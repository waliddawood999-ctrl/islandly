# Run against an extracted, existing native package; never builds or modifies binaries.
[CmdletBinding()]
param(
 [Parameter(Mandatory=$true)][string]$Package,
 [string]$OutputDirectory=(Join-Path (Get-Location) ('laptop-smoke-'+(Get-Date -Format 'yyyyMMdd-HHmmss'))),
 [ValidateSet('overlay','reserved-bar')][string]$Mode='overlay'
)
$ErrorActionPreference='Stop'
if([Environment]::OSVersion.Platform-ne 'Win32NT'){throw 'Requires an interactive Windows 11 laptop desktop'}
if([int](Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion').CurrentBuildNumber-lt 22000){throw 'Windows 11 required'}
Add-Type -AssemblyName System.Windows.Forms,System.Drawing
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class LaptopSmokeInput {
 delegate bool Callback(IntPtr h,IntPtr p);
 [DllImport("user32.dll")] static extern bool EnumWindows(Callback callback,IntPtr data);
 [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h,out uint pid);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern int GetWindowText(IntPtr h,System.Text.StringBuilder text,int size);
 [DllImport("user32.dll",SetLastError=true)] static extern IntPtr SendMessageTimeout(IntPtr h,uint msg,IntPtr a,IntPtr b,uint flags,uint timeout,out IntPtr result);
 public static IntPtr Host(int pid){IntPtr found=IntPtr.Zero;EnumWindows((h,p)=>{uint id;GetWindowThreadProcessId(h,out id);var text=new System.Text.StringBuilder(128);GetWindowText(h,text,128);if(id==pid&&text.ToString()=="Islandly Native"){found=h;return false;}return true;},IntPtr.Zero);if(found==IntPtr.Zero)throw new Exception("Native HWND missing");return found;}
 public static void Message(int pid,uint msg,int value){IntPtr result;if(SendMessageTimeout(Host(pid),msg,new IntPtr(value),IntPtr.Zero,2,5000,out result)==IntPtr.Zero)throw new Exception("Diagnostic message timed out");}
 [DllImport("user32.dll")] public static extern void keybd_event(byte key,byte scan,uint flags,UIntPtr extra);
 public static void Hotkey(){try{keybd_event(0x11,0,0,UIntPtr.Zero);keybd_event(0x12,0,0,UIntPtr.Zero);keybd_event(0x49,0,0,UIntPtr.Zero);}finally{keybd_event(0x49,0,2,UIntPtr.Zero);keybd_event(0x12,0,2,UIntPtr.Zero);keybd_event(0x11,0,2,UIntPtr.Zero);}}
}
'@
$Package=(Resolve-Path $Package).Path
New-Item $OutputDirectory -ItemType Directory -Force|Out-Null
$OutputDirectory=(Resolve-Path $OutputDirectory).Path
if(@(Get-ChildItem $OutputDirectory -Force).Count){throw 'OutputDirectory must be empty; use a fresh results folder'}
$probe=Join-Path $OutputDirectory 'probe';$profile=Join-Path $probe 'profile'
New-Item $profile -ItemType Directory -Force|Out-Null
$results=[Collections.Generic.List[object]]::new();$hostProcess=$null
$originalCursor=[Windows.Forms.Cursor]::Position
$configuration=@{idleEyes=$true;floating=$true;motion='full';ecoMode=$false;ecoAuto=$false;autoHide='never';uiLang='en';scale=1;islandMode=if($Mode-eq 'overlay'){'overlay'}else{'appbar'};islandVisibility='always';weather=$false;updates=$false;breakEvery=0;timeTracking=$false;prayerAlerts=$false;hideFullscreen=$true}
function Save-Settings {
 $temp=Join-Path $profile 'settings.tmp'
 [IO.File]::WriteAllText($temp,($configuration|ConvertTo-Json),[Text.UTF8Encoding]::new($false))
 Move-Item $temp (Join-Path $profile 'settings.json') -Force
}
function Read-Json($file){
 $stream=[IO.File]::Open($file,[IO.FileMode]::Open,[IO.FileAccess]::Read,([IO.FileShare]::ReadWrite-bor [IO.FileShare]::Delete))
 $reader=[IO.StreamReader]::new($stream)
 try{return ($reader.ReadToEnd()|ConvertFrom-Json)}finally{$reader.Dispose()}
}
function Status {
 if($null-eq $hostProcess-or $hostProcess.HasExited){throw 'Native host is not running'}
 [LaptopSmokeInput]::Message($hostProcess.Id,0x8022,0)
 $s=Read-Json (Join-Path $probe 'status.json')
 if($s.hostPid-ne $hostProcess.Id-or $null-eq $s.motion-or $null-eq $s.processes){throw 'Invalid diagnostic ownership/motion snapshot'}
 return $s
}
function Wait-State([scriptblock]$Condition,[string]$Description,[int]$Seconds=5){
 $end=[DateTime]::UtcNow.AddSeconds($Seconds)
 do{
  try{$s=Status;if(& $Condition $s){return $s};$lastError='state predicate was false'}catch{$lastError=$_.Exception.Message}
  Start-Sleep -Milliseconds 100
 }while([DateTime]::UtcNow-lt $end)
 throw "Timed out: $Description ($lastError)"
}
function Command($value){
 [IO.File]::WriteAllText((Join-Path $probe 'command.tmp'),$value)
 Move-Item (Join-Path $probe 'command.tmp') (Join-Path $probe 'command.txt') -Force
}
function Motion([int]$value){[LaptopSmokeInput]::Message($hostProcess.Id,0x8021,$value)}
function Far($s){$b=[Windows.Forms.Screen]::PrimaryScreen.Bounds;[Windows.Forms.Cursor]::Position=[Drawing.Point]::new(($b.Right-30),($b.Bottom-30))}
function Confirm($text){if((Read-Host "$text [type PASS to confirm]")-cne 'PASS'){throw 'User did not confirm PASS'}}
function Check($name,[scriptblock]$body){
 try{$detail=(& $body|Out-String).Trim();$results.Add([pscustomobject]@{Check=$name;Result='PASS';Detail=$detail})}
 catch{$results.Add([pscustomobject]@{Check=$name;Result='FAIL';Detail=$_.Exception.Message})}
 $results|Export-Csv (Join-Path $OutputDirectory 'results.csv') -NoTypeInformation
}
function Grab($s){
 $screen=[Windows.Forms.Screen]::PrimaryScreen.Bounds
 $x=[int][Math]::Max($screen.Left,$s.motion.center-300*$s.motion.scale)
 $y=[int]$s.motion.top
 $w=[int][Math]::Min(600*$s.motion.scale,$screen.Right-$x)
 $h=[int][Math]::Min(768*$s.motion.scale,$screen.Bottom-$y)
 $b=[Drawing.Bitmap]::new($w,$h);$g=[Drawing.Graphics]::FromImage($b)
 try{$g.CopyFromScreen($x,$y,0,0,$b.Size)}finally{$g.Dispose()}
 return $b
}
function Shot($name){$s=Status;$b=Grab $s;try{$b.Save((Join-Path $OutputDirectory ($name+'.png')),[Drawing.Imaging.ImageFormat]::Png)}finally{$b.Dispose()}}
function Quantile($values,$q){$a=@($values|Sort-Object);if(!$a.Count){throw 'No frame samples'};return $a[[Math]::Min($a.Count-1,[Math]::Floor($q*$a.Count))]}
function Transparency($tag){
 $s=Status;$screen=[Windows.Forms.Screen]::PrimaryScreen.Bounds
 if($s.motion.center-300*$s.motion.scale-lt $screen.Left-or $s.motion.center+300*$s.motion.scale-gt $screen.Right-or $s.motion.top+480*$s.motion.scale-gt $screen.Bottom){throw 'Capture requires the full centered island envelope on the primary screen'}
 Far $s;$configuration.islandVisibility='approach';Save-Settings
 $s=Wait-State {param($v)$v.motion.hidden} 'hidden reference';Start-Sleep -Milliseconds 900
 $reference=Grab $s;$reference.Save((Join-Path $OutputDirectory "$tag-reference.png"),[Drawing.Imaging.ImageFormat]::Png)
 try{
  $configuration.islandVisibility='always';Save-Settings
  $s=Wait-State {param($v)!$v.motion.hidden} 'visible island';Start-Sleep -Milliseconds 900
  Motion 3;$s=Status;$audit=$s.motion.alphaAudit
  $audit|ConvertTo-Json|Set-Content (Join-Path $OutputDirectory "$tag-alpha.json")
  if($null-eq $audit-or $audit.frames-lt 90-or $audit.leakPixels-ne 0){throw '90-frame composition alpha audit failed (required leakPixels=0)'}
  # Capture a burst without per-pixel processing in the timing-critical loop.
  foreach($direction in 1,0){
   $shots=[Collections.Generic.List[Drawing.Bitmap]]::new();$watch=[Diagnostics.Stopwatch]::StartNew()
   try{
    Motion $direction;$watch.Restart()
    while($watch.ElapsedMilliseconds-lt 450){$shots.Add((Grab $s));if($shots.Count-ge 120){break}}
    if($shots.Count-lt 5){throw 'Fewer than 5 captured animation frames'}
    $leaks=0;$counts=@();$sc=[double]$s.motion.scale
    for($i=0;$i-lt $shots.Count;$i++){
     $b=$shots[$i];$b.Save((Join-Path $OutputDirectory "$tag-$direction-$i.png"),[Drawing.Imaging.ImageFormat]::Png)
     $count=0
     # Full-height exterior bands, beyond the 440px open-card/overshoot envelope.
     for($y=0;$y-lt $b.Height;$y++){for($x=0;$x-lt $b.Width;$x++){
      if($x-ge (80*$sc)-and $x-lt (520*$sc)){continue}
      $a=$reference.GetPixel($x,$y);$p=$b.GetPixel($x,$y)
      if([Math]::Abs($a.R-$p.R)-gt 6-or [Math]::Abs($a.G-$p.G)-gt 6-or [Math]::Abs($a.B-$p.B)-gt 6){$count++}
     }}
     $leaks+=$count;$counts+=@{frame=$i;leakPixels=$count}
    }
    $counts|ConvertTo-Json|Set-Content (Join-Path $OutputDirectory "$tag-$direction-leaks.json")
    if($leaks-ne 0){throw "$tag direction=$direction desktop leakPixels=$leaks (required 0)"}
   }finally{foreach($b in $shots){$b.Dispose()}}
  }
  Confirm "Review $tag open/close PNGs in $OutputDirectory, including curved corners: no opaque or white rectangle outside the island shape"
  return '90 alpha frames: 0 leaks; captured open/close PNG exterior bands: 0 leaks (RGB tolerance 6); visual review confirmed'
 }finally{$reference.Dispose()}
}
try{
 Check 'Package identity and install' {
  $expected='758E43CF25850408FA42D7DE76565561AE329B353B8FACC508ECE9875BCD1592'
  $hash=(Get-FileHash (Join-Path $Package 'panels/Islandly.exe') -Algorithm SHA256).Hash
  if($hash-ne $expected){throw "Frozen panels executable mismatch: $hash"}
  foreach($file in 'Islandly.exe','Islandly.Motion.dll','panels/resources/app/package.json'){if(!(Test-Path (Join-Path $Package $file))){throw "Missing package file $file"}}
  Get-ChildItem $Package -Recurse -File|Where-Object {$_.Extension-in '.exe','.dll'}|ForEach-Object{[pscustomobject]@{Path=$_.FullName.Substring($Package.Length);SHA256=(Get-FileHash $_.FullName -Algorithm SHA256).Hash}}|Export-Csv (Join-Path $OutputDirectory 'binaries.csv') -NoTypeInformation
  Confirm 'Extract/install the approved package at the supplied path without disabling SAC; confirm no Windows policy/security block'
  "Frozen Electron SHA256=$hash; existing package only"
 }
 if($results[0].Result-ne 'PASS'){throw 'Package preflight failed; launch blocked'}
 Save-Settings
 Check 'Launch' {
  $hostProcess=Start-Process (Join-Path $Package 'Islandly.exe') -ArgumentList @('--root',('"'+(Join-Path $Package 'panels/resources/app')+'"'),'--profile',('"'+$profile+'"'),'--probe-dir',('"'+$probe+'"'),'--mode',$Mode,'--motion-metrics','--quiet-probe') -PassThru
  # Persist the process in the enclosing script scope (Check invokes a child scope).
  $script:hostProcess=$hostProcess
  $s=Wait-State {param($v)$v.phase-eq 'idle'-and !$v.motion.hidden} 'idle launch' 20
  Far $s;Shot 'launch';Confirm 'Island is visible and usable on this laptop';"hostPid=$($s.hostPid)"
 }
 if($null-eq $hostProcess-or $hostProcess.HasExited){throw 'Launch failed; dependent checks cannot run'}
 Check 'Ctrl+Alt+I' {
  $s=Status;if($s.hotkey-ne 'Ctrl+Alt+I'){throw "Requested hotkey unavailable; registered $($s.hotkey)"}
  [LaptopSmokeInput]::Hotkey();$s=Wait-State {param($v)$v.phase-eq 'panel'} 'real Ctrl+Alt+I panel launch' 30
  Shot 'hotkey';Confirm 'Ctrl+Alt+I opened the Islandly panel';Command 'close'
  [void](Wait-State {param($v)$v.phase-eq 'idle'} 'panel process shutdown' 20)
  'Real key events; panel ready; returned to idle'
 }
 Check 'Fullscreen hidden and top-edge reveal' {
  Far (Status)
  [void](Read-Host 'Prepare a static fullscreen app on the primary display. Press Enter, then Alt+Tab to it within 8 seconds; leave the cursor away from the top')
  Start-Sleep -Seconds 8
  $s=Wait-State {param($v)$v.motion.fullscreen-and $v.motion.hidden-and !$v.motion.eyesVisible-and !$v.motion.cursorTimer-and !$v.motion.frameLoop} 'fully hidden over fullscreen'
  Shot 'fullscreen-hidden'
  $screen=[Windows.Forms.Screen]::PrimaryScreen.Bounds
  [Windows.Forms.Cursor]::Position=[Drawing.Point]::new([int]$s.motion.center,($screen.Top+1))
  $s=Wait-State {param($v)$v.motion.fullscreen-and !$v.motion.hidden} 'top-edge hover reveal'
  Shot 'fullscreen-reveal';Far $s
  [void](Wait-State {param($v)$v.motion.fullscreen-and $v.motion.hidden} 'hidden after leaving')
  Confirm 'Return to PowerShell. Was the island completely hidden, revealed at the top edge, then hidden on leaving?'
  'Fullscreen hidden=true, eyes/timers off; top-edge reveal; leaving hides'
 }
 Check 'Always visible / show on approach' {
  Confirm 'Exit fullscreen and leave the desktop static (no video, notifications or moving wallpaper)'
  $configuration.islandVisibility='approach';Save-Settings;Far (Status)
  $s=Wait-State {param($v)$v.motion.hidden-and !$v.motion.cursorTimer-and !$v.motion.frameLoop} 'approach hidden'
  [Windows.Forms.Cursor]::Position=[Drawing.Point]::new([int]$s.motion.center,[int]($s.motion.top+10))
  $s=Wait-State {param($v)!$v.motion.hidden} 'approach reveal';Far $s
  [void](Wait-State {param($v)$v.motion.hidden} 'approach hide')
  $configuration.islandVisibility='always';Save-Settings
  [void](Wait-State {param($v)!$v.motion.hidden-and !$v.motion.fullscreen} 'always visible')
  'Approach hidden/reveal/hide; always visible with cursor far'
 }
 foreach($theme in 'light','dark'){
  Check "$theme theme" {
   Confirm "Set Windows Settings > Personalization > Colors > app mode to $theme; leave the desktop static"
   $want=$theme-eq 'light'
   $s=Wait-State {param($v)[bool]$v.motion.light-eq $want} "$theme native theme" 15
   Far $s;Start-Sleep -Milliseconds 500;Shot "$theme-island"
   Confirm "Island fill is $theme (not just the surrounding desktop)"
   "native motion.light=$($s.motion.light); visual confirmation saved"
  }
  Check "$theme opening transparency" {Transparency $theme}
 }
 Check 'Animation pacing and input' {
  $frames=@();$inputs=@()
  for($i=0;$i-lt 12;$i++){
   Motion 1;Start-Sleep -Milliseconds 340;$s=Status
   $frames+=@(Read-Json (Join-Path $probe 'motion-frames.json'));$inputs+=$s.motion.inputFirstMs
   Motion 0;Start-Sleep -Milliseconds 340
  }
  $active=@($frames|Where-Object {$_.body-gt .01-and $_.body-lt .99-and $_.interval-gt 0})
  $frames|ConvertTo-Json -Depth 10|Set-Content (Join-Path $OutputDirectory 'frames.json')
  $inputs|ConvertTo-Json|Set-Content (Join-Path $OutputDirectory 'input-ms.json')
  if($active.Count-lt 100-or $inputs.Count-ne 12-or @($inputs|Where-Object {$null-eq $_-or $_-lt 0}).Count-ne 0-or @($active|Where-Object {$null-eq $_.cpuMs-or $_.cpuMs-lt 0}).Count-ne 0){throw 'Insufficient frames/input observations'}
  $p95=Quantile $active.interval .95;$cpu=($active|Measure-Object cpuMs -Average).Average;$response=($inputs|Measure-Object -Maximum).Maximum
  if($p95-gt 16.667-or $cpu-ge 2-or $response-ge 50){throw "p95=$p95 ms; CPU=$cpu ms/frame; input=$response ms (limits 16.667/<2/<50)"}
  "frames=$($active.Count); p95=$p95 ms; CPU=$cpu ms/frame; max input=$response ms"
 }
 Check 'Idle RAM / ownership / CPU' {
  Command 'close';[void](Wait-State {param($v)$v.phase-eq 'idle'} 'idle' 20);Far (Status)
  Start-Sleep -Seconds 15;$samples=@();$hostProcess.Refresh()
  $lastCpu=$hostProcess.TotalProcessorTime.TotalMilliseconds;$watch=[Diagnostics.Stopwatch]::StartNew();$lastTime=0
  for($i=0;$i-lt 60;$i++){
   Start-Sleep -Seconds 1;$hostProcess.Refresh();$now=$watch.Elapsed.TotalMilliseconds;$cpu=$hostProcess.TotalProcessorTime.TotalMilliseconds
   $s=Status
   $samples+=@{totalMB=$s.totalMB;cpu=($cpu-$lastCpu)/($now-$lastTime)*100;phase=$s.phase;processes=@($s.processes).Count}
   $lastCpu=$cpu;$lastTime=$now
  }
  $samples|ConvertTo-Json -Depth 8|Set-Content (Join-Path $OutputDirectory 'idle.json')
  $peak=($samples|Measure-Object totalMB -Maximum).Maximum;$avgCpu=($samples|Measure-Object cpu -Average).Average
  if(@($samples|Where-Object {$_.phase-ne 'idle'-or $_.processes-ne 1-or $_.totalMB-le 0-or $_.totalMB-ge 180}).Count){throw 'Idle must own exactly one process and every working-set sample must be >0 and <180 MB'}
  if($avgCpu-ge .1){throw "Idle CPU $avgCpu% exceeds unchanged <0.1% one-core budget"}
  "60 samples after 15s warmup; peak=$peak MB; mean CPU=$avgCpu% of one core"
 }
}catch{
 $results.Add([pscustomobject]@{Check='Run completion';Result='FAIL';Detail=$_.Exception.Message})
}finally{
 if($null-ne $hostProcess-and !$hostProcess.HasExited){try{Command 'exit';if(!$hostProcess.WaitForExit(10000)){throw 'Host did not exit within 10s'}}catch{$results.Add([pscustomobject]@{Check='Cleanup';Result='FAIL';Detail=$_.Exception.Message})}}
 [Windows.Forms.Cursor]::Position=$originalCursor
 $results|Export-Csv (Join-Path $OutputDirectory 'results.csv') -NoTypeInformation
 $results|ConvertTo-Json -Depth 10|Set-Content (Join-Path $OutputDirectory 'results.json')
 $results|Format-Table Check,Result,Detail -Wrap -AutoSize
 Write-Host "Results: $OutputDirectory"
}
if(@($results|Where-Object {$_.Result-ne 'PASS'}).Count){exit 1}
Write-Host 'ALL LAPTOP SMOKE CHECKS GREEN';exit 0

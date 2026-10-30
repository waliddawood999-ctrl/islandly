param([ValidateSet('overlay','reserved-bar')][string]$Mode='overlay')
$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
Add-Type -AssemblyName System.Windows.Forms
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class MotionInput {
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] public static extern IntPtr FindWindow(string cls,string text);
 delegate bool Callback(IntPtr window,IntPtr data);
 [DllImport("user32.dll")]static extern bool EnumWindows(Callback callback,IntPtr data);
 [DllImport("user32.dll")]static extern uint GetWindowThreadProcessId(IntPtr window,out uint pid);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)]static extern int GetWindowText(IntPtr window,System.Text.StringBuilder text,int size);
 public static IntPtr Host(int owner){IntPtr result=IntPtr.Zero;EnumWindows((h,p)=>{uint id;GetWindowThreadProcessId(h,out id);var name=new System.Text.StringBuilder(128);GetWindowText(h,name,128);if(id==owner&&name.ToString()=="Islandly Native"){result=h;return false;}return true;},IntPtr.Zero);if(result==IntPtr.Zero)throw new Exception("Native host HWND not found");return result;}
 [DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr window,uint message,IntPtr a,IntPtr b);
 [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern int GetClassName(IntPtr window,System.Text.StringBuilder text,int size);
 [StructLayout(LayoutKind.Sequential)] struct RECT {public int left,top,right,bottom;}
 [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr window,out RECT rect);
 public static string Describe(IntPtr window){var cls=new System.Text.StringBuilder(128);GetClassName(window,cls,128);RECT r;GetWindowRect(window,out r);return "hwnd="+window.ToInt64()+" class="+cls+" rect="+r.left+","+r.top+","+r.right+","+r.bottom;}
}

public static class MotionProcessTree {
 [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)] struct ENTRY {public uint size,usage,id;public IntPtr heap;public uint module,threads,parent;public int priority;public uint flags;[MarshalAs(UnmanagedType.ByValTStr,SizeConst=260)]public string name;}
 [DllImport("kernel32.dll",SetLastError=true)]static extern IntPtr CreateToolhelp32Snapshot(uint flags,uint id);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode)]static extern bool Process32First(IntPtr snapshot,ref ENTRY entry);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode)]static extern bool Process32Next(IntPtr snapshot,ref ENTRY entry);
 [DllImport("kernel32.dll")]static extern bool CloseHandle(IntPtr value);
 public static int[] Children(int owner){IntPtr snapshot=CreateToolhelp32Snapshot(2,0);if(snapshot==new IntPtr(-1))throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
  try {var children=new System.Collections.Generic.List<int>();ENTRY e=new ENTRY();e.size=(uint)Marshal.SizeOf(e);if(!Process32First(snapshot,ref e))throw new Exception("Cannot enumerate processes");do{if(e.parent==owner)children.Add((int)e.id);}while(Process32Next(snapshot,ref e));return children.ToArray();}finally{CloseHandle(snapshot);}}
}

'@
$probe=Join-Path $env:TEMP ('Islandly-motion-perf-'+[guid]::NewGuid());$profile=Join-Path $probe 'profile'
New-Item $profile -ItemType Directory -Force|Out-Null
$configuration=@{idleEyes=$true;floating=$true;motion='full';ecoMode=$false;ecoAuto=$false;autoHide='never';uiLang='en';scale=1;islandMode=if($Mode-eq 'reserved-bar'){'appbar'}else{'overlay'};weather=$false;updates=$false;breakEvery=0;timeTracking=$false;prayerAlerts=$false;hideFullscreen=$true}
function Save-Settings {$configuration|ConvertTo-Json|Set-Content "$profile/settings.json" -Encoding utf8}
Save-Settings
$tool=& "$root/scripts/native-toolchain.ps1"
$refs=@('mscorlib','System','System.Core','System.Drawing','System.Windows.Forms')|ForEach-Object{'/reference:'+(Join-Path $tool.references ($_+'.dll'))}
$fullscreenExe=Join-Path $root 'native/bin/FullscreenFixture.exe'
& $tool.compiler /nologo /noconfig /nostdlib+ /target:exe "/out:$fullscreenExe" $refs "$root/test/native-fullscreen.cs"
if($LASTEXITCODE-ne 0){throw 'Fullscreen regression fixture compilation failed'}
$fullscreenProcess=$null
function Close-Fullscreen{if($null-ne $fullscreenProcess-and !$fullscreenProcess.HasExited){Set-Content "$probe/fullscreen-stop" 'stop';if(!$fullscreenProcess.WaitForExit(5000)){$fullscreenProcess.Kill()}}}
$hostProcess=Start-Process "$root/native/bin/Islandly.exe" -ArgumentList @('--root',('"'+$root+'"'),'--profile',('"'+$profile+'"'),'--probe-dir',('"'+$probe+'"'),'--mode',$Mode,'--motion-metrics','--quiet-probe') -PassThru
$owned=[Collections.Generic.HashSet[int]]::new()
$ast=[Management.Automation.Language.Parser]::ParseFile("$root/test/native-footprint.ps1",[ref]$null,[ref]$null)
foreach($name in @('Read-SharedJson','Read-Status')){$node=$ast.Find({param($n)$n-is [Management.Automation.Language.FunctionDefinitionAst]-and $n.Name-eq $name},$true);. ([scriptblock]::Create($node.Extent.Text))}
function Refresh {[void][MotionInput]::SendMessage(([MotionInput]::Host($hostProcess.Id)),0x8022,[IntPtr]::Zero,[IntPtr]::Zero)}
function Capture-Native {
 Refresh;$s=Read-Status;$m=$s.motion;$scale=$m.scale
 $x=[int]($m.center-69*$scale);$y=[int]$m.top;$bitmap=[Drawing.Bitmap]::new([int][Math]::Ceiling(138*$scale),[int][Math]::Ceiling(36*$scale));$graphics=[Drawing.Graphics]::FromImage($bitmap)
 try{$graphics.CopyFromScreen($x,$y,0,0,$bitmap.Size);New-Item "$root/out/t21" -ItemType Directory -Force|Out-Null;$file="$root/out/t21/native-desktop-$Mode.png";$bitmap.Save($file,[Drawing.Imaging.ImageFormat]::Png)
  $expected=if($m.light){@(12,12,18)}else{@(247,248,252)}
  foreach($centerX in @(20,42)){$ink=0;for($py=[int](4*$scale);$py-lt [int](34*$scale);$py++){for($px=[int](($centerX-10)*$scale);$px-lt [int](($centerX+10)*$scale);$px++){$p=$bitmap.GetPixel($px,$py);if([Math]::Abs($p.R-$expected[0])-le 8-and [Math]::Abs($p.G-$expected[1])-le 8-and [Math]::Abs($p.B-$expected[2])-le 8){$ink++}}}if($ink-lt 15){throw "Composited eye missing from real desktop: $centerX ink=$ink"}}
  Write-Output ('T21_DESKTOP_BASE64 '+[Convert]::ToBase64String([IO.File]::ReadAllBytes($file)))
 }finally{$graphics.Dispose();$bitmap.Dispose()}
}
function Quantile($values,$q){$ordered=@($values|Sort-Object);return $ordered[[Math]::Min($ordered.Count-1,[Math]::Floor($q*$ordered.Count))]}
function Phase($name,$moving){
 Refresh;$before=Read-Status
 Start-Sleep -Seconds 15;$samples=@();$watch=[Diagnostics.Stopwatch]::StartNew();$next=1000
 $hostProcess.Refresh();$lastCpu=$hostProcess.TotalProcessorTime.TotalMilliseconds;$lastTime=$watch.Elapsed.TotalMilliseconds
 for($i=0;$i-lt 60;){
  if($moving){$t=$watch.Elapsed.TotalSeconds;[Windows.Forms.Cursor]::Position=[Drawing.Point]::new([int]($center+110*[Math]::Sin($t*2)),[int]($top+100+15*[Math]::Cos($t*2)))}
  if($watch.ElapsedMilliseconds-ge $next){
   $hostProcess.Refresh();if($hostProcess.HasExited){throw 'Native host exited'}
   if([MotionProcessTree]::Children($hostProcess.Id).Length-ne 0){throw 'Native idle started a child process'}
   $now=$watch.Elapsed.TotalMilliseconds;$total=$hostProcess.TotalProcessorTime.TotalMilliseconds;$cpu=($total-$lastCpu)/($now-$lastTime)*100
   $samples+=@{totalMB=$hostProcess.WorkingSet64/1048576.0;totalCPU=$cpu;pid=$hostProcess.Id};$lastCpu=$total;$lastTime=$now;$i++;$next+=1000
  }
  Start-Sleep -Milliseconds 30
 }
 Refresh;$after=Read-Status
 if(@($after.processes).Count-ne 1-or $after.phase-ne 'idle'){throw 'Native idle retained an owned process'}
 $avg=($samples|ForEach-Object{$_.totalMB}|Measure-Object -Average).Average;$cpu=($samples|ForEach-Object{$_.totalCPU}|Measure-Object -Average).Average;$peak=($samples|ForEach-Object{$_.totalMB}|Measure-Object -Maximum).Maximum
 New-Item "$root/out/t21" -ItemType Directory -Force|Out-Null
 @{name=$name;averageMB=$avg;peakMB=$peak;averageCPU=$cpu;samples=$samples;before=$before.motion;after=$after.motion}|ConvertTo-Json -Depth 12|Set-Content "$root/out/t21/phase-$Mode-$name.json" -Encoding utf8
 Write-Output "MOTION PHASE RAW: $Mode $name RAM=$avg/$peak CPU=$cpu renders=$($after.motion.renders-$before.motion.renders) cursorReads=$($after.motion.cursorReads-$before.motion.cursorReads) start=$($before.motion|ConvertTo-Json -Compress) end=$($after.motion|ConvertTo-Json -Compress)"
 if($peak-ge 180){throw "$name RAM exceeds180 MB"}
 $limit=if($moving){.5}else{.1};if($cpu-ge $limit){throw "$name CPU $cpu exceeds $limit% of one core"}
 if(!$moving-and $after.motion.cursorReads-ne $before.motion.cursorReads){throw "$name polled a far/hidden cursor"}
 Write-Output "NATIVE MOTION PERF: $Mode $name RAM avg=$avg peak=$peak MB; CPU=$cpu%; cursorReads=$($after.motion.cursorReads-$before.motion.cursorReads)"
 return @{name=$name;averageMB=$avg;peakMB=$peak;averageCPU=$cpu;samples=$samples;before=$before.motion;after=$after.motion;method='external process CPU/working set,15s warmup/60samples; diagnostic status disk writes disabled; Toolhelp child detection; original T9 JobObject full guards remain separate'}
}

try{
 $deadline=[DateTime]::UtcNow.AddSeconds(20);while(!(Test-Path "$probe/status.json")){if($hostProcess.HasExited-or [DateTime]::UtcNow-gt $deadline){throw 'Native motion host did not start'};Start-Sleep -Milliseconds 100}
 $initial=Read-Status;$center=$initial.motion.center;$top=$initial.motion.top
 [Windows.Forms.Cursor]::Position=[Drawing.Point]::new([int]$center,[int]($top+400));Start-Sleep -Seconds 2
 Capture-Native
 $idle=Phase 'eyes-idle' $false
 [Windows.Forms.Cursor]::Position=[Drawing.Point]::new([int]$center,[int]($top+18));Start-Sleep -Milliseconds 150
 $moving=Phase 'eyes-moving' $true
 if($moving.after.cursorReads-$moving.before.cursorReads-lt 600){throw 'Moving eyes did not actually poll/track the near cursor'}
 [Windows.Forms.Cursor]::Position=[Drawing.Point]::new([int]$center,[int]($top+400));Start-Sleep -Seconds 2
 $configuration.ecoMode=$true;Save-Settings;Refresh
 $hidden=Phase 'eyes-hidden' $false
 if((Read-Status).motion.eyesVisible-or (Read-Status).motion.cursorTimer){throw 'Eco did not remove eyes and their timers'}
 $configuration.ecoMode=$false;Save-Settings;Refresh
 foreach($policy in @('reduced','off')){
  $configuration.motion=$policy;Save-Settings;Refresh;$s=Read-Status
  if($s.motion.cursorTimer-or ($policy-eq 'off'-and $s.motion.eyesVisible)-or ($policy-eq 'reduced'-and ($s.motion.gx-ne 0-or $s.motion.gy-ne 0-or $s.motion.lid-ne 0))){throw "$policy did not stop eye motion"}
 }
 $configuration.motion='full';Save-Settings;Refresh
 $fullscreenProcess=Start-Process $fullscreenExe -ArgumentList ('"'+$probe+'"') -PassThru
 $deadline=[DateTime]::UtcNow.AddSeconds(6);while(!(Test-Path "$probe/fullscreen-ready")-and !(Test-Path "$probe/fullscreen-not-foreground")){if($fullscreenProcess.HasExited-or [DateTime]::UtcNow-gt $deadline){throw 'Fullscreen fixture did not start'};Start-Sleep -Milliseconds 20}
 function Dump-Fullscreen($reason){$screen=[Windows.Forms.Screen]::PrimaryScreen.Bounds;Write-Output "FULLSCREEN DIAGNOSTIC ($reason): foreground=$([MotionInput]::Describe([MotionInput]::GetForegroundWindow())) monitor=$($screen.Left),$($screen.Top),$($screen.Right),$($screen.Bottom) fixture=$(Get-Content "$probe/fullscreen-ready","$probe/fullscreen-not-foreground" -ErrorAction SilentlyContinue) status=$((Read-Status).motion|ConvertTo-Json -Compress)"}
 if(Test-Path "$probe/fullscreen-not-foreground"){Dump-Fullscreen 'fixture never became the foreground window';Close-Fullscreen;throw 'Fullscreen fixture could not take the foreground (environment), host policy untested'}
 # The fixture announces readiness only when foreground; allow up to 2 s for the host to see it.
 $fixtureWindow=[IntPtr][int64](Get-Content "$probe/fullscreen-ready" -Raw).Trim();$until=[DateTime]::UtcNow.AddSeconds(2);while([MotionInput]::GetForegroundWindow()-ne $fixtureWindow-and [DateTime]::UtcNow-lt $until){Start-Sleep -Milliseconds 50}
 $until=[DateTime]::UtcNow.AddSeconds(2);do{Refresh;$fullscreen=Read-Status;if($fullscreen.motion.fullscreen-and !$fullscreen.motion.eyesVisible-and !$fullscreen.motion.cursorTimer){break};Start-Sleep -Milliseconds 100}while([DateTime]::UtcNow-lt $until)
 if(!($fullscreen.motion.fullscreen-and !$fullscreen.motion.eyesVisible-and !$fullscreen.motion.cursorTimer)){Dump-Fullscreen 'host did not hide'}
 try{Refresh;$fullscreen=Read-Status;if(!$fullscreen.motion.fullscreen-or $fullscreen.motion.eyesVisible-or $fullscreen.motion.cursorTimer){throw 'Real fullscreen foreground did not hide eyes/timers'}}finally{Close-Fullscreen}
 Refresh
 # 'Show on mouse approach': hidden (no eyes, no timers) until the cursor nears the island, hidden again when it leaves; 'always' restores it.
 function Wait-Island($visible){$until=[DateTime]::UtcNow.AddSeconds(3);do{Refresh;$s=Read-Status;if([bool]$s.motion.eyesVisible-eq $visible){return $s};Start-Sleep -Milliseconds 100}while([DateTime]::UtcNow-lt $until);throw "Island visibility never became $visible"}
 $configuration.islandVisibility='approach';Save-Settings;$s=Wait-Island $false
 if($s.motion.cursorTimer-or $s.motion.frameLoop){throw 'Approach mode left timers running while hidden'}
 [Windows.Forms.Cursor]::Position=[Drawing.Point]::new([int]$s.motion.center,[int]($s.motion.top+10));$s=Wait-Island $true
 [Windows.Forms.Cursor]::Position=[Drawing.Point]::new([int]$s.motion.center,[int]($s.motion.top+500));$s=Wait-Island $false
 $configuration.islandVisibility='always';Save-Settings;$s=Wait-Island $true
 Write-Output 'NATIVE ISLAND VISIBILITY: approach hides, cursor near reveals, leaving hides, always restores'
 # Transparency: pixels outside the island/card shape (the bounding-box corners) must show the desktop exactly as when the island is hidden. Reference = hidden capture, shot = visible capture.
 function Grab($x,$y,$w,$h){$b=[Drawing.Bitmap]::new($w,$h);$g=[Drawing.Graphics]::FromImage($b);try{$g.CopyFromScreen($x,$y,0,0,$b.Size)}finally{$g.Dispose()};return $b}
 function Assert-Transparent($name,$reference,$shot){
  New-Item "$root/out/t21" -ItemType Directory -Force|Out-Null;$reference.Save("$root/out/t21/transparency-$Mode-$name-hidden.png",[Drawing.Imaging.ImageFormat]::Png);$shot.Save("$root/out/t21/transparency-$Mode-$name-visible.png",[Drawing.Imaging.ImageFormat]::Png)
  $w=$shot.Width;$h=$shot.Height
  foreach($point in @(@(1,1),@(($w-2),1),@(1,($h-2)),@(($w-2),($h-2)))){
   $a=$reference.GetPixel($point[0],$point[1]);$b=$shot.GetPixel($point[0],$point[1]);Write-Output "TRANSPARENCY RGB ($name at $($point -join ',')): hidden $($a.R),$($a.G),$($a.B) vs island $($b.R),$($b.G),$($b.B)"
   if([Math]::Abs($a.R-$b.R)-gt 6-or [Math]::Abs($a.G-$b.G)-gt 6-or [Math]::Abs($a.B-$b.B)-gt 6){throw "$name has an opaque/tinted pixel outside the island shape at $($point -join ',') (desktop $($a.R),$($a.G),$($a.B) vs $($b.R),$($b.G),$($b.B))"}
  }
  $shot.Dispose()
 }
 $far=[Drawing.Point]::new([int]($s.motion.center+420),[int][Math]::Min(700,$s.motion.top+600))
 # Honest reference: the island is HIDDEN (Show on approach, cursor far), so no host window covers the sample points. Approach mode never reserves the strip, so the layout under the capture is identical when the cursor reveals the island.
 $cx=[int]$s.motion.center;$ty=[int]$s.motion.top;$sc=[double]$s.motion.scale
 $configuration.islandVisibility='approach';Save-Settings;[Windows.Forms.Cursor]::Position=$far;$s=Wait-Island $false;Start-Sleep -Milliseconds 900
 $barBox=@(($cx-[int](69*$sc)),$ty,[int][Math]::Ceiling(138*$sc),[int][Math]::Ceiling(36*$sc));$cardBox=@(($cx-[int](220*$sc)),$ty,[int][Math]::Ceiling(440*$sc),[int][Math]::Ceiling(480*$sc)) # 40 px of margin each side: the open spring overshoots the nominal 360 px card, so the box corners must lie clear of the animated shape
 $barReference=Grab $barBox[0] $barBox[1] $barBox[2] $barBox[3];$cardReference=Grab $cardBox[0] $cardBox[1] $cardBox[2] $cardBox[3]
 [Windows.Forms.Cursor]::Position=[Drawing.Point]::new($cx,[int]($ty+10));$s=Wait-Island $true;Start-Sleep -Milliseconds 700
 Assert-Transparent 'bar' $barReference (Grab $barBox[0] $barBox[1] $barBox[2] $barBox[3])
 function Assert-CornersMatch($name,$reference,$shot){$w=$shot.Width;$h=$shot.Height;if(-not $script:cornerLogged){$script:cornerLogged=$true;Write-Output "TRANSPARENCY RGB ($name first frame at 1,1): hidden $($reference.GetPixel(1,1).R),$($reference.GetPixel(1,1).G),$($reference.GetPixel(1,1).B) vs frame $($shot.GetPixel(1,1).R),$($shot.GetPixel(1,1).G),$($shot.GetPixel(1,1).B)"};foreach($point in @(@(1,1),@(($w-2),1),@(1,($h-2)),@(($w-2),($h-2)))){$x=$reference.GetPixel($point[0],$point[1]);$y=$shot.GetPixel($point[0],$point[1]);if([Math]::Abs($x.R-$y.R)-gt 6-or [Math]::Abs($x.G-$y.G)-gt 6-or [Math]::Abs($x.B-$y.B)-gt 6){$minX=99999;$minY=99999;$maxX=-1;$maxY=-1;$diffCount=0;for($gy=0;$gy-lt $h;$gy+=4){for($gx=0;$gx-lt $w;$gx+=4){$p=$reference.GetPixel($gx,$gy);$q=$shot.GetPixel($gx,$gy);if([Math]::Abs($p.R-$q.R)-gt 6-or [Math]::Abs($p.G-$q.G)-gt 6-or [Math]::Abs($p.B-$q.B)-gt 6){$diffCount++;if($gx-lt $minX){$minX=$gx};if($gy-lt $minY){$minY=$gy};if($gx-gt $maxX){$maxX=$gx};if($gy-gt $maxY){$maxY=$gy}}}};Write-Output "TRANSPARENCY DIFF ($name, 4 px grid, box $w x $h): differing samples=$diffCount bounds=($minX,$minY)-($maxX,$maxY)";New-Item "$root/out/t21" -ItemType Directory -Force|Out-Null;$tag=($name -replace ' ','-');$shot.Save("$root/out/t21/transparency-failure-$Mode-$tag-shot.png",[Drawing.Imaging.ImageFormat]::Png);$reference.Save("$root/out/t21/transparency-failure-$Mode-$tag-reference.png",[Drawing.Imaging.ImageFormat]::Png);throw "$name frame shows an opaque/tinted pixel outside the island shape at $($point -join ',') (reference $($x.R),$($x.G),$($x.B) vs frame $($y.R),$($y.G),$($y.B))"}}}
 # Which surface? The host reads its own DirectComposition surface back for every frame of a simulated open and close (frame 0 included) and counts non-transparent pixels outside the island's bounding box. 0 here while the screen differs means the tint comes from outside the composition surface (window material, region, halo, another window).
 [void][MotionInput]::SendMessage(([MotionInput]::Host($hostProcess.Id)),0x8021,[IntPtr]3,[IntPtr]::Zero);Start-Sleep -Milliseconds 400;Refresh;$audit=(Read-Status).motion.alphaAudit
 Write-Output "ALPHA AUDIT (composition surface outside the island, open and close frame by frame): frames=$($audit.frames) leakPixels=$($audit.leakPixels) first=($($audit.firstX),$($audit.firstY))"
 if($null-eq $audit-or $audit.frames-lt 90-or $audit.leakPixels-ne 0){throw "Composition surface is not transparent outside the island: frames=$($audit.frames) leakPixels=$($audit.leakPixels) first=($($audit.firstX),$($audit.firstY))"}
 # During the open and the close animation every captured frame must keep the corners (outside the shape) transparent.
 foreach($direction in @(@{message=1;name='open'},@{message=0;name='close'})){
  [void][MotionInput]::SendMessage(([MotionInput]::Host($hostProcess.Id)),0x8021,[IntPtr]$direction.message,[IntPtr]::Zero)
  $frames=0;$watch=[Diagnostics.Stopwatch]::StartNew()
  while($watch.ElapsedMilliseconds-lt 450){$shot=Grab $cardBox[0] $cardBox[1] $cardBox[2] $cardBox[3];Assert-CornersMatch "card $($direction.name)" $cardReference $shot;$frames++;if($direction.message-eq 1-and $watch.ElapsedMilliseconds-gt 300){$last=$shot}else{$shot.Dispose()}}
  if($frames-lt 5){throw "Transparency sampling captured only $frames frames during $($direction.name)"}
  if($direction.message-eq 1){Assert-Transparent 'card' $cardReference $last}
 }
 $configuration.islandVisibility='always';Save-Settings;Start-Sleep -Milliseconds 300;Refresh
 Write-Output 'NATIVE TRANSPARENCY: corner pixels outside the bar and the open card match the desktop'
 # Real Win32 message dispatch: input timestamp is captured at UI dispatch, never at a later timer.
 $frames=@();$inputs=@()
 for($n=0;$n-lt 12;$n++){
  [void][MotionInput]::SendMessage(([MotionInput]::Host($hostProcess.Id)),0x8021,[IntPtr]1,[IntPtr]::Zero);Start-Sleep -Milliseconds 340;Refresh
  $frames+=Get-Content "$probe/motion-frames.json" -Raw|ConvertFrom-Json;$inputs+=(Read-Status).motion.inputFirstMs
  [void][MotionInput]::SendMessage(([MotionInput]::Host($hostProcess.Id)),0x8021,[IntPtr]::Zero,[IntPtr]::Zero);Start-Sleep -Milliseconds 340
 }
 if(@($inputs|Where-Object {$_-lt 0}).Count-ne 0-or $inputs.Count-ne 12){throw 'Native input measurement never observed a changed frame'}
 [void][MotionInput]::SendMessage(([MotionInput]::Host($hostProcess.Id)),0x8021,[IntPtr]1,[IntPtr]::Zero);Start-Sleep -Milliseconds 340
 [void][MotionInput]::SendMessage(([MotionInput]::Host($hostProcess.Id)),0x8021,[IntPtr]2,[IntPtr]::Zero);Start-Sleep -Milliseconds 160;Refresh
 $measured=Read-Status;$resizeFrames=@(Get-Content "$probe/motion-frames.json" -Raw|ConvertFrom-Json|Where-Object{$_.resizing})
 if([Math]::Abs($measured.motion.cardHeight-300)-gt .1-or $resizeFrames.Count-lt 4){throw 'Measured card size did not ease over120ms'}
 [void][MotionInput]::SendMessage(([MotionInput]::Host($hostProcess.Id)),0x8021,[IntPtr]::Zero,[IntPtr]::Zero)
 $active=@($frames|Where-Object {$_.body-gt .01-and $_.body-lt .99-and $_.interval-gt 0})
 if($active.Count-lt 100){throw 'Insufficient native motion frames'}
 $p50=Quantile $active.interval .5;$p95=Quantile $active.interval .95;$cpu=($active|Measure-Object cpuMs -Average).Average;$response=($inputs|Measure-Object -Maximum).Maximum
 # DWM's nominal60 Hz period is16.667ms. Retain every raw interval and fail missed budgets.
 $late=@($active|Where-Object {$_.interval-gt 16.667}).Count
 if($p95-gt 16.667-or $response-ge 50-or $cpu-ge 2){throw "Native motion failed60fps/input/CPU: p95=$p95 response=$response cpu=$cpu late=$late"}
 New-Item "$root/out/t21" -ItemType Directory -Force|Out-Null
 @{mode=$Mode;idle=$idle;moving=$moving;hidden=$hidden;liquid=@{frameP50=$p50;frameP95=$p95;lateFrames=$late;frameCpuAverageMs=$cpu;inputMaxMs=$response;inputSamples=$inputs;frames=$frames;measuredResizeFrames=$resizeFrames};hardware='Windows CI single monitor; laptop SAC/second physical monitor/144Hz not run'}|ConvertTo-Json -Depth 14|Set-Content "$root/out/t21/perf-$Mode.json" -Encoding utf8
 Write-Output "NATIVE LIQUID: $Mode frame p50/p95=$p50/$p95 ms, CPU mean=$cpu ms/frame, input max=$response ms, >16.667ms=$late"
}finally{
 try{Close-Fullscreen;Refresh;Write-Output ('MOTION LAST STATUS: '+((Read-Status)|ConvertTo-Json -Compress -Depth 8))}catch{}
 if(!$hostProcess.HasExited){Set-Content "$probe/command.txt" 'exit';if(!$hostProcess.WaitForExit(10000)){$hostProcess.Kill()}}
 New-Item "$root/out/t21/logs-$Mode" -ItemType Directory -Force|Out-Null
 if(Test-Path "$profile/native-panels.log"){Get-Content "$profile/native-panels.log"|Select-Object -Last 25}
 Copy-Item "$profile/*.log","$probe/status.json","$probe/motion-frames.json" "$root/out/t21/logs-$Mode" -Force -ErrorAction SilentlyContinue
}

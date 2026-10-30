param([ValidateSet('overlay','reserved-bar')][string]$Mode='overlay')
$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
Add-Type -AssemblyName System.Windows.Forms
Add-Type @'
using System;using System.Runtime.InteropServices;using System.Text;
public static class IslandQaInput {
 delegate bool Visit(IntPtr h,IntPtr p);
 [DllImport("user32.dll")]static extern bool EnumWindows(Visit v,IntPtr p);
 [DllImport("user32.dll")]static extern uint GetWindowThreadProcessId(IntPtr h,out uint pid);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)]static extern int GetWindowText(IntPtr h,StringBuilder s,int n);
 [DllImport("user32.dll")]public static extern IntPtr SendMessage(IntPtr h,uint m,IntPtr w,IntPtr l);
 [DllImport("user32.dll")]public static extern bool IsWindowVisible(IntPtr h);
 [DllImport("user32.dll")]public static extern IntPtr GetForegroundWindow();
 public static IntPtr Host(int pid){IntPtr found=IntPtr.Zero;EnumWindows((h,p)=>{uint id;GetWindowThreadProcessId(h,out id);var s=new StringBuilder(100);GetWindowText(h,s,100);if(id==pid&&s.ToString()=="Islandly Native"){found=h;return false;}return true;},IntPtr.Zero);return found;}
}
'@
$tool=& "$root/scripts/native-toolchain.ps1"
$refs=@('mscorlib','System','System.Core','System.Drawing','System.Windows.Forms')|ForEach-Object{'/reference:'+(Join-Path $tool.references ($_+'.dll'))}
$fixtureExe="$root/native/bin/IslandDesktopFixture.exe"
& $tool.compiler /nologo /noconfig /nostdlib+ /target:exe "/out:$fixtureExe" $refs "$root/test/island-desktop-fixture.cs"
if($LASTEXITCODE-ne 0){throw 'Desktop fixture compilation failed'}
$out="$root/out/t24/desktop-$Mode";New-Item $out -ItemType Directory -Force|Out-Null
$reg='HKCU:\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize'
New-Item $reg -Force|Out-Null
$original=(Get-ItemProperty $reg -Name AppsUseLightTheme -ErrorAction SilentlyContinue).AppsUseLightTheme
$rows=@()
function Read-Json($file){$f=[IO.File]::Open($file,[IO.FileMode]::Open,[IO.FileAccess]::Read,([IO.FileShare]::ReadWrite-bor [IO.FileShare]::Delete));try{$r=[IO.StreamReader]::new($f);try{return $r.ReadToEnd()|ConvertFrom-Json}finally{$r.Dispose()}}finally{$f.Dispose()}}
function Save-Settings{$configuration|ConvertTo-Json|Set-Content "$profile/settings.json" -Encoding utf8}
function Refresh{[void][IslandQaInput]::SendMessage($window,0x8022,[IntPtr]::Zero,[IntPtr]::Zero);return Read-Json "$probe/status.json"}
function Wait-State($test,$label){$until=[DateTime]::UtcNow.AddSeconds(5);do{$s=Refresh;if(&$test $s){return $s};Start-Sleep -Milliseconds 25}while([DateTime]::UtcNow-lt $until);throw "$label : $($s|ConvertTo-Json -Depth 8 -Compress)"}
function Command($name){Set-Content "$probe/fixture-command" $name;$until=[DateTime]::UtcNow.AddSeconds(5);do{if((Test-Path "$probe/fixture-state")-and (Get-Content "$probe/fixture-state" -Raw).Trim()-eq $name){return};Start-Sleep -Milliseconds 25}while([DateTime]::UtcNow-lt $until);throw "Fixture command $name not acknowledged"}
function Grab{ $b=[Windows.Forms.Screen]::PrimaryScreen.Bounds;$image=[Drawing.Bitmap]::new($b.Width,$b.Height);$g=[Drawing.Graphics]::FromImage($image);try{$g.CopyFromScreen($b.Left,$b.Top,0,0,$image.Size)}finally{$g.Dispose()};return $image}
function Screenshot($name){$image=Grab;try{$image.Save("$out/$scene-$name.png",[Drawing.Imaging.ImageFormat]::Png)}finally{$image.Dispose()}}
function Move-Far{[Windows.Forms.Cursor]::Position=[Drawing.Point]::new(20,220)}
try{foreach($theme in @('light','dark')){Set-ItemProperty $reg AppsUseLightTheme ([int]($theme-eq 'light'))
 foreach($lang in @('ar','en')){
  $scene="$lang-$theme";$probe=Join-Path $env:TEMP ('Islandly-T24-'+[guid]::NewGuid());$profile="$probe/profile";New-Item $profile -ItemType Directory -Force|Out-Null
  $configuration=@{idleEyes=$true;floating=$true;motion='full';ecoMode=$false;ecoAuto=$false;autoHide='never';uiLang=$lang;scale=1;islandVisibility='always';islandMode=if($Mode-eq 'reserved-bar'){'appbar'}else{'overlay'};hideFullscreen=$true;weather=$false;updates=$false;breakEvery=0;prayerAlerts=$false;timeTracking=$false}
  Save-Settings;$hostProcess=$null;$fixture=$null;$baseline=$null
  try{
   Move-Far
   $fixture=Start-Process $fixtureExe -ArgumentList @(('"'+$probe+'"'),$theme) -PassThru
   $until=[DateTime]::UtcNow.AddSeconds(10);while(!(Test-Path "$probe/fixture-ready")){if($fixture.HasExited-or [DateTime]::UtcNow-gt $until){throw 'Foreground fixture failed'};Start-Sleep -Milliseconds 50}
   $foreign=[IntPtr][long](Get-Content "$probe/fixture-ready");$baseline=Grab;$baseline.Save("$out/$scene-fullscreen-reference.png",[Drawing.Imaging.ImageFormat]::Png)
   $hostProcess=Start-Process "$root/native/bin/Islandly.exe" -ArgumentList @('--root',('"'+$root+'"'),'--profile',('"'+$profile+'"'),'--probe-dir',('"'+$probe+'"'),'--mode',$Mode,'--quiet-probe') -PassThru
   $until=[DateTime]::UtcNow.AddSeconds(15);do{$window=[IslandQaInput]::Host($hostProcess.Id);if($hostProcess.HasExited-or [DateTime]::UtcNow-gt $until){throw 'Native host failed to start'};Start-Sleep -Milliseconds 50}while($window-eq [IntPtr]::Zero-or !(Test-Path "$probe/status.json"))
   $s=Wait-State {param($s)$s.motion.fullscreen-and $s.motion.hidden-and !$s.motion.windowVisible} 'Fullscreen must hide the WHOLE island'
   if([IslandQaInput]::IsWindowVisible($window)){throw 'Fullscreen left owner HWND visible'}
   if($s.motion.light-ne ($theme-eq 'light')){throw 'Native island did not use actual Windows theme'}
   Start-Sleep -Milliseconds 100
   $hiddenShot=Grab;try{for($y=4;$y-lt 650;$y+=8){for($x=220;$x-lt 804;$x+=8){$a=$baseline.GetPixel($x,$y);$b=$hiddenShot.GetPixel($x,$y);if([Math]::Abs($a.R-$b.R)-gt 6-or [Math]::Abs($a.G-$b.G)-gt 6-or [Math]::Abs($a.B-$b.B)-gt 6){throw "Fullscreen left visible island pixels at $x,$y"}}}}finally{$hiddenShot.Dispose()}
   Screenshot 'fullscreen-hidden'
   # Cursor inside old pill bounds is not enough: ONLY the top-edge strip may reveal it.
   [Windows.Forms.Cursor]::Position=[Drawing.Point]::new([int]$s.motion.center,[int]($s.motion.top+18));Start-Sleep -Milliseconds 150;$s=Refresh
   if(!$s.motion.hidden){throw 'Fullscreen island revealed away from top edge'}
   [Windows.Forms.Cursor]::Position=[Drawing.Point]::new([int]$s.motion.center,1)
   $s=Wait-State {param($s)!$s.motion.hidden-and $s.motion.windowVisible} 'Top-edge hover did not reveal island'
   if([IslandQaInput]::GetForegroundWindow()-ne $foreign){throw 'Hover stole fullscreen foreground'}
   Screenshot 'fullscreen-edge-reveal';Move-Far
   $s=Wait-State {param($s)$s.motion.hidden-and !$s.motion.windowVisible} 'Leaving edge did not rehide island'
   Screenshot 'fullscreen-left-hidden'
   # Same HWND becomes a normal window; no500ms cached fullscreen result allowed.
   Command 'normal';$s=Wait-State {param($s)!$s.motion.fullscreen-and !$s.motion.hidden-and $s.motion.windowVisible} 'Always-visible outside fullscreen'
   Screenshot 'normal-always'
   $configuration.islandVisibility='approach';Save-Settings;$s=Wait-State {param($s)$s.motion.hidden-and !$s.motion.windowVisible} 'Approach ignored far cursor';Screenshot 'normal-approach-hidden'
   [Windows.Forms.Cursor]::Position=[Drawing.Point]::new([int]$s.motion.center,[int]($s.motion.top+18))
   $s=Wait-State {param($s)!$s.motion.hidden-and $s.motion.windowVisible} 'Approach ignored near cursor';Screenshot 'normal-approach-visible';Move-Far
   $s=Wait-State {param($s)$s.motion.hidden} 'Approach failed to rehide'
   # Hidden reference is genuine, over a static textured fixture. Compare every captured animation frame's outer pixels.
   Start-Sleep -Milliseconds 300;$reference=Grab
   try{
    $configuration.islandVisibility='always';Save-Settings;$s=Wait-State {param($s)!$s.motion.hidden} 'Always restore';Start-Sleep -Milliseconds 200
    foreach($direction in @(1,0)){
     [void][IslandQaInput]::SendMessage($window,0x8021,[IntPtr]$direction,[IntPtr]::Zero);$watch=[Diagnostics.Stopwatch]::StartNew();$count=0
     do{$shot=Grab;try{
       $cx=[int]$s.motion.center;$top=[int]$s.motion.top
       foreach($point in @(@(($cx-298),($top+2)),@(($cx+298),($top+2)),@(($cx-298),($top+480)),@(($cx+298),($top+480)))){
        $x=[int]$point[0];$y=[int]$point[1];$a=$reference.GetPixel($x,$y);$b=$shot.GetPixel($x,$y)
        if([Math]::Abs($a.R-$b.R)-gt 6-or [Math]::Abs($a.G-$b.G)-gt 6-or [Math]::Abs($a.B-$b.B)-gt 6){throw 'Desktop composition has rectangle outside animated island'}
       }
       $shot.Save("$out/$scene-animation-$direction-$count.png",[Drawing.Imaging.ImageFormat]::Png);$count++
      }finally{$shot.Dispose()}
     }while($watch.ElapsedMilliseconds-lt 500)
     if($count-lt 5){throw 'Insufficient real desktop animation frames'}
     $rows+=@{scene=$scene;direction=$direction;desktopFrames=$count;mode=$Mode}
    }
   }finally{$reference.Dispose()}
   $s=Refresh;if(@($s.processes).Count-ne 1-or $s.phase-ne 'idle'-or $s.launchCount-ne 0){throw 'Requirements QA launched Electron or retained child process'}
   $hostProcess.Refresh();if($hostProcess.WorkingSet64/1MB-ge 180){throw 'Requirements host RAM exceeds180MB'}
   $rows+=@{scene=$scene;mode=$Mode;status=$s;workingSetMB=$hostProcess.WorkingSet64/1MB}
  }finally{
   if($hostProcess-and !$hostProcess.HasExited){Set-Content "$probe/command.txt" 'exit';if(!$hostProcess.WaitForExit(3000)){$hostProcess.Kill()}}
   if($fixture-and !$fixture.HasExited){Set-Content "$probe/fixture-command" 'stop';if(!$fixture.WaitForExit(3000)){$fixture.Kill()}}
   if($baseline){$baseline.Dispose()}
   Copy-Item "$profile/native-panels.log" "$out/$scene-native.log" -ErrorAction SilentlyContinue
  }
 }
}}finally{if($null-eq $original){Remove-ItemProperty $reg AppsUseLightTheme -ErrorAction SilentlyContinue}else{Set-ItemProperty $reg AppsUseLightTheme $original};$rows|ConvertTo-Json -Depth 14|Set-Content "$out/requirements.json" -Encoding utf8}
Write-Output "T24 DESKTOP PASS $Mode : RTL/LTR Windows light/dark fullscreen top-edge, visibility setting, every captured open/close frame; no Electron"

# Small real-desktop contact sheet is both an artifact and a log-readable visual review aid.
$board=[Drawing.Bitmap]::new(1024,880);$drawing=[Drawing.Graphics]::FromImage($board);$font=[Drawing.Font]::new('Segoe UI',11)
try{$drawing.Clear([Drawing.Color]::White);$row=0
 foreach($theme in @('light','dark')){foreach($lang in @('ar','en')){$col=0
  foreach($state in @('fullscreen-hidden','fullscreen-edge-reveal','normal-always','normal-approach-hidden')){
   $image=[Drawing.Bitmap]::new("$out/$lang-$theme-$state.png");try{$drawing.DrawString("$lang / $theme / $state",$font,[Drawing.Brushes]::Black,$col*256,($row*220));$drawing.DrawImage($image,[Drawing.Rectangle]::new(($col*256),($row*220+25),256,192))}finally{$image.Dispose()};$col++
  };$row++
 }}
 $preview="$out/preview.png";$board.Save($preview,[Drawing.Imaging.ImageFormat]::Png);Write-Output ('T24_DESKTOP_PREVIEW_BASE64 '+[Convert]::ToBase64String([IO.File]::ReadAllBytes($preview)))
}finally{$font.Dispose();$drawing.Dispose();$board.Dispose()}

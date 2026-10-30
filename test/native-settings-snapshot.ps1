# Force each incomplete generation to remain on disk during synchronous host refresh.
# The old deserializer accepts empty/null as null, poisons settings and never publishes.
$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class SettingsInput {
 delegate bool Callback(IntPtr window,IntPtr data);
 [DllImport("user32.dll")]static extern bool EnumWindows(Callback callback,IntPtr data);
 [DllImport("user32.dll")]static extern uint GetWindowThreadProcessId(IntPtr window,out uint pid);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)]static extern int GetWindowText(IntPtr window,System.Text.StringBuilder text,int size);
 [DllImport("user32.dll")]public static extern IntPtr SendMessage(IntPtr window,uint message,IntPtr a,IntPtr b);
 public static IntPtr Host(int owner){IntPtr result=IntPtr.Zero;EnumWindows((h,p)=>{uint id;GetWindowThreadProcessId(h,out id);var title=new System.Text.StringBuilder(128);GetWindowText(h,title,128);if(id==owner&&title.ToString()=="Islandly Native"){result=h;return false;}return true;},IntPtr.Zero);if(result==IntPtr.Zero)throw new Exception("Settings regression host not found");return result;}
}
'@
$probe=Join-Path $env:TEMP ('Islandly-settings-snapshot-'+[guid]::NewGuid());$profile=Join-Path $probe 'profile';$Mode='settings-snapshot'
New-Item $profile -ItemType Directory -Force|Out-Null
$settings=@{idleEyes=$true;ecoMode=$false;ecoAuto=$false;motion='full';autoHide='never';hideFullscreen=$false;weather=$false;updates=$false;timeTracking=$false;breakEvery=0;prayerAlerts=$false;uiLang='en'}
$file="$profile/settings.json";[IO.File]::WriteAllText($file,($settings|ConvertTo-Json))
$owned=[Collections.Generic.HashSet[int]]::new()
$ast=[Management.Automation.Language.Parser]::ParseFile("$root/test/native-footprint.ps1",[ref]$null,[ref]$null)
foreach($name in @('Read-SharedJson','Read-Status')){$node=$ast.Find({param($n)$n-is [Management.Automation.Language.FunctionDefinitionAst]-and $n.Name-eq $name},$true);. ([scriptblock]::Create($node.Extent.Text))}
$hostProcess=Start-Process "$root/native/bin/Islandly.exe" -ArgumentList @('--root',('"'+$root+'"'),'--profile',('"'+$profile+'"'),'--probe-dir',('"'+$probe+'"'),'--quiet-probe') -PassThru
try{
 $until=[DateTime]::UtcNow.AddSeconds(20);while(!(Test-Path "$probe/status.json")){if($hostProcess.HasExited-or [DateTime]::UtcNow-gt $until){throw 'Settings regression host did not start'};Start-Sleep -Milliseconds 50}
 $window=[SettingsInput]::Host($hostProcess.Id);$before=Read-Status
 if(!$before.motion.eyesVisible){throw 'Initial valid settings were not applied'}
 $stamp=[DateTime]::UtcNow.AddMinutes(1)
 foreach($invalid in @('', 'null', '{"idleEyes":')){
  [IO.File]::WriteAllText($file,$invalid);$stamp=$stamp.AddSeconds(1);[IO.File]::SetLastWriteTimeUtc($file,$stamp)
  [void][SettingsInput]::SendMessage($window,0x8022,[IntPtr]::Zero,[IntPtr]::Zero);$after=Read-Status
  if($after.motion.positions-le $before.motion.positions-or !$after.motion.eyesVisible-or $after.phase-ne 'idle'-or @($after.processes).Count-ne 1){throw "Incomplete settings poisoned last-good state or stopped status publication: [$invalid]"}
  $before=$after
 }
 # Hold the writer open across BOTH refreshes: the reader must share Write/Delete.
 $writer=[IO.FileStream]::new($file,[IO.FileMode]::Create,[IO.FileAccess]::Write,([IO.FileShare]::ReadWrite-bor [IO.FileShare]::Delete))
 try{
  $partial=[Text.Encoding]::UTF8.GetBytes('{"idleEyes":');$writer.Write($partial,0,$partial.Length);$writer.Flush($true);[IO.File]::SetLastWriteTimeUtc($file,$stamp.AddSeconds(1))
  [void][SettingsInput]::SendMessage($window,0x8022,[IntPtr]::Zero,[IntPtr]::Zero);$after=Read-Status
  if($after.motion.positions-le $before.motion.positions-or !$after.motion.eyesVisible){throw 'Open partial writer stopped fresh last-good status'}
  $before=$after;$settings.idleEyes=$false;$complete=[Text.Encoding]::UTF8.GetBytes(($settings|ConvertTo-Json));$writer.SetLength(0);$writer.Position=0;$writer.Write($complete,0,$complete.Length);$writer.Flush($true);[IO.File]::SetLastWriteTimeUtc($file,$stamp.AddSeconds(2))
  [void][SettingsInput]::SendMessage($window,0x8022,[IntPtr]::Zero,[IntPtr]::Zero);$after=Read-Status
  if($after.motion.positions-le $before.motion.positions-or $after.motion.eyesVisible){throw 'Valid settings did not recover after incomplete generations'}
 }finally{$writer.Dispose()}
 if((Get-Content "$profile/native-panels.log" -Raw -ErrorAction SilentlyContinue)-match 'ui-thread|fatal'){throw 'Incomplete settings caused an unhandled host exception'}
 Write-Output 'SETTINGS SNAPSHOT PASS: empty/null/partial generations retain last-good settings and publish fresh status; complete generation applies; no Electron or unhandled exception'
}finally{
 New-Item "$root/out/settings-snapshot" -ItemType Directory -Force|Out-Null
 Copy-Item "$profile/*.log","$probe/status.json" "$root/out/settings-snapshot" -Force -ErrorAction SilentlyContinue
 if(!$hostProcess.HasExited){[IO.File]::WriteAllText("$probe/command.txt",'exit');if(!$hostProcess.WaitForExit(10000)){$hostProcess.Kill()}}
}

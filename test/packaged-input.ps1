# Windows interactive-session regression: real pointer/button/keyboard input, no probe open command.
param([string]$Package = 'out/IslandlyPanels-win32-x64')
$ErrorActionPreference='Stop'
$env:ISLANDLY_INPUT_UNICODE='تجربة OneDrive'
0..9 | ForEach-Object { [Environment]::SetEnvironmentVariable(('ISLANDLY_LARGE_'+$_),('x'*4096),'Process') }
Add-Type -AssemblyName System.Windows.Forms
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class PanelInput {
 [StructLayout(LayoutKind.Sequential)] public struct RECT { public int left,top,right,bottom; }
 [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h,out RECT r);
 [DllImport("user32.dll")] public static extern bool SetCursorPos(int x,int y);
 [DllImport("user32.dll")] public static extern void mouse_event(uint flags,uint x,uint y,uint data,UIntPtr extra);
 [DllImport("user32.dll")] public static extern void keybd_event(byte key,byte scan,uint flags,UIntPtr extra);
}
'@
$stage=Join-Path $env:RUNNER_TEMP 'OneDrive - Islandly test\Desktop\جزيرة & Panels'
$profile=Join-Path $env:RUNNER_TEMP ('islandly-input-'+[guid]::NewGuid())
$probe=Join-Path $profile 'probe'
New-Item $stage,$profile,$probe -ItemType Directory -Force | Out-Null
Copy-Item "$Package/*" $stage -Recurse -Force
$prefs=@{autoHide='never';hideFullscreen=$false;updates=$false;weather=$false;timeTracking=$false;micCamIndicator=$false;clipboard=$false;prayerAutoPause=$false;breakEvery=0}
[IO.File]::WriteAllText("$profile/settings.json",($prefs|ConvertTo-Json),[Text.UTF8Encoding]::new($false))
# Deliberately no --root/--electron: exercise the installed production defaults.
$hostProcess=Start-Process (Join-Path $stage 'Islandly.exe') -ArgumentList @('--profile',"`"$profile`"",'--probe-dir',"`"$probe`"",'--interactive-probe') -WorkingDirectory $env:TEMP -PassThru
function Status {
 for($n=0;$n -lt 30;$n++) { try { return Get-Content "$probe/status.json" -Raw | ConvertFrom-Json } catch { Start-Sleep -Milliseconds 50 } }
 throw 'No native status available'
}
function Wait-Until([scriptblock]$Condition,[string]$Name,[int]$Seconds=30) {
 $deadline=[DateTime]::UtcNow.AddSeconds($Seconds)
 do {
  if($hostProcess.HasExited){throw "Host exited during $Name"}
  if(& $Condition){return}
  Start-Sleep -Milliseconds 100
 } while([DateTime]::UtcNow -lt $deadline)
 throw "Timed out: $Name"
}
function Probe-Command([string]$Value) { [IO.File]::WriteAllText("$probe/command.tmp",$Value); Move-Item "$probe/command.tmp" "$probe/command.txt" -Force }
function Point-ToIsland {
 $hostProcess.Refresh(); $rect=[PanelInput+RECT]::new()
 if(!$hostProcess.MainWindowHandle -or ![PanelInput]::GetWindowRect($hostProcess.MainWindowHandle,[ref]$rect)){throw 'Native window unavailable'}
 [void][PanelInput]::SetCursorPos([int](($rect.left+$rect.right)/2),[int](($rect.top+$rect.bottom)/2))
}
function Move-Away { [void][PanelInput]::SetCursorPos(800,500); Start-Sleep -Milliseconds 350 }
try {
 Wait-Until { Test-Path "$probe/status.json" } 'startup'
 Move-Away
 foreach($action in @('hover','click','hotkey')) {
  $before=(Status).launchCount
  if($action -eq 'hover') { Point-ToIsland }
  elseif($action -eq 'click') { Point-ToIsland; [PanelInput]::mouse_event(2,0,0,0,[UIntPtr]::Zero); [PanelInput]::mouse_event(4,0,0,0,[UIntPtr]::Zero) }
  else { foreach($key in @(0x11,0x12,0x49)){[PanelInput]::keybd_event($key,0,0,[UIntPtr]::Zero)}; foreach($key in @(0x49,0x12,0x11)){[PanelInput]::keybd_event($key,0,2,[UIntPtr]::Zero)} }
  Wait-Until { $s=Status; $s.phase -eq 'panel' -and $s.launchCount -gt $before } "$action launch"
  $log=Get-Content "$profile/native-panels.log" -Raw
  if($log -notmatch "launch-started origin=$action"){throw "Panel did not start through the real $action handler"}
  if(!((Status).processes | Where-Object name -eq 'IslandlyPanels')){throw 'Packaged Electron process not owned by native job'}
  Move-Away; Probe-Command 'close'
  Wait-Until { (Status).phase -eq 'idle' -and @((Status).processes).Count -eq 1 } "$action complete shutdown" 12
  Write-Output "PACKAGED REAL INPUT PASS: $action"
 }
 # Missing runtime is recoverable, creates diagnostics before child startup, and retries only once.
 $runtime=Join-Path $stage 'IslandlyPanels.exe'; Move-Item $runtime "$runtime.hold"
 Point-ToIsland; [PanelInput]::mouse_event(2,0,0,0,[UIntPtr]::Zero); [PanelInput]::mouse_event(4,0,0,0,[UIntPtr]::Zero)
 Wait-Until { (Get-Content "$profile/native-panels.log" -Raw) -match 'launch-failed' } 'failure logging'
 Move-Away; Start-Sleep -Seconds 4
 $failures=([regex]::Matches((Get-Content "$profile/native-panels.log" -Raw),'launch-failed')).Count
 if($failures -ne 2){throw "Expected one initial failure and one bounded retry, got $failures"}
 Move-Item "$runtime.hold" $runtime
 $before=(Status).launchCount; Point-ToIsland; [PanelInput]::mouse_event(2,0,0,0,[UIntPtr]::Zero); [PanelInput]::mouse_event(4,0,0,0,[UIntPtr]::Zero)
 Wait-Until { $s=Status; $s.phase -eq 'panel' -and $s.launchCount -gt $before } 'recovery after restoring runtime'
 Move-Away; Probe-Command 'close'; Wait-Until { (Status).phase -eq 'idle' } 'final shutdown' 12
 Write-Output 'PACKAGED RECOVERY PASS: logged failure, one retry, no process leak, subsequent user action succeeds'
} finally {
 New-Item 'out/input-diagnostics' -ItemType Directory -Force | Out-Null
 Copy-Item "$profile/*.log" 'out/input-diagnostics' -ErrorAction SilentlyContinue
 if(!$hostProcess.HasExited){Probe-Command 'exit';if(!$hostProcess.WaitForExit(10000)){$hostProcess.Kill()}}
}

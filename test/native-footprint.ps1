# Same 15 s warmup and 60 one-second samples as the Electron controls.
# Counts native host plus every PID in its Windows Job Object, without working-set trimming.
param([string]$Output = "$PSScriptRoot/../native-perf-result.json", [ValidateSet('overlay','reserved-bar')][string]$Mode = 'overlay', [switch]$Smoke, [string]$Executable = '')
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
Add-Type -AssemblyName System.Windows.Forms
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class WorkAreaProbe {
    [StructLayout(LayoutKind.Sequential)] public struct RECT { public int left,top,right,bottom; }
    [DllImport("user32.dll")] public static extern bool SystemParametersInfo(uint action,uint param,out RECT rect,uint flags);
    public static string Current() { RECT r; if(!SystemParametersInfo(48,0,out r,0)) throw new Exception("SPI_GETWORKAREA failed"); return r.left+","+r.top+","+r.right+","+r.bottom; }
    public static int Top() { RECT r; SystemParametersInfo(48,0,out r,0); return r.top; }
}
'@
$beforeWorkArea = [WorkAreaProbe]::Current()
$probe = Join-Path ([IO.Path]::GetTempPath()) ('islandly-native-probe-' + [Guid]::NewGuid())
$profile = Join-Path $probe 'profile'
New-Item -ItemType Directory -Path $profile -Force | Out-Null
# Same optional feature settings as the prior Electron controls; separate disposable profile.
$initialSettings = @{ weather=$false; updates=$false; icsUrl=''; breakEvery=0; timeTracking=$false; prayerAlerts=$false; hideFullscreen=$false; islandMode=$Mode } | ConvertTo-Json
[IO.File]::WriteAllText("$profile/settings.json",$initialSettings,[Text.UTF8Encoding]::new($false))
$timerDeadline = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() + 7200000
if ($Smoke) {
    $fixture = @{ mode='focus'; total=7200; remaining=7200; running=$true; endAt=$timerDeadline; breakActive=17.25; selected='timer'; clipboard=@(); clipboardPending=@('native handoff fixture') } | ConvertTo-Json
    [IO.File]::WriteAllText("$profile/native-session.json",$fixture,[Text.UTF8Encoding]::new($false))
}
$exe = if ($Executable) { [IO.Path]::GetFullPath($Executable) } else { Join-Path $root 'native/bin/Islandly.exe' }
$hostProcess = Start-Process $exe -ArgumentList @('--root',"`"$root`"",'--profile',"`"$profile`"",'--probe-dir',"`"$probe`"",'--mode',$Mode) -PassThru
$owned = [System.Collections.Generic.HashSet[int]]::new()
function Read-SharedJson([string]$File) {
    $sharing = [IO.FileShare]::ReadWrite -bor [IO.FileShare]::Delete
    $stream = [IO.FileStream]::new($File, [IO.FileMode]::Open, [IO.FileAccess]::Read, $sharing)
    $reader = [IO.StreamReader]::new($stream)
    try { return ($reader.ReadToEnd() | ConvertFrom-Json) }
    finally { $reader.Dispose() }
}
function Read-Status {
    if ($hostProcess.HasExited) { throw "Native host exited: $($hostProcess.ExitCode)" }
    $status = $null
    for ($retry=0; $retry -lt 20; $retry++) {
        try { $status = Read-SharedJson "$probe/status.json"; break }
        catch { Start-Sleep -Milliseconds 15 }
    }
    if ($null -eq $status) { throw 'Could not read native ownership status after bounded retries' }
    foreach ($p in $status.processes) { [void]$owned.Add([int]$p.pid) }
    return $status
}
function Command([string]$value) {
    Set-Content "$probe/command.tmp" $value -NoNewline
    Move-Item "$probe/command.tmp" "$probe/command.txt" -Force
}
function Wait-Phase([string]$phase) {
    $deadline = [DateTime]::UtcNow.AddSeconds(40)
    do {
        Start-Sleep -Milliseconds 250
        if (Test-Path "$probe/status.json") {
            $status = Read-Status
            if ($status.hostPid -eq $hostProcess.Id -and $status.phase -eq $phase) { return $status }
        }
    } while ([DateTime]::UtcNow -lt $deadline)
    throw "Timed out waiting for $phase. Probe evidence: $probe"
}
function Samples([string]$phase) {
    Start-Sleep -Seconds 15
    $samples = @()
    for ($n=0; $n -lt 60; $n++) {
        Start-Sleep -Seconds 1
        $s = Read-Status
        if ($s.phase -ne $phase) { throw "Expected $phase, got $($s.phase)" }
        if ($phase -eq 'idle' -and @($s.processes).Count -ne 1) { throw 'Idle must own only the native host; Electron/helper leaked' }
        $samples += $s
    }
    return @{ averageCPU=($samples | Measure-Object totalCPU -Average).Average; averageMB=($samples | Measure-Object totalMB -Average).Average; minMB=($samples | Measure-Object totalMB -Minimum).Minimum; peakMB=($samples | Measure-Object totalMB -Maximum).Maximum; samples=$samples }
}
try {
    $initial = Wait-Phase 'idle'
    Command 'measure' # disable incidental mouse-hover activation on the runner
    if ($initial.launchCount -ne 0) { throw 'Electron launched at native startup' }
    if ($Mode -eq 'reserved-bar') {
        if (!$initial.appBar) { throw 'Native AppBar not registered' }
        # Use a fresh Screen collection; do not trust a cached WorkingArea after SHAppBarMessage.
        $workArea = [WorkAreaProbe]::Current()
        if ([WorkAreaProbe]::Top() -lt $initial.appBarBottom) { throw "Reserved top work area not applied: $workArea" }
    }
    if ($Smoke) {
        Command 'settings'; $opened=Wait-Phase 'panel'; Start-Sleep -Seconds 1
        Command 'close'; $closed=Wait-Phase 'idle'
        $saved = Get-Content "$profile/native-session.json" -Raw | ConvertFrom-Json
        if ([Math]::Abs($saved.breakActive-17.25) -gt 0.001) { throw 'Active break counter lost across runtime shutdown' }
        if (!$saved.running -or [Math]::Abs($saved.endAt-$timerDeadline) -gt 1000) { throw 'Timer deadline lost or reset across runtime shutdown' }
        if ('native handoff fixture' -notin @($saved.clipboard.text)) { throw 'Native clipboard handoff was lost' }
        Command 'settings'; $second=Wait-Phase 'panel'
        $hostProcess.Kill(); $hostProcess.WaitForExit(); Start-Sleep -Seconds 2
        foreach ($id in $owned) { if (Get-Process -Id $id -ErrorAction SilentlyContinue) { throw "Owned PID $id survived native owner crash" } }
        $hostProcess = Start-Process $exe -ArgumentList @('--root',"`"$root`"",'--profile',"`"$profile`"",'--probe-dir',"`"$probe`"",'--mode',$Mode) -PassThru
        $recovered = Wait-Phase 'idle'
        if ($Mode -eq 'reserved-bar' -and !$recovered.appBar) { throw 'AppBar failed to recover after native owner crash' }
        Write-Output ('Native timer/clipboard handoff, cold launch, crash containment and recovery passed; latency ' + $opened.latenciesMs)
        return
    }
    $idle = Samples 'idle'
    Command 'settings'
    $opened = Wait-Phase 'panel'
    $panel = Samples 'panel'
    if ($Mode -eq 'reserved-bar' -and (!(Read-Status).appBar -or [WorkAreaProbe]::Top() -lt (Read-Status).appBarBottom)) { throw 'AppBar lost while panel open' }
    $closeTimer = [Diagnostics.Stopwatch]::StartNew()
    Command 'close'
    $closed = Wait-Phase 'idle'
    $shutdownMs = $closeTimer.ElapsedMilliseconds
    if ($shutdownMs -gt 8000) { throw "Panel runtime outlived short idle timeout: $shutdownMs ms" }
    $afterClose = Samples 'idle'
    # A second cold open proves relaunch works after complete runtime shutdown.
    Command 'expand'
    $reopened = Wait-Phase 'panel'
    Command 'close'
    $final = Wait-Phase 'idle'
    $result = @{ method='sum of native host and Windows Job Object process working sets / 1048576'; platform='Windows'; mode=$Mode; warmupSeconds=15; sampleCount=60; sampleIntervalSeconds=1;
        idle=$idle; panel=$panel; afterClose=$afterClose; runtimeShutdownMs=$shutdownMs; panelOpenLatencyMs=@($reopened.latenciesMs); latencyDefinition='native interaction to existing panel ready-to-show plus initial 350ms layout; cold opens';
        electron=(Get-Content "$root/node_modules/electron/package.json" -Raw | ConvertFrom-Json).version; measuredAt=[DateTime]::UtcNow.ToString('o'); ownedPids=@($owned); acceptanceUnder180=($idle.averageMB -lt 180 -and $afterClose.averageMB -lt 180) }
    $result | ConvertTo-Json -Depth 12 | Set-Content $Output -Encoding UTF8
    Write-Output "NATIVE FOOTPRINT: idle $($idle.averageMB) MB; panel $($panel.averageMB) MB; after-close $($afterClose.averageMB) MB; panel latency $($result.panelOpenLatencyMs -join ', ') ms; shutdown $shutdownMs ms; idle CPU $($idle.averageCPU)%"
    if (!$result.acceptanceUnder180) { throw 'Idle RAM acceptance failed: must be below 180 MB before and after opening panels' }
    if ($idle.averageCPU -ge 1 -or $afterClose.averageCPU -ge 1) { throw 'Native idle CPU must remain below 1 percent before and after opening panels' }
} finally {
    try { if (!$hostProcess.HasExited -and (Test-Path "$probe/status.json")) { Write-Output ('LAST STATUS: ' + ((Read-Status) | ConvertTo-Json -Compress -Depth 5)) } } catch { Write-Output 'Final status unavailable; continuing cleanup' }
    foreach ($log in @('native-panels.log','error.log','native-boot.log')) { if (Test-Path "$profile/$log") { Write-Output "$log :"; Get-Content "$profile/$log" | Select-Object -Last 35 } }
    if (!$hostProcess.HasExited) { Command 'exit'; if (!$hostProcess.WaitForExit(10000)) { $hostProcess.Kill(); throw 'Native host did not exit gracefully' } }
    foreach ($id in $owned) { if (Get-Process -Id $id -ErrorAction SilentlyContinue) { throw "Owned PID $id survived application shutdown" } }
    if ($Mode -eq 'reserved-bar') {
        $workArea = [WorkAreaProbe]::Current()
        if ($workArea -ne $beforeWorkArea) { throw "AppBar work area not restored: before $beforeWorkArea; after $workArea" }
    }
    Write-Output "Raw profile/logs retained for diagnosis: $probe"
}

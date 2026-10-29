# Same 15 s warmup and 60 one-second samples as the Electron controls.
# Counts native host plus every PID in its Windows Job Object, without working-set trimming.
param([string]$Output = "$PSScriptRoot/../native-perf-result.json", [ValidateSet('overlay','reserved-bar')][string]$Mode = 'overlay')
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
Add-Type -AssemblyName System.Windows.Forms
$beforeWorkArea = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea
$probe = Join-Path ([IO.Path]::GetTempPath()) ('islandly-native-probe-' + [Guid]::NewGuid())
$profile = Join-Path $probe 'profile'
New-Item -ItemType Directory -Path $profile -Force | Out-Null
# Same optional feature settings as the prior Electron controls; separate disposable profile.
@{ weather=$false; updates=$false; icsUrl=''; breakEvery=0; timeTracking=$false; prayerAlerts=$false; hideFullscreen=$false; islandMode=$Mode } | ConvertTo-Json | Set-Content "$profile/settings.json" -Encoding UTF8
$exe = Join-Path $root 'native/bin/Islandly.exe'
$hostProcess = Start-Process $exe -ArgumentList @('--root',"`"$root`"",'--profile',"`"$profile`"",'--probe-dir',"`"$probe`"",'--mode',$Mode) -PassThru
$owned = [System.Collections.Generic.HashSet[int]]::new()
function Read-Status {
    if ($hostProcess.HasExited) { throw "Native host exited: $($hostProcess.ExitCode)" }
    $status = Get-Content "$probe/status.json" -Raw | ConvertFrom-Json
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
            if ($status.phase -eq $phase) { return $status }
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
    return @{ averageMB=($samples | Measure-Object totalMB -Average).Average; minMB=($samples | Measure-Object totalMB -Minimum).Minimum; peakMB=($samples | Measure-Object totalMB -Maximum).Maximum; samples=$samples }
}
try {
    $initial = Wait-Phase 'idle'
    Command 'measure' # disable incidental mouse-hover activation on the runner
    if ($initial.launchCount -ne 0) { throw 'Electron launched at native startup' }
    if ($Mode -eq 'reserved-bar') {
        if (!$initial.appBar) { throw 'Native AppBar not registered' }
        # Use a fresh Screen collection; do not trust a cached WorkingArea after SHAppBarMessage.
        $workArea = [System.Windows.Forms.Screen]::AllScreens[0].WorkingArea
        if ($workArea.Top -lt $initial.appBarBottom) { throw "Reserved top work area not applied: $workArea" }
    }
    $idle = Samples 'idle'
    Command 'settings'
    $opened = Wait-Phase 'panel'
    $panel = Samples 'panel'
    if ($Mode -eq 'reserved-bar' -and !(Read-Status).appBar) { throw 'AppBar lost while panel open' }
    Command 'close'
    $closed = Wait-Phase 'idle'
    $afterClose = Samples 'idle'
    # A second cold open proves relaunch works after complete runtime shutdown.
    Command 'expand'
    $reopened = Wait-Phase 'panel'
    Command 'close'
    $final = Wait-Phase 'idle'
    $result = @{ method='sum of native host and Windows Job Object process working sets / 1048576'; platform='Windows'; mode=$Mode; warmupSeconds=15; sampleCount=60; sampleIntervalSeconds=1;
        idle=$idle; panel=$panel; afterClose=$afterClose; panelOpenLatencyMs=@($reopened.latenciesMs); latencyDefinition='native interaction to existing panel ready-to-show plus initial 350ms layout; cold opens';
        electron=(Get-Content "$root/node_modules/electron/package.json" -Raw | ConvertFrom-Json).version; measuredAt=[DateTime]::UtcNow.ToString('o'); ownedPids=@($owned); acceptanceUnder180=($idle.averageMB -lt 180 -and $afterClose.averageMB -lt 180) }
    $result | ConvertTo-Json -Depth 12 | Set-Content $Output -Encoding UTF8
    Write-Output "NATIVE FOOTPRINT: idle $($idle.averageMB) MB; panel $($panel.averageMB) MB; after-close $($afterClose.averageMB) MB; panel latency $($result.panelOpenLatencyMs -join ', ') ms"
    if (!$result.acceptanceUnder180) { throw 'Idle RAM acceptance failed: must be below 180 MB before and after opening panels' }
} finally {
    if (!$hostProcess.HasExited) { Command 'exit'; if (!$hostProcess.WaitForExit(10000)) { $hostProcess.Kill(); throw 'Native host did not exit gracefully' } }
    foreach ($id in $owned) { if (Get-Process -Id $id -ErrorAction SilentlyContinue) { throw "Owned PID $id survived application shutdown" } }
    if ($Mode -eq 'reserved-bar') {
        $workArea = [System.Windows.Forms.Screen]::AllScreens[0].WorkingArea
        if ($workArea -ne $beforeWorkArea) { throw "AppBar work area not restored: before $beforeWorkArea; after $workArea" }
    }
    Write-Output "Raw profile/logs retained for diagnosis: $probe"
}

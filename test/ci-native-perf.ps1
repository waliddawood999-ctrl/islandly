param([ValidateSet('overlay','reserved-bar')][string]$Mode='overlay')
$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
foreach($file in @('native/Islandly.cs','scripts/build-native.ps1','test/native-footprint.ps1')) {
    if(!(Test-Path (Join-Path $root $file))) {
        $reason="T9 prerequisite missing from candidate checkout: $file. Integrate accepted native T9 into dev; this guard never measures an archived reference app instead of the candidate."
        if($env:GITHUB_STEP_SUMMARY){Add-Content $env:GITHUB_STEP_SUMMARY "Native $Mode guard BLOCKED: $reason"}
        throw $reason
    }
}
# Electron 45 may resolve/download its runtime lazily. Prepare it before launching
# the native candidate; idle is never allowed to start a downloader or panel process.
& node -e "console.log(require('electron'))"
if($LASTEXITCODE -ne 0){throw 'Panel runtime preparation failed'}
& "$root/scripts/build-native.ps1"
if($LASTEXITCODE -ne 0){throw 'Candidate native build failed'}
$output=Join-Path $root "native-perf-$Mode.json"
$probeError=$null
try { & "$root/test/native-footprint.ps1" -Mode $Mode -Output $output } catch { $probeError=$_ }
# Even when the original probe rejects a budget, publish raw-sample failure metrics in the summary.
if(Test-Path $output){
    & node "$root/test/performance-check.js" $output $Mode
    if($LASTEXITCODE -ne 0){throw 'Native performance guard failed; see raw report and step summary'}
} else {
    if($env:GITHUB_STEP_SUMMARY){Add-Content $env:GITHUB_STEP_SUMMARY "Native $Mode probe produced no valid measurement report."}
    if(!$probeError){throw 'Native probe produced no report'}
}
if($probeError){throw $probeError}

$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
& "$root/scripts/build-native.ps1"
$original=(Get-FileHash "$root/native/bin/Islandly.exe" -Algorithm SHA256).Hash.ToLowerInvariant()
$clean=Join-Path $env:TEMP ('Islandly reproducible '+[guid]::NewGuid())
try {
    New-Item "$clean/native","$clean/scripts","$clean/native/toolchain","$clean/native/motion" -ItemType Directory -Force | Out-Null
    Copy-Item "$root/native/*.cs","$root/native/toolchain-lock.json" "$clean/native"
    Copy-Item "$root/native/motion/*" "$clean/native/motion"
    Copy-Item "$root/scripts/build-motion.ps1", "$root/scripts/build-native.ps1","$root/scripts/native-toolchain.ps1" "$clean/scripts"
    Copy-Item "$root/native/toolchain/*.zip" "$clean/native/toolchain"
    & "$clean/scripts/build-native.ps1"
    $motionOriginal=(Get-FileHash "$root/native/bin/Islandly.Motion.dll" -Algorithm SHA256).Hash
    $motionSecond=(Get-FileHash "$clean/native/bin/Islandly.Motion.dll" -Algorithm SHA256).Hash
    if($motionOriginal-ne $motionSecond){throw 'Native renderer DLL differs between clean roots'}
    $second=(Get-FileHash "$clean/native/bin/Islandly.exe" -Algorithm SHA256).Hash.ToLowerInvariant()
    Write-Output "REPRODUCIBLE MOTION DLL SHA256: $motionOriginal"
    if($original -ne $second){throw "Native host is not reproducible across clean roots: $original != $second"}
    New-Item "$root/out" -ItemType Directory -Force | Out-Null
    $identity=Get-Content "$root/packaging/windows-identity.json" -Raw | ConvertFrom-Json
    $changed=$original -ne $identity.host.baselineSha256
    $retest=$original -ne $identity.host.laptopAcceptedSha256
    $report=@{rendererSha256=$motionOriginal;sha256=$original;reproducible=$true;compiler='Microsoft.Net.Compilers.Toolset 4.14.0';references='net48 1.0.3';hostHashChanged=$changed;sacLaptopRetestRequired=$retest}
    $report | ConvertTo-Json | Set-Content "$root/out/host-identity.json" -Encoding utf8
    Write-Output "REPRODUCIBLE HOST SHA256: $original (same bytes from two clean roots; hash changed=$changed; SAC laptop retest=$retest)"
    if($env:GITHUB_STEP_SUMMARY){Add-Content $env:GITHUB_STEP_SUMMARY "Native host SHA256: $original. Reproducible across clean roots. New identity compared with accepted T9 E13846B221380B1ACCF4F79CAD17DC721F72A5AD406A3F95682F3089FE64382B; SAC laptop test required."}
} finally { Remove-Item $clean -Recurse -Force -ErrorAction SilentlyContinue }

# Build a complete Windows package with the native launcher as the user entry point.
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
& "$PSScriptRoot/build-native.ps1"
Push-Location $root
try {
    npx --yes '@electron/packager' . IslandlyPanels --platform=win32 --arch=x64 --out=out --overwrite --asar=false --ignore='^/native$' --ignore='^/dev$' --ignore='^/docs$' --ignore='^/attachments$' --ignore='^/out$' --ignore='^/test$' --ignore='^/\.git'
    if ($LASTEXITCODE -ne 0) { throw 'Electron packaging failed' }
    $package = Join-Path $root 'out/IslandlyPanels-win32-x64'
    Copy-Item "$root/native/bin/Islandly.exe" "$package/Islandly.exe" -Force
    # Keep only the platform's native dependency binaries; retain license files.
    & 7z a -tzip -mx=9 "$root/out/Islandly-native-win64.zip" "$package/*"
    if ($LASTEXITCODE -ne 0) { throw 'ZIP compression failed' }
    $size=(Get-Item "$root/out/Islandly-native-win64.zip").Length/1MB
    "T17 Windows ZIP: $([math]::Round($size,2)) MB (100 MB is a best-effort target)" | Tee-Object -FilePath "$root/out/package-size.txt"
    if($env:GITHUB_STEP_SUMMARY) { Get-Content "$root/out/package-size.txt" >> $env:GITHUB_STEP_SUMMARY }
} finally { Pop-Location }

# Build a complete Windows package with the native launcher as the user entry point.
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
& "$PSScriptRoot/build-native.ps1"
Push-Location $root
try {
    npx --yes '@electron/packager' . IslandlyPanels --platform=win32 --arch=x64 --out=out --overwrite --asar=false --ignore='^/native/bin$' --ignore='^/out$' --ignore='^/test$' --ignore='^/\.git'
    if ($LASTEXITCODE -ne 0) { throw 'Electron packaging failed' }
    $package = Join-Path $root 'out/IslandlyPanels-win32-x64'
    Copy-Item "$root/native/bin/Islandly.exe" "$package/Islandly.exe" -Force
    Compress-Archive -Path "$package/*" -DestinationPath "$root/out/Islandly-native-win64.zip" -Force
} finally { Pop-Location }

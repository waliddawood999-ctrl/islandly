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
    # This ZIP targets Windows x64; other koffi binaries cannot be loaded by it.
    $koffiBuild = Join-Path $package 'resources/app/node_modules/koffi/build/koffi'
    if (!(Test-Path (Join-Path $koffiBuild 'win32_x64/koffi.node'))) { throw 'Packaged Windows x64 koffi binary missing' }
    Get-ChildItem $koffiBuild -Directory | Where-Object { $_.Name -ne 'win32_x64' } | Remove-Item -Recurse -Force
    # App languages are Arabic/English. Keep both Chromium English variants and Arabic.
    Get-ChildItem (Join-Path $package 'locales') -Filter '*.pak' | Where-Object { $_.BaseName -notin @('ar','en-US','en-GB') } | Remove-Item -Force
    Get-ChildItem $package -Recurse -File | Sort-Object Length -Descending | Select-Object -First 20 @{Name='MB';Expression={[math]::Round($_.Length/1MB,2)}},FullName | Format-Table -AutoSize
    # Preserve runtime GPU/software-rendering components and all licenses.
    & 7z a -tzip -mx=9 "$root/out/Islandly-native-win64.zip" "$package/*"
    if ($LASTEXITCODE -ne 0) { throw 'ZIP compression failed' }
    $size=(Get-Item "$root/out/Islandly-native-win64.zip").Length/1MB
    "T17 Windows ZIP: $([math]::Round($size,2)) MB (100 MB is a best-effort target)" | Tee-Object -FilePath "$root/out/package-size.txt"
    if($env:GITHUB_STEP_SUMMARY) { Get-Content "$root/out/package-size.txt" >> $env:GITHUB_STEP_SUMMARY }
} finally { Pop-Location }

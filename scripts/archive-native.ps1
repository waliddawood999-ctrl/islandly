param([string]$Package = "$PSScriptRoot/../out/IslandlyPanels-win32-x64")
$ErrorActionPreference = 'Stop'
$out = Join-Path (Split-Path $PSScriptRoot -Parent) 'out'
$archive = Join-Path $out 'Islandly-native-win64.zip'
# Rebuild rather than update: removed files and old unsigned binaries must not survive.
if (Test-Path $archive) { Remove-Item $archive -Force }
& 7z a -tzip -mx=9 $archive "$Package/*"
if ($LASTEXITCODE -ne 0) { throw 'ZIP compression failed' }
$size = (Get-Item $archive).Length/1MB
"T17 Windows ZIP: $([math]::Round($size,2)) MB (100 MB is a best-effort target)" | Tee-Object -FilePath (Join-Path $out 'package-size.txt')
if ($env:GITHUB_STEP_SUMMARY) { Get-Content (Join-Path $out 'package-size.txt') >> $env:GITHUB_STEP_SUMMARY }

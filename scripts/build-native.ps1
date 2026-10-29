$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$out = Join-Path $root 'native\bin'
New-Item -ItemType Directory -Force $out | Out-Null
$csc = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
$source = Join-Path $root "native\Islandly.cs"
$materialSource = Join-Path $root 'native\Material.cs'
$binary = Join-Path $out "Islandly.exe"
& $csc /nologo /codepage:65001 /target:winexe /platform:x64 /optimize+ "/out:$binary" /reference:System.Windows.Forms.dll /reference:System.Drawing.dll /reference:System.Web.Extensions.dll $source $materialSource (Join-Path $root "native\Diagnostics.cs") (Join-Path $root 'native\LaunchPolicy.cs')
if ($LASTEXITCODE -ne 0) { throw 'Native host compilation failed' }
Write-Output "$out/Islandly.exe"

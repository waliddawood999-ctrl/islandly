$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$out = Join-Path $root 'native\bin'
New-Item -ItemType Directory -Force $out | Out-Null
$toolchain = & "$PSScriptRoot/native-toolchain.ps1"
$csc = $toolchain.compiler
$source = Join-Path $root "native\Islandly.cs"
$materialSource = Join-Path $root 'native\Material.cs'
$binary = Join-Path $out "Islandly.exe"
$references = @('mscorlib','System','System.Core','System.Drawing','System.Windows.Forms','System.Web.Extensions','System.Xml','Microsoft.CSharp') | ForEach-Object { '/reference:'+(Join-Path $toolchain.references ($_+'.dll')) }
& $csc /nologo /noconfig /nostdlib+ /deterministic+ /debug- /langversion:7.3 /codepage:65001 /target:winexe /platform:x64 /optimize+ "/pathmap:$root=/_/islandly" "/out:$binary" $references $source $materialSource (Join-Path $root "native\Diagnostics.cs") (Join-Path $root 'native\LaunchPolicy.cs')
if ($LASTEXITCODE -ne 0) { throw 'Native host compilation failed' }
Write-Output "$out/Islandly.exe"

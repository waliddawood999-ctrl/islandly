$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
$exe=Join-Path $env:TEMP ('islandly-policy-test-'+[guid]::NewGuid()+'.exe')
try {
    $csc=Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
    & $csc /nologo /codepage:65001 /target:exe /platform:x64 "/out:$exe" (Join-Path $root 'native/LaunchPolicy.cs') (Join-Path $PSScriptRoot 'launch-policy.cs')
    if($LASTEXITCODE -ne 0){throw 'Launch policy test compile failed'}
    & $exe
    if($LASTEXITCODE -ne 0){throw 'Launch policy tests failed'}
} finally { Remove-Item $exe -ErrorAction SilentlyContinue }

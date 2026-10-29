$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
$lock=Get-Content (Join-Path $root 'native/toolchain-lock.json') -Raw | ConvertFrom-Json
$cache=Join-Path $root 'native/toolchain'
New-Item $cache -ItemType Directory -Force | Out-Null
foreach($entry in @($lock.compiler,$lock.references)) {
    $archive=Join-Path $cache ($entry.id+'.'+$entry.version+'.zip')
    if(!(Test-Path $archive)) {
        Invoke-WebRequest "https://api.nuget.org/v3-flatcontainer/$($entry.id)/$($entry.version)/$($entry.id).$($entry.version).nupkg" -OutFile $archive
    }
    if((Get-FileHash $archive -Algorithm SHA256).Hash.ToLowerInvariant() -ne $entry.sha256) { throw "Pinned native toolchain checksum mismatch: $($entry.id)" }
    $destination=Join-Path $cache ($entry.id+'.'+$entry.version)
    # Re-extract verified bytes; never trust a previously mutated compiler/reference cache.
    if(Test-Path $destination){Remove-Item $destination -Recurse -Force}
    Expand-Archive $archive $destination
}
[pscustomobject]@{
    compiler=Join-Path $cache "$($lock.compiler.id).$($lock.compiler.version)/tasks/net472/csc.exe"
    references=Join-Path $cache "$($lock.references.id).$($lock.references.version)/build/.NETFramework/v4.8"
}

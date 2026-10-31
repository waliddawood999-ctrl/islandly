# Preserve the reference runtime bytes; only resources/app is replaced.
param([switch]$SkipArchive,[string]$ReferenceZip='')
$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
$lock=Get-Content "$root/packaging/windows-identity.json" -Raw | ConvertFrom-Json
if($lock.electron.sha256 -notmatch '^[a-fA-F0-9]{64}$'){throw 'T18 blocked: supply the full known-good 758E Electron SHA256 in packaging/windows-identity.json; a prefix is not an identity pin'}
if($lock.electron.referenceArchiveSha256 -notmatch '^[a-fA-F0-9]{64}$'){throw 'T18 blocked: pin the original reference ZIP SHA256 before packaging'}
& "$PSScriptRoot/build-native.ps1"
$package=Join-Path $root 'out/Islandly-native-win64'
$scratch=Join-Path $env:TEMP ('islandly-reference-'+[guid]::NewGuid())
New-Item $scratch -ItemType Directory | Out-Null
try {
    if($ReferenceZip){
        if((Get-FileHash $ReferenceZip -Algorithm SHA256).Hash.ToLowerInvariant() -ne $lock.electron.referenceArchiveSha256){throw 'Original reference ZIP checksum mismatch'}
        Expand-Archive $ReferenceZip "$scratch/reference"
        $referenceExecutables=@(Get-ChildItem "$scratch/reference" -Recurse -File -Filter Islandly.exe | Where-Object {
            $_.Length -eq $lock.electron.size -and (Get-FileHash $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant() -eq $lock.electron.sha256
        })
    } else {
        & npm ci --prefix "$root/packaging/tooling" --ignore-scripts --no-audit --no-fund
        if($LASTEXITCODE -ne 0){throw 'Frozen packaging toolchain installation failed'}
        & node "$PSScriptRoot/reproduce-electron.cjs"
        if($LASTEXITCODE -ne 0){throw 'Byte-for-byte Electron reproduction failed; original reference ZIP required, never substitute a different hash'}
        $referenceDirectory=Get-Content "$root/out/reference-electron/reference-directory.txt" -Raw
        $referenceExecutables=@(Get-Item (Join-Path $referenceDirectory 'Islandly.exe'))
    }
    if($referenceExecutables.Count -ne 1){throw 'Reference ZIP must contain exactly one byte-identical trusted Electron Islandly.exe'}
    if(Test-Path $package){Remove-Item $package -Recurse -Force}
    New-Item "$package/panels" -ItemType Directory -Force | Out-Null
    Copy-Item (Join-Path $referenceExecutables[0].Directory.FullName '*') "$package/panels" -Recurse -Force
    # After verified frozen reproduction, never rename/stamp/sign the reference EXE.
    if((Get-Content "$package/panels/version" -Raw).Trim() -ne $lock.electron.version){throw 'Trusted runtime is not Electron 45.1.0'}
    $app=Join-Path $package 'panels/resources/app'
    Remove-Item $app,"$package/panels/resources/app.asar","$package/panels/resources/app.asar.unpacked" -Recurse -Force -ErrorAction SilentlyContinue
    New-Item $app -ItemType Directory -Force | Out-Null
    & git -C $root archive --format=zip --output="$scratch/app.zip" HEAD
    if($LASTEXITCODE -ne 0){throw 'Committed app source archive failed'}
    Expand-Archive "$scratch/app.zip" $app -Force
    foreach($folder in @('dev','docs','test','scripts','native','packaging','.github','attachments')){Remove-Item (Join-Path $app $folder) -Recurse -Force -ErrorAction SilentlyContinue}
    Push-Location $app
    try { & npm ci --omit=dev --no-audit --no-fund; if($LASTEXITCODE -ne 0){throw 'Production dependency installation failed'} } finally { Pop-Location }
    $koffi=Join-Path $app 'node_modules/koffi/build/koffi'
    if(!(Test-Path "$koffi/win32_x64/koffi.node")){throw 'Windows x64 koffi binary missing'}
    Get-ChildItem $koffi -Directory | Where-Object {$_.Name -ne 'win32_x64'} | Remove-Item -Recurse -Force
    Copy-Item "$root/native/bin/Islandly.exe" "$package/Islandly.exe"
    Copy-Item "$root/native/bin/Islandly.Motion.dll" "$package/Islandly.Motion.dll"
    $motionHash=(Get-FileHash "$package/Islandly.Motion.dll" -Algorithm SHA256).Hash
    Write-Output "PACKAGED MOTION DLL SHA256: $motionHash"
    Set-Content "$package/NATIVE-RENDERER-SHA256.txt" $motionHash -Encoding utf8
    $version=[Diagnostics.FileVersionInfo]::GetVersionInfo("$package/panels/Islandly.exe")
    @{ProductName=$version.ProductName;FileDescription=$version.FileDescription;FileVersion=$version.FileVersion;ProductVersion=$version.ProductVersion;OriginalFilename=$version.OriginalFilename;InternalName=$version.InternalName;CompanyName=$version.CompanyName;LegalCopyright=$version.LegalCopyright} | ConvertTo-Json | Set-Content "$package/EXE-VERSION-RESOURCES.json" -Encoding utf8
    & node "$PSScriptRoot/windows-identity.js" $package
    if($LASTEXITCODE -ne 0){throw 'Executable identity guard failed'}
    Set-Content "$package/SIGNING-STATUS.txt" 'UNSIGNED IDENTITY-PRESERVED TEST: no stamping or signing; new native host identity requires SAC laptop validation.' -Encoding utf8
    if(!$SkipArchive){ & "$PSScriptRoot/archive-native.ps1" -Package $package }
} finally { Remove-Item $scratch -Recurse -Force -ErrorAction SilentlyContinue }

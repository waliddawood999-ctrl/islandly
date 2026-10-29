$ErrorActionPreference='Stop'
$script=Join-Path (Split-Path $PSScriptRoot -Parent) 'scripts/sign-windows.ps1'
$package=Join-Path $env:TEMP ('islandly-signing-test-'+[guid]::NewGuid())
$originalPfx=$env:ISLANDLY_SIGN_PFX_BASE64
$originalPassword=$env:ISLANDLY_SIGN_PFX_PASSWORD
try {
    New-Item $package -ItemType Directory | Out-Null
    Remove-Item Env:\ISLANDLY_SIGN_PFX_BASE64,Env:\ISLANDLY_SIGN_PFX_PASSWORD -ErrorAction SilentlyContinue
    & $script -Package $package
    if((Get-Content "$package/SIGNING-STATUS.txt" -Raw) -notmatch 'UNSIGNED PREVIEW'){throw 'Absent credentials did not cleanly mark unsigned output'}
    foreach($configuration in @('pfx-only','password-only','malformed-pfx')) {
        Remove-Item "$package/SIGNING-STATUS.txt"
        if($configuration -ne 'password-only'){$env:ISLANDLY_SIGN_PFX_BASE64='not-valid-base64'}
        if($configuration -ne 'pfx-only'){$env:ISLANDLY_SIGN_PFX_PASSWORD='dummy-test-value'}
        $failed=$false
        try { & $script -Package $package } catch { $failed=$true }
        if(!$failed -or (Test-Path "$package/SIGNING-STATUS.txt")){throw "Invalid signing configuration silently fell back: $configuration"}
        Remove-Item Env:\ISLANDLY_SIGN_PFX_BASE64,Env:\ISLANDLY_SIGN_PFX_PASSWORD -ErrorAction SilentlyContinue
        # No certificate is generated/imported/installed by these guard tests.
        Set-Content "$package/SIGNING-STATUS.txt" 'test fixture'
    }
    Write-Output 'Signing guards: absent secrets skip; partial/malformed secrets fail without unsigned fallback or certificate setup'
} finally {
    $env:ISLANDLY_SIGN_PFX_BASE64=$originalPfx
    $env:ISLANDLY_SIGN_PFX_PASSWORD=$originalPassword
    Remove-Item $package -Recurse -Force -ErrorAction SilentlyContinue
}

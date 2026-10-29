param([string]$Package = "$PSScriptRoot/../out/IslandlyPanels-win32-x64")
$ErrorActionPreference = 'Stop'
$statusFile = Join-Path $Package 'SIGNING-STATUS.txt'
if (!(Test-Path $Package -PathType Container)) { throw 'Windows package directory is missing' }
$hasPfx = ![string]::IsNullOrEmpty($env:ISLANDLY_SIGN_PFX_BASE64)
$hasPassword = ![string]::IsNullOrEmpty($env:ISLANDLY_SIGN_PFX_PASSWORD)
if (!$hasPfx -and !$hasPassword) {
    $message = 'UNSIGNED PREVIEW: signing credentials absent (or withheld from PR builds). Smart App Control may block either EXE before the host can log or show a tray message.'
    Set-Content $statusFile $message -Encoding utf8
    Write-Output $message
    if ($env:GITHUB_STEP_SUMMARY) { Add-Content $env:GITHUB_STEP_SUMMARY $message }
    return
}
if (!$hasPfx -or !$hasPassword) { throw 'Signing requires both ISLANDLY_SIGN_PFX_BASE64 and ISLANDLY_SIGN_PFX_PASSWORD; refusing an unsigned fallback' }
$certificate = $null
$bytes = $null
try {
    $bytes = [Convert]::FromBase64String($env:ISLANDLY_SIGN_PFX_BASE64)
    # No certificate installation, key export, secret file or password on a command line.
    $certificate = [Security.Cryptography.X509Certificates.X509Certificate2]::new($bytes,$env:ISLANDLY_SIGN_PFX_PASSWORD,[Security.Cryptography.X509Certificates.X509KeyStorageFlags]::EphemeralKeySet)
    if (!$certificate.HasPrivateKey -or $certificate.NotAfter -le [DateTime]::Now -or $certificate.NotBefore -gt [DateTime]::Now) { throw 'Signing certificate unavailable or outside its validity period' }
    $usage = @($certificate.Extensions | Where-Object { $_.Oid.Value -eq '2.5.29.37' } | ForEach-Object { $_.EnhancedKeyUsages } | Where-Object { $_.Value -eq '1.3.6.1.5.5.7.3.3' })
    if ($usage.Count -eq 0) { throw 'A code-signing certificate is required' }
    $timestamp = $env:ISLANDLY_SIGN_TIMESTAMP_URL
    if ([string]::IsNullOrWhiteSpace($timestamp)) { $timestamp = 'http://timestamp.digicert.com' }
    foreach ($name in @('Islandly.exe','IslandlyPanels.exe')) {
        $file = Join-Path $Package $name
        if (!(Test-Path $file -PathType Leaf)) { throw 'Signing target missing' }
        $result = Set-AuthenticodeSignature -FilePath $file -Certificate $certificate -HashAlgorithm SHA256 -TimestampServer $timestamp -ErrorAction Stop
        $verified = Get-AuthenticodeSignature -FilePath $file
        if ($result.Status -ne 'Valid' -or $verified.Status -ne 'Valid' -or $null -eq $verified.TimeStamperCertificate -or $verified.SignerCertificate.Thumbprint -ne $certificate.Thumbprint) { throw 'Signature, timestamp or signer verification failed' }
        Write-Output "Authenticode verified: $name (SHA256, timestamped)"
    }
    $message = 'SIGNED: Islandly.exe and IslandlyPanels.exe have verified timestamped Authenticode signatures. Windows policy/trust and bundled native dependencies still require validation on SAC hardware.'
    Set-Content $statusFile $message -Encoding utf8
    if ($env:GITHUB_STEP_SUMMARY) { Add-Content $env:GITHUB_STEP_SUMMARY $message }
} catch {
    # Do not echo certificate/password material or silently publish partly signed output.
    throw 'Windows signing failed. Check the supplied PFX/private key, password, code-signing EKU, trust/validity and timestamp service. No unsigned fallback will be published.'
} finally {
    if ($certificate) { $certificate.Dispose() }
    if ($bytes) { [Array]::Clear($bytes,0,$bytes.Length) }
    Remove-Item Env:\ISLANDLY_SIGN_PFX_BASE64,Env:\ISLANDLY_SIGN_PFX_PASSWORD -ErrorAction SilentlyContinue
}

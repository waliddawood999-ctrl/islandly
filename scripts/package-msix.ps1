# Build from an already packaged Windows application. Produces an unsigned MSIX by default.
# Signing/trusting a certificate is a separate deployment decision; this script never installs certificates.
param([Parameter(Mandatory=$true)][string]$AppDirectory,[string]$Publisher='CN=IslandlyDevelopment',[string]$Output='Islandly.msix')
$ErrorActionPreference='Stop'
$AppDirectory=(Resolve-Path $AppDirectory).Path
if(-not (Test-Path (Join-Path $AppDirectory 'resources/app/bridge/Islandly.NotificationBridge.exe'))) { throw 'Publish the notification bridge into bridge/ before packaging.' }
$assets=Join-Path $AppDirectory 'Assets';New-Item -ItemType Directory -Force $assets | Out-Null
Add-Type -AssemblyName System.Drawing
$icon=[Drawing.Image]::FromFile((Join-Path $AppDirectory 'resources/app/assets/tray.png'))
try { foreach($size in @(44,150)){ $bitmap=New-Object Drawing.Bitmap($size,$size);$g=[Drawing.Graphics]::FromImage($bitmap);try{$g.Clear([Drawing.Color]::FromArgb(20,21,28));$g.DrawImage($icon,0,0,$size,$size);$bitmap.Save((Join-Path $assets "logo$size.png"),[Drawing.Imaging.ImageFormat]::Png)}finally{$g.Dispose();$bitmap.Dispose()}} } finally {$icon.Dispose()}
$version=(Get-Content (Join-Path $AppDirectory 'resources/app/package.json') -Raw|ConvertFrom-Json).version+'.0'
$publisherEscaped=[Security.SecurityElement]::Escape($Publisher)
$manifest=@"
<?xml version="1.0" encoding="utf-8"?>
<Package xmlns="http://schemas.microsoft.com/appx/manifest/foundation/windows10" xmlns:uap="http://schemas.microsoft.com/appx/manifest/uap/windows10" xmlns:uap3="http://schemas.microsoft.com/appx/manifest/uap/windows10/3" xmlns:rescap="http://schemas.microsoft.com/appx/manifest/foundation/windows10/restrictedcapabilities" IgnorableNamespaces="uap uap3 rescap">
<Identity Name="Islandly.Desktop" Publisher="$publisherEscaped" Version="$version" ProcessorArchitecture="x64" />
<Properties><DisplayName>Islandly</DisplayName><PublisherDisplayName>Islandly</PublisherDisplayName><Logo>Assets\logo44.png</Logo></Properties>
<Resources><Resource Language="en-us"/><Resource Language="ar-sa"/></Resources>
<Dependencies><TargetDeviceFamily Name="Windows.Desktop" MinVersion="10.0.19041.0" MaxVersionTested="10.0.26100.0"/></Dependencies>
<Applications><Application Id="Islandly" Executable="Islandly.exe" EntryPoint="Windows.FullTrustApplication"><uap:VisualElements DisplayName="Islandly" Description="Islandly desktop companion" Square150x150Logo="Assets\logo150.png" Square44x44Logo="Assets\logo44.png" BackgroundColor="transparent"/></Application></Applications>
<Capabilities><rescap:Capability Name="runFullTrust"/><uap3:Capability Name="userNotificationListener"/></Capabilities>
</Package>
"@
[IO.File]::WriteAllText((Join-Path $AppDirectory 'AppxManifest.xml'),$manifest,(New-Object Text.UTF8Encoding($false)))
$tool=Get-ChildItem "${env:ProgramFiles(x86)}\Windows Kits\10\bin\*\x64\makeappx.exe" | Sort-Object FullName -Descending | Select-Object -First 1
if(-not $tool){throw 'Windows SDK makeappx.exe is required.'}
& $tool.FullName pack /d $AppDirectory /p $Output /o
if($LASTEXITCODE -ne 0){throw 'MSIX packaging failed.'}
Write-Output 'Unsigned MSIX created. Sign with your trusted publisher certificate before installation. No certificates were trusted or installed.'

param([string]$Package="$PSScriptRoot/../out/Islandly-install")
$ErrorActionPreference='Stop'
$Package=[IO.Path]::GetFullPath($Package)
$oldLocal=$env:LOCALAPPDATA; $oldRoaming=$env:APPDATA
$sandbox=Join-Path $env:TEMP ('Islandly OneDrive العربية ! & '+[guid]::NewGuid())
$env:LOCALAPPDATA=Join-Path $sandbox 'Local'; $env:APPDATA=Join-Path $sandbox 'Roaming'
$arp='HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\Islandly'
$run='HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
if(Test-Path $arp){throw 'Test requires an account without an existing Islandly installation'}
if((Get-ItemProperty $run -Name Islandly -ErrorAction SilentlyContinue)){throw 'Test requires no existing Islandly startup value'}
function Assert($condition,[string]$message){if(!$condition){throw $message}}
function Install([string]$argument='/quiet'){
 & $env:ComSpec /d /c "`"`"$Package\Install.cmd`" $argument`""
 if($LASTEXITCODE -ne 0){throw "Installer exit $LASTEXITCODE for $argument"}
}
function Hashes([string]$root){
 $result=@{};Get-ChildItem $root -Recurse -File | Where-Object Extension -in '.exe','.dll','.node' | ForEach-Object {$result[$_.FullName.Substring($root.Length)]=(Get-FileHash $_.FullName -Algorithm SHA256).Hash};return $result
}
$dest=Join-Path $env:LOCALAPPDATA 'Islandly'
$menu=Join-Path $env:APPDATA 'Microsoft/Windows/Start Menu/Programs/Islandly.lnk'
try {
 New-Item "$env:APPDATA/islandly" -ItemType Directory -Force | Out-Null
 [IO.File]::WriteAllText("$env:APPDATA/islandly/settings.json",'{"uiLang":"ar","ecoAuto":true}')
 $settings=(Get-FileHash "$env:APPDATA/islandly/settings.json").Hash
 Install
 Assert (Test-Path "$dest/.islandly-install") 'Install marker missing'
 Assert (Test-Path $menu) 'Start shortcut missing'
 $shell=New-Object -ComObject WScript.Shell
 $shortcut=$shell.CreateShortcut($menu)
 Assert ($shortcut.TargetPath -eq "$dest\Islandly.exe") "Shortcut resolves to wrong user: $($shortcut.TargetPath)"
 $registration=Get-ItemProperty $arp
 Assert ($registration.InstallLocation -eq $dest) 'ARP installation location mismatch'
 Assert ($registration.UninstallString.Contains('Uninstall.cmd')) 'Missing ARP uninstaller'
 Assert (!(Get-ItemProperty $run -Name Islandly -ErrorAction SilentlyContinue)) 'Startup must be opt-in'
 $before=Hashes "$Package\payload"; $installed=Hashes $dest
 Assert ($before.Count -eq $installed.Count) 'New binary was introduced'
 foreach($key in $before.Keys){Assert ($before[$key] -eq $installed[$key]) "Changed binary $key"}
 Install /startup-on
 Assert ((Get-ItemProperty $run).Islandly -eq "`"$dest\Islandly.exe`"") 'Startup target quoting incorrect'
 # Updating the same payload must delete obsolete files, retain settings and startup.
 Set-Content "$dest/obsolete-file.txt" 'old release'
 Install
 Assert (!(Test-Path "$dest/obsolete-file.txt")) 'Update retained obsolete release file'
 Assert ((Get-FileHash "$env:APPDATA/islandly/settings.json").Hash -eq $settings) 'Update changed settings'
 Assert ((Get-ItemProperty $run).Islandly -eq "`"$dest\Islandly.exe`"") 'Update lost startup choice'
 Install /startup-off
 Assert (!(Get-ItemProperty $run -Name Islandly -ErrorAction SilentlyContinue)) 'Startup disable failed'
 # Corrupted payload must fail before touching installed files.
 $hostExe="$Package/payload/Islandly.exe"; $backup=[IO.File]::ReadAllBytes($hostExe)
 try {
  [IO.File]::AppendAllText($hostExe,'tampered')
  & $env:ComSpec /d /c "`"`"$Package\Install.cmd`" /quiet`""
  Assert ($LASTEXITCODE -ne 0) 'Tampered payload was accepted'
  Assert ((Get-FileHash "$dest/Islandly.exe").Hash -eq $installed['\Islandly.exe']) 'Rejected update damaged installation'
 } finally {[IO.File]::WriteAllBytes($hostExe,$backup)}
 # Exercise the exact command Windows Installed Apps receives, with quiet consent for CI.
 $command=(Get-ItemProperty $arp).UninstallString
 Assert ($command.StartsWith('"'+$env:SystemRoot+'\System32\cmd.exe"')) "Uninstall command malformed: $command"
 & $env:ComSpec /d /c "`"`"$dest\Uninstall.cmd`" /uninstall /quiet`""
 Assert ($LASTEXITCODE -eq 0) 'Uninstall failed'
 Assert (!(Test-Path $dest)) 'Install directory remains'
 Assert (!(Test-Path "$env:APPDATA/islandly")) 'Profile remains'
 Assert (!(Test-Path $menu)) 'Shortcut remains'
 Assert (!(Test-Path $arp)) 'ARP entry remains'
 Assert (!(Get-ItemProperty $run -Name Islandly -ErrorAction SilentlyContinue)) 'Startup remains'
 Assert (!(Test-Path "$dest.previous")) 'Previous release remains'
 Assert (!(Test-Path "$dest.staging")) 'Staging remains'
 Write-Output 'T22 INSTALL UPDATE UNINSTALL PASS: unchanged binaries, user shortcut, startup opt-in, settings preservation, tamper rejection, cleanup; SAC not tested by Server CI.'
} finally {
 Remove-Item $arp -Recurse -Force -ErrorAction SilentlyContinue
 Remove-ItemProperty $run -Name Islandly -ErrorAction SilentlyContinue
 $env:LOCALAPPDATA=$oldLocal; $env:APPDATA=$oldRoaming
 Remove-Item $sandbox -Recurse -Force -ErrorAction SilentlyContinue
}

# Bounded diagnostic comparison against the exact reported host; no baseline failure is fabricated.
param([string]$Package='out/IslandlyPanels-win32-x64')
$ErrorActionPreference='Stop'
$stage=Join-Path $env:RUNNER_TEMP 'OneDrive - legacy comparison\Desktop\جزيرة Panels'
$profile=Join-Path $env:RUNNER_TEMP ('legacy-islandly-'+[guid]::NewGuid())
$probe=Join-Path $profile 'probe'
New-Item $stage,$profile,$probe,'out/input-diagnostics' -ItemType Directory -Force | Out-Null
Copy-Item "$Package/*" $stage -Recurse -Force
$sha='5420c0bcb0fed8eeca20a55f644440bf9a345a10'
git fetch --no-tags origin $sha
if($LASTEXITCODE -ne 0){throw 'Cannot fetch reported baseline host'}
$source=Join-Path $env:RUNNER_TEMP 'legacy-native.cs'
git show "${sha}:native/Islandly.cs" | Set-Content $source -Encoding UTF8
$csc=Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
& $csc /nologo /target:winexe /platform:x64 /optimize+ "/out:$stage/Islandly.exe" /reference:System.Windows.Forms.dll /reference:System.Drawing.dll /reference:System.Web.Extensions.dll $source
if($LASTEXITCODE -ne 0){throw 'Baseline compile failed'}
[IO.File]::WriteAllText("$profile/settings.json",'{"autoHide":"never","hideFullscreen":false,"weather":false,"updates":false,"timeTracking":false,"clipboard":false,"micCamIndicator":false,"breakEvery":0}')
$p=Start-Process "$stage/Islandly.exe" -ArgumentList @('--profile',"`"$profile`"",'--probe-dir',"`"$probe`"") -WorkingDirectory $env:TEMP -PassThru
try {
 Start-Sleep -Seconds 3
 # Baseline probe command reaches the same OpenPanel function; actual input coverage is in packaged-input.ps1.
 [IO.File]::WriteAllText("$probe/command.txt",'expand')
 $deadline=[DateTime]::UtcNow.AddSeconds(15);$opened=$false
 do { Start-Sleep -Milliseconds 200; try {$s=Get-Content "$probe/status.json" -Raw|ConvertFrom-Json;$opened=$s.phase -eq 'panel'}catch{} }while(!$opened -and !$p.HasExited -and [DateTime]::UtcNow -lt $deadline)
 $result=@{sha=$sha;openedOnThisRunner=$opened;os=[Environment]::OSVersion.Version.ToString();note='Baseline comparison on runner, not proof of Windows 11 build 26300/OneDrive provider behavior'}
 $result|ConvertTo-Json|Tee-Object -FilePath 'out/input-diagnostics/legacy-comparison.json'
}finally{if(!$p.HasExited){$p.Kill();$p.WaitForExit()}}

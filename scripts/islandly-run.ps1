# Explicit terminal integration: run a command and report its exit status to the local Islandly inbox.
# Example: .\islandly-run.ps1 -Label 'Build' -Command 'npm run build'
param([Parameter(Mandatory=$true)][string]$Command,[string]$Label='Terminal command')
$ErrorActionPreference = 'Stop'
$root = Join-Path $env:APPDATA 'islandly'
$inbox = Join-Path $root 'events'
New-Item -ItemType Directory -Force -Path $inbox | Out-Null
$id = [Guid]::NewGuid().ToString('N')
function Publish($state,$code) {
  $target = Join-Path $inbox ($id + '.json')
  $payload = @{ id=$id; label=$Label; status=$state; exitCode=$code; at=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() } | ConvertTo-Json -Compress
  [IO.File]::WriteAllText($target+'.tmp',$payload,(New-Object Text.UTF8Encoding($false)))
  Move-Item -Force ($target+'.tmp') $target
}
Publish 'running' $null
try {
  & powershell.exe -NoProfile -Command $Command
  $code = $LASTEXITCODE
  Publish $(if($code -eq 0){'done'}else{'failed'}) $code
  exit $code
} catch { Publish 'failed' 1; throw }

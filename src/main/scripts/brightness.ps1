# Get or set the built-in display brightness (laptops). Usage: brightness.ps1 [0-100]
param([int]$Level = -1)
$ErrorActionPreference = 'Stop'
try {
  if ($Level -ge 0) {
    $m = Get-CimInstance -Namespace root/WMI -ClassName WmiMonitorBrightnessMethods | Select-Object -First 1
    Invoke-CimMethod -InputObject $m -MethodName WmiSetBrightness -Arguments @{ Timeout = 1; Brightness = [byte][Math]::Min(100, $Level) } | Out-Null
  }
  $b = Get-CimInstance -Namespace root/WMI -ClassName WmiMonitorBrightness | Select-Object -First 1
  Write-Output $b.CurrentBrightness
} catch {
  Write-Output 'unsupported'
}

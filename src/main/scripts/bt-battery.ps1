# Prints a JSON array of connected Bluetooth devices that report a battery level: [{"name":"...","battery":80}]
$ErrorActionPreference = 'SilentlyContinue'
$batteryKey = '{104EA319-6EE2-4701-BD47-8DDBF425BBE5} 2'
$connectedKey = '{83DA6326-97A6-4088-9453-A1923F573B29} 15'
$result = @()
$devices = Get-PnpDevice -PresentOnly | Where-Object { $_.InstanceId -like 'BTH*\DEV_*' -and $_.Status -eq 'OK' }
foreach ($d in $devices) {
  $connected = (Get-PnpDeviceProperty -InstanceId $d.InstanceId -KeyName $connectedKey).Data
  if ($connected -eq $false) { continue }
  $battery = (Get-PnpDeviceProperty -InstanceId $d.InstanceId -KeyName $batteryKey).Data
  if ($null -ne $battery) {
    $result += [pscustomobject]@{ name = $d.FriendlyName; battery = [int]$battery }
  }
}
ConvertTo-Json -InputObject @($result) -Compress

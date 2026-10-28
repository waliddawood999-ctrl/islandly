$ErrorActionPreference = 'SilentlyContinue'
$previous = $null
$previousAt = Get-Date
while ($true) {
  $stats = Get-NetAdapter | Where-Object Status -eq 'Up' | Get-NetAdapterStatistics
  $rx = [double](($stats | Measure-Object ReceivedBytes -Sum).Sum)
  $tx = [double](($stats | Measure-Object SentBytes -Sum).Sum)
  $now = Get-Date
  if ($null -ne $previous) {
    $seconds = [Math]::Max(0.1, ($now - $previousAt).TotalSeconds)
    @{ rx = [Math]::Max(0, ($rx - $previous.rx) / $seconds); tx = [Math]::Max(0, ($tx - $previous.tx) / $seconds) } | ConvertTo-Json -Compress | Write-Output
    [Console]::Out.Flush()
  }
  $previous = @{ rx = $rx; tx = $tx }; $previousAt = $now
  Start-Sleep -Seconds 2
}

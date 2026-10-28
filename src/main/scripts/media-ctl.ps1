# Long-lived helper: reads one command per line on stdin, answers with one JSON line on stdout.
#   <id> playpause | next | prev | seek <seconds> | caps
$ErrorActionPreference = 'SilentlyContinue'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public class MediaKeys {
  [DllImport("user32.dll")] public static extern void keybd_event(byte b, byte s, uint f, UIntPtr e);
}
'@
$null = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime]

$asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
  $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
})[0]

function Await($op, $type) {
  $task = $asTask.MakeGenericMethod($type).Invoke($null, @($op))
  $null = $task.Wait(4000)
  $task.Result
}

function Press($vk) {
  [MediaKeys]::keybd_event($vk, 0, 0, [UIntPtr]::Zero)
  [MediaKeys]::keybd_event($vk, 0, 2, [UIntPtr]::Zero)
}

$manager = Await ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])

function Reply($id, $ok, $extra) {
  $okText = if ($ok) { 'true' } else { 'false' }
  [Console]::Out.WriteLine('{"id":' + $id + ',"ok":' + $okText + $extra + '}')
  [Console]::Out.Flush()
}

while ($true) {
  $line = [Console]::In.ReadLine()
  if ($null -eq $line) { break }
  $parts = $line.Trim().Split(' ')
  if ($parts.Count -lt 2) { continue }
  $id = $parts[0]
  $cmd = $parts[1]
  $session = $manager.GetCurrentSession()
  $ok = $false
  $extra = ''

  switch ($cmd) {
    'playpause' {
      if ($session) { $ok = Await ($session.TryTogglePlayPauseAsync()) ([bool]) }
      if (-not $ok) { Press 0xB3; $ok = $true }
    }
    'next' {
      if ($session) { $ok = Await ($session.TrySkipNextAsync()) ([bool]) }
      if (-not $ok) { Press 0xB0; $ok = $true }
    }
    'prev' {
      if ($session) { $ok = Await ($session.TrySkipPreviousAsync()) ([bool]) }
      if (-not $ok) { Press 0xB1; $ok = $true }
    }
    'seek' {
      if ($session -and $parts.Count -ge 3) {
        $ticks = [long]([double]::Parse($parts[2], [Globalization.CultureInfo]::InvariantCulture) * 10000000)
        $ok = Await ($session.TryChangePlaybackPositionAsync($ticks)) ([bool])
      }
    }
    'caps' {
      if ($session) {
        $c = $session.GetPlaybackInfo().Controls
        $ok = $true
        $extra = ',"next":' + $c.IsNextEnabled.ToString().ToLower() + ',"prev":' + $c.IsPreviousEnabled.ToString().ToLower() +
                 ',"seek":' + $c.IsPlaybackPositionEnabled.ToString().ToLower() + ',"toggle":' + $c.IsPlayPauseToggleEnabled.ToString().ToLower()
      }
    }
  }
  Reply $id $ok $extra
}

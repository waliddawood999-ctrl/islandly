# Long-lived helper: reads one command per line on stdin, answers with one JSON line on stdout.
#   JSON {id, script, args, command}; one shared process, fixed script allowlist
$ErrorActionPreference = 'SilentlyContinue'
function Await($op, $type) {
  $task = $asTask.MakeGenericMethod($type).Invoke($null, @($op))
  if (-not $task.Wait(4000)) { return $null }
  $task.Result
}

function Press($vk) {
  [MediaKeys]::keybd_event($vk, 0, 0, [UIntPtr]::Zero)
  [MediaKeys]::keybd_event($vk, 0, 2, [UIntPtr]::Zero)
}

function Initialize-Media {
  if ($script:mediaInitialized) { return }
  $script:mediaInitialized = $true
Add-Type -AssemblyName System.Runtime.WindowsRuntime
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public class MediaKeys {
  [DllImport("user32.dll")] public static extern void keybd_event(byte b, byte s, uint f, UIntPtr e);
}
'@
$null = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime]

$script:asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
  $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
})[0]

$script:manager = Await ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
}


function Reply($id, $ok, $extra) {
  $okText = if ($ok) { 'true' } else { 'false' }
  [Console]::Out.WriteLine('{"id":' + $id + ',"ok":' + $okText + $extra + '}')
  [Console]::Out.Flush()
}

# Shared host for media controls and fixed local scripts; commands are data, never Invoke-Expression.
while ($true) {
  $line = [Console]::In.ReadLine()
  if ($null -eq $line) { break }
  try {
    $request = $line | ConvertFrom-Json
    $id = [int]$request.id
    if ($request.script -eq 'media') {
      Initialize-Media
      $parts = @('id') + ([string]$request.command).Split(' ')
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
    } else {
      $script = [string]$request.script
      if ($script -notin @('bt-battery.ps1','brightness.ps1','explorer-selection.ps1')) { throw 'invalid script' }
      $arguments = @()
      if ($script -eq 'brightness.ps1' -and $request.args.Count -gt 0) {
        $level = [int]$request.args[0]
        if ($level -lt 0 -or $level -gt 100) { throw 'invalid brightness' }
        $arguments = @($level)
      }
      $output = (& (Join-Path $PSScriptRoot $script) @arguments | Out-String).Trim()
      [Console]::Out.WriteLine((@{id=$id;ok=$true;output=$output} | ConvertTo-Json -Compress))
      [Console]::Out.Flush()
    }
  } catch {
    [Console]::Out.WriteLine((@{id=$id;ok=$false;output=''} | ConvertTo-Json -Compress))
    [Console]::Out.Flush()
  }
}

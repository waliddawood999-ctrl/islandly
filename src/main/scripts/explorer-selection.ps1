# Prints a JSON array with the paths of the items selected in the foreground File Explorer window.
$ErrorActionPreference = 'SilentlyContinue'
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public class Fg { [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow(); }
'@
$fg = [int64][Fg]::GetForegroundWindow()
$shell = New-Object -ComObject Shell.Application
$paths = @()
foreach ($w in $shell.Windows()) {
  if ([int64]$w.HWND -eq $fg) {
    foreach ($item in $w.Document.SelectedItems()) { $paths += $item.Path }
  }
}
ConvertTo-Json -InputObject @($paths) -Compress

# Prints "1" when the foreground window covers a whole monitor (fullscreen video/game), "0" otherwise.
# Only prints when the state changes. Polls once a second.
$ErrorActionPreference = 'SilentlyContinue'
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Text;
public class FgWatch {
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
  [StructLayout(LayoutKind.Sequential)] public struct MONITORINFO { public int cb; public RECT mon; public RECT work; public uint flags; }
  [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] static extern IntPtr MonitorFromWindow(IntPtr h, uint f);
  [DllImport("user32.dll")] static extern bool GetMonitorInfo(IntPtr m, ref MONITORINFO mi);
  [DllImport("user32.dll", CharSet = CharSet.Auto)] static extern int GetClassName(IntPtr h, StringBuilder s, int n);
  public static bool IsFullscreen() {
    IntPtr h = GetForegroundWindow();
    if (h == IntPtr.Zero) return false;
    StringBuilder cls = new StringBuilder(256);
    GetClassName(h, cls, 256);
    string c = cls.ToString();
    if (c == "Progman" || c == "WorkerW" || c == "Shell_TrayWnd") return false;
    RECT r; if (!GetWindowRect(h, out r)) return false;
    MONITORINFO mi = new MONITORINFO(); mi.cb = Marshal.SizeOf(typeof(MONITORINFO));
    if (!GetMonitorInfo(MonitorFromWindow(h, 2), ref mi)) return false;
    return r.L <= mi.mon.L && r.T <= mi.mon.T && r.R >= mi.mon.R && r.B >= mi.mon.B;
  }
}
'@
$last = $null
while ($true) {
  $now = if ([FgWatch]::IsFullscreen()) { '1' } else { '0' }
  if ($now -ne $last) {
    [Console]::Out.WriteLine($now)
    [Console]::Out.Flush()
    $last = $now
  }
  Start-Sleep -Milliseconds 1000
}

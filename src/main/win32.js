// Direct Win32 calls through koffi (FFI): no PowerShell process, no compilation step.
// Every function degrades to a safe default when not on Windows or when a call fails.
let api = null;
let loadError = null;

function load() {
  if (api || loadError || process.platform !== 'win32') return api;
  try {
    const koffi = require('koffi');
    const user32 = koffi.load('user32.dll');
    const shell32 = koffi.load('shell32.dll');
    const dwmapi = koffi.load('dwmapi.dll');
    const kernel32 = koffi.load('kernel32.dll');
    const RECT = koffi.struct('ISL_RECT', { left: 'int32', top: 'int32', right: 'int32', bottom: 'int32' });
    const MONITORINFO = koffi.struct('ISL_MONITORINFO', { cbSize: 'uint32', rcMonitor: RECT, rcWork: RECT, dwFlags: 'uint32' });
    api = {
      koffi,
      GetForegroundWindow: user32.func('void * __stdcall GetForegroundWindow()'),
      IsWindowVisible: user32.func('bool __stdcall IsWindowVisible(void *hWnd)'),
      IsIconic: user32.func('bool __stdcall IsIconic(void *hWnd)'),
      GetWindowRect: user32.func('bool __stdcall GetWindowRect(void *hWnd, _Out_ ISL_RECT *rect)'),
      GetWindowLongW: user32.func('int32 __stdcall GetWindowLongW(void *hWnd, int32 index)'),
      GetClassNameW: user32.func('int32 __stdcall GetClassNameW(void *hWnd, void *buf, int32 max)'),
      GetWindowTextW: user32.func('int32 __stdcall GetWindowTextW(void *hWnd, void *buf, int32 max)'),
      GetWindowThreadProcessId: user32.func('uint32 __stdcall GetWindowThreadProcessId(void *hWnd, _Out_ uint32 *pid)'),
      MonitorFromWindow: user32.func('void * __stdcall MonitorFromWindow(void *hWnd, uint32 flags)'),
      GetMonitorInfoW: user32.func('bool __stdcall GetMonitorInfoW(void *hMonitor, _Inout_ ISL_MONITORINFO *info)'),
      keybd_event: user32.func('void __stdcall keybd_event(uint8 vk, uint8 scan, uint32 flags, uintptr_t extra)'),
      SHQueryUserNotificationState: shell32.func('int32 __stdcall SHQueryUserNotificationState(_Out_ int32 *state)'),
      DwmGetWindowAttribute: dwmapi.func('int32 __stdcall DwmGetWindowAttribute(void *hWnd, uint32 attr, void *value, uint32 size)'),
      OpenProcess: kernel32.func('void * __stdcall OpenProcess(uint32 access, bool inherit, uint32 pid)'),
      QueryFullProcessImageNameW: kernel32.func('bool __stdcall QueryFullProcessImageNameW(void *process, uint32 flags, void *buf, _Inout_ uint32 *size)'),
      CloseHandle: kernel32.func('bool __stdcall CloseHandle(void *handle)'),
    };
  } catch (err) {
    loadError = err;
    api = null;
  }
  return api;
}

const WS_CAPTION = 0x00c00000;
const GWL_STYLE = -16;
const MONITOR_DEFAULTTONEAREST = 2;
const DWMWA_EXTENDED_FRAME_BOUNDS = 9;
const DWMWA_CLOAKED = 14;
const PROCESS_QUERY_LIMITED_INFORMATION = 0x1000;
const QUNS_RUNNING_D3D_FULL_SCREEN = 3;
const QUNS_PRESENTATION_MODE = 4;
const SHELL_CLASSES = new Set(['Progman', 'WorkerW', 'Shell_TrayWnd', 'Shell_SecondaryTrayWnd', 'Windows.UI.Core.CoreWindow']);

function wide(fn, hwnd, max = 256) {
  const buf = Buffer.alloc(max * 2);
  const n = fn(hwnd, buf, max);
  return n > 0 ? buf.toString('utf16le', 0, n * 2) : '';
}

let processCache = { pid: 0, name: '' };
function processName(pid) {
  if (pid === processCache.pid) return processCache.name;
  let name = '';
  const h = api.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid);
  if (h) {
    try {
      const buf = Buffer.alloc(1040);
      const size = [520];
      if (api.QueryFullProcessImageNameW(h, 0, buf, size)) {
        const full = buf.toString('utf16le', 0, size[0] * 2);
        name = full.split('\\').pop().replace(/\.exe$/i, '');
      }
    } finally {
      api.CloseHandle(h);
    }
  }
  processCache = { pid, name };
  return name;
}

/**
 * What the user is looking at: { app, title, fullscreen }.
 * Fullscreen = a visible, uncloaked, caption-less foreground window covering its whole monitor, or the shell
 * reporting an exclusive Direct3D game / presentation mode. A maximized window with a title bar is not fullscreen.
 */
function foreground() {
  const a = load();
  if (!a) return { app: '', title: '', fullscreen: false };
  try {
    let fullscreen = false;
    const state = [0];
    if (a.SHQueryUserNotificationState(state) === 0 && (state[0] === QUNS_RUNNING_D3D_FULL_SCREEN || state[0] === QUNS_PRESENTATION_MODE)) fullscreen = true;

    const hwnd = a.GetForegroundWindow();
    if (!hwnd) return { app: '', title: '', fullscreen };
    const pidOut = [0];
    a.GetWindowThreadProcessId(hwnd, pidOut);
    const pid = pidOut[0];
    const app = pid && pid !== process.pid ? processName(pid) : '';
    const title = wide(a.GetWindowTextW, hwnd, 300);

    if (!fullscreen && pid !== process.pid && a.IsWindowVisible(hwnd) && !a.IsIconic(hwnd)) {
      const cls = wide(a.GetClassNameW, hwnd, 128);
      const cloakBuf = Buffer.alloc(4);
      const cloaked = a.DwmGetWindowAttribute(hwnd, DWMWA_CLOAKED, cloakBuf, 4) === 0 && cloakBuf.readUInt32LE(0) !== 0;
      const style = a.GetWindowLongW(hwnd, GWL_STYLE) >>> 0;
      const hasCaption = (style & WS_CAPTION) === WS_CAPTION;
      if (!SHELL_CLASSES.has(cls) && !cloaked && !hasCaption) {
        let rect = {};
        const frame = Buffer.alloc(16);
        if (a.DwmGetWindowAttribute(hwnd, DWMWA_EXTENDED_FRAME_BOUNDS, frame, 16) === 0) {
          rect = { left: frame.readInt32LE(0), top: frame.readInt32LE(4), right: frame.readInt32LE(8), bottom: frame.readInt32LE(12) };
        } else if (!a.GetWindowRect(hwnd, rect)) rect = null;
        const info = { cbSize: 40, rcMonitor: {}, rcWork: {}, dwFlags: 0 };
        const mon = a.MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST);
        if (rect && mon && a.GetMonitorInfoW(mon, info)) {
          const m = info.rcMonitor;
          fullscreen = rect.left <= m.left + 1 && rect.top <= m.top + 1 && rect.right >= m.right - 1 && rect.bottom >= m.bottom - 1;
        }
      }
    }
    return { app, title, fullscreen };
  } catch (_) {
    return { app: '', title: '', fullscreen: false };
  }
}

const VK = { playpause: 0xb3, next: 0xb0, prev: 0xb1, volup: 0xaf, voldown: 0xae, mute: 0xad };
/** Press a system media/volume key (media keys are the fallback when the media session API is unavailable). */
function mediaKey(action) {
  const a = load();
  const vk = VK[action];
  if (!a || !vk) return false;
  try {
    a.keybd_event(vk, 0, 0, 0);
    a.keybd_event(vk, 0, 2, 0);
    return true;
  } catch (_) {
    return false;
  }
}

module.exports = { foreground, mediaKey, available: () => !!load(), loadError: () => loadError };

// Native T6 surface contract. uintptr_t keeps HWND layout pointer-sized on x86/x64.
let api;
let failed = false;
const CALLBACK_MESSAGE = 0x81a1;
function load() {
  if (api || failed || process.platform !== 'win32') return api;
  try {
    const koffi = require('koffi');
    const user = koffi.load('user32.dll'), gdi = koffi.load('gdi32.dll'), shell = koffi.load('shell32.dll');
    const rect = koffi.struct('ISL_SURFACE_RECT', { left: 'int32', top: 'int32', right: 'int32', bottom: 'int32' });
    const data = koffi.struct('ISL_APPBARDATA', {
      cbSize: 'uint32', hWnd: 'uintptr_t', uCallbackMessage: 'uint32', uEdge: 'uint32', rc: rect, lParam: 'intptr_t',
    });
    api = {
      size: koffi.sizeof(data),
      message: user.func('uint32 __stdcall RegisterWindowMessageW(str16 name)')('TaskbarCreated'),
      send: shell.func('uintptr_t __stdcall SHAppBarMessage(uint32 message, _Inout_ ISL_APPBARDATA *data)'),
      getDC: user.func('void * __stdcall GetDC(uintptr_t hwnd)'),
      releaseDC: user.func('int __stdcall ReleaseDC(uintptr_t hwnd, void *dc)'),
      pixel: gdi.func('uint32 __stdcall GetPixel(void *dc, int32 x, int32 y)'),
    };
  } catch (_) { failed = true; api = null; }
  return api;
}
function handle(hwnd) {
  if (!Buffer.isBuffer(hwnd) || ![4, 8].includes(hwnd.length)) throw new Error('invalid HWND');
  const value = hwnd.length === 8 ? hwnd.readBigUInt64LE() : BigInt(hwnd.readUInt32LE());
  if (!value) throw new Error('invalid HWND');
  return value;
}
function validRect(rect) {
  return rect && ['left', 'top', 'right', 'bottom'].every(k => Number.isInteger(rect[k]) && Math.abs(rect[k]) < 0x7fffffff) &&
    rect.right > rect.left && rect.bottom > rect.top && rect.bottom - rect.top <= 4096;
}
function appData(a, hwnd, callback = CALLBACK_MESSAGE, rc = { left: 0, top: 0, right: 0, bottom: 0 }) {
  return { cbSize: a.size, hWnd: handle(hwnd), uCallbackMessage: callback, uEdge: 1, rc: { ...rc }, lParam: 0 };
}
const positions = new Map();
const appBar = {
  CALLBACK_MESSAGE,
  get TASKBAR_CREATED_MESSAGE() { return load()?.message || 0; },
  register(hwnd, callback = CALLBACK_MESSAGE) {
    const a = load(); if (!a) return false;
    try { positions.delete(handle(hwnd).toString()); return !!a.send(0, appData(a, hwnd, callback)); } catch (_) { return false; }
  },
  setPos(hwnd, rect) {
    const a = load(); if (!a || !validRect(rect)) return null;
    try {
      const data = appData(a, hwnd, CALLBACK_MESSAGE, rect);
      a.send(2, data); // ABM_QUERYPOS; this message's return value is not a success flag.
      data.rc.bottom = data.rc.top + (rect.bottom - rect.top);
      if (!validRect(data.rc)) return null;
      const key = handle(hwnd).toString(), previous = positions.get(key);
      // QUERYPOS must still run for other bars; do not feed back unchanged ABN_POSCHANGED notifications.
      if (previous && ['left', 'top', 'right', 'bottom'].every(k => previous[k] === data.rc[k])) return { ...previous };
      if (!a.send(3, data)) return null; // ABM_SETPOS; returns TRUE according to the API.
      if (!validRect(data.rc)) return null;
      positions.set(key, { ...data.rc });
      return { ...data.rc };
    } catch (_) { return null; }
  },
  remove(hwnd) {
    const a = load(); if (!a) return false;
    try { positions.delete(handle(hwnd).toString()); return !!a.send(1, appData(a, hwnd)); } catch (_) { return false; }
  },
};
function sampleScreenColor(points) {
  const a = load();
  if (!a || !Array.isArray(points) || !points.length || points.length > 16 ||
      !points.every(p => p && [p.x, p.y].every(n => Number.isInteger(n) && Math.abs(n) < 0x7fffffff))) return null;
  let dc;
  try {
    dc = a.getDC(0); if (!dc) return null;
    const colors = points.map(p => {
      const color = a.pixel(dc, p.x, p.y) >>> 0;
      return color === 0xffffffff ? null : { r: color & 255, g: (color >>> 8) & 255, b: (color >>> 16) & 255 };
    });
    return colors.some(Boolean) ? colors : null;
  } catch (_) { return null; }
  finally { if (dc) { try { a.releaseDC(0, dc); } catch (_) {} } }
}
module.exports = { sampleScreenColor, appBar, handle, validRect };

// Real Windows HWND/GDI/DWM smoke check; does not assert visual appearance.
const assert = require('assert/strict');
const { app, BrowserWindow } = require('electron');
const { performance } = require('perf_hooks');
const { Material } = require('../src/main/material');
const native = require('../src/main/win32');
const timer = setTimeout(() => app.exit(1), 30000);
app.whenReady().then(() => {
  assert.equal(process.platform, 'win32');
  const w = new BrowserWindow({ width: 400, height: 200, frame: false, transparent: true, show: false });
  const koffi = require('koffi');
  const gdi = koffi.load('gdi32.dll'), user = koffi.load('user32.dll');
  const create = gdi.func('void * __stdcall CreateRectRgn(int32 l, int32 t, int32 r, int32 b)');
  const del = gdi.func('bool __stdcall DeleteObject(void *obj)');
  const get = user.func('int32 __stdcall GetWindowRgn(uintptr_t hwnd, void *region)');
  const inside = gdi.func('bool __stdcall PtInRegion(void *region, int32 x, int32 y)');
  const rawHandle = w.getNativeWindowHandle();
  const handle = rawHandle.length === 8 ? rawHandle.readBigUInt64LE(0) : BigInt(rawHandle.readUInt32LE(0));
  const rect = { x: 10, y: 10, width: 200, height: 80, radius: 40 };
  const m = new Material({ window: w, native, zoom: () => 1, dpi: () => 1, publish: () => {}, initialRect: rect });
  m.apply('acrylic');
  assert.deepEqual(m.state(), { material: 'acrylic', supported: true });
  const region = create(0, 0, 1, 1);
  try {
    assert.ok(get(handle, region) > 0);
    assert.equal(inside(region, 110, 50), true);
    assert.equal(inside(region, 10, 10), false, 'corner outside pill');
    const times = [];
    for (let i = 0; i < 300; i++) {
      const start = performance.now();
      assert.equal(native.setPillRegion(handle, { ...rect, width: 200 + i % 2 }), true);
      times.push(performance.now() - start);
    }
    times.sort((a, b) => a - b);
    const mean = times.reduce((a, b) => a + b, 0) / times.length;
    console.log(JSON.stringify({ samples: times.length, meanMs: mean, p95Ms: times[284], maxMs: times[299], material: m.state() }));
    assert.ok(mean < 1, 'mean region update must be <1ms');
    m.apply('glass');
    assert.equal(get(handle, region), 0, 'glass clears region');
  } finally { del(region); w.destroy(); }
  clearTimeout(timer); app.exit(0);
}).catch((err) => { console.error(err); clearTimeout(timer); app.exit(1); });

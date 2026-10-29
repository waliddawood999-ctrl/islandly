const assert = require('assert/strict');
const { Material, physicalRect } = require('../src/main/material');
const { setPillRegion } = require('../src/main/win32');
assert.deepEqual(physicalRect({ x: 10, y: 5, width: 100, height: 40, radius: 30 }, .8, 1.5),
  { x: 12, y: 6, width: 120, height: 48, radius: 24 });
for (const rect of [null, {}, { x: -1, y: 0, width: 10, height: 10, radius: 3 }, { x: 0, y: 0, width: NaN, height: 10, radius: 3 }]) assert.equal(physicalRect(rect, 1, 1), null);
const rect = { x: 1, y: 2, width: 100, height: 40, radius: 20 };
let deleted = 0;
const hwndBuffer = Buffer.alloc(8); hwndBuffer.writeBigUInt64LE(77n);
const ffi = { CreateRoundRectRgn: (...args) => { assert.deepEqual(args, [1, 2, 102, 43, 40, 40]); return 88; }, SetWindowRgn: (h) => { assert.equal(h, 77n); return 1; }, DeleteObject: () => deleted++ };
assert.equal(setPillRegion(hwndBuffer, rect, ffi), true);
assert.equal(deleted, 0, 'Windows owns successful region');
ffi.SetWindowRgn = () => 0;
assert.equal(setPillRegion(77, rect, ffi), false);
assert.equal(deleted, 1, 'failed region freed');
ffi.SetWindowRgn = (_h, region) => { assert.equal(region, null); return 1; };
assert.equal(setPillRegion(77, null, ffi), true);
function fixture(platform = 'win32', release = '10.0.22631') {
  const calls = [], events = [];
  const window = { getNativeWindowHandle: () => Buffer.alloc(8), setBackgroundMaterial: (m) => calls.push(m) };
  const native = { setPillRegion: (_h, r) => { calls.push(r); return true; } };
  const m = new Material({ window, native, zoom: () => .8, dpi: () => 1.5, publish: (s) => events.push(s), platform, release, initialRect: rect });
  return { m, calls, events, window, native };
}
let f = fixture(); f.m.apply('acrylic');
assert.deepEqual(f.m.state(), { material: 'acrylic', supported: true });
let count = f.calls.length; f.m.shape(rect); assert.equal(f.calls.length, count, 'identical shape skipped');
f.m.resized(); assert.equal(f.calls.length, count + 1, 'resize reapplies region');
f.m.apply('glass'); assert.deepEqual(f.calls.slice(-2), ['none', null]);
f.m.apply('acrylic'); assert.equal(f.m.state().material, 'acrylic');
f.native.setPillRegion = () => false; f.m.resized(); assert.deepEqual(f.m.state(), { material: 'glass', supported: false });
f = fixture(); f.window.setBackgroundMaterial = () => { throw new Error('DWM failure'); }; f.m.apply('acrylic'); assert.equal(f.m.state().supported, false);
for (const [platform, release] of [['linux', '6.1'], ['win32', '10.0.19045'], ['win32', 'bad']]) {
  f = fixture(platform, release); f.m.apply('acrylic'); assert.deepEqual(f.m.state(), { material: 'glass', supported: false });
}
console.log('material: DPI geometry, region ownership, deduplication, resize and fallback pass');

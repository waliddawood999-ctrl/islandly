const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { Surface } = require('../src/main/surface');
const { AppBarSession } = require('../src/main/appbar-session');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'islandly-appbar-'));
const hwnd = Buffer.alloc(8); hwnd.writeBigUInt64LE(123n);
const fresh = Buffer.alloc(8); fresh.writeBigUInt64LE(456n);
const rect = { left: -1920, top: 0, right: 0, bottom: 66 };
const calls = [];
const native = {
  CALLBACK_MESSAGE: 0x81a1, TASKBAR_CREATED_MESSAGE: 0xc123,
  register: h => (calls.push(['new', h.readBigUInt64LE().toString()]), true),
  setPos: (h, r) => (calls.push(['pos', { ...r }]), r),
  remove: h => (calls.push(['remove', h.readBigUInt64LE().toString()]), true),
};
let passed = 0;
function test(name, fn) { return Promise.resolve().then(fn).then(() => { console.log('PASS ' + name); passed++; }); }
(async () => {
  await test('FFI layout, COLORREF decoding, DC cleanup, AppBar query/set and feedback suppression', () => {
    const ffiCalls = [];
    let color = 0x00332211;
    const fakeApi = {
      RegisterWindowMessageW: () => 0xc123, GetDC: () => 9,
      ReleaseDC: () => (ffiCalls.push('releaseDC'), 1),
      GetPixel: () => { if (color === 'throw') throw Error('pixel failed'); return color; },
      SHAppBarMessage: (message, data) => {
        assert.equal(data.cbSize, 48); assert.equal(data.hWnd, 123n); assert.equal(data.uEdge, 1);
        ffiCalls.push(message);
        if (message === 2) data.rc.top = 30;
        return 1;
      },
    };
    const fields = {};
    const koffi = {
      struct: (name, shape) => (fields[name] = shape, name), sizeof: () => 48,
      load: () => ({ func: signature => fakeApi[signature.match(/([A-Za-z0-9]+)\(/)[1]] }),
    };
    const module = { exports: {} };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/main/win32-surface.js'), 'utf8'), { module, Buffer, process: { platform: 'win32' }, require: () => koffi });
    const adapter = module.exports;
    assert.equal(JSON.stringify(adapter.sampleScreenColor([{ x: -1, y: 2 }])), JSON.stringify([{ r: 17, g: 34, b: 51 }]));
    assert.equal(fields.ISL_APPBARDATA.hWnd, 'uintptr_t');
    color = 0xffffffff; assert.equal(adapter.sampleScreenColor([{ x: 0, y: 0 }]), null);
    color = 'throw'; assert.equal(adapter.sampleScreenColor([{ x: 0, y: 0 }]), null);
    assert.equal(ffiCalls.filter(c => c === 'releaseDC').length, 3);
    assert.equal(adapter.appBar.register(hwnd), true);
    assert.equal(adapter.appBar.setPos(hwnd, rect).bottom, 96, 'requested height retained after QUERYPOS top adjustment');
    adapter.appBar.setPos(hwnd, rect);
    assert.equal(ffiCalls.filter(c => c === 3).length, 1, 'unchanged grant does not generate another SETPOS');
    assert.equal(adapter.appBar.remove(hwnd), true);
  });
  await test('marker before reservation, clean removal, failed removal retains marker', () => {
    const dir = path.join(temp, 'clean');
    const session = new AppBarSession({ native, userData: dir });
    assert(session.recover(hwnd));
    assert(session.register(hwnd, native.CALLBACK_MESSAGE));
    assert.equal(JSON.parse(fs.readFileSync(session.file)).pid, process.pid);
    assert(session.setPos(hwnd, rect));
    assert.deepEqual(JSON.parse(fs.readFileSync(session.file)).rect, rect);
    const remove = native.remove; native.remove = () => false;
    assert.equal(session.remove(hwnd), false); assert(fs.existsSync(session.file));
    native.remove = remove;
    assert(session.remove(hwnd)); assert(!fs.existsSync(session.file));
  });
  await test('live PID is never recovered or overwritten', () => {
    const session = new AppBarSession({ native, userData: path.join(temp, 'live'), isAlive: () => true });
    session.write({ pid: 1234, edge: 1, rect });
    calls.length = 0;
    assert.equal(session.recover(fresh), false); assert.equal(session.register(fresh), false);
    assert.equal(calls.length, 0); assert(fs.existsSync(session.file));
  });
  await test('crash recovery uses NEW/POS/REMOVE on fresh handle and retains marker if recovery fails', () => {
    const session = new AppBarSession({ native, userData: path.join(temp, 'dead'), isAlive: () => false });
    session.write({ pid: 1234, edge: 1, hwnd: '123', rect });
    calls.length = 0;
    assert(session.recover(fresh));
    assert.deepEqual(calls, [['new', '456'], ['pos', rect], ['remove', '456']]);
    assert(!fs.existsSync(session.file));
    session.write({ pid: 1234, edge: 1, rect });
    const remove = native.remove; native.remove = () => false;
    assert.equal(session.recover(fresh), false); assert(fs.existsSync(session.file)); native.remove = remove;
  });
  await test('sampling is opt-in, throttled across toggles, and stops when hidden/open', () => {
    let now = 0, samples = 0;
    const tints = [];
    const win = { isDestroyed: () => false, isVisible: () => true, getBounds: () => ({ x: 0, y: 0, width: 200, height: 60 }) };
    const surface = new Surface({ win32: { sampleScreenColor: () => (++samples, [{ r: 1, g: 2, b: 3 }]) }, getWindow: () => win, onTint: t => tints.push(t), now: () => now });
    surface.setMode('overlay'); surface.setResting(true); assert.equal(samples, 0);
    surface.setSamplingEnabled(true); assert.equal(samples, 1);
    surface.setVisible(false); surface.sample(); assert.equal(samples, 1); assert.equal(tints.at(-1), null);
    surface.setVisible(true); surface.sample(); assert.equal(samples, 1);
    now = 499; surface.sample(); assert.equal(samples, 1);
    now = 500; surface.sample(); assert.equal(samples, 2);
    surface.setResting(false); now = 1000; surface.sample(); assert.equal(samples, 2);
    surface.stop(); assert.equal(surface.timer, null);
  });
  await test('secondary-monitor DPI, Explorer restart, destroyed-window cleanup and failed positioning', () => {
    calls.length = 0;
    let destroyed = false;
    const hooks = {};
    const win = { isDestroyed: () => destroyed, getNativeWindowHandle: () => hwnd, getBounds: () => ({ x: -1400, y: 0, width: 100, height: 60 }), hookWindowMessage: (m, cb) => { hooks[m] = cb; } };
    const screen = { getDisplayMatching: () => ({ bounds: { x: -1280, y: 0, width: 1280, height: 720 } }), dipToScreenRect: (_, r) => ({ x: r.x * 1.5, y: 0, width: r.width * 1.5, height: r.height * 1.5 }) };
    const surface = new Surface({ win32: { appBar: native }, getWindow: () => win, screen, onTint: () => {} });
    surface.setBarHeight(44); surface.setMode('appbar');
    assert.deepEqual(calls.find(c => c[0] === 'pos')[1], rect);
    calls.length = 0; hooks[0xc123](); assert.deepEqual(calls.map(c => c[0]), ['remove', 'new', 'pos']);
    destroyed = true; calls.length = 0; surface.stop(); assert.deepEqual(calls, [['remove', '123']]);
    destroyed = false;
    const failing = new Surface({ win32: { appBar: { ...native, setPos: () => null } }, getWindow: () => win, screen, onTint: () => {} });
    failing.setBarHeight(44); failing.setMode('appbar'); assert.equal(failing.barRegistered, false); failing.stop();
  });
  await test('forced process termination leaves a marker; relaunch recovers it', async () => {
    const dir = path.join(temp, 'killed');
    const childFile = path.join(temp, 'child.cjs');
    fs.writeFileSync(childFile, `const { AppBarSession } = require(${JSON.stringify(path.join(__dirname, '../src/main/appbar-session'))});
      const h = Buffer.alloc(8); h.writeBigUInt64LE(123n);
      const native = { register: () => true, setPos: (_, r) => r, remove: () => true, CALLBACK_MESSAGE: 0x81a1 };
      const session = new AppBarSession({native,userData:${JSON.stringify(dir)}});
      session.register(h,0x81a1); session.setPos(h,${JSON.stringify(rect)});
      process.stdout.write('READY\\n'); setInterval(() => {}, 1000);`);
    const child = spawn(process.execPath, [childFile], { stdio: ['ignore', 'pipe', 'pipe'] });
    try {
      const ready = await Promise.race([once(child.stdout, 'data'), once(child, 'error').then(([err]) => { throw err; }), new Promise((_, reject) => { const t = setTimeout(() => reject(Error('child timeout')), 5000); t.unref(); })]);
      assert.match(ready[0].toString(), /READY/);
      const exit = once(child, 'exit'); child.kill('SIGKILL'); await exit;
      const session = new AppBarSession({ native, userData: dir }); calls.length = 0;
      assert(session.recover(fresh)); assert.deepEqual(calls.map(c => c[0]), ['new', 'pos', 'remove']);
      assert(!fs.existsSync(session.file));
    } finally { if (child.exitCode === null) child.kill('SIGKILL'); }
  });
  console.log(`${passed} T7 surface/Win32 scenarios passed`);
})().catch(err => { console.error(err); process.exitCode = 1; }).finally(() => fs.rmSync(temp, { recursive: true, force: true }));

const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const path = require('node:path');
const { PerformanceMonitor } = require('../src/main/perf');
let active = false, cpu = 99, tick;
const events = [];
const win = Object.assign(new EventEmitter(), {
  isDestroyed: () => false, isVisible: () => true,
  webContents: Object.assign(new EventEmitter(), { getOSProcessId: () => 1, send: (ch, data) => events.push([ch, data]) }),
});
const monitor = new PerformanceMonitor({
  app: { getAppMetrics: () => [{ type: 'Browser', pid: 1, memory: { workingSetSize: 10240 }, cpu: { percentCPUUsage: cpu } }] },
  windows: () => ({ settings: win }), active: () => active, nativeOwnerPid: 2,
  children: () => [{ pid: 2, type: 'other' }], metric: pid => ({ pid, mb: 40, cpu: 0 }),
  setTimer: fn => { tick = fn; return 1; }, clearTimer: () => {},
});
assert.equal(monitor.get().state, 'idle', 'CPU activity must not classify a workload as an open panel');
assert.equal(monitor.get().totalMB, 50);
assert.equal(monitor.get().processes.filter(p => p.pid === 2).length, 1);
assert.equal(monitor.get().processes.find(p => p.pid === 2).label, 'host');
active = true; cpu = 0;
assert.equal(monitor.get().state, 'active', 'a low-CPU settings panel remains active');
monitor.watch(win, true); tick();
assert.equal(events[0][0], 'perf:update'); assert.equal(events[0][1].state, 'active');
active = false; tick(); assert.equal(events[1][1].state, 'idle'); monitor.stop();

// Exercise the real preload allowlist and listener cleanup without renderer changes.
const ipc = new EventEmitter(); ipc.sendSync = () => ({});
let bridge;
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/main/palette-preload.js'), 'utf8'), {
  require: () => ({ ipcRenderer: ipc, contextBridge: { exposeInMainWorld: (_, api) => { bridge = api; } } }),
});
for (const ch of ['settings:update', 'eco:changed']) {
  let received;
  const stop = bridge.on(ch, value => { received = value; });
  const payload = { eco: true, motion: 'off' }; ipc.emit(ch, {}, payload);
  assert.equal(received, payload); stop(); assert.equal(ipc.listenerCount(ch), 0);
}
assert.equal(bridge.on('perf:update', () => {}), undefined);
assert.equal(ipc.listenerCount('perf:update'), 0);

// Exercise actual Palette.toggle payload using a fake Electron window.
const filename = path.join(__dirname, '../src/main/palette.js');
const localRequire = createRequire(filename), moduleMock = { exports: {} };
vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
  require: id => id === 'electron' ? { ipcMain: { handle() {}, on() {} }, screen: {
    getCursorScreenPoint: () => ({}), getDisplayNearestPoint: () => ({ workArea: { x: 0, y: 0, width: 1000, height: 800 } }),
  } } : localRequire(id), module: moduleMock, setTimeout,
});
let eco = true, motion = 'off'; const sent = [];
const palette = new moduleMock.exports.Palette({ root: '', settings: { get: () => ({ lang: 'ar', uiLang: 'ar', digits: 'arab', motion, ecoMode: false }) }, effectiveEco: () => eco });
palette.win = { isDestroyed: () => false, isVisible: () => false, getSize: () => [620], setPosition() {}, show() {}, focus() {},
  webContents: { isLoading: () => false, send: (ch, data) => sent.push([ch, data]) } };
palette.toggle();
assert.equal(sent[0][0], 'palette:shown'); assert.equal(sent[0][1].motion, 'off'); assert.equal(sent[0][1].ecoMode, true);
assert.equal(sent[0][1].digits, 'arab'); assert.equal(sent[1][1].eco, true);
eco = false; motion = 'full'; palette.toggle(); assert.equal(sent[2][1].ecoMode, false); assert.equal(sent[2][1].motion, 'full');
console.log('T19 perf workload state, native host accounting, palette preload events and live show payload passed');

const assert = require('assert/strict');
const { EventEmitter } = require('events');
const { EcoController } = require('../src/main/eco');
const { PerformanceMonitor } = require('../src/main/perf');
const { track, list } = require('../src/main/owned-processes');
const pm = new EventEmitter(); pm.isOnBatteryPower = () => true;
let s = { ecoMode: false, ecoAuto: false }, applied = [], published = [];
const eco = new EcoController({ powerMonitor: pm, settings: () => s, apply: (v) => applied.push(v), publish: (v) => published.push(v) });
eco.start(); assert.deepEqual(eco.state(), { eco: false });
s.ecoAuto = true; eco.update(); assert.equal(eco.state().eco, true);
pm.emit('on-ac'); assert.equal(eco.state().eco, false);
s.ecoMode = true; eco.update(); pm.emit('on-ac'); assert.equal(eco.state().eco, true);
const n = published.length; eco.update(); assert.equal(published.length, n, 'no duplicate Eco events');
pm.emit('suspend'); assert.equal(applied.at(-1).suspended, true);
pm.emit('resume'); assert.equal(applied.at(-1).suspended, false);
s.ecoMode = false; eco.update(); assert.equal(eco.state().eco, true, 'resume re-read battery');
eco.stop(); for (const event of ['on-ac', 'on-battery', 'suspend', 'resume']) assert.equal(pm.listenerCount(event), 0);
const child = new EventEmitter(); child.pid = 99999; track(child, 'powershell'); assert.equal(list()[0].pid, 99999); child.emit('exit'); assert.equal(list().length, 0);
const w = new EventEmitter(); w.webContents = new EventEmitter();
let visible = true, sent = [], ticks = new Map(), id = 0;
w.isDestroyed = () => false; w.isVisible = () => visible;
w.webContents.getOSProcessId = () => 2; w.webContents.send = (...args) => sent.push(args);
const perf = new PerformanceMonitor({ app: { getAppMetrics: () => [
  { type: 'Browser', pid: 1, memory: { workingSetSize: 10240 }, cpu: { percentCPUUsage: .3 } },
  { type: 'Tab', pid: 2, memory: { workingSetSize: 20480 }, cpu: { percentCPUUsage: .2 } },
  { type: 'GPU', pid: 3, memory: { workingSetSize: 30720 }, cpu: { percentCPUUsage: .1 } },
] }, windows: () => ({ settings: w }), children: () => [{ pid: 4, type: 'powershell' }, { pid: 5, type: 'other' }],
metric: (pid) => pid === 4 ? { pid, mb: 4.44, cpu: .1 } : null,
setTimer: (cb, ms) => { assert.equal(ms, 5000); ticks.set(++id, cb); return id; }, clearTimer: (i) => ticks.delete(i) });
let report = perf.get(); assert.equal(report.totalMB, 64.4); assert.equal(report.powershellCount, 1);
assert.deepEqual(report.processes.map((p) => p.type), ['browser', 'renderer', 'gpu', 'powershell']);
assert.equal(report.processes[1].label, 'settings'); assert.equal(ticks.size, 0);
perf.watch(w, true); perf.watch(w, true); assert.equal(ticks.size, 1); [...ticks.values()][0](); assert.equal(sent[0][0], 'perf:update');
w.emit('hide'); assert.equal(ticks.size, 0); assert.equal(w.listenerCount('closed'), 0);
visible = false; perf.watch(w, true); assert.equal(ticks.size, 0);
visible = true;
for (const [target, event] of [[w, 'closed'], [w.webContents, 'render-process-gone'], [w.webContents, 'did-start-loading']]) {
  perf.watch(w, true); target.emit(event); assert.equal(ticks.size, 0);
}
perf.watch(w, 'true'); assert.equal(ticks.size, 0);
console.log('Eco/perf: battery/manual precedence, suspend/resume, listener cleanup, full totals and subscription lifetime pass');

const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { PassThrough, Writable } = require('node:stream');
const Module = require('node:module');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { CommandHost } = require('../src/main/ps');
const { activityPolicy } = require('../src/main/activity-policy');
const original = Module._load;
let sequence = 1, text = 'initial', reads = 0, resolveRead;
const native = require('../src/main/native-perf');
const originalSequence = native.clipboardSequence;
native.clipboardSequence = () => sequence;
Module._load = function(id, ...args) {
  if (id === 'electron') return { clipboard: { readText: () => { reads++; return resolveRead ? new Promise(resolve => { resolveRead = resolve; }) : Promise.resolve(text); } } };
  return original.call(this, id, ...args);
};
const { ClipboardHistory } = require('../src/main/clipboard');
Module._load = original;
let passed = 0;
async function test(name, fn) { await fn(); passed++; console.log('PASS ' + name); }
(async () => {
  await test('clipboard reads only new native sequences and discards late reads after stop', async () => {
    const events = [], history = new ClipboardHistory(items => events.push(items));
    history.generation = 1;
    await history.poll(); await history.poll(); assert.equal(reads, 1);
    sequence++; text = 'new'; await history.poll(); assert.equal(reads, 2); assert.equal(history.list()[0].text, 'new');
    sequence++; resolveRead = true;
    const pending = history.poll(); const resolve = resolveRead;
    history.stop(); resolve('late'); await pending;
    assert.equal(history.list().length, 1);
    native.clipboardSequence = originalSequence;
  });
  await test('one host multiplexes fixed scripts/media; timeout settles all requests without a respawn loop', async () => {
    let launches = 0, child;
    const host = new CommandHost({ windows: true, launch: () => {
      launches++; child = new EventEmitter(); child.pid = 123; child.stdout = new PassThrough();
      child.stdin = new Writable({ write(chunk, enc, callback) { const msg = JSON.parse(chunk); if (msg.script !== 'brightness.ps1') child.stdout.write(JSON.stringify({ id: msg.id, ok: true, output: '[]' }) + '\n'); callback(); } });
      child.kill = () => {}; return child;
    } });
    assert((await host.request('bt-battery.ps1')).ok);
    assert((await host.request('media', [], 'caps')).ok);
    assert.equal(launches, 1); assert.deepEqual(host.pids(), [123]);
    assert.equal((await host.request('not-allowed.ps1')).ok, false);
    const pending = host.request('brightness.ps1', [50], '', 10);
    assert.equal((await pending).ok, false);
    assert.equal((await host.request('media', [], 'caps')).ok, false);
    assert.equal(launches, 1); assert.equal(host.pending.size, 0); host.shutdown();
  });
  await test('visibility/expanded/Eco policy keeps security events independent and suppresses optional work', () => {
    const base = { hidden: false, fullscreen: false, expanded: true, eco: false, clipboard: true, tracking: true };
    assert(activityPolicy(base).bluetooth);
    assert(!activityPolicy({ ...base, expanded: false }).bluetooth);
    assert(!activityPolicy({ ...base, hidden: true }).clipboard);
    assert(!activityPolicy({ ...base, fullscreen: true }).system);
    const eco = activityPolicy({ ...base, eco: true });
    assert.equal(eco.clipboardMs, 4000); assert(!eco.bluetooth && !eco.system && !eco.tracking && eco.networkPaused);
  });
  await test('perf includes GPU/native host totals, scoped five-second subscription and close cleanup', () => {
    const { PerformanceMonitor } = require('../src/main/perf');
    const window = new EventEmitter(); window.isDestroyed = () => false; window.isVisible = () => true;
    const events = []; window.webContents = { getOSProcessId: () => 7, send: (...args) => events.push(args) };
    let tick, interval, cleared = false;
    const monitor = new PerformanceMonitor({ app: { getAppMetrics: () => [{ type: 'Tab', pid: 7, memory: { workingSetSize: 10240 }, cpu: { percentCPUUsage: 0.5 } }, { type: 'GPU', pid: 8, memory: { workingSetSize: 20480 }, cpu: { percentCPUUsage: 0.2 } }] }, host: { pids: () => [] }, windows: () => ({ settings: window }), setTimer: (fn, ms) => { tick = fn; interval = ms; return 42; }, clearTimer: () => { cleared = true; } });
    const sample = monitor.get(); assert.equal(sample.totalMB, 30); assert.equal(sample.processes[0].label, 'settings'); assert.equal(sample.processes[1].type, 'gpu');
    monitor.watch(window, true); assert.equal(interval, 5000); tick(); assert.equal(events.length, 1);
    window.emit('closed'); assert(cleared); assert.equal(monitor.target, null); assert.equal(monitor.timer, null);
  });
  await test('native registry notifications rearm and cancellation releases the event/registry handles without polling', () => {
    let callback, notifications = 0, closes = 0;
    const wait = () => {}; wait.async = (_, ms, cb) => { assert.equal(ms, 0xffffffff); callback = cb; };
    const api = {
      GetClipboardSequenceNumber: () => 42, RegOpenKeyExW: (key, name, opt, access, out) => { out[0] = 5; return 0; },
      RegCloseKey: () => { closes++; }, RegEnumKeyExW: () => 259, RegQueryValueExW: () => 2,
      RegNotifyChangeKeyValue: (key, tree, flags) => { assert.equal(flags, 0x10000005); notifications++; return 0; },
      CreateEventW: () => 9, SetEvent: () => { callback(null, 0); return true; }, WaitForSingleObject: wait,
      CloseHandle: () => { closes++; }, OpenProcess: () => null, GetProcessMemoryInfo: () => false, GetProcessTimes: () => false,
    };
    const module = { exports: {} };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/main/native-perf.js'), 'utf8'), { module, Buffer, process: { platform: 'win32', arch: 'x64' }, performance, require: () => ({ load: () => ({ func: signature => api[signature.match(/([A-Za-z0-9]+)\(/)[1]] }) }) });
    let changed = 0;
    assert.equal(module.exports.clipboardSequence(), 42);
    const stop = module.exports.watchPrivacy(() => changed++);
    callback(null, 0); assert.equal(changed, 1); assert.equal(notifications, 2);
    stop(); assert.equal(changed, 1); assert.equal(closes, 2);
  });
  await test('calendar defers parsing until a response arrives and optional service pause retains configuration', async () => {
    const parser = require.resolve('../src/main/ics'); delete require.cache[parser];
    Module._load = function(id, ...args) {
      if (id === 'electron') return { net: { fetch: async () => new Response('BEGIN:VCALENDAR\r\nEND:VCALENDAR') } };
      return original.call(this, id, ...args);
    };
    const { CalendarFeed } = require('../src/main/calendar');
    Module._load = original;
    assert(!require.cache[parser]);
    const feed = new CalendarFeed(() => {}); feed.url = 'https://fixture.invalid/calendar';
    await feed.refresh(); assert(require.cache[parser]);
    feed.setPaused(true); assert.equal(feed.timer, null); assert.equal(feed.url, 'https://fixture.invalid/calendar');
    feed.setPaused(false); assert(feed.timer); feed.stop();
  });
  console.log(`${passed} T9 regressions passed`);
})().catch(err => { console.error(err); process.exitCode = 1; }).finally(() => { native.clipboardSequence = originalSequence; });

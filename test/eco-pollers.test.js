const assert = require('assert/strict'), fs = require('fs'), path = require('path'), vm = require('vm');
function load(file, stubs = {}) {
  const timers = new Map(); let id = 0;
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/main', file), 'utf8'), {
    module, exports: module.exports, process, Buffer, console,
    require: (name) => name in stubs ? stubs[name] : require(require.resolve(name, { paths: [path.join(__dirname, '../src/main', path.dirname(file))] })),
    setInterval: (cb, ms) => { timers.set(++id, { cb, ms }); return id; }, clearInterval: (id) => timers.delete(id),
    setTimeout: (cb, ms) => { timers.set(++id, { cb, ms }); return id; }, clearTimeout: (id) => timers.delete(id),
  });
  return { exports: module.exports, timers };
}
const clipboard = load('clipboard.js', { electron: { clipboard: {} } });
const history = new clipboard.exports.ClipboardHistory(() => {});
history.start(); assert.equal([...clipboard.timers.values()][0].ms, 800);
history.last = 'previous'; history.setEco(true); assert.equal(history.last, 'previous');
assert.equal([...clipboard.timers.values()][0].ms, 4000);
history.setEco(false); assert.equal(clipboard.timers.size, 1); history.stop(); assert.equal(clipboard.timers.size, 0);
const system = load('services/sysinfo.js'); const sys = new system.exports.SysInfo(() => {});
sys.watch(true); assert.equal(system.timers.size, 1); sys.setPaused(true); assert.equal(system.timers.size, 0);
sys.watch(true); assert.equal(system.timers.size, 0); sys.setPaused(false); assert.equal(system.timers.size, 1);
sys.watch(false); sys.setPaused(true); sys.setPaused(false); assert.equal(system.timers.size, 0);
const foreground = load('fullscreen.js', { './win32': { available: () => true, foreground: () => ({ app: '', title: '', fullscreen: false }) } });
const watcher = foreground.exports.watchForeground({ onFullscreen() {} }); watcher.setEco(true);
const firstTick = [...foreground.timers.entries()][0]; foreground.timers.delete(firstTick[0]); firstTick[1].cb();
assert.equal([...foreground.timers.values()][0].ms, 3000); watcher.setEco(false); assert.equal(foreground.timers.size, 1); watcher.stop();
let requests = 0;
const weather = load('services/weather.js', { electron: { net: { fetch: () => { requests++; return Promise.reject(Error('offline')); } } } });
const wx = new weather.exports.Weather(() => {}); wx.setPaused(true); wx.configure({ lat: 1, lng: 2 }, true);
assert.equal(requests, 0); assert.equal(weather.timers.size, 0); wx.setPaused(false); assert.equal(requests, 1); assert.equal(weather.timers.size, 1);
wx.setPaused(true); wx.configure({ lat: 3, lng: 4 }, false); wx.setPaused(false); assert.equal(weather.timers.size, 0);
const bt = load('bluetooth.js', { './ps': { isWindows: true, runOnce: () => { requests++; return Promise.resolve(''); } } });
const bluetooth = new bt.exports.BluetoothWatcher(() => {}); bluetooth.setPaused(true); bluetooth.start(); assert.equal(bt.timers.size, 0);
bluetooth.setPaused(false); assert.equal(bt.timers.size, 1); bluetooth.setPaused(true); assert.equal(bt.timers.size, 0);
console.log('Eco pollers: cadence changes, paused startup, setting changes during pause and subscription restoration pass');

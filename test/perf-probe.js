// Run with Electron. Writes real process metrics; music is a labelled local event fixture, not a real player.
const fs = require('fs'), path = require('path'), os = require('os');
const { app } = require('electron');
if (process.env.ISLANDLY_PERF_GPU_OFF === '1') app.disableHardwareAcceleration();
const root = path.resolve(process.env.ISLANDLY_PERF_ROOT || path.join(__dirname, '..'));
const output = path.resolve(process.env.ISLANDLY_PERF_OUTPUT || 'perf-result.json');
const duration = Number(process.env.ISLANDLY_PERF_SECONDS) || 60;
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'islandly-perf-'));
app.setPath('userData', userData);
fs.writeFileSync(path.join(userData, 'settings.json'), JSON.stringify({ weather: false, updates: false, icsUrl: '', breakEvery: 0, timeTracking: false, prayerAlerts: false, hideFullscreen: false }));
const deps = path.join(__dirname, '../node_modules');
process.env.NODE_PATH = deps; require('module').Module._initPaths();
const spawned = [];
const live = new Map();
const native = require('../src/main/native-perf');
const cp = require('child_process');
for (const method of ['spawn', 'execFile']) {
  const original = cp[method];
  cp[method] = function(file, ...args) {
    const child = original.call(this, file, ...args);
    if (child.pid) { live.set(child.pid, path.basename(String(file)).toLowerCase()); child.once('exit', () => live.delete(child.pid)); }
    spawned.push({ at: Date.now(), pid: child.pid, name: path.basename(String(file)).toLowerCase() });
    return child;
  };
}
let bridge;
const MediaBridge = require(path.join(root, 'src/main/media')).MediaBridge;
const originalStart = MediaBridge.prototype.start;
MediaBridge.prototype.start = function() { bridge = this; return originalStart.call(this); };
process.env.ISLANDLY_TEST = '1';
require(path.join(root, 'src/main/main'));
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function measure(mode) {
  const started = Date.now(), samples = [];
  const fixture = mode === 'music-fixture' ? setInterval(() => bridge?.onUpdate({ type: 'media', active: true, playing: true, title: 'Local performance fixture', artist: 'not a real SMTC player', duration: 180, position: ((Date.now() - started) / 1000) % 180, sentAt: Date.now(), trackChanged: false, thumb: null }), 1000) : null;
  try {
    for (let n = 0; n < duration; n++) {
      await sleep(1000);
      const processes = app.getAppMetrics().map(p => ({ type: p.type, pid: p.pid, mb: p.memory.workingSetSize / 1024, cpu: p.cpu.percentCPUUsage }));
      for (const [pid, name] of live) { const metric = native.processMetrics(pid); if (metric) processes.push({ ...metric, type: /powershell/i.test(name) ? 'powershell' : 'other' }); }
      samples.push({ at: Date.now(), processes, totalMB: processes.reduce((s, p) => s + p.mb, 0), cpu: processes.reduce((s, p) => s + p.cpu, 0) });
    }
  } finally { clearInterval(fixture); }
  const launches = spawned.filter(p => p.at >= started);
  return { started, mode, seconds: duration, avgMB: samples.reduce((s, p) => s + p.totalMB, 0) / samples.length, peakMB: Math.max(...samples.map(s => s.totalMB)), avgCPU: samples.reduce((s, p) => s + p.cpu, 0) / samples.length, externalLaunchesPerMinute: launches.length * 60 / duration, launches, samples };
}
app.whenReady().then(async () => {
  await sleep(15000); // keep startup costs separate from the steady-state window
  if (!global.__islandly) throw Error('Application startup did not complete');
  const idle = await measure('idle');
  const music = await measure('music-fixture');
  const processAverages = phase => [...new Set(phase.samples.flatMap(s => s.processes.map(p => p.type)))].map(type => ({ type, mb: phase.samples.reduce((sum, s) => sum + s.processes.filter(p => p.type === type).reduce((sum, p) => sum + p.mb, 0), 0) / phase.samples.length }));
  const result = { platform: process.platform, electron: process.versions.electron, root, startupLaunches: spawned.filter(p => p.at < idle.started), idle, music, limitations: ['Automated Windows CI, not manual Windows desktop acceptance', 'music-fixture is local media:update events, not a real SMTC player', 'Electron metrics include GPU; live instrumented direct child processes include native working sets/CPU. Short-lived reg processes may finish between samples; launch counts remain exact.'] };
  console.log('Process breakdown: ' + JSON.stringify({ idle: processAverages(idle), music: processAverages(music) }));
  fs.writeFileSync(output, JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ idle: { mb: idle.avgMB, cpu: idle.avgCPU, launchesPerMinute: idle.externalLaunchesPerMinute }, musicFixture: { mb: music.avgMB, cpu: music.avgCPU, launchesPerMinute: music.externalLaunchesPerMinute } }));
  global.__islandly?.cleanup?.();
  await sleep(100);
  app.exit(0);
}).catch(err => { console.error(err); app.exit(1); });

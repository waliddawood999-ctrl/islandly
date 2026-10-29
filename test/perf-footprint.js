// Controlled footprint diagnosis. This does not change production startup or UI source.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { app, BrowserWindow, Menu } = require('electron');
const variant = process.env.ISLANDLY_FOOTPRINT_VARIANT || 'full-app';
if (!['full-app', 'compact-v8', 'blank-window'].includes(variant)) throw Error('invalid footprint variant');
if (variant === 'compact-v8') {
  // Diagnostic V8 sizing policy only; keep renderer isolation and the process architecture intact.
  app.commandLine.appendSwitch('js-flags', '--optimize-for-size');
  app.commandLine.appendSwitch('enable-low-end-device-mode');
}
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'islandly-footprint-'));
app.setPath('userData', dir);
Menu.setApplicationMenu(null);
if (variant !== 'blank-window') {
  fs.writeFileSync(path.join(dir, 'settings.json'), JSON.stringify({ weather: false, updates: false, icsUrl: '', breakEvery: 0, timeTracking: false, prayerAlerts: false, hideFullscreen: false }));
  process.env.ISLANDLY_TEST = '1';
  require('../src/main/main');
}
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let win;
app.whenReady().then(async () => {
  if (variant === 'blank-window') {
    // Same window/security/visibility characteristics; no backend, preload, fonts, CSS, media or app page.
    win = new BrowserWindow({ width: 200, height: 60, frame: false, transparent: true, resizable: false, movable: false,
      focusable: false, skipTaskbar: true, alwaysOnTop: true, hasShadow: false, show: false,
      webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: true } });
    await win.loadURL('data:text/html;charset=utf-8,%3C!doctype%20html%3E%3Ctitle%3EFootprint%20control%3C/title%3E');
    win.showInactive();
  }
  await sleep(15000);
  if (variant !== 'blank-window' && !global.__islandly) throw Error('Application startup did not complete');
  const samples = [];
  for (let n = 0; n < 60; n++) {
    await sleep(1000);
    const processes = app.getAppMetrics().map(p => ({ type: p.type, pid: p.pid, name: p.name || null, serviceName: p.serviceName || null,
      mb: p.memory.workingSetSize / 1024, peakMB: p.memory.peakWorkingSetSize / 1024, cpu: p.cpu.percentCPUUsage }));
    samples.push({ at: Date.now(), totalMB: processes.reduce((sum, p) => sum + p.mb, 0), processes, mainHeap: process.memoryUsage() });
  }
  const byType = [...new Set(samples.flatMap(s => s.processes.map(p => p.type)))].map(type => ({ type,
    avgMB: samples.reduce((sum, s) => sum + s.processes.filter(p => p.type === type).reduce((sum, p) => sum + p.mb, 0), 0) / samples.length }));
  const result = { variant, platform: process.platform, electron: process.versions.electron, sampleSeconds: 60, warmupSeconds: 15,
    averageMB: samples.reduce((sum, s) => sum + s.totalMB, 0) / samples.length, minMB: Math.min(...samples.map(s => s.totalMB)), peakMB: Math.max(...samples.map(s => s.totalMB)),
    mainHeapUsedMB: samples.reduce((sum, s) => sum + s.mainHeap.heapUsed / 1048576, 0) / samples.length, processes: byType, samples,
    limitations: ['Automated Windows CI; no manual desktop or real playback acceptance', 'Blank control is an experimental lower-workload window, not a replacement app', 'All Electron process working sets, including GPU/utility, are counted; no trimming or isolation changes'] };
  const output = path.resolve(process.env.ISLANDLY_FOOTPRINT_OUTPUT || `footprint-${variant}.json`);
  fs.writeFileSync(output, JSON.stringify(result, null, 2));
  console.log('FOOTPRINT ' + JSON.stringify({ ...result, samples: undefined }));
  global.__islandly?.cleanup?.();
  await sleep(100);
  app.exit(0);
}).catch(err => { console.error(err); global.__islandly?.cleanup?.(); app.exit(1); });

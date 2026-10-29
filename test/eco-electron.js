require('./electron-diagnostics');
// Runs the real main process and unchanged preloads/UI on Windows CI.
const assert = require('assert/strict');
const fs = require('fs'), os = require('os'), path = require('path');
const { spawn } = require('child_process');
const { app, BrowserWindow } = require('electron');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'islandly-eco-'));
app.setPath('userData', root);
fs.writeFileSync(path.join(root, 'settings.json'), JSON.stringify({ ecoMode: true, ecoAuto: false,
  weather: false, updates: false, clipboard: false, timeTracking: false, micCamIndicator: false, breakEvery: 0 }));
process.env.ISLANDLY_TEST = '1';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let child;
const watchdog = setTimeout(() => { console.error('Eco Electron watchdog'); if (child) child.kill(); app.exit(1); }, 45000);
require('../src/main/main');
async function until(fn, timeout = 10000) {
  const start = Date.now();
  while (!await fn()) { if (Date.now() - start > timeout) throw Error('timed out'); await wait(100); }
}
app.whenReady().then(async () => {
  await until(() => global.__islandly);
  const existingIds = new Set(BrowserWindow.getAllWindows().map((w) => w.id));
  global.__islandly.openSettings();
  const settings = BrowserWindow.getAllWindows().find((w) => !existingIds.has(w.id));
  assert.ok(settings);
  await until(() => settings.webContents.executeJavaScript('typeof settingsAPI !== "undefined"').catch(() => false));
  const run = (js) => settings.webContents.executeJavaScript(js);
  const before = await run('settingsAPI.perf()');
  assert.equal(before.state, 'active');
  assert.ok(before.totalMB > 0 && before.processes.some((p) => p.type === 'browser'));
  assert.ok(before.processes.some((p) => p.label === 'settings'));
  assert.equal(before.totalMB, Math.round(before.processes.reduce((n, p) => n + p.mb, 0) * 10) / 10);
  if (process.platform === 'win32') {
    child = require('../src/main/owned-processes').track(spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', 'Start-Sleep -Seconds 30'], { windowsHide: true }), 'powershell');
    await until(async () => (await run('settingsAPI.perf()')).processes.some((p) => p.pid === child.pid && p.mb > 0));
    assert.ok((await run('settingsAPI.perf()')).powershellCount >= 1);
    child.kill();
  }
  global.__islandly.palette.toggle();
  const palette = global.__islandly.palette.win;
  await until(() => palette.webContents.executeJavaScript('typeof paletteAPI !== "undefined"').catch(() => false));
  await palette.webContents.executeJavaScript("window.paletteSettings=[]; window.paletteEco=[]; paletteAPI.on('settings:update', v=>paletteSettings.push(v)); paletteAPI.on('eco:changed', v=>paletteEco.push(v));");
  await run("window.ecoEvents=[]; settingsAPI.on('eco:changed', v=>ecoEvents.push(v)); settingsAPI.set({ecoMode:false})");
  await until(() => run('ecoEvents.some(v=>v.eco===false)'));
  await until(() => palette.webContents.executeJavaScript('paletteEco.some(v=>v.eco===false) && paletteSettings.some(v=>v.ecoMode===false)'));
  global.__islandly.palette.hide();
  await run('settingsAPI.set({ecoMode:true})');
  await until(() => run('ecoEvents.some(v=>v.eco===true)'));
  await run("window.perfEvents=[]; settingsAPI.on('perf:update', v=>perfEvents.push(v)); settingsAPI.send('perf:watch', true)");
  await until(() => run('perfEvents.length > 0'), 8000);
  assert.equal(await run('perfEvents[0].state'), 'active');
  await run("settingsAPI.send('perf:watch', false)");
  await wait(200); const count = await run('perfEvents.length'); await wait(5300);
  assert.equal(await run('perfEvents.length'), count, 'unsubscribe stops real updates');
  await run('settingsAPI.watchPerf(true)'); settings.hide(); await wait(5300);
  assert.equal(await run('perfEvents.length'), count, 'hidden settings stops updates');
  console.log('REAL IPC PASS: full process totals, native PowerShell memory, Eco broadcasts, five-second subscription/unsubscribe/hide');
  clearTimeout(watchdog); app.quit();
}).catch((err) => { console.error(err); if (child) child.kill(); clearTimeout(watchdog); app.exit(1); });
app.on('quit', () => { try { fs.rmSync(root, { recursive: true, force: true }); } catch (_) {} });

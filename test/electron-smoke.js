// Boots the real app (main process + renderer) and checks that the IPC bridge and every feature loads.
//   xvfb-run -a npx electron test/electron-smoke.js --no-sandbox     (Linux)   |   npx electron test/electron-smoke.js   (Windows)
const fs = require('fs');
const os = require('os');
const path = require('path');
const { app, BrowserWindow } = require('electron');

const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'islandly-smoke-'));
app.setPath('userData', userData);
// Headless Linux has no clipboard owner and reading it can stall, so keep the poller off for this test.
fs.writeFileSync(path.join(userData, 'settings.json'), JSON.stringify({ clipboard: false }));
require('../src/main/main.js');

app.on('web-contents-created', (_e, wc) => {
  wc.on('console-message', (_ev, level, message, line, src) => console.log('RENDERER[' + level + '] ' + message + ' (' + String(src).split('/').pop() + ':' + line + ')'));
  wc.on('render-process-gone', (_ev, d) => console.log('RENDERER GONE ' + JSON.stringify(d)));
  wc.on('did-fail-load', (_ev, code, desc) => console.log('FAIL LOAD ' + code + ' ' + desc));
  wc.on('preload-error', (_ev, p, err) => console.log('PRELOAD ERROR ' + p + ' ' + err));
  wc.on('did-finish-load', () => console.log('LOADED ' + wc.getURL().split('/').pop()));
});
app.whenReady().then(() => {
  console.log('SMOKE ready-callback');
  return setTimeout(async () => {
    console.log('SMOKE timer fired');
    try {
    const win = BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().includes('renderer'));
    console.log('SMOKE step: window found=' + !!win);
    console.log('SMOKE 1+1=' + (await win.webContents.executeJavaScript('1+1')));
    console.log('SMOKE typeof Island=' + (await win.webContents.executeJavaScript('typeof Island')));
    const result = await win.webContents.executeJavaScript(`(async () => {
      const out = {};
      out.island = typeof Island;
      out.features = ['clock', 'music', 'timer', 'battery', 'clipboard', 'shelf', 'calendar', 'notice'].filter((id) => Island.feature(id));
      out.api = Object.keys(window.islandAPI).sort();
      out.settings = window.islandAPI.settings;
      out.shelf = await islandAPI.call('shelf:list');
      out.clipboard = await islandAPI.call('clipboard:list');
      out.calendar = await islandAPI.call('calendar:get');
      out.blocked = await islandAPI.call('not:allowed').then(() => 'NOT BLOCKED', (e) => 'blocked');
      Island.open('clipboard');
      await new Promise((r) => setTimeout(r, 700));
      out.panelWidth = Math.round(document.getElementById('island').getBoundingClientRect().width);
      return out;
    })()`);
    console.log('SMOKE ' + JSON.stringify(result));
    fs.writeFileSync(path.join(os.tmpdir(), 'islandly-smoke.png'), (await win.webContents.capturePage()).toPNG());
    } catch (e) { console.log('SMOKE ERROR ' + e.stack); }
    app.exit(0);
  }, 3500);
});

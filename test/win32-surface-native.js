// Actual Win32 ABI and forced termination/recovery checks, distinct from manual desktop acceptance.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { app, BrowserWindow, screen } = require('electron');
const native = require('../src/main/win32-surface');
const { AppBarSession } = require('../src/main/appbar-session');
const childMode = process.argv.includes('--appbar-crash-child');
let win, child, temp;
let registered = false;
app.whenReady().then(async () => {
  assert.equal(process.platform, 'win32');
  win = new BrowserWindow({ show: false, width: 100, height: 40, frame: false });
  const hwnd = win.getNativeWindowHandle();
  const b = screen.getPrimaryDisplay().bounds;
  const px = screen.dipToScreenRect(win, { ...b, height: 1 });
  const rect = { left: px.x, top: px.y, right: px.x + px.width, bottom: px.y + 1 };
  if (childMode) {
    const dir = process.argv.at(-1);
    const session = new AppBarSession({ native: native.appBar, userData: dir });
    assert(session.register(hwnd, native.appBar.CALLBACK_MESSAGE));
    assert(session.setPos(hwnd, rect));
    process.stdout.write('APPBAR_READY\n');
    return; // Keep the native window/process alive until the parent force-terminates it.
  }
  try {
    assert.equal(native.appBar.CALLBACK_MESSAGE, 0x81a1);
    assert(native.appBar.TASKBAR_CREATED_MESSAGE >= 0xc000, 'registered TaskbarCreated message');
    registered = native.appBar.register(hwnd, native.appBar.CALLBACK_MESSAGE);
    assert(registered, 'actual ABM_NEW must succeed');
    const granted = native.appBar.setPos(hwnd, rect);
    assert(granted, 'actual QUERYPOS/SETPOS must succeed');
    assert.equal(granted.bottom - granted.top, 1);
    const colors = native.sampleScreenColor([{ x: px.x, y: px.y }]);
    assert(colors === null || (colors.length === 1 && ['r', 'g', 'b'].every(k => Number.isInteger(colors[0]?.[k]) && colors[0][k] >= 0 && colors[0][k] <= 255)));
    console.log('Windows native: NEW/QUERYPOS/SETPOS, pointer-sized ABI, registered callback and GetPixel call passed; pixel readable=' + !!colors);
    assert(native.appBar.remove(hwnd), 'actual ABM_REMOVE must succeed'); registered = false;

    temp = fs.mkdtempSync(path.join(os.tmpdir(), 'islandly-native-recover-'));
    child = spawn(process.execPath, [__filename, '--appbar-crash-child', temp], { stdio: ['ignore', 'pipe', 'pipe'] });
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error('native crash child startup timeout')), 15000);
      let output = '', errors = '';
      child.stderr.on('data', bytes => { errors += bytes; });
      child.on('error', err => { clearTimeout(timer); reject(err); });
      child.on('exit', code => { clearTimeout(timer); reject(Error('native child exited early: ' + code + ' ' + errors)); });
      child.stdout.on('data', bytes => { output += bytes; if (output.includes('APPBAR_READY')) { clearTimeout(timer); resolve(); } });
    });
    const exit = once(child, 'exit'); child.kill('SIGKILL'); await exit;
    const marker = path.join(temp, 'appbar-marker.json');
    assert(fs.existsSync(marker), 'force-killed process must leave marker');
    const recovery = new AppBarSession({ native: native.appBar, userData: temp });
    assert(recovery.recover(hwnd), 'actual native NEW/SETPOS/REMOVE recovery must succeed on a new live HWND');
    assert(!fs.existsSync(marker), 'successful native recovery must clear marker');
    console.log('Windows native forced termination/recovery passed');
  } finally {
    if (child && child.exitCode === null && !child.signalCode) child.kill('SIGKILL');
    if (registered) native.appBar.remove(hwnd);
    win.destroy();
    if (temp) fs.rmSync(temp, { recursive: true, force: true });
  }
  app.exit(0);
}).catch(err => { console.error(err); if (registered && win) native.appBar.remove(win.getNativeWindowHandle()); app.exit(1); });

const path = require('path');
const { app, BrowserWindow, screen, ipcMain, Tray, Menu, globalShortcut, nativeImage, shell } = require('electron');
const nativeManaged = process.env.ISLANDLY_NATIVE_SESSION === '1';
if (nativeManaged && process.env.ISLANDLY_NATIVE_PROFILE) app.setPath('userData', process.env.ISLANDLY_NATIVE_PROFILE);
const { NativeSession } = require('./native-session');
if (nativeManaged) {
  // User-launched applications must survive closing our Chromium Job Object.
  shell.openExternal = async target => { const error = await nativeSession.external('url', target); if (error) throw Error(error); };
  shell.openPath = target => nativeSession.external('path', target);
  shell.showItemInFolder = target => { nativeSession.external('reveal', target); };
}
let nativeSession, nativeExpanded = true;
Menu.setApplicationMenu(null); // A widget has no application menu; avoid creating one at startup.
const settings = require('./settings');
const { PerformanceMonitor } = require('./perf');
const { activityPolicy } = require('./activity-policy');
const commandHost = require('./ps').host;
const { MediaBridge } = require('./media');
const { ClipboardHistory } = require('./clipboard');
const { Shelf } = require('./shelf');
const { CalendarFeed } = require('./calendar');
const { BluetoothWatcher } = require('./bluetooth');
const { watchForeground } = require('./fullscreen');
const { Updater, markBootOk } = require('./updater');
const { runOnce } = require('./ps');
const { logError } = require('./log');
const prayer = require('./services/prayer');
const { Weather } = require('./services/weather');
const { SysInfo } = require('./services/sysinfo');
const { Breaks } = require('./services/breaks');
const { jsonStore } = require('./services/store');
const { Tracker } = require('./services/tracker');
const { PrivacyWatcher } = require('./services/privacy');
const { GitHubWatcher } = require('./services/github');
const { Palette, openTarget } = require('./palette');
const { Surface } = require('./surface');
const apps = require('./services/apps');
const win32 = require('./win32');
const cities = require('./cities');

const isDev = process.argv.includes('--dev');
const info = global.__ISLANDLY || {
  root: path.join(__dirname, '..', '..'),
  baseRoot: path.join(__dirname, '..', '..'),
  version: require('../../package.json').version,
};
const asset = (name) => path.join(info.root, 'assets', name);

// A background widget should not pop up a modal crash dialog: keep running and write the error to a log file.
process.on('uncaughtException', (err) => logError('main', err));
// Last chance to give back a reserved AppBar strip (normal quit already does this in will-quit).
process.on('exit', () => surface && surface.stop());
process.on('unhandledRejection', (err) => logError('main (promise)', err));

let win = null;
let tray = null;
let settingsWin = null;
let userHidden = false;
let envelope = { w: 160, h: 60 }; // the size the island needs right now, in CSS pixels (reported by the renderer)
let fullscreenActive = false;
let foregroundApp = { app: '', title: '' };
let media, clipboardHistory, shelf, calendar, bluetooth, updater, fsWatcher, weather, sysinfo, breaks, midnightTimer;
let palette, tracker, privacy, github, perf;
let systemRequested = false;
let surfaceResting = null;
const expanded = () => surfaceResting === null ? envelope.h > 150 : !surfaceResting;
let policy = null;
let surface;
let hoverPoll = null;
const notesStore = jsonStore('notes.json', { todos: [] });

function todayState() {
  return { prayer: prayer.schedule(settings.get()), weather: weather ? weather.last : null };
}

// Recompute prayer times right after midnight, then every day.
function scheduleMidnight() {
  clearTimeout(midnightTimer);
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 1);
  midnightTimer = setTimeout(() => {
    push('today:update', todayState());
    scheduleMidnight();
  }, next - now);
}

if (!app.requestSingleInstanceLock()) app.quit();

const push = (channel, payload) => {
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
};


const isIsland = e => !!win && !win.isDestroyed() && e.sender === win.webContents && e.senderFrame === win.webContents.mainFrame;
const isSettings = e => !!settingsWin && !settingsWin.isDestroyed() && e.sender === settingsWin.webContents && e.senderFrame === settingsWin.webContents.mainFrame;
function applyActivityPolicy() {
  if (!clipboardHistory || !bluetooth || !sysinfo || !tracker) return;
  const next = activityPolicy({ hidden: userHidden, fullscreen: fullscreenActive && settings.get().hideFullscreen, expanded: expanded(),
    eco: settings.get().ecoMode, clipboard: settings.get().clipboard, tracking: settings.get().timeTracking });
  if (!policy || next.clipboard !== policy.clipboard || next.clipboardMs !== policy.clipboardMs) next.clipboard ? clipboardHistory.start(next.clipboardMs) : clipboardHistory.stop();
  if (!policy || next.bluetooth !== policy.bluetooth) next.bluetooth ? bluetooth.start() : bluetooth.stop();
  sysinfo.watch(next.system && systemRequested);
  if (!policy || next.tracking !== policy.tracking) next.tracking ? tracker.start() : tracker.stop();
  if (!policy || next.networkPaused !== policy.networkPaused) [weather, calendar, github].forEach(service => service?.setPaused(next.networkPaused));
  fsWatcher?.setIntervalMs?.(next.foregroundMs);
  policy = next;
}

// ---------------------------------------------------------------- window

const zoom = () => Number(settings.get().scale) || 0.8;

/** Size the window to the island's envelope and keep it anchored at the top of the primary display. */
function positionWindow() {
  if (!win || win.isDestroyed()) return;
  const display = screen.getAllDisplays().find(d => String(d.id) === settings.get().monitorId) || screen.getPrimaryDisplay();
  const { bounds } = display;
  const z = zoom();
  const width = Math.min(bounds.width, Math.ceil(envelope.w * z));
  const height = Math.min(bounds.height, Math.ceil(envelope.h * z));
  const pos = settings.get().position;
  const x = pos === 'left' ? bounds.x + 16 : pos === 'right' ? bounds.x + bounds.width - width - 16 : Math.round(bounds.x + (bounds.width - width) / 2);
  win.setBounds({ x, y: bounds.y, width, height });
}

function applyVisibility() {
  if (!win || win.isDestroyed()) return;
  const hide = userHidden || (settings.get().hideFullscreen && fullscreenActive);
  if (hide && win.isVisible()) win.hide();
  if (!hide && !win.isVisible()) win.showInactive();
  if (surface) surface.setVisible(!hide);
  applyActivityPolicy();
  buildTrayMenu();
}

/** Is the mouse cursor inside the island window right now? (The renderer's mouse events can be wrong while the window is resized.) */
function cursorInWindow() {
  if (!win || win.isDestroyed() || !win.isVisible()) return false;
  const c = screen.getCursorScreenPoint();
  const b = win.getBounds();
  return c.x >= b.x && c.x < b.x + b.width && c.y >= b.y && c.y < b.y + b.height;
}

/**
 * While the renderer believes the pointer is on the island, watch the real cursor: if it has left the window
 * (twice in a row, 120 ms apart) without a mouseleave arriving, tell the renderer, so the island never stays open.
 */
function watchHover(on) {
  clearInterval(hoverPoll);
  hoverPoll = null;
  if (!on) return;
  let outside = 0;
  hoverPoll = setInterval(() => {
    outside = cursorInWindow() ? 0 : outside + 1;
    if (outside >= 2) {
      clearInterval(hoverPoll);
      hoverPoll = null;
      push('island:pointer-left');
    }
  }, 120);
}

/** App shortcuts for the clock panel: the names in Settings, matched to Start Menu entries, with their icons. */
async function shortcutList() {
  const names = String(settings.get().shortcuts || '')
    .split(/[,،\n]/)
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 6);
  const out = [];
  for (const name of names) {
    const [hit] = apps.search(name, 1);
    if (!hit || hit.score < 60) continue;
    let icon = null;
    try {
      const img = await app.getFileIcon(hit.path, { size: 'normal' });
      if (!img.isEmpty()) icon = img.toDataURL();
    } catch (_) {
      /* no icon: the panel shows a generic one */
    }
    out.push({ name: hit.name, icon });
  }
  return out;
}

/** Window material: 'acrylic' asks Windows 11 to blur what is behind the window (experimental with a transparent window). */
function applyMaterial() {
  if (!win || win.isDestroyed() || process.platform !== 'win32' || typeof win.setBackgroundMaterial !== 'function') return;
  try {
    win.setBackgroundMaterial(settings.get().material === 'acrylic' ? 'acrylic' : 'none');
  } catch (err) {
    logError('background material', err);
  }
}

function createWindow() {
  win = new BrowserWindow({
    width: 200,
    height: 60,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    focusable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: true,
    },
  });

  positionWindow();
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.loadFile(path.join(info.root, 'src', 'renderer', 'index.html'));
  win.once('ready-to-show', () => applyVisibility());
  win.webContents.on('did-finish-load', () => {
    markBootOk();
    push('eco:changed', { eco: settings.get().ecoMode });
    win.webContents.setZoomFactor(zoom());
  });
  win.webContents.on('render-process-gone', (_e, d) => logError('renderer gone', JSON.stringify(d)));
  win.webContents.on('preload-error', (_e, p, err) => logError('preload', p, err));
  if (isDev) win.webContents.openDevTools({ mode: 'detach' });
}

function openSettings() {
  if (settingsWin && !settingsWin.isDestroyed()) {
    settingsWin.focus();
    return;
  }
  settingsWin = new BrowserWindow({
    width: 480,
    height: 680,
    title: 'Islandly',
    autoHideMenuBar: true,
    resizable: false,
    backgroundColor: '#14151c',
    webPreferences: {
      preload: path.join(__dirname, 'settings-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  settingsWin.webContents.on('did-finish-load', () => settingsWin.webContents.send('eco:changed', { eco: settings.get().ecoMode }));
  settingsWin.on('closed', () => { perf?.stop(); settingsWin = null; });
  settingsWin.setMenu(null);
  settingsWin.loadFile(path.join(info.root, 'src', 'settings', 'index.html'));
}

// ---------------------------------------------------------------- tray

function nativeHostPath() { return app.isPackaged ? path.join(path.dirname(process.execPath), 'Islandly.exe') : path.join(info.baseRoot, 'native', 'bin', 'Islandly.exe'); }

function trayMenuTemplate() {
  const s = settings.get();
  const radio = (key, value, label) => ({ label, type: 'radio', checked: s[key] === value, click: () => settings.set({ [key]: value }) });
  return [
      {
        label: win && win.isVisible() ? 'إخفاء الجزيرة' : 'إظهار الجزيرة',
        click: () => {
          userHidden = !userHidden;
          applyVisibility();
        },
      },
      {
        label: 'الموضع',
        submenu: [radio('position', 'center', 'الوسط'), radio('position', 'left', 'اليسار'), radio('position', 'right', 'اليمين')],
      },
      {
        label: 'الإخفاء التلقائي',
        submenu: [
          radio('autoHide', 'auto', 'تصغير بعد ٥ ثوانٍ (موصى به)'),
          radio('autoHide', 'always', 'خط رفيع حتى تمرّ عليه'),
          radio('autoHide', 'never', 'دائماً ظاهرة'),
        ],
      },
      { label: 'لوحة الأوامر   Ctrl+Alt+Space', click: () => palette.toggle() },
      { label: 'الإعدادات…', click: openSettings },
      { label: 'فتح مجلد السجلات والبيانات', click: () => shell.openPath(app.getPath('userData')) },
      { type: 'separator' },
      {
        label: 'التحقق من التحديثات',
        click: async () => {
          const r = await updater.check();
          if (r.status === 'up-to-date') push('toast', { key: 'upToDate', version: r.version });
          else if (r.status === 'needs-full-download') push('toast', { key: 'needsDownload', version: r.version });
          else if (r.status === 'error') push('toast', { key: 'updateError' });
        },
      },
      {
        label: 'التشغيل مع ويندوز',
        type: 'checkbox',
        checked: app.getLoginItemSettings(nativeManaged ? { path: nativeHostPath() } : undefined).openAtLogin,
        click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked, ...(nativeManaged ? { path: nativeHostPath() } : {}) }),
      },
      { type: 'separator' },
      { label: `Islandly ${info.version}`, enabled: false },
      { label: 'خروج', click: () => { nativeSession?.send('exit'); app.quit(); } },
  ];
}

function buildTrayMenu() {
  if (tray) tray.setContextMenu(Menu.buildFromTemplate(trayMenuTemplate()));
}

function createTray() {
  tray = new Tray(nativeImage.createFromPath(asset('tray.png')));
  tray.setToolTip('Islandly');
  buildTrayMenu();
  tray.on('click', () => tray.popUpContextMenu());
  tray.on('double-click', openSettings);
}

// ---------------------------------------------------------------- features

function openExternal(url) {
  try {
    const u = new URL(url);
    if (['http:', 'https:', 'mailto:'].includes(u.protocol)) shell.openExternal(u.toString());
  } catch (_) {
    /* ignore invalid urls */
  }
}

async function stashFromExplorer() {
  const out = await runOnce('explorer-selection.ps1');
  let paths = [];
  try {
    const parsed = JSON.parse(out || '[]');
    paths = Array.isArray(parsed) ? parsed : [parsed];
  } catch (_) {
    /* nothing selected */
  }
  const added = shelf.add(paths);
  push('shelf:added', { count: added, selected: paths.length });
}

function registerIpc() {
  ipcMain.on('settings:get', (e) => (e.returnValue = settings.get()));
  ipcMain.on('island:envelope', (e, env) => {
    if (!isIsland(e) || !env || !Number.isFinite(env.w) || !Number.isFinite(env.h)) return;
    envelope = { w: Math.max(40, Math.min(1200, env.w)), h: Math.max(10, Math.min(800, env.h)) };
    positionWindow();
    applyActivityPolicy();
  });
  ipcMain.on('surface:resting', (e, resting) => { if (isIsland(e) && typeof resting === 'boolean') { surfaceResting = resting; if (surface) surface.setResting(resting); applyActivityPolicy(); } });
  ipcMain.on('system:watch', (e, on) => {
    if (isIsland(e) && typeof on === 'boolean') { systemRequested = on; applyActivityPolicy(); }
  });
  ipcMain.handle('island:pointer-inside', () => cursorInWindow());
  ipcMain.on('island:hover-state', (_e, on) => watchHover(!!on));
  ipcMain.handle('shortcuts:list', () => shortcutList());
  ipcMain.on('shortcuts:open', (_e, name) => openTarget({ type: 'app', value: String(name || '').slice(0, 120) }));
  ipcMain.handle('perf:get', e => { if (!isSettings(e)) throw Error('Unauthorized IPC sender'); return perf.get(); });
  ipcMain.on('perf:watch', (e, on) => { if (isSettings(e) && typeof on === 'boolean') perf.watch(settingsWin, on); });
  // The island only accepts keyboard focus while the to-do panel is on screen; it must never steal focus otherwise.
  ipcMain.on('island:focusable', (_e, on) => {
    if (!win || win.isDestroyed()) return;
    if (!on && win.isFocused()) win.blur();
    win.setFocusable(!!on);
  });
  ipcMain.on('island:focus', (_e, on) => {
    if (!win || win.isDestroyed()) return;
    if (on) {
      win.setFocusable(true);
      win.focus();
    }
  });
  ipcMain.on('log:error', (_e, text) => logError('renderer', String(text).slice(0, 2000)));
  ipcMain.on('media:control', (_e, action, value) => media.control(action, value));
  ipcMain.on('open:external', (_e, url) => openExternal(url));
  ipcMain.on('settings:open', openSettings);
  ipcMain.on('menu:show', () => Menu.buildFromTemplate(trayMenuTemplate()).popup({ window: win }));
  ipcMain.on('app:quit', () => { nativeSession?.send('exit'); app.quit(); });
  ipcMain.on('shelf:drag', (e, ids) => {
    const paths = shelf.pathsFor(ids);
    if (!paths.length) return;
    e.sender.startDrag({ files: paths, icon: shelf.iconFor(paths[0]).isEmpty() ? nativeImage.createFromPath(asset('tray.png')) : shelf.iconFor(paths[0]) });
  });

  ipcMain.handle('media:caps', () => media.capabilities(expanded() && !userHidden && !fullscreenActive));
  ipcMain.handle('clipboard:list', () => clipboardHistory.list());
  ipcMain.handle('clipboard:copy', (_e, id, as) => clipboardHistory.copy(id, as));
  ipcMain.handle('clipboard:pin', (_e, id) => clipboardHistory.pin(id));
  ipcMain.handle('clipboard:remove', (_e, id) => clipboardHistory.remove(id));
  ipcMain.handle('clipboard:clear', () => clipboardHistory.clear());
  ipcMain.handle('shelf:list', () => shelf.list());
  ipcMain.handle('shelf:add', (_e, paths) => shelf.add(Array.isArray(paths) ? paths : []));
  ipcMain.handle('shelf:remove', (_e, ids) => shelf.remove(ids));
  ipcMain.handle('shelf:clear', () => shelf.clear());
  ipcMain.handle('shelf:open', (_e, id) => {
    const [p] = shelf.pathsFor([id]);
    if (p) shell.openPath(p);
  });
  ipcMain.handle('shelf:reveal', (_e, id) => {
    const [p] = shelf.pathsFor([id]);
    if (p) shell.showItemInFolder(p);
  });
  ipcMain.handle('today:get', () => todayState());
  ipcMain.handle('notes:get', () => notesStore.read());
  ipcMain.handle('notes:set', (_e, data) => {
    const todos = Array.isArray(data && data.todos) ? data.todos.slice(0, 50).map((x) => ({ id: Number(x.id) || Date.now(), text: String(x.text || '').slice(0, 140), done: !!x.done })) : [];
    notesStore.write({ todos });
  });
  ipcMain.handle('calendar:get', () => ({ status: calendar.status, events: calendar.last || [] }));
  ipcMain.handle('update:check', () => updater.check());
  ipcMain.handle('update:apply', () => {
    if (nativeManaged) { nativeSession.send('restart'); app.quit(); return; }
    app.relaunch();
    app.quit();
  });
  ipcMain.handle('settings:set', (_e, patch) => settings.set(patch));
  ipcMain.on('settings:cities', (e) => (e.returnValue = Object.entries(cities).map(([key, c]) => ({ key, ar: c.ar, en: c.en }))));
  ipcMain.handle('settings:secret', (_e, name, value) => {
    settings.setSecret(String(name), String(value || '').trim());
    if (name === 'githubToken') github.start();
  });
  ipcMain.handle('shelf:image', (_e, id, op) => shelf.imageOp(id, op));
  ipcMain.handle('usage:get', () => tracker.today());
  ipcMain.handle('github:get', () => github.last || { status: 'off', items: [] });
  ipcMain.handle('privacy:get', () => privacy.state || { mic: [], cam: [] });
  ipcMain.on('controls:volume', (_e, action) => ['volup', 'voldown', 'mute'].includes(action) && win32.mediaKey(action));
  ipcMain.handle('controls:brightness', async (_e, level) => {
    const args = Number.isFinite(level) ? [Math.max(0, Math.min(100, Math.round(level)))] : [];
    const out = await runOnce('brightness.ps1', 10000, args);
    const n = parseInt(out, 10);
    return Number.isFinite(n) ? n : null;
  });
  ipcMain.handle('app:info', () => ({ version: info.version }));
}

// ---------------------------------------------------------------- lifecycle

app.on('second-instance', () => {
  userHidden = false;
  applyVisibility();
});

app.whenReady().then(() => {
  settings.init();
  createWindow();
  if (!nativeManaged) createTray();
  registerIpc();

  media = new MediaBridge((payload) => {
    if (payload && payload.type === 'unavailable') logError('media unavailable:', payload.reason);
    push('media:update', payload);
  }, info.baseRoot);
  media.start();

  clipboardHistory = new ClipboardHistory((list) => push('clipboard:update', list));
  // Clipboard policy is applied once services are ready.

  shelf = new Shelf((list) => push('shelf:update', list));
  shelf.load();

  calendar = new CalendarFeed((state) => {
    calendar.last = state.events;
    push('calendar:update', state);
  });
  calendar.configure(settings.get().icsUrl);

  bluetooth = new BluetoothWatcher((devices) => push('bluetooth:update', devices));
  // Bluetooth is requested only while the island is expanded (applyActivityPolicy).

  updater = new Updater((version) => push('update:ready', { version }));
  if (settings.get().updates) updater.start();

  weather = new Weather(() => push('today:update', todayState()));
  weather.configure(prayer.location(settings.get()), settings.get().weather);
  scheduleMidnight();

  sysinfo = new SysInfo((sample) => push('system:sample', sample));

  breaks = new Breaks(() => push('break:due', {}));
  breaks.configure(settings.get().breakEvery);

  tracker = new Tracker((today) => push('usage:update', today));
  if (settings.get().timeTracking) tracker.start();

  privacy = new PrivacyWatcher((state) => {
    privacy.state = state;
    push('privacy:update', state);
  });
  if (settings.get().micCamIndicator) privacy.start();

  github = new GitHubWatcher(
    () => settings.getSecret('githubToken'),
    (state) => {
      github.last = state;
      push('github:update', state);
    }
  );
  github.start();

  palette = new Palette({
    root: info.root,
    settings,
    onTimer: (minutes) => push('shortcut', 'timer:' + minutes),
    openSettings,
  });

  surface = new Surface({
    win32,
    screen,
    getWindow: () => win,
    onTint: (rgb) => push('surface:tint', rgb),
    log: (...a) => logError(...a),
  });
  // the reserved strip: the resting island (32 px) and its 8 px gap, scaled by the UI zoom
  surface.setBarHeight((8 + 32 + 4) * zoom());
  surface.setMode(nativeManaged ? 'overlay' : settings.get().islandMode);
  applyMaterial();

  perf = new PerformanceMonitor({ app, host: commandHost, nativeOwnerPid: nativeManaged ? process.ppid : null, windows: () => ({ island: win, settings: settingsWin, palette: palette?.win }) });
  applyActivityPolicy();

  if (process.env.ISLANDLY_TEST) global.__islandly = { palette, shelf, tracker, openSettings, cleanup: stopNativeServices };

  fsWatcher = watchForeground({
    onFullscreen: (active) => {
      fullscreenActive = active;
      applyVisibility();
    },
    onApp: (fg) => {
      foregroundApp = fg;
      tracker.setApp(fg);
      push('foreground', fg);
    },
  });

  applyActivityPolicy();
  const send = (cmd) => push('shortcut', cmd);
  if (!nativeManaged) {
  globalShortcut.register('Control+Alt+I', () => send('toggle'));
  globalShortcut.register('Control+Alt+P', () => send('pomodoro'));
  globalShortcut.register('Control+Alt+S', stashFromExplorer);
  if (!globalShortcut.register('Control+Alt+Space', () => palette.toggle())) logError('shortcut Ctrl+Alt+Space is taken by another app');
  }

  settings.onChange((now, prev) => {
    nativeSession?.send('settings');
    if (now.position !== prev.position || now.monitorId !== prev.monitorId) positionWindow();
    if (now.scale !== prev.scale && win) {
      win.webContents.setZoomFactor(zoom());
      positionWindow();
    }
    if (now.icsUrl !== prev.icsUrl) calendar.configure(now.icsUrl);

    if (now.hideFullscreen !== prev.hideFullscreen) applyVisibility();
    const locKeys = ['city', 'lat', 'lng', 'prayerMethod', 'madhab', 'weather'];
    if (locKeys.some((k) => now[k] !== prev[k])) {
      weather.configure(prayer.location(now), now.weather);
      push('today:update', todayState());
    }
    if (now.breakEvery !== prev.breakEvery) breaks.configure(now.breakEvery);

    if (now.micCamIndicator !== prev.micCamIndicator) {
      if (now.micCamIndicator) privacy.start();
      else {
        privacy.stop();
        privacy.state = { mic: [], cam: [] };
        push('privacy:update', privacy.state);
      }
    }
    if (now.islandMode !== prev.islandMode) surface.setMode(nativeManaged ? 'overlay' : now.islandMode);
    if (now.scale !== prev.scale) surface.setBarHeight((8 + 32 + 4) * zoom());
    if (now.material !== prev.material) applyMaterial();
    if (now.shortcuts !== prev.shortcuts) shortcutList().then((list) => push('shortcuts:update', list));
    const publicSettings = settings.get();
    push('settings:update', publicSettings);
    for (const target of [settingsWin, palette?.win]) if (target && !target.isDestroyed()) target.webContents.send('settings:update', publicSettings);
    if (now.ecoMode !== prev.ecoMode) {
      const payload = { eco: now.ecoMode };
      push('eco:changed', payload);
      if (settingsWin && !settingsWin.isDestroyed()) settingsWin.webContents.send('eco:changed', payload);
    }
    applyActivityPolicy();
    if (now.lang !== prev.lang && win) win.webContents.reload();
    buildTrayMenu();
  });

  if (nativeManaged) startNativeSession();
  screen.on('display-metrics-changed', positionWindow);
  screen.on('display-added', positionWindow);
  screen.on('display-removed', positionWindow);
});

function stopNativeServices() { privacy?.stop(); media?.stop(); perf?.stop(); commandHost.shutdown(true); }
app.on('render-process-gone', () => { if (nativeManaged) app.quit(); });
app.on('before-quit', () => { nativeSession?.stop(); stopNativeServices(); });
process.on('exit', stopNativeServices);

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  [media, calendar, bluetooth, updater, fsWatcher, clipboardHistory, weather, sysinfo, breaks, tracker, privacy, github, palette, surface].forEach((m) => m && m.stop && m.stop());
  clearInterval(hoverPoll);
  clearTimeout(midnightTimer);
  perf?.stop();
  commandHost.shutdown();
});

// Having this listener stops Electron from quitting when the settings window closes; only the tray menu quits.
app.on('window-all-closed', () => {
  if (!win || win.isDestroyed()) app.quit();
});


// Native host owns the collapsed window and shortcuts; Electron owns existing panels only.
// Calls the existing public Island API at the lifetime boundary; no UI source or IPC contract changes.
function startNativeSession() {
  logError('native session initializing');
  const fs = require('node:fs');
  const stateFile = path.join(app.getPath('userData'), 'native-session.json');
  let closingPanel = false, nativeActions = 0;
  const connection = require('node:net').createConnection('\\\\.\\pipe\\' + process.env.ISLANDLY_NATIVE_PIPE);
  connection.on('error', err => { logError('native pipe', err); app.quit(); });
  const renderer = script => win.webContents.executeJavaScript(script);
  const command = async action => {
    try {
      closingPanel = false;
      if (action === 'settings') {
        openSettings();
        if (settingsWin.webContents.isLoading()) await new Promise(resolve => settingsWin.once('ready-to-show', resolve));
      } else if (action === 'palette') {
        palette.toggle();
        if (palette.win?.webContents.isLoading()) await new Promise(resolve => palette.win.webContents.once('did-finish-load', resolve));
      } else if (action === 'stash') {
        nativeActions++;
        try { await stashFromExplorer(); } finally { nativeActions--; }
      }
      else if (action === 'close') {
        settingsWin?.close(); palette.hide();
        await renderer("Island.setHover(false); if (Island.isExpanded()) Island.togglePin();");
        closingPanel = true;
        nativeExpanded = false;
        win.hide();
      } else {
        const cmd = action === 'pomodoro' ? 'pomodoro' : 'toggle';
        push('shortcut', cmd);
        applyVisibility();
      }
    } catch (err) { logError('native command', err); }
  };
  nativeSession = new NativeSession({
    input: connection, output: connection,
    command, quit: () => app.quit(),
    busy: () => (!closingPanel && nativeExpanded) || !!settingsWin?.isVisible() || !!palette.win?.isVisible() || nativeActions > 0,
    restore: async () => {
      logError('native renderer ready, restoring');
      let saved;
      try { saved = JSON.parse(fs.readFileSync(stateFile, 'utf8')); } catch (_) { saved = null; }
      if (saved) {
        if (Number.isFinite(saved.breakActive)) breaks.active = Math.max(0, saved.breakActive);
        clipboardHistory.items = Array.isArray(saved.clipboard) ? saved.clipboard.slice(0, 100) : [];
        clipboardHistory.seq = Math.max(0, ...clipboardHistory.items.map(x => Number(x.id) || 0)) + 1;
        for (const text of saved.clipboardPending || []) if (typeof text === 'string') clipboardHistory.add(text);
        await renderer(`(() => {
          const saved = ${JSON.stringify(saved)};
          const timer = Island.feature('timer');
          if (timer && ['focus','rest'].includes(saved.mode) && Number.isFinite(saved.total) && saved.total > 0) {
            timer.mode = saved.mode; timer.total = saved.total;
            timer.remaining = Math.max(0, Number(saved.remaining) || 0);
            if (saved.running) timer.remaining = Math.max(0, (saved.endAt - Date.now()) / 1000);
            if (saved.completed || saved.running && timer.remaining <= 0) timer.finish();
            else if (saved.running) timer.start();
            else timer.paint();
          }
          if (saved.selected) Island.selectFeature(saved.selected);
        })()`);
      }
      logError('native opening command', process.env.ISLANDLY_NATIVE_COMMAND);
      await command(process.env.ISLANDLY_NATIVE_COMMAND || 'expand');
      logError('native command opened');
      // Include first panel layout/paint rather than counting process spawn as panel readiness.
      await new Promise(resolve => setTimeout(resolve, 350));
    },
    capture: async () => {
      const snapshot = await renderer(`(() => {
        const timer = Island.feature('timer');
        return { mode: timer.mode, total: timer.total, remaining: timer.remaining, running: timer.running,
          endAt: timer.endAt, selected: Island.selectedId(), expanded: Island.isExpanded() };
      })()`);
      nativeExpanded = snapshot.expanded;
      return { ...snapshot, breakActive: breaks.active, clipboard: clipboardHistory.items, clipboardPending: [],
        monitors: screen.getAllDisplays().map(d => ({ id: String(d.id), ...screen.dipToScreenPoint({ x: d.bounds.x, y: d.bounds.y }) })) };
    },
  });
  const loaded = () => nativeSession.loaded().catch(err => { logError('native load', err); app.quit(); });
  if (win.webContents.isLoadingMainFrame()) win.webContents.once('did-finish-load', loaded);
  else loaded();
}

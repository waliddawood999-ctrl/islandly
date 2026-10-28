const path = require('path');
const { app, BrowserWindow, screen, ipcMain, Tray, Menu, globalShortcut, nativeImage, shell } = require('electron');
const settings = require('./settings');
const { MediaBridge } = require('./media');
const { ClipboardHistory } = require('./clipboard');
const { Shelf } = require('./shelf');
const { CalendarFeed } = require('./calendar');
const { BluetoothWatcher } = require('./bluetooth');
const { watchForeground } = require('./fullscreen');
const { Updater, markBootOk } = require('./updater');
const { runOnce } = require('./ps');
const { logError } = require('./log');

const isDev = process.argv.includes('--dev');
const info = global.__ISLANDLY || {
  root: path.join(__dirname, '..', '..'),
  baseRoot: path.join(__dirname, '..', '..'),
  version: require('../../package.json').version,
};
const asset = (name) => path.join(info.root, 'assets', name);

// A background widget should not pop up a modal crash dialog: keep running and write the error to a log file.
process.on('uncaughtException', (err) => logError('main', err));
process.on('unhandledRejection', (err) => logError('main (promise)', err));

let win = null;
let tray = null;
let settingsWin = null;
let userHidden = false;
let envelope = { w: 160, h: 60 }; // the size the island needs right now, in CSS pixels (reported by the renderer)
let fullscreenActive = false;
let foregroundApp = { app: '', title: '' };
let media, clipboardHistory, shelf, calendar, bluetooth, updater, fsWatcher;

if (!app.requestSingleInstanceLock()) app.quit();

const push = (channel, payload) => {
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
};

// ---------------------------------------------------------------- window

const zoom = () => Number(settings.get().scale) || 0.8;

/** Size the window to the island's envelope and keep it anchored at the top of the primary display. */
function positionWindow() {
  if (!win || win.isDestroyed()) return;
  const { bounds } = screen.getPrimaryDisplay();
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
  buildTrayMenu();
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
      backgroundThrottling: false,
    },
  });

  positionWindow();
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.loadFile(path.join(info.root, 'src', 'renderer', 'index.html'));
  win.once('ready-to-show', () => applyVisibility());
  win.webContents.on('did-finish-load', () => {
    markBootOk();
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
  settingsWin.setMenu(null);
  settingsWin.loadFile(path.join(info.root, 'src', 'settings', 'index.html'));
}

// ---------------------------------------------------------------- tray

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
        checked: app.getLoginItemSettings().openAtLogin,
        click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked }),
      },
      { type: 'separator' },
      { label: `Islandly ${info.version}`, enabled: false },
      { label: 'خروج', click: () => app.quit() },
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
  ipcMain.on('island:envelope', (_e, env) => {
    if (!env || !Number.isFinite(env.w) || !Number.isFinite(env.h)) return;
    envelope = { w: Math.max(40, Math.min(1200, env.w)), h: Math.max(10, Math.min(800, env.h)) };
    positionWindow();
  });
  ipcMain.on('log:error', (_e, text) => logError('renderer', String(text).slice(0, 2000)));
  ipcMain.on('media:control', (_e, action, value) => media.control(action, value));
  ipcMain.on('open:external', (_e, url) => openExternal(url));
  ipcMain.on('settings:open', openSettings);
  ipcMain.on('menu:show', () => Menu.buildFromTemplate(trayMenuTemplate()).popup({ window: win }));
  ipcMain.on('app:quit', () => app.quit());
  ipcMain.on('shelf:drag', (e, ids) => {
    const paths = shelf.pathsFor(ids);
    if (!paths.length) return;
    e.sender.startDrag({ files: paths, icon: shelf.iconFor(paths[0]).isEmpty() ? nativeImage.createFromPath(asset('tray.png')) : shelf.iconFor(paths[0]) });
  });

  ipcMain.handle('media:caps', () => media.capabilities());
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
  ipcMain.handle('calendar:get', () => ({ status: calendar.status, events: calendar.last || [] }));
  ipcMain.handle('update:check', () => updater.check());
  ipcMain.handle('update:apply', () => {
    app.relaunch();
    app.quit();
  });
  ipcMain.handle('settings:set', (_e, patch) => settings.set(patch));
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
  createTray();
  registerIpc();

  media = new MediaBridge((payload) => {
    if (payload && payload.type === 'unavailable') logError('media unavailable:', payload.reason);
    push('media:update', payload);
  }, info.baseRoot);
  media.start();

  clipboardHistory = new ClipboardHistory((list) => push('clipboard:update', list));
  if (settings.get().clipboard) clipboardHistory.start();

  shelf = new Shelf((list) => push('shelf:update', list));
  shelf.load();

  calendar = new CalendarFeed((state) => {
    calendar.last = state.events;
    push('calendar:update', state);
  });
  calendar.configure(settings.get().icsUrl);

  bluetooth = new BluetoothWatcher((devices) => push('bluetooth:update', devices));
  bluetooth.start();

  updater = new Updater((version) => push('update:ready', { version }));
  if (settings.get().updates) updater.start();

  fsWatcher = watchForeground({
    onFullscreen: (active) => {
      fullscreenActive = active;
      applyVisibility();
    },
    onApp: (fg) => {
      foregroundApp = fg;
      push('foreground', fg);
    },
  });

  const send = (cmd) => push('shortcut', cmd);
  globalShortcut.register('Control+Alt+I', () => send('toggle'));
  globalShortcut.register('Control+Alt+P', () => send('pomodoro'));
  globalShortcut.register('Control+Alt+S', stashFromExplorer);

  settings.onChange((now, prev) => {
    if (now.position !== prev.position) positionWindow();
    if (now.scale !== prev.scale && win) {
      win.webContents.setZoomFactor(zoom());
      positionWindow();
    }
    if (now.icsUrl !== prev.icsUrl) calendar.configure(now.icsUrl);
    if (now.clipboard !== prev.clipboard) now.clipboard ? clipboardHistory.start() : clipboardHistory.stop();
    if (now.hideFullscreen !== prev.hideFullscreen) applyVisibility();
    push('settings:update', now);
    if (now.lang !== prev.lang && win) win.webContents.reload();
    buildTrayMenu();
  });

  screen.on('display-metrics-changed', positionWindow);
  screen.on('display-added', positionWindow);
  screen.on('display-removed', positionWindow);
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  [media, calendar, bluetooth, updater, fsWatcher, clipboardHistory].forEach((m) => m && m.stop && m.stop());
});

// Having this listener stops Electron from quitting when the settings window closes; only the tray menu quits.
app.on('window-all-closed', () => {
  if (!win || win.isDestroyed()) app.quit();
});

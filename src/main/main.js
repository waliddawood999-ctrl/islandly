const path = require('path');
const { app, BrowserWindow, screen, ipcMain, Tray, Menu, globalShortcut, nativeImage } = require('electron');
const { MediaBridge } = require('./media');

const WIN_W = 640;
const WIN_H = 300;
const isDev = process.argv.includes('--dev');

let win = null;
let tray = null;
let media = null;

if (!app.requestSingleInstanceLock()) {
  app.quit();
}

function positionWindow() {
  if (!win) return;
  const { bounds } = screen.getPrimaryDisplay();
  win.setBounds({
    x: Math.round(bounds.x + (bounds.width - WIN_W) / 2),
    y: bounds.y,
    width: WIN_W,
    height: WIN_H,
  });
}

function createWindow() {
  win = new BrowserWindow({
    width: WIN_W,
    height: WIN_H,
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
  // Click-through by default; the renderer turns it off while the pointer is over the island.
  win.setIgnoreMouseEvents(true, { forward: true });
  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  win.once('ready-to-show', () => win.showInactive());
  if (isDev) win.webContents.openDevTools({ mode: 'detach' });
}

function createTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, '..', '..', 'assets', 'tray.png'));
  tray = new Tray(icon);
  tray.setToolTip('Islandly');
  const build = () =>
    Menu.buildFromTemplate([
      {
        label: win && win.isVisible() ? 'إخفاء الجزيرة' : 'إظهار الجزيرة',
        click: () => {
          if (!win) return;
          win.isVisible() ? win.hide() : win.showInactive();
          tray.setContextMenu(build());
        },
      },
      {
        label: 'التشغيل مع ويندوز',
        type: 'checkbox',
        checked: app.getLoginItemSettings().openAtLogin,
        click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked }),
      },
      { type: 'separator' },
      { label: 'خروج', click: () => app.quit() },
    ]);
  tray.setContextMenu(build());
}

function registerShortcuts() {
  const send = (cmd) => win && win.webContents.send('shortcut', cmd);
  globalShortcut.register('Control+Alt+I', () => send('toggle'));
  globalShortcut.register('Control+Alt+P', () => send('pomodoro'));
}

ipcMain.on('island:interactive', (_e, interactive) => {
  if (win) win.setIgnoreMouseEvents(!interactive, { forward: true });
});

ipcMain.on('media:control', (_e, action) => {
  if (media) media.control(action);
});

app.on('second-instance', () => {
  if (win && !win.isVisible()) win.showInactive();
});

app.whenReady().then(() => {
  createWindow();
  createTray();
  registerShortcuts();

  media = new MediaBridge((payload) => {
    if (win && !win.isDestroyed()) win.webContents.send('media:update', payload);
  });
  media.start();

  screen.on('display-metrics-changed', positionWindow);
  screen.on('display-added', positionWindow);
  screen.on('display-removed', positionWindow);
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  if (media) media.stop();
});

app.on('window-all-closed', () => app.quit());

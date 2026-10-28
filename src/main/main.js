const path = require("path");
const {
  app,
  powerMonitor,
  BrowserWindow,
  screen,
  ipcMain,
  Tray,
  Menu,
  globalShortcut,
  nativeImage,
  shell,
} = require("electron");
const settings = require("./settings");
const { MediaBridge } = require("./media");
const { ClipboardHistory } = require("./clipboard");
const { Shelf } = require("./shelf");
const { CalendarFeed } = require("./calendar");
const { BluetoothWatcher } = require("./bluetooth");
const { watchForeground } = require("./fullscreen");
const { Updater, markBootOk } = require("./updater");
const { runOnce } = require("./ps");
const { logError } = require("./log");
const prayer = require("./services/prayer");
const { Weather } = require("./services/weather");
const { SysInfo } = require("./services/sysinfo");
const { Breaks } = require("./services/breaks");
const { jsonStore } = require("./services/store");
const { Tracker } = require("./services/tracker");
const { PrivacyWatcher } = require("./services/privacy");
const { GitHubWatcher } = require("./services/github");
const { Palette } = require("./palette");
const win32 = require("./win32");
const cities = require("./cities");
const { Lyrics } = require("./services/lyrics");
const { ActivityHub } = require("./services/activity");
const { Jobs } = require("./services/jobs");
const { DownloadWatcher } = require("./services/downloads");
const { Reminders } = require("./services/reminders");
const { FileActions } = require("./services/files");
const { LocalShare } = require("./services/share");
const { Capture } = require("./capture");
const { FocusMode } = require("./services/focus");
const { Plugins } = require("./services/plugins");
const { TerminalEvents } = require("./services/terminal-events");
const { HealthReminders } = require("./services/health");
const { Tools } = require("./services/tools");
const { WindowsNotifications } = require("./services/notifications");

const isDev = process.argv.includes("--dev");
const info = global.__ISLANDLY || {
  root: path.join(__dirname, "..", ".."),
  baseRoot: path.join(__dirname, "..", ".."),
  version: require("../../package.json").version,
};
const asset = (name) => path.join(info.root, "assets", name);

// A background widget should not pop up a modal crash dialog: keep running and write the error to a log file.
process.on("uncaughtException", (err) => logError("main", err));
process.on("unhandledRejection", (err) => logError("main (promise)", err));

let win = null;
let tray = null;
let settingsWin = null;
let userHidden = false;
let envelope = { w: 160, h: 60 }; // the size the island needs right now, in CSS pixels (reported by the renderer)
let fullscreenActive = false;
let foregroundApp = { app: "", title: "" };
let media,
  clipboardHistory,
  shelf,
  calendar,
  bluetooth,
  updater,
  fsWatcher,
  weather,
  sysinfo,
  breaks,
  midnightTimer;
let pointerTimer;
let palette,
  tracker,
  privacy,
  github,
  lyrics,
  activity,
  jobs,
  downloads,
  reminders;
let lastMedia = null;
let files, sharing, capture, focusMode, plugins, terminal;
let terminalItems = [];
let health, tools, notifications;
let hitbox = null,
  ignoringMouse = false;
const notesStore = jsonStore("notes.json", { todos: [], memo: "" });

function todayState() {
  return {
    prayer: prayer.schedule(settings.get()),
    weather: weather ? weather.last : null,
  };
}

// Recompute prayer times right after midnight, then every day.
function scheduleMidnight() {
  clearTimeout(midnightTimer);
  const now = new Date();
  const next = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    0,
    1,
  );
  midnightTimer = setTimeout(() => {
    push("today:update", todayState());
    scheduleMidnight();
  }, next - now);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
  return;
}

const push = (channel, payload) => {
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
};

function updateMouseHit() {
  if (
    process.platform !== "win32" ||
    !win ||
    win.isDestroyed() ||
    !win.isVisible() ||
    !hitbox
  )
    return;
  const cursor = screen.getCursorScreenPoint(),
    bounds = win.getBounds(),
    z = zoom();
  const x = (cursor.x - bounds.x) / z - hitbox.x,
    y = (cursor.y - bounds.y) / z - hitbox.y,
    r = Math.min(hitbox.radius, hitbox.width / 2, hitbox.height / 2);
  const inside =
    x >= 0 &&
    y >= 0 &&
    x <= hitbox.width &&
    y <= hitbox.height &&
    Math.hypot(
      Math.max(r - x, 0, x - hitbox.width + r),
      Math.max(r - y, 0, y - hitbox.height + r),
    ) <= r;
  if (ignoringMouse === inside) {
    ignoringMouse = !inside;
    win.setIgnoreMouseEvents(ignoringMouse, { forward: true });
  }
}
// ---------------------------------------------------------------- window

const zoom = () => Number(settings.get().scale) || 0.8;

/** Size the window to the island's envelope and keep it anchored at the top of the primary display. */
function positionWindow() {
  if (!win || win.isDestroyed()) return;
  const display =
    screen
      .getAllDisplays()
      .find((d) => String(d.id) === settings.get().monitorId) ||
    screen.getPrimaryDisplay();
  const bounds = display.workArea;
  const z = zoom();
  const width = Math.min(bounds.width, Math.ceil(envelope.w * z));
  const height = Math.min(bounds.height, Math.ceil(envelope.h * z));
  const pos = settings.get().position;
  const preferredX =
    pos === "left"
      ? bounds.x + 16
      : pos === "right"
        ? bounds.x + bounds.width - width - 16
        : Math.round(bounds.x + (bounds.width - width) / 2);
  const x = Math.max(
    bounds.x,
    Math.min(preferredX, bounds.x + bounds.width - width),
  );
  if (!fullscreenActive) win.setBounds({ x, y: bounds.y, width, height });
}

function applyVisibility() {
  if (!win || win.isDestroyed()) return;
  const hide =
    userHidden || (settings.get().hideFullscreen && fullscreenActive);
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
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
    },
  });

  positionWindow();
  win.setAlwaysOnTop(true, "floating");
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (e) => e.preventDefault());
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.loadFile(path.join(info.root, "src", "renderer", "index.html"));
  win.once("ready-to-show", () => applyVisibility());
  win.webContents.on("did-finish-load", () => {
    win.webContents.setZoomFactor(zoom());
  });
  win.webContents.on("render-process-gone", (_e, d) =>
    logError("renderer gone", JSON.stringify(d)),
  );
  win.webContents.on("preload-error", (_e, p, err) =>
    logError("preload", p, err),
  );
  if (isDev) win.webContents.openDevTools({ mode: "detach" });
}

function openSettings() {
  if (settingsWin && !settingsWin.isDestroyed()) {
    settingsWin.focus();
    return;
  }
  settingsWin = new BrowserWindow({
    width: 480,
    height: 680,
    title: "Islandly",
    autoHideMenuBar: true,
    resizable: false,
    backgroundColor: "#14151c",
    webPreferences: {
      preload: path.join(__dirname, "settings-preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  settingsWin.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  settingsWin.webContents.on("will-navigate", (e) => e.preventDefault());
  settingsWin.setMenu(null);
  settingsWin.loadFile(path.join(info.root, "src", "settings", "index.html"));
}

// ---------------------------------------------------------------- tray

function trayMenuTemplate() {
  const s = settings.get();
  const radio = (key, value, label) => ({
    label,
    type: "radio",
    checked: s[key] === value,
    click: () => settings.set({ [key]: value }),
  });
  return [
    {
      label: win && win.isVisible() ? "إخفاء الجزيرة" : "إظهار الجزيرة",
      click: () => {
        userHidden = !userHidden;
        applyVisibility();
      },
    },
    {
      label: "الموضع",
      submenu: [
        radio("position", "center", "الوسط"),
        radio("position", "left", "اليسار"),
        radio("position", "right", "اليمين"),
      ],
    },
    {
      label: "الإخفاء التلقائي",
      submenu: [
        radio("autoHide", "auto", "تصغير بعد ٥ ثوانٍ (موصى به)"),
        radio("autoHide", "always", "خط رفيع حتى تمرّ عليه"),
        radio("autoHide", "never", "دائماً ظاهرة"),
      ],
    },
    { label: "لوحة الأوامر   Ctrl+Alt+Space", click: () => palette.toggle() },
    { label: "الإعدادات…", click: openSettings },
    {
      label: "فتح مجلد السجلات والبيانات",
      click: () => shell.openPath(app.getPath("userData")),
    },
    { type: "separator" },
    {
      label: "التحقق من التحديثات",
      click: async () => {
        const r = await updater.check();
        if (r.status === "up-to-date")
          push("toast", { key: "upToDate", version: r.version });
        else if (r.status === "needs-full-download")
          push("toast", { key: "needsDownload", version: r.version });
        else if (r.status === "error") push("toast", { key: "updateError" });
      },
    },
    {
      label: "التشغيل مع ويندوز",
      type: "checkbox",
      checked: app.getLoginItemSettings().openAtLogin,
      click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked }),
    },
    { type: "separator" },
    { label: `Islandly ${info.version}`, enabled: false },
    { label: "خروج", click: () => app.quit() },
  ];
}

function buildTrayMenu() {
  if (tray) tray.setContextMenu(Menu.buildFromTemplate(trayMenuTemplate()));
}

function createTray() {
  tray = new Tray(nativeImage.createFromPath(asset("tray.png")));
  tray.setToolTip("Islandly");
  buildTrayMenu();
  tray.on("click", () => tray.popUpContextMenu());
  tray.on("double-click", openSettings);
}

// ---------------------------------------------------------------- features

function openExternal(url) {
  try {
    const u = new URL(url);
    if (["http:", "https:", "mailto:", "tel:"].includes(u.protocol))
      shell.openExternal(u.toString());
  } catch (_) {
    /* ignore invalid urls */
  }
}

async function stashFromExplorer() {
  const out = await runOnce("explorer-selection.ps1");
  let paths = [];
  try {
    const parsed = JSON.parse(out || "[]");
    paths = Array.isArray(parsed) ? parsed : [parsed];
  } catch (_) {
    /* nothing selected */
  }
  const added = shelf.add(paths);
  push("shelf:added", { count: added, selected: paths.length });
}

function registerIpc() {
  const originalOn = ipcMain.on.bind(ipcMain);
  const originalHandle = ipcMain.handle.bind(ipcMain);
  const settingsChannels = new Set([
    "settings:set",
    "settings:secret",
    "settings:cities",
    "app:info",
    "app:quit",
    "settings:displays",
  ]);
  const shared = new Set(["settings:get", "update:check", "update:apply"]);
  const allowed = (event, channel) => {
    if (!event.senderFrame || event.senderFrame !== event.sender.mainFrame)
      return false;
    const owner = settingsChannels.has(channel) ? settingsWin : win;
    return shared.has(channel)
      ? [win, settingsWin, palette && palette.win].some(
          (w) => w && !w.isDestroyed() && w.webContents === event.sender,
        )
      : owner && !owner.isDestroyed() && owner.webContents === event.sender;
  };
  // The wrappers apply only to island/settings registrations; Palette validates its own channels.
  ipcMain.on = (channel, fn) =>
    originalOn(channel, (event, ...args) => {
      if (allowed(event, channel)) return fn(event, ...args);
      if (event.returnValue === undefined && channel === "settings:get")
        event.returnValue = {};
    });
  ipcMain.handle = (channel, fn) =>
    originalHandle(channel, (event, ...args) => {
      if (!allowed(event, channel)) throw new Error("Unauthorized IPC sender");
      return fn(event, ...args);
    });
  const processText = async (op, text) => {
    const prompts = {
      translate:
        "Translate this text into " +
        (/[\u0600-\u06ff]/.test(text) ? "English" : "Arabic") +
        ". Return only the translation.",
      explain: "Explain the following text in its language.",
      summarize: "Summarize the following text in its language.",
      correct: "Correct spelling and grammar. Return the corrected text only.",
    };
    if (!prompts[op] || typeof text !== "string" || !text.trim())
      return { error: "Invalid text" };
    let output = "";
    const r = await require("./services/ai").ask(
      settings.getSecret("aiKey"),
      prompts[op] + "\n\n" + text.slice(0, 4000),
      (chunk) => (output += chunk),
    );
    return r.ok
      ? { text: output }
      : {
          error:
            r.reason === "no-key"
              ? "أضف مفتاح Anthropic من الإعدادات / Add your Anthropic key in Settings"
              : r.message || r.reason,
        };
  };
  ipcMain.handle("text:process", (_e, op, text) => processText(op, text));
  ipcMain.handle("text:translate", (_e, text) =>
    processText("translate", text),
  );
  ipcMain.handle("assistant:copy", (_e, text) =>
    require("electron").clipboard.writeText(String(text).slice(0, 50000)),
  );
  const launchItems = () =>
    require("./services/workspaces")
      .parse(settings.get().quickLaunch)
      .map((w, i) => ({ id: i, name: w.name, targets: w.items }));
  ipcMain.handle("launcher:list", () =>
    launchItems().map(({ id, name }) => ({ id, name })),
  );
  ipcMain.handle("launcher:run", (_e, id) => {
    const item = launchItems().find((x) => x.id === id);
    if (item) item.targets.forEach((t) => require("./palette").openTarget(t));
  });
  ipcMain.handle("plugins:list", () =>
    plugins.list().map(({ entry, ...p }) => p),
  );
  ipcMain.handle("plugins:enable", (_e, id, on) => {
    if (!settings.get().pluginsEnabled)
      throw new Error("Enable community plugins in Settings first");
    if (on) plugins.enable(id);
    else plugins.disable(id);
  });
  ipcMain.handle("plugins:folder", () => shell.openPath(plugins.root()));
  ipcMain.handle("capture:open", (_e, mode) =>
    capture.open(mode === "record" ? "record" : "image"),
  );
  ipcMain.handle("files:tool", (_e, id, op) => {
    const [file] = shelf.pathsFor([id]);
    if (!file) throw new Error("Select a file");
    return tools.run(file, op);
  });
  ipcMain.handle("files:process", (_e, ids, op, width) =>
    files.run(shelf.pathsFor(Array.isArray(ids) ? ids : []), op, width),
  );
  ipcMain.handle("files:share", async (_e, id) => {
    const [file] = shelf.pathsFor([id]);
    if (!file) throw new Error("Select a file");
    return sharing.share(file);
  });
  ipcMain.handle("files:stop-share", () => sharing.stop());
  ipcMain.handle("files:copy-path", (_e, id) => {
    const [file] = shelf.pathsFor([id]);
    if (file) return require("electron").clipboard.writeText(file);
  });
  ipcMain.handle("notifications:status", () => notifications.status);
  ipcMain.handle("activity:list", () => activity.list());
  ipcMain.handle("activity:clear", () => activity.clear());
  ipcMain.handle("activity:read", () => activity.read());
  ipcMain.on("activity:notify", (_e, item) => activity.add(item));
  ipcMain.on("focus:set", (_e, on) => {
    activity.focus(!!on);
    focusMode.configure(on, settings.get());
  });
  ipcMain.handle("jobs:list", () => [...jobs.list(), ...terminalItems]);
  ipcMain.handle("jobs:cancel", (_e, id) => jobs.cancel(id));
  ipcMain.handle("reminders:list", () => reminders.list());
  ipcMain.handle("reminders:add", (_e, minutes, text) =>
    reminders.add(minutes, text),
  );
  ipcMain.handle("display:list", () =>
    screen.getAllDisplays().map((d) => ({
      id: String(d.id),
      name: d.label || String(d.id),
      primary: d.id === screen.getPrimaryDisplay().id,
    })),
  );
  ipcMain.on("display:cycle", (_e, delta) => {
    const list = screen.getAllDisplays();
    const i = Math.max(
      0,
      list.findIndex((d) => String(d.id) === settings.get().monitorId),
    );
    settings.set({
      monitorId: String(
        list[(i + (delta > 0 ? 1 : list.length - 1)) % list.length].id,
      ),
    });
  });
  ipcMain.on("settings:system", (_e, key) => {
    const targets = {
      wifi: "network-wifi",
      bluetooth: "bluetooth",
      dnd: "quiethours",
      sound: "sound",
      battery: "batterysaver",
      notifications: "notifications",
    };
    if (targets[key] && process.platform === "win32")
      shell.openExternal("ms-settings:" + targets[key]);
  });
  ipcMain.on("app:ready", () => markBootOk());
  ipcMain.on("settings:get", (e) => (e.returnValue = settings.get()));
  ipcMain.on("island:hitbox", (_e, r) => {
    if (
      r &&
      ["x", "y", "width", "height", "radius"].every((k) =>
        Number.isFinite(r[k]),
      )
    )
      hitbox = r;
    updateMouseHit();
  });
  ipcMain.on("island:pointer", () => updateMouseHit());
  ipcMain.on("island:envelope", (_e, env) => {
    if (!env || !Number.isFinite(env.w) || !Number.isFinite(env.h)) return;
    envelope = {
      w: Math.max(40, Math.min(1200, env.w)),
      h: Math.max(10, Math.min(800, env.h)),
    };
    positionWindow();
  });
  ipcMain.on("system:watch", (_e, on) => sysinfo.watch(!!on));
  // The island only accepts keyboard focus while the to-do panel is on screen; it must never steal focus otherwise.
  ipcMain.on("island:focusable", (_e, on) => {
    if (!win || win.isDestroyed()) return;
    if (!on && win.isFocused()) win.blur();
    win.setFocusable(!!on);
  });
  ipcMain.on("island:focus", (_e, on) => {
    if (!win || win.isDestroyed()) return;
    if (on) {
      win.setFocusable(true);
      win.focus();
    }
  });
  ipcMain.on("log:error", (_e, text) =>
    logError("renderer", String(text).slice(0, 2000)),
  );
  ipcMain.handle("media:control", (_e, action, value, expectedApp) =>
    media.control(action, value, expectedApp),
  );
  ipcMain.on("media:select", (_e, source) => media.select(source));
  ipcMain.on("open:external", (_e, url) => openExternal(url));
  ipcMain.on("settings:open", openSettings);
  ipcMain.on("menu:show", () =>
    Menu.buildFromTemplate(trayMenuTemplate()).popup({ window: win }),
  );
  ipcMain.on("app:quit", () => app.quit());
  ipcMain.on("shelf:drag", (e, ids) => {
    const paths = shelf.pathsFor(ids);
    if (!paths.length) return;
    e.sender.startDrag({
      files: paths,
      icon: shelf.iconFor(paths[0]).isEmpty()
        ? nativeImage.createFromPath(asset("tray.png"))
        : shelf.iconFor(paths[0]),
    });
  });

  ipcMain.handle("battery:get", () => win32.battery());
  ipcMain.handle("media:caps", () => media.capabilities());
  ipcMain.handle("clipboard:list", () => clipboardHistory.list());
  ipcMain.handle("clipboard:copy", (_e, id, as) =>
    clipboardHistory.copy(id, as),
  );
  ipcMain.handle("clipboard:paste", async (_e, id) => {
    const r = await clipboardHistory.copy(id);
    return r?.ok ? win32.paste() : false;
  });
  ipcMain.handle("clipboard:pin", (_e, id) => clipboardHistory.pin(id));
  ipcMain.handle("clipboard:remove", (_e, id) => clipboardHistory.remove(id));
  ipcMain.handle("clipboard:clear", () => clipboardHistory.clear());
  ipcMain.handle("shelf:list", () => shelf.list());
  ipcMain.handle("shelf:add", (_e, paths) =>
    shelf.add(Array.isArray(paths) ? paths : []),
  );
  ipcMain.handle("shelf:remove", (_e, ids) => shelf.remove(ids));
  ipcMain.handle("shelf:clear", () => shelf.clear());
  ipcMain.handle("shelf:open", (_e, id) => {
    const [p] = shelf.pathsFor([id]);
    if (p) shell.openPath(p);
  });
  ipcMain.handle("shelf:reveal", (_e, id) => {
    const [p] = shelf.pathsFor([id]);
    if (p) shell.showItemInFolder(p);
  });
  ipcMain.handle("today:get", () => todayState());
  ipcMain.handle("notes:get", () => notesStore.read());
  ipcMain.handle("notes:set", (_e, data) => {
    const todos = Array.isArray(data && data.todos)
      ? data.todos.slice(0, 50).map((x) => ({
          id: Number(x.id) || Date.now(),
          text: String(x.text || "").slice(0, 140),
          done: !!x.done,
        }))
      : [];
    notesStore.write({ todos, memo: String(data?.memo || "").slice(0, 5000) });
  });
  ipcMain.handle("calendar:get", () => ({
    status: calendar.status,
    events: calendar.last || [],
  }));
  ipcMain.handle("update:check", () => updater.check());
  ipcMain.handle("update:apply", () => {
    app.relaunch();
    app.quit();
  });
  ipcMain.handle("settings:set", (_e, patch) => settings.set(patch));
  ipcMain.on(
    "settings:cities",
    (e) =>
      (e.returnValue = Object.entries(cities).map(([key, c]) => ({
        key,
        ar: c.ar,
        en: c.en,
      }))),
  );
  ipcMain.handle("settings:secret", (_e, name, value) => {
    settings.setSecret(String(name), String(value || "").trim());
    if (name === "githubToken") github.start();
  });
  ipcMain.handle("shelf:image", (_e, id, op) => shelf.imageOp(id, op));
  ipcMain.handle("usage:get", () => tracker.today());
  ipcMain.handle(
    "github:get",
    () => github.last || { status: "off", items: [] },
  );
  ipcMain.handle("privacy:get", () => privacy.state || { mic: [], cam: [] });
  ipcMain.on(
    "controls:volume",
    (_e, action) =>
      ["volup", "voldown", "mute"].includes(action) && win32.mediaKey(action),
  );
  ipcMain.handle("controls:brightness", async (_e, level) => {
    const args = Number.isFinite(level)
      ? [Math.max(0, Math.min(100, Math.round(level)))]
      : [];
    const out = await runOnce("brightness.ps1", 10000, args);
    const n = parseInt(out, 10);
    return Number.isFinite(n) ? n : null;
  });
  ipcMain.handle("settings:displays", () =>
    screen.getAllDisplays().map((d) => ({
      id: String(d.id),
      name: d.label || String(d.id),
      primary: d.id === screen.getPrimaryDisplay().id,
    })),
  );
  ipcMain.handle("app:info", () => ({ version: info.version }));
  ipcMain.on = originalOn;
  ipcMain.handle = originalHandle;
}

// ---------------------------------------------------------------- lifecycle

app.on("second-instance", () => {
  userHidden = false;
  applyVisibility();
});

app.whenReady().then(() => {
  settings.init();
  createWindow();
  createTray();
  if (process.platform === "win32")
    pointerTimer = setInterval(updateMouseHit, 150);
  registerIpc();

  activity = new ActivityHub(
    (list) => push("activity:update", list),
    (item) => push("activity:alert", item),
  );
  activity.configure({
    digest: settings.get().notificationDigest,
    minutes: settings.get().notificationMinutes,
  });
  sharing = new LocalShare();
  files = new FileActions(
    info.baseRoot,
    (r) => {
      if (r.path) shelf.add([r.path]);
      activity.add({
        source: "files",
        title: r.ok
          ? "اكتملت معالجة الملف / File ready"
          : "تعذرت المعالجة / Processing failed",
        body: r.error || "",
      });
    },
    (progress) => push("file:progress", progress),
  );
  focusMode = new FocusMode((name) =>
    activity.add({
      source: "focus",
      title: "تطبيق مشتت / Distraction",
      body: name,
    }),
  );
  plugins = new Plugins((cards) => push("plugins:update", cards));
  capture = new Capture(
    info.root,
    files,
    (file) => {
      shelf.add([file]);
      activity.add({
        source: "capture",
        title: "تم حفظ الالتقاط / Capture saved",
        body: path.basename(file),
      });
    },
    (text) => push("assistant:show", text),
  );
  notifications = new WindowsNotifications(
    info.baseRoot,
    (item) => activity.add(item),
    (status) => push("notifications:status", status),
  );
  if (settings.get().nativeNotifications) notifications.start();
  lyrics = new Lyrics((d) => push("lyrics:update", d));
  jobs = new Jobs(
    (list) => push("jobs:update", list),
    (j) =>
      activity.add({
        source: "jobs",
        title: j.label,
        body:
          j.status === "done"
            ? "اكتمل / completed"
            : "فشل أو أُلغي / failed or cancelled",
      }),
  );
  tools = new Tools(jobs);
  terminal = new TerminalEvents(
    path.join(app.getPath("userData"), "events"),
    (items) => {
      terminalItems = items;
      push("jobs:update", [...jobs.list(), ...items]);
    },
    (item) =>
      activity.add({
        source: "terminal",
        title: item.label,
        body: item.status,
      }),
  );
  terminal.start();
  downloads = new DownloadWatcher(app.getPath("downloads"), (d) =>
    activity.add({
      source: "downloads",
      title: "اكتمل التنزيل / Download complete",
      body: d.name,
    }),
  );
  if (settings.get().downloadAlerts) downloads.start();
  health = new HealthReminders((text) =>
    activity.add({ source: "health", title: text }),
  );
  health.configure(settings.get().healthReminders);
  reminders = new Reminders((r) =>
    activity.add({ source: "reminders", title: r.text, important: true }),
  );

  media = new MediaBridge((payload) => {
    if (payload && payload.type === "unavailable")
      logError("media unavailable:", payload.reason);
    lastMedia = payload;
    lyrics.update(payload, settings.get().lyrics);
    push("media:update", payload);
  }, info.baseRoot);
  media.start();

  clipboardHistory = new ClipboardHistory((list) =>
    push("clipboard:update", list),
  );
  if (settings.get().clipboard) clipboardHistory.start();

  shelf = new Shelf((list) => push("shelf:update", list));
  shelf.load();

  calendar = new CalendarFeed((state) => {
    calendar.last = state.events;
    push("calendar:update", state);
  });
  calendar.configure(settings.get().icsUrl);

  bluetooth = new BluetoothWatcher((devices) =>
    push("bluetooth:update", devices),
  );
  bluetooth.start();

  updater = new Updater((version) => push("update:ready", { version }));
  if (settings.get().updates) updater.start();

  weather = new Weather(() => push("today:update", todayState()));
  weather.configure(prayer.location(settings.get()), settings.get().weather);
  scheduleMidnight();

  sysinfo = new SysInfo((sample) => push("system:sample", sample));

  breaks = new Breaks(() => push("break:due", {}));
  breaks.configure(settings.get().breakEvery);

  tracker = new Tracker((today) => push("usage:update", today));
  if (settings.get().timeTracking) tracker.start();

  privacy = new PrivacyWatcher((state) => {
    privacy.state = state;
    push("privacy:update", state);
  });
  if (settings.get().micCamIndicator) privacy.start();

  github = new GitHubWatcher(
    () => settings.getSecret("githubToken"),
    (state) => {
      github.last = state;
      push("github:update", state);
      for (const item of state.fresh || [])
        activity.add({ source: "github", title: item.title, body: item.repo });
    },
    () => settings.get().githubRepos,
  );
  github.start();

  palette = new Palette({
    root: info.root,
    settings,
    onTimer: (minutes) => push("shortcut", "timer:" + minutes),
    openSettings,
    onReminder: (minutes, text) => reminders.add(minutes, text),
    onQuiet: () => {
      activity.focus(true);
      push("activity:quiet", true);
    },
  });

  if (process.env.ISLANDLY_TEST)
    global.__islandly = { palette, shelf, tracker, openSettings };

  fsWatcher = watchForeground({
    onTargetDisplay: (bounds) => {
      if (!bounds) return true; // Conservative fallback for protected/exclusive windows.
      const dip = screen.screenToDipRect(null, bounds);
      const activeDisplay = screen.getDisplayMatching(dip);
      const target =
        screen
          .getAllDisplays()
          .find((d) => String(d.id) === settings.get().monitorId) ||
        screen.getPrimaryDisplay();
      return activeDisplay.id === target.id;
    },
    onFullscreen: (active) => {
      fullscreenActive = active;
      if (!active) positionWindow();
      applyVisibility();
    },
    onApp: (fg) => {
      foregroundApp = fg;
      focusMode.foreground({ ...fg, fullscreen: fullscreenActive });
      tracker.setApp(fg);
      push("foreground", fg);
    },
  });

  const send = (cmd) => push("shortcut", cmd);
  globalShortcut.register("Control+Alt+I", () => send("toggle"));
  globalShortcut.register("Control+Alt+P", () => send("pomodoro"));
  globalShortcut.register("Control+Alt+O", () =>
    capture.open("image").catch((e) => logError("capture", e)),
  );
  globalShortcut.register("Control+Alt+R", () =>
    capture.open("record").catch((e) => logError("capture", e)),
  );
  globalShortcut.register("Control+Alt+T", async () => {
    const text = await require("electron").clipboard.readText();
    push("assistant:show", String(text).slice(0, 4000));
  });
  globalShortcut.register("Control+Alt+S", stashFromExplorer);
  if (!globalShortcut.register("Control+Alt+Space", () => palette.toggle()))
    logError("shortcut Ctrl+Alt+Space is taken by another app");

  settings.onChange((now, prev) => {
    if (now.nativeNotifications !== prev.nativeNotifications)
      now.nativeNotifications ? notifications.start() : notifications.stop();
    if (now.githubRepos !== prev.githubRepos) github.start();
    if (now.healthReminders !== prev.healthReminders)
      health.configure(now.healthReminders);
    if (
      now.focusDim !== prev.focusDim ||
      now.distractionApps !== prev.distractionApps
    )
      focusMode.configure(focusMode.active, now);
    if (now.pluginsEnabled !== prev.pluginsEnabled && !now.pluginsEnabled)
      plugins.stop();
    if (now.lyrics !== prev.lyrics) {
      lyrics.stop();
      lyrics.update(lastMedia, now.lyrics);
    }
    if (now.downloadAlerts !== prev.downloadAlerts)
      now.downloadAlerts ? downloads.start() : downloads.stop();
    if (
      now.notificationDigest !== prev.notificationDigest ||
      now.notificationMinutes !== prev.notificationMinutes
    )
      activity.configure({
        digest: now.notificationDigest,
        minutes: now.notificationMinutes,
      });
    if (now.position !== prev.position || now.monitorId !== prev.monitorId)
      positionWindow();
    if (now.scale !== prev.scale && win) {
      win.webContents.setZoomFactor(zoom());
      positionWindow();
    }
    if (now.icsUrl !== prev.icsUrl) calendar.configure(now.icsUrl);
    if (now.updates !== prev.updates)
      now.updates ? updater.start() : updater.stop();
    if (now.clipboard !== prev.clipboard)
      now.clipboard ? clipboardHistory.start() : clipboardHistory.stop();
    if (now.hideFullscreen !== prev.hideFullscreen) applyVisibility();
    const locKeys = ["city", "lat", "lng", "prayerMethod", "madhab", "weather"];
    if (locKeys.some((k) => now[k] !== prev[k])) {
      weather.configure(prayer.location(now), now.weather);
      push("today:update", todayState());
    }
    if (now.breakEvery !== prev.breakEvery) breaks.configure(now.breakEvery);
    if (now.timeTracking !== prev.timeTracking)
      now.timeTracking ? tracker.start() : tracker.stop();
    if (now.micCamIndicator !== prev.micCamIndicator) {
      if (now.micCamIndicator) privacy.start();
      else {
        privacy.stop();
        privacy.state = { mic: [], cam: [] };
        push("privacy:update", privacy.state);
      }
    }
    push("settings:update", now);
    if (now.lang !== prev.lang && win) win.webContents.send("language:reload");
    buildTrayMenu();
  });

  powerMonitor.on("suspend", () => {
    focusMode.clear();
    sharing.stop();
    capture.stop();
  });
  powerMonitor.on("lock-screen", () => focusMode.clear());
  powerMonitor.on("resume", () => {
    media.stop();
    media.start();
    calendar.refresh();
    weather.refresh();
    github.start();
    privacy.stop();
    if (settings.get().micCamIndicator) privacy.start();
    scheduleMidnight();
    push("today:update", todayState());
    positionWindow();
  });
  screen.on("display-metrics-changed", positionWindow);
  screen.on("display-added", positionWindow);
  screen.on("display-removed", positionWindow);
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
  [
    media,
    calendar,
    bluetooth,
    updater,
    fsWatcher,
    clipboardHistory,
    weather,
    sysinfo,
    breaks,
    tracker,
    privacy,
    github,
    palette,
    lyrics,
    activity,
    jobs,
    downloads,
    reminders,
    files,
    sharing,
    capture,
    focusMode,
    plugins,
    terminal,
    health,
    notifications,
  ].forEach((m) => m && m.stop && m.stop());
  clearInterval(pointerTimer);
  clearTimeout(midnightTimer);
});

// Having this listener stops Electron from quitting when the settings window closes; only the tray menu quits.
app.on("window-all-closed", () => {
  if (!win || win.isDestroyed()) app.quit();
});

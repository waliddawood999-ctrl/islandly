// Community JS runs in an isolated sandboxed renderer, not in Electron main or a Node worker.
// There is no filesystem/network/clipboard API. Only bounded text cards can cross the preload bridge.
const fs = require("fs");
const path = require("path");
const { BrowserWindow, ipcMain, app } = require("electron");
class Plugins {
  constructor(onCards) {
    this.onCards = onCards;
    this.windows = new Map();
    this.cards = new Map();
    ipcMain.on("plugin:publish", (event, value) => {
      const plugin = [...this.windows].find(
        ([, w]) =>
          !w.isDestroyed() &&
          event.sender === w.webContents &&
          event.senderFrame === event.sender.mainFrame,
      );
      if (!plugin || !value || typeof value.text !== "string") return;
      const [id] = plugin;
      const now = Date.now();
      if (now - (this.cards.get(id)?.at || 0) < 500) return;
      this.cards.set(id, {
        id,
        title: String(value.title || id).slice(0, 80),
        text: value.text.slice(0, 2000),
        at: now,
      });
      this.onCards([...this.cards.values()]);
    });
  }
  root() {
    return path.join(app.getPath("userData"), "plugins");
  }
  list() {
    fs.mkdirSync(this.root(), { recursive: true });
    const out = [];
    for (const dir of fs.readdirSync(this.root(), { withFileTypes: true })) {
      if (!dir.isDirectory() || !/^[-\w]{1,60}$/.test(dir.name)) continue;
      try {
        const root = path.join(this.root(), dir.name);
        const manifest = JSON.parse(
          fs.readFileSync(path.join(root, "manifest.json"), "utf8"),
        );
        const entry = manifest.entry || "plugin.js";
        if (!/^[\w.-]+\.js$/.test(entry)) continue;
        const file = path.join(root, entry);
        if (
          !fs.realpathSync(file).startsWith(fs.realpathSync(root) + path.sep) ||
          fs.statSync(file).size > 100000
        )
          continue;
        out.push({
          id: dir.name,
          name: String(manifest.name || dir.name).slice(0, 80),
          entry: file,
          enabled: this.windows.has(dir.name),
        });
      } catch (_) {}
    }
    return out;
  }
  enable(id) {
    if (this.windows.has(id)) return;
    if (this.windows.size >= 4)
      throw new Error("At most four plugins may run together");
    const plugin = this.list().find((p) => p.id === id);
    if (!plugin) throw new Error("Plugin not found");
    const w = new BrowserWindow({
      show: false,
      webPreferences: {
        preload: path.join(__dirname, "../plugin-preload.js"),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        partition: "islandly-plugin-" + id,
        backgroundThrottling: true,
      },
    });
    this.windows.set(id, w);
    const source = fs
      .readFileSync(plugin.entry, "utf8")
      .replace(/<\/script/gi, "<\\/script");
    const html = `<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; connect-src 'none'; img-src 'none'; frame-src 'none'; worker-src 'none';"><script>${source}</script>`;
    w.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    w.webContents.on("will-navigate", (e) => e.preventDefault());
    w.webContents.session.setPermissionRequestHandler((_wc, _p, cb) =>
      cb(false),
    );
    w.webContents.on("render-process-gone", () => this.disable(id));
    w.on("unresponsive", () => this.disable(id));
    w.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
  }
  disable(id) {
    const w = this.windows.get(id);
    this.windows.delete(id);
    this.cards.delete(id);
    if (w && !w.isDestroyed()) w.destroy();
    this.onCards([...this.cards.values()]);
  }
  stop() {
    for (const id of [...this.windows.keys()]) this.disable(id);
  }
}
module.exports = { Plugins };

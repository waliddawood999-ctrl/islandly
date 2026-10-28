const {
  BrowserWindow,
  desktopCapturer,
  screen,
  ipcMain,
  app,
  nativeImage,
  session,
} = require("electron");
const path = require("path");
const fs = require("fs");
class Capture {
  constructor(root, files, onSaved, onText) {
    this.root = root;
    this.files = files;
    this.onSaved = onSaved;
    this.onText = onText;
    this.win = null;
    this.sources = [];
    this.image = null;
    this.selected = null;
    this.mode = "image";
    this.chunks = [];
    this.bytes = 0;
    const valid = (e) =>
      this.win &&
      !this.win.isDestroyed() &&
      e.sender === this.win.webContents &&
      e.senderFrame === e.sender.mainFrame;
    const handle = (ch, fn) =>
      ipcMain.handle(ch, (e, ...args) => {
        if (!valid(e)) throw new Error("Unauthorized capture request");
        return fn(...args);
      });
    handle("capture:list", () =>
      this.sources.map((s) => ({
        id: s.id,
        name: s.name,
        thumb: s.thumbnail.toDataURL(),
      })),
    );
    handle("capture:mode", () => this.mode);
    handle("capture:select", (id) => {
      const source = this.sources.find((s) => s.id === id);
      if (!source) throw new Error("Invalid capture source");
      this.selected = id;
      this.image = source.thumbnail;
      return source.thumbnail.toDataURL();
    });
    handle("capture:crop", async (rect, ocr) => {
      if (this.mode !== "image" || !this.image)
        throw new Error("No screenshot selected");
      const size = this.image.getSize();
      const r = {
        x: Math.floor(rect.x),
        y: Math.floor(rect.y),
        width: Math.floor(rect.width),
        height: Math.floor(rect.height),
      };
      if (
        !Object.values(r).every(Number.isFinite) ||
        r.x < 0 ||
        r.y < 0 ||
        r.width < 1 ||
        r.height < 1 ||
        r.x + r.width > size.width ||
        r.y + r.height > size.height
      )
        throw new Error("Invalid selection");
      const dir = path.join(
        app.getPath(ocr ? "temp" : "downloads"),
        "Islandly",
      );
      fs.mkdirSync(dir, { recursive: true });
      const file = path.join(dir, "Screenshot-" + Date.now() + ".png");
      fs.writeFileSync(file, this.image.crop(r).toPNG(), { flag: "wx" });
      if (ocr) {
        try {
          const result = await this.files.run([file], "ocr");
          if (result.ok) this.onText(result.text);
          return result;
        } finally {
          fs.rmSync(file, { force: true });
        }
      }
      this.onSaved(file);
      return { ok: true, path: file };
    });
    handle("capture:chunk", (data) => {
      if (this.mode !== "record" || !this.selected)
        throw new Error("Recording not active");
      const chunk = Buffer.from(data);
      if ((this.bytes += chunk.length) > 64 * 1024 * 1024)
        throw new Error("Recording exceeds 64 MB");
      this.chunks.push(chunk);
    });
    handle("capture:finish", () => {
      if (!this.chunks.length) return { ok: false };
      const dir = path.join(app.getPath("downloads"), "Islandly");
      fs.mkdirSync(dir, { recursive: true });
      const file = path.join(dir, "Recording-" + Date.now() + ".webm");
      fs.writeFileSync(file, Buffer.concat(this.chunks), { flag: "wx" });
      this.chunks = [];
      this.bytes = 0;
      this.onSaved(file);
      return { ok: true, path: file };
    });
    session.defaultSession.setDisplayMediaRequestHandler(
      async (request, callback) => {
        if (
          !this.win ||
          this.win.isDestroyed() ||
          request.frame !== this.win.webContents.mainFrame ||
          this.mode !== "record" ||
          !this.selected
        )
          return callback({});
        try {
          const sources = await desktopCapturer.getSources({
            types: ["screen"],
            thumbnailSize: { width: 0, height: 0 },
          });
          const source = sources.find((s) => s.id === this.selected);
          callback(source ? { video: source } : {});
        } catch (_) {
          callback({});
        }
      },
    );
    session.defaultSession.setPermissionRequestHandler(
      (wc, permission, callback) =>
        callback(
          permission === "display-capture" &&
            this.win &&
            !this.win.isDestroyed() &&
            wc === this.win.webContents &&
            this.mode === "record",
        ),
    );
  }
  async open(mode = "image") {
    if (this.win && !this.win.isDestroyed()) {
      this.win.focus();
      return;
    }
    this.mode = mode;
    this.image = null;
    this.selected = null;
    this.chunks = [];
    this.bytes = 0;
    const display = screen.getDisplayNearestPoint(
      screen.getCursorScreenPoint(),
    );
    const width = Math.min(
      3840,
      Math.ceil(display.bounds.width * display.scaleFactor),
    );
    const height = Math.min(
      2160,
      Math.ceil(display.bounds.height * display.scaleFactor),
    );
    this.sources = await desktopCapturer.getSources({
      types: ["screen"],
      thumbnailSize: { width, height },
    });
    this.win = new BrowserWindow({
      width: 1000,
      height: 760,
      autoHideMenuBar: true,
      title:
        mode === "record"
          ? "Islandly — Screen recording"
          : "Islandly — Screenshot / OCR",
      webPreferences: {
        preload: path.join(__dirname, "capture-preload.js"),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
      },
    });
    this.win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    this.win.webContents.on("will-navigate", (e) => e.preventDefault());
    this.win.on("closed", () => {
      this.win = null;
      this.sources = [];
      this.image = null;
      this.selected = null;
      this.chunks = [];
      this.bytes = 0;
    });
    this.win.loadFile(path.join(this.root, "src/capture/index.html"));
  }
  stop() {
    if (this.win && !this.win.isDestroyed()) this.win.destroy();
  }
}
module.exports = { Capture };

const { BrowserWindow, screen } = require("electron");
const win32 = require("../win32");
class FocusMode {
  constructor(onDistraction) {
    this.onDistraction = onDistraction;
    this.active = false;
    this.dim = false;
    this.overlays = [];
    this.lastWarning = "";
    this.warnAt = 0;
  }
  configure(on, settings) {
    clearInterval(this.timer);
    this.active = !!on;
    this.dim = !!settings.focusDim;
    this.apps = String(settings.distractionApps || "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    if (!on || !this.dim) this.clear(true);
    else if (this.dim)
      this.timer = setInterval(() => this.foreground(win32.foreground()), 300);
  }
  foreground(fg) {
    if (!this.active) return;
    if (
      this.apps.includes(fg.app) &&
      (this.lastWarning !== fg.app || Date.now() - this.warnAt > 60000)
    ) {
      this.lastWarning = fg.app;
      this.warnAt = Date.now();
      this.onDistraction(fg.app);
    }
    if (!this.dim || fg.fullscreen) {
      this.clear();
      return;
    }
    const rect = win32.foregroundBounds();
    if (!rect) {
      this.clear();
      return;
    }
    const target = screen.screenToDipRect
      ? screen.screenToDipRect(null, rect)
      : rect;
    const areas = [];
    for (const display of screen.getAllDisplays()) {
      const b = display.bounds,
        l = Math.max(b.x, target.x),
        r = Math.min(b.x + b.width, target.x + target.width),
        t = Math.max(b.y, target.y),
        bt = Math.min(b.y + b.height, target.y + target.height);
      if (r <= l || bt <= t) {
        areas.push(b);
        continue;
      }
      areas.push(
        { x: b.x, y: b.y, width: b.width, height: t - b.y },
        { x: b.x, y: bt, width: b.width, height: b.y + b.height - bt },
        { x: b.x, y: t, width: l - b.x, height: bt - t },
        { x: r, y: t, width: b.x + b.width - r, height: bt - t },
      );
    }
    const valid = areas.filter((a) => a.width > 0 && a.height > 0);
    while (this.overlays.length < valid.length) {
      const w = new BrowserWindow({
        frame: false,
        show: false,
        focusable: false,
        skipTaskbar: true,
        backgroundColor: "#000000",
        opacity: 0.35,
        webPreferences: {
          sandbox: true,
          nodeIntegration: false,
          contextIsolation: true,
        },
      });
      w.setIgnoreMouseEvents(true);
      w.setAlwaysOnTop(true);
      this.overlays.push(w);
    }
    this.overlays.forEach((w, i) => {
      if (valid[i]) {
        w.setBounds(valid[i]);
        w.showInactive();
      } else w.hide();
    });
  }
  clear(destroy = false) {
    for (const w of this.overlays)
      if (!w.isDestroyed()) {
        if (destroy) w.destroy();
        else w.hide();
      }
    if (destroy) this.overlays = [];
  }
  stop() {
    clearInterval(this.timer);
    for (const w of this.overlays) if (!w.isDestroyed()) w.destroy();
    this.overlays = [];
    this.active = false;
  }
}
module.exports = { FocusMode };

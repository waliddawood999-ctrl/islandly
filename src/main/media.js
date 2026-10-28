const path = require("path");
const readline = require("readline");
const { Worker } = require("worker_threads");
const { spawnScript, isWindows } = require("./ps");
const win32 = require("./win32");
class MediaBridge {
  constructor(onUpdate, baseRoot) {
    this.onUpdate = onUpdate;
    this.baseRoot = baseRoot;
    this.worker = null;
    this.ps = null;
    this.nextId = 1;
    this.pending = new Map();
    this.ready = false;
    this.stopped = true;
    this.app = "";
    this.preferred = "";
    this.retry = null;
    this.warmTimer = null;
    this.commands = Promise.resolve();
  }
  start() {
    if (!this.stopped) return;
    this.stopped = false;
    if (!isWindows) {
      this.onUpdate({ type: "unavailable", reason: "not-windows" });
      return;
    }
    this.startWorker();
    this.warmTimer = setTimeout(() => this.warmUp(), 1000);
  }
  startWorker() {
    if (this.stopped) return;
    const w = new Worker(path.join(__dirname, "media-worker.js"), {
      workerData: { baseRoot: this.baseRoot },
    });
    this.worker = w;
    w.on("message", (m) => {
      this.app = m.app || "";
      this.onUpdate(m);
    });
    w.on("error", (err) =>
      this.onUpdate({ type: "unavailable", reason: String(err) }),
    );
    w.on("exit", () => {
      if (this.worker !== w) return;
      this.worker = null;
      if (!this.stopped)
        this.retry = setTimeout(() => this.startWorker(), 30000);
    });
    w.postMessage({ select: this.preferred });
  }
  select(app) {
    this.preferred = String(app || "");
    this.worker?.postMessage({ select: this.preferred });
  }
  stop() {
    this.stopped = true;
    clearTimeout(this.retry);
    clearTimeout(this.warmTimer);
    const w = this.worker;
    this.worker = null;
    w?.terminate();
    this.ps?.kill();
    this.ps = null;
    this.clearPending();
    this.ready = false;
  }
  clearPending() {
    for (const p of this.pending.values()) {
      clearTimeout(p.timer);
      p.resolve({ ok: false });
    }
    this.pending.clear();
  }
  helper() {
    if (this.stopped) return null;
    if (this.ps) return this.ps;
    const ps = spawnScript("media-ctl.ps1");
    if (!ps) return null;
    this.ps = ps;
    const clear = () => {
      if (this.ps !== ps) return;
      this.ps = null;
      this.ready = false;
      this.clearPending();
    };
    ps.on("error", clear);
    ps.on("exit", clear);
    ps.stdin.on("error", clear);
    readline.createInterface({ input: ps.stdout }).on("line", (line) => {
      try {
        const msg = JSON.parse(line);
        this.ready = true;
        const p = this.pending.get(msg.id);
        if (p) {
          clearTimeout(p.timer);
          this.pending.delete(msg.id);
          p.resolve(msg);
        }
      } catch (_) {}
    });
    return ps;
  }
  ask(ps, command) {
    const id = this.nextId++;
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        if (this.pending.has(id)) {
          ps.kill();
          this.clearPending();
          if (this.ps === ps) this.ps = null;
          this.ready = false;
        }
      }, 6000);
      this.pending.set(id, { resolve, timer });
      try {
        ps.stdin.write(`${id} ${command}\n`);
      } catch (_) {
        ps.kill();
        this.clearPending();
      }
    });
  }
  warmUp() {
    const ps = this.helper();
    if (ps) this.ask(ps, "caps");
  }
  async target(ps, app) {
    return this.ask(
      ps,
      "select " + Buffer.from(String(app || ""), "utf8").toString("base64"),
    );
  }
  serialize(fn) {
    const result = this.commands.then(fn, fn);
    this.commands = result.catch(() => {});
    return result;
  }
  control(action, value, expectedApp) {
    return this.serialize(() =>
      this.performControl(action, value, expectedApp),
    );
  }
  async performControl(action, value, expectedApp) {
    if (
      !["playpause", "next", "prev", "seek"].includes(action) ||
      (expectedApp && expectedApp !== this.app)
    )
      return { ok: false };
    if (action === "seek" && (!Number.isFinite(value) || value < 0))
      return { ok: false };
    const ps = this.helper();
    if (!ps)
      return {
        ok: !expectedApp && action !== "seek" && win32.mediaKey(action),
        fallback: true,
      };
    if (expectedApp) {
      const selected = await this.target(ps, expectedApp);
      if (!selected.ok) return { ok: false };
    }
    return this.ask(
      ps,
      action === "seek" ? `seek ${value.toFixed(3)}` : action,
    );
  }
  capabilities() {
    return this.serialize(() => this.readCapabilities());
  }
  async readCapabilities() {
    const ps = this.helper();
    if (!ps) return { ok: false };
    if (this.app) {
      const selected = await this.target(ps, this.app);
      if (!selected.ok) return { ok: false };
    }
    return this.ask(ps, "caps");
  }
}
module.exports = { MediaBridge };

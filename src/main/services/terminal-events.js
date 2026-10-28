const fs = require("fs");
const path = require("path");
class TerminalEvents {
  constructor(dir, onChange, onDone) {
    this.dir = dir;
    this.onChange = onChange;
    this.onDone = onDone;
    this.items = new Map();
    this.watcher = null;
    this.timer = null;
  }
  start() {
    fs.mkdirSync(this.dir, { recursive: true });
    this.scan(false);
    this.watcher = fs.watch(this.dir, () => {
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.scan(true), 150);
    });
    this.watcher.on("error", () => this.stop());
  }
  scan(notify) {
    for (const name of fs.readdirSync(this.dir)) {
      if (!/^[a-f0-9]{32}\.json$/.test(name)) continue;
      try {
        const file = path.join(this.dir, name);
        if (fs.statSync(file).size > 4096) continue;
        const d = JSON.parse(fs.readFileSync(file, "utf8"));
        if (
          d.id !== name.slice(0, -5) ||
          !["running", "done", "failed"].includes(d.status) ||
          typeof d.label !== "string" ||
          !Number.isFinite(d.at)
        )
          continue;
        if (Date.now() - d.at > 86400000) {
          fs.rmSync(file, { force: true });
          continue;
        }
        const old = this.items.get(d.id);
        if (old?.status === d.status) continue;
        this.items.set(d.id, {
          id: d.id,
          label: d.label.slice(0, 120),
          status: d.status,
          exitCode: d.exitCode,
          at: d.at,
          progress: null,
          external: true,
        });
        if (notify && d.status !== "running") this.onDone(d);
      } catch (_) {}
    }
    this.items = new Map([...this.items].slice(-30));
    this.onChange([...this.items.values()].reverse());
  }
  list() {
    return [...this.items.values()].reverse();
  }
  stop() {
    clearTimeout(this.timer);
    this.watcher?.close();
    this.watcher = null;
  }
}
module.exports = { TerminalEvents };

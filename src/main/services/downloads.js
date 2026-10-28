const fs = require("fs");
const path = require("path");
// Only known browser partial -> final renames are reported. Existing files and arbitrary additions are ignored.
class DownloadWatcher {
  constructor(dir, onDone) {
    this.dir = dir;
    this.onDone = onDone;
    this.partial = new Set();
    this.watcher = null;
    this.timer = null;
  }
  start() {
    this.stop();
    try {
      this.scan(false);
      this.watcher = fs.watch(this.dir, () => {
        clearTimeout(this.timer);
        this.timer = setTimeout(() => this.scan(true), 800);
      });
      this.watcher.on("error", () => this.stop());
    } catch (_) {}
  }
  scan(notify) {
    let files;
    try {
      files = fs.readdirSync(this.dir);
    } catch (_) {
      return;
    }
    const current = new Set(files);
    const next = new Set(
      files.filter((f) => /\.(crdownload|part|partial)$/i.test(f)),
    );
    if (notify)
      for (const name of this.partial) {
        const final = name.replace(/\.(crdownload|part|partial)$/i, "");
        if (!current.has(name) && current.has(final))
          this.onDone({ name: final, path: path.join(this.dir, final) });
      }
    this.partial = next;
  }
  stop() {
    clearTimeout(this.timer);
    this.watcher?.close();
    this.watcher = null;
  }
}
module.exports = { DownloadWatcher };

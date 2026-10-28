const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const readline = require("readline");
class WindowsNotifications {
  constructor(baseRoot, onNotification, onStatus) {
    this.file = path.join(
      baseRoot,
      "bridge",
      "Islandly.NotificationBridge.exe",
    );
    this.onNotification = onNotification;
    this.onStatus = onStatus;
    this.child = null;
    this.status = "off";
  }
  start() {
    this.stop();
    if (process.platform !== "win32" || !fs.existsSync(this.file)) {
      this.status = "package-required";
      this.onStatus(this.status);
      return;
    }
    const child = spawn(this.file, [], {
      windowsHide: true,
      stdio: ["ignore", "pipe", "ignore"],
    });
    this.child = child;
    this.status = "requesting";
    this.onStatus(this.status);
    child.on("error", () => {
      this.status = "unavailable";
      this.onStatus(this.status);
    });
    readline.createInterface({ input: child.stdout }).on("line", (line) => {
      if (child !== this.child || line.length > 20000) return;
      try {
        const item = JSON.parse(line);
        if (item.type === "status") {
          this.status = item.status;
          this.onStatus(this.status);
        } else if (item.type === "notification") this.onNotification(item);
      } catch (_) {}
    });
    child.on("exit", () => {
      if (child !== this.child) return;
      this.child = null;
      if (this.status === "allowed" || this.status === "requesting") {
        this.status = "unavailable";
        this.onStatus(this.status);
      }
    });
  }
  stop() {
    const c = this.child;
    this.child = null;
    c?.kill();
    this.status = "off";
    this.onStatus(this.status);
  }
}
module.exports = { WindowsNotifications };

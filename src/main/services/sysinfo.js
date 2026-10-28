const os = require("os");
const { spawnScript } = require("../ps");
const readline = require("readline");

function cpuTimes() {
  let idle = 0;
  let total = 0;
  for (const c of os.cpus()) {
    for (const v of Object.values(c.times)) total += v;
    idle += c.times.idle;
  }
  return { idle, total };
}

/** CPU / memory readings, sampled only while someone is looking (the System panel is open). */
class SysInfo {
  constructor(onSample) {
    this.onSample = onSample;
    this.timer = null;
    this.prev = null;
    this.network = null;
    this.child = null;
  }

  watch(on) {
    if (on && !this.timer) {
      this.prev = cpuTimes();
      this.child = spawnScript("network.ps1");
      if (this.child) {
        this.child.on("error", () => {});
        readline
          .createInterface({ input: this.child.stdout })
          .on("line", (line) => {
            try {
              this.network = JSON.parse(line);
            } catch (_) {}
          });
      }
      this.sample();
      this.timer = setInterval(() => this.sample(), 2000);
    } else if (!on && this.timer) {
      this.child?.kill();
      this.child = null;
      this.network = null;
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  sample() {
    const now = cpuTimes();
    const dt = now.total - this.prev.total;
    const cpu =
      dt > 0 ? Math.round((1 - (now.idle - this.prev.idle) / dt) * 100) : 0;
    this.prev = now;
    const total = os.totalmem();
    const used = total - os.freemem();
    this.onSample({
      network: this.network,
      cpu: Math.max(0, Math.min(100, cpu)),
      memUsed: used,
      memTotal: total,
      uptime: os.uptime(),
      cores: os.cpus().length,
    });
  }

  stop() {
    this.watch(false);
  }
}

module.exports = { SysInfo };

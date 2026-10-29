const os = require('os');

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
    this.requested = false;
    this.paused = false;
  }

  watch(on) {
    this.requested = !!on;
    this.reconcile();
  }

  reconcile() {
    const on = this.requested && !this.paused;
    if (on && !this.timer) {
      this.prev = cpuTimes();
      this.sample();
      this.timer = setInterval(() => this.sample(), 2000);
    } else if (!on && this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  sample() {
    const now = cpuTimes();
    const dt = now.total - this.prev.total;
    const cpu = dt > 0 ? Math.round((1 - (now.idle - this.prev.idle) / dt) * 100) : 0;
    this.prev = now;
    const total = os.totalmem();
    const used = total - os.freemem();
    this.onSample({ cpu: Math.max(0, Math.min(100, cpu)), memUsed: used, memTotal: total, uptime: os.uptime(), cores: os.cpus().length });
  }

  setPaused(paused) {
    this.paused = paused;
    this.reconcile();
  }

  stop() {
    this.watch(false);
  }
}

module.exports = { SysInfo };

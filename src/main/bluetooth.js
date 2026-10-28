const { runOnce, isWindows } = require('./ps');

const POLL_MS = 3 * 60 * 1000;

/** Polls connected Bluetooth devices that expose a battery level (headphones, mice, ...). */
class BluetoothWatcher {
  constructor(onChange) {
    this.onChange = onChange;
    this.timer = null;
    this.last = '';
    this.generation = 0;
    this.busy = false;
  }

  start() {
    if (!isWindows || this.timer) return;
    this.generation++;
    this.poll();
    this.timer = setInterval(() => this.poll(), POLL_MS);
  }

  stop() {
    this.generation++;
    clearInterval(this.timer);
    this.timer = null;
  }

  async poll() {
    if (this.busy) return;
    this.busy = true;
    const generation = this.generation;
    let out;
    try { out = await runOnce('bt-battery.ps1', 20000); } finally { this.busy = false; }
    if (generation !== this.generation) return;
    if (!out) return;
    try {
      const parsed = JSON.parse(out);
      const devices = (Array.isArray(parsed) ? parsed : [parsed]).filter((d) => d && d.name);
      const key = JSON.stringify(devices);
      if (key !== this.last) {
        this.last = key;
        this.onChange(devices);
      }
    } catch (_) {
      /* ignore malformed output */
    }
  }
}

module.exports = { BluetoothWatcher };

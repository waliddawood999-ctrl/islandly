/** Owns power events; no battery polling or UI dependencies. */
class EcoController {
  constructor({ powerMonitor, settings, apply, publish }) {
    Object.assign(this, { powerMonitor, settings, apply, publish });
    this.eco = null;
    this.battery = false;
    this.suspended = false;
    this.listeners = [];
  }
  start() {
    try { this.battery = this.powerMonitor.isOnBatteryPower(); } catch (_) { /* unknown stays AC */ }
    for (const [event, action] of Object.entries({
      'on-battery': () => { this.battery = true; },
      'on-ac': () => { this.battery = false; },
      suspend: () => { this.suspended = true; },
      resume: () => { this.suspended = false; try { this.battery = this.powerMonitor.isOnBatteryPower(); } catch (_) {} },
    })) {
      const listener = () => { action(); this.update(); };
      this.powerMonitor.on(event, listener); this.listeners.push([event, listener]);
    }
    this.update();
  }
  state() { return { eco: !!this.eco }; }
  update() {
    const s = this.settings();
    const eco = !!(s.ecoMode || (s.ecoAuto && this.battery));
    this.apply({ eco, suspended: this.suspended });
    if (eco !== this.eco) { this.eco = eco; this.publish(this.state()); }
  }
  stop() {
    for (const [event, listener] of this.listeners) this.powerMonitor.removeListener(event, listener);
    this.listeners = [];
  }
}
module.exports = { EcoController };

const { powerMonitor } = require('electron');

/**
 * Break reminders that count only active time: if the user was already away (idle) for 5 minutes,
 * that counts as a break and the counter restarts.
 */
class Breaks {
  constructor(onDue) {
    this.onDue = onDue;
    this.everyMin = 0;
    this.active = 0;
    this.timer = null;
  }

  configure(everyMin) {
    this.everyMin = Number(everyMin) || 0;
    this.active = 0;
    clearInterval(this.timer);
    this.timer = this.everyMin > 0 ? setInterval(() => this.tick(), 60 * 1000) : null;
  }

  tick() {
    const idle = powerMonitor.getSystemIdleTime(); // seconds
    if (idle >= 5 * 60) {
      this.active = 0;
      return;
    }
    if (idle < 60) this.active += 1;
    if (this.active >= this.everyMin) {
      this.active = 0;
      this.onDue(this.everyMin);
    }
  }

  stop() {
    clearInterval(this.timer);
  }
}

module.exports = { Breaks };

const { powerMonitor } = require("electron");
class HealthReminders {
  constructor(onDue) {
    this.onDue = onDue;
    this.minutes = 0;
    this.timer = null;
  }
  configure(on) {
    this.stop();
    this.minutes = 0;
    if (on) this.timer = setInterval(() => this.tick(), 60000);
  }
  tick() {
    if (powerMonitor.getSystemIdleTime() >= 300) {
      this.minutes = 0;
      return;
    }
    this.minutes++;
    if (this.minutes % 20 === 0)
      this.onDue(
        this.minutes % 60 === 0
          ? "ماء ووقوف وتعديل الجلسة / Water, stand up and adjust posture"
          : "٢٠-٢٠-٢٠: انظر بعيدًا ٢٠ ثانية / Look 20 feet away for 20 seconds",
      );
  }
  stop() {
    clearInterval(this.timer);
    this.timer = null;
  }
}
module.exports = { HealthReminders };

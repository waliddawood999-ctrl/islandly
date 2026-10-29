const { net } = require('electron');

const REFRESH_MS = 30 * 60 * 1000;

/** Current weather from Open-Meteo (free, no API key). */
class Weather {
  constructor(onChange) {
    this.onChange = onChange;
    this.timer = null;
    this.loc = null;
    this.last = null;
    this.paused = false;
  }

  configure(loc, enabled) {
    clearInterval(this.timer);
    this.timer = null;
    this.loc = enabled ? loc : null;
    if (!this.loc) {
      this.last = null;
      this.onChange(null);
      return;
    }
    if (this.paused) return;
    this.refresh();
    this.timer = setInterval(() => this.refresh(), REFRESH_MS);
  }

  async refresh() {
    if (!this.loc || this.paused) return;
    const { lat, lng } = this.loc;
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code,is_day&daily=temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=1`;
    try {
      const res = await net.fetch(url);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const j = await res.json();
      this.last = {
        temp: Math.round(j.current.temperature_2m),
        code: j.current.weather_code,
        day: j.current.is_day === 1,
        max: Math.round(j.daily.temperature_2m_max[0]),
        min: Math.round(j.daily.temperature_2m_min[0]),
        at: Date.now(),
      };
      this.onChange(this.last);
    } catch (_) {
      /* keep the last good reading */
    }
  }

  setPaused(paused) {
    if (paused === this.paused) return;
    this.paused = paused;
    clearInterval(this.timer); this.timer = null;
    if (!paused && this.loc) {
      this.refresh(); this.timer = setInterval(() => this.refresh(), REFRESH_MS);
    }
  }

  stop() {
    clearInterval(this.timer);
  }
}

module.exports = { Weather };

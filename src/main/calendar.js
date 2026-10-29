const { net } = require('electron');

const REFRESH_MS = 10 * 60 * 1000;
const LOOKAHEAD_MS = 3 * 24 * 3600 * 1000;

/** Fetches a calendar feed (ICS link) every few minutes and reports the upcoming events. */
class CalendarFeed {
  constructor(onChange) {
    this.onChange = onChange;
    this.url = '';
    this.timer = null;
    this.status = 'off'; // 'off' | 'ok' | 'error'
  }

  configure(url) {
    const clean = String(url || '').trim().replace(/^webcal:/i, 'https:');
    if (clean === this.url) return;
    this.url = clean;
    clearInterval(this.timer);
    this.timer = null;
    if (!clean) {
      this.status = 'off';
      this.onChange({ status: 'off', events: [] });
      return;
    }
    this.refresh();
    this.timer = this.paused ? null : setInterval(() => this.refresh(), REFRESH_MS);
  }

  async refresh() {
    if (!this.url) return;
    try {
      const res = await net.fetch(this.url, { headers: { 'User-Agent': 'islandly' } });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const text = await res.text();
      const now = Date.now();
      const events = require('./ics').upcomingEvents(text, now - 3600 * 1000, now + LOOKAHEAD_MS).filter((e) => !e.allDay).slice(0, 25);
      this.status = 'ok';
      this.onChange({ status: 'ok', events });
    } catch (_) {
      this.status = 'error';
      this.onChange({ status: 'error', events: [] });
    }
  }

  setPaused(paused) {
    if (this.paused === paused) return;
    this.paused = paused;
    clearInterval(this.timer); this.timer = null;
    if (!paused && this.url) this.timer = this.paused ? null : setInterval(() => this.refresh(), REFRESH_MS);
  }

  stop() {
    clearInterval(this.timer);
  }
}

module.exports = { CalendarFeed };

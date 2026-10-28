const { net } = require("electron");
const { RequestScope } = require("./request");
const { upcomingEvents } = require("./ics");

const REFRESH_MS = 10 * 60 * 1000;
const LOOKAHEAD_MS = 3 * 24 * 3600 * 1000;

/** Fetches a calendar feed (ICS link) every few minutes and reports the upcoming events. */
class CalendarFeed {
  constructor(onChange) {
    this.onChange = onChange;
    this.url = "";
    this.timer = null;
    this.scope = new RequestScope();
    this.status = "off"; // 'off' | 'ok' | 'error'
  }

  configure(url) {
    const clean = String(url || "")
      .trim()
      .replace(/^webcal:/i, "https:");
    if (clean === this.url) return;
    this.url = clean;
    this.scope.invalidate();
    clearInterval(this.timer);
    this.timer = null;
    if (!clean) {
      this.status = "off";
      this.onChange({ status: "off", events: [] });
      return;
    }
    this.refresh();
    this.timer = setInterval(() => this.refresh(), REFRESH_MS);
  }

  async refresh() {
    if (!this.url) return;
    const request = this.scope.begin();
    try {
      const res = await net.fetch(this.url, {
        headers: { "User-Agent": "islandly" },
        signal: request.signal,
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const text = await res.text();
      if (!request.current()) return;
      const now = Date.now();
      const events = upcomingEvents(text, now - 3600 * 1000, now + LOOKAHEAD_MS)
        .filter((e) => !e.allDay)
        .slice(0, 25);
      this.status = "ok";
      this.onChange({ status: "ok", events });
    } catch (_) {
      if (!request.current()) return;
      this.status = "error";
      this.onChange({ status: "error", events: [] });
    } finally {
      request.done();
    }
  }

  stop() {
    this.scope.invalidate();
    clearInterval(this.timer);
  }
}

module.exports = { CalendarFeed };

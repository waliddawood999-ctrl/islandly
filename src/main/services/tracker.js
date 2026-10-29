// Time tracker: how long each app was in the foreground today, counted only while the user is active.
const { powerMonitor } = require('electron');
const { jsonStore } = require('./store');

const TICK = 5; // seconds
const KEEP_DAYS = 14;

const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Friendly names for common executables; anything else shows its exe name without ".exe".
const NAMES = {
  chrome: 'Chrome', msedge: 'Edge', firefox: 'Firefox', code: 'VS Code', explorer: 'File Explorer',
  winword: 'Word', excel: 'Excel', powerpnt: 'PowerPoint', outlook: 'Outlook', olk: 'Outlook',
  teams: 'Teams', 'ms-teams': 'Teams', spotify: 'Spotify', discord: 'Discord', whatsapp: 'WhatsApp',
  telegram: 'Telegram', slack: 'Slack', notepad: 'Notepad', windowsterminal: 'Terminal', zoom: 'Zoom',
};
// system surfaces and this app itself are not "apps you used"
const SKIP = new Set(['', 'electron', 'islandly', 'islandlypanels', 'lockapp', 'searchhost', 'searchapp', 'shellexperiencehost', 'startmenuexperiencehost', 'textinputhost']);

const key = (exe) => String(exe || '').toLowerCase().replace(/\.exe$/, '');

/** "chrome" / "chrome.exe" -> "Chrome"; unknown programs keep their own name. */
function prettyName(exe) {
  return NAMES[key(exe)] || String(exe || '').replace(/\.exe$/i, '');
}

class Tracker {
  constructor(onChange) {
    this.onChange = onChange;
    this.store = jsonStore('usage.json', {});
    this.data = this.store.read();
    this.app = '';
    this.title = '';
    this.timer = null;
    this.dirty = 0;
  }

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick(), TICK * 1000);
  }

  stop() {
    clearInterval(this.timer);
    this.timer = null;
    this.flush();
  }

  setApp(fg) {
    this.app = String((fg && fg.app) || '');
    this.title = String((fg && fg.title) || '');
  }

  tick() {
    const exe = key(this.app);
    if (SKIP.has(exe)) return;
    if (powerMonitor.getSystemIdleTime() >= 60) return; // away from the keyboard
    const key = dayKey();
    const day = (this.data[key] = this.data[key] || {});
    // Store apps all run inside ApplicationFrameHost; their window title is the app's name (e.g. "Calculator")
    const name = exe === 'applicationframehost' ? this.title.split(' - ').pop().trim().slice(0, 40) || 'Store app' : prettyName(this.app);
    day[name] = (day[name] || 0) + TICK;
    if (++this.dirty >= 12) this.flush(); // about once a minute
    this.onChange(this.today());
  }

  flush() {
    if (!this.dirty) return;
    const keys = Object.keys(this.data).sort();
    for (const k of keys.slice(0, Math.max(0, keys.length - KEEP_DAYS))) delete this.data[k];
    this.store.write(this.data);
    this.dirty = 0;
  }

  today() {
    const day = this.data[dayKey()] || {};
    const apps = Object.entries(day)
      .map(([name, seconds]) => ({ name, seconds }))
      .sort((a, b) => b.seconds - a.seconds);
    return { total: apps.reduce((n, a) => n + a.seconds, 0), apps: apps.slice(0, 6) };
  }
}

module.exports = { Tracker, prettyName, dayKey };

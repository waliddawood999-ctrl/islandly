// Visual smoke test: loads the renderer in plain Chromium with a mocked Electron bridge
// and a fake battery, then screenshots every state into dev/shots/.
//   node dev/preview.mjs [ar|en]     (needs `playwright` resolvable, e.g. PLAYWRIGHT_DIR=/path/to/node_modules/)
import { createRequire } from 'module';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(process.env.PLAYWRIGHT_DIR || '/opt/node-tools/node_modules/');
const { chromium } = require('playwright');
const lang = process.argv[2] || 'ar';

const out = path.join(here, 'shots');
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 640, height: 320 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

await page.addInitScript((lang) => {
  window.__sent = [];
  const handlers = {};
  window.__emit = (ch, payload) => handlers[ch] && handlers[ch](payload);
  window.islandAPI = {
    settings: { lang, autoHide: 'auto', position: 'center' },
    call: (ch, ...args) => {
      window.__sent.push(['call', ch, ...args]);
      if (ch === 'media:caps') return Promise.resolve({ ok: true, next: true, prev: false, seek: true, toggle: true });
      return Promise.resolve(null);
    },
    send: (ch, ...args) => window.__sent.push(['send', ch, ...args]),
    on: (ch, cb) => (handlers[ch] = cb),
    pathsForFiles: () => [],
  };
  const bat = new EventTarget();
  Object.assign(bat, { level: 0.82, charging: true, chargingTime: 1500, dischargingTime: Infinity });
  window.__bat = bat;
  navigator.getBattery = () => Promise.resolve(bat);
}, lang);

await page.goto('file://' + path.join(here, '..', 'src', 'renderer', 'index.html'));
await page.evaluate(() => (document.body.style.background = '#2a2d3a'));

const shot = async (name, wait = 650) => {
  await page.waitForTimeout(wait);
  await page.screenshot({ path: path.join(out, name + '.png') });
};
const open = async (id) => {
  await page.evaluate((x) => Island.open(x), id);
};
const close = async () => {
  await page.evaluate(() => Island.togglePin());
  await page.mouse.move(5, 300);
  await page.waitForTimeout(500);
};

const art = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f97316"/><stop offset="1" stop-color="#6d28d9"/></linearGradient></defs><rect width="100" height="100" fill="url(#g)"/></svg>');

// 1. nothing going on: only a thin line (auto-hide)
await shot('01-idle-sliver');

// 2. music: peek -> compact -> line -> panel
await page.evaluate(({ art, lang }) => window.__emit('media:update', { type: 'media', active: true, title: lang === 'ar' ? 'سورة البقرة — مشاري العفاسي' : 'Midnight City', artist: lang === 'ar' ? 'القرآن الكريم' : 'M83', playing: true, position: 72, duration: 7243, sentAt: Date.now(), trackChanged: true, thumb: art }), { art, lang });
await shot('02-music-peek');
await page.waitForTimeout(4300);
await shot('03-music-compact', 300);
await page.waitForTimeout(5200);
await shot('04-music-auto-hidden', 300);
await open('music');
await shot('05-music-panel');
const barBox = await page.evaluate(() => { const r = document.querySelector('.bar').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width }; });
await page.mouse.move(barBox.x + barBox.w * 0.6, barBox.y + 3);
await shot('06-music-seek-hover', 300);
await page.mouse.down();
await page.mouse.up();
const seek = await page.evaluate(() => window.__sent.filter((s) => s[1] === 'media:control'));
console.log('seek sent:', JSON.stringify(seek));
await close();

// 3. timer, battery
await open('timer');
await shot('07-timer-panel');
await close();
await page.evaluate(() => window.__emit('bluetooth:update', [{ name: 'AirPods Pro', battery: 80 }, { name: 'MX Master', battery: 45 }]));
await open('battery');
await shot('08-battery-panel');
await close();
await page.evaluate(() => {
  window.__bat.charging = false;
  window.__bat.level = 0.12;
  window.__bat.dischargingTime = 2700;
  window.__bat.dispatchEvent(new Event('chargingchange'));
});
await shot('09-battery-unplugged-peek');

// 4. clipboard
await page.evaluate(() => window.__emit('clipboard:update', [
  { id: 1, text: 'https://github.com/waliddawood999-ctrl/islandly', type: 'url', pinned: true },
  { id: 2, text: '+966 55 123 4567', type: 'phone', digits: '+966551234567' },
  { id: 3, text: '#FF5733', type: 'color', color: '#FF5733', rgb: 'rgb(255, 87, 51)' },
  { id: 4, text: '450 * 1.15', type: 'math', result: 517.5 },
]));
await open('clipboard');
await shot('10-clipboard');
await close();

// 5. shelf
await open('shelf');
await shot('11-shelf-empty');
await page.evaluate(() => window.__emit('shelf:update', [
  { id: 1, name: 'report-final.pdf', path: 'C:/a/report-final.pdf', icon: null, isDir: false },
  { id: 2, name: 'Photos 2026', path: 'C:/a/Photos', icon: null, isDir: true },
  { id: 3, name: 'design-v3.png', path: 'C:/a/design-v3.png', icon: null, isDir: false },
  { id: 4, name: 'notes.txt', path: 'C:/a/notes.txt', icon: null, isDir: false },
]));
await shot('12-shelf-items');
await close();

// 6. calendar
await open('calendar');
await shot('13-calendar-off');
await close();
const now = Date.now();
await page.evaluate((now) => window.__emit('calendar:update', { status: 'ok', events: [
  { id: 'a', title: 'Design review', start: now + 4 * 60000, end: now + 64 * 60000, url: 'https://meet.google.com/abc' },
  { id: 'b', title: 'Weekly sync', start: now + 3 * 3600000, end: now + 4 * 3600000, url: 'https://zoom.us/j/123' },
  { id: 'c', title: 'Lunch with Sara', start: now + 26 * 3600000, end: now + 27 * 3600000, url: null },
] }), now);
await shot('14-calendar-peek');
await page.waitForTimeout(9300);
await shot('15-calendar-compact', 300);
await open('calendar');
await shot('16-calendar-panel');
await close();

// 7. update notice
await page.evaluate(() => window.__emit('update:ready', { version: '0.2.1' }));
await shot('17-update-notice');

console.log('errors:', errors.length ? errors : 'none');
await browser.close();

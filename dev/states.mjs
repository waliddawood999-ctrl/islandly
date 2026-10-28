// Captures every island state (T6) over a mock desktop: one screenshot per state into dev/states/,
// plus a video of the transitions (dev/states/transitions.webm). Renderer only, mocked Electron bridge.
//   node dev/states.mjs [ar|en]
import { createRequire } from 'module';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(process.env.PLAYWRIGHT_DIR || '/opt/node-tools/node_modules/');
const { chromium } = require('playwright');
const lang = process.argv[2] || 'ar';
const out = path.join(here, 'states');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

const W = 760;
const H = 360;
const browser = await chromium.launch({ args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, recordVideo: { dir: out, size: { width: W, height: H } } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

const appIcon = (bg, letter) =>
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" rx="14" fill="${bg}"/><text x="32" y="43" font-family="Segoe UI,Arial" font-size="30" font-weight="700" text-anchor="middle" fill="#fff">${letter}</text></svg>`
  );
const shortcuts = [
  { name: 'Edge', icon: appIcon('#0f7bd8', 'E') },
  { name: 'File Explorer', icon: appIcon('#e8a91c', 'F') },
  { name: 'Spotify', icon: appIcon('#1db954', 'S') },
  { name: 'VS Code', icon: appIcon('#2f80ed', 'C') },
];

await page.addInitScript(
  ({ lang, shortcuts }) => {
    window.__sent = [];
    const handlers = {};
    window.__emit = (ch, payload) => handlers[ch] && handlers[ch](payload);
    window.islandAPI = {
      settings: { lang, autoHide: 'never', position: 'center', islandMode: 'overlay' },
      call: (ch, ...args) => {
        window.__sent.push(['call', ch, ...args]);
        if (ch === 'media:caps') return Promise.resolve({ ok: true, next: true, prev: true, seek: true, toggle: true });
        if (ch === 'shortcuts:list') return Promise.resolve(shortcuts);
        if (ch === 'island:pointer-inside') return Promise.resolve(false);
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
  },
  { lang, shortcuts }
);

await page.goto('file://' + path.join(here, '..', 'src', 'renderer', 'index.html'));
// mock desktop: a wallpaper, and a browser window whose light tab strip sits under the island
await page.addStyleTag({
  content: `
  body { background: radial-gradient(120% 140% at 20% 0%, #3b2a6b 0%, #1d2440 45%, #0e1322 100%) !important; }
  #mock-browser { position: fixed; left: 40px; right: 40px; top: 0; bottom: -20px; border-radius: 0 0 12px 12px; background: #f6f6f8; box-shadow: 0 20px 60px rgba(0,0,0,.4); z-index: -1; display: none; }
  #mock-browser::before { content: ''; position: absolute; left: 0; right: 0; top: 0; height: 44px; background: #e9e9ee; border-bottom: 1px solid #d9d9df; }
  #mock-browser i { position: absolute; top: 60px; left: 30px; right: 30px; height: 12px; border-radius: 6px; background: #dedee4; box-shadow: 0 26px 0 #e6e6eb, 0 52px 0 #e6e6eb, 0 78px 0 #ececf0; }
  #label { position: fixed; left: 14px; bottom: 10px; font: 600 13px Segoe UI, Arial, sans-serif; color: rgba(255,255,255,.7); z-index: 5; }
`,
});
await page.evaluate(() => {
  const b = document.createElement('div');
  b.id = 'mock-browser';
  b.appendChild(document.createElement('i'));
  document.body.prepend(b);
  const l = document.createElement('div');
  l.id = 'label';
  document.body.appendChild(l);
});

let n = 0;
const label = (text) => page.evaluate((t) => (document.getElementById('label').textContent = t), text);
const shot = async (name, text, wait = 700) => {
  await label(text);
  await page.waitForTimeout(wait);
  await page.screenshot({ path: path.join(out, String(++n).padStart(2, '0') + '-' + name + '.png') });
};
const open = (id) => page.evaluate((x) => Island.open(x), id);
const close = async () => {
  await page.evaluate(() => Island.togglePin());
  await page.mouse.move(5, 340);
  await page.waitForTimeout(600);
};
const art =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff7a59"/><stop offset=".55" stop-color="#c2338a"/><stop offset="1" stop-color="#3a1c71"/></linearGradient></defs><rect width="200" height="200" fill="url(#g)"/><circle cx="140" cy="60" r="34" fill="#ffd36e" opacity=".9"/><path d="M0 150 Q60 110 110 140 T200 130 V200 H0Z" fill="#1b0f3a" opacity=".55"/></svg>'
  );
const media = (playing, position = 72) => ({
  type: 'media',
  active: true,
  title: 'Golden Hour',
  artist: 'Islandly Demo Band',
  playing,
  position,
  duration: 214,
  sentAt: Date.now(),
  trackChanged: false,
  thumb: art,
});

// 1. resting clock (auto-hide off) and the thin line
await shot('clock-compact', lang === 'ar' ? 'ساعة مصغّرة (الوضع الهادئ)' : 'Compact clock');
await page.evaluate(() => Island.configure({ autoHide: 'always' }));
await shot('sliver', lang === 'ar' ? 'خط رفيع (إخفاء تلقائي)' : 'Thin line (auto-hide)');
await page.evaluate(() => Island.configure({ autoHide: 'never' }));

// 2. camera + microphone indicator
await page.evaluate(() => window.__emit('privacy:update', { mic: ['Teams'], cam: ['Teams'] }));
await page.waitForTimeout(3800);
await shot('privacy-compact', lang === 'ar' ? 'مؤشر الكاميرا والمايك' : 'Camera + mic indicator');
await page.evaluate(() => window.__emit('privacy:update', { mic: [], cam: [] }));
await page.waitForTimeout(500);

// 3. music: compact, mini player, big player + lyrics strip
await page.evaluate((m) => window.__emit('media:update', { ...m, trackChanged: true }), media(true));
await shot('music-mini', lang === 'ar' ? 'موسيقى مصغّرة (مشغل صغير)' : 'Mini player', 900);
await page.waitForTimeout(3600);
await shot('music-compact', lang === 'ar' ? 'موسيقى: غلاف دائري + موجة صوت' : 'Music: round art + wave');
await page.evaluate(() =>
  window.__emit('lyrics:update', {
    status: 'ok',
    text: '',
    lines: [
      { at: 60, text: 'Light spills over the rooftops' },
      { at: 70, text: 'we chase the gold before it fades' },
      { at: 80, text: 'every second turning slower' },
    ],
  })
);
await open('music');
await shot('music-big-lyrics', lang === 'ar' ? 'المشغل الكبير + شريط رفيع + كلمات الأغنية' : 'Big player + lyrics', 1000);
await close();

// 4. clock panel with app shortcuts
await open('clock');
await shot('clock-panel', lang === 'ar' ? 'لوحة الساعة والتاريخ مع اختصارات التطبيقات' : 'Clock + date + shortcuts', 900);
await close();

// 5. timer: quick timer presets + custom, and a running stopwatch
await open('timer');
await page.evaluate(() => Island.feature('timer').setMode('quick'));
await shot('timer-quick', lang === 'ar' ? 'مؤقت: ٥/١٥/٣٠ دقيقة + مدة مخصصة' : 'Timer: 5/15/30 + custom', 900);
await page.evaluate(() => {
  const tm = Island.feature('timer');
  tm.setMode('stopwatch');
  tm.start();
});
await shot('stopwatch-panel', lang === 'ar' ? 'ساعة إيقاف تعمل' : 'Stopwatch running', 2200);
await close();
await shot('stopwatch-compact', lang === 'ar' ? 'ساعة الإيقاف مصغّرة' : 'Stopwatch compact');
await page.evaluate(() => Island.feature('timer').reset());

// 6. existing panels in the unified style
await page.evaluate((now) => {
  window.__emit('today:update', {
    weather: { temp: 31, code: 1, day: true, max: 36, min: 24 },
    prayer: {
      location: 'الرياض',
      today: ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'].map((name, i) => ({ name, time: now - 5 * 3600000 + i * 2.6 * 3600000 })),
      tomorrow: [],
    },
  });
}, Date.now());
await open('today');
await shot('today-panel', lang === 'ar' ? 'لوحة اليوم: الصلاة والطقس' : 'Today: prayers + weather', 900);
await close();
await page.evaluate(() =>
  window.__emit('clipboard:update', [
    { id: 1, text: 'https://github.com/waliddawood999-ctrl/islandly', type: 'url', pinned: true },
    { id: 2, text: '+966 55 123 4567', type: 'phone', digits: '+966551234567' },
    { id: 3, text: '450 * 1.15', type: 'math', result: 517.5 },
  ])
);
await open('clipboard');
await shot('clipboard-panel', lang === 'ar' ? 'الحافظة' : 'Clipboard', 900);
await close();
await open('battery');
await shot('battery-panel', lang === 'ar' ? 'البطارية' : 'Battery', 900);
await close();

// 7. "over the page" mode: the resting pill takes the tone of the page under it
await page.evaluate(() => {
  document.getElementById('mock-browser').style.display = 'block';
  Island.setTint({ r: 233, g: 233, b: 238 });
});
await shot('overlay-tint-light', lang === 'ar' ? 'وضع «فوق الصفحة»: الجزيرة تتلوّن مع الصفحة' : 'Over the page: tinted to match', 900);
await page.evaluate(() => {
  document.getElementById('mock-browser').style.background = '#0f0f12';
  Island.setTint({ r: 15, g: 15, b: 18 });
});
await shot('overlay-tint-dark', lang === 'ar' ? 'نفس الوضع فوق صفحة داكنة' : 'Over a dark page', 900);
await page.evaluate(() => {
  document.getElementById('mock-browser').style.display = 'none';
  Island.setTint(null);
});

// 8. a short sequence of transitions for the video: open, switch panels, close
await label(lang === 'ar' ? 'الحركة: فتح ← تبديل ← قفل' : 'Motion: open → switch → close');
await page.waitForTimeout(600);
for (const id of ['music', 'clock', 'timer', 'music']) {
  await open(id);
  await page.waitForTimeout(1100);
}
await close();
await page.waitForTimeout(900);
await page.evaluate((m) => window.__emit('media:update', { ...m, title: 'Night Drive', trackChanged: true }), media(true));
await page.waitForTimeout(1800);

// animation frame timing during one open/close cycle (renderer only, this machine)
const timing = await page.evaluate(async () => {
  const gaps = [];
  let last = performance.now();
  let run = true;
  const loop = (t) => {
    gaps.push(t - last);
    last = t;
    if (run) requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  Island.open('music');
  await new Promise((r) => setTimeout(r, 700));
  Island.togglePin();
  await new Promise((r) => setTimeout(r, 700));
  run = false;
  gaps.shift();
  gaps.sort((a, b) => a - b);
  const p = (q) => gaps[Math.min(gaps.length - 1, Math.floor(q * gaps.length))].toFixed(1);
  return {
    frames: gaps.length,
    median: p(0.5),
    p95: p(0.95),
    max: gaps[gaps.length - 1].toFixed(1),
    over20ms: gaps.filter((g) => g > 20).length,
    debug: Island.debug(),
  };
});

const video = page.video();
await context.close();
const vpath = await video.path();
fs.renameSync(vpath, path.join(out, 'transitions.webm'));
await browser.close();
console.log(
  'frame timing (ms):',
  JSON.stringify({ ...timing, debug: undefined }),
  'motion:',
  timing.debug.motion,
  'lastSpring(ms):',
  Math.round(timing.debug.stats.lastDuration)
);
console.log('shots:', n, 'errors:', errors.length ? errors : 'none');

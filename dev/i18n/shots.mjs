// T11 screenshots: every island panel and state, the settings window and the command palette, in Arabic and
// English, from the real renderer pages with a stand-in bridge and sample data.
//   node dev/i18n/shots.mjs     -> dev/i18n/shots/*.png (not committed) + dev/i18n/sheet-*.png via sheet.py
import { createRequire } from 'module';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(here, '..', '..', 'src');
const require = createRequire(process.env.PLAYWRIGHT_DIR || '/opt/node-tools/node_modules/');
const { chromium } = require('playwright');
const cities = createRequire(import.meta.url)('../../src/main/cities.js');
const out = path.join(here, 'shots');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

const art =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff7a59"/><stop offset=".55" stop-color="#c2338a"/><stop offset="1" stop-color="#3a1c71"/></linearGradient></defs><rect width="200" height="200" fill="url(#g)"/><circle cx="140" cy="60" r="34" fill="#ffd36e" opacity=".9"/></svg>'
  );

// Sample user content, in the language of the run (user text is shown as typed, isolated with dir=auto).
const SAMPLE = {
  ar: {
    track: { title: 'سورة الرحمن', artist: 'مشاري العفاسي' },
    meeting: 'اجتماع الفريق الأسبوعي',
    meeting2: 'Design review · مراجعة التصميم',
    clip: ['https://islandly.app/download', 'موعد التسليم يوم الخميس', '#7C5CFF', '120*3'],
    todos: ['أرسل التقرير لوليد', 'Review PR #4', 'اشترِ هدية العيد'],
    apps: ['Visual Studio Code', 'Microsoft Edge', 'واتساب', 'Spotify'],
    location: 'الرياض',
    gh: ['T11: واجهة عربية أولاً', 'Fix hover on Windows 11'],
    shelf: ['تقرير الربع الثالث.pdf', 'logo.png', 'صور الرحلة'],
    mic: ['Zoom', 'Teams'],
    workspace: 'الدراسة',
  },
  en: {
    track: { title: 'Golden Hour (Live)', artist: 'Islandly Demo Band' },
    meeting: 'Weekly team sync',
    meeting2: 'مراجعة التصميم · Design review',
    clip: ['https://islandly.app/download', 'Deadline is Thursday', '#7C5CFF', '120*3'],
    todos: ['Send the report to Walid', 'Review PR #4', 'Buy an Eid gift'],
    apps: ['Visual Studio Code', 'Microsoft Edge', 'WhatsApp', 'Spotify'],
    location: 'Riyadh',
    gh: ['T11: Arabic-first interface', 'Fix hover on Windows 11'],
    shelf: ['Q3 report.pdf', 'logo.png', 'Trip photos'],
    mic: ['Zoom', 'Teams'],
    workspace: 'Study',
  },
};

const browser = await chromium.launch({ args: ['--no-sandbox', '--allow-file-access-from-files'] });
const errors = [];
const network = [];
const shots = [];
const watch = (page) => {
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('request', (r) => !/^(file|data):/.test(r.url()) && network.push(r.url()));
};
const BG = 'body { background: linear-gradient(135deg, #2b2350, #141a2e) !important; }';

async function island(lang) {
  const S = SAMPLE[lang];
  const page = await browser.newPage({ viewport: { width: 600, height: 330 }, deviceScaleFactor: 2 });
  watch(page);
  const now = Date.now();
  const min = 60000;
  const data = {
    'today:get': {
      prayer: {
        location: S.location,
        // the next prayer (Asr) is 8 minutes away, so the countdown pill shows too
        today: [
          ['fajr', -560],
          ['sunrise', -470],
          ['dhuhr', -200],
          ['asr', 8],
          ['maghrib', 160],
          ['isha', 250],
        ].map(([name, m]) => ({ name, time: now + m * min })),
        tomorrow: [],
      },
      weather: { code: 1, temp: 31, max: 36, min: 24, day: true },
    },
    'calendar:get': {
      status: 'ok',
      events: [
        { id: 'a', title: S.meeting, start: now + 24 * min, end: now + 54 * min, url: 'https://meet.example/x' },
        { id: 'b', title: S.meeting2, start: now + 26 * 60 * min, end: now + 27 * 60 * min },
      ],
    },
    'clipboard:list': [
      { id: 1, type: 'url', text: S.clip[0], pinned: true },
      { id: 2, type: 'text', text: S.clip[1] },
      { id: 3, type: 'color', text: S.clip[2], color: S.clip[2] },
      { id: 4, type: 'math', text: S.clip[3], result: '360' },
    ],
    'shelf:list': S.shelf.map((name, i) => ({ id: i + 1, name, path: 'C:\\Users\\me\\' + name, isImage: name.endsWith('.png'), isDir: !name.includes('.') })),
    'notes:get': { todos: S.todos.map((text, i) => ({ id: i + 1, text, done: i === 1 })) },
    'usage:get': { total: 5 * 3600 + 22 * 60, apps: S.apps.map((name, i) => ({ name, seconds: [9000, 5400, 2700, 1220][i] })) },
    'github:get': {
      status: 'ok',
      items: S.gh.map((title, i) => ({ type: i ? 'Issue' : 'PullRequest', title, repo: 'waliddawood999-ctrl/islandly', url: 'https://github.com' })),
    },
    'shortcuts:list': ['Edge', 'File Explorer', 'Calculator', 'Notepad'].map((name) => ({ name })),
    'media:caps': { ok: true, next: true, prev: true, seek: true, toggle: true },
    'privacy:get': { mic: [], cam: [] },
  };
  await page.addInitScript(
    ({ lang, data }) => {
      const handlers = {};
      window.__emit = (ch, d) => handlers[ch] && handlers[ch](d);
      window.islandAPI = {
        settings: { uiLang: lang, lang, autoHide: 'never', material: 'glass', prayerAlerts: true, timeTracking: true },
        call: (ch) => Promise.resolve(data[ch] ?? null),
        send() {},
        on: (ch, cb) => (handlers[ch] = cb),
        pathsForFiles: () => [],
      };
      const battery = { level: 0.82, charging: true, chargingTime: 2400, dischargingTime: Infinity, addEventListener() {} };
      navigator.getBattery = () => Promise.resolve(battery);
    },
    { lang, data }
  );
  await page.goto('file://' + path.join(src, 'renderer', 'index.html'));
  await page.addStyleTag({ content: BG });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);

  const shot = async (name, prep) => {
    // peeks only show while no panel is pinned open
    if (/peek|mini|done|privacy|notice/.test(name)) await page.evaluate(() => Island.debug().pinned && Island.togglePin());
    await page.evaluate(prep);
    await page.waitForTimeout(900);
    const file = path.join(out, `island-${name}-${lang}.png`);
    const bottom = await page.evaluate(() =>
      Math.max(
        ...['#island', '#below']
          .map((s) => document.querySelector(s))
          .filter(Boolean)
          .map((e) => e.getBoundingClientRect().bottom)
      )
    );
    await page.screenshot({ path: file, clip: { x: 0, y: 0, width: 600, height: Math.min(330, Math.ceil(bottom) + 18) } });
    shots.push({ group: 'island', name, lang, file: path.basename(file) });
  };
  const media = { type: 'media', active: true, ...S.track, playing: true, position: 83, duration: 254, sentAt: Date.now(), trackChanged: true, thumb: art };

  await shot('prayer-pill', () => Island.render());
  await shot('today', () => Island.open('today'));
  await shot('clock', () => Island.open('clock'));
  await page.evaluate((m) => window.__emit('media:update', m), media);
  await shot('music-mini', () => Island.peek('music', 60000));
  await shot('music', () => Island.open('music'));
  await shot('timer', () => {
    const tm = Island.feature('timer');
    tm.setMode('quick');
    tm.setMinutes(15);
    Island.open('timer');
  });
  await shot('timer-done', () => {
    const tm = Island.feature('timer');
    tm.setMode('focus');
    tm.finish();
  });
  await shot('calendar', () => Island.open('calendar'));
  await shot('calendar-peek', () => Island.peek('calendar', 60000));
  await shot('clipboard', () => Island.open('clipboard'));
  await shot('shelf', () => Island.open('shelf'));
  await shot('notes', () => Island.open('notes'));
  await shot('battery', () => Island.open('battery'));
  await shot('system', () => {
    window.__emit('system:sample', { cpu: 23, memUsed: 9.4 * 1024 ** 3, memTotal: 16 * 1024 ** 3, uptime: 3 * 3600 + 25 * 60 });
    Island.open('system');
  });
  await shot('usage', () => Island.open('usage'));
  await shot('github', () => Island.open('github'));
  await shot('github-peek', () => {
    const g = Island.feature('github');
    g.set({
      ...g.state,
      fresh: [
        { title: 'a', repo: 'waliddawood999-ctrl/islandly' },
        { title: 'b', repo: 'waliddawood999-ctrl/islandly' },
        { title: 'c', repo: 'openjs/electron' },
      ],
    });
  });
  await shot('privacy', () => {
    window.__emit('privacy:update', { mic: ['Zoom', 'Teams'], cam: ['Zoom'] });
  });
  await shot('notice', () => Notice.show({ text: t('updateReady'), detail: t('updateReadySub', { v: '0.5.0' }), actionLabel: t('restartNow') }, 60000));
  await page.close();
}

async function settings(lang) {
  const page = await browser.newPage({ viewport: { width: 560, height: 900 }, deviceScaleFactor: 1.5 });
  watch(page);
  const list = Object.entries(cities).map(([key, c]) => ({ key, ar: c.ar, en: c.en }));
  await page.addInitScript(
    ({ lang, list }) => {
      window.settingsAPI = {
        get: () => ({
          uiLang: lang,
          lang,
          digits: 'latn',
          position: 'center',
          autoHide: 'auto',
          islandMode: 'overlay',
          material: 'acrylic',
          scale: 0.8,
          city: 'riyadh',
          prayerMethod: 'auto',
          madhab: 'shafi',
          breakEvery: 60,
          hideFullscreen: true,
          prayerAlerts: true,
          weather: true,
          timeTracking: true,
          micCamIndicator: true,
          clipboard: true,
          updates: true,
          hasAiKey: true,
          shortcuts: 'Edge, File Explorer, Calculator, Notepad',
        }),
        set: () => Promise.resolve(),
        info: () => Promise.resolve({ version: '0.5.0' }),
        cities: () => list,
        material: () => Promise.resolve({ supported: true }),
        setSecret: () => Promise.resolve(),
        checkUpdate: () => Promise.resolve({ status: 'up-to-date' }),
        quit() {},
      };
    },
    { lang, list }
  );
  await page.goto('file://' + path.join(src, 'settings', 'index.html'));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  const file = path.join(out, `settings-${lang}.png`);
  await page.screenshot({ path: file, fullPage: true });
  shots.push({ group: 'settings', name: 'settings', lang, file: path.basename(file) });
  await page.close();
}

async function palette(lang) {
  const S = SAMPLE[lang];
  const page = await browser.newPage({ viewport: { width: 680, height: 420 }, deviceScaleFactor: 2, bypassCSP: true });
  watch(page);
  await page.addInitScript(
    ({ lang, S }) => {
      const results = [
        { kind: 'copy', title: '360', sub: '120 × 3', icon: 'calc' },
        { kind: 'timer', title: '25', icon: 'timer' },
        { kind: 'workspace', title: S.workspace, sub: 'classroom.google.com · Word', icon: 'grid' },
        { kind: 'app', title: 'Visual Studio Code', sub: 'app', icon: 'app' },
        { kind: 'ai', question: '120*3', needsKey: false, title: '120*3', icon: 'spark' },
        { kind: 'hint', title: 'hintAi', icon: 'spark' },
      ];
      window.paletteAPI = { settings: { uiLang: lang, lang }, call: async (ch) => (ch === 'palette:query' ? results : null), send() {}, on() {} };
    },
    { lang, S }
  );
  await page.goto('file://' + path.join(src, 'palette', 'index.html'));
  await page.addStyleTag({ content: BG });
  await page.fill('#q', '120*3');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(700);
  const file = path.join(out, `palette-${lang}.png`);
  await page.screenshot({ path: file });
  shots.push({ group: 'palette', name: 'palette', lang, file: path.basename(file) });
  await page.close();
}

for (const lang of ['ar', 'en']) {
  await island(lang);
  await settings(lang);
  await palette(lang);
}
await browser.close();
fs.writeFileSync(path.join(out, 'shots.json'), JSON.stringify(shots, null, 1));
console.log(`shots: ${shots.length}`);
console.log('network requests:', network.length ? network : 'none');
console.log('errors:', errors.length ? errors : 'none');

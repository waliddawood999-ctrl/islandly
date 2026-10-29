// T12 screenshots: every prayer/Ramadan/Hijri/Quran state in Arabic and English, from the real renderer with
// a stand-in bridge whose data has exactly the T10 contract shapes (PR #12):
//   prayer:get / prayer:state, hijri:get, quran:reciters, quran:url, media:resume.
//   node dev/islamic/shots.mjs    -> dev/islamic/shots/*.png (not committed) + sheet via dev/i18n/sheet.py style
import { createRequire } from 'module';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(here, '..', '..', 'src');
const require = createRequire(process.env.PLAYWRIGHT_DIR || '/opt/node-tools/node_modules/');
const { chromium } = require('playwright');
const out = path.join(here, 'shots');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

const MIN = 60000;
const now = Date.now();
const asr = { name: 'asr', time: now + 8 * MIN };
// T10 shapes, field for field
const PRAYER = {
  pre: { next: asr, current: null, phase: 'pre', phaseEndsAt: asr.time, ramadan: false, imsak: null, iftar: null, pausedByAdhan: false },
  adhan: {
    next: { name: 'maghrib', time: now + 150 * MIN },
    current: { name: 'asr', time: now - 30000 },
    phase: 'adhan',
    phaseEndsAt: now + 90000,
    ramadan: false,
    imsak: null,
    iftar: null,
    pausedByAdhan: false,
  },
  paused: {
    next: { name: 'maghrib', time: now + 150 * MIN },
    current: { name: 'asr', time: now - 60000 },
    phase: 'adhan',
    phaseEndsAt: now + 60000,
    ramadan: false,
    imsak: null,
    iftar: null,
    pausedByAdhan: true,
  },
  iqama: {
    next: { name: 'maghrib', time: now + 140 * MIN },
    current: { name: 'asr', time: now - 8 * MIN },
    phase: 'iqama',
    phaseEndsAt: now + 12 * MIN,
    ramadan: false,
    imsak: null,
    iftar: null,
    pausedByAdhan: false,
  },
  iftar: {
    next: { name: 'maghrib', time: now + 42 * MIN },
    current: null,
    phase: 'idle',
    phaseEndsAt: null,
    ramadan: true,
    imsak: now + 12 * 60 * MIN,
    iftar: now + 42 * MIN,
    pausedByAdhan: false,
  },
};
const HIJRI = { day: 15, month: 9, year: 1448, monthNameAr: 'رمضان', monthNameEn: 'Ramadan', occasion: { id: 'ramadan', ar: 'رمضان', en: 'Ramadan' } };
const RECITERS = [
  {
    id: 123,
    nameAr: 'مشاري العفاسي',
    nameEn: 'Mishary Alafasy',
    moshaf: [{ id: 1, name: 'حفص عن عاصم - مرتل', server: 'https://server8.mp3quran.net/afs/', surahList: Array.from({ length: 114 }, (_, i) => i + 1) }],
  },
  {
    id: 54,
    nameAr: 'عبدالرحمن السديس',
    nameEn: 'Abdulrahman Al-Sudais',
    moshaf: [{ id: 2, name: 'حفص عن عاصم - مرتل', server: 'https://server11.mp3quran.net/sds/', surahList: Array.from({ length: 114 }, (_, i) => i + 1) }],
  },
  {
    id: 92,
    nameAr: 'ياسر الدوسري',
    nameEn: 'Yasser Al-Dosari',
    moshaf: [{ id: 3, name: 'حفص عن عاصم - مرتل', server: 'https://server11.mp3quran.net/yasser/', surahList: Array.from({ length: 114 }, (_, i) => i + 1) }],
  },
];

const browser = await chromium.launch({ args: ['--no-sandbox', '--allow-file-access-from-files'] });
const errors = [];
const network = [];
const shots = [];
const watch = (page) => {
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('request', (r) => !/^(file|data):/.test(r.url()) && network.push(r.url()));
};

async function island(lang) {
  const page = await browser.newPage({ viewport: { width: 600, height: 480 }, deviceScaleFactor: 2, bypassCSP: true });
  watch(page);
  const sched = {
    location: lang === 'ar' ? 'الرياض' : 'Riyadh',
    today: [
      ['fajr', -560],
      ['sunrise', -470],
      ['dhuhr', -200],
      ['asr', 8],
      ['maghrib', 160],
      ['isha', 250],
    ].map(([name, m]) => ({ name, time: now + m * MIN })),
    tomorrow: [],
  };
  await page.addInitScript(
    ({ lang, PRAYER, HIJRI, RECITERS, sched }) => {
      const handlers = {};
      window.__emit = (ch, d) => handlers[ch] && handlers[ch](d);
      window.__calls = [];
      const data = {
        'prayer:get': PRAYER.pre,
        'hijri:get': HIJRI,
        'quran:reciters': RECITERS,
        'today:get': { prayer: sched, weather: { code: 0, temp: 31, max: 36, min: 24, day: true } },
        'media:resume': { ok: true },
      };
      window.islandAPI = {
        settings: {
          uiLang: lang,
          lang,
          autoHide: 'never',
          material: 'glass',
          prayerActivity: true,
          hijriOccasions: true,
          quranEnabled: true,
          quranVolume: 0.8,
        },
        call: (ch, ...args) => {
          window.__calls.push(ch);
          if (ch === 'quran:url') return Promise.resolve(`https://server8.mp3quran.net/afs/${String(args[2]).padStart(3, '0')}.mp3`);
          return Promise.resolve(data[ch] ?? null);
        },
        send() {},
        on: (ch, cb) => (handlers[ch] = cb),
        pathsForFiles: () => [],
      };
    },
    { lang, PRAYER, HIJRI, RECITERS, sched }
  );
  await page.goto('file://' + path.join(src, 'renderer', 'index.html'));
  await page.addStyleTag({ content: 'body { background: linear-gradient(135deg, #2b2350, #141a2e) !important; }' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
  // nothing Quran-related may be asked for before the panel is opened
  const early = await page.evaluate(() => window.__calls.filter((c) => c.startsWith('quran:')));
  if (early.length) errors.push('quran requested before the panel opened: ' + early.join(','));

  const shot = async (name, prep, arg) => {
    await page.evaluate(() => Island.debug().pinned && Island.togglePin());
    await page.evaluate(prep, arg);
    await page.waitForTimeout(900);
    const bottom = await page.evaluate(() =>
      Math.max(
        ...['#island', '#below']
          .map((s) => document.querySelector(s))
          .filter(Boolean)
          .map((e) => e.getBoundingClientRect().bottom)
      )
    );
    const file = path.join(out, `island-${name}-${lang}.png`);
    await page.screenshot({ path: file, clip: { x: 0, y: 0, width: 600, height: Math.min(480, Math.ceil(bottom) + 18) } });
    shots.push({ group: 'island', name, lang, file: path.basename(file) });
  };
  const state = (s) => window.__emit('prayer:state', s);
  await shot('pre-adhan', state, PRAYER.pre);
  await shot('adhan', state, PRAYER.adhan);
  await shot('adhan-peek', () => Island.peek('prayer', 60000));
  await shot('paused-resume', state, PRAYER.paused);
  await shot('iqama', state, PRAYER.iqama);
  await shot('ramadan-iftar', state, PRAYER.iftar);
  await shot('today-ramadan', () => Island.open('today'));
  await shot('clock-hijri', () => Island.open('clock'));
  await shot('quran', () => Island.open('quran'));
  await shot('quran-surahs', () => {
    Island.open('quran');
    Island.feature('quran').toggleList('surahs');
  });
  await page.close();
}

async function settings(lang) {
  const page = await browser.newPage({ viewport: { width: 560, height: 900 }, deviceScaleFactor: 1.5 });
  watch(page);
  await page.addInitScript((lang) => {
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
        prayerActivity: true,
        prayerPreMinutes: 10,
        prayerIqamaMinutes: { fajr: 25, dhuhr: 20, asr: 20, maghrib: 10, isha: 20 },
        prayerAutoPause: true,
        ramadanMode: 'auto',
        hijriOccasions: true,
        quranEnabled: true,
        quranVolume: 0.8,
      }),
      set: () => Promise.resolve(),
      info: () => Promise.resolve({ version: '0.5.0' }),
      cities: () => [{ key: 'riyadh', ar: 'الرياض', en: 'Riyadh' }],
      setSecret: () => Promise.resolve(),
      checkUpdate: () => Promise.resolve({ status: 'up-to-date' }),
      quit() {},
    };
  }, lang);
  await page.goto('file://' + path.join(src, 'settings', 'index.html'));
  await page.evaluate(() => document.fonts.ready);
  const el = await page.$('#iqamaGrid');
  const section = await el.evaluateHandle((e) => e.closest('section'));
  const file = path.join(out, `settings-islamic-${lang}.png`);
  await section.screenshot({ path: file });
  shots.push({ group: 'settings', name: 'settings-islamic', lang, file: path.basename(file) });
  await page.close();
}

for (const lang of ['ar', 'en']) {
  await island(lang);
  await settings(lang);
}
await browser.close();
fs.writeFileSync(path.join(out, 'shots.json'), JSON.stringify(shots, null, 1));
console.log(`shots: ${shots.length}`);
console.log('network requests:', network.length ? network : 'none');
console.log('errors:', errors.length ? errors : 'none');

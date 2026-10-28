// Font pairing comparison (T8): the island in each pairing, in Arabic and English, in three states, plus
// a check that no font (or anything else) is requested from the network.
//   node dev/fonts/compare.mjs            -> dev/fonts/compare/*.png and compare-sheet.png
import { createRequire } from 'module';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(process.env.PLAYWRIGHT_DIR || '/opt/node-tools/node_modules/');
const { chromium } = require('playwright');
const out = path.join(here, 'compare');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

const PAIRINGS = {
  plex: 'IBM Plex Sans Arabic + IBM Plex Sans',
  manrope: 'Readex Pro + Manrope',
  jakarta: 'Alexandria + Plus Jakarta Sans',
};
const art =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff7a59"/><stop offset=".55" stop-color="#c2338a"/><stop offset="1" stop-color="#3a1c71"/></linearGradient></defs><rect width="200" height="200" fill="url(#g)"/><circle cx="140" cy="60" r="34" fill="#ffd36e" opacity=".9"/></svg>'
  );

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const network = [];
const fontsLoaded = {};
const errors = [];
const W = 560;
const H = 230;
const shots = [];

for (const [id, label] of Object.entries(PAIRINGS)) {
  for (const lang of ['ar', 'en']) {
    const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
    page.on('request', (r) => {
      const u = r.url();
      if (!u.startsWith('file:') && !u.startsWith('data:')) network.push(u);
      if (/\.woff2$/.test(u)) (fontsLoaded[id + '/' + lang] ||= new Set()).add(path.basename(path.dirname(u)) + '/' + path.basename(u));
    });
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.addInitScript(
      ({ lang, id }) => {
        const handlers = {};
        window.__emit = (ch, d) => handlers[ch] && handlers[ch](d);
        window.islandAPI = {
          settings: { lang, autoHide: 'never', fontPairing: id, material: 'glass' },
          call: (ch) => Promise.resolve(ch === 'media:caps' ? { ok: true, next: true, prev: true, seek: true, toggle: true } : null),
          send() {},
          on: (ch, cb) => (handlers[ch] = cb),
          pathsForFiles: () => [],
        };
      },
      { lang, id }
    );
    await page.goto('file://' + path.join(here, '..', '..', 'src', 'renderer', 'index.html'));
    if (id !== 'plex') await page.addStyleTag({ url: 'file://' + path.join(here, id, 'fonts.css') });
    await page.addStyleTag({ content: 'body { background: linear-gradient(135deg, #2b2350, #141a2e) !important; }' });
    const media = {
      type: 'media',
      active: true,
      title: lang === 'ar' ? 'سورة الرحمن · Live 2026' : 'Golden Hour (Live in Riyadh)',
      artist: lang === 'ar' ? 'مشاري العفاسي — Islandly' : 'Islandly Demo Band · فرقة الجزيرة',
      playing: true,
      position: 83,
      duration: 254,
      sentAt: Date.now(),
      trackChanged: true,
      thumb: art,
    };
    const shot = async (state) => {
      await page.waitForTimeout(900);
      await page.evaluate(() => document.fonts.ready);
      const file = path.join(out, `${id}-${lang}-${state}.png`);
      await page.screenshot({ path: file });
      shots.push({ id, label, lang, state, file });
    };
    // 1. resting: the clock pill (digits, tabular)
    await shot('compact');
    // 2. mini player: title and artist mixing Arabic and Latin
    await page.evaluate((m) => window.__emit('media:update', m), media);
    await shot('mini');
    // 3. big player
    await page.evaluate(() => Island.open('music'));
    await shot('player');
    await page.close();
  }
}
await browser.close();

// font bytes actually loaded per pairing (both languages)
const sizes = {};
for (const [key, set] of Object.entries(fontsLoaded)) {
  const id = key.split('/')[0];
  sizes[id] ||= new Set();
  for (const f of set) sizes[id].add(f);
}
const fontDir = (id) => (id === 'plex' ? path.join(here, '..', '..', 'assets', 'fonts', 'plex') : path.join(here, id));
const report = Object.fromEntries(
  Object.entries(sizes).map(([id, set]) => [id, { files: [...set].sort(), kb: Math.round([...set].reduce((n, f) => n + fs.statSync(path.join(fontDir(id), path.basename(f))).size, 0) / 1024) }])
);
fs.writeFileSync(path.join(out, 'shots.json'), JSON.stringify(shots.map(({ file, ...s }) => ({ ...s, file: path.basename(file) })), null, 1));
console.log('fonts loaded:', JSON.stringify(report));
console.log('network requests:', network.length ? network : 'none');
console.log('errors:', errors.length ? errors : 'none');

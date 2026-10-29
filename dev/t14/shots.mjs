// T14 visual QA: the Performance and power section of Settings and the island with the motion setting applied,
// from the real renderer pages with stand-in bridges, in Arabic RTL and English LTR, overlay and AppBar modes.
// Also runs a layout audit (no overflow, clipping or overlapping boxes) and counts running infinite animations.
//   node dev/t14/shots.mjs      -> dev/t14/shots/*.png (not committed) and a report on stdout
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

const browser = await chromium.launch({ args: ['--no-sandbox', '--allow-file-access-from-files'] });
const errors = [];
const network = [];
const problems = [];
const watch = (page) => {
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('request', (r) => !/^(file|data):/.test(r.url()) && network.push(r.url()));
};

// perf:get shapes (HANDOFF §2.3). While Settings is open the Electron windows are part of the total.
const proc = (type, mb, cpu, label = null) => ({ type, pid: 1000 + mb, mb, cpu, label });
const SNAP = {
  idle: { totalMB: 342.6, powershellCount: 0, uptimeSec: 754, processes: [proc('browser', 112.4, 0.1), proc('renderer', 98.7, 0.2, 'settings'), proc('gpu', 71.3, 0), proc('utility', 41.9, 0), proc('other', 18.3, 0.1)] },
  busy: { totalMB: 1204.8, powershellCount: 2, uptimeSec: 5 * 3600 + 21 * 60, processes: [proc('browser', 183.5, 1.6), proc('renderer', 301.2, 2.4, 'island'), proc('renderer', 128.0, 0.4, 'settings'), proc('renderer', 96.1, 0.3, 'palette'), proc('gpu', 238.9, 1.1), proc('utility', 62.4, 0), proc('powershell', 58.3, 0.2), proc('powershell', 56.0, 0), proc('other', 80.4, 0.2)] },
};
const SCENARIOS = {
  // name: [settings, eco effective, snapshot]
  idle: [{ ecoMode: false, ecoAuto: false, motion: 'full' }, false, 'idle'],
  eco: [{ ecoMode: true, ecoAuto: false, motion: 'reduced' }, true, 'busy'],
  battery: [{ ecoMode: false, ecoAuto: true, motion: 'full' }, true, 'idle'],
  off: [{ ecoMode: false, ecoAuto: true, motion: 'off' }, false, 'busy'],
  wait: [{ ecoMode: false, ecoAuto: false, motion: 'full' }, false, null],
};

async function settings(lang, mode, scenario, extra = {}) {
  const [conf, eco, snap] = SCENARIOS[scenario];
  const list = Object.entries(cities).map(([key, c]) => ({ key, ar: c.ar, en: c.en }));
  const page = await browser.newPage({ viewport: { width: 480, height: 680 }, deviceScaleFactor: 2 });
  watch(page);
  await page.addInitScript(
    ({ lang, mode, conf, eco, snap, list, extra }) => {
      const handlers = {};
      window.__emit = (ch, d) => handlers[ch] && handlers[ch](d);
      window.__sent = [];
      window.settingsAPI = {
        get: () => ({ uiLang: lang, lang, digits: 'latn', position: 'center', autoHide: 'auto', islandMode: mode, material: 'acrylic', scale: 0.8, city: 'riyadh', prayerMethod: 'auto', madhab: 'shafi', breakEvery: 60, hideFullscreen: true, prayerAlerts: true, weather: true, timeTracking: true, micCamIndicator: true, clipboard: true, updates: true, hasAiKey: true, shortcuts: 'Edge, File Explorer, Calculator, Notepad', ...conf, ...extra }),
        set: (patch) => (window.__sent.push(patch), Promise.resolve()),
        send: (ch, v) => window.__sent.push([ch, v]),
        on: (ch, cb) => ((handlers[ch] = cb), () => delete handlers[ch]),
        perf: () => Promise.resolve(snap),
        info: () => Promise.resolve({ version: '0.5.0' }),
        cities: () => list,
        material: () => Promise.resolve({ supported: true }),
        setSecret: () => Promise.resolve(),
        checkUpdate: () => Promise.resolve({ status: 'up-to-date' }),
        quit() {},
      };
    },
    { lang, mode, conf, eco, snap: snap ? SNAP[snap] : null, list, extra }
  );
  await page.goto('file://' + path.join(src, 'settings', 'index.html'));
  await page.evaluate(() => document.fonts.ready);
  // main sends eco:changed after the window has loaded (HANDOFF §2.5)
  if (eco) await page.evaluate(() => window.__emit('eco:changed', { eco: true }));
  await page.waitForTimeout(700);
  const name = `settings-${scenario}-${lang}-${mode}${extra.digits ? '-' + extra.digits + 'digits' : ''}`;
  await page.locator('#perf').screenshot({ path: path.join(out, name + '.png') });
  if (scenario === 'idle' && !Object.keys(extra).length) await page.screenshot({ path: path.join(out, `settings-full-${lang}-${mode}.png`), fullPage: true });

  // --- layout audit
  const audit = await page.evaluate(() => {
    const bad = [];
    const sec = document.querySelector('#perf').getBoundingClientRect();
    const doc = document.documentElement;
    if (doc.scrollWidth > doc.clientWidth) bad.push(`page scrolls horizontally (${doc.scrollWidth} > ${doc.clientWidth})`);
    const inside = (r, within) => r.left >= within.left - 0.5 && r.right <= within.right + 0.5;
    for (const el of document.querySelectorAll('#perf *')) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      if (el.matches('input[type=checkbox],input[type=radio]')) continue; // invisible hit areas
      if (!inside(r, sec)) bad.push(`outside section: ${el.tagName}.${el.className} ${el.textContent.slice(0, 20)}`);
      if (el.children.length === 0 && el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).textOverflow !== 'ellipsis') bad.push(`text clipped: ${el.textContent.slice(0, 30)}`);
      if (el.matches('.ram-name') && el.scrollWidth > el.clientWidth + 1) bad.push(`process name truncated: ${el.textContent}`);
    }
    // siblings of every flex/grid row must not intersect
    for (const row of document.querySelectorAll('#perf .opt, #perf .ram-rows li, #perf .ram-head, #perf .ram-total, #perf .seg')) {
      const kids = [...row.children].filter((k) => !k.matches('input') && k.getBoundingClientRect().width);
      for (let i = 0; i < kids.length; i++)
        for (let j = i + 1; j < kids.length; j++) {
          const a = kids[i].getBoundingClientRect();
          const b = kids[j].getBoundingClientRect();
          if (a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5) bad.push(`overlap in ${row.className}: ${kids[i].className} / ${kids[j].className}`);
        }
    }
    // vertical rhythm: direct blocks of the section keep a visible gap
    const blocks = [...document.querySelectorAll('#perf > *')].filter((k) => k.getBoundingClientRect().height);
    for (let i = 1; i < blocks.length; i++) if (blocks[i].getBoundingClientRect().top < blocks[i - 1].getBoundingClientRect().bottom - 0.5) bad.push('blocks overlap vertically: ' + blocks[i].className);
    const infinite = document.getAnimations().filter((a) => a.effect && a.effect.getComputedTiming().iterations === Infinity).length;
    return { bad, dir: doc.dir, motion: doc.dataset.motion, infinite, ramRows: document.querySelectorAll('.ram-rows li').length };
  });
  for (const b of audit.bad) problems.push(`${name}: ${b}`);
  await page.close();
  return { name, ...audit };
}

// ---- island with the motion setting applied
const art = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff7a59"/><stop offset="1" stop-color="#3a1c71"/></linearGradient></defs><rect width="200" height="200" fill="url(#g)"/></svg>');
async function island(lang, mode, motion, eco) {
  const page = await browser.newPage({ viewport: { width: 600, height: 330 }, deviceScaleFactor: 2 });
  watch(page);
  const now = Date.now();
  const min = 60000;
  const data = {
    'today:get': { prayer: { location: lang === 'ar' ? 'الرياض' : 'Riyadh', today: [['fajr', -560], ['sunrise', -470], ['dhuhr', -200], ['asr', 8], ['maghrib', 160], ['isha', 250]].map(([n, m]) => ({ name: n, time: now + m * min })), tomorrow: [] }, weather: { code: 1, temp: 31, max: 36, min: 24, day: true } },
    'media:caps': { ok: true, next: true, prev: true, seek: true, toggle: true },
  };
  await page.addInitScript(
    ({ lang, mode, motion, eco, data }) => {
      const handlers = {};
      window.__emit = (ch, d) => handlers[ch] && handlers[ch](d);
      window.islandAPI = { settings: { uiLang: lang, lang, autoHide: 'never', material: 'glass', islandMode: mode, motion, ecoMode: eco, prayerAlerts: true }, call: (ch) => Promise.resolve(data[ch] ?? null), send() {}, on: (ch, cb) => (handlers[ch] = cb), pathsForFiles: () => [] };
      navigator.getBattery = () => Promise.resolve({ level: 0.82, charging: true, chargingTime: 2400, dischargingTime: Infinity, addEventListener() {} });
    },
    { lang, mode, motion, eco, data }
  );
  await page.goto('file://' + path.join(src, 'renderer', 'index.html'));
  await page.addStyleTag({ content: 'body { background: linear-gradient(135deg, #2b2350, #141a2e) !important; }' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  if (mode === 'overlay') await page.evaluate(() => window.__emit('surface:tint', { r: 236, g: 236, b: 240 }));
  const tag = `${lang}-${mode}-${motion}${eco ? '-eco' : ''}`;
  const audit = [];
  const snap = async (name, prep) => {
    await page.evaluate(prep);
    await page.waitForTimeout(900);
    const r = await page.evaluate(() => {
      const els = ['#island', '#below'].map((s) => document.querySelector(s)).filter(Boolean).map((e) => e.getBoundingClientRect());
      const isl = document.querySelector('#island').getBoundingClientRect();
      // the blurred album-art backdrop (.m-bg) is meant to bleed past the pill and is clipped by it
      const outside = (e) => { if (e.matches('.m-bg')) return false; const b = e.getBoundingClientRect(); return b.width && (b.left < isl.left - 1 || b.right > isl.right + 1 || b.bottom > isl.bottom + 1 || b.top < isl.top - 1); };
      const who = [...document.querySelectorAll('#island .view *')].filter(outside).map((e) => e.tagName + '.' + e.className);
      const clipped = who.length;
      return { bottom: Math.max(...els.map((b) => b.bottom)), clipped, who, infinite: document.getAnimations().filter((a) => a.effect && a.effect.getComputedTiming().iterations === Infinity).length, dm: document.documentElement.dataset.motion };
    });
    audit.push({ name, ...r });
    if (r.clipped) problems.push(`island-${name}-${tag}: outside the pill: ${r.who.join(', ')}`);
    await page.screenshot({ path: path.join(out, `island-${name}-${tag}.png`), clip: { x: 0, y: 0, width: 600, height: Math.min(330, Math.ceil(r.bottom) + 18) } });
  };
  await snap('clock', () => Island.render());
  await page.evaluate((m) => window.__emit('media:update', m), { type: 'media', active: true, title: lang === 'ar' ? 'سورة الرحمن' : 'Golden Hour (Live)', artist: lang === 'ar' ? 'مشاري العفاسي' : 'Islandly Demo Band', playing: true, position: 83, duration: 254, sentAt: Date.now(), trackChanged: true, thumb: art });
  await snap('music', () => Island.open('music'));
  await snap('today', () => Island.open('today'));
  await page.close();
  return { tag, audit };
}

const report = [];
for (const lang of ['ar', 'en'])
  for (const mode of ['overlay', 'appbar']) {
    for (const sc of Object.keys(SCENARIOS)) report.push(await settings(lang, mode, sc));
    if (lang === 'ar' && mode === 'overlay') report.push(await settings(lang, mode, 'eco', { digits: 'arab' }));
  }
const islands = [];
for (const lang of ['ar', 'en'])
  for (const mode of ['overlay', 'appbar']) {
    islands.push(await island(lang, mode, 'full', false));
    islands.push(await island(lang, mode, 'reduced', false));
    islands.push(await island(lang, mode, 'off', false));
    islands.push(await island(lang, mode, 'full', true));
  }
console.log('SETTINGS');
for (const r of report) console.log(`  ${r.name.padEnd(34)} dir=${r.dir} motion=${r.motion} infiniteAnims=${r.infinite} rows=${r.ramRows} issues=${r.bad.length}`);
console.log('ISLAND (running infinite animations per state)');
for (const r of islands) console.log(`  ${r.tag.padEnd(24)} ` + r.audit.map((a) => `${a.name}:${a.infinite}${a.clipped ? '!' : ''}[${a.dm}]`).join('  '));
console.log('page errors:', errors.length ? errors : 'none');
console.log('network requests outside file/data:', network.length ? network : 'none');
console.log('LAYOUT PROBLEMS:', problems.length ? '\n  ' + problems.join('\n  ') : 'none');
await browser.close();
process.exit(problems.length || errors.length ? 1 : 0);

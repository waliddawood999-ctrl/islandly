// T19 visual QA: Settings (navigator, switches, segmented choices, live preview, "Saved" toast), the island tab dots and the
// command palette, from the real pages with stand-in bridges, in Arabic RTL and English LTR, overlay and AppBar modes.
// A layout audit fails on overflow, clipping or overlapping boxes. Not committed: dev/t19/shots (see dev/t19/sheets).
//   node dev/t19/shots.mjs
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

const proc = (type, mb, cpu, label = null) => ({ type, pid: 1000 + mb, mb, cpu, label });
const SNAP = { totalMB: 342.6, powershellCount: 0, uptimeSec: 754, processes: [proc('browser', 112.4, 0.1), proc('renderer', 98.7, 0.2, 'settings'), proc('gpu', 71.3, 0), proc('utility', 41.9, 0), proc('other', 18.3, 0.1)] };

// Only the user-visible boxes of one container are audited: nothing outside it, no clipped text, no overlapping siblings.
const AUDIT = () => {
  const bad = [];
  const doc = document.documentElement;
  if (doc.scrollWidth > doc.clientWidth) bad.push(`page scrolls horizontally (${doc.scrollWidth} > ${doc.clientWidth})`);
  const hit = (a, b) => a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
  for (const el of document.querySelectorAll('section *, .top *')) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height || el.closest('[hidden]') || el.matches('input[type=checkbox],input[type=radio]')) continue;
    if (r.left < -0.5 || r.right > doc.clientWidth + 0.5) {
      if (!el.closest('.nav')) bad.push(`outside window: ${el.tagName}.${el.className} ${el.textContent.slice(0, 20)}`);
    }
    if (el.children.length === 0 && el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).textOverflow !== 'ellipsis' && !el.closest('.nav')) bad.push(`text clipped: ${el.textContent.slice(0, 30)}`);
  }
  // rows whose children sit side by side must not intersect
  for (const row of document.querySelectorAll('.opt, label.check, .seg, .ram-rows li, .pv-pill, .row, .nav')) {
    const kids = [...row.children].filter((k) => !k.matches('input') && k.getBoundingClientRect().width);
    for (let i = 0; i < kids.length; i++)
      for (let j = i + 1; j < kids.length; j++) if (hit(kids[i].getBoundingClientRect(), kids[j].getBoundingClientRect())) bad.push(`overlap in ${row.className}: ${kids[i].className || kids[i].tagName} / ${kids[j].className || kids[j].tagName}`);
  }
  // preview: the pill must sit inside the mock desktop and its text inside the pill
  const pill = document.querySelector('.pv-pill');
  if (pill) {
    const d = document.querySelector('.pv-desk').getBoundingClientRect();
    const p = pill.getBoundingClientRect();
    if (p.left < d.left || p.right > d.right || p.top < d.top) bad.push('preview pill leaves the mock desktop');
    const t = document.querySelector('#pvTime').getBoundingClientRect();
    if (t.right > p.right || t.left < p.left) bad.push('preview time leaves the pill');
  }
  // the sticky header must not cover a section title at rest (scrollTop 0)
  const secs = [...document.querySelectorAll('section')].filter((s) => s.getBoundingClientRect().height);
  for (let i = 1; i < secs.length; i++) if (secs[i].getBoundingClientRect().top < secs[i - 1].getBoundingClientRect().bottom - 0.5) bad.push('sections overlap vertically: ' + secs[i].id);
  // a navigator chip is a single line
  for (const a of document.querySelectorAll('.nav a')) if (a.getBoundingClientRect().height > 40) bad.push('nav chip wraps: ' + a.textContent);
  return bad;
};

async function settings(lang, mode, extra = {}, tag = '') {
  const list = Object.entries(cities).map(([key, c]) => ({ key, ar: c.ar, en: c.en }));
  const page = await browser.newPage({ viewport: { width: 480, height: 680 }, deviceScaleFactor: 2 });
  watch(page);
  await page.addInitScript(
    ({ lang, mode, list, extra, snap }) => {
      const handlers = {};
      window.__emit = (ch, d) => handlers[ch] && handlers[ch](d);
      window.__sent = [];
      window.settingsAPI = {
        get: () => ({ uiLang: lang, lang, digits: 'latn', position: 'center', autoHide: 'auto', islandMode: mode, material: 'acrylic', scale: 0.8, city: 'riyadh', prayerMethod: 'auto', madhab: 'shafi', breakEvery: 60, hideFullscreen: true, prayerAlerts: true, weather: true, timeTracking: true, micCamIndicator: true, clipboard: true, updates: true, hasAiKey: true, shortcuts: 'Edge, File Explorer, Calculator, Notepad', motion: 'full', ...extra }),
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
    { lang, mode, list, extra, snap: SNAP }
  );
  await page.goto('file://' + path.join(src, 'settings', 'index.html'));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
  const name = `settings-${lang}-${mode}${tag}`;
  const check = async (label) => {
    const bad = await page.evaluate(AUDIT);
    for (const b of bad) problems.push(`${name} ${label}: ${b}`);
  };
  await page.screenshot({ path: path.join(out, `${name}-top.png`) });
  await check('top');
  // jump to Appearance through the navigator, as a user would
  await page.locator('.nav a').nth(1).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(out, `${name}-appearance.png`) });
  const state = await page.evaluate(() => ({ current: document.querySelector('.nav a[aria-current=true]')?.textContent, scrollTop: Math.round(scrollY), navTop: document.querySelector('.top').getBoundingClientRect().top }));
  if (state.navTop !== 0) problems.push(`${name}: sticky header moved (${state.navTop})`);
  if (!state.current) problems.push(`${name}: no current chip after jump`);
  await check('appearance');
  // change a segmented choice and a switch: the change reaches the bridge, the toast shows, the preview follows
  await page.locator('.seg.field').first().locator('label').nth(1).click();
  await page.locator('label.check').first().click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(out, `${name}-saved.png`) });
  const sent = await page.evaluate(() => ({ sent: window.__sent, toast: document.querySelector('#saved').classList.contains('on'), pos: document.querySelector('#preview').dataset.pos }));
  if (!sent.toast) problems.push(`${name}: no saved toast`);
  if (!sent.sent.some((p) => p.position === 'left')) problems.push(`${name}: segmented choice did not reach set()`);
  // bottom of the page
  await page.keyboard.press('End');
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(out, `${name}-bottom.png`) });
  await check('bottom');
  const last = await page.evaluate(() => document.querySelector('.nav a[aria-current=true]')?.textContent);
  // keyboard: Tab reaches a visible focus ring on a chip
  await page.evaluate(() => scrollTo(0, 0));
  await page.keyboard.press('Tab');
  const ring = await page.evaluate(() => { const e = document.activeElement; return e && getComputedStyle(e).outlineStyle !== 'none'; });
  if (!ring) problems.push(`${name}: focused control has no visible ring`);
  await page.close();
  return { name, state, last, pos: sent.pos };
}

async function previewSheet(lang) {
  // the preview in every material x mode x size x position combination that matters, one screenshot per language
  const list = Object.entries(cities).map(([key, c]) => ({ key, ar: c.ar, en: c.en }));
  const page = await browser.newPage({ viewport: { width: 480, height: 700 }, deviceScaleFactor: 2 });
  watch(page);
  await page.addInitScript(({ lang, list }) => {
    window.settingsAPI = { get: () => ({ uiLang: lang, lang, digits: lang === 'ar' ? 'arab' : 'latn', position: 'center', islandMode: 'overlay', material: 'acrylic', scale: 0.8 }), set: () => Promise.resolve(), send() {}, on: () => () => {}, perf: () => Promise.resolve(null), info: () => Promise.resolve({ version: '0.5.0' }), cities: () => list, material: () => Promise.resolve({ supported: true }), setSecret: () => Promise.resolve(), checkUpdate: () => Promise.resolve({ status: 'up-to-date' }), quit() {} };
  }, { lang, list });
  await page.goto('file://' + path.join(src, 'settings', 'index.html'));
  await page.evaluate(() => document.fonts.ready);
  const combos = [['acrylic', 'overlay', 'left', '0.7'], ['glass', 'overlay', 'center', '0.8'], ['acrylic', 'appbar', 'center', '1'], ['glass', 'appbar', 'right', '1']];
  const shots = [];
  for (const [material, mode, position, scale] of combos) {
    await page.evaluate(({ material, mode, position, scale }) => {
      for (const [id, v] of Object.entries({ material, islandMode: mode, position, scale })) { const s = document.getElementById(id); s.value = v; s.dispatchEvent(new Event('change')); }
    }, { material, mode, position, scale });
    await page.waitForTimeout(350);
    const bad = await page.evaluate(AUDIT);
    for (const b of bad) problems.push(`preview-${lang}-${material}-${mode}-${position}-${scale}: ${b}`);
    const f = `preview-${lang}-${material}-${mode}-${position}-${scale}.png`;
    await page.locator('#preview').screenshot({ path: path.join(out, f) });
    shots.push(f);
  }
  await page.close();
  return shots;
}

async function islandDots(lang, mode) {
  const page = await browser.newPage({ viewport: { width: 600, height: 330 }, deviceScaleFactor: 2 });
  watch(page);
  const now = Date.now();
  const min = 60000;
  const data = {
    'today:get': { prayer: { location: lang === 'ar' ? 'الرياض' : 'Riyadh', today: [['fajr', -560], ['sunrise', -470], ['dhuhr', -200], ['asr', 8], ['maghrib', 160], ['isha', 250]].map(([n, m]) => ({ name: n, time: now + m * min })), tomorrow: [] }, weather: { code: 1, temp: 31, max: 36, min: 24, day: true } },
    'media:caps': { ok: true },
  };
  await page.addInitScript(({ lang, mode, data }) => {
    const handlers = {};
    window.__emit = (ch, d) => handlers[ch] && handlers[ch](d);
    window.islandAPI = { settings: { uiLang: lang, lang, autoHide: 'never', material: 'glass', islandMode: mode, motion: 'full', prayerAlerts: true }, call: (ch) => Promise.resolve(data[ch] ?? null), send() {}, on: (ch, cb) => (handlers[ch] = cb), pathsForFiles: () => [] };
    navigator.getBattery = () => Promise.resolve({ level: 0.82, charging: true, chargingTime: 2400, dischargingTime: Infinity, addEventListener() {} });
  }, { lang, mode, data });
  await page.goto('file://' + path.join(src, 'renderer', 'index.html'));
  await page.addStyleTag({ content: 'body { background: linear-gradient(135deg, #2b2350, #141a2e) !important; }' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  await page.evaluate(() => Island.open('today'));
  await page.waitForTimeout(900);
  const info = await page.evaluate(() => {
    const dots = [...document.querySelectorAll('.dot')].map((d) => { const r = d.getBoundingClientRect(); const cs = getComputedStyle(d, '::before'); return { w: r.width, label: d.getAttribute('aria-label'), cur: d.getAttribute('aria-current'), hit: [cs.width, cs.height] }; });
    const rects = [...document.querySelectorAll('.dot')].map((d) => d.getBoundingClientRect());
    let overlap = false;
    for (let i = 1; i < rects.length; i++) if (rects[i].left < rects[i - 1].right + 2 && rects[i].right > rects[i - 1].left) overlap = !(Math.abs(rects[i].left - rects[i - 1].right) >= 2) || overlap;
    return { dots, overlap, n: rects.length };
  });
  if (info.n < 2) problems.push(`island-dots-${lang}-${mode}: fewer than two dots`);
  if (info.overlap) problems.push(`island-dots-${lang}-${mode}: dots crowd each other`);
  if (info.dots.some((d) => !d.label)) problems.push(`island-dots-${lang}-${mode}: dot without a label`);
  await page.keyboard.press('Tab');
  await page.waitForTimeout(150);
  const ring = await page.evaluate(() => { const e = document.activeElement; return !!e && e.matches('button') && getComputedStyle(e).outlineStyle !== 'none'; });
  if (!ring) problems.push(`island-dots-${lang}-${mode}: no visible focus ring`);
  await page.screenshot({ path: path.join(out, `island-dots-${lang}-${mode}.png`), clip: { x: 0, y: 0, width: 600, height: 280 } });
  await page.close();
  return { lang, mode, ...info, ring };
}

async function palette(lang) {
  const page = await browser.newPage({ viewport: { width: 640, height: 300 }, deviceScaleFactor: 2 });
  watch(page);
  const items = lang === 'ar'
    ? [{ kind: 'copy', icon: 'calc', title: '360', sub: '120 × 3' }, { kind: 'app', icon: 'app', title: 'الحاسبة', sub: 'app' }, { kind: 'openLink', icon: 'link', title: 'https://islandly.app', sub: 'openLink' }]
    : [{ kind: 'copy', icon: 'calc', title: '360', sub: '120 × 3' }, { kind: 'app', icon: 'app', title: 'Calculator', sub: 'app' }, { kind: 'openLink', icon: 'link', title: 'https://islandly.app', sub: 'openLink' }];
  await page.addInitScript(({ lang, items }) => {
    window.paletteAPI = { settings: { uiLang: lang, lang, digits: 'latn', motion: 'full' }, call: () => Promise.resolve(items), send() {}, on() {} };
  }, { lang, items });
  await page.goto('file://' + path.join(src, 'palette', 'index.html'));
  await page.evaluate(() => { document.documentElement.style.background = 'linear-gradient(135deg, #2b2350, #141a2e)'; });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
  await page.keyboard.press('Tab');
  await page.screenshot({ path: path.join(out, `palette-${lang}.png`) });
  const bad = await page.evaluate(AUDIT);
  for (const b of bad) problems.push(`palette-${lang}: ${b}`);
  await page.close();
}

const report = [];
for (const lang of ['ar', 'en']) for (const mode of ['overlay', 'appbar']) report.push(await settings(lang, mode));
report.push(await settings('ar', 'overlay', { digits: 'arab', scale: 1, material: 'glass', position: 'right' }, '-arabdigits'));
const sheets = [await previewSheet('ar'), await previewSheet('en')];
const dots = [];
for (const lang of ['ar', 'en']) for (const mode of ['overlay', 'appbar']) dots.push(await islandDots(lang, mode));
await palette('ar');
await palette('en');
console.log('SETTINGS');
for (const r of report) console.log(`  ${r.name.padEnd(34)} chipAfterJump="${r.state.current}" scrollTop=${r.state.scrollTop} lastChip="${r.last}" previewPos=${r.pos}`);
console.log('PREVIEW SHEETS', sheets.flat().length, 'shots');
console.log('ISLAND DOTS');
for (const d of dots) console.log(`  ${d.lang}-${d.mode} dots=${d.n} overlap=${d.overlap} focusRing=${d.ring} hitArea=${d.dots[0].hit.join('x')}`);
console.log('page errors:', errors.length ? errors : 'none');
console.log('network requests outside file/data:', network.length ? network : 'none');
console.log('LAYOUT PROBLEMS:', problems.length ? '\n  ' + problems.join('\n  ') : 'none');
await browser.close();
process.exit(problems.length || errors.length ? 1 : 0);

// T12 layout QA: in every prayer/Ramadan/Quran state, Arabic and English, Latin and Arabic-Indic digits, short and
// long strings, 12h and 24h: no element closer than 8px to its neighbour (12px around the status dot), 10px from the pill edge, nothing clipped.
//   node dev/islamic/layout-check.mjs   -> prints 'no issues' plus the Ramadan row positions
import { createRequire } from 'module';
const require = createRequire('/opt/node-tools/node_modules/');
const { chromium } = require('playwright');
const MIN = 60000;
const b = await chromium.launch({ args: ['--no-sandbox', '--allow-file-access-from-files'] });
const issues = [];
for (const lang of ['ar', 'en']) for (const digits of ['latn', 'arab']) {
  if (lang === 'en' && digits === 'arab') continue;
  const p = await b.newPage({ viewport: { width: 700, height: 500 }, deviceScaleFactor: 1, bypassCSP: true });
  await p.addInitScript(({ lang, digits }) => { const hs = {}; window.__emit = (c, d) => hs[c] && hs[c](d); window.islandAPI = { settings: { uiLang: lang, digits, autoHide: 'never', material: 'glass', prayerActivity: true }, call: () => Promise.resolve(null), send() {}, on: (c, f) => (hs[c] = f), pathsForFiles: () => [] }; }, { lang, digits });
  await p.goto('file://' + new URL('../../src/renderer/index.html', import.meta.url).pathname);
  await p.waitForTimeout(300);
  const now = Date.now();
  const cases = [];
  for (const name of ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']) {
    cases.push([`pre-${name}-short`, { next: { name, time: now + 65000 }, current: null, phase: 'pre', phaseEndsAt: now + 65000, ramadan: false, imsak: null, iftar: null, pausedByAdhan: false }]);
    cases.push([`pre-${name}-long`, { next: { name, time: now + 59 * MIN + 59000 }, current: null, phase: 'pre', phaseEndsAt: now + 59 * MIN + 59000, ramadan: false, imsak: null, iftar: null, pausedByAdhan: false }]);
    cases.push([`adhan-${name}`, { next: null, current: { name, time: now - 1000 }, phase: 'adhan', phaseEndsAt: now + 100000, ramadan: false, imsak: null, iftar: null, pausedByAdhan: false }]);
    cases.push([`iqama-${name}`, { next: null, current: { name, time: now - 3 * MIN }, phase: 'iqama', phaseEndsAt: now + 59 * MIN + 59000, ramadan: false, imsak: null, iftar: null, pausedByAdhan: false }]);
  }
  cases.push(['iftar-long', { next: { name: 'maghrib', time: now + 59 * MIN }, current: null, phase: 'idle', phaseEndsAt: null, ramadan: true, imsak: now + 10 * 3600000, iftar: now + 59 * MIN + 59000, pausedByAdhan: false }]);
  cases.push(['iftar-short', { next: { name: 'maghrib', time: now + 5000 }, current: null, phase: 'idle', phaseEndsAt: null, ramadan: true, imsak: now + 10 * 3600000, iftar: now + 9000, pausedByAdhan: false }]);
  const fresh = (s) => (s.ramadan && s.iftar && s.iftar - now < 60000 ? { ...s, iftar: Date.now() + 30000 } : s);
  for (const [label, s0] of cases) {
    const s = fresh(s0);
    await p.evaluate((s) => { if (Island.debug().pinned) Island.togglePin(); Island.peek('prayer', 0); window.__emit('prayer:state', s); Island.peek('prayer', 0); }, s);
    await p.waitForTimeout(1300);
    const r = await p.evaluate(() => {
      const v = document.querySelector('#content > .view');
      if (!v || !/prayer-activity|quran-compact|prayer-peek/.test(v.className)) return { skip: v && v.className };
      const isl = document.getElementById('island').getBoundingClientRect();
      const box = v.querySelector('.m-text'); const kids = [...v.children].filter((k) => getComputedStyle(k).display !== 'none' && k.getBoundingClientRect().width > 0).map((k) => { const b = k.getBoundingClientRect(); return { cls: k.className || k.tagName, l: b.left, r: b.right, t: b.top, b: b.bottom, sw: k.scrollWidth, cw: k.clientWidth, text: k.textContent }; });
      return { isl: { l: isl.left, r: isl.right, t: isl.top, b: isl.bottom, h: isl.height }, kids };
    });
    if (r.skip !== undefined) { issues.push(`${lang}/${digits} ${label}: not shown (${r.skip})`); continue; }
    const k = [...r.kids].sort((a, b2) => a.l - b2.l);
    for (let i = 1; i < k.length; i++) { const gap = k[i].l - k[i - 1].r; if (gap < (k[i - 1].cls === 'pa-dot' || k[i].cls === 'pa-dot' ? 12 : 8)) issues.push(`${lang}/${digits} ${label}: gap ${gap.toFixed(1)}px between ${k[i - 1].cls}("${k[i - 1].text}") and ${k[i].cls}("${k[i].text}")`); }
    const rad = r.isl.h / 2;
    for (const c of k) {
      if (c.sw > c.cw + 1 && c.cls !== 'pa-dot') issues.push(`${lang}/${digits} ${label}: ${c.cls} clipped ("${c.text}" ${c.sw}>${c.cw})`);
      const inL = c.l - r.isl.l, inR = r.isl.r - c.r;
      if (inL < 10 || inR < 10) issues.push(`${lang}/${digits} ${label}: ${c.cls} only ${Math.min(inL, inR).toFixed(1)}px from the pill edge`);
    }
  }
  // peeks: adhan and paused (with Resume), longest names
  for (const [label, s] of [['peek-adhan-maghrib', { next: null, current: { name: 'maghrib', time: Date.now() }, phase: 'adhan', phaseEndsAt: Date.now() + 100000, ramadan: false, imsak: null, iftar: null, pausedByAdhan: false }], ['peek-paused-maghrib', { next: null, current: { name: 'maghrib', time: Date.now() }, phase: 'adhan', phaseEndsAt: Date.now() + 100000, ramadan: false, imsak: null, iftar: null, pausedByAdhan: true }]]) {
    const r = await p.evaluate((s) => new Promise((res) => {
      if (Island.debug().pinned) Island.togglePin();
      window.__emit('prayer:state', { ...s, phase: 'idle', pausedByAdhan: false });
      window.__emit('prayer:state', s);
      Island.peek('prayer', 60000);
      setTimeout(() => {
        const v = document.querySelector('#content > .view');
        const isl = document.getElementById('island').getBoundingClientRect();
        const parts = [...v.querySelectorAll('.n-icon, .m-title, .m-artist, .pill')].filter((e) => getComputedStyle(e).display !== 'none' && e.textContent !== '' || e.classList.contains('n-icon')).map((e) => { const b = e.getBoundingClientRect(); const range = document.createRange(); range.selectNodeContents(e); const tb = range.getBoundingClientRect(); return { cls: e.className, l: e.classList.contains('n-icon') || e.classList.contains('pill') ? b.left : tb.left, r: e.classList.contains('n-icon') || e.classList.contains('pill') ? b.right : tb.right, sw: e.scrollWidth, cw: e.clientWidth, text: e.textContent }; });
        res({ cls: v.className, parts, isl: { l: isl.left, r: isl.right } });
      }, 1400);
    }), s);
    const k = [...r.parts].sort((a, b2) => a.l - b2.l);
    const rows = k.filter((x) => !/m-artist/.test(x.cls)); // title and subtitle share a column
    for (let i = 1; i < rows.length; i++) { const gap = rows[i].l - rows[i - 1].r; if (gap < 8) issues.push(`${lang}/${digits} ${label}: gap ${gap.toFixed(1)}px between "${rows[i - 1].text}" and "${rows[i].text}"`); }
    for (const c of k) { if (c.sw > c.cw + 1) issues.push(`${lang}/${digits} ${label}: "${c.text}" clipped`); if (c.l - r.isl.l < 10 || r.isl.r - c.r < 10) issues.push(`${lang}/${digits} ${label}: "${c.text || c.cls}" near the edge`); }
  }
  // Quran pill while reciting, short and long surah names
  for (const sura of [1, 36, 60, 74]) {
    const r = await p.evaluate((sura) => new Promise((res) => {
      Island.peek('prayer', 0);
      window.__emit('prayer:state', { next: null, current: null, phase: 'idle', phaseEndsAt: null, ramadan: false, imsak: null, iftar: null, pausedByAdhan: false });
      const q = Island.feature('quran'); q.pick.sura = sura; q.playing = true; q.paint(); Island.render();
      setTimeout(() => {
        const v = document.querySelector('#content > .view');
        const isl = document.getElementById('island').getBoundingClientRect();
        const kids = [...v.children].map((e) => { const b = e.getBoundingClientRect(); return { cls: e.className, l: b.left, r: b.right, sw: e.scrollWidth, cw: e.clientWidth, text: e.textContent }; });
        q.playing = false; Island.render();
        res({ cls: v.className, kids, isl: { l: isl.left, r: isl.right } });
      }, 1400);
    }), sura);
    const k = [...r.kids].sort((a, b2) => a.l - b2.l);
    for (let i = 1; i < k.length; i++) { const gap = k[i].l - k[i - 1].r; if (gap < 8) issues.push(`${lang}/${digits} quran-${sura}: gap ${gap.toFixed(1)}px`); }
    for (const c of k) { if (c.sw > c.cw + 1) issues.push(`${lang}/${digits} quran-${sura}: "${c.text}" clipped without ellipsis? (${c.sw}>${c.cw})`); if (c.l - r.isl.l < 10 || r.isl.r - c.r < 10) issues.push(`${lang}/${digits} quran-${sura}: ${c.cls} near the edge`); }
  }
  // panels: their content never reaches the tab dots, including right after a list opens
  for (const [label, prep] of [['today', "Island.open('today')"], ['clock', "Island.open('clock')"], ['quran', "Island.open('quran')"], ['quran+surahs', "Island.open('quran'); Island.feature('quran').toggleList('surahs')"], ['quran+reciters', "Island.open('quran'); Island.feature('quran').toggleList('reciters')"]]) {
    const r = await p.evaluate((prep) => new Promise((res) => {
      if (Island.debug().pinned) Island.togglePin();
      const q = Island.feature('quran'); q.list = ''; q.reciters = q.reciters || [{ id: 1, nameAr: 'مشاري راشد العفاسي', nameEn: 'Mishary Rashid Alafasy', moshaf: [{ id: 1, name: 'x', server: 'https://s.mp3quran.net/a/', surahList: Array.from({ length: 114 }, (_, i) => i + 1) }] }];
      const td = Island.feature('today');
      td.sched = td.sched || { location: 'X', today: ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'].map((n, i) => ({ name: n, time: Date.now() + (i - 2) * 3 * 3600000 })), tomorrow: [] };
      setTimeout(() => {
        try {
          (0, eval)(prep);
        } catch (e) {
          return res({ error: String(e) });
        }
        setTimeout(() => {
          try {
            const v = document.querySelector('#content > .view').getBoundingClientRect();
            const c = document.getElementById('content').getBoundingClientRect();
            const dots = document.querySelector('#content .dots');
            res({ key: Island.debug().key, viewBottom: v.bottom, contentBottom: c.bottom, dotsTop: dots ? dots.getBoundingClientRect().top : Infinity });
          } catch (e) {
            res({ error: String(e) });
          }
        }, 1500);
      }, 300);
    }), prep);
    if (r.error) { issues.push(`${lang}/${digits} panel ${label}: ${r.error}`); continue; }
    if (!r.key || !r.key.startsWith('x:')) issues.push(`${lang}/${digits} panel ${label}: not opened (${r.key})`);
    if (r.viewBottom > r.dotsTop + 1 || r.viewBottom > r.contentBottom + 1) issues.push(`${lang}/${digits} panel ${label}: content ${Math.round(r.viewBottom)} reaches the dots at ${Math.round(r.dotsTop)} (content box ends ${Math.round(r.contentBottom)})`);
  }
  // Ramadan row in Today, 12h and 24h
  for (const cycle of ['h12', 'h23']) {
    const r = await p.evaluate((cycle) => {
      const td = Island.feature('today');
      td.sched = { location: 'X', today: ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'].map((n, i) => ({ name: n, time: Date.now() + (i - 2) * 3 * 3600000 })), tomorrow: [] };
      td.fmtTime = (ms) => I18N.time(new Date(ms), { hour: 'numeric', minute: '2-digit', hourCycle: cycle });
      window.__emit('prayer:state', { next: null, current: null, phase: 'idle', phaseEndsAt: null, ramadan: true, imsak: new Date().setHours(4, 26, 0, 0), iftar: new Date().setHours(17, 48, 0, 0), pausedByAdhan: false });
      td.paint();
      Island.open('today');
      return new Promise((res) => setTimeout(() => {
        const row = document.querySelector('.rmd');
        const parts = [...row.querySelectorAll('.rmd-moon, .rmd-cell small, .rmd-cell b')].map((e) => { const b = e.getBoundingClientRect(); return { cls: e.className || e.tagName, l: b.left, r: b.right, text: e.textContent }; });
        const rb = row.getBoundingClientRect();
        res({ parts, row: { l: rb.left, r: rb.right } });
      }, 1300));
    }, cycle);
    const k = [...r.parts].sort((a, b2) => a.l - b2.l);
    for (let i = 1; i < k.length; i++) { const gap = k[i].l - k[i - 1].r; if (gap < 8) issues.push(`${lang}/${digits} ramadan ${cycle}: gap ${gap.toFixed(1)}px between "${k[i - 1].text}" and "${k[i].text}"`); }
    issues.push(`(info) ${lang}/${digits} ramadan ${cycle}: ` + k.map((x) => `${x.text || x.cls}[${Math.round(x.l)}-${Math.round(x.r)}]`).join(' '));
  }
  await p.close();
}
await b.close();
console.log(issues.join('\n') || 'no issues');

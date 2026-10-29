// T19 visual QA for the motion prototype: liquid-expand frames (B) and idle eyes (C) in Arabic RTL and English LTR, overlay,
// AppBar and floating, acrylic and glass, with a layout audit. Uses the prototype's manual clock, so frames are exact.
//   node dev/t19/prototype/shots.mjs   -> dev/t19/prototype/out/* (not committed; sheets and GIFs go to dev/t19/sheets)
import { createRequire } from 'module';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(process.env.PLAYWRIGHT_DIR || '/opt/node-tools/node_modules/');
const { chromium } = require('playwright');
const out = path.join(here, 'out');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'gif'), { recursive: true });
const url = (o) => 'file://' + path.join(here, 'index.html') + '?manual=1&' + new URLSearchParams(o);

const browser = await chromium.launch({ args: ['--no-sandbox', '--allow-file-access-from-files'] });
const problems = [];
const errors = [];
const network = [];

async function open(o, dsf = 2) {
  const page = await browser.newPage({ viewport: { width: 760, height: 330 }, deviceScaleFactor: dsf });
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('request', (r) => !/^(file|data):/.test(r.url()) && network.push(r.url()));
  await page.goto(url(o));
  await page.evaluate(() => document.fonts.ready);
  return page;
}
// a clip given in desk coordinates (the desk is centred in the 760 px viewport)
const clip = async (page, name, r) => { const b = await page.locator('#desk').boundingBox(); return page.screenshot({ path: name, clip: { x: b.x + r.x, y: b.y + r.y, width: r.width, height: r.height } }); };
const desk = (page, name) => page.locator('#desk').screenshot({ path: path.join(out, name + '.png') });

// every box of the pill (collapsed) or the card (open) stays inside the island, siblings do not intersect
const AUDIT = (state) => {
  const bad = [];
  const R = (el) => el.getBoundingClientRect();
  const inside = (a, b, m = 0.5) => a.left >= b.left - m && a.right <= b.right + m && a.top >= b.top - m && a.bottom <= b.bottom + m;
  const hit = (a, b) => a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
  const deskR = R(document.getElementById('desk'));
  const body = R(document.getElementById('shape'));
  if (!inside(body, deskR)) bad.push('island leaves the screen');
  if (state === 'collapsed') {
    const t = R(document.getElementById('time'));
    if (!inside(t, body)) bad.push('time leaves the pill');
    const hidden = document.getElementById('island').dataset.eyes !== 'on';
    if (!hidden) {
      const e = [...document.querySelectorAll('.eye')].map(R);
      e.forEach((x) => { if (!inside(x, body)) bad.push('eye leaves the pill'); if (hit(x, t)) bad.push('eye overlaps the time'); });
      if (hit(e[0], e[1])) bad.push('eyes overlap each other');
      const g = e[1].left - e[0].right;
      if (g < 4) bad.push('eyes crowded: gap ' + g.toFixed(1));
      const rest = R(document.getElementById('rest'));
      const group = { left: Math.min(e[0].left, e[1].left, t.left), right: Math.max(e[0].right, e[1].right, t.right) };
      if (group.left < body.left + 12 || group.right > body.right - 12) bad.push('eyes+time closer than 12 px to the pill edge');
    }
  } else {
    const card = document.getElementById('card');
    for (const el of card.querySelectorAll('*')) {
      const r = R(el);
      if (!r.width) continue;
      if (!inside(r, body)) bad.push('card content outside the island: ' + (el.id || el.className || el.tagName));
      if (el.children.length === 0 && el.scrollWidth > el.clientWidth + 1) bad.push('text clipped: ' + el.textContent.slice(0, 20));
    }
    for (const row of card.querySelectorAll('.c-head, .c-next, .c-chips')) {
      const k = [...row.children].map(R);
      for (let i = 0; i < k.length; i++) for (let j = i + 1; j < k.length; j++) if (hit(k[i], k[j])) bad.push('overlap in ' + row.className);
    }
  }
  return bad;
};
const audit = async (page, state, tag) => {
  for (const b of await page.evaluate(AUDIT, state)) problems.push(`${tag} ${state}: ${b}`);
};

// ---- B: liquid expand, frames at fixed times; the same sequence is exported as a slow-motion GIF
const FRAMES = [0, 30, 60, 100, 150, 260];
const combos = [];
for (const lang of ['ar', 'en']) for (const mode of ['overlay', 'appbar', 'floating']) combos.push({ lang, mode, pos: 'center', material: mode === 'appbar' ? 'glass' : 'acrylic' });
combos.push({ lang: 'ar', mode: 'floating', pos: 'right', material: 'glass' }, { lang: 'en', mode: 'floating', pos: 'left', material: 'glass' });
const report = [];
for (const o of combos) {
  const tag = `${o.lang}-${o.mode}-${o.pos}-${o.material}`;
  const page = await open({ ...o, motion: 'full' });
  await audit(page, 'collapsed', tag);
  let t = 0;
  await page.evaluate(() => window.proto.open(true));
  for (const f of FRAMES) {
    await page.evaluate((ms) => window.proto.step(ms), f - t);
    t = f;
    await desk(page, `B-${tag}-t${String(f).padStart(3, '0')}`);
  }
  await page.evaluate(() => window.proto.step(600));
  await audit(page, 'open', tag);
  await desk(page, `B-${tag}-open`);
  // interrupt: reverse at 90 ms and capture the turn-around
  await page.evaluate(() => { window.proto.open(false); window.proto.step(600); window.proto.open(true); window.proto.step(90); window.proto.open(false); });
  for (const f of [30, 90]) { await page.evaluate((ms) => window.proto.step(ms), f === 30 ? 30 : 60); await desk(page, `B-${tag}-reverse-t${f}`); }
  report.push(tag);
  await page.close();
}

// reduced and off: no droplet, no overshoot
for (const motion of ['reduced', 'off']) {
  const page = await open({ lang: 'en', mode: 'overlay', material: 'acrylic', motion });
  await page.evaluate(() => window.proto.open(true));
  await page.evaluate(() => window.proto.step(60));
  const mid = await page.evaluate(() => window.proto.state());
  await page.evaluate(() => window.proto.step(400));
  const end = await page.evaluate(() => window.proto.state());
  if (motion === 'off' && mid.f !== 1) problems.push('motion off: not instant');
  if (motion === 'reduced' && !(mid.f > 0 && mid.f < 1)) problems.push('motion reduced: no short fade');
  if (end.f > 1.001) problems.push(`motion ${motion}: overshoot`);
  await desk(page, `B-motion-${motion}-open`);
  await audit(page, 'open', 'motion-' + motion);
  await page.close();
}

// ---- C: eyes
const STATES = [
  ['far-sleepy', { x: 690, y: 330 }, {}],
  ['near-left', { x: 250, y: 60 }, {}],
  ['near-right', { x: 560, y: 60 }, {}],
  ['near-below', { x: 360, y: 200 }, {}],
  ['blink', { x: 360, y: 200 }, { blink: true }],
  ['reduced-static', { x: 250, y: 60 }, { motion: 'reduced' }],
  ['eco-hidden', { x: 250, y: 60 }, { eco: '1' }],
  ['fullscreen-hidden', { x: 250, y: 60 }, { fullscreen: '1' }],
  ['motion-off-hidden', { x: 250, y: 60 }, { motion: 'off' }],
];
for (const lang of ['ar', 'en'])
  for (const mode of ['overlay', 'appbar', 'floating'])
    for (const material of ['acrylic', 'glass'])
      for (const [name, at, extra] of STATES) {
        if (material === 'glass' && !['far-sleepy', 'near-left', 'blink'].includes(name)) continue;
        const tag = `${lang}-${mode}-${material}-${name}`;
        const page = await open({ lang, mode, material, motion: 'full', ...Object.fromEntries(Object.entries(extra).filter(([k]) => k !== 'blink')) }, 4);
        await page.evaluate((p) => { window.proto.pointer(p.x, p.y); window.proto.step(900); }, at);
        if (extra.blink) {
          // freeze at the lowest point of a blink: close = 35 % of 170 ms
          await page.evaluate(() => { const e = window.proto.state().eye; return e; });
          await page.evaluate(() => { for (let i = 0; i < 9000; i++) { window.proto.step(1); const s = window.proto.state().eye; if (s.blinkT >= 60 && s.blinkT <= 62) break; } });
        }
        await audit(page, 'collapsed', tag);
        {
          const pos = await page.evaluate(() => { const r = document.getElementById('shape').getBoundingClientRect(); const d = document.getElementById('desk').getBoundingClientRect(); return { x: r.left - d.left, y: r.top - d.top, w: r.width, h: r.height }; });
          await clip(page, path.join(out, `C-${tag}.png`), { x: pos.x - 24, y: Math.max(0, pos.y - 10), width: pos.w + 48, height: pos.h + 20 });
        }
        await page.close();
      }

// eyes behaviour numbers: pupil travel, blink cadence over 60 s of simulated time, far vs near
{
  const page = await open({ lang: 'en', mode: 'overlay', motion: 'full' });
  const r = await page.evaluate(() => {
    const P = window.proto; const res = {};
    P.pointer(-999, -999); P.step(1500); res.sleepy = P.state().eye;
    P.pointer(260, 56); P.step(900); res.left = P.state().eye;
    P.pointer(520, 56); P.step(900); res.right = P.state().eye;
    const count = (px, py, ms) => { P.pointer(px, py); P.step(900); let n = 0, was = false, maxLid = 0; for (let i = 0; i < ms; i++) { P.step(1); const b = P.state().eye.blinkT >= 0; if (b && !was) n++; was = b; } return n; };
    res.blinksIn60sNear = count(360, 120, 60000);
    res.blinksIn60sFar = count(700, 340, 60000);
    return res;
  });
  console.log('EYES', JSON.stringify(r));
  await page.close();
}

// ---- GIFs: B open + hold + close at 1/5 speed; C cursor sweep at real speed
async function frames(o, name, plan, stepMs, gh = 250) {
  const page = await open(o, 1);
  let i = 0;
  for (const seg of plan) {
    await page.evaluate(seg.pre || (() => {}));
    for (let k = 0; k < seg.n; k++) {
      await page.evaluate(([ms, fn]) => { if (fn) new Function('P', 'k', fn)(window.proto, 0); window.proto.step(ms); }, [stepMs, seg.each || null]);
      await clip(page, path.join(out, 'gif', `${name}-${String(i++).padStart(3, '0')}.png`), { x: 0, y: 0, width: 720, height: gh });
    }
  }
  await page.close();
}
for (const [lang, mode] of [['ar', 'floating'], ['en', 'overlay'], ['en', 'appbar'], ['ar', 'appbar']])
  await frames({ lang, mode, material: 'acrylic', motion: 'full' }, `B-${lang}-${mode}`, [
    { pre: () => window.proto.open(true), n: 40 }, // 40 x 8 ms = 320 ms
    { n: 10 },
    { pre: () => window.proto.open(false), n: 40 },
  ], 8);
await frames({ lang: 'en', mode: 'overlay', material: 'glass', motion: 'full' }, 'C-eyes-en', [
  { pre: () => window.proto.pointer(700, 330), n: 25 },
  { pre: () => window.proto.pointer(120, 90), n: 25 },
  { pre: () => window.proto.pointer(600, 90), n: 25 },
  { pre: () => window.proto.pointer(360, 160), n: 40 },
  { pre: () => window.proto.pointer(720, 360), n: 30 },
], 40);

console.log('B combos', report.length);
console.log('page errors:', errors.length ? errors : 'none');
console.log('network requests outside file/data:', network.length ? network : 'none');
console.log('LAYOUT PROBLEMS:', problems.length ? '\n  ' + problems.join('\n  ') : 'none');
await browser.close();
process.exit(problems.length || errors.length ? 1 : 0);

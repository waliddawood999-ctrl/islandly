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
      e.forEach((x) => {
        if (x.top < body.top + 1 || x.bottom > body.bottom - 1) bad.push('eye touches the top/bottom of the pill');
        if (x.left < body.left + 8 || x.right > body.right - 8) bad.push('eye closer than 8 px to the pill end');
        if (hit(x, t)) bad.push('eye overlaps the time');
      });
      if (hit(e[0], e[1])) bad.push('eyes overlap each other');
      const edge = Math.min(...e.map((x) => (x.left > t.left ? x.left - t.right : t.left - x.right)));
      if (edge < 11) bad.push('eyes and time closer than 11 px: ' + edge.toFixed(1));
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
for (const [lang, mode] of [['ar', 'overlay'], ['en', 'floating'], ['en', 'appbar']]) combos.push({ lang, mode, pos: 'center', material: 'acrylic', theme: 'light' });
combos.push({ lang: 'ar', mode: 'floating', pos: 'right', material: 'glass' }, { lang: 'en', mode: 'floating', pos: 'left', material: 'glass' });
const report = [];
for (const o of combos) {
  const tag = `${o.lang}-${o.mode}-${o.pos}-${o.material}${o.theme === 'light' ? '-light' : ''}`;
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
// pointer positions relative to the pill centre (cx = 360, cy = gap + 18)
const gapOf = { overlay: 8, appbar: 8, floating: 14 };
const GAZE_AT = [
  ['left', -170, 0], ['right', 170, 0], ['below-left', -120, 85], ['below-right', 120, 85], ['below', 0, 95],
  ['above-right', 120, -10], ['far-below-left', -330, 230], ['far-right', 330, 40],
];
const STATES = [
  ['rest-awake', null, {}], ['blink', null, { blink: true }], ['sleepy-far', [330, 40], {}], ['squint', 'pill', {}],
  ['reduced-static', [-170, 0], { motion: 'reduced' }], ['eco-hidden', [-170, 0], { eco: '1' }], ['fullscreen-hidden', [-170, 0], { fullscreen: '1' }], ['motion-off-hidden', [-170, 0], { motion: 'off' }],
];
const gazeRows = [];
for (const theme of ['dark', 'light'])
  for (const lang of ['ar', 'en'])
    for (const mode of ['overlay', 'appbar', 'floating']) {
      const cy = gapOf[mode] + 18;
      const base = { theme, lang, mode, material: theme === 'light' ? 'acrylic' : 'glass', motion: 'full' };
      // gaze board: one page per combination, the pointer moves through the positions
      const page = await open(base, 2);
      for (const [name, dx, dy] of GAZE_AT) {
        const tag = `${theme}-${lang}-${mode}-gaze-${name}`;
        await page.evaluate(([x, y]) => { window.proto.pointer(x, y); window.proto.step(2000); window.proto.deferBlink(); }, [360 + dx, cy + dy]);
        await audit(page, 'collapsed', tag);
        const st = await page.evaluate(() => window.proto.state().eye);
        const rec = { theme, lang, mode, name, gx: st.g.x, gy: st.g.y, lid: +st.lid.toFixed(2) };
        gazeRows.push(rec);
        const near = !name.startsWith('far');
        await clip(page, path.join(out, `C-gaze-${tag}.png`), near ? { x: 360 - 190, y: 0, width: 380, height: 150 } : { x: 360 - 190, y: 0, width: 380, height: 60 });
      }
      await page.close();
    }
// gaze assertions on the dark/en/overlay run (every combination uses the same maths)
const expect = (ok, msg) => ok || problems.push('gaze: ' + msg);
// the gaze angle must equal the real angle to the cursor (within 4 degrees), in every combination, near and far
for (const r of gazeRows) {
  const [, dx, dy] = GAZE_AT.find((a) => a[0] === r.name);
  const want = (Math.atan2(dy, dx) * 180) / Math.PI;
  const got = (Math.atan2(r.gy, r.gx) * 180) / Math.PI;
  const d = Math.abs(((got - want + 540) % 360) - 180);
  expect(d < 4, `${r.theme}-${r.lang}-${r.mode} ${r.name}: angle ${got.toFixed(1)} vs cursor ${want.toFixed(1)}`);
  const mag = Math.hypot(r.gx, r.gy);
  expect(r.name.startsWith('far') ? mag > 0.5 && mag < 0.65 && r.lid > 0.4 : mag > 0.97, `${r.name}: magnitude ${mag.toFixed(2)}, lid ${r.lid}`);
}

// states board
for (const theme of ['dark', 'light'])
  for (const lang of ['ar', 'en'])
    for (const [name, at, extra] of STATES) {
      const mode = 'overlay';
      const tag = `${theme}-${lang}-${name}`;
      const page = await open({ theme, lang, mode, material: theme === 'light' ? 'acrylic' : 'glass', motion: 'full', ...Object.fromEntries(Object.entries(extra).filter(([k]) => k !== 'blink')) }, 4);
      const cy = gapOf[mode] + 18;
      await page.evaluate(([p, cy]) => {
        if (p === 'pill') window.proto.pointer(360, cy); else if (p) window.proto.pointer(360 + p[0], cy + p[1]); else window.proto.pointer(360 + 120, cy + 70);
        window.proto.step(1500);
        if (!window.__keepBlink) window.proto.deferBlink();
      }, [at, cy]);
      if (extra.blink) await page.evaluate(() => { const P = window.proto; P.blinkNow(); for (let i = 0; i < 400; i++) { P.step(1); const e = P.state().eye; if (e.blinkT >= 112) break; } });
      await audit(page, 'collapsed', tag);
      await clip(page, path.join(out, `C-${tag}.png`), { x: 360 - 90, y: 0, width: 180, height: 60 });
      await page.close();
    }

// blink / sleepy timelines (dark, English): exact frames from the simulation
{
  const page = await open({ theme: 'dark', lang: 'en', mode: 'overlay', material: 'glass', motion: 'full' }, 4);
  await page.evaluate(() => { window.proto.pointer(480, 80); window.proto.step(1500); });
  for (const t of [0, 56, 112, 134, 190, 280]) {
    await page.evaluate((t) => { const P = window.proto; P.blinkNow(); P.step(1); P.setBlinkT(t); }, t);
    await clip(page, path.join(out, `C-blink-t${String(t).padStart(3, '0')}.png`), { x: 270, y: 0, width: 180, height: 60 });
  }
  await page.close();
}
{
  // sleepy fall-asleep, from awake to far
  const page = await open({ theme: 'dark', lang: 'en', mode: 'overlay', material: 'glass', motion: 'full' }, 4);
  await page.evaluate(() => { window.proto.pointer(480, 80); window.proto.step(1500); window.proto.pointer(340, 360); });
  let t = 0;
  for (const at of [0, 80, 160, 300, 500, 1200]) {
    await page.evaluate((ms) => window.proto.step(ms), at - t); t = at;
    await clip(page, path.join(out, `C-sleep-t${String(at).padStart(4, '0')}.png`), { x: 270, y: 0, width: 180, height: 60 });
  }
  await page.close();
}
// numbers for the spec: gaze response at 100/250/500/1000 ms after the cursor jumps to the right
{
  const page = await open({ theme: 'dark', lang: 'en', mode: 'overlay', material: 'glass', motion: 'full' }, 1);
  const r = await page.evaluate(() => {
    const P = window.proto; P.pointer(360, 26 + 120); P.step(2500); const res = {};
    P.pointer(360 + 170, 26); let t = 0;
    for (const at of [100, 250, 500, 1000]) { P.step(at - t); t = at; res['t' + at] = +P.state().eye.g.x.toFixed(3); }
    return res;
  });
  console.log('GLIDE', JSON.stringify(r));
  const rows = await (async () => {
    const o = [];
    for (const [name, dx, dy] of GAZE_AT.slice(0, 5)) {
      const v = await page.evaluate(([dx, dy]) => { const P = window.proto; P.pointer(360 + dx, 26 + dy); P.step(2500); const e = P.state().eye; const x = document.getElementById('eyes').style.transform; const ts = [...document.querySelectorAll('.eye')].map((el) => el.style.transform); return { g: e.g, x, ts }; }, [dx, dy]);
      o.push([name, v]);
    }
    return o;
  })();
  console.log('GAZE TABLE'); for (const [n, v] of rows) console.log(' ', n.padEnd(12), JSON.stringify(v.g), v.x, v.ts.join(' | '));
  await page.close();
}

// ---- GIFs: B open + hold + close at 1/5 speed; C cursor sweep at real speed
async function frames(o, name, plan, stepMs, gh = 250, crop = null) {
  const page = await open(o, crop ? 2 : 1);
  let i = 0;
  for (const seg of plan) {
    await page.evaluate(seg.pre || (() => {}));
    for (let k = 0; k < seg.n; k++) {
      await page.evaluate(([ms, fn]) => { if (fn) new Function('P', 'k', fn)(window.proto, 0); window.proto.step(ms); }, [stepMs, seg.each || null]);
      await clip(page, path.join(out, 'gif', `${name}-${String(i++).padStart(3, '0')}.png`), crop ? { x: crop.x, y: 0, width: crop.w, height: gh } : { x: 0, y: 0, width: 720, height: gh });
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
const eyePath = (theme, lang) => frames({ theme, lang, mode: 'overlay', material: theme === 'light' ? 'acrylic' : 'glass', motion: 'full' }, `C-eyes-${theme}-${lang}`, [
  { pre: () => window.proto.pointer(190, 26), n: 14 }, // left
  { pre: () => window.proto.pointer(250, 120), n: 14 }, // below-left
  { pre: () => window.proto.pointer(360, 125), n: 14 }, // below
  { pre: () => window.proto.pointer(470, 120), n: 14 }, // below-right
  { pre: () => window.proto.pointer(550, 26), n: 14 }, // right
  { pre: () => { window.proto.pointer(550, 26); window.proto.blinkNow(); }, n: 10 }, // blink while looking right
  { pre: () => window.proto.pointer(700, 330), n: 24 }, // far away: sleepy, still looking at it
  { pre: () => window.proto.pointer(360, 26), n: 14 }, // on the pill: happy squint
], 40, 150, { x: 170, w: 380 });
await eyePath('dark', 'en'); await eyePath('light', 'ar');

console.log('B combos', report.length);
console.log('page errors:', errors.length ? errors : 'none');
console.log('network requests outside file/data:', network.length ? network : 'none');
console.log('LAYOUT PROBLEMS:', problems.length ? '\n  ' + problems.join('\n  ') : 'none');
await browser.close();
process.exit(problems.length || errors.length ? 1 : 0);

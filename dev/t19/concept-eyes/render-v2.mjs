// Renders the idle-eyes concept v2 boards for approval. Not part of the product.
//   node dev/t19/concept-eyes/render-v2.mjs   -> dev/t19/concept-eyes/v2-board-*.png
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';
const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(process.env.PLAYWRIGHT_DIR || '/opt/node-tools/node_modules/');
const { chromium } = require('playwright');
const b = await chromium.launch({ args: ['--no-sandbox', '--allow-file-access-from-files'] });
const page = await b.newPage({ viewport: { width: 1560, height: 1000 }, deviceScaleFactor: 2 });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
await page.goto('file://' + path.join(here, 'concept-v2.html'));
await page.evaluate(() => document.fonts.ready);
for (const id of ['b0', 'b1', 'b2', 'b3', 'b4']) await page.locator('#' + id).screenshot({ path: path.join(here, `v2-board-${id.slice(1)}.png`) });
// audit (pills measured at their on-screen size): the eyes' bounding boxes stay inside the pill with >= 2 px, the eyes
// never touch each other or the time, and the whole group keeps >= 12 px from the pill ends
const bad = await page.evaluate(() => {
  const bad = [];
  const hit = (a, c) => a.left < c.right && c.left < a.right && a.top < c.bottom && c.top < a.bottom;
  document.querySelectorAll('.pill').forEach((p, i) => {
    const pr = p.getBoundingClientRect();
    const slots = [...p.querySelectorAll('.slot')];
    if (slots.length !== 2) return;
    const eyes = slots.map((s) => s.firstElementChild.getBoundingClientRect());
    const k = pr.width / 138; // zoom factor of this pill
    for (const r of eyes) {
      if (r.top < pr.top + 1.5 * k || r.bottom > pr.bottom - 1.5 * k) bad.push(`pill ${i}: eye too close to the top/bottom`);
      if (r.left < pr.left + 12 * k || r.right > pr.right - 12 * k) bad.push(`pill ${i}: eyes closer than 12 px to the pill end`);
    }
    const t = p.querySelector('.time');
    if (t) { const tr = t.getBoundingClientRect(); eyes.forEach((r) => hit(r, tr) && bad.push(`pill ${i}: eye overlaps the time`)); if (Math.abs(Math.max(...eyes.map((r) => (pr.left < tr.left ? r.right : r.left))) - (pr.left < tr.left ? tr.left : tr.right)) < 8 * k) bad.push(`pill ${i}: eyes and time closer than 8 px`); }
    if (hit(eyes[0], eyes[1])) bad.push(`pill ${i}: eyes overlap each other`);
  });
  return bad;
});
console.log('errors:', errs.length ? errs : 'none', '\nlayout:', bad.length ? [...new Set(bad)] : 'none');
await b.close();

// Renders the idle-eyes concept boards for approval. Not part of the product.
//   node dev/t19/concept-eyes/render.mjs   -> dev/t19/concept-eyes/board-*.png
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
await page.goto('file://' + path.join(here, 'concept.html'));
await page.evaluate(() => document.fonts.ready);
for (const id of ['b1', 'b2', 'b3', 'b4']) await page.locator('#' + id).screenshot({ path: path.join(here, `board-${id.slice(1)}.png`) });
// audit: eyes stay inside the pill with at least 3 px, never touch the time, eyes+time group is >= 12 px from the pill end
const bad = await page.evaluate(() => {
  const bad = [];
  document.querySelectorAll('.pill').forEach((p, i) => {
    const pr = p.getBoundingClientRect();
    const eyes = [...p.querySelectorAll('.eye')];
    const t = p.querySelector('.time');
    for (const e of eyes) {
      const r = e.getBoundingClientRect();
      if (r.top < pr.top + 2 || r.bottom > pr.bottom - 2 || r.left < pr.left + 8 || r.right > pr.right - 8) bad.push(`pill ${i}: eye too close to the pill edge`);
      if (t) { const tr = t.getBoundingClientRect(); if (r.left < tr.right && r.right > tr.left && r.top < tr.bottom && r.bottom > tr.top) bad.push(`pill ${i}: eye overlaps the time`); }
    }
    if (eyes.length === 2) { const a = eyes[0].getBoundingClientRect(), c = eyes[1].getBoundingClientRect(); }
  });
  return bad;
});
console.log('errors:', errs.length ? errs : 'none', '\nlayout:', bad.length ? bad : 'none');
await b.close();

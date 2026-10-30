// Opening-frame strips of the expanded island (browser renderer; native DWM material is not rendered here).
const { chromium } = require('playwright');
const path = require('path');
const { fixture } = require('../../test/t20-fixture');
const root = path.join(__dirname, '..', '..');
(async () => {
  const http = require('http'), fs = require('fs');
  const server = http.createServer((req, res) => { const f = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://x').pathname)); if (!f.startsWith(root)) { res.writeHead(403); return res.end(); } try { res.setHeader('Content-Type', f.endsWith('.js') ? 'text/javascript' : f.endsWith('.css') ? 'text/css' : f.endsWith('.json') ? 'application/json' : f.endsWith('.html') ? 'text/html' : f.endsWith('.woff2') ? 'font/woff2' : 'application/octet-stream'); res.end(fs.readFileSync(f)); } catch (_) { res.writeHead(404); res.end(); } });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const out = path.join(root, 'dev/t21/board');
  for (const lang of ['ar', 'en']) for (const theme of ['dark', 'light']) {
    const context = await browser.newContext({ viewport: { width: 520, height: 420 }, colorScheme: theme });
    const page = await context.newPage();
    await page.addInitScript(fixture, { lang, mode: 'overlay', material: 'glass', complete: true });
    await page.goto(origin + '/src/renderer/index.html');
    await page.evaluate(({ theme }) => { window.__seedPanels(); document.body.style.background = theme === 'light' ? '#e9edf4' : '#142033'; }, { theme });
    await page.evaluate(() => Island.configure({ workArea: { width: 520, height: 420 } }));
    await page.evaluate(() => Island.open('clock'));
    for (const [i, delay] of [0, 50, 100, 160, 240, 420].entries()) {
      await page.waitForTimeout(i === 0 ? 20 : delay - [0, 50, 100, 160, 240, 420][i - 1]);
      await page.screenshot({ path: path.join(out, `open-${lang}-${theme}-f${i}.png`) });
    }
    await context.close();
  }
  await browser.close(); server.close();
})().catch((e) => { console.error(e); process.exit(1); });

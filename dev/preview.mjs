// Visual smoke test: loads the renderer in plain Chromium with a mocked Electron bridge
// and a fake battery, then screenshots every state into dev/shots/.
//   node dev/preview.mjs        (needs `playwright` resolvable, e.g. NODE_PATH or a global install)
import { createRequire } from 'module';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(process.env.PLAYWRIGHT_DIR || '/opt/node-tools/node_modules/');
const { chromium } = require('playwright');

const out = path.join(here, 'shots');
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 640, height: 300 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

await page.addInitScript(() => {
  window.__calls = [];
  const media = [];
  window.islandAPI = {
    setInteractive: (v) => window.__calls.push(['interactive', v]),
    mediaControl: (a) => window.__calls.push(['media', a]),
    onMedia: (cb) => (window.__emitMedia = cb),
    onShortcut: (cb) => (window.__emitShortcut = cb),
  };
  const bat = new EventTarget();
  Object.assign(bat, { level: 0.82, charging: true, chargingTime: 1500, dischargingTime: Infinity });
  window.__bat = bat;
  navigator.getBattery = () => Promise.resolve(bat);
});

await page.goto('file://' + path.join(here, '..', 'src', 'renderer', 'index.html'));
await page.evaluate(() => (document.body.style.background = '#2a2d3a'));
const shot = async (name) => {
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(out, name + '.png') });
};
const hover = async (on) => {
  await page.mouse.move(on ? 320 : 5, on ? 30 : 280);
  await page.waitForTimeout(450);
};

await shot('01-idle');

// music
await page.evaluate(() => {
  const art = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><defs><linearGradient id="g"><stop offset="0" stop-color="#f97316"/><stop offset="1" stop-color="#6d28d9"/></linearGradient></defs><rect width="100" height="100" fill="url(#g)"/></svg>');
  window.__emitMedia({ type: 'media', active: true, title: 'Midnight City', artist: 'M83', playing: true, position: 72, duration: 243, sentAt: Date.now(), trackChanged: true, thumb: art });
});
await shot('02-music-peek');
await page.waitForTimeout(4300);
await shot('03-music-compact');
await hover(true);
await shot('04-music-expanded');

// timer
await page.keyboard.press('Escape');
await page.mouse.wheel(0, 120);
await shot('05-timer-expanded');
await page.click('.timer-expanded .pill.primary');
await hover(false);
await page.waitForTimeout(1200);
await shot('06-timer-compact');

// battery
await hover(true);
await page.mouse.wheel(0, 120);
await shot('07-battery-expanded');
await hover(false);

await page.evaluate(() => {
  window.__bat.charging = false;
  window.__bat.level = 0.12;
  window.__bat.dischargingTime = 2700;
  window.__bat.dispatchEvent(new Event('chargingchange'));
});
await shot('08-battery-unplugged-peek');

await page.evaluate(() => window.__emitMedia({ type: 'media', active: false }));
await page.evaluate(() => Island.feature('timer').reset());
await page.waitForTimeout(4500);
await shot('09-battery-low-compact');

console.log('errors:', errors.length ? errors : 'none');
await browser.close();

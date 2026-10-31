// Renders the settings window's visibility control (AR RTL / EN LTR) with a stubbed settingsAPI.
const { chromium } = require('playwright');
const path = require('path');
const root = path.join(__dirname, '..', '..');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--allow-file-access-from-files'] });
  for (const lang of ['en', 'ar']) {
    for (const mode of ['always', 'approach']) {
      const page = await browser.newPage({ viewport: { width: 560, height: 900 } });
      await page.addInitScript(({ lang, mode }) => {
        window.settingsAPI = { get: () => ({ uiLang: lang, lang, digits: 'latn', fontPairing: 'plex', position: 'center', autoHide: 'auto', islandMode: 'overlay', material: 'acrylic', motion: 'full', islandVisibility: mode, hideFullscreen: true, scale: 0.8, city: 'riyadh', breakEvery: 60, prayerMethod: 'auto', madhab: 'shafi' }), set() {}, cities: () => [{ key: 'riyadh', ar: 'الرياض', en: 'Riyadh' }], info: () => Promise.resolve({ version: '0' }), send() {}, on() {}, material: () => Promise.resolve({ supported: true }), perf: () => Promise.resolve(null) };
      }, { lang, mode });
      await page.goto('file://' + path.join(root, 'src/settings/index.html'));
      await page.waitForTimeout(300);
      await page.evaluate(() => document.getElementById('islandVisibility').scrollIntoView({ block: 'center' }));
      await page.screenshot({ path: path.join(__dirname, 'shots', `settings-visibility-${lang}-${mode}.png`) });
      await page.close();
    }
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });

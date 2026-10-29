// Drives the REAL app (window, main process, IPC) with a REAL pointer on a virtual X display and checks what a user
// would see: hover opens the island, buttons react to clicks, panels never overlap their dots, clicks fall through.
//   xvfb-run -a electron test/ui-e2e.js --no-sandbox --disable-gpu          (needs python3-xlib: pip install python-xlib)
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { execFileSync } = require('child_process');
const { app, BrowserWindow } = require('electron');

const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'islandly-e2e-'));
app.setPath('userData', userData);
// Interface language for this run: ISLANDLY_E2E_LANG=en runs the same checks in English (T11).
const LANG = process.env.ISLANDLY_E2E_LANG === 'en' ? 'en' : 'ar';
// Updates off: a real "update ready" notice from GitHub would cover the island at a random moment.
fs.writeFileSync(path.join(userData, 'settings.json'), JSON.stringify({ lang: LANG, uiLang: LANG, updates: false }));

const { MediaBridge } = require('../src/main/media');
const controls = [];
MediaBridge.prototype.control = function (action, value) {
  controls.push([action, value]);
  return Promise.resolve({ ok: true });
};
MediaBridge.prototype.capabilities = () => Promise.resolve({ ok: true, next: true, prev: true, seek: true, toggle: true });

require('../src/main/main.js');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const xmouse = (...args) => execFileSync('python3', [path.join(__dirname, 'xmouse.py'), ...args.map(String)]);
let win;
const js = (code) => win.webContents.executeJavaScript(code);

async function waitFor(label, fn, ms = 3000) {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > end) throw new Error('timed out: ' + label);
    await sleep(50);
  }
}

/** Centre of a page element in screen pixels (accounts for window position and zoom). */
async function screenPoint(selector, fx = 0.5, fy = 0.5) {
  const r = await js(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); if (!e) return null; const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, w: b.width, h: b.height }; })()`);
  assert(r, 'element not found: ' + selector);
  const z = win.webContents.getZoomFactor();
  const b = win.getBounds();
  return [Math.round(b.x + (r.l + r.w * fx) * z), Math.round(b.y + (r.t + r.h * fy) * z)];
}
const hoverIsland = async () => xmouse('move', ...(await screenPoint('#island')));

const results = [];
const step = async (name, fn) => {
  console.log("STEP " + name);
  try {
    await fn();
    results.push('PASS ' + name);
  } catch (e) {
    results.push('FAIL ' + name + ' -> ' + e.message);
  }
};

app.whenReady().then(() =>
  setTimeout(async () => {
    win = BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().includes('renderer'));
    // The real prayer schedule depends on the time of day; its alerts and countdown would make results depend
    // on when the test runs. Take it out of the picture.
    await js(`(() => { const t = Island.feature('today'); t.sched = null; API.settings.prayerAlerts = false; Island.render(); })()`);
    const art = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="#c60"/></svg>');
    win.webContents.send('media:update', { type: 'media', active: true, title: 'Test track', artist: 'Tester', playing: true, position: 30, duration: 200, sentAt: Date.now(), trackChanged: true, thumb: art });
    await sleep(400);

    // The window must hug the island: nothing outside it may be covered.
    const windowFitsIsland = async () => {
      const b = win.getBounds();
      const z = win.webContents.getZoomFactor();
      const r = await js(`(() => { const b = document.getElementById('island').getBoundingClientRect(); return { w: b.width, h: b.bottom }; })()`);
      const slackW = b.width - r.w * z;
      const slackH = b.height - r.h * z;
      return { b, slackW, slackH, ok: slackW >= -1 && slackH >= -1 && slackW <= 60 && slackH <= 40 };
    };

    await step(`interface is in ${LANG} with the matching direction, and no text of the other language shows`, async () => {
      const r = await js(`({ lang: document.documentElement.lang, dir: document.documentElement.dir })`);
      assert.deepStrictEqual(r, { lang: LANG, dir: LANG === 'ar' ? 'rtl' : 'ltr' });
      if (LANG === 'en') {
        // every panel's text, built or not yet on screen
        const text = await js(`Island.relang(), ['clock','music','timer','calendar','clipboard','shelf','notes','battery','system','usage','github'].map((id) => { const f = Island.feature(id); return Object.values(f).filter((v) => v instanceof HTMLElement).map((e) => e.innerText + ' ' + [...e.querySelectorAll('[title],[placeholder]')].map((x) => (x.title || '') + (x.placeholder || '')).join(' ')).join(' '); }).join(' ')`);
        const arabic = text.match(/[\u0600-\u06FF][^\n]{0,30}/g);
        assert(!arabic, 'Arabic text in the English interface: ' + JSON.stringify(arabic));
      }
    });

    await step('when idle the window is only as big as the thin line (does not cover tabs or pages)', async () => {
      xmouse('move', 5, 400);
      await js('Island.configure({ autoHide: "always" }); 0');
      await waitFor('thin line', () => js('Island.isSliver()'), 6000);
      await sleep(800);
      const fit = await windowFitsIsland();
      assert(fit.ok && fit.b.width < 160 && fit.b.height < 40, 'idle window too big: ' + JSON.stringify(fit));
      await js('Island.configure({ autoHide: "auto" }); 0');
    });

    await step('hovering the island opens the panel and the window grows to fit it', async () => {
      // pick the music panel as if the user chose it, so a real prayer time or meeting nearby cannot win
      await js('Island.selectFeature("music"); 0');
      await hoverIsland();
      await waitFor('panel open', () => js('Island.isExpanded()'));
      await sleep(900);
      const fit = await windowFitsIsland();
      assert(fit.ok, 'window does not fit the open panel: ' + JSON.stringify(fit));
    });

    await step('play/pause button click reaches the app', async () => {
      xmouse('move', ...(await screenPoint('.ctl.main')));
      await sleep(150);
      xmouse('click');
      await waitFor('playpause command', () => controls.some((c) => c[0] === 'playpause'));
    });

    await step('next and previous buttons work', async () => {
      xmouse('move', ...(await screenPoint('.ctls .ctl:nth-child(5)')));
      await sleep(150);
      xmouse('click');
      await waitFor('next command', () => controls.some((c) => c[0] === 'next'));
      xmouse('move', ...(await screenPoint('.ctls .ctl:nth-child(1)')));
      await sleep(150);
      xmouse('click');
      await waitFor('prev command', () => controls.some((c) => c[0] === 'prev'));
    });

    await step('+10s / -10s buttons seek relative to the current position', async () => {
      xmouse('move', ...(await screenPoint('.ctls .ctl:nth-child(4)')));
      await sleep(150);
      xmouse('click');
      const c = await waitFor('seek command', () => controls.find((x) => x[0] === 'seek'));
      assert(c[1] > 30 && c[1] < 60, 'seek target should be ~40s, got ' + c[1]);
    });

    await step('clicking the progress bar seeks to that point', async () => {
      controls.length = 0;
      xmouse('move', ...(await screenPoint('.bar', 0.75, 0.5)));
      await sleep(200);
      xmouse('click');
      const c = await waitFor('bar seek', () => controls.find((x) => x[0] === 'seek'));
      assert(Math.abs(c[1] - 150) < 6, 'expected ~150s (75% of 200s), got ' + c[1]);
    });

    await step('mouse wheel switches to the timer panel and its Start button works', async () => {
      xmouse('move', ...(await screenPoint('#island', 0.5, 0.3)));
      await sleep(200);
      xmouse('scroll', 'down');
      await waitFor('timer panel visible', () => js(`!!document.querySelector('.timer-expanded') && document.querySelector('.timer-expanded').isConnected`));
      await sleep(400);
      xmouse('move', ...(await screenPoint('.timer-expanded .pill.primary')));
      await sleep(150);
      xmouse('click');
      await waitFor('timer running', () => js("Island.feature('timer').running"));
    });

    await step('stays open while the pointer rests and the window resizes under it (no phantom mouseleave)', async () => {
      // start from the small resting pill, as a user would
      await js('Island.configure({ autoHide: "never" }); 0');
      xmouse('move', 5, 400);
      await waitFor('resting', async () => !(await js('Island.isExpanded()')), 6000);
      await sleep(900);
      // bring the pointer onto the pill (enter the window, then one small move) and then do not move it again:
      // the pill opens around the still pointer, the window grows and re-centres under it
      const [x, y] = await screenPoint('#island');
      xmouse('move', x, y);
      await sleep(120);
      xmouse('move', x + 2, y + 1);
      await waitFor('open by hover', () => js('Island.isExpanded()'), 3000);
      const trace = [];
      const ids = ['clock', 'timer', 'music'];
      for (let i = 0; i < 24; i++) {
        if (i === 8 || i === 16) await js(`Island.selectFeature(${JSON.stringify(ids[i / 8])}); Island.render(); 0`);
        trace.push((await js('Island.isExpanded()')) ? 'O' : '_');
        await sleep(125);
      }
      await js('Island.configure({ autoHide: "auto" }); 0');
      assert(!trace.includes('_'), 'closed by itself while the pointer did not move: ' + trace.join(''));
    });

    await step('a real exit that no mouseleave announced still closes it (main-process cursor watch)', async () => {
      xmouse('move', 5, 400);
      await waitFor('closed after leaving', async () => !(await js('Island.isExpanded()')), 4000);
      // simulate a stale "pointer is over the island" in the renderer while the real cursor is far away:
      // the main process sees the cursor outside and reports it, so the island does not stay (or get) stuck open
      await js('Island.setHover(true); 0');
      await waitFor('stale hover cleared by the cursor watch', () => js('!Island.debug().pointer && !Island.isExpanded()'), 2500);
      await sleep(800);
      assert.strictEqual(await js('Island.isExpanded()'), false, 'island opened from a stale hover state');
    });

    await step('timer: 5/15/30 presets, custom length with − / +, and the stopwatch', async () => {
      await js('Island.open("timer"); Island.feature("timer").setMode("quick"); 0');
      await sleep(700);
      const chip = await js(`[...document.querySelectorAll('.timer-expanded .chip')].map((c) => c.textContent)`);
      assert.strictEqual(chip.length, 3, 'three presets: ' + JSON.stringify(chip));
      xmouse('move', ...(await screenPoint('.timer-expanded .chip:nth-child(2)')));
      await sleep(150);
      xmouse('click');
      await waitFor('15 minutes', () => js('Island.feature("timer").total === 900'));
      xmouse('move', ...(await screenPoint('.timer-expanded .stepper .step:last-child')));
      await sleep(150);
      xmouse('click');
      await waitFor('custom 11 minutes', () => js('Island.feature("timer").total === 660'));
      await js('Island.feature("timer").setMode("stopwatch"); 0');
      await sleep(400);
      xmouse('move', ...(await screenPoint('.timer-expanded .pill.primary')));
      await sleep(150);
      xmouse('click');
      await sleep(1300);
      const e = await js('Island.feature("timer").elapsed()');
      assert(e > 0.9 && e < 3, 'stopwatch counts: ' + e);
      await js('Island.feature("timer").reset(); Island.feature("timer").setMode("focus"); Island.togglePin(); 0');
      xmouse('move', 5, 400);
      await waitFor('closed', async () => !(await js('Island.isExpanded()')), 6000);
    });

    await step('"over the page" tint applies only while resting', async () => {
      await js('Island.configure({ autoHide: "never" }); 0');
      win.webContents.send('surface:tint', { r: 240, g: 240, b: 244 });
      await waitFor('tinted while resting', () => js(`document.getElementById('island').classList.contains('tinted')`), 3000).catch(async (e) => {
        throw new Error(e.message + ' ' + JSON.stringify(await js('({ ...Island.debug(), cls: document.getElementById("island").className })')));
      });
      await js('Island.open("clock"); 0');
      await waitFor('not tinted when open', async () => !(await js(`document.getElementById('island').classList.contains('tinted')`)), 3000);
      await js('Island.togglePin(); Island.configure({ autoHide: "auto" }); 0');
      win.webContents.send('surface:tint', null);
      await sleep(600);
    });

    // realistic data for every panel
    win.webContents.send('clipboard:update', ['url', 'phone', 'color', 'math'].map((type, i) => ({ id: i + 1, type, text: 'item ' + i, digits: '+966551234567', color: '#ff5733', rgb: 'rgb(1,2,3)', result: 5, pinned: i === 0 })));
    win.webContents.send('shelf:update', [1, 2, 3, 4].map((i) => ({ id: i, name: 'file-' + i + '.pdf', path: 'C:/f' + i, icon: null, isDir: false })));
    const now = Date.now();
    win.webContents.send('calendar:update', { status: 'ok', events: [1, 2, 3].map((i) => ({ id: 'e' + i, title: 'Meeting ' + i, start: now + i * 3600000, end: now + i * 3600000 + 1800000, url: 'https://zoom.us/j/1' })) });
    win.webContents.send('bluetooth:update', [{ name: 'Headphones', battery: 80 }, { name: 'Mouse', battery: 40 }]);
    await sleep(300);

    await step('panels never overlap the tab dots and fit inside the island', async () => {
      // data for the panels that only appear with data
      win.webContents.send('usage:update', { total: 5400, apps: [{ name: 'Chrome', seconds: 3000 }, { name: 'VS Code', seconds: 1800 }, { name: 'WhatsApp', seconds: 600 }] });
      win.webContents.send('github:update', { status: 'ok', items: [{ id: '1', title: 'Fix the build on Windows', type: 'PullRequest', repo: 'me/islandly', url: 'https://github.com/me/islandly/pull/1' }, { id: '2', title: 'Crash when the clipboard is empty', type: 'Issue', repo: 'me/islandly', url: 'https://github.com/me/islandly/issues/2' }] });
      await sleep(400);
      const shotDir = process.env.ISLANDLY_SHOTS;
      if (shotDir) {
        fs.mkdirSync(shotDir, { recursive: true });
        let n = 0;
        // the page asks for a screenshot by setting a flag; the main process captures the real window
        const timer = setInterval(async () => {
          const id = await js('window.__wantShot || null');
          if (id) {
            await js('window.__wantShot = null');
            fs.writeFileSync(path.join(shotDir, String(++n).padStart(2, '0') + '-' + id + '.png'), (await win.webContents.capturePage()).toPNG());
          }
        }, 60);
        setTimeout(() => clearInterval(timer), 12000);
      }
      const report = await js(`window.__shot = async (id) => { window.__wantShot = id; await new Promise((r) => setTimeout(r, 400)); };
      (async () => {
        const out = [];
        const feed = (ch, payload) => window.__feed(ch, payload);
        for (const id of ['today', 'music', 'timer', 'calendar', 'clipboard', 'shelf', 'notes', 'battery', 'system', 'usage', 'github']) {
          Island.open(id);
          await new Promise((r) => setTimeout(r, 700));
          const isl = document.getElementById('island').getBoundingClientRect();
          const view = document.querySelector('#content > .view');
          const dots = document.querySelector('.dots');
          const v = view.getBoundingClientRect();
          const d = dots.getBoundingClientRect();
          if (window.__shot) await window.__shot(id);
          out.push({ id, islandH: Math.round(isl.height), contentBottom: Math.round(v.bottom), dotsTop: Math.round(d.top), islandBottom: Math.round(isl.bottom) });
        }
        return out;
      })()`);
      const bad = report.filter((r) => r.contentBottom > r.dotsTop + 1 || r.contentBottom > r.islandBottom + 1);
      assert.strictEqual(bad.length, 0, 'overlap: ' + JSON.stringify(bad));
    });

    await step('moving away closes the island and the window shrinks back', async () => {
      await js('Island.open("music"); Island.togglePin(); 0');
      xmouse('move', 5, 400);
      await waitFor('island collapsed', async () => !(await js('Island.isExpanded()')), 6000);
      await sleep(900);
      const fit = await windowFitsIsland();
      assert(fit.ok, 'window not trimmed after closing: ' + JSON.stringify(fit));
    });

    await step('typing in the to-do field adds a task with the real keyboard', async () => {
      await js('Island.open("notes"); 0');
      await sleep(900);
      const [x, y] = await screenPoint('.nt-input');
      xmouse('move', x, y);
      await sleep(500);
      xmouse('click');
      await sleep(600);
      xmouse('type', 'buy milk');
      xmouse('key', 'Return');
      await waitFor('task added', async () => (await js(`[...document.querySelectorAll('.nt-text')].map((e) => e.textContent).join('|')`)).includes('buy milk'), 4000);
      // leaving the field gives focus back, so the island never keeps keyboard focus
      await js('document.querySelector(".nt-input").blur(); 0');
      await sleep(300);
      // after typing the island must not stay stuck open
      await js('Island.togglePin(); 0');
      xmouse('move', 5, 400);
      await waitFor('island collapsed after typing', async () => !(await js('Island.isExpanded()')), 6000);
      assert.strictEqual(win.isFocusable(), false, 'window still accepts focus after the to-do panel closed');
    });

    await step('mic/camera indicator stays visible while in use and the window fits it', async () => {
      win.webContents.send('privacy:update', { mic: ['Zoom'], cam: ['Zoom'] });
      await sleep(4500); // after the announcement (peek) it settles into the compact indicator
      await sleep(5600); // longer than the auto-hide delay: it must not shrink to the thin line
      const view = await js(`document.querySelector('#content > .view') && document.querySelector('#content > .view').className`);
      assert(/privacy-compact/.test(view), 'indicator not shown: ' + view);
      if (process.env.ISLANDLY_SHOTS) fs.writeFileSync(path.join(process.env.ISLANDLY_SHOTS, '20-privacy.png'), (await win.webContents.capturePage()).toPNG());
      await sleep(500);
      const fit = await windowFitsIsland();
      assert(fit.ok, 'window does not fit the indicator: ' + JSON.stringify(fit));
      win.webContents.send('privacy:update', { mic: [], cam: [] });
      await waitFor('indicator gone', async () => !/privacy-compact/.test(await js(`(document.querySelector('#content > .view') || {}).className || ''`)), 4000);
    });

    await step('switching the language is instant: no reload, the open panel and a running timer are kept', async () => {
      const other = LANG === 'ar' ? 'en' : 'ar';
      await js('window.__noReload = 1; const tm = Island.feature("timer"); tm.setMode("quick"); tm.setMinutes(5); tm.start(); Island.open("timer"); 0');
      await sleep(700);
      const before = await js('document.querySelector(".timer-expanded .t-title").textContent');
      const settings = await js('({ ...API.settings })');
      win.webContents.send('settings:update', { ...settings, uiLang: other, lang: other });
      await waitFor('language switched', async () => (await js('document.documentElement.lang')) === other, 2000);
      const r = await js(`({ dir: document.documentElement.dir, marker: window.__noReload, running: Island.feature('timer').running, panel: Island.selectedId(), title: document.querySelector('.timer-expanded .t-title').textContent, expect: t('quickTimer'), tab: document.querySelector('.timer-expanded .seg-btn').textContent, tabExpect: t('focus') })`);
      assert.strictEqual(r.marker, 1, 'the page reloaded');
      assert.strictEqual(r.dir, other === 'ar' ? 'rtl' : 'ltr');
      assert.strictEqual(r.running, true, 'the timer stopped');
      assert.strictEqual(r.panel, 'timer', 'the open panel changed');
      assert.strictEqual(r.title, r.expect);
      assert.notStrictEqual(r.title, before);
      assert.strictEqual(r.tab, r.tabExpect);
      win.webContents.send('settings:update', { ...settings, uiLang: LANG, lang: LANG });
      await waitFor('language back', async () => (await js('document.documentElement.lang')) === LANG, 2000);
      assert.strictEqual(await js('document.querySelector(".timer-expanded .t-title").textContent'), before);
      await js('Island.feature("timer").reset(); Island.feature("timer").setMode("focus"); Island.togglePin(); 0');
      xmouse('move', 5, 400);
      await waitFor('closed', async () => !(await js('Island.isExpanded()')), 6000);
    });

    await step('pushing the cursor against the top screen edge opens the island and keeps it open', async () => {
      await js('Island.configure({ autoHide: "always" }); 0');
      xmouse('move', 5, 400);
      await waitFor('island back to a thin line', () => js('Island.isSliver()'), 6000);
      await sleep(800);
      const [x] = await screenPoint('#island');
      xmouse('move', x, 0);
      await waitFor('opens from the top edge', () => js('Island.isExpanded()'), 3000);
      await sleep(1500);
      assert.strictEqual(await js('Island.isExpanded()'), true, 'island flickered closed while the cursor sat on the top edge');
    });

    console.log(results.join('\n'));
    console.log('E2E ' + (results.some((r) => r.startsWith('FAIL')) ? 'FAILED' : 'OK'));
    app.exit(results.some((r) => r.startsWith('FAIL')) ? 1 : 0);
  }, 3500)
);

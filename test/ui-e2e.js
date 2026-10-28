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

    // realistic data for every panel
    win.webContents.send('clipboard:update', ['url', 'phone', 'color', 'math'].map((type, i) => ({ id: i + 1, type, text: 'item ' + i, digits: '+966551234567', color: '#ff5733', rgb: 'rgb(1,2,3)', result: 5, pinned: i === 0 })));
    win.webContents.send('shelf:update', [1, 2, 3, 4].map((i) => ({ id: i, name: 'file-' + i + '.pdf', path: 'C:/f' + i, icon: null, isDir: false })));
    const now = Date.now();
    win.webContents.send('calendar:update', { status: 'ok', events: [1, 2, 3].map((i) => ({ id: 'e' + i, title: 'Meeting ' + i, start: now + i * 3600000, end: now + i * 3600000 + 1800000, url: 'https://zoom.us/j/1' })) });
    win.webContents.send('bluetooth:update', [{ name: 'Headphones', battery: 80 }, { name: 'Mouse', battery: 40 }]);
    await sleep(300);

    await step('panels never overlap the tab dots and fit inside the island', async () => {
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
        for (const id of ['today', 'music', 'timer', 'calendar', 'clipboard', 'shelf', 'notes', 'battery', 'system']) {
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

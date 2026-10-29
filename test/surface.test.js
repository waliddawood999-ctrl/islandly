// Unit tests for src/main/surface.js with a fake Win32 layer (no Electron, no Windows needed).
const assert = require('assert');
const { Surface, SAMPLE_MS } = require('../src/main/surface');

let passed = 0;
const ok = (cond, msg) => {
  assert.ok(cond, msg);
  passed++;
};

function fakes({ withAppBar = true, withSampling = true, colours } = {}) {
  const calls = [];
  const hwnd = Buffer.from([1, 2, 3, 4, 5, 6, 7, 8]);
  const win = {
    destroyed: false,
    isDestroyed() {
      return this.destroyed;
    },
    getNativeWindowHandle: () => hwnd,
    getBounds: () => ({ x: 700, y: 0, width: 200, height: 60 }),
    hooks: {},
    hookWindowMessage(msg, cb) {
      this.hooks[msg] = cb;
    },
  };
  const win32 = {};
  if (withAppBar)
    win32.appBar = {
      CALLBACK_MESSAGE: 0x8000 + 0x1a1,
      TASKBAR_CREATED_MESSAGE: 0xc123,
      register: (h, msg) => (calls.push(['register', h === hwnd, msg]), true),
      setPos: (h, rect) => (calls.push(['setPos', rect]), rect),
      remove: (h) => (calls.push(['remove', h === hwnd]), true),
    };
  if (withSampling) win32.sampleScreenColor = (pts) => (calls.push(['sample', pts.length]), colours ? colours() : pts.map(() => ({ r: 240, g: 240, b: 244 })));
  const screen = {
    getDisplayMatching: () => ({ bounds: { x: 0, y: 0, width: 1600, height: 900 } }),
    dipToScreenRect: (_w, r) => ({ x: r.x * 1.5, y: r.y * 1.5, width: r.width * 1.5, height: r.height * 1.5 }),
    dipToScreenPoint: (p) => ({ x: p.x * 1.5, y: p.y * 1.5 }),
  };
  const tints = [];
  const logs = [];
  const s = new Surface({ win32, screen, getWindow: () => win, onTint: (t) => tints.push(t), log: (...a) => logs.push(a.join(' ')) });
  return { s, calls, tints, logs, win };
}

const names = (calls) => calls.map((c) => c[0]);

(async () => {
  // --- appbar: register, position, remove on switch back and on stop
  {
    const { s, calls, win } = fakes();
    s.setBarHeight(35.2); // DIP -> ceil 36
    s.setMode('appbar');
    ok(names(calls).join(',') === 'remove,register,setPos', 'entering appbar removes any old bar, registers, positions: ' + names(calls));
    const pos = calls.find((c) => c[0] === 'setPos')[1];
    ok(
      pos.left === 0 && pos.top === 0 && pos.right === 2400 && pos.bottom === 54,
      'bar rect is the display width x resting height, in physical px: ' + JSON.stringify(pos)
    );
    ok(calls[1][2] === 0x81a1, 'the callback message is passed to ABM_NEW');

    calls.length = 0;
    s.setMode('appbar');
    ok(calls.length === 0, 'setting the same mode again does nothing');

    // ABN_POSCHANGED re-positions the bar
    win.hooks[0x81a1](Buffer.from([1, 0, 0, 0, 0, 0, 0, 0]));
    ok(names(calls).join(',') === 'setPos', 'ABN_POSCHANGED asks for the position again');

    calls.length = 0;
    win.hooks[0xc123]();
    ok(names(calls).join(',') === 'remove,register,setPos', 'Explorer restarted (TaskbarCreated): the bar is registered again: ' + names(calls));

    calls.length = 0;
    s.setBarHeight(48);
    ok(names(calls).join(',') === 'setPos' && calls[0][1].bottom === 72, 'a new resting height re-positions the bar');

    calls.length = 0;
    s.setMode('overlay');
    ok(names(calls)[0] === 'remove', 'switching back to overlay removes the bar first');
    ok(!s.barRegistered, 'no bar registered after the switch');

    s.setMode('appbar');
    calls.length = 0;
    s.stop();
    ok(names(calls).join(',') === 'remove', 'stop() removes the bar (quit / crash handler)');
    calls.length = 0;
    s.stop();
    ok(calls.length === 0, 'a second stop() is harmless');
  }

  // --- appbar hooks missing (before T7): no crash, logged once per attempt
  {
    const { s, logs } = fakes({ withAppBar: false });
    s.setMode('appbar');
    ok(!s.barRegistered && logs.some((l) => l.includes('T7')), 'without AppBar hooks the mode degrades and says why');
    s.stop();
  }

  // --- overlay sampling: only while resting + visible, averaged, change-suppressed, cleared when stopped
  {
    let colour = { r: 240, g: 240, b: 244 };
    const { s, calls, tints } = fakes({ colours: () => [colour, { ...colour, r: colour.r - 10 }, colour] });
    s.setMode('overlay');
    ok(!calls.some((c) => c[0] === 'sample'), 'no sampling while the island is open');
    s.setResting(true);
    ok(calls.filter((c) => c[0] === 'sample').length === 1, 'sampling starts at once when resting');
    ok(calls.find((c) => c[0] === 'sample')[1] === 3, 'three points around the window');
    ok(tints.length === 1 && tints[0].r === 237 && tints[0].g === 240, 'the tint is the average: ' + JSON.stringify(tints[0]));

    await new Promise((r) => setTimeout(r, SAMPLE_MS + 60));
    ok(calls.filter((c) => c[0] === 'sample').length === 2, 'samples twice a second at most');
    ok(tints.length === 1, 'an unchanged colour is not sent again');

    colour = { r: 20, g: 20, b: 24 };
    await new Promise((r) => setTimeout(r, SAMPLE_MS + 60));
    ok(tints.length === 2 && tints[1].r < 30, 'a new page colour is sent');

    s.setVisible(false);
    const before = calls.length;
    await new Promise((r) => setTimeout(r, SAMPLE_MS + 60));
    ok(calls.length === before, 'no sampling while hidden (fullscreen)');
    ok(tints[tints.length - 1] === null, 'the tint is cleared when sampling stops');

    s.setVisible(true);
    s.setMode('appbar');
    const n = calls.filter((c) => c[0] === 'sample').length;
    await new Promise((r) => setTimeout(r, SAMPLE_MS + 60));
    ok(calls.filter((c) => c[0] === 'sample').length === n, 'no sampling in the reserved-strip mode');
    s.stop();
  }

  // --- sampling hook missing or failing
  {
    const { s, tints } = fakes({ withSampling: false });
    s.setMode('overlay');
    s.setResting(true);
    ok(tints.length === 0 && !s.timer, 'no sampling hook: nothing runs');
    s.stop();
    const f = fakes({ colours: () => [null, { r: NaN, g: 1, b: 1 }] });
    f.s.setMode('overlay');
    f.s.setResting(true);
    ok(f.tints.length === 0, 'unusable colours are ignored');
    f.s.stop();
  }

  console.log(`surface tests: ${passed} passed`);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});

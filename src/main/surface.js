// How the island lives with the windows under it (Settings → "Pages under the island"):
//
//   'overlay' (default)  The island floats over the page. While it is resting (compact pill or thin line) and
//                        visible, it samples the colour just outside its window, at most twice a second, so the
//                        renderer can tint the pill to blend in. Sampling stops when it is open, hidden or idle.
//   'appbar'             The island registers a top AppBar (SHAppBarMessage), so Windows lays maximized windows
//                        out below a strip as tall as the resting island. When it opens it overlaps that strip
//                        and the windows under it only temporarily. The bar is removed on quit, on a switch back
//                        to 'overlay', and before every re-registration.
//
// Switching modes applies immediately, without a restart. In both modes the island hides for fullscreen apps
// (main.js applyVisibility).
//
// The Win32 side lives in win32.js and is built in task T7 (Codex). This file only depends on these hooks, and
// works without them (no tint, no reserved strip) until they exist:
//   win32.sampleScreenColor(points)        points: [{x, y}] in physical screen pixels -> [{r, g, b}] | null
//   win32.appBar.register(hwnd, callbackMessage) -> boolean           ABM_NEW
//   win32.appBar.setPos(hwnd, rect)        rect {left, top, right, bottom}, physical px -> granted rect | null   ABM_QUERYPOS + ABM_SETPOS
//   win32.appBar.remove(hwnd)              -> boolean                 ABM_REMOVE
//   win32.appBar.CALLBACK_MESSAGE          the window message ABN_* notifications arrive with (WM_APP + n)
//   win32.appBar.TASKBAR_CREATED_MESSAGE   RegisterWindowMessageW('TaskbarCreated'): Explorer restarted, bars are gone
// `hwnd` is the Buffer from BrowserWindow.getNativeWindowHandle().

const { AppBarSession } = require('./appbar-session');
const SAMPLE_MS = 500; // twice a second at most
const ABN_POSCHANGED = 1;

class Surface {
  /**
   * @param {object} o
   * @param {object} o.win32         the native hooks above (missing functions are fine)
   * @param {() => Electron.BrowserWindow|null} o.getWindow
   * @param {object} [o.screen]      Electron's screen module (DIP <-> physical pixels)
   * @param {(rgb: {r,g,b}|null) => void} o.onTint
   * @param {(...args) => void} [o.log]
   */
  constructor({ win32, getWindow, screen, onTint, userData, log = () => {}, now = () => performance.now() }) {
    this.win32 = win32 || {};
    this.getWindow = getWindow;
    this.screen = screen || null;
    this.onTint = onTint;
    this.log = log;
    this.appBar = userData && this.win32.appBar ? new AppBarSession({ native: this.win32.appBar, userData, log }) : this.win32.appBar;
    this.samplingEnabled = false;
    this.now = now;
    this.lastSampleAt = -Infinity;
    this.stopped = false;
    this.positioning = false;
    this.registeredHwnd = null;
    this.mode = null;
    this.resting = false;
    this.visible = true;
    this.timer = null;
    this.lastTint = '';
    this.barRegistered = false;
    this.barHeight = 0; // DIP, the resting island plus its top gap
    this.hooked = false;
    if (userData && this.appBar) {
      try { const hwnd = this.hwnd(); if (hwnd) this.appBar.recover(hwnd); }
      catch (err) { this.log('surface: AppBar recovery failed', err); }
    }
  }

  hasAppBar() {
    const a = this.appBar;
    return !!(a && typeof a.register === 'function' && typeof a.setPos === 'function' && typeof a.remove === 'function');
  }

  hasSampling() {
    return typeof this.win32.sampleScreenColor === 'function';
  }

  /** Apply a mode now. Safe to call repeatedly with the same mode. */
  setMode(mode) {
    const next = mode === 'appbar' ? 'appbar' : 'overlay';
    if (next === this.mode) return;
    const prev = this.mode;
    this.mode = next;
    if (prev === 'appbar') this.removeBar();
    if (next === 'appbar') this.registerBar();
    this.updateSampling();
  }

  /** The renderer reports whether the island is resting (compact pill or thin line) as opposed to open. */
  setSamplingEnabled(enabled) {
    this.samplingEnabled = enabled === true;
    this.updateSampling();
  }

  setResting(resting) {
    this.resting = !!resting;
    this.updateSampling();
  }

  /** Hidden for a fullscreen app or by the user: no sampling. The AppBar stays registered (Windows ignores it for fullscreen apps). */
  setVisible(visible) {
    this.visible = !!visible;
    this.updateSampling();
  }

  /** Height of the reserved strip in DIP (the resting island and its gap). Re-positions the bar if registered. */
  setBarHeight(dip) {
    const h = Math.max(0, Math.ceil(dip));
    if (h === this.barHeight) return;
    this.barHeight = h;
    if (this.barRegistered) this.positionBar();
  }

  // ---------------------------------------------------------------- appbar

  hwnd() {
    const win = this.getWindow();
    return win && !win.isDestroyed() ? win.getNativeWindowHandle() : null;
  }

  registerBar() {
    if (this.stopped) return;
    if (!this.hasAppBar()) {
      this.log('surface: AppBar hooks not available yet (T7); "reserved strip" acts like "over the page"');
      return;
    }
    const hwnd = this.hwnd();
    if (!hwnd) return;
    try {
      this.appBar.remove(hwnd); // never register twice
      this.hookNotifications();
      this.barRegistered = !!this.appBar.register(hwnd, this.appBar.CALLBACK_MESSAGE);
      if (this.barRegistered) { this.registeredHwnd = hwnd; this.positionBar(); }
      else this.log('surface: ABM_NEW refused');
    } catch (err) {
      this.barRegistered = false;
      this.log('surface: AppBar register failed', err);
    }
  }

  positionBar() {
    const win = this.getWindow();
    const hwnd = this.registeredHwnd || this.hwnd();
    if (this.stopped || this.positioning || !this.barRegistered || !hwnd || !this.barHeight || !this.screen || !win || win.isDestroyed()) return;
    this.positioning = true;
    try {
      const display = this.screen.getDisplayMatching(win.getBounds());
      const dip = { x: display.bounds.x, y: display.bounds.y, width: display.bounds.width, height: this.barHeight };
      const px = typeof this.screen.dipToScreenRect === 'function' ? this.screen.dipToScreenRect(win, dip) : dip;
      const granted = this.appBar.setPos(hwnd, { left: Math.round(px.x), top: Math.round(px.y), right: Math.round(px.x + px.width), bottom: Math.round(px.y + px.height) });
      if (!granted) { this.log('surface: AppBar position refused'); this.removeBar(); }
    } catch (err) { this.log('surface: AppBar setPos failed', err); this.removeBar(); }
    finally { this.positioning = false; }
  }

  removeBar() {
    if (!this.barRegistered || !this.hasAppBar()) {
      this.barRegistered = false;
      return;
    }
    const hwnd = this.registeredHwnd || this.hwnd();
    try {
      if (hwnd && !this.appBar.remove(hwnd)) { this.log('surface: AppBar remove refused; marker retained'); return; }
    } catch (err) {
      this.log('surface: AppBar remove failed', err);
      return;
    }
    this.barRegistered = false;
    this.registeredHwnd = null;
  }

  // ABN_POSCHANGED: another bar or the taskbar moved; ask for our position again.
  // TaskbarCreated: Explorer restarted and forgot every AppBar; register again.
  hookNotifications() {
    const bar = this.appBar || {};
    const win = this.getWindow();
    if (this.hooked || !bar.CALLBACK_MESSAGE || !win || typeof win.hookWindowMessage !== 'function') return;
    win.hookWindowMessage(bar.CALLBACK_MESSAGE, (wParam) => {
      const code = Buffer.isBuffer(wParam) ? Number(wParam.length >= 8 ? wParam.readBigUInt64LE(0) : wParam.readUInt32LE(0)) : Number(wParam);
      if (code === ABN_POSCHANGED && this.barRegistered) this.positionBar();
    });
    if (bar.TASKBAR_CREATED_MESSAGE) {
      win.hookWindowMessage(bar.TASKBAR_CREATED_MESSAGE, () => {
        if (this.mode !== 'appbar') return;
        this.barRegistered = false;
        this.registerBar();
      });
    }
    this.hooked = true;
  }

  // ---------------------------------------------------------------- colour sampling ('overlay')

  updateSampling() {
    const want = !this.stopped && this.samplingEnabled && this.mode === 'overlay' && this.resting && this.visible && this.hasSampling();
    if (want && !this.timer) {
      this.timer = setInterval(() => this.sample(), SAMPLE_MS);
      this.sample();
    } else if (!want && this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (!want && this.lastTint) {
      this.lastTint = '';
      this.onTint(null);
    }
  }

  /** Points just outside the window (left, right, below), so the island itself is never sampled. */
  samplePoints() {
    const win = this.getWindow();
    if (!win || win.isDestroyed()) return [];
    const b = win.getBounds();
    const pts = [
      { x: b.x - 6, y: b.y + Math.round(b.height / 2) },
      { x: b.x + b.width + 6, y: b.y + Math.round(b.height / 2) },
      { x: b.x + Math.round(b.width / 2), y: b.y + b.height + 6 },
    ];
    const toPx = this.screen && typeof this.screen.dipToScreenPoint === 'function' ? (p) => this.screen.dipToScreenPoint(p) : (p) => p;
    return pts.map(toPx).map(p => ({ x: Math.round(p.x), y: Math.round(p.y) }));
  }

  sample() {
    const win = this.getWindow();
    if (this.stopped || !this.samplingEnabled || this.mode !== 'overlay' || !this.resting || !this.visible || !win || win.isDestroyed() || (win.isVisible && !win.isVisible())) return;
    if (this.now() - this.lastSampleAt < SAMPLE_MS) return;
    this.lastSampleAt = this.now();
    let colours = null;
    try {
      colours = this.win32.sampleScreenColor(this.samplePoints());
    } catch (err) {
      this.log('surface: sampling failed', err);
    }
    const ok = Array.isArray(colours) ? colours.filter((c) => c && [c.r, c.g, c.b].every(Number.isFinite)) : [];
    if (!ok.length) return;
    const avg = (k) => Math.round(ok.reduce((s, c) => s + c[k], 0) / ok.length);
    const rgb = { r: avg('r'), g: avg('g'), b: avg('b') };
    // tell the renderer only about visible changes
    const key = [rgb.r >> 3, rgb.g >> 3, rgb.b >> 3].join(',');
    if (key === this.lastTint) return;
    this.lastTint = key;
    this.onTint(rgb);
  }

  stop() {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.removeBar();
  }
}

module.exports = { Surface, SAMPLE_MS };


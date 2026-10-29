const path = require('path');
const readline = require('readline');
const { Worker } = require('worker_threads');
const { spawnScript, isWindows } = require('./ps');
const win32 = require('./win32');

/**
 * "Now playing" comes from Windows (SMTC) through a worker thread.
 * Controls (play/pause, next, previous, seek) go through one long-lived PowerShell helper that talks to the
 * same SMTC session API, falling back to the system media keys when the app does not support a command.
 */
class MediaBridge {
  constructor(onUpdate, baseRoot) {
    this.onUpdate = onUpdate;
    this.baseRoot = baseRoot;
    this.worker = null;
    this.ps = null;
    this.nextId = 1;
    this.pending = new Map();
    this.playback = null;
    this.adhanApp = null;
    this.ready = false; // true once the helper has answered once (PowerShell needs a moment to start)
  }

  start() {
    if (!isWindows) {
      this.onUpdate({ type: 'unavailable', reason: 'not-windows' });
      return;
    }
    this.worker = new Worker(path.join(__dirname, 'media-worker.js'), { workerData: { baseRoot: this.baseRoot } });
    this.worker.on('message', (m) => { this.playback = m.type === 'media' ? m : null; this.onUpdate(m); });
    this.worker.on('error', (err) => this.onUpdate({ type: 'unavailable', reason: String(err) }));
    setTimeout(() => this.warmUp(), 4000);
  }

  stop() {
    if (this.worker) this.worker.terminate();
    if (this.ps) this.ps.kill();
  }

  helper() {
    if (this.ps) return this.ps;
    this.ps = spawnScript('media-ctl.ps1');
    if (!this.ps) return null;
    this.ps.on('exit', () => {
      this.ps = null;
      this.ready = false;
      for (const resolve of this.pending.values()) resolve({ ok: false });
      this.pending.clear();
    });
    readline.createInterface({ input: this.ps.stdout }).on('line', (line) => {
      try {
        const msg = JSON.parse(line);
        this.ready = true;
        const resolve = this.pending.get(msg.id);
        if (resolve) {
          this.pending.delete(msg.id);
          resolve(msg);
        }
      } catch (_) {
        /* ignore noise */
      }
    });
    return this.ps;
  }

  send(command) {
    const ps = this.helper();
    // Until the helper is up (or if it cannot start), play/pause/next/previous go straight to the media keys,
    // so the very first click works instantly and a slow helper can never cause a double toggle.
    const isKey = ['playpause', 'next', 'prev'].includes(command);
    if (!ps || (!this.ready && isKey)) {
      return Promise.resolve({ ok: isKey && win32.mediaKey(command), fallback: true });
    }
    return this.ask(ps, command);
  }

  ask(ps, command) {
    const id = this.nextId++;
    return new Promise((resolve) => {
      this.pending.set(id, resolve);
      ps.stdin.write(`${id} ${command}\n`);
      setTimeout(() => {
        if (this.pending.delete(id)) resolve({ ok: false });
      }, 6000);
    });
  }

  /** Start the helper early so it is ready by the time the user clicks something. */
  warmUp() {
    const ps = this.helper();
    if (ps) this.ask(ps, 'caps');
  }

  control(action, value) {
    if (action === 'seek') return this.send(`seek ${Number(value).toFixed(3)}`);
    if (['playpause', 'next', 'prev'].includes(action)) return this.send(action);
    return Promise.resolve({ ok: false });
  }

  isPlaying() { return !!(this.playback?.active && this.playback.playing); }

  async pauseForAdhan() {
    if (!this.isPlaying()) return { ok: false };
    const result = await this.send('pause'); // explicit SMTC pause, never a toggling media key
    if (result?.ok && result.app) this.adhanApp = result.app;
    return { ok: !!result?.ok && !!result.app };
  }

  async resumeAfterAdhan() {
    if (!this.adhanApp) return { ok: false };
    const app = this.adhanApp;
    const result = await this.send('play ' + Buffer.from(app).toString('base64'));
    if (result?.ok && this.adhanApp === app) this.adhanApp = null;
    return { ok: !!result?.ok };
  }

  capabilities() {
    return this.send('caps');
  }
}

module.exports = { MediaBridge };

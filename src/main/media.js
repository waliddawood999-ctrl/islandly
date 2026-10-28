const path = require('path');
const { Worker } = require('worker_threads');
const { host, isWindows } = require('./ps');
const win32 = require('./win32');
class MediaBridge {
  constructor(onUpdate, baseRoot) { this.onUpdate = onUpdate; this.baseRoot = baseRoot; this.worker = null; this.generation = 0; this.ready = false; this.running = false; }
  start() {
    if (this.running) return;
    this.running = true;
    const generation = ++this.generation;
    if (!isWindows) { this.onUpdate({ type: 'unavailable', reason: 'not-windows' }); return; }
    this.worker = new Worker(path.join(__dirname, 'media-worker.js'), { workerData: { baseRoot: this.baseRoot } });
    this.worker.on('message', value => { if (generation === this.generation) this.onUpdate(value); });
    this.worker.on('error', err => { if (generation === this.generation) this.onUpdate({ type: 'unavailable', reason: String(err) }); });
    // Metadata is event-driven. No PowerShell warmup process at idle.
  }
  stop() { this.running = false; this.generation++; this.worker?.terminate(); this.worker = null; this.ready = false; }
  async send(command) {
    if (!this.running) return { ok: false };
    const generation = this.generation;
    const key = ['playpause', 'next', 'prev'].includes(command);
    if (key && !this.ready) {
      // Warm the shared host with a read-only query; never queue a duplicate toggle behind the fallback.
      host.request('media', [], 'caps').then(result => { if (generation === this.generation) this.ready = !!result.ok; });
      return { ok: win32.mediaKey(command), fallback: true };
    }
    const result = await host.request('media', [], command, 6000);
    if (generation !== this.generation) return { ok: false };
    this.ready = true; return result;
  }
  control(action, value) {
    if (action === 'seek' && Number.isFinite(Number(value))) return this.send(`seek ${Math.max(0, Number(value)).toFixed(3)}`);
    if (['playpause', 'next', 'prev'].includes(action)) return this.send(action);
    return Promise.resolve({ ok: false });
  }
  async capabilities(interactive = false) {
    if (!interactive) return this.caps || { ok: false };
    const result = await this.send('caps'); this.caps = result; return result;
  }
}
module.exports = { MediaBridge };

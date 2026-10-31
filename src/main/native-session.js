// Lifetime protocol with the native owner. No renderer IPC names or UI source changes.
const readline = require('node:readline');
class NativeSession {
  constructor({ input, output, command, quit, busy, capture, restore, interval = 500, grace = 3000 }) {
    Object.assign(this, { output, command, quit, busy, capture, restore, grace });
    this.pending = new Map();
    this.nextRequest = 0;
    this.lastBusy = Date.now();
    this.ready = false;
    this.stopped = false;
    this.polling = false;
    this.lines = readline.createInterface({ input });
    this.lines.on('line', line => {
      const reply = /^shell-result:(\d+):([A-Za-z0-9+/=]*)$/.exec(line);
      if (reply) {
        const item = this.pending.get(Number(reply[1]));
        if (item) { clearTimeout(item.timer); this.pending.delete(Number(reply[1])); item.resolve(Buffer.from(reply[2], 'base64').toString()); }
        return;
      }
      if (['expand', 'settings', 'palette', 'pomodoro', 'stash', 'close', 'present', 'quit'].includes(line)) {
        this.lastBusy = Date.now();
        if (line === 'quit') quit(); else command(line);
      }
    });
    this.lines.on('close', () => quit()); // parent died: never leave a resident panel runtime
    this.timer = setInterval(() => this.poll(), interval);
  }
  send(kind, value = '') { if (!this.stopped) this.output.write(`ISLANDLY:${kind}:${value}\n`); }
  async loaded() {
    await this.restore();
    this.ready = true;
    this.lastBusy = Date.now();
    this.send('ready');
  }
  async poll() {
    if (!this.ready || this.stopped || this.polling) return;
    this.polling = true;
    try {
      const state = await this.capture();
      if (this.stopped) return;
      this.send('state', Buffer.from(JSON.stringify(state)).toString('base64'));
      if (this.busy() || this.pending.size) this.lastBusy = Date.now();
      else if (Date.now() - this.lastBusy >= this.grace) { this.send('idle'); this.stop(); this.quit(); }
    } catch (_) { this.lastBusy = Date.now(); } // failed snapshot must not discard live state
    finally { this.polling = false; }
  }
  external(kind, target) {
    if (!['url', 'path', 'reveal'].includes(kind) || typeof target !== 'string' || target.length > 32768 || this.stopped) return Promise.resolve('Native owner unavailable');
    const id = ++this.nextRequest;
    return new Promise(resolve => {
      const timer = setTimeout(() => { this.pending.delete(id); resolve('Native shell request timed out'); }, 5000);
      this.pending.set(id, { resolve, timer });
      this.send('shell', Buffer.from(JSON.stringify({ id, kind, target })).toString('base64'));
    });
  }
  stop() { for (const item of this.pending.values()) { clearTimeout(item.timer); item.resolve('Panel session closed'); } this.pending.clear(); this.stopped = true; clearInterval(this.timer); this.lines.removeAllListeners(); this.lines.close(); }
}
module.exports = { NativeSession };

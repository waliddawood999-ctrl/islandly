// Lifetime protocol with the native owner. No renderer IPC names or UI source changes.
const readline = require('node:readline');
class NativeSession {
  constructor({ input, output, command, quit, busy, capture, restore, interval = 500, grace = 3000 }) {
    Object.assign(this, { output, command, quit, busy, capture, restore, grace });
    this.lastBusy = Date.now();
    this.ready = false;
    this.stopped = false;
    this.polling = false;
    this.lines = readline.createInterface({ input });
    this.lines.on('line', line => {
      if (['expand', 'settings', 'palette', 'pomodoro', 'stash', 'close', 'quit'].includes(line)) {
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
      if (this.busy()) this.lastBusy = Date.now();
      else if (Date.now() - this.lastBusy >= this.grace) { this.send('idle'); this.stop(); this.quit(); }
    } catch (_) { this.lastBusy = Date.now(); } // failed snapshot must not discard live state
    finally { this.polling = false; }
  }
  stop() { this.stopped = true; clearInterval(this.timer); this.lines.removeAllListeners(); this.lines.close(); }
}
module.exports = { NativeSession };

const path = require('path');
const { spawn } = require('child_process');
const readline = require('readline');
const isWindows = process.platform === 'win32';
const ALLOWED = new Set(['bt-battery.ps1', 'brightness.ps1', 'explorer-selection.ps1', 'media']);
class CommandHost {
  constructor({ launch = spawn, windows = isWindows } = {}) {
    this.launch = launch; this.windows = windows; this.child = null; this.pending = new Map(); this.next = 0; this.failed = false; this.started = 0;
  }
  start() {
    if (this.child || this.failed || !this.windows) return this.child;
    const executable = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe');
    try {
      const child = this.launch(executable, ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, 'scripts/command-host.ps1')], { windowsHide: true, stdio: ['pipe', 'pipe', 'ignore'] });
      this.child = child; this.started++;
      child.on('error', () => this.shutdown(true));
      child.on('exit', () => { if (this.child === child) this.shutdown(true); });
      child.stdin.on('error', () => this.shutdown(true));
      this.lines = readline.createInterface({ input: child.stdout });
      this.lines.on('line', line => {
        if (line.length > 1024 * 1024) return this.shutdown(true);
        try {
          const response = JSON.parse(line), item = this.pending.get(response.id);
          if (item) { this.pending.delete(response.id); clearTimeout(item.timer); item.resolve(response); }
        } catch (_) { /* ignore non-protocol startup output */ }
      });
      return child;
    } catch (_) { this.failed = true; return null; }
  }
  request(script, args = [], command = '', timeout = 15000) {
    if (!ALLOWED.has(script) || !Array.isArray(args) || args.length > 1 ||
        (script === 'brightness.ps1' && args.length && (!Number.isInteger(Number(args[0])) || Number(args[0]) < 0 || Number(args[0]) > 100))) return Promise.resolve({ ok: false });
    if (this.pending.size >= 32) return Promise.resolve({ ok: false });
    const child = this.start(); if (!child) return Promise.resolve({ ok: false });
    const id = ++this.next;
    return new Promise(resolve => {
      const timer = setTimeout(() => this.shutdown(true), timeout);
      this.pending.set(id, { resolve, timer });
      try { child.stdin.write(JSON.stringify({ id, script, args, command }) + '\n'); } catch (_) { this.shutdown(true); }
    });
  }
  shutdown(failed = false) {
    this.failed = this.failed || failed;
    const child = this.child; this.child = null;
    this.lines?.close(); this.lines = null;
    for (const item of this.pending.values()) { clearTimeout(item.timer); item.resolve({ ok: false }); }
    this.pending.clear(); child?.kill();
  }
  pids() { return this.child?.pid ? [this.child.pid] : []; }
}
const host = new CommandHost();
async function runOnce(name, timeout = 15000, args = []) {
  const result = await host.request(name, args, '', timeout);
  return result.ok && typeof result.output === 'string' ? result.output.trim() : '';
}
module.exports = { runOnce, isWindows, host, CommandHost, stop: () => host.shutdown() };

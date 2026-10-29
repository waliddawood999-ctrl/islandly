const round = (n) => Math.round(n * 10) / 10;
class PerformanceMonitor {
  constructor({ app, windows = () => ({}), host, nativeOwnerPid = null, active = null, children = require('./owned-processes').list, metric = require('./native-perf').processMetrics, setTimer = setInterval, clearTimer = clearInterval }) {
    Object.assign(this, { app, windows, host, nativeOwnerPid, active, children, metric, setTimer, clearTimer });
    this.timer = null; this.target = null;
  }
  get() {
    const windows = this.windows();
    const active = this.active ? this.active() : Object.values(windows).some(w => w && !w.isDestroyed() && w.isVisible());
    const labels = new Map();
    for (const [label, w] of Object.entries(windows)) if (w && !w.isDestroyed()) labels.set(w.webContents.getOSProcessId(), label);
    const types = { Browser: 'browser', Tab: 'renderer', GPU: 'gpu', Utility: 'utility' };
    const processes = this.app.getAppMetrics().map((p) => ({ type: types[p.type] || 'other', pid: p.pid,
      mb: round(p.memory.workingSetSize / 1024), cpu: p.cpu.percentCPUUsage, label: labels.get(p.pid) || null }));
    const children = [...this.children(), ...(this.host ? this.host.pids().map((pid) => ({ pid, type: 'powershell' })) : [])];
    if (this.nativeOwnerPid) children.push({ pid: this.nativeOwnerPid, type: 'other', label: 'host' });
    const distinctChildren = [...new Map(children.map((p) => [p.pid, p])).values()];
    for (const child of distinctChildren) {
      if (processes.some((p) => p.pid === child.pid)) continue;
      const sample = this.metric(child.pid);
      if (sample) processes.push({ ...sample, mb: round(sample.mb), type: child.type, label: child.label || null });
    }
    return { state: active ? 'active' : 'idle', totalMB: round(processes.reduce((n, p) => n + p.mb, 0)), processes,
      powershellCount: distinctChildren.filter((p) => p.type === 'powershell').length, uptimeSec: Math.floor(process.uptime()) };
  }
  watch(win, on) {
    this.stop();
    if (on !== true || !win || win.isDestroyed() || !win.isVisible()) return;
    this.target = win;
    this.closed = () => this.stop();
    for (const event of ['closed', 'hide']) win.once(event, this.closed);
    win.webContents.once('render-process-gone', this.closed);
    win.webContents.once('did-start-loading', this.closed);
    this.timer = this.setTimer(() => {
      if (win.isDestroyed() || !win.isVisible()) return this.stop();
      try { win.webContents.send('perf:update', this.get()); } catch (_) { this.stop(); }
    }, 5000);
  }
  stop() {
    if (this.timer !== null) this.clearTimer(this.timer);
    this.timer = null;
    if (this.target) {
      for (const event of ['closed', 'hide']) this.target.removeListener(event, this.closed);
      this.target.webContents.removeListener('render-process-gone', this.closed);
      this.target.webContents.removeListener('did-start-loading', this.closed);
    }
    this.target = null;
  }
}
module.exports = { PerformanceMonitor };

const { processMetrics } = require('./native-perf');
const round = n => Math.round(n * 10) / 10;
class PerformanceMonitor {
  constructor({ app, windows = () => ({}), host, setTimer = setInterval, clearTimer = clearInterval }) { this.app = app; this.windows = windows; this.host = host; this.setTimer = setTimer; this.clearTimer = clearTimer; this.timer = null; this.target = null; }
  get() {
    const labels = new Map();
    for (const [label, win] of Object.entries(this.windows())) if (win && !win.isDestroyed()) labels.set(win.webContents.getOSProcessId(), label);
    const types = { Browser: 'browser', Tab: 'renderer', GPU: 'gpu', Utility: 'utility' };
    const processes = this.app.getAppMetrics().map(p => ({ type: types[p.type] || 'other', pid: p.pid, mb: round(p.memory.workingSetSize / 1024), cpu: p.cpu.percentCPUUsage, label: labels.get(p.pid) || null }));
    const pids = this.host.pids();
    for (const pid of pids) { const metric = processMetrics(pid); if (metric) processes.push({ ...metric, mb: round(metric.mb), type: 'powershell', label: null }); }
    return { totalMB: round(processes.reduce((sum, p) => sum + p.mb, 0)), processes, powershellCount: pids.length, uptimeSec: Math.floor(process.uptime()) };
  }
  watch(win, on) {
    this.stop();
    if (!on || !win || win.isDestroyed() || !win.isVisible()) return;
    this.target = win;
    const closed = () => this.stop(); this.closed = closed;
    win.once('closed', closed); win.once('hide', closed);
    this.timer = this.setTimer(() => {
      if (win.isDestroyed() || !win.isVisible()) return this.stop();
      win.webContents.send('perf:update', this.get());
    }, 5000);
  }
  stop() {
    if (this.timer) this.clearTimer(this.timer);
    this.timer = null;
    if (this.target) { this.target.removeListener('closed', this.closed); this.target.removeListener('hide', this.closed); }
    this.target = null;
  }
}
module.exports = { PerformanceMonitor };

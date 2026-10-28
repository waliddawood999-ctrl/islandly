const fs = require('fs');
const path = require('path');
const { handle, validRect } = require('./win32-surface');
function alive(pid) {
  try { process.kill(pid, 0); return true; } catch (err) { return err.code !== 'ESRCH'; }
}
class AppBarSession {
  constructor({ native, userData, isAlive = alive, pid = process.pid, log = () => {} }) {
    this.native = native;
    this.file = path.join(userData, 'appbar-marker.json');
    this.isAlive = isAlive; this.pid = pid; this.log = log;
    this.record = null; this.blocked = false;
  }
  get CALLBACK_MESSAGE() { return this.native.CALLBACK_MESSAGE; }
  get TASKBAR_CREATED_MESSAGE() { return this.native.TASKBAR_CREATED_MESSAGE; }
  write(record) {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const temp = this.file + '.tmp';
    const fd = fs.openSync(temp, 'w');
    try { fs.writeFileSync(fd, JSON.stringify(record)); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    fs.renameSync(temp, this.file);
  }
  recover(hwnd) {
    let marker;
    try { marker = JSON.parse(fs.readFileSync(this.file, 'utf8')); }
    catch (err) { if (err.code === 'ENOENT') return true; this.blocked = true; this.log('AppBar marker unreadable', err); return false; }
    if (!Number.isInteger(marker.pid) || marker.pid <= 0 || marker.edge !== 1 || (marker.rect && !validRect(marker.rect))) {
      this.blocked = true; this.log('AppBar marker invalid'); return false;
    }
    if (this.isAlive(marker.pid)) { this.blocked = true; this.log('AppBar marker belongs to a live process'); return false; }
    // Never send REMOVE to a saved HWND: Windows may already have recycled it for another app.
    let registered = false, removed = false;
    try {
      registered = this.native.register(hwnd, this.CALLBACK_MESSAGE);
      if (!registered) return false;
      if (marker.rect) this.native.setPos(hwnd, marker.rect);
    } finally {
      if (registered) removed = this.native.remove(hwnd);
      if (removed) fs.rmSync(this.file, { force: true });
      this.blocked = !removed;
    }
    return removed;
  }
  register(hwnd, message) {
    if (this.blocked || this.record) return false;
    try {
      this.record = { pid: this.pid, hwnd: handle(hwnd).toString(), edge: 1, rect: null };
      this.write(this.record); // before registration: a crash at any later point is recoverable
      if (this.native.register(hwnd, message)) return true;
      this.remove(hwnd);
    } catch (err) { this.log('AppBar registration/marker failed', err); this.remove(hwnd); }
    return false;
  }
  setPos(hwnd, rect) {
    if (!this.record || this.record.hwnd !== handle(hwnd).toString() || !validRect(rect)) return null;
    try {
      this.record = { ...this.record, rect: { ...rect } };
      this.write(this.record); // preserve intended edge/monitor before reserving space
      return this.native.setPos(hwnd, rect);
    } catch (err) { this.log('AppBar position/marker failed', err); return null; }
  }
  remove(hwnd) {
    if (this.blocked) return false;
    if (this.record && this.record.hwnd !== handle(hwnd).toString()) return false;
    try {
      const removed = this.native.remove(hwnd);
      if (removed && this.record) { fs.rmSync(this.file, { force: true }); this.record = null; }
      return removed;
    } catch (err) { this.log('AppBar removal failed', err); return false; }
  }
}
module.exports = { AppBarSession };

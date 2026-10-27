const path = require('path');
const { Worker } = require('worker_threads');
const { spawn } = require('child_process');

// Virtual-key codes for the system media keys.
const VK = { playpause: 0xb3, next: 0xb0, prev: 0xb1 };

const PS_INIT = `
Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class K { [DllImport("user32.dll")] public static extern void keybd_event(byte b, byte s, uint f, UIntPtr e); }'
`;

/**
 * Reads "now playing" from Windows (SMTC) in a worker thread and sends media keys
 * through one long-lived PowerShell process, so a button press costs ~no startup time.
 */
class MediaBridge {
  constructor(onUpdate) {
    this.onUpdate = onUpdate;
    this.worker = null;
    this.ps = null;
  }

  start() {
    if (process.platform !== 'win32') {
      this.onUpdate({ type: 'unavailable', reason: 'not-windows' });
      return;
    }
    this.worker = new Worker(path.join(__dirname, 'media-worker.js'));
    this.worker.on('message', (m) => this.onUpdate(m));
    this.worker.on('error', (err) => this.onUpdate({ type: 'unavailable', reason: String(err) }));
  }

  stop() {
    if (this.worker) this.worker.terminate();
    if (this.ps) this.ps.kill();
  }

  control(action) {
    const vk = VK[action];
    if (!vk || process.platform !== 'win32') return;
    if (!this.ps) {
      this.ps = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', '-'], { windowsHide: true });
      this.ps.on('exit', () => (this.ps = null));
      this.ps.stdin.write(PS_INIT + '\n');
    }
    this.ps.stdin.write(`[K]::keybd_event(${vk},0,0,[UIntPtr]::Zero); [K]::keybd_event(${vk},0,2,[UIntPtr]::Zero)\n`);
  }
}

module.exports = { MediaBridge };

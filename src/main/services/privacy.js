// Microphone / camera in use: Windows records each app's last use in the ConsentStore registry keys.
// An entry whose LastUsedTimeStop is 0 (and start is not) is using the device right now. Read with the built-in reg.exe.
const { execFile } = require('child_process');
const { prettyName } = require('./tracker');

const BASE = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\CapabilityAccessManager\\ConsentStore\\';

function query(device) {
  return new Promise((resolve) => {
    require('../owned-processes').track(execFile('reg.exe', ['query', BASE + device, '/s'], { windowsHide: true, timeout: 4000 }, (err, out) => resolve(err ? '' : String(out))), 'other');
  });
}

/** Parse `reg query /s` output into the list of apps currently using the device. */
function parseActive(text) {
  const keys = new Map(); // key -> {start, stop}
  let key = '';
  for (const line of String(text).split(/\r?\n/)) {
    if (/^HKEY_/i.test(line)) {
      key = line.trim();
      continue;
    }
    const m = /LastUsedTime(Start|Stop)\s+REG_QWORD\s+0x([0-9a-f]+)/i.exec(line);
    if (m && key) {
      const k = keys.get(key) || {};
      k[m[1].toLowerCase()] = !/^0+$/.test(m[2]);
      keys.set(key, k);
    }
  }
  const active = [];
  for (const [k, v] of keys) {
    if (!v.start || v.stop !== false) continue;
    const leaf = k.split('\\').pop();
    // NonPackaged apps are stored as their full path with # instead of \
    const name = leaf.includes('#') ? prettyName(leaf.split('#').pop()) : leaf.split('_')[0];
    if (name) active.push(name);
  }
  return [...new Set(active)];
}

class PrivacyWatcher {
  constructor(onChange) {
    this.onChange = onChange;
    this.timer = null;
    this.last = '';
  }

  start() {
    if (process.platform !== 'win32' || this.timer) return;
    this.timer = setInterval(() => this.poll(), 3000);
    this.poll();
  }

  stop() {
    clearInterval(this.timer);
    this.timer = null;
  }

  async poll() {
    const [mic, cam] = await Promise.all([query('microphone'), query('webcam')]);
    const state = { mic: parseActive(mic), cam: parseActive(cam) };
    const key = JSON.stringify(state);
    if (key !== this.last) {
      this.last = key;
      this.onChange(state);
    }
  }
}

module.exports = { PrivacyWatcher, parseActive };

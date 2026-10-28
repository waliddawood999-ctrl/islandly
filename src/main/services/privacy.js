// Microphone / camera in use: Windows records each app's last use in the ConsentStore registry keys.
// An entry whose LastUsedTimeStop is 0 (and start is not) is using the device right now. Read with native registry APIs and change notifications.
const { prettyName } = require('./tracker');
const native = require('../native-perf');

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
  constructor(onChange) { this.onChange = onChange; this.last = ''; this.cancel = null; this.generation = 0; }
  start() {
    if (this.cancel) return;
    const generation = ++this.generation;
    this.cancel = native.watchPrivacy(() => { if (generation === this.generation) this.poll(); });
    this.poll();
  }
  stop() { this.generation++; this.cancel?.(); this.cancel = null; }
  poll() {
    const names = values => [...new Set(values.map(leaf => leaf.includes('#') ? prettyName(leaf.split('#').pop()) : leaf.split('_')[0]))];
    const raw = native.readPrivacy(), state = { mic: names(raw.mic), cam: names(raw.cam) };
    const key = JSON.stringify(state);
    if (key !== this.last) { this.last = key; this.onChange(state); }
  }
}
module.exports = { PrivacyWatcher, parseActive };

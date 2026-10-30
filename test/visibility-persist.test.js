// The island visibility setting survives a restart: main stores it in settings.json, rejects junk, and the native host reads the same file.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Module = require('module');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'islandly-vis-'));
const realLoad = Module._load;
Module._load = function (request, ...rest) {
  if (request === 'electron') return { app: { getPath: () => dir } };
  return realLoad.call(this, request, ...rest);
};
const load = () => { delete require.cache[require.resolve('../src/main/settings.js')]; const s = require('../src/main/settings.js'); s.init(); return s; };
let s = load();
assert.strictEqual(s.get().islandVisibility, 'always', 'defaults to always visible');
s.set({ islandVisibility: 'approach' });
assert.strictEqual(JSON.parse(fs.readFileSync(path.join(dir, 'settings.json'), 'utf8')).islandVisibility, 'approach', 'written to settings.json for the native host');
s = load();
assert.strictEqual(s.get().islandVisibility, 'approach', 'restored after restart');
s.set({ islandVisibility: 'nonsense' });
assert.strictEqual(s.get().islandVisibility, 'approach', 'invalid value ignored');
fs.writeFileSync(path.join(dir, 'settings.json'), JSON.stringify({ islandVisibility: 'bogus' }));
s = load();
assert.strictEqual(s.get().islandVisibility, 'always', 'corrupt stored value falls back to always');
Module._load = realLoad;
fs.rmSync(dir, { recursive: true, force: true });
console.log('island visibility persistence ok');

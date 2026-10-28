const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');
const { latestRelease } = require('../src/main/releases');
const { gitBlobSha } = require('../src/main/util');

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'islandly-release-'));
const root = path.join(temp, 'base');
fs.mkdirSync(root);
fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ islandlyBase: 3 }));
global.__ISLANDLY = { root, baseRoot: root, version: '0.5.0' };
const sha = 'a'.repeat(40);
const requested = [];
let release = { tag_name: 'v0.6.0', draft: false, prerelease: false, target_commitish: 'main' };
let files = {};
let corrupt = false;
let missing = false;
let extra = [];
let base = 3;
async function fetch(url) {
  requested.push(url);
  const result = data => ({ ok: true, json: async () => data, text: async () => typeof data === 'string' ? data : JSON.stringify(data), arrayBuffer: async () => Buffer.from(data) });
  if (url.endsWith('/releases/latest')) return missing ? { ok: false, status: 404 } : result(release);
  if (url.endsWith('/commits/v0.6.0')) return result({ sha });
  if (url.includes('/git/trees/')) return result({ truncated: false, tree: [...Object.entries(files).map(([p, text]) => ({ type: 'blob', path: p, sha: gitBlobSha(Buffer.from(text)) })), ...extra] });
  const p = url.split('/' + sha + '/')[1];
  if (files[p] !== undefined) return result(corrupt && p === 'src/main/main.js' ? 'corrupt' : files[p]);
  throw new Error('Unexpected URL: ' + url);
}
const originalLoad = Module._load;
Module._load = function(id, ...args) {
  if (id === 'electron') return { app: { getPath: () => temp }, net: { fetch } };
  return originalLoad.call(this, id, ...args);
};
const { Updater } = require('../src/main/updater');
Module._load = originalLoad;

function reset() {
  files = {
    'package.json': JSON.stringify({ version: '0.6.0', islandlyBase: base }),
    'src/main/main.js': '// fixture',
  };
  fs.rmSync(path.join(temp, 'updates'), { recursive: true, force: true });
}
(async () => {
  reset();
  const r = await new Updater(() => {}).check();
  assert.equal(r.status, 'ready');
  assert(requested.some(u => u.endsWith('/releases/latest')));
  assert(requested.some(u => u.endsWith('/commits/v0.6.0')));
  assert(!requested.some(u => u.includes('/commits/main')));
  reset();
  corrupt = true;
  assert.match((await new Updater(() => {}).check()).message, /checksum/);
  assert(!fs.existsSync(path.join(temp, 'updates/current.json')));
  corrupt = false;
  reset();
  extra = [{ type: 'blob', path: 'src/../../escape.js', sha }];
  assert.match((await new Updater(() => {}).check()).message, /invalid release file/);
  assert(!fs.existsSync(path.join(temp, 'escape.js')));
  extra = [];
  base = 4;
  reset();
  assert.equal((await new Updater(() => {}).check()).status, 'needs-full-download');
  base = 3;
  reset();
  files['package.json'] = JSON.stringify({ version: '0.7.0', islandlyBase: 3 });
  assert.match((await new Updater(() => {}).check()).message, /mismatch/);
  for (const override of [{ draft: true }, { prerelease: true }, { tag_name: '../main' }, { tag_name: 'v1.0.0-rc.1' }]) {
    const old = release;
    release = { ...old, ...override };
    assert.equal((await new Updater(() => {}).check()).status, 'error');
    release = old;
  }
  missing = true;
  assert.equal((await new Updater(() => {}).check()).status, 'up-to-date');
  await assert.rejects(latestRelease(async () => { throw new Error('403 forbidden'); }, 'https://api.test'), /403/);
  console.log('release discovery: stable tags, immutable commits, no main, checksum/path rejection and full-download guard passed');
})().catch(err => { console.error(err); process.exitCode = 1; }).finally(() => fs.rmSync(temp, { recursive: true, force: true }));

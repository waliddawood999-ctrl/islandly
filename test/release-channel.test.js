const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');
const { spawnSync } = require('node:child_process');
const { gitBlobSha } = require('../src/main/util');
const state = require('../src/main/update-state');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'islandly-channel-'));
const root = path.join(temp, 'base');
const userData = path.join(temp, 'user');
const updates = path.join(userData, 'updates');
fs.mkdirSync(root);
const basePkg = { version: '1.0.0', islandlyBase: 3, dependencies: { fake: '1.0.0' } };
fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify(basePkg));
const originalLoad = Module._load;
const calls = [];
const sha = 'd'.repeat(40);
let remoteVersion = '1.1.0';
let remoteBase = 3;
let files;
let treeExtra = [];
let corrupt = null;
let releaseOverrides = {};
let status = 200;
let interrupted = null;
let truncated = false;
function remote() {
  files = {
    'package.json': JSON.stringify({ ...basePkg, version: remoteVersion, islandlyBase: remoteBase }),
    'src/main/main.js': '// ' + remoteVersion,
    'assets/note.txt': 'payload ' + remoteVersion,
  };
}
async function fetch(url, options) {
  calls.push(url);
  if (interrupted && url.includes('/assets/')) await interrupted(options.signal);
  if (url.endsWith('/releases/latest')) return new Response(JSON.stringify({ tag_name: 'v' + remoteVersion, draft: false, prerelease: false, target_commitish: 'main', ...releaseOverrides }), { status });
  if (url.includes('/commits/v')) return Response.json({ sha });
  if (url.includes('/git/trees/')) return Response.json({ truncated, tree: [...Object.entries(files).map(([p, c]) => ({ path: p, type: 'blob', mode: '100644', sha: gitBlobSha(Buffer.from(c)) })), ...treeExtra] });
  const file = decodeURIComponent(url.split('/' + sha + '/')[1] || '');
  if (files[file] !== undefined) return new Response(corrupt === file ? 'CORRUPT' : files[file]);
  throw new Error('Unexpected URL ' + url);
}
Module._load = function(id, ...args) {
  if (id === 'electron') return { app: { getPath: () => userData }, net: { fetch } };
  return originalLoad.call(this, id, ...args);
};
const { Updater, markBootOk } = require('../src/main/updater');
Module._load = originalLoad;
const read = name => state.readJson(path.join(updates, name + '.json'));
function boot() { return global.__ISLANDLY = state.selectBoot(root, userData); }
function clear() {
  fs.rmSync(updates, { recursive: true, force: true });
  remoteVersion = '1.1.0'; remoteBase = 3; corrupt = null; treeExtra = []; releaseOverrides = {}; truncated = false; status = 200; interrupted = null;
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify(basePkg));
  remote(); boot();
}
let passed = 0;
async function test(name, fn) {
  clear();
  await fn();
  console.log('PASS ' + name); passed++;
}
(async () => {
  await test('A -> B -> C retains the running tree and healthy B for rollback', async () => {
    assert.equal((await new Updater().check()).status, 'ready');
    assert.equal(read('current'), null, 'staging must not activate');
    assert.equal(boot().version, '1.1.0');
    markBootOk();
    const b = read('current');
    remoteVersion = '1.2.0'; remote();
    assert.equal((await new Updater().check()).status, 'ready');
    assert.deepEqual(read('current'), b, 'running pointer unchanged while staging C');
    assert.equal(fs.readFileSync(path.join(b.dir, 'src/main/main.js'), 'utf8'), '// 1.1.0');
    assert.equal(boot().version, '1.2.0');
    assert.equal(read('previous').version, '1.1.0');
    markBootOk();
    assert.equal(boot().version, '1.2.0'); markBootOk();
  });
  await test('unhealthy C rolls back to verified B and skips C on later checks', async () => {
    await new Updater().check(); boot(); markBootOk();
    remoteVersion = '1.2.0'; remote(); await new Updater().check(); boot();
    assert.equal(boot().version, '1.1.0'); markBootOk();
    assert(state.failedVersions(updates).includes('1.2.0'));
    assert.equal((await new Updater().check()).status, 'skipped');
    remoteVersion = '1.3.0'; remote();
    assert.equal((await new Updater().check()).status, 'ready');
    assert.equal(boot().version, '1.3.0'); markBootOk();
  });
  await test('first failed update falls back to packaged A', async () => {
    await new Updater().check(); boot();
    assert.equal(boot().version, '1.0.0');
    assert.equal(read('current'), null);
  });
  await test('corrupt download leaves active and previous pointers unchanged', async () => {
    await new Updater().check(); boot(); markBootOk();
    const b = read('current');
    remoteVersion = '1.2.0'; remote(); corrupt = 'assets/note.txt';
    assert.match((await new Updater().check()).message, /checksum/);
    assert.deepEqual(read('current'), b);
    assert.equal(read('staged'), null);
    assert.equal(fs.readdirSync(updates).some(p => p.startsWith('.download-')), false);
  });
  await test('post-download corruption is rejected before boot', async () => {
    await new Updater().check();
    fs.writeFileSync(path.join(read('staged').dir, 'src/main/main.js'), '// tampered');
    assert.equal(boot().version, '1.0.0');
    assert.equal(read('staged'), null);
  });
  await test('corrupted rollback tree falls back to packaged version', async () => {
    await new Updater().check(); boot(); markBootOk();
    const b = read('current');
    remoteVersion = '1.2.0'; remote(); await new Updater().check(); boot();
    fs.writeFileSync(path.join(b.dir, 'assets/note.txt'), 'tampered');
    assert.equal(boot().version, '1.0.0');
  });
  await test('release discovery ignores moving main, draft and prerelease', async () => {
    calls.length = 0;
    assert.equal((await new Updater().check()).status, 'ready');
    assert(calls.some(u => u.includes('/commits/v1.1.0')));
    assert(!calls.some(u => u.includes('/commits/main')));
    for (const value of [{ draft: true }, { prerelease: true }, { tag_name: '../main' }]) {
      releaseOverrides = value;
      assert.equal((await new Updater().check()).status, 'error');
    }
    releaseOverrides = {}; status = 404;
    assert.equal((await new Updater().check()).status, 'up-to-date');
    status = 403;
    assert.equal((await new Updater().check()).status, 'error');
  });
  await test('base2 and changed native/dependency bases require full download', async () => {
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ version: '0.4.0', islandlyBase: 2 }));
    assert.equal((await new Updater().check()).status, 'needs-full-download');
    assert.equal(read('staged'), null);
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify(basePkg));
    remoteBase = 4; remote();
    assert.equal((await new Updater().check()).status, 'needs-full-download');
    remoteBase = 3; remote();
    files['package.json'] = JSON.stringify({ ...basePkg, version: remoteVersion, dependencies: { fake: '2.0.0' } });
    assert.equal((await new Updater().check()).status, 'needs-full-download');
  });
  await test('tag/package mismatch, unsafe paths, duplicate names and symlink blobs fail closed', async () => {
    files['package.json'] = JSON.stringify({ ...basePkg, version: '1.9.0' });
    assert.match((await new Updater().check()).message, /mismatch/);
    remote();
    for (const p of ['src/../../escape', 'src/a\\b.js', 'src/CON.js', 'src/x.js:stream', 'src/test.']) {
      treeExtra = [{ type: 'blob', mode: '100644', path: p, sha }];
      assert.match((await new Updater().check()).message, /invalid release file/);
    }
    treeExtra = [{ type: 'blob', mode: '100644', path: 'src/MAIN/main.js', sha }];
    assert.match((await new Updater().check()).message, /invalid release file/);
    treeExtra = [{ type: 'blob', mode: '120000', path: 'src/link', sha }];
    assert.match((await new Updater().check()).message, /invalid release file/);
    treeExtra = []; truncated = true;
    assert.match((await new Updater().check()).message, /incomplete/);
    assert.equal(read('staged'), null);
  });
  await test('stop cancels an in-flight download and cannot publish staged state', async () => {
    let started;
    const waiting = new Promise(resolve => { started = resolve; });
    interrupted = signal => new Promise((resolve, reject) => {
      started();
      signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
    });
    let notified = false;
    const updater = new Updater(() => { notified = true; });
    const check = updater.check();
    await waiting;
    assert.equal((await updater.check()).status, 'busy');
    updater.stop();
    assert.equal((await check).status, 'cancelled');
    assert.equal(read('staged'), null); assert.equal(notified, false);
  });
  await test('manifest tampering and pointers outside updates cannot execute', async () => {
    await new Updater().check();
    const staged = read('staged');
    fs.writeFileSync(path.join(staged.dir, 'manifest.json'), '[]');
    assert.equal(boot().version, '1.0.0');
    state.atomicJson(path.join(updates, 'staged.json'), { ...staged, dir: root });
    assert.equal(boot().version, '1.0.0');
  });
  await test('real bootstrap processes resolve packaged dependencies, survive forced termination and ignore second launches', async () => {
    fs.mkdirSync(path.join(root, 'src/main'), { recursive: true });
    for (const name of ['bootstrap.js', 'update-state.js', 'util.js']) fs.copyFileSync(path.join(__dirname, '../src/main', name), path.join(root, 'src/main', name));
    fs.mkdirSync(path.join(root, 'node_modules/bootstrap-fixture'), { recursive: true });
    fs.writeFileSync(path.join(root, 'node_modules/bootstrap-fixture/index.js'), 'module.exports = 42;');
    const main = `const info = global.__ISLANDLY;
      console.log('RUN ' + info.version + ' ' + require('bootstrap-fixture'));
      if (process.env.CRASH_VERSION === info.version) process.kill(process.pid, 'SIGKILL');
      require(require('path').join(info.baseRoot, 'src/main/update-state.js')).markHealthy(info);`;
    fs.writeFileSync(path.join(root, 'src/main/main.js'), main);
    const launcher = path.join(temp, 'launch.cjs');
    fs.writeFileSync(launcher, `const Module = require('module'), original = Module._load;
      Module._load = function(id, ...args) { if (id === 'electron') return { app: {
        getPath: () => ${JSON.stringify(userData)}, requestSingleInstanceLock: () => process.env.SECOND !== '1', quit: () => console.log('SECOND')
      } }; return original.call(this, id, ...args); };
      require(${JSON.stringify(path.join(root, 'src/main/bootstrap.js'))});`);
    const launch = env => spawnSync(process.execPath, [launcher], { encoding: 'utf8', env: { ...process.env, ...env }, timeout: 10000 });
    assert.match(launch().stdout, /RUN 1.0.0 42/);
    files['src/main/main.js'] = main;
    assert.equal((await new Updater().check()).status, 'ready');
    const b = launch(); assert.equal(b.status, 0, b.stderr); assert.match(b.stdout, /RUN 1.1.0 42/);
    global.__ISLANDLY = { ...global.__ISLANDLY, root: read('current').dir, version: '1.1.0' };
    remoteVersion = '1.2.0'; remote(); files['src/main/main.js'] = main;
    await new Updater().check();
    const before = read('current');
    assert.match(launch({ SECOND: '1' }).stdout, /SECOND/);
    assert.deepEqual(read('current'), before);
    assert.equal(read('staged').version, '1.2.0');
    const crashed = launch({ CRASH_VERSION: '1.2.0' });
    assert(crashed.signal || crashed.status !== 0);
    assert.equal(read('current').booting, true);
    const recovered = launch(); assert.equal(recovered.status, 0, recovered.stderr);
    assert.match(recovered.stdout, /RUN 1.1.0 42/);
    assert.equal(read('current').booting, false);
  });
  console.log(`${passed} release channel regressions passed`);
})().catch(err => { console.error(err); process.exitCode = 1; }).finally(() => fs.rmSync(temp, { recursive: true, force: true }));

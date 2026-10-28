// Exercise the actual 0.4.0 updater snapshot from dev 3cfd490, not a rewritten mock.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'islandly-base2-'));
fs.writeFileSync(path.join(temp, 'package.json'), JSON.stringify({ version: '0.4.0', islandlyBase: 2 }));
const calls = [];
const exported = { exports: {} };
const context = {
  module: exported, Buffer, process: { env: {} },
  global: { __ISLANDLY: { version: '0.4.0', root: temp, baseRoot: temp } },
  require(id) {
    if (id === './util') return require('../src/main/util');
    if (id === 'electron') return { app: { getPath: () => temp }, net: { fetch: async url => {
      calls.push(url);
      if (url.endsWith('/commits/main')) return Response.json({ sha: 'd'.repeat(40) });
      if (url.endsWith('/package.json')) return Response.json({ version: '0.5.0', islandlyBase: 3 });
      throw new Error('base2 must not download a base3 tree');
    } } };
    return require(id);
  },
};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'fixtures/base2-updater.cjs'), 'utf8'), context);
(async () => {
  const result = await new exported.exports.Updater(() => { throw new Error('must not stage'); }).check();
  assert.equal(result.status, 'needs-full-download');
  assert.equal(result.version, '0.5.0');
  assert.equal(calls.length, 2);
  assert(!fs.existsSync(path.join(temp, 'updates/current.json')));
  console.log('unchanged 0.4.0/base2 updater preserves needs-full-download, no base3 code staged');
})().catch(err => { console.error(err); process.exitCode = 1; }).finally(() => fs.rmSync(temp, { recursive: true, force: true }));

// End-to-end check of the self-update path against a local fake of GitHub's API:
//   check -> download -> verify checksums -> stage -> bootstrap picks the update up (and rejects bad downloads).
//   electron test/update-flow.js
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const assert = require('assert');
const { app } = require('electron');
const { gitBlobSha } = require('../src/main/util');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'islandly-update-'));
app.setPath('userData', path.join(tmp, 'userData'));
const repoRoot = path.join(__dirname, '..');

// A fake "remote repository" with a newer version.
const files = {
  'package.json': JSON.stringify({ name: 'islandly', version: '9.9.9', islandlyBase: require('../package.json').islandlyBase }),
  'src/main/main.js': "console.log('FIXTURE MAIN RUNNING from ' + __dirname.split(require('path').sep).slice(-4, -2).join('/')); require('electron').app.exit(0);",
  'assets/note.txt': 'hello',
  'README.md': 'not part of an update',
};
let corrupt = null;
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url);
  if (url.endsWith('/commits/main')) return res.end(JSON.stringify({ sha: 'deadbeef' }));
  if (url.includes('/git/trees/')) {
    const tree = Object.entries(files).map(([p, c]) => ({ path: p, type: 'blob', sha: gitBlobSha(Buffer.from(c)) }));
    return res.end(JSON.stringify({ truncated: false, tree }));
  }
  const m = url.match(/\/deadbeef\/(.+)$/);
  if (m && files[m[1]] !== undefined) return res.end(corrupt === m[1] ? 'tampered' : files[m[1]]);
  res.statusCode = 404;
  res.end('nope');
});

app.whenReady().then(() => {
  server.listen(0, '127.0.0.1', async () => {
    const base = 'http://127.0.0.1:' + server.address().port;
    process.env.ISLANDLY_API_BASE = base;
    process.env.ISLANDLY_RAW_BASE = base;
    global.__ISLANDLY = { root: repoRoot, baseRoot: repoRoot, version: require('../package.json').version };
    const { Updater } = require('../src/main/updater');
    const updatesDir = path.join(app.getPath('userData'), 'updates');

    try {
      // 1. a download that fails its checksum must not be staged
      corrupt = 'assets/note.txt';
      let r = await new Updater(() => {}).check();
      assert.strictEqual(r.status, 'error');
      assert(/checksum/.test(r.message), r.message);
      assert(!fs.existsSync(path.join(updatesDir, 'current.json')), 'bad update must not be staged');
      console.log('UPDATE rejected tampered file: ok');

      // 2. a good download is staged with only src/, assets/ and package.json
      corrupt = null;
      let readyVersion = null;
      r = await new Updater((v) => (readyVersion = v)).check();
      assert.deepStrictEqual([r.status, r.version, readyVersion], ['ready', '9.9.9', '9.9.9']);
      const cur = JSON.parse(fs.readFileSync(path.join(updatesDir, 'current.json'), 'utf8'));
      assert.strictEqual(cur.version, '9.9.9');
      assert(fs.existsSync(path.join(cur.dir, 'src/main/main.js')));
      assert.strictEqual(fs.readFileSync(path.join(cur.dir, 'assets/note.txt'), 'utf8'), 'hello');
      assert(!fs.existsSync(path.join(cur.dir, 'README.md')), 'only code is downloaded');
      console.log('UPDATE staged 9.9.9: ok');

      // 3. a repeat check does not download again
      r = await new Updater(() => {}).check();
      assert.strictEqual(r.status, 'ready');

      // 4. a release that needs newer native modules than this install has is not hot-installed
      const good = files['package.json'];
      files['package.json'] = JSON.stringify({ name: 'islandly', version: '10.0.0', islandlyBase: require('../package.json').islandlyBase + 1 });
      r = await new Updater(() => {}).check();
      assert.strictEqual(r.status, 'needs-full-download');
      files['package.json'] = good;
      console.log('UPDATE newer base asks for a full download: ok');

      // 5. the bootstrap now runs the staged update instead of the packaged code (the fixture main exits the app)
      require('../src/main/bootstrap.js');
      assert.strictEqual(global.__ISLANDLY.version, '9.9.9');
      console.log('UPDATE bootstrap picked up the update: ok');
    } catch (err) {
      console.log('UPDATE FAILED ' + err.stack);
      app.exit(1);
    }
    server.close();
  });
});

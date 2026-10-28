const fs = require('fs');
const path = require('path');
const { app, net } = require('electron');
const { cmp, gitBlobSha } = require('./util');

// The app updates itself from the public repository: the newest commit on `main` is the newest version.
// Only the app's own code (src/, assets/, package.json) is downloaded, so an update is about 1 MB.
const OWNER = 'waliddawood999-ctrl';
const REPO = 'islandly';
const BRANCH = 'main';
const CHECK_EVERY_MS = 6 * 3600 * 1000;
// Overridable so the update flow can be tested against a local server.
const API_BASE = process.env.ISLANDLY_API_BASE || 'https://api.github.com';
const RAW_BASE = process.env.ISLANDLY_RAW_BASE || 'https://raw.githubusercontent.com';

const info = () => global.__ISLANDLY || { version: '0.0.0', baseVersion: '0.0.0', root: '' };

async function fetchOk(url) {
  const res = await net.fetch(url, { headers: { 'User-Agent': 'islandly-updater', Accept: 'application/vnd.github+json' } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res;
}

const raw = (sha, p) => `${RAW_BASE}/${OWNER}/${REPO}/${sha}/${p.split('/').map(encodeURIComponent).join('/')}`;

class Updater {
  constructor(onReady) {
    this.onReady = onReady;
    this.timer = null;
    this.busy = false;
    this.pending = null;
  }

  start() {
    setTimeout(() => this.check(), 20 * 1000);
    this.timer = setInterval(() => this.check(), CHECK_EVERY_MS);
  }

  stop() {
    clearInterval(this.timer);
  }

  /** Returns { status: 'up-to-date' | 'ready' | 'needs-full-download' | 'error', version? } */
  async check() {
    if (this.busy) return { status: 'busy' };
    if (this.pending) return { status: 'ready', version: this.pending };
    this.busy = true;
    try {
      const commit = await (await fetchOk(`${API_BASE}/repos/${OWNER}/${REPO}/commits/${BRANCH}`)).json();
      const sha = commit.sha;
      const remote = JSON.parse(await (await fetchOk(raw(sha, 'package.json'))).text());
      const running = info();
      const basePkg = JSON.parse(fs.readFileSync(path.join(running.baseRoot || running.root, 'package.json'), 'utf8'));

      if (remote.islandlyBase !== basePkg.islandlyBase) return { status: 'needs-full-download', version: remote.version };
      if (cmp(remote.version, running.version) <= 0) return { status: 'up-to-date', version: running.version };
      try {
        const failed = fs.readFileSync(path.join(app.getPath('userData'), 'updates', 'failed.txt'), 'utf8').trim();
        if (cmp(remote.version, failed) <= 0) return { status: 'skipped', version: remote.version };
      } catch (_) {
        /* no failed update recorded */
      }

      const tree = await (await fetchOk(`${API_BASE}/repos/${OWNER}/${REPO}/git/trees/${sha}?recursive=1`)).json();
      if (tree.truncated) throw new Error('tree truncated');
      const files = tree.tree.filter((n) => n.type === 'blob' && (n.path === 'package.json' || n.path.startsWith('src/') || n.path.startsWith('assets/')));

      const updatesDir = path.join(app.getPath('userData'), 'updates');
      const dir = path.join(updatesDir, remote.version);
      fs.rmSync(dir, { recursive: true, force: true });
      for (const f of files) {
        const buf = Buffer.from(await (await fetchOk(raw(sha, f.path))).arrayBuffer());
        if (gitBlobSha(buf) !== f.sha) throw new Error('checksum mismatch: ' + f.path);
        const dest = path.join(dir, f.path);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.writeFileSync(dest, buf);
      }
      fs.writeFileSync(path.join(updatesDir, 'current.json'), JSON.stringify({ version: remote.version, dir, base: remote.islandlyBase, booting: false }));
      for (const old of fs.readdirSync(updatesDir)) {
        if (old !== remote.version && old !== 'current.json') fs.rmSync(path.join(updatesDir, old), { recursive: true, force: true });
      }
      this.pending = remote.version;
      this.onReady(remote.version);
      return { status: 'ready', version: remote.version };
    } catch (err) {
      return { status: 'error', message: String(err.message || err) };
    } finally {
      this.busy = false;
    }
  }
}

/** Called once the window has loaded: an update that got this far is considered healthy. */
function markBootOk() {
  const file = info().currentFile;
  if (!file) return;
  try {
    const cur = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (cur.booting) fs.writeFileSync(file, JSON.stringify({ ...cur, booting: false }));
  } catch (_) {
    /* nothing staged */
  }
}

module.exports = { Updater, markBootOk };

const fs = require('fs');
const path = require('path');
const { app, net } = require('electron');
const { cmp, gitBlobSha } = require('./util');

// Discover only published stable Releases; resolve their tag to an immutable commit.
// Only the app's own code (src/, assets/, package.json) is downloaded, so an update is about 1 MB.
const OWNER = 'waliddawood999-ctrl';
const REPO = 'islandly';
const { latestRelease } = require('./releases');
const CHECK_EVERY_MS = 6 * 3600 * 1000;
// Overridable so the update flow can be tested against a local server.
const API_BASE = process.env.ISLANDLY_API_BASE || 'https://api.github.com';
const RAW_BASE = process.env.ISLANDLY_RAW_BASE || 'https://raw.githubusercontent.com';

function safePath(p) {
  return typeof p === 'string' && !p.includes('\\') && !p.includes(':') && !p.includes('\0') && p.split('/').every(s => s && s !== '.' && s !== '..');
}

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
    this.stop();
    this.initialTimer = setTimeout(() => this.check(), 20 * 1000);
    this.timer = setInterval(() => this.check(), CHECK_EVERY_MS);
  }

  stop() {
    clearTimeout(this.initialTimer);
    clearInterval(this.timer);
  }

  /** Returns { status: 'up-to-date' | 'ready' | 'needs-full-download' | 'error', version? } */
  async check() {
    if (this.busy) return { status: 'busy' };
    if (this.pending) return { status: 'ready', version: this.pending };
    this.busy = true;
    try {
      const release = await latestRelease(fetchOk, API_BASE);
      if (!release) return { status: 'up-to-date', version: info().version };
      const { sha, version: releaseVersion } = release;
      const remote = JSON.parse(await (await fetchOk(raw(sha, 'package.json'))).text());
      if (remote.version !== releaseVersion) throw new Error('release tag/package version mismatch');
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
      if (!files.some(f => f.path === 'package.json') || !files.some(f => f.path === 'src/main/main.js')) throw new Error('incomplete release');
      for (const f of files) {
        if (!safePath(f.path) || !/^[a-f0-9]{40}$/.test(f.sha)) throw new Error('invalid release file');
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

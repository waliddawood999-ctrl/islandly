const fs = require('fs');
const path = require('path');
const { app, net } = require('electron');
const { cmp, gitBlobSha } = require('./util');
const { latestRelease, DOWNLOAD_URL } = require('./releases');
const { isVersion, isSha, codePath, safePath, readJson, atomicJson, validRecord, failedVersions, markHealthy } = require('./update-state');

const OWNER = 'waliddawood999-ctrl';
const REPO = 'islandly';
const CHECK_EVERY_MS = 6 * 3600 * 1000;
const API_BASE = process.env.ISLANDLY_API_BASE || 'https://api.github.com';
const RAW_BASE = process.env.ISLANDLY_RAW_BASE || 'https://raw.githubusercontent.com';
const info = () => global.__ISLANDLY || { version: '0.0.0', root: '' };
const raw = (sha, file) => `${RAW_BASE}/${OWNER}/${REPO}/${sha}/${file.split('/').map(encodeURIComponent).join('/')}`;
const dependencies = pkg => JSON.stringify([pkg.dependencies || {}, pkg.optionalDependencies || {}].map(o => Object.entries(o).sort(([a], [b]) => a.localeCompare(b))));

class Updater {
  constructor(onReady = () => {}) {
    this.onReady = onReady;
    this.busy = false;
    this.generation = 0;
    this.controllers = new Set();
  }
  start() {
    this.stop();
    this.initialTimer = setTimeout(() => this.check(), 20000);
    this.timer = setInterval(() => this.check(), CHECK_EVERY_MS);
  }
  stop() {
    clearTimeout(this.initialTimer);
    clearInterval(this.timer);
    this.generation++;
    for (const controller of this.controllers) controller.abort();
  }
  async request(url, limit = 8 * 1024 * 1024) {
    const controller = new AbortController();
    this.controllers.add(controller);
    const timer = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await net.fetch(url, { signal: controller.signal, headers: {
        'User-Agent': 'islandly-updater', Accept: 'application/vnd.github+json',
      } });
      if (!response.ok) throw new Error(`${response.status} ${url}`);
      const chunks = [];
      let size = 0;
      const reader = response.body.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > limit) throw new Error('release response too large');
          chunks.push(Buffer.from(value));
        }
      } finally { await reader.cancel().catch(() => {}); }
      return Buffer.concat(chunks);
    } finally {
      clearTimeout(timer);
      this.controllers.delete(controller);
    }
  }
  async check() {
    if (this.busy) return { status: 'busy' };
    this.busy = true;
    const generation = this.generation;
    const alive = () => { if (generation !== this.generation) throw new Error('update cancelled'); };
    const lifetime = setTimeout(() => { for (const c of this.controllers) c.abort(); this.generation++; }, 120000);
    let temp;
    try {
      const running = info();
      const basePkg = readJson(path.join(running.baseRoot || running.root, 'package.json'));
      const release = await latestRelease(async url => {
        alive();
        const bytes = await this.request(url);
        alive();
        return { json: async () => JSON.parse(bytes.toString('utf8')) };
      }, API_BASE);
      alive();
      if (!release) return { status: 'up-to-date', version: running.version };
      const { sha, version } = release;
      if (!isVersion(version)) throw new Error('invalid release version');
      const packageBytes = await this.request(raw(sha, 'package.json'));
      alive();
      const remote = JSON.parse(packageBytes.toString('utf8'));
      if (remote.version !== version || !Number.isInteger(remote.islandlyBase)) throw new Error('release tag/package mismatch');
      // Keep the legacy result/IPC toast; base2 never receives the new bootstrap or dependencies.
      if (basePkg.islandlyBase !== 3 || remote.islandlyBase !== basePkg.islandlyBase || dependencies(remote) !== dependencies(basePkg)) {
        return { status: 'needs-full-download', version, downloadUrl: DOWNLOAD_URL };
      }
      if (cmp(version, running.version) <= 0) return { status: 'up-to-date', version: running.version };
      const updatesDir = path.join(app.getPath('userData'), 'updates');
      if (failedVersions(updatesDir).includes(version)) return { status: 'skipped', version };
      const stagedFile = path.join(updatesDir, 'staged.json');
      const staged = readJson(stagedFile);
      if (staged?.version === version && staged.sha === sha && validRecord(staged, updatesDir, basePkg)) return { status: 'ready', version };
      const tree = JSON.parse((await this.request(`${API_BASE}/repos/${OWNER}/${REPO}/git/trees/${sha}?recursive=1`)).toString('utf8'));
      alive();
      if (tree.truncated || !Array.isArray(tree.tree)) throw new Error('incomplete release tree');
      const files = tree.tree.filter(n => n.type === 'blob' && codePath(n.path));
      if (!files.length || files.length > 10000) throw new Error('invalid release tree size');
      const names = new Set();
      for (const file of files) {
        if (!safePath(file.path) || !isSha(file.sha) || !['100644', '100755'].includes(file.mode) || names.has(file.path.toLowerCase())) throw new Error('invalid release file');
        names.add(file.path.toLowerCase());
      }
      if (!names.has('package.json') || !names.has('src/main/main.js')) throw new Error('incomplete release');
      const packageEntry = files.find(f => f.path === 'package.json');
      if (gitBlobSha(packageBytes) !== packageEntry.sha) throw new Error('checksum mismatch: package.json');
      fs.mkdirSync(updatesDir, { recursive: true });
      temp = fs.mkdtempSync(path.join(updatesDir, '.download-'));
      let size = 0;
      for (const file of files) {
        const bytes = file.path === 'package.json' ? packageBytes : await this.request(raw(sha, file.path), 20 * 1024 * 1024);
        alive();
        size += bytes.length;
        if (size > 100 * 1024 * 1024) throw new Error('release exceeds download budget');
        if (gitBlobSha(bytes) !== file.sha) throw new Error('checksum mismatch: ' + file.path);
        const dest = path.join(temp, file.path);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.writeFileSync(dest, bytes);
      }
      const manifest = Buffer.from(JSON.stringify(files.map(f => ({ path: f.path, sha: f.sha }))));
      fs.writeFileSync(path.join(temp, 'manifest.json'), manifest);
      const dir = path.join(updatesDir, version + '-' + sha);
      const record = { version, sha, dir, base: remote.islandlyBase, manifestSha: gitBlobSha(manifest), booting: false };
      alive();
      if (fs.existsSync(dir)) {
        if (!validRecord(record, updatesDir, basePkg)) throw new Error('existing release directory is invalid; full install required');
      } else fs.renameSync(temp, dir);
      // Publishing the staged pointer is the only commit operation. Active/previous/running files are untouched.
      atomicJson(stagedFile, record);
      this.onReady(version);
      return { status: 'ready', version };
    } catch (err) {
      return { status: generation === this.generation ? 'error' : 'cancelled', message: String(err.message || err) };
    } finally {
      clearTimeout(lifetime);
      if (temp) fs.rmSync(temp, { recursive: true, force: true });
      this.busy = false;
    }
  }
}
function markBootOk() {
  try { markHealthy(info()); } catch (_) { /* Leave booting set so the next launch recovers. */ }
}
module.exports = { Updater, markBootOk };

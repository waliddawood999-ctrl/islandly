// Shared by the packaged bootstrap and the release downloader. No Electron dependency.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { cmp, gitBlobSha } = require('./util');

const isVersion = value => typeof value === 'string' && /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value);
const isSha = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
function codePath(value) {
  return typeof value === 'string' && (value === 'package.json' || /^(src|assets)\//.test(value));
}
function safePath(value) {
  return codePath(value) && value.split('/').every(part => part && part !== '.' && part !== '..' &&
    !/[\\:\x00-\x1f<>"|?*]/.test(part) && !/[. ]$/.test(part) &&
    !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i.test(part));
}
function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) { return null; }
}
function atomicJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = file + '.' + crypto.randomUUID() + '.tmp';
  try {
    const fd = fs.openSync(temp, 'wx');
    try { fs.writeFileSync(fd, JSON.stringify(data)); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    fs.renameSync(temp, file);
  } finally { fs.rmSync(temp, { force: true }); }
}
function regularPath(root, relative) {
  let cursor = root;
  if (!fs.lstatSync(cursor).isDirectory() || fs.lstatSync(cursor).isSymbolicLink()) return false;
  const parts = relative.split('/');
  for (let i = 0; i < parts.length; i++) {
    cursor = path.join(cursor, parts[i]);
    const stat = fs.lstatSync(cursor);
    if (stat.isSymbolicLink() || (i === parts.length - 1 ? !stat.isFile() : !stat.isDirectory())) return false;
  }
  return true;
}
function validRecord(record, updatesDir, basePkg) {
  try {
    if (!record || !isVersion(record.version) || !isSha(record.sha) || record.base !== basePkg.islandlyBase ||
        cmp(record.version, basePkg.version) <= 0 || !isSha(record.manifestSha)) return false;
    const expected = path.join(updatesDir, record.version + '-' + record.sha);
    if (record.dir !== expected || !regularPath(expected, 'manifest.json')) return false;
    const buf = fs.readFileSync(path.join(expected, 'manifest.json'));
    if (gitBlobSha(buf) !== record.manifestSha) return false;
    const manifest = JSON.parse(buf);
    if (!Array.isArray(manifest) || !manifest.length || manifest.length > 10000) return false;
    const names = new Set();
    for (const entry of manifest) {
      if (!safePath(entry.path) || !isSha(entry.sha) || names.has(entry.path.toLowerCase())) return false;
      names.add(entry.path.toLowerCase());
      if (!regularPath(expected, entry.path) || gitBlobSha(fs.readFileSync(path.join(expected, entry.path))) !== entry.sha) return false;
    }
    if (!names.has('package.json') || !names.has('src/main/main.js')) return false;
    const pkg = readJson(path.join(expected, 'package.json'));
    return pkg?.version === record.version && pkg.islandlyBase === record.base;
  } catch (_) { return false; }
}
function failedVersions(updatesDir) {
  const values = readJson(path.join(updatesDir, 'failed.json'));
  return Array.isArray(values) ? values.filter(isVersion) : [];
}
function recordFailure(updatesDir, record) {
  if (!isVersion(record?.version)) return;
  atomicJson(path.join(updatesDir, 'failed.json'), [...new Set([...failedVersions(updatesDir), record.version])]);
}

function selectBoot(baseRoot, userData) {
  const basePkg = readJson(path.join(baseRoot, 'package.json'));
  const updatesDir = path.join(userData, 'updates');
  const currentFile = path.join(updatesDir, 'current.json');
  const stagedFile = path.join(updatesDir, 'staged.json');
  const previousFile = path.join(updatesDir, 'previous.json');
  const packaged = { root: baseRoot, baseRoot, version: basePkg.version, baseVersion: basePkg.version, currentFile };
  // base2 installations never consume the new record format.
  if (basePkg.islandlyBase !== 3) return packaged;
  let current = readJson(currentFile);
  const previous = readJson(previousFile);
  const failed = current && (current.booting || !validRecord(current, updatesDir, basePkg));
  if (failed) {
    recordFailure(updatesDir, current);
    // Also discard a leftover staging pointer to this candidate after an interrupted activation.
    const staged = readJson(stagedFile);
    if (staged?.version === current.version) fs.rmSync(stagedFile, { force: true });
    current = validRecord(previous, updatesDir, basePkg) && !failedVersions(updatesDir).includes(previous.version) ? previous : null;
    if (current) atomicJson(currentFile, { ...current, booting: false });
    else fs.rmSync(currentFile, { force: true });
  }
  const staged = readJson(stagedFile);
  if (!failed && staged) {
    const newer = cmp(staged.version, current?.version || basePkg.version) > 0;
    if (newer && !failedVersions(updatesDir).includes(staged.version) && validRecord(staged, updatesDir, basePkg)) {
      if (current) atomicJson(previousFile, { ...current, booting: false });
      current = { ...staged, booting: true };
      atomicJson(currentFile, current);
    } else if (newer && !validRecord(staged, updatesDir, basePkg)) recordFailure(updatesDir, staged);
    fs.rmSync(stagedFile, { force: true });
  }
  if (!current) return packaged;
  // Every launch must prove healthy; an unexpected exit during startup rolls back next time.
  atomicJson(currentFile, { ...current, booting: true });
  return { ...packaged, root: current.dir, version: current.version };
}
function markHealthy(info) {
  const record = readJson(info.currentFile);
  if (record?.booting && record.dir === info.root && record.version === info.version) {
    atomicJson(info.currentFile, { ...record, booting: false });
  }
}

module.exports = { isVersion, isSha, codePath, safePath, readJson, atomicJson, validRecord, failedVersions, selectBoot, markHealthy };

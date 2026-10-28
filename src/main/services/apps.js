// App launcher index: the shortcuts in the Start Menu folders (both per-user and all-users).
const fs = require('fs');
const path = require('path');

const SKIP = /uninstall|readme|help|documentation|website|إزالة/i;
let cache = null;
let cachedAt = 0;

function roots() {
  const list = [];
  if (process.env.APPDATA) list.push(path.join(process.env.APPDATA, 'Microsoft', 'Windows', 'Start Menu', 'Programs'));
  if (process.env.ProgramData) list.push(path.join(process.env.ProgramData, 'Microsoft', 'Windows', 'Start Menu', 'Programs'));
  if (process.env.ISLANDLY_APPS_DIR) list.push(process.env.ISLANDLY_APPS_DIR); // used by tests
  return list;
}

function walk(dir, depth, out) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (_) {
    return;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory() && depth < 3) walk(full, depth + 1, out);
    else if (/\.(lnk|url)$/i.test(e.name)) {
      const name = e.name.replace(/\.(lnk|url)$/i, '');
      if (!SKIP.test(name)) out.push({ name, path: full });
    }
  }
}

function list() {
  if (cache && Date.now() - cachedAt < 10 * 60 * 1000) return cache;
  const out = [];
  for (const r of roots()) walk(r, 0, out);
  const seen = new Set();
  cache = out.filter((a) => {
    const k = a.name.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  cachedAt = Date.now();
  return cache;
}

/** Simple ranking: prefix of the name > prefix of a word > substring > in-order letters. */
function score(name, q) {
  const n = name.toLowerCase();
  if (n.startsWith(q)) return 100 - n.length / 100;
  if (n.split(/[\s\-_.]+/).some((w) => w.startsWith(q))) return 80 - n.length / 100;
  if (n.includes(q)) return 60 - n.length / 100;
  let i = 0;
  for (const c of n) if (c === q[i]) i++;
  return i === q.length ? 30 - n.length / 100 : 0;
}

function search(query, limit = 5) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return [];
  return list()
    .map((a) => ({ ...a, score: score(a.name, q) }))
    .filter((a) => a.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

module.exports = { search, list, score };

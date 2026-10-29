// API/cache access is lazy: importing/constructing this service never opens the network or a file.
const fs = require('node:fs');
const path = require('node:path');
const TTL = 7 * 24 * 60 * 60 * 1000;
const API = 'https://mp3quran.net/api/v3/reciters';
function serverUrl(value) {
  try {
    const u = new URL(value);
    if (u.protocol !== 'https:' || !u.hostname.endsWith('.mp3quran.net') || u.username || u.password || u.port || u.search || u.hash) return null;
    u.pathname = u.pathname.replace(/\/+$/, '') + '/';
    return u.href;
  } catch (_) { return null; }
}
function normalize(rows, english = []) {
  if (!Array.isArray(rows)) throw Error('invalid');
  const names = new Map(english.map(r => [Number(r.id), String(r.name || '')]));
  const out = [];
  for (const r of rows.slice(0, 2000)) {
    const id = Number(r.id);
    if (!Number.isInteger(id) || id <= 0 || !Array.isArray(r.moshaf)) continue;
    const moshaf = [];
    for (const m of r.moshaf.slice(0, 100)) {
      const mid = Number(m.id), server = serverUrl(m.server);
      const list = Array.isArray(m.surahList) ? m.surahList : String(m.surah_list || '').split(',').map(x => Number(x.trim()));
      const surahList = [...new Set(list.filter(x => Number.isInteger(x) && x >= 1 && x <= 114))];
      if (Number.isInteger(mid) && mid > 0 && server && surahList.length) moshaf.push({ id: mid, name: String(m.name || '').slice(0, 300), server, surahList });
    }
    if (moshaf.length) out.push({ id, nameAr: String(r.nameAr || r.name || '').slice(0, 300), nameEn: String(r.nameEn || names.get(id) || r.name || '').slice(0, 300), moshaf });
  }
  if (!out.length) throw Error('invalid');
  return out;
}
async function download(language) {
  const { net } = require('electron');
  const response = await net.fetch(`${API}?language=${language}`, { signal: AbortSignal.timeout(15000), redirect: 'error' });
  if (!response.ok) throw Error('offline');
  // Bound remote metadata; audio is never fetched here.
  const reader = response.body.getReader(), chunks = []; let size = 0;
  try {
    while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > 4 * 1024 * 1024) throw Error('invalid'); chunks.push(Buffer.from(value)); }
  } catch (err) { await reader.cancel().catch(() => {}); throw err; }
  return JSON.parse(Buffer.concat(chunks).toString()).reciters;
}
class QuranService {
  constructor({ directory, fetchList = download, now = Date.now }) { Object.assign(this, { directory, fetchList, now }); this.cache = null; this.loaded = false; this.pending = null; }
  load() {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const file = path.join(this.directory(), 'quran-reciters.json');
      if (fs.statSync(file).size > 8 * 1024 * 1024) return;
      const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (Number.isFinite(saved.at) && saved.at <= this.now()) this.cache = { at: saved.at, rows: normalize(saved.rows) };
    } catch (_) {}
  }
  async reciters() {
    this.load();
    if (this.cache && this.now() - this.cache.at < TTL) return this.cache.rows;
    if (this.pending) return this.pending;
    this.pending = (async () => {
      try {
        const ar = await this.fetchList('ar');
        // A failing English mirror must not discard a usable Arabic response.
        const en = await this.fetchList('eng').catch(() => []);
        const rows = normalize(ar, Array.isArray(en) ? en : []);
        this.cache = { at: this.now(), rows };
        try {
          const dir = this.directory(); fs.mkdirSync(dir, { recursive: true });
          const file = path.join(dir, 'quran-reciters.json');
          fs.writeFileSync(file + '.tmp', JSON.stringify(this.cache)); fs.renameSync(file + '.tmp', file);
        } catch (_) {} // usable in-memory catalogue even if disk is read-only
        return rows;
      } catch (_) { if (this.cache) return this.cache.rows; throw Error('offline'); }
      finally { this.pending = null; }
    })();
    return this.pending;
  }
  url(reciterId, moshafId, sura) {
    if (![reciterId, moshafId, sura].every(Number.isInteger) || reciterId <= 0 || moshafId <= 0 || sura < 1 || sura > 114) throw Error('invalid');
    this.load(); // cache-only; never secretly downloads a catalogue
    if (!this.cache) throw Error('offline');
    const reciter = this.cache.rows.find(r => r.id === reciterId), m = reciter?.moshaf.find(m => m.id === moshafId);
    if (!m || !m.surahList.includes(sura)) throw Error('invalid');
    const server = serverUrl(m.server); if (!server) throw Error('invalid');
    return server + String(sura).padStart(3, '0') + '.mp3';
  }
}
module.exports = { QuranService, normalize, serverUrl, TTL };

const { net } = require("electron");
const { RequestScope } = require("../request");
function parseLrc(text) {
  const lines = [];
  for (const line of String(text || "").split(/\r?\n/)) {
    const tags = [...line.matchAll(/\[(\d+):(\d+(?:\.\d+)?)\]/g)];
    const text = line.replace(/\[[^\]]*\]/g, "").trim();
    for (const m of tags)
      lines.push({ at: Number(m[1]) * 60 + Number(m[2]), text });
  }
  return lines.sort((a, b) => a.at - b.at).slice(0, 3000);
}
class Lyrics {
  constructor(onUpdate) {
    this.onUpdate = onUpdate;
    this.scope = new RequestScope();
    this.key = "";
    this.cache = new Map();
  }
  async update(media, enabled) {
    const key =
      enabled && media && media.active && media.title
        ? `${media.title}|${media.artist}|${Math.round(media.duration || 0)}`
        : "";
    if (key === this.key) return;
    this.key = key;
    this.scope.invalidate();
    if (!key) {
      this.onUpdate({ status: "off", lines: [], text: "" });
      return;
    }
    if (this.cache.has(key)) {
      this.onUpdate(this.cache.get(key));
      return;
    }
    this.onUpdate({ status: "loading", lines: [], text: "" });
    const request = this.scope.begin();
    try {
      const query = new URLSearchParams({
        track_name: media.title,
        artist_name: media.artist || "",
      });
      if (media.duration > 0)
        query.set("duration", String(Math.round(media.duration)));
      const res = await net.fetch("https://lrclib.net/api/get?" + query, {
        signal: request.signal,
        headers: { "User-Agent": "Islandly/0.5.0" },
      });
      if (!res.ok) throw new Error("Lyrics unavailable");
      const d = await res.json();
      if (!request.current()) return;
      const out = {
        status: d.instrumental ? "instrumental" : "ok",
        lines: parseLrc(d.syncedLyrics),
        text: String(d.plainLyrics || "").slice(0, 30000),
      };
      this.cache.set(key, out);
      if (this.cache.size > 25)
        this.cache.delete(this.cache.keys().next().value);
      this.onUpdate(out);
    } catch (_) {
      if (request.current())
        this.onUpdate({ status: "unavailable", lines: [], text: "" });
    } finally {
      request.done();
    }
  }
  stop() {
    this.key = "";
    this.scope.invalidate();
  }
}
module.exports = { Lyrics, parseLrc };

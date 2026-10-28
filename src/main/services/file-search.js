const fs = require("fs").promises;
const path = require("path");
let cache = { root: "", at: 0, files: [] },
  pending = null;
async function search(query, root) {
  if (
    typeof root !== "string" ||
    !path.isAbsolute(root) ||
    query.trim().length < 2
  )
    return [];
  if (cache.root !== root || Date.now() - cache.at > 600000) {
    if (pending) await pending;
    if (cache.root !== root || Date.now() - cache.at > 600000) {
      pending = (async () => {
        const files = [];
        let visited = 0;
        const deadline = Date.now() + 5000;
        async function walk(dir, depth) {
          if (depth > 5 || visited > 10000 || Date.now() > deadline) return;
          let entries;
          try {
            entries = await fs.readdir(dir, { withFileTypes: true });
          } catch (_) {
            return;
          }
          for (const e of entries) {
            if (++visited > 10000 || Date.now() > deadline) break;
            if (e.name.startsWith(".") || e.isSymbolicLink()) continue;
            const file = path.join(dir, e.name);
            if (e.isDirectory()) await walk(file, depth + 1);
            else if (e.isFile()) files.push({ name: e.name, path: file });
          }
        }
        await walk(root, 0);
        cache = { root, at: Date.now(), files };
      })().finally(() => (pending = null));
      await pending;
    }
  }
  const q = query.trim().toLowerCase();
  return cache.files
    .filter((f) => f.name.toLowerCase().includes(q))
    .slice(0, 8);
}
module.exports = { search };

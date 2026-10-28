// Entry point. Runs the newest downloaded update if there is one, otherwise the code shipped in the package.
// Keep this file tiny and stable: it is the one part that updates cannot replace.
const fs = require("fs");
const path = require("path");
const { app } = require("electron");

const baseRoot = path.join(__dirname, "..", "..");
const basePkg = JSON.parse(
  fs.readFileSync(path.join(baseRoot, "package.json"), "utf8"),
);

function cmp(a, b) {
  const pa = String(a).split(".").map(Number);
  const pb = String(b).split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d;
  }
  return 0;
}

let root = baseRoot;
let version = basePkg.version;
const currentFile = path.join(
  app.getPath("userData"),
  "updates",
  "current.json",
);

try {
  const cur = JSON.parse(fs.readFileSync(currentFile, "utf8"));
  const usable =
    cur.base === basePkg.islandlyBase &&
    /^\d+\.\d+\.\d+$/.test(cur.version) &&
    path.resolve(cur.dir || "") ===
      path.join(path.dirname(currentFile), cur.version) &&
    cmp(cur.version, basePkg.version) > 0 &&
    fs.existsSync(path.join(cur.dir, "src", "main", "main.js"));
  if (usable && cur.booting) {
    // The previous start with this update never finished loading: drop it, remember it as bad, use the packaged code.
    fs.rmSync(currentFile, { force: true });
    fs.writeFileSync(
      path.join(path.dirname(currentFile), "failed.txt"),
      cur.version,
    );
  } else if (usable) {
    fs.writeFileSync(currentFile, JSON.stringify({ ...cur, booting: true }));
    root = cur.dir;
    version = cur.version;
  }
} catch (_) {
  /* no update staged */
}

// An update contains only the app's own code; its dependencies (koffi, adhan, ...) live in the packaged app.
// globalPaths is a copy: pushing to it does not update CommonJS resolution.
// Rebuild Node's global search paths for downloaded code, whose own ancestors have no node_modules.
process.env.NODE_PATH = [
  path.join(baseRoot, "node_modules"),
  process.env.NODE_PATH,
]
  .filter(Boolean)
  .join(path.delimiter);
require("module").Module._initPaths();

global.__ISLANDLY = {
  root,
  baseRoot,
  version,
  baseVersion: basePkg.version,
  currentFile,
};
require(path.join(root, "src", "main", "main.js"));

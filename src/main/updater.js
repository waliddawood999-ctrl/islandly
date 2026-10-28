const fs = require("fs");
const path = require("path");
const { app, net } = require("electron");
const { cmp, gitBlobSha } = require("./util");
const { RequestScope } = require("./request");
const OWNER = "waliddawood999-ctrl",
  REPO = "islandly",
  BRANCH = "main";
const CHECK_EVERY_MS = 6 * 3600 * 1000;
const API_BASE = process.env.ISLANDLY_API_BASE || "https://api.github.com";
const RAW_BASE =
  process.env.ISLANDLY_RAW_BASE || "https://raw.githubusercontent.com";
const info = () =>
  global.__ISLANDLY || { version: "0.0.0", baseVersion: "0.0.0", root: "" };
const versionOK = (v) =>
  typeof v === "string" && /^\d{1,6}\.\d{1,6}\.\d{1,6}$/.test(v);
function atomicJson(file, value) {
  fs.writeFileSync(file + ".tmp", JSON.stringify(value));
  fs.renameSync(file + ".tmp", file);
}
class Updater {
  constructor(onReady) {
    this.onReady = onReady;
    this.timer = null;
    this.initial = null;
    this.busy = false;
    this.pending = null;
    this.scope = new RequestScope();
  }
  start() {
    this.stop();
    this.initial = setTimeout(() => {
      this.initial = null;
      this.check();
    }, 20000);
    this.timer = setInterval(() => this.check(), CHECK_EVERY_MS);
  }
  stop() {
    clearTimeout(this.initial);
    clearInterval(this.timer);
    this.initial = this.timer = null;
    this.scope.invalidate();
  }
  async check() {
    if (this.busy) return { status: "busy" };
    if (this.pending) return { status: "ready", version: this.pending };
    this.busy = true;
    const request = this.scope.begin(120000);
    let stage;
    const fetchOk = async (url) => {
      const res = await net.fetch(url, {
        signal: request.signal,
        headers: {
          "User-Agent": "islandly-updater",
          Accept: "application/vnd.github+json",
        },
      });
      if (!request.current()) throw new Error("Update cancelled");
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res;
    };
    const raw = (sha, p) =>
      `${RAW_BASE}/${OWNER}/${REPO}/${sha}/${p.split("/").map(encodeURIComponent).join("/")}`;
    try {
      const commit = await (
        await fetchOk(`${API_BASE}/repos/${OWNER}/${REPO}/commits/${BRANCH}`)
      ).json();
      const sha = commit.sha;
      if (typeof sha !== "string" || !/^[-\w]+$/.test(sha))
        throw new Error("Invalid commit");
      const pkgBytes = Buffer.from(
        await (await fetchOk(raw(sha, "package.json"))).text(),
      );
      const remote = JSON.parse(pkgBytes);
      if (!versionOK(remote.version))
        throw new Error("Invalid release version");
      const running = info();
      const basePkg = JSON.parse(
        fs.readFileSync(
          path.join(running.baseRoot || running.root, "package.json"),
          "utf8",
        ),
      );
      if (remote.islandlyBase !== basePkg.islandlyBase)
        return { status: "needs-full-download", version: remote.version };
      if (cmp(remote.version, running.version) <= 0)
        return { status: "up-to-date", version: running.version };
      const updates = path.join(app.getPath("userData"), "updates");
      try {
        if (
          cmp(
            remote.version,
            fs.readFileSync(path.join(updates, "failed.txt"), "utf8").trim(),
          ) <= 0
        )
          return { status: "skipped", version: remote.version };
      } catch (_) {}
      const tree = await (
        await fetchOk(
          `${API_BASE}/repos/${OWNER}/${REPO}/git/trees/${sha}?recursive=1`,
        )
      ).json();
      if (tree.truncated || !Array.isArray(tree.tree))
        throw new Error("Incomplete tree");
      const files = tree.tree.filter(
        (n) =>
          n.type === "blob" &&
          (n.path === "package.json" ||
            n.path.startsWith("src/") ||
            n.path.startsWith("assets/")),
      );
      if (
        files.length > 1000 ||
        !files.some((f) => f.path === "src/main/main.js") ||
        !files.some((f) => f.path === "package.json")
      )
        throw new Error("Invalid update contents");
      for (const f of files)
        if (
          f.path.includes("\\") ||
          f.path.split("/").some((p) => !p || p === "." || p === "..") ||
          f.mode === "120000"
        )
          throw new Error("Unsafe update path");
      fs.mkdirSync(updates, { recursive: true });
      stage = fs.mkdtempSync(path.join(updates, ".stage-"));
      let total = 0;
      for (const f of files) {
        const buf = Buffer.from(
          await (await fetchOk(raw(sha, f.path))).arrayBuffer(),
        );
        if ((total += buf.length) > 32 * 1024 * 1024)
          throw new Error("Update too large");
        if (gitBlobSha(buf) !== f.sha)
          throw new Error("checksum mismatch: " + f.path);
        if (f.path === "package.json" && !buf.equals(pkgBytes))
          throw new Error("Package metadata changed");
        const dest = path.join(stage, f.path);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.writeFileSync(dest, buf);
      }
      if (!request.current()) throw new Error("Update cancelled");
      const dir = path.join(updates, remote.version);
      if (path.resolve(dir) === path.resolve(running.root))
        throw new Error("Cannot overwrite running version");
      fs.rmSync(dir, { recursive: true, force: true });
      fs.renameSync(stage, dir);
      stage = null;
      // Never remove a running update or its rollback code during staging. Cleanup happens after a healthy boot.
      atomicJson(path.join(updates, "current.json"), {
        version: remote.version,
        dir,
        base: remote.islandlyBase,
        booting: false,
        previous: running.root,
      });
      this.pending = remote.version;
      this.onReady(remote.version);
      return { status: "ready", version: remote.version };
    } catch (err) {
      return { status: "error", message: String(err.message || err) };
    } finally {
      if (stage) fs.rmSync(stage, { recursive: true, force: true });
      request.done();
      this.busy = false;
    }
  }
}
function markBootOk() {
  const file = info().currentFile;
  if (!file) return;
  try {
    const cur = JSON.parse(fs.readFileSync(file, "utf8"));
    if (path.resolve(cur.dir) !== path.resolve(info().root)) return;
    atomicJson(file, { ...cur, booting: false });
    // Retain the running version and one rollback candidate; only clean known version directories.
    for (const entry of fs.readdirSync(path.dirname(file), {
      withFileTypes: true,
    })) {
      if (!entry.isDirectory() || !versionOK(entry.name)) continue;
      const dir = path.resolve(path.dirname(file), entry.name);
      if (
        dir !== path.resolve(cur.dir) &&
        dir !== path.resolve(cur.previous || cur.dir)
      )
        fs.rmSync(dir, { recursive: true, force: true });
    }
  } catch (_) {}
}
module.exports = { Updater, markBootOk };

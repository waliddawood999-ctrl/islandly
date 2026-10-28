const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { randomBytes } = require("crypto");
class LocalShare {
  constructor() {
    this.server = null;
    this.files = new Map();
    this.timer = null;
  }
  async share(file) {
    const stat = fs.statSync(file);
    if (!stat.isFile()) throw new Error("Only files can be shared");
    if (!this.server) {
      this.server = http.createServer((req, res) => {
        const token = (req.url || "").split("?")[0].slice(1);
        const entry = this.files.get(token);
        if (
          !entry ||
          entry.until < Date.now() ||
          !["GET", "HEAD"].includes(req.method)
        ) {
          res.writeHead(404);
          res.end();
          return;
        }
        let stat;
        try {
          stat = fs.statSync(entry.path);
        } catch (_) {
          res.writeHead(404);
          res.end();
          return;
        }
        res.writeHead(200, {
          "Content-Type": "application/octet-stream",
          "Content-Length": stat.size,
          "Content-Disposition":
            "attachment; filename*=UTF-8''" +
            encodeURIComponent(path.basename(entry.path)),
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        });
        if (req.method === "HEAD") return res.end();
        const stream = fs.createReadStream(entry.path);
        stream.on("error", () => res.destroy());
        res.on("close", () => stream.destroy());
        stream.pipe(res);
      });
      await new Promise((resolve, reject) => {
        this.server.once("error", reject);
        this.server.listen(0, "0.0.0.0", () => {
          this.server.removeListener("error", reject);
          resolve();
        });
      }).catch((e) => {
        this.stop();
        throw e;
      });
    }
    const addresses = Object.values(os.networkInterfaces())
      .flat()
      .filter((i) => i.family === "IPv4" && !i.internal)
      .map((i) => i.address);
    const address = addresses[0];
    if (!address) {
      this.stop();
      throw new Error("No local network address");
    }
    const token = randomBytes(24).toString("hex");
    const until = Date.now() + 10 * 60000;
    this.files.set(token, { path: file, until });
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.stop(), 10 * 60000);
    return {
      url: `http://${address}:${this.server.address().port}/${token}`,
      expires: until,
    };
  }
  stop() {
    clearTimeout(this.timer);
    this.files.clear();
    this.server?.close();
    this.server?.closeAllConnections();
    this.server = null;
  }
}
module.exports = { LocalShare };

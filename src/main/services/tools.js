const { execFile } = require("child_process");
const fs = require("fs");
const path = require("path");
const { app } = require("electron");
class Tools {
  constructor(jobs) {
    this.jobs = jobs;
  }
  available(name) {
    if (!["ffmpeg", "rembg"].includes(name)) return Promise.resolve(false);
    return new Promise((resolve) =>
      execFile(
        process.platform === "win32" ? "where.exe" : "which",
        [name],
        { windowsHide: true, timeout: 3000 },
        (err) => resolve(!err),
      ),
    );
  }
  async run(file, op) {
    const allowed = { gif: "ffmpeg", audio: "ffmpeg", background: "rembg" };
    const tool = allowed[op];
    if (!tool || !(await this.available(tool)))
      return {
        ok: false,
        error: `Install ${tool} separately to enable this action.`,
      };
    if (
      !fs.statSync(file).isFile() ||
      fs.statSync(file).size > 500 * 1024 * 1024
    )
      throw new Error("Invalid or oversized input");
    const dir = path.join(app.getPath("downloads"), "Islandly");
    fs.mkdirSync(dir, { recursive: true });
    const out = path.join(
      dir,
      path.basename(file, path.extname(file)) +
        "-" +
        op +
        "-" +
        Date.now() +
        { gif: ".gif", audio: ".m4a", background: ".png" }[op],
    );
    const args =
      op === "gif"
        ? [
            "-n",
            "-i",
            file,
            "-t",
            "15",
            "-vf",
            "fps=10,scale=720:-1:flags=lanczos",
            out,
          ]
        : op === "audio"
          ? ["-n", "-i", file, "-vn", "-c:a", "aac", out]
          : ["i", file, out];
    const id = this.jobs.start(path.basename(file) + " — " + op, tool, args);
    return { ok: true, id, path: out };
  }
}
module.exports = { Tools };

const fs = require("fs");
const path = require("path");
const { Worker } = require("worker_threads");
const { app } = require("electron");
class FileActions {
  constructor(baseRoot, onResult, onProgress) {
    this.baseRoot = baseRoot;
    this.onResult = onResult;
    this.onProgress = onProgress;
    this.workers = new Set();
  }
  run(files, op, width) {
    if (this.workers.size >= 2)
      throw new Error("Two file operations are already running");
    const allowed = [
      "png",
      "jpg",
      "webp",
      "compress",
      "half",
      "resize",
      "pdf-merge",
      "pdf-optimize",
      "ocr",
    ];
    if (
      !allowed.includes(op) ||
      !Array.isArray(files) ||
      !files.length ||
      files.length > 20
    )
      throw new Error("Invalid file operation");
    if (
      files.some(
        (f) =>
          typeof f !== "string" || !path.isAbsolute(f) || !fs.existsSync(f),
      )
    )
      throw new Error("File does not exist");
    if (
      op.startsWith("pdf") &&
      files.some((f) => !f.toLowerCase().endsWith(".pdf"))
    )
      throw new Error("Select PDF files only");
    const worker = new Worker(path.join(__dirname, "../file-worker.js"), {
      workerData: {
        files,
        op,
        width,
        baseRoot: this.baseRoot,
        cache: path.join(app.getPath("userData"), "ocr-cache"),
        output: path.join(app.getPath("downloads"), "Islandly"),
      },
    });
    this.workers.add(worker);
    return new Promise((resolve) => {
      let ended = false;
      const finish = (r) => {
        if (ended) return;
        ended = true;
        clearTimeout(timeout);
        this.workers.delete(worker);
        worker.terminate();
        this.onResult(r);
        resolve(r);
      };
      const timeout = setTimeout(
        () => finish({ ok: false, error: "File operation timed out" }),
        180000,
      );
      worker.on("message", (r) => {
        if (r.progress !== undefined) this.onProgress(r.progress);
        else finish(r);
      });
      worker.on("error", (e) => finish({ ok: false, error: e.message }));
      worker.on("exit", (code) => {
        if (!ended) finish({ ok: false, error: "File worker exited: " + code });
      });
    });
  }
  stop() {
    for (const w of this.workers) w.terminate();
    this.workers.clear();
  }
}
module.exports = { FileActions };

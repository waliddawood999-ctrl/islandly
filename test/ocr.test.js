// Optional real OCR integration: downloads official ara+eng language data on first run.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { Worker } = require("node:worker_threads");
const sharp = require("sharp");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "islandly-ocr-test-"));
(async () => {
  const input = path.join(tmp, "sample.png");
  await sharp(
    Buffer.from(
      '<svg width="900" height="180" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="white"/><text x="35" y="115" font-size="72" font-family="sans-serif" fill="black">ISLANDLY 12345</text></svg>',
    ),
  )
    .png()
    .toFile(input);
  const result = await new Promise((resolve, reject) => {
    const worker = new Worker(
      path.resolve(__dirname, "../src/main/file-worker.js"),
      {
        workerData: {
          baseRoot: path.resolve(__dirname, ".."),
          files: [input],
          op: "ocr",
          cache: path.join(tmp, "cache"),
          output: tmp,
        },
      },
    );
    const timeout = setTimeout(() => {
      worker.terminate();
      reject(new Error("OCR timeout"));
    }, 120000);
    worker.on("message", (r) => {
      if (r.progress !== undefined) return;
      clearTimeout(timeout);
      worker.terminate();
      resolve(r);
    });
    worker.on("error", (e) => {
      clearTimeout(timeout);
      reject(e);
    });
  });
  assert.equal(result.ok, true, result.error);
  assert.match(result.text, /ISLANDLY\s+12345/);
  console.log(
    "Real OCR integration passed (ara+eng engine, generated English fixture). Arabic recognition quality is not asserted.",
  );
})()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => fs.rmSync(tmp, { recursive: true, force: true }));

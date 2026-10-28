// Expensive decoders run off Electron's main thread and only process explicitly selected local files.
const { parentPort, workerData: d } = require("worker_threads");
const fs = require("fs");
const path = require("path");
const dependency = (name) =>
  require(require.resolve(name, { paths: [d.baseRoot] }));
(async () => {
  for (const file of d.files) {
    const stat = fs.statSync(file);
    if (!stat.isFile() || stat.size > 100 * 1024 * 1024)
      throw new Error("File exceeds 100 MB limit");
  }
  let data,
    ext,
    name = path.basename(d.files[0], path.extname(d.files[0]));
  if (d.op === "pdf-merge" || d.op === "pdf-optimize") {
    const { PDFDocument } = dependency("pdf-lib");
    const out = await PDFDocument.create();
    for (const file of d.files) {
      const doc = await PDFDocument.load(fs.readFileSync(file));
      if (doc.getPageCount() > 500) throw new Error("PDF has too many pages");
      const pages = await out.copyPages(doc, doc.getPageIndices());
      pages.forEach((p) => out.addPage(p));
    }
    data = Buffer.from(await out.save({ useObjectStreams: true }));
    ext = "pdf";
    name += "-processed";
    if (
      d.op === "pdf-optimize" &&
      data.length >= fs.statSync(d.files[0]).size
    ) {
      parentPort.postMessage({
        ok: false,
        error: "PDF cannot be made smaller without reducing image quality.",
      });
      return;
    }
  } else if (d.op === "ocr") {
    const sharp = dependency("sharp");
    const input = await sharp(d.files[0], {
      limitInputPixels: 40 * 1000 * 1000,
    })
      .rotate()
      .png()
      .toBuffer();
    const { createWorker } = dependency("tesseract.js");
    fs.mkdirSync(d.cache, { recursive: true });
    const worker = await createWorker("ara+eng", 1, {
      cachePath: d.cache,
      logger: (m) => {
        if (m.status === "recognizing text")
          parentPort.postMessage({ progress: Math.round(m.progress * 100) });
      },
    });
    let text;
    try {
      const result = await worker.recognize(input);
      text = result.data.text.slice(0, 50000);
    } finally {
      await worker.terminate();
    }
    // Finish nested OCR worker cleanup before the parent terminates this file worker.
    parentPort.postMessage({ ok: true, text });
    return;
  } else {
    const sharp = dependency("sharp");
    let image = sharp(d.files[0], {
      limitInputPixels: 40 * 1000 * 1000,
    }).rotate();
    if (d.op === "half") {
      const meta = await image.metadata();
      image = image.resize(Math.max(1, Math.round(meta.width / 2)));
    } else if (d.op === "resize") {
      if (!Number.isInteger(d.width) || d.width < 16 || d.width > 8000)
        throw new Error("Invalid image width");
      image = image.resize({ width: d.width, withoutEnlargement: true });
    }
    ext = ["jpg", "compress"].includes(d.op)
      ? "jpg"
      : d.op === "webp"
        ? "webp"
        : "png";
    image =
      ext === "jpg"
        ? image.jpeg({ quality: d.op === "compress" ? 75 : 90, mozjpeg: true })
        : ext === "webp"
          ? image.webp({ quality: 85 })
          : image.png({ compressionLevel: 9 });
    data = await image.toBuffer();
    name += "-" + d.op;
  }
  fs.mkdirSync(d.output, { recursive: true });
  let target;
  for (let n = 0; n < 10000; n++) {
    target = path.join(d.output, `${name}${n ? " (" + n + ")" : ""}.${ext}`);
    let fd;
    try {
      fd = fs.openSync(target, "wx");
    } catch (e) {
      if (e.code === "EEXIST") continue;
      throw e;
    }
    try {
      fs.writeFileSync(fd, data);
    } catch (e) {
      fs.closeSync(fd);
      fs.rmSync(target, { force: true });
      throw e;
    }
    fs.closeSync(fd);
    parentPort.postMessage({ ok: true, path: target });
    return;
  }
  throw new Error("Cannot create unique output filename");
})().catch((e) => parentPort.postMessage({ ok: false, error: e.message }));

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const os = require("os");
const vm = require("vm");
const Module = require("module");
const { Worker } = require("worker_threads");
const repo = path.resolve(__dirname, ".."),
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "islandly-features-"));
function load(rel, stubs = {}) {
  const file = path.join(repo, rel),
    m = { exports: {} },
    real = Module.createRequire(file),
    req = (n) => (Object.hasOwn(stubs, n) ? stubs[n] : real(n));
  const context = vm.createContext({
    require: req,
    module: m,
    exports: m.exports,
    __dirname: path.dirname(file),
    __filename: file,
    console,
    process,
    Buffer,
    URL,
    Blob,
    AbortController,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
  });
  new vm.Script(Module.wrap(fs.readFileSync(file, "utf8"))).runInContext(
    context,
  )(m.exports, req, m, file, path.dirname(file));
  return m.exports;
}
const json = (x) => JSON.parse(JSON.stringify(x));
function operation(files, op, width) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(path.join(repo, "src/main/file-worker.js"), {
      workerData: { baseRoot: repo, files, op, width, output: tmp },
    });
    worker.on("message", async (r) => {
      if (r.progress !== undefined) return;
      await worker.terminate();
      r.ok ? resolve(r) : reject(new Error(r.error));
    });
    worker.on("error", reject);
  });
}
(async () => {
  const { parseLrc } = load("src/main/services/lyrics.js", {
    electron: { net: {} },
  });
  assert.deepStrictEqual(
    json(parseLrc("[00:12.50][00:20.0]hello\n[00:01.00]start")),
    [
      { at: 1, text: "start" },
      { at: 12.5, text: "hello" },
      { at: 20, text: "hello" },
    ],
  );
  const { ActivityHub } = require("../src/main/services/activity");
  const alerts = [],
    hub = new ActivityHub(
      () => {},
      (x) => alerts.push(x),
    );
  hub.focus(true);
  hub.add({ title: "private inbox alert" });
  assert.equal(alerts.length, 0);
  hub.focus(false);
  assert.equal(alerts.length, 1);
  for (let i = 0; i < 120; i++) hub.add({ title: "n" + i });
  assert.equal(hub.list().length, 100);
  hub.clear();
  assert.equal(hub.list().length, 0);
  hub.stop();
  let encrypted = true;
  const fakeElectron = {
    app: { getPath: () => tmp },
    safeStorage: {
      isEncryptionAvailable: () => encrypted,
      encryptString: (s) => Buffer.from("protected:" + s),
      decryptString: (b) => b.toString().slice(10),
    },
  };
  const settings = load("src/main/settings.js", { electron: fakeElectron });
  settings.init();
  settings.set({ scale: -3, lat: 91, autoHide: "invalid" });
  assert.equal(settings.get().scale, 0.8);
  assert.equal(settings.get().lat, 0);
  assert.equal(settings.get().autoHide, "auto");
  let event;
  settings.onChange((s) => (event = s));
  settings.setSecret("aiKey", "fake-secret");
  assert.equal(settings.getSecret("aiKey"), "fake-secret");
  assert(!("secrets" in event));
  encrypted = false;
  assert.throws(
    () => settings.setSecret("githubToken", "fake-token"),
    /Secure storage/,
  );
  assert(
    !fs.readFileSync(path.join(tmp, "settings.json"), "utf8").includes("raw:"),
  );
  let foreground = "notepad",
    snapshot = [];
  const clip = {
    read: async () => snapshot,
    readText: async () => "hello",
    writeText: async () => {},
    write: async () => {},
  };
  const { ClipboardHistory, classify } = load("src/main/clipboard.js", {
    electron: { clipboard: clip },
    "./win32": { foreground: () => ({ app: foreground }) },
  });
  const history = new ClipboardHistory(() => {});
  history.timer = 1;
  history.last = "old";
  foreground = "bitwarden";
  await history.poll();
  assert.equal(history.list().length, 0);
  foreground = "notepad";
  snapshot = [
    {
      types: [
        'electron application/osclipboard;format="ExcludeClipboardContentFromMonitorProcessing"',
      ],
    },
  ];
  await history.poll();
  assert.equal(history.list().length, 0);
  // A password-manager foreground switch while a clipboard payload is resolving must not store it.
  let deliver;
  snapshot = [
    {
      types: ["text/plain"],
      getType: () =>
        new Promise((resolve) => {
          deliver = resolve;
        }),
    },
  ];
  history.last = "old";
  const pendingRead = history.poll();
  await new Promise((resolve) => setImmediate(resolve));
  foreground = "bitwarden";
  deliver(new Blob(["must not enter history"], { type: "text/plain" }));
  await pendingRead;
  assert.equal(history.list().length, 0);
  foreground = "notepad";
  history.last = "old";
  const staleRead = history.poll();
  await new Promise((resolve) => setImmediate(resolve));
  history.stop();
  history.start();
  deliver(new Blob(["stale secret"], { type: "text/plain" }));
  await staleRead;
  assert.equal(history.list().length, 0, "old reads cannot cross stop/restart");
  history.stop();
  for (let i = 0; i < 30; i++) history.add("item " + i);
  assert.equal(history.list().length, 20);
  assert.equal(classify("SA0380000000608010167519").type, "iban");
  history.timer = null;
  const sharp = require("sharp");
  sharp.cache(false);
  const image = path.join(tmp, "input.png");
  await sharp({
    create: { width: 80, height: 40, channels: 3, background: "#ff5733" },
  })
    .png()
    .toFile(image);
  const converted = await operation([image], "webp");
  const meta = await sharp(converted.path).metadata();
  assert.equal(meta.format, "webp");
  assert.equal(meta.width, 80);
  const half = await operation([image], "half");
  assert.equal((await sharp(half.path).metadata()).width, 40);
  const { PDFDocument } = require("pdf-lib");
  const pdf = await PDFDocument.create();
  pdf.addPage([200, 200]);
  const input = path.join(tmp, "input.pdf");
  fs.writeFileSync(input, await pdf.save());
  const merged = await operation([input, input], "pdf-merge");
  assert.equal(
    (await PDFDocument.load(fs.readFileSync(merged.path))).getPageCount(),
    2,
  );
  assert(fs.existsSync(input), "original is never removed");
  const { search } = require("../src/main/services/file-search");
  assert.equal((await search("input.pdf", tmp)).length, 1);
  console.log(
    "feature integration: LRC, notification digest, settings validation, secret protection, clipboard privacy/limits, WebP, resize, PDF merge and local search passed",
  );
})()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() =>
    fs.rmSync(tmp, {
      recursive: true,
      force: true,
      maxRetries: 10,
      retryDelay: 100,
    }),
  );

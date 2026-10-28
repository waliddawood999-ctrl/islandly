// Read-only probes of the checked-out application. Only isolated temporary fixtures are written.
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const vm = require("vm");
const Module = require("module");
const EventEmitter = require("events");
const repo = path.resolve(__dirname, "..");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "islandly-audit-"));
const no = () => {};
let passed = 0;
const results = [];
function record(name, detail) {
  passed++;
  results.push({ name, detail });
  console.log("PASS:", name, "-", detail);
}
function load(rel, stubs = {}, globals = {}) {
  const filename = path.join(repo, rel);
  const mod = { exports: {} };
  const real = Module.createRequire(filename);
  function req(name) {
    return Object.hasOwn(stubs, name) ? stubs[name] : real(name);
  }
  req.resolve = (name) =>
    Object.hasOwn(stubs, name) ? name : real.resolve(name);
  const context = vm.createContext({
    require: req,
    module: mod,
    exports: mod.exports,
    __filename: filename,
    __dirname: path.dirname(filename),
    console,
    process,
    Buffer,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    URL,
    AbortController,
    global: {},
    ...globals,
  });
  new vm.Script(Module.wrap(fs.readFileSync(filename, "utf8")), {
    filename,
  }).runInContext(context)(
    mod.exports,
    req,
    mod,
    filename,
    path.dirname(filename),
  );
  return mod.exports;
}
(async () => {
  // R1: execute the real bootstrap against a staged main that requires a real shipped dependency.
  const bootData = path.join(tmp, "bootstrap");
  const staged = path.join(bootData, "updates", "9.9.9");
  fs.mkdirSync(path.join(staged, "src/main"), { recursive: true });
  fs.writeFileSync(path.join(staged, "src/main/main.js"), "require('adhan');");
  const base = require(path.join(repo, "package.json")).islandlyBase;
  fs.writeFileSync(
    path.join(bootData, "updates/current.json"),
    JSON.stringify({ dir: staged, base, version: "9.9.9", booting: false }),
  );
  let bootError;
  try {
    load("src/main/bootstrap.js", {
      electron: { app: { getPath: () => bootData } },
    });
  } catch (e) {
    bootError = e;
  }
  assert.strictEqual(
    bootError,
    undefined,
    "staged update must load packaged dependencies",
  );
  assert(fs.existsSync(path.join(repo, "node_modules/adhan")));
  record(
    "R1: staged bootstrap resolves packaged dependency",
    "adhan resolved from the base package",
  );

  // R2: download a next update while the current root lives inside updates/.
  const data = path.join(tmp, "cleanup");
  const current = path.join(data, "updates/0.5.0");
  fs.mkdirSync(path.join(current, "src/main"), { recursive: true });
  fs.writeFileSync(
    path.join(current, "src/main/main.js"),
    "current running code",
  );
  const files = {
    "package.json": JSON.stringify({ version: "0.6.0", islandlyBase: base }),
    "src/main/main.js": "new code",
  };
  const { gitBlobSha } = require(path.join(repo, "src/main/util"));
  const net = {
    fetch: async (url) => {
      const response = (value) => ({
        ok: true,
        json: async () => value,
        text: async () =>
          typeof value === "string" ? value : JSON.stringify(value),
        arrayBuffer: async () => Buffer.from(value),
      });
      if (url.includes("/commits/")) return response({ sha: "fixture" });
      if (url.includes("/git/trees/"))
        return response({
          truncated: false,
          tree: Object.entries(files).map(([p, c]) => ({
            path: p,
            type: "blob",
            sha: gitBlobSha(Buffer.from(c)),
          })),
        });
      const key = url.split("/fixture/")[1];
      assert(Object.hasOwn(files, key), url);
      return response(files[key]);
    },
  };
  const { Updater } = load(
    "src/main/updater.js",
    { electron: { app: { getPath: () => data }, net } },
    {
      global: {
        __ISLANDLY: { root: current, baseRoot: repo, version: "0.5.0" },
      },
    },
  );
  const r = await new Updater(() => {}).check();
  assert.strictEqual(r.status, "ready");
  assert(fs.existsSync(current), "running version must survive staging");
  record(
    "R2: updater preserves running update directory",
    "0.5.0 remains available while 0.6.0 is staged",
  );

  // R3: stop() cancels the interval but leaves the delayed initial check alive.
  const pending = new Map();
  let seq = 0;
  const fakeTimer = (cb) => {
    pending.set(++seq, cb);
    return seq;
  };
  const clear = (id) => pending.delete(id);
  const U = load(
    "src/main/updater.js",
    { electron: { app: {}, net: {} } },
    {
      setTimeout: fakeTimer,
      setInterval: fakeTimer,
      clearInterval: clear,
      clearTimeout: clear,
    },
  ).Updater;
  const u = new U(() => {});
  let checks = 0;
  u.check = () => checks++;
  u.start();
  u.stop();
  for (const cb of pending.values()) cb();
  assert.strictEqual(checks, 0, "stop must cancel delayed startup");
  record(
    "R3: updater stop cancels initial check",
    "no check executes after stop()",
  );

  // R4 is covered by renderer.test.js, which loads the real lib.js with a frozen bridge.
  // R5: clearing a calendar does not invalidate an already-started request.
  let finishCalendar;
  const calendarEvents = [];
  const C = load(
    "src/main/calendar.js",
    {
      electron: {
        net: {
          fetch: () => new Promise((resolve) => (finishCalendar = resolve)),
        },
      },
    },
    { setInterval: () => 1, clearInterval: no },
  ).CalendarFeed;
  const c = new C((s) => calendarEvents.push(s));
  c.configure("https://example.invalid/calendar.ics");
  c.configure("");
  finishCalendar({
    ok: true,
    text: async () => "BEGIN:VCALENDAR\nEND:VCALENDAR",
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.strictEqual(c.status, "off");
  assert.strictEqual(calendarEvents.at(-1).status, "off");
  record(
    "R5: disabled calendar ignores stale request",
    "status stays off after clearing URL",
  );

  // R6: disabling weather does not invalidate a request in flight.
  let finishWeather;
  const W = load(
    "src/main/services/weather.js",
    {
      electron: {
        net: {
          fetch: () => new Promise((resolve) => (finishWeather = resolve)),
        },
      },
    },
    { setInterval: () => 1, clearInterval: no },
  ).Weather;
  const w = new W(no);
  w.configure({ lat: 24, lng: 46 }, true);
  w.configure({ lat: 24, lng: 46 }, false);
  finishWeather({
    ok: true,
    json: async () => ({
      current: { temperature_2m: 30, weather_code: 0, is_day: 1 },
      daily: { temperature_2m_max: [35], temperature_2m_min: [20] },
    }),
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.strictEqual(
    w.last,
    null,
    "disabled weather must ignore the old response",
  );
  record(
    "R6: disabled weather ignores stale request",
    "last stays null after disable",
  );

  // R7: metadata event supplies a late thumbnail for an unchanged track key.
  let session = {
    sourceAppId: "player",
    media: { title: "Track", artist: "Artist", thumbnail: null },
    playback: { playbackStatus: 4 },
    timeline: { position: 0, duration: 100 },
  };
  let monitor;
  class Monitor extends EventEmitter {
    constructor() {
      super();
      monitor = this;
    }
    static getCurrentMediaSession() {
      return session;
    }
    static getMediaSessions() {
      return session ? [session] : [];
    }
  }
  const jobs = [];
  const payloads = [];
  load(
    "src/main/media-worker.js",
    {
      worker_threads: {
        parentPort: { postMessage: (p) => payloads.push(p), on() {} },
        workerData: { baseRoot: repo },
      },
      "@coooookies/windows-smtc-monitor": { SMTCMonitor: Monitor },
    },
    {
      setTimeout: (cb) => {
        jobs.push(cb);
        return 1;
      },
    },
  );
  jobs.shift()();
  session.media.thumbnail = Buffer.from("late thumbnail");
  monitor.emit("session-media-changed");
  jobs.shift()();
  assert(payloads.at(-1).thumb, "late artwork must be published");
  record(
    "R7: late album artwork is applied",
    "metadata thumbnail supplied and published",
  );

  // R8: privacy watcher dedup remains active across an explicit clear/disable.
  let privacyState;
  let privacyEmits = 0;
  const reg =
    "HKEY_CURRENT_USER\\Software\\ConsentStore\\microphone\\Zoom.exe\n LastUsedTimeStart REG_QWORD 0x123\n LastUsedTimeStop REG_QWORD 0x0";
  const P = load("src/main/services/privacy.js", {
    child_process: {
      execFile: (_cmd, args, _opts, cb) =>
        cb(null, args[1].endsWith("microphone") ? reg : ""),
    },
  }).PrivacyWatcher;
  const p = new P((s) => {
    privacyState = s;
    privacyEmits++;
  });
  await p.poll();
  p.stop();
  // main.js explicitly publishes an empty state when setting is disabled.
  privacyState = { mic: [], cam: [] };
  await p.poll();
  assert.strictEqual(privacyEmits, 2);
  assert.strictEqual(privacyState.mic.length, 1);
  record(
    "R8: reenabled privacy watcher republishes active mic",
    "UI receives the current active microphone again",
  );
  console.log("TOTAL:", passed, "reliability regressions passed.");
})()
  .catch((e) => {
    console.error(e.stack);
    process.exitCode = 1;
  })
  .finally(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
    if (process.versions.electron)
      require("electron").app.exit(process.exitCode || 0);
  });

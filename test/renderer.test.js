const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { JSDOM, ResourceLoader, VirtualConsole } = require("jsdom");
const root = path.resolve(__dirname, "../src/renderer");
const errors = [];
const sent = [];
const handlers = {};
const defaults = require("../src/main/settings").DEFAULTS;
class LocalResources extends ResourceLoader {
  fetch(url) {
    const file = path.join(root, new URL(url).pathname);
    return Promise.resolve(fs.readFileSync(file));
  }
}
const fixtures = {
  "notes:get": {
    todos: Array.from({ length: 15 }, (_, id) => ({
      id,
      text: "task " + id,
      done: false,
    })),
    memo: "saved memo",
  },
  "clipboard:list": [],
  "shelf:list": [],
  "plugins:list": [],
  "jobs:list": [],
  "activity:list": [],
  "launcher:list": [],
  "calendar:get": { status: "off", events: [] },
  "github:get": { status: "off", items: [] },
  "privacy:get": { mic: [], cam: [] },
  "notifications:status": "package-required",
  "media:caps": { ok: true, next: true, prev: true, seek: true, toggle: true },
};
const vc = new VirtualConsole();
vc.on("jsdomError", (e) => errors.push(e.message));
const dom = new JSDOM(fs.readFileSync(path.join(root, "index.html"), "utf8"), {
  url: "https://islandly.test/",
  runScripts: "dangerously",
  resources: new LocalResources(),
  pretendToBeVisual: true,
  virtualConsole: vc,
  beforeParse(w) {
    w.ResizeObserver = class {
      observe() {}
      disconnect() {}
    };
    w.matchMedia = () => ({ matches: false });
    w.islandAPI = Object.freeze({
      settings: Object.freeze({ ...defaults }),
      call: async (ch) => fixtures[ch] ?? null,
      send: (...args) => sent.push(args),
      on: (ch, fn) => (handlers[ch] ??= []).push(fn),
      pathsForFiles: () => [],
    });
  },
});
(async () => {
  await new Promise((resolve) => dom.window.addEventListener("load", resolve));
  await new Promise((resolve) => setTimeout(resolve, 80));
  const w = dom.window,
    run = (script) => w.eval(script),
    emit = (ch, p) => handlers[ch]?.forEach((fn) => fn(p));
  assert.deepStrictEqual(
    errors,
    [],
    "renderer should load all production scripts without an exception",
  );
  assert(
    sent.some((e) => e[0] === "app:ready"),
    "renderer health handshake",
  );
  emit("settings:update", {
    ...defaults,
    prayerAlerts: false,
    timeTracking: false,
  });
  assert.strictEqual(run("API.settings.prayerAlerts"), false);
  assert.strictEqual(
    w.islandAPI.settings.prayerAlerts,
    true,
    "bridge remains immutable",
  );
  assert.strictEqual(
    run('Island.feature("notes").list.children.length'),
    15,
    "all saved tasks are accessible",
  );
  assert.strictEqual(run('Island.feature("notes").memo.value'), "saved memo");
  emit(
    "clipboard:update",
    Array.from({ length: 20 }, (_, id) => ({
      id,
      text: "item " + id,
      type: "text",
    })),
  );
  assert.strictEqual(
    run('Island.feature("clipboard").list.children.length'),
    20,
    "all twenty clipboard entries are accessible",
  );
  emit("media:update", {
    type: "media",
    active: true,
    app: "player",
    title: "Track",
    artist: "Artist",
    playing: true,
    position: 0,
    duration: 100,
    sentAt: Date.now(),
    thumb: null,
    trackChanged: true,
    sessions: [{ app: "player", title: "Track" }],
  });
  emit("lyrics:update", {
    status: "ok",
    lines: [
      { at: 0, text: "line one" },
      { at: 40, text: "line two" },
    ],
    text: "",
  });
  assert(
    run('Island.feature("music").lyrics.textContent').includes("line one"),
  );
  for (const id of [
    "music",
    "notes",
    "clipboard",
    "activity",
    "launcher",
    "jobs",
    "assistant",
    "plugins",
    "adhkar",
    "system",
  ])
    run(`Island.open(${JSON.stringify(id)})`);
  emit("activity:update", [
    {
      id: 1,
      source: "test",
      title: "notification",
      body: "body",
      at: Date.now(),
    },
  ]);
  emit("jobs:update", [
    { id: "job", label: "Build", status: "running", progress: 50 },
  ]);
  run(
    "const originalContext = Island.setContext; Island.setContext = id => { window.contextPanel = id; return originalContext(id); };",
  );
  emit("foreground", { app: "code.exe" });
  assert.equal(
    w.contextPanel,
    "jobs",
    "running developer jobs become the context panel",
  );
  emit("foreground", { app: "chrome" });
  assert.equal(w.contextPanel, "clipboard");
  emit("foreground", { app: "Teams" });
  assert.equal(w.contextPanel, "calendar");
  run(
    'Island.feature("timer").setMinutes(10);Island.feature("timer").start();Island.feature("timer").persist();',
  );
  assert(JSON.parse(w.localStorage.getItem("islandly-timer")).running);
  run('Island.feature("timer").stop();');
  assert.deepStrictEqual(
    errors,
    [],
    "interactions should not create script errors",
  );
  console.log(
    "renderer DOM integration: all panels load, settings, clipboard, memo, lyrics and timer passed",
  );
})()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => dom.window.close());

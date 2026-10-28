const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const Module = require("node:module");
const { EventEmitter } = require("node:events");
const filename = path.resolve(__dirname, "../src/main/media.js");
const workers = [];
class Worker extends EventEmitter {
  constructor() {
    super();
    workers.push(this);
  }
  postMessage() {}
  terminate() {
    this.emit("exit", 0);
    return Promise.resolve(0);
  }
}
const real = Module.createRequire(filename);
const req = (name) =>
  name === "worker_threads"
    ? { Worker }
    : name === "./ps"
      ? { isWindows: true, spawnScript: () => null }
      : real(name);
const m = { exports: {} };
vm.runInNewContext(Module.wrap(fs.readFileSync(filename, "utf8")), {
  console,
  Buffer,
  process,
  setTimeout,
  clearTimeout,
})(m.exports, req, m, filename, path.dirname(filename));
(async () => {
  const events = [],
    bridge = new m.exports.MediaBridge(
      (x) => events.push(x),
      path.resolve(__dirname, ".."),
    );
  bridge.start();
  const old = workers[0];
  bridge.stop();
  bridge.start();
  old.emit("message", { app: "stale" });
  old.emit("error", new Error("stale worker"));
  assert.equal(events.length, 0, "old worker cannot overwrite restarted UI");
  workers[1].emit("message", { app: "current" });
  assert.equal(events[0].app, "current");
  let release,
    calls = 0;
  bridge.commands = new Promise((resolve) => {
    release = resolve;
  });
  bridge.performControl = () => {
    calls++;
    return { ok: true };
  };
  const queued = bridge.control("playpause");
  bridge.stop();
  release();
  assert.equal((await queued).ok, false);
  assert.equal(calls, 0, "queued commands cannot execute after stop");
  console.log(
    "Media lifecycle: stale worker events and queued commands rejected",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

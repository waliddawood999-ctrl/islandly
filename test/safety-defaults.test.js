const assert = require('node:assert/strict');
const Module = require('module');
const original = Module._load;
const handlers = new Map();
let enumerate;
let captureWindows = 0;
const electron = {
  app: {},
  ipcMain: { handle: (channel, handler) => handlers.set(channel, handler) },
  session: { defaultSession: {
    setDisplayMediaRequestHandler() {},
    setPermissionRequestHandler() {},
  } },
  screen: { getCursorScreenPoint: () => ({}), getDisplayNearestPoint: () => ({
    bounds: { width: 100, height: 100 }, scaleFactor: 1,
  }) },
  desktopCapturer: { getSources: () => enumerate() },
  BrowserWindow: class { constructor() { captureWindows++; throw new Error('Unexpected capture window'); } },
};
Module._load = function (id, ...args) {
  if (id === 'electron') return electron;
  return original.call(this, id, ...args);
};
const settings = require('../src/main/settings');
const { LocalShare } = require('../src/main/services/share');
const { FileActions } = require('../src/main/services/files');
const { Tools } = require('../src/main/services/tools');
const { Capture } = require('../src/main/capture');
(async () => {
  for (const key of ['lanShare', 'captureEnabled', 'ffmpegEnabled', 'rembgEnabled', 'lyrics', 'pluginsEnabled', 'nativeNotifications', 'circularClickThrough'])
    assert.equal(settings.DEFAULTS[key], false, key);
  await assert.rejects(new LocalShare().share('/missing'), /unavailable/);
  assert.throws(() => new FileActions().run(['/missing'], 'ocr'), /verified language data/);
  let spawned = false;
  const tools = new Tools({ start() { spawned = true; } });
  assert.equal((await tools.run('/missing', 'gif')).ok, false);
  assert.equal((await tools.run('/missing', 'background')).ok, false);
  assert.equal(spawned, false);
  const capture = new Capture('/unused');
  await assert.rejects(capture.open('record'), /disabled/);
  assert.throws(() => handlers.get('capture:chunk')({}, [1]), /disabled/);
  const get = settings.get;
  let enabled = true;
  settings.get = () => ({ ...get(), captureEnabled: enabled, ffmpegEnabled: enabled });
  try {
    let resolveSources;
    enumerate = () => new Promise(resolve => { resolveSources = resolve; });
    let pending = capture.open('image');
    enabled = false;
    resolveSources([]);
    await assert.rejects(pending, /disabled/);
    enabled = true;
    pending = capture.open('image');
    capture.stop();
    resolveSources([]);
    await assert.rejects(pending, /disabled/);
    assert.equal(captureWindows, 0, 'disable/stop during enumeration must not open a window');
    tools.available = async () => { enabled = false; return '/unused/ffmpeg'; };
    assert.equal((await tools.run('/unused/input.mp4', 'gif')).ok, false);
    assert.equal(spawned, false, 'disable during lookup must not start a job');
    assert.match((await tools.run('/unused/input.mp4', 'toString')).error, /Invalid/);
  } finally { settings.get = get; Module._load = original; }
  console.log('Safety defaults: disabled operations cannot spawn tools, workers or LAN listeners');
})().catch(e => { console.error(e); process.exitCode = 1; });

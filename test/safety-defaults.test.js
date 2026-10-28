const assert = require('node:assert/strict');
const Module = require('module');
const original = Module._load;
Module._load = function (id, ...args) {
  if (id === 'electron') return { app: {} };
  return original.call(this, id, ...args);
};
const settings = require('../src/main/settings');
const { LocalShare } = require('../src/main/services/share');
const { FileActions } = require('../src/main/services/files');
const { Tools } = require('../src/main/services/tools');
(async () => {
  for (const key of ['lanShare', 'captureEnabled', 'ffmpegEnabled', 'rembgEnabled', 'lyrics', 'pluginsEnabled', 'nativeNotifications'])
    assert.equal(settings.DEFAULTS[key], false, key);
  await assert.rejects(new LocalShare().share('/missing'), /unavailable/);
  assert.throws(() => new FileActions().run(['/missing'], 'ocr'), /verified language data/);
  let spawned = false;
  const tools = new Tools({ start() { spawned = true; } });
  assert.equal((await tools.run('/missing', 'gif')).ok, false);
  assert.equal((await tools.run('/missing', 'background')).ok, false);
  assert.equal(spawned, false);
  console.log('Safety defaults: disabled operations cannot spawn tools, workers or LAN listeners');
})().catch(e => { console.error(e); process.exitCode = 1; });

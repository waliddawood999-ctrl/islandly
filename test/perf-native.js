// Real native API smoke on Windows; no actual ConsentStore keys are modified.
const assert = require('node:assert/strict');
const native = require('../src/main/native-perf');
const { host } = require('../src/main/ps');
(async () => {
  assert.equal(process.platform, 'win32');
  assert(Number.isInteger(native.clipboardSequence()), 'native clipboard sequence must load');
  const privacy = native.readPrivacy(); assert(Array.isArray(privacy.mic) && Array.isArray(privacy.cam));
  const stop = native.watchPrivacy(() => {}); stop();
  const metric = native.processMetrics(process.pid); assert(metric && metric.mb > 0);
  const result = await host.request('brightness.ps1', [], '', 30000);
  assert(result.ok, 'shared PowerShell host must return a protocol reply');
  const pid = host.pids()[0]; assert(pid > 0);
  const selection = await host.request('explorer-selection.ps1', [], '', 30000);
  assert(selection.ok); assert.equal(host.pids()[0], pid, 'fixed scripts share one host');
  const caps = await host.request('media', [], 'caps', 30000);
  assert.equal(typeof caps.ok, 'boolean'); assert.equal(host.pids()[0], pid);
  host.shutdown();
  console.log('native clipboard/ConsentStore/working-set and shared PowerShell script/media protocol passed');
})().catch(err => { host.shutdown(); console.error(err); process.exitCode = 1; });

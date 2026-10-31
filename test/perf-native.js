// Real native API smoke on Windows; no actual ConsentStore keys are modified.
const assert = require('node:assert/strict');
const native = require('../src/main/native-perf');
const { host } = require('../src/main/ps');
(async () => {
  assert.equal(process.platform, 'win32');
  assert(Number.isInteger(native.clipboardSequence()), 'native clipboard sequence must load');
  const privacy = native.readPrivacy(); assert(Array.isArray(privacy.mic) && Array.isArray(privacy.cam));
  const koffi = require('koffi'), adv = koffi.load('advapi32.dll');
  const create = adv.func('int32 __stdcall RegCreateKeyExW(uintptr_t key, str16 subkey, uint32 reserved, str16 className, uint32 options, uint32 access, void *security, _Out_ uintptr_t *result, void *disposition)');
  const set = adv.func('int32 __stdcall RegSetValueExW(uintptr_t key, str16 name, uint32 reserved, uint32 type, void *data, uint32 length)');
  const close = adv.func('int32 __stdcall RegCloseKey(uintptr_t key)');
  const remove = adv.func('int32 __stdcall RegDeleteTreeW(uintptr_t key, str16 subkey)');
  const hkcu = process.arch === 'ia32' ? 0x80000001 : 0xffffffff80000001n;
  const fixture = 'Software\\IslandlyPerfTest-' + process.pid;
  let key, stop;
  try {
    const out = [0]; assert.equal(create(hkcu, fixture + '\\microphone\\NonPackaged\\fixture.exe', 0, null, 0, 0xf003f, null, out, null), 0); key = out[0];
    const start = Buffer.alloc(8); start.writeBigUInt64LE(1n);
    assert.equal(set(key, 'LastUsedTimeStart', 0, 11, start, 8), 0);
    assert.equal(set(key, 'LastUsedTimeStop', 0, 11, Buffer.alloc(8), 8), 0);
    assert.deepEqual(native.readPrivacy(fixture).mic, ['fixture.exe']);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error('RegNotifyChangeKeyValue did not notify')), 5000);
      stop = native.watchPrivacy(() => { clearTimeout(timer); resolve(); }, fixture);
      assert.equal(set(key, 'LastUsedTimeStop', 0, 11, start, 8), 0);
    });
    assert.deepEqual(native.readPrivacy(fixture).mic, []);
  } finally { stop?.(); if (key) close(key); remove(hkcu, fixture); }
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

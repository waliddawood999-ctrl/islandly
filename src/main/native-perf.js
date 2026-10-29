// Lightweight native clipboard/ConsentStore notifications and process working sets. No subprocesses.
let api, failed = false;
function load() {
  if (api || failed || process.platform !== 'win32') return api;
  try {
    const k = require('koffi'), u = k.load('user32.dll'), a = k.load('advapi32.dll'), n = k.load('kernel32.dll'), p = k.load('psapi.dll');
    api = {
      seq: u.func('uint32 __stdcall GetClipboardSequenceNumber()'),
      open: a.func('int32 __stdcall RegOpenKeyExW(uintptr_t key, str16 subkey, uint32 options, uint32 access, _Out_ uintptr_t *result)'),
      close: a.func('int32 __stdcall RegCloseKey(uintptr_t key)'),
      enumerate: a.func('int32 __stdcall RegEnumKeyExW(uintptr_t key, uint32 index, void *name, _Inout_ uint32 *length, void *reserved, void *className, void *classLength, void *lastWrite)'),
      value: a.func('int32 __stdcall RegQueryValueExW(uintptr_t key, str16 name, void *reserved, _Out_ uint32 *type, void *data, _Inout_ uint32 *size)'),
      notify: a.func('int32 __stdcall RegNotifyChangeKeyValue(uintptr_t key, bool subtree, uint32 filter, void *event, bool async)'),
      event: n.func('void * __stdcall CreateEventW(void *attributes, bool manual, bool initial, str16 name)'),
      signal: n.func('bool __stdcall SetEvent(void *event)'),
      wait: n.func('uint32 __stdcall WaitForSingleObject(void *event, uint32 milliseconds)'),
      closeHandle: n.func('bool __stdcall CloseHandle(void *handle)'),
      process: n.func('void * __stdcall OpenProcess(uint32 access, bool inherit, uint32 pid)'),
      memory: p.func('bool __stdcall GetProcessMemoryInfo(void *process, void *counters, uint32 size)'),
      times: n.func('bool __stdcall GetProcessTimes(void *process, void *creation, void *exit, void *kernel, void *user)'),
    };
  } catch (_) { failed = true; api = null; }
  return api;
}
function clipboardSequence() { try { return load()?.seq() ?? null; } catch (_) { return null; } }
const BASE = 'Software\\Microsoft\\Windows\\CurrentVersion\\CapabilityAccessManager\\ConsentStore';
function hkcu() { return process.arch === 'ia32' ? 0x80000001 : 0xffffffff80000001n; }
function open(a, key, name) { const out = [0]; return a.open(key, name, 0, 0x20019, out) === 0 ? out[0] : null; }
function readPrivacy(base = BASE) {
  const a = load(), result = { mic: [], cam: [] }; if (!a) return result;
  const walk = (handle, name, out, depth, budget) => {
    if (depth > 8 || budget.count++ > 4096) return;
    function value(field) { const b = Buffer.alloc(8), size = [8], type = [0]; return a.value(handle, field, null, type, b, size) === 0 && type[0] === 11 && size[0] === 8 ? b.readBigUInt64LE() : null; }
    const start = value('LastUsedTimeStart'), stop = value('LastUsedTimeStop');
    if (start && stop === 0n) out.push(name.split('\\').pop());
    for (let i = 0; i < 4096; i++) {
      const b = Buffer.alloc(1024), len = [512];
      if (a.enumerate(handle, i, b, len, null, null, null, null) !== 0) break;
      const sub = b.toString('utf16le', 0, len[0] * 2), child = open(a, handle, sub);
      if (child) { try { walk(child, name + '\\' + sub, out, depth + 1, budget); } finally { a.close(child); } }
    }
  };
  try {
    for (const [device, field] of [['microphone', 'mic'], ['webcam', 'cam']]) {
      const key = open(a, hkcu(), base + '\\' + device);
      if (key) { try { walk(key, device, result[field], 0, { count: 0 }); } finally { a.close(key); } }
    }
  } catch (_) { /* safe empty state; permission denied is not permission to launch reg.exe */ }
  return result;
}
function watchPrivacy(onChange, base = BASE) {
  const a = load(); if (!a) return () => {};
  const key = open(a, hkcu(), base); if (!key) return () => {};
  const event = a.event(null, false, false, null); if (!event) { a.close(key); return () => {}; }
  let stopped = false, pending = false, closed = false;
  const close = () => { if (!closed) { closed = true; a.close(key); a.closeHandle(event); } };
  const arm = () => {
    if (stopped) return close();
    if (a.notify(key, true, 0x10000005, event, true) !== 0) { stopped = true; return close(); }
    pending = true;
    a.wait.async(event, 0xffffffff, (err, code) => {
      pending = false;
      if (stopped) return close();
      if (err || code !== 0) { stopped = true; return close(); }
      arm(); // re-arm before reading to avoid losing another write
      if (!stopped) onChange();
    });
  };
  arm();
  return () => { stopped = true; if (pending) a.signal(event); else close(); };
}
const cpu = new Map();
function processMetrics(pid) {
  const a = load(); if (!a || !Number.isInteger(pid) || pid <= 0) return null;
  const h = a.process(0x410, false, pid); if (!h) return null;
  try {
    const b = Buffer.alloc(process.arch === 'ia32' ? 40 : 72); b.writeUInt32LE(b.length);
    if (!a.memory(h, b, b.length)) return null;
    const working = process.arch === 'ia32' ? b.readUInt32LE(12) : Number(b.readBigUInt64LE(16));
    const creation = Buffer.alloc(8), exit = Buffer.alloc(8), kernel = Buffer.alloc(8), user = Buffer.alloc(8);
    let percent = 0;
    if (a.times(h, creation, exit, kernel, user)) {
      const ticks = Number(kernel.readBigUInt64LE() + user.readBigUInt64LE()), now = performance.now(), old = cpu.get(pid);
      if (old && now > old.now) percent = (ticks - old.ticks) / 10000 / (now - old.now) * 100;
      cpu.set(pid, { ticks, now });
    }
    return { pid, mb: working / 1024 / 1024, cpu: Math.max(0, percent) };
  } finally { a.closeHandle(h); }
}
module.exports = { clipboardSequence, readPrivacy, watchPrivacy, processMetrics };

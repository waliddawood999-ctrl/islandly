// Working set and CPU of tracked external children. Never spawns a measurement helper.
let api;
const previous = new Map();
function processMetrics(pid) {
  if (process.platform !== 'win32') return null;
  try {
    if (!api) {
      const k = require('koffi'), kernel = k.load('kernel32.dll'), psapi = k.load('psapi.dll');
      api = {
        open: kernel.func('void * __stdcall OpenProcess(uint32 access, bool inherit, uint32 pid)'),
        close: kernel.func('bool __stdcall CloseHandle(void *handle)'),
        memory: psapi.func('bool __stdcall GetProcessMemoryInfo(void *process, void *counters, uint32 size)'),
        times: kernel.func('bool __stdcall GetProcessTimes(void *process, void *creation, void *exit, void *kernel, void *user)'),
      };
    }
    const handle = api.open(0x410, false, pid);
    if (!handle) return null;
    try {
      const b = Buffer.alloc(process.arch === 'ia32' ? 40 : 72); b.writeUInt32LE(b.length);
      if (!api.memory(handle, b, b.length)) return null;
      const bytes = process.arch === 'ia32' ? b.readUInt32LE(12) : Number(b.readBigUInt64LE(16));
      const creation = Buffer.alloc(8), exit = Buffer.alloc(8), kernel = Buffer.alloc(8), user = Buffer.alloc(8);
      let cpu = 0;
      if (api.times(handle, creation, exit, kernel, user)) {
        const ticks = Number(kernel.readBigUInt64LE() + user.readBigUInt64LE());
        const now = performance.now(), identity = creation.readBigUInt64LE().toString(), old = previous.get(pid);
        if (old && old.identity === identity && now > old.now) cpu = Math.max(0, (ticks - old.ticks) / 10000 / (now - old.now) * 100);
        previous.set(pid, { ticks, now, identity });
      }
      return { pid, mb: bytes / 1048576, cpu };
    } finally { api.close(handle); }
  } catch (_) { return null; }
}
function forget(pid) { previous.delete(pid); }
module.exports = { processMetrics, forget };

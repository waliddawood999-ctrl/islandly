// Each configuration owns its requests. A stopped/reconfigured provider cannot publish stale data.
class RequestScope {
  constructor() {
    this.generation = 0;
    this.controllers = new Set();
  }
  invalidate() {
    this.generation++;
    for (const c of this.controllers) c.abort();
    this.controllers.clear();
  }
  begin(timeout = 15000) {
    const generation = this.generation;
    const c = new AbortController();
    this.controllers.add(c);
    const timer = setTimeout(() => c.abort(), timeout);
    timer.unref?.();
    return {
      signal: c.signal,
      current: () => generation === this.generation && !c.signal.aborted,
      done: () => {
        clearTimeout(timer);
        this.controllers.delete(c);
      },
    };
  }
}
module.exports = { RequestScope };

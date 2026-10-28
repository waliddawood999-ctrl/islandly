// Bounded local notification inbox. No remote messages or clipboard contents are persisted.
class ActivityHub {
  constructor(onChange, onAlert, now = Date.now) {
    this.items = [];
    this.onChange = onChange;
    this.onAlert = onAlert;
    this.now = now;
    this.seq = 0;
    this.quiet = false;
    this.digest = false;
    this.timer = null;
    this.pending = [];
  }
  configure({ digest = false, minutes = 5 } = {}) {
    clearInterval(this.timer);
    this.digest = !!digest;
    if (this.digest)
      this.timer = setInterval(
        () => this.flush(),
        Math.max(1, Math.min(60, minutes)) * 60000,
      );
    else this.flush();
  }
  add(value) {
    if (!value || typeof value.title !== "string") return;
    const item = {
      id: ++this.seq,
      at: this.now(),
      source: String(value.source || "Islandly").slice(0, 60),
      title: value.title.slice(0, 200),
      body: String(value.body || "").slice(0, 1000),
      important: !!value.important,
      read: false,
    };
    this.items.unshift(item);
    this.items.length = Math.min(this.items.length, 100);
    this.onChange(this.list());
    if ((this.quiet || this.digest) && item.source !== "focus")
      this.pending.push(item);
    else this.onAlert(item);
    this.pending = this.pending.slice(-100);
    return item.id;
  }
  list() {
    return this.items.map((x) => ({ ...x }));
  }
  read() {
    this.items.forEach((x) => (x.read = true));
    this.onChange(this.list());
  }
  clear() {
    this.items = [];
    this.pending = [];
    this.onChange([]);
  }
  flush() {
    if (this.quiet || !this.pending.length) return;
    const batch = this.pending.splice(0);
    this.onAlert({
      source: "Islandly",
      title: `${batch.length} إشعارات / notifications`,
      body: batch
        .slice(-3)
        .map((x) => x.title)
        .join(" · "),
    });
  }
  focus(on) {
    this.quiet = !!on;
    if (!on) this.flush();
  }
  stop() {
    clearInterval(this.timer);
  }
}
module.exports = { ActivityHub };

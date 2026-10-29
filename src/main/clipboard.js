const { clipboard } = require('electron');
const native = require('./native-perf');
const { evaluate } = require('./services/calc');

const MAX_ITEMS = 30;
const MAX_LENGTH = 5000;

// Only text that looks like arithmetic (an operator between two numbers) is evaluated,
// so dates like 2026-10-28 or ranges like 1-5 are not mistaken for sums.
function safeMath(expr) {
  const t = expr.trim();
  if (!/^[\d\s+\-*/().×÷%^]+$/.test(t) || !/\d\s*[+\-*/×÷^]\s*[\d(]/.test(t)) return null;
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(t) || /^\d+-\d+$/.test(t)) return null;
  return evaluate(t);
}

function hexToRgb(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}

/** Work out what a copied string is, so the island can offer a fitting action. */
function classify(text) {
  const t = text.trim();
  if (/^https?:\/\/\S+$/i.test(t)) return { type: 'url' };
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return { type: 'email' };
  if (/^#([0-9a-f]{6}|[0-9a-f]{3})$/i.test(t)) return { type: 'color', color: t, rgb: hexToRgb(t) };
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(t) || /^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}$/.test(t)) return { type: 'text' }; // a date
  if (/^\+?[\d\s\-()]{7,20}$/.test(t) && t.replace(/\D/g, '').length >= 8) return { type: 'phone', digits: t.replace(/[^\d+]/g, '') };
  const result = safeMath(t);
  if (result !== null) return { type: 'math', result };
  return { type: 'text' };
}

class ClipboardHistory {
  constructor(onChange) {
    this.onChange = onChange;
    this.items = [];
    this.last = null; // null until the first poll has recorded what was already on the clipboard
    this.timer = null;
    this.busy = false;
    this.seq = 1;
  }

  start(interval = 800) {
    if (this.timer && this.interval === interval) return;
    if (this.timer) { clearInterval(this.timer); this.interval = interval; this.timer = setInterval(() => this.poll(), interval); return; }
    this.interval = interval;
    this.sequence = null;
    this.last = null;
    this.generation = (this.generation || 0) + 1;
    this.timer = setInterval(() => this.poll(), interval);
  }

  setEco(eco) { if (this.timer) this.start(eco ? 4000 : 800); }

  stop() {
    this.generation = (this.generation || 0) + 1;
    clearInterval(this.timer);
    this.timer = null;
  }

  // Electron's clipboard.readText()/writeText() return promises, so this is async and never overlaps itself.
  async poll() {
    if (this.busy) return;
    this.busy = true;
    const generation = this.generation;
    try {
      const sequence = native.clipboardSequence();
      if (sequence !== null && sequence === this.sequence) return;
      const text = await clipboard.readText();
      if (generation !== this.generation || typeof text !== 'string') return;
      this.sequence = sequence;
      const first = this.last === null;
      if (text === this.last) return;
      this.last = text;
      if (text && !first) this.add(text);
    } catch (_) {
      /* the clipboard can be locked by another app for a moment; try again next tick */
    } finally {
      this.busy = false;
    }
  }

  add(text) {
    const value = text.slice(0, MAX_LENGTH);
    const existing = this.items.find((i) => i.text === value);
    if (existing) {
      this.items = [existing, ...this.items.filter((i) => i !== existing)];
    } else {
      this.items.unshift({ id: this.seq++, text: value, ts: Date.now(), pinned: false, ...classify(value) });
      const unpinned = this.items.filter((i) => !i.pinned);
      if (unpinned.length > MAX_ITEMS) {
        const drop = new Set(unpinned.slice(MAX_ITEMS));
        this.items = this.items.filter((i) => !drop.has(i));
      }
    }
    this.emit();
  }

  list() {
    // pinned first, then newest
    return [...this.items.filter((i) => i.pinned), ...this.items.filter((i) => !i.pinned)];
  }

  emit() {
    this.onChange(this.list());
  }

  find(id) {
    return this.items.find((i) => i.id === id);
  }

  copy(id, as) {
    const item = this.find(id);
    if (!item) return;
    const text = as === 'rgb' && item.rgb ? item.rgb : as === 'result' && item.type === 'math' ? String(item.result) : item.text;
    this.last = text;
    Promise.resolve(clipboard.writeText(text)).catch(() => {});
  }

  pin(id) {
    const item = this.find(id);
    if (item) item.pinned = !item.pinned;
    this.emit();
  }

  remove(id) {
    this.items = this.items.filter((i) => i.id !== id);
    this.emit();
  }

  clear() {
    this.items = this.items.filter((i) => i.pinned);
    this.emit();
  }
}

module.exports = { ClipboardHistory, classify };

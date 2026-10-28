const { clipboard } = require('electron');

const MAX_ITEMS = 30;
const MAX_LENGTH = 5000;

function safeMath(expr) {
  if (!/^[\d\s+\-*/().]+$/.test(expr) || !/[+\-*/]/.test(expr)) return null;
  try {
    const value = Function(`"use strict"; return (${expr})`)();
    return Number.isFinite(value) ? Math.round(value * 1e8) / 1e8 : null;
  } catch (_) {
    return null;
  }
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
  if (/^\+?[\d\s\-()]{7,20}$/.test(t) && t.replace(/\D/g, '').length >= 8) return { type: 'phone', digits: t.replace(/[^\d+]/g, '') };
  const result = safeMath(t);
  if (result !== null) return { type: 'math', result };
  return { type: 'text' };
}

class ClipboardHistory {
  constructor(onChange) {
    this.onChange = onChange;
    this.items = [];
    this.last = '';
    this.timer = null;
    this.seq = 1;
  }

  start() {
    if (this.timer) return;
    this.last = clipboard.readText();
    this.timer = setInterval(() => this.poll(), 800);
  }

  stop() {
    clearInterval(this.timer);
    this.timer = null;
  }

  poll() {
    const text = clipboard.readText();
    if (!text || text === this.last) return;
    this.last = text;
    this.add(text);
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
    clipboard.writeText(text);
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

const { clipboard, ClipboardItem } = require("electron");
const crypto = require("crypto");
const win32 = require("./win32");
const { evaluate } = require("./services/calc");

const MAX_ITEMS = 20;
const MAX_IMAGE = 4 * 1024 * 1024;
const PRIVATE_APPS =
  /^(1password|bitwarden|keepass(?:xc)?|lastpass|dashlane|nordpass|enpass|keeper)$/i;
const PRIVATE_FORMAT =
  /excludeclipboardcontentfrommonitorprocessing|canincludeinclipboardhistory|canUploadToCloudClipboard|password|secret/i;
const MAX_LENGTH = 5000;

// Only text that looks like arithmetic (an operator between two numbers) is evaluated,
// so dates like 2026-10-28 or ranges like 1-5 are not mistaken for sums.
function safeMath(expr) {
  const t = expr.trim();
  if (!/^[\d\s+\-*/().×÷%^]+$/.test(t) || !/\d\s*[+\-*/×÷^]\s*[\d(]/.test(t))
    return null;
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(t) || /^\d+-\d+$/.test(t)) return null;
  return evaluate(t);
}

function hexToRgb(hex) {
  let h = hex.replace("#", "");
  if (h.length === 3)
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  const n = parseInt(h, 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}

/** Work out what a copied string is, so the island can offer a fitting action. */
function classify(text) {
  const t = text.trim();
  if (/^https?:\/\/\S+$/i.test(t)) return { type: "url" };
  if (/(?:شارع|حي\s|street|avenue|road)\s+\S+/i.test(t))
    return { type: "address" };
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return { type: "email" };
  if (/^#([0-9a-f]{6}|[0-9a-f]{3})$/i.test(t))
    return { type: "color", color: t, rgb: hexToRgb(t) };
  if (
    /^\d{4}-\d{1,2}-\d{1,2}$/.test(t) ||
    /^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}$/.test(t)
  )
    return { type: "text" }; // a date
  if (/^\+?[\d\s\-()]{7,20}$/.test(t) && t.replace(/\D/g, "").length >= 8)
    return { type: "phone", digits: t.replace(/[^\d+]/g, "") };
  if (/^[A-Z]{2}\d{2}[A-Z0-9 ]{10,34}$/i.test(t)) return { type: "iban" };
  if (
    /(?:^|\n)\s*(?:const |let |function |import |def |class |SELECT |<\w+[ >])/.test(
      t,
    )
  )
    return { type: "code" };
  const result = safeMath(t);
  if (result !== null) return { type: "math", result };
  return { type: "text" };
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

  start() {
    if (this.timer) return;
    this.last = null;
    this.timer = setInterval(() => this.poll(), 800);
  }

  stop() {
    clearInterval(this.timer);
    this.timer = null;
  }

  // Electron's clipboard.readText()/writeText() return promises, so this is async and never overlaps itself.
  async poll() {
    if (this.busy) return;
    this.busy = true;
    try {
      // Foreground exclusion and standardized clipboard markers are complementary; neither is a password detector.
      const before = win32.foreground().app;
      if (PRIVATE_APPS.test(before)) {
        this.last = null;
        return;
      }
      const batch = clipboard.read ? await clipboard.read() : null;
      if (PRIVATE_APPS.test(win32.foreground().app)) {
        this.last = null;
        return;
      }
      if (
        batch &&
        batch.some((item) =>
          item.types.some((type) => PRIVATE_FORMAT.test(type)),
        )
      ) {
        this.last = null;
        return;
      }
      const imageItem =
        batch && batch.find((item) => item.types.includes("image/png"));
      if (imageItem) {
        const blob = await imageItem.getType("image/png");
        if (blob.size > MAX_IMAGE) return;
        const data = Buffer.from(await blob.arrayBuffer());
        const fingerprint =
          "image:" + crypto.createHash("sha256").update(data).digest("hex");
        const first = this.last === null;
        if (this.last === fingerprint) return;
        this.last = fingerprint;
        if (!first) this.addImage(data, fingerprint);
        return;
      }
      const text = await clipboard.readText();
      if (typeof text !== "string") return;
      const first = this.last === null;
      if (text === this.last) return;
      this.last = text;
      if (text && !first && this.timer) this.add(text);
    } catch (_) {
      /* the clipboard can be locked by another app for a moment; try again next tick */
    } finally {
      this.busy = false;
    }
  }

  addImage(data, fingerprint) {
    if (!this.timer) return;
    const existing = this.items.find((i) => i.fingerprint === fingerprint);
    if (existing)
      this.items = [existing, ...this.items.filter((i) => i !== existing)];
    else
      this.items.unshift({
        id: this.seq++,
        type: "image",
        text: "Image / صورة",
        data: "data:image/png;base64," + data.toString("base64"),
        fingerprint,
        ts: Date.now(),
        pinned: false,
      });
    this.trim();
    this.emit();
  }
  trim() {
    this.items = this.list().slice(0, MAX_ITEMS);
    let bytes = 0;
    this.items = this.items.filter((i) => {
      bytes += i.data?.length || i.text.length;
      return bytes <= 20 * 1024 * 1024;
    });
  }

  add(text) {
    const value = text.slice(0, MAX_LENGTH);
    const existing = this.items.find((i) => i.text === value);
    if (existing) {
      this.items = [existing, ...this.items.filter((i) => i !== existing)];
    } else {
      this.items.unshift({
        id: this.seq++,
        text: value,
        ts: Date.now(),
        pinned: false,
        ...classify(value),
      });
      const unpinned = this.items.filter((i) => !i.pinned);
      if (unpinned.length > MAX_ITEMS) {
        const drop = new Set(unpinned.slice(MAX_ITEMS));
        this.items = this.items.filter((i) => !drop.has(i));
      }
    }
    this.trim();
    this.emit();
  }

  list() {
    // pinned first, then newest
    return [
      ...this.items.filter((i) => i.pinned),
      ...this.items.filter((i) => !i.pinned),
    ];
  }

  emit() {
    this.onChange(this.list());
  }

  find(id) {
    return this.items.find((i) => i.id === id);
  }

  async copy(id, as) {
    const item = this.find(id);
    if (!item) return { ok: false };
    if (item.type === "image") {
      const data = Buffer.from(item.data.split(",")[1], "base64");
      if (ClipboardItem) {
        await clipboard.write([
          new ClipboardItem({
            "image/png": new Blob([data], { type: "image/png" }),
          }),
        ]);
        return { ok: true };
      }
      return { ok: false };
    }
    const text =
      as === "rgb" && item.rgb
        ? item.rgb
        : as === "result" && item.type === "math"
          ? String(item.result)
          : item.text;
    this.last = text;
    await clipboard.writeText(text);
    return { ok: true };
  }

  pin(id) {
    const item = this.find(id);
    if (item) item.pinned = !item.pinned;
    this.items = this.list();
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

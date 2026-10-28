// Command palette (Ctrl+Alt+Space): calculator, units, currency, apps, workspaces, web search, translate, timer, AI.
const path = require("path");
const {
  BrowserWindow,
  ipcMain,
  screen,
  shell,
  clipboard,
} = require("electron");
const calc = require("./services/calc");
const units = require("./services/units");
const rates = require("./services/rates");
const apps = require("./services/apps");
const workspaces = require("./services/workspaces");
const ai = require("./services/ai");
const { logError } = require("./log");

const fmt = (n) =>
  Math.abs(n) >= 1e15 || (Math.abs(n) < 1e-6 && n !== 0)
    ? n.toExponential(6)
    : String(n);

function openTarget(target) {
  if (!target) return;
  if (target.type === "url") {
    try {
      const u = new URL(target.value);
      if (["http:", "https:"].includes(u.protocol))
        shell.openExternal(u.toString());
    } catch (_) {
      /* ignore */
    }
  } else if (target.type === "path") {
    const p = target.value.startsWith("~")
      ? path.join(require("os").homedir(), target.value.slice(1))
      : target.value;
    shell.openPath(p).then((err) => err && logError("palette open", p, err));
  } else if (target.type === "app") {
    const [hit] = apps.search(target.value, 1);
    // only a clear name match, so a typo never launches some unrelated program
    if (hit && hit.score >= 60) shell.openPath(hit.path);
    else logError("workspace: no app named", target.value);
  }
}

function translateUrl(text) {
  const arabic = /[؀-ۿ]/.test(text);
  return `https://translate.google.com/?sl=auto&tl=${arabic ? "en" : "ar"}&text=${encodeURIComponent(text)}&op=translate`;
}

/** Turn what the user typed into a ranked list of actions. Pure except for currency rates and the app index. */
async function query(raw, ctx) {
  const q = String(raw || "").trim();
  const items = [];
  const ws = workspaces.parse(ctx.settings.workspaces);

  if (!q) {
    for (const w of ws)
      items.push({
        kind: "workspace",
        title: w.name,
        sub: w.items.map((i) => i.value).join(" · "),
        icon: "grid",
        ws: w.name,
      });
    items.push({ kind: "hint", title: "hintCalc", icon: "calc" });
    items.push({ kind: "hint", title: "hintAi", icon: "spark" });
    items.push({ kind: "settings", title: "settings", icon: "gear" });
    return items;
  }

  // "?" or "ai " -> AI answer
  const aiMatch = /^(\?|؟|ai\s+|اسأل\s+)(.+)/i.exec(q);
  if (aiMatch) {
    items.push({
      kind: "ai",
      title: aiMatch[2].trim(),
      icon: "spark",
      question: aiMatch[2].trim(),
      needsKey: !ctx.hasAiKey,
    });
    return items;
  }

  // "tr ..." / "ترجم ..." -> translate
  const tr = /^(tr|ترجم|ترجمة)\s+(.+)/i.exec(q);
  if (tr) {
    items.push({
      kind: "open",
      title: tr[2],
      sub: "translate",
      icon: "globe",
      target: { type: "url", value: translateUrl(tr[2]) },
    });
    return items;
  }

  const remind =
    /^(remind|ذكرني)\s+(?:بعد\s+)?(\d+)\s*(minutes?|min|دقيقة|دقائق|hours?|ساعة|ساعات)?\s*(.*)$/i.exec(
      calc.digits(q),
    );
  if (remind) {
    const minutes =
      Number(remind[2]) * (/hour|ساعة|ساعات/i.test(remind[3] || "") ? 60 : 1);
    if (minutes > 0 && minutes <= 43200)
      items.push({
        kind: "reminder",
        title: remind[4] || q,
        minutes,
        text: remind[4] || "تذكير / Reminder",
        icon: "timer",
      });
  }
  if (/^(quiet|هدوء|الهدوء)$/i.test(q))
    items.push({
      kind: "quiet",
      title: "تفعيل الهدوء داخل Islandly / Quiet Islandly",
      icon: "timer",
    });
  // "timer 25" / "مؤقت ٢٥"
  const tm = /^(timer|مؤقت)\s+(\S+)/i.exec(calc.digits(q));
  if (tm && Number(tm[2]) > 0 && Number(tm[2]) <= 600) {
    items.push({
      kind: "timer",
      title: String(Number(tm[2])),
      icon: "timer",
      minutes: Number(tm[2]),
    });
  }

  const file = /^(?:file|ملف)\s+(.+)$/i.exec(q);
  if (file) {
    const root =
      ctx.settings.searchRoot || require("electron").app?.getPath("documents");
    for (const f of await require("./services/file-search").search(
      file[1],
      root,
    ))
      items.push({
        kind: "open",
        title: f.name,
        sub: f.path,
        icon: "folder",
        target: { type: "path", value: f.path },
      });
    return items.length
      ? items
      : [
          {
            kind: "hint",
            title: "No matching files / لا توجد ملفات مطابقة",
            icon: "folder",
          },
        ];
  }
  const value = calc.evaluate(q);
  if (value !== null)
    items.push({
      kind: "copy",
      title: fmt(value),
      sub: q,
      icon: "calc",
      text: fmt(value),
    });

  const u = units.convert(q);
  if (u)
    items.push({
      kind: "copy",
      title: `${fmt(u.result)} ${u.to}`,
      sub: `${u.value} ${u.from}`,
      icon: "ruler",
      text: fmt(u.result),
    });

  if (!u && rates.parseQuery(q)) {
    const c = await rates.convert(q);
    if (c && c.result !== null)
      items.push({
        kind: "copy",
        title: `${c.result.toLocaleString("en")} ${c.to}`,
        sub: `${c.amount} ${c.from}`,
        icon: "coin",
        text: String(c.result),
      });
    else if (c)
      items.push({ kind: "hint", title: "ratesOffline", icon: "coin" });
  }

  const lower = q.toLowerCase();
  for (const w of ws) {
    if (w.name.toLowerCase().includes(lower))
      items.push({
        kind: "workspace",
        title: w.name,
        sub: w.items.map((i) => i.value).join(" · "),
        icon: "grid",
        ws: w.name,
      });
  }

  if (/^(settings|إعدادات|اعدادات)/i.test(q))
    items.push({ kind: "settings", title: "settings", icon: "gear" });

  const target = workspaces.kind(q);
  if (target.type === "url" && !/\s/.test(q))
    items.push({
      kind: "open",
      title: target.value,
      sub: "openLink",
      icon: "link",
      target,
    });
  if (target.type === "path")
    items.push({
      kind: "open",
      title: q,
      sub: "openPath",
      icon: "folder",
      target,
    });

  if (!items.length || items.every((i) => i.kind !== "copy")) {
    for (const a of apps.search(q, 5))
      items.push({
        kind: "open",
        title: a.name,
        sub: "app",
        icon: "app",
        target: { type: "path", value: a.path },
      });
  }

  items.push({
    kind: "open",
    title: q,
    sub: "searchWeb",
    icon: "search",
    target: {
      type: "url",
      value: "https://www.google.com/search?q=" + encodeURIComponent(q),
    },
  });
  items.push({
    kind: "ai",
    title: q,
    icon: "spark",
    question: q,
    needsKey: !ctx.hasAiKey,
    low: true,
  });
  return items.slice(0, 9);
}

class Palette {
  constructor({ root, settings, onTimer, openSettings, onReminder, onQuiet }) {
    this.root = root;
    this.settings = settings;
    this.onTimer = onTimer;
    this.openSettings = openSettings;
    this.onReminder = onReminder;
    this.onQuiet = onQuiet;
    this.win = null;
    this.aiAbort = null;
    this.registerIpc();
  }

  create() {
    const { workArea } = screen.getPrimaryDisplay();
    const width = 620;
    this.win = new BrowserWindow({
      width,
      height: 420,
      x: Math.round(workArea.x + (workArea.width - width) / 2),
      y: workArea.y + Math.round(workArea.height * 0.16),
      frame: false,
      transparent: true,
      resizable: false,
      movable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      show: false,
      hasShadow: false,
      webPreferences: {
        preload: path.join(__dirname, "palette-preload.js"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    this.win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    this.win.webContents.on("will-navigate", (e) => e.preventDefault());
    this.win.setAlwaysOnTop(true, "pop-up-menu");
    this.win.loadFile(path.join(this.root, "src", "palette", "index.html"));
    this.win.on("blur", () => this.hide());
    this.win.webContents.on("render-process-gone", (_e, d) =>
      logError("palette gone", JSON.stringify(d)),
    );
  }

  toggle() {
    if (!this.win || this.win.isDestroyed()) this.create();
    if (this.win.isVisible()) return this.hide();
    const { workArea } = screen.getDisplayNearestPoint(
      screen.getCursorScreenPoint(),
    );
    const [w] = this.win.getSize();
    this.win.setPosition(
      Math.round(workArea.x + (workArea.width - w) / 2),
      workArea.y + Math.round(workArea.height * 0.16),
    );
    const show = () => {
      this.win.show();
      this.win.focus();
      this.win.webContents.send("palette:shown", {
        lang: this.settings.get().lang,
      });
    };
    if (this.win.webContents.isLoading())
      this.win.webContents.once("did-finish-load", show);
    else show();
  }

  hide() {
    if (this.aiAbort) this.aiAbort.abort();
    this.aiAbort = null;
    if (this.win && !this.win.isDestroyed() && this.win.isVisible())
      this.win.hide();
  }

  stop() {
    this.hide();
    if (this.win && !this.win.isDestroyed()) this.win.destroy();
  }

  registerIpc() {
    const valid = (e) =>
      this.win &&
      !this.win.isDestroyed() &&
      e.sender === this.win.webContents &&
      e.senderFrame === e.sender.mainFrame;
    const on = (ch, fn) =>
      ipcMain.on(ch, (e, ...args) => {
        if (valid(e)) return fn(e, ...args);
      });
    const handle = (ch, fn) =>
      ipcMain.handle(ch, (e, ...args) => {
        if (!valid(e)) throw new Error("Unauthorized IPC sender");
        return fn(e, ...args);
      });
    handle("palette:query", (_e, q) =>
      query(q, {
        settings: this.settings.get(),
        hasAiKey: !!this.settings.getSecret("aiKey"),
      }),
    );
    on("palette:hide", () => this.hide());
    on("palette:height", (_e, h) => {
      if (!this.win || this.win.isDestroyed() || !Number.isFinite(h)) return;
      const [w] = this.win.getSize();
      this.win.setSize(w, Math.max(80, Math.min(640, Math.ceil(h))));
    });
    handle("palette:run", async (_e, item) => {
      if (!item || typeof item !== "object") return;
      if (item.kind === "reminder") {
        this.onReminder?.(item.minutes, item.text);
        this.hide();
      } else if (item.kind === "quiet") {
        this.onQuiet?.();
        this.hide();
      } else if (item.kind === "copy") {
        await Promise.resolve(
          clipboard.writeText(String(item.text || "")),
        ).catch(() => {});
        this.hide();
      } else if (item.kind === "open") {
        openTarget(item.target);
        this.hide();
      } else if (item.kind === "workspace") {
        const w = workspaces
          .parse(this.settings.get().workspaces)
          .find((x) => x.name === item.ws);
        if (w)
          w.items.forEach((t, i) => setTimeout(() => openTarget(t), i * 250));
        this.hide();
      } else if (item.kind === "timer") {
        this.onTimer(Number(item.minutes));
        this.hide();
      } else if (item.kind === "settings") {
        this.hide();
        this.openSettings();
      }
    });
    on("palette:ask", async (e, question) => {
      if (this.aiAbort) this.aiAbort.abort();
      const abort = new AbortController();
      this.aiAbort = abort;
      const send = (ch, p) => !e.sender.isDestroyed() && e.sender.send(ch, p);
      const r = await ai.ask(
        this.settings.getSecret("aiKey"),
        question,
        (t) => !abort.signal.aborted && send("palette:ai-text", t),
        abort.signal,
      );
      if (r.reason !== "aborted") send("palette:ai-done", r);
      if (this.aiAbort === abort) this.aiAbort = null;
    });
    on("palette:copy", (_e, text) =>
      Promise.resolve(clipboard.writeText(String(text || ""))).catch(() => {}),
    );
  }
}

module.exports = { Palette, query, openTarget, translateUrl };

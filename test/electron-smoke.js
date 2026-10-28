// Boots the real app (main process + renderer) and checks that the IPC bridge and every feature loads.
//   xvfb-run -a npx electron test/electron-smoke.js --no-sandbox     (Linux)   |   npx electron test/electron-smoke.js   (Windows)
const fs = require("fs");
const assert = require("node:assert/strict");
let failures = 0;
setTimeout(() => app.exit(1), 60000).unref();
const os = require("os");
const path = require("path");
const { app, BrowserWindow, clipboard } = require("electron");

process.env.ISLANDLY_TEST = "1";
const userData = fs.mkdtempSync(path.join(os.tmpdir(), "islandly-smoke-"));
app.setPath("userData", userData);
if (process.platform === "linux" && process.env.ISLANDLY_HEADLESS_TEST === "1")
  app.requestSingleInstanceLock = () => true;
require("../src/main/main.js");

app.on("web-contents-created", (_e, wc) => {
  wc.on("console-message", (_ev, level, message, line, src) =>
    console.log(
      "RENDERER[" +
        level +
        "] " +
        message +
        " (" +
        String(src).split("/").pop() +
        ":" +
        line +
        ")",
    ),
  );
  wc.on("render-process-gone", (_ev, d) => {
    failures++;
    console.log("RENDERER GONE " + JSON.stringify(d));
  });
  wc.on("did-fail-load", (_ev, code, desc) => {
    failures++;
    console.log("FAIL LOAD " + code + " " + desc);
  });
  wc.on("preload-error", (_ev, p, err) => {
    failures++;
    console.log("PRELOAD ERROR " + p + " " + err);
  });
  wc.on("did-finish-load", () =>
    console.log("LOADED " + wc.getURL().split("/").pop()),
  );
});
app.whenReady().then(() => {
  console.log("SMOKE ready-callback");
  return setTimeout(async () => {
    console.log("SMOKE timer fired");
    try {
      if (process.platform === "win32")
        assert.ok(
          require("../src/main/win32").available(),
          "Win32 FFI must initialize",
        );
      const win = BrowserWindow.getAllWindows().find((w) =>
        w.webContents.getURL().includes("renderer"),
      );
      console.log("SMOKE step: window found=" + !!win);
      console.log(
        "SMOKE 1+1=" + (await win.webContents.executeJavaScript("1+1")),
      );
      console.log(
        "SMOKE typeof Island=" +
          (await win.webContents.executeJavaScript("typeof Island")),
      );
      await clipboard.writeText("https://example.com/from-smoke-test");
      await new Promise((r) => setTimeout(r, 2200));
      const result = await win.webContents.executeJavaScript(`(async () => {
      const out = {};
      out.island = typeof Island;
      out.features = ['clock', 'today', 'music', 'timer', 'calendar', 'clipboard', 'shelf', 'notes', 'battery', 'system', 'usage', 'github', 'privacy', 'notice'].filter((id) => Island.feature(id));
      out.api = Object.keys(window.islandAPI).sort();
      out.settings = window.islandAPI.settings;
      out.shelf = await islandAPI.call('shelf:list');
      out.clipboard = (await islandAPI.call('clipboard:list')).map((i) => i.type + ':' + i.text);
      out.calendar = await islandAPI.call('calendar:get');
      out.usage = await islandAPI.call('usage:get');
      out.github = await islandAPI.call('github:get');
      out.privacy = await islandAPI.call('privacy:get');
      out.blocked = await islandAPI.call('not:allowed').then(() => 'NOT BLOCKED', (e) => 'blocked');
      Island.open('clipboard');
      await new Promise((r) => setTimeout(r, 700));
      out.panelWidth = Math.round(document.getElementById('island').getBoundingClientRect().width);
      return out;
    })()`);
      console.log("SMOKE " + JSON.stringify(result));
      assert.equal(result.island, "object");
      assert.equal(result.features.length, 14);
      assert.equal(result.blocked, "blocked");
      assert.ok(result.panelWidth > 100);
      console.log(
        "SMOKE clipboard formats",
        (await clipboard.read()).map((i) => i.types),
      );
      assert.ok(
        result.clipboard.some((s) =>
          s.includes("https://example.com/from-smoke-test"),
        ),
        "new text must appear in clipboard history",
      );

      // shelf image action: halve a generated 40x20 PNG
      const { nativeImage } = require("electron");
      const png = path.join(userData, "pic.png");
      await require("sharp")({
        create: { width: 40, height: 20, channels: 4, background: "#6677aa" },
      })
        .png()
        .toFile(png);
      const t = global.__islandly;
      t.shelf.add([png]);
      const item = t.shelf.list().find((i) => i.path === png);
      const processed = await win.webContents.executeJavaScript(
        `islandAPI.call('files:process', [${JSON.stringify(item.id)}], 'half')`,
      );
      assert.equal(processed.ok, true, processed.error);
      const size = nativeImage.createFromPath(processed.path).getSize();
      assert.deepEqual(size, { width: 20, height: 10 });
      console.log("SMOKE image worker", size);
      const { ClipboardItem } = require("electron");
      await clipboard.write([
        new ClipboardItem({
          "image/png": new Blob([fs.readFileSync(png)], { type: "image/png" }),
        }),
      ]);
      await new Promise((r) => setTimeout(r, 1500));
      const copiedImage = await win.webContents.executeJavaScript(
        `islandAPI.call('clipboard:list').then(items => items.find(i => i.type === 'image'))`,
      );
      assert.ok(copiedImage, "new image must appear in clipboard history");
      await win.webContents.executeJavaScript(
        `islandAPI.call('clipboard:copy', ${JSON.stringify(copiedImage?.id)})`,
      );
      console.log("SMOKE image clipboard read/write: ok");

      // command palette: open, type, Enter copies the result and closes it
      t.palette.toggle();
      await new Promise((r) => setTimeout(r, 1500));
      const pw = BrowserWindow.getAllWindows().find((w) =>
        w.webContents.getURL().includes("palette"),
      );
      const typed = await pw.webContents.executeJavaScript(`(async () => {
      const q = document.getElementById('q');
      q.value = '12*12';
      q.dispatchEvent(new Event('input'));
      await new Promise((r) => setTimeout(r, 400));
      return { focused: document.activeElement === q, rows: [...document.querySelectorAll('.row .t1')].map((e) => e.textContent), dir: document.documentElement.dir };
    })()`);
      pw.webContents.sendInputEvent({ type: "keyDown", keyCode: "Return" });
      pw.webContents.sendInputEvent({ type: "keyUp", keyCode: "Return" });
      await new Promise((r) => setTimeout(r, 600));
      const copied = await clipboard.readText();
      assert.equal(copied.trim(), "144");
      assert.equal(pw.isVisible(), false);
      console.log(
        "SMOKE palette " +
          JSON.stringify({
            visibleBefore: true,
            typed,
            copied,
            visibleAfter: pw.isVisible(),
          }),
      );
      t.palette.toggle();
      await new Promise((r) => setTimeout(r, 800));
      const empty = await pw.webContents.executeJavaScript(
        `[...document.querySelectorAll('.row .t1')].map((e) => e.textContent)`,
      );
      console.log("SMOKE palette-empty " + JSON.stringify(empty));
      fs.writeFileSync(
        path.join(os.tmpdir(), "islandly-palette.png"),
        (await pw.webContents.capturePage()).toPNG(),
      );

      // settings window: new fields load, a key is stored encrypted and never shown back
      t.openSettings();
      await new Promise((r) => setTimeout(r, 1500));
      const sw = BrowserWindow.getAllWindows().find((w) =>
        w.webContents.getURL().includes("settings"),
      );
      const form = await sw.webContents.executeJavaScript(`(async () => {
      const $ = (id) => document.getElementById(id);
      $('aiKey').value = 'sk-smoke-123';
      $('aiKeySave').click();
      await new Promise((r) => setTimeout(r, 400));
      $('city').value = 'custom';
      $('city').dispatchEvent(new Event('change'));
      return { cities: $('city').options.length, customShown: !$('customBox').hidden, keyField: $('aiKey').value, keyState: $('aiKeyState').textContent, breakEvery: $('breakEvery').value };
    })()`);
      const st = require("../src/main/settings");
      const raw = fs.readFileSync(path.join(userData, "settings.json"), "utf8");
      console.log(
        "SMOKE settings " +
          JSON.stringify({
            ...form,
            stored: st.getSecret("aiKey") === "sk-smoke-123",
            plainInFile: raw.includes("sk-smoke-123"),
            hasAiKey: st.get().hasAiKey,
            city: st.get().city,
            secretInGet: "secrets" in st.get(),
          }),
      );
      if (require("electron").safeStorage.isEncryptionAvailable())
        assert.equal(st.getSecret("aiKey"), "sk-smoke-123");
      else console.log("SKIP encrypted-key roundtrip: OS secure storage unavailable");
      assert.equal(raw.includes("sk-smoke-123"), false);
      assert.equal("secrets" in st.get(), false);
      // A foreign main frame cannot mutate privileged settings even if it can send raw Electron IPC.
      const foreign = new BrowserWindow({
        show: false,
        webPreferences: {
          nodeIntegration: true,
          contextIsolation: false,
          sandbox: false,
        },
      });
      await foreign.loadURL("data:text/html,<title>IPC isolation test</title>");
      const denied = await foreign.webContents.executeJavaScript(
        `require('electron').ipcRenderer.invoke('settings:set', {scale: 1.5}).then(() => false, () => true)`,
      );
      assert.equal(denied, true, "foreign sender must be rejected");
      assert.equal(st.get().scale, 0.8);
      foreign.destroy();
      const pluginDir = path.join(userData, "plugins", "isolation-check");
      fs.mkdirSync(pluginDir, { recursive: true });
      fs.writeFileSync(
        path.join(pluginDir, "manifest.json"),
        JSON.stringify({ name: "Isolation check", entry: "plugin.js" }),
      );
      fs.writeFileSync(
        path.join(pluginDir, "plugin.js"),
        `(async()=>{let access='blocked';try{await fetch('https://example.com');access='allowed'}catch(_){}islandPlugin.publish({title:'Isolation',text:typeof require+'|'+typeof process+'|'+access});})()`,
      );
      st.set({ pluginsEnabled: true });
      await win.webContents.executeJavaScript(
        `islandAPI.call('plugins:enable', 'isolation-check', true)`,
      );
      await new Promise((r) => setTimeout(r, 1500));
      const card = await win.webContents.executeJavaScript(
        `Island.feature('plugins').cards.textContent`,
      );
      assert.ok(card.includes("undefined|undefined|blocked"), card);
      await win.webContents.executeJavaScript(
        `islandAPI.call('plugins:enable', 'isolation-check', false)`,
      );
      console.log("SMOKE plugin has no Node/process/network: ok");

      sw.webContents
        .capturePage()
        .then((img) =>
          fs.writeFileSync(
            path.join(os.tmpdir(), "islandly-settings.png"),
            img.toPNG(),
          ),
        );
      await new Promise((r) => setTimeout(r, 300));
      fs.writeFileSync(
        path.join(os.tmpdir(), "islandly-smoke.png"),
        (await win.webContents.capturePage()).toPNG(),
      );
    } catch (e) {
      failures++;
      console.log("SMOKE ERROR " + e.stack);
    }
    console.log("SMOKE DONE");
    app.exit(failures ? 1 : 0);
  }, 3500);
});

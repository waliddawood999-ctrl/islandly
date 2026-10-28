// Wiring: pointer handling, drag & drop, shortcuts, settings, updates.
(() => {
  // The window is only as large as the island plus a small margin, so "pointer inside the window" is the hover.
  // Listen on the whole window, not on the island element: the window grows and re-centres when the island
  // opens, which moves the element under a still cursor and makes Chromium fire a mouseleave with no movement
  // (PR #1 review, B1). A move inside the window also restores a hover that such a spurious leave dropped.
  document.documentElement.addEventListener("mouseenter", () => Island.setHover(true));
  document.documentElement.addEventListener("mouseleave", () => Island.setHover(false));
  document.addEventListener("mousemove", () => {
    if (!Island.hasPointer()) Island.setHover(true);
    API.send("island:pointer");
  });

  // Report script errors to the log file so problems can be diagnosed.
  window.addEventListener("error", (e) =>
    API.send("log:error", `${e.message} (${e.filename}:${e.lineno})`),
  );
  window.addEventListener("unhandledrejection", (e) =>
    API.send(
      "log:error",
      "promise: " + (e.reason && e.reason.stack ? e.reason.stack : e.reason),
    ),
  );

  // Right-click the island: the same menu as the tray icon (position, auto-hide, settings, quit).
  document.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    if (Island.el.contains(e.target)) API.send("menu:show");
  });

  // Dropping files on the island puts them on the shelf. (Works while the island is open under the pointer.)
  document.addEventListener("dragenter", (e) => {
    if (e.dataTransfer && [...e.dataTransfer.types].includes("Files"))
      Island.open("shelf");
  });
  document.addEventListener("dragover", (e) => e.preventDefault());
  document.addEventListener("drop", (e) => {
    e.preventDefault();
    if (e.dataTransfer && e.dataTransfer.files.length)
      Island.feature("shelf").drop(e.dataTransfer.files);
  });

  API.on("shortcut", (cmd) => {
    if (cmd === "toggle") Island.togglePin();
    if (cmd === "pomodoro") Island.feature("timer").toggle();
    if (typeof cmd === "string" && cmd.startsWith("timer:")) {
      const timer = Island.feature("timer");
      timer.setMinutes(Number(cmd.slice(6)) || 25);
      timer.start();
      Island.open("timer");
    }
  });

  // Context: the panel that fits the app you are using opens first on hover (unless something urgent is showing).
  const CONTEXT = [
    [/^(zoom|teams|ms-teams|outlook|olk|webex|slack)$/, "calendar"],
    [/^explorer$/, "shelf"],
    [/^(chrome|msedge|firefox|brave|vivaldi|opera)$/, "clipboard"],
    [/^(winword|excel|powerpnt|notepad|obsidian|notion|onenote)$/, "notes"],
    [/^(spotify|music\.ui|vlc|applemusic)$/, "music"],
    [/^taskmgr$/, "system"],
  ];
  let foreground = "";
  function updateContext() {
    if (
      /^(code|devenv|windowsterminal|powershell|pwsh|cmd)$/.test(foreground)
    ) {
      const working = Island.feature("jobs")?.items.some(
        (j) => j.status === "running",
      );
      Island.setContext(
        working ? "jobs" : API.settings.hasGithubToken ? "github" : "launcher",
      );
      return;
    }
    const hit = CONTEXT.find(([re]) => re.test(foreground));
    Island.setContext(hit ? hit[1] : null);
  }
  API.on("foreground", (fg) => {
    foreground = String(fg?.app || "")
      .toLowerCase()
      .replace(/\.exe$/, "");
    updateContext();
  });
  API.on("jobs:update", updateContext);

  API.on("language:reload", () => {
    Island.feature("timer").persist();
    location.reload();
  });
  API.on("settings:update", (s) => {
    Object.assign(API.settings, s);
    updateContext();
    Island.configure({ autoHide: s.autoHide });
    Island.render();
  });

  API.on("update:ready", ({ version }) => {
    Notice.show(
      {
        text: t("updateReady"),
        detail: t("updateReadySub", { v: version }),
        actionLabel: t("restartNow"),
        run: () => API.call("update:apply"),
      },
      20000,
    );
  });

  API.on("break:due", () => {
    Notice.show({ text: t("breakTitle"), detail: t("breakSub") }, 12000);
  });

  API.on("toast", ({ key, version }) => {
    Notice.show({ text: t(key), detail: version ? "v" + version : "" }, 4000);
  });

  Island.render();
  API.send("app:ready");
})();

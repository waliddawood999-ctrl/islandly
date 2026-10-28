// Wiring: pointer handling, drag & drop, shortcuts, settings, updates.
(() => {
  // The window is only as large as the island plus a small margin, so "pointer inside the window" is the hover.
  document.documentElement.addEventListener('mouseenter', () => Island.setHover(true));
  document.documentElement.addEventListener('mouseleave', () => Island.setHover(false));
  // The main process watches the real cursor and reports an exit that no mouseleave announced.
  API.on('island:pointer-left', () => Island.setHover(false));
  // "Over the page" mode: the colour of the page around the island (null = none).
  API.on('surface:tint', (rgb) => Island.setTint(rgb));
  document.documentElement.classList.toggle('acrylic', API.settings.material === 'acrylic');

  // Report script errors to the log file so problems can be diagnosed.
  window.addEventListener('error', (e) => API.send('log:error', `${e.message} (${e.filename}:${e.lineno})`));
  window.addEventListener('unhandledrejection', (e) => API.send('log:error', 'promise: ' + (e.reason && e.reason.stack ? e.reason.stack : e.reason)));

  // Right-click the island: the same menu as the tray icon (position, auto-hide, settings, quit).
  document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (Island.el.contains(e.target)) API.send('menu:show');
  });

  // Dropping files on the island puts them on the shelf. (Works while the island is open under the pointer.)
  document.addEventListener('dragenter', (e) => {
    if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) Island.open('shelf');
  });
  document.addEventListener('dragover', (e) => e.preventDefault());
  document.addEventListener('drop', (e) => {
    e.preventDefault();
    if (e.dataTransfer && e.dataTransfer.files.length) Island.feature('shelf').drop(e.dataTransfer.files);
  });

  API.on('shortcut', (cmd) => {
    if (cmd === 'toggle') Island.togglePin();
    if (cmd === 'pomodoro') Island.feature('timer').toggle();
    if (typeof cmd === 'string' && cmd.startsWith('timer:')) {
      const timer = Island.feature('timer');
      timer.setMode('quick');
      timer.setMinutes(Number(cmd.slice(6)) || 25);
      timer.start();
      Island.open('timer');
    }
  });

  // Context: the panel that fits the app you are using opens first on hover (unless something urgent is showing).
  const CONTEXT = [
    [/^(zoom|teams|ms-teams|outlook|olk|webex|slack)$/, 'calendar'],
    [/^(explorer)$/, 'shelf'],
    [/^(code|devenv|winword|notepad|obsidian|notion|onenote|windowsterminal)$/, 'notes'],
    [/^(spotify|music\.ui|vlc|applemusic)$/, 'music'],
    [/^(taskmgr)$/, 'system'],
  ];
  API.on('foreground', (fg) => {
    const app = String((fg && fg.app) || '').toLowerCase();
    const hit = CONTEXT.find(([re]) => re.test(app));
    Island.setContext(hit ? hit[1] : null);
  });

  API.on('settings:update', (s) => {
    try {
      Object.assign(API.settings, s);
    } catch (_) {
      /* settings object from the preload may be read-only; the next reload picks changes up */
    }
    Island.configure({ autoHide: s.autoHide, surfaceMode: s.surfaceMode });
    document.documentElement.classList.toggle('acrylic', s.material === 'acrylic');
    Island.render();
  });

  API.on('update:ready', ({ version }) => {
    Notice.show({ text: t('updateReady'), detail: t('updateReadySub', { v: version }), actionLabel: t('restartNow'), run: () => API.call('update:apply') }, 20000);
  });

  API.on('break:due', () => {
    Notice.show({ text: t('breakTitle'), detail: t('breakSub') }, 12000);
  });

  API.on('toast', ({ key, version }) => {
    Notice.show({ text: t(key), detail: version ? 'v' + version : '' }, 4000);
  });

  Island.render();
})();

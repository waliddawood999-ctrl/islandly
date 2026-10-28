// Wiring: pointer handling, drag & drop, shortcuts, settings, updates.
(() => {
  // Hover is decided in the main process (it watches the cursor) and arrives here.
  API.on('pointer:inside', (inside) => Island.setHover(inside));

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
  });

  API.on('settings:update', (s) => Island.configure({ autoHide: s.autoHide }));

  API.on('update:ready', ({ version }) => {
    Notice.show({ text: t('updateReady'), detail: t('updateReadySub', { v: version }), actionLabel: t('restartNow'), run: () => API.call('update:apply') }, 20000);
  });

  API.on('toast', ({ key, version }) => {
    Notice.show({ text: t(key), detail: version ? 'v' + version : '' }, 4000);
  });

  Island.render();
})();

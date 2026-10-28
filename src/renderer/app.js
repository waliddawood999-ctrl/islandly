// Wiring: pointer handling, drag & drop, shortcuts, settings, updates.
(() => {
  let inside = false;

  function setInside(value) {
    if (value === inside) return;
    inside = value;
    // The window is click-through; it only becomes interactive while the pointer is over the island.
    API.send('island:interactive', value);
    Island.setHover(value);
  }

  document.addEventListener(
    'mousemove',
    (e) => {
      const r = Island.el.getBoundingClientRect();
      // The thin auto-hide line is hard to hit, so give it a more generous target.
      const padX = Island.isSliver() ? 10 : 6;
      const padY = Island.isSliver() ? 6 : 6;
      setInside(e.clientX >= r.left - padX && e.clientX <= r.right + padX && e.clientY >= r.top - padY && e.clientY <= r.bottom + padY);
    },
    { passive: true }
  );
  document.addEventListener('mouseleave', () => setInside(false));

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

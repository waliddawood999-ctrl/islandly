// Pointer handling. The window is click-through; it only becomes interactive while the pointer is over the island.
(() => {
  const api = window.islandAPI || { setInteractive() {}, onShortcut() {} };
  let inside = false;

  function setInside(value) {
    if (value === inside) return;
    inside = value;
    api.setInteractive(value);
    Island.setHover(value);
  }

  document.addEventListener(
    'mousemove',
    (e) => {
      const r = Island.el.getBoundingClientRect();
      const pad = 6;
      setInside(e.clientX >= r.left - pad && e.clientX <= r.right + pad && e.clientY >= r.top - pad && e.clientY <= r.bottom + pad);
    },
    { passive: true }
  );
  document.addEventListener('mouseleave', () => setInside(false));

  api.onShortcut((cmd) => {
    if (cmd === 'toggle') Island.togglePin();
    if (cmd === 'pomodoro') {
      Island.feature('timer').toggle();
    }
  });

  Island.render();
})();

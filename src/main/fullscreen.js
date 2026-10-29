const win32 = require('./win32');

/**
 * Polls the foreground window once a second (a few cheap native calls, no extra process) and reports:
 *   onFullscreen(true|false) when a fullscreen video/game starts or stops
 *   onApp({ app, title })    when the active app or window title changes (time tracker, context)
 */
function watchForeground({ onFullscreen, onApp, intervalMs = 1000 }) {
  if (!win32.available()) return { stop() {} };
  let lastFull = null;
  let lastKey = '';
  const poll = () => {
    const fg = win32.foreground();
    if (fg.fullscreen !== lastFull) {
      lastFull = fg.fullscreen;
      onFullscreen(fg.fullscreen);
    }
    const key = fg.app + '|' + fg.title;
    if (key !== lastKey) {
      lastKey = key;
      if (onApp) onApp({ app: fg.app, title: fg.title });
    }
  };
  let timer = setInterval(poll, intervalMs);
  return {
    setEco(eco) {
      const next = eco ? 3000 : 1000;
      if (next === intervalMs) return;
      intervalMs = next; clearInterval(timer); timer = setInterval(poll, next);
    },
    stop: () => clearInterval(timer),
  };
}

module.exports = { watchForeground };

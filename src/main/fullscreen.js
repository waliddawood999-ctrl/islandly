const win32 = require("./win32");

/**
 * Polls the foreground window once a second (a few cheap native calls, no extra process) and reports:
 *   onFullscreen(true|false) when a fullscreen video/game starts or stops
 *   onApp({ app, title })    when the active app or window title changes (time tracker, context)
 */
function watchForeground({
  onFullscreen,
  onApp,
  onTargetDisplay = () => true,
  intervalMs = 1000,
}) {
  if (!win32.available()) return { stop() {} };
  let lastFull = null;
  let lastKey = "";
  const timer = setInterval(() => {
    const fg = win32.foreground();
    const full = fg.fullscreen && onTargetDisplay(win32.foregroundBounds());
    if (full !== lastFull) {
      lastFull = full;
      onFullscreen(full);
    }
    const key = fg.app + "|" + fg.title + "|" + full;
    if (key !== lastKey) {
      lastKey = key;
      if (onApp) onApp({ app: fg.app, title: fg.title });
    }
  }, intervalMs);
  return { stop: () => clearInterval(timer) };
}

module.exports = { watchForeground };

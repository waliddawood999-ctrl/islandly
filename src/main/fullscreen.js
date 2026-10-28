const readline = require('readline');
const { spawnScript } = require('./ps');

/** Calls onChange(true/false) when a fullscreen window (video, game) takes over the screen. */
function watchFullscreen(onChange) {
  const child = spawnScript('fg-watch.ps1');
  if (!child) return { stop() {} };
  readline.createInterface({ input: child.stdout }).on('line', (line) => {
    if (line === '1' || line === '0') onChange(line === '1');
  });
  return { stop: () => child.kill() };
}

module.exports = { watchFullscreen };

const path = require('path');
const { spawn, execFile } = require('child_process');

const SCRIPTS = path.join(__dirname, 'scripts');
const ARGS = ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File'];
const isWindows = process.platform === 'win32';

/** Run a script once and resolve with its trimmed stdout ('' on any failure). */
function runOnce(name, timeout = 15000, args = []) {
  if (!isWindows) return Promise.resolve('');
  return new Promise((resolve) => {
    execFile('powershell.exe', [...ARGS, path.join(SCRIPTS, name), ...args.map(String)], { windowsHide: true, timeout }, (err, stdout) =>
      resolve(err ? '' : String(stdout).trim())
    );
  });
}

/** Start a long-lived script. Returns the child process, or null when not on Windows. */
function spawnScript(name) {
  if (!isWindows) return null;
  return spawn('powershell.exe', [...ARGS, path.join(SCRIPTS, name)], { windowsHide: true, stdio: ['pipe', 'pipe', 'ignore'] });
}

module.exports = { runOnce, spawnScript, isWindows };

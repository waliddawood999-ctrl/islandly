const path = require('node:path');
const fs = require('node:fs');
const { spawn } = require('node:child_process');
const root = path.join(__dirname, '..');
if (process.platform === 'win32') {
  const exe = path.join(root, 'native', 'bin', 'Islandly.exe');
  if (!fs.existsSync(exe)) { console.error('Run npm run build:native first.'); process.exitCode = 1; }
  else spawn(exe, ['--root', root], { detached: true, stdio: 'ignore' }).unref();
} else {
  const child = spawn(require('electron'), [root, ...process.argv.slice(2)], { stdio: 'inherit' });
  child.on('exit', code => { process.exitCode = code || 0; });
}

const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const MAX_BYTES = 200 * 1024;

/** Append a line to %APPDATA%/islandly/error.log (best effort, capped in size). */
function logError(...parts) {
  try {
    const dir = app.getPath('userData');
    const file = path.join(dir, 'error.log');
    fs.mkdirSync(dir, { recursive: true });
    if (fs.existsSync(file) && fs.statSync(file).size > MAX_BYTES) fs.renameSync(file, file + '.old');
    const text = parts.map((p) => (p && p.stack ? p.stack : String(p))).join(' ');
    fs.appendFileSync(file, `${new Date().toISOString()} ${text}\n`);
  } catch (_) {
    /* logging must never throw */
  }
}

module.exports = { logError };

const fs = require('fs');
const path = require('path');
const { app } = require('electron');

/** Tiny JSON file store in %APPDATA%/islandly (notes, time tracking, ...). */
function jsonStore(name, fallback) {
  const file = () => path.join(app.getPath('userData'), name);
  return {
    read() {
      try {
        return JSON.parse(fs.readFileSync(file(), 'utf8'));
      } catch (_) {
        return typeof fallback === 'function' ? fallback() : JSON.parse(JSON.stringify(fallback));
      }
    },
    write(data) {
      try {
        fs.mkdirSync(path.dirname(file()), { recursive: true });
        const tmp = file() + '.tmp';
        fs.writeFileSync(tmp, JSON.stringify(data));
        fs.renameSync(tmp, file()); // atomic replace, so a crash never leaves half a file
      } catch (_) {
        /* non-fatal */
      }
    },
  };
}

const ISLAMIC_DEFAULTS = require('./prayer-defaults');
const MATERIAL_DEFAULT = 'acrylic';
module.exports = { jsonStore, ISLAMIC_DEFAULTS, MATERIAL_DEFAULT };

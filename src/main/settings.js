const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const DEFAULTS = {
  lang: 'ar', // 'auto' | 'ar' | 'en'
  autoHide: 'auto', // 'auto' (shrink after a few seconds) | 'never' | 'always' (thin line until hovered)
  position: 'center', // 'center' | 'left' | 'right'
  scale: 0.8, // UI size: 0.7 small, 0.8 medium, 1 large
  hideFullscreen: true,
  icsUrl: '',
  clipboard: true,
  updates: true,
};

let data = { ...DEFAULTS };
let file = '';
const listeners = new Set();

function init() {
  file = path.join(app.getPath('userData'), 'settings.json');
  try {
    data = { ...DEFAULTS, ...JSON.parse(fs.readFileSync(file, 'utf8')) };
  } catch (_) {
    /* first run */
  }
}

const get = () => ({ ...data });

function set(patch) {
  const prev = data;
  data = { ...data };
  for (const key of Object.keys(DEFAULTS)) {
    if (key in patch && typeof patch[key] === typeof DEFAULTS[key]) data[key] = patch[key];
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
  listeners.forEach((fn) => fn(data, prev));
}

const onChange = (fn) => listeners.add(fn);

module.exports = { init, get, set, onChange, DEFAULTS };

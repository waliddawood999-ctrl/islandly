const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const { ISLAMIC_DEFAULTS } = require('./services/store');
const DEFAULTS = {
  ecoMode: false,
  monitorId: '', // Existing T1/T7 display-selection contract; primary fallback.
  islandMode: 'overlay', // Existing T6/T7 contract: overlay | appbar; native owner reserves the strip.
  ...ISLAMIC_DEFAULTS,
  material: require('./services/store').MATERIAL_DEFAULT,
  ...require('./services/store').ECO_DEFAULTS,
  lang: 'ar', // 'auto' | 'ar' | 'en'
  autoHide: 'auto', // 'auto' (shrink after a few seconds) | 'never' | 'always' (thin line until hovered)
  position: 'center', // 'center' | 'left' | 'right'
  scale: 0.8, // UI size: 0.7 small, 0.8 medium, 1 large
  hideFullscreen: true,
  icsUrl: '',
  clipboard: true,
  updates: true,
  // Today: prayer times and weather
  city: 'riyadh', // preset key from cities.js, or 'custom'
  lat: 0,
  lng: 0,
  cityName: '',
  prayerMethod: 'auto', // 'auto' = the city's usual method, or an adhan method name
  madhab: 'shafi',
  prayerAlerts: true,
  weather: true,
  breakEvery: 60, // minutes of active use between break reminders; 0 = off
  timeTracking: true,
  micCamIndicator: true,
  workspaces: '', // one per line: Name: path-or-url | path-or-url
  islandMode: 'overlay', // 'overlay' (floats over the page, tinted to match) | 'appbar' (reserved strip, never covers windows)
  shortcuts: 'Edge, File Explorer, Calculator, Notepad', // app shortcuts in the clock panel
  hasAiKey: false,
  hasGithubToken: false,
};

// Secrets (API keys) are encrypted with the OS (DPAPI on Windows) and kept out of settings.json's plain fields.
const SECRET_KEYS = ['aiKey', 'githubToken'];

let data = { ...DEFAULTS };
let file = '';
const listeners = new Set();

function init() {
  file = path.join(app.getPath('userData'), 'settings.json');
  try {
    data = { ...DEFAULTS, ...JSON.parse(fs.readFileSync(file, 'utf8')) };
    if (!['acrylic', 'glass'].includes(data.material)) data.material = DEFAULTS.material;
    for (const key of ['ecoMode', 'ecoAuto']) if (typeof data[key] !== 'boolean') data[key] = DEFAULTS[key];
    if (!['full', 'reduced', 'off'].includes(data.motion)) data.motion = DEFAULTS.motion;
  } catch (_) {
    /* first run */
  }
}

const get = () => {
  const { secrets, ...rest } = data;
  return rest;
};

function set(patch) {
  const prev = data;
  data = { ...data }; // keeps data.secrets
  for (const key of Object.keys(DEFAULTS)) {
    if (key === 'motion' && !['full', 'reduced', 'off'].includes(patch[key])) continue;
    if (key === 'material' && !['acrylic', 'glass'].includes(patch[key])) continue;
    if (!(key in patch)) continue;
    if (key === 'prayerIqamaMinutes') {
      if (patch[key] && typeof patch[key] === 'object' && !Array.isArray(patch[key])) {
        const next = { ...ISLAMIC_DEFAULTS.prayerIqamaMinutes, ...data[key] };
        for (const name of Object.keys(ISLAMIC_DEFAULTS.prayerIqamaMinutes)) if (Number.isInteger(patch[key][name]) && patch[key][name] >= 0 && patch[key][name] <= 60) next[name] = patch[key][name];
        data[key] = next;
      }
    } else if (key === 'prayerPreMinutes') {
      if (Number.isInteger(patch[key]) && patch[key] >= 0 && patch[key] <= 60) data[key] = patch[key];
    } else if (key === 'ramadanMode') {
      if (['auto', 'on', 'off'].includes(patch[key])) data[key] = patch[key];
    } else if (typeof patch[key] === typeof DEFAULTS[key]) data[key] = patch[key];
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
  listeners.forEach((fn) => fn(data, prev));
}

const onChange = (fn) => listeners.add(fn);

function setSecret(name, value) {
  if (!SECRET_KEYS.includes(name)) return;
  const { safeStorage } = require('electron');
  const secrets = { ...(data.secrets || {}) };
  if (!value) delete secrets[name];
  else if (safeStorage.isEncryptionAvailable()) secrets[name] = 'enc:' + safeStorage.encryptString(String(value)).toString('base64');
  else secrets[name] = 'raw:' + Buffer.from(String(value)).toString('base64');
  data = { ...data, secrets };
  const flag = name === 'aiKey' ? 'hasAiKey' : 'hasGithubToken';
  set({ [flag]: !!value });
}

function getSecret(name) {
  const v = data.secrets && data.secrets[name];
  if (!v) return '';
  try {
    if (v.startsWith('enc:')) return require('electron').safeStorage.decryptString(Buffer.from(v.slice(4), 'base64'));
    if (v.startsWith('raw:')) return Buffer.from(v.slice(4), 'base64').toString();
  } catch (_) {
    /* unreadable on this machine/user */
  }
  return '';
}

module.exports = { init, get, set, onChange, setSecret, getSecret, DEFAULTS };

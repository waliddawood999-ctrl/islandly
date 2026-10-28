const fs = require("fs");
const path = require("path");
const { app } = require("electron");

const DEFAULTS = {
  lang: "ar", // 'auto' | 'ar' | 'en'
  autoHide: "auto", // 'auto' (shrink after a few seconds) | 'never' | 'always' (thin line until hovered)
  position: "center", // 'center' | 'left' | 'right'
  scale: 0.8, // UI size: 0.7 small, 0.8 medium, 1 large
  hideFullscreen: true,
  icsUrl: "",
  clipboard: true,
  updates: true,
  // Today: prayer times and weather
  city: "riyadh", // preset key from cities.js, or 'custom'
  lat: 0,
  lng: 0,
  cityName: "",
  prayerMethod: "auto", // 'auto' = the city's usual method, or an adhan method name
  madhab: "shafi",
  prayerAlerts: true,
  weather: true,
  breakEvery: 60, // minutes of active use between break reminders; 0 = off
  timeTracking: true,
  micCamIndicator: true,
  workspaces: "", // one per line: Name: path-or-url | path-or-url
  hasAiKey: false,
  hasGithubToken: false,
  monitorId: "",
  disabledFeatures: "activity,jobs,plugins,adhkar",
  quickLaunch: "GitHub: https://github.com",
  lyrics: false,
  prayerAlways: true,
  focusDim: false,
  distractionApps: "chrome,msedge,firefox",
  downloadAlerts: false,
  healthReminders: false,
  notificationDigest: false,
  notificationMinutes: 5,
  pauseForPrayer: false,
  pluginsEnabled: false,
  searchRoot: "",
  githubRepos: "",
  coverAccent: true,
  nativeNotifications: false,
  lanShare: false,
  captureEnabled: false,
  ffmpegEnabled: false,
  rembgEnabled: false,
  circularClickThrough: false, // Requires manual Windows pointer verification before enabling.
};

// Secrets (API keys) are encrypted with the OS (DPAPI on Windows) and kept out of settings.json's plain fields.
const SECRET_KEYS = ["aiKey", "githubToken"];

let data = { ...DEFAULTS };
let file = "";
const listeners = new Set();

function init() {
  file = path.join(app.getPath("userData"), "settings.json");
  try {
    const loaded = JSON.parse(fs.readFileSync(file, "utf8"));
    data = { ...DEFAULTS };
    for (const key of Object.keys(DEFAULTS))
      if (valid(key, loaded[key])) data[key] = loaded[key];
    if (loaded.secrets && typeof loaded.secrets === "object")
      data.secrets = loaded.secrets;
  } catch (err) {
    if (err.code !== "ENOENT") {
      try {
        fs.copyFileSync(file, file + ".invalid-" + Date.now());
      } catch (_) {}
    }
    data = { ...DEFAULTS };
  }
  data.hasAiKey = !!getSecret("aiKey");
  data.hasGithubToken = !!getSecret("githubToken");
}

const get = () => {
  const { secrets, ...rest } = data;
  return rest;
};

const ENUMS = {
  lang: ["auto", "ar", "en"],
  autoHide: ["auto", "never", "always"],
  position: ["center", "left", "right"],
  madhab: ["shafi", "hanafi"],
};
function valid(key, value) {
  if (typeof value !== typeof DEFAULTS[key]) return false;
  if (ENUMS[key] && !ENUMS[key].includes(value)) return false;
  if (
    typeof value === "string" &&
    value.length > (key === "workspaces" ? 20000 : 5000)
  )
    return false;
  if (typeof value === "number" && !Number.isFinite(value)) return false;
  if (key === "scale" && (value < 0.5 || value > 1.5)) return false;
  if (
    (key === "lat" && Math.abs(value) > 90) ||
    (key === "lng" && Math.abs(value) > 180)
  )
    return false;
  if (
    ["breakEvery", "notificationMinutes"].includes(key) &&
    (value < 0 || value > 1440)
  )
    return false;
  return true;
}
function persist() {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}
function set(patch) {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) return;
  const prev = data;
  data = { ...data }; // keeps data.secrets
  for (const key of Object.keys(DEFAULTS)) {
    if (key in patch && valid(key, patch[key])) data[key] = patch[key];
  }
  persist();
  listeners.forEach((fn) => fn(get(), (({ secrets, ...rest }) => rest)(prev)));
}

const onChange = (fn) => listeners.add(fn);

function setSecret(name, value) {
  if (!SECRET_KEYS.includes(name)) return;
  const { safeStorage } = require("electron");
  const secrets = { ...(data.secrets || {}) };
  if (!value) delete secrets[name];
  else if (safeStorage.isEncryptionAvailable())
    secrets[name] =
      "enc:" + safeStorage.encryptString(String(value)).toString("base64");
  else throw new Error("Secure storage is unavailable. The key was not saved.");
  data = { ...data, secrets };
  const flag = name === "aiKey" ? "hasAiKey" : "hasGithubToken";
  set({ [flag]: !!value });
}

function getSecret(name) {
  const v = data.secrets && data.secrets[name];
  if (!v) return "";
  try {
    if (v.startsWith("enc:"))
      return require("electron").safeStorage.decryptString(
        Buffer.from(v.slice(4), "base64"),
      );
    // Legacy plaintext/Base64 secrets must be re-entered into secure storage.
    if (v.startsWith("raw:")) return "";
  } catch (_) {
    /* unreadable on this machine/user */
  }
  return "";
}

module.exports = { init, get, set, onChange, setSecret, getSecret, DEFAULTS };

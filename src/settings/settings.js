const api = window.settingsAPI;
const $ = (id) => document.getElementById(id);
const current = api.get();
document.documentElement.dataset.fonts = current.fontPairing || 'plex';

// Language (T11): `uiLang` and `digits` per the IPC contract; until main stores `uiLang` the legacy `lang` is
// written too. A change re-translates this window at once.
current.uiLang = current.uiLang || current.lang || 'auto';
current.digits = current.digits || 'latn';
I18N.configure(current);
I18N.apply();

const fields = ['position', 'autoHide', 'prayerMethod', 'madhab', 'islandMode', 'material'];
const checks = ['hideFullscreen', 'clipboard', 'updates', 'prayerAlerts', 'weather', 'timeTracking', 'micCamIndicator'];

// material: acrylic needs Windows 11; main says whether it is supported (task T15)
if (!current.material) current.material = 'acrylic';
if (api.material)
  api
    .material()
    .then((r) => {
      if (r && r.supported === false) {
        $('material').querySelector('option[value="acrylic"]').disabled = true;
        $('materialHint').hidden = false;
        $('material').value = 'glass';
      }
    })
    .catch(() => {});

fields.forEach((k) => {
  $(k).value = current[k];
  $(k).addEventListener('change', () => api.set({ [k]: $(k).value }));
});
checks.forEach((k) => {
  $(k).checked = !!current[k];
  $(k).addEventListener('change', () => api.set({ [k]: $(k).checked }));
});

$('uiLang').value = current.uiLang;
$('uiLang').addEventListener('change', () => {
  current.uiLang = $('uiLang').value;
  api.set({ uiLang: current.uiLang, lang: current.uiLang });
  relang();
});
$('digits').value = current.digits;
$('digits').addEventListener('change', () => {
  current.digits = $('digits').value;
  api.set({ digits: current.digits });
  relang();
});

$('scale').value = String(current.scale);
$('scale').addEventListener('change', () => api.set({ scale: parseFloat($('scale').value) }));

$('icsUrl').value = current.icsUrl || '';
let icsTimer = 0;
$('icsUrl').addEventListener('input', () => {
  clearTimeout(icsTimer);
  icsTimer = setTimeout(() => api.set({ icsUrl: $('icsUrl').value.trim() }), 600);
});

// --- city / custom coordinates
const cities = api.cities();
for (const c of [...cities, { key: 'custom' }]) {
  const o = document.createElement('option');
  o.value = c.key;
  if (c.key === 'custom') o.dataset.i18n = 'settings.city.custom';
  $('city').append(o);
}
// city names come from main in both languages
const paintCities = () => {
  [...$('city').options].forEach((o, i) => {
    if (cities[i]) o.textContent = cities[i][I18N.lang] || cities[i].ar;
  });
};
paintCities();
I18N.apply($('city'));
$('city').value = current.city;
const showCustom = () => ($('customBox').hidden = $('city').value !== 'custom');
showCustom();
$('city').addEventListener('change', () => {
  showCustom();
  api.set({ city: $('city').value });
});
$('lat').value = current.lat || '';
$('lng').value = current.lng || '';
$('cityName').value = current.cityName || '';
const debounced = (fn, ms = 600) => {
  let t = 0;
  return () => {
    clearTimeout(t);
    t = setTimeout(fn, ms);
  };
};
const saveCustom = debounced(() => {
  const lat = parseFloat($('lat').value);
  const lng = parseFloat($('lng').value);
  if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) api.set({ lat, lng, cityName: $('cityName').value.trim() });
});
['lat', 'lng', 'cityName'].forEach((k) => $(k).addEventListener('input', saveCustom));

$('breakEvery').value = String(current.breakEvery);
$('breakEvery').addEventListener('change', () => api.set({ breakEvery: parseInt($('breakEvery').value, 10) }));

$('shortcuts').value = current.shortcuts || '';
$('shortcuts').addEventListener('input', debounced(() => api.set({ shortcuts: $('shortcuts').value })));

$('workspaces').value = current.workspaces || '';
$('workspaces').addEventListener('input', debounced(() => api.set({ workspaces: $('workspaces').value })));

// --- secrets: never read back, only replaced or cleared
const secrets = [];
function secretField(input, button, state, name, flag, labelKey, helpKey) {
  let has = !!current[flag];
  const paint = () => {
    state.textContent = has ? t('settings.secret.saved', { what: t(labelKey) }) : helpKey ? t(helpKey) : '';
    state.classList.toggle('ok', has);
  };
  paint();
  secrets.push(paint);
  button.addEventListener('click', async () => {
    const value = input.value.trim();
    await api.setSecret(name, value);
    input.value = '';
    has = !!value;
    paint();
  });
}
secretField($('aiKey'), $('aiKeySave'), $('aiKeyState'), 'aiKey', 'hasAiKey', 'settings.secret.key');
secretField($('githubToken'), $('ghSave'), $('ghState'), 'githubToken', 'hasGithubToken', 'settings.secret.token', 'settings.github.help');

let version = '';
const paintVersion = () => ($('version').textContent = version ? t('settings.version', { v: version }) : '');
api.info().then((i) => {
  version = i.version;
  paintVersion();
});

// update status: kept as a key so a language switch repaints it
let lastStatus = '';
const paintStatus = () => ($('status').textContent = lastStatus ? t('settings.' + lastStatus) : '');
$('check').addEventListener('click', async () => {
  lastStatus = 'busy';
  paintStatus();
  const r = await api.checkUpdate();
  lastStatus = r.status;
  paintStatus();
  if (r.status === 'ready' && !$('restartNow')) {
    const b = document.createElement('button');
    b.id = 'restartNow';
    b.dataset.i18n = 'settings.restartNow';
    b.addEventListener('click', () => api.applyUpdate());
    $('status').after(b);
    I18N.apply(b.parentNode);
  }
});

function relang() {
  I18N.configure(current); // re-translates every [data-i18n] in the window
  paintCities();
  secrets.forEach((paint) => paint());
  paintVersion();
  paintStatus();
}

$('quit').addEventListener('click', () => api.quit());

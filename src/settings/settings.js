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

// Every change is written at once; a small "Saved" confirmation tells the user it took effect (T19).
let savedTimer = 0;
function save(patch) {
  const done = api.set(patch);
  $('saved').classList.add('on');
  clearTimeout(savedTimer);
  savedTimer = setTimeout(() => $('saved').classList.remove('on'), 1400);
  return done;
}

const fields = ['position', 'autoHide', 'prayerMethod', 'madhab', 'islandMode', 'material'];
const checks = ['hideFullscreen', 'clipboard', 'updates', 'prayerAlerts', 'weather', 'timeTracking', 'micCamIndicator', 'ecoMode', 'ecoAuto'];

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
        paintPreview();
      }
    })
    .catch(() => {});

fields.forEach((k) => {
  $(k).value = current[k];
  $(k).addEventListener('change', () => {
    current[k] = $(k).value;
    save({ [k]: $(k).value });
    paintPreview();
  });
});
checks.forEach((k) => {
  $(k).checked = !!current[k];
  $(k).addEventListener('change', () => {
    current[k] = $(k).checked;
    save({ [k]: $(k).checked });
  });
});

$('uiLang').value = current.uiLang;
$('uiLang').addEventListener('change', () => {
  current.uiLang = $('uiLang').value;
  save({ uiLang: current.uiLang, lang: current.uiLang });
  relang();
});
$('digits').value = current.digits;
$('digits').addEventListener('change', () => {
  current.digits = $('digits').value;
  save({ digits: current.digits });
  relang();
});

$('scale').value = String(current.scale);
$('scale').addEventListener('change', () => {
  current.scale = parseFloat($('scale').value);
  save({ scale: current.scale });
  paintPreview();
});

$('icsUrl').value = current.icsUrl || '';
let icsTimer = 0;
$('icsUrl').addEventListener('input', () => {
  clearTimeout(icsTimer);
  icsTimer = setTimeout(() => save({ icsUrl: $('icsUrl').value.trim() }), 600);
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
  save({ city: $('city').value });
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
  if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) save({ lat, lng, cityName: $('cityName').value.trim() });
});
['lat', 'lng', 'cityName'].forEach((k) => $(k).addEventListener('input', saveCustom));

$('breakEvery').value = String(current.breakEvery);
$('breakEvery').addEventListener('change', () => save({ breakEvery: parseInt($('breakEvery').value, 10) }));

$('shortcuts').value = current.shortcuts || '';
$('shortcuts').addEventListener('input', debounced(() => save({ shortcuts: $('shortcuts').value })));

$('workspaces').value = current.workspaces || '';
$('workspaces').addEventListener('input', debounced(() => save({ workspaces: $('workspaces').value })));

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
  paintSegments();
  paintNav();
  paintPreview();
  paintCities();
  secrets.forEach((paint) => paint());
  paintVersion();
  paintStatus();
  paintPerformance();
}

// --- Short choices (T19): position, size, digits and madhab are shown as segmented controls. The <select> stays the
// source of truth (value, change event, settings:update), so nothing else in this file needs to know.
const segmented = ['position', 'scale', 'digits', 'madhab'].map((id) => {
  const select = $(id);
  const label = select.closest('label');
  const box = document.createElement('div');
  box.className = 'seg field';
  box.setAttribute('role', 'radiogroup');
  const radios = [...select.options].map((o) => {
    const wrap = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'seg-' + id;
    input.value = o.value;
    const text = document.createElement('span');
    wrap.append(input, text);
    box.append(wrap);
    input.addEventListener('change', () => {
      select.value = input.value;
      select.dispatchEvent(new Event('change'));
    });
    return { o, input, text };
  });
  select.hidden = true;
  label.classList.add('has-seg');
  label.after(box);
  return () => {
    box.setAttribute('aria-label', label.querySelector('span').textContent);
    radios.forEach(({ o, input, text }) => {
      text.textContent = o.textContent;
      input.checked = o.value === select.value;
    });
  };
});
function paintSegments() {
  segmented.forEach((paint) => paint());
  // long option texts are cut by the select box; the full text stays available on hover
  document.querySelectorAll('select').forEach((sel) => (sel.title = sel.selectedOptions[0] ? sel.selectedOptions[0].textContent : ''));
}
paintSegments();

// --- Live preview: the pill with the chosen material, mode, size and position
function paintPreview() {
  const box = $('preview');
  box.dataset.material = $('material').value === 'glass' ? 'glass' : 'acrylic';
  box.dataset.mode = $('islandMode').value === 'appbar' ? 'appbar' : 'overlay';
  box.dataset.pos = ['left', 'right'].includes($('position').value) ? $('position').value : 'center';
  box.querySelector('.pv-desk').style.setProperty('--s', String(parseFloat($('scale').value) || 0.8));
  $('pvTime').textContent = `${I18N.num(9)}:${I18N.num(41, { minimumIntegerDigits: 2 })}`;
}
paintPreview();

// --- Section navigator: chips built from the section titles, highlighting the section being read
const navSections = [...document.querySelectorAll('section[data-nav]')];
const navLinks = navSections.map((sec) => {
  const a = document.createElement('a');
  a.href = '#' + sec.id;
  a.addEventListener('click', (e) => {
    e.preventDefault();
    sec.scrollIntoView({ block: 'start' });
    sec.querySelector('h2').setAttribute('tabindex', '-1');
    sec.querySelector('h2').focus({ preventScroll: true });
  });
  $('nav').append(a);
  return a;
});
const NAV = { perf: 'settings.nav.perf', appearance: 'settings.nav.appearance', today: 'settings.nav.today', health: 'settings.nav.health', keys: 'settings.nav.keys', privacy: 'settings.nav.privacy', updates: 'settings.nav.updates' };
function paintNav() {
  navSections.forEach((sec, i) => (navLinks[i].textContent = t(NAV[sec.id])));
}
let navQueued = false;
function spy() {
  navQueued = false;
  const edge = 130;
  let on = 0;
  navSections.forEach((sec, i) => {
    if (sec.getBoundingClientRect().top <= edge) on = i;
  });
  if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) on = navSections.length - 1;
  navLinks.forEach((a, i) => {
    if (i === on) {
      if (a.getAttribute('aria-current') !== 'true') {
        a.setAttribute('aria-current', 'true');
        const nav = $('nav');
        const r = a.getBoundingClientRect();
        const n = nav.getBoundingClientRect();
        if (r.left < n.left || r.right > n.right) nav.scrollBy({ left: r.left + r.width / 2 - (n.left + n.width / 2) });
      }
    } else a.removeAttribute('aria-current');
  });
}
window.addEventListener('scroll', () => navQueued || ((navQueued = true), requestAnimationFrame(spy)), { passive: true });
paintNav();
spy();

$('quit').addEventListener('click', () => api.quit());

// --- Performance and power (T14). Contracts: docs/HANDOFF.md §2.3-2.5.
//   perf:get / perf:update  { totalMB, processes: [{ type, pid, mb, cpu, label }], powershellCount, uptimeSec }
//   eco:changed             { eco }   the *effective* state: ecoMode, or ecoAuto while on battery
// The contract has no idle/active flag, and updates only flow while this (Electron) window is open, so "active"
// is derived from the summed CPU of every process; hysteresis keeps the chip from flickering.
let perfSnapshot = null;
let ecoEffective = !!current.ecoMode;
let busy = false;
const BUSY_ON = 1.5;
const BUSY_OFF = 0.5;
const GROUPS = ['island', 'settings', 'palette', 'browser', 'renderer', 'gpu', 'utility', 'powershell'];

const setChip = (chip, state, key) => {
  chip.dataset.state = state;
  chip.querySelector('span').textContent = t(key);
};
const mbText = (mb) => I18N.num(mb, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
function uptimeText(sec) {
  const unit = (n, u) => I18N.num(n, { style: 'unit', unit: u, unitDisplay: 'narrow' });
  const m = Math.floor(sec / 60);
  const h = Math.floor(m / 60);
  return h ? `${unit(h, 'hour')} ${unit(m % 60, 'minute')}` : m ? unit(m, 'minute') : unit(Math.floor(sec), 'second');
}

// The island and this window follow the same motion choice; Eco limits "full" to "reduced" (as the island does).
function paintMotion() {
  const mode = current.motion || 'full';
  document.documentElement.dataset.motion = mode === 'off' ? 'off' : mode === 'reduced' || ecoEffective ? 'reduced' : 'full';
  document.querySelectorAll('input[name="motion"]').forEach((r) => (r.checked = r.value === mode));
  $('motionNote').hidden = !(ecoEffective && mode === 'full');
}
document.querySelectorAll('input[name="motion"]').forEach((r) =>
  r.addEventListener('change', () => {
    current.motion = r.value;
    save({ motion: r.value });
    paintMotion();
  })
);

function paintRam() {
  const rows = $('ramRows');
  rows.replaceChildren();
  if (!perfSnapshot) {
    setChip($('ramState'), 'wait', 'settings.ram.state.wait');
    $('ramMeta').textContent = '';
    return;
  }
  const cpu = perfSnapshot.processes.reduce((n, p) => n + (p.cpu || 0), 0);
  busy = busy ? cpu > BUSY_OFF : cpu >= BUSY_ON;
  setChip($('ramState'), busy ? 'busy' : 'idle', busy ? 'settings.ram.state.busy' : 'settings.ram.state.idle');
  $('ramTotal').textContent = mbText(perfSnapshot.totalMB);

  const groups = new Map();
  for (const p of perfSnapshot.processes) {
    const name = GROUPS.includes(p.label) ? p.label : GROUPS.includes(p.type) ? p.type : 'other';
    groups.set(name, (groups.get(name) || 0) + p.mb);
  }
  const sorted = [...groups].sort((a, b) => b[1] - a[1]);
  const max = sorted.length ? sorted[0][1] || 1 : 1;
  for (const [name, mb] of sorted) {
    const li = document.createElement('li');
    const label = document.createElement('span');
    label.className = 'ram-name';
    label.textContent = t('settings.ram.proc.' + name);
    const bar = document.createElement('span');
    bar.className = 'ram-bar';
    const fill = document.createElement('b');
    fill.style.setProperty('--w', Math.max(2, Math.round((mb / max) * 100)) + '%');
    bar.append(fill);
    const val = document.createElement('span');
    val.className = 'ram-val';
    val.textContent = t('settings.ram.mb', { mb: mbText(mb) });
    li.append(label, bar, val);
    rows.append(li);
  }
  $('ramMeta').textContent = t('settings.ram.meta', { ps: perfSnapshot.powershellCount, up: uptimeText(perfSnapshot.uptimeSec) });
}

function paintPerformance() {
  const manual = !!current.ecoMode;
  setChip($('ecoState'), !ecoEffective ? 'inactive' : manual ? 'active' : 'battery', !ecoEffective ? 'settings.eco.inactive' : manual ? 'settings.eco.active' : 'settings.eco.battery');
  paintMotion();
  paintRam();
}

if (api.on) {
  api.on('perf:update', (value) => {
    perfSnapshot = value;
    paintRam();
  });
  api.on('eco:changed', (value) => {
    ecoEffective = !!value.eco;
    paintPerformance();
  });
  api.on('settings:update', (value) => {
    Object.assign(current, value);
    for (const key of [...fields, ...checks]) {
      if (document.activeElement === $(key)) continue;
      if (checks.includes(key)) $(key).checked = !!value[key];
      else $(key).value = value[key];
    }
    I18N.configure(current);
    paintSegments();
    paintPreview();
    paintPerformance();
  });
}
// Live figures are requested only while the window is visible; main also stops them on hide/close.
const subscribePerformance = () => api.send('perf:watch', !document.hidden);
if (api.perf)
  api
    .perf()
    .then((value) => {
      perfSnapshot = value;
      paintRam();
    })
    .catch(() => {});
if (api.send) {
  subscribePerformance();
  document.addEventListener('visibilitychange', subscribePerformance);
  window.addEventListener('beforeunload', () => api.send('perf:watch', false));
}
paintPerformance();

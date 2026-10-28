const api = window.settingsAPI;
const $ = (id) => document.getElementById(id);
const current = api.get();

const fields = ['position', 'autoHide', 'lang', 'prayerMethod', 'madhab', 'islandMode', 'material'];
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
for (const c of [...cities, { key: 'custom', ar: 'موقع مخصص…' }]) {
  const o = document.createElement('option');
  o.value = c.key;
  o.textContent = c.ar;
  $('city').append(o);
}
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
function secretField(input, button, state, name, flag, label) {
  const paint = (has) => {
    state.textContent = has ? '✓ ' + label + ' محفوظ. اترك الحقل فارغاً واضغط حفظ لحذفه.' : state.dataset.help || '';
    state.classList.toggle('ok', has);
  };
  state.dataset.help = state.textContent;
  paint(!!current[flag]);
  button.addEventListener('click', async () => {
    const value = input.value.trim();
    await api.setSecret(name, value);
    input.value = '';
    paint(!!value);
  });
}
secretField($('aiKey'), $('aiKeySave'), $('aiKeyState'), 'aiKey', 'hasAiKey', 'المفتاح');
secretField($('githubToken'), $('ghSave'), $('ghState'), 'githubToken', 'hasGithubToken', 'الرمز');

api.info().then((i) => ($('version').textContent = 'الإصدار ' + i.version));

const messages = {
  'up-to-date': 'أنت على آخر إصدار.',
  ready: 'تم تنزيل تحديث جديد. سيُثبَّت عند إعادة تشغيل التطبيق.',
  'needs-full-download': 'يوجد إصدار جديد يحتاج تحميل الحزمة كاملة من GitHub.',
  skipped: 'تم تخطّي إصدار لم يعمل بشكل صحيح من قبل.',
  busy: 'جارٍ التحقق…',
  error: 'تعذّر التحقق. تأكد من الاتصال بالإنترنت.',
};

$('check').addEventListener('click', async () => {
  $('status').textContent = 'جارٍ التحقق…';
  const r = await api.checkUpdate();
  $('status').textContent = messages[r.status] || r.status;
  if (r.status === 'ready') {
    const b = document.createElement('button');
    b.textContent = 'إعادة التشغيل الآن';
    b.addEventListener('click', () => api.applyUpdate());
    $('status').after(b);
  }
});

$('quit').addEventListener('click', () => api.quit());

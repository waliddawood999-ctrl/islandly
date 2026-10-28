const api = window.settingsAPI;
const $ = (id) => document.getElementById(id);
const current = api.get();

const fields = ['position', 'autoHide', 'lang'];
const checks = ['hideFullscreen', 'clipboard', 'updates'];

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

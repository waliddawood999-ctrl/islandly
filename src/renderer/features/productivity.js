const tr = (ar, en) => (LANG === 'ar' ? ar : en);
Island.register({
  id: 'activity',
  icon: ICONS.calendar,
  items: [],
  init() {
    this.list = h('div', { class: 'scroll activity-list' });
    this.empty = h(
      'div',
      { class: 'p-empty' },
      tr(
        'لا توجد إشعارات. هذه القائمة تجمع تنبيهات Islandly؛ قراءة إشعارات التطبيقات الأخرى تتطلب حزمة Windows.',
        'No notifications. This inbox collects Islandly alerts; mirroring other apps requires a Windows package.'
      )
    );
    this.expandedEl = h(
      'div',
      { class: 'view auto panel' },
      h(
        'div',
        { class: 'p-head' },
        (this.heading = h('b', {}, tr('الإشعارات', 'Notifications'))),
        h('button', { class: 'chip', onclick: () => API.call('activity:read') }, tr('قراءة الكل', 'Mark read')),
        h('button', { class: 'chip', onclick: () => API.call('activity:clear') }, tr('مسح', 'Clear'))
      ),
      h('button', { class: 'chip', onclick: () => API.send('focus:set', false) }, tr('استئناف التنبيهات', 'Resume alerts')),
      (this.nativeStatus = h('p', { class: 'hint' })),
      this.list,
      this.empty
    );
    const paintStatus = (status) => {
      this.nativeStatus.textContent =
        status === 'allowed'
          ? tr('قراءة إشعارات Windows مفعّلة', 'Windows notification access enabled')
          : status === 'package-required'
            ? tr('قراءة إشعارات التطبيقات تحتاج حزمة MSIX مع الجسر الأصلي', 'Other apps require the MSIX package and native bridge')
            : 'Windows notifications: ' + status;
    };
    API.on('notifications:status', paintStatus);
    API.call('notifications:status').then(paintStatus);
    API.on('activity:update', (items) => this.set(items));
    API.call('activity:list').then((items) => this.set(items || []));
    API.on('activity:alert', (item) => Notice.show({ text: item.title, detail: item.body }, 6000));
  },
  set(items) {
    this.items = items;
    this.heading.textContent = tr('الإشعارات', 'Notifications') + ' · ' + items.filter((i) => !i.read).length;
    this.empty.hidden = !!items.length;
    this.list.replaceChildren(
      ...items.map((i) =>
        h(
          'div',
          { class: 'activity-row' },
          h('b', {}, i.title),
          h('p', { dir: 'auto' }, i.body),
          h('small', {}, i.source + ' · ' + new Date(i.at).toLocaleTimeString())
        )
      )
    );
    Island.render();
  },
  priority: () => 0,
  view(mode) {
    return mode === 'expanded' ? { el: this.expandedEl, w: 480, auto: true } : null;
  },
});
Island.register({
  id: 'launcher',
  icon: ICONS.shelf,
  init() {
    this.list = h('div', { class: 'launch-grid' });
    this.expandedEl = h('div', { class: 'view auto panel' }, h('div', { class: 'p-title' }, tr('المفضلات ومساحات العمل', 'Favorites & workspaces')), this.list);
    this.paint();
    API.on('settings:update', () => this.paint());
  },
  paint() {
    API.call('launcher:list').then((items) => {
      this.list.replaceChildren(
        ...(items || []).map((i) =>
          h(
            'button',
            {
              class: 'launch-tile',
              'data-interactive': '1',
              onclick: () => API.call('launcher:run', i.id),
            },
            h('span', {}, i.name.slice(0, 1)),
            h('b', {}, i.name)
          )
        )
      );
      Island.render();
    });
  },
  priority: () => 0,
  view(mode) {
    return mode === 'expanded' ? { el: this.expandedEl, w: 440, auto: true } : null;
  },
});
Island.register({
  id: 'jobs',
  icon: ICONS.timer,
  items: [],
  init() {
    this.list = h('div', { class: 'scroll activity-list' });
    this.expandedEl = h(
      'div',
      { class: 'view auto panel' },
      h('div', { class: 'p-title' }, tr('المهام والتنزيلات', 'Jobs & downloads')),
      h(
        'p',
        { class: 'hint' },
        tr(
          'تشغّل الأوامر صراحة عبر ملف islandly-run.ps1. لا نقرأ أوامرك الأخرى تلقائيًا.',
          'Run commands explicitly with islandly-run.ps1. Other terminal commands are not monitored.'
        )
      ),
      this.list
    );
    API.on('jobs:update', (items) => this.set(items));
    API.call('jobs:list').then((items) => this.set(items || []));
  },
  set(items) {
    this.items = items;
    this.list.replaceChildren(
      ...items.map((i) =>
        h(
          'div',
          { class: 'activity-row' },
          h('b', {}, i.label),
          h('small', {}, i.status + (i.progress === null ? '' : ` · ${i.progress}%`)),
          i.status === 'running' && !i.external ? h('button', { class: 'chip', onclick: () => API.call('jobs:cancel', i.id) }, tr('إلغاء', 'Cancel')) : null
        )
      )
    );
    Island.render();
  },
  priority: () => 0,
  view(mode) {
    return mode === 'expanded' ? { el: this.expandedEl, w: 460, auto: true } : null;
  },
});
Island.register({
  id: 'assistant',
  icon: ICONS.note,
  init() {
    this.text = h('textarea', {
      class: 'assistant-input',
      rows: '4',
      placeholder: tr('ألصق النص هنا للترجمة أو الشرح', 'Paste text to translate or explain'),
      dir: 'auto',
    });
    this.text.addEventListener('focus', () => {
      Island.hold(true);
      API.send('island:focus', true);
    });
    this.text.addEventListener('blur', () => Island.hold(false));
    this.result = h('div', { class: 'assistant-output scroll', dir: 'auto' });
    this.status = h('small');
    const action = (label, op) => h('button', { class: 'chip', onclick: () => this.run(op) }, label);
    this.expandedEl = h(
      'div',
      { class: 'view auto panel' },
      h('div', { class: 'p-title' }, tr('النص والمساعد', 'Text assistant')),
      h(
        'div',
        { class: 'chips' },
        h('button', { class: 'chip', onclick: () => API.call('capture:open', 'image') }, 'Screenshot / OCR'),
        h('button', { class: 'chip', onclick: () => API.call('capture:open', 'record') }, tr('تسجيل الشاشة', 'Record screen'))
      ),
      this.text,
      h(
        'div',
        { class: 'chips' },
        action(tr('ترجم', 'Translate'), 'translate'),
        action(tr('اشرح', 'Explain'), 'explain'),
        action(tr('لخّص', 'Summarize'), 'summarize'),
        action(tr('صحّح', 'Correct'), 'correct'),
        h(
          'button',
          {
            class: 'chip',
            onclick: () => API.call('assistant:copy', this.result.textContent),
          },
          tr('نسخ النتيجة', 'Copy result')
        )
      ),
      this.status,
      this.result,
      h(
        'p',
        { class: 'hint' },
        tr(
          'يُرسل النص الذي تختاره إلى Anthropic فقط عند الضغط، ويتطلب مفتاحك. لا تُقرأ الشاشة تلقائيًا.',
          'Your selected text is sent to Anthropic only on request, using your key. No automatic screen reading.'
        )
      )
    );
    API.on('assistant:show', (text) => {
      this.text.value = text;
      Island.open('assistant');
    });
  },
  async run(op) {
    if (!this.text.value.trim()) return;
    this.status.textContent = tr('جارٍ المعالجة…', 'Working…');
    const r = await API.call('text:process', op, this.text.value);
    this.status.textContent = '';
    this.show(r.text || r.error);
  },
  show(text) {
    this.result.textContent = text || '';
    Island.render();
  },
  priority: () => 0,
  view(mode) {
    return mode === 'expanded' ? { el: this.expandedEl, w: 480, auto: true } : null;
  },
});

Island.register({
  id: 'plugins',
  icon: ICONS.shelf,
  init() {
    this.list = h('div', { class: 'scroll activity-list' });
    this.cards = h('div', { class: 'scroll activity-list' });
    this.expandedEl = h(
      'div',
      { class: 'view auto panel' },
      h('div', { class: 'p-title' }, tr('الإضافات', 'Plugins')),
      h(
        'p',
        { class: 'hint' },
        tr(
          'إضافات JavaScript معزولة تعرض نصًا فقط، دون ملفات أو شبكة. فعّلها من الإعدادات.',
          'Sandboxed JavaScript text cards only: no files or network. Enable in Settings.'
        )
      ),
      h('button', { class: 'chip', onclick: () => API.call('plugins:folder') }, tr('مجلد الإضافات', 'Plugins folder')),
      h('button', { class: 'chip', onclick: () => this.refresh() }, tr('تحديث القائمة', 'Refresh list')),
      this.list,
      this.cards
    );
    this.refresh();
    API.on('plugins:update', (cards) => {
      this.cards.replaceChildren(...cards.map((c) => h('div', { class: 'activity-row' }, h('b', {}, c.title), h('p', {}, c.text))));
      Island.render();
    });
  },
  async refresh() {
    const list = await API.call('plugins:list');
    this.list.replaceChildren(
      ...(list || []).map((p) =>
        h(
          'div',
          { class: 'activity-row' },
          h('b', {}, p.name),
          h(
            'button',
            {
              class: 'chip',
              onclick: async () => {
                try {
                  await API.call('plugins:enable', p.id, !p.enabled);
                  this.refresh();
                } catch (e) {
                  Notice.show({ text: e.message });
                }
              },
            },
            p.enabled ? tr('إيقاف', 'Disable') : tr('تشغيل', 'Enable')
          )
        )
      )
    );
    Island.render();
  },
  priority: () => 0,
  view(mode) {
    return mode === 'expanded' ? { el: this.expandedEl, w: 480, auto: true } : null;
  },
});

Island.register({
  id: 'adhkar',
  icon: ICONS.moon,
  init() {
    const cards = [
      ['ذكر', 'سبحان الله وبحمده'],
      ['ذكر', 'لا إله إلا الله وحده لا شريك له، له الملك وله الحمد وهو على كل شيء قدير'],
      ['دعاء', 'ربنا آتنا في الدنيا حسنة وفي الآخرة حسنة وقنا عذاب النار'],
    ];
    this.expandedEl = h(
      'div',
      { class: 'view auto panel' },
      h('div', { class: 'p-title' }, tr('بطاقات أذكار', 'Adhkar cards')),
      h(
        'div',
        { class: 'scroll activity-list' },
        ...cards.map(([title, text]) => h('div', { class: 'activity-row' }, h('small', {}, title), h('p', { dir: 'rtl' }, text)))
      )
    );
  },
  priority: () => 0,
  view(mode) {
    return mode === 'expanded' ? { el: this.expandedEl, w: 440, auto: true } : null;
  },
});

// Clock: the resting pill shows the time; the panel shows a big clock, the date (Gregorian and Hijri)
// and a row of app shortcuts (Settings → "App shortcuts").
Island.register({
  id: 'clock',
  idle: true, // the compact pill only shows when auto-hide is off
  icon: ICONS.clock,
  node: null,
  timer: 0,
  secTimer: 0,
  shortcuts: [],

  init() {
    this.label = h('span', { class: 'clock-time', dir: 'ltr' });
    this.node = h('div', { class: 'view clock' }, h('i', { class: 'clock-dot' }), this.label);

    this.bigTime = h('span', { class: 'ck-time', dir: 'ltr' });
    this.bigSec = h('span', { class: 'ck-sec', dir: 'ltr' });
    this.dateEl = h('div', { class: 'ck-date' });
    this.hijriEl = h('div', { class: 'm-artist' });
    this.apps = h('div', { class: 'ck-apps stagger' });
    this.expandedEl = h(
      'div',
      { class: 'view auto clock-panel' },
      h('div', { class: 'ck-head' }, h('div', { class: 'ck-clock' }, this.bigTime, this.bigSec), h('div', { class: 'ck-dates' }, this.dateEl, this.hijriEl)),
      this.apps
    );

    API.on('shortcuts:update', (list) => this.setShortcuts(list));
    API.call('shortcuts:list').then((list) => this.setShortcuts(list));
    this.tick();
  },

  setShortcuts(list) {
    this.shortcuts = Array.isArray(list) ? list.slice(0, 8) : [];
    this.apps.replaceChildren(
      ...this.shortcuts.map((a) =>
        h(
          'button',
          { class: 'ck-app', title: a.name, 'data-interactive': '1', onclick: () => API.send('shortcuts:open', a.name) },
          a.icon ? h('img', { src: a.icon, alt: '', draggable: 'false' }) : h('span', { class: 'ck-app-fallback' }, html(ICONS.app)),
          h('span', { class: 'ck-app-name', dir: 'auto' }, a.name)
        )
      ),
      h('button', { class: 'ck-app', title: t('settings'), 'data-interactive': '1', onclick: () => API.send('settings:open') }, h('span', { class: 'ck-app-fallback' }, html(ICONS.gear)), h('span', { class: 'ck-app-name' }, t('settings')))
    );
    Island.render();
  },

  tick() {
    const now = new Date();
    this.label.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    this.paintPanel(now);
    // Wake once a minute, exactly on the minute.
    this.timer = setTimeout(() => this.tick(), (60 - now.getSeconds()) * 1000 - now.getMilliseconds() + 20);
  },

  paintPanel(now = new Date()) {
    this.bigTime.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    this.bigSec.textContent = ':' + pad2(now.getSeconds());
    this.dateEl.textContent = now.toLocaleDateString(LANG === 'ar' ? 'ar' : 'en', { weekday: 'long', day: 'numeric', month: 'long' });
    try {
      this.hijriEl.textContent = new Intl.DateTimeFormat((LANG === 'ar' ? 'ar-SA' : 'en') + '-u-ca-islamic-umalqura', { day: 'numeric', month: 'long', year: 'numeric' }).format(now);
    } catch (_) {
      this.hijriEl.textContent = '';
    }
  },

  // Seconds tick only while the panel is on screen.
  sync() {
    const open = Island.isExpanded() && Island.selectedId() === 'clock';
    if (open && !this.secTimer) {
      this.paintPanel();
      this.secTimer = setInterval(() => this.paintPanel(), 1000);
    } else if (!open && this.secTimer) {
      clearInterval(this.secTimer);
      this.secTimer = 0;
    }
  },

  priority: () => 1,

  view(mode) {
    if (mode === 'compact') return { el: this.node, w: 100, h: 32 };
    if (mode === 'expanded') return { el: this.expandedEl, w: 420, auto: true };
    return null;
  },
});

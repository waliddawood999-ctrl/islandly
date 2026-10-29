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
    this.occasion = h('span', { class: 'occasion' });
    this.apps = h('div', { class: 'ck-apps stagger' });
    this.expandedEl = h(
      'div',
      { class: 'view auto clock-panel' },
      h('div', { class: 'ck-head' }, h('div', { class: 'ck-clock' }, this.bigTime, this.bigSec), h('div', { class: 'ck-dates' }, this.dateEl, this.hijriEl, this.occasion)),
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
      h(
        'button',
        { class: 'ck-app', title: t('settings'), 'data-interactive': '1', onclick: () => API.send('settings:open') },
        h('span', { class: 'ck-app-fallback' }, html(ICONS.gear)),
        h('span', { class: 'ck-app-name' }, t('settings'))
      )
    );
    Island.render();
  },

  tick() {
    const now = new Date();
    this.label.textContent = I18N.time(now);
    this.paintPanel(now);
    // Wake once a minute, exactly on the minute.
    this.timer = setTimeout(() => this.tick(), (60 - now.getSeconds()) * 1000 - now.getMilliseconds() + 20);
  },

  paintPanel(now = new Date()) {
    this.bigTime.textContent = I18N.time(now);
    this.bigSec.textContent = I18N.digits(':' + pad2(now.getSeconds()));
    this.dateEl.textContent = I18N.date(now);
    this.hijriEl.textContent = I18N.hijri(now);
  },

  relang() {
    this.label.textContent = I18N.time(new Date());
    this.paintPanel();
    this.setShortcuts(this.shortcuts);
  },

  // Seconds tick only while the panel is on screen.
  sync() {
    const open = Island.isExpanded() && Island.selectedId() === 'clock';
    if (open && !this.secTimer) {
      this.paintPanel();
      this.secTimer = setInterval(() => this.paintPanel(), 1000);
      HijriInfo.paint(this.occasion); // Hijri occasion (T12): asked for when the panel opens
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

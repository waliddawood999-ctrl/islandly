// Time tracker: which apps had your attention today (counted only while you are active, stored on this PC only).
Island.register({
  id: 'usage',
  icon: null,
  data: { total: 0, apps: [] },

  init() {
    this.total = h('span', { class: 'count wide' });
    this.list = h('div', { class: 'us-list stagger' });
    this.empty = h('div', { class: 'p-empty' }, h('div', { class: 'm-artist' }, T('usageEmpty')));
    this.expandedEl = h(
      'div',
      { class: 'view auto panel usage' },
      h('div', { class: 'p-head' }, h('div', { class: 'p-title-wrap' }, h('div', { class: 'p-title' }, T('usage')), this.total)),
      this.list,
      this.empty
    );
    API.on('usage:update', (d) => this.set(d));
    API.call('usage:get').then((d) => d && this.set(d));
    this.paint();
  },

  set(d) {
    const before = this.data.apps.map((a) => a.name).join('|');
    this.data = d;
    // repaint the rows only when the ranking changes or the panel is open, to keep updates cheap
    if (before !== d.apps.map((a) => a.name).join('|') || (Island.isExpanded() && Island.selectedId() === 'usage')) this.paint();
  },

  dur(seconds) {
    const m = Math.round(seconds / 60);
    return m < 60 ? t('minutesShort', { m }) : t('hoursShort', { h: Math.floor(m / 60), m: m % 60 });
  },

  paint() {
    const { total, apps } = this.data;
    this.total.textContent = total >= 60 ? this.dur(total) : '';
    this.empty.style.display = apps.length ? 'none' : '';
    const max = apps.length ? apps[0].seconds : 1;
    const colors = ['#a78bfa', '#60a5fa', '#34d399', '#fbbf24', '#f472b6', '#9ba1b6'];
    this.list.replaceChildren(
      ...apps.map((a, i) => {
        const fill = h('i');
        fill.style.width = Math.max(4, (a.seconds / max) * 100) + '%';
        fill.style.background = colors[i % colors.length];
        return h('div', { class: 'us-row' }, h('div', { class: 'us-top' }, h('span', { class: 'us-name', dir: 'auto' }, a.name), h('span', { class: 'us-time' }, this.dur(a.seconds))), h('div', { class: 'meter thin' }, fill));
      })
    );
  },

  sync() {
    if (Island.isExpanded() && Island.selectedId() === 'usage') this.paint();
  },

  priority: () => 0,

  view(mode) {
    if (mode !== 'expanded' || API.settings.timeTracking === false) return null;
    return { el: this.expandedEl, w: 400, auto: true };
  },
});

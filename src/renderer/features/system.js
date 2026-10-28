// System: CPU and memory, sampled only while this panel is open.
Island.register({
  id: 'system',
  icon: null,
  data: null,
  watching: false,

  init() {
    this.cpuRing = ring(70, 8, '#60a5fa', 'rgba(255,255,255,.12)');
    this.cpuText = h('div', { class: 'ring-label sm', dir: 'ltr' }, '–');
    this.memFill = h('i');
    this.memText = h('div', { class: 'm-artist', dir: 'ltr' });
    this.uptime = h('div', { class: 'm-artist' });
    this.expandedEl = h(
      'div',
      { class: 'view auto system-expanded' },
      h('div', { class: 'ring-wrap s' }, this.cpuRing.el, this.cpuText),
      h(
        'div',
        { class: 'sys-side' },
        h('div', { class: 'p-title' }, t('cpu')),
        h('div', { class: 'sys-label' }, t('memory')),
        h('div', { class: 'meter', dir: 'ltr' }, this.memFill),
        this.memText,
        this.uptime
      )
    );
    API.on('system:sample', (d) => this.set(d));
  },

  set(d) {
    this.data = d;
    const color = d.cpu > 85 ? '#f87171' : d.cpu > 60 ? '#fbbf24' : '#60a5fa';
    this.cpuRing.set(d.cpu / 100);
    this.cpuRing.color(color);
    this.cpuText.textContent = d.cpu + '%';
    const frac = d.memUsed / d.memTotal;
    this.memFill.style.width = frac * 100 + '%';
    this.memFill.style.background = frac > 0.9 ? '#f87171' : frac > 0.75 ? '#fbbf24' : '#34d399';
    const gb = (b) => (b / 1024 ** 3).toFixed(1);
    this.memText.textContent = `${gb(d.memUsed)} / ${gb(d.memTotal)} GB`;
    const hrs = Math.floor(d.uptime / 3600);
    this.uptime.textContent = t('uptime', { h: num(hrs), m: num(Math.floor((d.uptime % 3600) / 60)) });
  },

  sync() {
    const open = Island.isExpanded() && Island.selectedId() === 'system';
    if (open !== this.watching) {
      this.watching = open;
      API.send('system:watch', open);
    }
  },

  priority: () => 0,

  view(mode) {
    return mode === 'expanded' ? { el: this.expandedEl, w: 400, auto: true } : null;
  },
});

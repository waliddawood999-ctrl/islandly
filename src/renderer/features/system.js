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
    // quick controls: volume keys and laptop screen brightness
    const vol = (action, icon, label) =>
      h(
        'button',
        {
          class: 'qc-btn',
          title: label,
          'data-interactive': '1',
          onclick: () => API.send('controls:volume', action),
        },
        html(icon)
      );
    this.bright = h('input', {
      class: 'qc-range',
      type: 'range',
      min: '0',
      max: '100',
      step: '5',
      dir: 'ltr',
      'data-interactive': '1',
    });
    this.bright.addEventListener('change', () => API.call('controls:brightness', Number(this.bright.value)));
    this.brightRow = h('div', { class: 'qc-bright' }, h('span', { class: 'qc-ic' }, html(ICONS.sun)), this.bright);
    this.brightRow.style.display = 'none';
    this.netText = h('div', { class: 'm-artist', dir: 'ltr' });
    this.controls = h(
      'div',
      { class: 'qc' },
      h(
        'div',
        { class: 'qc-vol', dir: 'ltr' },
        vol('voldown', ICONS.volDown, t('volDown')),
        vol('mute', ICONS.mute, t('mute')),
        vol('volup', ICONS.volUp, t('volUp'))
      ),
      this.brightRow,
      h(
        'div',
        { class: 'chips' },
        ...['wifi', 'bluetooth', 'dnd', 'sound'].map((key) =>
          h(
            'button',
            { class: 'chip', onclick: () => API.send('settings:system', key) },
            (LANG === 'ar' ? 'إعدادات ' : 'Settings: ') +
              {
                wifi: 'Wi-Fi',
                bluetooth: 'Bluetooth',
                dnd: LANG === 'ar' ? 'عدم الإزعاج' : 'Do not disturb',
                sound: LANG === 'ar' ? 'الصوت' : 'Sound',
              }[key]
          )
        )
      )
    );
    this.expandedEl = h(
      'div',
      { class: 'view auto system-wrap' },
      h(
        'div',
        { class: 'system-expanded' },
        h('div', { class: 'ring-wrap s' }, this.cpuRing.el, this.cpuText),
        h(
          'div',
          { class: 'sys-side' },
          h('div', { class: 'p-title' }, t('cpu')),
          h('div', { class: 'sys-label' }, t('memory')),
          h('div', { class: 'meter', dir: 'ltr' }, this.memFill),
          this.memText,
          this.uptime,
          this.netText
        )
      ),
      this.controls
    );
    API.on('system:sample', (d) => this.set(d));
  },

  set(d) {
    this.data = d;
    this.netText.textContent = d.network ? `↓ ${(d.network.rx / 1024).toFixed(1)} KB/s   ↑ ${(d.network.tx / 1024).toFixed(1)} KB/s` : '';
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
    this.uptime.textContent = t('uptime', {
      h: num(hrs),
      m: num(Math.floor((d.uptime % 3600) / 60)),
    });
  },

  sync() {
    const open = Island.isExpanded() && Island.selectedId() === 'system';
    if (open !== this.watching) {
      this.watching = open;
      API.send('system:watch', open);
      // read the brightness once per opening; the row stays hidden on desktops without a built-in display
      if (open) {
        API.call('controls:brightness').then((level) => {
          if (Number.isFinite(level)) {
            this.bright.value = String(level);
            this.brightRow.style.display = '';
          }
        });
      }
    }
  },

  priority: () => 0,

  view(mode) {
    return mode === 'expanded' ? { el: this.expandedEl, w: 400, auto: true } : null;
  },
});

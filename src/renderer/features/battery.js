Island.register({
  id: 'battery',
  icon: ICONS.battery,
  bat: null,
  lastLevel: null,
  lastCharging: null,
  devices: [],

  init() {
    // expanded: [ring + bolt]  82%  Charging / eta / tip / bluetooth devices
    this.xRing = ring(78, 9, '#34d399', 'rgba(255,255,255,.12)');
    this.xBolt = h('span', { class: 'ring-icon' }, html(ICONS.bolt));
    this.pct = h('div', { class: 'b-pct', dir: 'ltr' });
    this.state = h('div', { class: 'b-state' });
    this.eta = h('div', { class: 'b-eta' });
    this.tip = h('div', { class: 'tip' }, t('tip80'));
    this.devs = h('div', { class: 'devs stagger' });
    this.expandedEl = h(
      'div',
      { class: 'view auto battery-expanded' },
      h('div', { class: 'ring-wrap b' }, this.xRing.el, this.xBolt),
      h('div', { class: 'b-text' }, h('div', { class: 'b-row' }, this.pct, this.state), this.eta, this.tip, this.devs)
    );

    // compact (low battery): small ring + percent
    this.cRing = ring(24, 4, '#f87171', 'rgba(255,255,255,.14)');
    this.cText = h('span', { class: 'tm', dir: 'ltr' });
    this.compact = h('div', { class: 'view battery-compact' }, this.cRing.el, this.cText);

    // peek (plug / unplug / low)
    this.pRing = ring(46, 6, '#34d399', 'rgba(255,255,255,.12)');
    this.pText = h('div', { class: 'm-title' });
    this.pSub = h('div', { class: 'm-artist' });
    this.peekEl = h('div', { class: 'view battery-peek' }, this.pRing.el, h('div', { class: 'm-text' }, this.pText, this.pSub));

    API.on('bluetooth:update', (list) => {
      this.devices = list || [];
      this.paintDevices();
      Island.render();
    });

    const nativePoll = async () => {
      try {
        const s = await API.call('battery:get');
        if (!s) return;
        if (s.hasBattery === null) return;
        this.nativePower = true;
        this.noBattery = !s.hasBattery;
        if (!s.hasBattery) {
          this.bat = null;
          Island.render();
          return;
        }
        if (s.level === null) return;
        const first = !this.bat;
        this.bat = {
          level: s.level,
          charging: s.charging,
          chargingTime: Infinity,
          dischargingTime: s.remaining || Infinity,
        };
        if (first) {
          this.lastLevel = s.level;
          this.lastCharging = s.charging;
          this.paint();
          Island.render();
        } else this.onChange();
      } catch (_) {}
    };
    nativePoll();
    setInterval(nativePoll, 30000);
    if (!navigator.getBattery) return;
    navigator.getBattery().then((b) => {
      if (this.noBattery || this.bat) return;
      this.bat = b;
      const update = () => {
        if (!this.nativePower) this.onChange();
      };
      ['levelchange', 'chargingchange', 'chargingtimechange', 'dischargingtimechange'].forEach((e) => b.addEventListener(e, update));
      this.lastLevel = b.level;
      this.lastCharging = b.charging;
      this.paint();
      Island.render();
    });
  },

  color(level, charging) {
    if (charging) return '#34d399';
    if (level <= 0.15) return '#f87171';
    if (level <= 0.3) return '#fbbf24';
    return '#ffffff';
  },

  onChange() {
    const b = this.bat;
    const chargingChanged = b.charging !== this.lastCharging;
    const crossedLow = b.level <= 0.15 && this.lastLevel > 0.15 && !b.charging;
    this.lastLevel = b.level;
    this.lastCharging = b.charging;
    this.paint();
    if (chargingChanged) {
      this.pSub.textContent = t(b.charging ? 'plugged' : 'unplugged');
      Island.peek('battery', 3500);
    } else if (crossedLow) {
      this.pSub.textContent = t('low');
      Island.peek('battery', 5000);
    } else {
      Island.render();
    }
  },

  duration(seconds) {
    if (!isFinite(seconds) || seconds <= 0) return null;
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.round((seconds % 3600) / 60);
    return hrs ? `${num(hrs)} ${t('hour')} ${num(mins)} ${t('min')}` : `${num(mins)} ${t('min')}`;
  },

  paintDevices() {
    this.devs.replaceChildren(
      ...this.devices
        .slice(0, 3)
        .map((d) => h('span', { class: 'dev' }, html(ICONS.headphones), h('span', { class: 'dev-name' }, d.name), h('b', { dir: 'ltr' }, d.battery + '%')))
    );
    this.devs.style.display = this.devices.length ? '' : 'none';
  },

  paint() {
    const b = this.bat;
    if (!b) return;
    const level = b.level;
    const pct = Math.round(level * 100) + '%';
    const color = this.color(level, b.charging);
    this.pct.textContent = this.cText.textContent = pct;
    this.pText.textContent = num(Math.round(level * 100)) + '٪ · ' + t(b.charging ? 'charging' : 'onBattery');
    if (LANG === 'en') this.pText.textContent = pct + ' · ' + t(b.charging ? 'charging' : 'onBattery');
    for (const r of [this.xRing, this.cRing, this.pRing]) {
      r.set(level);
      r.color(color);
    }
    this.xBolt.style.display = b.charging ? '' : 'none';
    this.cText.style.color = color;

    this.state.textContent = b.charging ? (level >= 1 ? t('full') : t('charging')) : t('onBattery');
    const secs = b.charging ? b.chargingTime : b.dischargingTime;
    const d = this.duration(secs);
    this.eta.textContent = level >= 1 && b.charging ? '' : d ? `${d} ${t(b.charging ? 'untilFull' : 'left')}` : t('calculating');
    this.tip.style.display = b.charging && level >= 0.8 && level < 1 ? '' : 'none';
    if (!this.pSub.textContent) this.pSub.textContent = this.eta.textContent;
    this.paintDevices();
  },

  // Only takes the resting pill when the battery is critically low and not charging.
  priority() {
    return this.bat && this.bat.level <= 0.15 && !this.bat.charging ? 25 : 0;
  },

  view(mode) {
    if (!this.bat) return mode === 'expanded' && this.devices.length ? { el: this.devs, w: 420, auto: true } : null;
    if (mode === 'compact') return this.priority() ? { el: this.compact, w: 128, h: 42 } : null;
    if (mode === 'peek') return { el: this.peekEl, w: 330, h: 80 };
    if (mode === 'expanded') {
      return { el: this.expandedEl, w: 420, auto: true };
    }
    return null;
  },
});

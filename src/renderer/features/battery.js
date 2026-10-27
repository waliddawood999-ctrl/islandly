Island.register({
  id: 'battery',
  icon: ICONS.battery,
  bat: null,
  lastLevel: null,
  lastCharging: null,

  init() {
    this.fill = h('i', { class: 'bat-fill' });
    this.bolt = h('span', { class: 'bat-bolt' }, html(ICONS.bolt));
    this.glyph = h('div', { class: 'bat' }, this.fill, this.bolt);
    this.pct = h('div', { class: 'b-pct', dir: 'ltr' });
    this.state = h('div', { class: 'b-state' });
    this.eta = h('div', { class: 'b-eta' });
    this.tip = h('div', { class: 'tip' }, t('tip80'));
    this.expandedEl = h('div', { class: 'view battery-expanded' }, this.glyph, h('div', { class: 'b-text' }, h('div', { class: 'b-row' }, this.pct, this.state), this.eta, this.tip));

    // compact (low battery) and peek (plug / unplug) share the same shape.
    this.cGlyph = h('div', { class: 'bat sm' }, h('i', { class: 'bat-fill' }));
    this.cText = h('span', { class: 'tm', dir: 'ltr' });
    this.compact = h('div', { class: 'view battery-compact' }, this.cGlyph, this.cText);

    this.pText = h('div', { class: 'm-title' });
    this.pSub = h('div', { class: 'm-artist' });
    this.pGlyph = h('div', { class: 'bat md' }, h('i', { class: 'bat-fill' }));
    this.peekEl = h('div', { class: 'view battery-peek' }, this.pGlyph, h('div', { class: 'm-text' }, this.pText, this.pSub));

    if (!navigator.getBattery) return;
    navigator.getBattery().then((b) => {
      this.bat = b;
      const update = () => this.onChange();
      ['levelchange', 'chargingchange', 'chargingtimechange', 'dischargingtimechange'].forEach((e) => b.addEventListener(e, update));
      this.lastLevel = b.level;
      this.lastCharging = b.charging;
      this.paint();
      Island.render();
    });
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
    return hrs ? `${hrs} ${t('hour')} ${mins} ${t('min')}` : `${mins} ${t('min')}`;
  },

  paintGlyph(root, level, charging) {
    const f = root.querySelector('.bat-fill');
    f.style.width = Math.round(level * 100) + '%';
    root.classList.toggle('low', level <= 0.15 && !charging);
    root.classList.toggle('charging', charging);
  },

  paint() {
    const b = this.bat;
    if (!b) return;
    const level = b.level;
    const pct = Math.round(level * 100) + '%';
    this.pct.textContent = this.cText.textContent = pct;
    this.pText.textContent = pct + ' · ' + t(b.charging ? 'charging' : 'onBattery');
    this.paintGlyph(this.glyph, level, b.charging);
    this.paintGlyph(this.cGlyph, level, b.charging);
    this.paintGlyph(this.pGlyph, level, b.charging);

    this.state.textContent = b.charging ? (level >= 1 ? t('full') : t('charging')) : t('onBattery');
    const secs = b.charging ? b.chargingTime : b.dischargingTime;
    const d = this.duration(secs);
    this.eta.textContent = level >= 1 && b.charging ? '' : d ? `${d} ${t(b.charging ? 'untilFull' : 'left')}` : t('calculating');
    this.tip.style.display = b.charging && level >= 0.8 && level < 1 ? '' : 'none';
    if (!this.pSub.textContent) this.pSub.textContent = this.eta.textContent;
  },

  // Only takes the resting pill when the battery is critically low and not charging.
  priority() {
    return this.bat && this.bat.level <= 0.15 && !this.bat.charging ? 25 : 0;
  },

  view(mode) {
    if (!this.bat) return null;
    if (mode === 'compact') return this.priority() ? { el: this.compact, w: 128, h: 40 } : null;
    if (mode === 'peek') return { el: this.peekEl, w: 320, h: 70 };
    if (mode === 'expanded') return { el: this.expandedEl, w: 380, h: 118 };
    return null;
  },
});

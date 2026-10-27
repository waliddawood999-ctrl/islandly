// Focus / break timer (Pomodoro) and quick countdowns.
Island.register({
  id: 'timer',
  icon: ICONS.timer,

  mode: 'focus', // 'focus' | 'rest'
  total: 25 * 60, // seconds for the current round
  remaining: 25 * 60,
  running: false,
  endAt: 0,
  ticker: 0,
  presets: { focus: [25, 45, 15, 5], rest: [5, 10, 15] },

  init() {
    // compact: [ring] mm:ss
    this.cRing = ring(24, 3.5, '#a78bfa');
    this.cLabel = h('span', { class: 'tm', dir: 'ltr' });
    this.compact = h('div', { class: 'view timer-compact' }, this.cRing.el, this.cLabel);

    // expanded
    this.xRing = ring(92, 8, '#a78bfa');
    this.xLabel = h('div', { class: 'ring-label', dir: 'ltr' });
    this.xTitle = h('div', { class: 't-title' });
    this.mainBtn = h('button', { class: 'pill primary', onclick: () => this.toggle() });
    this.chips = h('div', { class: 'chips' });
    this.modeTabs = h('div', { class: 'chips modes' });
    this.expandedEl = h(
      'div',
      { class: 'view timer-expanded' },
      h('div', { class: 'ring-wrap' }, this.xRing.el, this.xLabel),
      h(
        'div',
        { class: 't-side' },
        this.xTitle,
        h(
          'div',
          { class: 't-actions' },
          this.mainBtn,
          h('button', { class: 'pill', title: t('reset'), onclick: () => this.reset() }, html(ICONS.reset))
        ),
        this.modeTabs,
        this.chips
      )
    );

    // peek: shown when a round finishes
    this.peekTitle = h('div', { class: 'm-title' });
    this.peekSub = h('div', { class: 'm-artist' });
    this.peekAction = h('button', { class: 'pill primary sm', onclick: () => this.startNext() });
    this.peekEl = h(
      'div',
      { class: 'view timer-peek' },
      h('div', { class: 'done-badge' }, '✓'),
      h('div', { class: 'm-text' }, this.peekTitle, this.peekSub),
      this.peekAction
    );

    this.paint();
  },

  setMode(mode, minutes) {
    this.mode = mode;
    this.total = (minutes || this.presets[mode][0]) * 60;
    this.remaining = this.total;
    this.stop();
    this.paint();
    Island.render();
  },

  setMinutes(minutes) {
    this.total = minutes * 60;
    this.remaining = this.total;
    this.stop();
    this.paint();
    Island.render();
  },

  toggle() {
    if (this.running) this.pause();
    else this.start();
  },

  start() {
    if (this.remaining <= 0) this.remaining = this.total;
    this.running = true;
    this.endAt = Date.now() + this.remaining * 1000;
    clearInterval(this.ticker);
    this.ticker = setInterval(() => this.tick(), 250);
    this.paint();
    Island.render();
  },

  pause() {
    this.remaining = Math.max(0, (this.endAt - Date.now()) / 1000);
    this.stop();
    this.paint();
    Island.render();
  },

  stop() {
    this.running = false;
    clearInterval(this.ticker);
    this.ticker = 0;
  },

  reset() {
    this.remaining = this.total;
    this.stop();
    this.paint();
    Island.render();
  },

  tick() {
    this.remaining = Math.max(0, (this.endAt - Date.now()) / 1000);
    if (this.remaining <= 0) return this.finish();
    this.paintTime();
  },

  finish() {
    this.stop();
    const wasFocus = this.mode === 'focus';
    beep();
    // Queue up the next round (not auto-started) and let the user decide.
    this.mode = wasFocus ? 'rest' : 'focus';
    this.total = this.presets[this.mode][0] * 60;
    this.remaining = this.total;
    this.peekTitle.textContent = t(wasFocus ? 'sessionDone' : 'restDone');
    this.peekSub.textContent = t(wasFocus ? 'timeForRest' : 'timeToFocus');
    this.peekAction.textContent = t('start') + ' · ' + t(this.mode);
    this.paint();
    Island.peek('timer', 9000);
  },

  startNext() {
    this.start();
    Island.render();
  },

  paintTime() {
    const frac = this.total ? this.remaining / this.total : 0;
    const label = clock(Math.ceil(this.remaining));
    this.cLabel.textContent = label;
    this.xLabel.textContent = label;
    this.cRing.set(frac);
    this.xRing.set(frac);
  },

  paint() {
    const color = this.mode === 'focus' ? '#a78bfa' : '#34d399';
    this.cRing.color(color);
    this.xRing.color(color);
    this.compact.classList.toggle('paused', !this.running);
    this.xTitle.textContent = t(this.mode === 'focus' ? 'focusSession' : 'restSession');
    this.mainBtn.textContent = this.running ? t('pause') : this.remaining < this.total ? t('resume') : t('start');

    this.modeTabs.replaceChildren(
      ...['focus', 'rest'].map((m) =>
        h('button', { class: 'chip' + (this.mode === m ? ' on' : ''), onclick: () => this.setMode(m) }, t(m))
      )
    );
    const minutes = Math.round(this.total / 60);
    this.chips.replaceChildren(
      ...this.presets[this.mode].map((mins) =>
        h('button', { class: 'chip' + (mins === minutes ? ' on' : ''), dir: 'ltr', onclick: () => this.setMinutes(mins) }, `${mins}${t('min')}`)
      )
    );
    this.paintTime();
  },

  // Show the compact timer while a round is running, or paused part-way through.
  priority() {
    return this.running || this.remaining < this.total ? 30 : 0;
  },

  view(mode) {
    if (mode === 'compact') return this.priority() ? { el: this.compact, w: 132, h: 40 } : null;
    if (mode === 'peek') return { el: this.peekEl, w: 400, h: 76 };
    if (mode === 'expanded') return { el: this.expandedEl, w: 420, h: 138 };
    return null;
  },
});

// Timers: Pomodoro (focus / break), a quick timer (5, 15, 30 minutes or a custom length) and a stopwatch.
// The custom length is set with − / + buttons, so the island never needs keyboard focus for it.
Island.register({
  id: 'timer',
  icon: ICONS.timer,

  mode: 'focus', // 'focus' | 'rest' | 'quick' | 'stopwatch'
  total: 25 * 60, // seconds for the current countdown
  remaining: 25 * 60,
  running: false,
  endAt: 0,
  ticker: 0,
  custom: 10, // minutes for the custom quick timer
  presets: { focus: [25, 50], rest: [5, 10], quick: [5, 15, 30] },
  // stopwatch
  elapsedBefore: 0, // seconds accumulated before the current run
  startedAt: 0,

  init() {
    // compact: [ring] mm:ss
    this.cRing = ring(20, 3, '#a78bfa');
    this.cLabel = h('span', { class: 'tm', dir: 'ltr' });
    this.compact = h('div', { class: 'view timer-compact' }, this.cRing.el, this.cLabel);

    // expanded
    this.xRing = ring(92, 7, '#a78bfa', 'rgba(255,255,255,.1)');
    this.xLabel = h('div', { class: 'ring-label', dir: 'ltr' });
    this.xTitle = h('div', { class: 't-title' });
    this.mainBtn = h('button', { class: 'pill primary', onclick: () => this.toggle() });
    this.resetBtn = h('button', { class: 'pill icon', title: t('reset'), onclick: () => this.reset() }, html(ICONS.reset));
    this.chips = h('div', { class: 'chips' });
    this.modeTabs = h('div', { class: 'seg' });
    this.expandedEl = h(
      'div',
      { class: 'view auto timer-expanded' },
      this.modeTabs,
      h(
        'div',
        { class: 't-main' },
        h('div', { class: 'ring-wrap' }, this.xRing.el, this.xLabel),
        h('div', { class: 't-side' }, this.xTitle, h('div', { class: 't-actions' }, this.mainBtn, this.resetBtn), this.chips)
      )
    );

    // peek: shown when a countdown finishes
    this.peekTitle = h('div', { class: 'm-title' });
    this.peekSub = h('div', { class: 'm-artist' });
    this.peekAction = h('button', { class: 'pill primary sm', onclick: () => this.startNext() });
    this.peekEl = h('div', { class: 'view timer-peek' }, h('div', { class: 'done-badge' }, html(ICONS.check)), h('div', { class: 'm-text' }, this.peekTitle, this.peekSub), this.peekAction);

    this.paint();
  },

  isStopwatch() {
    return this.mode === 'stopwatch';
  },

  elapsed() {
    return this.elapsedBefore + (this.running ? (Date.now() - this.startedAt) / 1000 : 0);
  },

  setMode(mode) {
    this.stop();
    this.mode = mode;
    if (mode === 'stopwatch') {
      this.elapsedBefore = 0;
    } else {
      this.total = (mode === 'quick' ? this.presets.quick[0] : this.presets[mode][0]) * 60;
      this.remaining = this.total;
    }
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

  stepCustom(delta) {
    this.custom = Math.max(1, Math.min(180, this.custom + delta));
    this.setMinutes(this.custom);
  },

  toggle() {
    if (this.running) this.pause();
    else this.start();
  },

  start() {
    clearInterval(this.ticker);
    if (this.isStopwatch()) {
      this.startedAt = Date.now();
    } else {
      if (this.remaining <= 0) this.remaining = this.total;
      this.endAt = Date.now() + this.remaining * 1000;
    }
    this.running = true;
    this.ticker = setInterval(() => this.tick(), 250);
    this.paint();
    Island.render();
  },

  pause() {
    if (this.isStopwatch()) this.elapsedBefore = this.elapsed();
    else this.remaining = Math.max(0, (this.endAt - Date.now()) / 1000);
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
    this.stop();
    if (this.isStopwatch()) this.elapsedBefore = 0;
    else this.remaining = this.total;
    this.paint();
    Island.render();
  },

  tick() {
    if (this.isStopwatch()) return this.paintTime();
    this.remaining = Math.max(0, (this.endAt - Date.now()) / 1000);
    if (this.remaining <= 0) return this.finish();
    this.paintTime();
  },

  finish() {
    this.stop();
    beep();
    if (this.mode === 'quick') {
      this.remaining = this.total;
      this.peekTitle.textContent = t('timerDone');
      this.peekSub.textContent = clock(this.total);
      this.peekAction.textContent = t('again');
    } else {
      // Pomodoro: queue up the next round (not auto-started) and let the user decide.
      const wasFocus = this.mode === 'focus';
      this.mode = wasFocus ? 'rest' : 'focus';
      this.total = this.presets[this.mode][0] * 60;
      this.remaining = this.total;
      this.peekTitle.textContent = t(wasFocus ? 'sessionDone' : 'restDone');
      this.peekSub.textContent = t(wasFocus ? 'timeForRest' : 'timeToFocus');
      this.peekAction.textContent = t('start') + ' · ' + t(this.mode);
    }
    this.paint();
    Island.peek('timer', 9000);
  },

  startNext() {
    this.start();
    Island.render();
  },

  paintTime() {
    if (this.isStopwatch()) {
      const e = this.elapsed();
      const label = e >= 3600 ? clock(Math.floor(e)) : `${Math.floor(e / 60)}:${pad2(Math.floor(e % 60))}.${Math.floor((e % 1) * 10)}`;
      this.cLabel.textContent = clock(Math.floor(e));
      this.xLabel.textContent = label;
      // the ring sweeps once a minute, like a second hand
      this.cRing.set((e % 60) / 60);
      this.xRing.set((e % 60) / 60);
      return;
    }
    const frac = this.total ? this.remaining / this.total : 0;
    const label = clock(Math.ceil(this.remaining));
    this.cLabel.textContent = label;
    this.xLabel.textContent = label;
    this.cRing.set(frac);
    this.xRing.set(frac);
  },

  paint() {
    const color = { focus: '#a78bfa', rest: '#34d399', quick: '#60a5fa', stopwatch: '#fbbf24' }[this.mode];
    this.cRing.color(color);
    this.xRing.color(color);
    this.compact.classList.toggle('paused', !this.running);
    this.xTitle.textContent = t({ focus: 'focusSession', rest: 'restSession', quick: 'quickTimer', stopwatch: 'stopwatch' }[this.mode]);
    const started = this.isStopwatch() ? this.elapsedBefore > 0 : this.remaining < this.total;
    this.mainBtn.replaceChildren(html(this.running ? ICONS.pause : ICONS.play), h('span', {}, this.running ? t('pause') : started ? t('resume') : t('start')));

    this.modeTabs.replaceChildren(
      ...['focus', 'rest', 'quick', 'stopwatch'].map((m) => h('button', { class: 'seg-btn' + (this.mode === m ? ' on' : ''), onclick: () => this.setMode(m) }, t(m === 'quick' ? 'timerTab' : m)))
    );

    const minutes = Math.round(this.total / 60);
    if (this.isStopwatch()) {
      this.chips.replaceChildren();
    } else if (this.mode === 'quick') {
      const isPreset = this.presets.quick.includes(minutes);
      this.chips.replaceChildren(
        ...this.presets.quick.map((mins) => h('button', { class: 'chip' + (mins === minutes ? ' on' : ''), dir: 'ltr', onclick: () => this.setMinutes(mins) }, `${num(mins)} ${t('min')}`)),
        h(
          'div',
          { class: 'stepper' + (isPreset ? '' : ' on'), dir: 'ltr' },
          h('button', { class: 'step', title: '-1', onclick: () => this.stepCustom(-1) }, '−'),
          h('button', { class: 'step-val', title: t('custom'), onclick: () => this.setMinutes(this.custom) }, `${num(this.custom)} ${t('min')}`),
          h('button', { class: 'step', title: '+1', onclick: () => this.stepCustom(1) }, '+')
        )
      );
    } else {
      this.chips.replaceChildren(
        ...this.presets[this.mode].map((mins) => h('button', { class: 'chip' + (mins === minutes ? ' on' : ''), dir: 'ltr', onclick: () => this.setMinutes(mins) }, `${num(mins)} ${t('min')}`))
      );
    }
    this.paintTime();
  },

  // Show the compact timer while one is running, or paused part-way through.
  priority() {
    if (this.isStopwatch()) return this.running || this.elapsedBefore > 0 ? 30 : 0;
    return this.running || this.remaining < this.total ? 30 : 0;
  },

  view(mode) {
    if (mode === 'compact') return this.priority() ? { el: this.compact, w: 112, h: 32 } : null;
    if (mode === 'peek') return { el: this.peekEl, w: 400, h: 68, radius: 24 };
    if (mode === 'expanded') return { el: this.expandedEl, w: 440, auto: true };
    return null;
  },
});

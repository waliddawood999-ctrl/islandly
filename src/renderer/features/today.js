// Today: Gregorian + Hijri date, prayer times with countdown and adhan alerts, current weather.
Island.register({
  id: 'today',
  icon: null,
  sched: null,
  weather: null,
  alerted: new Set(),
  timer: 0,
  lastPriority: 0,

  init() {
    this.date = h('div', { class: 'td-date' });
    this.hijri = h('div', { class: 'm-artist' });
    this.wxIcon = h('span', { class: 'wx-icon' });
    this.wxTemp = h('span', { class: 'wx-temp', dir: 'ltr' });
    this.wxDesc = h('div', { class: 'm-artist' });
    this.wx = h('div', { class: 'wx' }, h('div', { class: 'wx-row' }, this.wxIcon, this.wxTemp), this.wxDesc);
    this.nextName = h('div', { class: 'np-name' });
    this.nextIn = h('div', { class: 'np-in', dir: 'ltr' });
    this.nextAt = h('div', { class: 'm-artist' });
    this.next = h('div', { class: 'np' }, h('div', {}, this.nextName, this.nextAt), this.nextIn);
    this.row = h('div', { class: 'pr-row stagger' });
    this.place = h('div', { class: 'td-place' });
    this.expandedEl = h(
      'div',
      { class: 'view auto panel today' },
      h('div', { class: 'td-head' }, h('div', {}, this.date, this.hijri), this.wx),
      this.next,
      this.row,
      this.place
    );

    this.cName = h('span', { class: 'c-title' });
    this.cIn = h('span', { class: 'tm', dir: 'ltr' });
    this.compact = h('div', { class: 'view prayer-compact' }, html(ICONS.moon), this.cName, this.cIn);

    this.pTitle = h('div', { class: 'm-title' });
    this.pSub = h('div', { class: 'm-artist' });
    this.peekEl = h(
      'div',
      { class: 'view notice-view' },
      h('span', { class: 'n-icon gold' }, html(ICONS.moon)),
      h('div', { class: 'm-text' }, this.pTitle, this.pSub)
    );

    API.on('today:update', (d) => this.set(d));
    API.call('today:get').then((d) => d && this.set(d));
    this.loop();
  },

  set(d) {
    this.sched = d.prayer;
    this.weather = d.weather;
    this.paint();
    Island.render();
  },

  // One tick per second while the panel or the countdown pill is visible, otherwise every 20 s.
  loop() {
    clearTimeout(this.timer);
    this.tick();
    const fast = Island.isExpanded() || this.priority() > 0;
    this.timer = setTimeout(() => this.loop(), fast ? 1000 : 20000);
  },

  sync() {
    if (Island.isExpanded()) this.loop();
  },

  prayers() {
    if (!this.sched) return [];
    return [...this.sched.today, ...this.sched.tomorrow].filter((p) => p.name !== 'sunrise');
  },

  upcoming() {
    const now = Date.now();
    return this.prayers().find((p) => p.time > now) || null;
  },

  fmtLeft(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    const hh = Math.floor(s / 3600);
    const mm = Math.floor((s % 3600) / 60);
    const ss = s % 60;
    return hh ? `${hh}:${pad2(mm)}:${pad2(ss)}` : `${mm}:${pad2(ss)}`;
  },

  fmtTime(ms) {
    return new Date(ms).toLocaleTimeString(LANG === 'ar' ? 'ar-SA' : 'en', {
      hour: 'numeric',
      minute: '2-digit',
    });
  },

  tick() {
    const next = this.upcoming();
    const now = Date.now();
    if (next) {
      const left = next.time - now;
      this.nextName.textContent = t('p_' + next.name);
      this.nextAt.textContent = this.fmtTime(next.time);
      this.nextIn.textContent = this.fmtLeft(left);
      this.cName.textContent = t('p_' + next.name);
      this.cIn.textContent = this.fmtLeft(left);
      if (API.settings.prayerAlerts !== false) {
        const soon = next.name + next.time + ':soon';
        if (left <= 10 * 60000 && left > 9 * 60000 && !this.alerted.has(soon)) {
          this.alerted.add(soon);
          this.pTitle.textContent = t('prayerSoon', { p: t('p_' + next.name) });
          this.pSub.textContent = this.fmtTime(next.time);
          Island.peek('today', 8000);
        }
      }
    }
    // the moment of adhan: the prayer that started within the last minute
    if (API.settings.prayerAlerts !== false) {
      const started = this.prayers().find((p) => now >= p.time && now - p.time < 60000);
      const key = started && started.name + started.time + ':now';
      if (started && !this.alerted.has(key)) {
        this.alerted.add(key);
        this.pTitle.textContent = t('prayerNow', { p: t('p_' + started.name) });
        this.pSub.textContent = this.sched.location || '';
        Island.peek('today', 15000);
        API.send('activity:notify', {
          source: 'prayer',
          title: t('prayerNow', { p: t('p_' + started.name) }),
          important: true,
        });
        const timer = Island.feature('timer');
        if (API.settings.pauseForPrayer && timer && timer.running) timer.pause();
        beep();
      }
    }
    if (Island.isExpanded()) this.paintRow();
    const p = this.priority();
    if (p !== this.lastPriority) {
      this.lastPriority = p;
      Island.render();
    }
  },

  wxText(code) {
    if (code === 0) return ['clear', '☀️', '🌙'];
    if (code <= 2) return ['partly', '⛅', '☁️'];
    if (code === 3) return ['cloudy', '☁️', '☁️'];
    if (code === 45 || code === 48) return ['fog', '🌫️', '🌫️'];
    if (code >= 51 && code <= 67) return ['rain', '🌧️', '🌧️'];
    if (code >= 71 && code <= 77) return ['snow', '❄️', '❄️'];
    if (code >= 80 && code <= 82) return ['showers', '🌦️', '🌧️'];
    if (code >= 95) return ['storm', '⛈️', '⛈️'];
    return ['cloudy', '☁️', '☁️'];
  },

  paint() {
    const now = new Date();
    const loc = LANG === 'ar' ? 'ar-SA' : 'en';
    this.date.textContent = now.toLocaleDateString(LANG === 'ar' ? 'ar' : 'en', { weekday: 'long', day: 'numeric', month: 'long' });
    try {
      this.hijri.textContent = new Intl.DateTimeFormat(loc + '-u-ca-islamic-umalqura', { day: 'numeric', month: 'long', year: 'numeric' }).format(now);
    } catch (_) {
      this.hijri.textContent = '';
    }
    const w = this.weather;
    this.wx.style.display = w ? '' : 'none';
    if (w) {
      const [key, dayIcon, nightIcon] = this.wxText(w.code);
      this.wxIcon.textContent = w.day ? dayIcon : nightIcon;
      this.wxTemp.textContent = w.temp + '°';
      this.wxDesc.textContent = `${t('wx_' + key)} · ${w.max}° / ${w.min}°`;
    }
    this.place.textContent = this.sched && this.sched.location ? this.sched.location : '';
    this.paintRow();
    this.tick();
  },

  paintRow() {
    const next = this.upcoming();
    const today = this.sched ? this.sched.today.filter((p) => p.name !== 'sunrise') : [];
    this.row.replaceChildren(
      ...today.map((p) =>
        h(
          'div',
          {
            class: 'pr' + (next && next.time === p.time ? ' on' : '') + (p.time < Date.now() ? ' past' : ''),
          },
          h('small', {}, t('p_' + p.name)),
          h('b', {}, this.fmtTime(p.time))
        )
      )
    );
  },

  // The countdown pill shows during the 15 minutes before a prayer.
  priority() {
    const next = this.upcoming();
    return next ? (next.time - Date.now() <= 15 * 60000 ? 35 : API.settings.prayerAlways ? 5 : 0) : 0;
  },

  view(mode) {
    if (mode === 'compact') return this.priority() ? { el: this.compact, w: 210, h: 42 } : null;
    if (mode === 'peek') return { el: this.peekEl, w: 360, h: 72 };
    if (mode === 'expanded') return this.sched ? { el: this.expandedEl, w: 470, auto: true } : null;
    return null;
  },
});

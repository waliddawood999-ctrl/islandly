// Live prayer activity (T12), driven by the T10 contract: `prayer:get` / `prayer:state`
//   { next, current, phase: 'idle'|'pre'|'adhan'|'iqama', phaseEndsAt, ramadan, imsak, iftar, pausedByAdhan }
// Main pushes a new state only at phase boundaries; the countdown is computed here and ticks once a second
// only while this activity is on screen. Nothing runs while the island shows something else.
// Hijri occasion of the day (T10 `hijri:get` → { day, month, year, monthNameAr, monthNameEn, occasion: { id, ar, en } | null }).
// Asked for when a panel that shows it is painted, kept for ten minutes; never polled.
const HijriInfo = {
  value: null,
  at: 0,
  async get() {
    if (this.value && Date.now() - this.at < 600000) return this.value;
    try {
      this.value = await API.call('hijri:get');
      this.at = Date.now();
    } catch (_) {
      this.value = null;
    }
    return this.value;
  },
  occasion(v) {
    const o = v && v.occasion;
    return o && API.settings.hijriOccasions !== false ? (I18N.lang === 'ar' ? o.ar : o.en) : '';
  },
  /** Fill a chip element with today's occasion (hidden when there is none). */
  async paint(el) {
    const text = this.occasion(await this.get());
    el.textContent = text;
    el.style.display = text ? '' : 'none';
  },
};

Island.register({
  id: 'prayer',
  icon: null,
  state: null,
  ticker: 0,
  lastPhase: 'idle',
  lastPausedAt: null,

  init() {
    // compact: [halo dot] name  countdown
    this.cDot = h('i', { class: 'pa-dot' });
    this.cName = h('span', { class: 'c-title' });
    this.cTime = h('span', { class: 'tm', dir: 'ltr' });
    this.compact = h('div', { class: 'view prayer-activity' }, this.cDot, this.cName, this.cTime);

    // peek: adhan, or "we paused your music" with Resume
    this.pIcon = h('span', { class: 'n-icon gold' }, html(ICONS.moon));
    this.pTitle = h('div', { class: 'm-title' });
    this.pSub = h('div', { class: 'm-artist' });
    this.pResume = h('button', { class: 'pill primary sm', 'data-interactive': '1', onclick: () => this.resume() }, T('resumeMusic'));
    this.peekEl = h('div', { class: 'view notice-view prayer-peek' }, this.pIcon, h('div', { class: 'm-text' }, this.pTitle, this.pSub), this.pResume);

    API.on('prayer:state', (s) => this.set(s));
    API.call('prayer:get')
      .then((s) => s && this.set(s))
      .catch(() => {}); // backend without T10: the activity stays off
  },

  enabled() {
    return API.settings.prayerActivity !== false && !!this.state;
  },

  /** Ramadan, the last hour before iftar: a countdown in the resting island. */
  iftarSoon() {
    const s = this.state;
    if (!s || !s.ramadan || !s.iftar) return false;
    const left = s.iftar - Date.now();
    return left > 0 && left <= 3600000;
  },

  live() {
    return this.enabled() && (this.state.phase !== 'idle' || this.state.pausedByAdhan || this.iftarSoon());
  },

  // stays visible whatever the auto-hide setting while something is happening
  get sticky() {
    return this.live();
  },

  set(s) {
    const was = this.state;
    this.state = s;
    // the last hour before iftar is not a backend boundary: one timer to show its countdown, not a poll
    clearTimeout(this.iftarTimer);
    const opensIn = s && s.ramadan && s.iftar ? s.iftar - 3600000 - Date.now() : -1;
    if (opensIn > 0 && opensIn < 86400000) this.iftarTimer = setTimeout(() => (this.paint(), Island.render()), opensIn + 50);
    // entering adhan: a calm heads-up; the music was paused: offer Resume
    if (this.enabled() && s.phase === 'adhan' && (!was || was.phase !== 'adhan' || (was.current || {}).time !== (s.current || {}).time)) {
      this.paintPeek();
      Island.peek('prayer', 12000);
    } else if (this.enabled() && s.pausedByAdhan && !(was && was.pausedByAdhan)) {
      this.paintPeek();
      Island.peek('prayer', 15000);
    }
    // a heads-up that no longer applies (adhan over, music resumed) leaves at once
    if (!(s.phase === 'adhan' || s.pausedByAdhan) && Island.currentKey && Island.currentKey() === 'p:prayer') Island.peek('prayer', 0);
    this.paint();
    const today = Island.feature('today');
    if (today && today.paintRamadan) today.paintRamadan();
    Island.render();
  },

  async resume() {
    try {
      await API.call('media:resume');
    } catch (_) {
      /* the next prayer:state reports what actually happened */
    }
  },

  name(p) {
    return p ? t('p_' + p.name) : '';
  },

  left(until) {
    const s = Math.max(0, Math.ceil((until - Date.now()) / 1000));
    const hh = Math.floor(s / 3600);
    const mm = Math.floor((s % 3600) / 60);
    return I18N.digits(hh ? `${hh}:${pad2(mm)}:${pad2(s % 60)}` : `${mm}:${pad2(s % 60)}`);
  },

  paint() {
    const s = this.state;
    if (!s) return;
    const phase = s.phase;
    this.compact.dataset.phase = phase === 'idle' && this.iftarSoon() ? 'iftar' : phase;
    if (phase === 'pre') {
      this.cName.textContent = this.name(s.next);
      this.cTime.textContent = this.left(s.phaseEndsAt || s.next.time);
    } else if (phase === 'adhan') {
      this.cName.textContent = t('adhanNow', { p: this.name(s.current) });
      this.cTime.textContent = '';
    } else if (phase === 'iqama') {
      this.cName.textContent = t('iqamaIn');
      this.cTime.textContent = this.left(s.phaseEndsAt);
    } else if (this.iftarSoon()) {
      this.cName.textContent = t('iftarIn');
      this.cTime.textContent = this.left(s.iftar);
    }
    if (Island.currentKey && /:prayer$/.test(Island.currentKey() || '')) this.paintPeek();
  },

  paintPeek() {
    const s = this.state;
    if (!s) return;
    const paused = s.pausedByAdhan;
    this.pTitle.textContent = paused ? t('pausedForAdhan') : t('adhanNow', { p: this.name(s.current) });
    this.pSub.textContent = paused ? this.name(s.current) : s.phase === 'iqama' ? t('iqamaInTime', { time: this.left(s.phaseEndsAt) }) : '';
    this.pResume.style.display = paused ? '' : 'none';
  },

  relang() {
    this.paint();
    this.paintPeek();
  },

  // One tick per second, only while the activity is the view on screen.
  sync() {
    const onScreen = !!(Island.currentKey && /:prayer$/.test(Island.currentKey() || ''));
    if (onScreen && !this.ticker) {
      this.ticker = setInterval(() => {
        this.paint();
        // the last-hour iftar window opens and closes on its own, without a backend push
        if (!this.live()) Island.render();
      }, 1000);
    } else if (!onScreen && this.ticker) {
      clearInterval(this.ticker);
      this.ticker = 0;
    }
  },

  priority() {
    if (!this.live()) return 0;
    const phase = this.state.phase;
    // above meetings (40) and the Today countdown; the microphone indicator (90) still wins
    return phase === 'adhan' ? 80 : phase === 'iqama' || this.state.pausedByAdhan ? 50 : phase === 'pre' ? 45 : 30;
  },

  view(mode) {
    if (!this.enabled()) return null;
    if (mode === 'compact') {
      if (!this.live()) return null;
      const phase = this.compact.dataset.phase;
      return { el: this.compact, w: phase === 'adhan' ? 230 : 200, h: 32 };
    }
    if (mode === 'peek') return { el: this.peekEl, w: this.state.pausedByAdhan ? 400 : 340, h: 72 };
    return null;
  },
});

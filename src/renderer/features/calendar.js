// Upcoming meetings from a calendar feed (iCal link set in Settings), with a one-click Join button.
Island.register({
  id: 'calendar',
  icon: ICONS.calendar,
  events: [],
  status: 'off',
  peeked: new Set(),
  lastPriority: 0,

  init() {
    // compact: [dot] title  in 5 min
    this.cTitle = h('span', { class: 'c-title' });
    this.cWhen = h('span', { class: 'tm small' });
    this.cDot = h('i', { class: 'cal-dot' });
    this.compact = h('div', { class: 'view calendar-compact' }, this.cDot, this.cTitle, this.cWhen);

    // peek: title, when, join
    this.pTitle = h('div', { class: 'm-title' });
    this.pSub = h('div', { class: 'm-artist' });
    this.pJoin = h('button', { class: 'pill primary sm', onclick: () => this.joinNext() }, t('join'));
    this.peekEl = h('div', { class: 'view calendar-peek' }, h('span', { class: 'n-icon' }, html(ICONS.calendar)), h('div', { class: 'm-text' }, this.pTitle, this.pSub), this.pJoin);

    // expanded
    this.rows = h('div', { class: 'cal-list' });
    this.empty = h('div', { class: 'p-empty' }, h('div', { class: 'm-title lg' }), h('div', { class: 'm-artist' }), h('button', { class: 'chip', onclick: () => API.send('settings:open') }, t('openSettings')));
    this.expandedEl = h('div', { class: 'view auto panel' }, h('div', { class: 'p-head' }, h('div', { class: 'p-title' }, t('calendar'))), this.rows, this.empty);

    API.on('calendar:update', (s) => this.set(s));
    API.call('calendar:get').then((s) => s && this.set(s));
    setInterval(() => this.tick(), 15000);
    this.paint();
  },

  set(state) {
    this.status = state.status;
    this.events = state.events || [];
    this.paint();
    this.tick();
  },

  upcoming() {
    const now = Date.now();
    return this.events.filter((e) => e.end > now);
  },

  next() {
    return this.upcoming()[0] || null;
  },

  joinNext() {
    const e = this.next();
    if (e && e.url) API.send('open:external', e.url);
  },

  minutesTo(e) {
    return Math.ceil((e.start - Date.now()) / 60000);
  },

  tick() {
    const e = this.next();
    if (e) {
      const mins = this.minutesTo(e);
      const when = mins > 0 ? t('inMin', { n: num(mins) }) : t('nowLabel');
      this.cTitle.textContent = e.title;
      this.cWhen.textContent = when;
      this.cDot.classList.toggle('soon', mins <= 5);
      this.pTitle.textContent = e.title;
      this.pSub.textContent = mins > 0 ? t('startsIn', { n: num(mins) }) : t('nowLabel');
      this.pJoin.style.display = e.url ? '' : 'none';
      // One heads-up five minutes before, one when it starts.
      const stage = mins <= 0 ? 'now' : mins <= 5 ? 'soon' : null;
      const key = stage && e.id + ':' + stage;
      if (key && !this.peeked.has(key)) {
        this.peeked.add(key);
        Island.peek('calendar', 9000);
      }
    }
    const p = this.priority();
    if (p !== this.lastPriority) {
      this.lastPriority = p;
      Island.render();
    }
    this.paintRows();
  },

  dayLabel(e) {
    const d = new Date(e.start);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return t('today');
    const tomorrow = new Date(today.getTime() + 86400000);
    if (d.toDateString() === tomorrow.toDateString()) return t('tomorrow');
    return d.toLocaleDateString(LANG === 'ar' ? 'ar' : 'en', { weekday: 'short' });
  },

  paint() {
    const upcoming = this.upcoming();
    const state = this.status === 'off' ? 'calOff' : this.status === 'error' ? 'calError' : upcoming.length ? '' : 'calNone';
    this.empty.style.display = state ? '' : 'none';
    this.rows.style.display = state ? 'none' : '';
    if (state) {
      this.empty.children[0].textContent = t(state);
      this.empty.children[1].textContent = state === 'calOff' ? t('calOffSub') : '';
      this.empty.children[2].style.display = state === 'calOff' ? '' : 'none';
    }
    this.paintRows();
  },

  paintRows() {
    const upcoming = this.upcoming().slice(0, 3);
    this.rows.replaceChildren(
      ...upcoming.map((e) => {
        const time = new Date(e.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
        return h(
          'div',
          { class: 'cal-row' },
          h('div', { class: 'cal-time' }, h('b', { dir: 'ltr' }, time), h('small', {}, this.dayLabel(e))),
          h('div', { class: 'cal-title', dir: 'auto' }, e.title),
          e.url ? h('button', { class: 'pill primary sm', 'data-interactive': '1', onclick: (ev) => { ev.stopPropagation(); API.send('open:external', e.url); } }, t('join')) : null
        );
      })
    );
  },

  // Takes the resting pill when a meeting is about to start or just started.
  priority() {
    const e = this.next();
    if (!e) return 0;
    const ms = e.start - Date.now();
    return ms <= 10 * 60000 && ms > -5 * 60000 ? 40 : 0;
  },

  view(mode) {
    if (mode === 'compact') return this.priority() ? { el: this.compact, w: 270, h: 42 } : null;
    if (mode === 'peek') return this.next() ? { el: this.peekEl, w: 420, h: 84 } : null;
    if (mode === 'expanded') {
      return { el: this.expandedEl, w: 480, auto: true };
    }
    return null;
  },
});

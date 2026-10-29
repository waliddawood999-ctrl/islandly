// Mini Quran player (T12), on the T10 contract:
//   quran:reciters → [{ id, nameAr, nameEn, moshaf: [{ id, name, server, surahList }] }]   (network, cached by main)
//   quran:url(reciterId, moshafId, sura) → 'https://….mp3quran.net/…/001.mp3'
// Nothing is requested until the panel is opened, and the <audio> element exists only while Quran plays.
Island.register({
  id: 'quran',
  icon: ICONS.book,
  reciters: null,
  loading: false,
  error: '',
  audio: null,
  playing: false,
  list: '', // '' | 'reciters' | 'surahs'
  pick: null, // { reciter, moshaf, sura }

  init() {
    this.title = h('div', { class: 'm-title lg' });
    this.sub = h('button', { class: 'q-reciter', 'data-interactive': '1', onclick: () => this.toggleList('reciters') });
    this.fill = h('i');
    this.bar = h('div', { class: 'bar thin q-bar', dir: 'ltr' }, this.fill);
    this.pos = h('span', { dir: 'ltr' }, clock(0));
    this.dur = h('span', { dir: 'ltr' }, clock(0));
    const ctl = (icon, key, fn, extra = '') =>
      I18N.mark(h('button', { class: ('ctl ' + extra).trim(), 'data-interactive': '1', onclick: fn }, html(icon)), key, null, 'title');
    this.playBtn = ctl(ICONS.play, 'quranPlay', () => this.toggle(), 'main');
    this.stopBtn = I18N.mark(h('button', { class: 'chip', 'data-interactive': '1', onclick: () => this.stop() }), 'quranStop');
    // like the music player: the transport keeps its left-to-right order in Arabic too
    this.ctls = h(
      'div',
      { class: 'ctls', dir: 'ltr' },
      ctl(ICONS.prev, 'quranPrev', () => this.step(-1)),
      this.playBtn,
      ctl(ICONS.next, 'quranNext', () => this.step(1))
    );
    this.status = h('div', { class: 'm-artist q-status' });
    this.listEl = h('div', { class: 'q-list scroll' });
    this.head = h(
      'div',
      { class: 'm-head' },
      h('div', { class: 'art q-art' }, html(ICONS.book)),
      h('div', { class: 'm-text' }, h('button', { class: 'q-surah', 'data-interactive': '1', onclick: () => this.toggleList('surahs') }, this.title), this.sub)
    );
    this.expandedEl = h(
      'div',
      { class: 'view auto music-expanded quran' },
      h('div', { class: 'p-head' }, h('div', { class: 'p-title' }, T('quran')), this.stopBtn),
      this.head,
      this.bar,
      h('div', { class: 'times' }, this.pos, this.dur),
      this.ctls,
      this.status,
      this.listEl
    );

    // compact while reciting: [book] surah name
    this.cName = h('span', { class: 'c-title' });
    this.compact = h('div', { class: 'view quran-compact' }, h('span', { class: 'q-dot' }, html(ICONS.book)), this.cName);

    this.pick = this.saved();
    this.paint();
  },

  enabled() {
    return API.settings.quranEnabled !== false;
  },

  // the reciter/moshaf from settings (contract keys) if set, else the last choice on this PC
  saved() {
    let local = {};
    try {
      local = JSON.parse(localStorage.getItem('islandly.quran') || '{}');
    } catch (_) {
      /* storage can be unavailable */
    }
    return {
      reciter: API.settings.quranReciter || local.reciter || null,
      moshaf: API.settings.quranMoshaf || local.moshaf || null,
      sura: Number.isInteger(local.sura) ? local.sura : 1,
    };
  },

  remember() {
    try {
      localStorage.setItem('islandly.quran', JSON.stringify(this.pick));
    } catch (_) {
      /* a convenience only */
    }
  },

  reciter() {
    return (this.reciters || []).find((r) => r.id === this.pick.reciter) || null;
  },

  moshaf() {
    const r = this.reciter();
    return r ? r.moshaf.find((m) => m.id === this.pick.moshaf) || r.moshaf[0] : null;
  },

  reciterName(r) {
    return r ? (I18N.lang === 'ar' ? r.nameAr || r.nameEn : r.nameEn || r.nameAr) : '';
  },

  async load() {
    if (this.reciters || this.loading) return;
    this.loading = true;
    this.error = '';
    this.paint();
    try {
      const rows = await API.call('quran:reciters');
      this.reciters = Array.isArray(rows) ? rows : [];
      if (!this.reciter() && this.reciters.length) {
        this.pick.reciter = this.reciters[0].id;
        this.pick.moshaf = this.reciters[0].moshaf[0].id;
      }
    } catch (_) {
      this.error = 'quranOffline';
    }
    this.loading = false;
    this.paint();
    Island.render();
  },

  async toggle() {
    if (this.audio && this.playing) return this.audio.pause();
    if (this.audio) return this.audio.play().catch(() => {});
    await this.start();
  },

  async start() {
    await this.load();
    const r = this.reciter();
    const m = this.moshaf();
    if (!r || !m) return;
    if (!m.surahList.includes(this.pick.sura)) {
      this.error = 'quranUnavailable';
      return this.paint();
    }
    let url;
    try {
      url = await API.call('quran:url', r.id, m.id, this.pick.sura);
    } catch (_) {
      this.error = 'quranOffline';
      return this.paint();
    }
    this.error = '';
    this.stop(true);
    const a = new Audio();
    a.preload = 'none';
    a.volume = Math.max(0, Math.min(1, Number(API.settings.quranVolume ?? 0.8)));
    // events from an element that was already dropped are ignored
    const mine = (fn) => () => this.audio === a && fn();
    a.addEventListener(
      'play',
      mine(() => ((this.playing = true), this.paint(), Island.render()))
    );
    a.addEventListener(
      'pause',
      mine(() => ((this.playing = false), this.paint(), Island.render()))
    );
    a.addEventListener(
      'timeupdate',
      mine(() => this.progress())
    );
    a.addEventListener(
      'ended',
      mine(() => this.step(1))
    );
    a.addEventListener(
      'error',
      mine(() => ((this.error = 'quranOffline'), this.stop()))
    );
    a.src = url;
    this.audio = a;
    this.remember();
    a.play().catch(() => {});
  },

  /** Stop and drop the audio element (no stream, no decoder left behind). */
  stop(quiet) {
    const a = this.audio;
    this.audio = null;
    if (a) {
      a.pause();
      a.removeAttribute('src');
      a.load();
    }
    this.playing = false;
    if (!quiet) {
      this.paint();
      Island.render();
    }
  },

  step(delta) {
    const m = this.moshaf();
    const list = m ? m.surahList : [];
    let sura = this.pick.sura + delta;
    while (list.length && sura >= 1 && sura <= 114 && !list.includes(sura)) sura += delta;
    if (sura < 1 || sura > 114) return this.stop();
    this.pick.sura = sura;
    this.remember();
    if (this.audio) this.start();
    else this.paint();
  },

  choose(kind, value) {
    if (kind === 'reciters') {
      this.pick.reciter = value.id;
      this.pick.moshaf = value.moshaf[0].id;
    } else this.pick.sura = value;
    this.list = '';
    this.remember();
    if (this.audio) this.start();
    else this.paint();
    Island.render();
  },

  toggleList(kind) {
    this.list = this.list === kind ? '' : kind;
    if (this.list === 'reciters') this.load();
    this.paintList();
    Island.render();
  },

  progress() {
    const a = this.audio;
    if (!a) return;
    const d = isFinite(a.duration) ? a.duration : 0;
    this.fill.style.width = d ? (a.currentTime / d) * 100 + '%' : '0';
    this.pos.textContent = clock(a.currentTime);
    this.dur.textContent = clock(d);
  },

  paint() {
    const r = this.reciter();
    this.title.textContent = t('surah.' + this.pick.sura);
    this.cName.textContent = t('surah.' + this.pick.sura);
    this.sub.textContent = this.loading ? t('quranLoading') : r ? this.reciterName(r) : t('quranPickReciter');
    this.playBtn.replaceChildren(html(this.playing ? ICONS.pause : ICONS.play));
    this.stopBtn.style.display = this.audio ? '' : 'none';
    this.status.textContent = this.error ? t(this.error) : '';
    this.status.style.display = this.error ? '' : 'none';
    if (!this.audio) {
      this.fill.style.width = '0';
      this.pos.textContent = this.dur.textContent = clock(0);
    }
    this.paintList();
  },

  paintList() {
    this.listEl.style.display = this.list ? '' : 'none';
    if (!this.list) return this.listEl.replaceChildren();
    const row = (label, on, fn) => h('button', { class: 'q-row' + (on ? ' on' : ''), 'data-interactive': '1', dir: 'auto', onclick: fn }, label);
    if (this.list === 'reciters') {
      this.listEl.replaceChildren(...(this.reciters || []).map((r) => row(this.reciterName(r), r.id === this.pick.reciter, () => this.choose('reciters', r))));
    } else {
      const m = this.moshaf();
      const list = m ? m.surahList : Array.from({ length: 114 }, (_, i) => i + 1);
      this.listEl.replaceChildren(...list.map((n) => row(`${I18N.num(n)} · ${t('surah.' + n)}`, n === this.pick.sura, () => this.choose('surahs', n))));
    }
  },

  relang() {
    this.paint();
  },

  // The catalogue is asked for once per opening of the panel. A failure is not retried on every repaint
  // (that would loop: load → paint → render → sync → load); the next opening or a tap tries again.
  sync() {
    const open = this.enabled() && Island.isExpanded() && Island.selectedId() === 'quran';
    if (open && !this.opened) {
      this.opened = true;
      if (!this.reciters) this.load();
    } else if (!open) this.opened = false;
  },

  priority() {
    return this.playing ? 20 : 0;
  },

  view(mode) {
    if (!this.enabled()) return null;
    if (mode === 'compact') return this.playing ? { el: this.compact, w: 190, h: 32 } : null;
    if (mode === 'expanded') return { el: this.expandedEl, w: 440, auto: true };
    return null;
  },
});

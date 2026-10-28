Island.register({
  id: 'music',
  icon: ICONS.note,
  media: null,
  unavailable: false,
  progressTimer: 0,
  caps: { next: false, prev: false, seek: false, toggle: false },
  dragging: false,
  wasExpanded: false,

  init() {
    this.art = h('div', { class: 'art' });
    this.bg = h('div', { class: 'm-bg' });
    this.title = h('div', { class: 'm-title lg' });
    this.artist = h('div', { class: 'm-artist' });

    // compact: [art] title [equalizer]
    this.cArt = h('div', { class: 'art sm' });
    this.cTitle = h('span', { class: 'c-title' });
    this.eq = h('div', { class: 'eq' }, h('i'), h('i'), h('i'), h('i'));
    this.compact = h('div', { class: 'view music-compact' }, this.cArt, this.cTitle, this.eq);

    // peek: bigger art + title/artist, shown when the track changes
    this.pArt = h('div', { class: 'art md' });
    this.pTitle = h('div', { class: 'm-title' });
    this.pArtist = h('div', { class: 'm-artist' });
    this.peekEl = h('div', { class: 'view music-peek' }, this.pArt, h('div', { class: 'm-text' }, this.pTitle, this.pArtist));

    // expanded
    this.fill = h('i');
    this.knob = h('b');
    this.bubble = h('span', { class: 'bubble', dir: 'ltr' });
    this.bar = h('div', { class: 'bar', dir: 'ltr' }, this.fill, this.knob, this.bubble);
    this.posLabel = h('span', { dir: 'ltr' }, '0:00');
    this.durLabel = h('span', { dir: 'ltr' }, '0:00');
    this.prevBtn = this.button('prev', ICONS.prev, 'prev');
    this.backBtn = h('button', { class: 'ctl', onclick: () => this.skip(-10) }, html(ICONS.back10));
    this.playBtn = h('button', {
      class: 'ctl main',
      onclick: () => this.control('playpause'),
    });
    this.fwdBtn = h('button', { class: 'ctl', onclick: () => this.skip(10) }, html(ICONS.fwd10));
    this.nextBtn = this.button('next', ICONS.next, 'next');
    this.ctls = h('div', { class: 'ctls stagger', dir: 'ltr' }, this.prevBtn, this.backBtn, this.playBtn, this.fwdBtn, this.nextBtn);
    this.empty = h('div', { class: 'm-empty' }, h('div', { class: 'm-title lg' }, t('nothingPlaying')), h('div', { class: 'm-artist' }, t('openPlayer')));
    this.body = h('div', { class: 'm-body' }, this.title, this.artist, this.bar, h('div', { class: 'times' }, this.posLabel, this.durLabel), this.ctls);
    this.expandedEl = h('div', { class: 'view auto music-expanded' }, this.bg, this.art, this.body, this.empty);

    this.source = h('select', { class: 'chip', 'data-interactive': '1' });
    this.source.addEventListener('change', () => API.send('media:select', this.source.value));
    this.body.prepend(this.source);
    this.lyrics = h('div', { class: 'lyrics scroll', dir: 'auto' });
    this.body.append(this.lyrics);
    API.on('lyrics:update', (d) => {
      this.lyricData = d;
      this.paintLyrics();
      Island.render();
    });
    this.bindSeekBar();
    API.on('media:update', (m) => this.onUpdate(m));
    this.paint();
  },

  button(cls, icon, action) {
    return h('button', { class: 'ctl', onclick: () => this.control(action) }, html(icon));
  },

  async control(action) {
    const m = this.media;
    if (!m) return;
    const result = await API.call('media:control', action, undefined, m.app).catch(() => ({ ok: false }));
    if (!result?.ok)
      Notice.show({
        text: LANG === 'ar' ? 'تعذر التحكم في جلسة الوسائط' : 'Media command failed',
      });
  },

  seekTo(seconds) {
    const m = this.media;
    if (!m || !m.duration) return;
    const s = Math.max(0, Math.min(m.duration, seconds));
    m.position = s;
    m.sentAt = Date.now();
    m.updatedAt = 0;
    API.call('media:control', 'seek', s, m.app)
      .then((r) => {
        if (!r?.ok)
          Notice.show({
            text: LANG === 'ar' ? 'تعذر الانتقال في المقطع' : 'Seek failed',
          });
      })
      .catch(() => {});
    this.updateProgress();
  },

  skip(delta) {
    this.seekTo(this.position() + delta);
  },

  bindSeekBar() {
    const frac = (e) => {
      const r = this.bar.getBoundingClientRect();
      return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    };
    const preview = (e) => {
      const m = this.media;
      if (!m || !m.duration) return;
      const f = frac(e);
      this.fill.style.width = f * 100 + '%';
      this.bubble.textContent = clock(f * m.duration);
      this.bubble.style.left = f * 100 + '%';
    };
    this.bar.addEventListener('pointerdown', (e) => {
      if (!this.media || !this.media.duration || !this.caps.seek) return;
      this.dragging = true;
      this.bar.classList.add('drag');
      this.bar.setPointerCapture(e.pointerId);
      preview(e);
    });
    this.bar.addEventListener('pointermove', (e) => {
      if (this.dragging) preview(e);
      else if (this.media && this.media.duration) {
        const f = frac(e);
        this.bubble.textContent = clock(f * this.media.duration);
        this.bubble.style.left = f * 100 + '%';
      }
    });
    const finish = (e) => {
      if (!this.dragging) return;
      this.dragging = false;
      this.bar.classList.remove('drag');
      this.seekTo(frac(e) * this.media.duration);
    };
    this.bar.addEventListener('pointerup', finish);
    this.bar.addEventListener('pointercancel', () => {
      this.dragging = false;
      this.bar.classList.remove('drag');
    });
  },

  onUpdate(m) {
    if (m.type === 'unavailable') {
      this.unavailable = true;
      this.media = null;
    } else if (m.active) {
      const trackChanged = m.trackChanged || !this.media || this.media.title !== m.title;
      if (m.sessions) {
        const previous = this.source.value;
        this.source.replaceChildren(
          h('option', { value: '' }, LANG === 'ar' ? 'اختيار تلقائي' : 'Automatic'),
          ...m.sessions.map((s) => h('option', { value: s.app }, s.app))
        );
        this.source.value = previous;
      }
      this.media = {
        ...m,
        thumb: m.thumb === undefined && !trackChanged ? this.media.thumb : m.thumb,
      };
      if (trackChanged) {
        this.refreshCaps();
        if (m.playing && m.title) Island.peek('music', 4000);
      }
    } else {
      this.media = null;
    }
    this.paint();
    Island.render();
  },

  async refreshCaps() {
    try {
      const source = this.media && this.media.app;
      const c = await API.call('media:caps');
      if (source !== (this.media && this.media.app)) return;
      if (c && c.ok) {
        this.caps = {
          next: !!c.next,
          prev: !!c.prev,
          seek: !!c.seek,
          toggle: c.toggle !== false,
        };
        this.applyCaps();
      }
    } catch (_) {
      /* keep the defaults */
    }
  },

  applyCaps() {
    this.playBtn.disabled = !this.caps.toggle;
    this.prevBtn.disabled = !this.caps.prev;
    this.nextBtn.disabled = !this.caps.next;
    this.backBtn.disabled = this.fwdBtn.disabled = !this.caps.seek;
    this.bar.classList.toggle('locked', !this.caps.seek);
  },

  setArt(el, thumb) {
    el.style.backgroundImage = thumb ? `url("${thumb}")` : '';
    el.classList.toggle('empty', !thumb);
  },

  /** Moment the reported position was true: Windows' own timestamp when it is plausible, else when it arrived. */
  anchor() {
    const m = this.media;
    const u = m.updatedAt;
    const plausible = u && u <= m.sentAt + 2000 && m.sentAt - u < Math.max(0, (m.duration - m.position) * 1000);
    return plausible ? u : m.sentAt;
  },

  position() {
    const m = this.media;
    if (!m) return 0;
    const elapsed = m.playing ? Math.max(0, (Date.now() - this.anchor()) / 1000) : 0;
    return Math.max(0, Math.min(m.duration || Infinity, m.position + elapsed));
  },

  paint() {
    const m = this.media;
    const has = !!m && !!m.title;
    this.body.style.display = has ? '' : 'none';
    this.empty.style.display = has ? 'none' : '';
    this.art.style.display = has ? '' : 'none';
    this.bg.style.display = has ? '' : 'none';
    if (!has) {
      this.empty.firstChild.textContent = this.unavailable ? t('mediaUnavailable') : t('nothingPlaying');
      return;
    }
    this.title.textContent = this.pTitle.textContent = m.title;
    this.artist.textContent = this.pArtist.textContent = m.artist;
    this.cTitle.textContent = m.title;
    if (m.thumb !== this.accentThumb) {
      this.accentThumb = m.thumb;
      if (m.thumb && API.settings.coverAccent) {
        const image = new Image();
        const key = m.thumb;
        image.onload = () => {
          if (this.accentThumb !== key) return;
          try {
            const canvas = document.createElement('canvas');
            canvas.width = canvas.height = 16;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(image, 0, 0, 16, 16);
            const p = ctx.getImageData(0, 0, 16, 16).data;
            let r = 0,
              g = 0,
              b = 0;
            for (let i = 0; i < p.length; i += 4) {
              r += p[i];
              g += p[i + 1];
              b += p[i + 2];
            }
            this.expandedEl.style.setProperty('--cover-accent', `rgb(${Math.round(r / 256)},${Math.round(g / 256)},${Math.round(b / 256)})`);
          } catch (_) {}
        };
        image.src = m.thumb;
      }
    }
    this.setArt(this.art, m.thumb);
    this.setArt(this.cArt, m.thumb);
    this.setArt(this.pArt, m.thumb);
    this.bg.style.backgroundImage = m.thumb ? `url("${m.thumb}")` : '';
    this.playBtn.replaceChildren(html(m.playing ? ICONS.pause : ICONS.play));
    this.eq.classList.toggle('on', m.playing);
    this.applyCaps();
    this.updateProgress();
    this.syncProgressTimer();
  },

  paintLyrics() {
    const d = this.lyricData;
    if (!d || d.status === 'off') {
      this.lyrics.hidden = true;
      return;
    }
    this.lyrics.hidden = false;
    if (d.lines.length) {
      let index = -1;
      const p = this.position();
      for (let i = 0; i < d.lines.length && d.lines[i].at <= p; i++) index = i;
      this.lyrics.textContent = d.lines
        .slice(Math.max(0, index), Math.max(0, index) + 3)
        .map((l) => l.text)
        .join('\n');
    } else this.lyrics.textContent = d.text || (LANG === 'ar' ? 'لا توجد كلمات متاحة' : 'Lyrics unavailable');
  },
  updateProgress() {
    const m = this.media;
    if (!m || this.dragging) return;
    this.paintLyrics();
    const pos = this.position();
    const f = m.duration ? pos / m.duration : 0;
    this.fill.style.width = f * 100 + '%';
    this.knob.style.left = f * 100 + '%';
    this.posLabel.textContent = clock(pos);
    this.durLabel.textContent = m.duration ? clock(m.duration) : '--:--';
  },

  sync() {
    const open = Island.isExpanded() && Island.selectedId() === 'music';
    if (open && !this.wasExpanded) this.refreshCaps();
    this.wasExpanded = open;
    this.syncProgressTimer();
  },

  // Only tick while the expanded panel is open and something is playing.
  syncProgressTimer() {
    const need = this.media && this.media.playing && Island.isExpanded() && Island.selectedId() === 'music';
    if (need && !this.progressTimer) this.progressTimer = setInterval(() => this.updateProgress(), 500);
    if (!need && this.progressTimer) {
      clearInterval(this.progressTimer);
      this.progressTimer = 0;
    }
  },

  priority() {
    return this.media && this.media.playing && this.media.title ? 20 : 0;
  },

  view(mode) {
    const has = this.media && this.media.title;
    if (mode === 'compact') return has ? { el: this.compact, w: 236, h: 42 } : null;
    if (mode === 'peek') return has ? { el: this.peekEl, w: 340, h: 80 } : null;
    if (mode === 'expanded') return { el: this.expandedEl, w: 470, auto: true };
    return null;
  },
});

// Music: what is playing in any app (Windows media session), in three sizes.
//   compact   round album art + live sound wave (resting pill)
//   peek      "mini player": round art, title/artist, wave, previous/play/next (shown when the track changes)
//   expanded  big player: square art, title/artist, a thin full-width progress bar, controls,
//             and a lyrics strip under the island when lyrics are available ('lyrics:update').
Island.register({
  id: 'music',
  icon: ICONS.music,
  media: null,
  unavailable: false,
  progressTimer: 0,
  caps: { next: true, prev: true, seek: true, toggle: true },
  dragging: false,
  wasExpanded: false,
  lyricData: null,
  lyricIndex: -2,

  init() {
    // ---- compact
    this.cArt = h('div', { class: 'art round xs' });
    this.cWave = this.wave('sm');
    this.compact = h('div', { class: 'view music-compact', dir: 'ltr' }, this.cArt, this.cWave);

    // ---- peek: mini player
    this.pArt = h('div', { class: 'art round md' });
    this.pTitle = h('div', { class: 'm-title', dir: 'auto' });
    this.pArtist = h('div', { class: 'm-artist', dir: 'auto' });
    this.pWave = this.wave('xs');
    this.pPrev = this.button(ICONS.prev, 'prev', 'mini');
    this.pPlay = this.button(ICONS.play, 'playpause', 'mini main');
    this.pNext = this.button(ICONS.next, 'next', 'mini');
    this.peekEl = h(
      'div',
      { class: 'view music-mini' },
      this.pArt,
      h('div', { class: 'm-text' }, h('div', { class: 'mini-top' }, this.pTitle, this.pWave), this.pArtist),
      h('div', { class: 'mini-ctls', dir: 'ltr' }, this.pPrev, this.pPlay, this.pNext)
    );

    // ---- expanded: big player
    this.art = h('div', { class: 'art square' });
    this.bg = h('div', { class: 'm-bg' });
    this.title = h('div', { class: 'm-title lg', dir: 'auto' });
    this.artist = h('div', { class: 'm-artist', dir: 'auto' });
    this.xWave = this.wave('xs');
    this.fill = h('i');
    this.knob = h('b');
    this.bubble = h('span', { class: 'bubble', dir: 'ltr' });
    this.bar = h('div', { class: 'bar thin', dir: 'ltr' }, this.fill, this.knob, this.bubble);
    this.posLabel = h('span', { dir: 'ltr' }, clock(0));
    this.durLabel = h('span', { dir: 'ltr' }, clock(0));
    this.prevBtn = this.button(ICONS.prev, 'prev');
    this.backBtn = I18N.mark(h('button', { class: 'ctl', onclick: () => this.skip(-10) }, html(ICONS.back10)), 'back10', { n: 10 }, 'title');
    this.playBtn = this.button(ICONS.play, 'playpause', 'main');
    this.fwdBtn = I18N.mark(h('button', { class: 'ctl', onclick: () => this.skip(10) }, html(ICONS.fwd10)), 'fwd10', { n: 10 }, 'title');
    this.nextBtn = this.button(ICONS.next, 'next');
    this.ctls = h('div', { class: 'ctls stagger', dir: 'ltr' }, this.prevBtn, this.backBtn, this.playBtn, this.fwdBtn, this.nextBtn);
    this.empty = h('div', { class: 'm-empty' }, h('div', { class: 'm-title lg' }, t('nothingPlaying')), h('div', { class: 'm-artist' }, T('openPlayer')));
    this.head = h('div', { class: 'm-head' }, this.art, h('div', { class: 'm-text' }, h('div', { class: 'mini-top' }, this.title, this.xWave), this.artist));
    this.body = h('div', { class: 'm-body' }, this.head, this.bar, h('div', { class: 'times' }, this.posLabel, this.durLabel), this.ctls);
    this.expandedEl = h('div', { class: 'view auto music-expanded' }, this.bg, this.body, this.empty);

    // ---- lyrics strip (under the island)
    this.lyNow = h('div', { class: 'ly-now', dir: 'auto' });
    this.lyNext = h('div', { class: 'ly-next', dir: 'auto' });
    this.lyricsEl = h('div', { class: 'lyrics-strip' }, this.lyNow, this.lyNext);

    this.bindSeekBar();
    API.on('media:update', (m) => this.onUpdate(m));
    API.on('lyrics:update', (d) => {
      this.lyricData = d && Array.isArray(d.lines) ? d : null;
      this.lyricIndex = -2;
      this.paintLyrics();
      Island.render();
    });
    this.paint();
  },

  /** Animated sound wave: bars that rise and fall smoothly (CSS transforms only, paused when nothing plays). */
  wave(size) {
    return h('div', { class: 'wave ' + size, 'aria-hidden': 'true' }, h('i'), h('i'), h('i'), h('i'), h('i'));
  },

  button(icon, action, extra = '') {
    const label = { prev: 'prev', next: 'next', playpause: 'playPause' }[action];
    return I18N.mark(h('button', { class: ('ctl ' + extra).trim(), onclick: () => this.control(action) }, html(icon)), label, null, 'title');
  },

  control(action) {
    API.send('media:control', action);
    // The real state arrives through the media session a moment later.
    if (action === 'playpause' && this.media) {
      this.media.position = this.position();
      this.media.sentAt = Date.now();
      this.media.updatedAt = 0;
      this.media.playing = !this.media.playing;
      this.paint();
    }
  },

  seekTo(seconds) {
    const m = this.media;
    if (!m || !m.duration) return;
    const s = Math.max(0, Math.min(m.duration, seconds));
    m.position = s;
    m.sentAt = Date.now();
    m.updatedAt = 0;
    API.send('media:control', 'seek', s);
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
      this.media = m;
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
      const c = await API.call('media:caps');
      if (c && c.ok) {
        this.caps = { next: !!c.next, prev: !!c.prev, seek: !!c.seek, toggle: c.toggle !== false };
        this.applyCaps();
      }
    } catch (_) {
      /* keep the defaults */
    }
  },

  applyCaps() {
    this.prevBtn.disabled = this.pPrev.disabled = !this.caps.prev;
    this.nextBtn.disabled = this.pNext.disabled = !this.caps.next;
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
    this.bg.style.display = has ? '' : 'none';
    if (!has) {
      this.empty.firstChild.textContent = this.unavailable ? t('mediaUnavailable') : t('nothingPlaying');
      return;
    }
    this.title.textContent = this.pTitle.textContent = m.title;
    this.artist.textContent = this.pArtist.textContent = m.artist;
    for (const el of [this.art, this.cArt, this.pArt]) this.setArt(el, m.thumb);
    this.bg.style.backgroundImage = m.thumb ? `url("${m.thumb}")` : '';
    const icon = m.playing ? ICONS.pause : ICONS.play;
    this.playBtn.replaceChildren(html(icon));
    this.pPlay.replaceChildren(html(icon));
    for (const w of [this.cWave, this.pWave, this.xWave]) w.classList.toggle('on', m.playing);
    for (const a of [this.cArt, this.pArt]) a.classList.toggle('playing', m.playing);
    this.applyCaps();
    this.updateProgress();
    this.syncProgressTimer();
  },

  updateProgress() {
    const m = this.media;
    if (!m || this.dragging) return;
    const pos = this.position();
    const f = m.duration ? pos / m.duration : 0;
    this.fill.style.width = f * 100 + '%';
    this.knob.style.left = f * 100 + '%';
    this.posLabel.textContent = clock(pos);
    this.durLabel.textContent = m.duration ? clock(m.duration) : '--:--';
    this.paintLyrics();
  },

  hasLyrics() {
    const d = this.lyricData;
    return !!(d && this.media && this.media.title && (d.lines.length || (d.text && d.text.trim())));
  },

  // Current line (and the next one, faded) for timed lyrics; the first lines for plain text.
  paintLyrics() {
    if (!this.hasLyrics()) return;
    const d = this.lyricData;
    if (!d.lines.length) {
      if (this.lyricIndex === -1) return;
      this.lyricIndex = -1;
      const lines = d.text.split(/\r?\n/).filter((x) => x.trim());
      this.lyNow.textContent = lines[0] || '';
      this.lyNext.textContent = lines[1] || '';
      return;
    }
    const p = this.position();
    let i = -1;
    while (i + 1 < d.lines.length && d.lines[i + 1].at <= p) i++;
    if (i === this.lyricIndex) return;
    this.lyricIndex = i;
    this.lyNow.textContent = i >= 0 ? d.lines[i].text || '♪' : '♪';
    this.lyNext.textContent = d.lines[i + 1] ? d.lines[i + 1].text : '';
    if (window.Motion && !Island.debug().reducedMotion) Motion.animate(this.lyNow, { opacity: [0.3, 1], y: [6, 0] }, { duration: 0.28, ease: 'easeOut' });
  },

  sync() {
    const open = Island.isExpanded();
    if (open && !this.wasExpanded) this.refreshCaps();
    this.wasExpanded = open;
    this.syncProgressTimer();
  },

  // Only tick while the expanded panel is open and something is playing.
  syncProgressTimer() {
    const need = this.media && this.media.playing && Island.isExpanded();
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
    if (mode === 'compact') return has ? { el: this.compact, w: 128, h: 32 } : null;
    if (mode === 'peek') return has ? { el: this.peekEl, w: 400, h: 68, radius: 24 } : null;
    if (mode === 'expanded') return { el: this.expandedEl, w: 460, auto: true, below: this.hasLyrics() ? { el: this.lyricsEl, w: 460, h: 58 } : null };
    return null;
  },
});

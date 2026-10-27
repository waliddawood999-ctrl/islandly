Island.register({
  id: 'music',
  icon: ICONS.note,
  media: null,
  unavailable: false,
  progressTimer: 0,

  init() {
    this.art = h('div', { class: 'art' });
    this.title = h('div', { class: 'm-title' });
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
    this.posLabel = h('span', { dir: 'ltr' }, '0:00');
    this.durLabel = h('span', { dir: 'ltr' }, '0:00');
    this.playBtn = h('button', { class: 'ctl main', onclick: () => this.control('playpause') });
    this.empty = h('div', { class: 'm-empty' }, h('div', { class: 'm-title' }, t('nothingPlaying')), h('div', { class: 'm-artist' }, t('openPlayer')));
    this.body = h(
      'div',
      { class: 'm-body' },
      this.title,
      this.artist,
      h('div', { class: 'bar', dir: 'ltr' }, this.fill),
      h('div', { class: 'times' }, this.posLabel, this.durLabel),
      h(
        'div',
        { class: 'ctls', dir: 'ltr' },
        h('button', { class: 'ctl', onclick: () => this.control('prev') }, html(ICONS.prev)),
        this.playBtn,
        h('button', { class: 'ctl', onclick: () => this.control('next') }, html(ICONS.next))
      )
    );
    this.expandedEl = h('div', { class: 'view music-expanded' }, this.art, this.body, this.empty);

    if (window.islandAPI) window.islandAPI.onMedia((m) => this.onUpdate(m));
    this.paint();
  },

  control(action) {
    if (window.islandAPI) window.islandAPI.mediaControl(action);
  },

  onUpdate(m) {
    if (m.type === 'unavailable') {
      this.unavailable = true;
      this.media = null;
    } else if (m.active) {
      const trackChanged = m.trackChanged || !this.media || this.media.title !== m.title;
      this.media = m;
      if (trackChanged && m.playing && m.title) Island.peek('music', 4000);
    } else {
      this.media = null;
    }
    this.paint();
    Island.render();
  },

  setArt(el, thumb) {
    el.style.backgroundImage = thumb ? `url("${thumb}")` : '';
    el.classList.toggle('empty', !thumb);
  },

  position() {
    const m = this.media;
    if (!m) return 0;
    const elapsed = m.playing ? (Date.now() - m.sentAt) / 1000 : 0;
    return Math.min(m.duration || Infinity, m.position + elapsed);
  },

  paint() {
    const m = this.media;
    const has = !!m && !!m.title;
    this.body.style.display = has ? '' : 'none';
    this.empty.style.display = has ? 'none' : '';
    this.art.style.display = has ? '' : 'none';
    if (!has) {
      this.empty.firstChild.textContent = this.unavailable ? t('mediaUnavailable') : t('nothingPlaying');
      return;
    }
    this.title.textContent = this.pTitle.textContent = m.title;
    this.artist.textContent = this.pArtist.textContent = m.artist;
    this.cTitle.textContent = m.title;
    this.setArt(this.art, m.thumb);
    this.setArt(this.cArt, m.thumb);
    this.setArt(this.pArt, m.thumb);
    this.playBtn.replaceChildren(html(m.playing ? ICONS.pause : ICONS.play));
    this.eq.classList.toggle('on', m.playing);
    this.updateProgress();
    this.syncProgressTimer();
  },

  updateProgress() {
    const m = this.media;
    if (!m) return;
    const pos = this.position();
    this.fill.style.width = (m.duration ? (pos / m.duration) * 100 : 0) + '%';
    this.posLabel.textContent = clock(pos);
    this.durLabel.textContent = m.duration ? clock(m.duration) : '--:--';
  },

  sync() {
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
    if (mode === 'compact') return has ? { el: this.compact, w: 232, h: 40 } : null;
    if (mode === 'peek') return has ? { el: this.peekEl, w: 330, h: 76 } : null;
    if (mode === 'expanded') {
      return { el: this.expandedEl, w: 430, h: has ? 156 : 96 };
    }
    return null;
  },
});

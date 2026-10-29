// Microphone / camera in use: a small coloured indicator that stays visible while any app is using them.
Island.register({
  id: 'privacy',
  icon: null,
  sticky: true,
  state: { mic: [], cam: [] },

  init() {
    this.dotMic = h('span', { class: 'pv-dot mic' }, html(ICONS.mic));
    this.dotCam = h('span', { class: 'pv-dot cam' }, html(ICONS.cam));
    this.label = h('span', { class: 'c-title', dir: 'auto' });
    this.compact = h('div', { class: 'view privacy-compact' }, this.dotCam, this.dotMic, this.label);

    this.pTitle = h('div', { class: 'm-title' });
    this.pSub = h('div', { class: 'm-artist', dir: 'auto' });
    this.pIcon = h('span', { class: 'n-icon pv' });
    this.peekEl = h('div', { class: 'view notice-view' }, this.pIcon, h('div', { class: 'm-text' }, this.pTitle, this.pSub));

    API.on('privacy:update', (s) => this.set(s));
    API.call('privacy:get').then((s) => s && this.set(s));
  },

  set(s) {
    const wasCam = this.state.cam.length > 0;
    const wasMic = this.state.mic.length > 0;
    this.state = { mic: s.mic || [], cam: s.cam || [] };
    const cam = this.state.cam.length > 0;
    const mic = this.state.mic.length > 0;
    this.dotCam.style.display = cam ? '' : 'none';
    this.dotMic.style.display = mic ? '' : 'none';
    const apps = [...new Set([...this.state.cam, ...this.state.mic])];
    this.label.textContent = I18N.list(apps, 'narrow', 'unit');
    if ((cam && !wasCam) || (mic && !wasMic)) {
      this.pIcon.replaceChildren(html(cam ? ICONS.cam : ICONS.mic));
      this.pTitle.textContent = t(cam ? 'camInUse' : 'micInUse');
      this.pSub.textContent = I18N.list(apps);
      Island.peek('privacy', 3500);
    } else {
      Island.render();
    }
  },

  relang() {
    const apps = [...new Set([...this.state.cam, ...this.state.mic])];
    this.label.textContent = I18N.list(apps, 'narrow', 'unit');
    this.pTitle.textContent = t(this.state.cam.length ? 'camInUse' : 'micInUse');
    this.pSub.textContent = I18N.list(apps);
  },

  active() {
    return this.state.mic.length > 0 || this.state.cam.length > 0;
  },

  priority() {
    return this.active() ? 90 : 0;
  },

  view(mode) {
    if (mode === 'compact') return this.active() ? { el: this.compact, w: 176, h: 32 } : null;
    if (mode === 'peek') return { el: this.peekEl, w: 330, h: 64 };
    return null;
  },
});

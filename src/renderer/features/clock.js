// Idle state: a small pill with the time. Lowest priority, so anything else wins.
Island.register({
  id: 'clock',
  icon: null,
  node: null,
  timer: 0,

  init() {
    this.label = h('span', { class: 'clock-time', dir: 'ltr' });
    this.node = h('div', { class: 'view clock' }, h('i', { class: 'clock-dot' }), this.label);
    this.tick();
  },

  tick() {
    const now = new Date();
    this.label.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    // Wake once a minute, exactly on the minute.
    this.timer = setTimeout(() => this.tick(), (60 - now.getSeconds()) * 1000 - now.getMilliseconds() + 20);
  },

  priority: () => 1,

  view(mode) {
    return mode === 'compact' ? { el: this.node, w: 138, h: 36 } : null;
  },
});

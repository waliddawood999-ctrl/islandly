// GitHub notifications (only when a token is saved in Settings).
Island.register({
  id: 'github',
  icon: null,
  state: { status: 'off', items: [] },

  init() {
    this.count = h('span', { class: 'count' });
    this.list = h('div', { class: 'gh-list stagger scroll' });
    this.empty = h('div', { class: 'p-empty' }, h('div', { class: 'm-artist' }));
    this.allBtn = h('button', { class: 'chip', onclick: () => API.send('open:external', 'https://github.com/notifications') }, T('openAll'));
    this.expandedEl = h(
      'div',
      { class: 'view auto panel github' },
      h('div', { class: 'p-head' }, h('div', { class: 'p-title-wrap' }, h('span', { class: 'gh-logo' }, html(ICONS.github)), h('div', { class: 'p-title' }, T('github')), this.count), this.allBtn),
      this.list,
      this.empty
    );
    this.pTitle = h('div', { class: 'm-title', dir: 'auto' });
    this.pSub = h('div', { class: 'm-artist', dir: 'auto' });
    this.peekEl = h('div', { class: 'view notice-view' }, h('span', { class: 'n-icon' }, html(ICONS.github)), h('div', { class: 'm-text' }, this.pTitle, this.pSub));

    API.on('github:update', (s) => this.set(s));
    API.call('github:get').then((s) => s && this.set(s));
  },

  set(s) {
    this.state = s;
    this.paint();
    const fresh = s.fresh || [];
    if (fresh.length) {
      this.pTitle.textContent = fresh.length === 1 ? fresh[0].title : t('ghNew', { count: fresh.length });
      this.pSub.textContent = fresh.length === 1 ? fresh[0].repo : I18N.list([...new Set(fresh.map((f) => f.repo))]);
      Island.peek('github', 6000);
    } else {
      Island.render();
    }
  },

  paint() {
    const { status, items } = this.state;
    this.count.textContent = items.length ? num(items.length) : '';
    this.empty.style.display = items.length ? 'none' : '';
    this.empty.firstChild.textContent = status === 'bad-token' ? t('ghBadToken') : status === 'error' ? t('ghError') : t('ghEmpty');
    this.list.replaceChildren(
      ...items.slice(0, 8).map((n) =>
        h(
          'button',
          { class: 'gh-row', 'data-interactive': '1', onclick: () => API.send('open:external', n.url) },
          h('span', { class: 'gh-type' }, n.type === 'PullRequest' ? 'PR' : n.type === 'Issue' ? '#' : '•'),
          h('span', { class: 'gh-text' }, h('span', { class: 'gh-title', dir: 'auto' }, n.title), h('span', { class: 'gh-repo', dir: 'ltr' }, n.repo))
        )
      )
    );
  },

  priority: () => 0,

  view(mode) {
    if (this.state.status === 'off') return null;
    if (mode === 'peek') return { el: this.peekEl, w: 380, h: 68 };
    if (mode === 'expanded') return { el: this.expandedEl, w: 460, auto: true };
    return null;
  },
});

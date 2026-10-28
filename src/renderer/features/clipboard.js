// Smart clipboard: recent copies, with an action that fits what was copied.
Island.register({
  id: 'clipboard',
  icon: ICONS.clip,
  items: [],
  flash: 0,

  init() {
    this.list = h('div', { class: 'cl-list stagger' });
    this.title = h('div', { class: 'p-title' }, t('clipboard'));
    this.clearBtn = h('button', { class: 'chip', onclick: () => API.call('clipboard:clear') }, t('clear'));
    this.empty = h('div', { class: 'p-empty' }, h('div', { class: 'm-title lg' }, t('clipEmpty')), h('div', { class: 'm-artist' }, t('clipEmptySub')));
    this.expandedEl = h('div', { class: 'view auto panel' }, h('div', { class: 'p-head' }, this.title, this.clearBtn), this.list, this.empty);

    API.on('clipboard:update', (items) => this.set(items));
    API.call('clipboard:list').then((items) => items && this.set(items));
    this.paint();
  },

  set(items) {
    this.items = items || [];
    this.paint();
    Island.render();
  },

  kindIcon(item) {
    const dot = (cls, content, style) => h('span', { class: 'k ' + cls, style }, content);
    if (item.type === 'color') return dot('color', '', `background:${item.color}`);
    if (item.type === 'url') return dot('url', '↗');
    if (item.type === 'email') return dot('email', '@');
    if (item.type === 'phone') return dot('phone', '✆');
    if (item.type === 'math') return dot('math', '=');
    return dot('text', 'T');
  },

  action(item) {
    const chip = (label, fn) => h('button', { class: 'chip act', 'data-interactive': '1', onclick: (e) => { e.stopPropagation(); fn(); } }, label);
    switch (item.type) {
      case 'url':
        return chip(t('open'), () => API.send('open:external', item.text.trim()));
      case 'email':
        return chip(t('mailto'), () => API.send('open:external', 'mailto:' + item.text.trim()));
      case 'phone':
        return chip(t('whatsapp'), () => API.send('open:external', 'https://wa.me/' + item.digits.replace(/^\+/, '').replace(/^00/, '')));
      case 'color':
        return chip(t('copyRgb'), () => this.copy(item, 'rgb'));
      case 'math':
        return chip('= ' + item.result, () => this.copy(item, 'result'));
      default:
        return null;
    }
  },

  copy(item, as, row) {
    API.call('clipboard:copy', item.id, as);
    if (row) {
      row.classList.add('copied');
      setTimeout(() => row.classList.remove('copied'), 900);
    }
  },

  paint() {
    const shown = this.items.slice(0, 4);
    this.empty.style.display = shown.length ? 'none' : '';
    this.list.style.display = shown.length ? '' : 'none';
    this.clearBtn.style.display = this.items.some((i) => !i.pinned) ? '' : 'none';
    this.list.replaceChildren(
      ...shown.map((item) => {
        const row = h(
          'div',
          { class: 'cl-row' + (item.pinned ? ' pinned' : ''), onclick: () => this.copy(item, undefined, row) },
          this.kindIcon(item),
          h('span', { class: 'cl-text', dir: 'auto' }, item.text.replace(/\s+/g, ' ').trim().slice(0, 120)),
          this.action(item),
          h('button', { class: 'icon-btn pin' + (item.pinned ? ' on' : ''), title: t('pin'), 'data-interactive': '1', onclick: (e) => { e.stopPropagation(); API.call('clipboard:pin', item.id); } }, html(ICONS.star)),
          h('span', { class: 'copied-flag' }, t('copied'))
        );
        return row;
      })
    );
  },

  priority: () => 0,

  view(mode) {
    if (mode !== 'expanded') return null;
    return { el: this.expandedEl, w: 480, auto: true };
  },
});

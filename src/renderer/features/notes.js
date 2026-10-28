// Quick to-do list. Typing needs keyboard focus, so the island window becomes focusable only while the field is used.
Island.register({
  id: 'notes',
  icon: null,
  todos: [],

  init() {
    this.input = I18N.mark(h('input', { class: 'nt-input', type: 'text', maxlength: '140', dir: 'auto' }), 'notesPlaceholder', null, 'placeholder');
    this.input.addEventListener('mousedown', () => this.focusIn());
    this.input.addEventListener('focus', () => this.focusIn());
    this.input.addEventListener('blur', () => this.focusOut());
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.add();
      if (e.key === 'Escape') this.input.blur();
    });
    this.addBtn = h('button', { class: 'pill primary sm', onclick: () => this.add() }, '+');
    this.list = h('div', { class: 'nt-list stagger scroll' });
    this.count = h('span', { class: 'count' });
    this.empty = h('div', { class: 'p-empty' }, h('div', { class: 'm-artist' }, T('notesEmpty')));
    this.expandedEl = h(
      'div',
      { class: 'view auto panel notes' },
      h('div', { class: 'p-head' }, h('div', { class: 'p-title-wrap' }, h('div', { class: 'p-title' }, T('notes')), this.count)),
      h('div', { class: 'nt-add' }, this.input, this.addBtn),
      this.list,
      this.empty
    );
    API.call('notes:get').then((d) => {
      this.todos = (d && d.todos) || [];
      this.paint();
    });
    this.paint();
  },

  // While this panel is on screen the window accepts focus, so a click on the field activates it the normal way
  // (asking the OS for focus afterwards can be refused). Everywhere else the island never takes focus.
  sync() {
    const visible = Island.isExpanded() && Island.selectedId() === 'notes';
    if (visible !== this.focusable) {
      this.focusable = visible;
      API.send('island:focusable', visible);
      if (!visible && this.focused) this.input.blur();
    }
  },

  focusIn() {
    if (this.focused) return;
    this.focused = true;
    Island.hold(true);
    API.send('island:focus', true);
    setTimeout(() => this.input.focus(), 30);
  },

  focusOut() {
    if (!this.focused) return;
    this.focused = false;
    Island.hold(false);
    API.send('island:focus', false);
  },

  save() {
    API.call('notes:set', { todos: this.todos });
    this.paint();
    Island.render();
  },

  add() {
    const text = this.input.value.trim();
    if (!text) return;
    this.todos.unshift({ id: Date.now(), text, done: false });
    this.todos = this.todos.slice(0, 50);
    this.input.value = '';
    this.save();
  },

  paint() {
    const open = this.todos.filter((x) => !x.done).length;
    this.count.textContent = open ? num(open) : '';
    this.empty.style.display = this.todos.length ? 'none' : '';
    this.list.replaceChildren(
      ...this.todos.slice(0, 6).map((item) =>
        h(
          'div',
          { class: 'nt-row' + (item.done ? ' done' : '') },
          h('button', { class: 'nt-check', 'data-interactive': '1', onclick: () => { item.done = !item.done; this.save(); } }, item.done ? '✓' : ''),
          h('span', { class: 'nt-text', dir: 'auto' }, item.text),
          h('button', { class: 'icon-btn', 'data-interactive': '1', onclick: () => { this.todos = this.todos.filter((x) => x !== item); this.save(); } }, html(ICONS.close))
        )
      )
    );
  },

  priority: () => 0,

  view(mode) {
    return mode === 'expanded' ? { el: this.expandedEl, w: 440, auto: true } : null;
  },
});

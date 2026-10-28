// Short messages (update ready, "you're up to date", ...). Only ever shown as a peek.
const Notice = (() => {
  const title = h('div', { class: 'm-title' });
  const sub = h('div', { class: 'm-artist' });
  const action = h('button', { class: 'pill primary sm' });
  const el = h('div', { class: 'view notice-view' }, h('span', { class: 'n-icon' }, html(ICONS.download)), h('div', { class: 'm-text' }, title, sub), action);
  let hasAction = false;
  let onAction = null;
  action.addEventListener('click', () => onAction && onAction());

  Island.register({
    id: 'notice',
    priority: () => 0,
    view(mode) {
      if (mode !== 'peek') return null;
      return { el, w: hasAction ? 420 : 340, h: 72 };
    },
  });

  return {
    show({ text, detail = '', actionLabel, run }, ms = 5000) {
      title.textContent = text;
      sub.textContent = detail;
      hasAction = !!actionLabel;
      onAction = run || null;
      action.style.display = hasAction ? '' : 'none';
      if (hasAction) action.textContent = actionLabel;
      Island.peek('notice', ms);
    },
  };
})();

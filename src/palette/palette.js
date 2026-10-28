// Command palette UI: type, arrow keys to choose, Enter to run, Esc to close.
const API = window.paletteAPI || { settings: {}, call: async () => [], send() {}, on() {} };

const ICON = {
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/></svg>',
  calc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="5" y="3" width="14" height="18" rx="3"/><path d="M8.5 7.5h7M9 12h.01M12 12h.01M15 12h.01M9 16h.01M12 16h.01M15 16h.01"/></svg>',
  ruler: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M3 15.5L15.5 3 21 8.5 8.5 21z"/><path d="M7 11.5l2 2M10 8.5l2 2M13 5.5l2 2" stroke-linecap="round"/></svg>',
  coin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="8.5"/><path d="M14.8 9.2c-.5-.9-1.6-1.4-2.8-1.4-1.6 0-2.8.8-2.8 2.1 0 2.9 5.8 1.4 5.8 4.3 0 1.3-1.3 2.1-3 2.1-1.3 0-2.4-.6-2.9-1.5M12 6v1.8M12 16.3V18"/></svg>',
  spark: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5l1.9 5.6 5.6 1.9-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.9zM19 15l.9 2.1 2.1.9-2.1.9L19 21l-.9-2.1-2.1-.9 2.1-.9z"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M21.5 12h-3M5.5 12h-3M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1M18.7 18.7l-2.1-2.1M7.4 7.4L5.3 5.3" stroke-linecap="round"/></svg>',
  globe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.6 3.5 5.4 3.5 8.5s-1 5.9-3.5 8.5c-2.5-2.6-3.5-5.4-3.5-8.5s1-5.9 3.5-8.5z"/></svg>',
  link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>',
  folder: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M3.5 8a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/></svg>',
  app: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="4.5"/><path d="M9 12h6M12 9v6" stroke-linecap="round"/></svg>',
  grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="6.5" height="6.5" rx="1.8"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.8"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.8"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.8"/></svg>',
  timer: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6"/></svg>',
};

// Strings: src/renderer/locales/<lang>.json, `palette.*` keys (T11).
const s = (k, vars) => t('palette.' + k, vars);
const configureLang = (d) => I18N.configure({ uiLang: d.uiLang, lang: d.lang, digits: d.digits });
configureLang(API.settings);

const $ = (id) => document.getElementById(id);
const box = $('box');
const input = $('q');
const list = $('list');
const answer = $('answer');
const aText = $('aText');
let items = [];
let sel = 0;
let seq = 0;
let asking = false;
let dirty = false; // typed since the last results arrived

function applyLang() {
  document.documentElement.dataset.fonts = API.settings.fontPairing || 'plex';
  input.placeholder = s('placeholder');
  $('lead').innerHTML = ICON.search;
  $('aIcon').innerHTML = ICON.spark;
  $('aCopy').textContent = s('copy');
}

function actionLabel(it) {
  const key = it.kind === 'copy' ? 'copy' : it.kind === 'ai' ? 'ask' : it.kind === 'timer' || it.kind === 'settings' ? 'run' : 'open';
  return it.kind === 'hint' ? '' : s('withKey', { label: s(key) });
}

function titleOf(it) {
  if (it.kind === 'hint' || it.kind === 'settings') return s(it.title);
  if (it.kind === 'timer') return s('timer', { count: Number(it.title) || 0 });
  return it.title;
}

function subOf(it) {
  if (it.kind === 'ai') return it.needsKey ? s('needsKey') : s('askAi');
  if (it.kind === 'workspace') return s('workspaceSub', { name: it.sub });
  if (['translate', 'openLink', 'openPath', 'app', 'searchWeb'].includes(it.sub)) return s(it.sub);
  return it.sub || '';
}

function paint() {
  list.replaceChildren(
    ...items.map((it, i) => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'row' + (i === sel ? ' on' : '') + (it.kind === 'hint' ? ' hint' : '');
      row.setAttribute('role', 'option');
      const ic = document.createElement('span');
      ic.className = 'ic';
      ic.innerHTML = ICON[it.icon] || ICON.search;
      const txt = document.createElement('span');
      txt.className = 'txt';
      const t1 = document.createElement('div');
      t1.className = 't1' + (it.kind === 'copy' ? ' big' : '');
      t1.dir = 'auto';
      t1.textContent = titleOf(it);
      txt.append(t1);
      const sub = subOf(it);
      if (sub) {
        const t2 = document.createElement('div');
        t2.className = 't2';
        t2.dir = 'auto';
        t2.textContent = sub;
        txt.append(t2);
      }
      const act = document.createElement('span');
      act.className = 'act';
      act.textContent = actionLabel(it);
      row.append(ic, txt, act);
      row.addEventListener('mousemove', () => {
        if (sel !== i) {
          sel = i;
          markSel();
        }
      });
      row.addEventListener('click', () => run(it));
      return row;
    })
  );
  fit();
}

function markSel() {
  [...list.children].forEach((r, i) => r.classList.toggle('on', i === sel));
  const on = list.children[sel];
  if (on) on.scrollIntoView({ block: 'nearest' });
}

function fit() {
  requestAnimationFrame(() => API.send('palette:height', box.getBoundingClientRect().height + 20));
}

async function refresh() {
  dirty = false;
  const my = ++seq;
  const result = await API.call('palette:query', input.value).catch(() => []);
  if (my !== seq) return; // a newer query already answered
  items = Array.isArray(result) ? result : [];
  sel = Math.max(0, items.findIndex((it) => it.kind !== 'hint'));
  if (!asking) answer.hidden = true;
  paint();
}

function run(it) {
  if (!it || it.kind === 'hint') return;
  if (it.kind === 'ai') return askAi(it);
  API.call('palette:run', it);
}

function askAi(it) {
  answer.hidden = false;
  $('aTitle').textContent = it.question;
  aText.className = '';
  if (it.needsKey) {
    aText.textContent = s('needsKey');
    aText.className = 'err';
    fit();
    return;
  }
  asking = true;
  items = [];
  list.replaceChildren();
  aText.textContent = '';
  aText.classList.add('wait');
  fit();
  API.send('palette:ask', it.question);
}

API.on('palette:ai-text', (t) => {
  if (!asking) return;
  aText.textContent += t;
  aText.scrollTop = aText.scrollHeight;
  fit();
});

API.on('palette:ai-done', (r) => {
  asking = false;
  aText.classList.remove('wait');
  if (!r.ok) {
    // a mid-answer refusal leaves partial text that should not be kept
    aText.className = 'err';
    aText.textContent = r.reason === 'refusal' ? s('refusal') : r.reason === 'bad-key' ? s('badKey') : r.reason === 'no-key' ? s('needsKey') : s('error', { msg: r.message || '' });
  } else if (r.truncated) {
    aText.textContent += s('truncated');
  }
  fit();
});

$('aCopy').addEventListener('click', () => {
  API.send('palette:copy', aText.textContent);
  $('aCopy').textContent = s('copied');
  setTimeout(() => ($('aCopy').textContent = s('copy')), 1200);
});

let debounce = 0;
input.addEventListener('input', () => {
  asking = false;
  dirty = true;
  clearTimeout(debounce);
  debounce = setTimeout(refresh, 60);
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    e.preventDefault();
    API.send('palette:hide');
  } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    if (!items.length) return;
    const step = e.key === 'ArrowDown' ? 1 : -1;
    do sel = (sel + step + items.length) % items.length;
    while (items[sel].kind === 'hint' && items.some((x) => x.kind !== 'hint'));
    markSel();
  } else if (e.key === 'Enter') {
    e.preventDefault();
    clearTimeout(debounce);
    // Enter right after typing: run against the fresh results, not the stale list
    if (dirty) refresh().then(() => run(items[sel]));
    else run(items[sel]);
  }
});

API.on('palette:shown', (d) => {
  if (d) configureLang(d);
  applyLang();
  asking = false;
  input.value = '';
  answer.hidden = true;
  box.classList.remove('in');
  void box.offsetWidth;
  box.classList.add('in');
  input.focus();
  refresh();
});

applyLang();
refresh();

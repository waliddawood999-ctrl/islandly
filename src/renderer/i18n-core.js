// Shared i18n for the island, the settings window and the command palette (T11).
// Strings live in src/renderer/locales/<lang>.json (flat keys; island keys bare, `settings.*`, `palette.*`).
// A value is either a string with {name} placeholders, or a plural object {zero, one, two, few, many, other}
// chosen with Intl.PluralRules from vars.count (Arabic uses all six forms, English one/other).
// Numbers passed in vars are formatted for the current language and digit setting.
const I18N = (() => {
  const LANGS = ['ar', 'en'];
  const base = new URL('locales/', document.currentScript.src).href;
  const dicts = {};

  // Locale files sit next to this script; a synchronous read keeps start-up simple (two small local files).
  function load(lang) {
    if (dicts[lang]) return dicts[lang];
    try {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', base + lang + '.json', false);
      xhr.overrideMimeType('application/json');
      xhr.send();
      dicts[lang] = JSON.parse(xhr.responseText);
    } catch (_) {
      dicts[lang] = {};
    }
    return dicts[lang];
  }

  let lang = 'ar';
  let digits = 'latn';
  let locale = 'ar-u-nu-latn';
  let plural = null;
  let nf = null;
  const listeners = new Set();

  // 'auto' follows the system language (Arabic for any ar-*, otherwise English).
  function resolve(pref, system) {
    if (LANGS.includes(pref)) return pref;
    const sys = String(system || navigator.language || 'ar').toLowerCase();
    return sys.startsWith('ar') ? 'ar' : 'en';
  }

  // Arabic-Indic digits are an option for the Arabic interface only; English always uses Latin digits.
  function configure({ uiLang, lang: legacy, digits: d, system } = {}) {
    const nextLang = resolve(uiLang || legacy || 'ar', system);
    const nextDigits = d === 'arab' ? 'arab' : 'latn';
    const changed = nextLang !== lang || nextDigits !== digits || !plural;
    lang = nextLang;
    digits = nextDigits;
    locale = `${lang}-u-nu-${lang === 'ar' ? digits : 'latn'}`;
    plural = new Intl.PluralRules(lang);
    nf = new Intl.NumberFormat(locale);
    load(lang);
    const root = document.documentElement;
    root.lang = lang;
    root.dir = lang === 'ar' ? 'rtl' : 'ltr';
    if (changed) {
      retranslate();
      listeners.forEach((fn) => fn(lang));
    }
    return changed;
  }

  function lookup(key) {
    const own = load(lang)[key];
    if (own != null) return own;
    const ar = load('ar')[key];
    return ar != null ? ar : key;
  }

  function t(key, vars) {
    let s = lookup(key);
    if (s && typeof s === 'object') {
      const n = vars && typeof vars.count === 'number' ? vars.count : 0;
      // exact 0 gets its own phrase when the language has one ("no new notifications")
      s = (n === 0 && s.zero) || s[plural.select(n)] || s.other || '';
    }
    if (!vars) return s;
    return String(s).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? fmt(vars[k]) : m));
  }

  // numbers follow the language and digit setting; {pct: 0.8} is a percentage
  const fmt = (v) => (typeof v === 'number' ? nf.format(v) : v && typeof v === 'object' && 'pct' in v ? formatter(Intl.NumberFormat, { style: 'percent', maximumFractionDigits: 0 }).format(v.pct) : v);

  // --- elements whose text follows the language: built once, re-translated on a switch
  const tracked = new Set();

  function mark(el, key, vars, attr) {
    el.setAttribute(attr ? `data-i18n-${attr}` : 'data-i18n', key);
    if (vars) el.dataset.i18nVars = JSON.stringify(vars);
    paintEl(el);
    tracked.add(new WeakRef(el));
    return el;
  }

  function paintEl(el) {
    const vars = el.dataset.i18nVars ? JSON.parse(el.dataset.i18nVars) : undefined;
    if (el.dataset.i18n) el.textContent = t(el.dataset.i18n, vars);
    for (const attr of ['title', 'placeholder', 'aria-label']) {
      const key = el.getAttribute(`data-i18n-${attr}`);
      if (key) el.setAttribute(attr, t(key, vars));
    }
  }

  // Static markup (settings window): every [data-i18n], [data-i18n-title], ... under root.
  function apply(root = document) {
    root.querySelectorAll('[data-i18n],[data-i18n-title],[data-i18n-placeholder],[data-i18n-aria-label]').forEach(paintEl);
  }

  function retranslate() {
    apply(document);
    for (const ref of tracked) {
      const el = ref.deref();
      if (el) paintEl(el);
      else tracked.delete(ref);
    }
  }

  // --- formatting with the interface locale (and the digit setting)
  const cache = new Map();
  const formatter = (Ctor, opts, extra = '') => {
    const id = Ctor.name + locale + extra + JSON.stringify(opts);
    if (!cache.has(id)) cache.set(id, new Ctor(extra ? locale.replace('-u-', `-u-${extra}-`) : locale, opts));
    return cache.get(id);
  };

  return {
    configure,
    resolve,
    t,
    mark,
    apply,
    onChange: (fn) => listeners.add(fn),
    get lang() {
      return lang;
    },
    get locale() {
      return locale;
    },
    get dir() {
      return lang === 'ar' ? 'rtl' : 'ltr';
    },
    num: (n, opts) => (opts ? formatter(Intl.NumberFormat, opts) : nf).format(n),
    pct: (fraction) => formatter(Intl.NumberFormat, { style: 'percent', maximumFractionDigits: 0 }).format(fraction),
    time: (d, opts = { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }) => formatter(Intl.DateTimeFormat, opts).format(d),
    date: (d, opts = { weekday: 'long', day: 'numeric', month: 'long' }) => formatter(Intl.DateTimeFormat, opts).format(d),
    hijri: (d, opts = { day: 'numeric', month: 'long', year: 'numeric' }) => {
      try {
        return formatter(Intl.DateTimeFormat, opts, 'ca-islamic-umalqura').format(d);
      } catch (_) {
        return '';
      }
    },
    rel: (value, unit) => formatter(Intl.RelativeTimeFormat, { numeric: 'auto' }).format(value, unit),
    list: (items, style = 'long', type = 'conjunction') => formatter(Intl.ListFormat, { style, type }).format(items),
    // digits in strings built by hand (clock faces, mm:ss): Arabic-Indic when that setting is on
    digits: (s) => (lang === 'ar' && digits === 'arab' ? String(s).replace(/[0-9]/g, (d) => String.fromCharCode(0x660 + Number(d))) : String(s)),
  };
})();

// Short alias used across the UI code.
const t = I18N.t;

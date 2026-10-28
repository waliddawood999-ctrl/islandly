// Island glue for the shared i18n (i18n-core.js): language and digits come from the settings, and a change
// re-translates in place, so a running timer, the playing song and the open panel all stay as they are.
I18N.configure({ uiLang: API.settings.uiLang, lang: API.settings.lang, digits: API.settings.digits });
// font pairing (hidden setting): plex (default), manrope, jakarta. See assets/fonts/typography.css.
document.documentElement.dataset.fonts = API.settings.fontPairing || 'plex';

// A text node that follows the language: T('key') or T('key', vars) inside h(...).
const T = (key, vars) => I18N.mark(h('span', {}), key, vars);
const num = (n) => I18N.num(n);

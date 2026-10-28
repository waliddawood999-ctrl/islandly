// T11: no hard-coded interface text, and the two locale files agree.
//   node test/i18n-check.js
// Checks, for the UI code (src/renderer, src/settings, src/palette; vendor code excluded):
//   1. no Arabic letters outside comments (all Arabic lives in src/renderer/locales/ar.json);
//   2. HTML: no text between tags and no literal title/placeholder/aria-label/alt (use data-i18n*);
//   3. JS: no letters in string literals given to h(...) as children, to textContent/title/placeholder,
//      or as title/placeholder/aria-label/alt props (use t()/T()/I18N.mark());
//   4. every literal key passed to t/T/I18N.mark/s() or data-i18n* exists in both locales;
//   5. ar.json and en.json have the same keys, the same {placeholders}, and complete plural forms.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const LOCALES = path.join(root, 'src/renderer/locales');
const DIRS = ['src/renderer', 'src/settings', 'src/palette'];
// Tokens that read the same in every language (file formats, an issue-type badge).
const ALLOW = new Set(['PR', 'PNG', 'JPG']);
const LETTERS = /[A-Za-z؀-ۿ]{2,}/;
const ARABIC = /[؀-ۿ]/;

const errors = [];
const fail = (file, line, msg) => errors.push(`${file}:${line}: ${msg}`);

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'vendor' && entry.name !== 'locales') out.push(...walk(p));
    } else if (/\.(js|html)$/.test(entry.name)) out.push(p);
  }
  return out;
}

const lineOf = (src, index) => src.slice(0, index).split('\n').length;

// --- JS tokenizer: comments are blanked (keeping positions), string literals are collected.
function scanJs(src) {
  const strings = [];
  let code = '';
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    const n = src[i + 1];
    if (c === '/' && n === '/') {
      const end = src.indexOf('\n', i);
      const stop = end < 0 ? src.length : end;
      code += ' '.repeat(stop - i);
      i = stop;
    } else if (c === '/' && n === '*') {
      const stop = src.indexOf('*/', i + 2) + 2;
      code += src.slice(i, stop).replace(/[^\n]/g, ' ');
      i = stop;
    } else if (c === "'" || c === '"' || c === '`') {
      let j = i + 1;
      let text = '';
      while (j < src.length && src[j] !== c) {
        if (src[j] === '\\') {
          text += src[j] + src[j + 1];
          j += 2;
          continue;
        }
        if (c === '`' && src[j] === '$' && src[j + 1] === '{') {
          // skip the expression; its own strings are not interface text of this literal
          let depth = 1;
          j += 2;
          while (j < src.length && depth) {
            if (src[j] === '{') depth++;
            else if (src[j] === '}') depth--;
            j++;
          }
          text += '\u0000';
          continue;
        }
        text += src[j];
        j++;
      }
      strings.push({ start: i, end: j + 1, quote: c, text });
      code += src.slice(i, j + 1);
      i = j + 1;
    } else if (c === '/' && /[=(,:;!&|?{}[\n]\s*$/.test(code.slice(-20)) && n !== '/' && n !== '*') {
      // regular expression literal: copy through to the closing slash
      let j = i + 1;
      let inClass = false;
      while (j < src.length && (src[j] !== '/' || inClass)) {
        if (src[j] === '\\') j++;
        else if (src[j] === '[') inClass = true;
        else if (src[j] === ']') inClass = false;
        j++;
      }
      code += src.slice(i, j + 1);
      i = j + 1;
    } else {
      code += c;
      i++;
    }
  }
  return { code, strings };
}

const isText = (s) => {
  const plain = s.text.replace(/\u0000/g, ' ').trim();
  return LETTERS.test(plain) && !ALLOW.has(plain);
};

// Arguments of a call starting at `open` (index of "("): returns [{start, end}] for each top-level argument.
function callArgs(code, open) {
  const args = [];
  let depth = 0;
  let start = open + 1;
  for (let i = open; i < code.length; i++) {
    const c = code[i];
    if (c === "'" || c === '"' || c === '`') {
      // jump over the string (the tokenizer already validated it)
      let j = i + 1;
      while (j < code.length && code[j] !== c) j += code[j] === '\\' ? 2 : 1;
      i = j;
      continue;
    }
    if ('([{'.includes(c)) depth++;
    else if (')]}'.includes(c)) {
      depth--;
      if (depth === 0) {
        args.push({ start, end: i });
        return args;
      }
    } else if (c === ',' && depth === 1) {
      args.push({ start, end: i });
      start = i + 1;
    }
  }
  return args;
}

const usedKeys = new Map(); // key -> first place it is used

function useKey(key, file, line) {
  if (!usedKeys.has(key)) usedKeys.set(key, `${file}:${line}`);
}

function checkJs(file, src) {
  const { code, strings } = scanJs(src);
  const rel = path.relative(root, file);
  const strAt = new Map(strings.map((s) => [s.start, s]));

  // 1. Arabic outside comments
  code.split('\n').forEach((l, i) => {
    if (ARABIC.test(l)) fail(rel, i + 1, 'Arabic text in code (move it to locales/ar.json)');
  });

  // 3a. h('tag', props, ...children): literal children with letters
  for (const m of code.matchAll(/\bh\(/g)) {
    const args = callArgs(code, m.index + 1);
    for (const a of args.slice(2)) {
      const piece = code.slice(a.start, a.end);
      const lead = piece.length - piece.trimStart().length;
      const s = strAt.get(a.start + lead);
      if (s && s.end - a.start - lead === piece.trim().length && isText(s)) fail(rel, lineOf(src, s.start), `literal text in h(): ${JSON.stringify(s.text)}`);
    }
  }
  // 3b. sinks: .textContent = '...', title/placeholder props, etc.
  const sink = /(\.(textContent|innerText|placeholder|title)\s*=\s*|\b(title|placeholder|alt|'aria-label')\s*:\s*)$/;
  for (const s of strings) {
    if (!isText(s)) continue;
    if (sink.test(code.slice(Math.max(0, s.start - 40), s.start))) fail(rel, lineOf(src, s.start), `literal text: ${JSON.stringify(s.text)}`);
  }

  // 4. keys used literally
  const palette = rel.startsWith('src/palette');
  for (const m of code.matchAll(/\b(t|T|s)\(\s*(['"])([\w.-]+)\2\s*[,)]/g)) {
    if (m[1] === 's' && !palette) continue;
    useKey((m[1] === 's' ? 'palette.' : '') + m[3], rel, lineOf(src, m.index));
  }
  for (const m of code.matchAll(/I18N\.mark\(/g)) {
    const key = callArgs(code, m.index + 9)[1];
    const s = key && strAt.get(key.start + (code.slice(key.start, key.end).length - code.slice(key.start, key.end).trimStart().length));
    if (s) useKey(s.text, rel, lineOf(src, m.index));
  }
  for (const m of code.matchAll(/dataset\.i18n\s*=\s*(['"])([\w.-]+)\1/g)) useKey(m[2], rel, lineOf(src, m.index));
}

function checkHtml(file, src) {
  const rel = path.relative(root, file);
  const body = src.replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' ')).replace(/<(script|style)\b[\s\S]*?<\/\1>/g, (m) => m.replace(/[^\n]/g, ' '));
  const start = body.indexOf('<body');
  // 2a. text between tags
  for (const m of body.matchAll(/>([^<]+)</g)) {
    if (m.index < start) continue;
    const text = m[1].trim();
    if (text && /[A-Za-z؀-ۿ]/.test(text) && !ALLOW.has(text)) fail(rel, lineOf(src, m.index), `literal text in HTML: ${JSON.stringify(text)}`);
  }
  // 2b. literal attributes
  for (const m of body.matchAll(/\s(title|placeholder|aria-label|alt)="([^"]*)"/g)) {
    if (m.index < start) continue;
    if (/[A-Za-z؀-ۿ]/.test(m[2])) fail(rel, lineOf(src, m.index), `literal ${m[1]}="${m[2]}" (use data-i18n-${m[1]})`);
  }
  if (ARABIC.test(body)) fail(rel, lineOf(src, body.search(ARABIC)), 'Arabic text in HTML');
  for (const m of body.matchAll(/data-i18n(?:-[\w-]+)?="([\w.-]+)"/g)) useKey(m[1], rel, lineOf(src, m.index));
}

for (const dir of DIRS) {
  for (const file of walk(path.join(root, dir))) {
    const src = fs.readFileSync(file, 'utf8');
    (file.endsWith('.html') ? checkHtml : checkJs)(file, src);
  }
}

// 5. locale parity
const ar = JSON.parse(fs.readFileSync(path.join(LOCALES, 'ar.json'), 'utf8'));
const en = JSON.parse(fs.readFileSync(path.join(LOCALES, 'en.json'), 'utf8'));
const vars = (v) => new Set(String(v).match(/\{\w+\}/g) || []);
const allVars = (v) => (typeof v === 'object' ? new Set(Object.values(v).flatMap((x) => [...vars(x)])) : vars(v));
for (const key of new Set([...Object.keys(ar), ...Object.keys(en)])) {
  if (!(key in ar)) fail('locales/ar.json', 0, `missing key ${key}`);
  if (!(key in en)) fail('locales/en.json', 0, `missing key ${key}`);
  if (!(key in ar) || !(key in en)) continue;
  const a = ar[key];
  const e = en[key];
  if ((typeof a === 'object') !== (typeof e === 'object')) fail('locales', 0, `${key}: plural in one language only`);
  if (typeof a === 'object') {
    for (const form of ['one', 'two', 'few', 'many', 'other']) if (!a[form]) fail('locales/ar.json', 0, `${key}: missing plural form "${form}"`);
    for (const form of ['one', 'other']) if (!e[form]) fail('locales/en.json', 0, `${key}: missing plural form "${form}"`);
  }
  const va = [...allVars(a)].sort().join();
  const ve = [...allVars(e)].sort().join();
  if (va !== ve) fail('locales', 0, `${key}: placeholders differ (ar ${va || '-'} / en ${ve || '-'})`);
  if (typeof e === 'string' && ARABIC.test(e) && !/^settings\.(lang|digits)\./.test(key)) fail('locales/en.json', 0, `${key}: Arabic text in the English file`);
}
for (const [key, where] of usedKeys) if (!(key in ar)) fail(where.split(':')[0], where.split(':')[1], `unknown key "${key}"`);

if (errors.length) {
  console.error(errors.join('\n'));
  console.error(`i18n check: ${errors.length} problem(s)`);
  process.exit(1);
}
console.log(`i18n check ok: ${Object.keys(ar).length} keys in ar/en, ${usedKeys.size} used literally, no hard-coded text`);

// Safe arithmetic: a small recursive-descent parser instead of eval/Function.
// Supports + - * / % ^, parentheses, unary minus, Arabic-Indic digits, × ÷ and a few functions/constants.

const FUNCS = {
  sqrt: Math.sqrt,
  abs: Math.abs,
  round: Math.round,
  floor: Math.floor,
  ceil: Math.ceil,
  sin: (x) => Math.sin((x * Math.PI) / 180),
  cos: (x) => Math.cos((x * Math.PI) / 180),
  tan: (x) => Math.tan((x * Math.PI) / 180),
  log: Math.log10,
  ln: Math.log,
};
const CONSTS = { pi: Math.PI, e: Math.E };

function digits(input) {
  return String(input)
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/٫/g, '.')
    .trim();
}

function normalize(input) {
  return digits(input)
    .replace(/[×xX]/g, '*')
    .replace(/÷/g, '/')
    .replace(/٫/g, '.')
    .replace(/[,٬](?=\d{3}\b)/g, '')
    .trim();
}

function tokenize(s) {
  const tokens = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) {
      i++;
    } else if (/[\d.]/.test(c)) {
      const m = /^\d*\.?\d+(e[+-]?\d+)?|^\d+\.?/i.exec(s.slice(i));
      if (!m) throw new Error('number');
      tokens.push({ t: 'num', v: parseFloat(m[0]) });
      i += m[0].length;
    } else if (/[a-z]/i.test(c)) {
      const m = /^[a-z]+/i.exec(s.slice(i));
      tokens.push({ t: 'id', v: m[0].toLowerCase() });
      i += m[0].length;
    } else if ('+-*/%^()'.includes(c)) {
      tokens.push({ t: c });
      i++;
    } else {
      throw new Error('char');
    }
  }
  return tokens;
}

function parse(tokens) {
  let pos = 0;
  const peek = () => tokens[pos] && tokens[pos].t;
  const take = (t) => {
    if (peek() !== t) throw new Error('expected ' + t);
    return tokens[pos++];
  };

  function expr() {
    let v = term();
    while (peek() === '+' || peek() === '-') v = tokens[pos++].t === '+' ? v + term() : v - term();
    return v;
  }
  function term() {
    let v = unary();
    for (;;) {
      const op = peek();
      if (op === '*') (pos++, (v *= unary()));
      else if (op === '/') (pos++, (v /= unary()));
      else if (op === '%') {
        pos++;
        // "50%" alone means 0.5; "10 % 3" is the remainder
        const next = peek();
        if (next === 'num' || next === '(' || next === 'id') v %= unary();
        else v /= 100;
      } else if (op === '(' || op === 'id') v *= unary(); // implicit multiplication: 2(3+4), 2pi
      else return v;
    }
  }
  function unary() {
    if (peek() === '-') return pos++, -unary();
    if (peek() === '+') return pos++, unary();
    return power();
  }
  function power() {
    const base = atom();
    if (peek() === '^') {
      pos++;
      return Math.pow(base, unary());
    }
    return base;
  }
  function atom() {
    const tok = tokens[pos];
    if (!tok) throw new Error('end');
    if (tok.t === 'num') return pos++, tok.v;
    if (tok.t === '(') {
      pos++;
      const v = expr();
      take(')');
      return v;
    }
    if (tok.t === 'id') {
      pos++;
      if (tok.v in CONSTS) return CONSTS[tok.v];
      if (tok.v in FUNCS) {
        take('(');
        const v = expr();
        take(')');
        return FUNCS[tok.v](v);
      }
    }
    throw new Error('unexpected');
  }

  const value = expr();
  if (pos !== tokens.length) throw new Error('trailing');
  return value;
}

/** Evaluate an expression; returns a finite number or null. Plain numbers ("42") return null: nothing to compute. */
function evaluate(input) {
  const s = normalize(input);
  if (!s || s.length > 200) return null;
  try {
    const tokens = tokenize(s);
    const hasOp = tokens.some((t) => '+-*/%^'.includes(t.t) || t.t === 'id');
    if (!hasOp) return null;
    const v = parse(tokens);
    return Number.isFinite(v) ? Math.round(v * 1e10) / 1e10 : null;
  } catch (_) {
    return null;
  }
}

module.exports = { evaluate, normalize, digits };

// Currency conversion with free daily rates from open.er-api.com (no key), cached for 12 hours on disk.
const { net } = require('electron');
const { digits } = require('./calc');
const { jsonStore } = require('./store');

const TTL = 12 * 3600 * 1000;
const cache = jsonStore('rates.json', { base: 'USD', at: 0, rates: null });

const ALIASES = {
  'ريال': 'SAR', 'ر.س': 'SAR', 'سعودي': 'SAR', 'دولار': 'USD', '$': 'USD', 'يورو': 'EUR', '€': 'EUR', 'جنيه': 'EGP', 'مصري': 'EGP',
  'استرليني': 'GBP', '£': 'GBP', 'درهم': 'AED', 'اماراتي': 'AED', 'إماراتي': 'AED', 'دينار': 'KWD', 'كويتي': 'KWD', 'قطري': 'QAR',
  'بحريني': 'BHD', 'عماني': 'OMR', 'أردني': 'JOD', 'اردني': 'JOD', 'ين': 'JPY', 'ليرة': 'TRY', 'تركي': 'TRY', 'روبية': 'INR',
  'يوان': 'CNY', 'روبل': 'RUB',
};

function code(raw) {
  const r = raw.trim();
  if (ALIASES[r]) return ALIASES[r];
  return /^[a-z]{3}$/i.test(r) ? r.toUpperCase() : null;
}

/** "100 usd to sar" -> {amount, from, to} (no network). */
function parseQuery(input) {
  const s = digits(input).replace(/\s+/g, ' ');
  const m = /^(\d*\.?\d+)\s*([^\d\s]+)\s+(?:to|in|=|إلى|الى|ب|بـ)\s+([^\d\s]+)$/i.exec(s);
  if (!m) return null;
  const from = code(m[2]);
  const to = code(m[3]);
  if (!from || !to || from === to) return null;
  return { amount: parseFloat(m[1]), from, to };
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const req = net.request(url);
    let body = '';
    const timer = setTimeout(() => req.abort(), 8000);
    req.on('response', (res) => {
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        clearTimeout(timer);
        try {
          resolve(JSON.parse(body));
        } catch (err) {
          reject(err);
        }
      });
    });
    req.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    req.end();
  });
}

async function rates() {
  const c = cache.read();
  if (c.rates && Date.now() - c.at < TTL) return c.rates;
  try {
    const d = await fetchJson('https://open.er-api.com/v6/latest/USD');
    if (d && d.result === 'success' && d.rates) {
      cache.write({ base: 'USD', at: Date.now(), rates: d.rates });
      return d.rates;
    }
  } catch (_) {
    /* offline: fall back to the last cached rates, however old */
  }
  return c.rates;
}

async function convert(input) {
  const q = parseQuery(input);
  if (!q) return null;
  const r = await rates();
  if (!r) return { ...q, result: null }; // offline and nothing cached
  if (!r[q.from] || !r[q.to]) return null; // not currencies after all (e.g. "5 lbs to kgs")
  const result = (q.amount / r[q.from]) * r[q.to];
  return { ...q, result: Math.round(result * 100) / 100 };
}

module.exports = { convert, parseQuery };

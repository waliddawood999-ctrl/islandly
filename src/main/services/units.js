// Unit conversion for the command palette: "5 km to mi", "100 f in c", "٣ كيلو إلى رطل".
const { digits } = require('./calc');

// factor = how many base units one unit is
const GROUPS = {
  length: { base: 'm', units: { mm: 0.001, cm: 0.01, m: 1, km: 1000, in: 0.0254, ft: 0.3048, yd: 0.9144, mi: 1609.344 } },
  mass: { base: 'kg', units: { mg: 1e-6, g: 0.001, kg: 1, t: 1000, oz: 0.028349523125, lb: 0.45359237 } },
  volume: { base: 'l', units: { ml: 0.001, l: 1, gal: 3.785411784, cup: 0.2365882365, floz: 0.0295735295625 } },
  data: { base: 'b', units: { b: 1, kb: 1024, mb: 1024 ** 2, gb: 1024 ** 3, tb: 1024 ** 4 } },
  time: { base: 's', units: { s: 1, min: 60, h: 3600, d: 86400, wk: 604800 } },
  speed: { base: 'mps', units: { mps: 1, kmh: 1 / 3.6, mph: 0.44704, kn: 0.514444 } },
  area: { base: 'm2', units: { m2: 1, km2: 1e6, ha: 1e4, ft2: 0.09290304, acre: 4046.8564224 } },
};

const ALIASES = {
  millimeter: 'mm', millimeters: 'mm', centimeter: 'cm', centimeters: 'cm', meter: 'm', meters: 'm', metre: 'm',
  kilometer: 'km', kilometers: 'km', inch: 'in', inches: 'in', foot: 'ft', feet: 'ft', yard: 'yd', yards: 'yd',
  mile: 'mi', miles: 'mi', gram: 'g', grams: 'g', kilogram: 'kg', kilograms: 'kg', kgs: 'kg', ton: 't', tons: 't',
  ounce: 'oz', ounces: 'oz', pound: 'lb', pounds: 'lb', lbs: 'lb', liter: 'l', liters: 'l', litre: 'l',
  milliliter: 'ml', gallon: 'gal', gallons: 'gal', cups: 'cup', sec: 's', second: 's', seconds: 's',
  minute: 'min', minutes: 'min', mins: 'min', hour: 'h', hours: 'h', hr: 'h', hrs: 'h', day: 'd', days: 'd',
  week: 'wk', weeks: 'wk', 'km/h': 'kmh', kph: 'kmh', 'm/s': 'mps', knot: 'kn', knots: 'kn',
  sqm: 'm2', 'm²': 'm2', 'km²': 'km2', sqft: 'ft2', 'ft²': 'ft2', hectare: 'ha', acres: 'acre',
  celsius: 'c', fahrenheit: 'f', kelvin: 'k', '°c': 'c', '°f': 'f',
  // Arabic
  'ملم': 'mm', 'مم': 'mm', 'سم': 'cm', 'سنتي': 'cm', 'متر': 'm', 'م': 'm', 'كم': 'km', 'كيلومتر': 'km', 'انش': 'in', 'إنش': 'in',
  'قدم': 'ft', 'ياردة': 'yd', 'ميل': 'mi', 'جرام': 'g', 'غرام': 'g', 'جم': 'g', 'كيلو': 'kg', 'كغ': 'kg', 'كجم': 'kg', 'طن': 't',
  'أونصة': 'oz', 'اونصة': 'oz', 'رطل': 'lb', 'باوند': 'lb', 'لتر': 'l', 'مل': 'ml', 'جالون': 'gal', 'غالون': 'gal', 'كوب': 'cup',
  'ثانية': 's', 'دقيقة': 'min', 'دقائق': 'min', 'ساعة': 'h', 'ساعات': 'h', 'يوم': 'd', 'أيام': 'd', 'ايام': 'd', 'أسبوع': 'wk', 'اسبوع': 'wk',
  'كم/س': 'kmh', 'عقدة': 'kn', 'هكتار': 'ha', 'فدان': 'acre', 'مئوية': 'c', 'سيليزي': 'c', 'فهرنهايت': 'f', 'كلفن': 'k',
  'بايت': 'b', 'كيلوبايت': 'kb', 'ميجا': 'mb', 'ميجابايت': 'mb', 'جيجا': 'gb', 'جيجابايت': 'gb', 'تيرا': 'tb',
};

function unitKey(raw) {
  const u = raw.toLowerCase().replace(/\.$/, '');
  return ALIASES[u] || u;
}

function groupOf(u) {
  if (['c', 'f', 'k'].includes(u)) return 'temp';
  return Object.keys(GROUPS).find((g) => u in GROUPS[g].units) || null;
}

function toC(v, u) {
  return u === 'c' ? v : u === 'f' ? ((v - 32) * 5) / 9 : v - 273.15;
}
function fromC(v, u) {
  return u === 'c' ? v : u === 'f' ? (v * 9) / 5 + 32 : v + 273.15;
}

/** Parse "<number> <unit> to|in|إلى|الى|ب <unit>". Returns {value, from, to, result} or null. */
function convert(input) {
  const s = digits(input).replace(/\s+/g, ' ');
  const m = /^(-?\d*\.?\d+)\s*([^\d\s]+(?:\/[^\s]+)?)\s+(?:to|in|into|=|إلى|الى|لـ|ل|ب|بـ)\s+([^\s]+)$/i.exec(s);
  if (!m) return null;
  const value = parseFloat(m[1]);
  const from = unitKey(m[2]);
  const to = unitKey(m[3]);
  const g = groupOf(from);
  if (!g || g !== groupOf(to) || from === to) return null;
  let result;
  if (g === 'temp') result = fromC(toC(value, from), to);
  else result = (value * GROUPS[g].units[from]) / GROUPS[g].units[to];
  return { value, from, to, result: Math.round(result * 1e6) / 1e6 };
}

module.exports = { convert, unitKey };

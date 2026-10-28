const adhan = require('adhan');
const cities = require('../cities');

const NAMES = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];

/** Location from settings: a preset city, or custom coordinates. */
function location(s) {
  if (s.city === 'custom' && Number.isFinite(s.lat) && Number.isFinite(s.lng) && (s.lat || s.lng)) {
    return { lat: s.lat, lng: s.lng, method: s.prayerMethod || 'UmmAlQura', name: s.cityName || '' };
  }
  const c = cities[s.city] || cities.riyadh;
  return { lat: c.lat, lng: c.lng, method: s.prayerMethod && s.prayerMethod !== 'auto' ? s.prayerMethod : c.method, name: c.ar };
}

/** Prayer times for a day as [{ name, time(ms) }], using the adhan library (offline calculation). */
function timesFor(s, date) {
  const loc = location(s);
  const method = adhan.CalculationMethod[loc.method] ? loc.method : 'UmmAlQura';
  const params = adhan.CalculationMethod[method]();
  params.madhab = s.madhab === 'hanafi' ? adhan.Madhab.Hanafi : adhan.Madhab.Shafi;
  const pt = new adhan.PrayerTimes(new adhan.Coordinates(loc.lat, loc.lng), date, params);
  return NAMES.map((name) => ({ name, time: pt[name].getTime() }));
}

/** Today's and tomorrow's times; the renderer counts down locally. */
function schedule(s, now = new Date()) {
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 12);
  return { location: location(s).name, today: timesFor(s, now), tomorrow: timesFor(s, tomorrow) };
}

module.exports = { schedule, location, timesFor };

const adhan = require('adhan');
const cities = require('../cities');
const hijri = require('./hijri');
const DEFAULTS = require('./prayer-defaults');
const NAMES = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];
const MINUTE = 60000, ADHAN_MS = 2 * MINUTE;
const minute = (value, fallback) => Number.isInteger(value) && value >= 0 && value <= 60 ? value : fallback;
function location(s) {
  if (s.city === 'custom' && Number.isFinite(s.lat) && Number.isFinite(s.lng) && Math.abs(s.lat) <= 90 && Math.abs(s.lng) <= 180 && (s.lat || s.lng)) {
    return { lat: s.lat, lng: s.lng, method: s.prayerMethod || 'UmmAlQura', name: s.cityName || '' };
  }
  const c = cities[s.city] || cities.riyadh;
  return { lat: c.lat, lng: c.lng, method: s.prayerMethod && s.prayerMethod !== 'auto' ? s.prayerMethod : c.method, name: c.ar };
}
function ramadan(s, date) { return s.ramadanMode === 'on' || s.ramadanMode !== 'off' && hijri.get(date, false).month === 9; }
function timesFor(s, date) {
  const loc = location(s), day = hijri.civil(date);
  const method = adhan.CalculationMethod[loc.method] ? loc.method : 'UmmAlQura';
  const params = adhan.CalculationMethod[method]();
  params.madhab = s.madhab === 'hanafi' ? adhan.Madhab.Hanafi : adhan.Madhab.Shafi;
  if (method === 'UmmAlQura' && ramadan(s, date)) params.adjustments.isha = (params.adjustments.isha || 0) + 30;
  // adhan reads the input's host-local civil components; construct noon from the selected Riyadh day.
  const pt = new adhan.PrayerTimes(new adhan.Coordinates(loc.lat, loc.lng), new Date(day.year, day.month - 1, day.day, 12), params);
  return NAMES.map(name => ({ name, time: pt[name].getTime() }));
}
function schedule(s, now = new Date()) {
  return { location: location(s).name, today: timesFor(s, now), tomorrow: timesFor(s, new Date(hijri.midnight(now, 1) + 12 * 60 * MINUTE)) };
}
function windowFor(s, now, getTimes = timesFor) {
  const rows = [-1,0,1].flatMap(d => getTimes(s, new Date(hijri.midnight(new Date(now), d) + 12 * 60 * MINUTE)))
    .filter(p => p.name !== 'sunrise' && Number.isFinite(p.time)).sort((a,b) => a.time - b.time);
  const pre = minute(s.prayerPreMinutes, DEFAULTS.prayerPreMinutes) * MINUTE;
  let phase = 'idle', current = null, phaseEndsAt = null;
  for (const p of rows) {
    const end = p.time + minute(s.prayerIqamaMinutes?.[p.name], DEFAULTS.prayerIqamaMinutes[p.name]) * MINUTE;
    if (now >= p.time && now < p.time + ADHAN_MS) { phase = 'adhan'; current = p; phaseEndsAt = p.time + ADHAN_MS; break; }
    if (now >= p.time + ADHAN_MS && now < end) { phase = 'iqama'; current = p; phaseEndsAt = end; break; }
  }
  const next = rows.find(p => p.time > now) || null;
  if (phase === 'idle' && next && pre && now >= next.time - pre) { phase = 'pre'; phaseEndsAt = next.time; }
  const today = getTimes(s, new Date(now));
  const isRamadan = ramadan(s, new Date(now));
  const fajr = today.find(p => p.name === 'fajr');
  const tomorrowFajr = rows.find(p => p.name === 'fajr' && p.time > (fajr?.time || now));
  const nextFajr = fajr && now < fajr.time ? fajr : tomorrowFajr;
  const iftar = today.find(p => p.name === 'maghrib');
  const boundaries = [hijri.midnight(new Date(now), 1)];
  for (const p of rows) {
    const iqama = minute(s.prayerIqamaMinutes?.[p.name], DEFAULTS.prayerIqamaMinutes[p.name]);
    boundaries.push(p.time - pre, p.time, p.time + ADHAN_MS);
    if (iqama > 2) boundaries.push(p.time + iqama * MINUTE);
  }
  return { state: { next, current, phase, phaseEndsAt, ramadan: isRamadan,
    imsak: isRamadan && nextFajr ? nextFajr.time - 10 * MINUTE : null,
    iftar: isRamadan && Number.isFinite(iftar?.time) ? iftar.time : null, pausedByAdhan: false },
    wakeAt: Math.min(...boundaries.filter(t => t > now)) };
}
class PrayerService {
  constructor({ getSettings, onState, media, now = Date.now, setTimer = setTimeout, clearTimer = clearTimeout, getTimes = timesFor }) {
    Object.assign(this, { getSettings, onState, media, now, setTimer, clearTimer, getTimes });
    this.days = new Map();
    const calculate = this.getTimes;
    this.getTimes = (settings, date) => {
      const key = hijri.midnight(date);
      if (!this.days.has(key)) {
        this.days.set(key, calculate(settings, date));
        if (this.days.size > 3) this.days.delete(this.days.keys().next().value);
      }
      return this.days.get(key);
    };
    this.timer = null; this.active = false; this.pausedByAdhan = false; this.pauseFor = null; this.generation = 0; this.last = '';
  }
  start() { this.active = true; this.update(true); }
  stop() { this.active = false; this.generation++; this.clearTimer(this.timer); this.timer = null; }
  get() { const state = windowFor(this.getSettings(), this.now(), this.getTimes).state; return { ...state, pausedByAdhan: this.pausedByAdhan && ['adhan','iqama'].includes(state.phase) }; }
  emit(force = false) { const state = this.get(), key = JSON.stringify(state); this.snapshot = state; if (force || key !== this.last) { this.last = key; this.onState(state); } return state; }
  update(force = false) {
    this.clearTimer(this.timer); this.timer = null;
    if (!this.active) return;
    const now = this.now(), config = this.getSettings();
    const { state, wakeAt } = windowFor(config, now, this.getTimes);
    const token = state.current?.time;
    if (!['adhan', 'iqama'].includes(state.phase)) this.pausedByAdhan = false;
    this.emit(force);
    // Catch up after startup/suspend during adhan; never backfill old prayers or auto-resume.
    if (state.phase === 'adhan' && config.prayerAutoPause !== false && this.pauseFor !== token && this.media.isPlaying()) {
      this.pauseFor = token;
      const generation = this.generation;
      Promise.resolve(this.media.pauseForAdhan()).then(result => {
        if (!this.active || generation !== this.generation || !result?.ok) return;
        const latest = this.get();
        if (latest.current?.time === token && ['adhan','iqama'].includes(latest.phase)) { this.pausedByAdhan = true; this.emit(); }
      }).catch(() => {});
    }
    // Genuine next-boundary timeout, never a per-second polling interval. First alignment can be <1 minute.
    this.timer = this.setTimer(() => this.update(), Math.max(1, Math.min(2147483647, wakeAt - this.now())));
  }
  changed() { this.generation++; this.days.clear(); this.update(true); }
  mediaChanged(payload) {
    if (payload?.type !== 'media' || !this.active) return;
    if ((!payload.active || payload.playing) && this.pausedByAdhan) { this.pausedByAdhan = false; this.emit(); }
    // Initial SMTC metadata can arrive after startup. Catch it during adhan, once; timeline events in idle are O(1).
    const state = this.snapshot;
    if (payload.active && payload.playing && state?.phase === 'adhan' && this.pauseFor !== state.current?.time) this.update();
  }
  async resume() {
    if (!this.get().pausedByAdhan) return { ok: false };
    const generation = this.generation;
    const result = await this.media.resumeAfterAdhan();
    if (result?.ok && generation === this.generation) { this.pausedByAdhan = false; this.emit(); }
    return { ok: !!result?.ok };
  }
}
module.exports = { location, timesFor, schedule, ramadan, windowFor, PrayerService, ADHAN_MS };

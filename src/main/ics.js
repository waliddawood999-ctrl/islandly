// Minimal iCalendar reader: enough for Google / Outlook / Apple feeds (events, time zones, common recurrences).

const WINDOWS_ZONES = {
  'Arab Standard Time': 'Asia/Riyadh',
  'Arabic Standard Time': 'Asia/Baghdad',
  'Egypt Standard Time': 'Africa/Cairo',
  'Turkey Standard Time': 'Europe/Istanbul',
  'GMT Standard Time': 'Europe/London',
  'W. Europe Standard Time': 'Europe/Berlin',
  'Romance Standard Time': 'Europe/Paris',
  'Eastern Standard Time': 'America/New_York',
  'Central Standard Time': 'America/Chicago',
  'Mountain Standard Time': 'America/Denver',
  'Pacific Standard Time': 'America/Los_Angeles',
  'India Standard Time': 'Asia/Kolkata',
  'Pakistan Standard Time': 'Asia/Karachi',
  'Arabian Standard Time': 'Asia/Dubai',
  'UTC': 'UTC',
};

const DAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
const JOIN_LINK = /https?:\/\/[^\s<>"')\\]*(?:zoom\.us|meet\.google\.com|teams\.microsoft\.com|teams\.live\.com|webex\.com|whereby\.com)[^\s<>"')\\]*/i;

function unfold(text) {
  return text.replace(/\r?\n[ \t]/g, '').split(/\r?\n/);
}

function unescapeText(v) {
  return String(v || '').replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');
}

function parseLine(line) {
  const colon = line.indexOf(':');
  if (colon < 0) return null;
  const head = line.slice(0, colon).split(';');
  const params = {};
  for (const p of head.slice(1)) {
    const eq = p.indexOf('=');
    if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, '');
  }
  return { name: head[0].toUpperCase(), params, value: line.slice(colon + 1) };
}

function zoneOffsetMs(timeZone, utcMs) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  }).formatToParts(new Date(utcMs));
  const get = (type) => Number(parts.find((p) => p.type === type).value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

/** Wall-clock fields in a zone -> UTC milliseconds. tz = null means the machine's local zone. */
function wallToUtc(y, mo, d, h, mi, s, tz) {
  if (!tz) return new Date(y, mo, d, h, mi, s).getTime();
  let guess = Date.UTC(y, mo, d, h, mi, s);
  try {
    guess -= zoneOffsetMs(tz, guess);
    guess = Date.UTC(y, mo, d, h, mi, s) - zoneOffsetMs(tz, guess);
    return guess;
  } catch (_) {
    return new Date(y, mo, d, h, mi, s).getTime();
  }
}

function resolveZone(tzid) {
  if (!tzid) return null;
  const mapped = WINDOWS_ZONES[tzid] || tzid;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: mapped });
    return mapped;
  } catch (_) {
    return null;
  }
}

/** Parse a DTSTART/DTEND style value. Returns { wall:[y,mo,d,h,mi,s], tz, utc, allDay }. */
function parseDate(prop) {
  const v = prop.value.trim();
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/);
  if (!m) return null;
  const wall = [+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)];
  const allDay = !m[4] || prop.params.VALUE === 'DATE';
  let tz = null;
  let utc;
  if (m[7]) {
    utc = Date.UTC(...wall);
    tz = 'UTC';
  } else {
    tz = resolveZone(prop.params.TZID);
    utc = wallToUtc(...wall, tz);
  }
  return { wall, tz, utc, allDay };
}

function parseRule(value) {
  const rule = {};
  for (const part of value.split(';')) {
    const [k, v] = part.split('=');
    rule[k.toUpperCase()] = v;
  }
  return {
    freq: rule.FREQ,
    interval: Number(rule.INTERVAL || 1),
    count: rule.COUNT ? Number(rule.COUNT) : Infinity,
    until: rule.UNTIL ? parseDate({ value: rule.UNTIL, params: {} }) : null,
    byDay: rule.BYDAY ? rule.BYDAY.split(',') : [],
    byMonthDay: rule.BYMONTHDAY ? rule.BYMONTHDAY.split(',').map(Number) : [],
  };
}

function nthWeekday(year, month, weekday, n) {
  if (n > 0) {
    const first = new Date(Date.UTC(year, month, 1)).getUTCDay();
    const day = 1 + ((weekday - first + 7) % 7) + (n - 1) * 7;
    return day <= new Date(Date.UTC(year, month + 1, 0)).getUTCDate() ? day : null;
  }
  const lastDate = new Date(Date.UTC(year, month + 1, 0));
  const back = (lastDate.getUTCDay() - weekday + 7) % 7;
  const day = lastDate.getUTCDate() - back + (n + 1) * 7;
  return day >= 1 ? day : null;
}

/** Yield wall-clock dates [y, mo, d] of every occurrence from DTSTART, lazily and in order. */
function* occurrenceDates(start, rule) {
  const [y0, mo0, d0] = start.wall;
  const base = Date.UTC(y0, mo0, d0);
  const step = Math.max(1, rule.interval);
  const limit = 5000;

  if (rule.freq === 'DAILY') {
    for (let i = 0; i < limit; i++) {
      const dt = new Date(base + i * step * 86400000);
      yield [dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()];
    }
  } else if (rule.freq === 'WEEKLY') {
    const days = rule.byDay.length ? rule.byDay.map((c) => DAY_CODES.indexOf(c.slice(-2))) : [new Date(base).getUTCDay()];
    const weekStart = base - ((new Date(base).getUTCDay() + 6) % 7) * 86400000; // Monday of the first week
    for (let w = 0; w < limit; w++) {
      const monday = weekStart + w * step * 7 * 86400000;
      const sorted = days.map((d) => (d + 6) % 7).sort((a, b) => a - b);
      for (const offset of sorted) {
        const ms = monday + offset * 86400000;
        if (ms < base) continue;
        const dt = new Date(ms);
        yield [dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()];
      }
    }
  } else if (rule.freq === 'MONTHLY') {
    for (let i = 0; i < limit; i++) {
      const month = mo0 + i * step;
      const year = y0 + Math.floor(month / 12);
      const mo = ((month % 12) + 12) % 12;
      let days = [];
      if (rule.byDay.length) {
        for (const code of rule.byDay) {
          const n = parseInt(code, 10) || 0;
          const wd = DAY_CODES.indexOf(code.slice(-2));
          if (n) {
            const d = nthWeekday(year, mo, wd, n);
            if (d) days.push(d);
          } else {
            const dim = new Date(Date.UTC(year, mo + 1, 0)).getUTCDate();
            for (let d = 1; d <= dim; d++) if (new Date(Date.UTC(year, mo, d)).getUTCDay() === wd) days.push(d);
          }
        }
      } else if (rule.byMonthDay.length) {
        days = rule.byMonthDay.map((d) => (d < 0 ? new Date(Date.UTC(year, mo + 1, 0)).getUTCDate() + d + 1 : d));
      } else {
        days = [d0];
      }
      const dim = new Date(Date.UTC(year, mo + 1, 0)).getUTCDate();
      for (const d of days.sort((a, b) => a - b)) {
        if (d < 1 || d > dim) continue;
        if (Date.UTC(year, mo, d) < base) continue;
        yield [year, mo, d];
      }
    }
  } else if (rule.freq === 'YEARLY') {
    for (let i = 0; i < 200; i++) yield [y0 + i * step, mo0, d0];
  }
}

function findJoinLink(...texts) {
  for (const t of texts) {
    const m = t && String(t).match(JOIN_LINK);
    if (m) return m[0];
  }
  return null;
}

/** Parse an ICS document and return events starting between [from, to], sorted by start time. */
function upcomingEvents(icsText, from, to) {
  const lines = unfold(icsText);
  const raw = [];
  let cur = null;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') cur = [];
    else if (line === 'END:VEVENT') {
      if (cur) raw.push(cur);
      cur = null;
    } else if (cur) {
      const p = parseLine(line);
      if (p) cur.push(p);
    }
  }

  const events = [];
  const overridden = new Set();
  const parsed = raw.map((props) => {
    const get = (name) => props.find((p) => p.name === name);
    const all = (name) => props.filter((p) => p.name === name);
    return { get, all };
  });

  // Edited single instances of a recurring event replace the original occurrence.
  for (const ev of parsed) {
    const rid = ev.get('RECURRENCE-ID');
    const uid = ev.get('UID');
    if (rid && uid) {
      const d = parseDate(rid);
      if (d) overridden.add(uid.value + '|' + d.utc);
    }
  }

  for (const ev of parsed) {
    const status = ev.get('STATUS');
    if (status && status.value.toUpperCase() === 'CANCELLED') continue;
    const dtstart = ev.get('DTSTART');
    if (!dtstart) continue;
    const start = parseDate(dtstart);
    if (!start) continue;
    const dtend = ev.get('DTEND');
    const end = dtend ? parseDate(dtend) : null;
    const duration = end ? end.utc - start.utc : start.allDay ? 86400000 : 0;
    const uid = (ev.get('UID') || { value: Math.random().toString(36) }).value;
    const title = unescapeText((ev.get('SUMMARY') || { value: '' }).value) || '(no title)';
    const location = unescapeText((ev.get('LOCATION') || { value: '' }).value);
    const description = unescapeText((ev.get('DESCRIPTION') || { value: '' }).value);
    const url = findJoinLink((ev.get('URL') || {}).value, location, description);
    const base = { title, location, url, allDay: start.allDay };

    const rrule = ev.get('RRULE');
    if (!rrule) {
      if (start.utc + duration >= from && start.utc <= to) events.push({ ...base, id: uid, start: start.utc, end: start.utc + duration });
      continue;
    }

    const rule = parseRule(rrule.value);
    const excluded = new Set();
    for (const ex of ev.all('EXDATE')) {
      for (const v of ex.value.split(',')) {
        const d = parseDate({ value: v, params: ex.params });
        if (d) excluded.add(d.utc);
      }
    }
    let n = 0;
    for (const [y, mo, d] of occurrenceDates(start, rule)) {
      const s = wallToUtc(y, mo, d, start.wall[3], start.wall[4], start.wall[5], start.tz === 'UTC' ? 'UTC' : start.tz);
      if (rule.until && s > rule.until.utc) break;
      if (++n > rule.count) break;
      if (s > to) break;
      if (s + duration < from) continue;
      if (excluded.has(s) || overridden.has(uid + '|' + s)) continue;
      events.push({ ...base, id: uid + '@' + s, start: s, end: s + duration });
    }
  }

  return events.sort((a, b) => a.start - b.start);
}

module.exports = { upcomingEvents, findJoinLink };

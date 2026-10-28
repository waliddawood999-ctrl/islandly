const assert = require('assert');
const { upcomingEvents } = require('../src/main/ics');

const ics = [
  'BEGIN:VCALENDAR',
  // one-off, UTC
  'BEGIN:VEVENT', 'UID:a1', 'DTSTART:20260310T090000Z', 'DTEND:20260310T100000Z', 'SUMMARY:One off',
  'DESCRIPTION:Join https://meet.google.com/abc-defg-hij\\nbye', 'END:VEVENT',
  // weekly Sun+Tue 10:00 Riyadh, with one exception and one moved instance
  'BEGIN:VEVENT', 'UID:w1', 'DTSTART;TZID=Asia/Riyadh:20260301T100000', 'DTEND;TZID=Asia/Riyadh:20260301T110000',
  'RRULE:FREQ=WEEKLY;BYDAY=SU,TU', 'EXDATE;TZID=Asia/Riyadh:20260308T100000', 'SUMMARY:Standup', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:w1', 'RECURRENCE-ID;TZID=Asia/Riyadh:20260310T100000', 'DTSTART;TZID=Asia/Riyadh:20260310T150000',
  'DTEND;TZID=Asia/Riyadh:20260310T160000', 'SUMMARY:Standup (moved)', 'END:VEVENT',
  // cancelled
  'BEGIN:VEVENT', 'UID:c1', 'DTSTART:20260311T090000Z', 'STATUS:CANCELLED', 'SUMMARY:Nope', 'END:VEVENT',
  // monthly, 2nd Monday, folded line
  'BEGIN:VEVENT', 'UID:m1', 'DTSTART;TZID=Europe/London:20260112T140000', 'DTEND;TZID=Europe/London:20260112T150000',
  'RRULE:FREQ=MONTHLY;BYDAY=2MO', 'SUMMARY:Long', ' title', 'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

const from = Date.UTC(2026, 2, 1);
const to = Date.UTC(2026, 2, 20);
const ev = upcomingEvents(ics, from, to);
const fmt = (e) => `${new Date(e.start).toISOString().slice(0, 16)} ${e.title}`;
const out = ev.map(fmt);
console.log(out.join('\n'));

// Riyadh is UTC+3: 10:00 local = 07:00Z
assert(out.includes('2026-03-01T07:00 Standup'), 'sunday occurrence');
assert(out.includes('2026-03-03T07:00 Standup'), 'tuesday occurrence');
assert(!out.includes('2026-03-08T07:00 Standup'), 'EXDATE removed');
assert(!out.includes('2026-03-10T07:00 Standup'), 'moved instance replaced');
assert(out.includes('2026-03-10T12:00 Standup (moved)'), 'moved instance present');
assert(out.includes('2026-03-15T07:00 Standup'), 'next sunday');
assert(out.includes('2026-03-10T09:00 One off'), 'one-off');
assert(!out.some((l) => l.includes('Nope')), 'cancelled skipped');
assert(out.includes('2026-03-09T14:00 Longtitle'), '2nd Monday of March, London (GMT in early March)');
assert.strictEqual(ev.find((e) => e.title === 'One off').url, 'https://meet.google.com/abc-defg-hij');
console.log('ics ok');

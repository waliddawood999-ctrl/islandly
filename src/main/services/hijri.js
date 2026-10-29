// Offline Umm al-Qura calendar. A single lazy formatter is shared by prayer and Hijri IPC.
const TIME_ZONE = 'Asia/Riyadh';
const OFFSET = 3 * 60 * 60 * 1000; // Riyadh civil time: UTC+03, no DST in the supported contemporary calendar.
const AR = ['محرم','صفر','ربيع الأول','ربيع الآخر','جمادى الأولى','جمادى الآخرة','رجب','شعبان','رمضان','شوال','ذو القعدة','ذو الحجة'];
const EN = ['Muharram','Safar','Rabi al-Awwal','Rabi al-Thani','Jumada al-Ula','Jumada al-Akhirah','Rajab','Sha\u2019ban','Ramadan','Shawwal','Dhu al-Qadah','Dhu al-Hijjah'];
let formatter;
function civil(date = new Date()) {
  const shifted = new Date(+date + OFFSET);
  if (!Number.isFinite(+shifted)) throw Error('invalid date');
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, day: shifted.getUTCDate() };
}
function midnight(date = new Date(), days = 0) {
  const d = civil(date);
  return Date.UTC(d.year, d.month - 1, d.day + days) - OFFSET;
}
const event = (id, ar, en) => ({ id, ar, en });
function occasion(month, day, g) {
  if (g.month === 2 && g.day === 22) return event('founding-day', 'يوم التأسيس', 'Saudi Founding Day');
  if (g.month === 9 && g.day === 23) return event('national-day', 'اليوم الوطني السعودي', 'Saudi National Day');
  if (month === 9) return event('ramadan', 'رمضان', 'Ramadan');
  if (month === 10 && day <= 3) return event('eid-fitr', 'عيد الفطر', 'Eid al-Fitr');
  if (month === 12 && day === 9) return event('arafah', 'يوم عرفة', 'Day of Arafah');
  if (month === 12 && day >= 10 && day <= 13) return event('eid-adha', 'عيد الأضحى', 'Eid al-Adha');
  if (month === 12 && day <= 10) return event('dhul-hijjah-ten', 'العشر من ذي الحجة', 'First ten days of Dhu al-Hijjah');
  if (month === 1 && day === 10) return event('ashura', 'عاشوراء', 'Ashura');
  if (month === 1 && day === 1) return event('hijri-new-year', 'رأس السنة الهجرية', 'Islamic New Year');
  return null;
}
function get(date = new Date(), showOccasions = true) {
  formatter ||= new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { timeZone: TIME_ZONE, year: 'numeric', month: 'numeric', day: 'numeric' });
  const parts = Object.fromEntries(formatter.formatToParts(date).map(p => [p.type, p.value]));
  const day = Number(parts.day), month = Number(parts.month), year = Number(parts.year);
  return { day, month, year, monthNameAr: AR[month - 1], monthNameEn: EN[month - 1], occasion: showOccasions ? occasion(month, day, civil(date)) : null };
}
module.exports = { get, civil, midnight, TIME_ZONE };

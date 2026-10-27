const STRINGS = {
  ar: {
    music: 'الموسيقى',
    timer: 'المؤقت',
    battery: 'البطارية',
    nothingPlaying: 'لا يوجد شيء يعمل الآن',
    openPlayer: 'شغّل أغنية من أي تطبيق',
    mediaUnavailable: 'قراءة الموسيقى تعمل على ويندوز فقط',
    focus: 'تركيز',
    rest: 'استراحة',
    focusSession: 'جلسة تركيز',
    restSession: 'وقت استراحة',
    start: 'ابدأ',
    pause: 'إيقاف مؤقت',
    resume: 'متابعة',
    reset: 'إعادة',
    min: 'د',
    hour: 'س',
    sessionDone: 'انتهت الجلسة',
    restDone: 'انتهت الاستراحة',
    timeForRest: 'حان وقت الاستراحة',
    timeToFocus: 'جاهز لجلسة جديدة؟',
    charging: 'يشحن',
    onBattery: 'على البطارية',
    full: 'مكتملة',
    left: 'متبقي',
    untilFull: 'حتى الامتلاء',
    calculating: 'جارٍ الحساب…',
    tip80: 'افصل الشاحن عند ٨٠٪ لإطالة عمر البطارية',
    low: 'البطارية منخفضة',
    plugged: 'تم توصيل الشاحن',
    unplugged: 'تم فصل الشاحن',
  },
  en: {
    music: 'Music',
    timer: 'Timer',
    battery: 'Battery',
    nothingPlaying: 'Nothing playing',
    openPlayer: 'Play something in any app',
    mediaUnavailable: 'Music info works on Windows only',
    focus: 'Focus',
    rest: 'Break',
    focusSession: 'Focus session',
    restSession: 'Break time',
    start: 'Start',
    pause: 'Pause',
    resume: 'Resume',
    reset: 'Reset',
    min: 'm',
    hour: 'h',
    sessionDone: 'Session complete',
    restDone: 'Break is over',
    timeForRest: 'Time for a break',
    timeToFocus: 'Ready for another round?',
    charging: 'Charging',
    onBattery: 'On battery',
    full: 'Fully charged',
    left: 'left',
    untilFull: 'until full',
    calculating: 'Calculating…',
    tip80: 'Unplug at 80% to extend battery life',
    low: 'Battery low',
    plugged: 'Charger connected',
    unplugged: 'Charger disconnected',
  },
};

const LANG = (() => {
  try {
    const saved = localStorage.getItem('islandly.lang');
    if (saved === 'ar' || saved === 'en') return saved;
  } catch (_) {
    /* storage may be unavailable */
  }
  return (navigator.language || 'ar').toLowerCase().startsWith('en') ? 'en' : 'ar';
})();

document.documentElement.lang = LANG;
document.documentElement.dir = LANG === 'ar' ? 'rtl' : 'ltr';

const t = (key) => STRINGS[LANG][key] || key;

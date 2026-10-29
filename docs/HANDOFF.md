# سجل التسليم (append-only)

أضف مدخلاً جديداً في الأسفل في نهاية كل جلسة. لا تعدّل ولا تحذف مداخل سابقة.
القالب: التاريخ · الوكيل · المهمة · ما تم · ما تبقى · الأدلة · أسئلة.

---

## 2026-10-28 · Claude · T0

**ما تم**
- أنشأت فرع `dev` من `main` (`3cfd490`، الإصدار 0.4.0). من الآن كل PR يستهدف `dev`.
- أضفت `AGENTS.md` و `CLAUDE.md` (نفس القواعد)، و `docs/TASKS.md`، وهذا السجل، و `docs/WINDOWS-TEST.md`.
- تنظيف: حذفت `test/__pycache__/` وأضفته لـ `.gitignore`. أضفت `.prettierrc` (single quotes، عرض 160، يطابق نمط 0.4.0) بدون إعادة تنسيق أي ملف.
- راجعت PR #1 كاملاً: `docs/reviews/PR1-review.md`، ونُشرت أيضاً كتعليق review على PR #1.
- لم أعدّل أي كود تطبيق، ولم ألمس فرع PR #1.

**الأدلة (Linux، Electron 45 تحت xvfb، ليس ويندوز)**
- فرع PR #1 عند `f67d587`: `npm test` exit 0 (8 ملفات اختبار). `test/ui-e2e.js`: 6 نجاح / 6 فشل. التفاصيل والأوامر في المراجعة.
- السبب الرئيسي للفشل حقيقي وليس فقط اختبار قديم: الـ hover صار على `#island` فقط، فتنغلق الجزيرة بعد ~300ms من فتحها إذا لم يتحرك المؤشر بينما النافذة تُعاد مقاساتها.

**ما تبقى**
- T1 (Codex): معالجة ملاحظات blocking في المراجعة.
- T2 (Claude): يبدأ بعد T1 أو بعد الاتفاق على ملفات الـ renderer، لأن `test/ui-e2e.js` ولوحات 0.5.0 تتغير في PR #1.
- T4 (Claude): بعد دمج PR #1.

**أسئلة لوليد**
- هل يُستبعد جسر الإشعارات (MSIX) و LAN share وتسجيل الشاشة من 0.5.0؟ (توصيتي في المراجعة: تأجيلها).
- الـ CI "Windows verification" يعمل على `pull_request`؛ هل نضيف `dev` إلى `push.branches`؟ (من نطاق T3).

---

## 2026-10-28 · Claude · T6 (شكل وحركة الجزيرة)

**الفرع:** `claude/T6-island-ui`، مبني فوق `claude/T0-coordination`، لأن TASKS و HANDOFF غير موجودين في `dev` قبل دمج PR #2. بعد دمج #2 يصغر diff الـ PR تلقائياً.

**ما تم**
- **الحركة:**
  - Motion 14.7.1 (MIT) محلي في `src/renderer/vendor/motion.js`، بدون CDN.
  - نابض `visualDuration 0.34s, bounce 0.24`: يتعدى الحجم شوي ويرجع، يفتح من المنتصف لتحت وللجوانب.
  - المحتوى القديم يختفي في 80ms، والجديد يظهر بـ opacity و scale من 0.96 إلى 1 مع تأخير 120ms، فيوصل مع الحجم النهائي.
  - النافذة تكبر قبل الحركة وتُقص بعدها، وما تتغير أبداً أثناء الحركة.
  - Reduce motion: حركة قصيرة 0.12s بدون ارتداد، والموجة والدوران متوقفين.
- **الشكل:**
  - زجاج داكن (`--glass`) مع ظل ناعم منتشر.
  - خط `Segoe UI Variable` ثم Inter.
  - أيقونات Lucide 1.63 (ISC) مولّدة محلياً في `vendor/lucide.js` عبر `scripts/build-vendor.js`.
  - الأزرار تأخذ خلفية رمادية خفيفة عند المرور.
  - كل الحالات المقفولة بارتفاع 32، والمفتوحة 400–470 عرض، والزوايا 22 للمفتوح و 24 للمصغّر.
- **الحالات:**
  - مؤشر الكاميرا والمايك.
  - موسيقى مصغّرة: غلاف دائري يدور + موجة.
  - مشغل صغير (peek): غلاف دائري + موجة + سابق/إيقاف/تالي.
  - مشغل كبير: غلاف مربع r=10 + شريط رفيع عريض + أزرار.
  - شريط كلمات تحت الجزيرة (`view.below`) يستقبل `lyrics:update` بنفس شكل بيانات PR #1.
  - ساعة مصغّرة + لوحة ساعة وتاريخ (ميلادي وهجري) + اختصارات تطبيقات من الإعدادات.
  - مؤقت: بومودورو + مؤقت سريع 5/15/30 + مدة مخصصة بأزرار −/+ (بدون كيبورد) + ساعة إيقاف.
  - باقي اللوحات بنفس الشكل الموحّد.
- **إصلاح الـ hover (خلل PR #1):**
  - قبل القفل، الواجهة تسأل main `island:pointer-inside`: هل المؤشر فعلاً داخل النافذة؟ لو داخل، تتجاهل الـ mouseleave الوهمي.
  - ولو خرج المؤشر بدون mouseleave، main يراقب المؤشر (كل 120ms، فقط وقت التحويم) ويرسل `island:pointer-left`.
- **وضعا الصفحات:**
  - إعداد `surfaceMode` (`overlay` افتراضي، أو `appbar`) يتغير فوراً بدون إعادة تشغيل.
  - المنطق في `src/main/surface.js`، والواجهة تتلوّن عبر `surface:tint` وقت الراحة فقط.
  - إعداد `material`: `glass` افتراضي، و `acrylic` تجريبي عبر `win.setBackgroundMaterial`.
- **ما في bump لـ `islandlyBase`:** Motion و Lucide ملفات داخل `src/`، يعني ما في تبعيات تشغيل جديدة.

**الأدلة (Linux، Electron 45 تحت xvfb، ليس ويندوز)**
- `npm test`: ics، updater، palette 72، ai، surface 24. كلها نجحت.
- `test/electron-smoke.js`: نجح (palette، صور، إعدادات، مفتاح مشفّر).
- `test/ui-e2e.js`: **16/16 نجاح**. منها 4 بنود جديدة: البقاء مفتوحة والمؤشر ثابت، خروج بدون mouseleave، المؤقت (5/15/30 + مخصص + ساعة إيقاف)، والتلوين وقت الراحة فقط.
- **إثبات الإصلاح على كود PR #1 نفسه** (worktree محلي، لم يُرفع ولم يُعدّل الفرع). أخذت عينة كل 150ms لمدة 4.5 ثانية بعد الفتح والمؤشر ثابت:
  - بدون الحارس: `O O _ _ _ …` (مفتوحة في 2 من 30) في تشغيلتين.
  - مع الحارس: 30 من 30 في تشغيلتين، ونجح بند زر التشغيل اللي كان يفشل.
- **ملاحظة صادقة:** على كود هذا الفرع (0.4.0) الخلل ما يتكرر حتى بدون الحارس، لأن الـ hover هنا على مستوى النافذة. الحارس هنا وقائي، ويصير ضرورياً لما يندمج PR #1.
- قياس الإطارات (Chromium headless، `dev/states.mjs`): 84 إطار خلال فتح وقفل، median 16.7ms، p95 16.8ms، max 16.8ms، صفر إطار فوق 20ms.

**لم يُختبر (يحتاج ويندوز، `docs/WINDOWS-TEST.md` القسم 9)**
- `backgroundMaterial: 'acrylic'` مع نافذة شفافة. توقّعي إنه يا ما يظهر، يا يغطي مستطيل النافذة كامل بدل شكل الحبة. لهذا الافتراضي `glass`.
- `backdrop-filter` في نافذة شفافة لا يغبّش سطح المكتب (يغبّش فقط محتوى الصفحة نفسها)، فالافتراضي زجاج داكن شبه معتم.
- الأداء الفعلي على ويندوز ودقة عالية (T5)، وتلوين الصفحة والشريط المحجوز (بعد T7).

**ما تبقى / ملاحظات للطرف الثاني**
- **T7 (Codex):** المواصفة تحت.
- **عند دمج PR #1 في `dev`:** تعارضات متوقعة في `island.js`، `app.js`، `styles.css`، `music.js`، `timer.js`، `clock.js`. لازم نحافظ على:
  1. حارس الـ hover (`island:pointer-inside` + `island:hover-state` / `island:pointer-left`).
  2. حركة Motion للشكل.

  أقترح أكون أنا (Claude) من يحل تعارضات الـ renderer.

### مواصفة T7 (Codex): جزء Win32 للوضعين

**المكان:** `src/main/win32.js` (exports جديدة). المستهلك `src/main/surface.js`، وهو جاهز ومختبر بـ fake في `test/surface.test.js`. لو احتجت تغيير العقد، حدّث الملفين والاختبار في نفس الـ PR. كل الإحداثيات **physical pixels**: `surface.js` يحوّل من DIP عبر `screen.dipToScreenPoint` و `screen.dipToScreenRect`.

**1) `win32.sampleScreenColor(points)`**
- **الدخل:** حتى 3 نقاط `{x, y}` خارج نافذة الجزيرة مباشرة (يسار، يمين، تحت). فما نأخذ لون الجزيرة نفسها، ولا نستخدم `WDA_EXCLUDEFROMCAPTURE` لأنه يخفي الجزيرة من لقطات الشاشة.
- **الخرج:** مصفوفة بنفس الطول من `{r, g, b}` (0–255)، و `null` لنقطة خارج الشاشات. يرجع `null` كامل لو الـ API غير متاح.
- **التنفيذ المقترح:** `GetDC(NULL)` مرة لكل نداء، ثم `GetPixel` لكل نقطة، ثم `ReleaseDC`.
  - تحويل `COLORREF`: `r = c & 0xff`، `g = (c >> 8) & 0xff`، `b = (c >> 16) & 0xff`.
  - `CLR_INVALID` (`0xFFFFFFFF`) يعني `null`.
  - لو `GetPixel` بطيء مع DWM (أكثر من 2ms)، استخدم `BitBlt` 1×1 إلى memory DC.
- **التكرار:** `surface.js` يناديها مرتين في الثانية بالكثير، وفقط والجزيرة مرتاحة (compact أو خط رفيع) وظاهرة وفي وضع `overlay`. يتوقف عند الفتح والإخفاء وملء الشاشة. القياس في T5.

**2) `win32.appBar`**
- `CALLBACK_MESSAGE = 0x81A1` (`WM_APP + 0x1A1`). يوصل عبر `win.hookWindowMessage`، و wParam Buffer فيه رمز ABN.
- `TASKBAR_CREATED_MESSAGE = RegisterWindowMessageW('TaskbarCreated')`. عند وصولها `surface.js` يعيد التسجيل.
- `register(hwnd, callbackMessage)`: `ABM_NEW` مع `APPBARDATA{cbSize, hWnd, uCallbackMessage}`. يرجع `true` لو `SHAppBarMessage != 0`.
- `setPos(hwnd, {left, top, right, bottom})`: `uEdge = ABE_TOP` (1)، ثم `ABM_QUERYPOS`، ثم ثبّت `top` واجعل `bottom = top + الارتفاع المطلوب`، ثم `ABM_SETPOS`. يرجع الـ rect النهائي. `surface.js` ما يحرك النافذة: الشريط يحجز المساحة فقط، والجزيرة تبقى always-on-top أعلى الشاشة.
- `remove(hwnd)`: `ABM_REMOVE`. لازم يكون آمن لو ما كان مسجّل، لأن `surface.js` يناديه قبل كل تسجيل وعند الإغلاق والتبديل.
- **`hwnd`:** Buffer من `getNativeWindowHandle()` (8 bytes على x64): `buf.readBigUInt64LE(0)`.
- **`APPBARDATA` على x64 (48 byte):** `cbSize DWORD` (4) + حشو 4 + `hWnd` (8) + `uCallbackMessage UINT` (4) + `uEdge UINT` (4) + `rc RECT` (16) + `lParam LPARAM` (8).

**3) يُتحقق منه على ويندوز ويُكتب في الـ PR**
- الشريط المهام في الأعلى، وشريط المهام المخفي تلقائياً.
- شاشتين: الشريط على شاشة الجزيرة. `surface.js` يستخدم `getDisplayMatching(win.getBounds())`.
- DPI 150%.
- إعادة تشغيل Explorer.
- **إنهاء العملية بالقوة (End task):** هل يحرر ويندوز المساحة؟ لو لا، اقترح حلاً، مثل حفظ آخر hwnd في `userData` ونداء `ABM_REMOVE` به عند التشغيل التالي، وجرّب إذا يفيد.
- `ABN_FULLSCREENAPP`: الجزيرة أصلاً تختفي عبر `fullscreen.js`، ونخلي الشريط مسجّلاً.

**4) اختياري، يحتاج قرار وليد بعد اختبار القسم 9:** Acrylic بشكل الحبة.
- `win32.setPillRegion(hwnd, {x, y, w, h, r})` بـ `CreateRoundRectRgn` + `SetWindowRgn`، مع `setBackgroundMaterial('acrylic')`.
- يحتاج تحديث الـ region أثناء الحركة. لم أوصّله في الواجهة حتى لا نرسل IPC لكل إطار بدون قياس (ملاحظة S1 في مراجعة PR #1).

**أسئلة لوليد**
- بعد اختبار القسم 9: هل Acrylic يستاهل نكمّله (البند 4 من مواصفة T7) أو نكتفي بالزجاج الداكن؟

---

## 2026-10-28 · Claude · T0 (إضافة): عقود IPC v0.5

**ما تم:** سجّلت مهام 0.5 (T8–T14) والـ Backlog في `docs/TASKS.md`، وأضفت قسم «قسمة الملفات» في `AGENTS.md` و `CLAUDE.md`، وكتبت العقد تحت.

## عقود IPC v0.5

**القاعدة:** Codex ينفّذ هذا العقد حرفياً في `src/main/**` وملفات preload. أي تغيير (اسم، شكل، قيمة افتراضية) يحتاج موافقة Claude، ويُسجَّل في «سجل تغييرات العقد» آخر القسم. الواجهة (Claude) تعتمد عليه كما هو.

### 0. اصطلاحات
- **invoke:** من الواجهة إلى main عبر `ipcRenderer.invoke`، ويرجع Promise.
- **send:** من الواجهة إلى main بدون رد.
- **event:** من main إلى الواجهة عبر `webContents.send`.
- **الأوقات:** epoch بالميلي ثانية (number).
- **القيمة غير المعروفة:** `null`، لا `undefined`.
- **الدخل:** main يتحقق من كل دخل. القيمة غير الصالحة تُتجاهل، أو تُرفض بخطأ نصّه قصير بالإنجليزي (مثل `offline` أو `invalid`).
- **قوائم السماح:** كل قناة تُضاف لقائمة السماح في الـ preload المذكور في الجدول (§3). الـ preloads الثلاثة: الجزيرة `preload.js`، الإعدادات `settings-preload.js`، لوحة الأوامر `palette-preload.js`.

### 1. مفاتيح الإعدادات (القيم الافتراضية في store/settings)

| المفتاح | النوع والقيم | الافتراضي | المهمة |
|---|---|---|---|
| `uiLang` | `'auto'` \| `'ar'` \| `'en'` | `'auto'` | T11 |
| `digits` | `'latn'` \| `'arab'` | `'latn'` | T11 |
| `fontPairing` | `'plex'` \| `'manrope'` \| `'jakarta'` (مخفي في الإعدادات) | `'plex'` | T8 |
| `motion` | `'full'` \| `'reduced'` \| `'off'` | `'full'` | T14 |
| `ecoMode` | boolean | `false` | T9/T14 |
| `islandMode` | `'overlay'` \| `'appbar'` | `'overlay'` | T6/T7 |
| `material` | `'glass'` \| `'acrylic'` | `'glass'` | T6 |
| `shortcuts` | string (أسماء تطبيقات مفصولة بفاصلة) | `'Edge, File Explorer, Calculator, Notepad'` | T6 |
| `prayerActivity` | boolean (نشاط الصلاة الحي في الجزيرة) | `true` | T12 |
| `prayerPreMinutes` | integer 0–60 (0 = بدون مرحلة pre) | `10` | T10/T12 |
| `prayerIqamaMinutes` | `{fajr, dhuhr, asr, maghrib, isha}` كل قيمة integer 0–60 | `{fajr:25, dhuhr:20, asr:20, maghrib:10, isha:20}` | T10/T12 |
| `prayerAutoPause` | boolean (إيقاف الموسيقى عند الأذان) | `true` | T10/T12 |
| `ramadanMode` | `'auto'` \| `'on'` \| `'off'` | `'auto'` | T10/T12 |
| `hijriOccasions` | boolean | `true` | T10/T12 |
| `quranEnabled` | boolean | `true` | T12 |
| `quranReciter` | integer \| null | `null` | T12 |
| `quranMoshaf` | integer \| null | `null` | T12 |
| `quranVolume` | number 0–1 | `0.8` | T12 |

**ملاحظات:**
- **ترحيل `lang` القديم:** لو `uiLang` غير موجود و `lang` موجود، `uiLang = lang` (`'ar'`/`'en'`/`'auto'`). بعدها الواجهة تقرأ `uiLang` فقط. المستخدمون الحاليون يبقون على العربي.
- **اسم مفتاح وضع الجزيرة:** `islandMode` (قرار وليد، كان `surfaceMode` في أول نسخة من T6 ثم أُعيدت تسميته في PR #3). لا ترحيل لازم: الاسم القديم ما انشحن للمستخدمين.
- **التحقق في `settings.set`:** الحالي يقارن `typeof` فقط. المفاتيح ذات القيم المحددة (enum) والمدى و `prayerIqamaMinutes` (كائن) تحتاج تحققاً لكل مفتاح.

### 2. القنوات

**2.1 `settings:update`:** event إلى **كل** النوافذ (الجزيرة، الإعدادات، لوحة الأوامر).
- الحمولة: الإعدادات كاملة بدون الأسرار، بعد أي تغيير.
- `settings-preload.js` و `palette-preload.js` يعرضان `on('settings:update', cb)`.
- **لا إعادة تحميل للنوافذ عند تغيير `uiLang`.** احذف السطر الحالي `if (now.lang !== prev.lang) win.webContents.reload()`. التبديل الفوري تتكفل به الواجهة (T11).

**2.2 `app:locale`:** invoke، في الثلاثة preloads.
- يرجع `{ system: string, preferred: string[] }` من `app.getSystemLocale()` و `app.getPreferredSystemLanguages()`.
- تستخدمه الواجهة لـ `uiLang: 'auto'`.

**2.3 `perf:get`:** invoke، في الإعدادات.
- يرجع: `{ totalMB, processes:[{type, pid, mb, cpu, label}], powershellCount, uptimeSec }`.
- `type`: `'browser'` \| `'renderer'` \| `'gpu'` \| `'utility'` \| `'powershell'` \| `'other'`.
- `label` اختياري للـ renderer: `'island'` \| `'settings'` \| `'palette'`، وإلا `null`.
- `mb`: من `workingSetSize` (KB في `app.getAppMetrics()`) ÷ 1024، بخانة عشرية واحدة.
- `cpu`: `percentCPUUsage`.
- عمليات PowerShell الأبناء تُعدّ في `powershellCount`، وتظهر في `processes` بنوع `'powershell'` لو أمكن قياسها.
- `totalMB`: مجموع `mb`. `uptimeSec`: ثواني منذ التشغيل.

**2.4 `perf:watch`:** send، في الإعدادات، قيمته `true` أو `false`.
- `perf:update`: event إلى نافذة الإعدادات فقط، بنفس شكل `perf:get`، كل 5 ثوانٍ، **فقط** والاشتراك مفعّل.
- يتوقف تلقائياً عند إغلاق نافذة الإعدادات.

**2.5 `eco:changed`:** event إلى الجزيرة والإعدادات.
- الحمولة: `{ eco: boolean }`.
- يُرسل عند تغيّر `ecoMode`، ومرة بعد تحميل كل نافذة (`did-finish-load`)، حتى تبدأ الواجهة بالقيمة الفعلية.

**2.6 `prayer:get` (invoke، الجزيرة والإعدادات) و `prayer:state` (event، الجزيرة):** نفس الشكل:
```
{
  next:    { name, time },            // name: 'fajr'|'dhuhr'|'asr'|'maghrib'|'isha' (بدون الشروق)
  current: { name, time } | null,     // الصلاة الحالية في مرحلتي adhan و iqama، وإلا null
  phase: 'idle' | 'pre' | 'adhan' | 'iqama',
  phaseEndsAt: number | null,
  ramadan: boolean,
  imsak: number | null,               // اليوم أو الغد، قبل الفجر بـ 10 دقائق، وفقط إذا ramadan
  iftar: number | null,               // مغرب اليوم، وفقط إذا ramadan
  pausedByAdhan: boolean
}
```
- **المراحل:**
  - `pre`: من (الأذان − `prayerPreMinutes`) إلى الأذان.
  - `adhan`: من الأذان لمدة **3 دقائق**.
  - `iqama`: من نهاية `adhan` إلى (الأذان + `prayerIqamaMinutes[name]`). لو القيمة ≤ 3، ما في مرحلة iqama.
  - `idle`: غير ذلك.
- `phaseEndsAt`: نهاية المرحلة الحالية، و `null` في `idle`.
- **الإرسال:** فقط عند تغيّر المرحلة، وعند منتصف الليل، وعند تغيير أي مفتاح صلاة أو موقع، وعند تغيّر `pausedByAdhan`. **ليس كل ثانية**: العد التنازلي تحسبه الواجهة.
- `ramadan`: حسب `ramadanMode`. `'auto'` يعني الشهر الهجري 9 (أم القرى).
- `prayerAutoPause`: عند بداية `adhan`، لو تُشغَّل وسائط، main يوقفها و `pausedByAdhan = true`. يرجع `false` عند `media:resume`، أو عند تشغيل المستخدم بنفسه، أو بنهاية `iqama`.

**2.7 `media:resume`:** invoke، في الجزيرة.
- يرجع `{ ok: boolean }`.
- يعمل فقط إذا `pausedByAdhan`. يستأنف ويصفّر `pausedByAdhan`، ويرسل `prayer:state`.

**2.8 `hijri:get`:** invoke، في الجزيرة والإعدادات.
- يرجع: `{ day, month, year, monthNameAr, monthNameEn, occasion: { id, ar, en } | null }` لليوم المحلي (أم القرى).
- `month` من 1 إلى 12.
- **قيم `id` المعتمدة:**

  | id | المناسبة | النوع |
  |---|---|---|
  | `ramadan` | رمضان | هجري |
  | `eid-fitr` | 1–3 شوال | هجري |
  | `arafah` | 9 ذو الحجة | هجري |
  | `eid-adha` | 10–13 ذو الحجة | هجري |
  | `hijri-new-year` | 1 محرم | هجري |
  | `ashura` | 10 محرم | هجري |
  | `founding-day` | 22 فبراير | ميلادي |
  | `national-day` | 23 سبتمبر | ميلادي |

- `hijriOccasions: false` يعني `occasion: null` دائماً.
- الواجهة تعيد الطلب عند منتصف الليل المحلي.

**2.9 `quran:reciters` و `quran:url`:** invoke، في الجزيرة.
- `quran:reciters()` يرجع `[{ id, nameAr, nameEn, moshaf: [{ id, name, server, surahList: number[] }] }]`.
  - المصدر mp3quran API v3. `surahList` يُحوّل من النص المفصول بفواصل إلى أرقام.
  - كاش في `userData` لمدة 7 أيام.
  - **لا طلب شبكة إلا عند استدعاء القناة** (المستخدم فتح مشغل القرآن).
- `quran:url(reciterId, moshafId, sura)` يرجع string: `server + pad3(sura) + '.mp3'`.
  - main يتحقق: `https:`، والمضيف ينتهي بـ `.mp3quran.net`، و `sura` من 1 إلى 114 وموجودة في `surahList`.
  - غير ذلك يرفض بخطأ `invalid`.
  - بدون شبكة ولا كاش: خطأ `offline`.
- (الواجهة تضيف `media-src https://*.mp3quran.net` في CSP صفحة الجزيرة. هذا ملف Claude.)

**2.10 قنوات موجودة من T6 (للعلم، بلا تغيير):** `island:pointer-inside` (invoke)، `island:hover-state` (send)، `island:pointer-left` (event)، `surface:resting` (send)، `surface:tint` (event `{r,g,b}` \| `null`)، `shortcuts:list` (invoke)، `shortcuts:open` (send)، `shortcuts:update` (event)، `lyrics:update` (event `{status, lines:[{at, text}], text}`).

**2.11 المادة (أكريليك / زجاج داكن): T15، قرار وليد بعد التجربة**
- **المفتاح:** `material: 'acrylic' | 'glass'`. **الافتراضي يصير `'acrylic'`** (كان `'glass'` في T6).
- **الدعم:** main يحسب `materialEffective`:
  - `'acrylic'` فقط إذا: `process.platform === 'win32'`، وويندوز 11 (رقم البناء من `os.release()` ≥ 22000)، و `win.setBackgroundMaterial` موجود.
  - غير ذلك `'glass'`.
  - ويطبّق `win.setBackgroundMaterial(materialEffective === 'acrylic' ? 'acrylic' : 'none')`.
- **`material:get`** (invoke، الجزيرة والإعدادات) يرجع `{ material: 'acrylic' | 'glass', supported: boolean }`. `material` = القيمة الفعلية. `settings-preload.js` يعرضه كـ `material()`.
- **`material:changed`** (event، الجزيرة والإعدادات) بنفس الشكل: عند تغيّر الإعداد، وبعد `did-finish-load`.
- **`settings:update`** يتضمن الحقل المحسوب `materialEffective`.
- **`island:shape`** (send، الجزيرة): `{ x, y, width, height, radius }` بـ CSS px داخل الصفحة.
  - الواجهة ترسله فقط والمادة الفعلية أكريليك: كل إطار أثناء حركة الحبة (حوالي 30 رسالة لكل فتح أو قفل، مقاس)، ومرة عند الاستقرار. لا شيء في الزجاج الداكن ولا في الخمول.
  - main يقص التغبيش على هذا الشكل (مواصفة T15 تحت).

### 3. قوائم السماح المطلوبة

| القناة | النوع | الجزيرة `preload.js` | الإعدادات | لوحة الأوامر |
|---|---|---|---|---|
| `settings:update` | event | ✓ (موجود) | ✓ | ✓ |
| `app:locale` | invoke | ✓ | ✓ | ✓ |
| `perf:get` | invoke | | ✓ | |
| `perf:watch` | send | | ✓ | |
| `perf:update` | event | | ✓ | |
| `eco:changed` | event | ✓ | ✓ | |
| `prayer:get` | invoke | ✓ | ✓ | |
| `prayer:state` | event | ✓ | | |
| `media:resume` | invoke | ✓ | | |
| `hijri:get` | invoke | ✓ | ✓ | |
| `quran:reciters`، `quran:url` | invoke | ✓ | | |
| `material:get` | invoke | ✓ | ✓ (`material()`) | |
| `material:changed` | event | ✓ | ✓ | |
| `island:shape` | send | ✓ | | |

### 4. أدوات للاختبار (اختياري، T13)
- `ISLANDLY_FAKE_NOW` (env، epoch ms): يثبّت الوقت لخدمات الصلاة والهجري، حتى تُختبر المراحل والمناسبات بدون انتظار.

### سجل تغييرات العقد
- 2026-10-28: النسخة الأولى (Claude).
- 2026-10-28: `surfaceMode` صار `islandMode` (قرار وليد). نفس القيم والقيمة الافتراضية.
- 2026-10-28: §2.11 المادة (أكريليك افتراضي مع رجوع تلقائي)، و `material:get`، و `material:changed`، و `island:shape`. قرار وليد بعد تجربة Acrylic.

### مواصفة T15 (Codex): أكريليك بشكل الحبة

الواجهة جاهزة في فرع T6: `island.js` يرسل `island:shape`، و `app.js` يتبع `material:get`/`material:changed`، والإعدادات تعطّل الخيار لو `supported: false`. المطلوب في `src/main/**`:

1. **الدعم والرجوع:** حسب §2.11. على ويندوز 10 أو أي فشل في `setBackgroundMaterial`: `materialEffective = 'glass'`، و `supported: false`. لا رسالة خطأ للمستخدم، فقط الرجوع للزجاج.
2. **القص على شكل الحبة:** `win32.setPillRegion(hwnd, rect)`:
   - **التحويل:** `rect` من `island:shape` (CSS px) × `zoom()` (إعداد `scale`) يعطي DIP، ثم × `display.scaleFactor` يعطي physical px نسبة لنافذة الجزيرة.
   - **التنفيذ:** `CreateRoundRectRgn(x, y, x+w+1, y+h+1, 2r, 2r)`، ثم `SetWindowRgn(hwnd, rgn, TRUE)`. لا تحذف الـ region بعد `SetWindowRgn`: النظام يملكها.
   - **السرعة:** النداء قد يصل حوالي 60 مرة في الثانية أثناء الحركة. لازم يكون رخيصاً (أقل من 1ms). وتجاهل الرسالة لو مطابقة للسابقة.
   - **لما يتغير حجم النافذة (envelope):** طبّق آخر شكل مرة ثانية، لأن الإحداثيات نسبية للنافذة.
   - **عند الرجوع للزجاج:** `SetWindowRgn(hwnd, NULL, TRUE)`، يعني بدون قص.
3. **الظل:** مع القص يضيع ظل CSS خارج الحبة. هذا مقبول مبدئياً. اذكر في الـ PR إن كان ظل DWM يظهر، ولا تضف حلولاً أثقل بدون قياس.
4. **التحقق على ويندوز** (يُكتب في الـ PR):
   - ويندوز 11: التغبيش داخل الحبة فقط، وبدون مستطيل حولها في المقفول والمفتوح وأثناء الحركة.
   - ويندوز 10: زجاج داكن، والخيار معطّل في الإعدادات مع الشرح.
   - التبديل بين المادتين فوري.
   - CPU أثناء الحركة (مع T9).

---

## 2026-10-28 · Claude · T8 (الخطوط)

**الفرع:** `claude/T8-typography`، مبني فوق `claude/T6-island-ui` (T6 لم يُدمج بعد).

**ما تم**
- **الافتراضي:** IBM Plex Sans Arabic + IBM Plex Sans، كعائلة واحدة مركّبة `'Islandly Plex'`. الحرف العربي يأخذ الخط العربي، والباقي (لاتيني، أرقام، رموز) يأخذ اللاتيني، عبر `unicode-range` حتى داخل السطر الواحد.
- **للمقارنة فقط** (في `dev/fonts/`، لا تُشحن): Readex Pro + Manrope، و Alexandria + Plus Jakarta Sans.
- **حُذف** Segoe UI Variable و Inter و system-ui و Tahoma من كل CSS. الاحتياط فقط لرموز غير موجودة في الخط (emoji وبعض الرموز): `Segoe UI Symbol` و `Segoe UI Emoji`.
- **الرخص:**
  - تحققت من كل خط في المصدر: `google/fonts` @ `9862abc`، ملف `ofl/<family>/METADATA.pb` فيه `license: "OFL"`، و `OFL.txt` هو SIL OFL 1.1. كل الستة OFL، وما احتجت أبدّل أي خط.
  - نسخ `OFL.txt` حرفية في `scripts/licenses/`، وتُنسخ بجانب ملفات الخطوط.
- **Reserved Font Name:** IBM Plex عنده اسم محجوز "Plex". تعديل الخط (subset جديد) يلزم تغيير اسمه حسب OFL. لهذا نشحن ملفات subset الرسمية (عربي ولاتيني، من Google Fonts عبر Fontsource 5.3.0) **بدون تعديل**، ونختار بينها بـ `unicode-range`.
- **الملفات:** woff2 في `assets/fonts/plex/` (4 أوزان × عربي ولاتيني)، و `font-display: swap`. `scripts/build-fonts.js` يولّدها مع `fonts.css`. والمشترك في `assets/fonts/typography.css`، تربطه الجزيرة والإعدادات ولوحة الأوامر.
- **التوازن:**
  - `size-adjust: 106%` للعربي في Plex.
  - `line-height` 1.55 للعربي و 1.38 للاتيني (`html:lang(ar)`).
  - حذف `letter-spacing` من أي نص قد يكون عربياً، لأنه يكسر وصل الحروف.
  - الأوزان 400/500/600/700، والـ 800 السابقة صارت 700.
- **الأرقام:** `tabular-nums` في الساعة والمؤقت وساعة الإيقاف والعد التنازلي.
- **`fontPairing`:** مفتاح مخفي (`plex` / `manrope` / `jakarta`). الواجهة تطبّقه عبر `html[data-fonts]`. لو ملفات التركيبة غير موجودة، يرجع لـ Plex.

**الأرقام والأدلة (Linux، ليس ويندوز)**
- **الحجم:** Plex المشحون 266KB لكل الأوزان (الحد 400KB). المحمّل فعلاً في الجزيرة 129KB (4 ملفات: 400 و 700 عربي ولاتيني). الإعدادات تحمّل الثمانية (266KB).
- **الشبكة:** صفر طلبات (`dev/fonts/compare.mjs` وفحص الإعدادات ولوحة الأوامر). كل الخطوط من `file://`.
- **الرام:** متوسط 3 تشغيلات Electron حقيقية، T6 مقابل T8:
  - نافذة الجزيرة في الراحة: 95.9 ← 97.0MB (+1.1).
  - مشغل الموسيقى مفتوح: 112.2 ← 114.3MB (+2.1).
- **الحركة:** 84 إطار، median 16.7ms، max 16.8ms، صفر فوق 20ms، يعني 60fps بدون تأثر.
- **الاختبارات:** `npm test` أخضر، و smoke أخضر، و ui-e2e 16/16.

**لم يُختبر:** عرض الخطوط على ويندوز (ClearType، DPI 125/150%)، وشكل الاحتياط للرموز على ويندوز. انظر `docs/WINDOWS-TEST.md` القسم 10.

**لـ Codex**
- لا طلبات جديدة. `fontPairing` موجود أصلاً في عقد v0.5 (القيمة الافتراضية `'plex'`).
- الحزمة تشحن `assets/fonts/` تلقائياً، و `dev/` مستثنى في `package-win.sh`.
- التحديث التلقائي ينزّل `assets/` (حوالي 270KB إضافية مرة وحدة)، وما يحتاج bump لـ `islandlyBase`.

---

## 2026-10-28 · Claude · T8 (قرار الخط)

**المعتمد: IBM Plex Sans Arabic + IBM Plex Sans** (`fontPairing: 'plex'`، الافتراضي والوحيد المشحون). القرار فوّضه وليد لي بناءً على `compare-sheet.png` و `compare-zoom.png`.
**السبب:** الخطان من عائلة واحدة صممتها IBM معاً (نفس سماكة الخط وارتفاع الحروف والإيقاع)، فالسطر اللي يخلط عربي وإنجليزي يبان كخط واحد. وهو الأوضح عربياً في الأحجام الصغيرة (12–15px) بدون ما يعرض النص: Alexandria أعرض وقصّ العنوان في المشغل الصغير، و Readex Pro أنعم وأقل حدّة بجانب اللاتيني.

---

## 2026-10-28 · Claude · T8 (قرار الخط)

**المعتمد: IBM Plex Sans Arabic + IBM Plex Sans** (`fontPairing: 'plex'`، الافتراضي والوحيد المشحون). القرار فوّضه وليد لي بناءً على `compare-sheet.png` و `compare-zoom.png`.
**السبب:** الخطان من عائلة واحدة صممتها IBM معاً (نفس سماكة الخط وارتفاع الحروف والإيقاع)، فالسطر اللي يخلط عربي وإنجليزي يبان كخط واحد. وهو الأوضح عربياً في الأحجام الصغيرة (12–15px) بدون ما يعرض النص: Alexandria أعرض وقصّ العنوان في المشغل الصغير، و Readex Pro أنعم وأقل حدّة بجانب اللاتيني.

---

## 2026-10-28 · Claude · T11 (واجهة عربية أولاً وثنائية اللغة)

**الفرع:** `claude/T11-i18n-rtl` (stacked على T8). **الحالة:** review.

**ما تم**
- **النصوص كلها في ملفين:** `src/renderer/locales/ar.json` و `src/renderer/locales/en.json` (مفاتيح مسطّحة: الجزيرة بدون بادئة، `settings.*` لنافذة الإعدادات، `palette.*` للوحة الأوامر). 255 مفتاح في كل ملف. **هذا المسار لاختبار التطابق في T13.**
- **`src/renderer/i18n-core.js`** مشترك بين الثلاث نوافذ (الإعدادات واللوحة تحمّله من `../renderer/i18n-core.js`):
  - `t(key, vars)` مع الجمع عبر `Intl.PluralRules`: القيمة تكون نصاً أو كائن `{zero, one, two, few, many, other}` يُختار من `vars.count`. العربي فيه الست صيغ (إشعار جديد / إشعاران جديدان / ٥ إشعارات / ١١ إشعارًا / ١٠٠ إشعار).
  - الأرقام في `vars` تُنسّق تلقائياً حسب اللغة وإعداد الأرقام.
  - `I18N.num` و `pct` و `time` و `date` و `hijri` (أم القرى) و `rel` و `list` (`Intl.ListFormat` بدل «، » الثابتة) و `digits`.
  - `I18N.mark(el, key, vars, attr)` و `data-i18n` / `data-i18n-title` / `data-i18n-placeholder`: النص الثابت يُعاد ترجمته في مكانه.
- **تبديل فوري بدون إعادة تحميل:** `settings:update` فيه `uiLang` (أو `lang`) يعيد ترجمة كل العناصر، وكل ميزة ترسم نصوصها من جديد (`relang()` أو `paint()`). المؤقت الشغّال والأغنية واللوحة المفتوحة تبقى كما هي (اختبار e2e جديد يثبت هذا).
- **`uiLang`:** auto (لغة النظام) / ar / en. **`digits`:** latn (افتراضي) / arab، للواجهة العربية فقط.
- **RTL:**
  - خصائص CSS منطقية (`padding-inline`، `inset-inline`، `margin-inline-start`) بدل left/right.
  - كل شيء ينعكس، **ما عدا** أزرار الموسيقى وشريط التقديم (`dir="ltr"`)، وكذلك الساعات و mm:ss.
  - `:dir(rtl)` يعكس سهم الرابط في الحافظة.
- **العزل (bidi):**
  - `dir="auto"` على كل نص يكتبه المستخدم أو يجي من برنامج (أسماء الأغاني والفنانين، الاجتماعات، المهام، أسماء التطبيقات والملفات، إشعارات GitHub).
  - النص المعزول يبقى بمحاذاة الواجهة: يمين في العربي ويسار في الإنجليزي.
  - درجة الحرارة معزولة (LRI/PDI) حتى تبقى ° بعد الرقم في العربي.
- **مراجعة النصوص:** صياغة عربية طبيعية، ومراجعة الإنجليزي. انظر أيضاً `ghBadToken` و `prayerSoon` و `shelfAdded`.
- **`test/i18n-check.js`** (أضفته لـ `npm test`، حسب الاستثناء المتفق عليه في CLAUDE.md). يتحقق من:
  - صفر حرف عربي في كود الواجهة.
  - صفر نص ثابت في HTML.
  - صفر نص حرفي في `h()` و `textContent` و `title` و `placeholder`.
  - كل مفتاح مستخدم موجود في الملفين.
  - نفس المفاتيح والـ `{placeholders}` في الملفين، وصيغ الجمع كاملة.
  - الاستثناءات الوحيدة: `PR` و `PNG` و `JPG`.
- **`test/ui-e2e.js`:**
  - `ISLANDLY_E2E_LANG=en` يشغّل نفس الفحوص بالإنجليزي.
  - فحص جديد: لغة واتجاه الواجهة، وما فيه نص عربي في الواجهة الإنجليزية.
  - فحص جديد: التبديل الفوري.
  - التحديثات مقفولة في الاختبار، لأن إشعار «تحديث جاهز» الحقيقي من GitHub كان يغطي الجزيرة في وقت عشوائي ويُفشل فحص اللون (تكرر في اللغتين، وما له علاقة بـ T11).

**الأرقام والأدلة (Linux تحت xvfb، ليس ويندوز)**
- `npm test`: كله أخضر، وآخر سطر `i18n check ok: 255 keys in ar/en, … no hard-coded text`.
- ui-e2e: 18/18 بالعربي و 18/18 بالإنجليزي، ثلاث مرات متتالية لكل لغة. smoke و update-flow أخضر.
- **الرام:** متوسط 3 تشغيلات Electron، T8 مقابل T11:
  - الجزيرة في الراحة: 98.5 ← 99.3MB (+0.8).
  - مشغل الموسيقى مفتوح: 116.9 ← 117.4MB (+0.5).
  - الحد +2MB.
- **الحجم:** ملفات اللغة 26KB، و `i18n-core.js` 6KB.
- **الشبكة:** صفر طلبات.
- **الصور:** `dev/i18n/sheet-island-1.png` و `sheet-island-2.png` (19 حالة للجزيرة)، و `sheet-settings.png` و `sheet-palette.png`، بالعربي بجانب الإنجليزي. يولّدها `node dev/i18n/shots.mjs && python3 dev/i18n/sheet.py`.

**لم يُختبر:** على ويندوز حقيقي (لغة نظام عربية، `auto`، خط الأرقام العربية، اتجاه القوائم المنسدلة). انظر `docs/WINDOWS-TEST.md` القسم 11.

**لـ Codex (main و preload، حسب عقد v0.5 §2.1)**
1. **`settings.js`:** أضف `uiLang: 'auto'` و `digits: 'latn'` لـ `DEFAULTS`، مع ترحيل `lang` ← `uiLang`. حالياً `set()` يرمي المفاتيح غير المعروفة، فاختيار الأرقام ما يُحفظ. والإعدادات تكتب `lang` و `uiLang` معاً مؤقتاً.
2. **`main.js:524`:** احذف `win.webContents.reload()` عند تغيّر اللغة. الواجهة صارت تبدّل في مكانها، والـ reload يضيّع المؤقت والحالة.
3. **بث `settings:update`** لنافذتي الإعدادات واللوحة أيضاً، مع `onUpdate` في `settings-preload.js` (اللوحة عندها `on` أصلاً). مع إضافة `uiLang` و `digits` لـ `palette:shown`.
4. **`today:update`:** `prayer.location` يرجع الاسم العربي دائماً. خلّه يتبع اللغة (عندك `ar` و `en` في `cities.js`)، أو أرسل `{ar, en}` والواجهة تختار.
5. **`package.json`:** أضفت `node test/i18n-check.js` لسكربت `test`. راجعه.
6. **T13:** المسارات `src/renderer/locales/{ar,en}.json`. `test/i18n-check.js` يغطي التطابق أصلاً. لو تبي اختبار منفصل في CI، استخدمه أو انقل منطقه.

**سؤال لوليد:** الأرقام الافتراضية لاتينية (0–9) حسب العقد. لو تفضّل الهندية (٠–٩) للواجهة العربية، غيّر الافتراضي في العقد.

## 2026-10-28 · Codex · T1 (قيد التنفيذ)

- قرأت AGENTS وTASKS وHANDOFF ومراجعة PR1 كاملة من فرع T0؛ نسخة محلية من ملفات التنسيق للإبقاء على العقد أثناء العمل، دون تعديل فرع Claude.
- راجعت T0 بتعليق: https://github.com/waliddawood999-ctrl/islandly/pull/2#pullrequestreview-5685413833 . طلبت مواءمة مدة الأذان (تعليمات وليد: دقيقتان)، وتعافي AppBar (فحص PID وNEW/SETPOS/REMOVE)، وتسجيل T16، وتوحيد افتراضي material.
- PR #1 الآن يستهدف dev، ولم يُدفع أو يُدمج شيء إلى main.
- B3: captureEnabled/ffmpegEnabled/rembgEnabled/lanShare=false؛ الالتقاط محروس داخل Capture.open لتغطية الاختصار وIPC. LAN وOCR وrembg مؤجلة بالكامل: لا منفذ LAN، لا worker OCR ولا تنزيل لغة، ولا تشغيل rembg وتنزيل النموذج. FFmpeg يستخدم مساراً مطلقاً متحققاً منه من أداة البحث؛ plugins/lyrics/nativeNotifications مقفولة أصلاً.
- S2: activity/jobs/plugins/adhkar ضمن disabledFeatures الافتراضي. S3: تقليم بناءات Koffi غير win32_x64. S5: تخطي roundtrip المفتاح إذا secure storage غير متاح مع سبب صريح. CI يعمل على push dev وأضيف job ui-e2e على Ubuntu/Xvfb؛ ليس مدعى أنه أخضر.
- الاختبار الفعلي: npm ci ثم NODE_USE_ENV_PROXY=1 node node_modules/electron/install.js ثم npm test: exit 0، ويشمل اختبار safety-defaults الجديد. git diff --check: exit 0. Linux/Node 24، لا اختبار Windows يدوي ولا قياس أداء Windows. الاختبار الأول على snapshot 0.4.0 فشل listen EPERM؛ بعد الصلاحية الموسعة والتثبيت نجحت اختبارات T1.
- لم يكتمل T1: B1/S1 يملكهما Claude في T6؛ B2 تغطية لوحات 0.5 في T2 ونتيجة CI منتظرة؛ B4 لا يمكن إعادة تنسيق renderer/CSS حسب قسمة وليد، يُطلب من Claude تنسيقها في T4؛ B5 لم يُحسم تقسيم PR. S6 يحتاج تتبع sender قبل أي تغيير أمني (لن أخفف التحقق). حجم zip لم يُقَس بعد.
- المطلوب من Claude: دمج/إعادة تطبيق إصلاح التحويم على واجهة 0.5 بالتنسيق مع T2؛ إضافة مفاتيح تعطيل الالتقاط والأدوات للواجهة مع توضيح أن LAN/OCR/rembg مؤجلة؛ تحديد خطة B4/B5. لا تعديل renderer أو CSS من Codex.
- T16 أعلى أولوية بعد إكمال T1 ثم T3؛ T7/T15/T9/T10/T13 لم تبدأ. T16 غير مسجلة في TASKS من Claude بعد؛ طُلب تسجيلها في مراجعة T0.

### دليل CI لدفعة T1
- الكوميت: `6fa874e20b0979b358f721c628beab3d0155e83a`.
- https://github.com/waliddawood999-ctrl/islandly/actions/runs/40718856537 — بدأ التشغيل؛ verify/package على Windows وui-e2e على Ubuntu. لا نتيجة نجاح مؤكدة بعد.
- طلب المراجعة من Claude: https://github.com/waliddawood999-ctrl/islandly/pull/1#issuecomment-6473537447 .


## 2026-10-28 · Codex · T1 follow-up

- Read the full uploaded CODEX_BRIEF.md and AGENTS/TASKS/HANDOFF/PR1 review, including the current T0 contract. Latest user instruction overrides the older branch instruction: created `codex/T1-review-fixes` from dev `3cfd490` and incorporated PR #1 head `355a687` without changing that branch. PR #1 already targets dev.
- Reviewed T0 by comment: https://github.com/waliddawood999-ctrl/islandly/pull/2#pullrequestreview-5686274295 .
- Kept the previous safety fixes. Added capture permission/IPC/async enablement checks, cancellation of pending capture on stop, capture shutdown when disabled, FFmpeg enablement recheck after resolution, input/operation validation, and circularClickThrough=false by default. Added race regression coverage.
- Windows packaging now prunes non-win32_x64 Koffi builds, creates the portable zip and reports its measured bytes in the CI summary.
- Actual verification: Linux / Node 24 `npm test` exit 0 (all nine scripts), `node test/safety-defaults.test.js` exit 0, `git diff --check` exit 0. No manual Windows test or Windows performance claim.
- Review dispositions: `docs/reviews/T1-response.md`. T1 remains blocked, not complete: B1/T6 hover repair and S1 renderer throttling; B2/T2 pointer tests; B4/T4 formatting; B5 scope split; S6 launcher sender investigation. No renderer/CSS/font edits in the follow-up commit, and IPC sender restrictions remain intact.
- Prior CI https://github.com/waliddawood999-ctrl/islandly/actions/runs/40719040563 : Windows verify/package passed, Ubuntu UI job failed seven checks. An overall green run is not claimed. Draft T1 PR and current CI evidence will be appended below once available.
- Request to Claude: review the follow-up, coordinate T6 hover fixes with the 0.5 renderer and T2, and resolve B4/B5. Later tasks have not started because T1 is not complete. Nothing pushed or merged to main.

### T1 PR and current CI evidence

- Draft PR: https://github.com/waliddawood999-ctrl/islandly/pull/5 (`codex/T1-review-fixes` → `dev`). Review requested: https://github.com/waliddawood999-ctrl/islandly/pull/5#issuecomment-6474994561 . Original PR #1 notified: https://github.com/waliddawood999-ctrl/islandly/pull/1#issuecomment-6475007721 .
- Code head `f4739b5`: https://github.com/waliddawood999-ctrl/islandly/actions/runs/40728979477 . Windows verify passed npm audit, npm test, Electron update flow and renderer/IPC smoke. The launcher:list authorization error did not reproduce; the intentional foreign settings:set rejection did appear, as expected.
- Ubuntu pointer tests passed 11/12. Remaining failure: `pushing the cursor against the top screen edge opens the island and keeps it open -> island flickered closed while the cursor sat on the top edge`. Overall CI is not green. Claude/T6 and T2 must resolve and verify this; no renderer ownership bypass or skipped CI check.
- Packaging compiled the native helper and packaged Windows Electron successfully; ZIP measurement/artifact completion was still pending when this entry was written. No size result invented.



## 2026-10-28 · Codex · T16 Windows installer

- Walid explicitly accepted T1 as PR #5 and authorized T16 next. B1/B2/B4 remain with Claude. No changes to those blockers or to renderer/settings/palette/fonts/CSS.
- Branch `codex/T16-windows-installer` starts at dev `3cfd490`; T1 is not merged into dev. The coordination docs are copied from the T1 branch because they do not exist on dev; prior handoff entries remain unchanged. T16 ownership is recorded here under Walid's direct assignment.
- Added pinned electron-builder, Windows x64 one-click per-user NSIS `Islandly-Setup-0.5.0.exe`, portable `Islandly-win64.zip`, native Koffi pruning, artifact checks and SHA256SUMS. PR/dev builds upload artifacts only. Stable `v*` tags matching package.version publish to Releases and set latest. No tag created, release published, or main update performed by Codex.
- Version 0.5.0 / base 3: full install is required for base 2 clients. New update discovery reads published stable `/releases/latest`, resolves the release tag (never target_commitish/main) to an immutable SHA, then retains blob hash verification and rejects invalid paths/tag-package mismatches. Drafts and prereleases are rejected. With no releases, check returns up-to-date; HTTP failures remain errors. T3 will add complete transactional rollback and lifecycle coverage.
- Actual checks: Linux Node 24 `npm test` exit 0 (5 scripts; 72 palette cases plus release regressions), builder configuration schema validation exit 0, `git diff --check` exit 0. npm test required expanded execution permissions for the pre-existing local AI test server. Windows CI pending; no manual Windows test or installer launch has occurred.
- Claude review requested in the PR description: review installer/update changes and coordinate integration with PR #5. Keep B1/B2/B4 untouched. Signing is not configured; installer is unsigned. Native notification MSIX capability is outside this NSIS task.
- Publish policy: T16's explicit request to publish stable tags takes priority over the older T3 draft-only wording. PR/dev builds never publish. `/releases/latest` changes only after a maintainer pushes a matching stable tag and its build succeeds.

### T16 first Windows CI result

- PR: https://github.com/waliddawood999-ctrl/islandly/pull/7 . First run https://github.com/waliddawood999-ctrl/islandly/actions/runs/40734698114 failed in the existing app-index fixture: it included the runner's real Start Menu (145 entries instead of the expected 3). Isolated APPDATA/ProgramData to temporary fixture paths in test/palette.test.js; no production/UI behavior changed. Packaging had not run yet. Follow-up CI pending.

### T16 completed code verification

- Code commit `0b0179469028d993827c5fc39b15779a47c1de97`: https://github.com/waliddawood999-ctrl/islandly/actions/runs/40735233961 **SUCCESS**. Windows npm ci/test, Electron release update flow, current stable electron-builder 26.18.0, NSIS and portable ZIP, packaged code/native checks, Koffi pruning and artifact upload all passed. Release job was correctly skipped for a PR.
- Linux npm test and builder schema validation passed with the current dependency pin. `npm audit --omit=dev --audit-level=high`: found 0 vulnerabilities.
- Review PR: https://github.com/waliddawood999-ctrl/islandly/pull/7 (`codex/T16-windows-installer` → dev). Claude review requested in its description. T16 is review, not merged/done. Final follow-up records evidence only. No Windows desktop/manual install test, no tag or published release, no main push/merge. Next task in Walid's sequence is T3.


## 2026-10-28 · Codex · T3 release channel

- User explicitly started T3 after T16. Created `codex/T3-release-channel` from latest dev `3cfd490`; PR #7 remains unmerged. Copied existing coordination docs from T16 because dev has none; prior handoff entries are unchanged. T3 is assigned to Codex in TASKS. B1/B2/B4 remain Claude's work.
- Implemented stable GitHub Release discovery (shared T16 helper), immutable tag SHA, verified code blobs and strict Windows-safe paths/modes/duplicate-name checks. Version 0.5.0/base3, same as T16; changed runtime dependencies/native base request a full download. Existing update IPC/result/toast behavior retained.
- New update-state module separates staged/current/previous; atomic pointer publication, boot-time manifest revalidation, healthy rollback and packaged fallback, exact failed-version tracking. Download staging never deletes a running tree. Packaged bootstrap obtains single-instance lock before touching boot state and resolves dependencies via NODE_PATH. Startup watchdog exits an unacknowledged candidate after 30 seconds; preload/load errors cannot mark it healthy.
- Tests cover A→B→C, rollback after failed C, first-update failure, download and on-disk corruption, invalid rollback tree, bad manifest/paths/duplicate names/symlinks/tag metadata, cancellation and base2/runtime dependency guards. Real Node child processes exercise the packaged bootstrap, dependency resolution, forced termination/relaunch and second-instance state preservation. Also exercise the actual unchanged 0.4.0/base2 updater snapshot: needs-full-download, no base3 staging.
- Added Windows verification/ZIP artifact CI on dev pushes and PRs. Separate optional workflow_dispatch creates only a draft for an existing matching stable tag, verifies its commit and never publishes or overwrites an existing release. No tag/draft/release created. T16's explicit tag-publication workflow remains separate.
- Local checks so far: Linux/Node24 npm test exit 0; 12 new release-channel regression scenarios plus legacy base2 check; git diff --check exit 0. Real Electron update-flow and packaging are pending Windows CI. No manual Windows test. UI/palette/settings/fonts/CSS untouched.
- Integration request for Claude: review T3 and reconcile overlapping updater/package scripts/docs with T16 #7 and T1 #5 on dev. Keep T16 installer/build dependency and T3 transactional bootstrap/updater. Do not combine this with B1/B2/B4 work. Full recovery/state/CI design and limitations: docs/RELEASE-CHANNEL.md.

### T3 PR and completed verification

- PR https://github.com/waliddawood999-ctrl/islandly/pull/8 (`codex/T3-release-channel` → dev), open for review. Claude review requested in its description.
- Code commit `1efae58b61f1ca0b4d6cbefd7dde54dd3c7ee5b9`: https://github.com/waliddawood999-ctrl/islandly/actions/runs/40740700551 **SUCCESS**. Windows npm ci/test (12 channel regressions and actual legacy-base2 check), real Electron/local-HTTP corrupt-download rejection, verified staging, full-download guard and packaged bootstrap selection passed; Windows portable packaging/native checks/ZIP and artifact upload passed. Draft job correctly skipped on PR; manual draft-creation route not executed.
- Artifact: https://github.com/waliddawood999-ctrl/islandly/actions/runs/40740700551/artifacts/12838374571 . Contains Islandly-win64.zip, SHA256SUMS and build-info; artifact archive is 167923934 bytes (not a claim about ZIP size alone).
- Final follow-up changes documentation only. Linux npm test and git diff --check pass. No manual Windows desktop test, no tag/draft/published release, no merge or main push. S4 (updater discovery on main) addressed; B1/B2/B4 unchanged, no new review item rejected.
- Read-only merge-tree simulation against open T16 identified expected overlap in docs/HANDOFF.md, docs/TASKS.md, package.json, src/main/updater.js and the fixture comment in test/palette.test.js. No branch was merged or changed by that simulation. Reconciliation: preserve all handoff history plus T3's appended entries; keep both task rows; choose T3 updater and T3 test script, retain T16 dist:win and electron-builder devDependency. T3's release-channel.test.js supersedes T16's older releases.test.js fixture (which does not model the new streaming/staging API), so do not add that obsolete test invocation to the combined npm test. Either app-index fixture comment is equivalent. Keep T16 installer workflow/configuration and decide on one portable packaging route. Re-run npm test/Windows CI after maintainer integration.


## 2026-10-28 · Codex · T7 native surface integration

- User accepted T3 PR #8 and assigned T7. Created codex/T7-appbar directly from latest dev 3cfd490; no merge or main push. Current T6 PR #3 is still unmerged. Read its complete native Surface contract and AGENTS; copied only src/main/surface.js as the backend integration baseline, not its renderer/UI/hover changes. Existing docs history copied from T3, append-only. T7 uses current T6 islandMode (older handoff surfaceMode name is superseded).
- Implemented sampleScreenColor(points) and appBar register/setPos/remove/CALLBACK_MESSAGE/TASKBAR_CREATED_MESSAGE through Koffi. Pointer-sized APPBARDATA/HWND, GetDC/GetPixel/ReleaseDC with COLORREF conversion, QUERYPOS followed by height-preserving SETPOS, unchanged-position feedback suppression. No PowerShell processes or network.
- Surface integrates physical pixel conversion for the island's monitor, 500ms minimum sample interval across visibility toggles, hidden/open/off shutdown, Explorer restart and AppBar notifications. monitorId uses T1's existing backend contract, primary fallback when unavailable. setPos failure removes reservation; close/quit/exit/uncaught-exception/renderer loss clean up using the saved live HWND.
- Crash marker is written and flushed before NEW and before SETPOS. Recovery checks prior PID is dead, then NEW/SETPOS/REMOVE using the new HWND on the saved top edge/rect. Never sends REMOVE to a recycled old HWND. Live/unknown PID or unreadable marker fails closed. Failed REMOVE retains marker. Forced termination cannot execute cleanup code; next-launch recovery handles it.
- Security/defaults: islandMode=overlay; surfaceTint=false is a new explicit opt-in for native screen pixel sampling (AGENTS screen-read default-off rule). No IPC name/payload changes: surface:resting boolean, surface:tint {r,g,b}|null. Sender/frame validation added for surface:resting. Claude: expose surfaceTint opt-in in your settings UI and enable sampling only on explicit user consent. This backend key addition does not rename an existing contract field.
- Tests cover FFI call data/COLORREF/DC cleanup, marker lifecycle/live/dead PID and failed removal, DPI/secondary monitor conversion, Explorer restart, saved-handle cleanup and throttling. A real child process is force-killed and its marker recovered on relaunch with fake native calls. npm test passed on Linux/Node24. Actual native ABI/AppBar test and full npm test are wired to Windows CI; pending. No manual Windows acceptance performed; checklist appended to docs/WINDOWS-TEST.md.
- Integration with T6: keep its UI/hover work unchanged, retain this Surface marker/throttle/failure handling and current main/preload lifecycle wiring. Do not replace whole main.js with an older task branch during integration. T1 B1/B2/B4 and renderer/settings UI/palette/fonts/CSS untouched.

### T7 PR and completed native verification

- PR https://github.com/waliddawood999-ctrl/islandly/pull/9 (`codex/T7-appbar` → dev), open for Claude review. Code commit `78b400eff3413805bb87453ac827e64a63d246ed`.
- https://github.com/waliddawood999-ctrl/islandly/actions/runs/40747778235 **SUCCESS**. Windows npm ci/test passed all five scripts and seven T7 scenarios. Real native test passed pointer-sized ABI, registered callback, NEW/QUERYPOS/SETPOS/REMOVE and GetPixel (`pixel readable=true`). A separate Electron process registered a real AppBar and was force-terminated; recovery on the surviving/new live window performed native NEW/SETPOS/REMOVE and cleared its marker. This is automated Windows CI, not manual desktop/visual acceptance.
- Linux Node24 npm test and git diff --check passed. Final follow-up records docs only. No merge, no main push, and no protected UI/CSS/font edits. Manual visual/taskbar/fullscreen/Explorer/mixed-DPI checks remain explicitly pending in docs/WINDOWS-TEST.md.
- Claude review request is in PR #9's description. Remaining coordination: merge-time backend reconciliation with T6 #3 and prior task PRs; expose surfaceTint=false opt-in without changing existing IPC names; run the manual acceptance checklist. The old HWND is retained only as marker evidence, never used to remove a possibly unrelated recycled window.


## 2026-10-28 · Codex · T9 baseline capture

- User assigned T9. Created codex/T9-perf-ram directly from latest dev 3cfd490. No merge, no main push. Existing coordination docs copied from T7 and T9 row marked doing.
- Before editing pollers, added an actual Electron app.getAppMetrics baseline probe and Windows CI comparison against immutable dev 3cfd490. Captures 15s warmup, 60s idle and 60s local music-event fixture, GPU/process metrics and instrumented main-process child launches. Real SMTC/music and manual Windows acceptance remain pending; no numbers invented. Details/limitations in docs/perf.md.
- Code inspection: baseline privacy spawns two reg.exe every 3 seconds; Bluetooth/brightness/Explorer use fresh PowerShell calls. Anthropic SDK is already lazy; calendar ICS parser can be deferred.

### T9 implementation progress

- Initial pre-change Windows baseline run 40749631551 succeeded: Electron/GPU idle 265.99 MB, 0.176% CPU, 40 child launches/minute; local music-event fixture 239.68 MB, 0.414% CPU, 40/min. Separate PowerShell working sets excluded in that first probe; final probe adds native live-child metrics for both before/after. The baseline is over the 180MB limit; no pass claimed.
- Implemented native clipboard sequence gating, event-driven RegNotifyChangeKeyValue + native ConsentStore reads (no reg.exe), one persistent JSON-line PowerShell host shared by fixed Bluetooth/brightness/Explorer scripts and media controls, bounded requests/circuit breaker/shutdown. Removed idle media-helper warmup; capability checks only start the helper for expanded controls.
- Added scoped perf:get/perf:watch/perf:update at 5s only for visible subscribed settings; native PowerShell working set/CPU included. ecoMode=false and eco:changed delivered after island/settings load and on changes. Hidden/fullscreen stops clipboard and optional network timers, collapsed stops Bluetooth/System polling; Eco slows clipboard to 4s and foreground checks to 3s, pauses optional refreshes/Bluetooth/System/tracking. Privacy and media metadata remain event-driven. Essential fullscreen recovery/break/update/calendar state timers retain their documented background purpose. Renderer background throttling is enabled in main window preferences; no renderer source changed.
- Anthropic SDK already lazy; moved ICS require into the parse-on-refresh path. Menu.setApplicationMenu(null) runs before ready. Six new regressions pass along with existing npm test; actual native API/shared-host tests and inclusive comparison pending Windows CI. No manual Windows or real-player music claim.

### T9 final code verification and acceptance gap

- Draft PR https://github.com/waliddawood999-ctrl/islandly/pull/10 (`codex/T9-perf-ram` → dev), no merge/main push. Code `5822a7f9e8ccff9fac677c74353b8a27230b531d`: https://github.com/waliddawood999-ctrl/islandly/actions/runs/40753032354 **SUCCESS**. npm test (five scripts/six T9 regressions), real native clipboard sequence/private-registry notification/working-set calls, one-host brightness/Explorer/media protocol, and real Electron perf IPC/Eco events/5s subscription/hide cleanup/foreign sender rejection passed.
- Inclusive comparable 60s averages: idle baseline 361.96 MB / 0.164% sampled CPU / 40 launches per minute → T9 262.98 MB / 0.061% / 0 launches. Local music-event fixture 329.28 MB / 0.388% / 40 → 237.87 MB / 0.306% / 0. GPU-off diagnostic 261.92 MB idle did not materially help; acceleration unchanged. Artifact https://github.com/waliddawood999-ctrl/islandly/actions/runs/40753032354/artifacts/12844927586 . Full commands, process breakdown and limits: docs/perf.md.
- **T9 is blocked, not done:** RAM remains above 180 MB (also misses 150 MB goal). Real-player music CPU and manual Windows acceptance are unverified. CI verifies functional behavior and records measurements; it does not enforce the RAM budget. No selective omission/working-set manipulation used. The initial 265.99 MB baseline excluded PowerShell memory and is not directly comparable with the final inclusive table. Short-lived baseline reg CPU can be missed between snapshots.
- Corrected a test-window navigation race in the new IPC test and verified the full test afterward. Added explicit native-wait/worker/host cleanup before teardown. Prevented noninteractive music peeks from starting Bluetooth/helper work; current T6 surface:resting bool is accepted with sender/frame checks and pre-T6 fallback excludes peeks. Media initialization inside the shared host is lazy; failed hosts preserve native media-key fallback and do not respawn in a loop. Public settings:update is sent to all existing windows without secrets.
- Integration request to Claude: review backend changes, connect Eco/perf UI using the existing contract, combine resting-state handling with T7 (avoid duplicate handlers), and reconcile prior task changes rather than replacing whole main/media/updater files. Prior PRs remain unmerged; both benchmarks use dev's 0.4 renderer, not combined 0.5 UI. Further RAM optimization/integration measurements are required before changing T9 to done. No protected UI/CSS/font changes.
- Final evidence follow-up changes docs only. npm test rerun before push; working tree checked. No real Windows desktop/music claim and no new task started.


## 2026-10-28 · Codex · T9 RAM continuation

- User explicitly rejected RAM acceptance at 262.98 MB and authorized continuation on the same branch/PR, with a stop before major architectural changes. Staying on codex/T9-perf-ram / PR #10; no merge/main push.
- Added a controlled 15s warmup/60s Windows footprint experiment: unchanged T9 app, diagnostic V8 optimize-for-size/Chromium low-end policy without isolation changes, and a blank transparent Electron window with the same basic security/visibility preferences but no backend/preload/app page. All Electron/GPU/utility working sets remain counted; no working-set trimming or product feature removal. Production code/UI unchanged at this stage.
- Goal is to establish whether small backend/runtime sizing changes can bridge the ~83 MB gap, or whether the user's architecture-stop condition applies. Results pending; npm test will run before push and in CI. No architectural change has been made.

### T9 RAM continuation result — stopped before architectural change

- Same branch codex/T9-perf-ram and draft PR #10. Diagnostic commit f2ca237: https://github.com/waliddawood999-ctrl/islandly/actions/runs/40765826827 **SUCCESS** (npm test + three controlled Windows probes + artifact upload). Raw samples: https://github.com/waliddawood999-ctrl/islandly/actions/runs/40765826827/artifacts/12850189086 . No production source change in this continuation.
- Prior idle 262.98 MB; unchanged full-app retest **260.00 MB** average (238.94 minimum / 279.96 peak). Diagnostic optimize-for-size/low-end policy **259.02 MB** average (238.00 / 277.18), not shipped. Blank transparent Electron window with no backend/preload/app page **225.99 MB** average, minimum **204.90 MB**, peak 242.42. All Electron process working sets including GPU/utility counted; no trim or metric substitution. The 2.98 MB full-app difference is run-to-run variation, not a claimed optimization.
- Full main-thread V8 heap 4.85 MB; blank control 3.81 MB (not total worker/native memory). Blank process averages: Browser 88.53, Renderer 54.96, GPU 44.85, Utility 37.66 MB. The current runner/runtime stays above 180 even without the app workload. These are CI-specific observations, not a universal proof about every Windows/GPU combination.
- User explicitly required stopping if crossing the budget requires a major architectural change. The tested small changes do not bridge the gap; stopped before changing host/render ownership or process architecture. T9 remains blocked/unaccepted and PR stays draft. No native idle shell, WebView2 migration, process consolidation or sandbox change implemented.
- Concrete options documented in docs/perf.md: (1) native collapsed island + existing Electron panels on demand (new lifecycle/IPC/latency work), (2) native Windows host with WebView2 or native views (larger host/service/window/update rewrite), (3) run unchanged full/blank controls on target desktop hardware before selecting either. A prototype must demonstrate the memory/interaction targets; no framework-based guarantee offered. Claude's protected UI ownership remains respected.
- Final npm test rerun before evidence push; git diff --check pass. No merge/main push; no renderer/settings UI/palette/fonts/CSS edits. This continuation ends at the user's stated architectural boundary, not as a successful RAM acceptance.



## 2026-10-29 · Codex · T9 native idle architecture authorized

- User selected Option 1 after local Acer Aspire Lite 16 measurements: full app 452.21 MB; blank Electron 301.35 MB, GPU ~183 MB (Electron 45.1.0, same 15s/60-sample probe). CI controls remain 260.00/225.99 MB. Local measurements are user-supplied.
- Continuing codex/T9-perf-ram / PR #10. Implementing native Win32/WinForms collapsed host, on-demand Electron panels, native AppBar ownership, Job Object shutdown of all descendants, existing IPC/settings, timer/clipboard lifetime handoff. No renderer/settings UI/palette/font/CSS source edits. Native host is now the intended Windows startup/packaged entry point; previous Linux packaging route needs the native binary to produce this architecture.
- Added Windows workflow and local PowerShell probe for all owned-process RAM (idle/settings open/returned idle), cold open latency, overlay/reserved-bar recovery and no orphan processes. CI measurements pending; no RAM pass claimed.
- Visual handoff for Claude: native GDI pill/sliver approximates existing dimensions, anchor, scale, black rounded shape, accent dot and clock/countdown. GDI text/antialiasing, shadow and spring animation differ; native collapsed state does not yet reproduce live music artwork/waveform, privacy/battery/clipboard/prayer compact variants. These are gaps to review, not a redesign of existing UI. Expanded Electron panels retain their existing sources.


### Native lifetime and integration details

- Windows Job Object assignment happens before Electron resumes from CREATE_SUSPENDED; owner death also kills the runtime tree. Current-user-only asynchronous named pipe carries bounded command/reply messages and timer/clipboard snapshots. User-requested external programs are opened by the native owner outside the Chromium job so closing a panel cannot kill those applications.
- Native idle handles timer completion, clipboard change notifications/queued text handoff, usage/break tracking and event-driven ConsentStore privacy detection. Panels remain existing Electron UI/IPC. Optional web services refresh while panels run; live native media artwork/waveforms and rich compact variants remain visual gaps for Claude. Native privacy uses a generic label; no screen colour sampling was added.
- Canonical islandMode values remain overlay/appbar (the probe calls the latter reserved-bar). Native AppBar survives panel shutdown, reacts to Explorer restart and uses an atomic crash marker with PID/start identity. Recovery registers/removes our fresh HWND, never a saved/recycled HWND. Monitor IDs are mapped to native screen origins from the panel snapshot; unknown/removed monitors fall back to primary. Mixed-DPI/manual multi-monitor visual checks still need a Windows desktop.
- Full-package compatibility base is 3. Native binary changes must ship in a full Windows package, not the existing src/assets-only updater. Both native and panel context startup settings target the native executable. The Linux packaging script now requires ISLANDLY_NATIVE_EXE and cannot silently ship an Electron idle entry point; Windows npm run package:native builds the complete portable package.
- T6/T7 and T3 remain separate unmerged PRs: when integrating, keep exactly one AppBar owner (the native host in managed sessions), retain current IPC names and the updated base/full-install boundary. Native UI fidelity still requires Claude's review; no protected UI source was edited.

- Additional native visual gaps for Claude: native tray currently has English labels and a generic system icon; compact text uses native GDI rasterization. Native auto-hide preserves the five-second compact-to-sliver timing, but there is no spring/hint animation or web shadow. Rich now-playing artwork/waveforms and localized privacy-app labels are not painted by the native shell. Existing expanded UI, palette, fonts and CSS remain untouched.



## 2026-10-29 · Codex · T9 native Windows verification

- Native source `1f78cb0fe4feb6a9d894ea058638ced74e60c5df`: https://github.com/waliddawood999-ctrl/islandly/actions/runs/40809880548 **SUCCESS**, both native measurement and packaged jobs. Raw samples: https://github.com/waliddawood999-ctrl/islandly/actions/runs/40809880548/artifacts/12870680145; Windows preview package: https://github.com/waliddawood999-ctrl/islandly/actions/runs/40809880548/artifacts/12870405443. Existing native/IPC/performance CI https://github.com/waliddawood999-ctrl/islandly/actions/runs/40809881015 and Electron control CI https://github.com/waliddawood999-ctrl/islandly/actions/runs/40809880396 also **SUCCESS**. npm test passes, including native-session state/parent-loss/external-launch regressions.
- Before: historical CI Electron idle 260.00 MB; user-supplied local Acer full app 452.21 MB / blank Electron 301.35 MB (local GPU ~183 MB; CI blank 225.99 MB). Final native CI overlay idle **39.43 MB**, settings **398.76 MB**, returned idle **31.00 MB**, sampled idle CPU **0.21%**, settings/expanded cold opens **1114/692 ms**, shutdown **4556 ms**. AppBar: **39.76/399.50/31.67 MB**, idle CPU **0.39%**, cold opens **1066/678 ms**, shutdown **4584 ms**. Every idle sample contains only the native host. Method: 15s warmup, 60 one-second samples per workload; all host/job process working sets included without trimming.
- Initial native CPU was 1.23–1.65% despite passing RAM. Reduced idle wakeups to 1Hz; hover uses a one-shot 280ms timer and settings/display/privacy events apply directly. Final CI enforces <180 MB RAM and <1% idle CPU before and after panel use, plus bounded shutdown, state roundtrip, owner-crash containment and work-area recovery.
- Native lifetime snapshots depend on the existing public Island API and timer feature fields mode/total/remaining/running/endAt; changes by Claude must preserve/update this adapter in src/main/main.js. Active break state and usage app naming remain compatible across native/Electron sessions. User-launched external applications are outside the Chromium job.
- Local native measurements remain pending; exact laptop commands are in docs/perf.md. Real-player playback and manual mixed-DPI/multi-monitor/visual acceptance are unverified. Native visual gaps already listed above include GDI/translucency/shadow/spring differences, generic tray icon/English menu, and missing rich compact media/artwork/app labels. Claude should review those instead of treating the native approximation as a redesign.
- Same codex/T9-perf-ram / PR #10 targeting dev. No merges/main pushes or protected UI/font/CSS edits. Full-package base 3 and single native AppBar ownership must be reconciled with the separate unmerged T3/T6/T7 PRs. T9 is in review, not declared manually accepted.

## 2026-10-29 · Codex · T10 Islamic backend

- User accepted T9 and assigned T10. Created `codex/T10-islamic-services` directly from fetched dev `3cfd4909143d6a87d5d6a61cbe94592a6824a263`; no merge/main push. dev still lacks the earlier task PRs, so coordination docs were carried forward from accepted T9, without importing its production files. T10 is registered to Codex in TASKS.
- Implemented prayer:get/state, explicit media:resume, offline hijri:get and on-demand quran:reciters/url. New channels authorize the island's main frame; prayer/hijri also allow settings' main frame. Preload APIs are extended without renderer/settings UI/palette/font/CSS edits.
- **Contract correction:** CODEX_BRIEF specifies a two-minute adhan phase; the older contract above says three. T10 uses **2 minutes**. iqama begins after those two minutes and ends at adhan time + prayerIqamaMinutes[name]; values <=2 skip iqama. Current prayer is separate from next, and sunrise is excluded from next/live phases. Defaults are exported from services/store.js and shared with settings.js. Partial iqama settings preserve the other prayers and reject invalid values.
- Fixed timezone: Asia/Riyadh (contemporary civil UTC+03; no DST), shared with Intl en-u-ca-islamic-umalqura. Saudi-midnight behavior does not depend on the executor's timezone. UmmAlQura Ramadan Isha receives exactly +30 minutes; other calculation methods do not. Ramadan mode on/off/auto and imsak/iftar are included. Hijri names are Arabic/English, with fixed offline occasion IDs; `dhul-hijjah-ten` adds the brief's first-ten-days occasion omitted in the older contract. Specific Eid/Arafah IDs win over that range; Gregorian Saudi national/founding dates win on overlap.
- Prayer scheduling has one pending next-boundary setTimeout, no polling interval. All calculated boundaries are minute-aligned. An initial alignment after startup/settings/resume may be shorter than a minute to reach the real event, rather than delaying adhan. No recurring sub-minute poller was added. Resume/unlock and relevant preference changes recompute the next event; stop cancels timers and invalidates late pause callbacks.
- Auto-pause checks playing metadata first, then uses SMTC TryPauseAsync (never a toggle key). Resume is explicit, once, and restricted to the app identity returned by the successful pause. Missing/paused media never gets toggled into playback. A successful pause updates pausedByAdhan; user playback/no session/end of iqama clears it. Nothing resumes automatically.
- Quran constructor/getting prayer/Hijri opens no network. Only quran:reciters fetches Arabic/English catalogue metadata, with coalesced requests and a seven-day disk cache. Failed refresh uses validated stale cache; no cache gives offline. quran:url is cache-only and rejects unsupported surahs/IDs and non-HTTPS/non-mp3quran-subdomain servers. No audio downloads or playback in main. Claude T12 must add the audio element and appropriate media-src CSP; protected HTML is unchanged.
- Added deterministic Riyadh reference/Ramadan/timezone/phase/pause tests, known Hijri dates/occasions, Quran cache/URL security tests, scoped IPC/settings validation tests, real Electron IPC and a cold incremental Windows Browser working-set probe (3 MB limit, no GC or working-set trimming, zero idle Quran requests). npm test passed on Linux; Windows CI/memory measurement pending.
- **Integration dependency:** this dev-based task does not contain the accepted, unmerged T9 native host. When combining task PRs, preserve T9's shared PowerShell host and transplant the explicit pause/play/app-identity commands rather than replacing its media bridge with the pre-T9 file. The always-on prayer scheduler/pause owner must be wired into the native host before shipping a combined native-idle build; do not keep Electron alive to preserve the Node timeout. This backend PR supplies the calculation/state/IPC contract; it does not claim native-idle background prayer execution on the uncombined T9 branch. Mixed native/background integration needs separate verification, not UI redesign.


### T10 scope decision and memory optimization

- User confirmed: **keep PR #12 scoped; the user will update dev with T9**. Native-host integration stays outside this PR until that base is available. No prior task branch was merged or copied into production code.
- Windows npm test initially exposed the existing app-index fixture including the machine's Start Menu. Added test/run-tests.js with per-child temporary APPDATA/ProgramData only for that test on Windows; palette source/tests are unchanged. Full npm test and real Electron IPC subsequently passed.
- Cold service working-set deltas were 3.52 MB, then 3.25 MB with bounded daily calculation/Hijri caches, over the 3 MB limit. A minimal Intl-only control measured 2.39 MB; no heap-only metric or trimming used to claim a pass.
- Added a 7,231-byte exact month-boundary cache generated with Intl.DateTimeFormat(en-u-ca-islamic-umalqura), fixed Asia/Riyadh. It covers AH 1400–1500 (roughly 1979–2077), retains runtime Intl fallback outside the cached range, and is checked against runtime Intl at every cached month start/middle/end. scripts/generate-hijri-cache.js regenerates it offline when ICU data changes. This avoids repeated cold ICU residency for contemporary dates without substituting another calendar algorithm. Memory rerun pending; the fallback path can have the documented cold Intl overhead.
- Late initial SMTC playing metadata during adhan now triggers the one allowed pause; subsequent timeline/user-resume events do not repeat it. Expired iqama state cannot resume media even if the timer was delayed. Upcoming imsak is omitted if the next fajr falls on Eid rather than Ramadan. Preferences/resume invalidate the bounded daily calculation cache.


### T10 final backend verification — PR #12

- User accepted T9 before assigning T10; TASKS now records that acceptance. T10 remains scoped to the dev-based backend while the user updates dev with T9; no native production files were imported.
- Code 0b35d28249e68329ad9ceecc39b9e3fa4f73b83f, https://github.com/waliddawood999-ctrl/islandly/actions/runs/40818006161 **SUCCESS**: full npm test, real Electron sender/frame-guarded prayer/Hijri/resume IPC, cold incremental RAM and zero idle Quran requests. Raw samples: https://github.com/waliddawood999-ctrl/islandly/actions/runs/40818006161/artifacts/12872989110.
- Latest full-service Windows Browser working-set means **68.42 → 68.11 MB**, signed **-0.31 MB** (normal working-set variation, not savings). Observed initialization checkpoints were at most **0.77 MB** above baseline mean. Earlier cache-enabled run +0.10 MB; both below 3 MB. Zero startup Quran requests, one initial state event. 15s warmup/30 one-second samples per phase; no GC/working-set trimming or heap-only substitution. Details/commands in docs/T10.md.
- Cache-generated dates match runtime Intl across every cached month boundary/middle/end; AH 1400–1500 is covered, with lazy runtime Intl outside that range. The cold fallback can exceed the contemporary-date budget and is documented. Regenerate via scripts/generate-hijri-cache.js when ICU data changes.
- Protected renderer/settings UI/palette/fonts/CSS unchanged. PR #12 targets dev; no merge/main push. Claude review requested for T12 IPC/audio/CSP consumers and the two-minute adhan correction. Native-owner integration and manual playback verification are deferred, not claimed complete.

## 2026-10-29 · Codex · T13 scoped tests/CI

- User accepted T10 and assigned T13. Created codex/T13-tests-ci directly from fetched dev 3cfd490. dev still lacks accepted T9 native production files and T11 JSON catalogues. User explicitly chose **keep prerequisites explicit; finish scoped tests**. No production code from those branches is imported; no merging/main pushes. T10 acceptance recorded in TASKS.
- Scope is the user's three checks: bidirectional ar.json/en.json key parity, real UI e2e under xvfb, and native idle RAM/CPU CI gates. Older brief package-size/CDN checks are outside this scoped request.
- JSON guard discovers the real catalogue pair in src/renderer/locales, src/locales or locales, with ISLANDLY_LOCALES_DIR for an explicit application directory. Missing/ambiguous/invalid/empty catalogues fail; no inline-string/fixture fallback. Nested keys/arrays use escaped JSON pointers so dotted keys cannot hide structural differences. Missing keys are reported both directions; incompatible types fail too. No locale files are created or edited.
- Native thresholds preserve T9: RAM <180 MB and 60-sample mean idle CPU <1%, both before and after opening panels. RAM also fails on any raw idle sample at/over 180 MB. T9 reference values: overlay 39.43 MB / 0.21%, AppBar 39.76 MB / 0.39%; these are comparison baselines, not stricter CPU ceilings or replacement measurements.
- Baseline/evidence stored in test/ci/perf-baseline.json. Guard recomputes means from exactly 60 one-second raw snapshots after >=15s warmup, verifies process sums/CPU fields, rejects non-native/Electron/helper residency, malformed/incomplete data and wrong mode/platform. Counts native host plus its entire job via accepted T9 test/native-footprint.ps1 instrumentation; no getAppMetrics Electron-only substitute, trimming or heap-only budget.
- Native Windows jobs compile and measure the **candidate checkout** in both modes, log deltas against T9 and upload raw JSON. They fail explicitly if native/Islandly.cs or scripts/build-native.ps1 is missing. An archived accepted branch is never measured instead of the changed candidate. These jobs cannot pass on current uncombined dev; user acknowledged that dependency.
- UI e2e runs on Ubuntu 24.04 with xvfb/openbox, the real XTEST pointer/keyboard and installed python3-xlib. The existing assertions are retained. Test-only profile disables network/host pollers to preserve injected fixtures; optional screenshots/logs are uploaded. Added a watchdog and unhandled-rejection failure exit so a stuck run cannot silently pass. Linux --no-sandbox/--disable-gpu flags apply only to this panel UI test, not the Windows native performance measurement.
- Workflow runs on every PR, push to dev and manual dispatch. Pure guard regressions join npm test through a discovering test runner so integration does not drop later *.test.js suites; Windows palette app-index fixture uses isolated child-only APPDATA/ProgramData without editing palette source/tests. npm test passes locally. Windows/Ubuntu CI validation pending; missing T9/T11 prerequisites will remain visible failures, not skips.


## 2026-10-29 · Codex · T13 PR #14 continuation

- User requested fixing the four failing checks on the same branch/PR. Verified branch/remote e25d31e and dev still 3cfd490; no newer task prerequisites are present. Prior user decision to keep prerequisites explicit remains in effect. Three failures are missing production dependencies: contracts lacks T11 ar.json/en.json; both native-mode jobs lack native/Islandly.cs/build script from accepted T9. These cannot honestly pass without the prerequisites; no skip/fake catalogue/archive-app workaround was introduced.
- xvfb run 40820410667 exercised the real panel app: first nine assertions passed; to-do typing timed out, and its unreleased notes state cascaded into privacy/top-edge failures. The driver now explicitly activates the existing X11 window after the app declares it focusable, then checks actual OS/DOM focus and XTEST-entered text before pressing Return. It does not alter app focusability, set an input value, inject DOM key events, or modify production focus code. This is Linux test-driver activation, not a claim that Windows/Linux click-to-focus production behavior was changed.
- Notes cleanup runs even after a failed assertion so privacy and top-edge checks remain independent. Failed steps now retain screenshots and focused-window/DOM/input-value/X11 diagnostics.
- Tightened the performance report validator: missing/non-finite warmup metadata is rejected; a native host restart between startup/returned-idle phases is rejected; null raw snapshots receive a useful error. Added regression fixtures; npm test passes locally. CI rerun pending. No renderer/settings UI/palette/font/CSS edits; no merge/main push.

### T13 continuation verification — PR #14

- Commit 38644c91b5d7ce61e68d5c750da1352225eead26: [CI run 40832960874](https://github.com/waliddawood999-ctrl/islandly/actions/runs/40832960874). Ubuntu ui-e2e **passed all 12 assertions**, including real keyboard notes entry, privacy indicator and top-edge activation; final log says E2E OK. The test-driver focus/cleanup failure is fixed.
- Full npm test passed locally and in the contracts job. Three checks remain blocked: contracts fails only on absent real T11 ar.json/en.json; native-idle overlay and reserved-bar fail preflight on absent T9 native/Islandly.cs. Current dev remains 3cfd490. No native RAM measurement is claimed for this checkout.
- Scoped tests are ready for dependency integration, but overall CI is **not green** and T13 is not declared accepted. Per the user's explicit prerequisite decision, guards continue to fail rather than skip or substitute archived production/fixture data. After T9/T11 reach dev, update this branch from that base and rerun all checks. PR #14 remains draft targeting dev; no merge/main push or protected UI edits.

## 2026-10-29 · Codex · T15 acrylic pill backend

- User accepted T13 as scoped and assigned T15. Branch codex/T15-acrylic-pill created directly from fetched dev 3cfd490; no merges/main pushes. Carried forward coordination docs only. dev still lacks T6 shape-emitting UI, T7 AppBar and accepted T9 native host. This PR implements the current Electron backend; it does not claim native collapsed-host acrylic or AppBar integration.
- Implements §2.11 material:get/material:changed and island:shape with sender/main-frame checks, settings materialEffective broadcasts, Windows 11 build >=22000 detection, acrylic default shared from services/store.js, validated material persistence and glass fallback after DWM/GDI failure. Existing glass preference remains respected. Settings preload adds material() and the two permitted event subscriptions; UI files unchanged.
- Converts CSS shape × settings scale × monitor DPI to physical HWND-relative integers; clamps corner radius, rejects malformed/oversized shapes. CreateRoundRectRgn/SetWindowRgn use direct koffi calls. Windows owns successful regions; failed regions are deleted. Identical physical shapes are skipped; resize, scale and display changes reapply the latest shape. Glass clears the region. No polling/process launches added.
- Initial clipping uses a conservative envelope-sized pill before the first exact T6 shape, so acrylic never starts with a rectangular region. Claude: integrate T6's existing shape producer and verify the first frame and each animation; the old dev renderer does not send exact shapes. CSS shadow outside the region is clipped as allowed by the spec. DWM shadow visibility and visual match are unverified; no shadow redesign.
- Local npm test passes, including geometry/DPI, fallback, deduplication, resize and ownership regressions. Windows CI adds a real HWND/GDI/DWM smoke and 300-call region timing (mean <1ms); measures backend call duration, not animation CPU or full T9 RAM. CI result pending. No local Windows session or visual test claimed.
- Claude review/manual integration: Windows 11 collapsed/expanded/animation blur stays inside the actual pill; Windows 10 dark-glass fallback and disabled UI explanation; immediate material switching; fractional/mixed DPI and both modes; animation CPU with T9. Run npm test, then npx electron test/material-native.js on Windows 11 for API/timing verification, and npm start for visual checks after T6 integration.

### T15 verification — PR #16

- Draft PR to dev: https://github.com/waliddawood999-ctrl/islandly/pull/16. Code a4908a2b6264e860778235b482e87ca15e0ae2e5, Windows CI https://github.com/waliddawood999-ctrl/islandly/actions/runs/40834486202 **SUCCESS**. Full npm test passes on Linux and Windows.
- Real Windows Server 2025 runner (windows-2025-vs2026 image): acrylic applied successfully; actual GetWindowRgn/PtInRegion confirmed pill center included and corner excluded; glass removed the HWND region. 300 direct region updates: mean **0.063612 ms**, p95 **0.104800 ms**, max **0.273200 ms**. These are API call durations, not animation CPU measurements or a Windows 11 laptop visual test.
- HWND Buffers are decoded to pointer-sized integer handles before calling Win32; ownership tests cover successful transfer and failed-call deletion. No renderer/settings UI/palette/font/CSS edits; no merges/main pushes. Claude review and T6/T9 integration/manual checks listed above remain outstanding.

## 2026-10-29 · Codex · T14 backend Eco and RAM

- User assigned T14 backend after noting T15. New codex/T14-eco-backend created directly from fetched dev 3cfd490. No task branches merged or production dependencies imported; coordination history and the isolated test runner are carried forward. dev still lacks accepted T9 native host/performance backend and T6 UI. This is a scoped Electron backend, not a claim that T9's native background owner is integrated.
- Defaults exported by services/store.js and consumed by settings.js: ecoMode=false, ecoAuto=false, motion='full'. Motion validates full/reduced/off and is broadcast with settings; renderer animation changes remain Claude's work. ecoAuto is explicitly opt-in: effective Eco = ecoMode OR (ecoAuto AND on-battery). AC never overrides manual Eco. Electron powerMonitor supplies initial battery state and on-battery/on-ac/resume events; no battery polling or subprocess. Battery auto was backlog in the original table; the user's T14 backend addendum authorizes its backend logic, with existing off-by-default policy retained.
- Eco slows clipboard 800→4000ms without discarding clipboard history/last text and foreground checks 1000→3000ms (fullscreen recovery stays live). Pauses Bluetooth subprocess polling, System-panel sampling and optional weather/GitHub network refresh timers. Startup in Eco avoids initiating these optional polls. Disabling Eco resumes only enabled weather/token services and the user's existing System-panel subscription. Settings changes during Eco cannot restart paused optional pollers. In-flight requests may finish; no new refreshes are scheduled while paused.
- Suspend pauses these optional services and clipboard plus performance subscription; resume restores according to preferences/current power. Media controls/session data, mic/camera privacy indicators, calendar/update/break reminders and time-tracking accuracy remain active for their existing purposes; this task does not replace T9's event-driven privacy/native process architecture or promise all background timers are removed.
- eco:changed {eco} goes to island/settings on effective state transitions and after each window loads. Settings updates broadcast to both windows. perf:get and strict-boolean perf:watch are settings-main-frame-only; no island/palette access added. perf:update every 5000ms only for a visible subscribing settings window; unsubscribe/hide/close/reload/renderer crash/quit removes the timer/listeners. Suspend unsubscribes; consumer must subscribe again after resume.
- Settings preload retains T9-compatible perf(), call('perf:get'), send('perf:watch', bool), on(event, callback) with unsubscribe, and watchPerf(bool) convenience. Allowed events: perf:update, eco:changed, settings:update. Island preload adds only eco:changed; no UI edits.
- RAM contract matches §2.3: Electron Browser/Renderer/GPU/Utility workingSetSize KB ÷1024, one decimal; label island/settings/palette where known; totalMB=sum displayed mb; percentCPUUsage and process uptime. Tracked PowerShell/reg children are measured directly with OpenProcess/GetProcessMemoryInfo/GetProcessTimes, no measurement helper or working-set trimming. Count includes live tracked PowerShell even if memory query fails; inaccessible/exited children can be absent from rows as allowed by the contract. Short-lived processes between reads are not captured. This is a live panel diagnostic, not an acceptance benchmark or proof of <180MB.
- T9 integration must retain its native owner PID/job membership and shared PowerShell host accounting, with a single performance/Eco owner. This old dev checkout has no native host to include; do not replace T9's accounting with this scoped Electron-only owner inventory. Reconcile overlapping backend modules/main hooks rather than keeping duplicate timers.
- npm test passes locally: manual/battery precedence, suspend/resume re-read, listener cleanup, full totals, subscription teardown; cadence/pause/restoration/disabled-setting tests. Windows CI adds actual main/preload IPC, tracked native PowerShell RAM, Eco broadcasts and real five-second subscription/unsubscribe/hide checks. CI pending. No local Windows desktop, battery-hardware or native-idle acceptance measurement claimed.
- Claude review requested for Eco/motion/perf UI consumers; add controls/initial state binding in protected UI later. No renderer/settings UI/palette/font/CSS edits. One PR into dev, never merge/main push.

### T14 PR #17 first CI follow-up

- Draft PR: https://github.com/waliddawood999-ctrl/islandly/pull/17. First Windows run 40835696386 passed full npm test but the new integration harness failed selecting its settings HWND: Electron 45 does not expose the old preload property in getLastWebPreferences. Fixed harness selection to use the new BrowserWindow ID created by the real openSettings action, without modifying production/UI code or weakening assertions. Rerun pending.

### T14 backend verification — PR #17

- Code 0b1fb194e34f92987f60f14e56f2861512c3eba2: https://github.com/waliddawood999-ctrl/islandly/actions/runs/40835854331 **SUCCESS**. Full npm test passes on Linux and Windows. Real Windows Electron main/preloads pass full process totals, directly measured tracked PowerShell memory, Eco off/on events, five-second subscribed updates and no further updates after unsubscribe or settings hide. Log ends REAL IPC PASS.
- Battery/AC/suspend/resume policy and poller transitions were verified with controlled power events/unit clocks; physical battery-hardware testing is not claimed. No native-idle benchmark or sub-180MB claim is made for this old dev checkout. T9 native-owner reconciliation and Claude's motion/RAM UI remain integration work.
- Manual Windows confirmation after prerequisites are combined: npm test; npx electron test/eco-electron.js for actual IPC; enable ecoAuto and unplug/reconnect AC, confirm manual ecoMode remains on across AC changes; use the settings performance subscription while visible, then hide/close it and confirm updates stop. No protected UI changes, merges or main pushes.

## 2026-10-29 · Codex · T17 integration

- Explicit user assignment: create integration branch from dev, combine #2/#3/#4/#6/#10/#12/#14/#16/#17 in order; exclude #13/#15; no branch merges or dev/main changes. Applied selected PR patches and committed on codex/T17-integration. Detailed per-file conflict decisions in docs/T17-INTEGRATION.md.
- Product decision: user approved union clipping around main and lyrics pills, preserving acrylic and lyrics layout. Added backwards-compatible secondary shape. Unsupported-system/API failure behavior remains T15's documented fallback; lyrics never trigger a glass switch.
- Native host owns idle island/AppBar and panel Job; on-demand Electron and full shutdown retained. T9 measurement inventory retained. T14 and T15 wired into native settings/panel consumers. Local npm test and real locale parity pass; full Windows/xvfb/native measurement CI pending. No final measurements or artifact claimed yet.

### T17 CI integration follow-up

- Draft PR #18: https://github.com/waliddawood999-ctrl/islandly/pull/18. First Windows run exposed compiler forward-slash source path interpretation; fixed with Join-Path. Main-window clipping could re-enter through resize callbacks; guarded GDI region application (unit regression added), fixing early Windows main-process exits. Lyrics dimension changes now invalidate the T6 render cache. Overlay-only tint test explicitly selects overlay and restores the matrix mode.
- Code f18bd5b passes contracts, all four real UI combinations (ar/en × overlay/AppBar), Windows Eco IPC, Islamic tests and real two-region material checks. Native measurement jobs found no panel executable: Electron 45 runtime resolution is lazy and those jobs did not run npm test first. Added explicit runtime preparation before starting native measurement, preserving zero-launch native startup. Stored AppBar preference uses canonical appbar; probe mode label remains reserved-bar. Measurements/build pending, no acceptance claimed from the failed lifecycle probe.

### T17 measured native result and manifest reconciliation

- Source 86cbffa guard run 40871409380 SUCCESS: contracts, four xvfb combinations, and both native idle modes. Overlay idle avg/peak 40.17/42.46 MB, CPU 0.363%, settings 415.97 MB, after-close avg/peak 30.59/36.65 MB, CPU 0.311%. AppBar 40.67/42.96 MB, CPU 0.365%, settings 420.45 MB, after-close 31.89/36.96 MB, CPU 0.416%. All owned processes counted, 15s warmup +60 samples per phase; no idle Electron. Full evidence/latency/shutdown in docs/perf.md and docs/T17-INTEGRATION.md.
- Manifest audit corrected package fields from later pre-T9 snapshots: native start script and full-install base 3 must survive integration. Windows packaging/remaining checks rerun on this correction; no acceptance claimed until they pass. Existing preview build is about 158.72 MB despite maximum ZIP compression and exclusion of development files, above the optional 100 MB target. No incompatible runtime components removed just to claim a smaller archive.

- Packaging keeps only Windows x64 koffi and Arabic/English Chromium locale packs, preserving application fonts/licenses and hardware/software GPU components. Full packaged smoke verifies runtime operation after pruning; final build size/link will be published in PR #18. All runtime/backend work is on this branch only; review/draft status recorded in TASKS.

- Added native-only preference roundtrip to both source/packaged lifecycle smoke: change Eco and glass/acrylic settings, verify native status applies them while owning exactly one process and launchCount remains zero, then run the existing state/crash/AppBar checks. This tests native wiring in addition to the Node policy and bare-HWND material tests; does not change the 15s/60-sample measurement protocol.

## 2026-10-29 · Codex · T17 high-priority real-hardware launch failure

- User reports Windows 11 build 26300 Acer x64/OneDrive Desktop: old T9 host repeatedly raises an unhandled Win32 error 87 before any child/log. Investigating on the existing T17 branch/PR #18; no merge/main push. Laptop failure is not claimed reproduced locally.
- Definite diagnostic defect: GetLastWin32Error was read after EndSession/native cleanup, so 87 can mask the actual CreateProcess error. Capture immediately at every failing API, log stage and native error before cleanup. Validate x64 STARTUPINFO=104, PROCESS_INFORMATION=24 and extended job limits=144.
- Production packaged defaults previously used resources/app as an unnormalized working directory; old CI always supplied --root checkout, missing this path. Canonicalize paths, launch with executable-parent cwd. Remove unused inherited anonymous stdin/stdout/stderr handles and STARTF_USESTDHANDLES; named session IPC already handles all commands/state. Preserve suspended creation, Unicode environment block and job assignment before resume.
- Native diagnostics created in the profile at launch-request, before any child; bounded rolling native-panels.log captures exact stage/API/error and safe ABI/path context, never environment values. Recoverable OpenPanel errors clean up partial jobs/pipes, show a throttled balloon and retry once; later user action can retry. WinForms/task/fatal logging boundaries suppress the .NET unhandled-exception dialog.
- New packaged Windows input regression stages under a OneDrive-style path with spaces/Arabic/&; passes no --root/--electron overrides, activates via real hover/click/Ctrl+Alt+I, verifies the named activation source and owned IslandlyPanels process, full shutdown, missing-runtime failure and recovery. Actual OneDrive cloud-provider behavior and build 26300 hardware require Walid confirmation; CI is a real Windows runner, not his laptop.

### T17 launch investigation evidence

- First fix CI compiles x64 host and passes source/packaged protocol lifecycle, existing Windows IPC/material tests, RTL/LTR UI and native preference smoke. Exact baseline 5420c0b **does open on the Windows Server runner** using packaged defaults under the OneDrive-style path, so the Windows 11 build 26300/cloud-provider hardware failure is **not reproduced**; no exact hardware root-cause confirmation claimed. Capturing the original error before cleanup is a definite fix; path/stdio hardening removes unnecessary launch dependencies.
- New real-input harness initially stopped before any input because Process.MainWindowHandle excludes the island's tool window. Locate the actual visible island by EnumWindows/PID/title instead, then use OS pointer/button/key APIs. The profile diagnostic artifact is uploaded on failure. Laptop exception stack/exact path requested to distinguish process-creation, pipe and OS-policy/provider failure.

- Strengthened the failure injection to an existing invalid PE executable: this reaches CreateProcessW and must preserve native error 193 through cleanup (rather than merely testing a File.Exists guard). Expect exactly one retry, then restore the real executable and prove the next real click opens a panel. This diagnoses the confirmed last-error clobbering defect without claiming the laptop's original underlying API error was 193.

- Real OS hover reaches and launches the panel in CI. Corrected its diagnostic origin from click to hover so the regression verifies the actual handler accurately; activation-source assertions remain enabled. Re-running all checks and packaged failure/recovery coverage on this revision.

- Walid supplied the visible exception stack: OpenPanel(String command) -> constructor timer delegate -> WinForms Timer.OnTick; message alternates error 87 and error 0 (“The operation completed successfully”). Actual executable folder is C:\Users\walid\Desktop\Islandly-T9, despite visible Desktop redirection to OneDrive. This confirms the escaping timer path and supports last-error clobbering; it does not reveal the original CreateProcessW error. Added docs/T17-LAUNCH-VERIFY.md with safe artifact/laptop confirmation steps.
- Candidate b697ca3 passes actual packaged hover, click and Ctrl+Alt+I launches and complete shutdown on Windows CI 40879480170. The invalid-PE injection timed out awaiting failure logging; retaining the failing assertion and exposing native log/last status in CI stdout to distinguish blocked launch, input delivery and recovery defects before publishing an artifact.

- Diagnostic CI 40880496262 proves all three real inputs pass, then the invalid-PE failure click reaches CreateProcessW but that call does not return for 30 seconds (no failure log; status stops updating). This is distinct from an input-delivery failure and consistent with a blocking Windows loader error dialog. Added thread-scoped SetThreadErrorMode(SEM_FAILCRITICALERRORS | SEM_NOGPFAULTERRORBOX | SEM_NOOPENFILEERRORBOX) only around CreateProcessW, restoring the prior mode afterward and retaining immediate error capture. Re-run the unchanged invalid-PE193/retry/recovery assertions; not claiming this CI fixture reproduces Walid's original underlying error.
- Recorded candidate b697ca3 native RAM/CPU measurements in docs/perf.md: overlay idle 40.17/42.34 MB avg/peak, CPU .416%, settings416.12MB, returned27.89/35.14MB; AppBar40.66/42.76MB, .522%, settings423.06MB, returned30.48/36.37MB. Both guards pass all samples; automated Windows runner only.

- Windows CI 40881392714: scoped loader-error mode resolves the blocking malformed-image launch; host logs original error216, remains responsive and retries exactly once. The regression incorrectly assumed Windows must return193; this runner returns216 for the text-as-EXE fixture. Added an independent direct CreateProcessW reference in the test and require both host failure entries to preserve that exact API result (bounded to legitimate malformed-image193/216). Assertions still require one retry, user-action recovery and full shutdown; no production error-code rewriting.

## 2026-10-29 · Codex · T17 launch recovery verified in packaged Windows CI

- Source cf89cc21ff5bfa9924464932157e731d09b2316e: Windows packaged job123476637877 in run40882272649 SUCCESS. Real hover/click/Ctrl+Alt+I each launch IslandlyPanels and fully return to native-only idle. Direct CreateProcessW malformed-image reference returns216; both initial and single retry preserve216 through cleanup. Restoring the copied executable and real-clicking successfully opens again, then fully shuts down. Native log shows no escaping timer exception or modal launch failure. Regression uses >50k-character Unicode environment and production default root/runtime paths from a Unicode/space-containing staged package, not an actual OneDrive provider.
- New validated artifact: https://github.com/waliddawood999-ctrl/islandly/actions/runs/40882272649/artifacts/12901307086 (inner Windows ZIP141.75MB, optional100MB target not reached). Diagnostic logs artifact12901446679. Artifact contains the hardened T17 host; do not use the earlier90a1ae1 preview for this bug.
- All contracts/ar-en × overlay-AppBar UI/native-idle jobs pass in40882272509. Fresh raw measurements in docs/perf.md: overlay40.12/42.27MB idle avg/peak, CPU.467%, settings415.10MB, returned27.82/34.61MB; AppBar40.66/42.80MB, CPU.626%, settings417.28MB, returned28.59/35.46MB. Same15s/60 samples and every host/Job PID; idle has no Electron. Local npm test passes. Remaining longer Windows lifecycle/performance workflows continue; final PR metadata will link final checks.
- Confirmed fixes: immediate Win32-error capture, caught/logged launch failures with throttled tray balloon and one bounded retry, explicit checked x64 layouts, normalized executable-parent cwd/no unused inherited stdio, scoped loader-dialog suppression. Underlying laptop CreateProcess failure is still unknown because5420c0b opens on CI and Walid's old cleanup clobbered its error. Laptop confirmation/new native-panels.log is still required; exact safe steps are in docs/T17-LAUNCH-VERIFY.md. No manual Windows11/build26300 test or AppHangB1 root cause claimed. No renderer/settings UI/palette/font/CSS edits in the bugfix. No merge or dev/main push; PR18 remains draft.

## 2026-10-29 · Codex · T17 SAC diagnosis and optional signing

- Walid's supplied laptop evidence identifies the root cause as Smart App Control (On), not Desktop redirection or a demonstrated launch ABI defect. CodeIntegrity3077/3118/3033/3089 shows unsigned T9 IslandlyPanels.exe blocks at15:34/15:35/15:40/15:41(x2)/16:09 Riyadh, policy0283ac0f-fff1-49ae-ada1-8a933130cad6. The cf89cc2 host itself is now blocked before entry by application control, so no native log/tray message is possible. This supersedes the earlier “underlying cause unknown” state. Keep SAC enabled; prior unsigned previews are not laptop fixes.
- Native classification covers Win32 policy/image-hash errors577/1260/4551, relevant NTSTATUS/HRESULT forms and wrapped exceptions. The clear Arabic/English tray notice requires a signed build; policy blocks stop automatic retry and repeated hover launches, while explicit click/hotkey/tray actions can retry after replacing the runtime. Unrelated errors preserve one bounded retry. Source diagnostics/job ownership remain intact; no renderer/settings UI/palette/font/CSS changes.
- Windows packaging now prepares -> optional signing -> fresh archive -> packaged regression -> artifact. Both Islandly.exe and IslandlyPanels.exe are SHA256 Authenticode-signed/timestamped/verified when both PFX secrets are supplied on a trusted manual workflow_dispatch. PR jobs receive neither secret. No secrets means an explicit unsigned skip/status; partial or invalid credentials/signature/timestamp failure fail closed without unsigned fallback. PFX remains ephemeral/in memory; no certificate purchased/generated/installed/configured or repo secrets changed. Signing and SAC acceptance remain untested without credentials; native dependencies/trust may need later validation. Docs/WINDOWS-SIGNING.md gives exact inputs/limits and notes manual dispatch default-branch availability without changing main.
- Added Windows numeric-classification/retry/bilingual-message tests and absent/partial/malformed signing-configuration guards (no certificate setup). Local npm test PASS (exit0); Windows CI results will be recorded in PR18 metadata after validation. Native/test compilation explicitly uses UTF8 so Arabic survives Windows code pages; keep draft, no merge or dev/main push. Laptop validation is blocked pending Walid's signing decision.
- Checked constants against Microsoft's public WinSDK winerror.h/ntstatus.h: the exact “An Application Control policy has blocked this file” status is STATUS_SYSTEM_INTEGRITY_POLICY_VIOLATION (C0E90002), mapped to4551. Include raw status and HRESULT_FROM_NT forms alongside the image-hash/policy cases; negative tests prevent misclassifying generic access violations/denials.

## 2026-10-29 · Codex · T18 executable reputation preservation (in progress)

- User-authorized branch codex/T18-sac-reputation from T17 9e1fdaa; draft target codex/T17-integration, no merges. Full known-good758E Electron hash/original ZIP requested; no such full pin found in repo/releases. Packaging intentionally blocks on null reference pins rather than inventing identity or asserting SAC acceptance. Work continues independently on deterministic native build and package/CI wiring.
- Downloaded published T9 ZIP read-only, verified archiveSHA89913f4327f1b112343e0a4c9b8730f5c60d8013f46ae7eed0c227940e5d3575. Native accepted E138 fullhash is e13846b221380b1accf4f79cad17dc721f72a5ad406a3f95682f3089fe64382b; its runtime is190bd5d696f1a2e4867f769306a980c6efc359e7a5ca86a188ddb447dd7ae30b, not758E. Exact old native reuse cannot meet required T17 bilingual policy handling before child creation; no config/IPC hook exists. Preserve hardening and change only three native default-path expressions; move layout resolution into main/bootstrap helper, keep all idle duties native.
- Pinned Roslyn4.14.0 SHA941a9cf3ea618d88d01a3dd6b1a45a06bcf07716a9f81ce4031caa3edd24a845 and net48 reference1.0.3 SHA8a7e348538e7eb91351696911689f49e3d4f63f8bab517432bbe159b8b1104a2. Deterministic/path-mapped UTF8 build and two-clean-root comparison; host baseline will be filled from Windows output, new hash needs laptop test. Source/Job RAM ownership unchanged; Electron/native both namedIslandly distinguished by PID, not omitted by name.
- Packaging copies trusted reference runtime into panels/Islandly.exe, updates resources/app only, never stamps/signs/renames Electron, inventories every EXE and checks exact pinned hash before archiving. T18 disables old stamping path and optional signing; adds packaged overlay/AppBar measurements while preserving hover/click/hotkey/error recovery tests. No renderer/settings UI/palette/font/CSS changes. Local/new tests and CI evidence to be recorded on draft PR; artifact and758E match not claimed while reference is missing.
- Follow-up: Walid supplied full758E43CF25850408FA42D7DE76565561AE329B353B8FACC508ECE9875BCD1592 and original ZIP23B80C7F766BDB4050221DD7E0122185E643828712E7E4CEBB24B50F4140C13E (claude.ai, no public URL), and explicitly authorized reproducing old0.4.0 version resources. Locked packager20.3.0/resedit2.0.3 with fixed identity fixture plus stock CompanyName GitHub, Inc. produces **exact full758E match locally** (249,798,656bytes). No guessed hash and no claim matching resource strings alone is sufficient. Windows CI will verify the same reproduction before copying unchanged to panels/Islandly.exe; all app changes stay resources/app. Original ZIP can alternatively be supplied locally by checksum. No signing/SAC changes.
- T18 source5968a209859fc057b5c8db1e9523c0997a7c1adf: all seven CI workflows PASS. Windows reproduces exact Electron758e43cf25850408fa42d7de76565561ae329b353b8facc508ece9875bcd1592; native host is reproducible c7a5f5998c0a148e8da8bc38ce649ad172c3e8d7086cd24990245fb71cf1f501 across clean roots and independent native/package jobs. Pin this candidate baseline separately from accepted E138; new host still requires laptop SAC test. Only two EXEs are present, both namedIslandly.exe in separate root/panels folders; full hashes in docs/T18-SAC-REPUTATION.md and package EXE-SHA256.txt.
- Draft PR20 targets codex/T17-integration. Artifactislandly-t18-sac-reputation-windows (inner Islandly-sac-reputation-win64.zip,152.54MB): https://github.com/waliddawood999-ctrl/islandly/actions/runs/40935706701/artifacts/12925517588. Actual packaged hover/click/hotkey/recovery/shutdown pass. Packaged native idle means overlay39.87MB/CPU.233%, AppBar40.35MB/CPU.467%; settings417.23/419.31MB, returned28.23/31.01MB. Same15s/60 samples, host+allJobPIDs, no idle Electron/no trim. Rawreports12925597405 and full method in docs/perf.md. Local npm test PASS (exit0). Final pin/version-resource metadata/strict packaged raw-budget checks rerun; final CI links in PR metadata. Laptop test requested in parallel; not claimed completed, keep SAC enabled. No merge or main/dev/T17 push.

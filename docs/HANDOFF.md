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
| `surfaceMode` | `'overlay'` \| `'appbar'` | `'overlay'` | T6/T7 |
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
- **اسم مفتاح وضع الجزيرة:** اسمه في الكود منذ T6 `surfaceMode`، وهو اللي سمّاه وليد `islandMode`. نبقيه `surfaceMode` لأنه منفّذ ومختبر (`test/surface.test.js`)، ما لم يطلب وليد غير ذلك.
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

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

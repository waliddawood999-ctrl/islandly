# مراجعة PR #1: `feat/reliability-and-productivity` (0.5.0، base 3)

- المراجع: Claude (T0). التاريخ: 2026-10-28.
- النسخة المراجعة: `f67d587` (82 ملف، +10805 / −1861) مقارنة بـ `main` عند `3cfd490` (0.4.0).
- المراجعة قراءة كود + تشغيل الاختبارات على **Linux (Electron 45 تحت xvfb)**. **لم يُختبر شيء على ويندوز حقيقي.** أرقام CI على `windows-latest` من Codex لم أعد تشغيلها.
- التصنيف: **blocking** = لازم يتصلح قبل الدمج في `dev`. **should-fix** = قبل إصدار 0.5.0. **nit** = تحسين.

## الملخص

العمل على الـ updater والـ lifecycle ممتاز ومُختبر جيداً: فصل الـ stage، عدم حذف مجلد النسخة الجارية، `RequestScope`، التحقق من المسارات، وإصلاح `NODE_PATH` بدل `globalPaths.push`. هذا الجزء جاهز تقريباً.

المشاكل الرئيسية أربع:
1. **regression حقيقي في الـ hover** (موثّق بالقياس تحت).
2. PR ضخم يخلط إعادة تنسيق كاملة مع تغيير منطق، فتصير مراجعته صعبة.
3. ميزات بسطح أمان (مشاركة على الشبكة، تسجيل الشاشة، أدوات خارجية، تنزيل OCR) غير مقفولة بإعداد افتراضي.
4. `test/ui-e2e.js` أحمر على الفرع ولا يعمل في CI.

**توصيتي:** تقسيم الـ PR (القسم الأخير).

## نتائج التشغيل الفعلية

البيئة: Linux, Node v22.22.0, Electron 45 (`node_modules/electron/dist/electron`), Xvfb 1600x900, على `f67d587` في worktree منفصل، بعد `npm ci`.

### `npm test`
```
$ npm test
ics ok
updater helpers ok
palette tests: 72 passed
ai tests ok
TOTAL: 7 reliability regressions passed.
feature integration: LRC, notification digest, settings validation, secret protection, clipboard privacy/limits, WebP, resize, PDF merge and local search passed
renderer DOM integration: all panels load, settings, clipboard, memo, lyrics and timer passed
Media lifecycle: stale worker events and queued commands rejected
exit=0
```
**النتيجة: نجح (exit 0، 8 ملفات اختبار).**

### `test/ui-e2e.js` (مؤشر وكيبورد حقيقيين عبر XTEST)
```
$ xvfb-run -a -s "-screen 0 1600x900x24" node_modules/electron/dist/electron test/ui-e2e.js --no-sandbox --disable-gpu --disable-dev-shm-usage
PASS when idle the window is only as big as the thin line (does not cover tabs or pages)
FAIL hovering the island opens the panel and the window grows to fit it -> timed out: panel open
FAIL play/pause button click reaches the app -> element not found: .ctl.main
FAIL next and previous buttons work -> element not found: .ctls .ctl:nth-child(5)
FAIL +10s / -10s buttons seek relative to the current position -> element not found: .ctls .ctl:nth-child(4)
FAIL clicking the progress bar seeks to that point -> element not found: .bar
FAIL mouse wheel switches to the timer panel and its Start button works -> timed out: timer panel visible
PASS panels never overlap the tab dots and fit inside the island
PASS moving away closes the island and the window shrinks back
PASS typing in the to-do field adds a task with the real keyboard
PASS mic/camera indicator stays visible while in use and the window fits it
PASS pushing the cursor against the top screen edge opens the island and keeps it open
E2E FAILED   (exit=1)
```
**النتيجة: 6 نجاح / 6 فشل من 12.**

**التشخيص** (تعديلات مؤقتة على الاختبار في worktree محلي، أُعيدت ولم تُرفع):
- الفشل الأول: حركة مؤشر واحدة لا تطلق `mouseenter` على `#island`. مع حركة ثانية صغيرة ينجح بند الـ hover.
- حتى مع الحركة الثانية، تتبّعت الحالة كل 150ms بعد الفتح والمؤشر ثابت فوق الجزيرة:
  ```
  DIAG trace O- O- _- _- _- _- _- ...   (O = مفتوحة، _ = مغلقة)
  ```
  الجزيرة **تنغلق بعد ~300ms** والمؤشر لم يتحرك، و `:hover` لم يعد على الجزيرة. لذلك فشلت بنود الموسيقى التالية (`.ctl.main` غير موجود لأن اللوحة رجعت compact).
- مع حركة ثانية: 7 نجاح / 5 فشل.

### `test/electron-smoke.js` (معلومة إضافية)
- الـ palette والصور يمرّان.
- يفشل في حفظ المفتاح على Linux لأن `safeStorage` غير متاح هنا، والـ PR أزال الحفظ غير المشفّر عمداً، وهذا صحيح أمنياً. على ويندوز DPAPI متاح دائماً.
- ظهر في السجل: `Error occurred in handler for 'launcher:list': Error: Unauthorized IPC sender` (انظر S6).

## ملاحظات blocking

**B1. regression في الـ hover: الجزيرة تنغلق وحدها بعد الفتح** — `src/renderer/app.js:4-6`، `src/renderer/island.js:73-87`، `src/main/main.js:132-158`.

0.4.0 كان يستمع لـ `mouseenter/mouseleave` على `document.documentElement`، فالنافذة كلها (الجزيرة + هامش 18px) هي منطقة الـ hover. الـ PR غيّرها إلى `Island.el`. لما تنفتح الجزيرة، النافذة تكبر وتعيد التمركز (`x` تغيّر من 684 إلى 691 في القياس)، فيتحرك العنصر تحت مؤشر ثابت، ويطلق Chromium `mouseleave` بدون حركة ماوس.

النتيجة على ويندوز المتوقعة: الجزيرة ترمش أو تنغلق إذا وقّف المستخدم الماوس، وهي نفس الشكوى الأولى للمستخدم ("ما أقدر أضغط على زر").

إضافة لذلك، click-through الجديد (`setIgnoreMouseEvents(…, {forward:true})` مع hit-test دائري) يعتمد على `mousemove` المُمرَّر لإطلاق `mouseenter`، وهذا لم يُختبر على ويندوز ولا يغطيه أي اختبار (`updateMouseHit` لا يعمل على غير win32).

**المطلوب:**
- إرجاع الـ hover لمستوى النافذة، أو اعتماد hit-test في main كمصدر وحيد للحالة (من مؤشر الشاشة) بدل `mouseenter` على العنصر.
- إثبات ذلك بـ `test/ui-e2e.js` (T2).
- تأجيل click-through الدائري إن لم يُختبر يدوياً على ويندوز (`docs/WINDOWS-TEST.md` البنود 3.1–3.3).

**B2. `test/ui-e2e.js` أحمر ولا يعمل في CI، ولا تغطية للوحات الجديدة** — `.github/workflows/windows.yml`.

الاختبار الوحيد الذي يحرّك مؤشراً حقيقياً هو بالضبط ما كشف B1، وهو غير موجود في CI. والـ CI الأخضر على `windows-latest` لا يغطي hover أو click-through أو حجم النافذة.

**المطلوب:**
- إضافة job على `ubuntu-latest` يشغّل `xvfb-run … test/ui-e2e.js` (يحتاج `python3-xlib`).
- تحديث الاختبار للوحات 0.5.0 (activity, launcher, jobs, assistant, plugins, adhkar) في T2.
- عدم الدمج والاختبار أحمر.

**B3. ميزات بسطح أمان أو اعتماد خارجي غير مقفولة افتراضياً بإعداد.** القواعد الجديدة (`AGENTS.md`) تشترط أن تكون مقفولة. `pluginsEnabled` و `nativeNotifications` و `lyrics` مقفولة، وهذا جيد. لكن:
- **مشاركة على الشبكة المحلية** — `src/main/services/share.js:53`:
  - `listen(0, "0.0.0.0")` على كل الواجهات، HTTP غير مشفّر.
  - `addresses[0]` (سطر 66) يأخذ أول IPv4، وقد يكون محوّل Hyper-V أو VPN، فيصير الرابط خاطئاً أو معروضاً على شبكة غير المقصودة.
  - أول listen يطلق نافذة Windows Firewall باسم Electron.
  - لا يوجد إعداد يقفلها.
  - **المطلوب:** إعداد `lanShare: false` افتراضياً، والاستماع على عنوان الواجهة المختارة فقط (لا `0.0.0.0`)، واختيار الواجهة صاحبة الـ default route، وإظهار اسم الشبكة للمستخدم قبل المشاركة.
- **تسجيل الشاشة واللقطة** — `src/main/capture.js:108-144`:
  - الـ handlers مقيّدة جيداً بنافذة الالتقاط و `mode`، لكن الميزة متاحة بدون إعداد.
  - `setPermissionRequestHandler` على `defaultSession` يرفض كل الأذونات الأخرى لكل النوافذ (سطر 135)، وهو تغيير سلوك عام غير موثّق.
  - **المطلوب:** إعداد مقفول افتراضياً، وتوثيق رفض الأذونات العام.
- **FFmpeg و rembg** — `src/main/services/tools.js:9-21، 59`:
  - يُنفَّذ الاسم المجرد `ffmpeg` / `rembg`. `CreateProcess` على ويندوز يبحث في مجلد التطبيق والمجلد الحالي **قبل** `PATH`، فهذا مسار لزرع ملف تنفيذي.
  - **المطلوب:** أخذ المسار الكامل من مخرجات `where.exe` (أول سطر)، والتحقق أنه ملف موجود، وتنفيذه هو. مع إعداد مقفول افتراضياً.
- **OCR** — `src/main/file-worker.js:51`:
  - `createWorker("ara+eng")` بدون `langPath` ينزّل بيانات اللغة من CDN خارجي (jsdelivr) أول مرة، بدون تثبيت نسخة أو checksum.
  - هذا موثّق في `IMPLEMENTATION-STATUS.md`، لكنه يحدث بدون موافقة صريحة في الواجهة.
  - **المطلوب:** إما تضمين `ara.traineddata` و `eng.traineddata` مع checksum، أو `langPath` مثبّت الإصدار + sha256 + رسالة موافقة قبل أول تنزيل.

**B4. خلط إعادة تنسيق كاملة مع تغيير المنطق** — كل ملفات `src/`.
- الملفات التي لمسها الـ PR صارت بـ double quotes (prettier الافتراضي، بدون `.prettierrc`)، والباقية single quotes.
- العدد على الفرع: **57 ملف double / 31 ملف single**. و `prettier --check` يبلّغ عن 27 ملف غير منسّق.
- قياس: بعد تمرير نسختي `main` والفرع على نفس إعدادات prettier ثم المقارنة، يبقى من diff `island.js` **41 سطراً منطقياً من 181** (77% تنسيق). `app.js`: 57 من 113. `main.js`: 486 من 953. هذا يخفي تغييرات منطقية مهمة، مثل B1 نفسه (سطرين وسط سطور تنسيق).
- **المطلوب:** إعادة الملفات لنمط `main` (single quotes، والـ `.prettierrc` الجديد في T0)، أو على الأقل فصل التنسيق في commit/PR مستقل. التوحيد الكامل يتم في T4 بعد الدمج.

**B5. نطاق الـ PR: يجب تقسيمه** (التفاصيل في القسم الأخير).
- 82 ملف، 6 لوحات جديدة في ملف واحد (`productivity.js`)، جسر WinUI بـ .NET، MSIX، plugins، وتسجيل شاشة، في PR واحد يستهدف قناة التحديث التلقائي.
- جسر الإشعارات يعمل فقط من حزمة MSIX، ومسار التوزيع الحالي zip. والـ MSIX غير موقّع، فلا يُثبَّت عند المستخدم بدون Developer Mode أو شهادة. عملياً الميزة ستعرض `package-required` لكل المستخدمين.

## ملاحظات should-fix

- **S1. IPC لكل إطار حركة ولكل حركة ماوس** — `src/renderer/island.js:79` يرسل `island:hitbox` من `apply()` في كل إطار rAF (~60/ث أثناء الحركة)، و `src/renderer/app.js:5` يرسل `island:pointer` مع كل `mousemove`. **المطلوب:** إرسال الـ hitbox عند تغيّر الهدف وعند الاستقرار فقط، وخنق `island:pointer` (rAF أو 30ms). يُقاس في T5.
- **S2. عدد اللوحات** — صارت ~19 لوحة قابلة للتوسيع. التنقل بالعجلة طويل، والنقاط تزدحم في أصغر عرض. **المطلوب:** اللوحات الجديدة (activity, jobs, plugins, adhkar…) تكون في `disabledFeatures` افتراضياً، أو تُجمع في لوحة واحدة.
- **S3. حجم الحزمة** — `scripts/package-win.sh` أزال تقليم بناءات koffi لغير `win32_x64` (البناءات الأخرى حوالي 26MB من 28MB، وبناء `win32_x64` وحده 1.6MB). مع sharp و tesseract.js الحزمة تكبر. **المطلوب:** إرجاع تقليم koffi وقياس حجم الـ zip في وصف الـ PR.
- **S4. updater ما زال على `main`** — `src/main/updater.js:8` (`BRANCH = "main"`). صحيح الآن، لكنه مرتبط بـ T3 (قناة إصدار). **المطلوب:** عدم دمج 0.5.0 في `main` قبل حسم T3.
- **S5. اختبار smoke يفترض secure storage** — `test/electron-smoke.js` يفشل على Linux بعد إزالة الحفظ غير المشفّر (`src/main/settings.js:136`، وهذا صحيح). **المطلوب:** تخطّي فحص المفتاح حين `safeStorage.isEncryptionAvailable()` false، مع طباعة السبب.
- **S6. `launcher:list: Unauthorized IPC sender`** في سجل smoke — `src/main/main.js:378-397`. التحقق من المرسل يعتمد على `win`. نداء من الـ renderer وصل في لحظة لم يطابق فيها. **المطلوب:** معرفة المرسل (reload؟ نافذة ثانية؟)، وإما إصلاحه أو تجاهله بهدوء بدل رمي خطأ.
- **S7. اختيار الواجهة والتسمية في المشاركة** — جزء من B3، ويُذكر هنا لو تقرر إبقاء الميزة: الرابط يجب أن يعرض اسم الشبكة/الواجهة.
- **S8. rembg و FFmpeg في أول تشغيل** قد ينزّلان نماذج (rembg)، وترخيص النموذج غير مراجع (مذكور في الوثيقة). يُؤجَّل مع B3.

## nit

- **N1.** تعريفات CSS مكررة تُلحق تعديلات في آخر الملف بدل دمجها: `.view` (`styles.css:89` و `:152`)، `.nt-list` (`:1228` و `:1596`)، `.music-expanded` (`:493` و `:1601`).
- **N2.** `styles.css`: الاتساق مقبول. ألوان hex مميزة 31 مقابل 24 في 0.4.0، أحجام خط 13 (نفسها)، نصف قطر 17 مقابل 16، صفر `!important`، و `var(--…)` مستخدمة 52 مرة. الزيادة الحقيقية أقل مما يوحي به +1781، لأن prettier فكّ الأسطر (342 سطر مضغوط إلى 1607). يُفضّل جمع الألوان الجديدة (مثل `--cover-accent`) في `:root`.
- **N3.** `Module._initPaths()` في `bootstrap.js` API داخلي في Node. يعمل ومغطّى بـ R1، لكن يستحق تعليق يذكر نسخة Electron التي اختُبر عليها.
- **N4.** `islandly-run.ps1` و `terminal-events.js` (إشعار انتهاء أوامر الطرفية) غير موثّقين في README للمستخدم.

## أسئلة المراجعة المطلوبة

- **regression في الواجهة عن 0.4.0؟** نعم في الـ hover (B1). حجم النافذة يطابق الجزيرة (البنود 1 و 8 و 9 نجحت). المهام: الكتابة تعمل (بند 10 نجح، والـ focusable صار في `island.js` لـ notes و assistant). الـ palette سليم في smoke. click-through غير مختبر.
- **التصميم متسق؟** مقبول عموماً (N1، N2). المشكلة الأكبر كثرة اللوحات (S2).
- **خلط الـ quotes؟** نعم (B4).
- **سطح الأمان؟**
  - LAN share: B3.
  - Plugins: جيد. sandbox، و partition مستقل، و CSP `default-src 'none'; connect-src 'none'`، وبطاقات نصية محدودة (عنوان 80 حرف، نص 2000)، و `pluginsEnabled:false`. البطاقات تُعرض كنص عبر `h()` (`productivity.js:329-330`)، لا HTML.
  - FFmpeg و rembg: B3.
  - تسجيل الشاشة: B3. حد 64MB في الذاكرة جيد.
- **الميزات الخطرة مقفولة افتراضياً؟** جزئياً. انظر B3.
- **base 3 ضروري؟** **نعم**:
  1. إصلاح `bootstrap.js` لا يصل بالتحديث التلقائي لأن bootstrap جزء من الـ base.
  2. sharp فيه ملف native جديد (`@img/sharp-win32-x64`)، و pdf-lib و tesseract.js تبعيات جديدة. بدون base 3، نسخة 0.4.0 ستنزّل كوداً يطلب وحدات غير موجودة، فينهار التشغيل ويرجع للنسخة المحزومة.

  التوصية: بما أن base 3 سيُفرض على الجميع (تحميل zip جديد)، ضمّنوا فيه **كل** التبعيات المتوقعة لسلسلة 0.5.x، حتى لو بقيت واجهة بعضها مؤجلة، حتى لا نحتاج base 4 قريباً.
- **هل نقسم الـ PR؟** نعم، انظر الاقتراح تحت.

## اقتراح التقسيم

**PR-A: 0.5.0 الأساس (يدخل 0.5.0)**
- updater: stage منفصل، عدم حذف النسخة الجارية، `RequestScope`، التحقق من المسارات والإصدار.
- `bootstrap.js`: إصلاح `NODE_PATH`.
- lifecycle: calendar، weather، media-worker، privacy، clipboard privacy races، file-worker shutdown.
- settings: validation و secret protection.
- اختبارات: `reliability.test.js`، `media-lifecycle.test.js`، `features.test.js` (الأجزاء الخاصة بما سبق).
- CI: الـ verify job، مع إضافة ui-e2e (B2).
- base 3 مع **كل** تبعيات 0.5.x (sharp, pdf-lib, وتبعية OCR إن تقرر).
- بدون إعادة تنسيق (B4).

**PR-B: أدوات إنتاجية آمنة (0.5.0 أو 0.5.1 بعد إصلاح B1)**
- تحويل الصور (WebP، resize) و PDF merge (عامل مستقل).
- حفظ المؤقت، launcher، file search بحدود، reminders، focus mode بدون تعتيم.
- lyrics (مقفولة)، adhkar، multi-monitor (`monitorId`).
- تحديث `test/ui-e2e.js` (T2).

**يُؤجَّل (0.6+، كل واحد في PR مستقل مع إعداد مقفول ومراجعة أمنية)**
- جسر الإشعارات + MSIX (يحتاج توقيعاً وقرار توزيع).
- Plugins.
- LAN share.
- تسجيل الشاشة.
- FFmpeg و rembg.
- OCR (بعد حل مصدر بيانات اللغة).
- تكامل الطرفية (`islandly-run.ps1`).
- click-through الدائري (بعد اختبار يدوي على ويندوز).

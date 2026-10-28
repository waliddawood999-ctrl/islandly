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

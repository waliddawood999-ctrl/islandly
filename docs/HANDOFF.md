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

## 2026-10-29 · Claude · T9 native visual polish (`claude/T9-native-visual-polish` → `codex/T9-perf-ram`)

**ما تم** (`native/Islandly.cs` فقط، مع خطوط في `assets/fonts/native/`). ما لمست منطق الذاكرة أو الـ CPU أو الجلسة أو الـ pipe أو الـ AppBar.

- **المقاسات من الجزيرة في Electron (T6):**
  - الساعة 100، البطارية المنخفضة 108، المؤقت 112، الميكروفون والكاميرا 176، كلها × 32، على بعد 8px من الأعلى. الخط الرفيع 84 × 5.
  - نصف القطر كامل.
  - كانت قبل 138 × 36 لكل الحالات.
- **الخامة:**
  - **زجاج:** شبه أسود (10,10,13) مع لمعة علوية (أبيض 5% ← 0 على 38%) وحافة 0.5px.
  - **أكريليك:** الافتراضي على ويندوز 11 (build 22000+) وحسب إعداد `material`، عبر `SetWindowCompositionAttribute` (ACCENT_ENABLE_ACRYLICBLURBEHIND) بطبقة داكنة rgba(10,10,14,.46). يرجع للزجاج على ويندوز 10.
- **الخط:** IBM Plex Sans و IBM Plex Sans Arabic Bold.
  - ملفات TTF رسمية بدون تعديل من IBM/plex @71f5589، مع OFL و SOURCE. اضطريت لها لأن GDI+ ما يقرأ woff2.
  - الوقت 14px، ونقطة الساعة الخضراء مع توهج، وحلقة 20px للمؤقت والبطارية، والمؤقت الموقوف بشفافية 60%.
  - صيغة الوقت `m:ss` أو `h:mm:ss` مثل `clock()` في الواجهة.
- **الحركة:**
  - نابض للحجم (visualDuration 0.34، bounce 0.24، نفس قيم Motion)، والمؤقت يشتغل أثناء تغيّر الحجم بس.
  - تكبير 1.04 عند مرور الماوس قبل الفتح.
  - ما فيه مؤقت جديد في الراحة.
- **الأيقونة والقائمة:**
  - أيقونة `assets/tray.png` بدل أيقونة النظام.
  - القائمة والتنبيهات بالعربي والإنجليزي حسب `uiLang`/`lang`، والقائمة RTL بالعربي.
  - نص الخصوصية مترجم: «الكاميرا قيد الاستخدام» و «الميكروفون قيد الاستخدام». القيمة الداخلية صارت `camera`/`mic` بدل النص الإنجليزي.

**الأدلة**
- CI على ويندوز (workflow_dispatch على الفرع، `2b852eb`): https://github.com/waliddawood999-ctrl/islandly/actions/runs/40815150039 . native-windows ✅ و packaged-windows ✅: يعني تجميع csc، و npm test، وقياسات overlay و reserved-bar، وفحص الحزمة.
- **الأرقام الدقيقة ما قدرت أقراها**، لأن مضيف artifacts محجوب في بيئتي. البوابات (< 180MB و < 1% CPU) نجحت. المقارنة الدقيقة مع 39.43/31.00MB تحتاج فتح artifact `t9-native-footprint` من الرابط.
- الذاكرة المتوقعة: ملفّي خط (448KB) محمّلة بالـ mapping، ومؤقت النابض متوقف في الراحة. إضافة صغيرة لكن **لم تُقس بدقة**.

**لم يُختبر:** الشكل على ويندوز حقيقي (أكريليك فوق خلفيات مختلفة، وحدّة النص على DPI 100/150%، والحركة باليد). ما عندي شاشة ويندوز.

**المتبقي (ما سويته، لأنه يحتاج إعادة تصميم لطبقة الرسم أو بيانات من الجلسة):**
1. ظل الجزيرة: نافذة مقصوصة بـ region ما ترسم خارجها. يحتاج `UpdateLayeredWindow` بـ per-pixel alpha.
2. لون الصفحة (`surface:tint`): مقفول افتراضياً حسب AGENTS، وما فيه أخذ عينات في الـ native.
3. غلاف الأغنية والموجة الحية في الوضع المصغّر: يحتاجان بيانات الوسائط في الـ native.
4. أيقونات الميكروفون والكاميرا: نقطة ملونة بدل رمز Lucide.
5. توهج الخط الرفيع النشط.

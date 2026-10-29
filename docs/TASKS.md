# المهام

الحالات: `todo` · `doing` · `review` (PR مفتوح) · `blocked` · `done` (دمجه وليد في dev).
كل طرف يحدّث صفوف مهامه فقط. "المراجع" هو من يراجع الـ PR قبل أن يدمجه وليد.
قسمة الملفات والعقود: `AGENTS.md` (قسم «قسمة الملفات») و `docs/HANDOFF.md` (قسم «عقود IPC v0.5»).

## الإصدار 0.5

| ID | المهمة | المالك | الفرع | يعتمد على | الحالة | المراجع | الدليل |
|---|---|---|---|---|---|---|---|
| T0 | تنسيق: AGENTS/CLAUDE.md، TASKS، HANDOFF، WINDOWS-TEST، تنظيف، .prettierrc، مراجعة PR #1، عقود IPC v0.5 | Claude | `claude/T0-coordination` | — | review | Codex | PR #2، `docs/reviews/PR1-review.md` |
| T1 | إنهاء PR #1 حسب المراجعة (`docs/reviews/PR1-review.md`) | Codex | `codex/T1-review-fixes` | — | blocked | Claude | PR #5 draft to dev; npm test + Windows verify pass; CI 40728979477 UI 11/12; B1/B2/B4/B5 pending; docs/reviews/T1-response.md |
| T2 | تحديث `test/ui-e2e.js` للوحات 0.5.0 وإصلاح أي UI regression | Claude | `claude/T2-e2e-050` | T1 (يبدأ لما يرجع PR #1) | todo | Codex | — |
| T3 | قناة إصدار آمنة بدل `main` + CI يبني zip artifact و draft Release، و CI يشتغل على `dev` مع كل push | Codex | `codex/T3-release-channel` | — | review | Claude | PR #8; npm test pass Linux and Windows; CI 40740700551 SUCCESS (Electron update flow, ZIP artifact); manual Windows pending |
| T4 | توحيد التنسيق بـ prettier (single quotes حسب `.prettierrc`) في PR منفصل | Claude | `claude/T4-prettier` | دمج PR #1 | todo | Codex | — |
| T5 | ~~قياس الأداء والـ polling على ويندوز~~ مدمجة في T9 | Codex | — | — | مدمجة في T9 | — | — |
| T6 | شكل وحركة الجزيرة (Motion، Lucide، الحالات، وضعا الصفحات + IPC، إصلاح الـ hover) | Claude | `claude/T6-island-ui` | T0 (stacked) | review | Codex | PR #3 |
| T7 | Win32 للوضعين: لون البكسلات (koffi) و AppBar بـ `SHAppBarMessage` حسب مواصفة T6 في `HANDOFF.md`، **+ تنظيف AppBar بعد الانهيار عن طريق ملف علامة** (يُكتب hwnd في `userData` عند التسجيل، ويُحذف عند الخروج النظيف؛ عند التشغيل إن وُجد: `ABM_REMOVE` بالـ hwnd المحفوظ ثم حذف الملف) | Codex | `codex/T7-appbar` | T6 | review | Claude | PR #9; Linux/Windows npm test pass; native ABI/GetPixel/AppBar and forced-kill recovery pass; CI 40747778235 SUCCESS; manual visual checks pending |
| T8 | الخطوط: IBM Plex Sans Arabic + IBM Plex Sans (افتراضي)، مقارنة Readex Pro/Alexandria و Manrope/Plus Jakarta Sans، OFL فقط، woff2 محلي subset، unicode-range، `fontPairing` مخفي، ميزانية < 400KB | Claude | `claude/T8-typography` | T6 (stacked) | doing | Codex | — |
| T9 | الأداء والرام (يشمل T5): قياس CPU/RAM/IPC في الخمول والحركة، تقليل الـ polling وعمليات PowerShell، `perf:get`/`perf:update`/`perf:watch`، `eco:changed` حسب العقد | Codex | `codex/T9-perf-ram` | — | done | Claude | PR #10 accepted by user; native idle CI 39.43/39.76 MB; no manual local native measurement claimed |
| T10 | خدمات الحزمة الإسلامية: `prayer:get`/`prayer:state` (pre/adhan/iqama، رمضان، إيقاف الموسيقى)، `media:resume`، `hijri:get` مع المناسبات، `quran:reciters`/`quran:url` حسب العقد | Codex | `codex/T10-islamic-services` | — | review | Claude | PR #12; npm test/Windows IPC PASS; CI 40818006161 SUCCESS; contemporary-date added RAM <3 MB, zero idle Quran requests; native integration deferred per user |
| T11 | واجهة عربية أولاً وثنائية اللغة مع RTL كامل: `locales/ar.json` و `en.json`، `uiLang` فوري، خصائص CSS منطقية، Intl، `digits` | Claude | `claude/T11-i18n-rtl` | T8؛ و T9 أو T10 لبث `settings:update` لكل النوافذ (العقد 2.1) | todo | Codex | — |
| T12 | واجهة الحزمة الإسلامية والسعودية: نشاط الصلاة الحي، رسالة الاستئناف، رمضان، الهجري والمناسبات، مشغل القرآن، الإعدادات | Claude | `claude/T12-islamic-ui` | T10 (يبدأ ببيانات وهمية تطابق العقد) | todo | Codex | — |
| T13 | الاختبارات و CI وحماية الأداء: اختبار تطابق مفاتيح `ar.json`/`en.json`، ui-e2e في CI (xvfb)، حدود أداء/رام تفشل الـ CI لو تعدّتها | Codex | `codex/T13-tests-ci` | T11 (للتطابق)، T9 (للأرقام) | todo | Claude | — |
| T14 | وضع التوفير والحركة ومؤشر الرام: `motion` (full/reduced/off)، `ecoMode`، مراجعة كل الحركات، لوحة الرام في الإعدادات | Claude | `claude/T14-eco-motion` | T9 | todo | Codex | — |
| T15 | أكريليك بشكل الحبة: كشف الدعم (ويندوز 11) والرجوع للزجاج الداكن، `material:get`/`material:changed`، القيمة الافتراضية `material: 'acrylic'`، وقص التغبيش على شكل الحبة بـ `SetWindowRgn` من `island:shape` (العقد §2.11 ومواصفة T15 في `HANDOFF.md`) | Codex | `codex/T15-acrylic-pill` | T6 | todo | Claude | — |
| T16 | Windows NSIS installer, portable ZIP and stable GitHub Releases | Codex | `codex/T16-windows-installer` | T1 accepted by Walid | review | Claude | PR #7; Linux npm test pass; Windows installer CI 40735233961 SUCCESS (tests, Electron update flow, NSIS/ZIP, native pruning, artifact upload); manual Windows pending |

## Backlog (0.6 و 0.7)

مؤجّل بقرار وليد. يرجع كل بند كمهمة مستقلة بإعداد مقفول افتراضياً ومراجعة أمنية.

| البند | المصدر | ملاحظة |
|---|---|---|
| جسر إشعارات Windows (WinUI) + حزمة MSIX موقّعة | PR #1 | يحتاج توقيع وقرار توزيع |
| الإضافات (plugins) | PR #1 | sandbox موجود في PR #1 |
| مشاركة ملف على الشبكة المحلية | PR #1 | لا `0.0.0.0`، اختيار الواجهة، مقفولة افتراضياً |
| تسجيل الشاشة واللقطة | PR #1 | |
| FFmpeg (GIF، استخراج صوت) و rembg (إزالة خلفية) | PR #1 | مسار تنفيذي كامل بدل الاسم المجرد |
| OCR (Tesseract) | PR #1 | بيانات اللغة مضمّنة مع checksum أو موافقة قبل التنزيل |
| تكامل الطرفية (`islandly-run.ps1`) | PR #1 | |
| click-through الدائري | PR #1 | بعد اختبار يدوي على ويندوز |
| تفعيل وضع التوفير تلقائياً مع Battery saver | T14 | `ecoAuto` |
| بنود أخرى من بحث المنافسين | وليد | لم تصلني قائمة البحث نفسها؛ تُضاف هنا |



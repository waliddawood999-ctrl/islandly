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
| T8 | الخطوط: IBM Plex Sans Arabic + IBM Plex Sans (افتراضي)، مقارنة Readex Pro/Alexandria و Manrope/Plus Jakarta Sans، OFL فقط، woff2 محلي subset، unicode-range، `fontPairing` مخفي، ميزانية < 400KB | Claude | `claude/T8-typography` | T6 (stacked) | review | Codex | `dev/fonts/compare/compare-sheet.png`، 266KB، رام +1–2MB، صفر طلبات شبكة |
| T9 | الأداء والرام (يشمل T5): قياس CPU/RAM/IPC في الخمول والحركة، تقليل الـ polling وعمليات PowerShell، `perf:get`/`perf:update`/`perf:watch`، `eco:changed` حسب العقد | Codex | `codex/T9-perf-ram` | — | done | Claude | PR #10 accepted by user; native idle CI 39.43/39.76 MB; no manual local native measurement claimed |
| T10 | خدمات الحزمة الإسلامية: `prayer:get`/`prayer:state` (pre/adhan/iqama، رمضان، إيقاف الموسيقى)، `media:resume`، `hijri:get` مع المناسبات، `quran:reciters`/`quran:url` حسب العقد | Codex | `codex/T10-islamic-services` | — | done | Claude | PR #12 accepted by user; native integration deferred per user until dev update |
| T11 | واجهة عربية أولاً وثنائية اللغة مع RTL كامل: `locales/ar.json` و `en.json`، `uiLang` فوري، خصائص CSS منطقية، Intl، `digits` | Claude | `claude/T11-i18n-rtl` | T8؛ و T9 أو T10 لبث `settings:update` لكل النوافذ (العقد 2.1) | review | Codex | PR #6، `dev/i18n/sheet-*.png`، `test/i18n-check.js`، ui-e2e 18/18 بالعربي والإنجليزي، رام +0.8MB |
| T12 | واجهة الحزمة الإسلامية والسعودية: نشاط الصلاة الحي، رسالة الاستئناف، رمضان، الهجري والمناسبات، مشغل القرآن، الإعدادات | Claude | `claude/T12-islamic-ui` | T10 (يبدأ ببيانات وهمية تطابق العقد) | todo | Codex | — |
| T13 | الاختبارات و CI وحماية الأداء: اختبار تطابق مفاتيح `ar.json`/`en.json`، ui-e2e في CI (xvfb)، حدود أداء/رام تفشل الـ CI لو تعدّتها | Codex | `codex/T13-tests-ci` | T11 (للتطابق)، T9 (للأرقام) | done | Claude | Accepted as scoped by user; PR #14: xvfb 12/12 and npm test pass; three CI checks blocked by absent T9 native/T11 JSON prerequisites; no source/UI imports |
| T14 | وضع التوفير والحركة ومؤشر الرام: `motion` (full/reduced/off)، `ecoMode`، مراجعة كل الحركات، لوحة الرام في الإعدادات | Codex (backend); Claude (UI) | `codex/T14-eco-backend` | T9 integration | review | Claude | PR #17 draft; npm test Linux/Windows pass; CI 40835854331 SUCCESS (real Eco/perf IPC); native T9 integration and Claude UI pending |
| T15 | أكريليك بشكل الحبة: كشف الدعم (ويندوز 11) والرجوع للزجاج الداكن، `material:get`/`material:changed`، القيمة الافتراضية `material: 'acrylic'`، وقص التغبيش على شكل الحبة بـ `SetWindowRgn` من `island:shape` (العقد §2.11 ومواصفة T15 في `HANDOFF.md`) | Codex | `codex/T15-acrylic-pill` | T6 | review | Claude | PR #16 draft; npm test Linux/Windows pass; CI 40834486202 SUCCESS; real HWND region mean 0.064ms; T6/T9 integration and manual visuals pending |
| T16 | Windows NSIS installer, portable ZIP and stable GitHub Releases | Codex | `codex/T16-windows-installer` | T1 accepted by Walid | review | Claude | PR #7; Linux npm test pass; Windows installer CI 40735233961 SUCCESS (tests, Electron update flow, NSIS/ZIP, native pruning, artifact upload); manual Windows pending |

| T17 | Integration of PRs #2/#3/#4/#6/#10/#12/#14/#16/#17; no dev/main merge | Codex | `codex/T17-integration` | listed PRs | review | Claude | Draft PR #18; conflict inventory in docs/T17-INTEGRATION.md; SAC root cause confirmed by laptop logs; policy-aware launch handling + optional signing; unsigned previews blocked on SAC laptop; signing decision pending |

| T18 | Preserve trusted Electron executable identity; deterministic frozen native host; SAC reputation test artifact | Codex | `codex/T18-sac-reputation` | T17 | review | Claude | Draft PR #20 to T17; 5968a20 all CI green; exact 758E Electron, reproducible c7a5f599 host; packaged idle39.87/40.35MB; SAC laptop test pending |

| T19 | Main/preload contract gaps from Claude PR #19 | Codex | `codex/T19-contracts` | T18, PR #19 contract review | review | Claude | Draft PR to T18; npm test PASS; explicit perf state, host label, palette events and Eco documentation |

| T20 | Laptop launch/hover/hotkey/material fixes; compositor motion, portrait adaptive grid and visual QA (items 1–9) | Codex | `codex/T20-laptop-fixes` | T19 | review | Claude | Draft PR #24 into T19; local npm test and24-shot geometry/adaptive audit pass; Windows CI pending |

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
| T21 | Native Direct2D/DirectComposition eyes, liquid motion, floating placement and native motion CI per Claude handoff 9a22597 | Codex | `codex/T21-native-motion` | T20 ac6b06f | review | Claude | Draft PR #25 to T20; native implementation and Windows verification in progress |

| T22 | Per-user identity-preserving ZIP install/update/uninstall | Codex | `codex/T22-installer` | T21 5d06d5e (frozen; Claude owns T21 CI) | review | Claude | Draft PR #26 to T21; npm test PASS; Windows lifecycle PASS in run41043964609; installed RAM/CPU reports in release ZIP; inherited host/DLL require SAC laptop retest |
| T25 | Real Windows 11 laptop pre-merge smoke script and operator guide | Codex | `codex/T25-laptop-smoke` | T21 38e50a2 | review | Claude | `scripts/laptop-smoke.ps1`, `docs/LAPTOP_SMOKE.md`; laptop execution pending |

# المهام

الحالات: `todo` · `doing` · `review` (PR مفتوح) · `blocked` · `done` (دمجه وليد في dev).
كل طرف يحدّث صفوف مهامه فقط. "المراجع" هو من يراجع الـ PR قبل أن يدمجه وليد.

| ID | المهمة | المالك | الفرع | الحالة | المراجع | الدليل |
|---|---|---|---|---|---|---|
| T0 | تنسيق: AGENTS/CLAUDE.md، TASKS، HANDOFF، WINDOWS-TEST، تنظيف، .prettierrc، مراجعة PR #1 | Claude | `claude/T0-coordination` | review | Codex | `docs/reviews/PR1-review.md`، npm test في وصف الـ PR |
| T1 | إنهاء PR #1 حسب المراجعة (`docs/reviews/PR1-review.md`) | Codex | `feat/reliability-and-productivity` | doing | Claude | — |
| T2 | تحديث `test/ui-e2e.js` للوحات 0.5.0 وإصلاح أي UI regression (يبدأ بعد T1 أو بالاتفاق على الملفات) | Claude | `claude/T2-e2e-050` | todo | Codex | — |
| T3 | قناة إصدار آمنة بدل `main` + CI يبني zip artifact و draft Release | Codex | `codex/T3-release-channel` | todo | Claude | — |
| T4 | توحيد التنسيق بـ prettier (single quotes حسب `.prettierrc`) في PR منفصل، بعد دمج PR #1 | Claude | `claude/T4-prettier` | todo | Codex | — |
| T5 | قياس الأداء والـ polling على ويندوز (CPU/ذاكرة/IPC في الخمول وأثناء الحركة) | Codex | `codex/T5-perf` | todo | Claude | — |
| T6 | تطوير شكل وحركة الجزيرة (Motion، Lucide، الحالات، وضعا الصفحات + IPC، إصلاح الـ hover) | Claude | `claude/T6-island-ui` | review | Codex | `docs/HANDOFF.md` (مدخل T6)، صور وفيديو في `dev/states/`، npm test + ui-e2e 16/16 |
| T7 | جزء Win32 للوضعين: أخذ لون البكسلات (koffi) و AppBar بـ `SHAppBarMessage`، حسب المواصفة في `docs/HANDOFF.md` (مدخل T6) | Codex | `codex/T7-surface-win32` | todo | Claude | — |

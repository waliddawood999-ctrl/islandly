# T17 integration record

Base: dev 3cfd490. Combine only #2, #3, #4, #6, #10, #12, #14, #16, #17, in that order. #13/#15 are excluded. Changes are applied as patches and committed on this branch; no branch merges or changes to dev/main.

## Sources and conflicts

- #2: applied T0 coordination files without conflict. Registered T17 from explicit user assignment.
- #3/#4/#6: T6 panel/hover/shortcuts, local fonts and full RTL/locales combined cleanly in stacked order. Font/license files preserved verbatim.
- #10 conflicts: .gitignore union; package scripts/dependencies combined; HANDOFF preserves both parties' distinct sections and TASKS preserves task-specific evidence plus T17. main.js retains native launch/exit/perf policy, adds T6 hover/shortcuts and Surface behavior; native-managed panels force Surface overlay so native alone owns AppBar. Duplicate system/resting listeners consolidated. preload allowlists union.
- #12 conflicts: docs/task/package unions as above; main preserves T9 native-session/menu lifecycle and adds T10 prayer/Hijri/Quran scoped IPC and scheduler; cleanup includes both sets. media retains T9 shared command host/no warmup and adds T10 explicit adhan pause/resume identity; no old per-media PowerShell helper restored. Preloads union channels/APIs; settings combine display/Eco and Islamic defaults. Shared-host explicit pause/play commands require integration below.
- #14 conflicts: preserve T11 Arabic/English e2e language profile plus T13 deterministic disabled pollers/watchdog/focus diagnostics; discover all Node suites using T13 runner rather than T10 fixed list. Real locale/native gates remain enabled now prerequisites are present. Docs/package evidence unions retained.

# T17 integration record

Base: dev 3cfd490. Combine only #2, #3, #4, #6, #10, #12, #14, #16, #17, in that order. #13/#15 are excluded. Changes are applied as patches and committed on this branch; no branch merges or changes to dev/main.

## Sources and conflicts

- #2: applied T0 coordination files without conflict. Registered T17 from explicit user assignment.
- #3/#4/#6: T6 panel/hover/shortcuts, local fonts and full RTL/locales combined cleanly in stacked order. Font/license files preserved verbatim.
- #10 conflicts: .gitignore union; package scripts/dependencies combined; HANDOFF preserves both parties' distinct sections and TASKS preserves task-specific evidence plus T17. main.js retains native launch/exit/perf policy, adds T6 hover/shortcuts and Surface behavior; native-managed panels force Surface overlay so native alone owns AppBar. Duplicate system/resting listeners consolidated. preload allowlists union.
- #12 conflicts: docs/task/package unions as above; main preserves T9 native-session/menu lifecycle and adds T10 prayer/Hijri/Quran scoped IPC and scheduler; cleanup includes both sets. media retains T9 shared command host/no warmup and adds T10 explicit adhan pause/resume identity; no old per-media PowerShell helper restored. Preloads union channels/APIs; settings combine display/Eco and Islamic defaults. Shared-host explicit pause/play commands require integration below.
- #14 conflicts: preserve T11 Arabic/English e2e language profile plus T13 deterministic disabled pollers/watchdog/focus diagnostics; discover all Node suites using T13 runner rather than T10 fixed list. Real locale/native gates remain enabled now prerequisites are present. Docs/package evidence unions retained.
- #16 conflicts: keep authenticated T9/T10 IPC, union material channels/preload access, export all shared defaults, validate both Islamic/material settings, and remove duplicate T6 glass default. T15 Material replaces T6 experimental background call so unsupported/error fallback and physical pill clipping have one owner. Window-load/settings events publish material plus Eco/prayer state.
- #17 conflicts: retain T9 event-driven privacy/clipboard, shared command host, cancellation generations and native-owner process accounting instead of T14's standalone replacements. Add T14 power-event controller to T9 activity policy; one policy/perf subscription owner. Union defaults/validation/preload events, retain T15 material and T10 IPC. T14 System-panel pause support is retained. Test compatibility will exercise the combined interfaces without losing native inventory.

## Integration fixes

- User chose clipping the union of main and lyrics pills; no material switch based on lyrics. island:shape retains the original main rect and adds optional secondary rect/null. Native GDI unions up to two rounded regions, frees intermediate/failed regions, and transfers only successful ownership to Windows. RTL/LTR use actual DOM bounds. Animation/resize/hide reporting and native region tests cover both rectangles and the transparent gap.
- T14 power controller drives T9's activity policy and retains T9's process/PowerShell/native-owner inventory. Native host evaluates manual/battery Eco and material itself without Chromium. Bilingual settings consume live RAM/Eco contracts and motion preferences; no visual redesign or font/palette changes beyond combining authorized PRs.
- T11 plural shape differences reconciled by English aliases of existing other wording; strict deep parity retained. Store persists uiLang/digits/fontPairing. T10 tests exercise explicit pause/play over T9's shared command host rather than the retired helper. Shared helper receives explicit SMTC pause/play identity commands.
- T13 UI runs Arabic/English × overlay/AppBar under xvfb; Windows checks exercise actual region union/clear and native host. Packaging excludes development screenshots/docs/tests/source-native and uses maximum ZIP compression; native entry point remains Islandly.exe.

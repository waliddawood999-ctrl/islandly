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

## Exact source heads

- #2: `32d4d6a104cb208f84557c990c208b2403508701`
- #3: `ebadac0f66c2a2bdac30aa6d06ae68f9628d8be6`
- #4: `80d5f5214aa5211e2990a717ec242655e4e28376`
- #6: `78529d3a6a8d285aa89166a459c6dfab1b3fc8a3`
- #10: `5420c0bcb0fed8eeca20a55f644440bf9a345a10`
- #12: `e6c8575bddac7320eb552851ee1bec793de94d01`
- #14: `c230e21bc33900056425f14250929e6f288c8958`
- #16: `d78e5adc9e8afef1b045274e00ee76850fc518a5`
- #17: `09ab664d2ea6a1fd876f4e59a0521a241144f709`

## Complete conflict inventory

| Applied PR | Conflicting files | Resolution |
|---|---|---|
| #10 | `.gitignore`, `docs/HANDOFF.md`, `docs/TASKS.md`, `package.json`, `src/main/main.js`, `src/main/preload.js` | Union ignores/docs/task evidence/dependencies/IPC; keep T9 ownership, accounting and policy; preserve T6 hover/shortcuts with one system/resting handler and native-only AppBar ownership. |
| #12 | `docs/HANDOFF.md`, `docs/TASKS.md`, `package.json`, `src/main/main.js`, `src/main/media.js`, `src/main/preload.js`, `src/main/settings-preload.js`, `src/main/settings.js` | Append distinct handoff sections; retain task evidence; union tests/contracts/defaults. Keep shared media host and add explicit identity-checked pause/play; retain native session lifecycle. |
| #14 | `docs/HANDOFF.md`, `docs/TASKS.md`, `package.json`, `test/run-tests.js`, `test/ui-e2e.js` | Union history/evidence/scripts; test discovery includes all integrated suites and explicit i18n checker; preserve T11 language checks and T13 deterministic fixtures/focus diagnostics. |
| #16 | `docs/HANDOFF.md`, `docs/TASKS.md`, `src/main/main.js`, `src/main/preload.js`, `src/main/services/store.js`, `src/main/settings-preload.js`, `src/main/settings.js` | Union history/defaults/preloads, preserve Islamic validation and secure handlers; Material controller replaces T6 experimental direct call. Acrylic default wins over duplicate old glass default. |
| #17 | `docs/HANDOFF.md`, `docs/TASKS.md`, `src/main/bluetooth.js`, `src/main/clipboard.js`, `src/main/fullscreen.js`, `src/main/main.js`, `src/main/perf.js`, `src/main/preload.js`, `src/main/ps.js`, `src/main/services/privacy.js`, `src/main/services/store.js`, `src/main/services/weather.js`, `src/main/settings-preload.js`, `src/main/settings.js` | Keep T9 event notifications/cancellation/shared host and native-aware accounting. Add T14 power controller/pause APIs and subscription crash/reload cleanup; single policy and perf owner. Union settings/defaults/API allowlists and all validation. Remove duplicated GitHub pause method from the otherwise clean textual application. |

No textual conflicts in #2/#3/#4/#6. Remaining changes are integration fixes described above, not imports from excluded PRs.

- Final manifest audit: later scoped package snapshots had restored legacy start/base fields. Retained T9's `node scripts/start-native.js` entry and full-install compatibility `islandlyBase: 3`; source-only updates must not cross the native-install boundary. This is a technical conflict resolution, not a new release policy.

## Native measurement evidence

Measured source 86cbffa, [guard run 40871409380](https://github.com/waliddawood999-ctrl/islandly/actions/runs/40871409380), 15-second warmup and 60 one-second samples per phase; counts native host plus every owned Windows Job process, without working-set trimming. Every idle snapshot owns only Islandly.

| Mode | Idle avg MB | Idle peak MB | Idle CPU % | Settings avg MB | After-close avg/peak MB | After-close CPU % | Cold settings/expand ms | Shutdown ms |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Overlay | 40.17 | 42.46 | 0.363 | 415.97 | 30.59 / 36.65 | 0.311 | 1306 / 775 | 4578 |
| AppBar | 40.67 | 42.96 | 0.365 | 420.45 | 31.89 / 36.96 | 0.416 | 1481 / 817 | 4570 |

Raw evidence: [overlay](https://github.com/waliddawood999-ctrl/islandly/actions/runs/40871409380/artifacts/12896605986), [AppBar](https://github.com/waliddawood999-ctrl/islandly/actions/runs/40871409380/artifacts/12895783460). Both pass every idle RAM sample <180 MB and mean CPU <1%. Windows CI measurements, not laptop/manual playback testing.

- Packaging size pass: excludes non-Windows/non-x64 koffi binaries and unused Chromium language packs while preserving Arabic, en-US/en-GB, all application fonts/licenses and GPU/software-rendering components. Prints the largest runtime files for audit. The <100MB target is best-effort; do not remove required runtime support or change archive compatibility to claim it.

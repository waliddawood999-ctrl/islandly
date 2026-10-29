# T9 performance evidence

**Status: native idle RAM and CPU acceptance pass on Windows CI; local native confirmation and Claude visual review remain pending.** Electron-only results below are historical controls; the native host results are in the 2026-10-29 section.

## Prior comparable measurements

Code commit `5822a7f9e8ccff9fac677c74353b8a27230b531d`, [Windows CI run 40753032354](https://github.com/waliddawood999-ctrl/islandly/actions/runs/40753032354), [raw JSON artifact](https://github.com/waliddawood999-ctrl/islandly/actions/runs/40753032354/artifacts/12844927586). Windows / Electron 45.1.0, separate baseline/current processes on the same runner. Baseline is immutable dev `3cfd4909143d6a87d5d6a61cbe94592a6824a263`. Both use the unchanged dev 0.4 renderer; these are not measurements of the combined unmerged 0.5/T6 UI.

| Workload | Baseline RAM MB | T9 RAM MB | Baseline sampled CPU | T9 sampled CPU | Baseline external launches/min | T9 external launches/min |
|---|---:|---:|---:|---:|---:|---:|
| Idle, 60s average | 361.96 | 262.98 | 0.164% | 0.061% | 40 | 0 |
| Local music-event fixture, 60s average | 329.28 | 237.87 | 0.388% | 0.306% | 40 | 0 |

Idle memory decreased by 98.98 MB (27.3%). The final idle process averages are Browser 109.79 MB, Renderer 68.11 MB, GPU 46.51 MB and Utility 38.57 MB. No PowerShell process was needed during either final workload. A host starts only when an expanded panel or explicit user request needs it and remains shared; its memory is included in perf:get whenever it is alive. Measurements after arbitrary user interactions can differ.

The GPU-off diagnostic on the same code measured 261.92 MB idle and 0.058% CPU, with 235.46 MB / 0.299% for the fixture. It did not materially improve RAM; acceleration behavior was left unchanged. The probe's GPU-off flag is diagnostic only.

| Acceptance item | Result |
|---|---|
| Idle RAM <180 MB; goal <150 MB | **Not met on this CI runner** |
| Idle CPU <1% | Met in automated CI workload |
| Zero new PowerShell/reg processes per minute at steady idle | Met; 0/min in final idle and music fixture |
| Music CPU <3% | Fixture passes; **real-player playback unverified** |
| npm test and Windows functional CI | Pass; RAM threshold is reported here, not enforced by this measurement workflow |

No resident-memory trimming, private-byte substitution or omitted GPU process is used to satisfy the budget. The reported RAM remains the requested sum of working sets. Further optimization and remeasurement after integration are necessary before marking T9 done.

## Method and commands

On Windows:

```powershell
$env:ISLANDLY_PERF_ROOT = 'C:\path\to\source'
$env:ISLANDLY_PERF_OUTPUT = 'C:\path\to\perf-result.json'
$env:ISLANDLY_PERF_SECONDS = '60'
npx electron test/perf-probe.js
```

CI archives the fixed baseline source, then runs this same probe against baseline/current. Each process warms up for 15 seconds, samples idle for 60 seconds and a local music-event fixture for 60 seconds. app.getAppMetrics supplies every Electron process, including GPU; GetProcessMemoryInfo/GetProcessTimes add live instrumented direct-child working sets/CPU. Spawn/execFile instrumentation counts main-process child creation, including processes too short-lived to appear in one-second snapshots. The baseline's 40/min are the two reg.exe reads every three seconds. CPU is a sampled metric; short-lived reg processes can finish between samples, so baseline CPU can be underestimated. Final workloads have no such child launches.

Weather, automatic updates, calendar feeds, tracking and prayer alerts are disabled equally for these measurements. Clipboard/privacy and media metadata services run. The fixture emits local media:update events without fetching media/artwork and is not a real SMTC/audio player. These automated Windows CI numbers are distinct from Linux unit tests and manual Windows measurements. Raw JSON preserves process IDs, per-sample working sets and CPU, child launches and measurement limits.

The initial pre-change capture [40749631551](https://github.com/waliddawood999-ctrl/islandly/actions/runs/40749631551) measured 265.99 MB / 0.176% idle and 239.68 MB / 0.414% fixture, with 40 launches/min in both. That first probe excluded external PowerShell working sets; it must not be compared directly with the inclusive table above.

## Implemented polling/resource policy

| Service | Policy |
|---|---|
| Clipboard | Native sequence check at 800ms, content read only after change; 4s in Eco; paused while hidden/fullscreen; late reads discarded after stop |
| Microphone/camera | Native ConsentStore read plus RegNotifyChangeKeyValue event; no reg.exe or polling interval; native wait explicitly cancelled on stop/quit |
| Bluetooth | Three-minute refresh only while visible/expanded and outside Eco; shared helper, no overlapping requests/stale delivery |
| Brightness/Explorer/media controls | One fixed-script JSON-line PowerShell host; bounded pending requests/deadlines; failed host circuit-breaks for the session; native media-key fallback retained |
| System panel | Two-second samples only for an authenticated panel subscription while visible/expanded and outside Eco |
| Weather/calendar/GitHub | Cached configuration/state retained; refresh intervals paused while hidden or in Eco |
| Performance panel | 5s perf:update only for visible subscribed settings; closes/hides unsubscribe; foreign windows/frames rejected |
| Foreground/fullscreen | Essential recovery/context watcher uses a timeout at 1s, or 3s in Eco |
| Usage tracking | Background feature retained when enabled; paused in Eco |
| Break reminders/update check | User-enabled background functions retain their minute/six-hour schedules; update startup timeout is cleared on stop |

Eco defaults false. eco:changed is sent on island/settings load and changes. perf:get/update match the v0.5 contract, including process labels, helper count and uptime. settings:update broadcasts public settings without secrets. The current T6 surface:resting contract supplies precise expanded/resting state when integrated; pre-T6 dev falls back to envelope height >150px, excluding the noninteractive 80px music peek. UI subscribers still belong to Claude.

Anthropic SDK was already lazy. ICS parsing is now required only when a calendar response arrives. The application menu is disabled before ready; hidden renderer background throttling is enabled in main process preferences. No renderer, settings UI, palette UI, fonts or CSS were modified.

## Remaining verification

Measure the integrated build on a real Windows desktop with an actual SMTC player, after opening/closing helper-using panels, in fullscreen, hidden state and Eco. Confirm memory/CPU and motion latency over longer sessions and different GPUs/DPI. The current RAM failure stays visible in the task board/PR; passing functional CI does not mark the RAM target satisfied.

## RAM continuation: architecture boundary reached

The user rejected the 262.98 MB result, requested continuation on the same PR, and explicitly required stopping before a major architectural change. No production change was made during this continuation; the changes are diagnostic tooling, CI and evidence.

[Windows footprint run 40765826827](https://github.com/waliddawood999-ctrl/islandly/actions/runs/40765826827), diagnostic commit `f2ca237`, [raw JSON artifact](https://github.com/waliddawood999-ctrl/islandly/actions/runs/40765826827/artifacts/12850189086). All three variants ran on the same Windows runner / Electron 45.1.0 with a separate process/profile, 15s warmup and 60 one-second samples. All Browser/Renderer/GPU/Utility working sets are counted.

| Variant | Average RAM MB | Minimum MB | Peak MB | Main-thread V8 heap used MB |
|---|---:|---:|---:|---:|
| Full unchanged T9 app, retest | **260.00** | 238.94 | 279.96 | 4.85 |
| Full app + diagnostic V8 optimize-for-size and Chromium low-end policy | **259.02** | 238.00 | 277.18 | 4.85 |
| Blank transparent Electron window; no backend/preload/app page | **225.99** | **204.90** | 242.42 | 3.81 |

The before-continuation value is 262.98 MB and the unchanged full-app retest is 260.00 MB. That 2.98 MB difference is run-to-run variation, **not an implemented optimization**. The diagnostic memory policy saves approximately 0.99 MB in this comparison and was not enabled in production. No variant meets 180 MB. The blank control is not a product acceptance result: it removes the app workload solely to diagnose the runtime/process overhead.

Process averages for the blank control: Browser 88.53 MB, Renderer 54.96 MB, GPU 44.85 MB, Utility 37.66 MB. For the full app: Browser 107.04 MB, Renderer 70.29 MB, GPU 44.89 MB, Utility 37.79 MB. Main-thread V8 heap is only one component; worker heaps/native allocations are separate. These measurements do not prove a universal minimum on every GPU/Windows machine, but they show that the tested backend/runtime sizing changes cannot bridge the current gap on this runner.

**Historical stop, superseded by the user's Option 1 authorization below.** Under the current Electron runtime/process model, the next material approaches change the host/window lifecycle or runtime. No native shell, WebView migration, process consolidation or sandbox/isolation change was implemented. No working-set trimming, metric substitution or process omission was used. The RAM acceptance item remains failed; npm test and diagnostic CI passing do not change that status.

### Options before further implementation

1. **Native idle island with Electron panels on demand.** A small Win32 host paints the collapsed island and receives native media/AppBar events. Existing web panels open when needed and their process lifetime is managed explicitly. This offers a direct way to reduce idle Chromium residency while reusing the existing panels, but changes rendering ownership, IPC/state transfer, hover/window lifecycle and first-open latency. A prototype must demonstrate both <180 MB after repeated open/close cycles and acceptable latency before adopting it.
2. **Native Windows host with WebView2, or fully native views.** Move Electron/Node host responsibilities to a lean Windows host and reuse eligible web views through WebView2, or reimplement the views natively. This is a larger rewrite of IPC, service integration, windowing, updates and packaging. WebView2's name alone does not guarantee the memory target; benchmark a minimal representative prototype first.
3. **Validate on target desktop hardware before choosing a rewrite.** Re-run the unchanged full/blank probes on the user's Windows/GPU setup. This can distinguish runner-specific overhead from a repeatable runtime floor; it does not waive the <180 MB acceptance limit or make the present build pass.

The first two options are architectural work requiring the user's choice and coordination with Claude's protected UI ownership. Existing T9 remains a draft, not accepted. No further implementation beyond this boundary was performed.

### Reproduction

Set `ISLANDLY_FOOTPRINT_VARIANT` to `full-app`, `compact-v8` or `blank-window`, set `ISLANDLY_FOOTPRINT_OUTPUT`, then run `npx electron test/perf-footprint.js` on Windows. The script records all samples, main-process heap data and process-type totals. The full-app comparison uses exactly the same network/feature settings as the earlier T9 probe. Automated Windows CI is distinct from manual desktop validation.


## 2026-10-29: native idle host (Option 1)

The native Win32/WinForms host owns the collapsed island, tray, hotkeys, timer deadline, clipboard notifications, privacy events, usage/break tracking and optional AppBar reservation. Electron starts only for an expanded island, settings or palette. A random named pipe restricted to the current Windows user transfers readiness and state; existing panel UI and IPC names remain unchanged. Electron starts suspended, enters a kill-on-close Job Object, then resumes. After a 3s collapsed grace period, it quits; the native owner terminates any remaining job descendants. User-requested external applications are launched outside that job so they survive panel closure.

### Before/after measurements

User-supplied Acer Aspire Lite 16 / Windows / Electron 45.1.0, same 15s warmup and 60 samples:

| Historical Electron control | CI average MB | Local laptop average MB |
|---|---:|---:|
| Full app idle | 260.00 | 452.21 |
| Blank Electron window | 225.99 | 301.35 |

The local GPU process alone was approximately 183 MB. These laptop figures were supplied by the user; this Linux session did not run them. **Native laptop measurements remain pending.**

Native code `1f78cb0fe4feb6a9d894ea058638ced74e60c5df`, [Windows native/package CI](https://github.com/waliddawood999-ctrl/islandly/actions/runs/40809880548) **SUCCESS**, [raw samples](https://github.com/waliddawood999-ctrl/islandly/actions/runs/40809880548/artifacts/12870680145). Electron 45.1.0 panels, Windows runner; measurements use a disposable profile and the same optional-feature configuration as the earlier Electron controls.

| Mode | Native idle MB | Settings open MB | Returned idle MB | Idle sampled CPU | Settings cold open ms | Expanded island cold open ms | Close to native-only ms |
|---|---:|---:|---:|---:|---:|---:|---:|
| Overlay | 39.43 | 398.76 | 31.00 | 0.21% | 1114 | 692 | 4556 |
| Reserved-bar / appbar | 39.76 | 399.50 | 31.67 | 0.39% | 1066 | 678 | 4584 |

Idle RAM is below 180 MB (also below the 150 MB goal) in both modes, including after opening and closing panels. Every idle sample contains **only the native host**, with no Electron Browser/GPU/Utility/Renderer or PowerShell process. Native RAM is reduced from the historical CI 260.00 MB to 39.43–39.76 MB. Panel-open RAM includes the native host plus all runtime/helper processes; it is a different workload from the historical collapsed Electron control.

The initial native implementation met RAM but sampled 1.23–1.65% idle CPU. Moving idle work from four wakeups/second to once/second and using a separate one-shot 280ms hover timer corrected that; final CI enforces <1% both before and after opening panels. No working-set trim, GPU omission, metric substitution, renderer isolation change or hidden Electron residency is used.

### Method and validation

Each RAM workload warms for 15 seconds and records 60 one-second samples: startup idle, settings open, and returned idle. `Process.WorkingSet64 / 1048576` counts the native host plus every PID enumerated from its Windows Job Object. The probe is separate instrumentation, not an app-owned process. CPU is sampled from process CPU-time deltas; raw per-process snapshots remain in the artifact. Panel latency is native request dispatch through actual panel readiness plus 350ms initial layout allowance, not process creation alone. Each panel open starts a fresh Electron process; Windows file caches can be warm. Hover dwell and the probe's command-file polling delay are outside that latency definition. The first cold packaged smoke open took 1304 ms; it is separate from the measurement-table opens.

CI verifies RAM <180 MB and CPU <1% at startup and after close; shutdown within 8s including the 3s grace; settings open and a second cold expanded-island open; timer deadline, clipboard and elapsed-break-state handoff; forced native-owner death with no surviving runtime PIDs; AppBar work-area recovery after crash and restoration after exit. Packaging and packaged smoke run in a separate Windows job. [Existing functional/native/perf IPC CI](https://github.com/waliddawood999-ctrl/islandly/actions/runs/40809881015) and [Electron control CI](https://github.com/waliddawood999-ctrl/islandly/actions/runs/40809880396) also passed, as did npm test. Real-player playback and manual mixed-DPI/multi-monitor/native visual acceptance remain unverified.

### Local confirmation

Close other Islandly instances. From the Windows T9 checkout, run:

```powershell
git switch codex/T9-perf-ram
git pull --ff-only
npm ci
npm test
npm run build:native
powershell -NoProfile -ExecutionPolicy Bypass -File test/native-footprint.ps1 -Output native-perf-local-overlay.json -Mode overlay
powershell -NoProfile -ExecutionPolicy Bypass -File test/native-footprint.ps1 -Output native-perf-local-reserved-bar.json -Mode reserved-bar
```

Both commands print idle/settings/returned-idle averages, cold-open latencies, shutdown time and idle CPU, and retain all 60 samples per workload in the named JSON files. They fail if the RAM/CPU budgets or ownership/lifecycle checks fail. They use isolated profiles without changing the user's normal settings.

Run `npm start` for ordinary native-host startup. `npm run package:native` builds `out/Islandly-native-win64.zip`; [the validated Windows preview](https://github.com/waliddawood999-ctrl/islandly/actions/runs/40809880548/artifacts/12870405443) includes native `Islandly.exe` and on-demand `IslandlyPanels.exe`. The full-package compatibility base is now 3: src/assets-only updates cannot install or replace the native host. The Linux packaging script requires a Windows-built `ISLANDLY_NATIVE_EXE`. Prior T3/T6/T7 integration must retain this full-install boundary and exactly one AppBar owner in managed sessions.

Native visual gaps for Claude are listed in HANDOFF: GDI rasterization/translucency/shadow/animation differences, generic tray icon/English native menu, and missing rich compact artwork/waveforms or app-specific localized indicators. Existing renderer/settings UI/palette/font/CSS files are untouched. T9 remains in review for laptop confirmation and UI-owner review; CI acceptance does not constitute manual desktop/playback acceptance.

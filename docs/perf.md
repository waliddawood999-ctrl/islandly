# T9 performance evidence

Baseline commit: dev 3cfd490. Development environment: Linux / Node 24; no manual Windows measurements available. Windows CI baseline capture is pending before poller implementation.

Command on Windows: `npx electron test/perf-probe.js`, with ISLANDLY_PERF_ROOT selecting baseline/current source, ISLANDLY_PERF_OUTPUT selecting the result file, and ISLANDLY_PERF_SECONDS=60 (default). Each process warms up for 15 seconds, then records 60 seconds idle and 60 seconds of a labelled local music-event fixture. Network weather/update/calendar features are disabled equally for both measurements. GPU is included in app.getAppMetrics.

The fixture is not a real Spotify/YouTube SMTC playback test. Its results cannot establish the real-music CPU acceptance criterion. Main-process child creation is instrumented to count PowerShell/reg launches; initial process metrics exclude their separate working sets until the native external-process sampler is implemented. Preserve this distinction when reporting results.

## Initial baseline, captured before backend changes

Run https://github.com/waliddawood999-ctrl/islandly/actions/runs/40749631551 (probe commit 8a647cf), Windows CI / Electron 45.1.0. Idle: **265.99 MB**, **0.176% CPU**, **40 external launches/minute**. Local music-event fixture: **239.68 MB**, **0.414% CPU**, **40 launches/minute**. These first figures include all Electron processes/GPU but exclude the separate persistent PowerShell working set. They already exceed the 180 MB acceptance limit; they are not a successful T9 result.

The final comparison probe additionally reads live direct-child working sets/CPU through GetProcessMemoryInfo/GetProcessTimes and prints per-process-type totals. Baseline/current will use that same inclusive probe for comparability. Very short-lived reg processes can finish between samples; launch instrumentation still counts them exactly. No claim of a real-player music result is made.

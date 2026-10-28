# T9 performance evidence

Baseline commit: dev 3cfd490. Development environment: Linux / Node 24; no manual Windows measurements available. Windows CI baseline capture is pending before poller implementation.

Command on Windows: `npx electron test/perf-probe.js`, with ISLANDLY_PERF_ROOT selecting baseline/current source, ISLANDLY_PERF_OUTPUT selecting the result file, and ISLANDLY_PERF_SECONDS=60 (default). Each process warms up for 15 seconds, then records 60 seconds idle and 60 seconds of a labelled local music-event fixture. Network weather/update/calendar features are disabled equally for both measurements. GPU is included in app.getAppMetrics.

The fixture is not a real Spotify/YouTube SMTC playback test. Its results cannot establish the real-music CPU acceptance criterion. Main-process child creation is instrumented to count PowerShell/reg launches; initial process metrics exclude their separate working sets until the native external-process sampler is implemented. Preserve this distinction when reporting results.

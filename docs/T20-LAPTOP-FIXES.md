# T20 laptop fixes

Branch `codex/T20-laptop-fixes` targets `codex/T19-contracts`; no merge.

The T18 host C7A5F599 and exact758E panels were accepted by SAC on Walid's laptop with43–48MB idle RAM. T20 changes the native host; the new hash must be tested there again. CI Windows Server does not enforce SAC.

The launch worker keeps the collapsed island responsive during OS reputation scanning. A120-second first-ready window starts after ResumeThread,60 seconds after an earlier successful session. There is no automatic Electron prewarming or new resident process. The OS first-run scan can still take tens of seconds; loading feedback is immediate rather than a false promise of a warm launch time.

Expanded card defaults360×440CSS pixels.16px padding,12px grid gaps and a separate pagination row replace absolute overlap-prone placement. Media can grow to460px; all content caps560px and clamps to work area. Wide/long content scrolls inside a rounded card. Both-pills acrylic clip remains, including lyrics. GPU compositor transforms/opacity replace dimension/top/filter animations; native HWND geometry changes only at transition boundaries.

## Evidence

- `npm test`: Node/contract regression suite.
- `node test/t20-visual.cjs`: actual Chromium before/after screenshots in `dev/t20`, both languages/modes and100/125/150% device scale. Uses local fixtures; not Windows acrylic screenshots. Baseline8b32e19 is rendered directly, not approximated. It did not reproduce the hardware overlap; candidate geometry is audited independently.
- `npx electron test/t20-electron.js` with `T20_DPI=1`, `1.25`, `1.5`: real Windows Electron before/after captures, frame p50/p95/raw intervals/frames>25ms, renderer input-to-first-change. Thresholds p95<=25ms/input<50ms are guard tolerances, not a claim every frame is16.67ms. Native response measured separately in the loading-paint log. Both are software measurements, not a physical input/display latency test.
- `test/t20-startup.ps1`: real delayed child32s + simulated pre-process scan32s, native UI liveness, timer placement, loading paint<50ms, registered hotkey conflict fallback, complete shutdown.
- Existing packaged real hover/click/Ctrl+Alt+I, recovery, both native modes and strict15s/60-sample RAM/CPU probes remain enabled. Full executable inventory checks exact758E and reports the new reproducible host hash.

Final CI links, raw measurements, Windows artifact and host SHA256 are recorded in the draft PR. Test the new artifact on the laptop with SAC still enabled, including the first open, hover, fallback hotkey, both modes and real monitor DPI. Do not use signing or change executable resources.

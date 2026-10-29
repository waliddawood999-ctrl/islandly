# T17 packaged launch verification

## Evidence and remaining uncertainty

Walid reports the original native host `5420c0b` from `C:\Users\walid\Desktop\Islandly-T9` on Windows 11 build 26300. His visible Desktop is redirected to OneDrive, but the reported executable path is outside `OneDrive\Desktop`. The dialog stack reaches `IslandHost.OpenPanel(String command)` from a WinForms timer callback. Messages include both error 87 and “The operation completed successfully” (error 0).

The original code captures `GetLastWin32Error()` **after** `EndSession()`. That cleanup calls other native APIs and can replace the actual process-creation error. The candidate captures it immediately after `CreateProcessW`, before freeing the environment or cleanup, and preserves the numeric error in the exception/log. This diagnostic defect and the escaping timer exception are confirmed in source; the underlying laptop process-creation failure remains unconfirmed until its original error is captured.

The legacy host successfully opens on the Windows Server CI runner with production package paths. Do not treat a directory named OneDrive in CI as actual OneDrive cloud-provider or Windows 11 build 26300 coverage. x64 layouts are checked as STARTUPINFO 104, PROCESS_INFORMATION 24 and extended job limits 144 bytes; no evidence establishes an original ABI-size defect.

The candidate removes unused inherited anonymous stdio handles, uses explicit Unicode CreateProcessW and a normalized executable-parent working directory, and retains suspended creation followed by kill-on-close job assignment and resume. The named session pipe carries the existing contracts. Launch errors are logged before child startup, caught, shown through a throttled tray balloon and retried once. A later user action can try again. No Electron process remains resident while idle.

## Laptop confirmation with the artifact

1. Exit previous Islandly instances through the tray. Download the latest **launch-regression-passing** Windows artifact linked in PR #18. Extract the artifact wrapper, then extract its `Islandly-native-win64.zip` into a new folder; keep the complete directory together. Launch **Islandly.exe**.
2. Test hover, then close the expanded panel and wait for complete shutdown. Repeat with a click, then Ctrl+Alt+I. Open Settings through the tray as well. Confirm there is no .NET exception dialog and no hung host. Repeat in overlay and reserved-bar modes.
3. After a panel closes, wait at least 8 seconds and check Task Manager: only `Islandly.exe` should remain; there should be no `IslandlyPanels.exe` Browser/GPU/Utility/Renderer processes.
4. If launch fails, keep `%APPDATA%\islandly\native-panels.log` (and `.old`, if present). It records the launch stage, working directory and original numeric error without environment values. `panel-chromium.log` may exist if Chromium starts. A missing Chromium log alone does not identify a native API failure. Share the native log for diagnosis; do not infer the cause from a balloon.

CI is automated Windows Server input injection, not a manual test on Walid's laptop. Successful laptop confirmation is still required.

## Reproduce automated packaged input on the laptop

From a checkout of `codex/T17-integration`, with other Islandly instances closed, use PowerShell. Replace only the package folder below with the extracted artifact's folder containing both EXEs:

```powershell
$env:RUNNER_TEMP = Join-Path $env:TEMP ('Islandly-T17-' + [guid]::NewGuid())
New-Item -ItemType Directory -Path $env:RUNNER_TEMP -Force | Out-Null
powershell -NoProfile -ExecutionPolicy Bypass -File test/packaged-input.ps1 -Package 'C:\Users\walid\Desktop\Islandly-T17'
```

This copies the package to a temporary Unicode/space-containing path and uses a disposable profile; it does not replace the user's original executable or settings. Keep the desktop unlocked and avoid input while it runs. The script sends real pointer/button/key input for hover, click and Ctrl+Alt+I. It then temporarily substitutes an invalid PE **in its copied package** to force CreateProcessW error 193, verifies exactly one retry and original-error logging, restores the copied runtime and verifies real-click recovery/full shutdown. Expected output contains three `PACKAGED REAL INPUT PASS` lines and one `PACKAGED RECOVERY PASS`. Failure diagnostics are copied to `out/input-diagnostics` in the checkout.

For the accepted 15s warmup / 60-sample native RAM/CPU protocol from source, run `npm ci`, `npm test`, then:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File test/ci-native-perf.ps1 -Mode overlay
powershell -NoProfile -ExecutionPolicy Bypass -File test/ci-native-perf.ps1 -Mode reserved-bar
```

Both commands build/prepare the native runtime, count the host plus the complete Windows Job process inventory, and enforce <180 MB idle RAM and <1% mean idle CPU before and after panels close. No working-set trimming is used.

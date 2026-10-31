# T17 packaged launch verification

## Laptop root cause: Smart App Control

Walid's Windows 11 build26300 Acer Aspire Lite16 has `SmartAppControlState=On`. His CodeIntegrity events3077/3118/3033/3089 identify unsigned `Desktop\Islandly-T9\IslandlyPanels.exe` blocked by policy `{0283ac0f-fff1-49ae-ada1-8a933130cad6}` at15:34,15:35,15:40,15:41 (twice) and16:09 Riyadh time, matching the old launch failures. Starting the cf89cc2 host itself now returns “An Application Control policy has blocked this file.” This is user-supplied real-laptop evidence; the Windows Server runner has no SAC and cannot establish SAC compatibility. Desktop redirection/ABI/cwd are not the demonstrated laptop cause.

**Both EXEs in previous previews are unsigned. Do not disable SAC.** If Windows blocks Islandly.exe before entry, it cannot create a native log or show a tray balloon. An unsigned preview is not a usable laptop fix for this machine. A signed build accepted by Windows policy is required before laptop panel/RAM validation can continue; adding a signing hook alone does not produce such a build.

If the host can run but CreateProcessW reports a code-integrity/application-control block, it logs the exact error and shows an Arabic/English notice that Windows Smart App Control / App Control blocked the panels and a signed build is required. Win32 errors577,1260,4551 and the corresponding image-hash/policy/certificate NTSTATUS/HRESULT forms are classified, including wrapped exceptions. Generic access-denied5, malformed-image193/216 and unrelated errors are not labelled SAC. Policy blocks suppress the automatic retry and subsequent hover attempts. Explicit click/hotkey/tray actions can try again after replacing the runtime with a trusted build. Ordinary failures retain the single bounded retry.

Earlier hardening still applies: immediate last-error capture before cleanup, checked x64 layouts104/24/144, explicit Unicode CreateProcessW, normalized executable-parent cwd, no unused inherited stdio, scoped loader-dialog suppression and suspended job assignment before resume. It fixes diagnostics/recovery but cannot override OS application control. The native host remains the only idle process. See [WINDOWS-SIGNING.md](WINDOWS-SIGNING.md) for the optional signing workflow and its verification limits.

## Laptop confirmation with the artifact

Only perform these steps on the SAC laptop with a signed/trusted build accepted by its policy. Current unsigned CI previews are for Windows Server regression testing.

1. Exit previous Islandly instances through the tray. Download the latest **launch-regression-passing** Windows artifact linked in PR #18. Extract the artifact wrapper, then extract its `Islandly-native-win64.zip` into a new folder; keep the complete directory together. Launch **Islandly.exe**.
2. Test hover, then close the expanded panel and wait for complete shutdown. Repeat with a click, then Ctrl+Alt+I. Open Settings through the tray as well. Confirm there is no .NET exception dialog and no hung host. Repeat in overlay and reserved-bar modes.
3. After a panel closes, wait at least 8 seconds and check Task Manager: only `Islandly.exe` should remain; there should be no `IslandlyPanels.exe` Browser/GPU/Utility/Renderer processes.
4. If launch fails, keep `%APPDATA%\islandly\native-panels.log` (and `.old`, if present). It records the launch stage, working directory and original numeric error without environment values. `panel-chromium.log` may exist if Chromium starts. A missing Chromium log alone does not identify a native API failure. Share the native log for diagnosis; do not infer the cause from a balloon.

CI is automated Windows Server input injection, not SAC enforcement. Laptop confirmation is blocked pending a signed/trusted build; no certificate has been bought, generated or configured.

## Reproduce automated packaged input on the laptop

This malformed-image regression intentionally substitutes an unsigned fake runtime. Run it on a Windows test runner without SAC enforcement, not as SAC-laptop acceptance. From a checkout of `codex/T17-integration`, with other Islandly instances closed, use PowerShell. Replace only the package folder below with the extracted artifact's folder containing both EXEs:

```powershell
$env:RUNNER_TEMP = Join-Path $env:TEMP ('Islandly-T17-' + [guid]::NewGuid())
New-Item -ItemType Directory -Path $env:RUNNER_TEMP -Force | Out-Null
powershell -NoProfile -ExecutionPolicy Bypass -File test/packaged-input.ps1 -Package 'C:\Users\walid\Desktop\Islandly-T17'
```

This copies the package to a temporary Unicode/space-containing path and uses a disposable profile; it does not replace the user's original executable or settings. Keep the desktop unlocked and avoid input while it runs. The script sends real pointer/button/key input for hover, click and Ctrl+Alt+I. It then temporarily substitutes an invalid PE **in its copied package** to force a CreateProcessW malformed-image error (193 or 216, compared with an independent direct API reference), verifies exactly one retry and original-error logging, restores the copied runtime and verifies real-click recovery/full shutdown. Expected output contains three `PACKAGED REAL INPUT PASS` lines and one `PACKAGED RECOVERY PASS`. Failure diagnostics are copied to `out/input-diagnostics` in the checkout.

For the accepted 15s warmup / 60-sample native RAM/CPU protocol from source, run `npm ci`, `npm test`, then:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File test/ci-native-perf.ps1 -Mode overlay
powershell -NoProfile -ExecutionPolicy Bypass -File test/ci-native-perf.ps1 -Mode reserved-bar
```

Both commands build/prepare the native runtime, count the host plus the complete Windows Job process inventory, and enforce <180 MB idle RAM and <1% mean idle CPU before and after panels close. No working-set trimming is used.

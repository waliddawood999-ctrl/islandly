# Windows 11 laptop pre-merge smoke check (T25)

Run this on the actual laptop before merging. A Linux syntax check or Windows CI run does not establish laptop acceptance. The script prints `ALL LAPTOP SMOKE CHECKS GREEN` only when every automatic check and every requested visual confirmation passes; any failure returns exit code 1. Missing evidence is a failure, not a skip.

## Prepare

1. Obtain the approved, already built native package for the revision being evaluated. Extract the inner ZIP to a new local folder, for example `C:\Islandly-preview`. This is the portable installation check; this script does not test an NSIS installer. Keep Smart App Control and other Windows protections enabled. Do not unblock or rebuild executables to make a failed launch pass.
2. Close every existing Islandly instance through its tray, including older versions. Use the physical, unlocked Windows 11 laptop desktop, with a primary monitor large enough for the 600 x 768 diagnostic host at the configured scale. Start with a static desktop; pause video, animated wallpaper, notifications and other overlays. The script records the primary display and requires the island envelope to fit on it.
3. Keep the laptop's normal power mode, display refresh rate and DPI. Record those, the laptop model, Windows build, battery/AC state, SAC state and package revision in a `machine-notes.txt` file in the results folder **after** the run. Do not change refresh rate or disable protections just to obtain green results.
4. Have a real app ready to enter fullscreen on the primary monitor (for example a browser showing a static page with F11). Fullscreen must actually become the foreground app. The script does not generate a fullscreen fixture executable.
5. Use Windows PowerShell 5.1 or PowerShell 7 in a normal interactive session. Review the script before running. It uses an isolated profile under its output folder and does not edit your normal Islandly settings or the Windows theme. It asks you to change Windows app theme manually; restore your preferred theme afterwards.

From this checkout, run:

```powershell
powershell.exe -NoProfile -File .\scripts\laptop-smoke.ps1 `
  -Package C:\Islandly-preview `
  -OutputDirectory C:\Islandly-evidence\overlay-01 `
  -Mode overlay
$LASTEXITCODE
```

Choose a fresh, empty output directory outside the package. Repeat with `-Mode reserved-bar` and another fresh folder if AppBar is in the pre-merge scope. The script does not change execution policy. If your policy disallows scripts, follow your organization's approved review/signing process.

## What happens

| Check | Required evidence / unchanged gate |
| --- | --- |
| Installation and identity | Existing portable package layout; user confirms extraction without a security block. `panels/Islandly.exe` SHA256 must equal `758E43CF25850408FA42D7DE76565561AE329B353B8FACC508ECE9875BCD1592`. Saves EXE/DLL inventory and hashes; builds nothing. |
| Launch | Starts the existing native host with a fresh profile and existing diagnostic flags; valid PID-owned status, idle phase and visible island within 20 seconds; visual confirmation. |
| Ctrl+Alt+I | Checks the registered shortcut is exactly Ctrl+Alt+I, sends real key events, waits for a ready panel and asks for visual confirmation. Fallback Ctrl+Alt+Shift+I does not pass. Closing must return to native idle. |
| Fullscreen | After the 8-second switch window, requires `fullscreen=true`, `hidden=true`, no eyes, cursor timer or frame loop. Moves the pointer to the physical top edge, requires reveal while still fullscreen, then requires hide on leaving. Saves screenshots and requires explicit visual confirmation of full hide/reveal/hide. Return to PowerShell only after the automatic sequence. |
| Visibility preference | Writes the existing isolated-profile `islandVisibility` setting: approach hides with timers stopped, near pointer reveals, leaving hides; always restores visibility with the pointer far away. This verifies the setting's runtime behavior; it does not click the Settings UI. |
| Light and dark | You select Windows **app mode** in Personalization > Colors. The native `motion.light` flag must match, a desktop image is saved, and you must confirm the island fill itself is light/dark. The script does not infer a visual pass from the flag alone. |
| Opening transparency, both themes | Existing composition alpha audit must cover at least 90 open/close frames with exactly **0 leak pixels**. Captures at least 5 real desktop PNGs each for opening and closing, counts every differing pixel in full-height exterior side bands outside the 440px animation envelope, and requires **0 leaks** with the existing RGB tolerance of 6. Saves hidden reference, PNGs, per-frame counts and alpha report. |
| Animation pacing | Collects 12 open bursts through existing `0x8021/0x8022` hooks, at least 100 active frames. Frame interval p95 **≤16.667ms**, mean frame CPU **<2ms**, every observed input response nonnegative and maximum **<50ms**. Raw frames and input times saved; no outlier removal or relaxed high-refresh exception. |
| Idle resource use | 15-second warmup, 60 one-second samples. Every status must be idle, with exactly one owned native process, and every total working-set sample **>0 and <180MB**. Mean CPU must remain **<0.1% of one core**, retaining the T21 idle gate. |

Visual questions accept only the literal uppercase `PASS`. Do not confirm if the check was unobserved, ambiguous or failed. A screenshot is evidence for review, not an automatic visual approval. A desktop capture mismatch may come from another moving window: preserve the failed run and repeat under a static desktop in a new folder, without increasing the tolerance.

The desktop pixel count covers the exterior bands, not an exact per-frame curved-shape mask. The 90-frame native alpha audit separately checks the composition surface outside its shape bounds; inspect the saved PNGs for visible artifacts inside the envelope, including curved corners. These checks cannot guarantee detection of every single-refresh artifact: screen capture samples the real desktop, while the alpha audit uses the host's simulated frame sequence. Report any visible opaque/white rectangle as a failure even if counters are zero.

## Evidence and acceptance

The output contains `results.csv`, `results.json`, screenshots, leak counts, frame samples, input times, idle samples, binary inventory and `probe/` with the isolated profile, native logs and latest diagnostic status. The console prints a PASS/FAIL table. Screenshots may contain desktop content; review before sharing.

Do not merge until both the table and your visual inspection are green on the target laptop, and any separately required CI checks are green. If launch is blocked before application entry, retain the failure table and Windows Code Integrity/SAC evidence; absence of an application log is not a successful launch. If the script aborts before creating a table (for example, unsupported OS or unreadable path), that run is not green.

The script requests graceful exit of its own host in cleanup, restores the cursor and retains evidence. It does not terminate unrelated Islandly instances. A host that refuses to exit fails cleanup; close it through its tray before retrying. Restore your preferred Windows theme, app fullscreen state and any desktop changes manually. The isolated profile can be deleted with the evidence folder when no longer needed.

Implementation branch: `codex/T25-laptop-smoke`, based on T21 `38e50a21602e7835ee8be59d031d2eb3e6f89dec`. No runtime changes, builds, new EXE/DLL files, existing test edits or threshold changes are part of this task. Real Windows 11 laptop execution is pending until an operator runs this procedure; local validation must not be reported as laptop green.

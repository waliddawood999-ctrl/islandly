# T18 executable identity and native freeze

Branch codex/T18-sac-reputation starts at T17 commit9e1fdaa; draft PR targets codex/T17-integration. No merge, signing, certificate setup, policy exception or SAC setting change.

## Exact Electron reference and verified reproduction

Walid supplied the full laptop-accepted Electron45.1.0 identity: **758e43cf25850408fa42d7de76565561ae329b353b8facc508ece9875bcd1592**,249,798,656bytes. Original Islandly-win64.zip from claude.ai:164,958,731bytes, SHA25623b80c7f766bdb4050221dd7e0122185e643828712e7e4cebb24b50f4140c13e; no public URL. These are recorded in packaging/windows-identity.json.

User authorized reproduction from the old0.4.0 configuration. A separate locked packager20.3.0/resedit2.0.3 toolchain creates a minimal, fixed0.4.0 identity fixture with nameIslandly, Electron45.1.0 and stock CompanyName GitHub, Inc. The original resource fields are preserved: ProductName/FileDescription/InternalName Islandly; OriginalFilename Islandly.exe; FileVersion/ProductVersion0.4.0; stock GitHub copyright. **Local reproduction succeeded with an exact full758E SHA256 match**, not merely matching version strings. Windows CI must repeat and check it before artifact acceptance.

The frozen fixture is independent of current application code/package version. Only this user-authorized reproduction phase writes the old version-resource values; after full hash verification, the EXE is copied unchanged into panels/Islandly.exe. No later rename/re-stamp/sign runs. Current committed code and production dependencies replace only panels/resources/app. Optional -ReferenceZip accepts the original ZIP instead, by its full archive checksum and exact EXE pin. A mismatch aborts the package; a different hash is never accepted as a “close enough” baseline. The obsolete app-dependent stamping script is disabled on T18; the T17 optional signing step is not invoked.

The layout is:

```text
Islandly.exe                     native idle owner
panels/Islandly.exe              exact trusted Electron binary
panels/resources/app/            current app code and production dependencies
EXECUTABLE-IDENTITY.json         full inventory / host retest status
EXE-SHA256.txt                   SHA256 of every EXE recursively
EXE-VERSION-RESOURCES.json       original Electron version-resource values
```

The build uses unpacked resources/app, matching the existing bootstrap/updater. App changes must never require re-stamping the Electron EXE. Folder moves keep the filename and bytes intact; naming the same bytes differently would not itself change SHA256, whereas resource stamping does. Copying the same binary is a preservation measure, not proof of a future cloud/policy decision.

## Why the exact T9 host cannot satisfy the complete task

Read-only inspection of the published t9-native-preview ZIP confirms:

- Archive SHA25689913f4327f1b112343e0a4c9b8730f5c60d8013f46ae7eed0c227940e5d3575.
- Native Islandly.exe47,104bytes, SHA256e13846b221380b1accf4f79cad17dc721f72a5ad406a3f95682f3089fe64382b, matching Walid's accepted prefix.
- Its IslandlyPanels.exe is the blocked identity190bd5d696f1a2e4867f769306a980c6efc359e7a5ca86a188ddb447dd7ae30b, not the758E reference.

The old host has no configurable/IPC hook to display the T17 bilingual application-control notice when CreateProcess fails. That failure happens before Electron can handle it. Its cleanup can overwrite the native error and it can raise an unhandled timer exception. Reusing those exact bytes would lose required error handling; a config/IPC-only change cannot supply it. No old binary is silently substituted just to inherit a previously allowed hash.

Keep T17 hardening and policy notice; change only three host path expressions to locate panels/Islandly.exe and its resources/app. Bootstrap/startup host-path resolution lives in Electron code, with legacy/dev layout compatibility. No new host feature logic: always-on AppBar/window, input, timer/state and native power/material ownership remain native because moving their idle duties into Electron would violate zero-Electron idle. Panel features/settings remain external code/config.

## Reproducible host, explicit new identity

native/toolchain-lock.json pins Microsoft.Net.Compilers.Toolset4.14.0 and .NETFramework reference assemblies net48 1.0.3 by full package SHA256. No machine-dependent framework compiler/reference fallback. Native compilation uses deterministic output, mapped source paths, explicit UTF8, no debug information and fixed compiler options. test/native-reproducible.ps1 builds the same sources in two clean roots (including a path with spaces) and fails unless EXEs are byte-identical.

CI reports the host hash against the recorded build baseline and the laptop-accepted T9 hash separately. The first candidate baseline remains pending its Windows build. A new native hash **requires laptop SAC testing**; matching a reproducible-build baseline is not a claim of cloud reputation. Preserve/retag that accepted binary only after Walid confirms it. Future app-only changes must retain the native source/toolchain; code/binary changes are visible as a hash change and retest flag.

## Verification and limitations

npm test adds full-pin/name/size/content rejection and complete recursive EXE-inventory tests, plus same-named Electron/native path resolution. Windows CI adds clean-root host reproducibility and keeps policy-message/one-retry tests. Package CI checks exact Electron SHA before ZIP generation, then hover/click/Ctrl+Alt+I, complete Job shutdown, overlay/AppBar and full RAM measurement on the packaged layout. Both EXEs have the same process name: process accounting uses the native host PID and the full Job PID inventory, never name-based exclusion. Idle guards require exactly one native process, no Electron/GPU/Utility/Renderer, every idle RAM sample <180MB and mean CPU <1%.

Measurements retain15s warmup and60 one-second samples for idle/settings-open/returned-idle. No working-set trim or omitted helper. Raw reports and hashes accompany Islandly-sac-reputation-win64.zip in the islandly-t18-sac-reputation-windows artifact. Do not claim Windows artifact/runtime measurements until those tests pass. No UI/settings/palette/font/CSS source changes.

A running host retains the bilingual SAC/App Control notice and suppresses automatic policy-block retries. If SAC blocks the native host itself before entry, no host log or tray notice can run. Keep SAC enabled and use CodeIntegrity evidence for the new candidate. Windows Server CI verifies packaging/lifecycle/accounting, not real SAC acceptance. Existing T17 optional signing remains historical; T18's identity-locked package never invokes it, and the signing script refuses a locked package.

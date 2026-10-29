# Optional Windows Authenticode signing

SAC is enabled on Walid's Windows11 build26300 laptop and blocks the unsigned preview EXEs. Keep SAC enabled. If it blocks Islandly.exe itself, no application code executes and no native log/tray message is possible. If only the panels are blocked, the host's bilingual message identifies application control and suppresses automatic retries. See T17-LAUNCH-VERIFY.md for the supplied CodeIntegrity evidence.

## Build order and unsigned previews

The `packaged-windows` job in `.github/workflows/native-perf.yml` prepares the package without an archive, runs `scripts/sign-windows.ps1`, creates a fresh ZIP with `scripts/archive-native.ps1`, then tests the same packaged files before uploading. The signing targets are exactly **Islandly.exe** and **IslandlyPanels.exe**. `SIGNING-STATUS.txt` inside the package and the job summary state whether they were signed or the preview is unsigned.

No credentials: clean skip, successful unsigned test artifact, explicit SAC warning. Only one credential present, malformed PFX, expired/not-yet-valid certificate, absent private key/code-signing EKU, signing error, invalid/untrusted signature, wrong signer or missing timestamp: fail the build, with no unsigned fallback/artifact upload. Both EXEs must verify before archiving. Existing vendor DLL/node files are not re-signed or modified by this step.

## Optional inputs, to be decided by Walid

No certificate was bought, generated, installed or configured, and no repository secrets/settings were changed. When Walid chooses a signing method, this hook supports an existing password-protected, code-signing PFX with a usable private key:

| Input | Location | Meaning |
|---|---|---|
| `ISLANDLY_SIGN_PFX_BASE64` | GitHub Actions secret | Base64 of the complete PFX, provided through approved secret management, never committed or pasted into PRs/logs |
| `ISLANDLY_SIGN_PFX_PASSWORD` | GitHub Actions secret | Nonempty password for that PFX |
| `ISLANDLY_SIGN_TIMESTAMP_URL` | Optional Actions variable | Authenticode timestamp server; default `http://timestamp.digicert.com` |

The PFX/private key stays in memory using EphemeralKeySet, is disposed after signing and is never installed in a certificate store or written to disk. Signing uses SHA256 and requires a verified timestamp and matching signer. Passwords are never passed as process command-line arguments. The job does not print secret values. A hardware/cloud/nonexportable-key certificate requires the provider's signing integration instead of this PFX hook; this change does not choose or configure one.

**Secrets are exposed only on an explicitly initiated `workflow_dispatch` run of reviewed code.** PR builds (including same-repository PRs) never receive signing credentials and remain unsigned. Select the reviewed `codex/T17-integration` ref for the native workflow when dispatch is available. GitHub requires the workflow to be present on the default branch for manual dispatch availability; this change does not add it to main or merge anything. Until that is available, a trusted Windows build machine can run the same sequence with securely supplied process-scoped inputs:

```powershell
npm ci
npm test
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/package-native.ps1 -SkipArchive
pwsh -NoProfile -File scripts/sign-windows.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/archive-native.ps1
```

Use `pwsh` for the signing step (Windows PowerShell5 may lack the ephemeral-key support); other commands need no secrets. Run these from the repository root. Do not put a password or PFX value in command history. `npm run package:native` alone still creates an unsigned local package and does not invoke signing. This document describes optional inputs, not a request to obtain a certificate now.

## Validation and limits

CI tests classification of real numeric policy/hash statuses, no-retry decisions, ordinary-error retry preservation and the bilingual notice. Packaging tests absent credentials (clean skip), partial credentials (failure) and malformed input (failure without importing any certificate). Packaged hover/click/hotkey/error-recovery tests still run on Windows Server. Those tests do not enable, emulate or bypass SAC.

Actual trusted signing/timestamp verification has **not been exercised without signing credentials**. A signed artifact and successful laptop launch are not claimed. Certificate trust/reputation and policy can still block a signed EXE or a bundled DLL/.node dependency; signing these two entry points alone is not a guarantee of SAC acceptance. After Walid chooses signing, verify both EXEs with `Get-AuthenticodeSignature`, validate the full package on the unchanged SAC laptop and inspect CodeIntegrity if it rejects any dependency. Signing does not disable or override policy.

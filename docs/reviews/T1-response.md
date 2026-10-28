# T1 response to PR #1 review

2026-10-28 · Codex. Branch `codex/T1-review-fixes` starts at dev
`3cfd490` and incorporates the existing PR #1 head `355a687` without changing
that branch. PR #1 already targets dev. No main branch mutation or release.

| Review | Disposition and evidence |
|---|---|
| B1 | Circular click-through now defaults off (`circularClickThrough:false`). Hover regression still requires Claude's T6 repair and T2 verification; no renderer/CSS edits in this follow-up. |
| B2 | Required Ubuntu/Xvfb UI job retained, with no skipped failures. Prior run 40719040563 failed seven pointer checks; Windows verify/package passed. T2 must adapt and verify the 0.5 UI. |
| B3 | Existing false defaults retained for LAN, capture, FFmpeg, rembg, plugins, lyrics, native notifications. LAN is unavailable; OCR rejected before spawning a worker; rembg rejected before any model download. Capture now checks enablement on every IPC and permission request and after asynchronous source enumeration; disabling closes capture and cancels pending opens. FFmpeg rechecks enablement after executable resolution and rejects unknown operations/relative input paths. Regression tests cover disable/stop during awaits. |
| B4 | Still pending Claude/T4. User explicitly reserves renderer and all CSS to Claude. No broad reformat in this follow-up. |
| B5 | Still pending scope split/coordination. Existing PR #1 content is preserved in history; importing it does not claim that the review's requested split is complete. Draft must not merge while blockers remain. |
| S1 | Renderer IPC rate reduction remains with Claude/T6 and performance work. Circular hit testing is disabled by default. |
| S2 | Existing disabledFeatures defaults include activity/jobs/plugins/adhkar. |
| S3 | Existing shell packaging trim retained; Windows CI now also prunes Koffi builds except win32_x64, checks the target exists, creates Islandly-win64.zip and reports its actual bytes in the job summary. |
| S4 | Release updater belongs to T3; current updater still reads main. Do not release this build before T3. |
| S5 | Existing smoke explicitly skips secret roundtrip when secure storage is unavailable; encryption requirement preserved. |
| S6 | Sender authentication preserved. No speculative relaxation to hide the launcher:list error; investigation remains open. |
| S7/S8 | LAN and rembg remain unavailable pending interface consent and model/license review respectively. |
| N1/N2 | Renderer/CSS cleanup remains Claude's work. |
| N3/N4 | Nonblocking documentation improvements remain open; terminal helper is described in docs/DEVELOPMENT.md. |

No blocking observation is rejected as invalid. B1/B2/B4/B5 remain explicit
integration blockers, rather than claimed fixes. Latest IPC contract in Claude's
T0 branch takes precedence over the older snapshot inherited from PR #1; this
task introduces no IPC contract change.

Validation: `npm test` on Linux / Node 24 passes all nine test scripts, including
seven reliability regressions, real image/PDF workers, renderer DOM integration,
media lifecycle and extended safety-default tests. `git diff --check` passes.
No manual Windows testing, Windows performance result, or all-green UI run is
claimed. See the T1 handoff entry for PR/CI links and current results.

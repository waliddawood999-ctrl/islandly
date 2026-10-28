# Stable release updates (base 3)

Updates discover GitHub's published stable `/releases/latest`, resolve its tag to an immutable commit, and verify the package version and every downloaded code/assets blob against that commit's Git tree. Drafts and prereleases are never installed. No update check uses the head of main. GitHub/TLS and the repository's release permissions remain the trust boundary; Git blob hashes detect corruption, not a compromised release account.

The installation must be base 3. A changed base or runtime dependency set returns `needs-full-download` through the existing IPC result/toast path. The unmodified 0.4.0/base2 updater also stops at a base change before downloading code. Old binaries cannot retroactively switch their discovery endpoint: a full install is required. The legacy source snapshot in `test/fixtures/base2-updater.cjs` verifies this compatibility behavior.

## State and recovery

Under userData/updates:

- `.download-*`: incomplete download, never executable. Removed on ordinary failure/cancellation; a process kill may leave an inert partial directory.
- `<version>-<commit>`: immutable downloaded tree plus a blob-hashed manifest. Kept to avoid deleting a tree still used by a process. Automated retention cleanup is deferred.
- `staged.json`: fully verified candidate; does not replace the active version until restart.
- `current.json`: active tree, marked booting before each startup, healthy after the island document loads without a preload/load failure.
- `previous.json`: the last healthy downloaded tree, verified again before rollback.
- `failed.json`: exact versions rejected after failed startup or local integrity failure; a later version can still be offered.

Bootstrap obtains the single-instance lock before state changes. It checks all manifest hashes, package/base/version and contained paths, then promotes staged state using atomic pointer replacement. C failing startup rolls back to healthy B on the next launch; a corrupt/missing B falls back to packaged A. A 30-second startup watchdog exits an unacknowledged downloaded startup, leaving the rollback marker set. This detects startup failure, not arbitrary application bugs after startup.

No live tree is overwritten or deleted by staging. Stop cancels outstanding downloads. Requests have a 30-second deadline, a 2-minute total check deadline and size/file budgets. The current-file format from base2 is intentionally not migrated; base2 continues from its packaged version.

## CI and draft creation

`Release channel verification` runs on every PR to dev and push to dev. Windows runs npm test and the real Electron/local-HTTP update flow, packages `Islandly-win64.zip`, prunes other-platform Koffi binaries, and uploads ZIP, SHA256SUMS and build metadata.

A maintainer may manually dispatch the workflow with an **existing** stable tag matching package.version. The workflow checks out that tag, builds/tests it and checks the remote tag still resolves to the built commit before creating a **draft** Release. It never publishes, creates a tag, overwrites assets, or edits an existing Release. No draft/release was created during T3 development.

T16 PR #7 separately defines the explicitly requested stable-tag installer publication. T3 does not change that policy. Its draft workflow is a separate manual review route; it will fail safely if that tag already has a Release. Both task branches began at dev 3cfd490, so the updater, package scripts and coordination-doc overlap must be reconciled when integrating #7 and T3. Keep T16's electron-builder dependency/configuration and installer workflow, plus T3's transactional updater/bootstrap/tests. Use one authoritative portable ZIP build when integrating both workflows.

## Verification

`npm test` includes A -> B -> C, healthy rollback, packaged fallback, bad downloads, post-download corruption, corrupt rollback tree, path/manifest/tag checks, native dependency/base guards, cancellation and a real child-process forced termination/relaunch. That child test runs the actual bootstrap with an Electron API stub and resolves a module from the packaged dependency directory. It is distinct from the real Electron update-flow CI test and from manual Windows desktop acceptance.

Manual Windows acceptance remains required: upgrade a base3 portable/install build, force termination before startup acknowledgement, relaunch to B, verify settings persist, and confirm a base2 build displays the full-download notice. Linux development and headless Windows CI do not establish these manual results.

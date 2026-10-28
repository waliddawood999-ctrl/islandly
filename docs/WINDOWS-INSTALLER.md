# Windows installer and Releases

Download the current installer or portable ZIP from https://github.com/waliddawood999-ctrl/islandly/releases/latest . This URL requires at least one published stable Release; a PR build cannot create it.

`npm ci && npm run dist:win` builds `dist/Islandly-Setup-x.y.z.exe` and `dist/Islandly-win64.zip` on Windows. The installer is one-click, per-user, creates shortcuts, and preserves user data on uninstall. Signing is not configured yet.

The Windows installer workflow tests and packages every PR to dev and every push to dev. These runs upload review artifacts only. A maintainer may create a stable tag such as `v0.5.0`, matching package.json exactly. On that tag the same build must pass before a separate job with contents:write publishes both binaries and SHA256SUMS, setting the Release as latest. Codex does not create tags or update main.

Release update checks ignore moving branches, draft releases and prereleases. The release tag resolves to an immutable commit, package.version must match, and code blobs must match the Git tree hashes. A different islandlyBase returns needs-full-download; existing 0.4.0/base2 binaries require a full download and are not rewritten by this PR. T3 covers transactional installation and rollback.

Manual Windows verification (pending; this implementation was developed on Linux):

1. Install the NSIS artifact as a standard user. Confirm launch, tray, shortcuts and startup after relaunch.
2. Install a newer build over it; confirm settings persist and the installed application reports the new version.
3. Uninstall; confirm shortcuts and application files are removed and user data remains.
4. Extract the portable ZIP to a fresh directory and run Islandly.exe. Confirm native media and Koffi features load.
5. Verify a base2 build requests a full download for base3, and a base3 build checks Releases without requesting commits/main.
6. On a maintainer-pushed stable tag, confirm both assets and SHA256SUMS appear on the published Release and /releases/latest resolves to it.

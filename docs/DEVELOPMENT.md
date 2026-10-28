# Review build and integrations

Use Node 24, `npm ci`, `npm test`, then `npm start` on Windows. `npm run test:smoke` boots the real application with isolated temporary user data and returns a nonzero exit code on failed assertions. `npx electron test/update-flow.js` uses a local fake GitHub service; it never changes this repository or downloads production updates.

## Windows review artifacts

`.github/workflows/windows.yml` runs tests, Electron smoke, builds the .NET notification bridge, packages Electron and creates an **unsigned** MSIX. Check Actions results before using the build. Nothing signs, installs certificates, publishes a release, or merges the PR.

Manual bridge build: `dotnet publish native/NotificationBridge/NotificationBridge.csproj -c Release -r win-x64 -o bridge`. Requires Windows, .NET 8 and Windows SDK/XAML build tools. Windows App SDK is self-contained. `scripts/package-msix.ps1 -AppDirectory out/Islandly-win32-x64 -Output out/Islandly-unsigned.msix` requires Windows SDK makeappx.exe. Signing and publisher identity are deployment decisions; do not trust a development certificate automatically. Notification listener access requires the MSIX identity and user permission; ordinary ZIP builds report `package-required`.

`scripts/package-win.sh` packages committed HEAD with locked production dependencies and Windows optional native modules. Commit local changes before using it. It can copy a previously built `bridge/` folder but cannot compile WinUI on Linux. The new dependencies and bootstrap require `islandlyBase: 3`, so 0.4.0/base2 needs a full download. Do not publish this on main until Windows acceptance is complete.

## Explicit terminal reporting

Run `powershell.exe -NoProfile -File .\islandly-run.ps1 -Label Build -Command "npm run build"`. This launches exactly the command you supply in a child PowerShell; do not pass untrusted notification or AI text. It writes small status events to `%APPDATA%\islandly\events`. Islandly reads only bounded JSON with matching IDs and deletes old events. It does not hook the terminal or collect every command. Stop the command from its own terminal; the island cannot cancel an unrelated terminal session.

## Community plugin example

Enable Plugins in Settings, open the plugin folder, copy `examples/plugins/clock` there, then enable Clock in the Plugins panel. Each plugin has a manifest (`name`, `entry`) and a JavaScript entry under its own folder. Only `islandPlugin.publish({title,text})` is exposed. Rendering uses text nodes; HTML is not accepted. There is no Node, fetch/network, filesystem, clipboard, application launch or native access. Source is limited to 100KB, cards to 2000 characters, publication to twice/second and active plugins to four. Extensions are not automatically downloaded/enabled. Unresponsive/crashed renderers are destroyed. Disabling removes the process/card.

This first plugin API intentionally supports text cards only. Rich controls/native permissions/store distribution need a separate permission model and review. Sandboxing limits access; it cannot promise zero resource use or protection against every Chromium vulnerability.

## Operating notes

- Expanded panel wheel: change panel; Shift+wheel: system volume; Alt+wheel: cycle displays.
- Ctrl+Alt+O: screenshot selection/OCR window; Ctrl+Alt+T: review clipboard text in the assistant. Buttons choose region/OCR or recording explicitly.
- Shelf image operations create outputs under Downloads/Islandly. OCR text opens Assistant locally; sending to AI requires another explicit action.
- File palette queries: `file report` / `ملف تقرير`. Search root is configurable, defaults to Documents, depth 5 / 10,000 entries / 5 seconds.
- Reminders: `remind 60 drink water` / `ذكرني بعد ١ ساعة استراحة`. Reminder persistence is local; due reminders are delivered after restarting the app, not while it is closed.
- Quiet command pauses Islandly notifications only. System Wi-Fi/Bluetooth/output device/DND controls open the corresponding supported Windows Settings page.

See [IMPLEMENTATION-STATUS.md](IMPLEMENTATION-STATUS.md) for the complete requested-feature matrix, privacy details and unverified Windows acceptance checklist.

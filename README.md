# Islandly

A Dynamic Island for Windows: a small floating pill at the top of your screen that grows to show music, timers, battery, meetings and more.
جزيرة ديناميكية لويندوز: كبسولة صغيرة أعلى الشاشة تتمدد لتعرض الموسيقى والمؤقت والبطارية والاجتماعات وغيرها.

## Features

| Panel | What it does |
|---|---|
| **Music** | Now playing from any app or browser tab (Spotify, YouTube, Quran videos, ...). Play/pause, next/previous, ±10 seconds, and a draggable progress bar to jump to any second. Buttons the current media does not support are dimmed. |
| **Timer** | Focus / break timer (Pomodoro) and quick countdowns. |
| **Battery** | Percentage, time left, "unplug at 80%" tip, battery level of connected Bluetooth devices (when the device reports it). |
| **Clipboard** | Recent copies with a fitting action: open a link, WhatsApp a number, copy a colour as RGB, evaluate a calculation, pin items. Text only, kept in memory only. |
| **Shelf** | Hold files temporarily and drag them out to any app. Add with `Ctrl+Alt+S` (selected files in Explorer) or by dropping files on the open island. Files are never copied or moved. |
| **Meetings** | Next meetings from your calendar (iCal link), a heads-up 5 minutes before and when it starts, one-click **Join** for Zoom / Meet / Teams / Webex links. |

The island stays out of your way: after a few seconds it shrinks to a thin line at the top edge (hover it to bring it back), it hides itself in fullscreen video and games, and it can sit in the centre, left or right.

## Install (no tools needed)

Download `Islandly-win64.zip`, extract it, double-click `Islandly.exe`.
If Windows shows "Windows protected your PC", choose **More info → Run anyway** (the app is not code-signed).
After that the app **updates itself** from this repository.

## Using it

| Action | How |
|---|---|
| Expand | Hover the island (it opens after a short pause) |
| Keep it open | Click it (click again to release) |
| Switch panel | Mouse wheel over the island, or click the dots |
| Open / close the panel from the keyboard | `Ctrl+Alt+I` |
| Start / pause the focus timer | `Ctrl+Alt+P` |
| Put the files selected in Explorer on the shelf | `Ctrl+Alt+S` |
| Settings, position, auto-hide, quit | Right-click the island, or click the purple tray icon (it may be under the ^ arrow) |

The window is click-through everywhere except on the island itself, so it never blocks what is underneath.

**Calendar:** open Settings from the tray icon and paste your calendar's private iCal link (Google Calendar → Settings → your calendar → "Secret address in iCal format"). It stays on your computer.

## Updates

On start and every 6 hours the app checks the `main` branch of this repository. If `package.json` has a newer version it downloads `src/`, `assets/` and `package.json` (about 1 MB), verifies every file against the git tree, and installs it on the next restart. If an update ever fails to start, the app falls back to the packaged version and skips that update.
Releasing = bump `version` in `package.json` and merge to `main`. Changing the native part (Electron version, native modules) means bumping `islandlyBase` and shipping a new zip.

## Development

```
npm install
npm start            # run the app
npm test             # unit tests (calendar parser, update helpers)
npm run test:smoke   # boots the real app and checks the IPC bridge
node test/update-flow.js   # update flow against a local fake of GitHub (run with electron)
xvfb-run -a npx electron test/ui-e2e.js --no-sandbox   # real pointer on a virtual display: hover, clicks, seek, layout (needs python-xlib)
node dev/preview.mjs       # screenshots of every panel in headless Chromium
scripts/package-win.sh     # builds Islandly-win64.zip (works from Linux/macOS)
```

```
src/main/        Electron main process: window, tray, shortcuts, media, clipboard, shelf, calendar, updater
  scripts/       small PowerShell helpers (media controls, fullscreen watcher, Explorer selection, Bluetooth battery)
src/renderer/    The island itself (plain HTML/CSS/JS, no build step)
  island.js      Spring-animated pill, auto-hide, view switching
  features/      One file per panel; each registers itself with Island.register()
src/settings/    The settings window
```

Adding a panel = one file in `src/renderer/features/` that calls `Island.register({ id, icon, priority(), view(mode) })`.

## Notes

- Music info uses the Windows media session API through [`@coooookies/windows-smtc-monitor`](https://www.npmjs.com/package/@coooookies/windows-smtc-monitor) (MIT). Controls use the same API through a PowerShell helper and fall back to the system media keys.
- Everything stays on your machine. The only network traffic is the update check (GitHub) and, if you set one, your calendar link.

## License

MIT, see [LICENSE](LICENSE).

# Islandly

A Dynamic Island for Windows: a small floating pill at the top of your screen that grows to show music, timers, battery and more.
جزيرة ديناميكية لويندوز: كبسولة صغيرة أعلى الشاشة تتمدد لتعرض الموسيقى والمؤقت والبطارية وغيرها.

## Status

**Phase 1** (this version): island engine with spring animation, clock, music (now playing + controls), focus timer / Pomodoro, battery.
Next phases are listed in [ROADMAP.md](ROADMAP.md).

## Run it (Windows 10 1809+ / 11)

1. Install [Node.js](https://nodejs.org) (LTS).
2. In a terminal:

```
git clone https://github.com/waliddawood999-ctrl/islandly
cd islandly
git checkout phase-1
npm install
npm start
```

The island appears at the top-center of your main screen. A tray icon lets you hide it, start it with Windows, or quit.

## Using it

| Action | How |
|---|---|
| Expand | Hover the island |
| Keep it open | Click it (click again to release) |
| Switch panel | Mouse wheel over the island, or click the dots |
| Show / hide panel from the keyboard | `Ctrl+Alt+I` |
| Start / pause the focus timer | `Ctrl+Alt+P` |

The window is click-through everywhere except on the island itself, so it never blocks what is underneath.

## Project layout

```
src/main/      Electron main process: transparent window, tray, shortcuts, media bridge (SMTC in a worker thread)
src/renderer/  The island itself (plain HTML/CSS/JS, no build step)
  island.js    Spring-animated pill and view switching
  features/    One file per feature; each registers itself with Island.register()
dev/preview.mjs  Screenshots every state in headless Chromium with a mocked bridge
```

Adding a feature = one file in `src/renderer/features/` that calls `Island.register({ id, icon, priority(), view(mode) })`.

## Notes

- Music info uses the Windows media session API through [`@coooookies/windows-smtc-monitor`](https://www.npmjs.com/package/@coooookies/windows-smtc-monitor) (MIT). It works with Spotify, browsers, VLC, etc.
- Play / pause / next / previous send the system media keys.
- Everything stays on your machine.

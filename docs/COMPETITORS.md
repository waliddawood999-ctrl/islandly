# Competitor benchmark and UI plan (T19-UX)

Date: 2026-10-29 · Author: Claude · Status: research notes + the UI-only items implemented in this PR.

## How this was researched (and what it can't tell you)

Desk research only: web search plus the public READMEs of the open-source apps. **No competitor was installed or run**, so "visual quality", "animation" and "settings UX" are judged from README/feature descriptions, screenshots' captions and the stated tech stack, not from hands-on use. Pages that could not be reached from this session (notchy.dev, windowscentral.com, apps.microsoft.com: blocked by the sandbox network allow-list) are cited only through their search snippets, and anything taken from a snippet is marked ◦. No competitor makes a quantitative RAM/CPU claim with a benchmark; the numbers for Islandly come from `docs/perf.md` (Windows CI runner, not a retail laptop).

## Competitors

| App | Stack / license | Core features | Visual + animation (as documented) | Settings UX | Arabic / RTL | Performance claims |
|---|---|---|---|---|---|---|
| **PILLAR** [1] | Tauri 2 (Rust) + React, Motion; free, open source, unsigned build | SMTC media with album-art tint, Pomodoro timers, notification toasts folding into the pill, volume + per-app mixer + output switch, CPU/RAM, brightness/battery, AI assistant (needs `GROQ_API_KEY`), tasks/notes/agenda | Hover to peek, click to expand; Motion springs; reduced-motion support listed | A Settings tab with a live system monitor; no other settings documented | Not mentioned | "~3 MB", "near-zero CPU when idle", "adaptive polling"; no RAM figure or benchmark |
| **rajsriv/dynamic-island-for-windows** [2] | Python + PyQt6, MIT | Idle/Hover/Music/Notification states, CPU/RAM/disk/net, weather, calendar, tasks, Caps/Num-lock alerts, power controls, wallpaper accent colour | Three animation styles (Glow Sweep, Fluid Blobs, Neon Border), "Liquid Glass" style, notch-anchored style | Right-click menu (animation style, island style, location), autostart toggle | Not mentioned | None quantified ("smooth", "fluid") |
| **sadeeshasathsara/dynamic-island-on-windows** [3] | C# WPF + WinRT, Win 11 22621+ | Replaces Windows toasts with a pill, hover Mute/Clear, click opens source app, per-app accent avatars, stays above full screen | Drop-down bounce, horizontal expand, slide-up exit | Tray icon + Windows notification-access permission; no settings screen documented | Not mentioned | "sub-millisecond event handling", no benchmark |
| **DynamicWin** [4] | C#, FenUI; releases-only repo, CC BY-SA 4.0 | Media controller, Google Calendar, file tray (share dialog), Bluetooth device + battery, "spring notches", scroll to switch view, auto-updater | Animated preview only; no details | Not described | Languages section empty | None; its "quick-drop" popup was removed for "massive performance issues" |
| **eIsland** [5]◦ | Electron + React + TypeScript, GPL-3.0 | Weather, synced lyrics, timers, system-action toolbox, AI agent | Not described | Not described | README is Chinese; no RTL mention | Not described (Electron) |
| **Win Dynamic Island** (Microsoft Store) [6]◦ | n/a | Music controls, weather, system monitor, app shortcuts, clipboard manager, meeting controls | n/a | n/a | n/a | n/a |
| **Dynamic Edge / Nusa Dynamic Island / Isle Notch / WinIsland** [6][7]◦ | WinUI 3 (Dynamic Edge); Rust (WinIsland) | Media, clipboard, timers, charge status, app shortcuts; Dynamic Edge has a Pro tier | n/a | n/a | n/a | n/a |
| **NotchNook** (macOS, reference) [8]◦ | macOS only | Control centre, drag-and-drop file tray, AirDrop; a paid lifetime licence or subscription | Native macOS polish | n/a | n/a | n/a |

Not Windows apps despite their names: DynamicLake, Alcove, Boring Notch, Notchy (all macOS) [6].

**Islandly (this repo, T17 integration state)**: native Win32 host with no Electron while idle (idle 40.1 MB avg, CPU ≈0.4 % on the Windows CI runner, `docs/perf.md`); on-demand Electron panels; acrylic + dark glass; overlay and AppBar modes; Motion springs with Full/Reduced/Off and an Eco mode; Arabic-first UI with full RTL, Arabic-Indic digits option, IBM Plex Sans Arabic; prayer times, Hijri calendar, Quran player; live RAM panel in Settings; command palette; clipboard, shelf, notes, timers, GitHub, mic/camera indicator.

## Gap list

Legend: **Behind** · **Equal** · **Ahead** (relative to the best documented competitor; all "ahead" claims are on documented features, not hands-on tests).

| Area | Islandly | Verdict | Note |
|---|---|---|---|
| Arabic / RTL | Arabic-first, complete RTL, Arabic digits, bilingual strings with parity test | **Ahead** | No competitor documents Arabic or RTL at all |
| Prayer, Hijri, Quran | Built in (T10/T12) | **Ahead** | Nothing comparable found |
| Idle footprint | No Electron while idle, measured and CI-guarded | **Ahead** (on paper) | PILLAR claims "near-zero" and ~3 MB installer but publishes no RAM measurement; unproven either way on the same hardware |
| Eco mode + motion control | Full/Reduced/Off + Eco + live RAM panel | **Ahead** / **Equal** | PILLAR also has reduced motion; none has a RAM panel |
| Materials | Acrylic and dark glass, pill-shaped clip | **Ahead** | Others: tint from album art / wallpaper, "Liquid Glass" (rajsriv) |
| Two placement modes | Overlay and AppBar | **Ahead** | Others are overlay only |
| Media + lyrics | SMTC, lyrics strip, seek | **Equal** | eIsland has lyrics; PILLAR has art tint |
| Timers, clipboard, shelf, system | Present | **Equal** | |
| **Settings navigation** | One 9-section scroll page, no way to jump | **Behind → fixed here** | Competitors have less settings, so this was a self-inflicted gap |
| **Settings control consistency** | Mixed native checkboxes, selects, T14 switches | **Behind → fixed here** | |
| **Settings feedback / live preview** | None | **Behind → fixed here** | No competitor shows a preview either: a chance to lead |
| **Keyboard focus visibility** | No focus ring on island buttons; 5 px tab dots | **Behind → fixed here** | PILLAR advertises keyboard nav + screen-reader announcements |
| Windows notification mirroring | Not present | **Behind** | sadeeshasathsara, PILLAR. Needs backend → Codex |
| Per-app volume / output switch | Not present | **Behind** | PILLAR. Needs native audio → Codex |
| Caps/Num-lock and key-state alerts | Not present | **Behind** | rajsriv. Needs a native hook → Codex |
| Bluetooth device battery | Present in battery panel | **Equal** | DynamicWin has it too |
| Autostart toggle | Not in Settings | **Behind** | rajsriv. Needs `main` → Codex |
| Wider / resizable Settings window | Fixed 480×680 | **Behind** | `main.js` window options → Codex |
| Signed installer, auto-update | T16/T3 in review | **Equal** | PILLAR is unsigned; others vary |

## Prioritised plan: top five (impact ÷ effort)

| # | Improvement | Impact | Effort | Owner |
|---|---|---|---|---|
| 1 | **Section navigator** in Settings: sticky chips with scroll-spy and jump-to-section; short labels in both languages | High: 9 sections no longer need a long hunt | S | Claude (done) |
| 2 | **One control language**: every checkbox row becomes the same switch as T14; short choices (position, size, digits, madhab) become segmented controls; consistent focus rings, custom select chevron, ellipsis + tooltip for long option text | High: reads as one designed product | S–M | Claude (done) |
| 3 | **Live preview** of the pill in Appearance: material (acrylic/glass), mode (overlay/AppBar reserved strip), size, position, and the digit style | High and unique: users see the effect of a setting before leaving Settings | M | Claude (done) |
| 4 | **"Saved" confirmation**: the app applies every change at once, but nothing said so; a polite live-region chip in the header | Medium: trust, accessibility | XS | Claude (done) |
| 5 | **Keyboard and touch polish**: visible `:focus-visible` rings in island, Settings and palette; tab-dot hit area ≈11×25 px (the dots stay 5 px to the eye) with `aria-label`/`aria-current`; clearer selected palette row | Medium–High: accessibility is a documented selling point of PILLAR | S | Claude (done) |

### Needs backend or native work: **Codex** (not implemented here)

1. Windows notification mirroring (WinRT listener, toast suppression): locked by default, explicit opt-in (CLAUDE.md privacy rule).
2. Per-app volume mixer and audio-output switch.
3. Caps/Num/Scroll-lock indicators (native hook).
4. Autostart toggle (a settings key + `main`).
5. Settings window: wider / resizable (e.g. 720 px with a left sidebar instead of top chips) through `BrowserWindow` options in `src/main/main.js`.
6. `palette:shown` should carry `motion`/`ecoMode` (already noted in the T14 UI entry).
7. If the palette ever gets a key-hint footer: `palette:height` budget; the renderer side is ready.

## Sources

1. PILLAR: https://github.com/warpirate/pillar-dynamic-island-for-windows
2. rajsriv/dynamic-island-for-windows: https://github.com/rajsriv/dynamic-island-for-windows
3. sadeeshasathsara/dynamic-island-on-windows: https://github.com/sadeeshasathsara/dynamic-island-on-windows
4. DynamicWin: https://github.com/FlorianButz/DynamicWin
5. eIsland (via search result listing): https://github.com/JNTMTMTM/eIsland ◦
6. "Dynamic Island for Windows? What Exists in 2026": https://notchy.dev/dynamic-island-windows/ ◦ (search snippet only); Windows Central coverage: https://www.windowscentral.com/software-apps/want-your-pc-to-be-a-bit-more-like-a-mac-the-dynamic-island-for-windows-just-got-a-big-update ◦; Microsoft Store listing: https://apps.microsoft.com/detail/9pgr4zg2sxw0 ◦
7. Windows BiDi guidance: https://learn.microsoft.com/en-au/windows/apps/design/globalizing/design-for-bidi-text
8. NotchNook comparisons: https://notchly.vercel.app/compare/notchly-vs-notchnook ◦ (third-party, pricing unverified)

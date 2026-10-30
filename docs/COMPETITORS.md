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

---

# Update 2 (2026-10-29): recent competitors, requested features, complaints

## Honest scope of this update

The brief for this update came from **recent X/Twitter posts. This session cannot read X** (search and fetch tools return web pages, not posts), so the post-derived parts (the "most requested" and "top complaints" lists below) are **the requester's summary, not independently verified**. What I could verify is only what each product's own public page, store listing or repo says (Product Hunt, App Store, GitHub, secondary listing sites), found by web search. Where a name could not be matched to any product, it says so rather than guessing. As before, nothing was installed or run, and `◦` marks facts taken from a search snippet or secondary listing.

## New entries

| App | Platform / price | What the public listing says | Found? |
|---|---|---|---|
| **rammcodes' free Windows island** | Windows, free (per the brief) | Nothing under that name or handle in any web result; the free Windows options that do appear are WinIsland, Notchify, Isle Notch (free tier), Cosmic-light, rajsriv's PyQt6 island [9] | **Not found.** Cannot compare features; ask Walid for the link or post |
| **Tomte** [10]◦ | Windows 11, free, MIT; Microsoft Store, winget, GitHub | Draws nothing until the pointer reaches the top edge, a hotkey is pressed or a file is dragged up; then a shelf for files, current media, a note and shortcuts. Described as a top-edge panel, not a permanent notch | Yes (Product Hunt launch post only) |
| **Nusa Dynamic Island** [11]◦ | Windows 10/11 | Collapsed bar at the top that expands on cursor; system notifications, music controls, tools. The article notes new apps often get false antivirus warnings | Yes (one Slovak-language article; no official page found) |
| **Notchzy** [12]◦ | Windows 11 / 10 2004+, one-time purchase | Pill UI with media controls, focus timers and notifications | Yes (listing site only) |
| **Claude Code approval islands** [13] | **macOS only** in every result (Vibe Island, Vibe Notch, Atoll, AgentNotch, Claude Pulse, CodexIsland, LimitWatch) | Approve/deny Claude Code and Codex permission prompts from the notch, show the 5-hour and weekly usage limits with reset countdowns, jump to the right terminal. Mechanism: hooks in `~/.claude/hooks/` talking to the app over a Unix socket; some batch-approve "safe" tools. Vibe Island is listed at $20, closed source; AgentNotch is free, local-only | Yes; **no Windows equivalent found** |
| **Droppy** (macOS) [14]◦ | macOS; listings conflict ($6.99 on Gumroad vs free MIT on GitHub) | Notch file shelf, a floating "basket" summoned by jiggling the mouse while dragging, clipboard history with OCR, media player; works as a pill on Macs without a notch | Yes |
| **Isleta** (macOS) | n/a | No product by that name; closest are **Isle/Isle Notch** (paid, module hub opened by hovering the notch) and **Islet** [15]◦ | **Not found** |
| **Halo** | n/a | No notch/island app by that name in any result; related Mac apps listed: NotchNook, DynamicNotch (free, HUDs for brightness/volume), DynamicHorizon ($12.99), Landing, NotchBox [16]◦ | **Not found** |
| **DynamicLake** (macOS) [17]◦ | macOS | Drag-and-drop file handling, customisable widgets, messaging-app notifications, answering FaceTime/iPhone calls from the island | Yes |

## What users ask for and complain about (requester's list), and Islandly's position

| Request / complaint | Islandly today | Verdict |
|---|---|---|
| Auto-hide/shrink when covering tabs or menus | Auto-hide (shrink after 5 s / thin line / never), **AppBar mode reserves the strip so nothing is covered**, overlay mode | **Ahead**: AppBar is the only structural answer in this list; smart per-app avoidance is still missing → Codex |
| Fullscreen behaviour | Hides in full screen (`hideFullscreen` setting) in both modes | **Equal** (PILLAR also hides) |
| File shelf (drag and drop) | Shelf panel, drag out, image actions | **Equal**; Droppy's jiggle basket and Tomte's "drag a file to the top edge" are missing → Codex (drag detection) |
| Clipboard history | Text-only, memory-only, pinning | **Equal** (Droppy adds OCR; we stay text-only by privacy rule) |
| Focus/Pomodoro timer | Focus / Break / Timer / Stopwatch, ring, native timer surviving panel close | **Equal** |
| Synced lyrics | Lyrics strip under the island | **Equal** |
| Claude/Codex approvals and usage limits | None | **Behind**; high value, but needs a local hook channel (a new port/socket) → **Codex + security review**, locked by default (CLAUDE.md privacy rule) |
| Calendar with "Join meeting" | iCal feed, Join button on peek and list, resting pill before a meeting | **Equal** (already built) |
| Charging animation | One-shot bolt pop and glow on plug-in (this PR), plug/unplug peek, ETA, "unplug at 80 %" tip | **Equal → Ahead** after this PR |
| Volume / brightness overlays | Brightness slider and volume buttons in the system panel; no pop-up HUD | **Behind** → Codex (needs a system volume/brightness change event) |
| Unsigned-app / antivirus warnings | NSIS installer and ZIP in review (T16); **signing not decided** | **Behind** until signed → Walid/Codex, not UI |
| Battery drain | Native idle host, no Electron while idle, Eco mode, live RAM panel | **Ahead** on paper; the new eyes feature is opt-in and cost-designed for this reason |
| Hard-to-find settings | Settings now also reachable from a gear in the footer of **every** expanded panel (this PR), plus tray, clock-panel tile, calendar empty state; section navigator inside Settings | **Behind → fixed** |

**Where Islandly is clearly different (not matched by anything found):** Arabic-first UI with complete RTL; prayer times, Hijri calendar and Quran player; **two placement modes** (overlay and AppBar); the lowest documented idle footprint with measured numbers (`docs/perf.md`).

## Re-ranked improvement plan (by user value to the requester's list)

| Rank | Item | Why | Status / owner |
|---|---|---|---|
| 1 | Covering tabs/menus and fullscreen | Top complaint; AppBar + auto-hide already answer it, now explained better (Settings preview shows the reserved strip) | Done (UI). **Smart avoidance per app: Codex** |
| 2 | Unsigned / antivirus warnings | Top complaint; blocks installs | **Codex + Walid** (signing decision, T16) |
| 3 | Settings findable | Complaint; cheap | **Done:** footer gear on every panel + navigator (T19) |
| 4 | Claude/Codex approvals + usage limit | Most distinctive new request; macOS-only today, so a first on Windows | **Codex** (hook socket, locked by default, security review); UI panel afterwards |
| 5 | Charging animation | Requested, small | **Done** (T19) |
| 6 | Volume/brightness HUD | Requested | **Codex** (system change events) |
| 7 | Drag-to-top-edge / jiggle shelf | Tomte, Droppy | **Codex** (global drag detection) |
| 8 | Floating mode, liquid expand, idle eyes | Polish and personality, battery-safe if opt-in | **Spec + prototype done** (`docs/MOTION_SPEC.md`); native → **Codex** |
| 9 | Focus timer, join meeting, lyrics, shelf, clipboard | Already built | none |

## Sources (update 2)

9. Free Windows islands in the search results: https://github.com/rajsriv/dynamic-island-for-windows, https://alternativeto.net/software/winisland/about/, https://toolradar.com/tools/isle-notch
10. Tomte (Product Hunt): https://www.producthunt.com/products/tomte
11. Nusa Dynamic Island (touchit.sk): https://touchit.sk/dynamic-island-po-vzore-ios-je-tu-aj-pre-windows/933565/
12. Notchzy listing: https://huntscreens.com/products/notchzy
13. Claude Code/Codex notch apps: https://dev.to/krisying/i-turned-my-macbooks-notch-into-a-control-center-for-ai-coding-agents-2o57, https://vibeisland.app/claude-code/, https://github.com/Kumario1/agentNotch, https://github.com/rutmehta/Atoll, https://claudepulse-5bw.pages.dev/, https://raw.githubusercontent.com/ericjypark/codex-island/main/README.md
14. Droppy: https://iordv.gumroad.com/l/Droppy, https://www.producthunt.com/products/droppy-4
15. Isle / Islet: https://alternativeto.net/software/isle/about/, https://www.hunted.space/product/islet-2
16. DynamicNotch and other Mac notch apps: https://github.com/jackson-storm/dynamicnotch, https://www.bgr.com/tech/this-app-transforms-your-macbook-notch-into-a-useful-dynamic-island/
17. DynamicLake: https://alternativeto.net/news/2025/5/dynamiclake-introduces-support-for-facetime-iphone-calls-in-the-dynamic-island-and-more

# T20 UI review (Claude, for Codex): PR #24 `codex/T20-laptop-fixes` @ ac6b06f

Date 2026-10-30. Scope: the 24 screenshots and `geometry.json` in `dev/t20/` on that head (I extracted and looked at the four "after" renders at 100 % — Arabic/English × overlay/AppBar — and read all 12 "after" rows of `geometry.json`), checked against `docs/MOTION_SPEC.md` and the visual QA rules. I did **not** open the 125 % / 150 % images pixel by pixel (only their geometry), did not run anything, and changed no code. All renders are Chromium fixtures, as `docs/T20-LAPTOP-FIXES.md` itself says (not Windows acrylic).

## What passes
- No collisions in any of the 12 "after" rows (`collisions: []`, `errors: []`): card 360 × 440, 5 tiles of 72 × 64 on a 12 px grid, dots row 12 px high **below** the tiles, nothing overlaps or crowds.
- Dots are evenly spaced and the active one sits at the **inline-start** in both languages (right in Arabic, left in English), as designed.
- The card is centred in the frame, rounded (≈ 22), tile labels and the date do not clip in either language.

## Findings, most important first

**P1 · The card height is not adaptive.** All 12 renders have the identical 360 × 440 card, and the clock panel (two short tile rows) leaves about **100 px of empty space** between the tiles and the dots (y ≈ 320 → 420). "Taller-narrower with adaptive width" is only half shown: the narrower, taller shape is there, but nothing adapts to content in these artifacts. Ask: size the card to its measured content with a floor and cap (the doc says media may grow to 460, all content caps at 560, clamped to the work area), and show at least a short and a long panel so the adaptation is visible.

**P1 · The artifact set cannot prove most of the QA rules.** Missing: (a) **light theme**, every image is dark; (b) **acrylic vs glass**; (c) **AppBar context**: the overlay and AppBar renders are structurally identical (no reserved strip, no page behind), so the AppBar look is not actually checked; (d) every panel except the **clock** (music, timer, battery, today, clipboard, shelf, calendar, system, notes); (e) the **collapsed pill** (and the eyes, if `idleEyes` lands) and any opening/closing **frames**; (f) the long-content scroll case. Ask: extend `test/t20-visual.cjs` to render panels × light/dark × material × Arabic/English × overlay/AppBar, with a page behind and the AppBar strip, at 100/125/150 %, and keep the same geometry audit.

**P2 · MOTION_SPEC constants are now out of date (my side).** The spec's liquid expand assumes a 440 × 200 card (`W = 138 + 302f`, `H = 36 + 164f`). T20's default is **360 × 440**, content-sized up to 460/560. Until I update the spec, do **not** copy those two formulas into the native host. Interim rule so work is not blocked: `W = 138 + (cardW − 138)·f`, `H = 36 + (cardH − 36)·f` with the card size from the measured panel, and **keep the droplet `bulge` gain at an absolute 164 px** (not scaled by the new height; a ×2 taller card would otherwise give a ≈ 2× bigger droplet). The lobe width and the 12 px screen-edge clamp stay as written. Once the real size is only known when the panel reports ready, animate to the default 360 × 440 and ease to the measured size over 120 ms.

**P2 · Arabic header is unbalanced.** In the Arabic renders the large time (22:39 and its seconds) sits at the **physical left** while the date lines are right-aligned, so the time block is not at the inline-start the way the dots, tiles and date are. In English both start on the left, so only Arabic looks off. Ask: put the time block at the inline-start (right) in RTL, keeping the digits themselves left-to-right.

**P3 · Footer gear and eyes are not in this branch.** PR #24 is based on `codex/T19-contracts`, which does not contain my T19 UI (settings gear at the end of the dots row, charging animation). When both land, re-check that the gear (20 px, 12 px from the inline-end) does not touch the 10-dot row at the new 360 px width; today the dots row is about 130 px wide and centred, so it should clear it by ~100 px, but that is arithmetic, not a render.

**P3 · Small text.** Tile labels are about 11 px and muted; in Arabic ("الإعدادات") they are small for the language. Ask: 12 px minimum for tile labels, and confirm contrast on the light theme once it is rendered.

## Not verified here
125 % and 150 % pixel review, real Windows acrylic, hover/open/close motion (no frames exist), the other panels, light theme. These need Codex's extended renders before anyone can sign off on the layout.

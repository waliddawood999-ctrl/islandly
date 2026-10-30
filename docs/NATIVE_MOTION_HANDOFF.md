# Native motion hand-off for Codex (T19): eyes, liquid expand, floating mode

From Claude · 2026-10-30 · For `native/**` and `src/main/**` (Codex's area). Source of truth for the *why*: `docs/MOTION_SPEC.md`; this file is the *what to build*, with the numbers copied from it. If the two ever differ, MOTION_SPEC wins and this file is the bug. Prototype to match visually: `dev/t19/prototype/index.html` (open in a browser; every control is live). Nothing here was run on Windows; every "measured" number is a simulation in that prototype, every "target" is for you to verify.

Scope guard: no new resident process; Electron stays off while idle; no change to existing IPC contracts. New contract items are only the three in §7.

All sizes are px at scale 1.0; multiply by `scale × DPI/96` (scale default 0.8). Times in ms. Springs are unit-mass: `a = −k·(x−target) − c·v`, stepped in real elapsed time (never per frame count), ≤ 1 ms sub-steps or an exact integrator.

## 1. Idle eyes (setting `idleEyes`, default **false**)

**Where:** the collapsed pill (138 × 36, radius 18) shows `[eyes] [time]`. They replace the green clock dot and only exist when no other compact content owns the pill (timer, media, privacy label, low battery).

| Item | Value |
|---|---|
| Eye | one **solid capsule 13 × 26**, radius 6.5, **no pupil, no outline** |
| Tilt | **−11°** (top leans left), both eyes parallel, **identical in LTR and RTL** |
| Centres | **22 apart**; group bounding box ≈ 40 × 28 (78 % of the height; 4 px free above/below at rest) |
| Gap eyes ↔ time | ≥ **16** at rest, ≥ **11** at the extreme gaze |
| Colours | dark island **#F7F8FC**; light island **#0C0C12** (follows the island's light/dark tint, same rule as the time text) |
| Fixed place | the eyes **never move or swap sides**. Only the gaze shifts inside the same spot |

**Gaze.** One smoothed vector `g ∈ [−1,1]²`:

```
d = cursor − pillCentre;  dist = |d|
s = smoothstep(clamp(dist / 50, 0, 1))
gain = (cursor within 240 px of the pill centre and f < 0.05) ? 1.0 : 0.6      // far: sleepy, but still looks
target = pointerOnScreen ? (d / dist) · s · gain : (0, 0)
g += (target − g) · (1 − exp(−4·dt))        // 4 per second, τ = 250 ms; smooth the vector, never the angle
```
| Output | Formula | Max |
|---|---|---|
| Shift (both eyes) | `x = 4·g.x`, `y = 3·g.y − 0.5·squint` | ±4 px, ±3 px |
| Far-eye squash | far-side eye width × `1 − 0.18·|g.x|` (cursor right → left eye, cursor left → right eye) | **0.82** |
| Foreshortening | both eyes length × `1 − 0.12·|g.y|` | **0.88** |

Reference rows (cursor from pill centre, after 2 s): left (−170,0) → shift (−4, 0), right eye 0.82 · right (+170,0) → (+4, 0), left eye 0.82 · below-left (−120,+85) → (−3.3, +1.7), far eye 0.85, length 0.93 · below-right → (+3.3, +1.7) · directly below (0,+95) → (0, +3), length 0.88. Response to a jump: 33 % at 100 ms, 63 % at 250 ms, 86.5 % at 500 ms, 98 % at 1 s. The gaze angle must equal the cursor angle within **4°**, near and far.

**States**
| State | Condition | Lid | Notes |
|---|---|---|---|
| Awake | cursor < 240 px | 0 | blink every **3–4 s** (random), 280 ms |
| Sleepy | cursor ≥ 240 px or left the screen | → **0.54** (τ 220 ms; waking τ 70 ms) | lid = the upright slot clipped from the **top** by `lid × slot height` (30), so the cut is horizontal on screen; length × `1 − 0.1·lid/0.54`; same place, no droop; gaze at 60 %; blink every 8–14 s, 380 ms |
| Happy squint | pointer on the pill | 0 | width × `1 + 0.1·e`, length × `1 − 0.4·e`, y −0.5·e; `e` eases with τ 90 ms |
| Blink | timer | | the *filled* eye narrows to **10 % of its width** (1.3 px, solid, not an outline) and back: close **40 %** of the duration (ease-in, quadratic: `c = (u/0.4)²`), hold to **48 %**, open the last **52 %** (ease-out: `c = (1 − (u−0.48)/0.52)²`); `width = 1 − 0.9·c`; multiplies with squash/squint |
| Hidden | fullscreen app, Eco (`eco:changed`), Motion Off, `idleEyes` false, island opening (f > 0.05), other compact content | | the green clock dot returns; **no timers** |
| Reduced | Motion Reduced | 0 | static open eyes, resting tilt, no gaze/blink/lid |

Clip the lid with a geometry/layer clip (not an overlay) so acrylic and glass show through.

**Cost rules (targets, not measured):** no hook, no raw input. `GetCursorPos` on a coalescable timer: **10 Hz** while visible and idle, **30 Hz** only while the cursor moved in the last 1.5 s or `|g − target| > 0.02`, 0 when hidden. Repaint only the eyes' dirty rect (≈ 44 × 32) and only when `g` changed ≥ 0.02 or the lid/blink changed. Budget: idle ≤ 0.05 % CPU, mouse moving ≤ 0.5 % of one core.

## 2. Liquid expand / collapse

Two springs, both with target 1 (open) or 0 (closed). Never reset position or velocity when the target flips (that is what makes it interruptible).

| Spring | k | c | ζ | Result (*sim*) |
|---|---|---|---|---|
| BODY `f` | 520 | 40 | 0.88 | 50 % at **68 ms**, within 2 % at **198 ms** |
| DROP `d` | 900 | 28 | 0.47 | peak **1.188**, within 2 % at **274 ms** |

Per frame, with `a` = anticipation (0…0.10):
```
W = 138 + (cardW − 138)·f      H = 36 + (cardH − 36)·f      R = 18 + 4·clamp(f,0,1)
bulge = max(0, d + a − f) · 164                       // ABSOLUTE 164 px gain, not scaled by cardH; the one tuning knob
left  = clamp(cx − W/2, 12, screenW − 12 − W)         // cx = pill centre; left/right positions therefore grow inward
wl    = min(0.30·W, W/2 − R − 4)                      // lobe half-width
path  = rounded rect (W×H, R), bottom edge replaced when bulge > 0.5 by
        H cx+wl  C cx+0.5wl,H  cx+0.55wl,H+bulge  cx,H+bulge  C cx−0.55wl,H+bulge  cx−0.5wl,H  cx−wl,H  H R
```
Use this one `ID2D1PathGeometry` for the visible shape **and** mirror it into `SetWindowRgn` (hit-test and acrylic clip; 0.064 ms per update measured by T15). Do not use blur-and-threshold "gooey" filters: they make acrylic opaque.

**Card size.** `cardW × cardH` = the panel's size: default **360 × 440** (T20), content-sized up to 460 and capped at 560, clamped to the work area. Animate to the default; when the measured size arrives (`panel:ready`) **ease to it over 120 ms** (τ 40 ms), do not restart the springs.

Keyframes (opening, Full, *sim*; `f`, `d`, `bulge` are valid for any card, **width/height columns are for the old 440 × 200 card**: recompute them with the formulas above): 
| t ms | f | d | bulge px | width | height |
|---|---|---|---|---|---|
| 0 | 0 | 0 | 0 | 138 | 36 |
| 16 | 0.058 | 0.105 | 7.7 | 155 | 45 |
| 33 | 0.189 | 0.353 | 26.8 | 195 | 67 |
| 50 | 0.344 | 0.638 | 48.3 | 242 | 92 |
| 67 | 0.493 | 0.888 | 64.9 | 287 | 117 |
| 83 | 0.615 | 1.058 | **72.5 (peak)** | 324 | 137 |
| 100 | 0.723 | 1.158 | 71.4 | 356 | 155 |
| 133 | 0.867 | 1.170 | 49.7 | 400 | 178 |
| 166 | 0.944 | 1.073 | 21.2 | 423 | 191 |
| 200 | 0.982 | 0.990 | 1.4 | 435 | 197 |
| 250 | 1.000 | 0.968 | 0 | 440 | 200 |

Closing uses the same springs toward 0 (body within 2 % at 198 ms, droplet absorbed by 274 ms). Reversing at 100 ms keeps `|Δf| ≤ 0.0069 per ms` and undershoots by ≤ 0.002 (0.3 px).

**Trigger.** Halo = pill rect **+20 px** each side (alpha 1/255 pixels so the layered window is hit-testable; or `TrackMouseEvent` on the enlarged rect; **no polling, no hook**). Within **48 px** the DROP target rises linearly to **0.10** (a 16 px swell, Full only). **Dwell 120 ms** in the halo → open and start the panel launch in parallel (today 280). **Leave grace 200 ms** outside the card rect + 16 px → close.

**Content.** Collapsed label (time/eyes) opacity `1 − f/0.25`; card content opacity `clamp((f − 0.30)/0.50)` and scale 0.97 → 1, **clipped by the same path**.

**Hand-off to Electron (the panel needs 0.8–1.3 s).** The host owns the animation: draw a **native placeholder card** (shape + big time + date, no web content); when the panel reports ready (§7) show the web window exactly over the card's region and cross-fade the placeholder out over **120 ms**. If the pointer leaves first, reverse and cancel/close the launch.

| Motion setting | Behaviour |
|---|---|
| Full | as above |
| Reduced / Eco | `f` follows a **120 ms ease-out** (τ 40 ms): no DROP, no anticipation, no overshoot, no placeholder cross-fade |
| Off | instant size change, no animation frames |

## 3. Floating mode (setting `floating`, default **false**; works with overlay and AppBar)

| Property | Flush (today) | Floating |
|---|---|---|
| Gap to the screen top | 8 | **14** |
| Pill | 138 × 36, radius 18 | same; radius = height/2 |
| Side margin (left/right position) | 16 | **20** (center unchanged) |
| Edge | inner white line α 0.10–0.14, 0.5 px | same + **2 px outer ring α 0.06** |
| Shadow | none | two layers: **y 2, blur 3, α 0.30** and **y 14, blur 14, α 0.38** (black) |
| AppBar strip height | 44 | **58** (14 + 36 + 8) |

Shadow, two tiers (you choose; start with Tier 1): **Tier 1** inner highlight + outer ring only, drawn inside the region, no extra window. **Tier 2** one click-through layered window directly behind the island (`WS_EX_LAYERED|WS_EX_TRANSPARENT|WS_EX_NOACTIVATE`, same thread, **not a process**) carrying a pre-blurred shadow bitmap baked on size change only (scaled during B, re-baked once at rest); destroy/hide it with the island and in fullscreen.

**Drag and snap: not specified by MOTION_SPEC and not in the contract today (position is the 3-way setting `position`).** Proposal, needs Walid's decision before anyone builds it: no free dragging in this task; floating keeps the three anchors; if dragging is wanted later, release snaps to the nearest anchor (left/center/right, margin 20) with the BODY spring (k 520, c 40), the new anchor is written to the existing `position` key, and a drag never starts a panel launch.

## 4. RTL / LTR mirroring rules
1. **Mirrored by language direction only:** the order inside the pill (`[eyes][time]` in LTR, eyes at the **inline-start = right** in RTL, time to their left) and logical content inside the card.
2. **Never mirrored:** eye shape, the −11° tilt, the gaze (it is physical: cursor on the left → eyes look left in both languages), the droplet path (symmetric), `position` left/right (physical screen sides), spring values.
3. The card clamps to **12 px** from the screen edge in both directions; left/right positions therefore grow inward.
4. Digits: Latin by default; Arabic-Indic only when the existing `digits` setting says so (`10:42` is drawn left-to-right inside its own box).

## 5. Frame and input targets (to be measured by you)
- **60 fps** during a 330 ms open/close: every frame **≤ 16.6 ms wall, ≤ 2 ms CPU**; at 144 Hz step by elapsed time, not frame count; the frame loop (`DwmFlush`-synchronised short-lived thread, or an 8 ms timer fallback) exists **only while a spring moves** and is released at rest.
- **Input → first changed frame ≤ 50 ms** for: pointer entering the halo (anticipation swell), pointer entering the pill (squint), Motion/Eco/fullscreen changes (eyes hidden). Hover open must show the first droplet frame within 50 ms of the 120 ms dwell ending.
- **Gaze: cursor sample → pixels ≤ 50 ms while the cursor is moving** (30 Hz period 33 ms + a tiny repaint). **Known tension:** from a fully idle cursor the 10 Hz base poll can take up to **100 ms** to notice the first movement. Measure it; if that feels late, raise the base to 20 Hz (50 ms) and record the CPU cost.
- Idle (eyes hidden or `idleEyes` false): zero new timers; the global guards stay (RAM < 180 MB, CPU < 1 %, no Electron while idle).

## 6. Screenshots your build must match
Compare structure and numbers, not anti-aliasing: positions within **±1 px at 100 % DPI** (±2 px at 150/200 %), colours exact, no overlap/clip. Reference images are committed in `dev/t19/sheets/`; re-render the prototype's version of any shot with `node dev/t19/prototype/shots.mjs && python3 dev/t19/prototype/sheets.py`.

| # | Must match | Reference file | Also run |
|---|---|---|---|
| 1 | Gaze: cursor left, right, below-left, below-right, directly below; dark + light; Arabic + English | `motion-C-gaze-overlay.png`, `-appbar.png`, `-floating.png` | far cursor: `motion-C-gaze-*-far.png` (sleepy lids, same angle) |
| 2 | Eye states: rest, blink (10 % line), sleepy (flat-topped), squint, Reduced static, hidden in Eco/fullscreen/Off | `motion-C-states.png`, `motion-C-timelines.png`, GIFs `motion-C-eyes-*.gif` | |
| 3 | Liquid expand/collapse frames at 0/30/60/100/150/260 ms, the reversal, and the open card | `motion-B-en.png`, `motion-B-ar.png`, `motion-B-light.png` | Reduced/Off: `motion-B-positions-reduced-off.png`; GIFs `motion-B-*.gif` (×5 slow motion) |
| 4 | Floating look: gap 14, ring, shadow, AppBar strip 58, left/center/right | `motion-B-*` floating rows, `motion-B-positions-reduced-off.png` | acrylic **and** glass, overlay **and** AppBar |
| 5 | The approved style boards | `dev/t19/concept-eyes/v2-board-*.png` | |

Matrix for each screenshot you add to your PR: **Arabic RTL and English LTR × dark and light × overlay and AppBar × acrylic and glass × 100/150/200 % DPI**, one primary monitor and one secondary. Report what you did **not** run, per `AGENTS.md` (real Windows vs CI runner vs manual).

## 7. Contract and test requests (the only new interfaces)
1. Settings keys (HANDOFF §1): **`floating`** bool default `false`, **`idleEyes`** bool default `false`; broadcast with `settings:update`.
2. A **`panel:ready`** signal from the Electron panel to the host (for the placeholder cross-fade).
3. Perf guard (`test/ci-native-perf.ps1`): `liquid-open` (300 ms CPU, frame time ≤ 2 ms) and `eyes-idle | eyes-moving | eyes-hidden` (CPU, wake-ups/s).
Claude will add the two Settings switches (floating, idle eyes) and the preview look the moment the keys exist; the Settings copy (ar/en) is in MOTION_SPEC §5.

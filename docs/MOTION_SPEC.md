# Motion spec: A Floating mode, B Liquid expand, C Idle eyes (T19)

Author: Claude · 2026-10-29 · Status: **design + HTML prototype only.** Native implementation is Codex's (`src/main/**`, `native/**`). Nothing here changes a contract: the keys and events it needs are *requests* listed in §6 and in `docs/HANDOFF.md`.

Prototype: `dev/t19/prototype/index.html` (open it in any browser; `?lang=ar|en&theme=dark|light&mode=overlay|appbar|floating&pos=left|center|right&material=acrylic|glass&motion=full|reduced|off&eco=1&fullscreen=1&eyes=0`; the control strip under the island switches everything live). Frames and GIFs: `dev/t19/sheets/motion-*.png|gif` (gaze boards: `motion-C-gaze-{overlay,appbar,floating}.png` and `-far.png`). Re-render and audit: `node dev/t19/prototype/shots.mjs && python3 dev/t19/prototype/sheets.py`. The idle-eyes concept boards that were approved are in `dev/t19/concept-eyes/`.

**What is measured and what is not.** Every number marked *sim* comes from running the prototype's spring integrator with a manual 1 ms clock (so it is exact for the maths, not a measurement of Windows). Everything marked *budget* or *est.* is a design target for Codex to verify with the existing perf guard (`docs/perf.md`); no native code was written or run for this spec.

## 0. Baseline this spec starts from (read from the repo)

| Fact | Where | Consequence |
|---|---|---|
| The idle island is a WinForms/GDI+ host window; the pill is **138×36 px × scale × DPI** (scale default 0.8, 0.5–2), sliver 84×5, top gap **8 px × scale**, side margin **16 px** for left/right, shape = `SetWindowRgn` rounded rect | `native/Islandly.cs` `Position()` | Overlay is already "detached by 8 px"; A below is a *style* on top of that, not a new window kind |
| Hover opens a panel after a **280 ms dwell**; a 1 Hz ticker is the only idle timer | `native/Islandly.cs` (`hoverDwell`, `ticker`) | No cursor polling exists today: B and C must not add a busy loop |
| Expanded panels are Electron windows started on demand; **cold open 775–1306 ms**, first packaged open 1304 ms | `docs/perf.md` | A 250 ms liquid animation cannot be driven by the panel. The **host animates a placeholder shape first** (§3.6) |
| Region update cost measured at **0.064 ms** mean on a real HWND | `docs/HANDOFF.md` (T15) | Re-clipping every frame for 250 ms is affordable |
| Idle budget: RAM < 180 MB, CPU < 1 %; measured idle ≈ 40 MB / 0.4 % on the CI runner | `docs/perf.md` | The spec adds **no new timer** for A and B (they run only while animating); the opt-in eyes use a **10 Hz coalescable timer while visible** (§4.5) and nothing at all while hidden/Eco/Off |
| Settings: `motion` full/reduced/off, `ecoMode`, `eco:changed` (effective Eco) | HANDOFF §1/§2 | B and C obey these; Eco is treated as Reduced for B and **Off** for C |

Units: all sizes below are **px at scale 1.0**; multiply by `scale × DPI/96`. Times are ms. Colours are the existing palette (`--accent #a78bfa`, `--green #34d399`).

## 1. Shared definitions

**Springs** are unit-mass damped springs, semi-implicit Euler in ≤1 ms slices; native: step in real elapsed time: `a = −k·(x−target) − c·v`.

| Spring | k | c | ζ (damping ratio) | Behaviour | sim |
|---|---|---|---|---|---|
| **BODY** (rounded box) | 520 | 40 | 0.88 | one soft approach, ~0.2 % overshoot | 50 % at **68 ms**, within 2 % at **198 ms** |
| **DROP** (droplet lead) | 900 | 28 | 0.47 | leads the body, overshoots **+19 %**, returns | 50 % at 42 ms, peak **1.188**, within 2 % at **274 ms** |

**Motion modes**

| Setting | A Floating | B Liquid expand | C Idle eyes |
|---|---|---|---|
| **Full** | static style | BODY + DROP springs, anticipation swell, droplet lobe | live: gaze, blinks, sleepy lids, happy squint |
| **Reduced** (and **Eco**) | static style | BODY replaced by a **120 ms ease-out** (τ = 40 ms), no droplet, no anticipation, no overshoot | **Static** eyes (open, resting tilt, no gaze, no blink) for Reduced; **hidden** in Eco |
| **Off** | static style | instant size change, no frames | hidden |

Eco follows the existing rule "Eco limits Full to Reduced"; C is the only place Eco goes further (hidden), because it is purely decorative.

**RTL.** The shapes are symmetric. Only content order mirrors: in Arabic the collapsed label is `[time] … [eyes]` read from the right, i.e. **eyes at the inline-start (right)**, time after them; card content uses logical start/end exactly like the current panels. Side clamping keeps 12 px from the screen edge in both directions.

**Materials.** Acrylic: the *region* carries the shape, the blur is Windows', the host paints only a dark veil (alpha 0.46, as `html.acrylic #island` does today; the prototype uses 0.62 so the effect is visible on a light page). Glass: opaque `rgba(12,12,15,0.9)` plus the existing top highlight. The droplet must not change the material (no extra window, no alpha pop). The HTML prototype uses `clip-path: path()` for this reason (a CSS `filter`-based metaball would turn translucent acrylic opaque during the move: rejected, see §3.7).

## 2. A. Floating mode

A style, not a window kind. Everything the host already does for overlay/AppBar stays.

| Property | Flush (today) | **Floating** |
|---|---|---|
| Gap to the screen top | 8 | **14** |
| Pill height / radius | 36 / 18 | 36 / 18 (fully rounded: radius = height/2) |
| Side margin for left/right | 16 | **20** (center unchanged) |
| Edge | 0.5 px inner white line α0.10–0.14 | same + **2 px outer ring α0.06** so it reads as an object |
| Shadow | none outside the region | **soft two-layer shadow:** `0 2 3 α0.30` + `0 14 14 α0.38` (y, blur) |
| AppBar strip height (when the mode is AppBar) | 44 | **58** (14 + 36 + 8) so the pill never touches the strip bottom |
| Position | left / center / right | unchanged |

**Shadow cost (important).** A window clipped by `SetWindowRgn` cannot draw outside its region, and a per-pixel-alpha layered window cannot carry the acrylic backdrop. Two tiers, Codex chooses:
- **Tier 1 (no extra window):** inner highlight + outer ring only (drawn inside the region). Looks flat on light pages, zero cost. Recommended first.
- **Tier 2:** one extra **click-through layered window** (`WS_EX_LAYERED|WS_EX_TRANSPARENT|WS_EX_NOACTIVATE`) directly behind the island, same thread, carrying a pre-blurred shadow bitmap (**re-rendered only on size change, not per frame**; while animating B it is scaled with the shape, then re-baked once at rest). It is a window, not a process; it must be destroyed with the island and hidden in fullscreen/hide like it.

Floating works in both Overlay and AppBar. Preview in Settings: the existing preview (`#preview`) gets a third look (bigger gap, shadow) when the switch is on.

## 3. B. Liquid expand

### 3.1 States and trigger

```
Collapsed ──(pointer enters halo)──▶ Approach ──(dwell 120 ms)──▶ Opening ──▶ Open
    ▲                                    │ leave halo                │ pointer leaves card
    └────────────── Closing ◀────────────┴────────────────────────────┘  (grace 200 ms)
```
Any state can reverse into any other: the springs keep their velocity, so reversing is smooth (§3.5).

| Parameter | Value | Note |
|---|---|---|
| Halo | pill rect **+20 px** on every side | invisible hit margin |
| Anticipation | within **48 px** of the pill the DROP target rises linearly to **0.10**, i.e. a **16 px** swell under the pill | Full only |
| Dwell | **120 ms** inside the halo (today 280) | the web panel launch starts here, not at the end of the animation |
| Leave grace | **200 ms** outside the card rect +16 px | hysteresis against flicker |
| Card size | `cardW × cardH` = the panel's size; default **360 × 440** (T20), content-sized, up to 460 and capped at 560 (was 440 × 200) | the real panel height varies; the animation targets the panel's *measured* size once known, else this default |

**No polling for the halo.** The halo is part of the host window: enlarge the window by 20 px per side, paint the extra margin as **alpha = 1/255** (invisible, still hit-testable on a layered window) and use the existing `MouseEnter/MouseLeave`. Idle cost stays zero; `WM_MOUSEMOVE` is delivered only while the pointer is inside. (If the host window stays non-layered, use `TrackMouseEvent` on the enlarged rect: same effect.)

### 3.2 Geometry per frame

With `f` = BODY position (0 collapsed … 1 open) and `d` = DROP position (+ anticipation `a`):

```
W = 138 + (cardW − 138)·f      H = 36 + (cardH − 36)·f      R = 18 + 4·clamp(f,0,1)
bulge = max(0, d + a − f) · 164            // px hanging under the body bottom: ABSOLUTE 164 px gain, independent of cardH
left  = clamp(cx − W/2, 12, screenW − 12 − W)       // cx = pill centre; clamp makes left/right positions grow inward
```
Outline (one closed path, 14 segments): rounded rectangle `W×H` radius `R`; when `bulge > 0.5` the bottom edge is replaced by
`H cx+wl  C cx+0.5wl,H  cx+0.55wl,H+bulge  cx,H+bulge  C cx−0.55wl,H+bulge  cx−0.5wl,H  cx−wl,H  H R`
with lobe half-width `wl = min(0.30·W, W/2 − R − 4)`. This is the exact path the prototype feeds to `clip-path: path()`.

**Measured size.** The real size is only known once the panel reports ready (§3.6). Animate to the default `cardW × cardH` and, when the measured size arrives, **ease to it over 120 ms** (exponential, τ 40 ms) instead of restarting the springs.

> **Update (T20 review):** the sizes below are the card-size-relative form. `cardW × cardH` is the panel's size: default **360 × 440** (T20), content-sized up to 460 and capped at 560, clamped to the work area. The bulge stays an **absolute 164 px gain** (it is not scaled by the card height). The keyframe table further down was computed for the old 440 × 200 card, so only its `f`, `d` and `bulge` columns still apply; recompute width/height with the formulas above.

Content: the collapsed label (time/eyes) fades out over `f ∈ [0, 0.25]`; the card content fades in and scales 0.97→1 over `f ∈ [0.30, 0.80]`, **clipped by the same path** so nothing is ever drawn outside the shape.

### 3.3 Sample frames (*sim*, Full, opening)

| t ms | body f | drop d | bulge px | width px | height px |
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
| 250 | 1.000 | 0.968 | 0 | 440 (old card) | 200 (old card) |
| 300 | 1.002 | 0.995 | 0 | 441 | 200 |

Reading: ~70 % of the size change is done by 100 ms, the droplet is gone by 200 ms, everything is within 2 % by **~275 ms** (the user's "~250 ms" target; the visible motion is ~200 ms). If the droplet feels too strong on a real screen, the single tuning knob is the gain `164` in `bulge` (lower = subtler); do not change the springs.

### 3.4 Closing
Same springs with target 0; the DROP spring leads the body upward, so the droplet is absorbed before the body finishes. Within 2 % at **198 ms** (body) / **274 ms** (drop), *sim*.

### 3.5 Interruptible (*sim*)
Reversing at 100 ms (f = 0.72): the largest frame-to-frame change of `f` stays **0.0069 per ms** (no jump), the body undershoots 0 by **−0.0019** (0.3 px) and ends at 0. Rule for Codex: never reset position/velocity on a target change; only change the target.

### 3.6 Hand-off to the Electron panel (the part that is not CSS)
Because the web panel needs **0.8–1.3 s**, the host owns the whole 250 ms animation:
1. t = 0 (dwell end, 120 ms after entering the halo): host starts B **and** requests the panel (as today, `OpenPanel("expand","hover")`).
2. The host paints a **placeholder card**: the shape plus a cheap native layout (big time, date line; no web content). It stays until the panel reports ready.
3. Panel ready (new event, §6): the web window is shown *exactly over* the card rect (same region), the placeholder cross-fades out over **120 ms**.
4. If the pointer leaves before the panel is ready, B reverses (§3.5) and the pending launch is cancelled or the panel closed immediately (existing idle-shutdown path).
Reduced/Off skip the placeholder cross-fade: the panel appears when ready, the shape just snaps/fades.

### 3.7 Rendering options (all inside the existing host process)
- **Target:** Direct2D path geometry on a DirectComposition/swap-chain surface, one `ID2D1PathGeometry` rebuilt per frame (14 segments); mirror the outline into `SetWindowRgn` for hit-testing and the acrylic clip (0.064 ms/update measured by T15).
- **Interim, no rewrite:** keep the GDI+ `Region` path: `GraphicsPath` from the same 14 segments → `Region` per frame + invalidate; fine for 250 ms bursts.
- **Rejected:** SVG/CSS "gooey" blur+threshold filters (what many web demos use): they cost a full-surface filter per frame and quantise alpha, so acrylic turns opaque mid-animation.
- **Loop:** drive frames from a short-lived thread blocking on `DwmFlush()` (or a `WM_TIMER` at 8 ms as fallback) **only while any spring is moving**; stop and free it at rest. Frame budget **≤ 2 ms CPU/frame** (*budget*); a full open is ≈ 17 frames at 60 Hz (≈ 34 ms CPU, *est.*), idle cost 0.
- 144 Hz: step in real elapsed time, not frame count.

## 4. C. Idle eyes (style approved by Walid: concept v2; gaze fix applied)

### 4.1 Where and when
In the collapsed pill, **eyes + time** (confirmed): `[eyes] [time]`, mirrored in Arabic (eyes at the start, on the right) with the **same eye shape and the same tilt in both directions**. The eyes replace the green clock dot. They show only when no other compact content owns the pill (timer, media, privacy label, low battery). **Hidden** (the dot comes back) in: fullscreen, Eco, Motion Off, `idleEyes` false, while the island opens (f > 0.05). **Reduced:** static open eyes at the resting tilt (no gaze, no blink, no lid).

### 4.2 Shape (px at scale 1; × scale × DPI)
| Part | Spec |
|---|---|
| Eye | one **solid capsule 13 × 26**, fully rounded ends (radius 6.5), **no pupil, no outline** |
| Resting tilt | **−11°** (top leans left), both eyes parallel; the same in LTR and RTL |
| Two eyes | centres **22 apart**; the group's bounding box is ≈ **40 × 28** (78 % of the 36 px height; 4 px free above and below at rest) |
| Eyes ↔ time | **≥ 16 px** at rest, **≥ 11 px** at the extreme gaze (checked by the audit); the eyes never swap sides or approach the time |
| Colour | dark island: `#f7f8fc`; light island: `#0c0c12` (near-black, strong contrast); the light/dark choice follows the island's tint exactly like the text does (`on-light`) |
| Lid (sleepy) | not an overlay: the upright slot of each eye is **clipped from the top** by `lid × slot height`, so the cut edge is horizontal on screen and any material shows through |

### 4.3 The gaze (obvious, 2-D, continuous angle; the eyes never change place)
**The eyes stay fixed**: same two spots in the bar, same side of the time always (mirrored only by language direction), same −11° tilt, no lean. The gaze is a **small shift of a few pixels inside each eye's own spot**, plus a slight squash of the far-side eye for direction. One smoothed vector **g ∈ [−1,1]²** drives it, so the parts cannot disagree.

```
d   = cursor − pillCentre            dist = |d|
s   = smoothstep(clamp(dist / 50, 0, 1))              // full strength after 50 px
gain = awake ? 1.0 : 0.6                              // awake: cursor within 240 px of the pill centre
target = (d / dist) · s · gain                        // the real angle, always, near or far; 0 if the pointer left the screen
g += (target − g) · (1 − exp(−4·dt))                  // 4 per second: time constant 250 ms; vector smoothing, so the angle never jumps at ±180°
```
| Derived value | Formula | At full gaze |
|---|---|---|
| Gaze shift (both eyes, same amount) | `x = 4·g.x`, `y = 3·g.y − 0.5·squint` | up to **±4 px** sideways, **±3 px** up/down |
| Far-eye squash | the eye on the far side gets width `1 − 0.18·|g.x|` (cursor right: the left eye; cursor left: the right eye) | **0.82** |
| Foreshortening | both eyes get length `1 − 0.12·|g.y|` | **0.88** looking straight down/up |
| Tilt, position of the group | **fixed**: −11°, the same spot | none |

*sim*, the five requested positions (cursor measured from the pill centre; gaze after 2 s):

| Cursor | g | gaze shift | far-eye width | length |
|---|---|---|---|---|
| left (−170, 0) | (−1.00, 0) | **−4 px**, 0 | right eye 0.82 | 1.00 |
| right (+170, 0) | (+1.00, 0) | **+4 px**, 0 | left eye 0.82 | 1.00 |
| below-left (−120, +85) | (−0.82, +0.58) | −3.3 px, **+1.7 px** | right eye 0.85 | 0.93 |
| below-right (+120, +85) | (+0.82, +0.58) | +3.3 px, **+1.7 px** | left eye 0.85 | 0.93 |
| directly below (0, +95) | (0, +1.00) | 0, **+3 px** | both 1.00 | **0.88** |

Gaze accuracy (checked in every theme × language × mode of the QA run): the angle of **g equals the angle to the cursor within 4°**, including far positions (330 px away), where the magnitude is 0.60 and the lids are sleepy. Glide response to a cursor jump from below to the right (*sim*): 33 % of the way at 100 ms, **63 % at 250 ms**, 86.5 % at 500 ms, 98.2 % at 1 s.

### 4.4 States
| State | Condition | Lid | Gaze | Blink |
|---|---|---|---|---|
| **Awake** | cursor within 240 px | 0 | full (above) | auto, every **3–4 s**, **280 ms** |
| **Sleepy** | cursor farther than 240 px, or left the screen | eases to **0.54** (τ 220 ms; wakes with τ 70 ms): flat-topped, half-closed filled eyes in the same spot, 10 % shorter | still follows the angle at 60 % (or rests at the centre if the pointer left) | slow, every **8–14 s**, 380 ms |
| **Happy squint** | pointer on the pill | 0 | as awake, fades out | eyes become 1.1 × wider and **0.6 ×** as long (τ 90 ms), nudged up 0.5 px |
| **Blink** | timer | | | the *filled eye itself* narrows to **10 % of its width** (1.3 px, still solid) and back: close 40 % of 280 ms (ease-in, quadratic), hold 8 %, open 52 % (ease-out); blink and gaze combine by multiplication |
| **Hidden** | fullscreen, Eco, Motion Off, `idleEyes` false, opening, other compact content | | | |

### 4.5 Cost design (the battery-drain complaint is the main risk)
- **No hook, no raw input.** A low-level hook or raw-input sink wakes the host on every mouse move and is what antivirus products flag. The host instead reads `GetCursorPos` on a **coalescable timer**: **10 Hz** while the eyes are visible and idle, **30 Hz** only while the cursor has moved in the last 1.5 s or the gaze is still converging (|g − target| > 0.02), nothing at all while hidden.
- Gaze must *track continuously* (also below the bar and far away), so there is no "far = 2 Hz" mode any more; far tracking uses the same 10 Hz baseline, and the 250 ms smoothing interpolates between samples while the 30 Hz frame timer runs.
- **Repaint only on change:** the eyes' dirty rectangle is ≈ **44 × 32 px**; skip the repaint when g moved < 0.02 (≈ 0.15 px of travel) and the lid/blink did not change.
- Blink timers are one-shot (random interval); cancelled when hidden. When hidden, no timers beyond the existing 1 Hz ticker.
- *Budget (to be measured, not measured):* resting/idle ≤ 0.05 % CPU, while the user moves the mouse ≤ 0.5 % of one core, hidden 0; the global **< 1 %** and **< 180 MB** guards stay. Add `eyes-idle`, `eyes-moving`, `eyes-hidden` cases to the native perf guard.
- **Default: `idleEyes = false`** (opt-in).

## 5. Settings UI (design; not wired, see §6)
Appearance section, under "Windows under the island": 

| Control | Type | ar | en | Hint (en) |
|---|---|---|---|---|
| `floating` | switch | جزيرة عائمة | Floating island | Detaches the island from the top edge with a soft shadow. Works with both modes. |
| `idleEyes` | switch | عينان عند الخمول | Idle eyes | Two small eyes look at your cursor when the island is resting. Off in full screen, in Eco and when motion is off. |

The Settings preview already renders material × mode × size × position; it gains the floating look and an eyes glyph. Both rows follow the T19 switch style, and `idleEyes` is shown disabled with the existing amber note when Eco/Motion Off applies ("Eco is on" style, like `settings.motion.ecoLimit`).

## 6. Requests to Codex (contract changes, none made here)
1. Settings keys (HANDOFF §1): **`floating`** boolean, default `false`; **`idleEyes`** boolean, default `false`. Broadcast with `settings:update` like the others; host reads them in `Position()`/paint.
2. Host: B animation, halo, anticipation, placeholder card, §3.6 hand-off; A style (+ AppBar strip 58); C eyes with the gaze model in §4.3 and the cost design in §4.5.
3. Event **`panel:ready`** (or equivalent) from the Electron panel to the host for the cross-fade; today the host only knows "launched".
4. Perf guard: new cases `liquid-open` (CPU during 300 ms, frame time ≤ 2 ms) and `eyes-idle/moving/hidden` (CPU, wakeups/s) in `test/ci-native-perf.ps1`.
5. Manual Windows check list (never claimed from CI): 100/150/200 % DPI, two monitors, AppBar mode, acrylic vs glass, 60/144 Hz, RTL position clamp, fullscreen hide.

## 7. Limits of the prototype
HTML springs are the same maths but run in Chromium; the eyes' gaze shift and squash are CSS transforms of two `<i>` capsules, not Direct2D shapes; the droplet outline is a CSS path, not Direct2D; acrylic is `backdrop-filter`; screenshots/GIFs are produced on a manual clock (GIFs are slowed ×5: 8 ms of animation per 40 ms frame), so they show shape, not real-time feel. No real-device timing, power or GPU measurement exists for any of A–C.

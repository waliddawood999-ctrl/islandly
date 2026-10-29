# Motion spec: A Floating mode, B Liquid expand, C Idle eyes (T19)

Author: Claude · 2026-10-29 · Status: **design + HTML prototype only.** Native implementation is Codex's (`src/main/**`, `native/**`). Nothing here changes a contract: the keys and events it needs are *requests* listed in §6 and in `docs/HANDOFF.md`.

Prototype: `dev/t19/prototype/index.html` (open it in any browser; `?lang=ar|en&mode=overlay|appbar|floating&pos=left|center|right&material=acrylic|glass&motion=full|reduced|off&eco=1&fullscreen=1&eyes=0`; the control strip under the island switches everything live). Frames and GIFs: `dev/t19/sheets/motion-*.png|gif`. Re-render and audit: `node dev/t19/prototype/shots.mjs && python3 dev/t19/prototype/sheets.py`.

**What is measured and what is not.** Every number marked *sim* comes from running the prototype's spring integrator with a manual 1 ms clock (so it is exact for the maths, not a measurement of Windows). Everything marked *budget* or *est.* is a design target for Codex to verify with the existing perf guard (`docs/perf.md`); no native code was written or run for this spec.

## 0. Baseline this spec starts from (read from the repo)

| Fact | Where | Consequence |
|---|---|---|
| The idle island is a WinForms/GDI+ host window; the pill is **138×36 px × scale × DPI** (scale default 0.8, 0.5–2), sliver 84×5, top gap **8 px × scale**, side margin **16 px** for left/right, shape = `SetWindowRgn` rounded rect | `native/Islandly.cs` `Position()` | Overlay is already "detached by 8 px"; A below is a *style* on top of that, not a new window kind |
| Hover opens a panel after a **280 ms dwell**; a 1 Hz ticker is the only idle timer | `native/Islandly.cs` (`hoverDwell`, `ticker`) | No cursor polling exists today: B and C must not add a busy loop |
| Expanded panels are Electron windows started on demand; **cold open 775–1306 ms**, first packaged open 1304 ms | `docs/perf.md` | A 250 ms liquid animation cannot be driven by the panel. The **host animates a placeholder shape first** (§3.6) |
| Region update cost measured at **0.064 ms** mean on a real HWND | `docs/HANDOFF.md` (T15) | Re-clipping every frame for 250 ms is affordable |
| Idle budget: RAM < 180 MB, CPU < 1 %; measured idle ≈ 40 MB / 0.4 % on the CI runner | `docs/perf.md` | Spec adds **no resident timer faster than 2 Hz** and nothing at all while hidden/Eco/Off |
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
| **Full** | static style | BODY + DROP springs, anticipation swell, droplet lobe | live: tracking, blinks, sleepy state |
| **Reduced** (and **Eco**) | static style | BODY replaced by a **120 ms ease-out** (τ = 40 ms), no droplet, no anticipation, no overshoot | A **static** pair of eyes (open, pupils centred) for Reduced; **hidden** in Eco |
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
| Card size | 440 × 200 (the real "today" panel is 440 × 201, r 22) | the real panel height varies; the animation targets the panel's *measured* size once known, else this default |

**No polling for the halo.** The halo is part of the host window: enlarge the window by 20 px per side, paint the extra margin as **alpha = 1/255** (invisible, still hit-testable on a layered window) and use the existing `MouseEnter/MouseLeave`. Idle cost stays zero; `WM_MOUSEMOVE` is delivered only while the pointer is inside. (If the host window stays non-layered, use `TrackMouseEvent` on the enlarged rect: same effect.)

### 3.2 Geometry per frame

With `f` = BODY position (0 collapsed … 1 open) and `d` = DROP position (+ anticipation `a`):

```
W = 138 + 302·f        H = 36 + 164·f        R = 18 + 4·clamp(f,0,1)
bulge = max(0, d + a − f) · 164            // px hanging under the body bottom
left  = clamp(cx − W/2, 12, screenW − 12 − W)       // cx = pill centre; clamp makes left/right positions grow inward
```
Outline (one closed path, 14 segments): rounded rectangle `W×H` radius `R`; when `bulge > 0.5` the bottom edge is replaced by
`H cx+wl  C cx+0.5wl,H  cx+0.55wl,H+bulge  cx,H+bulge  C cx−0.55wl,H+bulge  cx−0.5wl,H  cx−wl,H  H R`
with lobe half-width `wl = min(0.30·W, W/2 − R − 4)`. This is the exact path the prototype feeds to `clip-path: path()`.

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
| 250 | 1.000 | 0.968 | 0 | 440 | 200 |
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

## 4. C. Idle eyes

### 4.1 Where and when
Collapsed pill only, when there is no other compact content (no timer, media, privacy or low-battery label). Eyes replace the green clock dot; the time stays: `[eyes] [time]` (mirrored in RTL). **Hidden** (the green dot comes back) when: fullscreen app active, Eco, Motion Off, `idleEyes` false, island opening (f > 0.05), or any compact activity takes the pill. In **Reduced**: static open eyes.

### 4.2 Shapes (px at scale 1)
| Part | Spec |
|---|---|
| Eye | capsule **10 × 13**, radius 6, fill **`#ece6ff`** |
| Gap between eyes | **7**; group sits at the label start, **12 px** from the time |
| Pupil | **5 × 6** ellipse, fill **`#1b1530`**, travels **±2.5 px (x), ±2.0 px (y)** inside the eye |
| Lid | not an overlay: the eye is **clipped from the top** by `lid × 100 %` (so any material shows through) |
| Minimum clearance | group ≥ 12 px from the pill's end, eyes never overlap the time (audited in `shots.mjs`) |

### 4.3 States
| State | Condition | Lid | Pupils | Blink |
|---|---|---|---|---|
| **Awake / follow** | cursor within **240 px** of the pill centre | 0 | toward the cursor: `dir · min(1, dist/160) · (2.5, 2.0)` | every **3.0–6.5 s**, 170 ms; **12 %** chance of a quick second blink 120 ms later |
| **Sleepy** | cursor farther than 240 px | **0.42** (42 % closed) | down, `(0, +1.5)` | every **8–14 s**, slow: 380 ms |
| Transition | | exponential smoothing, **τ = 70 ms** waking, **τ = 220 ms** falling asleep | same τ | |

Blink curve (fraction of the blink length): close during the first **35 %**, hold **10 %**, open during the last **55 %**; the lid peaks at **0.92**, never fully closed.

*sim:* near ≈ 11–16 blinks/min (including doubles), far 5–6 blinks/min over 60 s of simulated time. The pupil reached −1.56 px / +2.46 px for a cursor 100 px left / 160 px right.

### 4.4 Cost design (the battery-drain complaint is the main risk)
- **No hook, no per-move events.** Awake tracking needs the cursor position: poll `GetCursorPos` at **30 Hz only while the cursor is within 240 px**; far away poll at **2 Hz** with a coalescable timer (`SetCoalescableTimer`, 500 ms, tolerance 250 ms) so Windows can batch the wake-up with others. (A low-level mouse hook or raw input would wake the host on every mouse move: rejected.)
- **Repaint only on change:** redraw the tiny **≈ 40 × 16 px** eye rect when a pupil moved ≥ 0.25 px or the lid changed ≥ 1 %. A still cursor repaints nothing.
- Blink timers are one-shot (random interval), cancelled when eyes are hidden. When hidden (fullscreen/Eco/Off/disabled) there are **no timers at all** beyond the existing 1 Hz ticker.
- *Budget:* awake ≤ 0.1 % CPU average, far ≤ 0.02 %, hidden 0 (to be added as an `eyes` case to the native perf guard; the **< 1 %** global guard stays). **Default: `idleEyes = false`** (opt-in), because of the battery-drain complaint and because it is decorative.

## 5. Settings UI (design; not wired, see §6)
Appearance section, under "Windows under the island": 

| Control | Type | ar | en | Hint (en) |
|---|---|---|---|---|
| `floating` | switch | جزيرة عائمة | Floating island | Detaches the island from the top edge with a soft shadow. Works with both modes. |
| `idleEyes` | switch | عينان عند الخمول | Idle eyes | Two small eyes follow the cursor when the island is resting. Off in full screen, in Eco and when motion is off. |

The Settings preview already renders material × mode × size × position; it gains the floating look and an eyes glyph. Both rows follow the T19 switch style, and `idleEyes` is shown disabled with the existing amber note when Eco/Motion Off applies ("Eco is on" style, like `settings.motion.ecoLimit`).

## 6. Requests to Codex (contract changes, none made here)
1. Settings keys (HANDOFF §1): **`floating`** boolean, default `false`; **`idleEyes`** boolean, default `false`. Broadcast with `settings:update` like the others; host reads them in `Position()`/paint.
2. Host: B animation, halo, anticipation, placeholder card, §3.6 hand-off; A style (+ AppBar strip 58); C eyes with the cost design in §4.4.
3. Event **`panel:ready`** (or equivalent) from the Electron panel to the host for the cross-fade; today the host only knows "launched".
4. Perf guard: new cases `liquid-open` (CPU during 300 ms, frame time ≤ 2 ms) and `eyes-awake/far/hidden` (CPU, wakeups/s) in `test/ci-native-perf.ps1`.
5. Manual Windows check list (never claimed from CI): 100/150/200 % DPI, two monitors, AppBar mode, acrylic vs glass, 60/144 Hz, RTL position clamp, fullscreen hide.

## 7. Limits of the prototype
HTML springs are the same maths but run in Chromium; the droplet outline is a CSS path, not Direct2D; acrylic is `backdrop-filter`; screenshots/GIFs are produced on a manual clock (GIFs are slowed ×5: 8 ms of animation per 40 ms frame), so they show shape, not real-time feel. No real-device timing, power or GPU measurement exists for any of A–C.

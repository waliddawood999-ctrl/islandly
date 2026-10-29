// Prototype of docs/MOTION_SPEC.md B (liquid expand) and C (idle eyes). Every constant below is the value the spec names.
(() => {
  const $ = (id) => document.getElementById(id);
  const q = new URLSearchParams(location.search);
  const S = { theme: q.get('theme') || 'dark', lang: q.get('lang') || 'en', mode: q.get('mode') || 'overlay', pos: q.get('pos') || 'center', material: q.get('material') || 'glass', motion: q.get('motion') || 'full', eyes: q.get('eyes') || '1', ctx: q.get('eco') ? 'eco' : q.get('fullscreen') ? 'fullscreen' : 'normal' };
  const manual = q.get('manual') === '1';

  // ---- constants (MOTION_SPEC.md §B, §C)
  const DESK = { w: 720, h: 380 };
  const PILL = { w: 138, h: 36, r: 18 };
  const CARD = { w: 440, h: 200, r: 22 };
  const GAP = { overlay: 8, appbar: 8, floating: 14 };
  const EDGE = 16; // distance from the screen side for left / right
  const BODY = { k: 520, c: 40 }; // critically-ish damped: zeta 0.88, settles in ~200 ms
  const DROP = { k: 900, c: 28 }; // under-damped: zeta 0.47, ~19 % overshoot, leads the body and gives the droplet
  const HALO = 20; // px of invisible hit margin round the pill (native: layered window with alpha 1 there)
  const DWELL = 120; // ms inside the halo before opening (native today: 280)
  const LEAVE = 200; // ms outside the card before closing
  const ANTICIPATE = 48; // px: the pill starts to swell this far from it
  const NEAR = 240; // px: eyes wake; beyond it they get sleepy lids but keep looking at the cursor (60 % travel)
  const t0 = performance.now();
  let fake = 0;
  const now = () => (manual ? fake : performance.now() - t0);

  // ---- text
  const TXT = {
    en: { date: 'Thursday, 29 October', hijri: '18 Jumada al-Ula 1448 AH', next: 'Asr', at: '3:21 PM', chips: ['Fajr 4:52', 'Dhuhr 11:42', 'Maghrib 5:08'] },
    ar: { date: 'الخميس، 29 أكتوبر', hijri: '18 جمادى الأولى 1448 هـ', next: 'العصر', at: '3:21 م', chips: ['الفجر 4:52', 'الظهر 11:42', 'المغرب 5:08'] },
  };

  // ---- state
  const body = $('body'), shape = $('shape'), island = $('island'), card = $('card'), rest = $('rest'), desk = $('desk');
  let f = 0, vf = 0, d = 0, vd = 0; // body spring, droplet spring
  let target = 0, ant = 0; // 0 collapsed, 1 expanded; ant = anticipation swell 0..0.1
  let pointer = { x: -999, y: -999 }, inHalo = 0, outCard = 0, lastT = now();
  const eye = { blinkAt: 0, blinkLen: 280, blinkT: -1 };

  const pill = () => {
    const gap = GAP[S.mode];
    const x = S.pos === 'left' ? EDGE : S.pos === 'right' ? DESK.w - EDGE - PILL.w : (DESK.w - PILL.w) / 2;
    return { x, y: gap };
  };
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const rnd = (a, b) => a + Math.random() * (b - a);

  function spring(x, v, to, k, c, dt) { // semi-implicit Euler, unit mass
    v += (-k * (x - to) - c * v) * dt;
    return [x + v * dt, v];
  }

  // ---- geometry of one frame
  const f1 = (n) => +n.toFixed(2);
  function shapePath(W, H, R, bulge) {
    const cx = W / 2;
    const wl = Math.max(0, Math.min(0.3 * W, W / 2 - R - 4)); // half-width of the droplet lobe
    let p = `M${f1(R)},0 H${f1(W - R)} A${f1(R)},${f1(R)} 0 0 1 ${f1(W)},${f1(R)} V${f1(H - R)} A${f1(R)},${f1(R)} 0 0 1 ${f1(W - R)},${f1(H)}`;
    if (bulge > 0.5 && wl > 6) p += ` H${f1(cx + wl)} C${f1(cx + wl * 0.5)},${f1(H)} ${f1(cx + wl * 0.55)},${f1(H + bulge)} ${f1(cx)},${f1(H + bulge)} C${f1(cx - wl * 0.55)},${f1(H + bulge)} ${f1(cx - wl * 0.5)},${f1(H)} ${f1(cx - wl)},${f1(H)}`;
    return p + ` H${f1(R)} A${f1(R)},${f1(R)} 0 0 1 0,${f1(H - R)} V${f1(R)} A${f1(R)},${f1(R)} 0 0 1 ${f1(R)},0 Z`;
  }
  function layout() {
    const p = pill();
    const W = lerp(PILL.w, CARD.w, f), H = lerp(PILL.h, CARD.h, f), R = lerp(PILL.r, CARD.r, clamp(f, 0, 1));
    const cx = p.x + PILL.w / 2;
    const left = clamp(cx - W / 2, 12, DESK.w - 12 - W);
    // the droplet: how far the spring DROP (fast, under-damped) has run ahead of the body, in px under its bottom edge
    const bulge = S.motion === 'full' ? Math.max(0, d + ant - f) * (CARD.h - PILL.h) : 0;
    body.style.cssText = `left:${left}px;top:${p.y}px;width:${W}px;height:${H + bulge}px`;
    shape.style.clipPath = `path('${shapePath(W, H, R, bulge)}')`;
    // content: the collapsed label fades out first; the card fades in while the shape grows, and is clipped by it
    const cardLeft = clamp(cx - CARD.w / 2, 12, DESK.w - 12 - CARD.w);
    const a = clamp((f - 0.3) / 0.5, 0, 1);
    card.style.cssText = `left:${cardLeft - left}px;width:${CARD.w}px;height:${CARD.h}px;opacity:${a};transform:scale(${lerp(0.97, 1, a)});transform-origin:50% 0`;
    rest.style.cssText = `left:${p.x}px;top:${p.y}px;opacity:${clamp(1 - f / 0.25, 0, 1)}`;
    island.classList.toggle('open', f > 0.9 && target === 1);
  }

  // ---- B: advance the springs by dt ms
  function stepB(ms) {
    const go = (S.motion === 'full' ? 1 : 0);
    if (S.motion === 'off') { f = target; d = target; vf = vd = 0; return; }
    if (S.motion === 'reduced') { // 120 ms ease-out, no overshoot, no droplet
      const k = 1 - Math.exp(-ms / 40);
      f += (target - f) * k; d = f; vf = vd = 0; ant = 0;
      if (Math.abs(f - target) < 0.002) f = d = target;
      return;
    }
    const n = Math.max(1, Math.round(ms));
    const dt = ms / n / 1000;
    for (let i = 0; i < n; i++) {
      [f, vf] = spring(f, vf, target, BODY.k, BODY.c, dt);
      [d, vd] = spring(d, vd, target ? 1 : 0, DROP.k, DROP.c, dt);
    }
    if (!go) return;
  }

  // ---- C: eyes (MOTION_SPEC.md section 4). Two filled capsules, no pupils. The gaze is one smoothed vector g in [-1, 1]^2
  // that follows the real angle to the cursor; offset, lean, far-eye squash and foreshortening are all derived from it.
  const GAZE = { x: 7, y: 4, lean: 7, farSquash: 0.18, foreshorten: 0.12, ramp: 50, rate: 4, farGain: 0.6, yLimit: 4 };
  const g = { x: 0, y: 0 }; // smoothed gaze
  let squint = 0, lidNow = 0.54;
  const slots = [...document.querySelectorAll('.slot')], eyeEls = [...document.querySelectorAll('.eye')], eyesBox = $('eyes');
  function nextBlink(t, sleepy) { eye.blinkAt = t + (sleepy ? rnd(8000, 14000) : rnd(3000, 4000)); }
  const smooth = (x) => x * x * (3 - 2 * x);
  function stepC(ms, t) {
    const hidden = S.eyes === '0' || S.ctx !== 'normal' || S.motion === 'off';
    island.dataset.eyes = S.eyes === '0' ? 'off' : hidden ? 'hidden' : 'on';
    if (hidden) return;
    const p = pill();
    const cx = p.x + PILL.w / 2, cy = p.y + PILL.h / 2;
    const present = pointer.x > -900;
    const dx = pointer.x - cx, dy = pointer.y - cy, dist = Math.hypot(dx, dy);
    const still = S.motion === 'reduced'; // static eyes: open, centred, no tracking, no blink
    const awake = present && dist < NEAR && f < 0.05;
    const inPill = present && pointer.x >= p.x && pointer.x <= p.x + PILL.w && pointer.y >= p.y && pointer.y <= p.y + PILL.h;
    // gaze target: the unit direction to the cursor, ramped in over the first 50 px, 60 % travel when the cursor is far
    const s = smooth(clamp(dist / GAZE.ramp, 0, 1)) * (awake ? 1 : GAZE.farGain);
    const tx = still || !present || !dist ? 0 : (dx / dist) * s;
    const ty = still || !present || !dist ? 0 : (dy / dist) * s;
    const kg = 1 - Math.exp((-ms * GAZE.rate) / 1000); // 4 per second: time constant 250 ms
    g.x += (tx - g.x) * kg; g.y += (ty - g.y) * kg;
    const wantLid = still ? 0 : awake ? 0 : 0.54;
    const kl = 1 - Math.exp(-ms / (awake ? 70 : 220));
    lidNow += (wantLid - lidNow) * kl;
    squint += ((inPill && !still ? 1 : 0) - squint) * (1 - Math.exp(-ms / 90));
    // blink: 280 ms (380 ms when sleepy); the filled eye narrows to 10 % of its width and back
    let blinkW = 1;
    if (!still) {
      if (!eye.blinkAt) nextBlink(t, !awake);
      if (eye.blinkT < 0 && t >= eye.blinkAt) { eye.blinkT = 0; eye.blinkLen = awake ? 280 : 380; }
      if (eye.blinkT >= 0) {
        eye.blinkT += ms;
        const u = eye.blinkT / eye.blinkLen;
        const c = u < 0.4 ? (u / 0.4) ** 2 : u < 0.48 ? 1 : u < 1 ? (1 - (u - 0.48) / 0.52) ** 2 : 0;
        blinkW = 1 - 0.9 * c;
        if (u >= 1) { eye.blinkT = -1; nextBlink(t, !awake); }
      }
    }
    eye.g = { x: +g.x.toFixed(3), y: +g.y.toFixed(3) }; eye.lid = lidNow; eye.squint = squint; eye.blinkW = blinkW;
    const tilt = -11 + g.x * GAZE.lean; // both eyes lean toward the cursor
    const droop = 2.5 * (lidNow / 0.54);
    const x = g.x * GAZE.x;
    const y = clamp(g.y * GAZE.y + droop - 0.5 * squint, -GAZE.yLimit, GAZE.yLimit);
    eyesBox.style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px)`;
    const fore = 1 - GAZE.foreshorten * Math.abs(g.y) - 0.1 * (lidNow / 0.54);
    const sy = fore * (1 - 0.4 * squint);
    const farA = g.x > 0 ? 1 - GAZE.farSquash * g.x : 1; // cursor on the right: the left eye is the far one
    const farB = g.x < 0 ? 1 + GAZE.farSquash * g.x : 1;
    const wq = (1 + 0.1 * squint) * blinkW;
    eyeEls[0].style.transform = `rotate(${tilt.toFixed(2)}deg) scale(${(farA * wq).toFixed(3)}, ${sy.toFixed(3)})`;
    eyeEls[1].style.transform = `rotate(${tilt.toFixed(2)}deg) scale(${(farB * wq).toFixed(3)}, ${sy.toFixed(3)})`;
    slots.forEach((e) => e.style.setProperty('--lid', lidNow.toFixed(3)));
  }

  // ---- B trigger: approach, dwell, leave (hysteresis)
  function pointerLogic(ms) {
    const p = pill();
    const insideRect = (r, m) => pointer.x >= r.x - m && pointer.x <= r.x + r.w + m && pointer.y >= r.y - m && pointer.y <= r.y + r.h + m;
    const pr = { x: p.x, y: p.y, w: PILL.w, h: PILL.h };
    const cl = clamp(p.x + PILL.w / 2 - CARD.w / 2, 12, DESK.w - 12 - CARD.w);
    const cr = { x: cl, y: p.y, w: CARD.w, h: CARD.h };
    if (target === 0) {
      const dd = Math.max(0, p.y - pointer.y, pointer.y - (p.y + PILL.h), p.x - pointer.x, pointer.x - (p.x + PILL.w));
      ant = S.motion === 'full' ? 0.1 * clamp(1 - dd / ANTICIPATE, 0, 1) : 0;
      if (insideRect(pr, HALO)) { inHalo += ms; if (inHalo >= DWELL) { target = 1; inHalo = 0; } } else inHalo = 0;
    } else {
      ant = 0;
      if (!insideRect(cr, 16)) { outCard += ms; if (outCard >= LEAVE) { target = 0; outCard = 0; } } else outCard = 0;
    }
  }

  function frame(ms) {
    const t = now();
    if (!manual || api.live) pointerLogic(ms);
    stepB(ms);
    stepC(ms, t);
    layout();
  }
  function loop() { const t = now(); const ms = Math.min(50, t - lastT); lastT = t; frame(ms); requestAnimationFrame(loop); }

  // ---- paint static bits
  function paint() {
    const T = TXT[S.lang];
    document.documentElement.lang = S.lang;
    document.documentElement.dir = S.lang === 'ar' ? 'rtl' : 'ltr';
    desk.dataset.mode = S.mode; desk.dataset.material = S.material; desk.dataset.theme = S.theme; desk.dataset.showcursor = manual && pointer.x > -900 ? '1' : '0';
    $('cursor').style.cssText = `left:${pointer.x}px;top:${pointer.y}px`;
    $('time').textContent = '10:42';
    $('bigTime').textContent = '10:42';
    $('date').textContent = T.date; $('hijri').textContent = T.hijri; $('nextName').textContent = T.next; $('nextAt').textContent = T.at; $('nextIn').textContent = '00:38';
    ['chip1', 'chip2', 'chip3'].forEach((id, i) => ($(id).textContent = T.chips[i]));
    document.querySelectorAll('.seg').forEach((s) => s.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(S[s.dataset.k] === b.dataset.v))));
    const p = pill();
    island.style.setProperty('--pw', PILL.w + 'px');
    layout();
  }
  document.querySelectorAll('.seg button').forEach((b) => b.addEventListener('click', () => { S[b.parentNode.dataset.k] = b.dataset.v; paint(); }));
  desk.addEventListener('pointermove', (e) => { const r = desk.getBoundingClientRect(); pointer = { x: e.clientX - r.left, y: e.clientY - r.top }; });
  desk.addEventListener('pointerleave', () => (pointer = { x: -999, y: -999 }));

  // ---- test / capture API
  const api = (window.proto = {
    S,
    live: false,
    set(k, v) { S[k] = v; paint(); },
    open(on) { target = on ? 1 : 0; },
    pointer(x, y) { pointer = { x, y }; desk.dataset.showcursor = manual && x > -900 ? '1' : '0'; $('cursor').style.cssText = `left:${x}px;top:${y}px`; },
    step(ms) { // manual clock: advance in 1 ms slices so the springs behave as in a live run
      for (let i = 0; i < ms; i++) { fake += 1; frame(1); }
    },
    blinkNow() { eye.blinkAt = now(); eye.blinkT = -1; },
    setBlinkT(ms) { eye.blinkT = ms; eye.blinkLen = 280; stepC(0, now()); },
    state() { return { f, d, vf, vd, target, eye: { ...eye } }; },
    spring: { BODY, DROP },
  });
  paint();
  if (!manual) requestAnimationFrame(loop);
})();

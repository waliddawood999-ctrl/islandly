// Prototype of docs/MOTION_SPEC.md B (liquid expand) and C (idle eyes). Every constant below is the value the spec names.
(() => {
  const $ = (id) => document.getElementById(id);
  const q = new URLSearchParams(location.search);
  const S = { lang: q.get('lang') || 'en', mode: q.get('mode') || 'overlay', pos: q.get('pos') || 'center', material: q.get('material') || 'glass', motion: q.get('motion') || 'full', eyes: q.get('eyes') || '1', ctx: q.get('eco') ? 'eco' : q.get('fullscreen') ? 'fullscreen' : 'normal' };
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
  const NEAR = 240; // px: eyes wake and follow
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
  const eye = { lid: 0.42, px: 0, py: 1.5, blink: 0, blinkAt: 0, blinkLen: 170, blinkT: -1, double: false };

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

  // ---- C: eyes
  function nextBlink(t, sleepy) { eye.blinkAt = t + (sleepy ? rnd(8000, 14000) : rnd(3000, 6500)); }
  function stepC(ms, t) {
    const hidden = S.eyes === '0' || S.ctx !== 'normal' || S.motion === 'off';
    island.dataset.eyes = S.eyes === '0' ? 'off' : hidden ? 'hidden' : 'on';
    if (hidden) return;
    const p = pill();
    const cx = p.x + PILL.w / 2, cy = p.y + PILL.h / 2;
    const dx = pointer.x - cx, dy = pointer.y - cy, dist = Math.hypot(dx, dy);
    const near = dist < NEAR && f < 0.05;
    const still = S.motion === 'reduced'; // static eyes: open, centred, no blink, no tracking
    const wantLid = still ? 0 : near ? 0 : 0.42; // sleepy lids: 42 %
    let wx = 0, wy = 1.5;
    if (still) { wx = 0; wy = 0; } else if (near) { const m = Math.min(1, dist / 160); wx = (dx / (dist || 1)) * 2.5 * m; wy = (dy / (dist || 1)) * 2.0 * m; }
    const tau = near ? 70 : 220; // ms, exponential smoothing
    const k = 1 - Math.exp(-ms / tau);
    eye.lid += (wantLid - eye.lid) * k; eye.px += (wx - eye.px) * k; eye.py += (wy - eye.py) * k;
    if (!still) {
      if (!eye.blinkAt) nextBlink(t, !near);
      if (eye.blinkT < 0 && t >= eye.blinkAt) { eye.blinkT = 0; eye.blinkLen = near ? 170 : 380; }
      if (eye.blinkT >= 0) {
        eye.blinkT += ms;
        const u = eye.blinkT / eye.blinkLen; // 0..1: close for 35 %, hold 10 %, open for 55 %
        eye.blink = u < 0.35 ? u / 0.35 : u < 0.45 ? 1 : u < 1 ? 1 - (u - 0.45) / 0.55 : 0;
        if (u >= 1) { eye.blinkT = -1; eye.blink = 0; if (near && !eye.double && Math.random() < 0.12) { eye.double = true; eye.blinkAt = t + 120; } else { eye.double = false; nextBlink(t, !near); } }
      }
    } else eye.blink = 0;
    const lid = Math.max(eye.lid, eye.blink * 0.92); // a blink never closes fully: 92 %
    island.style.setProperty('--lid', lid.toFixed(3));
    document.querySelectorAll('.eye').forEach((e) => { e.style.setProperty('--lid', lid.toFixed(3)); e.firstElementChild.style.setProperty('--px', eye.px.toFixed(2) + 'px'); e.firstElementChild.style.setProperty('--py', eye.py.toFixed(2) + 'px'); });
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
    desk.dataset.mode = S.mode; desk.dataset.material = S.material;
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
    pointer(x, y) { pointer = { x, y }; },
    step(ms) { // manual clock: advance in 1 ms slices so the springs behave as in a live run
      for (let i = 0; i < ms; i++) { fake += 1; frame(1); }
    },
    state() { return { f, d, vf, vd, target, eye: { ...eye } }; },
    spring: { BODY, DROP },
  });
  paint();
  if (!manual) requestAnimationFrame(loop);
})();

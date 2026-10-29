/**
 * Island core: a spring-animated pill that shows one "view" at a time.
 *
 * A feature registers { id, icon, priority(), view(mode) } where mode is
 *   'compact'  - resting state (shown while the feature has the highest priority)
 *   'peek'     - short transient popup (Island.peek)
 *   'expanded' - full panel while hovered or pinned
 * and view() returns { el, w, h } (or { el, w, auto: true } for panels that size to their content),
 * optionally with `below: { el, w, h }`: a second, smaller pill shown under the island (e.g. lyrics).
 * Elements are built once and updated in place.
 *
 * Motion: the pill's size is a spring (Motion, vendor/motion.js) that overshoots a little and settles in
 * ~0.35 s, opening from the top centre downwards and sideways. Content never resizes with the pill: the old
 * view fades out fast, the new one fades and scales in (0.96 -> 1) as the pill arrives. Only the pill box
 * itself changes size (one isolated element with `contain`); its content is laid out once at the final size.
 *
 * Auto-hide: after a few seconds a compact view shrinks to a thin line at the top edge, so the island
 * does not sit on top of tabs and page content. Hovering the line brings it back.
 */
const Island = (() => {
  const el = $('#island');
  const stage = $('#content');
  const features = [];
  const M = window.Motion || null;

  const FOOTER = 24; // room for the tab dots below the panel's content
  const TOP = 8; // gap above the island
  const BELOW_GAP = 8; // gap between the island and the strip under it
  const AUTO_HIDE_MS = 5000;
  const HOVER_DWELL_MS = 280; // pointer must rest on the island before it opens (avoids accidental opens)
  const LEAVE_MS = 24; // how long after the pointer leaves the island closes again
  let reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Spring: visual duration ~0.35 s with a slight overshoot. Reduced motion: short, no bounce.
  let motionOff = false;
  let SPRING = reducedMotion ? { duration: 0.12, ease: 'easeOut' } : { type: 'spring', visualDuration: 0.34, bounce: 0.24 };

  let hovered = false; // pointer has rested on the island long enough to open it
  let pointer = false; // pointer is over the island right now
  let pinned = false;
  let held = false; // keep open regardless of the pointer (e.g. while typing)
  let userChoseAt = 0; // when the user last picked a panel themselves
  let selected = 0;
  let peekState = null;
  let current = null;
  let workArea = { width: screen.availWidth || 1280, height: screen.availHeight || 800 };
  let autoHide = (window.islandAPI && window.islandAPI.settings.autoHide) || 'auto';
  let compactKey = null;
  let compactSince = 0;
  let hoverTimer = 0;
  let pinTimer = 0;

  const dots = h('div', { class: 'dots' });
  // Off-screen box used to measure a panel's natural height before it is shown.
  const meter = h('div', { id: 'measure' });
  document.body.appendChild(meter);
  const sliverEl = h('div', { class: 'view sliver' });
  const below = h('div', { id: 'below' });
  document.body.appendChild(below);

  // ------------------------------------------------------------------ shape
  // The current target of the pill and of the strip under it, in CSS pixels.
  const shape = { w: 90, h: 22, y: TOP, r: 11 };
  let belowShape = null; // { w, h } or null
  let shapeAnim = null;
  let animating = false;
  const stats = { animations: 0, lastDuration: 0 };

  const radiusFor = (w, hgt, v) => (v && v.radius) || (hgt <= 48 ? hgt / 2 : 22);

  // The window is only as big as the island (plus room for its shadow), so it never covers anything else.
  // Before an animation it grows to fit both the old and new size; once the spring settles it is trimmed.
  // It is never resized during the animation itself, so the pill cannot shake.
  const GUTTER = 18;
  const OVERSHOOT = 1.08;
  let lastEnvelope = '';
  function sendEnvelope(w, hgt, y, extra) {
    const env = { w: Math.ceil(Math.max(w, extra ? extra.w : 0) + 2 * GUTTER), h: Math.ceil(y + hgt + (extra ? BELOW_GAP + extra.h : 0) + GUTTER) };
    const key = env.w + 'x' + env.h;
    if (key === lastEnvelope) return;
    lastEnvelope = key;
    API.send('island:envelope', env);
  }

  function liveSize() {
    const r = el.getBoundingClientRect();
    return { w: r.width, h: r.height, y: r.top };
  }

  function setTarget(w, hgt, y, r, nextBelow) {
    const now = liveSize();
    sendEnvelope(Math.max(now.w, w), Math.max(now.h, hgt), Math.max(now.y, y), nextBelow || belowShape);
    Object.assign(shape, { w, h: hgt, y, r });
    placeBelow(nextBelow);
    if (shapeAnim) shapeAnim.stop();
    // FLIP: one layout at the destination, then compositor transform/opacity only.
    Object.assign(el.style, { width: w + 'px', height: hgt + 'px', top: y + 'px', borderRadius: r + 'px' });
    if (motionOff || !el.animate) { settle(); return; }
    animating = true;
    el.style.willChange = 'transform';
    const started = performance.now();
    const animation = el.animate([
      { transform: `translateX(-50%) translateY(${now.y-y}px) scale(${now.w/w}, ${now.h/hgt})` },
      { transform: 'translateX(-50%) translateY(0px) scale(1, 1)' },
    ], { duration: reducedMotion ? 100 : 180, easing: 'cubic-bezier(.2,.9,.3,1)' });
    const anim = { stop: () => animation.cancel() };
    shapeAnim = anim; stats.animations++;
    if (nextBelow) {
      below.style.top = (y + hgt + BELOW_GAP) + 'px';
      below.animate([{ transform: `translateY(${now.y + now.h - y - hgt}px)` }, { transform: 'translateY(0px)' }],
        { duration: reducedMotion ? 100 : 180, easing: 'cubic-bezier(.2,.9,.3,1)' });
    }
    startShapeLoop(); reportShape();
    animation.finished.then(() => {
      if (shapeAnim !== anim) return;
      shapeAnim = null; el.style.willChange = '';
      stats.lastDuration = performance.now() - started;
      settle();
    }).catch(() => {});
  }

  function settle() {
    animating = false;
    reportShape();
    if (belowShape) below.style.top = el.getBoundingClientRect().bottom + BELOW_GAP + 'px';
    sendEnvelope(shape.w, shape.h, shape.y, belowShape); // trim the window to the final size
  }

  // The strip under the island (lyrics). It slides in from under the pill and fades out again.
  let belowEl = null;
  let belowAnimating = 0;
  function placeBelow(next) {
    const nextEl = next ? next.el : null;
    if (nextEl !== belowEl) {
      if (belowEl && M && !motionOff) {
        const old = belowEl;
        M.animate(below, { opacity: 0 }, { duration: 0.1 }).then(() => old.remove());
      } else if (belowEl) belowEl.remove();
      belowEl = nextEl;
      if (nextEl) {
        below.replaceChildren(nextEl);
        if (M && !motionOff) {
          below.style.opacity = '0';
          belowAnimating++;
          M.animate(below, { opacity: [0, 1] }, { ...SPRING, delay: reducedMotion ? 0 : 0.18 }).then(() => { belowAnimating--; reportShape(); });
          startShapeLoop();
        }
      }
    }
    belowShape = next ? { w: next.w, h: next.h } : null;
    lastShape = '';
    startShapeLoop();
    below.style.display = next ? '' : 'none';
    if (next) {
      below.style.width = next.w + 'px';
      below.style.height = next.h + 'px';
      below.style.left = `calc(50% - ${next.w / 2}px)`; // centred without a transform, which Motion animates
    }
  }

  /** Natural height of a view: panels (v.auto) are measured, small pills use their fixed height. */
  function heightOf(v) {
    if (!v.auto) return v.h;
    if (v.el.parentNode !== stage) {
      meter.style.width = v.w + 'px';
      meter.appendChild(v.el);
    }
    return Math.ceil(v.el.offsetHeight);
  }

  function expandedSize(v, id) {
    const maxWidth = Math.max(160, Math.min(560, workArea.width - 2 * GUTTER));
    const base = Math.min(360, maxWidth);
    const preferred = id === 'music' && v.el.querySelector('.m-body')?.style.display !== 'none' ? Math.min(460, maxWidth) : base;
    const clone = v.el.cloneNode(true);
    Object.assign(clone.style, { width: (preferred - 32) + 'px', height: 'auto', position: 'relative', padding: '0', inset: 'auto' });
    meter.classList.add('expanded-grid'); meter.appendChild(clone);
    const needed = Math.max(preferred, Math.min(v.w, clone.scrollWidth + 32));
    const w = Math.min(maxWidth, needed);
    clone.style.width = (w - 32) + 'px';
    const natural = v.auto ? clone.offsetHeight : v.h;
    clone.remove();
    const hgt = Math.min(Math.max(120, workArea.height - TOP - GUTTER - (v.below ? v.below.h + BELOW_GAP : 0)), Math.max(440, natural + FOOTER + 44));
    return { w, h: hgt };
  }
  const expandable = () => features.filter((f) => f.view('expanded'));

  function bestCompact(includeIdle) {
    let best = null;
    let bestPriority = 0;
    for (const f of features) {
      if (f.idle && !includeIdle) continue;
      const p = f.priority();
      if (p > bestPriority && f.view('compact')) {
        best = f;
        bestPriority = p;
      }
    }
    return best;
  }

  function resolve() {
    if (hovered || pinned) {
      compactKey = null;
      const list = expandable();
      if (!list.length) return null;
      selected = Math.min(selected, list.length - 1);
      const f = list[selected];
      const v = f.view('expanded');
      const dims = expandedSize(v, f.id);
      const hgt = dims.h;
      return {
        key: 'x:' + f.id,
        mode: 'expanded',
        el: v.el,
        w: dims.w,
        h: hgt,
        y: TOP,
        r: radiusFor(v.w, hgt, v),
        withDots: list.length > 1,
        auto: !!v.auto,
        below: v.below ? { ...v.below, w: Math.min(v.below.w, workArea.width - 2 * GUTTER) } : null,
      };
    }
    if (peekState && Date.now() < peekState.until) {
      compactKey = null;
      const f = peekState.feature;
      const v = f.view('peek') || f.view('expanded');
      if (v) {
        const hgt = heightOf(v);
        return { key: 'p:' + f.id, mode: 'peek', el: v.el, w: v.w, h: hgt, y: TOP, r: radiusFor(v.w, hgt, v), auto: !!v.auto };
      }
    }

    const f = bestCompact(autoHide === 'never');
    sliverEl.classList.toggle('active', !!bestCompact(false));
    // a "sticky" compact view (microphone/camera in use) stays visible whatever the auto-hide setting
    if (f && (autoHide !== 'always' || f.sticky)) {
      const key = 'c:' + f.id;
      if (key !== compactKey) {
        compactKey = key;
        compactSince = Date.now();
        if (autoHide === 'auto') setTimeout(render, AUTO_HIDE_MS + 40);
      }
      if (autoHide === 'never' || f.sticky || Date.now() - compactSince < AUTO_HIDE_MS) {
        const v = f.view('compact');
        return { key, mode: 'compact', el: v.el, w: v.w, h: v.h, y: TOP, r: radiusFor(v.w, v.h, v) };
      }
    }
    return { key: 'sliver', mode: 'sliver', el: sliverEl, w: 84, h: 5, y: 0, r: 2.5, sliver: true };
  }

  function renderDots() {
    const list = expandable();
    const active = list[selected];
    dots.replaceChildren(
      ...list.map((f, i) =>
        h('button', {
          class: 'dot' + (f === active ? ' on' : ''),
          title: t(f.id),
          'data-interactive': '1',
          onclick: () => select(i),
        })
      )
    );
  }

  // A panel whose content changes size (new rows, data arriving) is re-measured automatically.
  let resizeQueued = false;
  const resizer = new ResizeObserver(() => {
    if (resizeQueued) return;
    resizeQueued = true;
    requestAnimationFrame(() => {
      resizeQueued = false;
      renderNow();
    });
  });

  function mount(v) {
    resizer.disconnect();
    if (v.auto) { resizer.observe(v.el); for (const child of v.el.children) resizer.observe(child); }
    sizeStage(v);
    const kids = [v.el];
    if (v.withDots) {
      renderDots();
      kids.push(dots);
    }
    stage.replaceChildren(...kids);
    el.classList.toggle('sliver', !!v.sliver);
    el.dataset.mode = v.mode;
    applyTint();
    const resting = v.mode === 'compact' || v.mode === 'sliver';
    if (resting !== lastResting) {
      lastResting = resting;
      API.send('surface:resting', resting); // the main process samples the page colour only while resting
    }
    // staggered children (lists) cascade in once the view is in
    v.el.classList.remove('enter');
    void v.el.offsetWidth;
    v.el.classList.add('enter');
  }

  let lastResting = null;

  // The content box is centred with `left`, so transforms stay free for the enter animation.
  function sizeStage(v) {
    stage.classList.toggle('expanded-grid', v.mode === 'expanded');
    if(v.mode !== 'expanded') v.el.style.width = '';
    stage.style.width = v.w + 'px';
    stage.style.height = v.h + 'px';
    stage.style.left = `calc(50% - ${v.w / 2}px)`;
  }

  // Swap views: the old content disappears quickly, the new one appears as the pill reaches its size.
  let swapToken = 0;
  function swap(v) {
    const token = ++swapToken;
    if (!M || motionOff) {
      mount(v);
      return;
    }
    const hadContent = stage.childElementCount > 0;
    const out = hadContent ? M.animate(stage, { opacity: 0, scale: 0.98 }, { duration: reducedMotion ? 0.05 : 0.08, ease: 'easeIn' }) : Promise.resolve();
    out.then(() => {
      if (token !== swapToken) return;
      mount(v);
      M.animate(
        stage,
        { opacity: [0, 1], scale: [0.98, 1] },
        { duration: reducedMotion ? 0.08 : 0.12, ease: [0.2, 0.9, 0.3, 1], delay: 0 }
      );
    });
  }

  function render() {
    renderNow();
    for (const f of features) if (f.sync) f.sync();
  }

  function renderNow() {
    const v = resolve();
    if (!v) return;
    if (current && current.key === v.key) {
      if (current.w !== v.w || current.h !== v.h || (current.below && current.below.el) !== (v.below && v.below.el) || (current.below && current.below.w) !== (v.below && v.below.w) || (current.below && current.below.h) !== (v.below && v.below.h)) {
        setTarget(v.w, v.h, v.y, v.r, v.below);
        sizeStage(v);
      }
      const dotsChanged = v.withDots && dots.childElementCount !== expandable().length;
      current = v;
      if (dotsChanged) renderDots();
      return;
    }
    const first = !current;
    current = v;
    setTarget(v.w, v.h, v.y, v.r, v.below);
    if (first) mount(v);
    else swap(v);
  }

  // Language switch (T11): marked text is already re-translated by I18N; each feature repaints the text it
  // builds itself (relang(), or paint() by default), without resetting its state.
  function relang() {
    for (const f of features) {
      try {
        if (f.relang) f.relang();
        else if (f.paint) f.paint();
      } catch (err) {
        API.send('log:error', `relang ${f.id}: ${err && err.message}`);
      }
    }
    if (current && current.withDots) renderDots();
    render();
  }

  function select(i) {
    selected = i;
    userChoseAt = Date.now();
    render();
  }

  // Context: open on what matters now (a meeting about to start, the running timer, the song playing...),
  // unless the user picked a panel themselves in the last minute.
  // Which panel suits the app in front (set by app.js from the foreground window); used when nothing is urgent.
  let contextPanel = null;

  function pickDefault() {
    if (Date.now() - userChoseAt < 60000) return;
    const list = expandable();
    let best = 0;
    let bestP = 0;
    list.forEach((f, i) => {
      const p = f.priority();
      if (p > bestP) {
        best = i;
        bestP = p;
      }
    });
    if (bestP < 30 && contextPanel) {
      const i = list.findIndex((f) => f.id === contextPanel);
      if (i >= 0) best = i;
    }
    selected = best;
  }

  function hold(value) {
    held = value;
    if (value) {
      pinned = true;
      clearTimeout(pinTimer);
    } else armPinTimeout(4000);
    render();
  }

  function register(feature) {
    features.push(feature);
    if (feature.init) feature.init();
  }

  function peek(id, ms = 3500) {
    const feature = features.find((f) => f.id === id);
    if (!feature) return;
    peekState = { feature, until: Date.now() + ms };
    render();
    setTimeout(render, ms + 30);
  }

  // A pinned island closes by itself some seconds after the pointer is gone (or was never there).
  function armPinTimeout(ms) {
    clearTimeout(pinTimer);
    if (!pinned || pointer || held) return;
    pinTimer = setTimeout(() => {
      pinned = false;
      render();
    }, ms);
  }

  // ------------------------------------------------------------------ hover
  // `mouseleave` is not proof the pointer left: Chromium also fires it when the window is resized or moved
  // under a pointer that did not move (the island re-centres itself when it grows). So before closing, the
  // main process is asked where the cursor really is. The main process also reports a real exit that no
  // mouse event announced (see 'island:pointer-left').
  async function pointerReallyInside() {
    try {
      return (await API.call('island:pointer-inside')) === true;
    } catch (_) {
      return false;
    }
  }

  function reportHoverState() {
    API.send('island:hover-state', !!(pointer || hovered));
  }

  function setHover(value) {
    pointer = value;
    clearTimeout(hoverTimer);
    // immediate feedback: the island swells slightly while it waits to open
    el.classList.toggle('hint', value && !(hovered || pinned));
    if (value) {
      clearTimeout(pinTimer);
      hoverTimer = setTimeout(() => {
        if (!hovered && !pinned) pickDefault();
        hovered = true;
        el.classList.remove('hint');
        render();
        reportHoverState();
      }, HOVER_DWELL_MS);
    } else {
      const timer = setTimeout(async () => {
        if (held) return;
        if (await pointerReallyInside()) {
          if (hoverTimer === timer) pointer = true; // a spurious leave: stay open
          return;
        }
        if (hoverTimer !== timer) return; // the pointer came back meanwhile
        hovered = false;
        render();
        reportHoverState();
      }, LEAVE_MS);
      hoverTimer = timer;
      armPinTimeout(4000);
    }
    reportHoverState();
  }

  function togglePin() {
    pinned = !pinned;
    if (!pinned) hovered = pointer;
    armPinTimeout(8000);
    render();
  }

  function selectFeature(id) {
    const i = expandable().findIndex((f) => f.id === id);
    if (i >= 0) {
      selected = i;
      userChoseAt = Date.now();
    }
  }

  /** Open a feature's panel right away (used for drag & drop and keyboard shortcuts). */
  function open(id) {
    selectFeature(id);
    pinned = true;
    armPinTimeout(8000);
    render();
  }

  function configure(opts) {
    if (opts.workArea) { workArea = opts.workArea; render(); }
    if (opts.autoHide) {
      autoHide = opts.autoHide;
      compactKey = null;
      render();
    }
    if (opts.islandMode) {
      islandMode = opts.islandMode;
      applyTint();
    }
  }

  // ------------------------------------------------------------------ acrylic shape
  // With the acrylic material, Windows blurs the desktop behind the whole window. Main clips that blur to the
  // pill (SetWindowRgn, task T15), so it needs the pill's rectangle and corner radius: on every frame while the
  // pill animates, and once when it settles. Nothing is sent with the glass material.
  let material = 'glass';
  let lastShape = '';
  let shapeLoop = false;
  function reportShape() {
    if (material !== 'acrylic') return;
    const r = el.getBoundingClientRect();
    const radius = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
    const msg = { x: Math.round(r.left), y: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height), radius: Math.round(radius) };
    msg.secondary = null;
    if (belowShape && below.style.display !== 'none') {
      const b = below.getBoundingClientRect();
      if (b.width > 0 && b.height > 0) msg.secondary = { x: Math.round(b.left), y: Math.round(b.top), width: Math.round(b.width), height: Math.round(b.height), radius: Math.round(parseFloat(getComputedStyle(below).borderTopLeftRadius) || 0) };
    }
    const key = JSON.stringify(msg);
    if (key === lastShape) return;
    lastShape = key;
    API.send('island:shape', msg);
  }
  function shapeFrame() {
    reportShape();
    if ((animating || belowAnimating > 0) && material === 'acrylic') requestAnimationFrame(shapeFrame);
    else shapeLoop = false;
  }
  function startShapeLoop() {
    if (shapeLoop || material !== 'acrylic') return;
    shapeLoop = true;
    requestAnimationFrame(shapeFrame);
  }
  function setMaterial(m) {
    material = m === 'acrylic' ? 'acrylic' : 'glass';
    lastShape = '';
    reportShape();
  }

  // ------------------------------------------------------------------ tint ("over the page" mode)
  // While resting (compact or the thin line) the pill takes a tone of the page under it, so it blends in.
  // Expanded panels and alerts always use the dark glass, so their text stays readable.
  let islandMode = (window.islandAPI && window.islandAPI.settings.islandMode) || 'overlay';
  let tint = null;
  function setTint(rgb) {
    tint = rgb && [rgb.r, rgb.g, rgb.b].every(Number.isFinite) ? rgb : null;
    applyTint();
  }
  function applyTint() {
    const resting = current && (current.mode === 'compact' || current.mode === 'sliver');
    const on = !!(tint && resting && islandMode === 'overlay');
    el.classList.toggle('tinted', on);
    if (!on) return;
    // 45% page colour over the dark glass; light results switch the text to dark.
    const mix = (c) => Math.round(c * 0.45 + 10 * 0.55);
    const [r, g, b] = [mix(tint.r), mix(tint.g), mix(tint.b)];
    el.style.setProperty('--tint', `rgb(${r}, ${g}, ${b})`);
    el.classList.toggle('on-light', (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.55);
  }

  // Wheel over the island switches between panels (unless the wheel is over a scrollable strip).
  let wheelLock = 0;
  el.addEventListener(
    'wheel',
    (e) => {
      if (!(hovered || pinned) || Date.now() < wheelLock || e.target.closest('.scroll')) return;
      const n = expandable().length;
      if (n < 2) return;
      wheelLock = Date.now() + 260;
      select((selected + (e.deltaY > 0 ? 1 : n - 1)) % n);
    },
    { passive: true }
  );

  el.addEventListener('click', (e) => {
    if (e.target.closest('button, [data-interactive], input')) return;
    togglePin();
  });

  Object.assign(el.style, { width: shape.w + 'px', height: shape.h + 'px', top: shape.y + 'px', borderRadius: shape.r + 'px' });
  below.style.display = 'none';
  sendEnvelope(shape.w, shape.h, shape.y, null);

  return {
    el,
    register,
    render,
    peek,
    setHover,
    togglePin,
    selectFeature,
    open,
    configure,
    relang,
    setTint,
    setMaterial,
    setMotion(mode, eco) {
      motionOff = mode === 'off';
      reducedMotion = motionOff || !!eco || mode === 'reduced' || !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
      SPRING = reducedMotion ? { duration: 0.12, ease: 'easeOut' } : { type: 'spring', visualDuration: 0.34, bounce: 0.24 };
      document.documentElement.dataset.motion = motionOff ? 'off' : reducedMotion ? 'reduced' : 'full';
    },
    whenPainted: () => new Promise((resolve, reject) => {
      const until = performance.now() + 5000;
      function painted() {
        if (current && current.el.parentNode === stage && !animating && Number(getComputedStyle(stage).opacity) > .98) {
          requestAnimationFrame(() => requestAnimationFrame(resolve)); return;
        }
        if (performance.now() > until) { reject(new Error('Island first paint timed out')); return; }
        requestAnimationFrame(painted);
      }
      document.fonts.ready.then(painted);
    }),
    isExpanded: () => hovered || pinned,
    hold,
    selectedId: () => {
      const list = expandable();
      return list[Math.min(selected, list.length - 1)] ? list[Math.min(selected, list.length - 1)].id : null;
    },
    isSliver: () => !!(current && current.sliver),
    feature: (id) => features.find((f) => f.id === id),
    setContext: (id) => (contextPanel = id || null),
    /** For tests and the dev preview. */
    debug: () => ({
      key: current && current.key,
      mode: current && current.mode,
      hovered,
      pointer,
      pinned,
      animating,
      shape: { ...shape },
      below: belowShape,
      stats: { ...stats },
      motion: !!M,
      reducedMotion,
    }),
  };
})();

/**
 * Island core: a spring-animated pill that shows one "view" at a time.
 *
 * A feature registers { id, icon, priority(), view(mode) } where mode is
 *   'compact'  - resting state (shown while the feature has the highest priority)
 *   'peek'     - short transient popup (Island.peek)
 *   'expanded' - full panel while hovered or pinned
 * and view() returns { el, w, h } or null. Elements are built once and updated in place.
 *
 * Auto-hide: after a few seconds a compact view shrinks to a thin line at the top edge, so the island
 * does not sit on top of tabs and page content. Hovering the line brings it back.
 *
 * The animation loop only runs while the size is actually changing, so an idle island costs no CPU.
 */
const Island = (() => {
  const el = $('#island');
  const stage = $('#content');
  const features = [];

  const FOOTER = 22; // room for the tab dots below the panel's content
  const TOP = 8; // gap above the island
  const AUTO_HIDE_MS = 5000;
  const HOVER_DWELL_MS = 280; // pointer must rest on the island before it opens (avoids accidental opens)
  const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const STIFFNESS = reducedMotion ? 900 : 320;
  const DAMPING = reducedMotion ? 60 : 26; // ~0.73 damping ratio: a touch of overshoot, settles fast

  const spring = (x) => ({ x, v: 0, t: x });
  const S = { w: spring(90), h: spring(22), y: spring(TOP) };
  let raf = 0;
  let lastFrame = 0;

  let hovered = false; // pointer has rested on the island long enough to open it
  let pointer = false; // pointer is over the island right now
  let pinned = false;
  let held = false; // keep open regardless of the pointer (e.g. while typing)
  let userChoseAt = 0; // when the user last picked a panel themselves
  let selected = 0;
  let peekState = null;
  let current = null;
  let autoHide = (window.islandAPI && window.islandAPI.settings.autoHide) || 'auto';
  let compactKey = null;
  let compactSince = 0;
  let swapTimer = 0;
  let hoverTimer = 0;
  let pinTimer = 0;

  const dots = h('div', { class: 'dots' });
  // Off-screen box used to measure a panel's natural height before it is shown.
  const meter = h('div', { id: 'measure' });
  document.body.appendChild(meter);
  const sliverEl = h('div', { class: 'view sliver' });

  // The window is only as big as the island (plus room for its shadow), so it never covers anything else.
  // Before an animation it grows to fit both the old and new size; once the spring settles it is trimmed.
  const GUTTER = 18;
  const OVERSHOOT = 1.08;
  let lastEnvelope = '';
  function sendEnvelope(w, hgt, y) {
    const env = { w: Math.ceil(w + 2 * GUTTER), h: Math.ceil(y + hgt + GUTTER) };
    const key = env.w + 'x' + env.h;
    if (key === lastEnvelope) return;
    lastEnvelope = key;
    API.send('island:envelope', env);
  }

  function apply() {
    el.style.width = S.w.x + 'px';
    el.style.height = S.h.x + 'px';
    el.style.top = S.y.x + 'px';
    el.style.borderRadius = Math.min(S.h.x / 2, 34) + 'px';
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

  function step(now) {
    const dt = Math.min(0.032, (now - lastFrame) / 1000);
    lastFrame = now;
    let moving = false;
    for (const s of [S.w, S.h, S.y]) {
      s.v += (-STIFFNESS * (s.x - s.t) - DAMPING * s.v) * dt;
      s.x += s.v * dt;
      if (Math.abs(s.x - s.t) > 0.15 || Math.abs(s.v) > 0.4) moving = true;
      else {
        s.x = s.t;
        s.v = 0;
      }
    }
    apply();
    if (moving) raf = requestAnimationFrame(step);
    else {
      raf = 0;
      sendEnvelope(S.w.t, S.h.t, S.y.t); // trim the window to the final size
    }
  }

  function setTarget(w, hgt, y) {
    sendEnvelope(Math.max(S.w.x, w) * OVERSHOOT, Math.max(S.h.x, hgt) * OVERSHOOT, Math.max(S.y.x, y));
    S.w.t = w;
    S.h.t = hgt;
    S.y.t = y;
    if (!raf) {
      lastFrame = performance.now();
      raf = requestAnimationFrame(step);
    }
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
      return { key: 'x:' + f.id, el: v.el, w: v.w, h: heightOf(v) + (list.length > 1 ? FOOTER : 0), y: TOP, withDots: list.length > 1, auto: !!v.auto };
    }
    if (peekState && Date.now() < peekState.until) {
      compactKey = null;
      const f = peekState.feature;
      const v = f.view('peek') || f.view('expanded');
      if (v) return { key: 'p:' + f.id, el: v.el, w: v.w, h: heightOf(v), y: TOP, auto: !!v.auto };
    }

    const f = bestCompact(autoHide === 'never');
    sliverEl.classList.toggle('active', !!bestCompact(false));
    if (f && autoHide !== 'always') {
      const key = 'c:' + f.id;
      if (key !== compactKey) {
        compactKey = key;
        compactSince = Date.now();
        if (autoHide === 'auto') setTimeout(render, AUTO_HIDE_MS + 40);
      }
      if (autoHide === 'never' || Date.now() - compactSince < AUTO_HIDE_MS) {
        const v = f.view('compact');
        return { key, el: v.el, w: v.w, h: v.h, y: TOP };
      }
    }
    return { key: 'sliver', el: sliverEl, w: 84, h: 5, y: 0, sliver: true };
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
    if (v.auto) resizer.observe(v.el);
    stage.style.width = v.w + 'px';
    stage.style.height = v.h + 'px';
    const kids = [v.el];
    if (v.withDots) {
      renderDots();
      kids.push(dots);
    }
    stage.replaceChildren(...kids);
    el.classList.toggle('sliver', !!v.sliver);
    // replay the entrance animation (fade + scale + staggered children)
    v.el.classList.remove('enter');
    void v.el.offsetWidth;
    v.el.classList.add('enter');
  }

  function render() {
    renderNow();
    for (const f of features) if (f.sync) f.sync();
  }

  function renderNow() {
    const v = resolve();
    if (!v) return;
    if (current && current.key === v.key) {
      if (current.w !== v.w || current.h !== v.h) {
        setTarget(v.w, v.h, v.y);
        stage.style.width = v.w + 'px';
        stage.style.height = v.h + 'px';
      }
      const dotsChanged = v.withDots && dots.childElementCount !== expandable().length;
      current = v;
      if (dotsChanged) renderDots();
      return;
    }
    const first = !current;
    current = v;
    setTarget(v.w, v.h, v.y);
    if (first) {
      mount(v);
      return;
    }
    stage.classList.add('out');
    clearTimeout(swapTimer);
    swapTimer = setTimeout(() => {
      mount(current);
      stage.classList.remove('out');
    }, 110);
  }

  function select(i) {
    selected = i;
    userChoseAt = Date.now();
    render();
  }

  // Context: open on what matters now (a meeting about to start, the running timer, the song playing...),
  // unless the user picked a panel themselves in the last minute.
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
      }, HOVER_DWELL_MS);
    } else {
      hoverTimer = setTimeout(() => {
        if (held) return;
        hovered = false;
        render();
      }, 240);
      armPinTimeout(4000);
    }
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
    if (opts.autoHide) {
      autoHide = opts.autoHide;
      compactKey = null;
      render();
    }
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

  apply();
  sendEnvelope(S.w.x, S.h.x, S.y.x);

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
    isExpanded: () => hovered || pinned,
    hold,
    selectedId: () => {
      const list = expandable();
      return list[Math.min(selected, list.length - 1)] ? list[Math.min(selected, list.length - 1)].id : null;
    },
    isSliver: () => !!(current && current.sliver),
    feature: (id) => features.find((f) => f.id === id),
  };
})();

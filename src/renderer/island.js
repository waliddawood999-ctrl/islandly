/**
 * Island core: a spring-animated pill that shows one "view" at a time.
 *
 * A feature registers { id, icon, priority(), view(mode) } where mode is
 *   'compact'  - resting state (shown when the feature has the highest priority)
 *   'peek'     - short transient popup (Island.peek)
 *   'expanded' - full panel while hovered or pinned
 * and view() returns { el, w, h } or null. Elements are built once and updated in place.
 *
 * The animation loop only runs while the size is actually changing, so an idle island costs no CPU.
 */
const Island = (() => {
  const el = $('#island');
  const stage = $('#content');
  const features = [];

  const FOOTER = 26; // room for the tab dots in expanded mode
  const STIFFNESS = 320;
  const DAMPING = 26; // ~0.73 damping ratio: a touch of overshoot, settles fast

  const size = { w: { x: 90, v: 0, t: 90 }, h: { x: 22, v: 0, t: 22 } };
  let raf = 0;
  let lastFrame = 0;

  let hovered = false;
  let pinned = false;
  let selected = 0;
  let peekState = null;
  let current = null;
  let swapTimer = 0;
  let hoverTimer = 0;
  let pinTimer = 0;

  const dots = h('div', { class: 'dots' });

  function apply() {
    el.style.width = size.w.x + 'px';
    el.style.height = size.h.x + 'px';
    el.style.borderRadius = Math.min(size.h.x / 2, 34) + 'px';
  }

  function step(now) {
    const dt = Math.min(0.032, (now - lastFrame) / 1000);
    lastFrame = now;
    let moving = false;
    for (const s of [size.w, size.h]) {
      s.v += (-STIFFNESS * (s.x - s.t) - DAMPING * s.v) * dt;
      s.x += s.v * dt;
      if (Math.abs(s.x - s.t) > 0.15 || Math.abs(s.v) > 0.4) moving = true;
      else {
        s.x = s.t;
        s.v = 0;
      }
    }
    apply();
    raf = moving ? requestAnimationFrame(step) : 0;
  }

  function setTarget(w, hgt) {
    size.w.t = w;
    size.h.t = hgt;
    if (!raf) {
      lastFrame = performance.now();
      raf = requestAnimationFrame(step);
    }
  }

  const expandable = () => features.filter((f) => f.view('expanded'));

  function resolve() {
    if (hovered || pinned) {
      const list = expandable();
      if (!list.length) return null;
      selected = Math.min(selected, list.length - 1);
      const f = list[selected];
      const v = f.view('expanded');
      return { key: 'x:' + f.id, el: v.el, w: v.w, h: v.h + FOOTER, withDots: list.length > 1 };
    }
    if (peekState && Date.now() < peekState.until) {
      const f = peekState.feature;
      const v = f.view('peek') || f.view('expanded');
      if (v) return { key: 'p:' + f.id, el: v.el, w: v.w, h: v.h };
    }
    let best = null;
    let bestPriority = 0;
    for (const f of features) {
      const p = f.priority();
      if (p > bestPriority && f.view('compact')) {
        best = f;
        bestPriority = p;
      }
    }
    if (!best) return null;
    const v = best.view('compact');
    return { key: 'c:' + best.id, el: v.el, w: v.w, h: v.h };
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

  function mount(v) {
    stage.style.width = v.w + 'px';
    stage.style.height = v.h + 'px';
    const kids = [v.el];
    if (v.withDots) {
      renderDots();
      kids.push(dots);
    }
    stage.replaceChildren(...kids);
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
        setTarget(v.w, v.h);
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
    setTarget(v.w, v.h);
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

  function setHover(value) {
    clearTimeout(hoverTimer);
    clearTimeout(pinTimer);
    if (value) {
      hoverTimer = setTimeout(() => {
        hovered = true;
        render();
      }, 70);
    } else {
      hoverTimer = setTimeout(() => {
        hovered = false;
        render();
      }, 240);
      // A pinned island closes by itself a few seconds after the pointer leaves.
      if (pinned) {
        pinTimer = setTimeout(() => {
          pinned = false;
          render();
        }, 4000);
      }
    }
  }

  function togglePin() {
    pinned = !pinned;
    if (pinned) hovered = true;
    render();
  }

  function selectFeature(id) {
    const i = expandable().findIndex((f) => f.id === id);
    if (i >= 0) selected = i;
  }

  // Wheel over the island switches between panels.
  let wheelLock = 0;
  el.addEventListener(
    'wheel',
    (e) => {
      if (!(hovered || pinned) || Date.now() < wheelLock) return;
      const n = expandable().length;
      if (n < 2) return;
      wheelLock = Date.now() + 260;
      select((selected + (e.deltaY > 0 ? 1 : n - 1)) % n);
    },
    { passive: true }
  );

  el.addEventListener('click', (e) => {
    if (e.target.closest('button, [data-interactive]')) return;
    togglePin();
  });

  apply();

  return {
    el,
    register,
    render,
    peek,
    setHover,
    togglePin,
    selectFeature,
    isExpanded: () => hovered || pinned,
    feature: (id) => features.find((f) => f.id === id),
  };
})();

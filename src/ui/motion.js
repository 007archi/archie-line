// Motion: interactive glass, scroll reveals, screen transitions, parallax shapes, page-load intro,
// count-up numbers, bursts and confetti. Only transform/opacity are animated (GPU-friendly), every
// pointer/scroll handler is batched into one requestAnimationFrame, and "reduce motion" turns it all off.

export const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches;

// ------------------------------------------------------------------ count-up numbers
const lastValues = new Map();
/** Animate every [data-count] number from its previous value to the new one. */
export function countUp(root) {
  for (const el of root.querySelectorAll('[data-count]')) {
    const key = el.dataset.count;
    const to = Number(el.dataset.value);
    const from = lastValues.get(key) ?? 0;
    lastValues.set(key, to);
    if (reduced() || from === to) { el.textContent = el.dataset.text ?? to; continue; }
    const pad = el.dataset.pad ? Number(el.dataset.pad) : 0;
    const start = performance.now();
    const dur = 900;
    const step = (now) => {
      const p = Math.min(1, (now - start) / dur);
      const eased = 1 - (1 - p) ** 5;
      const v = Math.round(from + (to - from) * eased);
      el.textContent = String(v).padStart(pad, '0');
      if (p < 1) requestAnimationFrame(step);
      else el.textContent = el.dataset.text ?? String(to).padStart(pad, '0');
    };
    requestAnimationFrame(step);
  }
}

// ------------------------------------------------------------------ celebration
export function burst(fromEl) {
  if (reduced() || !fromEl) return;
  const r = fromEl.getBoundingClientRect();
  const host = document.createElement('div');
  host.className = 'burst';
  host.style.left = `${r.left + r.width / 2}px`;
  host.style.top = `${r.top + r.height / 2}px`;
  for (let i = 0; i < 12; i++) {
    const s = document.createElement('i');
    s.style.setProperty('--a', `${(360 / 12) * i + Math.random() * 15}deg`);
    s.style.setProperty('--d', `${26 + Math.random() * 20}px`);
    host.append(s);
  }
  document.body.append(host);
  setTimeout(() => host.remove(), 800);
}

export function confetti() {
  if (reduced()) return;
  const host = document.createElement('div');
  host.className = 'confetti';
  const colors = ['#baff29', '#1a1b41', '#f1ffe7', '#6290c3', '#ff5468'];
  for (let i = 0; i < 46; i++) {
    const p = document.createElement('i');
    p.style.left = `${Math.random() * 100}%`;
    p.style.background = colors[i % colors.length];
    p.style.setProperty('--x', `${(Math.random() - 0.5) * 140}px`);
    p.style.setProperty('--r', `${Math.random() * 720 - 360}deg`);
    p.style.animationDelay = `${Math.random() * 0.25}s`;
    p.style.animationDuration = `${1.2 + Math.random() * 0.9}s`;
    host.append(p);
  }
  document.body.append(host);
  setTimeout(() => host.remove(), 2700);
}

// ------------------------------------------------------------------ tab indicator
export function moveTabIndicator() {
  const nav = document.querySelector('.tabs');
  const cur = nav?.querySelector('[aria-current="page"]');
  const ind = nav?.querySelector('.tab-ind');
  if (!cur || !ind) return;
  const n = nav.getBoundingClientRect();
  const c = cur.getBoundingClientRect();
  const x = c.left - n.left;
  if (ind.dataset.x && Number(ind.dataset.x) !== x && !reduced()) {
    ind.classList.remove('squash'); void ind.offsetWidth; ind.classList.add('squash'); // stretch while travelling
  }
  ind.dataset.x = String(x);
  ind.style.width = `${c.width}px`;
  ind.style.transform = `translateX(${x}px)`;
}

// ------------------------------------------------------------------ interactive glass
// Cards light up where the pointer or finger is, tilt slightly under a mouse, and ripple when pressed.
const GLASS = '.card, .tile, .lib-chip, .priority';
export function initInteractiveGlass() {
  let active = null;
  let last = null;
  let raf = 0;

  const paint = () => {
    raf = 0;
    if (!active || !last || !active.isConnected) return;
    const r = active.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (last.clientX - r.left) / r.width));
    const y = Math.min(1, Math.max(0, (last.clientY - r.top) / r.height));
    active.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`);
    active.style.setProperty('--my', `${(y * 100).toFixed(1)}%`);
    if (finePointer() && !reduced() && !active.matches('.lib-chip, .priority')) {
      active.style.setProperty('--rx', `${((0.5 - y) * 7).toFixed(2)}deg`);
      active.style.setProperty('--ry', `${((x - 0.5) * 7).toFixed(2)}deg`);
    }
  };
  const release = (el) => {
    el.classList.remove('glow');
    el.style.removeProperty('--rx');
    el.style.removeProperty('--ry');
  };
  const track = (e) => {
    const el = e.target.closest?.(GLASS) ?? null;
    if (el !== active) {
      if (active) release(active);
      active = el;
      el?.classList.add('glow');
    }
    last = e;
    if (!raf) raf = requestAnimationFrame(paint);
  };

  document.addEventListener('pointermove', track, { passive: true });
  document.addEventListener('pointerdown', (e) => {
    track(e);
    if (active && !reduced()) ripple(active, e);
  }, { passive: true });
  const end = (e) => { if (e.pointerType !== 'mouse' && active) { release(active); active = null; } };
  document.addEventListener('pointerup', end, { passive: true });
  document.addEventListener('pointercancel', end, { passive: true });
  document.addEventListener('pointerout', (e) => { if (!e.relatedTarget && active) { release(active); active = null; } }, { passive: true });
}

function ripple(el, e) {
  const r = el.getBoundingClientRect();
  const size = Math.max(r.width, r.height) * 1.4;
  const s = document.createElement('span');
  s.className = 'ripple';
  s.style.width = s.style.height = `${size}px`;
  s.style.left = `${e.clientX - r.left - size / 2}px`;
  s.style.top = `${e.clientY - r.top - size / 2}px`;
  el.append(s);
  setTimeout(() => s.remove(), 750);
}

// ------------------------------------------------------------------ magnetic floating button
export function initMagnet() {
  let raf = 0;
  let ev = null;
  document.addEventListener('pointermove', (e) => {
    if (!finePointer() || reduced()) return;
    ev = e;
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      const fab = document.querySelector('.fab');
      if (!fab) return;
      const r = fab.getBoundingClientRect();
      const dx = ev.clientX - (r.left + r.width / 2);
      const dy = ev.clientY - (r.top + r.height / 2);
      const dist = Math.hypot(dx, dy);
      const pull = dist < 140 ? (1 - dist / 140) * 0.35 : 0;
      fab.style.setProperty('--fx', `${(dx * pull).toFixed(1)}px`);
      fab.style.setProperty('--fy', `${(dy * pull).toFixed(1)}px`);
    });
  }, { passive: true });
}

// ------------------------------------------------------------------ parallax shapes
// Background shapes drift on their own (CSS) and also shift with scroll and pointer (here).
export function initParallax() {
  const root = document.documentElement;
  let raf = 0;
  let px = 0; let py = 0;
  const apply = () => {
    raf = 0;
    root.style.setProperty('--sy', String(Math.round(window.scrollY)));
    root.style.setProperty('--px', px.toFixed(3));
    root.style.setProperty('--py', py.toFixed(3));
  };
  const queue = () => { if (!raf && !reduced()) raf = requestAnimationFrame(apply); };
  window.addEventListener('scroll', queue, { passive: true });
  window.addEventListener('pointermove', (e) => {
    if (!finePointer()) return;
    px = e.clientX / window.innerWidth - 0.5;
    py = e.clientY / window.innerHeight - 0.5;
    queue();
  }, { passive: true });
}

// ------------------------------------------------------------------ scroll reveals + screen transitions
let io = null;
const REVEAL = ':scope > *:not(.fab):not(.tiles), :scope > .tiles > *, :scope > .bento > *';

/** Elements fade/slide in the first time they scroll into view; ones already visible stagger in. */
export function reveal(root) {
  io?.disconnect();
  if (reduced() || !('IntersectionObserver' in window)) return;
  const els = [...root.querySelectorAll(REVEAL)].filter((el) => !el.matches('.bento'));
  for (const el of els) el.classList.add('reveal');
  io = new IntersectionObserver((entries) => {
    const shown = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
    shown.forEach((e, i) => {
      const el = e.target;
      el.style.transitionDelay = `${Math.min(i, 7) * 70}ms`;
      el.classList.add('in');
      io.unobserve(el);
      setTimeout(() => { el.style.transitionDelay = ''; }, 1200 + i * 70);
    });
  }, { rootMargin: '0px 0px -6% 0px', threshold: 0.06 });
  for (const el of els) io.observe(el);
}

let swapTimer = null;
/**
 * Replace a view's content. When `animate` is set the old content eases out first, then the new
 * content reveals. `after` runs once the new HTML is in place (count-up, celebrations…).
 */
export function swapView(el, html, animate, after) {
  clearTimeout(swapTimer);
  const apply = () => {
    el.classList.remove('leaving');
    el.innerHTML = html;
    if (animate) {
      el.classList.remove('enter'); void el.offsetWidth; el.classList.add('enter');
      reveal(el);
    }
    after?.();
  };
  if (animate && !reduced() && el.childElementCount) {
    el.classList.add('leaving');
    swapTimer = setTimeout(apply, 170);
  } else {
    apply();
  }
}

// ------------------------------------------------------------------ page-load intro
/** Plays the intro once per app launch. Resolves when the app should reveal itself. */
export function playIntro() {
  const intro = document.getElementById('intro');
  if (!intro) return Promise.resolve();
  let seen = false;
  try { seen = sessionStorage.getItem('sd-intro') === '1'; sessionStorage.setItem('sd-intro', '1'); } catch { /* private mode */ }
  if (seen || reduced()) { intro.remove(); return Promise.resolve(); }
  document.body.classList.add('booting');
  return new Promise((resolve) => {
    setTimeout(() => {
      intro.classList.add('out');
      document.body.classList.remove('booting');
      resolve();
      setTimeout(() => intro.remove(), 900);
    }, 1450);
  });
}

// Interactive "starry night" background — a minimal, Van Gogh–inspired sky in the app's palette.
// Two stacked canvases:
//   • paint layer: ~1,000 brush strokes ride a swirling flow field and leave slowly fading trails,
//     so the sky looks painted in curling strokes;
//   • top layer (cleared every frame): glowing stars with pulsing halo rings, a crescent moon,
//     twinkling small stars, rolling hills, a swaying cypress and flickering village windows.
// Interaction: a finger or cursor stirs a vortex into the strokes and brightens nearby stars,
// a tap leaves a swirl that spins out over a few seconds, and scrolling/pointer give parallax.

const STROKE_COLORS = ['#2f4f8f', '#4369a8', '#6290c3', '#8fb0e6', '#c2e7da', '#e8f6ff'];
const GLOW_COLORS = ['#f4ffb0', '#d9ff70', '#baff29'];

let root = null;
let paint = null; let pctx = null;
let top = null; let tctx = null;
let raf = 0;
let running = false;
let W = 0; let H = 0; let DPR = 1;          // top layer size (device px)
let PW = 0; let PH = 0;                      // paint layer size (CSS px; softer and cheaper)
let particles = [];
let stars = [];
let dust = [];
let windows = [];
let vortices = [];
let taps = [];
let time = 0;
let last = 0;
let fadeGrad = null;
const pointer = { x: -1e4, y: -1e4, sx: -1e4, sy: -1e4, tx: 0, ty: 0, px: 0, py: 0, power: 0, target: 0, down: false };

const rand = (a, b) => a + Math.random() * (b - a);
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const horizon = () => PH * 0.74;

// ------------------------------------------------------------------ scene setup
function build() {
  DPR = Math.min(2, window.devicePixelRatio || 1);
  const cw = window.innerWidth;
  const ch = window.innerHeight;
  W = top.width = Math.round(cw * DPR);
  H = top.height = Math.round(ch * DPR);
  PW = paint.width = Math.round(cw);
  PH = paint.height = Math.round(ch);

  // big, slow swirls — the signature of the sky
  vortices = [
    { x: 0.34, y: 0.28, r: 0.22, s: 0.8 },
    { x: 0.66, y: 0.5, r: 0.24, s: -0.6 },
  ];

  const n = Math.round(Math.min(480, Math.max(220, (cw * ch) / 1200))); // minimal: a few hundred strokes
  particles = Array.from({ length: n }, () => spawn({}));

  // large stars with halos (positions relative to the viewport)
  stars = [
    [0.16, 0.14, 3.5], [0.46, 0.2, 4.5], [0.24, 0.48, 3], [0.88, 0.36, 3.5], [0.62, 0.62, 3],
  ].map(([x, y, r], i) => ({ x, y, r, phase: Math.random() * 6.28, color: GLOW_COLORS[i % GLOW_COLORS.length], red: i === 3 }));

  dust = Array.from({ length: Math.round(n * 0.35) }, () => ({ x: Math.random(), y: Math.random() * 0.72, s: rand(0.6, 1.6), p: Math.random() * 6.28 }));

  // village windows along the lower hill
  windows = []; // minimal version: no village

  fadeGrad = pctx.createLinearGradient(0, 0, 0, PH);
  fadeGrad.addColorStop(0, '#0d1240');
  fadeGrad.addColorStop(0.6, '#142a66');
  fadeGrad.addColorStop(1, '#0a0f2c');
  pctx.globalAlpha = 1;
  pctx.fillStyle = fadeGrad;
  pctx.fillRect(0, 0, PW, PH);
}

function spawn(p) {
  p.x = Math.random() * PW;
  p.y = Math.random() * horizon();
  p.life = rand(60, 220);
  p.c = Math.floor(Math.random() * STROKE_COLORS.length);
  p.w = rand(1.2, 3.2);
  return p;
}

// ------------------------------------------------------------------ flow field
function velocity(x, y) {
  const t = time * 0.00018;
  // a gentle rolling current from left to right
  const a = Math.sin(y * 0.006 + t) * 0.7 + Math.cos(x * 0.004 - t * 1.3) * 0.4;
  let vx = Math.cos(a) * 0.55 + 0.25;
  let vy = Math.sin(a) * 0.35;
  const add = (cx, cy, r, s) => {
    const dx = x - cx;
    const dy = y - cy;
    const d2 = dx * dx + dy * dy;
    const k = Math.exp(-d2 / (r * r)) * s;
    const d = Math.sqrt(d2) + 1;
    vx += (-dy / d) * k * 2.2;
    vy += (dx / d) * k * 2.2;
  };
  for (const v of vortices) add(v.x * PW, v.y * PH, v.r * Math.min(PW, PH) * 1.4, v.s);
  if (pointer.power > 0.02) add(pointer.sx / DPR, pointer.sy / DPR, 110, 1.6 * pointer.power);
  for (const tp of taps) add(tp.x, tp.y, tp.r, tp.s);
  return [vx, vy];
}

// ------------------------------------------------------------------ drawing
function drawPaint(dt) {
  // fade older strokes toward the night-sky gradient → trails
  pctx.globalCompositeOperation = 'source-over';
  pctx.globalAlpha = 0.07; // shorter trails
  pctx.fillStyle = fadeGrad;
  pctx.fillRect(0, 0, PW, PH);

  pctx.globalAlpha = 0.2;  // faint strokes
  pctx.lineCap = 'round';
  const step = Math.min(2.4, dt / 16);
  const hz = horizon();
  // one path per colour keeps it fast
  for (let c = 0; c < STROKE_COLORS.length; c++) {
    pctx.strokeStyle = STROKE_COLORS[c];
    for (const wv of [1.4, 2.6]) {
      pctx.lineWidth = wv;
      pctx.beginPath();
      for (const p of particles) {
        if (p.c !== c || (p.w < 2 ? 1.4 : 2.6) !== wv) continue;
        const [vx, vy] = velocity(p.x, p.y);
        const nx = p.x + vx * step * 0.9;
        const ny = p.y + vy * step * 0.9;
        pctx.moveTo(p.x, p.y);
        pctx.lineTo(nx, ny);
        p.x = nx; p.y = ny;
        p.life -= step;
        if (p.life <= 0 || nx < -10 || nx > PW + 10 || ny < -10 || ny > hz) spawn(p);
      }
      pctx.stroke();
    }
  }
}

function halo(x, y, r, color, strength, pulse) {
  const g = tctx.createRadialGradient(x, y, 0, x, y, r * 5 * strength);
  g.addColorStop(0, color);
  g.addColorStop(0.18, 'rgba(244,255,176,0.55)');
  g.addColorStop(0.5, 'rgba(186,255,41,0.12)');
  g.addColorStop(1, 'rgba(186,255,41,0)');
  tctx.fillStyle = g;
  tctx.beginPath();
  tctx.arc(x, y, r * 5 * strength, 0, Math.PI * 2);
  tctx.fill();
  // painted concentric rings
  tctx.lineWidth = 1.4 * DPR;
  for (let k = 1; k <= 1; k++) { // one quiet ring
    tctx.strokeStyle = `rgba(217,255,112,${(0.22 / k) * strength})`;
    tctx.beginPath();
    tctx.arc(x, y, r * (2.2 + k * 1.5 + pulse * 0.6) * strength, 0, Math.PI * 2);
    tctx.stroke();
  }
  tctx.fillStyle = '#fbffe6';
  tctx.beginPath();
  tctx.arc(x, y, r * 0.9, 0, Math.PI * 2);
  tctx.fill();
}

function drawTop() {
  tctx.clearRect(0, 0, W, H);
  const scroll = window.scrollY;
  const ox = pointer.px * 14 * DPR;
  const oy = pointer.py * 10 * DPR - scroll * 0.05 * DPR;

  tctx.globalCompositeOperation = 'lighter';
  // twinkling dust stars
  for (const d of dust) {
    const tw = 0.5 + 0.5 * Math.sin(time * 0.002 + d.p);
    tctx.globalAlpha = 0.2 + 0.7 * tw;
    tctx.fillStyle = '#eef6ff';
    tctx.fillRect(d.x * W + ox * 0.5, d.y * H + oy * 0.5, d.s * DPR, d.s * DPR);
  }

  // big stars: pulse, and brighten when the pointer is near
  for (const s of stars) {
    const x = s.x * W + ox;
    const y = s.y * H + oy;
    const near = Math.max(0, 1 - Math.hypot(x - pointer.sx, y - pointer.sy) / (180 * DPR)) * pointer.power;
    const pulse = 0.5 + 0.5 * Math.sin(time * 0.0016 + s.phase);
    tctx.globalAlpha = 0.85;
    halo(x, y, s.r * DPR, s.red ? '#ffd3d9' : s.color, 0.8 + pulse * 0.15 + near * 0.9, pulse);
    if (s.red) {
      tctx.globalAlpha = 0.35 + 0.25 * pulse;
      tctx.fillStyle = 'rgba(255,84,104,0.9)';
      tctx.beginPath(); tctx.arc(x, y, s.r * 2.2 * DPR, 0, Math.PI * 2); tctx.fill();
    }
  }

  // crescent moon, top right
  const mx = W * 0.84 + ox * 1.2;
  const my = H * 0.13 + oy * 1.2;
  const mr = Math.min(W, H) * 0.06;
  tctx.globalAlpha = 0.9;
  halo(mx, my, mr / 2.6, '#f7ffd0', 1.3, 0.5 + 0.5 * Math.sin(time * 0.001));
  tctx.globalCompositeOperation = 'source-over';
  tctx.globalAlpha = 1;
  tctx.fillStyle = '#f2ffc2';
  tctx.beginPath();
  tctx.arc(mx, my, mr, 0, Math.PI * 2);
  tctx.arc(mx + mr * 0.42, my - mr * 0.22, mr * 0.86, 0, Math.PI * 2, true);
  tctx.fill('evenodd');

  // a single faint horizon line (minimal)
  const hillShift = -scroll * 0.08 * DPR;
  tctx.globalCompositeOperation = 'source-over';
  tctx.globalAlpha = 0.9;
  tctx.fillStyle = '#0a1030';
  tctx.beginPath();
  tctx.moveTo(0, H * 0.86 + hillShift);
  tctx.bezierCurveTo(W * 0.3, H * 0.82 + hillShift, W * 0.65, H * 0.9 + hillShift, W, H * 0.84 + hillShift);
  tctx.lineTo(W, H); tctx.lineTo(0, H); tctx.closePath(); tctx.fill();
  tctx.globalAlpha = 1;

  // tap swirls: a fading painted ring
  tctx.globalCompositeOperation = 'lighter';
  for (const tp of taps) {
    tctx.globalAlpha = Math.max(0, tp.s / 2.4) * 0.5;
    tctx.strokeStyle = '#c2e7da';
    tctx.lineWidth = 1.5 * DPR;
    tctx.beginPath();
    tctx.arc(tp.x * DPR, tp.y * DPR, tp.ring * DPR, 0, Math.PI * 2);
    tctx.stroke();
  }
  tctx.globalAlpha = 1;
  tctx.globalCompositeOperation = 'source-over';
}

function step(dt) {
  time += dt;
  pointer.sx += (pointer.x - pointer.sx) * 0.2;
  pointer.sy += (pointer.y - pointer.sy) * 0.2;
  pointer.px += (pointer.tx - pointer.px) * 0.05;
  pointer.py += (pointer.ty - pointer.py) * 0.05;
  pointer.power += (pointer.target - pointer.power) * 0.07;
  for (let i = taps.length - 1; i >= 0; i--) {
    const tp = taps[i];
    tp.s *= 0.985;
    tp.ring += dt * 0.12;
    if (tp.s < 0.05) taps.splice(i, 1);
  }
  drawPaint(dt);
  drawTop();
}

function loop(now) {
  if (!running) return;
  raf = requestAnimationFrame(loop);
  const dt = Math.min(40, now - (last || now));
  last = now;
  step(dt);
}

// ------------------------------------------------------------------ input
function onMove(e) {
  pointer.x = e.clientX * DPR;
  pointer.y = e.clientY * DPR;
  pointer.tx = e.clientX / window.innerWidth - 0.5;
  pointer.ty = e.clientY / window.innerHeight - 0.5;
  if (e.pointerType === 'mouse' || pointer.down) pointer.target = 1;
}
function onDown(e) {
  pointer.down = true;
  onMove(e);
  pointer.sx = pointer.x; pointer.sy = pointer.y;
  if (taps.length < 4) taps.push({ x: e.clientX, y: e.clientY, r: 150, s: (Math.random() < 0.5 ? -1 : 1) * 2.4, ring: 6 });
}
function onUp(e) { pointer.down = false; if (e.pointerType !== 'mouse') pointer.target = 0; }
function onLeave() { pointer.target = 0; pointer.tx = 0; pointer.ty = 0; }
let resizeTimer;
function onResize() { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { if (root) { build(); prewarm(); } }, 150); }
function onVisibility() {
  if (!root) return;
  if (document.hidden) { running = false; cancelAnimationFrame(raf); }
  else if (!reduced() && !running) { running = true; last = 0; raf = requestAnimationFrame(loop); }
}

/** Run the simulation briefly so the sky opens already painted, not empty. */
function prewarm() { for (let i = 0; i < 90; i++) step(16); }

// ------------------------------------------------------------------ public API
export function startStarryNight() {
  if (root) return;
  root = document.createElement('div');
  root.className = 'galaxy starry';
  root.setAttribute('aria-hidden', 'true');
  paint = document.createElement('canvas');
  top = document.createElement('canvas');
  root.append(paint, top);
  document.body.prepend(root);
  pctx = paint.getContext('2d', { alpha: false });
  tctx = top.getContext('2d');
  build();
  prewarm();
  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('pointerdown', onDown, { passive: true });
  window.addEventListener('pointerup', onUp, { passive: true });
  window.addEventListener('pointercancel', onUp, { passive: true });
  document.addEventListener('pointerleave', onLeave);
  window.addEventListener('resize', onResize);
  document.addEventListener('visibilitychange', onVisibility);
  requestAnimationFrame(() => root?.classList.add('on'));
  if (!reduced()) { running = true; last = 0; raf = requestAnimationFrame(loop); }
}

export function stopStarryNight() {
  if (!root) return;
  running = false;
  cancelAnimationFrame(raf);
  window.removeEventListener('pointermove', onMove);
  window.removeEventListener('pointerdown', onDown);
  window.removeEventListener('pointerup', onUp);
  window.removeEventListener('pointercancel', onUp);
  document.removeEventListener('pointerleave', onLeave);
  window.removeEventListener('resize', onResize);
  document.removeEventListener('visibilitychange', onVisibility);
  const el = root;
  root = null; paint = null; top = null; pctx = null; tctx = null;
  el.classList.remove('on');
  setTimeout(() => el.remove(), 1400);
}

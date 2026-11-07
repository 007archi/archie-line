// Small wake-up activities that switch an alarm off. Each mounts into an element and calls done() when finished.

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export const ACTIVITY_IDS = ['breathe', 'tap', 'math', 'type', 'memory', 'countup', 'scale', 'scramble', 'trace'];
export const resolveActivity = (id) => (id && id !== 'random' && ACTIVITY_IDS.includes(id) ? id : pick(ACTIVITY_IDS));

function breathe(el, done) {
  const CYCLES = 3;
  let count = 0;
  let downAt = 0;
  let timer;
  el.innerHTML = `
    <p class="act-title">Breathe</p>
    <p class="act-hint">Press and hold the circle while you breathe in. Let go to breathe out.</p>
    <button class="breath" type="button" aria-label="Hold while breathing in"><span class="breath-core">Hold</span></button>
    <div class="act-dots">${'<i></i>'.repeat(CYCLES)}</div>`;
  const btn = el.querySelector('.breath');
  const core = el.querySelector('.breath-core');
  const dots = el.querySelectorAll('.act-dots i');
  const start = (e) => {
    e.preventDefault();
    downAt = performance.now();
    btn.classList.add('inhale');
    core.textContent = 'Breathe in…';
    timer = setTimeout(() => { core.textContent = 'Now let go'; btn.classList.add('ready'); }, 3500);
  };
  const end = () => {
    if (!downAt) return;
    clearTimeout(timer);
    const held = performance.now() - downAt;
    downAt = 0;
    btn.classList.remove('inhale', 'ready');
    if (held >= 3500) {
      dots[count].classList.add('on');
      count += 1;
      core.textContent = count >= CYCLES ? 'Lovely' : 'Breathe out…';
      if (count >= CYCLES) setTimeout(done, 500);
      else setTimeout(() => { core.textContent = 'Hold'; }, 1800);
    } else {
      core.textContent = 'A little longer';
      btn.classList.add('shake');
      setTimeout(() => { btn.classList.remove('shake'); core.textContent = 'Hold'; }, 900);
    }
  };
  btn.addEventListener('pointerdown', start);
  btn.addEventListener('pointerup', end);
  btn.addEventListener('pointerleave', end);
  btn.addEventListener('pointercancel', end);
  btn.addEventListener('contextmenu', (e) => e.preventDefault());
}

function tap(el, done) {
  const TOTAL = 8;
  let hits = 0;
  el.innerHTML = `
    <p class="act-title">Wake your eyes</p>
    <p class="act-hint">Tap the dots as they appear — <b class="act-count">0</b>/${TOTAL}</p>
    <div class="tap-field" aria-live="polite"></div>`;
  const field = el.querySelector('.tap-field');
  const counter = el.querySelector('.act-count');
  const spawn = () => {
    const d = document.createElement('button');
    d.type = 'button';
    d.className = 'tap-dot';
    d.setAttribute('aria-label', 'Tap');
    d.style.left = `${8 + Math.random() * 76}%`;
    d.style.top = `${8 + Math.random() * 76}%`;
    d.addEventListener('pointerdown', () => {
      hits += 1;
      counter.textContent = hits;
      d.classList.add('pop');
      setTimeout(() => d.remove(), 300);
      if (hits >= TOTAL) setTimeout(done, 350);
      else setTimeout(spawn, 120);
    }, { once: true });
    field.append(d);
  };
  spawn();
}

function math(el, done) {
  const make = () => {
    const a = 12 + Math.floor(Math.random() * 60);
    const b = 6 + Math.floor(Math.random() * 30);
    return Math.random() < 0.5 ? { q: `${a} + ${b}`, a: a + b } : { q: `${a + b} − ${b}`, a };
  };
  const qs = [make(), make(), make()];
  let i = 0;
  el.innerHTML = `
    <p class="act-title">Quick sums</p>
    <p class="act-hint">Question <b class="act-count">1</b> of 3</p>
    <form class="act-form"><p class="sum"></p>
      <input inputmode="numeric" pattern="[0-9]*" autocomplete="off" aria-label="Answer">
      <button class="primary-btn" type="submit">Check</button></form>`;
  const form = el.querySelector('form');
  const sum = el.querySelector('.sum');
  const input = form.querySelector('input');
  const counter = el.querySelector('.act-count');
  const show = () => { sum.textContent = `${qs[i].q} = ?`; input.value = ''; input.focus(); counter.textContent = i + 1; };
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (Number(input.value) === qs[i].a) {
      i += 1;
      if (i >= qs.length) { done(); return; }
      sum.classList.remove('nope'); show();
    } else {
      sum.classList.remove('nope'); void sum.offsetWidth; sum.classList.add('nope');
    }
  });
  show();
}

const PHRASES = ['Draw first, decide later', 'Light, section, detail', 'Today I design with intent', 'Good morning, studio', 'One line at a time'];
function type(el, done) {
  const phrase = pick(PHRASES);
  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
  el.innerHTML = `
    <p class="act-title">Type it out</p>
    <p class="act-hint">Copy this phrase exactly:</p>
    <p class="phrase">“${phrase}”</p>
    <input class="phrase-input" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Type the phrase">`;
  const input = el.querySelector('input');
  input.addEventListener('input', () => {
    const ok = norm(input.value) === norm(phrase);
    input.classList.toggle('match', norm(phrase).startsWith(norm(input.value)) && input.value.length > 0);
    if (ok) { input.disabled = true; setTimeout(done, 300); }
  });
  setTimeout(() => input.focus(), 50);
}

const shuffle = (arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const wiggle = (node) => { node.classList.remove('nope'); void node.offsetWidth; node.classList.add('nope'); };

/** Memory grid: watch 4 tiles light up, then tap them back in the same order. */
function memory(el, done) {
  const LEN = 4;
  const seq = Array.from({ length: LEN }, () => Math.floor(Math.random() * 9));
  let pos = 0;
  let busy = true;
  el.innerHTML = `
    <p class="act-title">Memory grid</p>
    <p class="act-hint act-status">Watch the order…</p>
    <div class="mem-grid">${Array.from({ length: 9 }, (_, i) => `<button type="button" class="mem-tile" data-i="${i}" aria-label="Tile ${i + 1}"></button>`).join('')}</div>`;
  const tiles = [...el.querySelectorAll('.mem-tile')];
  const status = el.querySelector('.act-status');
  const flash = (i, cls = 'lit', ms = 420) => { tiles[i].classList.add(cls); setTimeout(() => tiles[i].classList.remove(cls), ms); };
  const playback = () => {
    busy = true; pos = 0; status.textContent = 'Watch the order…';
    seq.forEach((i, k) => setTimeout(() => flash(i), 500 + k * 650));
    setTimeout(() => { busy = false; status.textContent = 'Now tap them in order'; }, 500 + LEN * 650);
  };
  tiles.forEach((t) => t.addEventListener('pointerdown', () => {
    if (busy) return;
    const i = Number(t.dataset.i);
    if (i === seq[pos]) {
      flash(i, 'lit', 220);
      pos += 1;
      if (pos >= LEN) { busy = true; status.textContent = 'Sharp memory'; setTimeout(done, 450); }
    } else {
      flash(i, 'miss', 400);
      status.textContent = 'Not quite — watch again';
      setTimeout(playback, 700);
    }
  }));
  playback();
}

/** Count up: tap 1 to 9 in order on a shuffled grid. */
function countup(el, done) {
  let next = 1;
  el.innerHTML = `
    <p class="act-title">Count up</p>
    <p class="act-hint">Tap 1 to 9 in order — next: <b class="act-count">1</b></p>
    <div class="num-grid">${shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]).map((n) => `<button type="button" class="num-tile" data-n="${n}">${n}</button>`).join('')}</div>`;
  const counter = el.querySelector('.act-count');
  el.querySelectorAll('.num-tile').forEach((b) => b.addEventListener('pointerdown', () => {
    if (Number(b.dataset.n) === next) {
      b.classList.add('done'); b.disabled = true;
      next += 1;
      if (next > 9) setTimeout(done, 350); else counter.textContent = next;
    } else wiggle(b);
  }));
}

/** Scale check: read a drawing at 1:50 / 1:100 / 1:200 / 1:500. Three multiple-choice questions. */
export function scaleQuestion() {
  const scale = pick([50, 100, 200, 500]);
  const cm = pick([1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 6, 7.5, 8]);
  const fmt = (m) => `${Number(m.toFixed(2))} m`;
  const right = (cm * scale) / 100;
  const wrong = shuffle([right * 10, right / 10, (cm * pick([50, 100, 200, 500].filter((s) => s !== scale))) / 100, right * 2])
    .filter((v, i, a) => Math.abs(v - right) > 1e-9 && a.findIndex((x) => Math.abs(x - v) < 1e-9) === i).slice(0, 3);
  return { q: `At 1:${scale}, ${cm} cm on the drawing is…`, options: shuffle([right, ...wrong]).map(fmt), answer: fmt(right) };
}
function scale(el, done) {
  const qs = [scaleQuestion(), scaleQuestion(), scaleQuestion()];
  let i = 0;
  el.innerHTML = `
    <p class="act-title">Scale check</p>
    <p class="act-hint">Question <b class="act-count">1</b> of 3</p>
    <p class="sum scale-q"></p>
    <div class="choice-grid"></div>`;
  const qEl = el.querySelector('.scale-q');
  const grid = el.querySelector('.choice-grid');
  const counter = el.querySelector('.act-count');
  const show = () => {
    counter.textContent = i + 1;
    qEl.textContent = qs[i].q;
    grid.innerHTML = qs[i].options.map((o) => `<button type="button" class="choice">${o}</button>`).join('');
    grid.querySelectorAll('.choice').forEach((b) => b.addEventListener('click', () => {
      if (b.textContent === qs[i].answer) {
        b.classList.add('right');
        i += 1;
        setTimeout(() => (i >= qs.length ? done() : show()), 300);
      } else wiggle(b);
    }));
  };
  show();
}

/** Word scramble: tap the letters of an architecture word in the right order. */
const WORDS = [
  ['LINTEL', 'Beam over a door or window'], ['PLINTH', 'Base a building stands on'], ['TRUSS', 'Triangulated frame for a roof'],
  ['GABLE', 'Triangular wall under a pitched roof'], ['CORBEL', 'Bracket projecting from a wall'], ['ATRIUM', 'Open, top-lit central space'],
  ['DORMER', 'Window poking out of a roof'], ['FACADE', 'The face of a building'], ['PERGOLA', 'Open frame for climbing plants'],
  ['COLUMN', 'Vertical structural support'], ['CORNICE', 'Moulding along the top of a wall'], ['PODIUM', 'Raised base of a tower'],
];
function scramble(el, done) {
  const [word, clue] = pick(WORDS);
  let letters = shuffle([...word].map((ch, i) => ({ ch, i })));
  if (letters.map((l) => l.ch).join('') === word) letters = letters.reverse();
  let typed = '';
  el.innerHTML = `
    <p class="act-title">Word scramble</p>
    <p class="act-hint">${clue}</p>
    <p class="scramble-answer" aria-live="polite">${'_ '.repeat(word.length).trim()}</p>
    <div class="letter-row">${letters.map((l) => `<button type="button" class="letter">${l.ch}</button>`).join('')}</div>`;
  const answer = el.querySelector('.scramble-answer');
  const render = () => { answer.textContent = [...word].map((_, k) => typed[k] ?? '_').join(' '); };
  el.querySelectorAll('.letter').forEach((b) => b.addEventListener('pointerdown', () => {
    if (b.disabled) return;
    if (b.textContent === word[typed.length]) {
      typed += b.textContent; b.disabled = true; b.classList.add('used'); render();
      if (typed === word) setTimeout(done, 400);
    } else wiggle(b);
  }));
}

/** Steady line: trace a dotted house outline with one finger, start to finish. */
function trace(el, done) {
  const W = 280; const H = 240;
  const corners = pick([
    [[40, 210], [40, 110], [140, 40], [240, 110], [240, 210]],               // gable
    [[30, 200], [30, 90], [250, 90], [250, 200], [140, 200], [140, 140]],     // L-plan section
    [[40, 210], [40, 60], [240, 60], [240, 210]],                             // portal frame
  ]);
  const pts = [];
  for (let k = 0; k < corners.length - 1; k++) {
    const [x0, y0] = corners[k]; const [x1, y1] = corners[k + 1];
    const steps = Math.max(2, Math.round(Math.hypot(x1 - x0, y1 - y0) / 12));
    for (let s = 0; s < steps; s++) pts.push([x0 + ((x1 - x0) * s) / steps, y0 + ((y1 - y0) * s) / steps]);
  }
  pts.push(corners[corners.length - 1]);
  const d = `M${corners.map((p) => p.join(' ')).join(' L')}`;
  el.innerHTML = `
    <p class="act-title">Steady line</p>
    <p class="act-hint">Trace the dotted line from the glowing dot to the ring, keeping your finger down.</p>
    <svg class="trace-pad" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-label="Tracing pad">
      <path d="${d}" class="trace-guide"/>
      <polyline class="trace-ink" points=""/>
      <circle cx="${corners[0][0]}" cy="${corners[0][1]}" r="11" class="trace-start"/>
      <circle cx="${corners[corners.length - 1][0]}" cy="${corners[corners.length - 1][1]}" r="9" class="trace-end"/>
    </svg>
    <div class="trace-bar"><i></i></div>`;
  const svgEl = el.querySelector('.trace-pad');
  const ink = el.querySelector('.trace-ink');
  const bar = el.querySelector('.trace-bar i');
  let idx = 0; let drawing = false;
  const local = (e) => { const r = svgEl.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H]; };
  const near = (p, q, tol) => Math.hypot(p[0] - q[0], p[1] - q[1]) <= tol;
  const update = () => { ink.setAttribute('points', pts.slice(0, idx + 1).map((p) => p.join(',')).join(' ')); bar.style.width = `${Math.round((idx / (pts.length - 1)) * 100)}%`; };
  svgEl.addEventListener('pointerdown', (e) => {
    const p = local(e);
    if (near(p, pts[idx], 34)) { drawing = true; svgEl.setPointerCapture(e.pointerId); }
  });
  svgEl.addEventListener('pointermove', (e) => {
    if (!drawing) return;
    const p = local(e);
    while (idx < pts.length - 1 && near(p, pts[idx + 1], 30)) idx += 1;
    update();
    if (idx >= pts.length - 1) { drawing = false; svgEl.classList.add('done'); setTimeout(done, 400); }
  });
  const lift = () => { drawing = false; };
  svgEl.addEventListener('pointerup', lift);
  svgEl.addEventListener('pointercancel', lift);
  svgEl.style.touchAction = 'none';
  update();
}

export function mountActivity(id, el, done) {
  ({ breathe, tap, math, type, memory, countup, scale, scramble, trace })[id](el, done);
}

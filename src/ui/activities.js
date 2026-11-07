// Small wake-up activities that switch an alarm off. Each mounts into an element and calls done() when finished.

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export const ACTIVITY_IDS = ['breathe', 'tap', 'math', 'type'];
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

export function mountActivity(id, el, done) {
  ({ breathe, tap, math, type })[id](el, done);
}

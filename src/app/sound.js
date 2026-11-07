// Alarm sound made with Web Audio (no audio files). Browsers only allow sound after a tap,
// so `unlock()` runs on the first tap anywhere in the app; after that an alarm can ring by itself
// while the app stays open (Bedside mode keeps it open overnight).

let ctx = null;
let loop = null;

export function unlock() {
  try {
    ctx ??= new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    // a silent blip fully unlocks iOS
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    g.gain.value = 0;
    o.connect(g).connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + 0.02);
  } catch { /* no audio available */ }
}
export const canPlay = () => Boolean(ctx && ctx.state === 'running');

function chirp(t, freq, dur, vol) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'triangle';
  o.frequency.setValueAtTime(freq, t);
  o.frequency.exponentialRampToValueAtTime(freq * 1.5, t + dur * 0.6);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t); o.stop(t + dur + 0.05);
}

/** Bright rising three-note pattern, repeating and slowly getting louder. */
export function startRinging() {
  if (!ctx) unlock();
  if (!ctx || loop) return;
  let round = 0;
  const play = () => {
    const vol = Math.min(0.9, 0.25 + round * 0.08);
    const t = ctx.currentTime + 0.05;
    [660, 880, 1175].forEach((f, i) => chirp(t + i * 0.16, f, 0.22, vol));
    navigator.vibrate?.([200, 100, 200]);
    round += 1;
  };
  play();
  loop = setInterval(play, 1300);
}

export function softenRinging() { // while the user is doing the activity
  if (!loop) return;
  clearInterval(loop);
  loop = setInterval(() => { const t = ctx.currentTime + 0.05; chirp(t, 880, 0.18, 0.12); }, 2600);
}

export function stopRinging() {
  clearInterval(loop);
  loop = null;
  navigator.vibrate?.(0);
}

export function successChime() {
  if (!canPlay()) return;
  const t = ctx.currentTime + 0.02;
  [523, 659, 784, 1047].forEach((f, i) => chirp(t + i * 0.09, f, 0.3, 0.35));
}

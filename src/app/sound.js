// Alarm sounds made with Web Audio (no audio files). Browsers only allow sound after a tap,
// so `unlock()` runs on the first tap anywhere in the app; after that an alarm can ring by itself
// while the app stays open (Bedside mode keeps it open overnight).
//
// Loudness: every sound runs through drive → soft clipper → compressor, which raises the
// perceived level a lot without harsh digital clipping. Sounds sit in the 1–3 kHz range where
// hearing is most sensitive, and use square / sawtooth waves, which carry far more energy than
// the old single triangle tone.

let ctx = null;
let bus = null;     // where voices connect (the drive stage)
let master = null;  // final level (used for gentle rise and softening)
let loop = null;
let previewTimer = null;

const SILENT_WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';

export function unlock() {
  try {
    // iOS 17+: play as media, so the alarm is heard even with the ring/silent switch on silent
    if (navigator.audioSession) navigator.audioSession.type = 'playback';
    ctx ??= new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    // older iOS: a (silent) media element switches the page to the playback audio category
    const a = new Audio(SILENT_WAV);
    a.setAttribute('playsinline', '');
    a.play().catch(() => {});
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    g.gain.value = 0;
    o.connect(g).connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + 0.02);
  } catch { /* no audio available */ }
}
export const canPlay = () => Boolean(ctx && ctx.state === 'running');

// Measured (Classic beep, RMS) against the old alarm at its loudest: loud ≈ +6 dB, max ≈ +10 dB;
// against the old first ring: +17 / +21 dB. Rise starts near the old level and reaches max in 30 s.
const LEVELS = { rise: { drive: 4, from: 0.12, to: 1 }, loud: { drive: 1.4, to: 0.7 }, max: { drive: 4, to: 1 } };

function buildChain(volume) {
  teardown();
  const level = LEVELS[volume] ?? LEVELS.loud;
  const drive = ctx.createGain();
  drive.gain.value = level.drive;
  const shaper = ctx.createWaveShaper();
  const n = 1024;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; curve[i] = Math.tanh(2.2 * x) / Math.tanh(2.2); }
  shaper.curve = curve;
  shaper.oversample = '2x';
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16; comp.knee.value = 6; comp.ratio.value = 12; comp.attack.value = 0.002; comp.release.value = 0.12;
  master = ctx.createGain();
  const now = ctx.currentTime;
  if (level.from != null) { master.gain.setValueAtTime(level.from, now); master.gain.linearRampToValueAtTime(level.to, now + 30); }
  else master.gain.setValueAtTime(level.to, now);
  drive.connect(shaper).connect(comp).connect(master).connect(ctx.destination);
  bus = drive;
}

function teardown() {
  if (!master) return;
  const m = master;
  try { m.gain.cancelScheduledValues(ctx.currentTime); m.gain.setTargetAtTime(0, ctx.currentTime, 0.03); } catch { /* closed */ }
  setTimeout(() => { try { m.disconnect(); } catch { /* already */ } }, 300);
  master = null; bus = null;
}

/** One oscillator note with a short attack/release (beeps, sweeps, buzzes). */
function tone(t, { f, f2 = f, dur, type = 'square', a = 0.004, vol = 0.6, detune = 0 }) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (f2 !== f) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  o.detune.value = detune;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + a);
  g.gain.setValueAtTime(vol, Math.max(t + a, t + dur - 0.015));
  g.gain.linearRampToValueAtTime(0, t + dur);
  o.connect(g).connect(bus);
  o.start(t); o.stop(t + dur + 0.03);
}

/** A struck sound (bell, marimba, gong): sine partials with exponential decay. */
function strike(t, { f, partials, dur, vol = 0.6 }) {
  partials.forEach(([ratio, amp, decay = 1], i) => {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = f * ratio;
    const g = ctx.createGain();
    const end = t + dur * decay;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol * amp, t + 0.006 + i * 0.001);
    g.gain.exponentialRampToValueAtTime(0.0001, end);
    o.connect(g).connect(bus);
    o.start(t); o.stop(end + 0.05);
  });
}

const BELL = [[1, 1], [2.76, 0.55, 0.7], [5.4, 0.35, 0.45], [8.93, 0.2, 0.3]];

/** Each sound: one repeating pattern starting at t, and how often it repeats (seconds). */
const PATTERNS = {
  classic: { every: 1.0, play: (t) => { for (let i = 0; i < 4; i++) tone(t + i * 0.15, { f: 2048, dur: 0.09, vol: 0.7 }); } },
  pager: { every: 0.9, play: (t) => { for (let i = 0; i < 3; i++) tone(t + i * 0.11, { f: 2900, dur: 0.07, vol: 0.65 }); } },
  chimes: { every: 1.3, play: (t) => { [660, 880, 1175, 1568].forEach((f, i) => { tone(t + i * 0.15, { f, f2: f * 1.02, dur: 0.24, type: 'triangle', vol: 0.8 }); tone(t + i * 0.15, { f: f * 2, dur: 0.18, type: 'square', vol: 0.12 }); }); } },
  siren: { every: 1.2, play: (t) => { tone(t, { f: 700, f2: 1500, dur: 0.6, type: 'sawtooth', a: 0.02, vol: 0.55 }); tone(t + 0.6, { f: 1500, f2: 700, dur: 0.6, type: 'sawtooth', a: 0.01, vol: 0.55 }); } },
  bell: { every: 1.6, play: (t) => { strike(t, { f: 880, partials: BELL, dur: 1.5, vol: 0.75 }); strike(t + 0.8, { f: 660, partials: BELL, dur: 1.4, vol: 0.7 }); } },
  marimba: { every: 1.7, play: (t) => { [784, 988, 1175, 1568, 1175, 988].forEach((f, i) => strike(t + i * 0.16, { f, partials: [[1, 1], [4, 0.3, 0.25], [10, 0.08, 0.1]], dur: 0.45, vol: 0.8 })); } },
  buzzer: { every: 0.8, play: (t) => { tone(t, { f: 190, dur: 0.48, type: 'sawtooth', vol: 0.7 }); tone(t, { f: 380, dur: 0.48, type: 'square', vol: 0.35, detune: 8 }); } },
  lights: { every: 3.0, play: (t) => { for (let i = 0; i < 5; i++) tone(t + i * 0.32, { f: 1000, dur: 0.13, vol: 0.7 }); tone(t + 1.75, { f: 260, f2: 1900, dur: 0.85, type: 'sawtooth', a: 0.02, vol: 0.6 }); tone(t + 1.75, { f: 520, f2: 3800, dur: 0.85, type: 'square', a: 0.02, vol: 0.18 }); } },
  gong: { every: 3.4, play: (t) => strike(t, { f: 196, partials: [[1, 1], [1.48, 0.6], [2.2, 0.5, 0.8], [2.9, 0.35, 0.6], [4.1, 0.25, 0.4], [5.6, 0.15, 0.3]], dur: 3.2, vol: 0.85 }) },
};

/** Start the chosen sound repeating. `volume`: 'rise' (builds over 30 s) | 'loud' | 'max'. */
export function startRinging({ sound = 'classic', volume = 'loud' } = {}) {
  if (!ctx) unlock();
  if (!ctx || loop) return;
  clearTimeout(previewTimer);
  const pattern = PATTERNS[sound] ?? PATTERNS.classic;
  buildChain(volume);
  const play = () => {
    if (!bus) return;
    pattern.play(ctx.currentTime + 0.05);
    navigator.vibrate?.([300, 120, 300]);
  };
  play();
  loop = setInterval(play, pattern.every * 1000);
}

export function softenRinging() { // while the user is doing the activity
  if (!master) return;
  master.gain.cancelScheduledValues(ctx.currentTime);
  master.gain.setTargetAtTime(0.12, ctx.currentTime, 0.2);
}

export function stopRinging() {
  clearInterval(loop);
  clearTimeout(previewTimer);
  loop = null;
  teardown();
  navigator.vibrate?.(0);
}

/** Play a sound for a few seconds so it can be chosen in the alarm form. */
export function preview(sound, volume = 'loud') {
  unlock();
  stopRinging();
  startRinging({ sound, volume: volume === 'rise' ? 'loud' : volume });
  const every = (PATTERNS[sound] ?? PATTERNS.classic).every;
  previewTimer = setTimeout(stopRinging, Math.max(2.6, every * 2) * 1000);
}

export function successChime() {
  if (!canPlay()) return;
  const was = bus;
  if (!was) buildChain('rise');
  const t = ctx.currentTime + 0.02;
  if (master) { master.gain.cancelScheduledValues(t); master.gain.setValueAtTime(0.5, t); }
  [523, 659, 784, 1047].forEach((f, i) => strike(t + i * 0.09, { f, partials: [[1, 1], [2, 0.25, 0.5]], dur: 0.5, vol: 0.6 }));
  setTimeout(() => { if (!loop) teardown(); }, 1200);
}

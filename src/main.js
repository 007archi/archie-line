// Composition root: wires storage, tracker, reminders, alarms and views, and handles user events.
import { Tracker } from './app/tracker.js';
import * as push from './app/push.js';
import * as sound from './app/sound.js';
import * as repo from './data/repository.js';
import { requestPersistence } from './data/db.js';
import { VAULT_FORMAT } from './data/crypto.js';
import { todayKey, addDays, startOfWeek, weekday } from './domain/dates.js';
import { isDone, dayProgress } from './domain/habits.js';
import { withDefaults, buildSchedule } from './domain/reminders.js';
import { DEFAULT_ALARMS, SHIFT_PRESETS, ALARM_SOUNDS, soundOf, newAlarm, ringMinute, ringingNow, alarmSchedule, isAlarmDay, minToTime } from './domain/alarms.js';
import { LIBRARY } from './domain/library.js';
import {
  todayView, progressView, habitsView, habitForm, settingsView, lockView, passcodeForm,
  librarySheet, alarmsView, alarmForm, alarmOverlay, timerOverlay, bedsideOverlay, icon, profileForm, packSheet,
} from './ui/views.js';
import { resolveActivity, mountActivity } from './ui/activities.js';
import { startStarryNight, stopStarryNight } from './ui/starry-night.js';
import { packById, resolvePack } from './domain/themes.js';
import { normaliseProfile } from './domain/profile.js';
import {
  countUp, burst, confetti, moveTabIndicator, swapView,
  initInteractiveGlass, initMagnet, initParallax, playIntro,
} from './ui/motion.js';

const tracker = new Tracker();
const viewEl = document.getElementById('view');
const sheet = document.getElementById('sheet');
const overlay = document.getElementById('overlay');
const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

const ui = { view: 'today', day: todayKey(), weekStart: startOfWeek(todayKey()), persisted: null, locked: false, bedside: false };
const nowMinute = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
const nowHHMM = () => minToTime(nowMinute());

// ---------------------------------------------------------------- profile
const profile = () => normaliseProfile(tracker.setting('profile') ?? {});
function openProfile() {
  sheet.innerHTML = profileForm(profile());
  if (!sheet.open) sheet.showModal();
}
/** Square-crop and shrink a picked photo to a small JPEG data URL (keeps storage and backups tiny). */
async function photoToDataUrl(file, size = 192) {
  const bmp = await createImageBitmap(file);
  const side = Math.min(bmp.width, bmp.height);
  const canvas = Object.assign(document.createElement('canvas'), { width: size, height: size });
  canvas.getContext('2d').drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, size, size);
  bmp.close?.();
  return canvas.toDataURL('image/jpeg', 0.82);
}
function setPhotoPreview(dataUrl) {
  const form = sheet.querySelector('form[data-form="profile"]');
  if (!form) return;
  form.elements.namedItem('photo').value = dataUrl;
  const name = form.elements.namedItem('fullname').value.trim();
  const ini = name.split(/\s+/).filter(Boolean).map((w) => [...w][0]).filter((_, i, a) => i === 0 || i === a.length - 1).join('').toUpperCase();
  form.querySelector('.photo-preview').innerHTML = dataUrl
    ? `<img class="avatar lg" src="${dataUrl}" alt="">`
    : `<span class="avatar lg" aria-hidden="true">${ini || '?'}</span>`;
  form.querySelector('[data-act="profile-photo-clear"]').hidden = !dataUrl;
}

// ---------------------------------------------------------------- alarms data
const alarms = () => tracker.setting('alarms') ?? DEFAULT_ALARMS;
async function saveAlarms(list) { await tracker.saveSetting('alarms', list); syncReminders(); }

function nextAlarm() {
  const today = todayKey();
  const now = nowMinute();
  for (let i = 0; i < 8; i++) {
    const d = addDays(today, i);
    const due = alarms()
      .filter((a) => a.on && isAlarmDay(a, weekday(d)) && !(i === 0 && (ringMinute(a, d) <= now || tracker.alarmDone(a.id, d))))
      .sort((a, b) => a.time.localeCompare(b.time));
    if (due.length) {
      const a = due[0];
      const word = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][weekday(d)];
      return { label: a.label, when: `${word} · around ${a.time}` };
    }
  }
  return null;
}

// ---------------------------------------------------------------- appearance
// Theme + background are a per-device display preference, kept in localStorage (not in the encrypted
// data) so the right look appears instantly, even on the lock screen.
const APPEARANCE_KEY = 'sd-appearance';
let appearance = (() => { try { return JSON.parse(localStorage.getItem(APPEARANCE_KEY)) ?? {}; } catch { return {}; } })();

let appliedTokens = [];
const systemDark = window.matchMedia('(prefers-color-scheme: dark)');
function applyAppearance() {
  const pack = packById(appearance.pack ?? 'studio');
  const root = document.documentElement;
  for (const k of appliedTokens) root.style.removeProperty(k);
  appliedTokens = [];
  const choice = appearance.theme ?? 'auto';
  let mode = choice === 'auto' ? (systemDark.matches ? 'dark' : 'light') : choice;
  let backdrop;
  let flip = false;
  if (pack.id === 'studio') {
    delete root.dataset.pack;
    backdrop = (appearance.backdrop ?? 'galaxy') === 'galaxy' ? 'starry' : 'shapes'; // Starry Night is the default (stored value 'galaxy')
    if (backdrop === 'starry') mode = 'dark'; // the painted sky is a night sky
    if (backdrop === 'starry' || choice !== 'auto') root.dataset.theme = mode; else delete root.dataset.theme;
  } else {
    const r = resolvePack(pack, mode);
    root.dataset.pack = pack.id;
    root.dataset.theme = mode;
    for (const [k, v] of Object.entries(r.tokens)) { root.style.setProperty(k, v); appliedTokens.push(k); }
    backdrop = r.backdrop;
    flip = r.flip;
  }
  const starry = backdrop === 'starry';
  const svgBackdrop = backdrop !== 'starry' && backdrop !== 'blobs' && backdrop !== 'shapes';
  document.body.classList.toggle('bg-galaxy', starry);
  document.body.classList.toggle('bg-blobs', backdrop === 'blobs');
  document.body.classList.toggle('bg-svg', svgBackdrop);
  let layer = document.querySelector('.pack-bg');
  if (!layer) { layer = Object.assign(document.createElement('div'), { className: 'pack-bg' }); layer.setAttribute('aria-hidden', 'true'); document.body.prepend(layer); }
  layer.innerHTML = svgBackdrop ? backdrop : '';
  layer.classList.toggle('flip', flip);
  const barColour = pack.id === 'studio' ? (mode === 'dark' ? '#07081a' : '#f1ffe7') : root.style.getPropertyValue('--bg');
  for (const m of document.querySelectorAll('meta[name="theme-color"]')) m.content = barColour;
  if (starry) startStarryNight(); else stopStarryNight();
}
// Auto follows the iPhone's appearance live (e.g. when it switches to dark at sunset).
systemDark.addEventListener?.('change', () => { if ((appearance.theme ?? 'auto') === 'auto') applyAppearance(); });

function setAppearance(patch) {
  appearance = { ...appearance, ...patch };
  try { localStorage.setItem(APPEARANCE_KEY, JSON.stringify(appearance)); } catch { /* private mode: still applies for this visit */ }
  applyAppearance();
  render();
}
applyAppearance();

// ---------------------------------------------------------------- rendering
let justDone = null; // habit id that was just completed → celebrate after render
let justMood = null;

function render(animate = false) {
  if (ui.locked) return;
  const today = todayKey();
  if (ui.day > today) ui.day = today;
  const html = {
    today: () => todayView(tracker, ui.day, today, { nextAlarm: nextAlarm(), profile: profile(), hour: new Date().getHours() }),
    week: () => progressView(tracker, ui.weekStart, today),
    habits: () => habitsView(tracker, today),
    alarms: () => alarmsView(alarms(), { recordFor: (id) => tracker.alarmRecord(id, today), bedside: ui.bedside }),
    settings: () => settingsView(tracker, {
      persisted: ui.persisted,
      standalone,
      encrypted: repo.isEncrypted(),
      autoLock: tracker.setting('autoLock') ?? 1,
      reminders: reminders(),
      conn: tracker.setting('push') ?? null,
      serverUrl: tracker.setting('pushUrl'),
      support: push.pushSupport(),
      appearance: { theme: appearance.theme ?? 'auto', backdrop: appearance.backdrop ?? 'galaxy', pack: appearance.pack ?? 'studio' },
      profile: profile(),
      today,
    }),
  }[ui.view]();
  for (const btn of document.querySelectorAll('.tabs button')) {
    btn.setAttribute('aria-current', btn.dataset.view === ui.view ? 'page' : 'false');
  }
  moveTabIndicator();
  swapView(viewEl, html, animate, () => { countUp(viewEl); celebrate(); });
}

function celebrate() {
  if (justDone) {
    const li = viewEl.querySelector(`.habit[data-id="${justDone}"]`);
    if (li) { li.classList.add('just-done'); burst(li.querySelector('.tick')); }
    const p = dayProgress(tracker.habits(), ui.day, tracker.valueOf, tracker.charretteDays());
    if (p.total && p.done === p.total) { confetti(); toast('Every habit done today. Beautiful work.'); }
    justDone = null;
  }
  if (justMood) {
    viewEl.querySelector(`.mood[data-mood="${justMood}"]`)?.classList.add('just');
    justMood = null;
  }
}

function go(view) {
  ui.view = view;
  if (view === 'today') ui.day = todayKey();
  render(true);
  window.scrollTo({ top: 0 });
}

let toastTimer;
function toast(message) {
  let el = document.getElementById('toast');
  if (!el) {
    el = Object.assign(document.createElement('div'), { id: 'toast', className: 'toast', role: 'status' });
    document.body.append(el);
  }
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}

// Sound may only start after a tap: unlock it on the first one.
document.addEventListener('pointerdown', () => sound.unlock(), { once: true, capture: true });
window.addEventListener('resize', moveTabIndicator);

// ---------------------------------------------------------------- lock
function showLock() {
  ui.locked = true;
  document.body.classList.add('is-locked');
  if (sheet.open) sheet.close();
  viewEl.classList.remove('enter');
  viewEl.innerHTML = lockView();
  viewEl.querySelector('input[type=password]')?.focus();
}

async function lockNow() {
  if (!repo.isEncrypted() || ui.locked) return;
  await repo.lock();
  tracker.unload();
  showLock();
}

async function startApp() {
  ui.locked = false;
  document.body.classList.remove('is-locked');
  await tracker.load();
  render(!document.body.classList.contains('booting')); // under the intro, reveal later
  await flushPendingAlarm();
  checkAlarms();
}

let hiddenAt = null;
let lastToday = todayKey();
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'hidden') {
    hiddenAt = Date.now();
    await repo.flush();
    if (repo.isEncrypted() && !ui.locked && !ui.bedside && overlay.hidden && (tracker.setting('autoLock') ?? 1) === 0) await lockNow();
    return;
  }
  const minutes = tracker.setting('autoLock') ?? 1;
  if (repo.isEncrypted() && !ui.locked && !ui.bedside && overlay.hidden && hiddenAt && Date.now() - hiddenAt >= minutes * 60_000) { await lockNow(); return; }
  const now = todayKey();
  if (now !== lastToday) {
    if (ui.day === lastToday) ui.day = now;
    ui.weekStart = startOfWeek(now);
    lastToday = now;
    render();
  }
  checkAlarms();
});

// ---------------------------------------------------------------- sheets
let pendingAsk = null;
/** Opens the passcode sheet. `onSubmit` may throw to show an error and keep the sheet open. Resolves null on cancel. */
function askPasscode(opts, onSubmit) {
  return new Promise((resolve) => {
    sheet.innerHTML = passcodeForm(opts);
    pendingAsk = { onSubmit, resolve };
    sheet.showModal();
    sheet.querySelector('input[type=password]')?.focus();
  });
}
sheet.addEventListener('close', () => {
  if (!ringing) sound.stopRinging(); // end any sound preview
  if (pendingAsk) { pendingAsk.resolve(null); pendingAsk = null; }
});

function openForm(habit) {
  sheet.innerHTML = habitForm(habit);
  if (!sheet.open) sheet.showModal();
  const form = sheet.querySelector('form');
  form.elements.namedItem('kind').addEventListener('change', () => {
    form.querySelector('.target-field').hidden = form.elements.namedItem('kind').value === 'check';
  });
}

function openLibrary() {
  sheet.innerHTML = librarySheet(tracker);
  sheet.showModal();
}

function openAlarmForm(alarm) {
  const isNew = !alarm;
  sheet.innerHTML = alarmForm(alarm ?? newAlarm(), isNew);
  sheet.showModal();
}

// ---------------------------------------------------------------- reminders
const reminders = () => withDefaults(tracker.setting('reminders'));
const schedule = () => [...buildSchedule(reminders(), tracker.isCharretteActive()), ...alarmSchedule(alarms())];

let syncTimer;
function syncReminders() {
  const conn = tracker.setting('push');
  if (!conn) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(async () => {
    try { await push.sync(conn, schedule()); } catch (err) { toast(`Reminders not synced: ${err.message}`); }
  }, 600);
}

async function updateReminder(id, patch) {
  const list = reminders().map((r) => (r.id === id ? { ...r, ...patch } : r));
  await tracker.saveSetting('reminders', list.map(({ id: rid, on, time, until, everyMin }) => ({ id: rid, on, time, until, everyMin })));
  syncReminders();
}

// ---------------------------------------------------------------- alarm ringing
let ringing = null;      // { alarmId, date, label, startedAt, test }
let pendingDone = null;  // finished while the app was locked; logged after unlock

function checkAlarms() {
  if (ui.locked || ringing) return;
  const today = todayKey();
  const due = ringingNow(alarms(), today, weekday(today), nowMinute(), (id, d) => tracker.alarmDone(id, d));
  if (due.length) startAlarm({ alarmId: due[0].id, date: today, label: due[0].label, activity: due[0].activity, ...soundOf(due[0]) });
}
setInterval(checkAlarms, 15_000);

function startAlarm({ alarmId, date, label, activity, sound: tone = 'classic', volume = 'loud', test = false }) {
  if (sheet.open) sheet.close();
  ringing = { alarmId, date, label, activity, tone, volume, startedAt: Date.now(), test };
  overlay.className = 'overlay';
  overlay.innerHTML = alarmOverlay(label, nowHHMM());
  overlay.hidden = false;
  sound.startRinging({ sound: tone, volume }); // rings straight away if sound was unlocked earlier (Bedside mode); otherwise on the first tap
}

function beginActivity() {
  sound.unlock();
  sound.startRinging({ sound: ringing.tone, volume: ringing.volume });
  sound.softenRinging();
  overlay.classList.add('doing');
  const host = overlay.querySelector('.activity');
  host.hidden = false;
  mountActivity(resolveActivity(ringing.activity), host, finishAlarm);
}

async function finishAlarm() {
  const r = ringing;
  sound.stopRinging();
  sound.successChime();
  confetti();
  const took = Math.round((Date.now() - r.startedAt) / 1000);
  overlay.classList.remove('doing');
  overlay.innerHTML = `<div class="ring-done">
      <span class="disc">${icon('check')}</span>
      <h2>Alarm off</h2>
      <p class="fine">${r.test ? 'That was a test run.' : `Good ${new Date().getHours() < 12 ? 'morning' : 'day'} — done in ${Math.max(1, Math.round(took / 60))} min.`}</p>
    </div>
    <div class="ring-panel"><button class="primary-btn big-btn" data-act="overlay-close">Let's go</button></div>`;
  ringing = null;
  if (r.test) return;
  const record = { at: nowHHMM(), took, activity: r.activity };
  if (ui.locked) { pendingDone = { ...r, record }; return; }
  await recordAlarm(r.alarmId, r.date, record);
}

async function recordAlarm(alarmId, date, record) {
  await tracker.logAlarm(alarmId, date, record);
  const conn = tracker.setting('push');
  if (conn) push.alarmDone(conn, alarmId, date).catch(() => {});
}

async function flushPendingAlarm() {
  if (!pendingDone) return;
  const p = pendingDone;
  pendingDone = null;
  await recordAlarm(p.alarmId, p.date, p.record);
}

/** A notification for an alarm opens the app with ?alarm=…&date=… */
function handleAlarmUrl(href) {
  const url = new URL(href, location.href);
  const alarmId = url.searchParams.get('alarm');
  const date = url.searchParams.get('date');
  if (!alarmId || !date) return;
  history.replaceState(null, '', location.pathname);
  if (ringing) return;
  if (!ui.locked) {
    if (tracker.alarmDone(alarmId, date)) return;
    const a = alarms().find((x) => x.id === alarmId);
    startAlarm({ alarmId, date, label: a?.label ?? 'Alarm', activity: a?.activity ?? 'random', ...soundOf(a) });
  } else {
    startAlarm({ alarmId, date, label: 'Alarm', activity: 'random' }); // details are encrypted; ring anyway
  }
}
navigator.serviceWorker?.addEventListener('message', (e) => { if (e.data?.type === 'open-url') handleAlarmUrl(e.data.url); });

// ---------------------------------------------------------------- focus timer
let timer = null; // { habitId, total, elapsed, startedAt, tick }

function openTimer(habitId) {
  const h = tracker.habit(habitId);
  timer = { habitId, total: 25 * 60, elapsed: 0, startedAt: null, tick: null };
  overlay.className = 'overlay';
  overlay.innerHTML = timerOverlay(h.name, 25);
  overlay.hidden = false;
  paintTimer();
}

function timerElapsed() { return timer.elapsed + (timer.startedAt ? (Date.now() - timer.startedAt) / 1000 : 0); }

function paintTimer() {
  if (!timer) return;
  const left = Math.max(0, timer.total - timerElapsed());
  const m = Math.floor(left / 60);
  const s = Math.floor(left % 60);
  overlay.querySelector('.timer-clock').textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  overlay.querySelector('.t-fill').style.strokeDashoffset = String(326.7 * (1 - timerElapsed() / timer.total));
  if (left <= 0 && timer.startedAt) stopTimer(true);
}

function toggleTimer() {
  const box = overlay.querySelector('.timer');
  const btn = overlay.querySelector('[data-act="timer-toggle"]');
  if (timer.startedAt) {
    timer.elapsed = timerElapsed();
    timer.startedAt = null;
    clearInterval(timer.tick);
    box.classList.remove('running');
    btn.innerHTML = `${icon('play')} Resume`;
  } else {
    timer.startedAt = Date.now();
    timer.tick = setInterval(paintTimer, 1000);
    box.classList.add('running');
    btn.innerHTML = `${icon('pause')} Pause`;
  }
}

async function stopTimer(finished = false) {
  const t = timer;
  if (!t) return;
  clearInterval(t.tick);
  const mins = Math.floor((timerElapsed() + 30) / 60);
  timer = null;
  closeOverlay();
  if (mins > 0) {
    const before = tracker.valueOf(t.habitId, ui.day);
    const h = tracker.habit(t.habitId);
    if (!isDone(h, before) && isDone(h, before + mins)) justDone = t.habitId;
    await tracker.setValue(t.habitId, ui.day, before + mins);
    if (finished) { sound.successChime(); confetti(); }
    toast(`${mins} min added to ${h.name}.`);
  }
}

// ---------------------------------------------------------------- bedside mode
let wakeLock = null;
let bedClock = null;
async function startBedside() {
  sound.unlock(); // this tap is what lets the alarm make sound later
  ui.bedside = true;
  try { wakeLock = await navigator.wakeLock?.request('screen'); } catch { wakeLock = null; }
  overlay.className = 'overlay bed';
  const paint = () => {
    if (ringing) return;
    const n = nextAlarm();
    overlay.innerHTML = bedsideOverlay(nowHHMM(), n ? `${n.label} · ${n.when}` : '');
  };
  paint();
  overlay.hidden = false;
  bedClock = setInterval(() => { paint(); checkAlarms(); }, 10_000);
  if (!wakeLock) toast('This browser cannot keep the screen awake — set auto-lock to Never in iPhone settings tonight.');
}
function stopBedside() {
  ui.bedside = false;
  clearInterval(bedClock);
  wakeLock?.release().catch(() => {});
  wakeLock = null;
}
document.addEventListener('visibilitychange', async () => {
  if (ui.bedside && document.visibilityState === 'visible' && !wakeLock) {
    try { wakeLock = await navigator.wakeLock?.request('screen'); } catch { /* ignore */ }
  }
});

function closeOverlay() {
  overlay.hidden = true;
  overlay.innerHTML = '';
  overlay.className = 'overlay';
  if (ui.bedside) stopBedside();
  render();
}

overlay.addEventListener('click', (e) => {
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (act === 'ring-start') beginActivity();
  if (act === 'overlay-close') closeOverlay();
  if (act === 'timer-toggle') toggleTimer();
  if (act === 'timer-stop') stopTimer(false);
  if (act === 'timer-len' && timer && !timer.startedAt) {
    timer.total = Number(e.target.dataset.min) * 60;
    timer.elapsed = 0;
    overlay.querySelectorAll('.timer-len button').forEach((b) => b.classList.toggle('on', b === e.target));
    paintTimer();
  }
});
overlay.addEventListener('dblclick', () => { if (ui.bedside && !ringing) closeOverlay(); });

// ---------------------------------------------------------------- tab bar
document.querySelector('.tabs').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-view]');
  if (btn && !ui.locked && btn.dataset.view !== ui.view) go(btn.dataset.view);
});

// ---------------------------------------------------------------- main view: clicks
viewEl.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || ui.locked) return;
  const act = el.dataset.act;
  const habitId = el.closest('[data-id]')?.dataset.id;

  try {
    switch (act) {
      case 'toggle': {
        const h = tracker.habit(habitId);
        const v = tracker.valueOf(habitId, ui.day);
        if (v < h.target) justDone = habitId;
        await tracker.setValue(habitId, ui.day, v >= h.target ? 0 : h.target);
        break;
      }
      case 'step': {
        const h = tracker.habit(habitId);
        const v = tracker.valueOf(habitId, ui.day);
        const next = v + Number(el.dataset.step);
        if (!isDone(h, v) && isDone(h, next)) justDone = habitId;
        await tracker.setValue(habitId, ui.day, next);
        break;
      }
      case 'timer': openTimer(habitId); break;
      case 'mood': {
        const m = Number(el.dataset.mood);
        justMood = tracker.mood(ui.day) === m ? null : m;
        await tracker.setMood(ui.day, tracker.mood(ui.day) === m ? 0 : m);
        break;
      }
      case 'day': ui.day = addDays(ui.day, Number(el.dataset.delta)); render(true); break;
      case 'go-today': ui.day = todayKey(); render(true); break;
      case 'week': ui.weekStart = addDays(ui.weekStart, Number(el.dataset.delta)); render(true); break;
      case 'go-alarms': go('alarms'); break;
      case 'library': openLibrary(); break;
      case 'new': openForm(null); break;
      case 'edit': openForm(tracker.habit(el.dataset.id)); break;
      case 'export': await exportBackup(); break;
      case 'reset':
        if (confirm('Delete all habits and history on this device? This cannot be undone. Export a backup first if unsure.')) await tracker.resetAll();
        break;

      // --- alarms
      case 'alarm-new': openAlarmForm(null); break;
      case 'alarm-edit': openAlarmForm(alarms().find((a) => a.id === el.closest('[data-aid]').dataset.aid)); break;
      case 'alarm-test': {
        const a = alarms()[0] ?? newAlarm();
        sound.unlock();
        startAlarm({ alarmId: a.id, date: todayKey(), label: a.label, activity: a.activity, ...soundOf(a), test: true });
        break;
      }
      case 'bedside': await startBedside(); break;
      case 'theme': {
        const patch = { theme: el.dataset.v };
        // Starry Night is a night sky: asking for Light (or Auto) on Studio swaps it for Shapes.
        const studioStarry = (appearance.pack ?? 'studio') === 'studio' && (appearance.backdrop ?? 'galaxy') === 'galaxy';
        if (studioStarry && el.dataset.v !== 'dark') { patch.backdrop = 'shapes'; toast('Background: Shapes (Starry Night is dark only)'); }
        setAppearance(patch);
        break;
      }
      case 'backdrop': setAppearance(el.dataset.v === 'galaxy' ? { backdrop: 'galaxy', theme: 'dark' } : { backdrop: el.dataset.v }); break;
      case 'pack': setAppearance({ pack: el.dataset.v }); toast(`Theme: ${packById(el.dataset.v).name}`); break;
      case 'profile-edit': openProfile(); break;
      case 'packs-open':
        sheet.innerHTML = packSheet(appearance.pack ?? 'studio');
        sheet.showModal();
        sheet.querySelector('.pack[aria-checked="true"]')?.scrollIntoView({ block: 'center' });
        break;

      // --- reminders (push-on must reach Notification.requestPermission without an earlier await)
      case 'push-on': {
        const url = viewEl.querySelector('[data-act="push-url"]')?.value ?? '';
        const conn = await push.connect(url, schedule());
        await tracker.saveSetting('pushUrl', conn.serverUrl);
        await tracker.saveSetting('push', conn);
        toast('Reminders are on.');
        break;
      }
      case 'push-test': await push.sendTest(tracker.setting('push')); toast('Test sent — it should arrive in a few seconds.'); break;
      case 'push-off':
        await push.disconnect(tracker.setting('push'));
        await tracker.saveSetting('push', null);
        toast('Reminders are off.');
        break;

      // --- encryption
      case 'enc-on': {
        const ok = await askPasscode({
          title: 'Encrypt my data',
          note: 'Choose a passcode of at least 6 characters. If you forget it, the data cannot be recovered.',
          fields: ['next', 'confirm'], submit: 'Encrypt',
        }, (v) => repo.enable(v.next));
        if (ok) { toast('Encrypted. The app now locks with your passcode.'); render(); }
        break;
      }
      case 'enc-change': {
        const ok = await askPasscode({ title: 'Change passcode', fields: ['current', 'next', 'confirm'], submit: 'Change' },
          (v) => repo.changePasscode(v.current, v.next));
        if (ok) toast('Passcode changed.');
        break;
      }
      case 'enc-off': {
        const ok = await askPasscode({
          title: 'Turn off encryption', note: 'Your data will be stored unencrypted on this phone again.',
          fields: ['passcode'], submit: 'Turn off',
        }, async (v) => { await repo.unlock(v.passcode); await repo.disable(); });
        if (ok) { toast('Encryption is off.'); render(); }
        break;
      }
      case 'lock-now': await lockNow(); break;
      default: break;
    }
  } catch (err) {
    toast(err.message || 'Something went wrong.');
  }
});

// ---------------------------------------------------------------- main view: inputs
viewEl.addEventListener('change', async (e) => {
  const t = e.target;
  const act = t.dataset.act;
  const rid = t.closest('[data-rid]')?.dataset.rid;
  if (act === 'charrette') { await tracker.setCharrette(t.checked); syncReminders(); }
  if (act === 'import') await importBackup(t);
  if (act === 'autolock') await tracker.saveSetting('autoLock', Number(t.value));
  if (act === 'push-url') await tracker.saveSetting('pushUrl', t.value.trim());
  if (act === 'rem-on') await updateReminder(rid, { on: t.checked });
  if (act === 'rem-time' && t.value) await updateReminder(rid, { [t.dataset.field]: t.value });
  if (act === 'rem-every') await updateReminder(rid, { everyMin: Number(t.value) });
  if (act === 'alarm-on') {
    const id = t.closest('[data-aid]').dataset.aid;
    await saveAlarms(alarms().map((a) => (a.id === id ? { ...a, on: t.checked } : a)));
  }
});

let noteTimer;
viewEl.addEventListener('input', (e) => {
  if (e.target.dataset.act !== 'note') return;
  const day = ui.day;
  const value = e.target.value;
  clearTimeout(noteTimer);
  noteTimer = setTimeout(() => tracker.setNote(day, value), 300);
});

// unlock form
viewEl.addEventListener('submit', async (e) => {
  if (e.target.dataset.form !== 'unlock') return;
  e.preventDefault();
  const form = e.target;
  const btn = form.querySelector('button[type=submit]');
  const error = form.querySelector('.form-error');
  btn.disabled = true; btn.textContent = 'Unlocking…'; error.hidden = true;
  try {
    await repo.unlock(form.elements.namedItem('passcode').value);
    await startApp();
  } catch (err) {
    error.textContent = err.message; error.hidden = false;
    btn.disabled = false; btn.textContent = 'Unlock';
    form.elements.namedItem('passcode').select();
  }
});

// ---------------------------------------------------------------- sheet events
sheet.addEventListener('click', async (e) => {
  if (e.target === sheet) { sheet.close(); return; } // tap on backdrop
  const el = e.target.closest('[data-act]');
  const act = el?.dataset.act;
  if (act === 'cancel') sheet.close();
  if (act === 'sound-preview') {
    const f = sheet.querySelector('form').elements;
    sound.preview(f.namedItem('sound').value, f.namedItem('volume').value);
  }
  if (act === 'profile-photo-clear') setPhotoPreview('');
  if (act === 'pack') {
    setAppearance({ pack: el.dataset.v });
    for (const b of sheet.querySelectorAll('.pack')) b.setAttribute('aria-checked', String(b === el));
    const t = packById(el.dataset.v);
    const note = sheet.querySelector('.pack-note');
    if (note) note.innerHTML = `<b>${t.name}</b> · ${t.note}`;
  }
  if (act === 'custom') openForm(null);
  if (act === 'lib-cat') {
    sheet.querySelectorAll('.lib-cats button').forEach((b) => b.classList.toggle('on', b === el));
    sheet.querySelector(`#lib-g-${el.dataset.g}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  if (act === 'lib-add') {
    const item = LIBRARY[Number(el.dataset.g)].items[Number(el.dataset.i)];
    await tracker.addHabit(item);
    el.classList.add('added', 'just');
    el.disabled = true;
    el.querySelector('.lib-state').innerHTML = icon('check');
    burst(el.querySelector('.lib-state'));
    toast(`Added “${item.name}”.`);
  }
  if (act === 'delete') {
    const id = sheet.querySelector('form').dataset.id;
    if (confirm(`Delete "${tracker.habit(id).name}" and its history?`)) { await tracker.deleteHabit(id); sheet.close(); }
  }
  if (act === 'alarm-delete') {
    const id = sheet.querySelector('form').dataset.aid;
    if (confirm('Delete this alarm?')) { await saveAlarms(alarms().filter((a) => a.id !== id)); sheet.close(); }
  }
});

sheet.addEventListener('change', async (e) => {
  if (e.target.name === 'sound' || e.target.name === 'volume') {
    const f = e.target.form.elements;
    const hint = e.target.form.querySelector('.sound-hint');
    if (hint) hint.textContent = ALARM_SOUNDS.find((s) => s.id === f.namedItem('sound').value)?.hint ?? '';
    sound.preview(f.namedItem('sound').value, f.namedItem('volume').value);
    return;
  }
  if (e.target.dataset?.act !== 'profile-photo') return;
  const file = e.target.files?.[0];
  if (!file) return;
  try { setPhotoPreview(await photoToDataUrl(file)); } catch { toast("That image couldn't be read. Try a JPEG or PNG."); }
});

sheet.addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const f = form.elements;
  const error = form.querySelector('.form-error');
  const fail = (msg) => { error.textContent = msg; error.hidden = false; };

  if (form.dataset.form === 'profile') {
    const p = normaliseProfile({
      name: f.namedItem('fullname').value, role: f.namedItem('role').value, studio: f.namedItem('studio').value,
      city: f.namedItem('city').value, project: f.namedItem('project').value, photo: f.namedItem('photo').value,
    });
    await tracker.saveSetting('profile', p);
    sheet.close();
    toast(p.name ? `Saved. Hello, ${p.name.split(' ')[0]}.` : 'Profile saved.');
    return;
  }
  const days = [...form.querySelectorAll('input[name="days"]:checked')].map((i) => Number(i.value));

  if (form.dataset.form === 'passcode') {
    const values = Object.fromEntries([...form.querySelectorAll('input[type=password]')].map((i) => [i.name, i.value]));
    if ('confirm' in values && values.confirm !== values.next) { fail("The two new passcodes don't match."); return; }
    const btn = form.querySelector('button[type=submit]');
    const label = btn.textContent;
    btn.disabled = true; btn.textContent = 'Working…'; error.hidden = true;
    try {
      const ask = pendingAsk;
      const result = await ask.onSubmit(values);
      pendingAsk = null;
      sheet.close();
      ask.resolve(result ?? true);
    } catch (err) {
      fail(err.message); btn.disabled = false; btn.textContent = label;
    }
    return;
  }

  if (form.dataset.form === 'alarm') {
    if (!days.length) { fail('Pick at least one day.'); return; }
    const preset = SHIFT_PRESETS[Number(f.namedItem('shift').value)];
    const fields = {
      label: f.namedItem('label').value.trim() || 'Alarm',
      time: f.namedItem('time').value,
      shiftMin: preset.min, shiftMax: preset.max,
      days, activity: f.namedItem('activity').value,
      sound: f.namedItem('sound').value, volume: f.namedItem('volume').value,
    };
    const id = form.dataset.aid;
    const list = form.dataset.new ? [...alarms(), { ...newAlarm(fields), id }] : alarms().map((a) => (a.id === id ? { ...a, ...fields } : a));
    await saveAlarms(list.sort((a, b) => a.time.localeCompare(b.time)));
    sheet.close();
    toast('Alarm saved. It shifts to a new random time each day.');
    return;
  }

  // habit form
  if (!f.namedItem('title').value.trim()) { fail('Give the habit a name.'); return; }
  if (!days.length) { fail('Pick at least one day.'); return; }
  const fields = {
    name: f.namedItem('title').value.trim(),
    slot: f.namedItem('slot').value,
    kind: f.namedItem('kind').value,
    target: Number(f.namedItem('target').value) || 1,
    days,
    essential: f.namedItem('essential').checked,
  };
  if (form.dataset.id) await tracker.updateHabit(form.dataset.id, fields);
  else await tracker.addHabit(fields);
  sheet.close();
});

// ---------------------------------------------------------------- backup
async function saveFile(name, text) {
  const blob = new Blob([text], { type: 'application/json' });
  const file = new File([blob], name, { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name }); return; } catch (err) { if (err.name === 'AbortError') return; }
  }
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

async function exportBackup() {
  const data = await tracker.exportData();
  if (!repo.isEncrypted()) { await saveFile(`studio-days-${todayKey()}.json`, JSON.stringify(data, null, 1)); return; }
  let sealed = null;
  await askPasscode({
    title: 'Encrypted backup',
    note: 'You will need this passcode to restore the backup. Your app passcode is fine.',
    fields: ['next', 'confirm'], submit: 'Export',
  }, async (v) => { sealed = await repo.sealBackup(data, v.next); });
  if (sealed) await saveFile(`studio-days-${todayKey()}.encrypted.json`, JSON.stringify(sealed));
}

async function importBackup(input) {
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  try {
    let json = JSON.parse(await file.text());
    if (json?.format === VAULT_FORMAT) {
      let opened = null;
      await askPasscode({ title: 'Restore encrypted backup', fields: ['passcode'], submit: 'Restore' },
        async (v) => { opened = await repo.openBackup(json, v.passcode); });
      if (!opened) return;
      json = opened;
    }
    if (!confirm('Replace everything on this device with this backup?')) return;
    await tracker.importData(json);
    toast('Backup restored.');
  } catch (err) {
    toast(err.message || 'Could not read that file.');
  }
}

// ---------------------------------------------------------------- boot
tracker.onChange(() => render());
initInteractiveGlass();
initMagnet();
initParallax();
const intro = playIntro();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
await repo.init();
if (repo.isLocked()) showLock();
else await startApp();
handleAlarmUrl(location.href);
intro.then(() => {
  if (ui.locked || !overlay.hidden) return;
  viewEl.innerHTML = ''; // reveal fresh as the intro lifts, without an exit fade
  render(true);
});
ui.persisted = await requestPersistence();

// Rendering only: each function takes data and returns an HTML string. Events live in main.js.
import {
  SLOTS, KINDS, isScheduled, isPaused, isDone, currentStreak, bestStreak, weekSummary,
  dayProgress, goodDayStreak, cellState,
} from '../domain/habits.js';
import { formatWeekday, formatDate, formatShort, formatWeekdayInitial, addDays, weekday, startOfWeek, daysBetween } from '../domain/dates.js';
import { SHIFT_PRESETS, ACTIVITIES, ALARM_SOUNDS, ALARM_VOLUMES, soundOf, windowLabel } from '../domain/alarms.js';
import { LIBRARY } from '../domain/library.js';
import { THEMES, PACK_GROUPS, GROUP_LABELS, packById } from '../domain/themes.js';
import { ROLES, hasProfile, initials, greeting, subtitle } from '../domain/profile.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad2 = (n) => String(n).padStart(2, '0');
const hm = (min) => (min >= 60 ? `${Math.floor(min / 60)}h ${pad2(min % 60)}m` : `${min}m`);
const count = (key, value, { pad = 0, text } = {}) =>
  `<span data-count="${key}" data-value="${value}"${pad ? ` data-pad="${pad}"` : ''}${text ? ` data-text="${esc(text)}"` : ''}>${text ?? String(value).padStart(pad, '0')}</span>`;

// ---- glyphs (stroke icons, 24px grid)
const ICON = {
  morning: '<path d="M3 17h18M7 17a5 5 0 0 1 10 0M12 5v3M5.6 9.6l1.9 1.4M18.4 9.6l-1.9 1.4"/>',
  studio: '<path d="M4 20V4l16 16z"/><path d="M8 16v-4.5l4.5 4.5z"/>',
  field: '<path d="M4 20h16M6 20V9l6-4 6 4v11M10 20v-4h4v4M9 12h2M13 12h2"/>',
  evening: '<path d="M19.5 14.5A7.5 7.5 0 1 1 9.5 4.5a6 6 0 0 0 10 10z"/>',
  compass: '<circle cx="12" cy="4.5" r="1.8"/><path d="M11 6.2L6 20M13 6.2L18 20M8.3 14h7.4"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7M10 17h4"/>',
  check: '<path d="M6 12.5l4 4 8-9"/>',
  clock: '<circle cx="12" cy="12" r="8"/><path d="M12 7.5V12l3 2"/>',
  lock: '<rect x="5" y="10.5" width="14" height="9.5" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5M12 14.5v2"/>',
  bell: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15zM10 20.5a2 2 0 0 0 4 0"/>',
  play: '<path d="M8 5.5v13l10.5-6.5z"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  alarm: '<circle cx="12" cy="13" r="7"/><path d="M12 9.5V13l2.5 1.5M4.5 5.5l3-2.5M19.5 5.5l-3-2.5"/>',
  moon: '<path d="M19.5 14.5A7.5 7.5 0 1 1 9.5 4.5a6 6 0 0 0 10 10z"/>',
  user: '<circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/>',
  camera: '<path d="M4 8h3l2-2.5h6L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18"/>',
};
export const icon = (name, cls = '') => `<svg class="ico ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICON[name]}</svg>`;

/** Tile tone per slot, alternating so a long list stays rhythmic. */
const TONES = { morning: ['lime', 'glass'], studio: ['ink', 'glass'], field: ['moss', 'glass'], evening: ['ink', 'lime'] };

function scheduleLabel(days) {
  const s = [...days].sort().join('');
  if (s === '0123456') return 'Every day';
  if (s === '12345') return 'Weekdays';
  if (s === '123456') return 'Mon–Sat';
  if (s === '06') return 'Weekends';
  return [1, 2, 3, 4, 5, 6, 0].filter((d) => days.includes(d)).map((d) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(' ');
}

function pageHead(eyebrow, title, right = '') {
  return `<header class="page-head"><div><p class="eyebrow">${eyebrow}</p><h1>${title}</h1></div>${right}</header>`;
}

function bestOf(tracker, today, charrette) {
  let best = { n: 0, name: '—' };
  for (const h of tracker.habits()) {
    const n = bestStreak(h, today, tracker.valueOf, charrette);
    if (n > best.n) best = { n, name: h.name };
  }
  return best;
}

// ================= TODAY =================
function habitRow(h, value, streak) {
  const done = isDone(h, value);
  const unit = KINDS[h.kind].unit;
  const parts = [];
  if (h.kind !== 'check') parts.push(`${value}/${h.target} ${unit}`);
  if (streak > 0) parts.push(`<span class="run">${streak}-day run</span>`);
  let controls = '';
  if (h.kind === 'minutes') {
    controls = `<div class="steps">
      <button data-act="timer" class="play" aria-label="Start a focus timer">${icon('play')}</button>
      <button data-act="step" data-step="-5" aria-label="Remove 5 minutes">−5</button>
      <button data-act="step" data-step="5" aria-label="Add 5 minutes">+5</button>
      <button data-act="step" data-step="15" aria-label="Add 15 minutes">+15</button></div>`;
  } else if (h.kind === 'count') {
    controls = `<div class="steps">
      <button data-act="step" data-step="-1" aria-label="Remove one">−</button>
      <button data-act="step" data-step="1" aria-label="Add one">+1</button></div>`;
  }
  const fill = Math.min(1, value / h.target);
  return `<li class="habit ${done ? 'is-done' : ''}" data-id="${h.id}">
    <span class="badge badge-${h.slot}">${icon(h.slot)}</span>
    <div class="habit-body">
      <span class="habit-name">${esc(h.name)}</span>
      ${parts.length ? `<span class="habit-meta">${parts.join('<span class="dot">·</span>')}</span>` : ''}
      ${controls}
    </div>
    <button class="tick" data-act="toggle" aria-pressed="${done}" aria-label="${done ? 'Mark not done' : 'Mark done'}: ${esc(h.name)}"
      style="--fill:${(fill * 360).toFixed(0)}deg">${icon('check')}</button>
  </li>`;
}

const MOODS = ['Drained', 'Low', 'Okay', 'Good', 'Great'];

export function todayView(tracker, day, today, { nextAlarm, profile = {}, hour = 12 } = {}) {
  const charrette = tracker.charretteDays();
  const all = tracker.habits();
  const habits = all.filter((h) => isScheduled(h, day));
  const active = habits.filter((h) => !isPaused(h, day, charrette));
  const paused = habits.filter((h) => isPaused(h, day, charrette));
  const prog = dayProgress(all, day, tracker.valueOf, charrette);
  const isToday = day === today;
  const streakFor = (h) => (isToday ? currentStreak(h, today, tracker.valueOf, charrette) : 0);
  const goodRun = goodDayStreak(all, today, tracker.valueOf, charrette);
  const best = bestOf(tracker, today, charrette);
  const studioMin = active.filter((h) => h.slot === 'studio' && h.kind === 'minutes').reduce((a, h) => a + tracker.valueOf(h.id, day), 0);
  const mood = tracker.mood(day);

  const weekDots = daysBetween(startOfWeek(day), addDays(startOfWeek(day), 6)).map((d) => {
    const p = dayProgress(all, d, tracker.valueOf, charrette);
    const state = d > today || p.rate === null ? 'future' : p.rate >= 0.75 ? 'good' : p.rate > 0 ? 'some' : d === today ? 'today' : 'miss';
    const lbl = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][weekday(d)];
    return `<span class="goal-day g-${state} ${d === day ? 'is-sel' : ''}">
      <i>${state === 'good' ? icon('check') : state === 'some' ? `<b>${Math.round(p.rate * 100)}<small>%</small></b>` : ''}</i><small>${lbl}</small></span>`;
  }).join('');

  const slots = SLOTS.map((slot) => {
    const items = active.filter((h) => h.slot === slot.id);
    if (!items.length) return '';
    return `<div class="slot"><h3>${slot.label}<small>${slot.hint}</small></h3>
      <ul class="habit-list">${items.map((h) => habitRow(h, tracker.valueOf(h.id, day), streakFor(h))).join('')}</ul></div>`;
  }).join('');

  const pausedBlock = paused.length ? `<details class="paused">
      <summary>${paused.length} paused for charrette</summary>
      <ul class="habit-list">${paused.map((h) => habitRow(h, tracker.valueOf(h.id, day), 0)).join('')}</ul>
    </details>` : '';

  const dayNav = `<div class="pill-nav">
      <button data-act="day" data-delta="-1" aria-label="Previous day">‹</button>
      <button data-act="day" data-delta="1" aria-label="Next day" ${day >= today ? 'disabled' : ''}>›</button></div>`;

  return `
    ${pageHead(`${isToday ? esc(greeting(profile.name, hour)) : '<button class="link-btn" data-act="go-today">← Today</button>'} · ${formatWeekday(day).slice(0, 3)} ${formatShort(day)}`,
      isToday ? "Today's Focus" : formatWeekday(day), dayNav)}

    <section class="card tone-ink goal-card">
      <div class="card-head"><h2>Daily Goal</h2>
        <span class="goal-today"><b>${count('done', prog.done)}</b> of ${prog.total} today</span></div>
      <div class="goal-row">${weekDots}</div>
      <div class="mini-bar"><span style="width:${prog.total ? (prog.done / prog.total) * 100 : 0}%"></span></div>
    </section>

    ${charrette.has(day) ? `<div class="banner">${icon('spark')}<span><strong>Charrette mode</strong> — only essentials count; other streaks are frozen.</span></div>` : ''}

    <label class="card tone-glass priority">
      <span class="label">One design priority</span>
      <input type="text" data-act="note" maxlength="140" placeholder="e.g. Resolve the stair–core junction" value="${esc(tracker.note(day))}">
    </label>

    <section class="card tone-glass list-card">
      <div class="card-head"><p class="label">${isToday ? "Today's habits" : 'Habits'}</p>
        <button class="chip-btn" data-act="library">${icon('plus')} Add</button></div>
      ${slots || '<p class="empty">Nothing scheduled for this day.</p>'}
      ${pausedBlock}
    </section>

    <section class="card tone-glass mood-card">
      <p class="label">How's your energy?</p>
      <div class="mood-row" role="radiogroup" aria-label="Energy today">
        ${MOODS.map((m, i) => `<button role="radio" aria-checked="${mood === i + 1}" data-act="mood" data-mood="${i + 1}" class="mood m${i + 1} ${mood === i + 1 ? 'on' : ''}">
          <i></i><small>${m}</small></button>`).join('')}
      </div>
    </section>

    <section class="bento">
      <div class="card tone-lime hero">
        <p class="label">Good-day run</p>
        <p class="big">${count('goodRun', goodRun)}<small>days</small></p>
        <p class="fine">¾ of habits done</p>
        ${icon('compass', 'hero-ico')}
      </div>
      <div class="card tone-glass row-card">
        <span class="disc">${icon('trophy')}</span>
        <div><p class="label">Best streak</p><p class="mid sm">${count('best', best.n)}</p><p class="fine clamp">${esc(best.name)}</p></div>
      </div>
      <div class="card tone-moss row-card">
        <span class="disc light">${icon('clock')}</span>
        <div><p class="label">Studio time</p><p class="mid sm">${hm(studioMin)}</p></div>
      </div>
    </section>

    <button class="card tone-ink row-card alarm-chip" data-act="go-alarms">
      <span class="disc dark">${icon('alarm')}</span>
      <div><p class="label">Next alarm</p><p class="alarm-line"><b>${nextAlarm ? esc(nextAlarm.label) : 'None set'}</b>
      <span>${nextAlarm ? esc(nextAlarm.when) : 'Tap to add one'}</span></p></div>
    </button>`;
}

// ================= HABITS =================
export function habitsView(tracker, today) {
  const charrette = tracker.charretteDays();
  const habits = tracker.habits();
  const last7 = daysBetween(addDays(today, -6), today);
  const counters = {};
  const tiles = SLOTS.flatMap((slot) => habits.filter((h) => h.slot === slot.id)).map((h) => {
    const i = (counters[h.slot] = (counters[h.slot] ?? -1) + 1);
    const tone = TONES[h.slot][i % 2];
    const streak = currentStreak(h, today, tracker.valueOf, charrette);
    const dots = last7.map((d) => `<i class="d-${cellState(h, d, today, tracker.valueOf, charrette)}"></i>`).join('');
    return `<button class="tile tone-${tone}" data-act="edit" data-id="${h.id}">
      <span class="tile-top"><span class="tile-name">${esc(h.name)}</span>${icon(h.slot, 'tile-ico')}</span>
      <span class="tile-num${streak ? '' : ' zero'}">${pad2(streak)}</span>
      <span class="label">Day streak</span>
      <span class="tile-sub">${scheduleLabel(h.days)}${h.kind !== 'check' ? ` · ${h.target} ${KINDS[h.kind].unit}` : ''}${h.essential ? ' · <span class="ess">Essential</span>' : ''}</span>
      <span class="tile-dots" aria-label="Last 7 days">${dots}</span>
    </button>`;
  }).join('');
  return `
    ${pageHead('Tracked items', 'My Habits', `<span class="count-pill">All (${habits.length})</span>`)}
    <section class="tiles">${tiles || '<p class="empty">No habits yet.</p>'}</section>
    <p class="note"><span class="ess">Essential</span> habits keep counting in charrette mode. Tap a tile to edit it.</p>
    <button class="fab" data-act="library" aria-label="Add a habit">${icon('plus')}</button>`;
}

export function librarySheet(tracker) {
  return `<div class="sheet-form library">
    <div class="sheet-grip"></div>
    <h2>Add habits</h2>
    <p class="note">${LIBRARY.reduce((n, g) => n + g.items.length, 0)} ideas in ${LIBRARY.length} groups. Tap to add — everything stays editable afterwards.</p>
    <div class="lib-cats" role="tablist" aria-label="Jump to a group">
      ${LIBRARY.map((g, gi) => `<button data-act="lib-cat" data-g="${gi}">${esc(g.category)}<small>${g.items.length}</small></button>`).join('')}
    </div>
    ${LIBRARY.map((g, gi) => `<section class="lib-group" id="lib-g-${gi}">
      <h3>${esc(g.category)}</h3>
      <div class="lib-chips">${g.items.map((it, ii) => {
        const has = tracker.hasHabitNamed(it.name);
        return `<button class="lib-chip ${has ? 'added' : ''}" data-act="lib-add" data-g="${gi}" data-i="${ii}" ${has ? 'disabled' : ''}>
          <span class="badge badge-${it.slot}">${icon(it.slot)}</span>
          <span><b>${esc(it.name)}</b><small>${it.kind === 'check' ? scheduleLabel(it.days) : `${it.target} ${KINDS[it.kind].unit} · ${scheduleLabel(it.days)}`}</small></span>
          <i class="lib-state">${icon(has ? 'check' : 'plus')}</i></button>`;
      }).join('')}</div></section>`).join('')}
    <div class="sheet-actions sticky">
      <button type="button" class="ghost-btn" data-act="custom">Custom habit</button>
      <button type="button" class="primary-btn" data-act="cancel">Done</button>
    </div>
  </div>`;
}

// ================= ALARMS =================
// ---- Lock-screen alarm: visual Shortcuts setup guide (drawn iPhone screens, not screenshots)
const tapRing = '<i class="tap-ring" aria-hidden="true"></i>';
const iosRow = (label, right = '›', { tap = false, sub = '' } = {}) =>
  `<div class="ios-row${tap ? ' is-tap' : ''}"><span>${label}${sub ? `<small>${sub}</small>` : ''}</span><b>${right}</b>${tap ? tapRing : ''}</div>`;
const iosToggle = (on, tap = false) => `<i class="ios-toggle${on ? ' on' : ''}">${tap ? tapRing : ''}</i>`;
const iosBlock = (colour, title, detail = '', { tap = false, indent = 0 } = {}) =>
  `<div class="ios-block${tap ? ' is-tap' : ''}" style="--c:${colour};margin-left:${indent * 14}px"><i></i><span><b>${title}</b>${detail ? ` ${detail}` : ''}</span>${tap ? tapRing : ''}</div>`;
const phone = (title, body, { back = '', action = '' } = {}) =>
  `<div class="ios-phone"><div class="ios-bar">${back ? `<span class="ios-back">‹ ${back}</span>` : '<span></span>'}<b>${title}</b><span class="ios-act">${action}</span></div><div class="ios-body">${body}</div></div>`;
const varChip = (t) => `<em class="ios-var">${t}</em>`;

export const CLOCK_GUIDE_STEPS = [
  {
    title: 'Copy your link',
    text: 'You will paste this private link into the shortcut in step 3. Copy it now — every step that needs it has a copy button too.',
    copies: [{ label: 'Copy link', key: 'url' }],
    mock: phone('Archie Line', `<div class="ios-card"><small>YOUR PRIVATE LINK</small><code>https://studio-days-push…/ring/…</code><div class="ios-btn is-tap">Copy link${tapRing}</div></div>`),
  },
  {
    title: 'Create a new shortcut',
    text: 'Open the <b>Shortcuts</b> app and go to <b>Shortcuts</b> (all shortcuts). Tap <b>+</b> to create a new shortcut. Tap its name at the top and call it <b>Archie Line Alarm</b>.',
    copies: [{ label: 'Copy name', text: 'Archie Line Alarm' }],
    mock: phone('All Shortcuts', `<div class="ios-grid"><span>Morning</span><span>Home</span><span>Notes</span></div>`, { action: `<span class="is-tap">+${tapRing}</span>` }),
  },
  {
    title: 'Fetch today’s alarm time',
    text: 'Tap the search field for actions and type <b>Get Contents of URL</b>. Add it, tap the URL field and <b>paste your link</b>.',
    copies: [{ label: 'Copy link', key: 'url' }],
    mock: phone('Archie Line Alarm', `${iosBlock('#2f7ee6', 'Get contents of', `<em class="ios-var is-tap">paste link${tapRing}</em>`)}<div class="ios-search">Search actions: <b>Get Contents of URL</b></div>`, { action: 'Done' }),
  },
  {
    title: 'Remove yesterday’s alarm',
    text: 'Search actions for <b>alarm</b>. Add the action that <b>finds</b> alarms (usually <b>Find Alarms</b>), tap <b>Add Filter</b> and set <b>Label is Archie Line</b>. Then add <b>Delete Alarms</b> — it uses the alarms just found. If your version has no filter, add <b>Repeat with Each</b> and an <b>If Label is Archie Line</b> around Delete instead.',
    copies: [{ label: 'Copy “Archie Line”', text: 'Archie Line' }],
    mock: phone('Archie Line Alarm', `${iosBlock('#2f7ee6', 'Get contents of', varChip('URL'))}${iosBlock('#f59e0b', 'Find Alarms where', `Label is <em class="ios-var is-tap">Archie Line${tapRing}</em>`)}${iosBlock('#f59e0b', 'Delete', varChip('Alarms'))}<div class="ios-search">Search actions: <b>alarm</b></div>`, { action: 'Done' }),
  },
  {
    title: 'Add today’s alarm',
    text: 'Add <b>If</b>: first field <b>Contents of URL</b>, condition <b>is not</b>, text <b>off</b>. Inside the If, add the action that <b>adds</b> an alarm (usually <b>Add Alarm</b>, older versions say <b>Create Alarm</b>). Set its time to <b>Contents of URL</b> and its label to <b>Archie Line</b>. Tap <b>Done</b>.',
    copies: [{ label: 'Copy “off”', text: 'off' }, { label: 'Copy “Archie Line”', text: 'Archie Line' }],
    mock: phone('Archie Line Alarm', `${iosBlock('#f59e0b', 'Delete', varChip('Alarms'))}${iosBlock('#8e8e93', 'If', `${varChip('Contents of URL')} is not <em class="ios-var">off</em>`)}${iosBlock('#f59e0b', 'Add alarm at', `${varChip('Contents of URL')} label <em class="ios-var is-tap">Archie Line${tapRing}</em>`, { indent: 1 })}${iosBlock('#8e8e93', 'End If')}`, { action: '<span class="is-tap">Done' + tapRing + '</span>' }),
  },
  {
    title: 'Run it every night at 2:00 AM',
    text: 'Open your <b>Archie Line Alarm</b> shortcut, tap <b>Edit</b>, then <b>Automation</b>. Choose <b>Time of Day</b>, set <b>2:00 AM</b> and <b>Daily</b>. (On older iOS: Automation tab → <b>+</b> → Time of Day → Run Immediately → pick this shortcut.)',
    mock: phone('Automation', `${iosRow('Time of Day', '2:00 AM', { tap: true })}${iosRow('Repeat', 'Daily')}${iosRow('Arrive', '')}${iosRow('Alarm', '')}`, { back: 'Edit', action: 'Done' }),
  },
  {
    title: 'Let it run while you sleep',
    text: 'Still in the shortcut: tap <b>Edit</b>, then the <b>ⓘ</b> button → <b>Privacy</b> → turn on <b>Allow Running When Locked</b>. If testing later asks “Delete alarm?”, also turn on <b>Allow Deleting Without Confirmation</b> (iPhone Settings → Apps → Shortcuts → Advanced, if your version has it).',
    mock: phone('Privacy', `${iosRow('Allow Running When Locked', iosToggle(true, true))}${iosRow('Allow Deleting Without Confirmation', iosToggle(true))}`, { back: 'Details', action: 'Done' }),
  },
  {
    title: 'Test it',
    text: 'Run the shortcut once with <b>▶</b>. Then open the <b>Clock</b> app: an <b>Archie Line</b> alarm should be there at today’s time below. If it is, you’re done — it resets itself every night. If any screen looked different, send a screenshot and the guide will be updated.',
    check: true,
    mock: phone('Alarm', `<div class="ios-alarm is-tap"><b class="ios-alarm-time">--:--</b><small>Archie Line</small>${iosToggle(true)}${tapRing}</div>`, { action: 'Edit' }),
  },
];

/** One step of the guide, shown in the sheet. `expected` is today's time from the link (or null). */
export function clockGuideSheet(step, { expected = null } = {}) {
  const s = CLOCK_GUIDE_STEPS[step];
  const n = CLOCK_GUIDE_STEPS.length;
  const mock = s.check && expected ? s.mock.replace('--:--', expected === 'off' ? 'off today' : expected) : s.mock;
  return `<div class="sheet-form guide-sheet" data-step="${step}">
    <div class="sheet-grip"></div>
    <div class="guide-head"><small>Step ${step + 1} of ${n}</small><button type="button" class="ghost-btn guide-close" data-act="cancel">Close</button></div>
    <div class="guide-progress">${CLOCK_GUIDE_STEPS.map((_, i) => `<i class="${i < step ? 'done' : i === step ? 'on' : ''}"></i>`).join('')}</div>
    <h2>${s.title}</h2>
    <div class="guide-mock">${mock}</div>
    <p class="guide-text">${s.text}</p>
    ${s.copies ? `<div class="btn-row guide-copies">${s.copies.map((c) => `<button type="button" class="ghost-btn" data-act="guide-copy" ${c.key ? `data-key="${c.key}"` : `data-text="${esc(c.text)}"`}>${c.label}</button>`).join('')}</div>` : ''}
    ${s.check ? `<div class="btn-row guide-copies"><button type="button" class="ghost-btn" data-act="guide-check">Today's time${expected ? `: ${expected}` : ''}</button></div>` : ''}
    <div class="sheet-actions guide-nav">
      ${step > 0 ? '<button type="button" class="ghost-btn" data-act="guide-prev">Back</button>' : '<span></span>'}
      ${step < n - 1 ? '<button type="button" class="primary-btn" data-act="guide-next">Next</button>' : '<button type="button" class="primary-btn" data-act="guide-done">It worked</button>'}
    </div>
  </div>`;
}

function lockAlarmCard({ connected, url, done }) {
  let body;
  if (!connected) {
    body = `<p class="fine">First turn on <b>Reminders</b> in Settings — the link reads your alarm from the push server.</p>
      <button class="primary-btn" data-act="goto-settings">Open Settings</button>`;
  } else if (!url) {
    body = `<p class="fine">Creates a private link that tells the Shortcuts app today's shifted time, so the iPhone's own alarm rings — locked, on silent, no Bedside mode.</p>
      <button class="primary-btn" data-act="clock-link">${icon('alarm')} Create my link</button>`;
  } else {
    body = `<label class="field"><span>Your private link</span><input class="clock-url" readonly value="${esc(url)}" aria-label="Your Shortcuts link"></label>
      <div class="btn-row"><button class="primary-btn" data-act="clock-copy">Copy link</button><button class="ghost-btn" data-act="clock-check">Today's time</button><button class="ghost-btn" data-act="clock-link" title="Replace the link (the old one stops working)">New link</button></div>
      <button class="${done ? 'ghost-btn' : 'primary-btn'} wide guide-start" data-act="clock-guide">${done ? 'Show the setup steps again' : `Start the visual setup · ${CLOCK_GUIDE_STEPS.length} steps, about 5 min`}</button>
      <p class="fine">Keep <b>Reminders</b> on: the notification at the same moment opens Archie Line for the wake-up activity — tap it after you stop the Clock alarm.</p>`;
  }
  return `<section class="card tone-glass lock-alarm-card">
    <div class="card-title">${icon('alarm')}<h2>Lock-screen alarm</h2>${done ? '<span class="ok-pill lime">Set up ✓</span>' : url ? '<span class="ok-pill">Link ready</span>' : ''}</div>
    ${body}
  </section>`;
}

export function alarmsView(alarms, { recordFor, bedside, clock = {} }) {
  const cards = alarms.map((a) => {
    const rec = recordFor(a.id);
    return `<article class="card ${a.on ? 'tone-ink' : 'tone-glass'} alarm-card" data-aid="${a.id}">
      <div class="alarm-top">
        <button class="alarm-time" data-act="alarm-edit" aria-label="Edit ${esc(a.label)}">${a.time}</button>
        <label class="switch"><input type="checkbox" data-act="alarm-on" ${a.on ? 'checked' : ''} aria-label="Alarm on"><span></span></label>
      </div>
      <p class="alarm-label">${esc(a.label)}</p>
      <p class="fine">${windowLabel(a)} · ${scheduleLabel(a.days)}</p>
      <div class="alarm-foot">
        <span class="pill">${esc(ACTIVITIES[a.activity] ?? ACTIVITIES.random)}</span>
        ${rec ? `<span class="pill lime">${icon('check')} Today ${rec.at} · ${Math.max(1, Math.round(rec.took / 60))} min</span>` : ''}
      </div>
    </article>`;
  }).join('');
  return `
    ${pageHead('Wake with intent', 'Alarms', `<button class="count-pill" data-act="alarm-new">${icon('plus')} New</button>`)}
    ${lockAlarmCard(clock)}
    <section class="card tone-moss bedside-card">
      <div><p class="label">Bedside mode</p><h2>${bedside ? 'On' : 'Keep the app awake overnight'}</h2>
      <p class="fine">Optional: keep Archie Line open on charge to hear your chosen alarm sound. With the lock-screen alarm above you don't need it.</p></div>
      <button class="primary-btn on-moss" data-act="bedside">${icon('moon')} Start</button>
    </section>
    ${cards || '<p class="empty">No alarms yet.</p>'}
    <p class="note">Each day the alarm shifts by a fresh random amount inside its window, so your body can't learn it. It stops only when you finish a short activity.</p>
    <button class="ghost-btn wide" data-act="alarm-test">Try the alarm now</button>`;
}

export function alarmForm(a, isNew) {
  const chips = [1, 2, 3, 4, 5, 6, 0].map((d) => `<label class="chip">
      <input type="checkbox" name="days" value="${d}" ${a.days.includes(d) ? 'checked' : ''}><span>${['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'][d]}</span></label>`).join('');
  const preset = SHIFT_PRESETS.findIndex((p) => p.min === a.shiftMin && p.max === a.shiftMax);
  return `<form method="dialog" class="sheet-form" data-form="alarm" data-aid="${a.id}" data-new="${isNew ? 1 : ''}">
    <div class="sheet-grip"></div>
    <h2>${isNew ? 'New alarm' : 'Edit alarm'}</h2>
    <label class="field"><span>Label</span><input name="label" maxlength="40" value="${esc(a.label)}" required></label>
    <div class="field-row">
      <label class="field"><span>Around</span><input name="time" type="time" value="${a.time}" required></label>
      <label class="field"><span>Random shift</span><select name="shift">
        ${SHIFT_PRESETS.map((p, i) => `<option value="${i}" ${i === (preset < 0 ? 0 : preset) ? 'selected' : ''}>${p.label}</option>`).join('')}
      </select></label>
    </div>
    <fieldset class="field"><legend>Days</legend><div class="chips">${chips}</div></fieldset>
    <div class="field-row">
      <label class="field"><span>Sound</span><select name="sound">
        ${ALARM_SOUNDS.map((s) => `<option value="${s.id}" ${s.id === soundOf(a).sound ? 'selected' : ''}>${s.label}</option>`).join('')}
      </select></label>
      <label class="field"><span>Volume</span><select name="volume">
        ${ALARM_VOLUMES.map((v) => `<option value="${v.id}" ${v.id === soundOf(a).volume ? 'selected' : ''}>${v.label.replace(/ \(.*\)/, '')}</option>`).join('')}
      </select></label>
    </div>
    <div class="sound-preview-row">
      <button type="button" class="ghost-btn" data-act="sound-preview">${icon('play')} Preview</button>
      <small class="sound-hint">${esc(ALARM_SOUNDS.find((s) => s.id === soundOf(a).sound)?.hint ?? '')}</small>
    </div>
    <p class="note small">Turn the iPhone volume up with the side buttons. With the app open (or in Bedside mode) the alarm plays even when the phone is on silent.</p>
    <label class="field"><span>To switch it off</span><select name="activity">
      ${Object.entries(ACTIVITIES).map(([k, v]) => `<option value="${k}" ${k === a.activity ? 'selected' : ''}>${v}</option>`).join('')}
    </select></label>
    <p class="form-error" hidden></p>
    <div class="sheet-actions">
      ${isNew ? '' : '<button type="button" class="danger-btn" data-act="alarm-delete">Delete</button>'}
      <button type="button" class="ghost-btn" data-act="cancel">Cancel</button>
      <button type="submit" class="primary-btn">Save</button>
    </div>
  </form>`;
}

export function alarmOverlay(label, time) {
  return `<div class="ring-stage">
    <div class="ripples"><i></i><i></i><i></i></div>
    <div class="ring-bell">${icon('alarm')}</div>
    <p class="ring-time">${time}</p>
    <p class="ring-label">${esc(label)}</p>
  </div>
  <div class="ring-panel">
    <p class="fine">Finish a short activity to switch it off.</p>
    <button class="primary-btn big-btn" data-act="ring-start">I'm up — start</button>
  </div>
  <div class="activity" hidden></div>`;
}

export function timerOverlay(name, minutes) {
  return `<div class="timer">
    <p class="eyebrow">Focus</p>
    <h2>${esc(name)}</h2>
    <div class="timer-ring">
      <svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="52" class="t-track"/><circle cx="60" cy="60" r="52" class="t-fill"/></svg>
      <p class="timer-clock">${pad2(minutes)}:00</p>
    </div>
    <div class="timer-len">${[15, 25, 45, 60].map((m) => `<button data-act="timer-len" data-min="${m}" class="${m === minutes ? 'on' : ''}">${m}m</button>`).join('')}</div>
    <div class="btn-row center-row">
      <button class="primary-btn" data-act="timer-toggle">${icon('play')} Start</button>
      <button class="ghost-btn" data-act="timer-stop">Stop &amp; log</button>
    </div>
    <p class="fine">Minutes are added to the habit when you stop.</p>
  </div>`;
}

export function bedsideOverlay(clock, next) {
  return `<div class="bedside">
    <p class="bed-clock">${clock}</p>
    <p class="bed-next">${next ? `${icon('alarm')} ${esc(next)}` : 'No alarm tonight'}</p>
    <p class="fine">Screen stays on · tap twice to exit</p>
  </div>`;
}

// ================= PROGRESS =================
export function progressView(tracker, weekStart, today) {
  const charrette = tracker.charretteDays();
  const habits = tracker.habits();
  const s = weekSummary(habits, weekStart, today, tracker.valueOf, charrette);

  const heat = daysBetween(addDays(weekStart, -14), addDays(weekStart, 6)).map((d, i) => {
    const p = dayProgress(habits, d, tracker.valueOf, charrette);
    let lvl = 'none';
    if (d <= today && p.rate !== null) lvl = p.rate >= 1 ? 4 : p.rate >= 0.75 ? 3 : p.rate >= 0.4 ? 2 : p.rate > 0 ? 1 : 0;
    return `<span class="heat heat-${lvl} ${d === today ? 'is-today' : ''}" style="--i:${i}" title="${formatShort(d)}${p.rate !== null && d <= today ? ` · ${p.done}/${p.total}` : ''}"></span>`;
  }).join('');

  const best = bestOf(tracker, today, charrette);
  const pct = Math.round(s.rate * 100);
  const C = 2 * Math.PI * 26;
  const moods = s.days.map((d) => {
    const m = tracker.mood(d);
    return `<span class="mood-bar"><i style="--h:${m * 20}%" class="${m ? `m${m}` : 'none'}"></i><small>${formatWeekdayInitial(weekday(d))}</small></span>`;
  }).join('');

  const header = s.days.map((d) => `<th scope="col" class="${d === today ? 'is-today' : ''}">${formatWeekdayInitial(weekday(d))}</th>`).join('');
  const rows = s.rows.filter((r) => r.scheduled || r.total).map((r) => `<tr>
      <th scope="row">${esc(r.habit.name)}<small>${r.done} of ${r.scheduled} ${r.scheduled === 1 ? 'day' : 'days'}</small></th>
      ${r.cells.map((c) => `<td><i class="d-${c}" title="${c}"></i></td>`).join('')}</tr>`).join('');

  const nav = `<div class="pill-nav label-pill">
      <button data-act="week" data-delta="-7" aria-label="Previous week">‹</button>
      <span>${formatShort(weekStart)}–${formatShort(addDays(weekStart, 6))}</span>
      <button data-act="week" data-delta="7" aria-label="Next week" ${addDays(weekStart, 7) > today ? 'disabled' : ''}>›</button></div>`;

  return `
    ${pageHead('Weekly review', 'Your Progress')}
    ${nav}
    <section class="card tone-glass">
      <div class="card-head"><p class="label">Habit heatmap</p>
        <span class="heat-key"><i class="heat heat-1"></i><i class="heat heat-3"></i><i class="heat heat-4"></i> activity</span></div>
      <div class="heat-head">${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((x) => `<b>${x}</b>`).join('')}</div>
      <div class="heat-grid">${heat}</div>
    </section>

    <section class="bento two">
      <div class="card tone-ink center-card">
        <p class="label">Completion</p>
        <svg class="ring" viewBox="0 0 64 64" aria-hidden="true">
          <circle cx="32" cy="32" r="26" class="ring-track"/>
          <circle cx="32" cy="32" r="26" class="ring-fill" style="--dash:${(s.rate * C).toFixed(1)}" stroke-dasharray="${(s.rate * C).toFixed(1)} ${C.toFixed(1)}"/>
        </svg>
        <p class="ring-num">${count('pct', pct, { text: `${pct}%` })}</p>
      </div>
      <div class="card tone-lime">
        <p class="label">Total check-ins</p>
        <p class="mid">${count('total', tracker.totalCheckIns())}</p>
        <p class="fine">all time</p>
      </div>
      <div class="card tone-moss">
        <p class="label">Studio time</p><p class="mid sm">${hm(s.minutesBySlot.studio)}</p><p class="fine">this week</p>
      </div>
      <div class="card tone-mint">
        <p class="label">Sketch &amp; field</p><p class="mid sm">${hm(s.minutesBySlot.morning + s.minutesBySlot.field)}</p><p class="fine">this week</p>
      </div>
    </section>

    <section class="card tone-glass">
      <p class="label">Energy this week</p>
      <div class="mood-bars">${moods}</div>
    </section>

    <section class="card tone-ink grid-card">
      <p class="label">This week, habit by habit</p>
      <table class="week-grid"><thead><tr><th></th>${header}</tr></thead>
        <tbody>${rows || '<tr><td colspan="8" class="empty">No habits scheduled this week.</td></tr>'}</tbody></table>
      <ul class="legend">
        <li><i class="d-done"></i>Done</li><li><i class="d-partial"></i>Started</li><li><i class="d-missed"></i>Missed</li>
        <li><i class="d-pending"></i>Today</li><li><i class="d-paused"></i>Charrette</li>
      </ul>
    </section>

    <section class="card tone-lime long-card">
      <p class="label">All-time longest streak</p>
      <p class="big">${count('longest', best.n)}<small>days</small></p>
      <p class="fine clamp">${esc(best.name)}</p>
      ${icon('trophy', 'corner-ico big-ico')}
    </section>`;
}

// ================= FORMS =================
export function habitForm(h) {
  const isNew = !h;
  h ??= { name: '', slot: 'studio', kind: 'check', target: 1, days: [0, 1, 2, 3, 4, 5, 6], essential: false };
  const dayChips = [1, 2, 3, 4, 5, 6, 0].map((d) => `<label class="chip">
      <input type="checkbox" name="days" value="${d}" ${h.days.includes(d) ? 'checked' : ''}>
      <span>${['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'][d]}</span></label>`).join('');
  return `<form method="dialog" class="sheet-form" data-id="${isNew ? '' : h.id}">
    <div class="sheet-grip"></div>
    <h2>${isNew ? 'New habit' : 'Edit habit'}</h2>
    <label class="field"><span>Name</span><input name="title" required maxlength="60" value="${esc(h.name)}" placeholder="e.g. Hand-draft one detail"></label>
    <label class="field"><span>Part of day</span><select name="slot">
      ${SLOTS.map((s) => `<option value="${s.id}" ${s.id === h.slot ? 'selected' : ''}>${s.label} — ${s.hint}</option>`).join('')}
    </select></label>
    <div class="field-row">
      <label class="field"><span>Measure</span><select name="kind">
        ${Object.entries(KINDS).map(([k, v]) => `<option value="${k}" ${k === h.kind ? 'selected' : ''}>${v.label}</option>`).join('')}
      </select></label>
      <label class="field target-field" ${h.kind === 'check' ? 'hidden' : ''}><span>Daily target</span>
        <input name="target" type="number" inputmode="numeric" min="1" max="1440" value="${h.target}"></label>
    </div>
    <fieldset class="field"><legend>Days</legend><div class="chips">${dayChips}</div></fieldset>
    <label class="toggle-row"><input type="checkbox" name="essential" ${h.essential ? 'checked' : ''}>
      <span><strong>Essential</strong><small>Keeps counting during charrette mode</small></span></label>
    <p class="form-error" hidden></p>
    <div class="sheet-actions">
      ${isNew ? '' : '<button type="button" class="danger-btn" data-act="delete">Delete</button>'}
      <button type="button" class="ghost-btn" data-act="cancel">Cancel</button>
      <button type="submit" class="primary-btn">Save</button>
    </div>
  </form>`;
}

// ================= LOCK + PASSCODE =================
export function lockView() {
  return `<section class="lock">
    <div class="lock-mark">${icon('lock')}</div>
    <h1>Archie Line</h1>
    <p class="note">Your data is encrypted. Enter your passcode to open it.</p>
    <form class="lock-form" data-form="unlock" autocomplete="on">
      <input type="text" name="username" value="Archie Line" autocomplete="username" hidden>
      <input type="password" name="passcode" autocomplete="current-password" placeholder="Passcode" aria-label="Passcode" required>
      <button type="submit" class="primary-btn">Unlock</button>
      <p class="form-error" hidden></p>
    </form>
  </section>`;
}

/** fields: any of 'current', 'next', 'confirm', 'passcode'. */
export function passcodeForm({ title, note = '', fields, submit }) {
  const labels = { current: 'Current passcode', next: 'New passcode', confirm: 'Repeat new passcode', passcode: 'Passcode' };
  const ac = { current: 'current-password', passcode: 'current-password', next: 'new-password', confirm: 'new-password' };
  return `<form method="dialog" class="sheet-form" data-form="passcode">
    <div class="sheet-grip"></div>
    <h2>${title}</h2>
    ${note ? `<p class="note">${note}</p>` : ''}
    <input type="text" name="username" value="Archie Line" autocomplete="username" hidden>
    ${fields.map((f) => `<label class="field"><span>${labels[f]}</span>
      <input type="password" name="${f}" autocomplete="${ac[f]}" minlength="${f === 'current' || f === 'passcode' ? 1 : 6}" required></label>`).join('')}
    <p class="form-error" hidden></p>
    <div class="sheet-actions">
      <button type="button" class="ghost-btn" data-act="cancel">Cancel</button>
      <button type="submit" class="primary-btn">${submit}</button>
    </div>
  </form>`;
}

// ================= SETTINGS =================
const AUTO_LOCK = [[0, 'Immediately'], [1, 'After 1 minute'], [5, 'After 5 minutes'], [15, 'After 15 minutes']];

function privacyCard({ encrypted, autoLock }) {
  if (!encrypted) {
    return `<section class="card tone-ink">
      <div class="card-title">${icon('lock')}<h2>Encryption</h2></div>
      <p class="note">Lock the app with a passcode and encrypt every habit, check-in and note on this phone (AES-256). Notifications keep working while it's locked.</p>
      <button class="primary-btn" data-act="enc-on">Encrypt my data</button>
    </section>`;
  }
  return `<section class="card tone-ink">
    <div class="card-title">${icon('lock')}<h2>Encrypted</h2><span class="ok-pill">AES-256 on</span></div>
    <label class="field on-dark"><span>Auto-lock</span><select data-act="autolock">
      ${AUTO_LOCK.map(([v, l]) => `<option value="${v}" ${v === autoLock ? 'selected' : ''}>${l}</option>`).join('')}
    </select></label>
    <div class="btn-row">
      <button class="primary-btn" data-act="lock-now">Lock now</button>
      <button class="ghost-btn" data-act="enc-change">Change passcode</button>
      <button class="ghost-btn" data-act="enc-off">Turn off</button>
    </div>
    <p class="note small">Forget the passcode and the data cannot be recovered — not by you, not by anyone. Export a backup now and then.</p>
  </section>`;
}

function remindersCard({ reminders, conn, support, serverUrl }) {
  const status = !support.supported
    ? `<p class="note">This browser can't receive notifications.</p>`
    : !support.standalone
      ? `<p class="note"><strong>Install first:</strong> iPhone only allows notifications for apps added to the Home Screen (iOS 16.4+).</p>`
      : '';
  const rows = reminders.map((r) => `<li class="rem" data-rid="${r.id}">
      <label class="toggle-row small-toggle"><input type="checkbox" data-act="rem-on" ${r.on ? 'checked' : ''}>
        <span><strong>${esc(r.label)}</strong><small>${scheduleLabel(r.days)}${r.essential ? ' · also in charrette' : ''}</small></span></label>
      <div class="rem-times">
        <input type="time" data-act="rem-time" data-field="time" value="${r.time}" aria-label="${esc(r.label)} time">
        ${r.everyMin ? `<span>to</span><input type="time" data-act="rem-time" data-field="until" value="${r.until}" aria-label="${esc(r.label)} until">
          <select data-act="rem-every" aria-label="Repeat every">${[60, 90, 120].map((m) => `<option value="${m}" ${m === r.everyMin ? 'selected' : ''}>every ${m} min</option>`).join('')}</select>` : ''}
      </div>
    </li>`).join('');
  return `<section class="card tone-glass">
    <div class="card-title">${icon('bell')}<h2>Reminders</h2>${conn ? '<span class="ok-pill lime">On</span>' : ''}</div>
    ${status}
    ${conn ? `<p class="note small">Connected to ${esc(new URL(conn.serverUrl).host)}. Changes sync automatically (alarms too).</p>
      <div class="btn-row"><button class="primary-btn" data-act="push-test">Send test</button><button class="ghost-btn" data-act="push-off">Turn off</button></div>`
    : `<label class="field"><span>Push server address</span>
        <input type="url" data-act="push-url" inputmode="url" placeholder="https://studio-days-push.you.workers.dev" value="${esc(serverUrl ?? '')}"></label>
      <button class="primary-btn" data-act="push-on" ${support.supported ? '' : 'disabled'}>Turn on reminders</button>`}
    <ul class="rem-list">${rows}</ul>
    <p class="note small">The push server only gets these times and texts — never your habits or check-ins.</p>
  </section>`;
}

const packFont = (t) => (t.font ? ` style="font-family:${esc(t.font)}"` : '');
const packSwatch = (t) => `<span class="pack-swatch" style="border-radius:${Math.min(t.radius ?? 12, 14)}px">${t.swatch.map((c) => `<i style="background:${c}"></i>`).join('')}</span>`;

function appearanceCard({ theme, backdrop, pack }) {
  const seg = (act, value, options) => `<div class="seg" role="radiogroup">${options.map(([v, l]) =>
    `<button role="radio" data-act="${act}" data-v="${v}" aria-checked="${v === value}">${l}</button>`).join('')}</div>`;
  const current = packById(pack);
  const studio = current.id === 'studio';
  const starry = studio && backdrop === 'galaxy';
  const modeNote = starry
    ? 'Starry Night is a night sky, so it always uses Dark. Light or Auto switches the background to Shapes.'
    : 'Auto follows your iPhone’s light or dark setting.';
  return `<section class="card tone-glass packs">
    <div class="card-title">${icon('spark')}<h2>Appearance</h2></div>
    <p class="label">Theme pack</p>
    <button class="pack-current" data-act="packs-open" aria-label="Theme pack: ${esc(current.name)}. Change">
      ${packSwatch(current)}
      <span class="pack-current-text"><b${packFont(current)}>${esc(current.name)}</b><small>${esc(current.by)} · ${THEMES.length} packs</small></span>
      <span class="pack-change">Change ›</span>
    </button>
    <p class="label" style="margin-top:14px">Mode</p>
    ${seg('theme', starry ? 'dark' : theme, [['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']])}
    ${studio ? `<p class="label" style="margin-top:12px">Background</p>
      ${seg('backdrop', backdrop, [['shapes', 'Shapes'], ['galaxy', 'Starry Night']])}` : ''}
    <p class="note small">${modeNote}</p>
  </section>`;
}

/** The full pack picker, in a sheet so Settings stays short. Picking applies live behind the sheet. */
export function packSheet(packId) {
  const current = packById(packId);
  const groups = PACK_GROUPS.map((g) => `<h3>${GROUP_LABELS[g] ?? g}</h3><div class="pack-grid" role="radiogroup" aria-label="${GROUP_LABELS[g] ?? g} theme packs">
    ${THEMES.filter((t) => t.group === g).map((t) => `<button type="button" class="pack" role="radio" data-act="pack" data-v="${t.id}" aria-checked="${t.id === current.id}">
      ${packSwatch(t)}
      <b${packFont(t)}>${esc(t.name)}</b><small>${esc(t.by)}</small>
      <span class="pack-check">${icon('check')}</span>
    </button>`).join('')}</div>`).join('');
  return `<div class="sheet-form packs pack-sheet">
    <div class="sheet-grip"></div>
    <div class="pack-sheet-head"><h2>Theme pack</h2><button type="button" class="primary-btn" data-act="cancel">Done</button></div>
    <p class="pack-note"><b>${esc(current.name)}</b> · ${esc(current.note)}</p>
    ${groups}
  </div>`;
}

function avatar(p, cls = '') {
  return p.photo
    ? `<img class="avatar ${cls}" src="${esc(p.photo)}" alt="">`
    : `<span class="avatar ${cls}" aria-hidden="true">${initials(p.name) ? esc(initials(p.name)) : icon('user')}</span>`;
}

function profileCard(tracker, p, today) {
  if (!hasProfile(p)) {
    return `<section class="card tone-glass profile-card empty">
      <div class="profile-top">${avatar(p)}<div class="profile-id"><h2>Your profile</h2><p>Add your name and practice. The greeting on Today uses it, and it stays on this phone.</p></div></div>
      <button class="primary-btn" data-act="profile-edit">Set up profile</button>
    </section>`;
  }
  const charrette = tracker.charretteDays();
  const since = tracker.habits().map((h) => h.createdOn).filter(Boolean).sort()[0] ?? today;
  const best = bestOf(tracker, today, charrette);
  return `<section class="card tone-ink profile-card">
    <div class="profile-top">${avatar(p)}
      <div class="profile-id"><h2>${esc(p.name || 'Your profile')}</h2>${subtitle(p) ? `<p>${esc(subtitle(p))}</p>` : ''}</div>
      <button class="chip-btn" data-act="profile-edit" aria-label="Edit profile">Edit</button></div>
    ${p.project ? `<p class="profile-project"><span>Working on</span>${esc(p.project)}</p>` : ''}
    <div class="profile-stats">
      <div><b>${count('pf-checkins', tracker.totalCheckIns())}</b><small>check-ins</small></div>
      <div><b>${count('pf-good', goodDayStreak(tracker.habits(), today, tracker.valueOf, charrette))}</b><small>good-day run</small></div>
      <div><b>${count('pf-best', best.n)}</b><small>best streak</small></div>
    </div>
    <p class="profile-since">Tracking since ${esc(formatDate(since))}</p>
  </section>`;
}

export function profileForm(p) {
  const role = ROLES.includes(p.role) || !p.role ? p.role : 'Other';
  return `<form method="dialog" class="sheet-form" data-form="profile">
    <div class="sheet-grip"></div>
    <h2>Profile</h2>
    <div class="profile-photo">
      <span class="photo-preview">${avatar(p, 'lg')}</span>
      <div class="btn-row">
        <label class="ghost-btn file-btn">${p.photo ? 'Change photo' : 'Add photo'}<input type="file" accept="image/*" data-act="profile-photo" hidden></label>
        <button type="button" class="ghost-btn" data-act="profile-photo-clear" ${p.photo ? '' : 'hidden'}>Remove</button>
      </div>
      <input type="hidden" name="photo" value="${esc(p.photo ?? '')}">
    </div>
    <label class="field"><span>Name</span><input name="fullname" maxlength="40" autocomplete="name" value="${esc(p.name ?? '')}" placeholder="Your name"></label>
    <div class="field-row">
      <label class="field"><span>Role</span><select name="role"><option value="">—</option>
        ${ROLES.map((r) => `<option ${r === role ? 'selected' : ''}>${r}</option>`).join('')}</select></label>
      <label class="field"><span>City</span><input name="city" maxlength="40" autocomplete="address-level2" value="${esc(p.city ?? '')}"></label>
    </div>
    <label class="field"><span>Studio, firm or school</span><input name="studio" maxlength="60" autocomplete="organization" value="${esc(p.studio ?? '')}"></label>
    <label class="field"><span>Working on</span><input name="project" maxlength="80" value="${esc(p.project ?? '')}" placeholder="e.g. library competition, thesis, DD set"></label>
    <p class="note small">Saved only on this phone. It is encrypted with your habits when encryption is on, and included in backups.</p>
    <p class="form-error" hidden></p>
    <div class="sheet-actions">
      <button type="button" class="ghost-btn" data-act="cancel">Cancel</button>
      <button type="submit" class="primary-btn">Save</button>
    </div>
  </form>`;
}

export function settingsView(tracker, { persisted, standalone, encrypted, autoLock, reminders, conn, support, serverUrl, appearance, profile = {}, today }) {
  const on = tracker.isCharretteActive();
  const since = tracker.charretteSince();
  return `
    ${pageHead('Settings', 'Archie Line')}
    ${profileCard(tracker, profile, today)}
    ${appearanceCard(appearance)}
    <section class="card ${on ? 'tone-lime' : 'tone-glass'}">
      <label class="toggle-row big"><input type="checkbox" data-act="charrette" ${on ? 'checked' : ''}>
        <span><strong>Charrette mode</strong>
        <small>${on ? `On since ${formatDate(since)}. ` : ''}For submission weeks: only essential habits and reminders count, other streaks are frozen.</small></span></label>
    </section>
    ${remindersCard({ reminders, conn, support, serverUrl })}
    ${privacyCard({ encrypted, autoLock })}
    <section class="card tone-glass">
      <h2>Backup</h2>
      <p class="note">${encrypted ? 'Backups are encrypted with a passcode you choose when exporting.' : 'Your data lives only on this phone.'} Export one now and then — iOS can clear website data from apps you haven't opened in a long time.</p>
      <div class="btn-row">
        <button class="primary-btn" data-act="export">Export backup</button>
        <label class="ghost-btn file-btn">Import backup<input type="file" accept="application/json,.json" data-act="import" hidden></label>
      </div>
      <p class="note small">Storage: ${persisted === true ? 'protected from automatic clearing' : persisted === false ? 'not yet protected (install to Home Screen helps)' : 'status unknown'}</p>
    </section>
    ${standalone ? '' : `<section class="card tone-mint">
      <h2>Install on iPhone</h2>
      <ol class="steps-list"><li>Open this page in <strong>Safari</strong>.</li><li>Tap the <strong>Share</strong> button.</li>
      <li>Choose <strong>Add to Home Screen</strong>, then <strong>Add</strong>.</li><li>Open Archie Line from its icon. It works offline.</li></ol>
    </section>`}
    <section class="card tone-glass">
      <h2>Start over</h2>
      <p class="note">Deletes every habit and record on this device and restores the starter set.</p>
      <button class="danger-btn" data-act="reset">Reset all data</button>
    </section>
    <p class="note small center">Version 0.4 · offline · no account</p>`;
}

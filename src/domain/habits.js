// Pure habit rules: no storage, no DOM. Everything here is unit-testable.
import { addDays, weekday, daysBetween } from './dates.js';

export const SLOTS = [
  { id: 'morning', label: 'Morning', hint: 'Before the studio' },
  { id: 'studio', label: 'Studio', hint: 'Desk hours' },
  { id: 'field', label: 'Field', hint: 'Site & city' },
  { id: 'evening', label: 'Evening', hint: 'Wind down' },
];

export const KINDS = {
  check: { label: 'Done / not done', unit: '' },
  minutes: { label: 'Minutes', unit: 'min' },
  count: { label: 'Count', unit: '×' },
};

const WEEKDAYS = [1, 2, 3, 4, 5];
const MON_SAT = [1, 2, 3, 4, 5, 6];
const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];

/** The starter set, tuned to an architect's day. `essential` habits keep running in charrette mode. */
export function starterHabits(createdOn) {
  const list = [
    ['Morning sketch', 'morning', 'minutes', 15, EVERY_DAY, false],
    ["Set today's one design priority", 'morning', 'check', 1, MON_SAT, true],
    ['Precedent reading', 'morning', 'minutes', 20, WEEKDAYS, false],
    ['Deep design block', 'studio', 'minutes', 90, WEEKDAYS, true],
    ['20-20-20 eye breaks', 'studio', 'count', 4, MON_SAT, true],
    ['Stretch / posture break', 'studio', 'count', 3, MON_SAT, true],
    ['Water (glasses)', 'studio', 'count', 8, EVERY_DAY, true],
    ['Software practice (Rhino / GH / QGIS)', 'studio', 'minutes', 30, WEEKDAYS, false],
    ['Photo of one building detail', 'field', 'check', 1, EVERY_DAY, false],
    ['Walk & observe the city', 'field', 'minutes', 20, EVERY_DAY, false],
    ["Log hours + tomorrow's first task", 'evening', 'check', 1, WEEKDAYS, true],
    ['Screens off by 23:00', 'evening', 'check', 1, EVERY_DAY, true],
  ];
  return list.map(([name, slot, kind, target, days, essential], i) =>
    createHabit({ name, slot, kind, target, days, essential, order: i, createdOn }));
}

export function createHabit({ name, slot = 'studio', kind = 'check', target = 1, days = EVERY_DAY,
  essential = false, order = 0, createdOn }) {
  return {
    id: `h_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    name: name.trim(),
    slot,
    kind,
    target: kind === 'check' ? 1 : Math.max(1, Number(target) || 1),
    days: [...days].sort(),
    essential: Boolean(essential),
    archived: false,
    order,
    createdOn,
  };
}

export const entryKey = (habitId, day) => `${habitId}|${day}`;

export function isScheduled(habit, day) {
  return day >= habit.createdOn && habit.days.includes(weekday(day));
}

export function isDone(habit, value) {
  return (value || 0) >= habit.target;
}

/** Non-essential habits are paused (neither counted nor broken) on charrette days. */
export function isPaused(habit, day, charretteDays) {
  return !habit.essential && charretteDays.has(day);
}

/**
 * Current run of consecutive completed scheduled days.
 * Today counts if already done; if not, the run is measured up to yesterday,
 * so an unfinished today never shows as a broken streak.
 */
export function currentStreak(habit, today, valueOf, charretteDays) {
  let day = isDone(habit, valueOf(habit.id, today)) ? today : addDays(today, -1);
  let run = 0;
  while (day >= habit.createdOn) {
    if (isScheduled(habit, day) && !isPaused(habit, day, charretteDays)) {
      if (!isDone(habit, valueOf(habit.id, day))) break;
      run += 1;
    }
    day = addDays(day, -1);
  }
  return run;
}

/** Expand charrette ranges ({from, to|null}) into a Set of day keys, open ranges ending today. */
export function charretteDaySet(ranges, today) {
  const set = new Set();
  for (const r of ranges) {
    for (const k of daysBetween(r.from, r.to ?? today)) set.add(k);
  }
  return set;
}

/** State of one habit on one day: future | off | paused | done | partial | pending | missed. */
export function cellState(habit, day, today, valueOf, charretteDays) {
  if (day > today) return 'future';
  if (!isScheduled(habit, day)) return 'off';
  if (isPaused(habit, day, charretteDays)) return 'paused';
  const value = valueOf(habit.id, day);
  if (isDone(habit, value)) return 'done';
  if (value > 0) return 'partial';
  return day === today ? 'pending' : 'missed';
}

/** Longest run ever for a habit. An unfinished today does not end the run. */
export function bestStreak(habit, today, valueOf, charretteDays) {
  let best = 0;
  let run = 0;
  for (let day = habit.createdOn; day <= today; day = addDays(day, 1)) {
    if (!isScheduled(habit, day) || isPaused(habit, day, charretteDays)) continue;
    if (isDone(habit, valueOf(habit.id, day))) best = Math.max(best, ++run);
    else if (day < today) run = 0;
  }
  return best;
}

/** How much of a day's active (scheduled, not paused) habits were done. rate is null if nothing was due. */
export function dayProgress(habits, day, valueOf, charretteDays) {
  const active = habits.filter((h) => isScheduled(h, day) && !isPaused(h, day, charretteDays));
  const done = active.filter((h) => isDone(h, valueOf(h.id, day))).length;
  return { done, total: active.length, rate: active.length ? done / active.length : null };
}

/** A "good day" means at least this share of the day's habits got done. */
export const GOOD_DAY = 0.75;

/** Consecutive good days up to today (today counts once it qualifies). Days with nothing due are skipped. */
export function goodDayStreak(habits, today, valueOf, charretteDays) {
  if (!habits.length) return 0;
  const earliest = habits.reduce((m, h) => (h.createdOn < m ? h.createdOn : m), today);
  const good = (day) => {
    const p = dayProgress(habits, day, valueOf, charretteDays);
    return p.rate === null ? null : p.rate >= GOOD_DAY;
  };
  let day = good(today) ? today : addDays(today, -1);
  let run = 0;
  for (; day >= earliest; day = addDays(day, -1)) {
    const g = good(day);
    if (g === null) continue;
    if (!g) break;
    run += 1;
  }
  return run;
}

/** Per-habit and aggregate numbers for a Monday-start week, counted only up to `today`. */
export function weekSummary(habits, weekStart, today, valueOf, charretteDays) {
  const days = daysBetween(weekStart, addDays(weekStart, 6));
  const rows = habits.map((h) => {
    const cells = days.map((day) => cellState(h, day, today, valueOf, charretteDays));
    const total = days.reduce((a, day) => a + (valueOf(h.id, day) || 0), 0);
    const scheduled = cells.filter((c) => ['done', 'partial', 'pending', 'missed'].includes(c)).length;
    const done = cells.filter((c) => c === 'done').length;
    return { habit: h, cells, scheduled, done, total };
  });
  const scheduled = rows.reduce((a, r) => a + r.scheduled, 0);
  const done = rows.reduce((a, r) => a + r.done, 0);
  const minutesBySlot = Object.fromEntries(SLOTS.map((s) => [s.id, 0]));
  for (const r of rows) if (r.habit.kind === 'minutes') minutesBySlot[r.habit.slot] += r.total;
  return { days, rows, scheduled, done, rate: scheduled ? done / scheduled : 0, minutesBySlot };
}

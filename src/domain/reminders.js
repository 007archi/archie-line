// Reminder rules (pure). The push server only ever receives the flat schedule built here:
// times, weekdays and short generic text — never habit records or values.

const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];
const WEEKDAYS = [1, 2, 3, 4, 5];
const MON_SAT = [1, 2, 3, 4, 5, 6];

export const DEFAULT_REMINDERS = [
  { id: 'morning', label: 'Morning sketch', title: 'Morning sketch', body: '15 minutes with a pen before the studio.', time: '07:30', days: EVERY_DAY, essential: false, on: true },
  { id: 'priority', label: 'Design priority', title: 'One design priority', body: "What's the single thing to resolve today?", time: '09:30', days: MON_SAT, essential: true, on: true },
  { id: 'breaks', label: 'Studio breaks', title: 'Look up from the screen', body: '20-20-20 for your eyes, stretch, sip water.', time: '11:00', until: '17:00', everyMin: 90, days: MON_SAT, essential: true, on: true },
  { id: 'field', label: 'Field & city', title: 'Field time', body: 'Walk, observe, photograph one building detail.', time: '17:45', days: EVERY_DAY, essential: false, on: true },
  { id: 'log', label: 'Log the day', title: 'Log the day', body: "Log your hours and tomorrow's first task.", time: '21:30', days: WEEKDAYS, essential: true, on: true },
  { id: 'screens', label: 'Screens off', title: 'Wind down', body: 'Screens off by 23:00.', time: '22:45', days: EVERY_DAY, essential: true, on: true },
];

export const INTERVALS = [60, 90, 120];

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
export const isTime = (t) => TIME_RE.test(t);
const toMin = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
const toTime = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/** All clock times one reminder fires at (a repeating reminder fires from `time` to `until`). */
export function expandTimes(r) {
  if (!isTime(r.time)) return [];
  if (!r.everyMin || !r.until || !isTime(r.until)) return [r.time];
  const out = [];
  for (let m = toMin(r.time); m <= toMin(r.until) && out.length < 24; m += r.everyMin) out.push(toTime(m));
  return out;
}

/** Merge saved settings over the defaults so new defaults appear after an update. */
export function withDefaults(saved = []) {
  const byId = new Map(saved.map((r) => [r.id, r]));
  return DEFAULT_REMINDERS.map((d) => ({ ...d, ...(byId.get(d.id) ?? {}) }));
}

/** Flat list sent to the push server. In charrette mode only essential reminders go out. */
export function buildSchedule(reminders, charretteActive) {
  return reminders
    .filter((r) => r.on && (!charretteActive || r.essential))
    .flatMap((r) => expandTimes(r).map((time) => ({
      id: `${r.id}@${time}`, time, days: [...r.days], title: r.title, body: r.body,
    })));
}

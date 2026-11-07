// Alarm rules (pure). Each day an alarm is shifted by a random number of minutes within
// [shiftMin, shiftMax], earlier or later. The shift is derived from (alarm id + date), so the
// phone and the push server always agree on today's ring time without talking to each other.
// KEEP IN SYNC with push-server/src/jitter.js (a test checks both give identical results).

export const SHIFT_PRESETS = [
  { min: 10, max: 15, label: '10–15 min early or late' },
  { min: 5, max: 15, label: '5–15 min early or late' },
  { min: 0, max: 10, label: 'Up to 10 min either way' },
  { min: 0, max: 15, label: 'Up to 15 min either way' },
];

export const ACTIVITIES = {
  random: 'Surprise me',
  breathe: 'Breathe — 3 slow breaths',
  tap: 'Tap 8 moving dots',
  math: 'Solve 3 quick sums',
  type: 'Type a short phrase',
};

const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];

export function newAlarm(fields = {}) {
  return {
    id: `a_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
    label: 'Wake up', time: '07:00', shiftMin: 10, shiftMax: 15,
    days: [1, 2, 3, 4, 5, 6], activity: 'random', on: true, ...fields,
  };
}

export const DEFAULT_ALARMS = [newAlarm({ id: 'a_wake', label: 'Wake up', time: '07:00' })];

/** FNV-1a 32-bit hash. */
export function hash32(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Signed minute shift for one alarm on one local date ("YYYY-MM-DD"). */
export function dailyShift(alarmId, date, shiftMin, shiftMax) {
  const h = hash32(`${alarmId}|${date}`);
  const lo = Math.max(0, Math.min(shiftMin, shiftMax));
  const hi = Math.max(lo, shiftMax);
  const mag = lo + ((h >>> 1) % (hi - lo + 1));
  return mag === 0 ? 0 : (h & 1 ? mag : -mag);
}

const toMin = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
export const minToTime = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/** Minute of the day the alarm rings on `date`, clamped to the same day. */
export function ringMinute(alarm, date) {
  const m = toMin(alarm.time) + dailyShift(alarm.id, date, alarm.shiftMin, alarm.shiftMax);
  return Math.min(1439, Math.max(0, m));
}

export const isAlarmDay = (alarm, weekdayIndex) => (alarm.days ?? EVERY_DAY).includes(weekdayIndex);

/** Human description of the window, without revealing today's exact time. */
export function windowLabel(alarm) {
  const t = toMin(alarm.time);
  const { shiftMin: lo, shiftMax: hi } = alarm;
  if (lo === 0) return `Rings between ${minToTime(Math.max(0, t - hi))} and ${minToTime(Math.min(1439, t + hi))}`;
  return `Rings ${minToTime(Math.max(0, t - hi))}–${minToTime(Math.max(0, t - lo))} or ${minToTime(Math.min(1439, t + lo))}–${minToTime(Math.min(1439, t + hi))}`;
}

/**
 * Alarms that should be ringing now: rang today at or before `nowMin`, within the last
 * `graceMin` minutes, and not yet done.
 */
export function ringingNow(alarms, date, weekdayIndex, nowMin, isDone, graceMin = 30) {
  return alarms.filter((a) => {
    if (!a.on || !isAlarmDay(a, weekdayIndex) || isDone(a.id, date)) return false;
    const r = ringMinute(a, date);
    return nowMin >= r && nowMin - r <= graceMin;
  });
}

/** Push-server items for alarms (the server recomputes the daily shift itself). */
export function alarmSchedule(alarms) {
  return alarms.filter((a) => a.on).map((a) => ({
    kind: 'alarm', id: a.id, time: a.time, shiftMin: a.shiftMin, shiftMax: a.shiftMax,
    days: [...a.days], title: `⏰ ${a.label}`.slice(0, 60), body: 'Open Archie Line and finish a short activity to stop the alarm.',
  }));
}

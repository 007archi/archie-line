// Copy of the shift rules in ../../src/domain/alarms.js (the app) — KEEP IN SYNC (tests compare them).
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
/** Minute of the day the alarm rings on `date`, clamped to the same day. */
export function ringMinute(alarm, date) {
  const m = toMin(alarm.time) + dailyShift(alarm.id, date, alarm.shiftMin, alarm.shiftMax);
  return Math.min(1439, Math.max(0, m));
}

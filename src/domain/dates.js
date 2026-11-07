// Calendar helpers. Days are local-time keys "YYYY-MM-DD" so they compare as strings.

export function toKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function fromKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key, n) {
  const date = fromKey(key);
  date.setDate(date.getDate() + n);
  return toKey(date);
}

/** 0 = Sunday … 6 = Saturday */
export function weekday(key) {
  return fromKey(key).getDay();
}

export function todayKey() {
  return toKey(new Date());
}

/** Monday of the week containing `key`. */
export function startOfWeek(key) {
  return addDays(key, -((weekday(key) + 6) % 7));
}

export function daysBetween(fromKeyInclusive, toKeyInclusive) {
  const out = [];
  for (let k = fromKeyInclusive; k <= toKeyInclusive; k = addDays(k, 1)) out.push(k);
  return out;
}

const WEEKDAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEKDAY_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const formatWeekday = (key) => WEEKDAY_LONG[weekday(key)];
export const formatWeekdayInitial = (dayIndex) => WEEKDAY_SHORT[dayIndex];
export function formatDate(key) {
  const d = fromKey(key);
  return `${d.getDate()} ${MONTH_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}
export function formatShort(key) {
  const d = fromKey(key);
  return `${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`;
}

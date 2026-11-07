import test from 'node:test';
import assert from 'node:assert/strict';
import { dailyShift, ringMinute, ringingNow, windowLabel, alarmSchedule, newAlarm } from '../src/domain/alarms.js';
import { LIBRARY } from '../src/domain/library.js';
import { createHabit } from '../src/domain/habits.js';

const dates = Array.from({ length: 90 }, (_, i) => {
  const d = new Date(2026, 10, 1 + i);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
});

test('10–15 shift: always 10 to 15 minutes off, earlier and later, changing daily', () => {
  const shifts = dates.map((d) => dailyShift('a_wake', d, 10, 15));
  for (const s of shifts) assert.ok(Math.abs(s) >= 10 && Math.abs(s) <= 15, `shift ${s}`);
  assert.ok(shifts.filter((s) => s < 0).length > 20 && shifts.filter((s) => s > 0).length > 20, 'roughly balanced');
  assert.ok(new Set(shifts).size >= 10, 'uses the whole range');
  assert.equal(dailyShift('a_wake', '2026-11-07', 10, 15), dailyShift('a_wake', '2026-11-07', 10, 15), 'stable within a day');
});

test('"up to 15" window can land on time or anywhere inside ±15', () => {
  for (const d of dates) assert.ok(Math.abs(dailyShift('x', d, 0, 15)) <= 15);
});

test('ring time stays inside the same day', () => {
  const a = newAlarm({ id: 'late', time: '23:55', shiftMin: 10, shiftMax: 15 });
  const b = newAlarm({ id: 'early', time: '00:05', shiftMin: 10, shiftMax: 15 });
  for (const d of dates) {
    assert.ok(ringMinute(a, d) <= 1439);
    assert.ok(ringMinute(b, d) >= 0);
  }
});

test('ringing window: rings from ring time for 30 min until done, only on chosen days', () => {
  const a = newAlarm({ id: 'a1', time: '07:00', days: [6] });
  const d = '2026-11-07'; // Saturday
  const r = ringMinute(a, d);
  const notDone = () => false;
  assert.equal(ringingNow([a], d, 6, r - 1, notDone).length, 0);
  assert.equal(ringingNow([a], d, 6, r, notDone).length, 1);
  assert.equal(ringingNow([a], d, 6, r + 30, notDone).length, 1);
  assert.equal(ringingNow([a], d, 6, r + 31, notDone).length, 0);
  assert.equal(ringingNow([a], d, 6, r + 5, () => true).length, 0, 'done → silent');
  assert.equal(ringingNow([a], d, 5, r + 5, notDone).length, 0, 'not an alarm day');
  assert.equal(ringingNow([{ ...a, on: false }], d, 6, r, notDone).length, 0, 'switched off');
});

test('window label describes the range without the exact time', () => {
  assert.equal(windowLabel(newAlarm({ time: '07:00', shiftMin: 10, shiftMax: 15 })), 'Rings 06:45–06:50 or 07:10–07:15');
  assert.equal(windowLabel(newAlarm({ time: '07:00', shiftMin: 0, shiftMax: 10 })), 'Rings between 06:50 and 07:10');
});

test('alarm schedule for the server excludes switched-off alarms', () => {
  const s = alarmSchedule([newAlarm({ id: 'on' }), newAlarm({ id: 'off', on: false })]);
  assert.deepEqual(s.map((x) => x.id), ['on']);
  assert.equal(s[0].kind, 'alarm');
});

test('every library habit is a valid habit', () => {
  const all = LIBRARY.flatMap((g) => g.items);
  assert.ok(all.length >= 20);
  for (const it of all) {
    const h = createHabit({ ...it, createdOn: '2026-11-07' });
    assert.ok(h.name && h.days.length && h.target >= 1 && ['morning', 'studio', 'field', 'evening'].includes(h.slot));
  }
  assert.equal(new Set(all.map((x) => x.name)).size, all.length, 'no duplicate names');
});

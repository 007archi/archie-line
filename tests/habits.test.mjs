// Run with: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHabit, currentStreak, charretteDaySet, weekSummary, isScheduled, starterHabits } from '../src/domain/habits.js';
import { addDays, startOfWeek, weekday } from '../src/domain/dates.js';

const TODAY = '2026-11-07'; // a Saturday
const values = (map) => (id, day) => map[`${id}|${day}`] ?? 0;

test('dates: Monday week start and weekday', () => {
  assert.equal(weekday(TODAY), 6);
  assert.equal(startOfWeek(TODAY), '2026-11-02');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
});

test('streak counts back over completed days; unfinished today does not break it', () => {
  const h = createHabit({ name: 'Sketch', createdOn: '2026-11-01' });
  const v = values({ [`${h.id}|2026-11-06`]: 1, [`${h.id}|2026-11-05`]: 1, [`${h.id}|2026-11-04`]: 1 });
  assert.equal(currentStreak(h, TODAY, v, new Set()), 3);
  const v2 = values({ [`${h.id}|2026-11-07`]: 1, [`${h.id}|2026-11-06`]: 1 });
  assert.equal(currentStreak(h, TODAY, v2, new Set()), 2);
});

test('streak skips unscheduled days (weekday habit over a weekend)', () => {
  const h = createHabit({ name: 'Deep block', kind: 'minutes', target: 90, days: [1, 2, 3, 4, 5], createdOn: '2026-10-01' });
  const map = {};
  for (const d of ['2026-11-06', '2026-11-05', '2026-11-03', '2026-11-02']) map[`${h.id}|${d}`] = 90;
  map[`${h.id}|2026-11-04`] = 45; // partial Wednesday breaks it
  // Saturday: not scheduled today, Friday & Thursday done → 2
  assert.equal(currentStreak(h, TODAY, values(map), new Set()), 2);
});

test('charrette freezes non-essential streaks but not essential ones', () => {
  const sketch = createHabit({ name: 'Sketch', createdOn: '2026-11-01' });
  const water = createHabit({ name: 'Water', kind: 'count', target: 8, essential: true, createdOn: '2026-11-01' });
  const charrette = charretteDaySet([{ from: '2026-11-05', to: null }], TODAY);
  assert.deepEqual([...charrette], ['2026-11-05', '2026-11-06', '2026-11-07']);
  const v = values({ [`${sketch.id}|2026-11-04`]: 1, [`${sketch.id}|2026-11-03`]: 1, [`${water.id}|2026-11-04`]: 8 });
  assert.equal(currentStreak(sketch, TODAY, v, charrette), 2, 'paused days neither add nor break');
  assert.equal(currentStreak(water, TODAY, v, charrette), 0, 'essential habit missed on charrette days');
});

test('habit not scheduled before it was created', () => {
  const h = createHabit({ name: 'New', createdOn: TODAY });
  assert.equal(isScheduled(h, '2026-11-06'), false);
  assert.equal(currentStreak(h, TODAY, () => 0, new Set()), 0);
});

test('week summary: rates and studio minutes', () => {
  const deep = createHabit({ name: 'Deep', slot: 'studio', kind: 'minutes', target: 60, days: [1, 2, 3, 4, 5], createdOn: '2026-10-01' });
  const map = { [`${deep.id}|2026-11-02`]: 60, [`${deep.id}|2026-11-03`]: 30 };
  const s = weekSummary([deep], '2026-11-02', TODAY, values(map), new Set());
  assert.equal(s.scheduled, 5);
  assert.equal(s.done, 1);
  assert.equal(s.minutesBySlot.studio, 90);
  assert.deepEqual(s.rows[0].cells, ['done', 'partial', 'missed', 'missed', 'missed', 'off', 'future']);
});

test('starter set is valid', () => {
  const list = starterHabits(TODAY);
  assert.equal(list.length, 12);
  assert.equal(new Set(list.map((h) => h.id)).size, 12);
  for (const h of list) assert.ok(h.days.length && h.target >= 1);
});

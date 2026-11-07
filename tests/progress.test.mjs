import test from 'node:test';
import assert from 'node:assert/strict';
import { createHabit, bestStreak, dayProgress, goodDayStreak, cellState } from '../src/domain/habits.js';

const TODAY = '2026-11-07';
const values = (map) => (id, day) => map[`${id}|${day}`] ?? 0;

test('best streak finds the longest past run', () => {
  const h = createHabit({ name: 'Sketch', createdOn: '2026-11-01' });
  const map = {};
  for (const d of ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-05', '2026-11-06']) map[`${h.id}|${d}`] = 1;
  assert.equal(bestStreak(h, TODAY, values(map), new Set()), 3);
});

test('day progress ignores habits not due and paused ones', () => {
  const a = createHabit({ name: 'A', createdOn: '2026-11-01' });
  const b = createHabit({ name: 'B', createdOn: '2026-11-01', essential: true });
  const c = createHabit({ name: 'C', createdOn: '2026-11-01', days: [1] }); // Mondays only
  const p = dayProgress([a, b, c], TODAY, values({ [`${b.id}|${TODAY}`]: 1 }), new Set([TODAY]));
  assert.deepEqual(p, { done: 1, total: 1, rate: 1 });
});

test('good-day streak: 75% of habits counts, unfinished today does not break it', () => {
  const hs = [1, 2, 3, 4].map((i) => createHabit({ name: `H${i}`, createdOn: '2026-11-04' }));
  const map = {};
  for (const d of ['2026-11-05', '2026-11-06']) for (const h of hs.slice(0, 3)) map[`${h.id}|${d}`] = 1; // 3 of 4
  for (const h of hs.slice(0, 2)) map[`${h.id}|2026-11-04`] = 1; // 2 of 4 → not good
  assert.equal(goodDayStreak(hs, TODAY, values(map), new Set()), 2);
});

test('cell state marks an untouched today as pending', () => {
  const h = createHabit({ name: 'A', createdOn: '2026-11-01' });
  assert.equal(cellState(h, TODAY, TODAY, () => 0, new Set()), 'pending');
  assert.equal(cellState(h, '2026-11-06', TODAY, () => 0, new Set()), 'missed');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { expandTimes, buildSchedule, withDefaults, DEFAULT_REMINDERS } from '../src/domain/reminders.js';

test('repeating reminder expands across the studio day', () => {
  assert.deepEqual(expandTimes({ time: '11:00', until: '17:00', everyMin: 90 }), ['11:00', '12:30', '14:00', '15:30', '17:00']);
  assert.deepEqual(expandTimes({ time: '07:30' }), ['07:30']);
  assert.deepEqual(expandTimes({ time: '7:30' }), []);
});

test('charrette sends only essential reminders; off ones never go out', () => {
  const list = withDefaults([{ id: 'screens', on: false }]);
  const normal = buildSchedule(list, false);
  const charrette = buildSchedule(list, true);
  assert.ok(normal.some((r) => r.id.startsWith('morning@')));
  assert.ok(!charrette.some((r) => r.id.startsWith('morning@') || r.id.startsWith('field@')));
  assert.ok(!normal.some((r) => r.id.startsWith('screens@')));
  assert.ok(charrette.some((r) => r.id.startsWith('breaks@')));
});

test('schedule carries only times, days and generic text', () => {
  for (const item of buildSchedule(withDefaults(), false)) {
    assert.deepEqual(Object.keys(item).sort(), ['body', 'days', 'id', 'time', 'title']);
  }
  assert.equal(withDefaults().length, DEFAULT_REMINDERS.length);
});

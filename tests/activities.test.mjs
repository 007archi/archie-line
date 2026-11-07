import test from 'node:test';
import assert from 'node:assert/strict';
import { ACTIVITY_IDS, resolveActivity, scaleQuestion } from '../src/ui/activities.js';
import { ACTIVITIES } from '../src/domain/alarms.js';

test('every wake-up activity is offered in the alarm editor, and Surprise me picks a real one', () => {
  assert.ok(ACTIVITY_IDS.length >= 9);
  for (const id of ACTIVITY_IDS) assert.ok(ACTIVITIES[id], `label for ${id}`);
  for (let i = 0; i < 50; i++) assert.ok(ACTIVITY_IDS.includes(resolveActivity('random')));
  assert.equal(resolveActivity('scale'), 'scale');
});

test('scale check: the right answer is offered once, alongside distinct wrong ones', () => {
  for (let i = 0; i < 300; i++) {
    const q = scaleQuestion();
    const [, scale, cm] = q.q.match(/1:(\d+), ([\d.]+) cm/);
    const metres = (Number(cm) * Number(scale)) / 100;
    assert.equal(q.answer, `${Number(metres.toFixed(2))} m`, q.q);
    assert.equal(q.options.filter((o) => o === q.answer).length, 1, q.q);
    assert.equal(new Set(q.options).size, q.options.length, q.q);
    assert.ok(q.options.length >= 3, q.q);
  }
});

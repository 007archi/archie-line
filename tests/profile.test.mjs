import test from 'node:test';
import assert from 'node:assert/strict';
import { normaliseProfile, initials, greeting, subtitle, hasProfile } from '../src/domain/profile.js';

test('profile input is trimmed, capped and only accepts a small image data URL', () => {
  const p = normaliseProfile({ name: '  Ada   Lovelace ', role: 'Architect', studio: 'x'.repeat(200), photo: 'javascript:alert(1)' });
  assert.equal(p.name, 'Ada Lovelace');
  assert.equal(p.studio.length, 60);
  assert.equal(p.photo, '');
  assert.equal(normaliseProfile({ photo: 'data:image/jpeg;base64,AAAA' }).photo, 'data:image/jpeg;base64,AAAA');
  assert.equal(hasProfile(normaliseProfile({})), false);
  assert.equal(hasProfile(p), true);
});

test('initials, greeting and subtitle', () => {
  assert.equal(initials('ada king lovelace'), 'AL');
  assert.equal(initials('Ada'), 'A');
  assert.equal(initials('  '), '');
  assert.equal(greeting('Ada Lovelace', 8), 'Good morning, Ada');
  assert.equal(greeting('', 14), 'Good afternoon');
  assert.equal(greeting('Ada', 20), 'Good evening, Ada');
  assert.equal(greeting('Ada', 2), 'Working late, Ada');
  assert.equal(subtitle({ role: 'Architect', studio: '', city: 'Pune' }), 'Architect · Pune');
});

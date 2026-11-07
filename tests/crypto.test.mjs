import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveKey, seal, unseal, newKdf, WrongPasscodeError, toB64, fromB64 } from '../src/data/crypto.js';

test('seal → unseal round trip, fresh IV each time', async () => {
  const kdf = newKdf();
  const key = await deriveKey('drafting-table', kdf);
  const data = { habits: [{ id: 'h1', name: 'Sketch ✏️' }], entries: Array.from({ length: 5000 }, (_, i) => ({ key: `h1|${i}`, value: i })) };
  const a = await seal(key, kdf, data);
  const b = await seal(key, kdf, data);
  assert.notEqual(a.iv, b.iv);
  assert.ok(!a.ct.includes('Sketch'));
  assert.deepEqual(await unseal(key, a), data);
});

test('wrong passcode and tampering are both rejected', async () => {
  const kdf = newKdf();
  const sealed = await seal(await deriveKey('right-pass', kdf), kdf, { x: 1 });
  await assert.rejects(unseal(await deriveKey('wrong-pass', kdf), sealed), WrongPasscodeError);
  const ct = fromB64(sealed.ct);
  ct[3] ^= 1;
  await assert.rejects(unseal(await deriveKey('right-pass', kdf), { ...sealed, ct: toB64(ct) }), WrongPasscodeError);
});

test('kdf uses PBKDF2-SHA256 with 600k iterations and a 16-byte salt', () => {
  const k = newKdf();
  assert.equal(k.iterations, 600000);
  assert.equal(fromB64(k.salt).length, 16);
});

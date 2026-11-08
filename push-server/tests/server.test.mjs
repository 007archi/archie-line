// End-to-end test of the Worker with an in-memory KV and a fake push service.
// The fake service DECRYPTS each message with the phone's private key, proving the RFC 8291 encryption is correct.
import test from 'node:test';
import assert from 'node:assert/strict';
import worker, { runDue, localParts, ringToday } from '../src/index.js';
import { ringMinute } from '../src/jitter.js';
import { b64u, hmac, concat } from '../src/webpush.js';

const te = new TextEncoder();
const td = new TextDecoder();

async function makeEnv() {
  const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const store = new Map();
  return {
    VAPID_PUBLIC_KEY: b64u.enc(await crypto.subtle.exportKey('raw', kp.publicKey)),
    VAPID_PRIVATE_JWK: JSON.stringify(await crypto.subtle.exportKey('jwk', kp.privateKey)),
    VAPID_SUBJECT: 'mailto:test@example.com',
    ALLOWED_ORIGIN: 'https://app.example',
    SUBS: {
      async get(k, type) { const v = store.get(k); return v == null ? null : type === 'json' ? JSON.parse(v) : v; },
      async put(k, v) { store.set(k, v); },
    },
  };
}

async function makePhone() {
  const ua = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const uaPublic = new Uint8Array(await crypto.subtle.exportKey('raw', ua.publicKey));
  const auth = crypto.getRandomValues(new Uint8Array(16));
  return {
    ua, uaPublic, auth,
    subscription: { endpoint: 'https://web.push.apple.com/QFAKE-TOKEN', keys: { p256dh: b64u.enc(uaPublic), auth: b64u.enc(auth) } },
  };
}

async function decryptOnPhone(phone, body) {
  const salt = body.slice(0, 16);
  const idlen = body[20];
  const asPublic = body.slice(21, 21 + idlen);
  const ct = body.slice(21 + idlen);
  const asKey = await crypto.subtle.importKey('raw', asPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: asKey }, phone.ua.privateKey, 256));
  const prkKey = await hmac(phone.auth, shared);
  const ikm = await hmac(prkKey, concat(te.encode('WebPush: info\0'), phone.uaPublic, asPublic, new Uint8Array([1])));
  const prk = await hmac(salt, ikm);
  const cek = (await hmac(prk, concat(te.encode('Content-Encoding: aes128gcm\0'), new Uint8Array([1])))).slice(0, 16);
  const nonce = (await hmac(prk, concat(te.encode('Content-Encoding: nonce\0'), new Uint8Array([1])))).slice(0, 12);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']);
  const pt = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, key, ct));
  assert.equal(pt[pt.length - 1], 2, 'final-record delimiter');
  return JSON.parse(td.decode(pt.slice(0, -1)));
}

async function verifyVapid(env, authHeader, endpoint) {
  const [, jwt, k] = authHeader.match(/^vapid t=([^,]+), k=(.+)$/);
  assert.equal(k, env.VAPID_PUBLIC_KEY);
  const [h, c, s] = jwt.split('.');
  const pub = await crypto.subtle.importKey('raw', b64u.dec(k), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  assert.ok(await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pub, b64u.dec(s), te.encode(`${h}.${c}`)), 'VAPID signature valid');
  const claims = JSON.parse(td.decode(b64u.dec(c)));
  assert.equal(claims.aud, new URL(endpoint).origin);
}

const req = (method, path, body, token) => new Request(`https://push.example${path}`, {
  method,
  headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
  body: body ? JSON.stringify(body) : undefined,
});

test('local time parts follow the phone time zone', () => {
  // 2026-11-07T04:00Z is 09:30 on a Saturday in India
  assert.deepEqual(localParts(new Date('2026-11-07T04:00:00Z'), 'Asia/Kolkata'), { hhmm: '09:30', minute: 570, dow: 6, date: '2026-11-07' });
  assert.equal(localParts(new Date('2026-11-07T20:00:00Z'), 'Asia/Kolkata').date, '2026-11-08', 'date rolls over in local time');
});

test('server and app compute the same daily alarm shift', async () => {
  const app = await import('../../src/domain/alarms.js');
  const srv = await import('../src/jitter.js');
  const alarm = { id: 'a_wake', time: '07:00', shiftMin: 10, shiftMax: 15 };
  const seen = new Set();
  for (let d = 1; d <= 60; d++) {
    const date = `2026-${String(Math.ceil(d / 30) + 10).padStart(2, '0')}-${String(((d - 1) % 30) + 1).padStart(2, '0')}`;
    const m = srv.ringMinute(alarm, date);
    assert.equal(m, app.ringMinute(alarm, date));
    const shift = Math.abs(m - 420);
    assert.ok(shift >= 10 && shift <= 15, `shift ${shift} within 10–15`);
    seen.add(m - 420);
  }
  assert.ok([...seen].some((s) => s < 0) && [...seen].some((s) => s > 0), 'both earlier and later occur');
  assert.ok(seen.size >= 8, 'varies from day to day');
});

test('alarm re-alerts every 2 minutes until the phone reports it done', async () => {
  const env = await makeEnv();
  const phone = await makePhone();
  const { ringMinute } = await import('../src/jitter.js');
  const alarm = { kind: 'alarm', id: 'a_wake', time: '07:00', shiftMin: 10, shiftMax: 15, days: [0, 1, 2, 3, 4, 5, 6], title: '⏰ Wake up', body: 'Finish a short activity.' };
  const { id, token } = await (await worker.fetch(req('POST', '/subscribe', { subscription: phone.subscription, tz: 'UTC', schedule: [alarm] }), env)).json();
  const ring = ringMinute(alarm, '2026-11-07');
  const at = (m) => new Date(Date.UTC(2026, 10, 7, Math.floor(m / 60), m % 60));
  const outbox = [];
  const fakeFetch = async (url, init) => { outbox.push(init); return new Response(null, { status: 201 }); };

  assert.equal((await runDue(env, at(ring - 1), fakeFetch)).length, 0, 'silent before ring time');
  assert.equal((await runDue(env, at(ring), fakeFetch)).length, 1, 'rings on time');
  assert.equal((await runDue(env, at(ring + 1), fakeFetch)).length, 0);
  assert.equal((await runDue(env, at(ring + 2), fakeFetch)).length, 1, 'rings again after 2 minutes');
  const msg = await decryptOnPhone(phone, outbox[0].body);
  assert.equal(msg.url, './?alarm=a_wake&date=2026-11-07');
  assert.equal(msg.renotify, true);

  const done = await worker.fetch(req('POST', '/alarm/done', { id, alarmId: 'a_wake', date: '2026-11-07' }, token), env);
  assert.equal(done.status, 200);
  assert.equal((await runDue(env, at(ring + 4), fakeFetch)).length, 0, 'stops once done');
});

test('subscribe → scheduled run sends an encrypted, signed push the phone can read', async () => {
  const env = await makeEnv();
  const phone = await makePhone();
  const schedule = [
    { id: 'priority@09:30', time: '09:30', days: [1, 2, 3, 4, 5, 6], title: 'One design priority', body: 'What to resolve today?' },
    { id: 'morning@07:30', time: '07:30', days: [0, 1, 2, 3, 4, 5, 6], title: 'Morning sketch', body: '15 minutes.' },
  ];
  const r = await worker.fetch(req('POST', '/subscribe', { subscription: phone.subscription, tz: 'Asia/Kolkata', schedule }), env);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('access-control-allow-origin'), 'https://app.example');
  const { id, token } = await r.json();
  assert.ok(id && token);

  const outbox = [];
  const fakeFetch = async (url, init) => { outbox.push({ url, init }); return new Response(null, { status: 201 }); };
  const sent = await runDue(env, new Date('2026-11-07T04:00:00Z'), fakeFetch);
  assert.equal(sent.length, 1);
  assert.equal(outbox[0].url, phone.subscription.endpoint);
  assert.equal(outbox[0].init.headers['Content-Encoding'], 'aes128gcm');
  await verifyVapid(env, outbox[0].init.headers.Authorization, phone.subscription.endpoint);
  const msg = await decryptOnPhone(phone, outbox[0].init.body);
  assert.deepEqual(msg, { title: 'One design priority', body: 'What to resolve today?', tag: 'priority@09:30' });

  assert.equal((await runDue(env, new Date('2026-11-07T04:01:00Z'), fakeFetch)).length, 0, 'nothing due a minute later');
});

test('schedule updates need the token; a gone subscription is removed', async () => {
  const env = await makeEnv();
  const phone = await makePhone();
  const { id, token } = await (await worker.fetch(req('POST', '/subscribe', { subscription: phone.subscription, tz: 'UTC', schedule: [] }), env)).json();
  assert.equal((await worker.fetch(req('PUT', '/schedule', { id, schedule: [] }, 'wrong-token'), env)).status, 401);
  const ok = await worker.fetch(req('PUT', '/schedule', { id, schedule: [{ id: 'x', time: '10:00', days: [6], title: 'T', body: 'B' }] }, token), env);
  assert.equal(ok.status, 200);
  const sent = await runDue(env, new Date('2026-11-07T10:00:00Z'), async () => new Response(null, { status: 410 }));
  assert.equal(sent.length, 0);
  assert.deepEqual(await env.SUBS.get('subs', 'json'), {});
});

test('rejects non-push endpoints and bad schedules', async () => {
  const env = await makeEnv();
  const phone = await makePhone();
  const evil = { ...phone.subscription, endpoint: 'https://attacker.example/hook' };
  assert.equal((await worker.fetch(req('POST', '/subscribe', { subscription: evil, tz: 'UTC', schedule: [] }), env)).status, 400);
  const bad = await worker.fetch(req('POST', '/subscribe', { subscription: phone.subscription, tz: 'UTC', schedule: [{ time: '25:00', days: [1] }] }), env);
  assert.equal(bad.status, 400);
});

test('ring-time link for the iPhone Clock: needs a key from the app, follows the synced alarm, says off on rest days', async () => {
  const env = await makeEnv();
  const phone = await makePhone();
  const alarm = { kind: 'alarm', id: 'a_wake', time: '07:00', shiftMin: 10, shiftMax: 15, days: [1, 2, 3, 4, 5, 6], title: 'Wake up', body: 'b' };
  const { id, token } = await (await worker.fetch(req('POST', '/subscribe', { subscription: phone.subscription, tz: 'Asia/Kolkata', schedule: [alarm] }), env)).json();
  assert.equal((await worker.fetch(req('POST', '/clock-key', { id }, 'wrong-token'), env)).status, 401);
  const { key } = await (await worker.fetch(req('POST', '/clock-key', { id }, token), env)).json();
  assert.ok(key.length >= 16);

  const get = (path) => worker.fetch(new Request(`https://push.example${path}`), env);
  const res = await get(`/ring/${id}/${key}`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  const text = await res.text();
  const { date, dow } = localParts(new Date(), 'Asia/Kolkata');
  if (alarm.days.includes(dow)) {
    const m = ringMinute(alarm, date);
    assert.equal(text, `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
    const diff = Math.abs(m - 7 * 60);
    assert.ok(diff >= 10 && diff <= 15, `shift ${diff}`);
  } else assert.equal(text, 'off');
  assert.equal((await get(`/ring/${id}/${'x'.repeat(32)}`)).status, 404, 'wrong key');

  // a fixed Sunday (rest day) and a fixed Monday, checked directly
  const s = (await env.SUBS.get('subs', 'json'))[id];
  assert.equal(ringToday(s, new Date('2026-11-08T00:30:00Z')), 'off');           // Sunday morning in India
  assert.match(ringToday(s, new Date('2026-11-09T00:30:00Z')), /^0[6-7]:\d\d$/); // Monday
  assert.equal(ringToday(s, new Date('2026-11-09T00:30:00Z'), 'nope'), 'off');

  // re-subscribing (e.g. reminders turned off and on) keeps the link working
  await worker.fetch(req('POST', '/subscribe', { subscription: phone.subscription, tz: 'Asia/Kolkata', schedule: [alarm] }), env);
  assert.equal((await get(`/ring/${id}/${key}`)).status, 200);
});

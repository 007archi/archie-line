// Archie Line push server — a Cloudflare Worker.
// Stores, per phone: the push subscription, time zone, reminder schedule and a hashed access token.
// A cron trigger runs every minute and sends the reminders that are due in each phone's local time.
import { sendWebPush, b64u } from './webpush.js';
import { ringMinute } from './jitter.js';

const NAG_MINUTES = [0, 2, 4, 6, 8, 10]; // an alarm re-alerts every 2 minutes until the phone reports it done

const KV_KEY = 'subs';       // one JSON record: { [id]: Subscriber } — one read per minute, writes only on change
const MAX_SUBSCRIBERS = 10;  // a personal server; refuse anything beyond a few devices
const PUSH_HOSTS = [/^web\.push\.apple\.com$/, /^fcm\.googleapis\.com$/, /^updates\.push\.services\.mozilla\.com$/, /\.notify\.windows\.com$/];

const te = new TextEncoder();
async function sha256hex(s) {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', te.encode(s)));
  return [...d].map((b) => b.toString(16).padStart(2, '0')).join('');
}
function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

const loadSubs = async (env) => (await env.SUBS.get(KV_KEY, 'json')) ?? {};
const saveSubs = (env, subs) => env.SUBS.put(KV_KEY, JSON.stringify(subs));

// ---- validation
class BadRequest extends Error {}
function check(cond, msg) { if (!cond) throw new BadRequest(msg); }

function validSubscription(s) {
  check(s && typeof s.endpoint === 'string' && s.keys?.p256dh && s.keys?.auth, 'Missing subscription');
  const u = new URL(s.endpoint);
  check(u.protocol === 'https:' && PUSH_HOSTS.some((re) => re.test(u.hostname)), 'Unknown push service');
  return { endpoint: s.endpoint, keys: { p256dh: String(s.keys.p256dh), auth: String(s.keys.auth) } };
}
function validTz(tz) {
  try { new Intl.DateTimeFormat('en', { timeZone: tz }); return tz; } catch { throw new BadRequest('Unknown time zone'); }
}
function validSchedule(list) {
  check(Array.isArray(list) && list.length <= 60, 'Schedule must be a list of at most 60 items');
  return list.map((r) => {
    check(typeof r.time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(r.time), 'Bad time');
    check(Array.isArray(r.days) && r.days.every((d) => Number.isInteger(d) && d >= 0 && d <= 6), 'Bad days');
    const alarm = r.kind === 'alarm' ? (() => {
      const lo = Number(r.shiftMin);
      const hi = Number(r.shiftMax);
      check(Number.isInteger(lo) && Number.isInteger(hi) && lo >= 0 && hi <= 30 && lo <= hi, 'Bad alarm shift');
      return { kind: 'alarm', shiftMin: lo, shiftMax: hi };
    })() : {};
    return {
      ...alarm,
      id: String(r.id ?? '').slice(0, 40),
      time: r.time,
      days: [...new Set(r.days)],
      title: String(r.title ?? 'Archie Line').slice(0, 60),
      body: String(r.body ?? '').slice(0, 160),
    };
  });
}

async function authorise(req, subs, id) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const sub = subs[id];
  if (!sub || !token || !safeEqual(sub.tokenHash, await sha256hex(token))) throw Object.assign(new Error('Not authorised'), { status: 401 });
  return sub;
}

/** Local "HH:MM", minute of day, weekday (0 = Sunday) and "YYYY-MM-DD" for an instant in a time zone. */
export function localParts(date, tz) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date).map((p) => [p.type, p.value]));
  const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday);
  return {
    hhmm: `${parts.hour}:${parts.minute}`,
    minute: Number(parts.hour) * 60 + Number(parts.minute),
    dow,
    date: `${parts.year}-${parts.month}-${parts.day}`,
  };
}

const doneKey = (subId, alarmId, date) => `done:${subId}:${alarmId}:${date}`;

/** Messages due for one subscriber at this minute. Alarms need a KV lookup to see if they were dismissed. */
async function dueMessages(env, subId, s, now) {
  const { hhmm, minute, dow, date } = localParts(now, s.tz);
  const out = [];
  for (const r of s.schedule) {
    if (!r.days.includes(dow)) continue;
    if (r.kind !== 'alarm') {
      if (r.time === hhmm) out.push({ id: r.id, msg: { title: r.title, body: r.body, tag: r.id } });
      continue;
    }
    const since = minute - ringMinute(r, date);
    if (!NAG_MINUTES.includes(since)) continue;
    if (await env.SUBS.get(doneKey(subId, r.id, date))) continue;
    out.push({
      id: `${r.id}+${since}`,
      msg: { title: r.title, body: r.body, tag: `alarm-${r.id}`, renotify: true, url: `./?alarm=${encodeURIComponent(r.id)}&date=${date}` },
    });
  }
  return out;
}

/**
 * Today's ring time for one subscriber, for an iOS Shortcuts automation that sets the iPhone Clock alarm.
 * Returns "HH:MM" for the earliest alarm ringing today (or the one named by `alarmId`), or "off".
 * Exported for tests.
 */
export function ringToday(s, now, alarmId = '') {
  const { dow, date } = localParts(now, s.tz);
  const mins = s.schedule
    .filter((r) => r.kind === 'alarm' && r.days.includes(dow) && (!alarmId || r.id === alarmId))
    .map((r) => ringMinute(r, date));
  if (!mins.length) return 'off';
  const m = Math.min(...mins);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** Send everything due at `now`. Exported for tests. */
export async function runDue(env, now, fetchImpl = fetch) {
  const subs = await loadSubs(env);
  let changed = false;
  const sent = [];
  for (const [id, s] of Object.entries(subs)) {
    for (const due of await dueMessages(env, id, s, now)) {
      const res = await sendWebPush(s.subscription, due.msg, env, fetchImpl);
      if (res.status === 404 || res.status === 410) { delete subs[id]; changed = true; break; } // phone unsubscribed
      sent.push({ id, reminder: due.id, status: res.status });
    }
  }
  if (changed) await saveSubs(env, subs);
  return sent;
}

export default {
  async fetch(req, env) {
    const cors = {
      'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'content-type, authorization',
      Vary: 'Origin',
    };
    const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { ...cors, 'content-type': 'application/json' } });
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    const { pathname } = new URL(req.url);
    const route = `${req.method} ${pathname}`;
    try {
      if (route === 'GET /vapid') return json({ publicKey: env.VAPID_PUBLIC_KEY });

      // Read-only link for an iOS Shortcuts automation: today's alarm time as plain text.
      const ring = req.method === 'GET' && pathname.match(/^\/ring\/([0-9a-f]{32})\/([A-Za-z0-9_-]{16,64})$/);
      if (ring) {
        const text = (t, status = 200) => new Response(t, { status, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });
        const all = await loadSubs(env);
        const s = all[ring[1]];
        if (!s?.clockHash || !safeEqual(s.clockHash, await sha256hex(ring[2]))) return text('not found', 404);
        return text(ringToday(s, new Date(), new URL(req.url).searchParams.get('alarm') ?? ''));
      }

      const body = req.method === 'GET' ? {} : await req.json().catch(() => { throw new BadRequest('Expected JSON'); });
      const subs = await loadSubs(env);

      if (route === 'POST /subscribe') {
        const subscription = validSubscription(body.subscription);
        const id = (await sha256hex(subscription.endpoint)).slice(0, 32);
        check(subs[id] || Object.keys(subs).length < MAX_SUBSCRIBERS, 'This server is full');
        const token = b64u.enc(crypto.getRandomValues(new Uint8Array(32)));
        subs[id] = { subscription, tz: validTz(body.tz), schedule: validSchedule(body.schedule ?? []), tokenHash: await sha256hex(token), clockHash: subs[id]?.clockHash, updated: Date.now() };
        await saveSubs(env, subs);
        return json({ id, token });
      }
      if (route === 'PUT /schedule') {
        const sub = await authorise(req, subs, body.id);
        sub.schedule = validSchedule(body.schedule);
        if (body.tz) sub.tz = validTz(body.tz);
        sub.updated = Date.now();
        await saveSubs(env, subs);
        return json({ ok: true, count: sub.schedule.length });
      }
      if (route === 'DELETE /subscribe') {
        await authorise(req, subs, body.id);
        delete subs[body.id];
        await saveSubs(env, subs);
        return json({ ok: true });
      }
      if (route === 'POST /alarm/done') {
        await authorise(req, subs, body.id);
        check(typeof body.alarmId === 'string' && /^\d{4}-\d\d-\d\d$/.test(body.date ?? ''), 'Bad alarm');
        await env.SUBS.put(doneKey(body.id, body.alarmId.slice(0, 40), body.date), '1', { expirationTtl: 2 * 86400 });
        return json({ ok: true });
      }
      if (route === 'POST /clock-key') {
        const sub = await authorise(req, subs, body.id);
        const key = b64u.enc(crypto.getRandomValues(new Uint8Array(24)));
        sub.clockHash = await sha256hex(key); // only the hash is kept; a new key replaces the old link
        await saveSubs(env, subs);
        return json({ key });
      }
      if (route === 'POST /test') {
        const sub = await authorise(req, subs, body.id);
        const res = await sendWebPush(sub.subscription, { title: 'Archie Line', body: 'Notifications are working.', tag: 'test' }, env);
        if (!res.ok) return json({ error: `Push service replied ${res.status}` }, 502);
        return json({ ok: true });
      }
      return json({ error: 'Not found' }, 404);
    } catch (err) {
      const status = err.status ?? (err instanceof BadRequest ? 400 : 500);
      return json({ error: status === 500 ? 'Server error' : err.message }, status);
    }
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(runDue(env, new Date(event.scheduledTime)));
  },
};

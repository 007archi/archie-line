// Talks to the Archie Line push server and the browser's Push API.

/** Your own push server (Cloudflare Worker), pre-filled in Settings → Reminders. */
export const DEFAULT_PUSH_URL = 'https://studio-days-push.archie-line.workers.dev';
// What the server learns: your push address (an opaque URL from Apple), your time zone and the reminder schedule.

function b64urlToBytes(s) {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}
function bytesToB64url(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function pushSupport() {
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  return { supported, standalone, permission: supported ? Notification.permission : 'unsupported' };
}

const timeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

async function call(conn, path, method, body) {
  const res = await fetch(`${conn.serverUrl}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(conn.token ? { authorization: `Bearer ${conn.token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Push server replied ${res.status}.`);
  return json;
}

/** Must be called straight from a tap: iOS only shows the permission prompt for a user gesture. */
export async function connect(serverUrl, schedule) {
  const base = serverUrl.trim().replace(/\/+$/, '');
  if (!/^https:\/\//.test(base)) throw new Error('The push server address must start with https://');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notifications were not allowed. You can allow them in iPhone Settings → Notifications → Archie Line.');
  const { publicKey } = await call({ serverUrl: base }, '/vapid', 'GET');
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (sub && sub.options?.applicationServerKey && bytesToB64url(sub.options.applicationServerKey) !== publicKey) {
    await sub.unsubscribe();
    sub = null;
  }
  sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64urlToBytes(publicKey) });
  const { id, token } = await call({ serverUrl: base }, '/subscribe', 'POST', { subscription: sub.toJSON(), tz: timeZone(), schedule });
  return { serverUrl: base, id, token };
}

export const sync = (conn, schedule) => call(conn, '/schedule', 'PUT', { id: conn.id, tz: timeZone(), schedule });
export const sendTest = (conn) => call(conn, '/test', 'POST', { id: conn.id });

export async function disconnect(conn) {
  try { await call(conn, '/subscribe', 'DELETE', { id: conn.id }); } catch { /* server may already have dropped it */ }
  const sub = await (await navigator.serviceWorker.ready).pushManager.getSubscription();
  await sub?.unsubscribe();
}

/** A private, read-only link that returns today's alarm time ("06:48" or "off") for an iOS Shortcuts automation. */
export async function clockLink(conn) {
  const { key } = await call(conn, '/clock-key', 'POST', { id: conn.id });
  return `${conn.serverUrl}/ring/${conn.id}/${key}`;
}

/** Tell the server an alarm was dismissed so it stops re-alerting. */
export const alarmDone = (conn, alarmId, date) => call(conn, '/alarm/done', 'POST', { id: conn.id, alarmId, date });

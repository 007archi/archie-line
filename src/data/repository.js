// Storage the app talks to. Two modes behind one interface:
//   plain     — records written straight to IndexedDB (db.js)
//   encrypted — the whole dataset kept in memory while unlocked and saved as one AES-GCM blob
import * as db from './db.js';
import { deriveKey, seal, unseal, newKdf, MIN_PASSCODE } from './crypto.js';

const STORE_KEYS = { habits: 'id', entries: 'key', days: 'date', meta: 'k' };

let encrypted = false; // a vault exists on this device
let key = null;        // in-memory AES key while unlocked
let kdf = null;
let cache = null;      // decrypted dataset: { habits: [], entries: [], days: [], meta: [] }
let saveTimer = null;
let pendingSave = null;

export async function init() {
  encrypted = Boolean(await db.getVault());
  return { encrypted };
}
export const isEncrypted = () => encrypted;
export const isLocked = () => encrypted && !key;

export async function unlock(passcode) {
  const vault = await db.getVault();
  const k = await deriveKey(passcode, vault.kdf);
  cache = await unseal(k, vault); // throws WrongPasscodeError
  key = k;
  kdf = vault.kdf;
}

export async function lock() {
  await flush();
  key = null;
  cache = null;
}

// ---- data API used by the tracker
export async function loadAll() {
  if (!encrypted) return db.loadAll();
  if (!key) throw new Error('Locked');
  return structuredClone(cache);
}

export async function put(store, record) {
  if (!encrypted) return db.putRecord(store, record);
  const list = cache[store];
  const k = STORE_KEYS[store];
  const i = list.findIndex((r) => r[k] === record[k]);
  if (i >= 0) list[i] = record; else list.push(record);
  scheduleSave();
}

export async function remove(store, id) {
  if (!encrypted) return db.deleteRecord(store, id);
  const k = STORE_KEYS[store];
  cache[store] = cache[store].filter((r) => r[k] !== id);
  scheduleSave();
}

export async function replaceAll(data) {
  if (!encrypted) return db.replaceAll(data);
  cache = Object.fromEntries(Object.keys(STORE_KEYS).map((s) => [s, structuredClone(data[s] ?? [])]));
  await saveNow();
}

// Batch rapid taps into one encryption + write.
function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 250);
}
async function saveNow() {
  clearTimeout(saveTimer);
  saveTimer = null;
  if (!key) return;
  const snapshot = structuredClone(cache);
  pendingSave = (async () => db.putVault(await seal(key, kdf, snapshot)))();
  await pendingSave;
}
/** Make sure nothing is waiting in the debounce (call before locking or when the app goes to background). */
export async function flush() {
  if (saveTimer) await saveNow();
  else if (pendingSave) await pendingSave;
}

// ---- turning encryption on / off
function checkPasscode(p) {
  if (typeof p !== 'string' || p.length < MIN_PASSCODE) throw new Error(`Use at least ${MIN_PASSCODE} characters.`);
}

export async function enable(passcode) {
  checkPasscode(passcode);
  const data = await db.loadAll();
  const newK = newKdf();
  const k = await deriveKey(passcode, newK);
  const sealed = await seal(k, newK, data);
  await unseal(k, sealed); // verify before wiping plaintext
  await db.encryptInPlace(sealed);
  encrypted = true; key = k; kdf = newK; cache = data;
}

export async function disable() {
  if (!key) throw new Error('Unlock first.');
  await flush();
  await db.decryptInPlace(cache);
  encrypted = false; key = null; kdf = null; cache = null;
}

export async function changePasscode(current, next) {
  checkPasscode(next);
  const vault = await db.getVault();
  await unseal(await deriveKey(current, vault.kdf), vault); // proves the current passcode
  await flush();
  const newK = newKdf();
  const k = await deriveKey(next, newK);
  await db.putVault(await seal(k, newK, cache));
  key = k; kdf = newK;
}

// ---- encrypted backups
/** Backup sealed with its own salt from `passcode` (normally the same passcode). */
export async function sealBackup(data, passcode) {
  const k2 = newKdf();
  return seal(await deriveKey(passcode, k2), k2, data);
}
export async function openBackup(sealed, passcode) {
  return unseal(await deriveKey(passcode, sealed.kdf), sealed);
}

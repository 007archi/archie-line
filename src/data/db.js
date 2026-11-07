// Thin IndexedDB wrapper. All data lives on the device; nothing is sent anywhere.
const DB_NAME = 'studio-days';
const DB_VERSION = 2;
export const STORES = ['habits', 'entries', 'days', 'meta'];
const KEY_PATHS = { habits: 'id', entries: 'key', days: 'date', meta: 'k', vault: 'id' };
const ALL_STORES = [...STORES, 'vault']; // 'vault' holds the single encrypted blob when encryption is on

let dbPromise;

function openDb() {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      for (const s of ALL_STORES) {
        if (!req.result.objectStoreNames.contains(s)) req.result.createObjectStore(s, { keyPath: KEY_PATHS[s] });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function run(storeNames, mode, work) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeNames, mode);
    const result = work(tx);
    tx.oncomplete = () => resolve(result && 'result' in result ? result.result : result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function loadAll() {
  const out = {};
  await Promise.all(STORES.map(async (s) => {
    out[s] = await run([s], 'readonly', (tx) => tx.objectStore(s).getAll());
  }));
  return out;
}

export const putRecord = (store, record) => run([store], 'readwrite', (tx) => { tx.objectStore(store).put(record); });
export const deleteRecord = (store, key) => run([store], 'readwrite', (tx) => { tx.objectStore(store).delete(key); });

/** Atomically replace everything (used by import and reset). */
export function replaceAll(data) {
  return run(STORES, 'readwrite', (tx) => {
    for (const s of STORES) {
      const os = tx.objectStore(s);
      os.clear();
      for (const rec of data[s] ?? []) os.put(rec);
    }
  });
}

// ---- encrypted vault (one record)
export const getVault = () => run(['vault'], 'readonly', (tx) => tx.objectStore('vault').get('main'));
export const putVault = (sealed) => putRecord('vault', { id: 'main', ...sealed });
export const clearVault = () => deleteRecord('vault', 'main');

/** Write the vault and wipe the plaintext stores in ONE transaction, so there is never a half-encrypted state. */
export function encryptInPlace(sealed) {
  return run(ALL_STORES, 'readwrite', (tx) => {
    tx.objectStore('vault').put({ id: 'main', ...sealed });
    for (const s of STORES) tx.objectStore(s).clear();
  });
}

/** Restore plaintext stores and remove the vault in ONE transaction. */
export function decryptInPlace(data) {
  return run(ALL_STORES, 'readwrite', (tx) => {
    for (const s of STORES) {
      const os = tx.objectStore(s);
      os.clear();
      for (const rec of data[s] ?? []) os.put(rec);
    }
    tx.objectStore('vault').delete('main');
  });
}

/** Ask the browser not to evict our data under storage pressure. */
export async function requestPersistence() {
  if (!navigator.storage?.persist) return null;
  if (await navigator.storage.persisted()) return true;
  return navigator.storage.persist();
}

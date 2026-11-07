// Passcode-based encryption with the browser's built-in Web Crypto API.
// PBKDF2-SHA256 (600k iterations) turns the passcode into an AES-256-GCM key.
// The key is non-extractable and lives only in memory while the app is unlocked.

const te = new TextEncoder();
const td = new TextDecoder();

export const VAULT_FORMAT = 'studio-days-vault/1';
const AAD = te.encode(VAULT_FORMAT); // binds ciphertext to this format
export const ITERATIONS = 600_000;
export const MIN_PASSCODE = 6;

export class WrongPasscodeError extends Error {
  constructor() { super('That passcode is not right.'); this.name = 'WrongPasscodeError'; }
}

export function toB64(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000));
  return btoa(s);
}
export function fromB64(b64) {
  const s = atob(b64);
  const u8 = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i);
  return u8;
}

export function newKdf() {
  return { name: 'PBKDF2', hash: 'SHA-256', iterations: ITERATIONS, salt: toB64(crypto.getRandomValues(new Uint8Array(16))) };
}

export async function deriveKey(passcode, kdf) {
  if (kdf?.name !== 'PBKDF2' || kdf.hash !== 'SHA-256') throw new Error('Unsupported key format.');
  const base = await crypto.subtle.importKey('raw', te.encode(passcode.normalize('NFKC')), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: fromB64(kdf.salt), iterations: kdf.iterations, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'],
  );
}

/** Encrypt any JSON-serialisable value. A fresh random IV every time. */
export async function seal(key, kdf, value) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: AAD }, key, te.encode(JSON.stringify(value)));
  return { format: VAULT_FORMAT, kdf, iv: toB64(iv), ct: toB64(ct) };
}

/** Decrypt a sealed object. A wrong key fails the GCM tag check → WrongPasscodeError. */
export async function unseal(key, sealed) {
  if (sealed?.format !== VAULT_FORMAT) throw new Error('Not an encrypted Archie Line file.');
  try {
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(sealed.iv), additionalData: AAD }, key, fromB64(sealed.ct));
    return JSON.parse(td.decode(pt));
  } catch (err) {
    if (err instanceof SyntaxError) throw err;
    throw new WrongPasscodeError();
  }
}

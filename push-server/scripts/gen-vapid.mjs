// Generates the VAPID key pair the push server signs with. Run once: node scripts/gen-vapid.mjs
const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const raw = new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey));
const pub = Buffer.from(raw).toString('base64url');
const jwk = await crypto.subtle.exportKey('jwk', kp.privateKey);
console.log('VAPID_PUBLIC_KEY (paste into wrangler.toml):\n' + pub + '\n');
console.log('VAPID_PRIVATE_JWK (paste when `npx wrangler secret put VAPID_PRIVATE_JWK` asks; keep it secret):\n' + JSON.stringify(jwk));

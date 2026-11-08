# Archie Line push server

iPhone web apps can only receive notifications that a server sends. This tiny Cloudflare Worker (free plan is plenty) does that.

**What it stores:** your phone's push address (an opaque Apple URL), your time zone, the reminder times and their short generic text, and a hashed access token. **It never receives your habits, check-ins, notes or streaks.** Push messages are end-to-end encrypted to your phone (RFC 8291).

## Set up (about 10 minutes, once)
You need a free Cloudflare account and Node.js.

1. In this folder: `npx wrangler login`
2. `npx wrangler kv namespace create SUBS` → copy the `id` into `wrangler.toml`.
3. `node scripts/gen-vapid.mjs` → paste the public key into `wrangler.toml`; keep the private JWK for step 5.
4. Edit `VAPID_SUBJECT` (your email) and `ALLOWED_ORIGIN` (the address the app is hosted at) in `wrangler.toml`.
5. `npx wrangler secret put VAPID_PRIVATE_JWK` → paste the private JWK.
6. `npx wrangler deploy` → note the `https://studio-days-push.<you>.workers.dev` address.
7. On the iPhone, in the installed app: Settings → Reminders → paste that address → **Turn on reminders** → **Send test**.

## Notes
- Reminders fire within the minute set, in the phone's time zone. Charrette mode sends only essential reminders.
- Changing the VAPID keys disconnects phones; turn reminders off and on again in the app.
- Tests: `node --test tests/` in this folder (nothing to install).

## Lock-screen alarm link
`POST /clock-key` (authorised by the phone's token) issues a random read-only key; only its hash is stored, and a new key replaces the old one. `GET /ring/<id>/<key>` returns today's alarm time in the phone's time zone as plain text (`HH:MM`, or `off` on days without an alarm; `?alarm=<id>` picks one alarm). Used by an iOS Shortcuts automation to set the iPhone Clock alarm.

## Current deployment
- Live at `https://studio-days-push.archie-line.workers.dev` (Cloudflare Worker `studio-days-push`), already configured in `wrangler.toml` and pre-filled in the app (`src/app/push.js`).
- The private key exists only as the Cloudflare secret `VAPID_PRIVATE_JWK`; it is not in this repository.
- To update the server after changing its code: in this folder run `npx wrangler login` (once per computer), then `npx wrangler deploy`.

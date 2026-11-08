# Archie Line

_Draw your day. Formerly Studio Days. Storage keys and backup format ids still say `studio-days`, so existing data and backups keep working._

A private, offline habit tracker shaped around an architect's day. No account, no server: everything is stored on the phone.

## Run locally
    python -m http.server 8765
Open http://localhost:8765. Logic tests: `node --test tests/` (31 tests; `push-server/` has 6 more)

## Put it on your iPhone
iOS only installs web apps served over HTTPS, so host the folder on any free static host:
- **GitHub Pages:** push this folder to a repo → Settings → Pages → deploy from `main` / root.
- **Netlify Drop:** drag this folder onto https://app.netlify.com/drop.

Then on the iPhone: open the URL in **Safari** → Share → **Add to Home Screen**.
The host only delivers the app; your habit data never leaves the phone.

## Updating
After changing files, bump `VERSION` in `sw.js`, redeploy, then open the app twice on the phone to pick up the new build.

## Structure
- `src/domain/` — pure rules (dates, streaks, charrette pause, weekly summary). Tested in `tests/`.
- `src/data/db.js` — IndexedDB storage.
- `src/app/tracker.js` — app state with write-through saving, export/import.
- `src/ui/views.js` — screens; `src/main.js` — events and startup.

## Encryption
Settings → Encryption → Encrypt my data. Everything (habits, check-ins, notes, settings) is kept as one AES-256-GCM blob, keyed from your passcode with PBKDF2-SHA256 (600,000 rounds). The key lives only in memory while unlocked; the app re-locks after the auto-lock delay. A forgotten passcode cannot be recovered. Code: `src/data/crypto.js`, `src/data/repository.js`.

## Reminders
Push notifications need the small server in `push-server/` (see its README). It only receives reminder times and generic text, never habit data. Reminder rules: `src/domain/reminders.js`; client: `src/app/push.js`; notification display: `sw.js`.

## Alarms
Alarms tab. Each alarm rings at its set time shifted by a fresh random amount every day (default 10–15 min earlier or later; other windows in the alarm editor), and only stops after a short activity: 3 slow breaths, tapping 8 dots, 3 quick sums, typing a phrase, a memory grid, counting 1–9, a drawing-scale quiz, an architecture word scramble, or tracing a building outline. The daily shift is derived from the alarm id + date, so the push server (`push-server/src/jitter.js`, kept identical by a test) rings at the same moment and re-alerts every 2 minutes until the app reports it done. With the app open (Bedside mode keeps the screen awake) it rings with sound. Code: `src/domain/alarms.js`, `src/ui/activities.js`, `src/app/sound.js`.

**Lock-screen alarm:** Alarms → Lock-screen alarm creates a private read-only link (`/ring/<id>/<key>` on the push server) that returns today's shifted time as text (`06:48` or `off`). A nightly iOS Shortcuts automation reads it, deletes yesterday's "Archie Line" Clock alarm and creates today's, so the iPhone's own alarm rings while locked or on silent. The repeating push notification at the same moment opens the app for the wake-up activity. A visual 8-step setup guide (drawn iPhone screens with tap markers and copy buttons) opens from the card.

**Alarm sounds:** each alarm picks one of 9 sounds (Classic beep, Pager, Buzzer, Siren, Lights out, Rising chimes, Bell tower, Morning marimba, Temple gong) and a volume (Gentle rise, Loud, Maximum), with a Preview button. Sounds run through drive, a soft clipper and a compressor for extra loudness; on iOS the page plays as media, so an open app is heard even on silent.

## More trackers
Habit library (Health, Mind, Focus, Studio, Life) from the + button, a daily energy check-in, and a focus timer (▶ on any minutes habit) that logs the minutes when you stop.

## Theme packs
Settings → Appearance → Theme pack (tap **Change** to open the picker; packs apply live behind it). **Mode** (Auto / Light / Dark) applies to every pack, and every pack has its own light and dark palette. Auto follows the iPhone's setting live. Packs:
- **Studio** (default). It also has the Shapes / Starry Night background choice. Starry Night is a night sky, so choosing Light or Auto switches it to Shapes.
- **Architects:** Casa Color (Barragán), Polychromie (Le Corbusier), Less Is More (Mies), Parametric (Zaha Hadid), Concrete & Light (Tadao Ando).
- **Architectural styles** (after simplykalaa.com/architectural-styles): Stained Glass (Gothic), Jazz Age (Art Deco), Bauhaus, Raw Concrete (Brutalist), Marble & Column (Neoclassical), Pastel Salon (Rococo), Girih Tiles (Islamic), Sandstone & Marble (Indo-Saracenic).
- **Artists:** Starry Night (Van Gogh), De Stijl (Mondrian), Great Wave (Hokusai), Gold Period (Klimt), Water Lilies (Monet), Infinity Dots (Kusama).
- **Shinobi** (inspired by Naruto): Orange Spiral (Naruto), Indigo Lightning (Sasuke), Silver Mist (Kakashi), Crimson Moon (Itachi), Lavender Calm (Hinata), Desert Sand (Gaara).
- **Motorsport** (inspired by F1): Rosso Corsa (Ferrari), Papaya (McLaren), Silver Arrow (Mercedes), Midnight Charge (Red Bull), British Racing Green (Aston Martin), Grove Blue (Williams), Yellow Helmet (Ayrton Senna), Oranje (Max Verstappen), Forty-Four (Lewis Hamilton).

Fan packs use colour palettes and original motifs only, with no logos, emblems or character art.

Each pack sets colours, type, corner radius and an original background study. A background drawn for one mode appears tonally inverted (same hues, quieter) in the other mode, unless the pack draws its own art for that mode. `tests/themes.test.mjs` checks the WCAG contrast of every pack in both modes. Defined in `src/domain/themes.js`.

## Profile
Settings → top card. Name, role, studio/firm/school, city, current project and an optional photo. The photo is square-cropped to 192px on the phone. The Today greeting uses your first name ("Good morning, Sam"). The card shows all-time check-ins, the good-day run, the best streak and the tracking-since date. Profile data is stored with the other settings, so it is encrypted when encryption is on and included in backups. Logic is in `src/domain/profile.js`, tested in `tests/profile.test.mjs`.

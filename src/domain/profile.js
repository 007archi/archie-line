// Basic profile: who is using the tracker. Stored with the other settings, so it is encrypted
// together with the habits when encryption is on, and travels in backups.

export const ROLES = [
  'Architect', 'Architecture student', 'Intern architect', 'Project architect', 'Principal',
  'Interior designer', 'Landscape architect', 'Urban designer', 'Other',
];

const LIMITS = { name: 40, role: 40, studio: 60, city: 40, project: 80 };

/** Clean user input into a profile object (trimmed, length-capped, photo only as a small data URL). */
export function normaliseProfile(input = {}) {
  const out = {};
  for (const [k, max] of Object.entries(LIMITS)) out[k] = String(input[k] ?? '').trim().replace(/\s+/g, ' ').slice(0, max);
  const photo = String(input.photo ?? '');
  out.photo = /^data:image\/(jpeg|png|webp);base64,/.test(photo) && photo.length < 120_000 ? photo : '';
  return out;
}

export const hasProfile = (p) => Boolean(p && (p.name || p.role || p.studio || p.photo));

/** Up to two initials for the avatar fallback. */
export function initials(name) {
  const parts = String(name ?? '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  const first = [...parts[0]][0] ?? '';
  const last = parts.length > 1 ? [...parts[parts.length - 1]][0] ?? '' : '';
  return (first + last).toUpperCase();
}

/** "Good morning, Sam" — or just "Good morning" without a name. */
export function greeting(name, hour) {
  const part = hour < 5 ? 'Working late' : hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const first = String(name ?? '').trim().split(/\s+/)[0];
  return first ? `${part}, ${first}` : part;
}

/** "Architect · Studio North · Pune" from whichever fields are filled. */
export const subtitle = (p) => [p.role, p.studio, p.city].filter(Boolean).join(' · ');

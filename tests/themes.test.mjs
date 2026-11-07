import test from 'node:test';
import assert from 'node:assert/strict';
import { THEMES, packById, PACK_GROUPS, MODES, resolvePack } from '../src/domain/themes.js';

const lum = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const packs = THEMES.filter((t) => t.id !== 'studio');

test('packs are well-formed, grouped, and have both modes', () => {
  assert.equal(new Set(THEMES.map((t) => t.id)).size, THEMES.length);
  for (const t of THEMES) {
    assert.ok(PACK_GROUPS.includes(t.group), t.id);
    assert.equal(t.swatch.length, 5, t.id);
  }
  for (const t of packs) {
    assert.ok(MODES.includes(t.native), t.id);
    for (const mode of MODES) {
      const r = resolvePack(t, mode);
      assert.ok(typeof r.backdrop === 'string' && r.backdrop.length > 0, `${t.id} ${mode} backdrop`);
      for (const k of ['--bg', '--ink', '--black', '--on-dark', '--lime', '--on-accent', '--moss', '--on-moss', '--radius', '--display']) assert.ok(r.tokens[k], `${t.id} ${mode} ${k}`);
      assert.ok(mode === 'dark' ? lum(r.tokens['--bg']) < 0.05 : lum(r.tokens['--bg']) > 0.3, `${t.id}: ${mode} background is actually ${mode}`);
    }
  }
  for (const g of ['Architects', 'Styles', 'Artists', 'Shinobi', 'Motorsport']) assert.ok(THEMES.filter((t) => t.group === g).length >= 5, g);
  assert.equal(packById('nope').id, 'studio');
});

test('every pack keeps text readable in light and dark (WCAG AA 4.5:1 body, 3:1 large/accents)', () => {
  for (const t of packs) for (const mode of MODES) {
    const k = t[mode];
    const at = `${t.id}/${mode}`;
    assert.ok(contrast(k.ink, k.bg) >= 4.5, `${at}: ink on background ${contrast(k.ink, k.bg).toFixed(2)}`);
    assert.ok(contrast(k.onPanel, k.panel) >= 4.5, `${at}: text on panels ${contrast(k.onPanel, k.panel).toFixed(2)}`);
    assert.ok(contrast(k.onAccent, k.accent) >= 3, `${at}: text on accent ${contrast(k.onAccent, k.accent).toFixed(2)}`);
    assert.ok(contrast(k.onSecond, k.second) >= 3, `${at}: text on secondary ${contrast(k.onSecond, k.second).toFixed(2)}`);
    assert.ok(contrast(k.muted, k.bg) >= 3, `${at}: muted text ${contrast(k.muted, k.bg).toFixed(2)}`);
    // dark mode draws ticks, buttons and selected states in the accent on the dark panel
    if (mode === 'dark') assert.ok(contrast(k.accent, k.panel) >= 3, `${at}: accent marks on panel ${contrast(k.accent, k.panel).toFixed(2)}`);
  }
});

// Theme packs: complete looks inspired by architects, architectural styles and artists.
// Each pack has a light and a dark palette (chosen by Settings → Theme: Auto / Light / Dark), plus type,
// corner radius and a background. Backgrounds are either
// the app's own ('starry', 'blobs') or a lightweight SVG composition drawn here — original
// studies "after" each designer's language, not reproductions of specific works.

const hexRgb = (h) => {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const rgba = (h, a) => `rgba(${hexRgb(h).join(', ')}, ${a})`;
const mix = (h, toward, t) => {
  const a = hexRgb(h);
  const b = hexRgb(toward);
  return `#${a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, '0')).join('')}`;
};

/** Build the full token set from a handful of design decisions. */
function tokens(p) {
  const dark = p.scheme === 'dark';
  return {
    '--bg': p.bg,
    '--ink': p.ink,
    '--muted': p.muted,
    '--glass': rgba(dark ? p.panel : p.bg, p.glass ?? (dark ? 0.55 : 0.62)),
    '--glass-strong': rgba(dark ? p.panel : p.bg, 0.94),
    '--glass-edge': dark ? 'rgba(255, 255, 255, 0.09)' : 'rgba(255, 255, 255, 0.7)',
    '--glass-hi': dark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(255, 255, 255, 0.7)',
    '--black': p.panel,
    '--ink-hi': p.panelHi ?? mix(p.panel, '#ffffff', 0.14),
    '--on-dark': p.onPanel,
    '--lime': p.accent,
    '--accent-hi': mix(p.accent, '#ffffff', 0.28),
    '--accent-lo': mix(p.accent, '#000000', 0.14),
    '--on-accent': p.onAccent,
    '--accent-rgb': hexRgb(p.accent).join(', '),
    '--lime-deep': p.second,
    '--rust': p.second,
    '--moss': p.second,
    '--moss-hi': mix(p.second, '#ffffff', 0.2),
    '--on-moss': p.onSecond,
    '--mint': p.soft,
    '--red': p.red,
    '--red-rgb': hexRgb(p.red).join(', '),
    '--line': rgba(p.ink, dark ? 0.12 : 0.1),
    '--shadow': dark ? '0 18px 40px -22px rgba(0, 0, 0, 0.8)' : `0 18px 40px -22px ${rgba(p.ink, 0.35)}`,
    '--radius': `${p.radius}px`,
    '--display': p.font ?? '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", system-ui, sans-serif',
    '--blob-a': p.blobs?.[0] ?? p.accent,
    '--blob-b': p.blobs?.[1] ?? p.second,
    '--blob-c': p.blobs?.[2] ?? p.soft,
    '--tabbar': rgba(p.panel, 0.92),
    '--tab-muted': rgba(p.onPanel, 0.62),
  };
}

const svg = (body) => `<svg viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;

// ---- backdrops (original compositions in each designer's visual language)
const barraganBg = svg(`<g class="pk-drift" opacity="0.6">
  <rect x="-40" y="70" width="250" height="420" fill="#e5448a"/>
  <rect x="170" y="-30" width="270" height="290" fill="#f1b24a"/>
  <rect x="205" y="300" width="230" height="380" fill="#2c5aa0"/>
  <rect x="-30" y="540" width="290" height="340" fill="#d9653b"/>
  <polygon points="205,300 435,300 435,330 235,330" fill="rgba(40,20,10,0.18)"/>
  <polygon points="170,260 210,260 210,490 170,520" fill="rgba(40,20,10,0.12)"/></g>`);

const corbusierBg = (() => {
  const xs = [0, 62, 100, 162, 262, 390];
  const ys = [0, 100, 162, 262, 424, 524, 686, 844];
  const lines = [...xs.map((x) => `<line x1="${x}" y1="0" x2="${x}" y2="844"/>`), ...ys.map((y) => `<line x1="0" y1="${y}" x2="390" y2="${y}"/>`)].join('');
  return svg(`<g opacity="0.55"><rect x="100" y="162" width="162" height="100" fill="#d6a13c"/><rect x="262" y="424" width="128" height="100" fill="#2f4b9a"/>
    <rect x="0" y="524" width="100" height="162" fill="#a3482f"/><rect x="162" y="686" width="100" height="158" fill="#a9c3a0"/></g>
    <g stroke="rgba(31,31,31,0.18)" stroke-width="1.2">${lines}</g>
    <path d="M30 820 V560 M30 560 h12 M30 620 h8 M30 680 h12 M30 740 h8" stroke="rgba(31,31,31,0.3)" fill="none" stroke-width="1.5"/>`);
})();

const miesBg = svg(`<defs><pattern id="pk-g" width="48" height="96" patternUnits="userSpaceOnUse"><path d="M48 0H0V96" fill="none" stroke="rgba(17,17,17,0.09)" stroke-width="1"/></pattern></defs>
  <rect width="390" height="844" fill="url(#pk-g)"/><rect x="0" y="610" width="390" height="234" fill="rgba(184,155,110,0.18)"/>
  <rect x="286" y="0" width="6" height="844" fill="rgba(17,17,17,0.55)"/><rect x="0" y="606" width="390" height="4" fill="rgba(17,17,17,0.4)"/>`);

const zahaBg = (() => {
  const paths = Array.from({ length: 22 }, (_, i) => {
    const y = 40 + i * 36;
    return `<path d="M-30 ${y} C 110 ${y - 140}, 250 ${y + 170}, 430 ${y - 60}" stroke="rgba(201,214,232,${(0.05 + (i % 5) * 0.025).toFixed(3)})" stroke-width="${i % 4 === 0 ? 1.8 : 1}" fill="none"/>`;
  }).join('');
  return svg(`<g class="pk-flow">${paths}</g>`);
})();

const andoBg = (() => {
  let holes = '';
  for (let y = 0; y < 844; y += 70) for (let x = 0; x < 390; x += 130) {
    for (const [dx, dy] of [[20, 18], [65, 18], [110, 18], [20, 52], [65, 52], [110, 52]]) holes += `<circle cx="${x + dx}" cy="${y + dy}" r="2.4"/>`;
  }
  return svg(`<defs><linearGradient id="pk-light" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff6dc" stop-opacity="0.95"/><stop offset="1" stop-color="#fff6dc" stop-opacity="0.2"/></linearGradient>
    <filter id="pk-glow"><feGaussianBlur stdDeviation="6"/></filter><pattern id="pk-form" width="130" height="70" patternUnits="userSpaceOnUse"><path d="M130 0H0V70" fill="none" stroke="rgba(0,0,0,0.08)" stroke-width="1.2"/></pattern></defs>
    <rect width="390" height="844" fill="url(#pk-form)"/><g fill="rgba(0,0,0,0.13)">${holes}</g>
    <g class="pk-breathe" filter="url(#pk-glow)" fill="url(#pk-light)"><rect x="268" y="70" width="12" height="330"/><rect x="190" y="180" width="168" height="12"/></g>
    <g fill="#fffaf0"><rect x="271" y="70" width="6" height="330"/><rect x="190" y="183" width="168" height="6"/></g>`);
})();

const mondrianBg = svg(`<g opacity="0.62">
  <rect x="0" y="0" width="95" height="180" fill="#d6282c"/><rect x="250" y="420" width="140" height="180" fill="#f2c500"/>
  <rect x="0" y="600" width="95" height="160" fill="#1d4fa0"/><rect x="330" y="760" width="60" height="84" fill="#d6282c"/>
  <rect x="250" y="0" width="80" height="90" fill="#1d4fa0"/></g>
  <g fill="#111"><rect x="90" y="0" width="10" height="844"/><rect x="245" y="0" width="10" height="844"/><rect x="325" y="420" width="10" height="424"/>
  <rect x="0" y="175" width="390" height="10"/><rect x="0" y="415" width="390" height="10"/><rect x="0" y="595" width="390" height="10"/>
  <rect x="245" y="755" width="145" height="10"/><rect x="0" y="755" width="100" height="10"/><rect x="250" y="88" width="80" height="6"/></g>`);

const hokusaiBg = (() => {
  const rows = Array.from({ length: 14 }, (_, r) => {
    const y = 120 + r * 52;
    let d = `M-30 ${y}`;
    for (let x = -30; x < 420; x += 60) d += ` q 15 -${18 + (r % 3) * 6} 30 0 t 30 0`;
    return `<path d="${d}" stroke="rgba(27,58,107,${(0.1 + (r % 4) * 0.04).toFixed(2)})" stroke-width="${r % 3 === 0 ? 2.2 : 1.4}" fill="none"/>`;
  }).join('');
  const crest = '<path d="M-20 760 C 60 640, 170 600, 230 650 C 200 640, 170 660, 175 690 C 185 720, 230 715, 236 690 C 270 760, 180 820, 80 844 L -20 844 Z" fill="rgba(27,58,107,0.22)"/>';
  return svg(`<circle cx="300" cy="150" r="46" fill="rgba(192,57,43,0.18)"/><g class="pk-drift">${rows}</g>${crest}`);
})();

const klimtBg = (() => {
  return svg(`<defs><pattern id="pk-gold" width="64" height="64" patternUnits="userSpaceOnUse">
      <circle cx="16" cy="16" r="11" fill="none" stroke="rgba(212,175,55,0.32)" stroke-width="1.5"/><circle cx="16" cy="16" r="4.5" fill="rgba(212,175,55,0.28)"/>
      <rect x="40" y="36" width="8" height="20" fill="rgba(212,175,55,0.2)"/><rect x="36" y="8" width="16" height="6" fill="rgba(212,175,55,0.14)"/>
      <path d="M44 44 m-6 0 a6 6 0 1 0 12 0 a3 3 0 1 0 -6 0" fill="none" stroke="rgba(212,175,55,0.22)"/></pattern>
    <radialGradient id="pk-glowk" cx="0.5" cy="0.35" r="0.7"><stop offset="0" stop-color="#3a2a10"/><stop offset="1" stop-color="#14100a"/></radialGradient></defs>
    <rect width="390" height="844" fill="url(#pk-glowk)"/><rect class="pk-drift" width="390" height="844" fill="url(#pk-gold)"/>`);
})();

const kusamaArt = (fill) => {
  let dots = '';
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < 70; i++) {
    const r = 6 + rnd() * 30;
    dots += `<circle class="${i % 6 === 0 ? 'pk-pulse' : ''}" cx="${(rnd() * 390).toFixed(1)}" cy="${(rnd() * 844).toFixed(1)}" r="${r.toFixed(1)}"/>`;
  }
  return svg(`<g fill="${fill}">${dots}</g>`);
};


// ---- architectural style backdrops
const gothicBg = (() => {
  const glass = ['#c9302c', '#1f4e8c', '#d9a531', '#2f7a4f', '#6b3fa0'];
  let petals = '';
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    petals += `<circle cx="${(195 + Math.cos(a) * 52).toFixed(1)}" cy="${(170 + Math.sin(a) * 52).toFixed(1)}" r="24" fill="${glass[i % 5]}" fill-opacity="0.3"/>`;
  }
  let lancets = '';
  [30, 147, 264].forEach((x, k) => {
    const w = 96;
    const arch = `M${x} 844 V430 C${x} 370 ${x + w * 0.3} 330 ${x + w / 2} 300 C${x + w * 0.7} 330 ${x + w} 370 ${x + w} 430 V844 Z`;
    let panes = '';
    for (let y = 300, r = 0; y < 844; y += 62, r++) {
      panes += `<rect x="${x}" y="${y}" width="${w / 2}" height="62" fill="${glass[(r + k) % 5]}" fill-opacity="0.16"/><rect x="${x + w / 2}" y="${y}" width="${w / 2}" height="62" fill="${glass[(r + k + 2) % 5]}" fill-opacity="0.16"/>`;
    }
    lancets += `<clipPath id="pk-l${k}"><path d="${arch}"/></clipPath><g clip-path="url(#pk-l${k})">${panes}</g><path d="${arch}" fill="none" stroke="rgba(255,255,255,0.16)" stroke-width="3"/>`;
  });
  return svg(`<g class="pk-breathe">${petals}<circle cx="195" cy="170" r="86" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="3"/><circle cx="195" cy="170" r="20" fill="#d9a531" fill-opacity="0.4"/></g>${lancets}`);
})();

const decoBg = (() => {
  let rays = '';
  for (let i = 0; i <= 18; i++) {
    const a = Math.PI + (i / 18) * Math.PI;
    rays += `<line x1="195" y1="844" x2="${(195 + Math.cos(a) * 700).toFixed(1)}" y2="${(844 + Math.sin(a) * 700).toFixed(1)}"/>`;
  }
  let arcs = '';
  for (let r = 90; r <= 330; r += 60) arcs += `<path d="M${195 - r} 844 A${r} ${r} 0 0 1 ${195 + r} 844"/>`;
  const chevrons = Array.from({ length: 5 }, (_, i) => `<path d="M0 ${60 + i * 22} L195 ${10 + i * 22} L390 ${60 + i * 22}"/>`).join('');
  return svg(`<g stroke="rgba(217,178,90,0.2)" stroke-width="1.2" fill="none">${rays}${chevrons}</g>
    <g stroke="rgba(231,163,168,0.26)" stroke-width="2" fill="none" class="pk-breathe">${arcs}</g>
    <path d="M150 844 V700 h14 V660 h14 V620 h34 V660 h14 V700 h14 V844 Z" fill="rgba(217,178,90,0.12)"/>`);
})();

const bauhausBg = svg(`<g opacity="0.55"><circle class="pk-drift" cx="300" cy="170" r="120" fill="#1f4fa0"/>
  <polygon points="10,820 170,520 330,820" fill="#c8321e"/><rect x="30" y="300" width="130" height="130" fill="#f0b400"/></g>
  <g stroke="#151515" stroke-width="6" opacity="0.6"><line x1="0" y1="470" x2="390" y2="470"/><line x1="230" y1="0" x2="230" y2="470"/></g>
  <circle cx="95" cy="365" r="8" fill="#151515" opacity="0.6"/>`);

const brutalBg = (() => {
  let board = '';
  for (let y = 0; y < 844; y += 14) board += `<line x1="0" y1="${y}" x2="390" y2="${y}"/>`;
  let win = '';
  for (let y = 120; y < 760; y += 70) for (let x = 214; x < 380; x += 56) win += `<rect x="${x}" y="${y}" width="34" height="34"/>`;
  return svg(`<g stroke="rgba(0,0,0,0.05)">${board}</g>
    <g fill="rgba(0,0,0,0.1)"><rect x="-10" y="80" width="200" height="300"/><rect x="40" y="380" width="240" height="180"/><rect x="190" y="90" width="210" height="700"/><rect x="-10" y="560" width="160" height="300"/></g>
    <g fill="rgba(0,0,0,0.18)">${win}</g><rect x="0" y="560" width="390" height="5" fill="rgba(255,90,31,0.55)"/>`);
})();

const neoBg = (() => {
  let cols = '';
  for (let i = 0; i < 6; i++) {
    const x = 22 + i * 64;
    cols += `<rect x="${x}" y="300" width="28" height="470" fill="rgba(40,48,68,0.05)"/>`;
    for (let f = 1; f < 4; f++) cols += `<line x1="${x + f * 7}" y1="306" x2="${x + f * 7}" y2="764"/>`;
    cols += `<rect x="${x - 6}" y="288" width="40" height="12" fill="rgba(40,48,68,0.1)"/><rect x="${x - 6}" y="770" width="40" height="12" fill="rgba(40,48,68,0.1)"/>`;
  }
  const veins = Array.from({ length: 6 }, (_, i) => `<path d="M-20 ${90 + i * 140} C 90 ${40 + i * 140}, 200 ${170 + i * 140}, 410 ${80 + i * 140}"/>`).join('');
  return svg(`<g stroke="rgba(120,110,95,0.09)" fill="none" stroke-width="1.5" class="pk-drift">${veins}</g>
    <polygon points="0,270 195,150 390,270" fill="none" stroke="rgba(40,48,68,0.18)" stroke-width="3"/>
    <rect x="0" y="270" width="390" height="18" fill="rgba(40,48,68,0.1)"/><g stroke="rgba(40,48,68,0.12)">${cols}</g>`);
})();

const rococoBg = (() => {
  const scroll = (x, y, k) => `<path d="M${x} ${y} c ${20 * k} -40, ${70 * k} -40, ${70 * k} 0 s ${-40 * k} 40, ${-20 * k} 10 c ${10 * k} -10, ${30 * k} -5, ${25 * k} 10"/>`;
  const scrolls = [[30, 120, 1], [300, 90, -1], [60, 520, 1], [330, 640, -1], [180, 330, 1], [150, 780, -1]].map((a) => scroll(...a)).join('');
  return svg(`<g><ellipse class="pk-drift" cx="300" cy="260" rx="110" ry="150" fill="#f4c6d0" fill-opacity="0.4"/>
    <ellipse cx="80" cy="640" rx="120" ry="90" fill="#a8d5c8" fill-opacity="0.36"/><ellipse cx="120" cy="140" rx="80" ry="60" fill="#bcd6ee" fill-opacity="0.4"/></g>
    <g stroke="rgba(185,151,91,0.42)" stroke-width="2" fill="none" class="pk-drift">${scrolls}</g>`);
})();

const islamicBg = svg(`<defs><pattern id="pk-girih" width="80" height="80" patternUnits="userSpaceOnUse">
  <g fill="none" stroke="rgba(15,59,74,0.18)" stroke-width="1.4">
  <rect x="20" y="20" width="40" height="40"/><rect x="20" y="20" width="40" height="40" transform="rotate(45 40 40)"/>
  <circle cx="40" cy="40" r="8"/><path d="M0 0 L20 20 M80 0 L60 20 M0 80 L20 60 M80 80 L60 60"/></g>
  <polygon points="40,26 44,36 54,40 44,44 40,54 36,44 26,40 36,36" fill="rgba(58,167,181,0.16)"/></pattern></defs>
  <rect width="390" height="844" fill="url(#pk-girih)"/>
  <path d="M95 844 V380 Q95 250 195 210 Q295 250 295 380 V844" fill="rgba(184,134,47,0.08)" stroke="rgba(184,134,47,0.32)" stroke-width="3"/>`);

const indoBg = (() => {
  const dome = (cx, base, w, h) => `<path d="M${cx - w / 2} ${base} C ${cx - w / 2} ${base - h * 0.7}, ${cx - w * 0.15} ${base - h * 0.8}, ${cx} ${base - h} C ${cx + w * 0.15} ${base - h * 0.8}, ${cx + w / 2} ${base - h * 0.7}, ${cx + w / 2} ${base} Z" fill="rgba(255,250,242,0.85)" stroke="rgba(138,58,34,0.35)" stroke-width="2"/><line x1="${cx}" y1="${base - h}" x2="${cx}" y2="${base - h - 18}" stroke="rgba(138,58,34,0.45)" stroke-width="2"/>`;
  let arches = '';
  for (let i = 0; i < 5; i++) { const x = 20 + i * 72; arches += `<path d="M${x} 844 V700 Q${x} 650 ${x + 26} 636 Q${x + 52} 650 ${x + 52} 700 V844" fill="rgba(43,23,16,0.1)"/>`; }
  return svg(`<defs><pattern id="pk-jali" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M12 0 L24 12 L12 24 L0 12 Z" fill="none" stroke="rgba(138,58,34,0.13)"/><circle cx="12" cy="12" r="3" fill="rgba(138,58,34,0.09)"/></pattern></defs>
    <rect width="390" height="844" fill="url(#pk-jali)"/>
    <g opacity="0.6">${dome(195, 560, 190, 190)}${dome(60, 600, 70, 80)}${dome(330, 600, 70, 80)}
    <rect x="70" y="560" width="250" height="284" fill="rgba(138,58,34,0.3)"/><rect x="20" y="600" width="80" height="244" fill="rgba(138,58,34,0.26)"/><rect x="290" y="600" width="80" height="244" fill="rgba(138,58,34,0.26)"/></g>
    ${arches}<circle class="pk-breathe" cx="320" cy="140" r="34" fill="rgba(231,176,74,0.32)"/>`);
})();

const vangoghLightBg = (() => {
  let sw = '';
  for (let i = 0; i < 9; i++) { const y = 60 + i * 46; sw += `<path d="M-20 ${y} C 80 ${y - 30}, 140 ${y + 40}, 220 ${y} S 360 ${y - 30}, 420 ${y + 10}"/>`; }
  return svg(`<g class="pk-flow" stroke="rgba(47,90,168,0.15)" stroke-width="3" fill="none" stroke-linecap="round">${sw}</g>
    <g fill="none" stroke="rgba(47,90,168,0.2)" stroke-width="2.5"><circle cx="120" cy="190" r="34"/><circle cx="120" cy="190" r="20"/></g>
    <circle cx="310" cy="110" r="30" fill="rgba(244,208,63,0.45)"/><circle class="pk-breathe" cx="310" cy="110" r="46" fill="none" stroke="rgba(244,208,63,0.35)" stroke-width="4"/>
    <path d="M0 700 C 120 660, 260 700, 390 670 V844 H0 Z" fill="rgba(27,42,110,0.07)"/>`);
})();

// ---- fandom backdrops: original motifs only (no logos, emblems or character art)
const spiral = (cx, cy, turns, step, colour, w) => {
  let d = '';
  for (let i = 0; i <= turns * 60; i++) {
    const a = (i / 60) * 2 * Math.PI;
    const r = (step * a) / (2 * Math.PI);
    d += `${i ? 'L' : 'M'}${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)}`;
  }
  return `<path d="${d}" fill="none" stroke="${colour}" stroke-width="${w}" stroke-linecap="round"/>`;
};
const narutoBg = svg(`<g class="pk-drift">${spiral(290, 190, 4, 26, 'rgba(255,122,26,0.3)', 7)}</g>${spiral(70, 690, 3, 20, 'rgba(34,81,163,0.16)', 5)}
  <g stroke="rgba(255,122,26,0.2)" stroke-width="3" stroke-linecap="round"><line x1="20" y1="420" x2="150" y2="400"/><line x1="40" y1="450" x2="200" y2="428"/><line x1="10" y1="480" x2="120" y2="466"/></g>`);

const bolt = (x, y, len, seed) => {
  let s = seed;
  const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const pts = [[x, y]];
  for (let i = 0; i < 8; i++) { const [px, py] = pts[pts.length - 1]; pts.push([px + (r() - 0.5) * 54, py + len / 8]); }
  return pts.map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' ');
};
const sasukeArt = (glow, core) => svg(`<g fill="none" stroke-linejoin="round" stroke-linecap="round" class="pk-breathe">${[[290, 0, 380, 3], [90, 300, 320, 11], [330, 500, 300, 19]]
  .map(([x, y, l, s]) => `<polyline points="${bolt(x, y, l, s)}" stroke="${glow}" stroke-width="10"/><polyline points="${bolt(x, y, l, s)}" stroke="${core}" stroke-width="2.2"/>`).join('')}</g>`);

const kakashiBg = (() => {
  let bands = '';
  for (let i = 0; i < 6; i++) {
    const y = 140 + i * 120;
    bands += `<path d="M-20 ${y} C 90 ${y - 30}, 200 ${y + 30}, 410 ${y - 10} V ${y + 40} C 200 ${y + 70}, 90 ${y + 10}, -20 ${y + 40} Z" fill="rgba(195,204,210,${(0.05 + (i % 3) * 0.025).toFixed(3)})"/>`;
  }
  const leaves = [[80, 120, 30], [300, 260, -20], [200, 520, 50], [60, 640, 10], [330, 720, -40]]
    .map(([x, y, a]) => `<path d="M0 -10 C 7 -4, 7 4, 0 10 C -7 4, -7 -4, 0 -10 Z" transform="translate(${x} ${y}) rotate(${a})" fill="rgba(63,111,120,0.4)"/>`).join('');
  return svg(`<g class="pk-flow">${bands}</g><g class="pk-drift">${leaves}</g>`);
})();

const itachiArt = (moon, crow, line) => {
  const crows = [[230, 150, 1], [290, 210, 0.8], [200, 240, 0.7], [320, 120, 0.6], [150, 330, 0.9], [90, 420, 0.6]]
    .map(([x, y, s]) => `<path d="M${x} ${y} q ${9 * s} ${-8 * s} ${18 * s} 0 q ${9 * s} ${-8 * s} ${18 * s} 0" fill="none" stroke="${crow}" stroke-width="${(3 * s).toFixed(1)}" stroke-linecap="round" stroke-linejoin="round"/>`).join('');
  return svg(`<circle class="pk-breathe" cx="270" cy="190" r="110" fill="${moon}"/><g class="pk-drift">${crows}</g><line x1="0" y1="700" x2="390" y2="700" stroke="${line}" stroke-width="1.5"/>`);
};

const hinataArt = (ring) => {
  let rings = '';
  for (let i = 0; i < 7; i++) rings += `<circle cx="195" cy="300" r="${40 + i * 34}" fill="none" stroke="${ring}" stroke-width="${i % 2 ? 1.5 : 3}"/>`;
  for (let i = 0; i < 4; i++) rings += `<circle cx="60" cy="700" r="${30 + i * 28}" fill="none" stroke="${ring}" stroke-width="1.5"/>`;
  return svg(`<g class="pk-breathe">${rings}</g>`);
};

const gaaraBg = (() => {
  const dunes = [[560, 0.18], [640, 0.24], [720, 0.3]].map(([y, a], i) =>
    `<path d="M-20 ${y} C 80 ${y - 60 + i * 10}, 200 ${y + 30}, 410 ${y - 50} V 844 H -20 Z" fill="rgba(217,163,92,${a})"/>`).join('');
  let grains = '';
  let s = 5;
  const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < 60; i++) grains += `<circle cx="${(r() * 390).toFixed(1)}" cy="${(r() * 520).toFixed(1)}" r="${(1 + r() * 2).toFixed(1)}"/>`;
  return svg(`<g class="pk-drift" fill="rgba(107,42,30,0.22)">${grains}</g>${dunes}`);
})();

/** Racing livery: diagonal stripes, carbon weave, a chequered corner and speed lines — colours per team. */
const liveryArt = ([a, b, c], mode) => {
  const ink = mode === 'dark' ? '255,255,255' : '0,0,0';
  let cheq = '';
  for (let y = 0; y < 3; y++) for (let x = 0; x < 6; x++) if ((x + y) % 2 === 0) cheq += `<rect x="${300 + x * 12}" y="${36 + y * 12}" width="12" height="12"/>`;
  const band = (y0, w, colour) => `<polygon points="-20,${y0} 410,${y0 - 300} 410,${y0 - 300 + w} -20,${y0 + w}" fill="${colour}"/>`;
  return svg(`<defs><pattern id="pk-carbon" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="4" height="4" fill="rgba(${ink},0.035)"/><rect x="4" y="4" width="4" height="4" fill="rgba(${ink},0.035)"/></pattern></defs>
    <rect width="390" height="844" fill="url(#pk-carbon)"/>
    <g opacity="${mode === 'dark' ? 0.55 : 0.5}">${band(760, 46, a)}${band(818, 16, b)}${band(846, 8, c)}</g>
    <g fill="rgba(${ink},0.28)">${cheq}</g>
    <g class="pk-flow" stroke="rgba(${ink},0.12)" stroke-width="2" stroke-linecap="round"><line x1="210" y1="220" x2="380" y2="220"/><line x1="250" y1="240" x2="380" y2="240"/><line x1="180" y1="260" x2="380" y2="260"/></g>`);
};
const livery = (colours) => ({ light: liveryArt(colours, 'light'), dark: liveryArt(colours, 'dark') });
const RACE_FONT = '"Avenir Next Condensed", "DIN Condensed", "Helvetica Neue", Arial, sans-serif';

/** Forty-Four: a big outlined 44, seven stars for seven titles, black livery with red and gold pinstripes. */
const hamiltonArt = (mode) => {
  const ink = mode === 'dark' ? '255,255,255' : '0,0,0';
  const star = (cx, cy, r) => {
    const pts = Array.from({ length: 10 }, (_, i) => {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 ? r * 0.45 : r;
      return `${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)}`;
    });
    return `<polygon points="${pts.join(' ')}"/>`;
  };
  const stars = Array.from({ length: 7 }, (_, i) => star(48 + i * 28, 70, 8)).join('');
  const band = (y0, w, colour) => `<polygon points="-20,${y0} 410,${y0 - 300} 410,${y0 - 300 + w} -20,${y0 + w}" fill="${colour}"/>`;
  return svg(`<defs><pattern id="pk-carbon44" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="4" height="4" fill="rgba(${ink},0.035)"/><rect x="4" y="4" width="4" height="4" fill="rgba(${ink},0.035)"/></pattern></defs>
    <rect width="390" height="844" fill="url(#pk-carbon44)"/>
    <text x="400" y="640" text-anchor="end" font-family="${RACE_FONT.replace(/"/g, "'")}" font-weight="800" font-size="300" font-style="italic" letter-spacing="-12"
      fill="none" stroke="rgba(${mode === 'dark' ? '224,180,58' : '18,18,18'},${mode === 'dark' ? 0.22 : 0.12})" stroke-width="3">44</text>
    <g fill="rgba(${mode === 'dark' ? '224,180,58' : '212,167,44'},${mode === 'dark' ? 0.7 : 0.8})" class="pk-breathe">${stars}</g>
    <g opacity="${mode === 'dark' ? 0.6 : 0.5}">${band(790, 40, mode === 'dark' ? '#2a2a2a' : '#121212')}${band(838, 10, '#c8102e')}${band(856, 5, '#d4a72c')}</g>`);
};

// ---- packs. `native` is the mode the backdrop was drawn for; in the other mode it is shown tonally
// inverted (hue kept) unless the pack gives that mode its own art.
export const THEMES = [
  {
    id: 'studio', group: 'Studio', name: 'Studio', by: 'The default look', note: 'Navy, lime and mint. Pick Shapes or Starry Night below.',
    swatch: ['#1a1b41', '#baff29', '#6290c3', '#c2e7da', '#f1ffe7'],
  },
  // ---------------- Architects
  {
    id: 'barragan', group: 'Architects', name: 'Casa Color', by: 'after Luis Barragán', note: 'Sun-washed walls in pink, ochre and cobalt.',
    native: 'light', art: { base: barraganBg }, radius: 18, swatch: ['#e5448a', '#f1b24a', '#2c5aa0', '#d9653b', '#f6e3d3'],
    light: { bg: '#f6e3d3', ink: '#2a1f1d', muted: '#7a5a4e', panel: '#b8326c', onPanel: '#fff3ea', accent: '#f1b24a', onAccent: '#2a1f1d', second: '#2c5aa0', onSecond: '#fff3ea', soft: '#f9d6c4', red: '#c0392b' },
    dark: { bg: '#1f1418', ink: '#fbeee6', muted: '#c3a59a', panel: '#2b1c22', panelHi: '#4a2a38', onPanel: '#fbeee6', accent: '#f1b24a', onAccent: '#2a1f1d', second: '#4f7fd0', onSecond: '#ffffff', soft: '#3a2530', red: '#ff6b5a' },
  },
  {
    id: 'corbusier', group: 'Architects', name: 'Polychromie', by: 'after Le Corbusier', note: 'Ochre, ultramarine and sienna on a Modulor grid.',
    native: 'light', art: { base: corbusierBg }, radius: 6, font: '"Avenir Next", "Futura", -apple-system, system-ui, sans-serif', swatch: ['#2f4b9a', '#d6a13c', '#a3482f', '#a9c3a0', '#efe9dc'],
    light: { bg: '#efe9dc', ink: '#1f1f1f', muted: '#6b665c', panel: '#2f4b9a', onPanel: '#f7f3ea', accent: '#d6a13c', onAccent: '#1f1f1f', second: '#a3482f', onSecond: '#f7f3ea', soft: '#dfe8d8', red: '#b8322a' },
    dark: { bg: '#121a33', ink: '#f2ede2', muted: '#a9adbf', panel: '#1a2446', panelHi: '#2f4b9a', onPanel: '#f2ede2', accent: '#d6a13c', onAccent: '#1f1f1f', second: '#c0634a', onSecond: '#1f1f1f', soft: '#1f2a40', red: '#ff6a55' },
  },
  {
    id: 'mies', group: 'Architects', name: 'Less Is More', by: 'after Mies van der Rohe', note: 'Black steel, travertine and a curtain-wall grid.',
    native: 'light', art: { base: miesBg }, radius: 3, font: '"Helvetica Neue", Helvetica, Arial, sans-serif', swatch: ['#111111', '#b89b6e', '#3e5a4a', '#e6e1d8', '#f4f2ee'],
    light: { bg: '#f4f2ee', ink: '#111111', muted: '#6d6a65', panel: '#111111', onPanel: '#f4f2ee', accent: '#c9ad7f', onAccent: '#111111', second: '#3e5a4a', onSecond: '#f4f2ee', soft: '#e6e1d8', red: '#9e2b25', glass: 0.72 },
    dark: { bg: '#0e0e0e', ink: '#f1eee8', muted: '#9a958c', panel: '#1a1a1a', panelHi: '#333333', onPanel: '#f1eee8', accent: '#c9ad7f', onAccent: '#111111', second: '#5b7f6a', onSecond: '#ffffff', soft: '#24221f', red: '#e0574d', glass: 0.7 },
  },
  {
    id: 'zaha', group: 'Architects', name: 'Parametric', by: 'after Zaha Hadid', note: 'Fluid lines in silver and graphite.',
    native: 'dark', art: { base: zahaBg }, radius: 34, swatch: ['#0b0c10', '#c9d6e8', '#3a4256', '#1c2130', '#ff4f5e'],
    light: { bg: '#eef1f5', ink: '#14161d', muted: '#5d6575', panel: '#1b1e27', onPanel: '#eef1f5', accent: '#9fb3cf', onAccent: '#0b0c10', second: '#3a4256', onSecond: '#eef1f5', soft: '#dfe5ee', red: '#d6303f' },
    dark: { bg: '#0b0c10', ink: '#eef1f5', muted: '#8d96a6', panel: '#15171f', panelHi: '#2a2f3d', onPanel: '#eef1f5', accent: '#c9d6e8', onAccent: '#0b0c10', second: '#3a4256', onSecond: '#eef1f5', soft: '#1c2130', red: '#ff4f5e' },
  },
  {
    id: 'ando', group: 'Architects', name: 'Concrete & Light', by: 'after Tadao Ando', note: 'Formwork concrete, tie holes and a cross of light.',
    native: 'light', art: { base: andoBg }, radius: 10, swatch: ['#3c3b38', '#f5e6c4', '#6f7d6b', '#dcdad5', '#c9c7c2'],
    light: { bg: '#c9c7c2', ink: '#1d1d1b', muted: '#56544f', panel: '#3c3b38', onPanel: '#f1efea', accent: '#f5e6c4', onAccent: '#1d1d1b', second: '#6f7d6b', onSecond: '#f1efea', soft: '#dcdad5', red: '#a63d2f', glass: 0.66 },
    dark: { bg: '#22221f', ink: '#ecebe6', muted: '#9d9a92', panel: '#2d2c29', panelHi: '#45433e', onPanel: '#ecebe6', accent: '#f5e6c4', onAccent: '#1d1d1b', second: '#7f8f7a', onSecond: '#111111', soft: '#34332f', red: '#e06a55' },
  },
  // ---------------- Architectural styles
  {
    id: 'gothic', group: 'Styles', name: 'Stained Glass', by: 'Gothic, 12th–16th c.', note: 'Limestone, lead lines and jewel-coloured glass under pointed arches.',
    native: 'dark', art: { base: gothicBg }, radius: 14, font: '"Iowan Old Style", "Palatino", Georgia, serif', swatch: ['#1c1726', '#c9302c', '#1f4e8c', '#d9a531', '#ece6da'],
    light: { bg: '#ece6da', ink: '#1e1a24', muted: '#635b6b', panel: '#2a2238', onPanel: '#f3eee4', accent: '#c9302c', onAccent: '#ffffff', second: '#1f4e8c', onSecond: '#ffffff', soft: '#e2dbe8', red: '#b3261e' },
    dark: { bg: '#120f18', ink: '#f1ecf6', muted: '#a39cb0', panel: '#1c1726', panelHi: '#352a4a', onPanel: '#f1ecf6', accent: '#e0443d', onAccent: '#ffffff', second: '#3f74c2', onSecond: '#ffffff', soft: '#221c2e', red: '#ff5a4f', glass: 0.7 },
  },
  {
    id: 'deco', group: 'Styles', name: 'Jazz Age', by: 'Art Deco, 1920s–30s', note: 'Gold sunbursts, stepped spires, emerald and blush.',
    native: 'dark', art: { base: decoBg }, radius: 4, font: '"Avenir Next Condensed", "Futura", "Gill Sans", sans-serif', swatch: ['#15201c', '#d9b25a', '#e7a3a8', '#24423a', '#f5ece0'],
    light: { bg: '#f5ece0', ink: '#14201c', muted: '#5f6a64', panel: '#14332b', onPanel: '#f4ead2', accent: '#c99a3c', onAccent: '#14100a', second: '#d98b93', onSecond: '#1a1013', soft: '#f2dfe0', red: '#b8322e' },
    dark: { bg: '#0e1513', ink: '#f4ead2', muted: '#a9a48e', panel: '#15201c', panelHi: '#24423a', onPanel: '#f4ead2', accent: '#d9b25a', onAccent: '#14100a', second: '#e7a3a8', onSecond: '#1a1013', soft: '#1b2a25', red: '#ff6b6b', glass: 0.66 },
  },
  {
    id: 'bauhaus', group: 'Styles', name: 'Bauhaus', by: 'Bauhaus, 1919–1933', note: 'Circle, triangle, square, primary colours and Futura.',
    native: 'light', art: { base: bauhausBg }, radius: 8, font: '"Futura", "Avenir Next", "Century Gothic", sans-serif', swatch: ['#151515', '#f0b400', '#c8321e', '#1f4fa0', '#f2efe6'],
    light: { bg: '#f2efe6', ink: '#151515', muted: '#5c5a55', panel: '#151515', onPanel: '#f2efe6', accent: '#f0b400', onAccent: '#151515', second: '#c8321e', onSecond: '#ffffff', soft: '#e4e0d4', red: '#c8321e', glass: 0.74 },
    dark: { bg: '#121212', ink: '#f2efe6', muted: '#9b978e', panel: '#1d1d1d', panelHi: '#353535', onPanel: '#f2efe6', accent: '#f0b400', onAccent: '#151515', second: '#e2513a', onSecond: '#111111', soft: '#242424', red: '#ff5a40', glass: 0.72 },
  },
  {
    id: 'brutalist', group: 'Styles', name: 'Raw Concrete', by: 'Brutalist, 1950s–70s', note: 'Board-formed concrete, deep modular blocks, one hot accent.',
    native: 'light', art: { base: brutalBg }, radius: 0, font: '"Helvetica Neue", Arial, sans-serif', swatch: ['#2e2e2c', '#ff5a1f', '#4a4f55', '#d2cfc9', '#bfbcb6'],
    light: { bg: '#bfbcb6', ink: '#121212', muted: '#4a4844', panel: '#2e2e2c', onPanel: '#ecebe7', accent: '#ff5a1f', onAccent: '#121212', second: '#4a4f55', onSecond: '#ecebe7', soft: '#d2cfc9', red: '#b02a14', glass: 0.7 },
    dark: { bg: '#1a1a19', ink: '#e9e7e2', muted: '#9b9892', panel: '#262624', panelHi: '#3a3a37', onPanel: '#e9e7e2', accent: '#ff6a2f', onAccent: '#121212', second: '#5c6268', onSecond: '#ffffff', soft: '#2a2a28', red: '#ff5a40', glass: 0.72 },
  },
  {
    id: 'neoclassical', group: 'Styles', name: 'Marble & Column', by: 'Neoclassical, 1750–1850', note: 'White marble, fluted columns, gilt and slate.',
    native: 'light', art: { base: neoBg }, radius: 6, font: '"Baskerville", "Libre Baskerville", "Times New Roman", serif', swatch: ['#283044', '#b9975b', '#7d8a7a', '#e9e5dc', '#f4f1ea'],
    light: { bg: '#f4f1ea', ink: '#1d1f24', muted: '#666a72', panel: '#283044', onPanel: '#f4f1ea', accent: '#b9975b', onAccent: '#1d1f24', second: '#7d8a7a', onSecond: '#111111', soft: '#e9e5dc', red: '#9e3a2f' },
    dark: { bg: '#15171c', ink: '#f1eee6', muted: '#a19e96', panel: '#1f232c', panelHi: '#353c4d', onPanel: '#f1eee6', accent: '#c9a86b', onAccent: '#1d1f24', second: '#8e9c8b', onSecond: '#111111', soft: '#23262d', red: '#e0705f' },
  },
  {
    id: 'rococo', group: 'Styles', name: 'Pastel Salon', by: 'Rococo, 18th c.', note: 'Whitened pastels, gilded scrolls and soft curves.',
    native: 'light', art: { base: rococoBg }, radius: 28, font: '"Hoefler Text", "Bodoni 72 Oldstyle", Georgia, serif', swatch: ['#5a4a6a', '#f4c6d0', '#a8d5c8', '#bcd6ee', '#fbf3f1'],
    light: { bg: '#fbf3f1', ink: '#3a2a33', muted: '#85707a', panel: '#5a4a6a', onPanel: '#fff7f5', accent: '#f4c6d0', onAccent: '#3a2a33', second: '#a8d5c8', onSecond: '#233a33', soft: '#eaf3f7', red: '#c4516a', glass: 0.6 },
    dark: { bg: '#1e1820', ink: '#fbeff2', muted: '#b9a3ad', panel: '#2a2130', panelHi: '#45354f', onPanel: '#fbeff2', accent: '#f4c6d0', onAccent: '#3a2a33', second: '#a8d5c8', onSecond: '#233a33', soft: '#2b2430', red: '#f07890' },
  },
  {
    id: 'islamic', group: 'Styles', name: 'Girih Tiles', by: 'Islamic, from the 7th c.', note: 'Eight-point star tiling, lapis, turquoise and gold.',
    native: 'light', art: { base: islamicBg }, radius: 12, font: '"Optima", "Gill Sans", -apple-system, system-ui, sans-serif', swatch: ['#0f3b4a', '#3aa7b5', '#b8862f', '#e3ecea', '#f3ede0'],
    light: { bg: '#f3ede0', ink: '#14232b', muted: '#5a6670', panel: '#0f3b4a', onPanel: '#f3ede0', accent: '#3aa7b5', onAccent: '#0b1d23', second: '#b8862f', onSecond: '#14100a', soft: '#e3ecea', red: '#b23a2c' },
    dark: { bg: '#0b1a20', ink: '#f1ebdc', muted: '#93a5ab', panel: '#10262e', panelHi: '#1d4552', onPanel: '#f1ebdc', accent: '#4cc0cd', onAccent: '#0b1d23', second: '#d3a24a', onSecond: '#14100a', soft: '#132a32', red: '#ff6e5c' },
  },
  {
    id: 'indosaracenic', group: 'Styles', name: 'Sandstone & Marble', by: 'Indo-Saracenic, 19th c.', note: 'Red sandstone, marble domes, jali screens and marigold.',
    native: 'light', art: { base: indoBg }, radius: 20, font: '"Palatino", "Book Antiqua", Georgia, serif', swatch: ['#8a3a22', '#e7b04a', '#2f6b5e', '#f0e2d2', '#f6eee4'],
    light: { bg: '#f6eee4', ink: '#2b1710', muted: '#7a5a4c', panel: '#8a3a22', onPanel: '#fff4ea', accent: '#e7b04a', onAccent: '#2b1710', second: '#2f6b5e', onSecond: '#ffffff', soft: '#f0e2d2', red: '#b8341f' },
    dark: { bg: '#1d100c', ink: '#fbefe4', muted: '#c0a090', panel: '#2a1712', panelHi: '#5a2a1a', onPanel: '#fbefe4', accent: '#f0b955', onAccent: '#2b1710', second: '#3f8a7a', onSecond: '#ffffff', soft: '#2c1a14', red: '#ff6a4f' },
  },
  // ---------------- Artists
  {
    id: 'vangogh', group: 'Artists', name: 'Starry Night', by: 'after Vincent van Gogh', note: 'A quiet swirling sky in cobalt and chrome yellow.',
    native: 'dark', art: { dark: 'starry', light: vangoghLightBg }, radius: 26, swatch: ['#0d1240', '#f4d03f', '#2f5aa8', '#1b2a5e', '#e2683c'],
    light: { bg: '#f3ecd6', ink: '#142057', muted: '#5a6390', panel: '#1b2a6e', onPanel: '#f8f3e2', accent: '#f4d03f', onAccent: '#142057', second: '#2f5aa8', onSecond: '#ffffff', soft: '#e3e6f0', red: '#c8502a' },
    dark: { bg: '#0d1240', ink: '#f3f6ff', muted: '#a3b0d6', panel: '#0f1748', panelHi: '#24307a', onPanel: '#f3f6ff', accent: '#f4d03f', onAccent: '#0d1240', second: '#2f5aa8', onSecond: '#f3f6ff', soft: '#1b2a5e', red: '#e2683c', glass: 0.72 },
  },
  {
    id: 'mondrian', group: 'Artists', name: 'De Stijl', by: 'after Piet Mondrian', note: 'Primary blocks, black lines, square corners.',
    native: 'light', art: { base: mondrianBg }, radius: 0, font: '"Helvetica Neue", Helvetica, Arial, sans-serif', swatch: ['#111111', '#f2c500', '#1d4fa0', '#d6282c', '#f7f5ef'],
    light: { bg: '#f7f5ef', ink: '#111111', muted: '#555555', panel: '#111111', onPanel: '#ffffff', accent: '#f2c500', onAccent: '#111111', second: '#1d4fa0', onSecond: '#ffffff', soft: '#ffffff', red: '#d6282c', glass: 0.82 },
    dark: { bg: '#0f0f0f', ink: '#f7f5ef', muted: '#a0a0a0', panel: '#1b1b1b', panelHi: '#333333', onPanel: '#ffffff', accent: '#f2c500', onAccent: '#111111', second: '#3d6fd0', onSecond: '#ffffff', soft: '#232323', red: '#ff4447', glass: 0.8 },
  },
  {
    id: 'hokusai', group: 'Artists', name: 'Great Wave', by: 'after Katsushika Hokusai', note: 'Prussian blue waves on washi paper.',
    native: 'light', art: { base: hokusaiBg }, radius: 14, font: '"Hiragino Mincho ProN", "Yu Mincho", "Songti SC", Georgia, serif', swatch: ['#1b3a6b', '#6fa3c8', '#2e5f8a', '#e3ecef', '#efe6d2'],
    light: { bg: '#efe6d2', ink: '#1b2a4a', muted: '#5f6b80', panel: '#1b3a6b', onPanel: '#f6efe0', accent: '#8dbbdb', onAccent: '#10213f', second: '#2e5f8a', onSecond: '#f6efe0', soft: '#e3ecef', red: '#c0392b' },
    dark: { bg: '#0d1a30', ink: '#f1ead9', muted: '#9aa7bd', panel: '#12233f', panelHi: '#1f3a66', onPanel: '#f1ead9', accent: '#8dbbdb', onAccent: '#10213f', second: '#3c76a8', onSecond: '#ffffff', soft: '#182a48', red: '#e2614f' },
  },
  {
    id: 'klimt', group: 'Artists', name: 'Gold Period', by: 'after Gustav Klimt', note: 'Gold leaf ornament on umber or cream.',
    native: 'dark', art: { base: klimtBg }, radius: 16, font: '"Didot", "Bodoni 72", "Playfair Display", Georgia, serif', swatch: ['#14100a', '#d4af37', '#6b5326', '#2a2214', '#c0392b'],
    light: { bg: '#f5ecd4', ink: '#2a1f0c', muted: '#7a6740', panel: '#3a2c12', onPanel: '#f6ead0', accent: '#c9a227', onAccent: '#1a1408', second: '#6b5326', onSecond: '#f6ead0', soft: '#efe2bf', red: '#b03224' },
    dark: { bg: '#14100a', ink: '#f6ead0', muted: '#b39f78', panel: '#1e170c', panelHi: '#3a2c12', onPanel: '#f6ead0', accent: '#d4af37', onAccent: '#1a1408', second: '#6b5326', onSecond: '#f6ead0', soft: '#2a2214', red: '#c0392b', glass: 0.62 },
  },
  {
    id: 'monet', group: 'Artists', name: 'Water Lilies', by: 'after Claude Monet', note: 'Soft lilac, sage and peach light.',
    native: 'light', art: { base: 'blobs' }, radius: 30, swatch: ['#4a5a7a', '#c8b6e2', '#8fb39a', '#f3c9b3', '#eef0f4'],
    light: { bg: '#eef0f4', ink: '#2f3a4a', muted: '#6f7888', panel: '#4a5a7a', onPanel: '#f6f7fb', accent: '#c8b6e2', onAccent: '#2f3a4a', second: '#8fb39a', onSecond: '#1f2a24', soft: '#e4efe6', red: '#c4515f', glass: 0.5, blobs: ['#c8b6e2', '#a8c8a9', '#f3c9b3'] },
    dark: { bg: '#1b2030', ink: '#eef0f6', muted: '#a3abbd', panel: '#252c40', panelHi: '#3a4560', onPanel: '#eef0f6', accent: '#c8b6e2', onAccent: '#2f3a4a', second: '#8fb39a', onSecond: '#1f2a24', soft: '#26303a', red: '#f07a88', glass: 0.55, blobs: ['#6c5a8f', '#4f7a5d', '#a86f5c'] },
  },
  {
    id: 'kusama', group: 'Artists', name: 'Infinity Dots', by: 'after Yayoi Kusama', note: 'Red polka dots that gently pulse.',
    native: 'light', art: { light: kusamaArt('rgba(224,38,47,0.55)'), dark: kusamaArt('rgba(255,59,68,0.4)') }, radius: 32, swatch: ['#111111', '#e0262f', '#f2c500', '#ffe9e9', '#fff8f6'],
    light: { bg: '#fff8f6', ink: '#1a1111', muted: '#6b5555', panel: '#111111', onPanel: '#ffffff', accent: '#e0262f', onAccent: '#ffffff', second: '#f2c500', onSecond: '#111111', soft: '#ffe9e9', red: '#e0262f', glass: 0.78 },
    dark: { bg: '#120808', ink: '#fff1ef', muted: '#c09a98', panel: '#1d0f0f', panelHi: '#3a1515', onPanel: '#fff1ef', accent: '#ff3b44', onAccent: '#ffffff', second: '#f2c500', onSecond: '#111111', soft: '#2a1414', red: '#ff3b44', glass: 0.74 },
  },
  // ---------------- Shinobi (inspired by Naruto): palettes and original motifs, no character art
  {
    id: 'naruto', group: 'Shinobi', name: 'Orange Spiral', by: 'inspired by Naruto Uzumaki', note: 'Bright orange, deep blue and a whirl of wind.',
    native: 'light', art: { base: narutoBg }, radius: 20, swatch: ['#1d1d22', '#ff7a1a', '#2251a3', '#ffe3c7', '#fff6ea'],
    light: { bg: '#fff6ea', ink: '#1d1a1a', muted: '#6e5f55', panel: '#1d1d22', onPanel: '#fff6ea', accent: '#ff7a1a', onAccent: '#1d1a1a', second: '#2251a3', onSecond: '#ffffff', soft: '#ffe3c7', red: '#c8321e' },
    dark: { bg: '#15120f', ink: '#fff1e2', muted: '#b8a38f', panel: '#201b17', panelHi: '#3a2a1c', onPanel: '#fff1e2', accent: '#ff8a2a', onAccent: '#1d1a1a', second: '#3f78d6', onSecond: '#ffffff', soft: '#2a2119', red: '#ff5a40' },
  },
  {
    id: 'sasuke', group: 'Shinobi', name: 'Indigo Lightning', by: 'inspired by Sasuke Uchiha', note: 'Indigo night with crackling violet lightning.',
    native: 'dark', art: { dark: sasukeArt('rgba(157,140,255,0.16)', 'rgba(214,206,255,0.55)'), light: sasukeArt('rgba(122,102,240,0.12)', 'rgba(58,47,122,0.45)') }, radius: 12,
    swatch: ['#0e0c1c', '#9d8cff', '#4a3aa8', '#1c1838', '#eeeaff'],
    light: { bg: '#f2f0fa', ink: '#17142c', muted: '#5f5a7e', panel: '#241f48', onPanel: '#f2f0fa', accent: '#7a66f0', onAccent: '#ffffff', second: '#3a2f7a', onSecond: '#ffffff', soft: '#e4e0f5', red: '#d6304f' },
    dark: { bg: '#0e0c1c', ink: '#eeeaff', muted: '#9d97c0', panel: '#17142c', panelHi: '#2e2758', onPanel: '#eeeaff', accent: '#9d8cff', onAccent: '#0e0c1c', second: '#4a3aa8', onSecond: '#ffffff', soft: '#1c1838', red: '#ff4f6d' },
  },
  {
    id: 'kakashi', group: 'Shinobi', name: 'Silver Mist', by: 'inspired by Kakashi Hatake', note: 'Drifting silver mist, slate blue and falling leaves.',
    native: 'dark', art: { base: kakashiBg }, radius: 14, swatch: ['#182026', '#c3ccd2', '#3f6f78', '#1c262d', '#eef1f2'],
    light: { bg: '#eef1f2', ink: '#141b20', muted: '#5c6a71', panel: '#1f2a31', onPanel: '#eef1f2', accent: '#8fa1ab', onAccent: '#0f1418', second: '#3f6f78', onSecond: '#ffffff', soft: '#dde3e6', red: '#b3362c' },
    dark: { bg: '#0f1418', ink: '#e9eef0', muted: '#93a1a8', panel: '#182026', panelHi: '#2b3942', onPanel: '#e9eef0', accent: '#c3ccd2', onAccent: '#0f1418', second: '#3f6f78', onSecond: '#ffffff', soft: '#1c262d', red: '#e0574d' },
  },
  {
    id: 'itachi', group: 'Shinobi', name: 'Crimson Moon', by: 'inspired by Itachi Uchiha', note: 'A red moon, black sky and a scatter of crows.',
    native: 'dark', art: { dark: itachiArt('rgba(224,41,58,0.34)', 'rgba(8,4,4,0.85)', 'rgba(244,236,236,0.12)'), light: itachiArt('rgba(196,30,46,0.2)', 'rgba(26,18,18,0.6)', 'rgba(26,18,18,0.15)') }, radius: 10,
    swatch: ['#0b0909', '#e0293a', '#5a1d24', '#1c1212', '#f4ecec'],
    light: { bg: '#f4efec', ink: '#1a1212', muted: '#6e5c5c', panel: '#1a1212', onPanel: '#f4efec', accent: '#c41e2e', onAccent: '#ffffff', second: '#5a1d24', onSecond: '#f4efec', soft: '#ead9d6', red: '#c41e2e' },
    dark: { bg: '#0b0909', ink: '#f4ecec', muted: '#a89a9a', panel: '#151010', panelHi: '#2e1616', onPanel: '#f4ecec', accent: '#e0293a', onAccent: '#ffffff', second: '#5a1d24', onSecond: '#f4ecec', soft: '#1c1212', red: '#ff4050', glass: 0.7 },
  },
  {
    id: 'hinata', group: 'Shinobi', name: 'Lavender Calm', by: 'inspired by Hinata Hyuga', note: 'Soft lavender, quiet navy and gentle ripples.',
    native: 'light', art: { light: hinataArt('rgba(91,79,154,0.16)'), dark: hinataArt('rgba(200,184,240,0.18)') }, radius: 24,
    swatch: ['#2c2650', '#c8b8f0', '#5b4f9a', '#ebe6f7', '#f5f2fb'],
    light: { bg: '#f5f2fb', ink: '#241f3a', muted: '#6d6688', panel: '#2c2650', onPanel: '#f5f2fb', accent: '#c8b8f0', onAccent: '#241f3a', second: '#5b4f9a', onSecond: '#ffffff', soft: '#ebe6f7', red: '#c84a6a' },
    dark: { bg: '#14111f', ink: '#f1edfb', muted: '#a69fc2', panel: '#1d192e', panelHi: '#352d55', onPanel: '#f1edfb', accent: '#c8b8f0', onAccent: '#241f3a', second: '#6e62b4', onSecond: '#ffffff', soft: '#221d36', red: '#f07892' },
  },
  {
    id: 'gaara', group: 'Shinobi', name: 'Desert Sand', by: 'inspired by Gaara', note: 'Sand dunes, terracotta and drifting grains.',
    native: 'light', art: { base: gaaraBg }, radius: 16, swatch: ['#6b2a1e', '#d9a35c', '#3d5a4a', '#ead6b8', '#f3e6d0'],
    light: { bg: '#f3e6d0', ink: '#2a1a12', muted: '#7a5d48', panel: '#6b2a1e', onPanel: '#fbf0e2', accent: '#d9a35c', onAccent: '#2a1a12', second: '#3d5a4a', onSecond: '#ffffff', soft: '#ead6b8', red: '#b8341f' },
    dark: { bg: '#1a120c', ink: '#f8ead6', muted: '#bfa184', panel: '#241810', panelHi: '#4a2a1a', onPanel: '#f8ead6', accent: '#e0ae6a', onAccent: '#2a1a12', second: '#4f7a62', onSecond: '#ffffff', soft: '#2a1d14', red: '#ff6a4f' },
  },
  // ---------------- Motorsport (inspired by F1): team and helmet colours on an original livery, no logos
  {
    id: 'ferrari', group: 'Motorsport', name: 'Rosso Corsa', by: 'inspired by Scuderia Ferrari', note: 'Racing red, a flash of yellow and carbon black.',
    native: 'light', art: livery(['#d40000', '#ffd700', '#1a1a1a']), radius: 8, font: RACE_FONT, swatch: ['#b30000', '#ffd700', '#1a1a1a', '#f3dcdc', '#f6f2ee'],
    light: { bg: '#f6f2ee', ink: '#1a1010', muted: '#6b5a5a', panel: '#b30000', onPanel: '#ffffff', accent: '#ffd700', onAccent: '#1a1010', second: '#1a1a1a', onSecond: '#ffffff', soft: '#f3dcdc', red: '#b30000' },
    dark: { bg: '#120808', ink: '#fbeeee', muted: '#b99a9a', panel: '#1d0e0e', panelHi: '#4a1010', onPanel: '#fbeeee', accent: '#ff3030', onAccent: '#ffffff', second: '#ffd700', onSecond: '#1a1010', soft: '#2a1414', red: '#ff3030' },
  },
  {
    id: 'mclaren', group: 'Motorsport', name: 'Papaya', by: 'inspired by McLaren', note: 'Papaya orange, anthracite and a cool blue edge.',
    native: 'light', art: livery(['#ff8000', '#47c7fc', '#26262b']), radius: 8, font: RACE_FONT, swatch: ['#26262b', '#ff8000', '#47c7fc', '#ffe6cf', '#f5f3f0'],
    light: { bg: '#f5f3f0', ink: '#1b1b1f', muted: '#63636b', panel: '#26262b', onPanel: '#f5f3f0', accent: '#ff8000', onAccent: '#1b1b1f', second: '#2aa7e0', onSecond: '#0b1a24', soft: '#ffe6cf', red: '#d63a2a' },
    dark: { bg: '#111114', ink: '#f3f2ef', muted: '#9c9ca6', panel: '#1c1c21', panelHi: '#33333b', onPanel: '#f3f2ef', accent: '#ff8a1a', onAccent: '#1b1b1f', second: '#47c7fc', onSecond: '#0b1a24', soft: '#24242a', red: '#ff5a40' },
  },
  {
    id: 'mercedes', group: 'Motorsport', name: 'Silver Arrow', by: 'inspired by Mercedes', note: 'Silver and black with a teal streak.',
    native: 'light', art: livery(['#00d2be', '#c0c8cd', '#121416']), radius: 8, font: RACE_FONT, swatch: ['#121416', '#00d2be', '#a7b0b6', '#e2e7ea', '#f1f3f4'],
    light: { bg: '#f1f3f4', ink: '#111416', muted: '#5d666c', panel: '#121416', onPanel: '#f1f3f4', accent: '#00b8a8', onAccent: '#06201d', second: '#a7b0b6', onSecond: '#111416', soft: '#e2e7ea', red: '#d0303c' },
    dark: { bg: '#0b0d0e', ink: '#eef2f3', muted: '#94a0a6', panel: '#15181a', panelHi: '#2c3236', onPanel: '#eef2f3', accent: '#00d2be', onAccent: '#06201d', second: '#8a959c', onSecond: '#0b0d0e', soft: '#1b1f22', red: '#ff4f5e' },
  },
  {
    id: 'redbull', group: 'Motorsport', name: 'Midnight Charge', by: 'inspired by Red Bull Racing', note: 'Midnight navy, red and a hit of yellow.',
    native: 'light', art: livery(['#e8002d', '#ffcc00', '#1e2a4f']), radius: 8, font: RACE_FONT, swatch: ['#1e2a4f', '#ffcc00', '#e8002d', '#e3e6f0', '#f2f3f7'],
    light: { bg: '#f2f3f7', ink: '#121a33', muted: '#5b6380', panel: '#1e2a4f', onPanel: '#f2f3f7', accent: '#ffcc00', onAccent: '#121a33', second: '#e8002d', onSecond: '#ffffff', soft: '#e3e6f0', red: '#e8002d' },
    dark: { bg: '#0b1022', ink: '#eef0f8', muted: '#9aa1bd', panel: '#121a33', panelHi: '#26355f', onPanel: '#eef0f8', accent: '#ffcc00', onAccent: '#121a33', second: '#ff2448', onSecond: '#ffffff', soft: '#18203d', red: '#ff2448' },
  },
  {
    id: 'aston', group: 'Motorsport', name: 'British Racing Green', by: 'inspired by Aston Martin', note: 'Deep racing green with a lime flash.',
    native: 'light', art: livery(['#00594f', '#cedc00', '#0b2b26']), radius: 8, font: RACE_FONT, swatch: ['#00594f', '#cedc00', '#0b2b26', '#dde9e1', '#eff3ef'],
    light: { bg: '#eff3ef', ink: '#0f1f1b', muted: '#566a63', panel: '#00594f', onPanel: '#f2f7f2', accent: '#cedc00', onAccent: '#0f1f1b', second: '#0b2b26', onSecond: '#eef5ef', soft: '#dde9e1', red: '#c8321e' },
    dark: { bg: '#07130f', ink: '#ecf4ef', muted: '#92a89f', panel: '#0d1f1a', panelHi: '#12483f', onPanel: '#ecf4ef', accent: '#cedc00', onAccent: '#0f1f1b', second: '#1c7a6c', onSecond: '#ffffff', soft: '#102a23', red: '#ff6a4f' },
  },
  {
    id: 'williams', group: 'Motorsport', name: 'Grove Blue', by: 'inspired by Williams', note: 'Navy and bright blue with a red pinstripe.',
    native: 'light', art: livery(['#00a0de', '#00205b', '#e4002b']), radius: 8, font: RACE_FONT, swatch: ['#00205b', '#00a0de', '#e4002b', '#dfeaf3', '#f1f5f9'],
    light: { bg: '#f1f5f9', ink: '#0b1a33', muted: '#56627a', panel: '#00205b', onPanel: '#f1f5f9', accent: '#00a0de', onAccent: '#04152b', second: '#e4002b', onSecond: '#ffffff', soft: '#dfeaf3', red: '#e4002b' },
    dark: { bg: '#06102a', ink: '#eef3fa', muted: '#95a3bd', panel: '#0b1a3d', panelHi: '#183070', onPanel: '#eef3fa', accent: '#1fb4f0', onAccent: '#04152b', second: '#ff2a4f', onSecond: '#ffffff', soft: '#0f1f45', red: '#ff2a4f' },
  },
  {
    id: 'senna', group: 'Motorsport', name: 'Yellow Helmet', by: 'inspired by Ayrton Senna', note: 'Helmet yellow with green and blue stripes.',
    native: 'light', art: livery(['#ffd400', '#009a3e', '#002776']), radius: 8, font: RACE_FONT, swatch: ['#002776', '#ffd400', '#009a3e', '#fff3b8', '#fffbe6'],
    light: { bg: '#fffbe6', ink: '#0f2a1a', muted: '#5f6b4a', panel: '#002776', onPanel: '#fffbe6', accent: '#ffd400', onAccent: '#0f2a1a', second: '#009a3e', onSecond: '#ffffff', soft: '#fff3b8', red: '#c8321e' },
    dark: { bg: '#0a1410', ink: '#fff8d6', muted: '#b2b38f', panel: '#0f1f18', panelHi: '#123e2a', onPanel: '#fff8d6', accent: '#ffd400', onAccent: '#0f2a1a', second: '#1f63d6', onSecond: '#ffffff', soft: '#16261e', red: '#ff6a4f' },
  },
  {
    id: 'verstappen', group: 'Motorsport', name: 'Oranje', by: 'inspired by Max Verstappen', note: 'Orange-army orange on navy, with a red stripe.',
    native: 'light', art: livery(['#ff6a00', '#1e2a4f', '#c8102e']), radius: 8, font: RACE_FONT, swatch: ['#1e2a4f', '#ff6a00', '#c8102e', '#ffe0c7', '#fff4ea'],
    light: { bg: '#fff4ea', ink: '#1a1220', muted: '#6b5d66', panel: '#1e2a4f', onPanel: '#fff4ea', accent: '#ff6a00', onAccent: '#1a1220', second: '#c8102e', onSecond: '#ffffff', soft: '#ffe0c7', red: '#c8102e' },
    dark: { bg: '#0e0c14', ink: '#fff1e6', muted: '#b3a3a8', panel: '#171422', panelHi: '#2b2650', onPanel: '#fff1e6', accent: '#ff7a1a', onAccent: '#1a1220', second: '#4f6fd0', onSecond: '#ffffff', soft: '#201b2c', red: '#ff4a5f' },
  },
  {
    id: 'hamilton', group: 'Motorsport', name: 'Forty-Four', by: 'inspired by Lewis Hamilton', note: 'All black with red and gold pinstripes, a big 44 and seven stars for seven titles.',
    native: 'dark', art: { light: hamiltonArt('light'), dark: hamiltonArt('dark') }, radius: 8, font: RACE_FONT, swatch: ['#121212', '#e0b43a', '#c8102e', '#2c2c2c', '#f4f2ef'],
    light: { bg: '#f4f2ef', ink: '#121212', muted: '#625f5a', panel: '#121212', onPanel: '#f4f2ef', accent: '#d4a72c', onAccent: '#121212', second: '#c8102e', onSecond: '#ffffff', soft: '#ece6da', red: '#c8102e' },
    dark: { bg: '#0a0a0a', ink: '#f2efe8', muted: '#9e9a92', panel: '#151515', panelHi: '#2c2c2c', onPanel: '#f2efe8', accent: '#e0b43a', onAccent: '#121212', second: '#e8213a', onSecond: '#ffffff', soft: '#1d1d1d', red: '#ff3a4f', glass: 0.72 },
  },
];

export const MODES = ['light', 'dark'];
export const packById = (id) => THEMES.find((t) => t.id === id) ?? THEMES[0];
export const PACK_GROUPS = ['Studio', 'Architects', 'Styles', 'Artists', 'Shinobi', 'Motorsport'];
export const GROUP_LABELS = { Studio: 'Studio', Architects: 'Architects', Styles: 'Architectural styles', Artists: 'Artists', Shinobi: 'Shinobi · inspired by Naruto', Motorsport: 'Motorsport · inspired by F1' };

/**
 * Resolve a pack for 'light' or 'dark': the CSS tokens, the backdrop ('starry' | 'blobs' | svg markup)
 * and whether the backdrop is shown tonally inverted because it was drawn for the other mode.
 */
export function resolvePack(pack, mode) {
  if (pack.id === 'studio') return null;
  const pal = pack[mode];
  const art = pack.art[mode] ?? pack.art.base;
  return {
    mode,
    tokens: tokens({ ...pal, scheme: mode, radius: pack.radius, font: pack.font }),
    backdrop: art,
    flip: !pack.art[mode] && mode !== pack.native && art !== 'blobs' && art !== 'starry',
  };
}

// Okrągłe przyciski menu w stylu „neonowego fioletu”: świecący pierścień, ciemnofioletowa tarcza,
// pełna błyszcząca ikona (sylwetki, puchar, piłka…) i ścięta plakietka z białym napisem.

const NS = 'http://www.w3.org/2000/svg';

/** Gradienty wspólne dla wszystkich ikon (wstawiane raz do dokumentu). */
export function ensureOrbDefs() {
  if (typeof document === 'undefined' || document.getElementById('orb-defs')) return;
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('id', 'orb-defs');
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.position = 'absolute';
  svg.innerHTML = `<defs>
    <linearGradient id="ogBody" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#6a30dc"/><stop offset="0.45" stop-color="#3a1192"/><stop offset="1" stop-color="#18043f"/>
    </linearGradient>
    <linearGradient id="ogEdge" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#f1e2ff"/><stop offset="1" stop-color="#a874ff"/>
    </linearGradient>
    <linearGradient id="ogShine" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.75"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
  </defs>`;
  document.body.appendChild(svg);
}

const B = 'class="ob"';            // bryła: fioletowy gradient z jasną krawędzią
const H = 'class="oh"';            // połysk

function person(cx, cy, r) {
  return `<path ${B} d="M${cx - 2.15 * r} ${cy + 4.2 * r} Q${cx - 2.15 * r} ${cy + 1.45 * r} ${cx - 0.95 * r} ${cy + 1.3 * r} L${cx} ${cy + 2 * r} L${cx + 0.95 * r} ${cy + 1.3 * r} Q${cx + 2.15 * r} ${cy + 1.45 * r} ${cx + 2.15 * r} ${cy + 4.2 * r} Z"/>`
    + `<circle ${B} cx="${cx}" cy="${cy}" r="${r}"/>`
    + `<ellipse ${H} cx="${cx - r * 0.25}" cy="${cy - r * 0.45}" rx="${r * 0.55}" ry="${r * 0.3}"/>`;
}

function poly(n, cx, cy, ro, ri, rot = -Math.PI / 2) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? ri : ro, a = rot + (i * Math.PI) / n;
    pts.push(`${(cx + Math.cos(a) * r).toFixed(1)},${(cy + Math.sin(a) * r).toFixed(1)}`);
  }
  return pts.join(' ');
}

function gear(cx, cy) {
  const pts = [];
  const teeth = 8;
  for (let i = 0; i < teeth * 4; i++) {
    const a = (i * Math.PI * 2) / (teeth * 4) - Math.PI / 2;
    const r = i % 4 < 2 ? 21 : 15.5;
    pts.push(`${(cx + Math.cos(a) * r).toFixed(1)},${(cy + Math.sin(a) * r).toFixed(1)}`);
  }
  return `<polygon ${B} points="${pts.join(' ')}"/><circle cx="${cx}" cy="${cy}" r="6.5" fill="#1b0545" stroke="#d9b8ff" stroke-width="2"/>`;
}

const G = {
  squad: () => person(15.5, 22, 7.6) + person(48.5, 22, 7.6) + person(32, 17, 9.4),
  u21: () => person(30, 20, 8.5) + `<polygon ${B} points="${poly(5, 50, 16, 9, 4)}"/>`,
  tactics: () => `<rect ${B} x="13" y="10" width="38" height="46" rx="5"/><rect ${B} x="23" y="5" width="18" height="10" rx="3"/>`
    + '<path d="M20 26l7 7M27 26l-7 7" stroke="#f3e6ff" stroke-width="3" stroke-linecap="round"/><circle cx="41" cy="44" r="4.5" fill="none" stroke="#f3e6ff" stroke-width="3"/>'
    + '<path d="M26 44 q6 -12 12 -12" fill="none" stroke="#d8b8ff" stroke-width="2.4" stroke-dasharray="3 3"/>'
    + `<rect ${H} x="17" y="13" width="30" height="7" rx="3"/>`,
  training: () => `<rect ${B} x="6" y="22" width="7" height="20" rx="2.5"/><rect ${B} x="13" y="16" width="8" height="32" rx="3"/>`
    + `<rect ${B} x="51" y="22" width="7" height="20" rx="2.5"/><rect ${B} x="43" y="16" width="8" height="32" rx="3"/>`
    + `<rect ${B} x="21" y="28.5" width="22" height="7" rx="3"/><rect ${H} x="15" y="18" width="4" height="12" rx="2"/><rect ${H} x="45" y="18" width="4" height="12" rx="2"/>`,
  opponents: () => `<path ${B} d="M8 40 L15 14 h10 L27 40 Z"/><path ${B} d="M56 40 L49 14 h-10 L37 40 Z"/>`
    + `<rect ${B} x="25" y="22" width="14" height="10" rx="3"/><circle ${B} cx="17" cy="44" r="11"/><circle ${B} cx="47" cy="44" r="11"/>`
    + '<circle cx="17" cy="44" r="5.5" fill="#1b0545" stroke="#d9b8ff" stroke-width="1.6"/><circle cx="47" cy="44" r="5.5" fill="#1b0545" stroke="#d9b8ff" stroke-width="1.6"/>'
    + `<ellipse ${H} cx="14" cy="39" rx="4" ry="2"/><ellipse ${H} cx="44" cy="39" rx="4" ry="2"/>`,
  comps: () => `<path ${B} d="M18 8 h28 v14 a14 14 0 0 1 -28 0 Z"/><path ${B} d="M18 12 h-8 a9 9 0 0 0 9 13 l1 -4 a5 5 0 0 1 -5 -6 h3 Z"/>`
    + `<path ${B} d="M46 12 h8 a9 9 0 0 1 -9 13 l-1 -4 a5 5 0 0 0 5 -6 h-3 Z"/><rect ${B} x="28" y="35" width="8" height="9" rx="1.5"/>`
    + `<rect ${B} x="19" y="44" width="26" height="10" rx="3"/><path ${H} d="M22 11 h7 v11 a8 8 0 0 1 -7 -6 Z"/>`,
  friendlies: () => `<circle ${B} cx="32" cy="32" r="22"/>`
    + `<polygon points="${poly(5, 32, 31, 8, 8)}" fill="#1b0545" stroke="#d9b8ff" stroke-width="1.6"/>`
    + '<path d="M32 23 L32 12 M40 28 L50 24 M37 38 L43 47 M27 38 L21 47 M24 28 L14 24" stroke="#d9b8ff" stroke-width="2" stroke-linecap="round"/>'
    + `<ellipse ${H} cx="25" cy="17" rx="9" ry="4.5" transform="rotate(-25 25 17)"/>`,
  federation: () => `<path ${B} d="M8 22 L32 8 L56 22 Z"/><rect ${B} x="10" y="48" width="44" height="8" rx="2"/>`
    + `<rect ${B} x="14" y="25" width="7" height="22" rx="1.5"/><rect ${B} x="28.5" y="25" width="7" height="22" rx="1.5"/><rect ${B} x="43" y="25" width="7" height="22" rx="1.5"/>`
    + `<path ${H} d="M17 20 L32 11.5 L40 16 L22 20 Z"/>`,
  ranking: () => `<circle ${B} cx="32" cy="32" r="22"/>`
    + '<path d="M10 32 h44 M32 10 c-9 7 -9 37 0 44 M32 10 c9 7 9 37 0 44 M14 21 h36 M14 43 h36" fill="none" stroke="#d9b8ff" stroke-width="2"/>'
    + `<ellipse ${H} cx="24" cy="18" rx="9" ry="4.5" transform="rotate(-25 24 18)"/>`,
  stats: () => `<rect ${B} x="8" y="36" width="10" height="18" rx="2.5"/><rect ${B} x="21" y="26" width="10" height="28" rx="2.5"/>`
    + `<rect ${B} x="34" y="31" width="10" height="23" rx="2.5"/><rect ${B} x="47" y="12" width="10" height="42" rx="2.5"/>`
    + `<rect ${H} x="49" y="14" width="3" height="16" rx="1.5"/><rect ${H} x="23" y="28" width="3" height="10" rx="1.5"/>`,
  offers: () => `<path ${B} d="M24 18 v-6 a3 3 0 0 1 3 -3 h10 a3 3 0 0 1 3 3 v6 h-4 v-5 h-8 v5 Z"/><rect ${B} x="7" y="18" width="50" height="34" rx="6"/>`
    + '<path d="M7 32 h50" stroke="#d9b8ff" stroke-width="2"/><rect x="28" y="28" width="8" height="8" rx="2" fill="#efe0ff"/>'
    + `<rect ${H} x="11" y="21" width="42" height="6" rx="3"/>`,
  achievements: () => `<polygon ${B} points="${poly(5, 32, 33, 24, 10.5)}"/><path ${H} d="M27 20 L32 10 L35 18 Z"/>`,
  messages: () => `<rect ${B} x="7" y="14" width="50" height="36" rx="6"/>`
    + '<path d="M9 17 L32 35 L55 17" fill="none" stroke="#e6d0ff" stroke-width="2.6" stroke-linejoin="round"/>'
    + `<rect ${H} x="11" y="17" width="12" height="4" rx="2"/>`,
  save: () => `<path ${B} d="M9 12 a4 4 0 0 1 4 -4 h32 l10 10 v33 a4 4 0 0 1 -4 4 h-38 a4 4 0 0 1 -4 -4 Z"/>`
    + '<rect x="19" y="8" width="22" height="13" rx="2" fill="#1b0545" stroke="#d9b8ff" stroke-width="1.6"/><rect x="34" y="10" width="4" height="8" fill="#e6d0ff"/>'
    + '<rect x="16" y="33" width="32" height="18" rx="2" fill="#efe0ff" opacity="0.9"/>',
  settings: () => gear(32, 32),
  menu: () => `<rect ${B} x="12" y="8" width="28" height="48" rx="3"/><circle cx="34" cy="33" r="2.4" fill="#efe0ff"/>`
    + `<path ${B} d="M38 26 h10 v-7 l12 13 l-12 13 v-7 h-10 Z"/><rect ${H} x="15" y="11" width="6" height="18" rx="3"/>`,
};

// przyciski zaprojektowane jako grafiki (z napisem)
const IMG = { squad: 'kadra', tactics: 'taktyka', training: 'trening', opponents: 'przeciwnicy', comps: 'rozgrywki', friendlies: 'towarzyskie', u21: 'u21', federation: 'federacja', ranking: 'ranking' };

/** Okrągły przycisk menu. ic – nazwa ikony, label – napis na plakietce. „Kadra” to grafika z projektu. */
export function orb(ic, label, attrs, badge = 0) {
  const b = badge ? `<span class="badge">${badge}</span>` : '';
  if (IMG[ic]) {
    return `<button class="orb orb-img" ${attrs} aria-label="${label}"><img src="img/${IMG[ic]}.png" alt="" draggable="false">${b}</button>`;
  }
  const g = G[ic] ? G[ic]() : '';
  const hl = g.match(/<[^>]*class="oh"[^>]*\/>/g) || [];
  const body = g.replace(/<[^>]*class="oh"[^>]*\/>/g, '');
  const long = label.length > 8 ? ' long' : '';
  // trzy warstwy jak w ręcznie rysowanej ikonie: ciemny kontur, bryła z jasną krawędzią, połysk
  return `<button class="orb" ${attrs} aria-label="${label}">
    <span class="orb-disc"><svg class="orb-ic" viewBox="-4 -4 72 72" aria-hidden="true"><g class="o-out">${body}</g><g class="o-fill">${body}</g><g class="o-hl">${hl.join('')}</g></svg></span>
    <span class="orb-label${long}"><b>${label}</b></span>
    ${b}
  </button>`;
}

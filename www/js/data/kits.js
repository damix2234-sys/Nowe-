// Barwy strojów reprezentacji (kolory narodowe): 'koszulka/wykończenie[/wzór]|strój wyjazdowy'.
// Wzory: s – pasy pionowe, c – szachownica, d – szarfa, h – poziomy pas.
const K = {
  ALB: 'e41e20/111111|ffffff/e41e20', AND: '1b3d8f/f4c400|ffffff/d52b1e', ARM: 'd90012/0033a0|ffffff/d90012', AUT: 'ed2939/ffffff|ffffff/ed2939',
  AZE: '0092bc/ffffff|ffffff/e00034', BLR: 'c8313e/ffffff|ffffff/4aa657', BEL: 'c8102e/111111|ffffff/c8102e', BIH: '002f6c/fecb00|ffffff/002f6c',
  BUL: 'ffffff/00966e|d62612/ffffff', CRO: 'ffffff/e30613/c|1b2a5c/ffffff', CYP: '1e4ea1/ffffff|ffffff/1e4ea1', CZE: 'd7141a/ffffff|ffffff/11457e',
  DEN: 'c8102e/ffffff|ffffff/c8102e', ENG: 'ffffff/1d2a59|c8102e/ffffff', EST: '0072ce/111111|ffffff/0072ce', FRO: 'ffffff/0065bd|0065bd/ffffff',
  FIN: 'ffffff/002f6c|002f6c/ffffff', FRA: '1f2c5c/ffffff|ffffff/1f2c5c', GEO: 'ffffff/e8112d|e8112d/ffffff', GER: 'ffffff/111111|111111/ffffff',
  GIB: 'da291c/ffffff|ffffff/da291c', GRE: 'ffffff/0d5eaf|0d5eaf/ffffff', HUN: 'ce2939/ffffff|ffffff/477050', ISL: '02529c/ffffff|ffffff/02529c',
  IRL: '169b62/ffffff|ffffff/169b62', ISR: 'ffffff/0038b8|0038b8/ffffff', ITA: '1b5ab4/ffffff|ffffff/1b5ab4', KAZ: 'ffd600/00afca|00afca/ffd600',
  KOS: '244aa5/d0a650|ffffff/244aa5', LVA: '9e3039/ffffff|ffffff/9e3039', LIE: '002b7f/ce1126|ce1126/002b7f', LTU: 'fdb913/006a44|006a44/fdb913',
  LUX: 'ed2939/ffffff|ffffff/00a1de', MLT: 'cf142b/ffffff|ffffff/cf142b', MDA: '0046ae/ffd200|ffffff/0046ae', MNE: 'c40308/d4af37|ffffff/c40308',
  NED: 'f36c21/111111|1b2a5c/f36c21', MKD: 'd20000/ffe600|ffffff/d20000', NIR: '00843d/ffffff|ffffff/00843d', NOR: 'ba0c2f/ffffff|ffffff/00205b',
  POL: 'ffffff/dc143c|dc143c/ffffff', POR: 'c8102e/006600|ffffff/c8102e', ROU: 'fcd116/002b7f|002b7f/fcd116', RUS: 'ffffff/0039a6|d52b1e/ffffff',
  SMR: '5eb6e4/ffffff|ffffff/5eb6e4', SCO: '1c2a5a/ffffff|ffffff/1c2a5a', SRB: 'c6363c/ffffff|ffffff/0c4076', SVK: 'ffffff/0b4ea2|0b4ea2/ffffff',
  SVN: 'ffffff/005ce5|00a651/ffffff', ESP: 'c60b1e/ffc400|ffffff/c60b1e', SWE: 'fecc00/006aa7|006aa7/fecc00', SUI: 'd52b1e/ffffff|ffffff/d52b1e',
  TUR: 'e30a17/ffffff|ffffff/e30a17', UKR: 'ffd500/005bbb|005bbb/ffd500', WAL: 'c8102e/ffffff|ffd200/00843d',
  ARG: '75aadb/ffffff/s|1b2a5c/75aadb', BOL: '007a33/ffffff|ffffff/007a33', BRA: 'ffdf00/009c3b|1f4fb4/ffffff', CHI: 'd52b1e/0039a6|ffffff/d52b1e',
  COL: 'fcd116/003893|003893/fcd116', ECU: 'ffd100/034ea2|034ea2/ffd100', PAR: 'd52b1e/ffffff/s|0038a8/ffffff', PER: 'ffffff/d91023/d|d91023/ffffff',
  URU: '55a6e0/111111|ffffff/55a6e0', VEN: '7a1b2e/ffffff|ffffff/7a1b2e',
  USA: 'ffffff/0a3161|0a3161/ffffff', MEX: '006847/ffffff|ffffff/006847', CAN: 'd80621/ffffff|ffffff/d80621', CRC: 'ce1126/002b7f|ffffff/ce1126',
  PAN: 'da121a/ffffff|ffffff/072357', JAM: 'fed100/009b3a|111111/fed100', HON: 'ffffff/0073cf|0073cf/ffffff', SLV: '0f47af/ffffff|ffffff/0f47af',
  GUA: 'ffffff/4997d0|4997d0/ffffff', HAI: '00209f/d21034|d21034/ffffff', TRI: 'ce1126/111111|ffffff/ce1126', CUW: '002b7f/f9e814|ffffff/002b7f',
  MAR: 'c1272d/006233|ffffff/c1272d', SEN: 'ffffff/00853f|00853f/fdef42', EGY: 'ce1126/ffffff|ffffff/111111', CIV: 'f77f00/009e60|ffffff/f77f00',
  NGA: '008751/ffffff|ffffff/008751', ALG: 'ffffff/006233|006233/ffffff', TUN: 'e70013/ffffff|ffffff/e70013', CMR: '007a5e/fcd116|ce1126/fcd116',
  GHA: 'ffffff/111111|fcd116/006b3f', MLI: '14b53a/fcd116|fcd116/14b53a', BFA: '009e49/ef2b2d|ffffff/009e49', RSA: 'ffb612/007a4d|007a4d/ffb612',
  COD: '007fff/f7d618|ce1021/ffffff', GUI: 'ce1126/fcd116|ffffff/009460', ZAM: '198a00/ef7d00|ffffff/198a00', GAB: 'fcd116/009e60|3a75c4/ffffff',
  ANG: 'cc092f/111111|ffffff/cc092f', UGA: 'fcdc04/111111|d90000/ffffff', KEN: 'bb0000/006600|ffffff/006600', CPV: '003893/ffffff|ffffff/cf2027',
  JPN: '1c3f94/ffffff|ffffff/1c3f94', KOR: 'cd2e3a/111111|ffffff/0047a0', IRN: 'ffffff/239f40|da0000/ffffff', AUS: 'ffcd00/00843d|00205b/ffcd00',
  KSA: 'ffffff/006c35|006c35/ffffff', QAT: '8a1538/ffffff|ffffff/8a1538', UAE: 'ffffff/ef3340|ef3340/ffffff', IRQ: '007a3d/ffffff|ffffff/ce1126',
  UZB: 'ffffff/0099b5|0099b5/ffffff', JOR: 'ffffff/ce1126|ce1126/ffffff', OMA: 'db161b/ffffff|ffffff/db161b', CHN: 'de2910/ffde00|ffffff/de2910',
  BHR: 'ce1126/ffffff|ffffff/ce1126', SYR: 'ce1126/ffffff|ffffff/111111', THA: '241d4f/ffffff|ffffff/a51931', VIE: 'da251d/ffcd00|ffffff/da251d',
  IDN: 'ce1126/ffffff|ffffff/ce1126', IND: '1e3f9c/ff9933|ffffff/1e3f9c', NZL: 'ffffff/111111|111111/ffffff', SOL: '0051ba/fcd116|215b33/ffffff',
  FIJ: 'ffffff/68bfe5|68bfe5/ffffff', TAH: 'ce1126/ffffff|ffffff/ce1126',
};

const GK_COLORS = ['16c784', 'f5d000', '8e44ad', 'ff7f11', '222222', '00bcd4', 'e91e63'];

function hexRgb(h) {
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Odległość kolorów (przybliżenie percepcyjne „redmean”). */
export function colorDist(a, b) {
  const [r1, g1, b1] = hexRgb(a), [r2, g2, b2] = hexRgb(b);
  const rm = (r1 + r2) / 2;
  const dr = r1 - r2, dg = g1 - g2, db = b1 - b2;
  return Math.sqrt((2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db);
}

const lum = (h) => { const [r, g, b] = hexRgb(h); return 0.299 * r + 0.587 * g + 0.114 * b; };

function parseKit(str) {
  const [shirt, trim, pat] = str.split('/');
  return { shirt, trim, pat: pat || '', num: lum(shirt) > 150 ? '111111' : 'ffffff' };
}

function fallback(nid) {
  let h = 0;
  for (const ch of nid) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const hues = ['c62828', '1565c0', '2e7d32', 'f9a825', '6a1b9a', 'ef6c00', '00838f', 'ffffff', '212121'];
  const a = hues[h % hues.length], b = hues[(h >> 4) % hues.length] === a ? 'ffffff' : hues[(h >> 4) % hues.length];
  return `${a}/${b}|${b}/${a}`;
}

export function kitsOf(nid) {
  const [h, a] = (K[nid] || fallback(nid)).split('|');
  return { home: parseKit(h), away: parseKit(a) };
}

const GRASS = '2f8a47';

/**
 * Stroje na mecz: gospodarz w domowym, gość w domowym albo wyjazdowym, gdy kolory się zlewają.
 * Zwraca [{ shirt, trim, pat, num, gk:{...} }, {...}] z kolorami w formacie '#rrggbb'.
 */
export function matchKits(hNid, aNid) {
  const H = { ...kitsOf(hNid).home };
  const A = kitsOf(aNid);
  // gość: strój domowy, wyjazdowy albo neutralny – byle wyraźnie inny niż koszulki gospodarza
  const alts = ['ffffff', '111111', 'f5d000', '1e5bd8', 'd62828', 'ff7f11'].map((c) => ({ shirt: c, trim: lum(c) > 150 ? '333333' : 'ffffff', pat: '', num: lum(c) > 150 ? '111111' : 'ffffff' }));
  let away = [A.home, A.away].find((k) => colorDist(H.shirt, k.shirt) >= 185);
  if (!away) away = alts.slice().sort((x, y) => colorDist(H.shirt, y.shirt) - colorDist(H.shirt, x.shirt))[0];
  away = { ...away };
  // koszulki w kolorze murawy dostają jasne obramowanie
  for (const k of [H, away]) if (colorDist(k.shirt, GRASS) < 110 && colorDist(k.trim, 'ffffff') > 60) k.trim = 'ffffff';
  const used = [H.shirt, away.shirt, GRASS];
  const gks = [];
  for (const c of GK_COLORS) {
    if (used.every((u) => colorDist(u, c) > 170) && gks.every((g) => colorDist(g, c) > 170)) gks.push(c);
    if (gks.length === 2) break;
  }
  while (gks.length < 2) gks.push(gks.length ? '222222' : 'f5d000');
  const mk = (k, gk) => ({
    shirt: '#' + k.shirt, trim: '#' + k.trim, pat: k.pat, num: '#' + k.num,
    gk: { shirt: '#' + gk, trim: '#111111', pat: '', num: lum(gk) > 150 ? '#111111' : '#ffffff' },
  });
  return [mk(H, gks[0]), mk(away, gks[1])];
}

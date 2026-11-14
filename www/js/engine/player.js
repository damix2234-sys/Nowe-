// Model zawodnika: atrybuty, oceny na pozycjach, wartość, rozwój.
import { clamp, gauss, chance } from '../core/util.js';

// Pełny zestaw atrybutów (jak w profesjonalnych menedżerach): techniczne, mentalne, fizyczne i bramkarskie.
// Każdy ma konkretną rolę w silniku meczu (engine/sim.js) – zawodnicy ścierają się atrybutami w pojedynkach.
// Klucze z poprzedniej wersji zachowały znaczenie (sh = Wykończenie, gk = Refleks, gw = Wyjścia z bramki).
export const ATTR_NAMES = {
  // techniczne
  cor: 'Rzuty rożne', cr: 'Dośrodkowania', dr: 'Drybling', sh: 'Wykończenie', ft: 'Przyjęcie piłki', fk: 'Rzuty wolne',
  hd: 'Gra głową', ls: 'Strzały z dystansu', lt: 'Wrzuty z autu', mk: 'Krycie', ps: 'Podania', pen: 'Rzuty karne',
  tk: 'Odbiór piłki', te: 'Technika',
  // mentalne
  agg: 'Agresja', ant: 'Przewidywanie', brv: 'Odwaga', cm: 'Opanowanie', con: 'Koncentracja', dec: 'Decyzje',
  det: 'Determinacja', fla: 'Polot', ld: 'Przywództwo', otb: 'Gra bez piłki', psn: 'Ustawianie się', tmw: 'Gra zespołowa',
  vis: 'Wizja gry', wr: 'Pracowitość',
  // fizyczne
  acc: 'Przyspieszenie', agi: 'Zwinność', bal: 'Równowaga', jmp: 'Skoczność', nf: 'Naturalna kondycja',
  sp: 'Szybkość', en: 'Wytrzymałość', st: 'Siła',
  // bramkarskie
  aer: 'Zasięg w powietrzu', coa: 'Panowanie w polu karnym', com: 'Komunikacja', ecc: 'Ekscentryczność',
  han: 'Chwytanie', kic: 'Wykopy', ovo: 'Sam na sam', pun: 'Piąstkowanie', gk: 'Refleks', gw: 'Wyjścia z bramki', thr: 'Wyrzuty ręką',
};
export const ATTRS = Object.keys(ATTR_NAMES);
export const ATTR_HINTS = {
  cor: 'jakość dośrodkowań z rzutów rożnych', cr: 'dośrodkowania z gry', dr: 'mijanie rywali z piłką (przeciw odbiorowi)',
  sh: 'skuteczność strzałów z pola karnego (przeciw bramkarzowi)', ft: 'pewność przyjęcia podania, mniej strat', fk: 'strzały i dośrodkowania z rzutów wolnych',
  hd: 'celność i siła strzałów i podań głową', ls: 'strzały zza pola karnego (celność, siła, chęć uderzenia)', lt: 'zasięg wrzutów z autu',
  mk: 'pilnowanie rywala, przechwyty', ps: 'celność podań', pen: 'skuteczność rzutów karnych', tk: 'odbieranie piłki (przeciw dryblingowi)',
  te: 'technika użytkowa – celność strzałów i podań, gra pod presją',
  agg: 'częstość prób odbioru (więcej fauli)', ant: 'czytanie gry: przechwyty, szybsza reakcja na piłkę', brv: 'blokowanie strzałów, walka w powietrzu',
  cm: 'zimna krew w sytuacjach bramkowych i pod presją', con: 'mniej błędów, szczególnie pod koniec meczu', dec: 'trafność wyborów z piłką',
  det: 'walka do końca, gdy drużyna przegrywa', fla: 'nieszablonowe zagrania: drybling, strzały z dystansu', ld: 'wpływ na drużynę jako kapitan',
  otb: 'wbiegnięcia za obrońców, szukanie wolnego pola', psn: 'ustawienie w obronie i krycie strefy', tmw: 'trzymanie ustawienia, wspieranie partnerów',
  vis: 'dostrzeganie podań prostopadłych i otwierających', wr: 'pressing i powroty – intensywność gry bez piłki',
  acc: 'rozpędzanie się w pierwszych metrach', agi: 'zwody, zmiana kierunku, parady', bal: 'utrzymanie się na nogach w pojedynkach',
  jmp: 'wysokość wyskoku do piłki', nf: 'regeneracja między meczami i wolniejsze męczenie się', sp: 'prędkość maksymalna',
  en: 'jak szybko spada świeżość w meczu', st: 'przepychanki, zasłanianie piłki, walka w powietrzu',
  aer: 'łapanie i piąstkowanie wysokich piłek', coa: 'wychodzenie do dośrodkowań w polu karnym', com: 'organizacja obrony (lepsze krycie)',
  ecc: 'nieprzewidywalne zachowania bramkarza', han: 'czy obroniona piłka zostanie złapana, czy odbita', kic: 'celność wykopów',
  ovo: 'pojedynki sam na sam z napastnikiem', pun: 'skłonność do piąstkowania zamiast łapania', gk: 'refleks przy strzałach z bliska',
  gw: 'skracanie kąta i wybiegnięcia przed pole karne', thr: 'celność wyrzutów ręką',
};
export const ATTR_GROUPS = [
  ['Techniczne', ['cor', 'cr', 'dr', 'sh', 'ft', 'fk', 'hd', 'ls', 'lt', 'mk', 'ps', 'pen', 'tk', 'te']],
  ['Mentalne', ['agg', 'ant', 'brv', 'cm', 'con', 'dec', 'det', 'fla', 'ld', 'otb', 'psn', 'tmw', 'vis', 'wr']],
  ['Fizyczne', ['acc', 'agi', 'bal', 'jmp', 'nf', 'sp', 'en', 'st']],
  ['Bramkarskie', ['aer', 'coa', 'com', 'ecc', 'ft', 'han', 'kic', 'ovo', 'ps', 'pun', 'gk', 'gw', 'thr']],
];
export const GK_ATTRS = new Set(['aer', 'coa', 'com', 'ecc', 'han', 'kic', 'ovo', 'pun', 'gk', 'gw', 'thr']);
export const PHYS_ATTRS = new Set(['acc', 'agi', 'bal', 'jmp', 'nf', 'sp', 'en', 'st']);

// pierwotny zestaw (generator świata – zachowuje bazę zawodników i ich oceny)
export const OLD_ATTRS = ['gk', 'tk', 'st', 'hd', 'ps', 'cr', 'te', 'sp', 'sh', 'ld'];

export const POSITIONS = ['GK', 'LB', 'CB', 'RB', 'DM', 'CM', 'AM', 'LW', 'RW', 'CF'];
export const POS_NAMES = {
  GK: 'Bramkarz', LB: 'Lewy obrońca', CB: 'Środkowy obrońca', RB: 'Prawy obrońca',
  DM: 'Defensywny pomocnik', CM: 'Środkowy pomocnik', AM: 'Ofensywny pomocnik',
  LW: 'Lewy skrzydłowy', RW: 'Prawy skrzydłowy', CF: 'Napastnik',
};
export const POS_SHORT = { GK: 'BR', LB: 'LO', CB: 'ŚO', RB: 'PO', DM: 'DP', CM: 'ŚP', AM: 'OP', LW: 'LS', RW: 'PS', CF: 'N' };
export const POS_GROUP = { GK: 'G', LB: 'D', CB: 'D', RB: 'D', DM: 'M', CM: 'M', AM: 'M', LW: 'A', RW: 'A', CF: 'A' };
export const POS_ORDER = Object.fromEntries(POSITIONS.map((p, i) => [p, i]));

export const OLD_POS_W = {
  GK: { gk: 0.8, sp: 0.08, st: 0.06, ps: 0.06 },
  CB: { tk: 0.34, hd: 0.24, st: 0.2, sp: 0.1, ps: 0.12 },
  LB: { tk: 0.28, sp: 0.22, cr: 0.2, ps: 0.12, te: 0.1, st: 0.08 },
  RB: { tk: 0.28, sp: 0.22, cr: 0.2, ps: 0.12, te: 0.1, st: 0.08 },
  DM: { tk: 0.3, ps: 0.26, st: 0.16, te: 0.1, hd: 0.08, sp: 0.1 },
  CM: { ps: 0.3, te: 0.22, tk: 0.14, sp: 0.1, sh: 0.1, st: 0.14 },
  AM: { ps: 0.26, te: 0.3, sh: 0.2, sp: 0.14, cr: 0.1 },
  LW: { sp: 0.26, te: 0.26, cr: 0.2, sh: 0.14, ps: 0.14 },
  RW: { sp: 0.26, te: 0.26, cr: 0.2, sh: 0.14, ps: 0.14 },
  CF: { sh: 0.4, hd: 0.14, sp: 0.16, te: 0.16, st: 0.14 },
};

// wagi z poprzedniej wersji (zachowanie ocen przy migracji)
export const POS_W_V2 = {
  GK: { gk: 0.6, gw: 0.2, ps: 0.08, cm: 0.06, st: 0.03, sp: 0.03 },
  CB: { tk: 0.24, mk: 0.22, hd: 0.18, st: 0.14, sp: 0.08, ps: 0.07, cm: 0.04, te: 0.03 },
  LB: { tk: 0.18, sp: 0.18, cr: 0.14, mk: 0.12, en: 0.1, ps: 0.1, dr: 0.08, te: 0.06, st: 0.04 },
  RB: { tk: 0.18, sp: 0.18, cr: 0.14, mk: 0.12, en: 0.1, ps: 0.1, dr: 0.08, te: 0.06, st: 0.04 },
  DM: { tk: 0.22, mk: 0.18, ps: 0.18, st: 0.1, en: 0.1, te: 0.08, hd: 0.06, cm: 0.04, sp: 0.04 },
  CM: { ps: 0.24, te: 0.16, en: 0.12, tk: 0.1, dr: 0.08, sh: 0.08, mk: 0.06, cm: 0.06, st: 0.06, sp: 0.04 },
  AM: { ps: 0.22, te: 0.2, dr: 0.18, sh: 0.16, cm: 0.1, sp: 0.08, cr: 0.06 },
  LW: { sp: 0.22, dr: 0.22, te: 0.14, cr: 0.14, sh: 0.12, ps: 0.08, en: 0.04, cm: 0.04 },
  RW: { sp: 0.22, dr: 0.22, te: 0.14, cr: 0.14, sh: 0.12, ps: 0.08, en: 0.04, cm: 0.04 },
  CF: { sh: 0.3, cm: 0.14, te: 0.12, hd: 0.12, sp: 0.12, st: 0.1, dr: 0.06, ps: 0.04 },
};

// wagi atrybutów w ocenie ogólnej na pozycji (suma 1) – najważniejsze atrybuty dla danej roli
const FB_W = { tk: 0.11, sp: 0.1, cr: 0.1, mk: 0.08, en: 0.08, psn: 0.08, acc: 0.07, ant: 0.06, wr: 0.06, ps: 0.06, dr: 0.05, tmw: 0.05, dec: 0.05, con: 0.05 };
const W_W = { dr: 0.14, sp: 0.12, acc: 0.1, cr: 0.1, te: 0.08, otb: 0.07, ft: 0.06, fla: 0.06, agi: 0.06, sh: 0.06, ps: 0.05, dec: 0.04, wr: 0.03, en: 0.03 };
export const POS_W = {
  GK: { gk: 0.22, han: 0.14, psn: 0.1, ovo: 0.1, aer: 0.1, coa: 0.08, agi: 0.08, gw: 0.06, kic: 0.04, com: 0.03, dec: 0.03, cm: 0.02 },
  CB: { tk: 0.14, mk: 0.14, hd: 0.12, psn: 0.12, jmp: 0.08, st: 0.08, ant: 0.07, con: 0.06, dec: 0.05, sp: 0.05, brv: 0.04, ps: 0.03, cm: 0.02 },
  LB: FB_W, RB: FB_W,
  DM: { tk: 0.13, ps: 0.12, psn: 0.1, ant: 0.1, mk: 0.09, dec: 0.09, tmw: 0.07, wr: 0.07, st: 0.06, en: 0.06, con: 0.05, cm: 0.04, vis: 0.02 },
  CM: { ps: 0.15, dec: 0.1, vis: 0.1, te: 0.08, ft: 0.07, tmw: 0.07, wr: 0.07, en: 0.07, ant: 0.05, otb: 0.05, tk: 0.05, cm: 0.05, dr: 0.04, ls: 0.03, st: 0.02 },
  AM: { ps: 0.13, vis: 0.12, te: 0.11, dr: 0.1, ft: 0.08, dec: 0.08, otb: 0.08, fla: 0.07, cm: 0.06, ls: 0.06, sh: 0.05, agi: 0.03, acc: 0.03 },
  LW: W_W, RW: W_W,
  CF: { sh: 0.2, otb: 0.1, cm: 0.1, ft: 0.08, hd: 0.08, acc: 0.08, ant: 0.07, sp: 0.06, te: 0.06, dr: 0.05, st: 0.05, jmp: 0.04, dec: 0.03 },
};

const SIMILAR = {
  GK: [], LB: ['RB', 'LW'], RB: ['LB', 'RW'], CB: ['DM'], DM: ['CM', 'CB'], CM: ['DM', 'AM'],
  AM: ['CM', 'LW', 'RW', 'CF'], LW: ['RW', 'AM', 'LB'], RW: ['LW', 'AM', 'RB'], CF: ['AM', 'LW', 'RW'],
};

export const ALT_CHANCES = {
  GK: [], CB: [['DM', 0.15], ['RB', 0.06], ['LB', 0.06]], LB: [['LW', 0.25], ['RB', 0.15], ['CB', 0.1]],
  RB: [['RW', 0.25], ['LB', 0.15], ['CB', 0.1]], DM: [['CM', 0.5], ['CB', 0.2]], CM: [['DM', 0.4], ['AM', 0.35]],
  AM: [['CM', 0.35], ['LW', 0.2], ['RW', 0.2], ['CF', 0.2]], LW: [['RW', 0.4], ['AM', 0.25], ['CF', 0.15], ['LB', 0.05]],
  RW: [['LW', 0.4], ['AM', 0.25], ['CF', 0.15], ['RB', 0.05]], CF: [['AM', 0.15], ['LW', 0.12], ['RW', 0.12]],
};

export function posRating(p, pos) {
  const w = POS_W[pos];
  let s = 0;
  for (const k in w) s += w[k] * (p.a[k] ?? 40);
  return s;
}

/** Ocena według dawnych wag (generator świata). */
export function oldRating(a, pos) {
  const w = OLD_POS_W[pos];
  let s = 0;
  for (const k in w) s += w[k] * (a[k] ?? 40);
  return s;
}

const r1 = (v) => clamp(Math.round(v * 10) / 10, 1, 99);

/**
 * Uzupełnia nowe umiejętności (drybling, kondycja, krycie, opanowanie, wyjścia) na podstawie dotychczasowych,
 * pozycji i wieku, zachowując ocenę ogólną. Własny generator losowy (z id zawodnika) – baza świata się nie zmienia.
 */
export function extendAttrs(p, r) {
  const a = p.a;
  if (a.dr != null && a.en != null && a.mk != null && a.cm != null && a.gw != null) return extendFull(p, r);
  const T = oldRating(a, p.pos);
  const g = () => gauss(r);
  const pos = p.pos, age = p.age || 25;
  const isGK = pos === 'GK';
  if (isGK) {
    a.dr = 12 + r() * 22;
    a.mk = 10 + r() * 20;
    a.gw = (a.gk ?? T) - 3 + g() * 6;
    a.en = 45 + T * 0.25 + g() * 6;
  } else {
    const wing = pos === 'LW' || pos === 'RW';
    const def = pos === 'CB' || pos === 'DM', fb = pos === 'LB' || pos === 'RB';
    a.dr = (wing || pos === 'AM' ? 0.5 * a.te + 0.3 * a.sp + 0.2 * T + 3 : pos === 'CF' ? 0.45 * a.te + 0.25 * a.sp + 0.3 * T
      : fb ? 0.4 * a.te + 0.3 * a.sp + 0.3 * T * 0.85 : def ? 0.35 * a.te + 0.15 * a.sp + 0.5 * T * 0.7 : 0.5 * a.te + 0.2 * a.sp + 0.3 * T * 0.85) + g() * 5;
    a.mk = (def ? 0.55 * a.tk + 0.2 * a.hd + 0.25 * T : fb ? 0.55 * a.tk + 0.45 * T * 0.88 : pos === 'CM' ? 0.5 * a.tk + 0.5 * T * 0.72
      : 0.35 * a.tk + 0.65 * T * 0.5) + g() * 5;
    a.gw = 4 + r() * 12;
    a.en = 26 + T * 0.55 + (fb || pos === 'CM' || wing ? 5 : pos === 'CB' ? -3 : pos === 'CF' ? -2 : 0) + g() * 7;
  }
  a.en += age >= 33 ? -9 : age >= 30 ? -4 : age <= 20 ? -2 : 0;
  a.cm = 12 + 0.3 * T + 0.3 * a.te + (age - 18) * 0.9 + (['CF', 'AM'].includes(pos) ? 4 : 0) + g() * 8;
  for (const k of ['dr', 'mk', 'gw', 'en', 'cm']) a[k] = r1(a[k]);
  // ocena ogólna bez zmian (przesunięcie umiejętności ważnych dla pozycji, z poszanowaniem granic 1–99)
  fitOvr(p, T, POS_W_V2);
  extendFull(p, r);
  return true;
}

function v2Rating(p) { const w = POS_W_V2[p.pos]; let s = 0; for (const k in w) s += w[k] * (p.a[k] ?? 40); return s; }

/**
 * Pełny zestaw atrybutów (mentalne, fizyczne, bramkarskie, wzrost i waga) wyliczany z pozycji, wieku
 * i dotychczasowych umiejętności. Ocena ogólna zawodnika zostaje taka sama jak przed rozbudową.
 */
export function extendFull(p, r) {
  const a = p.a;
  if (a.ant != null && p.h != null) return false;
  const T = v2Rating(p);
  const g = () => gauss(r);
  const pos = p.pos, age = p.age || 25, isGK = pos === 'GK';
  const wing = pos === 'LW' || pos === 'RW', fb = pos === 'LB' || pos === 'RB';
  const mental = (b) => b + (age - 24) * 0.7;
  // wzrost i waga
  const hBase = { GK: 190, CB: 188, CF: 184, DM: 181, CM: 179, AM: 176, LB: 177, RB: 177, LW: 175, RW: 175 }[pos];
  p.h = Math.round(clamp(hBase + g() * 5.5, 163, 204));
  p.w = Math.round(clamp((p.h - 100) * 0.88 + g() * 4.5 + (pos === 'CB' || pos === 'CF' ? 2 : 0), 58, 102));
  const tall = (p.h - 180) / 10;
  const set = (k, v) => { if (a[k] == null) a[k] = r1(v); };
  const imp = (k) => (POS_W[pos][k] ? 1 : 0);
  const base = (k, off = 0) => (imp(k) ? T + 2 : T * 0.8 + 6) + off + g() * 6.5;
  if (isGK) {
    for (const k of ['cor', 'fk', 'ls', 'pen', 'lt', 'fla', 'otb']) set(k, 10 + r() * 22);
    set('sh', a.sh ?? 15); set('ft', base('ft', -6)); set('han', (a.gk ?? T) + g() * 6); set('ovo', (a.gw ?? T) * 0.5 + T * 0.5 + g() * 6);
    set('aer', T + tall * 4 + g() * 6); set('coa', (a.gw ?? T) * 0.6 + T * 0.4 + g() * 6); set('com', T * 0.8 + 8 + g() * 8);
    set('kic', T * 0.85 + 6 + g() * 8); set('thr', T * 0.85 + 6 + g() * 8); set('pun', 25 + r() * 50); set('ecc', 5 + r() * 55);
  } else {
    for (const k of ['aer', 'coa', 'com', 'han', 'kic', 'ovo', 'thr']) set(k, 3 + r() * 14);
    set('pun', 3 + r() * 10); set('ecc', 3 + r() * 10);
    set('ft', (a.te ?? T) + g() * 5); set('ls', (a.sh ?? T) * (pos === 'CF' ? 0.85 : 0.95) + g() * 6);
    set('cor', (a.cr ?? T) + g() * 6); set('fk', 0.45 * (a.cr ?? T) + 0.45 * (a.te ?? T) + g() * 8);
    set('pen', 0.55 * (a.sh ?? T) + 0.35 * (a.cm ?? T) + 6 + g() * 7); set('lt', (fb ? 40 : 25) + r() * 40);
  }
  set('agg', (pos === 'CB' || pos === 'DM' ? 62 : isGK ? 35 : 50) + g() * 12);
  set('ant', mental(base('ant')));
  set('brv', (pos === 'CB' ? 68 : isGK ? 60 : 55) + g() * 10 + T * 0.1);
  set('con', mental(base('con')));
  set('dec', mental(base('dec')));
  set('det', 45 + r() * 45);
  set('fla', (wing || pos === 'AM' || pos === 'CF' ? T * 0.85 + 6 : T * 0.6 + 6) + g() * 9);
  set('otb', isGK ? 15 : base('otb', pos === 'CB' ? -12 : 0));
  set('psn', mental(base('psn', wing || pos === 'AM' || pos === 'CF' ? -10 : 0)));
  set('tmw', base('tmw') + g() * 2);
  set('vis', 0.6 * (a.ps ?? T) + 0.4 * base('vis') + g() * 4);
  set('wr', base('wr') + (fb || pos === 'CM' || pos === 'DM' ? 4 : pos === 'CF' ? -4 : 0));
  const old = (age >= 31 ? -(age - 30) * 2 : 0);
  set('acc', (a.sp ?? T) + g() * 6 - tall * 2 + old);
  set('agi', (isGK ? T : 0.5 * (a.dr ?? T) + 0.5 * T) + g() * 6 - tall * 2.5 + old);
  set('bal', 0.5 * T + 0.3 * (a.st ?? T) + 12 + g() * 7);
  set('jmp', 0.5 * (a.hd ?? T) + 0.3 * T + tall * 5 + 10 + g() * 6 + old);
  set('nf', (a.en ?? T) + g() * 8);
  for (const k of ['agg', 'brv', 'det', 'lt', 'pun', 'ecc']) a[k] = r1(a[k]);
  fitOvr(p, T);
  return true;
}

/** Dopasowuje umiejętności pozycji tak, by ocena ogólna wynosiła target (kilka przebiegów – limity 1–99). */
export function fitOvr(p, target, W = POS_W) {
  const w = W[p.pos];
  const rate = () => { let t = 0; for (const k in w) t += w[k] * (p.a[k] ?? 40); return t; };
  for (let it = 0; it < 5; it++) {
    const diff = target - rate();
    if (Math.abs(diff) < 0.05) break;
    let free = 0;
    for (const k in w) if ((diff > 0 && p.a[k] < 99) || (diff < 0 && p.a[k] > 1)) free += w[k];
    if (free <= 0) break;
    for (const k in w) if ((diff > 0 && p.a[k] < 99) || (diff < 0 && p.a[k] > 1)) p.a[k] = r1(p.a[k] + diff / free);
  }
}

// Forma: znakomita daje premię, przeciętna nic, słaba i fatalna obniżają umiejętności w meczu.
export const FORM_MUL = { '-2': 0.92, '-1': 0.96, 0: 1, 1: 1.03, 2: 1.07 };
export const formMul = (p) => FORM_MUL[p.form] ?? 1;
export const moraleMul = (p) => 1 + (((p.mor ?? 50) - 50) / 50) * 0.03;

export function familiarity(p, pos) {
  if (p.pos === pos) return 1;
  if (pos === 'GK') return 0.25;
  if (p.pos === 'GK') return 0.35;
  if (p.alt && p.alt.includes(pos)) return 0.96;
  if (SIMILAR[p.pos].includes(pos)) return 0.88;
  return 0.75;
}

export const slotRating = (p, pos) => posRating(p, pos) * familiarity(p, pos);
export const ovr = (p) => posRating(p, p.pos);
export const ovrI = (p) => Math.round(ovr(p));

/** Czynnik dyspozycji dnia (forma + morale), ok. 0.89-1.10. */
export function stateFactor(p) {
  return formMul(p) * moraleMul(p);
}

export function value(p) {
  const o = ovr(p);
  let v = 200000 * Math.pow(1.2, o - 60);
  const a = p.age;
  v *= a <= 21 ? 1.35 : a <= 24 ? 1.25 : a <= 28 ? 1 : a <= 30 ? 0.75 : a <= 32 ? 0.5 : 0.3;
  if (a <= 23) v *= 1 + Math.max(0, p.pot - o) / 25;
  if (v < 5000) v = 5000;
  const mag = Math.pow(10, Math.floor(Math.log10(v)) - 1);
  return Math.round(v / mag) * mag;
}

export const CLUB_STATUS = ['Kluczowy zawodnik', 'Ważny zawodnik', 'Zawodnik rotacyjny', 'Rezerwowy'];

export function clubStatusFor(o, lv) {
  const d = o - lv;
  return d >= 4 ? 0 : d >= -1 ? 1 : d >= -6 ? 2 : 3;
}

/** Zmienia ocenę zawodnika o d punktów (rozkładając na atrybuty pozycji). */
export function applyDelta(p, d, r = Math.random) {
  const w = POS_W[p.pos];
  for (const k in w) p.a[k] = clamp((p.a[k] ?? 40) + d * (0.6 + r() * 0.8), 1, 99);
  // drobny wpływ na pozostałe atrybuty (bez bramkarskich u graczy z pola i cech charakteru)
  for (const k of ATTRS) {
    if (w[k] || k === 'ld' || k === 'det' || k === 'agg' || k === 'ecc' || k === 'pun' || k === 'brv') continue;
    if (GK_ATTRS.has(k) !== (p.pos === 'GK') && GK_ATTRS.has(k)) continue;
    p.a[k] = clamp((p.a[k] ?? 40) + d * 0.35 * r(), 1, 99);
  }
  if (d < 0 && p.age >= 30) for (const k of ['sp', 'acc', 'agi', 'en', 'nf']) p.a[k] = clamp((p.a[k] ?? 60) + d * 0.6, 1, 99);
  for (const k of ATTRS) if (p.a[k] != null) p.a[k] = Math.round(p.a[k] * 10) / 10;
}

/** Ustawia ocenę ogólną na zadaną wartość (edytor). */
export function setOvr(p, target) {
  fitOvr(p, target);
}

/** Miesięczny rozwój. play = ile meczów zagrał w kadrze/U-21 w tym miesiącu. */
export function developMonthly(p, play = 0) {
  const o = ovr(p);
  const gap = p.pot - o;
  let d;
  if (p.age <= 20) d = gap * 0.045 + gauss() * 0.25;
  else if (p.age <= 23) d = gap * 0.035 + gauss() * 0.25;
  else if (p.age <= 27) d = gap * 0.02 + gauss() * 0.2;
  else if (p.age <= 30) d = -0.05 + gauss() * 0.2;
  else if (p.age <= 32) d = -0.2 + gauss() * 0.2;
  else d = -0.34 + gauss() * 0.25;
  d += [0.08, 0.04, 0, -0.07][p.cst] || 0;
  if (play > 0 && p.age <= 23) d += 0.12 * Math.min(play, 2);
  if (p.inj > 20) d -= 0.1;
  applyDelta(p, d);
  if (p.age >= 27 && p.pot > ovr(p) + 1) p.pot = Math.max(ovr(p), p.pot - 0.3);
  if (p.age < 30 && chance(0.15)) p.a.ld = clamp(p.a.ld + 0.5, 1, 99);
  if (p.age < 31 && chance(0.12)) p.a.cm = clamp((p.a.cm ?? 50) + 0.5, 1, 99);
  if (p.age < 31) for (const k of ['dec', 'ant', 'psn', 'con']) if (chance(0.08)) p.a[k] = clamp((p.a[k] ?? 50) + 0.5, 1, 99);
}

export const FORM_ICONS = ['⬇', '↘', '➡', '↗', '⬆'];
export const FORM_NAMES = ['Fatalna', 'Słaba', 'Przeciętna', 'Dobra', 'Znakomita'];

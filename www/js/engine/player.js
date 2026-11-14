// Model zawodnika: atrybuty, oceny na pozycjach, wartość, rozwój.
import { clamp, gauss, chance } from '../core/util.js';

// 15 umiejętności – każda ma konkretną rolę w silniku meczu (pojedynki „jedna przeciw drugiej”):
// Strzały + Technika + Opanowanie ↔ Bramkarstwo, Drybling ↔ Odbiór piłki, Podania ↔ Krycie,
// Gra głową + Siła ↔ Gra głową + Siła / Wyjścia bramkarza, Szybkość ↔ Szybkość, Kondycja – zmęczenie.
export const ATTRS = ['sp', 'st', 'en', 'te', 'dr', 'ps', 'cr', 'sh', 'hd', 'tk', 'mk', 'cm', 'ld', 'gk', 'gw'];
export const ATTR_NAMES = {
  sp: 'Szybkość', st: 'Siła', en: 'Kondycja', te: 'Technika', dr: 'Drybling', ps: 'Podania', cr: 'Dośrodkowania',
  sh: 'Strzały', hd: 'Gra głową', tk: 'Odbiór piłki', mk: 'Krycie', cm: 'Opanowanie', ld: 'Przywództwo', gk: 'Bramkarstwo', gw: 'Wyjścia',
};
export const ATTR_HINTS = {
  sp: 'wyścigi do piłki, kontry, uciekanie obrońcom', st: 'przepychanki, zasłanianie piłki, pojedynki w powietrzu',
  en: 'jak szybko spada świeżość w meczu', te: 'przyjęcie piłki, celność strzałów i podań', dr: 'mijanie rywali (przeciw odbiorowi)',
  ps: 'celność i jakość podań, prostopadłe piłki', cr: 'dośrodkowania, rzuty rożne i wolne', sh: 'siła i jakość strzału (przeciw bramkarzowi)',
  hd: 'gra w powietrzu i strzały głową', tk: 'odbiór piłki (przeciw dryblingowi), mniej fauli', mk: 'czytanie gry, przechwyty, blokowanie strzałów',
  cm: 'zimna krew w sytuacjach sam na sam i przy karnych, mniej błędów', ld: 'wpływ na drużynę, szczególnie jako kapitan',
  gk: 'refleks i ustawienie przy strzałach', gw: 'wyjścia do dośrodkowań i sam na sam',
};
export const ATTR_GROUPS = [
  ['Fizyczne', ['sp', 'st', 'en']],
  ['Techniczne', ['te', 'dr', 'ps', 'cr', 'sh', 'hd']],
  ['Defensywne', ['tk', 'mk']],
  ['Mentalne', ['cm', 'ld']],
  ['Bramkarskie', ['gk', 'gw']],
];
export const PHYS_ATTRS = new Set(['sp', 'st', 'en']);

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

// wagi umiejętności w ocenie ogólnej na pozycji (suma 1)
export const POS_W = {
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
  if (a.dr != null && a.en != null && a.mk != null && a.cm != null && a.gw != null) return false;
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
  fitOvr(p, T);
  return true;
}

/** Dopasowuje umiejętności pozycji tak, by ocena ogólna wynosiła target (kilka przebiegów – limity 1–99). */
export function fitOvr(p, target) {
  const w = POS_W[p.pos];
  for (let it = 0; it < 4; it++) {
    const diff = target - posRating(p, p.pos);
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
  for (const k in w) p.a[k] = clamp(p.a[k] + d * (0.6 + r() * 0.8), 1, 99);
  // drobny wpływ na pozostałe atrybuty
  for (const k of ATTRS) {
    if (k === 'ld' || w[k] || ((k === 'gk' || k === 'gw') && p.pos !== 'GK')) continue;
    p.a[k] = clamp((p.a[k] ?? 40) + d * 0.35 * r(), 1, 99);
  }
  if (d < 0 && p.age >= 30) { p.a.sp = clamp(p.a.sp + d * 0.6, 1, 99); p.a.en = clamp((p.a.en ?? 60) + d * 0.5, 1, 99); }
  for (const k of ATTRS) p.a[k] = Math.round(p.a[k] * 10) / 10;
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
}

export const FORM_ICONS = ['⬇', '↘', '➡', '↗', '⬆'];
export const FORM_NAMES = ['Fatalna', 'Słaba', 'Przeciętna', 'Dobra', 'Znakomita'];

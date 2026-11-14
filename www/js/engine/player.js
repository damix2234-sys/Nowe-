// Model zawodnika: atrybuty, oceny na pozycjach, wartość, rozwój.
import { clamp, gauss, chance } from '../core/util.js';

export const ATTRS = ['gk', 'tk', 'st', 'hd', 'ps', 'cr', 'te', 'sp', 'sh', 'ld'];
export const ATTR_NAMES = {
  gk: 'Bramkarstwo', tk: 'Odbiór piłki', st: 'Siła', hd: 'Gra głową', ps: 'Podania',
  cr: 'Dośrodkowania', te: 'Technika', sp: 'Szybkość', sh: 'Strzały', ld: 'Przywództwo',
};

export const POSITIONS = ['GK', 'LB', 'CB', 'RB', 'DM', 'CM', 'AM', 'LW', 'RW', 'CF'];
export const POS_NAMES = {
  GK: 'Bramkarz', LB: 'Lewy obrońca', CB: 'Środkowy obrońca', RB: 'Prawy obrońca',
  DM: 'Defensywny pomocnik', CM: 'Środkowy pomocnik', AM: 'Ofensywny pomocnik',
  LW: 'Lewy skrzydłowy', RW: 'Prawy skrzydłowy', CF: 'Napastnik',
};
export const POS_SHORT = { GK: 'BR', LB: 'LO', CB: 'ŚO', RB: 'PO', DM: 'DP', CM: 'ŚP', AM: 'OP', LW: 'LS', RW: 'PS', CF: 'N' };
export const POS_GROUP = { GK: 'G', LB: 'D', CB: 'D', RB: 'D', DM: 'M', CM: 'M', AM: 'M', LW: 'A', RW: 'A', CF: 'A' };
export const POS_ORDER = Object.fromEntries(POSITIONS.map((p, i) => [p, i]));

export const POS_W = {
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
  for (const k in w) s += w[k] * p.a[k];
  return s;
}

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

/** Czynnik dyspozycji dnia (forma + morale), ok. 0.92-1.08. */
export function stateFactor(p) {
  return (1 + p.form * 0.025) * (1 + ((p.mor - 50) / 50) * 0.03);
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
    if (k === 'ld' || w[k] || (k === 'gk' && p.pos !== 'GK')) continue;
    p.a[k] = clamp(p.a[k] + d * 0.35 * r(), 1, 99);
  }
  if (d < 0 && p.age >= 30) p.a.sp = clamp(p.a.sp + d * 0.6, 1, 99);
  for (const k of ATTRS) p.a[k] = Math.round(p.a[k] * 10) / 10;
}

/** Ustawia ocenę ogólną na zadaną wartość (edytor). */
export function setOvr(p, target) {
  const cur = ovr(p);
  const diff = target - cur;
  const w = POS_W[p.pos];
  for (const k in w) p.a[k] = clamp(p.a[k] + diff, 1, 99);
  for (const k of ATTRS) p.a[k] = Math.round(p.a[k] * 10) / 10;
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
}

export const FORM_ICONS = ['⬇', '↘', '➡', '↗', '⬆'];
export const FORM_NAMES = ['Fatalna', 'Słaba', 'Przeciętna', 'Dobra', 'Znakomita'];

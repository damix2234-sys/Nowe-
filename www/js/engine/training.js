// Trening kadry: punkty w kategoriach dają bonus albo karę w meczu oraz miesięczne zmiany atrybutów.
import { ATTR_NAMES, POS_W } from './player.js';

export const TRAIN_KEYS = ['cond', 'poss', 'sp', 'off', 'def', 'ment', 'gk'];
export const TRAIN_NAMES = {
  cond: 'Kondycja', poss: 'Posiadanie piłki', sp: 'Stałe fragmenty gry', off: 'Ofensywa',
  def: 'Defensywa', ment: 'Przygotowanie mentalne', gk: 'Trening bramkarzy',
};
export const TRAIN_BUDGET = 35;
export const TRAIN_MAX = 10;
/** Próg: poniżej tylu punktów kategoria jest zaniedbana i działa kara. */
export const TRAIN_MIN = 4;

/** Atrybuty przypisane do kategorii treningu. Każdy atrybut należy do dokładnie jednej. */
export const TRAIN_ATTRS = {
  cond: ['acc', 'agi', 'bal', 'jmp', 'nf', 'sp', 'en', 'st'],
  poss: ['ps', 'ft', 'te', 'vis', 'dec', 'tmw'],
  sp: ['cor', 'fk', 'pen', 'lt', 'hd'],
  off: ['sh', 'ls', 'dr', 'cr', 'otb', 'fla'],
  def: ['tk', 'mk', 'psn', 'ant', 'brv', 'agg', 'wr'],
  ment: ['cm', 'con', 'det', 'ld'],
  gk: ['gk', 'han', 'ovo', 'aer', 'coa', 'gw', 'com', 'kic', 'thr', 'pun', 'ecc'],
};
export const ATTR_TRAIN = {};
for (const k in TRAIN_ATTRS) for (const a of TRAIN_ATTRS[k]) ATTR_TRAIN[a] = k;

/** Cechy charakteru: trening nie zmienia ich w meczu ani w rozwoju. */
const TRAITS = new Set(['agg', 'ecc', 'pun']);

/** Mnożnik atrybutów w meczu za punkty w kategorii: 10 pkt = +12%, 4 pkt = 0, 0 pkt = −10%. */
export function trainMul(pts) {
  const p = pts ?? 5;
  return p >= TRAIN_MIN ? 1 + 0.02 * (p - TRAIN_MIN) : 1 - 0.025 * (TRAIN_MIN - p);
}
export const trainPct = (pts) => Math.round((trainMul(pts) - 1) * 100);

/** Mnożnik treningu dla atrybutu k w meczu. */
export function attrTrainMul(train, k) {
  if (!train || TRAITS.has(k)) return 1;
  const cat = ATTR_TRAIN[k];
  return cat ? trainMul(train[cat]) : 1;
}

/** Plan treningowy drużyn komputera: równo po 5 pkt. */
export const AI_TRAIN = Object.fromEntries(TRAIN_KEYS.map((k) => [k, 5]));

/** Miesięczna zmiana atrybutu od treningu: 10 pkt to +0,3 w kluczowych atrybutach, 0 pkt to −0,32. */
export function monthlyGain(pts) {
  const p = pts ?? 5;
  return p > TRAIN_MIN ? 0.05 * (p - TRAIN_MIN) : p < TRAIN_MIN ? -0.08 * (TRAIN_MIN - p) : 0;
}

/**
 * Miesięczny wpływ treningu na zawodnika kadry. Zyski trafiają w pełni do atrybutów kluczowych
 * dla jego pozycji, a w 30% do pozostałych z kategorii. Kary dotyczą wszystkich atrybutów kategorii.
 * Zyski zatrzymują się, gdy ocena przekroczy potencjał o 3.
 */
export function applyMonthlyTraining(p, train, ovrNow, mult = 1) {
  const key = POS_W[p.pos] || {};
  const isGK = p.pos === 'GK';
  const age = p.age <= 23 ? 1.2 : p.age <= 29 ? 1 : p.age <= 32 ? 0.6 : 0.3;
  const capped = ovrNow >= (p.pot ?? 99) + 3;
  for (const cat of TRAIN_KEYS) {
    if (cat === 'gk' && !isGK) continue;
    const g = monthlyGain(train[cat]) * mult;
    if (!g) continue;
    for (const k of TRAIN_ATTRS[cat]) {
      if (TRAITS.has(k) || p.a[k] == null) continue;
      let d;
      if (g > 0) { if (capped) continue; d = g * age * (key[k] ? 1 : 0.3); }
      else d = g * (key[k] ? 1 : 0.6);
      p.a[k] = Math.round(Math.min(99, Math.max(1, p.a[k] + d)) * 10) / 10;
    }
  }
}

export const TRAIN_ATTR_LIST = (cat) => TRAIN_ATTRS[cat].map((k) => ATTR_NAMES[k]);

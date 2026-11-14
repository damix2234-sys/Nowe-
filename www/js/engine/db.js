// Generowanie świata: kluby, zawodnicy wszystkich reprezentacji. Deterministyczne dla danego ziarna.
import { mkRng, rint, gauss, pick, wpick, clamp } from '../core/util.js';
import { NATIONS, NAT, LEAGUES } from '../data/nations.js';
import { POOLS } from '../data/names.js';
import { POS_W, OLD_POS_W, OLD_ATTRS, ALT_CHANCES, posRating, ovr, applyDelta, clubStatusFor, setOvr, extendAttrs, oldRating } from './player.js';

export const DEFAULT_SEED = 20260901;

const SENIOR_LAYOUT = { GK: 3, CB: 5, LB: 2, RB: 2, DM: 3, CM: 3, AM: 2, LW: 2, RW: 2, CF: 4 };
const YOUTH_LAYOUT = ['GK', 'CB', 'CB', 'LB', 'RB', 'DM', 'CM', 'AM', 'W', 'CF'];
const DEPTH = [2, -2, -5, -8, -11];
const GOAL_RATE = { GK: 0, CB: 0.04, LB: 0.02, RB: 0.02, DM: 0.03, CM: 0.07, AM: 0.15, LW: 0.17, RW: 0.17, CF: 0.38 };

// ---------------- kluby ----------------
const CLUB_PAT = {
  en: ['{c} United', '{c} City', '{c} Rovers', '{c} Athletic', '{c} Town', '{c} Albion', '{c} Wanderers', 'AFC {c}'],
  es: ['CD {c}', '{c} CF', 'UD {c}', 'Deportivo {c}', 'Racing {c}', 'Atlético {c}', 'SD {c}', 'Real Club {c}'],
  de: ['FC {c}', 'SV {c}', 'VfB {c}', 'TSV {c}', 'Borussia {c}', 'Eintracht {c}', 'SC {c}', 'Fortuna {c}'],
  it: ['AC {c}', 'US {c}', '{c} Calcio', 'SS {c}', 'Sporting {c}', 'Virtus {c}', 'FC {c}'],
  fr: ['FC {c}', 'AS {c}', 'Olympique {c}', 'Stade {c}', 'RC {c}', 'SC {c}', 'US {c}'],
  nl: ['FC {c}', 'SC {c}', '{c} SV', 'VV {c}', 'Sparta {c}', 'RKC {c}'],
  pt: ['SC {c}', 'FC {c}', 'Académica {c}', 'Sporting {c}', 'União {c}', 'CD {c}', 'Vitória {c}'],
  gen: ['FC {c}', '{c} SK', 'Dinamo {c}', 'Olimpik {c}', 'Sporting {c}', 'Atletik {c}'],
  ar: ['Al-{c} SC', '{c} FC', 'Nadi {c}'],
  us: ['{c} FC', '{c} SC', '{c} United', 'Real {c}'],
  br: ['{c} EC', '{c} FC', 'Atlético {c}', 'Sport {c}', 'América {c}'],
  la: ['Club {c}', 'Deportivo {c}', 'Atlético {c}', 'Sportivo {c}', 'Racing {c}'],
  pl: ['KS {c}', 'Polonia {c}', 'Unia {c}', 'Stal {c}', 'Sparta {c}', 'Olimpia {c}', 'Victoria {c}'],
  cs: ['FK {c}', 'SK {c}', 'Slavoj {c}', 'Baník {c}', 'Dukla {c}', 'Viktoria {c}'],
  ru: ['FK {c}', 'Dinamo {c}', 'Spartak {c}', 'Torpedo {c}', 'Lokomotiw {c}', 'Metałurh {c}'],
  yu: ['FK {c}', 'NK {c}', 'Radnik {c}', 'Sloga {c}', 'Rudar {c}'],
  al: ['KF {c}', '{c} FC', 'KS {c}'],
  gr: ['AO {c}', 'PAE {c}', 'Asteras {c}', 'Atromitos {c}'],
  ro: ['FC {c}', 'CS {c}', 'Sportul {c}', 'Universitatea {c}'],
  hu: ['{c} FC', '{c} TE', '{c} SE', 'Vasas {c}'],
  bg: ['FK {c}', 'Lokomotiv {c}', 'Botev {c}', 'Spartak {c}'],
  nord: ['{c} BK', '{c} IF', '{c} FK', 'IK {c}', 'FC {c}'],
  he: ['Hapoel {c}', 'Maccabi {c}', 'Beitar {c}', 'Bnei {c}'],
  afr_fr: ['AS {c}', 'Stade {c}', 'Union {c}', 'Étoile {c}', 'US {c}'],
  afr_en: ['{c} United', '{c} Stars', '{c} Rangers', '{c} City'],
  fa: ['{c} FC', 'Sanat {c}', 'Esteghlal {c}'],
  asia: ['{c} FC', 'FC {c}', '{c} United', 'Sporting {c}'],
};
const POOL_STYLE = {
  pl: 'pl', cs: 'cs', ru: 'ru', ua: 'ru', kz: 'ru', az: 'ru', hy: 'ru', ka: 'ru', uz: 'ru', yu: 'yu', mk: 'yu', al: 'al', gr: 'gr', tr: 'gen',
  ro: 'ro', hu: 'hu', bg: 'bg', de: 'de', nl: 'nl', fr: 'fr', es: 'es', pt: 'pt', it: 'it', en: 'en', ie: 'en', sco: 'en', wal: 'en',
  nord: 'nord', is: 'nord', fi: 'nord', ee: 'gen', lv: 'gen', lt: 'gen', he: 'he', mt: 'en', la: 'la', br: 'br', car: 'en', ht: 'fr',
  ar: 'ar', afr_fr: 'afr_fr', afr_en: 'afr_en', ao: 'pt', fa: 'fa', ja: 'asia', ko: 'asia', zh: 'asia', th: 'asia', vi: 'asia', id: 'asia', in: 'asia', pac: 'en',
};

export function mainPool(nat) {
  if (typeof nat.pool === 'string') return nat.pool;
  return Object.entries(nat.pool).sort((a, b) => b[1] - a[1])[0][0];
}

function buildClubs(world, r) {
  const clubs = [];
  const seen = new Set();
  const add = (name, nat, lv) => {
    if (seen.has(name)) name = name + ' II';
    seen.add(name);
    clubs.push({ n: name, nat, lv: Math.round(lv * 10) / 10 });
  };
  for (const nat of NATIONS) {
    const lg = LEAGUES[nat.id];
    if (lg) {
      const pats = CLUB_PAT[lg.style];
      lg.cities.forEach((c, i) => {
        const base = lg.tier === 1 ? 89 - i * 1.7 : lg.tier === 2 ? 79 - i * 2 : 73 - i * 2;
        add(pick(pats, r).replace('{c}', c), nat.id, base);
      });
    } else {
      const pats = CLUB_PAT[POOL_STYLE[mainPool(nat)]] || CLUB_PAT.gen;
      const used = new Set();
      nat.cities.forEach((c, i) => {
        let pat = pick(pats, r);
        if (used.has(pat)) pat = pats.find((x) => !used.has(x)) || pat;
        used.add(pat);
        add(pat.replace('{c}', c), nat.id, nat.str - 2 - i * 3);
      });
      // dodatkowe kluby w mniejszych miastach ligi krajowej
      const extra = nat.str >= 60 ? 2 : 1;
      for (let i = 0; i < extra; i++) {
        const c = nat.cities[i % nat.cities.length];
        const pat = pats.find((x) => !used.has(x));
        if (!pat) break;
        used.add(pat);
        add(pat.replace('{c}', c), nat.id, nat.str - 6 - i * 3);
      }
    }
  }
  world.clubs = clubs;
}

/** Dobiera klub do zawodnika na podstawie jego oceny. */
export function assignClub(world, p, r = Math.random) {
  const o = p._o ?? ovr(p);
  const nat = NAT[p.nat];
  if (!world._maxLv) world._maxLv = Math.max(...world.clubs.map((c) => c.lv));
  const aim = Math.min(o + gauss(r) * 2.5, world._maxLv);
  const win = aim >= 84 ? 4 : 5;
  let cands = [];
  for (let i = 0; i < world.clubs.length; i++) {
    const c = world.clubs[i];
    if (aim >= 84 ? c.lv >= aim - win : Math.abs(c.lv - aim) <= win) cands.push(i);
  }
  if (!cands.length) {
    // najbliższy poziomem klub, z silną preferencją ligi krajowej
    let best = -1, bd = 1e9;
    for (let i = 0; i < world.clubs.length; i++) {
      const c = world.clubs[i];
      const d = Math.abs(c.lv - aim) + (c.nat === p.nat ? 0 : NAT[c.nat].conf === nat.conf ? 6 : 14);
      if (d < bd) { bd = d; best = i; }
    }
    cands = [best];
  }
  const european = (cid) => NAT[cid].conf === 'EU';
  const idx = wpick(cands, (i) => {
    const c = world.clubs[i];
    const cn = NAT[c.nat];
    const lg = LEAGUES[c.nat];
    let w;
    if (c.nat === p.nat) w = 10;
    else if (lg && lg.tier === 1) w = aim >= 72 ? 4 : 0.4;
    else if (lg && lg.tier === 2) w = aim >= 66 ? 2.2 : 0.5;
    else if (cn.conf === nat.conf) w = 1.6;
    else w = 0.12;
    if (c.nat !== p.nat && cn.conf === nat.conf) w *= 1.8;
    // zawodnicy spoza Europy częściej wyjeżdżają do lig europejskich
    if (nat.conf !== 'EU' && aim >= 70 && european(c.nat) && lg) w *= 2.5;
    if (aim < 58 && cn.conf !== nat.conf) w *= 0.15;
    return w;
  }, r);
  p.club = idx;
  p.cst = clubStatusFor(o, world.clubs[idx].lv);
  if (r() < 0.15) p.cst = clamp(p.cst + (r() < 0.5 ? -1 : 1), 0, 3);
}

// ---------------- zawodnicy ----------------
export function poolKey(nat, r) {
  if (typeof nat.pool === 'string') return nat.pool;
  const keys = Object.keys(nat.pool);
  return wpick(keys, (k) => nat.pool[k], r);
}

export function genName(nat, r = Math.random, used = null) {
  let res = null;
  for (let t = 0; t < 14; t++) {
    const P = POOLS[poolKey(nat, r)];
    let fn, ln;
    if (P.nick.length && r() < 0.18) { fn = ''; ln = pick(P.nick, r); }
    else { fn = pick(P.f, r); ln = pick(P.l, r); }
    res = { fn, ln, ord: P.order };
    const key = fn + '|' + ln;
    if (!used || !used.has(key)) { if (used) used.add(key); return res; }
  }
  return res;
}

/** Generator losowy nowych umiejętności, osobny strumień z id zawodnika (baza świata pozostaje taka sama). */
export const attrRng = (id) => mkRng(((id * 2654435761) ^ 0x5bd1e995) >>> 0);

// Podstawowe 10 umiejętności (dawny zestaw); nowe uzupełnia extendAttrs.
export function genAttrs(pos, target, age, r = Math.random) {
  const w = OLD_POS_W[pos];
  const a = {};
  for (const k of OLD_ATTRS) {
    if (k === 'ld') continue;
    if (pos === 'GK') {
      if (k === 'gk') a.gk = target + gauss(r) * 2;
      else if (w[k]) a[k] = target * 0.75 + gauss(r) * 6;
      else a[k] = rint(10, 40, r) * (0.6 + target / 250);
    } else if (k === 'gk') a.gk = rint(3, 15, r);
    else if (w[k]) a[k] = target + gauss(r) * 6;
    else a[k] = target * 0.7 + gauss(r) * 9;
  }
  if (pos !== 'GK') {
    const wk = Object.keys(w);
    const up = pick(wk, r), dn = pick(wk, r);
    if (up !== dn) { a[up] += 6; a[dn] -= 6; }
  }
  let cur = 0;
  for (const k in w) cur += w[k] * a[k];
  const diff = target - cur;
  for (const k in w) a[k] += diff;
  for (const k of OLD_ATTRS) if (k !== 'ld') a[k] = clamp(Math.round(a[k] * 10) / 10, 1, 99);
  a.ld = clamp(Math.round(30 + (age - 18) * 1.8 + gauss(r) * 12), 5, 95);
  return a;
}

const SENIOR_AGE_W = { 21: 3, 22: 5, 23: 7, 24: 8, 25: 9, 26: 9, 27: 9, 28: 9, 29: 8, 30: 7, 31: 6, 32: 4, 33: 3, 34: 2, 35: 1 };
const seniorAge = (r) => +wpick(Object.keys(SENIOR_AGE_W), (k) => SENIOR_AGE_W[k], r);

export function makePlayer(world, natId, pos, target, age, r = Math.random, used = null) {
  const nat = NAT[natId];
  const nm = genName(nat, r, used);
  const p = {
    id: world.nextPid++, nat: natId, fn: nm.fn, ln: nm.ln, ord: nm.ord, age, pos, alt: [],
    a: genAttrs(pos, target, age, r), pot: target, club: 0, cst: 1,
    caps: 0, goals: 0, form: 0, cond: 95, mor: 55, inj: 0, susp: 0,
  };
  // pozycje alternatywne według dawnych wag (ta sama sekwencja losowań, baza świata bez zmian)
  const o = oldRating(p.a, pos);
  for (const [q, c] of ALT_CHANCES[pos]) {
    if (p.alt.length < 2 && r() < c && oldRating(p.a, q) >= o - 7) p.alt.push(q);
  }
  p._o = o;
  extendAttrs(p, attrRng(p.id));
  p.form = r() < 0.6 ? 0 : r() < 0.5 ? 1 : -1;
  p.cond = rint(88, 100, r);
  p.mor = rint(45, 70, r);
  world.players[p.id] = p;
  return p;
}

/** Nowy młody zawodnik (regeneracja kadr co roku). */
export function makeYouth(world, natId, r = Math.random, age = null) {
  const nat = NAT[natId];
  const posRaw = pick(YOUTH_LAYOUT, r);
  const pos = posRaw === 'W' ? (r() < 0.5 ? 'LW' : 'RW') : posRaw;
  const ag = age ?? rint(17, 21, r);
  const target = clamp(nat.str - 15 + (ag - 17) * 2.5 + gauss(r) * 4.5, 22, 85);
  const p = makePlayer(world, natId, pos, target, ag, r);
  let pot = nat.str + 1 + gauss(r) * 6;
  if (r() < 0.07) pot += rint(5, 11, r); // wielki talent
  p.pot = clamp(Math.round(Math.max(pot, target + 3)), 30, 96);
  assignClub(world, p, r);
  delete p._o;
  return p;
}

export function generateWorld(seed = DEFAULT_SEED) {
  const r = mkRng(seed);
  const world = { players: {}, nextPid: 1, clubs: [], nats: {} };
  buildClubs(world, r);
  for (const nat of NATIONS) {
    const used = new Set();
    const pool = [];
    for (const [pos, cnt] of Object.entries(SENIOR_LAYOUT)) {
      for (let k = 0; k < cnt; k++) {
        const age = seniorAge(r);
        let target = nat.str + DEPTH[k] + gauss(r) * 3.5;
        if (age <= 22) target -= 2;
        if (age >= 33) target -= 2;
        target = clamp(target, 24, 92);
        const p = makePlayer(world, nat.id, pos, target, age, r, used);
        p.pot = age <= 23 ? clamp(Math.round(target + rint(2, 10, r)), target, 96) : Math.round(target + (age <= 26 ? rint(0, 3, r) : 0));
        const capRate = [7, 4.5, 2.5, 1.2, 0.6][k] * (0.5 + r() * 0.8);
        p.caps = Math.max(0, Math.round((age - 20) * capRate));
        p.goals = Math.round(p.caps * GOAL_RATE[pos] * (0.6 + r() * 0.8) * (target / 75));
        pool.push(p.id);
      }
    }
    // gwiazdy reprezentacji
    const starChance = clamp((nat.str - 38) / 45, 0.05, 0.95);
    const nStars = (r() < starChance ? 1 : 0) + (r() < starChance * 0.45 ? 1 : 0);
    for (let s = 0; s < nStars; s++) {
      const p = world.players[pick(pool, r)];
      const boost = rint(5, 10, r);
      setOvr(p, clamp(ovr(p) + boost, 30, 95));
      if (p._o != null) p._o = clamp(p._o + boost, 30, 95);
      p.pot = Math.max(p.pot, Math.round(ovr(p)));
      p.caps = Math.round(p.caps * 1.4 + 5);
      p.goals = Math.round(p.goals * 1.5 + (GOAL_RATE[p.pos] > 0.1 ? 4 : 0));
      p.a.ld = clamp(p.a.ld + 8, 1, 99);
    }
    // młodzież
    for (let i = 0; i < YOUTH_LAYOUT.length; i++) {
      const raw = YOUTH_LAYOUT[i];
      const pos = raw === 'W' ? (r() < 0.5 ? 'LW' : 'RW') : raw;
      const age = rint(17, 21, r);
      const target = clamp(nat.str - 14 + (age - 17) * 2.5 + gauss(r) * 4, 22, 85);
      const p = makePlayer(world, nat.id, pos, target, age, r, used);
      let pot = nat.str + 1 + gauss(r) * 6;
      if (r() < 0.08) pot += rint(5, 11, r);
      p.pot = clamp(Math.round(Math.max(pot, target + 3)), 30, 96);
      p.caps = age >= 20 && r() < 0.25 ? rint(1, 4, r) : 0;
      p.u21 = { apps: rint(0, 12, r), g: 0 };
      pool.push(p.id);
    }
    for (const pid of pool) assignClub(world, world.players[pid], r);
    const coach = genName(nat, r);
    world.nats[nat.id] = { pool, coach: { fn: coach.fn, ln: coach.ln, ord: coach.ord } };
  }
  for (const p of Object.values(world.players)) delete p._o;
  return world;
}

/** Nakłada zmiany z edytora na wygenerowany świat. */
export function applyOverrides(world, ov) {
  if (!ov) return;
  for (const [pid, o] of Object.entries(ov)) {
    const p = world.players[pid];
    if (!p) continue;
    if (typeof o.fn === 'string') p.fn = o.fn;
    if (typeof o.ln === 'string') p.ln = o.ln;
    if (o.age) p.age = clamp(+o.age, 15, 45);
    if (o.pos && POS_W[o.pos]) {
      if (o.pos !== p.pos) {
        const keep = ovr(p);
        p.a = genAttrs(o.pos, keep, p.age, Math.random);
        p.pos = o.pos;
        p.alt = [];
        extendAttrs(p, attrRng(p.id));
        setOvr(p, keep);
      }
    }
    if (o.ovr) {
      setOvr(p, clamp(+o.ovr, 20, 99));
      p.pot = Math.max(p.pot, Math.round(ovr(p)));
    }
  }
}

// ---------------------------------------------------------------------
// Szeroka baza zawodników prowadzonej reprezentacji i akademia federacji
// ---------------------------------------------------------------------
const DEPTH_POS = Object.entries(SENIOR_LAYOUT).flatMap(([pos, n]) => Array(n).fill(pos));

/** Zawodnik z szerszej bazy kraju: zwykle słabszy od czołówki, czasem ukryty talent. */
export function makeDepthPlayer(world, natId, r = Math.random) {
  const nat = NAT[natId];
  const pos = pick(DEPTH_POS, r);
  const young = r() < 0.3;
  const age = young ? rint(17, 21, r) : seniorAge(r);
  let target = nat.str - 7 - Math.abs(gauss(r)) * 9 + gauss(r) * 2;
  if (young) target -= (21 - age) * 2;
  if (age >= 33) target -= 2;
  target = clamp(target, 22, 88);
  const p = makePlayer(world, natId, pos, target, age, r);
  if (age <= 23) {
    let pot = target + rint(1, 9, r) + (r() < 0.06 ? rint(6, 14, r) : 0);
    p.pot = clamp(Math.round(pot), Math.round(target), 95);
  } else p.pot = Math.round(target + (age <= 26 ? rint(0, 3, r) : 0));
  p.caps = 0; p.goals = 0;
  assignClub(world, p, r);
  delete p._o;
  return p;
}

/** Krzywa rozwoju wychowanka: jaką część potencjału osiąga w danym wieku. */
export const academyCurve = (age) => clamp(0.3 + (age - 4) * 0.0343, 0.25, 0.8);

/** Wzrost i waga dziecka w danym wieku, na podstawie docelowych wymiarów dorosłego. */
export function kidBody(p) {
  if (p.hAdult == null) { p.hAdult = p.h; p.wAdult = p.w; }
  const g = clamp((p.age - 4) / 14, 0, 1);
  p.h = Math.round(p.hAdult * (0.57 + 0.43 * Math.pow(g, 0.85)));
  p.w = Math.round((p.h * p.h) / 10000 * (15.5 + 5.5 * g));
}

/** Nowy wychowanek akademii federacji. */
export function makeAcademyKid(world, natId, age, r = Math.random) {
  const nat = NAT[natId];
  const raw = pick(YOUTH_LAYOUT, r);
  const pos = raw === 'W' ? (r() < 0.5 ? 'LW' : 'RW') : raw;
  let pot = nat.str + gauss(r) * 7;
  if (r() < 0.06) pot += rint(6, 14, r);
  pot = clamp(Math.round(pot), 35, 97);
  const target = clamp(pot * academyCurve(age) + gauss(r) * 2, 8, 80);
  const p = makePlayer(world, natId, pos, target, age, r);
  p.pot = pot;
  p.acad = true;
  p.club = null;
  p.cst = 1;
  p.caps = 0; p.goals = 0;
  delete p._o;
  kidBody(p);
  return p;
}

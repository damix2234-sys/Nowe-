// Formacje, automatyczny wybór składu, polecenia indywidualne i stałe fragmenty gry.
import { clamp, wpick } from '../core/util.js';
import { slotRating, ovr, POS_GROUP, stateFactor } from './player.js';

// [pozycja, x (0 lewa – 100 prawa), y (0 własna bramka – 100 bramka rywala)]
export const FORMATIONS = {
  '4-4-2': [['GK', 50, 5], ['LB', 14, 24], ['CB', 38, 19], ['CB', 62, 19], ['RB', 86, 24], ['LW', 14, 52], ['CM', 38, 48], ['CM', 62, 48], ['RW', 86, 52], ['CF', 38, 80], ['CF', 62, 80]],
  '4-3-3': [['GK', 50, 5], ['LB', 14, 24], ['CB', 38, 19], ['CB', 62, 19], ['RB', 86, 24], ['CM', 30, 50], ['DM', 50, 38], ['CM', 70, 50], ['LW', 16, 76], ['CF', 50, 83], ['RW', 84, 76]],
  '4-2-3-1': [['GK', 50, 5], ['LB', 14, 24], ['CB', 38, 19], ['CB', 62, 19], ['RB', 86, 24], ['DM', 38, 40], ['DM', 62, 40], ['LW', 16, 64], ['AM', 50, 62], ['RW', 84, 64], ['CF', 50, 84]],
  '4-5-1': [['GK', 50, 5], ['LB', 14, 24], ['CB', 38, 19], ['CB', 62, 19], ['RB', 86, 24], ['LW', 14, 54], ['CM', 33, 49], ['DM', 50, 40], ['CM', 67, 49], ['RW', 86, 54], ['CF', 50, 80]],
  '4-1-4-1': [['GK', 50, 5], ['LB', 14, 24], ['CB', 38, 19], ['CB', 62, 19], ['RB', 86, 24], ['DM', 50, 36], ['LW', 14, 57], ['CM', 38, 54], ['CM', 62, 54], ['RW', 86, 57], ['CF', 50, 82]],
  '4-4-2 romb': [['GK', 50, 5], ['LB', 14, 24], ['CB', 38, 19], ['CB', 62, 19], ['RB', 86, 24], ['DM', 50, 36], ['CM', 30, 50], ['CM', 70, 50], ['AM', 50, 64], ['CF', 38, 82], ['CF', 62, 82]],
  '3-5-2': [['GK', 50, 5], ['CB', 28, 20], ['CB', 50, 17], ['CB', 72, 20], ['LB', 10, 46], ['CM', 35, 51], ['DM', 50, 38], ['CM', 65, 51], ['RB', 90, 46], ['CF', 38, 80], ['CF', 62, 80]],
  '3-4-3': [['GK', 50, 5], ['CB', 28, 20], ['CB', 50, 17], ['CB', 72, 20], ['LB', 12, 48], ['CM', 38, 46], ['CM', 62, 46], ['RB', 88, 48], ['LW', 18, 76], ['CF', 50, 83], ['RW', 82, 76]],
  '5-3-2': [['GK', 50, 5], ['LB', 10, 29], ['CB', 30, 19], ['CB', 50, 16], ['CB', 70, 19], ['RB', 90, 29], ['CM', 30, 49], ['DM', 50, 40], ['CM', 70, 49], ['CF', 38, 78], ['CF', 62, 78]],
  '5-4-1': [['GK', 50, 5], ['LB', 10, 29], ['CB', 30, 19], ['CB', 50, 16], ['CB', 70, 19], ['RB', 90, 29], ['LW', 14, 52], ['CM', 38, 46], ['CM', 62, 46], ['RW', 86, 52], ['CF', 50, 78]],
};
export const FORMATION_NAMES = Object.keys(FORMATIONS);

/** Wagi udziału pozycji w obronie / środku / ataku na podstawie głębokości ustawienia. */
export function slotWeights(y) {
  return {
    d: clamp((55 - y) / 30, 0, 1),
    m: clamp(1 - Math.abs(y - 48) / 26, 0, 1),
    a: clamp((y - 45) / 30, 0, 1),
  };
}

// Bazowe sumy wag (średnia ze wszystkich formacji) – normalizacja siły formacji.
export const UNIT_BASE = (() => {
  let d = 0, m = 0, a = 0;
  const fs = Object.values(FORMATIONS);
  for (const f of fs) {
    for (const [pos, , y] of f) {
      if (pos === 'GK') continue;
      const w = slotWeights(y);
      d += w.d; m += w.m; a += w.a;
    }
  }
  return { d: d / fs.length, m: m / fs.length, a: a / fs.length };
})();

export const STYLE_NAMES = ['bardzo defensywny', 'defensywny', 'normalny', 'ofensywny', 'bardzo ofensywny'];
export const PRESS_NAMES = ['niski', 'normalny', 'wysoki'];
export const TW_NAMES = ['nigdy', 'gdy prowadzimy', 'zawsze'];
export const TRAP_NAMES = ['nigdy', 'czasem', 'często'];

export const INSTR = {
  sh: { name: 'Strzały', opts: ['nigdy', 'czasem', 'często'], hint: 'Jak chętnie zawodnik oddaje strzały.' },
  dr: { name: 'Drybling', opts: ['nigdy', 'czasem', 'często'], hint: 'Indywidualne akcje: więcej szans, ale i strat.' },
  ps: { name: 'Podania', opts: ['krótkie', 'mieszane', 'długie'], hint: 'Długie podania przyspieszają grę kosztem celności.' },
  tk: { name: 'Odbiór piłki', opts: ['delikatny', 'normalny', 'ostry'], hint: 'Ostry odbiór to więcej przechwytów, fauli i kartek.' },
  dv: { name: 'Symulowanie fauli', opts: ['nigdy', 'czasem', 'często'], hint: 'Ryzyko żółtej kartki za symulację.' },
};
export const SP_ROLE_NAMES = ['nie bierze udziału', 'pole karne', 'wykonuje'];

export function defaultTactics(str = 70) {
  return { f: str >= 78 ? '4-3-3' : str >= 66 ? '4-2-3-1' : str >= 55 ? '4-4-2' : '4-5-1', style: 2, press: 1, tw: 0, trap: 0 };
}

export function defaultInstr(p, pos) {
  const a = p.a;
  const g = POS_GROUP[pos];
  let sh = 0, dr = 0, ps = 1;
  if (pos === 'CF') { sh = 2; dr = 1; ps = 0; }
  else if (pos === 'AM' || pos === 'LW' || pos === 'RW') { sh = a.sh >= 65 ? 2 : 1; dr = a.te >= 62 ? 2 : 1; ps = 0; }
  else if (pos === 'CM') { sh = 1; dr = a.te >= 70 ? 1 : 0; }
  else if (pos === 'DM') { sh = a.sh >= 70 ? 1 : 0; }
  else if (pos === 'GK') { ps = 2; }
  if (g === 'D') { sh = 0; dr = 0; }
  return { sh, dr, ps, tk: 1, dv: 0 };
}

const spScore = {
  pen: (p) => p.a.sh * 0.7 + p.a.te * 0.3,
  fkn: (p) => p.a.sh * 0.5 + p.a.te * 0.5,
  fkf: (p) => p.a.cr * 0.7 + p.a.te * 0.3,
  cor: (p) => p.a.cr * 0.75 + p.a.te * 0.25,
  air: (p) => p.a.hd * 0.7 + p.a.st * 0.3,
};

/** Domyślni wykonawcy stałych fragmentów oraz kapitan dla podanej jedenastki. */
export function defaultSetPieces(players) {
  const field = players.filter((p) => p.pos !== 'GK');
  const best = (fn, excl = []) => {
    let b = null, bs = -1;
    for (const p of field) {
      if (excl.includes(p.id)) continue;
      const s = fn(p);
      if (s > bs) { bs = s; b = p; }
    }
    return b ? b.id : null;
  };
  const pen = best(spScore.pen);
  const fkn = best(spScore.fkn);
  const fkf = best(spScore.fkf);
  const cor = best(spScore.cor);
  const takers = [fkf, cor];
  const box = field.filter((p) => !takers.includes(p.id)).sort((x, y) => spScore.air(y) - spScore.air(x)).slice(0, 4).map((p) => p.id);
  let cap = null, cs = -1;
  for (const p of players) {
    const s = p.a.ld + Math.min(p.caps, 100) * 0.15 + ovr(p) * 0.2;
    if (s > cs) { cs = s; cap = p.id; }
  }
  return { pen, fkn, fkf, cor, box, cap };
}

/** Czy zawodnik może zagrać (bez kontuzji i zawieszenia). */
export const available = (p) => p && !p.inj && !p.susp;

/** Ocena przydatności zawodnika na pozycji w dniu meczu. */
export function matchScore(p, pos) {
  return slotRating(p, pos) * stateFactor(p) * (0.85 + 0.15 * (p.cond / 100));
}

/** Automatyczny wybór jedenastki (zachłanny + poprawa zamianami). Zwraca tablicę 11 id. */
export function autoLineup(players, formation) {
  const slots = FORMATIONS[formation];
  const pool = players.filter(available);
  const n = slots.length;
  const res = new Array(n).fill(null);
  const used = new Set();
  const order = [...slots.keys()].sort((i, j) => scarcity(slots[i][0]) - scarcity(slots[j][0]));
  for (const i of order) {
    let best = null, bs = -1;
    for (const p of pool) {
      if (used.has(p.id)) continue;
      const s = matchScore(p, slots[i][0]);
      if (s > bs) { bs = s; best = p; }
    }
    if (best) { res[i] = best; used.add(best.id); }
  }
  // poprawa: zamiany par i zamiany z rezerwowymi
  for (let iter = 0; iter < 4; iter++) {
    let improved = false;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = res[i], b = res[j];
        if (!a || !b) continue;
        const cur = matchScore(a, slots[i][0]) + matchScore(b, slots[j][0]);
        const sw = matchScore(b, slots[i][0]) + matchScore(a, slots[j][0]);
        if (sw > cur + 0.01) { res[i] = b; res[j] = a; improved = true; }
      }
      for (const p of pool) {
        if (used.has(p.id)) continue;
        const cur = res[i] ? matchScore(res[i], slots[i][0]) : -1;
        const s = matchScore(p, slots[i][0]);
        if (s > cur + 0.01) {
          if (res[i]) used.delete(res[i].id);
          res[i] = p; used.add(p.id); improved = true;
        }
      }
    }
    if (!improved) break;
  }
  return res.map((p) => (p ? p.id : null));
}

function scarcity(pos) {
  return { GK: 0, CB: 1, LB: 2, RB: 2, DM: 3, CF: 4, CM: 5, LW: 6, RW: 6, AM: 7 }[pos] ?? 9;
}

/** Ławka rezerwowych: najlepsi pozostali, z bramkarzem. */
export function autoBench(players, lineupIds, size = 12) {
  const rest = players.filter((p) => available(p) && !lineupIds.includes(p.id));
  const gk = rest.filter((p) => p.pos === 'GK').sort((a, b) => ovr(b) - ovr(a));
  const out = rest.filter((p) => p.pos !== 'GK').sort((a, b) => ovr(b) - ovr(a));
  const bench = [];
  if (gk[0]) bench.push(gk[0].id);
  for (const p of out) { if (bench.length >= size) break; bench.push(p.id); }
  for (const p of gk.slice(1)) { if (bench.length >= size) break; bench.push(p.id); }
  return bench;
}

const SQUAD_QUOTA = [['GK', 3], ['CB', 4], ['LB', 2], ['RB', 2], ['DM', 2], ['CM', 3], ['AM', 1], ['W', 3], ['CF', 3]];

/** Powołania dla drużyny komputera (23 lub 26 zawodników). */
export function pickSquad(players, size = 23) {
  const pool = players.filter((p) => p.inj <= 10).sort((a, b) => squadValue(b) - squadValue(a));
  const chosen = new Set();
  const take = (pred, k) => {
    for (const p of pool) {
      if (k <= 0) break;
      if (!chosen.has(p.id) && pred(p)) { chosen.add(p.id); k--; }
    }
  };
  for (const [q, k] of SQUAD_QUOTA) {
    if (q === 'W') take((p) => p.pos === 'LW' || p.pos === 'RW', k);
    else take((p) => p.pos === q, k);
  }
  take((p) => p.pos !== 'GK', size - chosen.size);
  if (chosen.size < size) take(() => true, size - chosen.size);
  return [...chosen];
}

function squadValue(p) {
  return ovr(p) + p.form * 1.2 + (p.inj ? -15 : 0) + (p.age <= 20 ? -1 : 0);
}

/** Taktyka drużyny komputera dopasowana do rywala. */
export function aiTactics(base, myStr, oppStr) {
  const t = { ...base };
  const d = myStr - oppStr;
  t.style = d <= -15 ? 0 : d <= -5 ? 1 : d >= 15 ? 4 : d >= 5 ? 3 : 2;
  t.press = d >= 8 ? 2 : d <= -15 ? 0 : 1;
  t.trap = 0;
  t.tw = d <= -5 ? 1 : 0;
  if (d <= -12 && !['5-4-1', '5-3-2', '4-5-1'].includes(t.f)) t.f = wpick(['5-4-1', '4-5-1', '5-3-2'], () => 1);
  return t;
}

/** Średnia siła jedenastki (do porównań i oczekiwań). */
export function lineupStrength(players, lineupIds, formation) {
  const slots = FORMATIONS[formation];
  let s = 0, n = 0;
  lineupIds.forEach((id, i) => {
    const p = players.find((x) => x.id === id);
    if (p) { s += slotRating(p, slots[i][0]); n++; }
  });
  return n ? s / 11 : 0;
}

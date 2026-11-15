// Tryb zawodnika: stałe składy wszystkich klubów, statystyki zawodników w sezonie, relacje z kolegami z drużyny,
// wyścigi o nagrody w ligach i światowy ranking piłkarzy. Funkcje dostają stan kariery (st) jako parametr.
import { mkRng, rint, gauss, pick, clamp } from '../core/util.js';
import { NAT, NATIONS } from '../data/nations.js';
import { genName } from '../engine/db.js';
import { POS_GROUP, ovr } from '../engine/player.js';

/** Skład klubu: 18 zawodników. */
const LAYOUT = ['GK', 'GK', 'CB', 'CB', 'CB', 'LB', 'RB', 'DM', 'CM', 'CM', 'AM', 'LW', 'RW', 'CF', 'CF']; // minimum pozycji w kadrze
const EXTRA = [['CB', 'LB', 'RB'], ['DM', 'CM', 'AM'], ['LW', 'RW', 'CF']];
/** Ustawienie 4-3-3 do wyboru jedenastki w meczach symulowanych. */
const XI = ['GK', 'LB', 'CB', 'CB', 'RB', 'DM', 'CM', 'AM', 'LW', 'CF', 'RW'];
const GOAL_W = { GK: 0, CB: 0.45, LB: 0.4, RB: 0.4, DM: 0.7, CM: 1.3, AM: 2.6, LW: 3, RW: 3, CF: 5 };
const AST_W = { GK: 0.05, CB: 0.4, LB: 1.3, RB: 1.3, DM: 1.1, CM: 2.3, AM: 3.6, LW: 3.2, RW: 3.2, CF: 2 };
const EU_NATS = NATIONS.filter((n) => n.conf === 'EU').map((n) => n.id);
export const ME = 'me';

const emptyS = () => ({ ap: 0, g: 0, a: 0, cs: 0, rs: 0 });
/** Statystyki zawodnika w rozgrywkach: 'lg' liga (p.s), 'cup' puchar kraju, 'ucl', 'usl', 'ulg', 'unl' (p.sc). */
export const statsOf = (p, key = 'lg') => (key === 'lg' ? p.s : (p.sc && p.sc[key]) || emptyS());
/** Wszystkie mecze sezonu: liga i puchary razem. */
export function totalStats(p) {
  const t = { ...p.s };
  for (const x of Object.values(p.sc || {})) { t.ap += x.ap; t.g += x.g; t.a += x.a; t.cs += x.cs; t.rs += x.rs; }
  return t;
}

function newPlayer(st, cid, pos, o, age, r) {
  const c = st.clubs[cid];
  // większość zawodników z kraju klubu, w mocnych klubach więcej obcokrajowców
  const foreign = r() < (c.lv >= 80 ? 0.4 : c.lv >= 70 ? 0.25 : 0.12);
  const nat = foreign ? pick(EU_NATS.filter((x) => x !== c.nat), r) || c.nat : c.nat;
  const nm = genName(NAT[nat], r);
  const id = st.plSeq++;
  const p = { id, fn: nm.fn, ln: nm.ln, pos, age, o: Math.round(clamp(o, 30, 95)), nat, c: cid, s: emptyS(), t: { ap: 0, g: 0, a: 0 } };
  p.pt = Math.round(clamp(Math.max(p.o, p.o + (27 - age) * 1.6 + gauss(r) * 4), 30, 96));
  st.pl[id] = p;
  return p;
}

/** Tworzy składy wszystkich klubów (nowa kariera albo zapis sprzed 0.9.9). */
export function ensureRosters(st) {
  if (!st.pl || !st.ros) { st.pl = {}; st.ros = {}; st.plSeq = 1000; }
  st.rel = st.rel || {};
  seasonRosters(st);
}

/** Kadra jednego klubu (tworzona, gdy jest potrzebna: wejście na stronę klubu, mecz, transfer). */
export function ensureClub(st, cid) {
  if (!st.pl || cid == null || !st.clubs[cid] || st.ros[cid]) return;
  const c = st.clubs[cid];
  const r = mkRng(c.id * 7919 + st.year * 31 + 5);
  const ids = [];
  // jedenastka na poziomie klubu, ławka nieco słabsza
  const bench = ['GK', 'CB', pick(EXTRA[0], r), 'CM', pick(EXTRA[1], r), pick(EXTRA[2], r), 'CF'];
  XI.forEach((pos) => ids.push(newPlayer(st, c.id, pos, c.lv + gauss(r) * 3.2, rint(19, 33, r), r).id));
  bench.forEach((pos) => ids.push(newPlayer(st, c.id, pos, c.lv - 4 + gauss(r) * 3.2, rint(18, 32, r), r).id));
  st.ros[c.id] = ids;
}

/** Pełne kadry wszystkich klubów na świecie (także nowych klubów po rozbudowie świata). */
export function seasonRosters(st) {
  if (!st.pl) return;
  for (const c of st.clubs) ensureClub(st, c.id);
}

export const rosterOf = (st, cid) => (st.ros[cid] || []).map((id) => st.pl[id]).filter(Boolean);

/** Najlepsza jedenastka klubu w ustawieniu 4-3-3 (bez zawodnika gracza). */
export function lineupOf(st, cid) {
  const left = rosterOf(st, cid).slice().sort((a, b) => b.o - a.o);
  const out = [];
  for (const pos of XI) {
    let i = left.findIndex((p) => p.pos === pos);
    if (i < 0) i = left.findIndex((p) => POS_GROUP[p.pos] === POS_GROUP[pos] && p.pos !== 'GK');
    if (i < 0) i = left.findIndex((p) => pos === 'GK' || p.pos !== 'GK');
    if (i < 0) continue;
    out.push(left[i]); left.splice(i, 1);
  }
  return out;
}

function wPick(list, wf) {
  const tot = list.reduce((s, p) => s + wf(p), 0);
  let u = Math.random() * tot;
  for (const p of list) { u -= wf(p); if (u <= 0) return p; }
  return list[list.length - 1];
}

/**
 * Statystyki zawodników za jeden mecz klubu. gf/ga: bramki drużyny. opts.skip: liczba goli i asyst, które zdobył
 * zawodnik gracza (nie rozdzielamy ich innym). opts.live: { pid: { g, a, r, cs } } z meczu 2D (dokładne dane).
 */
export function teamMatchStats(st, cid, gf, ga, opts = {}) {
  if (!st.pl || !st.ros[cid]) return [];
  const lv = st.clubs[cid].lv;
  let xi;
  if (opts.live) xi = Object.keys(opts.live).map((id) => st.pl[id]).filter((p) => p && p.c === cid);
  else {
    xi = lineupOf(st, cid);
    if (opts.meIn) {
      // zawodnik gracza zajmuje miejsce kolegi na swojej pozycji
      const i = xi.findIndex((p) => p.pos === opts.mePos);
      xi.splice(i >= 0 ? i : xi.length - 1, 1);
    }
    // czasem ktoś odpoczywa: zmiennik z ławki
    if (Math.random() < 0.4) {
      const bench = rosterOf(st, cid).filter((p) => !xi.includes(p));
      const k = rint(1, xi.length - 1);
      const sub = bench.find((p) => POS_GROUP[p.pos] === POS_GROUP[xi[k].pos]);
      if (sub) xi[k] = sub;
    }
  }
  if (!xi.length) return [];
  const rec = Object.fromEntries(xi.map((p) => [p.id, { g: 0, a: 0 }]));
  if (opts.live) for (const p of xi) { rec[p.id].g = opts.live[p.id].g || 0; rec[p.id].a = opts.live[p.id].a || 0; }
  else {
    // gole zawodnika gracza są już policzone; jego asysty przypadają na gole kolegów
    const goals = Math.max(0, gf - (opts.skipG || 0));
    const myA = opts.skipA || 0;
    for (let i = 0; i < goals; i++) {
      const sc = wPick(xi, (p) => GOAL_W[p.pos] * Math.pow(p.o / 70, 3) + 0.02);
      rec[sc.id].g++;
      if (i < myA) continue;
      if (Math.random() < 0.72) {
        const as = wPick(xi.filter((p) => p !== sc), (p) => AST_W[p.pos] * Math.pow(p.o / 70, 3) + 0.02);
        if (as) rec[as.id].a++;
      }
    }
  }
  const res = gf > ga ? 0.35 : gf < ga ? -0.35 : 0;
  const key = opts.key || 'lg';
  for (const p of xi) {
    let s = p.s;
    if (key !== 'lg') { p.sc = p.sc || {}; s = p.sc[key] = p.sc[key] || emptyS(); }
    const x = rec[p.id];
    s.ap++; s.g += x.g; s.a += x.a;
    const def = p.pos === 'GK' || POS_GROUP[p.pos] === 'D';
    if (ga === 0 && def) s.cs++;
    let r;
    if (opts.live && opts.live[p.id].r != null) r = opts.live[p.id].r;
    else r = 6.55 + res + x.g * 0.85 + x.a * 0.5 + (def ? (ga === 0 ? 0.45 : -0.12 * Math.min(ga, 4)) : 0) + (p.o - lv) * 0.035 + gauss() * 0.42;
    s.rs = Math.round((s.rs + clamp(r, 4, 10)) * 10) / 10;
  }
  return xi;
}

/** Relacje z kolegami po meczu: im więcej wspólnych meczów, tym lepsza relacja. */
export function relAfterMatch(st, mates, extra = {}) {
  st.rel = st.rel || {};
  for (const p of mates) {
    const v = st.rel[p.id] || 0;
    // przyrost maleje przy wysokich relacjach; wspólne akcje (podania do mnie, asysty) dają więcej
    const add = (2.4 + (extra[p.id] || 0)) * (1 - v / 120);
    st.rel[p.id] = Math.round(clamp(v + add, 0, 100) * 10) / 10;
  }
}

export const REL_LEVELS = [[80, 'Przyjaciel'], [60, 'Dobry kumpel'], [40, 'Kolega'], [20, 'Znajomy'], [0, 'Nowy w drużynie']];
export const relLabel = (v) => (REL_LEVELS.find(([t]) => (v || 0) >= t) || REL_LEVELS[4])[1];

// ---------------------------------------------------------------------
// koniec sezonu: wiek, rozwój, emerytury, młodzi zawodnicy, transfery między klubami
// ---------------------------------------------------------------------
export function rosterSeasonEnd(st) {
  if (!st.pl) return { moves: {} };
  const moves = {};
  const note = (cid, p) => { (moves[cid] = moves[cid] || []).push(p); };
  for (const p of Object.values(st.pl)) {
    const tt = totalStats(p);
    p.t.ap += tt.ap; p.t.g += tt.g; p.t.a += tt.a;
    delete p.sc;
    p.s = emptyS();
    p.age++;
    const grow = p.age <= 21 ? 2.4 : p.age <= 24 ? 1.3 : p.age <= 28 ? 0.3 : p.age <= 31 ? -0.8 : -2.2;
    const room = p.pt - p.o;
    p.o = Math.round(clamp(p.o + (grow > 0 ? Math.min(grow + gauss() * 1.2, Math.max(0, room)) : grow + gauss() * 1), 30, 95));
  }
  // emerytury i nowi zawodnicy na ich miejsce
  for (const c of st.clubs) {
    if (!st.ros[c.id]) continue;
    const ids = st.ros[c.id];
    st.ros[c.id] = ids.filter((id) => {
      const p = st.pl[id];
      if (p.age >= 32 && Math.random() < (p.age - 31) * 0.18) { delete st.pl[id]; delete st.rel[id]; return false; }
      return true;
    });
  }
  // najlepsi zawodnicy słabszych klubów przechodzą do mocniejszych
  const all = Object.values(st.pl);
  for (const p of all) {
    const from = st.clubs[p.c];
    if (!from || p.o < from.lv + 3 || Math.random() > 0.35) continue;
    const to = st.clubs.filter((c) => st.ros[c.id] && c.lv > from.lv + 2 && c.lv <= p.o + 3 && st.ros[c.id].length < 22);
    if (!to.length) continue;
    const dst = pick(to);
    st.ros[from.id] = st.ros[from.id].filter((x) => x !== p.id);
    st.ros[dst.id].push(p.id);
    p.c = dst.id;
    delete st.rel[p.id];
    note(dst.id, p);
  }
  // uzupełnienie składów do 18 i normalizacja do siły klubu
  for (const c of st.clubs) {
    if (!st.ros[c.id]) continue;
    const r = Math.random;
    const ros = rosterOf(st, c.id);
    // zbyt duża kadra: odchodzą najsłabsi (do niższych lig, poza grę)
    if (ros.length > 20) {
      ros.sort((a, b) => a.o - b.o);
      for (const p of ros.slice(0, ros.length - 20)) { delete st.pl[p.id]; delete st.rel[p.id]; }
      st.ros[c.id] = st.ros[c.id].filter((id) => st.pl[id]);
    }
    while (st.ros[c.id].length < 18) {
      const have = rosterOf(st, c.id);
      const need = LAYOUT.find((pos) => have.filter((p) => p.pos === pos).length < LAYOUT.filter((x) => x === pos).length) || pick(XI);
      const young = r() < 0.55;
      const p = newPlayer(st, c.id, need, c.lv + (young ? -7 : -2) + gauss(r) * 3, young ? rint(17, 20, r) : rint(22, 30, r), r);
      st.ros[c.id].push(p.id);
      note(c.id, p);
    }
    normalizeClub(st, c.id);
  }
  return { moves };
}

/** Średnia najlepszej jedenastki podąża za siłą klubu (wyniki i transfery zmieniają siłę). */
export function normalizeClub(st, cid) {
  const xi = lineupOf(st, cid);
  if (!xi.length) return;
  const m = xi.reduce((s, p) => s + p.o, 0) / xi.length;
  const d = (st.clubs[cid].lv - m) * 0.85;
  if (Math.abs(d) < 0.5) return;
  for (const p of rosterOf(st, cid)) { p.o = Math.round(clamp(p.o + d, 30, 95)); p.pt = Math.max(p.pt, p.o); }
}

// ---------------------------------------------------------------------
// wyścigi o nagrody i ranking piłkarzy
// ---------------------------------------------------------------------
const avg = (s) => (s.ap ? s.rs / s.ap : 0);

/** Wiersz zawodnika gracza w rankingach. key: rozgrywki ('lg', 'cup', 'ucl'...) albo 'all' (cały sezon). */
export function meRow(st, key = 'all') {
  const p = st.me, ss = st.ss || {};
  const all = { ap: ss.apps || 0, g: ss.goals || 0, a: ss.assists || 0, cs: ss.cleanSheets || 0, rs: ss.rsum || 0 };
  // zapisy sprzed 1.0.1 nie mają statystyk osobno dla rozgrywek: liga = cały sezon
  const s = key === 'all' ? all : ss.comp ? { ...emptyS(), ...(ss.comp[key] || {}) } : key === 'lg' ? all : emptyS();
  return { id: ME, me: true, fn: p.fn, ln: p.ln, pos: p.pos, age: p.age, o: Math.round(ovr(p)), nat: p.nat, c: st.club, s };
}

/** Zawodnicy rozgrywek ze statystykami z tych rozgrywek (z zawodnikiem gracza, jeśli jego klub w nich gra). */
export function compPlayers(st, teams, key) {
  const out = [];
  for (const cid of teams) for (const p of rosterOf(st, cid)) out.push({ id: p.id, fn: p.fn, ln: p.ln, pos: p.pos, age: p.age, o: p.o, nat: p.nat, c: p.c, s: statsOf(p, key) });
  if (teams.includes(st.club)) out.push(meRow(st, key));
  return out;
}

/** Wszystkie rozgrywki z nagrodami indywidualnymi: ligi, puchary europejskie, Unova League i puchary krajowe. */
export function awardComps(st, names) {
  const out = [];
  for (const L of Object.values(st.leagues)) out.push({ id: `L:${L.key}`, name: names.league(L), teams: L.teams, key: 'lg', nat: L.nat, kind: 'league' });
  for (const [k, E] of Object.entries(st.euro || {})) out.push({ id: `E:${k}`, name: E.name, teams: E.teams, key: k, kind: k === 'unl' ? 'world' : 'euro' });
  const cups = st.cups ? Object.values(st.cups) : st.cup ? [st.cup] : [];
  for (const c of cups) out.push({ id: `C:${c.nat}`, name: `Puchar ${NAT[c.nat].name}`, teams: c.teams || [...new Set([...(st.leagues[`${c.nat}-1`] || { teams: [] }).teams, ...c.alive])], key: 'cup', nat: c.nat, kind: 'cup' });
  return out;
}

export const AWARDS = [
  { k: 'top', n: 'Król strzelców', ic: '⚽', val: (p) => p.s.g, fmt: (p) => `${p.s.g} goli`, ok: () => true, tie: (p) => avg(p.s) },
  { k: 'ast', n: 'Król asyst', ic: '🅰️', val: (p) => p.s.a, fmt: (p) => `${p.s.a} asyst`, ok: () => true, tie: (p) => avg(p.s) },
  { k: 'mvp', n: 'Piłkarz sezonu', ic: '🏆', val: (p) => avg(p.s) + (p.s.g + p.s.a * 0.6) * 0.012, fmt: (p) => `ocena ${avg(p.s).toFixed(2)}`, ok: (p, n) => p.s.ap >= n * 0.5 },
  { k: 'gk', n: 'Najlepszy bramkarz', ic: '🧤', val: (p) => p.s.cs + avg(p.s) * 0.1, fmt: (p) => `${p.s.cs} czystych kont`, ok: (p, n) => p.pos === 'GK' && p.s.ap >= n * 0.4 },
  { k: 'def', n: 'Najlepszy obrońca', ic: '🛡️', val: (p) => avg(p.s), fmt: (p) => `ocena ${avg(p.s).toFixed(2)}`, ok: (p, n) => POS_GROUP[p.pos] === 'D' && p.s.ap >= n * 0.5 },
  { k: 'mid', n: 'Najlepszy pomocnik', ic: '🎯', val: (p) => avg(p.s), fmt: (p) => `ocena ${avg(p.s).toFixed(2)}`, ok: (p, n) => POS_GROUP[p.pos] === 'M' && p.s.ap >= n * 0.5 },
  { k: 'fwd', n: 'Najlepszy napastnik', ic: '🔥', val: (p) => avg(p.s) + p.s.g * 0.01, fmt: (p) => `ocena ${avg(p.s).toFixed(2)}`, ok: (p, n) => POS_GROUP[p.pos] === 'A' && p.s.ap >= n * 0.5 },
  { k: 'yng', n: 'Młodzieżowiec sezonu', ic: '🌱', val: (p) => avg(p.s) + (p.s.g + p.s.a * 0.6) * 0.012, fmt: (p) => `ocena ${avg(p.s).toFixed(2)}`, ok: (p, n) => p.age <= 21 && p.s.ap >= n * 0.4 },
];

/** Wyścig o nagrodę w rozgrywkach comp (z awardComps): posortowana lista. Próg meczów liczony od zawodnika
 *  z największą liczbą występów w tych rozgrywkach. players: gotowa lista z compPlayers (opcjonalnie). */
export function awardRace(st, comp, aw, n = 10, players = null) {
  const all = players || compPlayers(st, comp.teams, comp.key);
  const played = Math.max(1, ...all.map((p) => p.s.ap));
  const list = all.filter((p) => aw.ok(p, played) && (aw.val(p) > 0));
  list.sort((a, b) => aw.val(b) - aw.val(a) || (aw.tie ? aw.tie(b) - aw.tie(a) : 0));
  return list.slice(0, n);
}

/** Punkty w światowym rankingu piłkarzy: umiejętności i forma w sezonie (oceny, gole, asysty, czyste konta). */
export function rankScore(st, p) {
  const s = p.me ? p.s : totalStats(p), a = avg(s);
  const lv = st.clubs[p.c] ? st.clubs[p.c].lv : 60;
  // forma w sezonie liczy się w pełni po ok. 8 meczach; gole i asysty dają dodatkowe punkty
  const perf = s.ap ? (a - 6.6) * 8 + s.g * 0.35 + s.a * 0.25 + (p.pos === 'GK' ? s.cs * 0.3 : 0) : 0;
  return Math.round((p.o + perf * Math.min(1, s.ap / 8) + (lv - 75) * 0.1) * 10);
}

export function globalRanking(st, n = 100) {
  const all = Object.values(st.pl).concat([meRow(st, 'all')]);
  // wstępne odsianie: tylko najlepsi (oszczędność przy kilku tysiącach zawodników)
  const pre = all.filter((p) => p.me || p.o >= 70);
  return pre.map((p) => ({ p, sc: rankScore(st, p) })).sort((a, b) => b.sc - a.sc).slice(0, n);
}

/** Nagrody za miejsce w światowym rankingu na koniec sezonu. */
export function globalAwardFor(place) {
  if (place === 1) return 'Złota Piłka';
  if (place === 2) return 'Srebrna Piłka';
  if (place === 3) return 'Brązowa Piłka';
  if (place <= 10) return 'Światowa dziesiątka';
  if (place <= 30) return 'Światowa trzydziestka';
  if (place <= 100) return 'Światowa setka';
  return null;
}
export const GLOBAL_AWARDS = [
  [1, 'Złota Piłka', '🥇'], [2, 'Srebrna Piłka', '🥈'], [3, 'Brązowa Piłka', '🥉'],
  ['4–10', 'Światowa dziesiątka', '⭐'], ['11–30', 'Światowa trzydziestka', '✨'], ['31–100', 'Światowa setka', '🌍'],
];

// ---------------------------------------------------------------------
// informacje o klubie (stałe, z ziarna klubu)
// ---------------------------------------------------------------------
export function clubInfo(st, cid) {
  const c = st.clubs[cid];
  const r = mkRng(cid * 104729 + 17);
  const founded = rint(1878, 1965, r);
  const cap = Math.round((4000 + Math.pow(Math.max(0, c.lv - 40), 2.15) * 18 + r() * 6000) / 500) * 500;
  const coach = genName(NAT[c.nat], r);
  const words = c.n.split(' ');
  const base = words.find((w) => w.length > 3 && /^[A-ZŁŚŻŹĆ]/.test(w) && !['Real', 'Sporting', 'Athletic', 'Racing', 'United', 'City'].includes(w)) || words[words.length - 1];
  const stadium = pick([`Stadion Miejski ${base}`, `Arena ${base}`, `Park ${base}`, `Stadion ${base}`, `Estadio ${base}`], r);
  const nick = pick(['Lwy', 'Orły', 'Wilki', 'Sokoły', 'Niedźwiedzie', 'Smoki', 'Rycerze', 'Gwiazdy', 'Byki', 'Jastrzębie'], r);
  // dawne trofea: mocne kluby mają bogatszą historię
  const hist = st.hist && st.hist[cid] ? st.hist[cid] : null;
  const old = { league: Math.max(0, Math.round((c.lv - 74) / 2.2 + r() * 3 - 1)), cup: Math.max(0, Math.round((c.lv - 70) / 2.5 + r() * 3 - 1)), euro: Math.max(0, Math.round((c.lv - 84) / 2 + r() * 1.5 - 0.6)) };
  return { founded, cap, coach: `${coach.fn} ${coach.ln}`, stadium, nick, titles: {
    league: old.league + (hist ? hist.league || 0 : 0), cup: old.cup + (hist ? hist.cup || 0 : 0), euro: old.euro + (hist ? hist.euro || 0 : 0), world: hist ? hist.world || 0 : 0,
  } };
}

/** Zapis trofeów zdobytych w trakcie kariery (dla wszystkich klubów). */
export function addHist(st, cid, k) {
  st.hist = st.hist || {};
  const h = (st.hist[cid] = st.hist[cid] || {});
  h[k] = (h[k] || 0) + 1;
}

/** Wartość rynkowa zawodnika w euro (z umiejętności i wieku). */
export function marketValue(p) {
  const ageK = p.age <= 21 ? 1.35 : p.age <= 25 ? 1.2 : p.age <= 29 ? 1 : p.age <= 32 ? 0.6 : 0.3;
  const v = Math.pow(1.17, (p.o - 50)) * 60000 * ageK;
  return v >= 1e6 ? Math.round(v / 1e5) * 1e5 : Math.round(v / 1e4) * 1e4;
}
export const fmtMoney = (v) => (v >= 1e6 ? `${(v / 1e6).toFixed(v >= 1e7 ? 0 : 1).replace('.', ',')} mln €` : `${Math.round(v / 1000)} tys. €`);

/** Zimowe wzmocnienia: nowi zawodnicy w miejsce najsłabszych na tej samej formacji. */
export function signPlayers(st, cid, n) {
  if (!st.pl) return [];
  const c = st.clubs[cid], out = [];
  for (let i = 0; i < n; i++) {
    const ros = rosterOf(st, cid).filter((p) => p.pos !== 'GK').sort((a, b) => a.o - b.o);
    const gone = ros[0];
    if (!gone) break;
    st.ros[cid] = st.ros[cid].filter((x) => x !== gone.id);
    delete st.pl[gone.id]; delete st.rel[gone.id];
    const p = newPlayer(st, cid, gone.pos, c.lv + gauss() * 2.5, rint(20, 30), Math.random);
    st.ros[cid].push(p.id);
    out.push(p);
  }
  return out;
}

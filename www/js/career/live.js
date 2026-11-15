// Tryb zawodnika: mecz 2D ze sterowaniem własną postacią. Buduje składy obu drużyn dla silnika LiveMatch
// (zawodnicy z umiejętnościami według siły klubu lub reprezentacji) i przenosi wynik meczu do kariery.
import { mkRng, rint, gauss } from '../core/util.js';
import { NAT } from '../data/nations.js';
import { makePlayer } from '../engine/db.js';
import { FORMATIONS, defaultTactics, defaultSetPieces } from '../engine/tactics.js';
import { AI_TRAIN } from '../engine/training.js';
import { LiveMatch } from '../engine/sim.js';
import { PC, finishMatch } from './engine.js';
import { rosterOf } from './rosters.js';
import { POS_GROUP } from '../engine/player.js';

export const USER_PID = 1;
export const BODY_R = 1.0;
const BENCH_POS = ['GK', 'CB', 'LB', 'DM', 'CM', 'LW', 'CF'];

function formationFor(pos) {
  for (const f of ['4-3-3', '4-4-2', '4-2-3-1']) if (FORMATIONS[f].some((s) => s[0] === pos)) return f;
  return '4-3-3';
}

/** Skład drużyny: stały w danym sezonie (ziarno z klucza drużyny i roku). */
function squad(key, natId, str, base, f, r0) {
  const r = mkRng(r0);
  const tmp = { players: {}, nextPid: base };
  const slots = FORMATIONS[f].map((s) => s[0]);
  const lineup = slots.map((pos) => {
    const p = makePlayer(tmp, natId, pos, Math.max(30, str + gauss(r) * 3.2), rint(19, 33, r), r);
    delete p._o; p.cond = 92 + rint(0, 8, r); p.form = rint(-1, 1, r);
    return p.id;
  });
  const bench = BENCH_POS.map((pos) => { const p = makePlayer(tmp, natId, pos, Math.max(28, str - 4 + gauss(r) * 3), rint(18, 32, r), r); delete p._o; p.cond = 96; return p.id; });
  return { players: tmp.players, lineup, bench };
}

/** Skład klubu z jego stałej kadry: ci sami zawodnicy (imiona, pozycje, umiejętności) co na ekranie Klub. */
function clubSquad(cid, f) {
  const ros = rosterOf(PC, cid).slice().sort((a, b) => b.o - a.o);
  if (ros.length < 11) return null;
  const tmp = { players: {}, nextPid: 0 };
  const mk = (rp, pos) => {
    tmp.nextPid = rp.id;
    const p = makePlayer(tmp, rp.nat, rp.pos, rp.o, rp.age, mkRng(rp.id * 2654435761 % 2147483647 + 7));
    delete p._o;
    p.fn = rp.fn; p.ln = rp.ln; p.cond = 94; p.form = 0;
    if (pos && pos !== rp.pos && !p.alt.includes(pos)) p.alt.push(pos);
    return p.id;
  };
  const left = ros.slice();
  const take = (pos) => {
    let i = left.findIndex((p) => p.pos === pos);
    if (i < 0) i = left.findIndex((p) => POS_GROUP[p.pos] === POS_GROUP[pos] && p.pos !== 'GK');
    if (i < 0) i = left.findIndex((p) => (pos === 'GK') === (p.pos === 'GK'));
    if (i < 0) i = 0;
    return left.splice(i, 1)[0];
  };
  const lineup = FORMATIONS[f].map((s) => { const rp = take(s[0]); return mk(rp, s[0]); });
  const bench = left.slice(0, 7).map((rp) => mk(rp));
  return { players: tmp.players, lineup, bench };
}

function hashKey(k) { let h = 0; for (const c of String(k)) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); }

/** Specyfikacje obu drużyn dla meczu z kariery (M z setupMatch). */
export function liveSpecs(M) {
  const me = PC.me;
  const nat = M.comp === 'intl' || M.comp === 'tour';
  const usNat = nat ? M.usKey : PC.clubs[M.usKey].nat;
  const themNat = nat ? M.themKey : PC.clubs[M.themKey].nat;
  const fUs = formationFor(me.pos);
  const tUs = { ...defaultTactics(M.usStr), f: fUs };
  const tThem = defaultTactics(M.themStr);
  const us = (!nat && PC.pl && clubSquad(M.usKey, fUs)) || squad(M.usKey, usNat, M.usStr, 100, fUs, hashKey(`${M.usKey}:${PC.year}`));
  const them = (!nat && PC.pl && clubSquad(M.themKey, tThem.f)) || squad(M.themKey, themNat, M.themStr, 300, tThem.f, hashKey(`${M.themKey}:${PC.year}`));
  // zawodnik gracza: w wyjściowym składzie na swojej pozycji albo na ławce (wejdzie z niej)
  const meP = { ...me, id: USER_PID, a: { ...me.a } };
  us.players[USER_PID] = meP;
  if (M.role === 'start') {
    const i = FORMATIONS[fUs].findIndex((s) => s[0] === me.pos);
    us.lineup[i >= 0 ? i : 1] = USER_PID;
  } else us.bench.unshift(USER_PID);
  const mk = (sq, t, name, nid, home) => ({
    nid, name, players: sq.players, lineup: sq.lineup, bench: sq.bench, tac: t, instr: {},
    sp: defaultSetPieces(sq.lineup.map((id) => sq.players[id])), train: AI_TRAIN, home, ai: true,
  });
  const usSpec = mk(us, tUs, M.usName, usNat, M.home);
  const themSpec = mk(them, tThem, M.themName, themNat, !M.home);
  const userSide = M.home ? 0 : 1;
  return { home: M.home ? usSpec : themSpec, away: M.home ? themSpec : usSpec, userSide };
}

/** Tworzy mecz 2D. Zwraca { sim, userSide }. */
export function createLive(M) {
  const { home, away, userSide } = liveSpecs(M);
  const sim = new LiveMatch(home, away, { neutral: M.comp === 'tour' });
  sim.userSide = userSide;
  sim.ctrlPid = USER_PID;
  sim.bodyR = BODY_R; // promień sylwetki: zderzenia przy styku krawędzi

  sim.ctrl = sim.agentOf(userSide, USER_PID);
  // relacje z kolegami: lepsza relacja, częstsze podania do mnie
  sim.ctrlRel = PC.rel || {};
  // kto mi podawał (wspólne akcje poprawiają relację)
  sim.recvFrom = {};
  const prev = sim.onEvent;
  sim.onEvent = (t, d) => {
    if (t === 'received' && d && d.a && d.a.pid === USER_PID && d.by && d.by.pid !== USER_PID) sim.recvFrom[d.by.pid] = (sim.recvFrom[d.by.pid] || 0) + 1;
    if (prev) prev(t, d);
  };
  return { sim, userSide };
}

/** Wejście z ławki w wyznaczonej minucie (rola rezerwowego). */
export function liveSubCheck(M, sim, userSide) {
  if (M.role !== 'sub' || M.subDone) return;
  const minute = Math.floor(sim.clk / 60);
  if (minute < M.enter) return;
  const S = sim.sides[userSide];
  const pos = PC.me.pos;
  const cands = S.on.filter((x) => x && x.pid !== USER_PID && x.pos !== 'GK');
  const out = cands.find((x) => x.pos === pos) || cands.sort((a, b) => (S.st[a.pid] ?? 90) - (S.st[b.pid] ?? 90))[0];
  if (out && sim.sub(userSide, out.pid, USER_PID)) M.subDone = true;
}

/** Przenosi wynik meczu 2D do kariery i wywołuje standardowe rozliczenie meczu. */
export function finishLive(M, sim, userSide) {
  const S = sim.sides[userSide], T = sim.sides[1 - userSide];
  M.goals = [S.goals, T.goals];
  const ps = S.ps[USER_PID];
  const played = !!(ps && ps.on != null);
  if (played) {
    const r = sim.liveRating(userSide, USER_PID);
    M.rating = Math.round((r ?? 6.4) * 10) / 10;
    M.my.g = ps.g || 0; M.my.a = ps.a || 0; M.my.yc = ps.yc || 0; M.my.rc = ps.rc || 0;
    M.enter = Math.min(89, Math.round(ps.on || 0));
    M.leave = ps.off != null ? Math.round(ps.off) : 99;
    M.role = M.enter > 0 ? 'sub' : 'start';
    M.my.ok = (ps.tk || 0) + (ps.kp || 0) + (ps.sot || 0);
    M.my.bad = Math.max(0, (ps.sh || 0) - (ps.sot || 0));
  } else {
    M.role = 'out';
    M.rating = null;
  }
  M.live = true;
  // dokładne statystyki zawodników z meczu 2D (tylko kluby: zawodnicy ze stałych kadr)
  const nat = M.comp === 'intl' || M.comp === 'tour';
  if (!nat && PC.pl) {
    const grab = (side) => {
      const out = {}, X = sim.sides[side];
      for (const [pid, q] of Object.entries(X.ps)) {
        if (+pid === USER_PID || q.on == null || !PC.pl[pid]) continue;
        const r = sim.liveRating(side, +pid);
        out[pid] = { g: q.g || 0, a: q.a || 0, r: r != null ? Math.round(r * 10) / 10 : null };
      }
      return out;
    };
    M.liveUs = grab(userSide); M.liveThem = grab(1 - userSide);
    M.relExtra = Object.fromEntries(Object.entries(sim.recvFrom || {}).map(([pid, n]) => [pid, Math.min(3, n * 0.4)]));
  }
  return finishMatch(M);
}

// Stan gry, upływ czasu i wszystkie decyzje menedżerskie.
import { mkDay, ymd, rint, chance, pick, shuffle, clamp, hashStr, mkRng, fmtDate, fmtDateLong, plural } from '../core/util.js';
import { NATIONS, NAT } from '../data/nations.js';
import { fullName } from '../data/names.js';
import { ACH } from '../data/achievements.js';
import { QUESTIONS, OUTLETS, GREETINGS, GREET_ANSWERS } from '../data/press.js';
import { generateWorld, applyOverrides, DEFAULT_SEED, genName, makeYouth, assignClub, attrRng } from './db.js';
import { ovr, developMonthly, POS_GROUP, clubStatusFor, CLUB_STATUS, extendAttrs } from './player.js';
import { FORMATIONS, defaultTactics, autoLineup, autoBench, defaultSetPieces, pickSquad, aiTactics, available, matchScore } from './tactics.js';
import { Match } from './match.js';
import { LiveMatch } from './sim.js';
import { initRanking, updateRanking, rankPositions, expected } from './ranking.js';
import {
  windowsForYear, createLN, checkLN, createQualifiers, checkQual, createFinals, checkFinals, addFriendly, hasFixture,
  fxById, resetFxIndex, pickHosts, standings, stillIn, WINDOW_NAMES, fixtureStage,
} from './comps.js';

export let G = null;
const hooks = { achieve: null };
export function setHooks(h) { Object.assign(hooks, h); }

const winCache = new Map();
export function setGame(g) { G = g; migrate(g); resetFxIndex(); winCache.clear(); }

/** Uzupełnia starsze zapisy o nowe umiejętności zawodników (ta sama metoda co przy tworzeniu świata). */
function migrate(g) {
  if (!g || !g.players) return;
  for (const p of Object.values(g.players)) if (p && p.a && (p.a.dr == null || p.a.ant == null || p.h == null)) extendAttrs(p, attrRng(p.id));
}

export const TRAIN_KEYS = ['cond', 'poss', 'sp', 'off', 'def', 'ment'];
export const TRAIN_NAMES = { cond: 'Kondycja', poss: 'Posiadanie piłki', sp: 'Stałe fragmenty gry', off: 'Ofensywa', def: 'Defensywa', ment: 'Przygotowanie mentalne' };
export const TRAIN_BUDGET = 30;
const SACK = [9, 15, 22];
const NEG = [0.7, 1, 1.35];

export const me = () => (G && !G.user.unemployed ? G.user.nat : null);
export const natName = (id) => (NAT[id] ? NAT[id].name : id);
export const poolOf = (nid) => (G.nats[nid].pool || []).map((id) => G.players[id]).filter(Boolean);
export const P = (id) => G.players[id];

export function windows(y) {
  if (!winCache.has(y)) winCache.set(y, windowsForYear(y));
  return winCache.get(y);
}
export function windowAt(d) {
  const y = ymd(d).y;
  return windows(y).find((w) => d >= w.callup && d <= w.days[w.days.length - 1]) || null;
}
export function nextWindow(d) {
  const y = ymd(d).y;
  for (const yy of [y, y + 1]) for (const w of windows(yy)) if (w.days[w.days.length - 1] >= d) return w;
  return null;
}

/** Siła drużyny na podstawie punktów rankingowych. */
export const strengthOf = (nid) => 30 + ((G.rank[nid] || 1000) - 780) / 18;

// =====================================================================
// NOWA GRA
// =====================================================================
export function newGame({ nat, manager = 'Trener', useEdited = true, overrides = null, diff = 1 } = {}) {
  const seed = useEdited ? DEFAULT_SEED : (Math.random() * 2147483647) | 0;
  const world = generateWorld(seed);
  if (useEdited && overrides) applyOverrides(world, overrides);
  const start = mkDay(2026, 8, 20);
  const g = {
    v: 1, seed, day: start, start, diff, doneDay: start - 1, startedDay: start,
    user: { name: manager, nat: null, rep: 0, since: start, contractEnd: 0, spells: [], trophies: [], unemployed: false, sacked: 0 },
    trust: { fed: 60, fans: 60, pl: 60, media: 60 },
    players: world.players, nextPid: world.nextPid, clubs: world.clubs,
    nats: {}, rank: {}, rankPrev: {}, comps: {}, compOrder: [], fixtures: [], fxSeq: 1, hosts: {}, archive: [],
    msgs: [], msgSeq: 1, queue: [], history: [], objectives: [], offers: [], u21res: [],
    team: null, staff: null, journalists: [], flags: {}, lastCall: start, ach: [], recent: {},
    stats: { m: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, unb: 0, maxUnb: 0, ws: 0, maxWs: 0, best: null, worst: null },
  };
  for (const n of NATIONS) {
    g.nats[n.id] = { pool: world.nats[n.id].pool.slice(), squad: [], u21: [], coach: world.nats[n.id].coach, tac: defaultTactics(n.str), sec: 60 + rint(-10, 10), form: [] };
  }
  setGame(g);
  initRanking(G);
  G.hosts[2028] = pickHosts(G, 2028, 'CONT');
  createLN(G, 2026);
  for (const n of NATIONS) G.nats[n.id].squad = pickSquad(poolOf(n.id), 23);
  takeJob(nat, true);
  return G;
}

function contractEndFrom(day) {
  let y = ymd(day).y;
  for (;;) {
    if (y % 2 === 0 && mkDay(y, 7, 31) - day >= 300) return mkDay(y, 7, 31);
    y++;
  }
}

function seededName(nid, salt) {
  return genName(NAT[nid], mkRng(hashStr(nid + salt)));
}

export function takeJob(nid, initial = false) {
  const n = NAT[nid];
  if (initial) G.user.rep = Math.round(32 + (n.str - 40) * 0.35);
  G.user.nat = nid;
  G.user.unemployed = false;
  G.user.since = G.day;
  G.user.contractEnd = contractEndFrom(G.day);
  G.user.spells.push({ nat: nid, from: G.day, to: null, m: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0 });
  G.trust = { fed: 62, fans: 55 + rint(0, 10), pl: 60, media: 55 + rint(0, 8) };
  G.team = defaultTeam(nid);
  const pres = seededName(nid, 'prezes'), asst = seededName(nid, 'asystent'), doc = seededName(nid, 'lekarz');
  G.staff = { president: pres, assistant: asst, doctor: doc };
  G.journalists = [0, 1, 2, 3].map((i) => {
    const nm = seededName(nid, 'dz' + i);
    return { ...nm, outlet: OUTLETS[(hashStr(nid) + i * 3) % OUTLETS.length], blocked: false, seed: hashStr(nid + 'dz' + i) };
  });
  G.flags = { warned: 0, contractAsked: false };
  G.offers = [];
  G.nats[nid].squad = G.team.squad.slice();
  for (const id of G.compOrder) {
    const c = G.comps[id];
    if (c && !c.done && (c.groups || []).some((g) => g.teams.includes(nid))) addObjective(c);
  }
  const objs = G.objectives.filter((o) => o.nat === nid && o.status === 'open').map((o) => '• ' + o.text).join('\n');
  msg('president', 'Witamy w federacji!',
    `Szanowny Panie,\n\nw imieniu zarządu witam na stanowisku selekcjonera reprezentacji: ${n.name}. Liczymy na Pana odwagę i konsekwencję, kibice czekają na drużynę, z której znów będą dumni.\n\n` +
    (objs ? `Nasze oczekiwania na najbliższy okres:\n${objs}\n\n` : '') +
    `Kontrakt obowiązuje do ${fmtDateLong(G.user.contractEnd)}.\n\nPowodzenia!\n${fullName(pres)}, prezes federacji`, { important: true });
  if (!initial) achieve('new_job');
  const w = windowAt(G.day);
  if (w && G.fixtures.some((f) => w.days.includes(f.d) && f.d >= G.day && (f.h === nid || f.a === nid))) queueCallup(w);
}

function defaultTeam(nid) {
  const pool = poolOf(nid);
  const n = NAT[nid];
  const squad = pickSquad(pool, 23);
  const u21 = pool.filter((p) => p.age <= 21).sort((a, b) => ovr(b) - ovr(a)).slice(0, 23).map((p) => p.id);
  const lvl = Object.fromEntries(TRAIN_KEYS.map((k) => [k, 30]));
  const alloc = Object.fromEntries(TRAIN_KEYS.map((k) => [k, 5]));
  return {
    squad, prevSquad: squad.slice(), u21, tac: defaultTactics(n.str), lineup: null, bench: null, instr: {}, sp: null,
    train: { alloc, lvl }, talked: {}, promises: {}, callup: null, friendAsk: {}, medical: false, scouts: false, req: {},
  };
}

// =====================================================================
// WIADOMOŚCI, OSIĄGNIĘCIA, ZAUFANIE
// =====================================================================
export function msg(from, subj, body, opts = {}) {
  G.msgs.unshift({ id: G.msgSeq++, d: G.day, from, subj, body, read: false, important: !!opts.important });
  if (G.msgs.length > 150) G.msgs.length = 150;
}

export function senderName(from) {
  const s = G.staff;
  if (from === 'president') return s ? `${fullName(s.president)}, prezes` : 'Prezes federacji';
  if (from === 'assistant') return s ? `${fullName(s.assistant)}, asystent` : 'Asystent';
  if (from === 'doctor') return s ? `${fullName(s.doctor)}, lekarz kadry` : 'Lekarz kadry';
  if (from === 'press') return 'Rzecznik prasowy';
  if (from === 'system') return 'Biuro rozgrywek';
  if (from && from.startsWith('fed:')) return `Federacja: ${natName(from.slice(4))}`;
  return from;
}

export function achieve(id) {
  if (!ACH[id] || G.ach.includes(id)) return;
  G.ach.push(id);
  if (hooks.achieve) hooks.achieve(id);
}

export function trustChange(d) {
  for (const k of ['fed', 'fans', 'pl', 'media']) {
    if (!d[k]) continue;
    let v = d[k];
    if (v < 0) v *= NEG[G.diff];
    G.trust[k] = clamp(Math.round((G.trust[k] + v) * 10) / 10, 0, 100);
  }
}

// =====================================================================
// GŁÓWNA PĘTLA CZASU
// =====================================================================
export function advance(maxDays = 400) {
  if (!G) return { type: 'idle' };
  if (G.queue.length) return { type: 'event', ev: G.queue[0] };
  for (let i = 0; i < maxDays; i++) {
    const fx = userFixtureOn(G.day);
    if (fx && !fx.res) return { type: 'match', fx };
    finishDay(G.day);
    if (G.queue.length) return { type: 'event', ev: G.queue[0] };
    G.day++;
    startDay(G.day);
    if (G.queue.length) return { type: 'event', ev: G.queue[0] };
  }
  return { type: 'idle' };
}

export function userFixtureOn(d) {
  const m = me();
  if (!m) return null;
  return G.fixtures.find((f) => f.d === d && (f.h === m || f.a === m)) || null;
}

export function userFixtures(nid = me()) {
  if (!nid) return [];
  return G.fixtures.filter((f) => f.h === nid || f.a === nid).sort((a, b) => a.d - b.d);
}

export function nextUserFixture() {
  const m = me();
  if (!m) return null;
  return G.fixtures.filter((f) => !f.res && (f.h === m || f.a === m) && f.d >= G.day).sort((a, b) => a.d - b.d)[0] || null;
}

function finishDay(d) {
  if (G.doneDay >= d) return;
  const todays = G.fixtures.filter((f) => f.d === d);
  for (const f of todays) if (!f.res) simulateFixture(f);
  u21Matchday(d);
  const comps = [...new Set(todays.map((f) => f.comp))];
  for (const cid of comps) compCheck(G.comps[cid]);
  G.doneDay = d;
}

function startDay(d) {
  if (G.startedDay >= d) return;
  G.startedDay = d;
  const t = ymd(d);
  dailyTick(d);
  if (t.wd === 1) weeklyTick();
  if (t.d === 1) monthlyTick();
  if (t.m === 1 && t.d === 1) newYear();
  if (t.m === 7 && t.d === 1) midYear(t.y);
  if (t.m === 8 && t.d === 1 && t.y % 2 === 0 && !G.comps[`LN${t.y}-EU`]) afterCreate(createLN(G, t.y), 'LN');
  if (t.m === 12 && t.d === 5) {
    if (t.y % 2 === 0) afterCreate(createQualifiers(G, t.y + 2), 'Q');
    else afterCreate(createFinals(G, t.y + 1), 'FIN');
  }
  for (const w of windows(t.y)) {
    if (d === w.callup) callupDay(w);
    if (d === w.fdays[0] - 30) friendlyPlanning(w);
  }
  if (me()) {
    if (d >= G.user.contractEnd && !G.flags.contractAsked) contractEnd();
    journalistCall(d);
    preMatchPress(d);
  } else if (G.user.unemployed) unemployedTick(d);
}

// =====================================================================
// SYMULACJA MECZÓW
// =====================================================================
const AI_TRAIN = { cond: 40, poss: 40, sp: 40, off: 40, def: 40, ment: 40 };

export function aiSpec(nid, fx, home) {
  const nat = G.nats[nid];
  let squad = (nat.squad || []).map((id) => G.players[id]).filter(Boolean);
  if (squad.filter(available).length < 14) {
    nat.squad = pickSquad(poolOf(nid), 23);
    squad = nat.squad.map((id) => G.players[id]).filter(Boolean);
  }
  const opp = fx.h === nid ? fx.a : fx.h;
  const tac = aiTactics(nat.tac, strengthOf(nid), strengthOf(opp));
  const lineup = autoLineup(squad, tac.f);
  const bench = autoBench(squad, lineup, 12);
  const players = Object.fromEntries(squad.map((p) => [p.id, p]));
  const sp = defaultSetPieces(lineup.filter(Boolean).map((id) => players[id]));
  const c = G.comps[fx.comp];
  return { nid, name: NAT[nid].name, players, lineup, bench, tac, instr: {}, sp, train: AI_TRAIN, home: home && !fx.neutral, host: !!(c && c.host === nid), ai: true };
}

function simulateFixture(fx) {
  const m = new Match(aiSpec(fx.h, fx, true), aiSpec(fx.a, fx, false), { ko: fx.ko, neutral: fx.neutral });
  const r = m.simulate();
  applyResult(fx, r, m);
}

function injuryDays(nid) {
  const base = Math.random() < 0.6 ? rint(4, 14) : rint(15, 50);
  return Math.round(base * (nid === me() && G.team && G.team.medical ? 0.75 : 1));
}

function applyResult(fx, r, m) {
  const c = G.comps[fx.comp];
  fx.res = {
    hg: r.hg, ag: r.ag, et: r.et, pens: r.pens,
    sc: r.key.filter((k) => k.type === 'goal').map((k) => ({ pid: k.pid, s: k.side, m: k.min, p: k.pen ? 1 : 0, o: k.og ? 1 : 0 })),
  };
  const competitive = c && c.type !== 'FRI';
  for (const side of [0, 1]) {
    const nid = side === 0 ? fx.h : fx.a;
    const S = m.sides[side];
    const gf = side === 0 ? r.hg : r.ag, ga = side === 0 ? r.ag : r.hg;
    const res = gf > ga ? 'W' : gf < ga ? 'L' : 'D';
    const nat = G.nats[nid];
    nat.form.push(res);
    if (nat.form.length > 10) nat.form.shift();
    for (const pid of nat.squad || []) {
      const p = G.players[pid];
      if (p && p.susp > 0 && !S.played.has(pid)) p.susp--;
    }
    for (const pid of S.played) {
      const p = G.players[pid];
      const s = r.pl[side][pid];
      if (!p || !s) continue;
      p.caps++;
      p.goals += s.g;
      p.mp = (p.mp || 0) + 1;
      p.cond = clamp(Math.round(S.st[pid] ?? p.cond), 30, 100);
      if (s.inj) p.inj = Math.max(p.inj, injuryDays(nid));
      if (s.rc) p.susp = (p.susp || 0) + 1;
      else if (s.yc && competitive) {
        p.ycc = (p.ycc || 0) + s.yc;
        if (p.ycc >= 2) { p.susp = (p.susp || 0) + 1; p.ycc = 0; }
      }
      p.mor = clamp(p.mor + (res === 'W' ? 4 : res === 'D' ? 1 : -3) + (s.r >= 7.5 ? 3 : s.r <= 5.5 ? -3 : 0), 0, 100);
    }
    if (nid !== me()) {
      const opp = side === 0 ? fx.a : fx.h;
      const We = expected(G, nid, opp, fx.neutral ? 0 : side === 0 ? 60 : -60);
      const W = res === 'W' ? 1 : res === 'L' ? 0 : 0.5;
      nat.sec = clamp(nat.sec + (W - We) * (competitive ? 10 : 4), 0, 100);
    }
  }
  if (c) {
    c.sc = c.sc || {};
    for (const k of fx.res.sc) if (!k.o) c.sc[k.pid] = (c.sc[k.pid] || 0) + 1;
  }
  updateRanking(G, fx);
}

// =====================================================================
// MECZ UŻYTKOWNIKA
// =====================================================================
export function userSquadPlayers() {
  return (G.team.squad || []).map((id) => G.players[id]).filter(Boolean);
}

/** Sprawdza i uzupełnia jedenastkę, ławkę i wykonawców stałych fragmentów. */
export function ensureLineup() {
  const t = G.team;
  const squad = userSquadPlayers();
  const f = FORMATIONS[t.tac.f];
  let lu = t.lineup && t.lineup.length === f.length ? t.lineup.slice() : null;
  const ok = (id) => id != null && t.squad.includes(id) && available(G.players[id]);
  if (!lu) lu = autoLineup(squad, t.tac.f);
  else {
    lu = lu.map((id) => (ok(id) ? id : null));
    const used = new Set(lu.filter((x) => x != null));
    for (let i = 0; i < lu.length; i++) {
      if (lu[i] != null) continue;
      let best = null, bs = -1;
      for (const p of squad) {
        if (used.has(p.id) || !available(p)) continue;
        const s = matchScore(p, f[i][0]);
        if (s > bs) { bs = s; best = p; }
      }
      if (best) { lu[i] = best.id; used.add(best.id); }
    }
  }
  t.lineup = lu;
  const inLu = new Set(lu.filter((x) => x != null));
  let bench = (t.bench || []).filter((id) => ok(id) && !inLu.has(id));
  const auto = autoBench(squad, [...inLu, ...bench], 12);
  for (const id of auto) { if (bench.length >= 12) break; if (!bench.includes(id)) bench.push(id); }
  t.bench = bench.slice(0, 12);
  const lp = lu.filter((x) => x != null).map((id) => G.players[id]);
  const def = defaultSetPieces(lp);
  const sp = t.sp ? { ...t.sp } : { ...def };
  for (const k of ['pen', 'fkn', 'fkf', 'cor', 'cap']) if (!inLu.has(sp[k])) sp[k] = def[k];
  sp.box = (sp.box || []).filter((id) => inLu.has(id));
  if (sp.box.length < 2) sp.box = def.box;
  t.sp = sp;
}

export function buildUserSpec(fx, home) {
  ensureLineup();
  const t = G.team;
  const m = me();
  const players = Object.fromEntries(userSquadPlayers().map((p) => [p.id, p]));
  const c = G.comps[fx.comp];
  return {
    nid: m, name: NAT[m].name, players, lineup: t.lineup.slice(), bench: t.bench.slice(0, 12), tac: { ...t.tac },
    instr: JSON.parse(JSON.stringify(t.instr || {})), sp: { ...t.sp, box: [...(t.sp.box || [])] }, train: { ...t.train.lvl },
    home: home && !fx.neutral, host: !!(c && c.host === m), ai: false, isUser: true,
  };
}

export function attendance(fx) {
  const venueNat = Object.keys(NAT).find((id) => NAT[id].cities.includes(fx.city)) || fx.h;
  const cap = clamp(12000 + (NAT[venueNat].str - 35) * 1150, 5000, 82000);
  const c = G.comps[fx.comp];
  const imp = c ? (c.type === 'FIN' ? 0.25 : c.type === 'Q' ? 0.12 : c.type === 'LN' ? 0.08 : 0) : 0;
  const homeFans = fx.h === me() ? G.trust.fans / 100 : 0.6;
  const fill = clamp(0.45 + 0.3 * homeFans + imp + (Math.random() - 0.5) * 0.1, 0.25, 1);
  return Math.round(cap * fill);
}

export function prepareMatch(fx, opts = {}) {
  const home = fx.h === me();
  const us = buildUserSpec(fx, home);
  const them = aiSpec(home ? fx.a : fx.h, fx, !home);
  const userSide = home ? 0 : 1;
  const autoSubs = [false, false];
  if (opts.quick) autoSubs[userSide] = true;
  const m = new LiveMatch(home ? us : them, home ? them : us, { ko: fx.ko, neutral: fx.neutral, autoSubs });
  m.userSide = userSide;
  m.fx = fx;
  m.attendance = attendance(fx);
  m.startLineup = us.lineup.slice();
  return m;
}

export function quickSimUserMatch(fx) {
  const m = prepareMatch(fx, { quick: true });
  m.simulate();
  return completeUserMatch(m);
}

export function completeUserMatch(m) {
  const fx = m.fx;
  if (fx.res) return null;
  const r = m.result();
  const capsBefore = {};
  for (const pid of m.sides[m.userSide].played) capsBefore[pid] = G.players[pid] ? G.players[pid].caps : 0;
  applyResult(fx, r, m);
  G.recent = {};
  const info = userAfterMatch(fx, r, m, capsBefore);
  for (const f of G.fixtures) if (f.d === fx.d && !f.res) simulateFixture(f);
  finishDay(fx.d);
  const press = makePostPress(fx, r, m, info);
  if (press) G.queue.unshift(press);
  checkSack();
  return info;
}

function userAfterMatch(fx, r, m, capsBefore) {
  const us = m.userSide;
  const mid = me();
  const opp = us === 0 ? fx.a : fx.h;
  const gf = us === 0 ? r.hg : r.ag, ga = us === 0 ? r.ag : r.hg;
  const wonPens = gf === ga && r.pens && r.winner === us;
  const lostPens = gf === ga && r.pens && r.winner !== us;
  const res = gf > ga ? 'W' : gf < ga ? 'L' : 'D';
  const S = m.sides[us];
  const c = G.comps[fx.comp];
  const ps = r.pl[us];
  const debuts = [];
  // statystyki zawodników
  for (const pid of S.played) {
    const p = G.players[pid];
    const s = ps[pid];
    if (!p || !s) continue;
    p.s = p.s || { apps: 0, g: 0, a: 0, rs: 0, yc: 0, rc: 0, mom: 0, min: 0 };
    p.s.apps++; p.s.g += s.g; p.s.a += s.a; p.s.rs += s.r; p.s.yc += s.yc; p.s.rc += s.rc; p.s.min += s.min || 0;
    if (r.motm && r.motm.side === us && r.motm.pid === pid) p.s.mom++;
    if ((capsBefore[pid] || 0) === 0) { debuts.push(pid); if (p.age <= 18) achieve('debut18'); }
  }
  // rezerwowi niezadowoleni z braku gry
  for (const pid of G.team.squad) {
    if (S.played.has(pid)) continue;
    const p = G.players[pid];
    if (p && available(p) && ovr(p) >= teamTopAvg() - 2) p.mor = clamp(p.mor - 3, 0, 100);
  }
  // obietnice
  const starters = new Set(m.startLineup || []);
  for (const [pid, day] of Object.entries(G.team.promises)) {
    if (day >= fx.d) continue;
    const p = G.players[pid];
    if (p && G.team.squad.includes(+pid) && available(p) && !starters.has(+pid)) {
      p.mor = clamp(p.mor - 15, 0, 100);
      trustChange({ pl: -2 });
      msg('assistant', 'Złamana obietnica', `${fullName(p)} jest rozczarowany, obiecał mu pan miejsce w wyjściowym składzie, a nie zagrał od pierwszej minuty. Atmosfera w szatni na tym ucierpiała.`);
    }
    delete G.team.promises[pid];
  }
  // zaufanie
  const homeAdv = fx.neutral ? 0 : us === 0 ? 60 : -60;
  const We = expected(G, mid, opp, homeAdv);
  let W = res === 'W' ? 1 : res === 'L' ? 0 : 0.5;
  if (wonPens) W = 0.65;
  if (lostPens) W = 0.4;
  const imp = !c ? 0.5 : c.type === 'FRI' ? 0.5 : c.type === 'LN' ? (fx.r >= 0 ? 1.3 : 0.9) : c.type === 'Q' ? 1.3 : fx.r >= 0 ? 1.9 : 1.5;
  const b = W - We;
  trustChange({
    fed: 11 * imp * b,
    fans: 13 * imp * b + clamp((gf - ga) * 0.6, -3, 3) + (res === 'W' && G.team.tac.style >= 3 ? 1 : 0),
    media: 8 * imp * b,
    pl: 4 * (W - 0.5) + (res === 'W' ? 1 : 0),
  });
  // historia i statystyki
  const pname = (pid) => (G.players[pid] ? fullName(G.players[pid]) : '?');
  const motm = r.motm ? { n: pname(r.motm.pid), own: r.motm.side === us } : null;
  G.history.push({
    id: fx.id, d: fx.d, comp: c ? c.name : '', cs: c ? c.short : '', stage: fixtureStage(G, fx), opp, nat: mid, home: us === 0, neutral: fx.neutral,
    gf, ga, et: r.et, pens: r.pens ? (us === 0 ? r.pens : [r.pens[1], r.pens[0]]) : null, res: wonPens ? 'W' : lostPens ? 'L' : res,
    sc: r.key.filter((k) => k.type === 'goal').map((k) => ({ n: pname(k.pid), m: k.min, own: k.side === us, pen: k.pen, og: k.og })),
    motm, att: m.attendance || 0, st: r.stats,
  });
  const sp = G.user.spells[G.user.spells.length - 1];
  const st = G.stats;
  for (const o of [sp, st]) { o.m++; o.gf += gf; o.ga += ga; if (res === 'W') o.w++; else if (res === 'L') o.l++; else o.d++; }
  if (res !== 'L') st.unb++; else st.unb = 0;
  if (res === 'W') st.ws++; else st.ws = 0;
  st.maxUnb = Math.max(st.maxUnb, st.unb);
  st.maxWs = Math.max(st.maxWs, st.ws);
  if (res === 'W' && (!st.best || gf - ga > st.best.gf - st.best.ga)) st.best = { gf, ga, opp, d: fx.d };
  if (res === 'L' && (!st.worst || ga - gf > st.worst.ga - st.worst.gf)) st.worst = { gf, ga, opp, d: fx.d };
  // osiągnięcia
  achieve('first_match');
  if (res === 'W') achieve('first_win');
  if (ga === 0) achieve('clean_sheet');
  if (gf - ga >= 5) achieve('big_win');
  const pos = rankPositions(G);
  if (res === 'W' && pos[opp] + 20 <= pos[mid]) achieve('upset');
  if (wonPens) achieve('shootout');
  if (st.ws >= 5) achieve('wins5');
  if (st.unb >= 10) achieve('unbeaten10');
  if (st.m >= 50) achieve('matches50');
  if (st.m >= 100) achieve('matches100');
  if (Object.values(ps).some((s) => s.g >= 3)) achieve('hattrick');
  let diff = 0, worstDiff = 0;
  for (const k of r.key) {
    if (k.type !== 'goal') continue;
    diff += k.side === us ? 1 : -1;
    worstDiff = Math.min(worstDiff, diff);
  }
  if (worstDiff <= -2 && res === 'W') achieve('comeback');
  // kontuzje
  for (const pid of S.played) {
    const s = ps[pid];
    const p = G.players[pid];
    if (s && s.inj && p) msg('doctor', `Kontuzja: ${fullName(p)}`, `${fullName(p)} doznał urazu w meczu. Przewidywana przerwa: ${p.inj} ${plural(p.inj, 'dzień', 'dni', 'dni')}.`);
    if (s && s.rc && p) msg('assistant', `Zawieszenie: ${fullName(p)}`, `Po czerwonej kartce ${fullName(p)} będzie pauzował w najbliższym meczu.`);
    else if (p && p.susp > 0 && s && s.yc) msg('assistant', `Zawieszenie: ${fullName(p)}`, `${fullName(p)} uzbierał limit żółtych kartek i opuści najbliższy mecz.`);
  }
  return { fx, r, res, gf, ga, opp, debuts, We, us };
}

let _topAvg = { d: -1, v: 0 };
function teamTopAvg() {
  if (_topAvg.d === G.day) return _topAvg.v;
  const list = userSquadPlayers().map(ovr).sort((a, b) => b - a).slice(0, 11);
  _topAvg = { d: G.day, v: list.length ? list.reduce((s, x) => s + x, 0) / list.length : 60 };
  return _topAvg.v;
}

// =====================================================================
// KONFERENCJE PRASOWE I DZIENNIKARZE
// =====================================================================
function fillQ(q, vars) {
  const f = (s) => s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
  return { q: f(q.q), a: q.a.map((a) => ({ t: f(a.t), e: a.e })), pid: vars.pid || null, ctx: q.ctx };
}
function qFor(ctx, vars, used) {
  const list = QUESTIONS.filter((q) => q.ctx === ctx && !used.has(q));
  if (!list.length) return null;
  const q = pick(list);
  used.add(q);
  return fillQ(q, vars);
}

function makePostPress(fx, r, m, info) {
  if (!info) return null;
  const { gf, ga, res, We, us, debuts } = info;
  const S = m.sides[us];
  const ps = r.pl[us];
  const vars = { S: `${gf}:${ga}`, O: natName(info.opp) };
  const used = new Set();
  const qs = [];
  const margin = gf - ga;
  const main = res === 'W' ? (margin >= 3 ? 'win_big' : 'win') : res === 'L' ? (margin <= -3 ? 'loss_big' : 'loss') : 'draw';
  if (G.recent.title) qs.push(qFor('title', vars, used));
  else if (G.recent.qualified) qs.push(qFor('qualified', vars, used));
  else if (G.recent.eliminated) qs.push(qFor('eliminated', vars, used));
  if (res === 'W' && We < 0.3) qs.push(qFor('upset_win', vars, used));
  else if (res === 'L' && We > 0.7) qs.push(qFor('shock_loss', vars, used));
  else qs.push(qFor(main, vars, used));
  // pytanie o zawodnika
  const played = [...S.played].map((pid) => ({ pid, s: ps[pid], p: G.players[pid] })).filter((x) => x.s && x.p);
  const hero = played.filter((x) => x.s.g >= 2 || x.s.r >= 8).sort((a, b) => b.s.r - a.s.r)[0];
  const gk = played.find((x) => x.s.pos === 'GK' && x.s.sv >= 5);
  const star = played.slice().sort((a, b) => ovr(b.p) - ovr(a.p))[0];
  const special = [];
  if (hero) special.push(['hero', hero.pid]);
  if (gk) special.push(['gk_hero', gk.pid]);
  if (star && star.s.r <= 5.6) special.push(['star_poor', star.pid]);
  if (debuts.length) special.push(['debut', debuts[0]]);
  if (S.red > 0) special.push(['red', null]);
  if (special.length && qs.length < 3) {
    const [ctx, pid] = pick(special);
    qs.push(qFor(ctx, { ...vars, P: pid ? fullName(G.players[pid]) : '', pid }, used));
  }
  const list = qs.filter(Boolean).slice(0, 3);
  if (!list.length) return null;
  const j = availableJournalists();
  return { type: 'press', kind: 'post', fx: fx.id, title: 'Konferencja prasowa', sub: `${natName(fx.h)} ${r.hg}:${r.ag} ${natName(fx.a)}`, j: j.length ? pick(j) : 0, qs: list };
}

function availableJournalists() {
  return G.journalists.map((j, i) => (j.blocked ? -1 : i)).filter((i) => i >= 0);
}

function preMatchPress(d) {
  const fx = G.fixtures.find((f) => f.d === d + 1 && !f.res && (f.h === me() || f.a === me()));
  if (!fx || !chance(0.4)) return;
  const home = fx.h === me();
  const opp = home ? fx.a : fx.h;
  const We = expected(G, me(), opp, fx.neutral ? 0 : home ? 60 : -60);
  const ctx = We > 0.68 ? 'pre_weak' : We < 0.32 ? 'pre_strong' : 'pre_even';
  const used = new Set();
  const qs = [qFor(ctx, { O: natName(opp) }, used)];
  if (chance(0.3)) qs.push(qFor('call_rival', { O: natName(opp) }, used));
  const j = availableJournalists();
  G.queue.push({ type: 'press', kind: 'pre', fx: fx.id, title: 'Konferencja przedmeczowa', sub: `${natName(fx.h)} vs ${natName(fx.a)}`, j: j.length ? pick(j) : 0, qs: qs.filter(Boolean) });
}

function journalistCall(d) {
  if (d - G.lastCall < 18 || !chance(0.05)) return;
  const nxt = nextUserFixture();
  if (nxt && nxt.d - d < 4) return;
  const js = availableJournalists();
  if (!js.length) return;
  G.lastCall = d;
  const ji = pick(js);
  const j = G.journalists[ji];
  const squad = userSquadPlayers();
  const star = squad.slice().sort((a, b) => ovr(b) - ovr(a))[0];
  const inSquad = new Set(G.team.squad);
  const young = poolOf(me()).filter((p) => p.age <= 21 && !inSquad.has(p.id)).sort((a, b) => b.pot - a.pot)[0];
  const benchwarmer = squad.filter((p) => p.cst === 3).sort((a, b) => ovr(b) - ovr(a))[0];
  const form = G.nats[me()].form.slice(-4);
  const wins = form.filter((x) => x === 'W').length;
  const ctxs = ['call_plans', 'call_fed', 'call_fans'];
  if (star) ctxs.push('call_star');
  if (young) ctxs.push('call_young');
  if (benchwarmer) ctxs.push('call_club');
  if (form.length >= 3 && wins <= 1) ctxs.push('call_bad', 'call_bad');
  if (form.length >= 3 && wins >= 3) ctxs.push('call_good', 'call_good');
  if (nxt) ctxs.push('call_rival');
  const used = new Set();
  const qs = [];
  const pickedCtx = shuffle(ctxs.slice());
  for (const ctx of pickedCtx) {
    if (qs.length >= (chance(0.5) ? 2 : 1)) break;
    if (qs.some((q) => q.ctx === ctx)) continue;
    const pl = ctx === 'call_star' ? star : ctx === 'call_young' ? young : ctx === 'call_club' ? benchwarmer : null;
    const opp = nxt ? (nxt.h === me() ? nxt.a : nxt.h) : null;
    const q = qFor(ctx, { P: pl ? fullName(pl) : '', pid: pl ? pl.id : null, O: opp ? natName(opp) : '' }, used);
    if (q) qs.push(q);
  }
  const greet = pick(GREETINGS).replace('{J}', fullName(j)).replace('{M}', j.outlet);
  G.queue.push({ type: 'journalist', j: ji, title: 'Telefon od dziennikarza', greet, ga: GREET_ANSWERS, qs });
}

/** answers: tablica indeksów odpowiedzi. */
export function answerPress(ev, answers) {
  let sum = { fans: 0, media: 0, pl: 0, fed: 0 };
  ev.qs.forEach((q, i) => {
    const a = q.a[answers[i] ?? 1];
    if (!a) return;
    for (const k of ['fans', 'media', 'pl', 'fed']) if (a.e[k]) sum[k] += a.e[k];
    if (a.e.star && q.pid && G.players[q.pid]) {
      const p = G.players[q.pid];
      p.mor = clamp(p.mor + a.e.star, 0, 100);
    }
  });
  trustChange(sum);
  removeEvent(ev);
  return sum;
}

export function answerGreeting(ev, k) {
  if (k === 'later') trustChange({ media: -1 });
  if (k === 'never') { trustChange({ media: -4 }); G.journalists[ev.j].blocked = true; }
  if (k !== 'yes' || !ev.qs.length) removeEvent(ev);
}

export function removeEvent(ev) {
  const i = G.queue.indexOf(ev);
  if (i >= 0) G.queue.splice(i, 1);
}

// =====================================================================
// POWOŁANIA I ZGRUPOWANIA
// =====================================================================
function finalsCompsOf(y) {
  return G.compOrder.map((id) => G.comps[id]).filter((c) => c && c.type === 'FIN' && c.year === y);
}

function callupDay(w) {
  const fins = w.kind === 'fin' ? finalsCompsOf(w.y) : [];
  for (const n of NATIONS) {
    if (n.id === me()) continue;
    const size = fins.some((c) => c.groups.some((g) => g.teams.includes(n.id))) ? 26 : 23;
    G.nats[n.id].squad = pickSquad(poolOf(n.id), size);
  }
  if (me()) queueCallup(w);
}

function queueCallup(w) {
  const m = me();
  const matches = G.fixtures.filter((f) => w.days.includes(f.d) && (f.h === m || f.a === m));
  const inFinals = w.kind === 'fin' && finalsCompsOf(w.y).some((c) => c.groups.some((g) => g.teams.includes(m)));
  if (!matches.length && !inFinals) {
    msg('assistant', 'Brak meczów na zgrupowaniu', `W terminie zgrupowania ${WINDOW_NAMES[w.key]} nie mamy zaplanowanych meczów. Wciąż można umówić mecz towarzyski w menu „Mecze towarzyskie”.`);
    return;
  }
  if (G.queue.some((e) => e.type === 'callup' && e.win === w.id)) return;
  const size = inFinals ? 26 : 23;
  const inj = userSquadPlayers().filter((p) => p.inj > 0);
  const note = inj.length ? `Kontuzjowani obecnie w kadrze: ${inj.map((p) => `${fullName(p)} (${p.inj} dni)`).join(', ')}.` : '';
  G.queue.push({ type: 'callup', win: w.id, size, n: matches.length, title: inFinals ? 'Kadra na turniej finałowy' : `Powołania, zgrupowanie ${WINDOW_NAMES[w.key]}`, note });
}

export function confirmCallup(ev, ids) {
  const t = G.team;
  const old = new Set(t.prevSquad || t.squad);
  t.squad = ids.slice();
  G.nats[me()].squad = ids.slice();
  const top = poolOf(me()).filter((p) => p.inj === 0).sort((a, b) => ovr(b) - ovr(a)).slice(0, 3);
  let pain = 0;
  for (const pid of ids) {
    const p = G.players[pid];
    if (p) p.mor = clamp(p.mor + (old.has(pid) ? 2 : 6), 0, 100);
  }
  for (const pid of old) {
    if (ids.includes(pid)) continue;
    const p = G.players[pid];
    if (!p || p.inj > 0) continue;
    p.mor = clamp(p.mor - (p.caps > 30 ? 10 : 5), 0, 100);
    if (p.caps > 40) pain++;
  }
  const omitted = top.filter((p) => !ids.includes(p.id));
  trustChange({ pl: -Math.min(4, pain), fans: omitted.length ? -2 * omitted.length : 0.5, media: omitted.length ? -1 : 0 });
  for (const p of omitted) {
    if (p.caps < 15 || !chance(0.55)) continue;
    const quote = pick([
      '„Nie rozumiem tej decyzji. W klubie daję z siebie wszystko.”',
      '„Jestem rozczarowany. Nikt ze sztabu nawet do mnie nie zadzwonił.”',
      '„Szanuję decyzję selekcjonera, ale uważam, że zasłużyłem na powołanie.”',
    ]);
    msg('press', `${fullName(p)} rozczarowany brakiem powołania`, `${fullName(p)} w rozmowie z dziennikarzami nie ukrywał rozczarowania: ${quote}\n\nMedia szeroko komentują decyzję selekcjonera.`);
    trustChange({ fans: -1, media: -1 });
  }
  t.prevSquad = ids.slice();
  if (ev) { t.callup = ev.win; removeEvent(ev); }
  ensureLineup();
}

function friendlyPlanning(w) {
  for (const d of w.fdays) {
    const free = shuffle(NATIONS.map((n) => n.id).filter((id) => id !== me() && !hasFixture(G, id, d)));
    const used = new Set();
    for (const a of free) {
      if (used.has(a) || Math.random() > 0.55) continue;
      const opts = free.filter((b) => b !== a && !used.has(b) && Math.abs(G.rank[a] - G.rank[b]) < 350);
      if (!opts.length) continue;
      const same = opts.filter((b) => NAT[b].conf === NAT[a].conf);
      const b = same.length && Math.random() < 0.7 ? pick(same) : pick(opts);
      used.add(a); used.add(b);
      if (Math.random() < 0.5) addFriendly(G, d, a, b); else addFriendly(G, d, b, a);
    }
  }
  const m = me();
  if (!m) return;
  const freeDays = w.fdays.filter((d) => !hasFixture(G, m, d));
  if (!freeDays.length) return;
  const d = freeDays[0];
  const cands = NATIONS.map((n) => n.id).filter((id) => id !== m && !hasFixture(G, id, d) && Math.abs(G.rank[id] - G.rank[m]) < 400);
  if (cands.length && chance(0.7)) {
    G.queue.push({ type: 'friendlyInvite', from: pick(cands), d, home: chance(0.5), title: 'Zaproszenie na mecz towarzyski' });
  } else {
    msg('assistant', 'Wolne terminy na zgrupowaniu', `Podczas najbliższego zgrupowania mamy wolne terminy: ${freeDays.map(fmtDate).join(', ')}. Warto umówić mecz towarzyski w menu „Mecze towarzyskie”.`);
  }
}

export function answerInvite(ev, accept) {
  const m = me();
  if (accept && !hasFixture(G, m, ev.d) && !hasFixture(G, ev.from, ev.d)) {
    if (ev.home) addFriendly(G, ev.d, m, ev.from); else addFriendly(G, ev.d, ev.from, m);
    msg('system', 'Mecz towarzyski potwierdzony', `${fmtDateLong(ev.d)}: ${natName(ev.home ? m : ev.from)} vs ${natName(ev.home ? ev.from : m)}.`);
  }
  removeEvent(ev);
}

/** Wolne terminy na mecze towarzyskie w najbliższych zgrupowaniach. */
export function friendlySlots() {
  const m = me();
  if (!m) return [];
  const out = [];
  const y = ymd(G.day).y;
  for (const yy of [y, y + 1]) {
    for (const w of windows(yy)) {
      for (const d of w.fdays) {
        if (d < G.day + 3) continue;
        out.push({ d, w, taken: G.fixtures.find((f) => f.d === d && (f.h === m || f.a === m)) || null });
      }
    }
  }
  return out.slice(0, 8);
}

export function friendlyCandidates(d) {
  const m = me();
  return NATIONS.map((n) => n.id).filter((id) => id !== m && !hasFixture(G, id, d)).sort((a, b) => G.rank[b] - G.rank[a]);
}

export function requestFriendly(d, opp, home) {
  const m = me();
  if (hasFixture(G, opp, d) || hasFixture(G, m, d)) return { ok: false, msg: 'Termin jest już zajęty.' };
  const tries = G.team.friendAsk[d] || 0;
  if (tries >= 3) return { ok: false, msg: 'Na ten termin wysłano już zbyt wiele zaproszeń.' };
  G.team.friendAsk[d] = tries + 1;
  const pr = clamp(0.55 + (G.rank[m] - G.rank[opp]) / 900 + (G.trust.fed - 50) / 250 + (home ? -0.12 : 0.12), 0.12, 0.95);
  if (Math.random() < pr) {
    if (home) addFriendly(G, d, m, opp); else addFriendly(G, d, opp, m);
    return { ok: true, msg: `Federacja: ${natName(opp)} przyjęła zaproszenie!` };
  }
  return { ok: false, msg: `Federacja: ${natName(opp)} odrzuciła zaproszenie.` };
}

export function cancelFriendly(fx) {
  if (fx.res || G.comps[fx.comp].type !== 'FRI' || fx.d < G.day + 3) return false;
  G.fixtures.splice(G.fixtures.indexOf(fx), 1);
  resetFxIndex();
  trustChange({ fed: -1 });
  return true;
}

// =====================================================================
// U-21
// =====================================================================
function u21Matchday(d) {
  const m = me();
  if (!m) return;
  const w = windowAt(d);
  if (!w || w.kind === 'fin' || d !== w.days[0]) return;
  if (G.u21res.some((x) => x.d === d && x.nat === m)) return;
  const cands = NATIONS.map((n) => n.id).filter((id) => id !== m && NAT[id].conf === NAT[m].conf && Math.abs(G.rank[id] - G.rank[m]) < 300);
  if (!cands.length) return;
  const opp = pick(cands);
  const senior = new Set(G.team.squad);
  const elig = (nid, pref) => {
    const out = (pref || []).map((id) => G.players[id]).filter((p) => p && p.age <= 21 && available(p) && !(nid === m && senior.has(p.id)));
    const ids = new Set(out.map((p) => p.id));
    const rest = poolOf(nid).filter((p) => p.age <= 21 && available(p) && !ids.has(p.id) && !(nid === m && senior.has(p.id))).sort((a, b) => ovr(b) - ovr(a));
    for (const p of rest) { if (out.length >= 18) break; out.push(p); }
    return out.slice(0, 20);
  };
  const spec = (nid, list, home) => {
    const tac = defaultTactics(NAT[nid].str);
    const lineup = autoLineup(list, tac.f);
    const players = Object.fromEntries(list.map((p) => [p.id, p]));
    return { nid, name: NAT[nid].name + ' U-21', players, lineup, bench: autoBench(list, lineup, 9), tac, instr: {}, sp: defaultSetPieces(lineup.filter(Boolean).map((id) => players[id])), train: AI_TRAIN, home, ai: true };
  };
  const mine = elig(m, G.team.u21), theirs = elig(opp, null);
  if (mine.length < 11 || theirs.length < 11) return;
  const home = chance(0.5);
  const match = new Match(home ? spec(m, mine, true) : spec(opp, theirs, true), home ? spec(opp, theirs, false) : spec(m, mine, false), {});
  const r = match.simulate();
  const us = home ? 0 : 1;
  for (const pid of match.sides[us].played) {
    const p = G.players[pid];
    const s = r.pl[us][pid];
    p.u21 = p.u21 || { apps: 0, g: 0 };
    p.u21.apps++;
    p.u21.g += s.g;
    p.mp = (p.mp || 0) + 1;
  }
  const gf = us === 0 ? r.hg : r.ag, ga = us === 0 ? r.ag : r.hg;
  G.u21res.unshift({
    d, nat: m, opp, home, gf, ga,
    sc: r.key.filter((k) => k.type === 'goal' && k.side === us && !k.og).map((k) => fullName(G.players[k.pid])),
  });
  if (G.u21res.length > 40) G.u21res.length = 40;
}

// =====================================================================
// ROZGRYWKI: kontrola etapów, cele, trofea
// =====================================================================
function compCheck(c) {
  if (!c) return;
  let evs = [];
  if (c.type === 'LN') evs = checkLN(G, c);
  else if (c.type === 'Q') evs = checkQual(G, c);
  else if (c.type === 'FIN') evs = checkFinals(G, c);
  for (const e of evs) handleCompEvent(c, e);
  evalObjectives(c);
}

function inComp(c, nid) {
  return (c.groups || []).some((g) => g.teams.includes(nid));
}

function handleCompEvent(c, e) {
  const m = me();
  if (e.type === 'lnFinals' && m && e.teams.includes(m)) {
    msg('system', 'Turniej finałowy Ligi Narodów!', `Wygraliśmy grupę i zagramy w turnieju finałowym Ligi Narodów w czerwcu ${c.year + 1}.`, { important: true });
  }
  if (e.type === 'groupsDone' && m && inComp(c, m)) {
    if (c.type === 'LN') {
      const gi = c.groups.findIndex((g) => g.teams.includes(m));
      const pos = standings(G, c, gi).findIndex((r) => r.t === m) + 1;
      if (pos === 1) achieve('ln_group');
      msg('system', `${c.name}: koniec fazy grupowej`, `Zakończyliśmy rywalizację w grupie ${c.groups[gi].name} na ${pos}. miejscu.`);
    }
    if (c.type === 'FIN') {
      if (e.advanced.includes(m)) {
        achieve('ko_stage');
        G.user.rep = clamp(G.user.rep + 3, 0, 100);
        msg('system', `${c.name}: awans z grupy!`, 'Jesteśmy w fazie pucharowej turnieju!', { important: true });
      } else {
        G.recent.eliminated = true;
        msg('system', `${c.name}: odpadamy`, 'Niestety, nie udało się wyjść z grupy. Dla nas turniej dobiegł końca.', { important: true });
      }
    }
  }
  if (e.type === 'koRound' && m && c.type === 'FIN') {
    const r = c.ko.rounds[e.round];
    if (r.fx.some((id) => { const f = fxById(G, id); return f.h === m || f.a === m; })) {
      if (r.name === 'Półfinał') achieve('semis');
      if (r.name === 'Finał') achieve('final');
    } else if (inComp(c, m) && c.ko.rounds[e.round - 1].fx.some((id) => { const f = fxById(G, id); return f.h === m || f.a === m; })) {
      G.recent.eliminated = true;
      msg('system', `${c.name}: koniec marzeń`, `Odpadliśmy z turnieju w rundzie: ${c.ko.rounds[e.round - 1].name.toLowerCase()}.`, { important: true });
    }
  }
  if (e.type === 'qualDone') {
    for (const nid of Object.keys(G.nats)) {
      if (nid === m || !inComp(c, nid)) continue;
      const gi = c.groups.findIndex((g) => g.teams.includes(nid));
      const seed = c.groups[gi].teams.slice().sort((a, b) => G.rank[b] - G.rank[a]).indexOf(nid);
      if (seed <= 1 && !e.qualified.includes(nid)) G.nats[nid].sec -= 30;
    }
    if (m && inComp(c, m)) {
      if (e.qualified.includes(m)) {
        G.recent.qualified = true;
        achieve('qualify');
        if (rankPositions(G)[m] > 50) achieve('underdog');
        G.user.rep = clamp(G.user.rep + 5, 0, 100);
        msg('president', 'Awans!', `Gratuluję awansu na turniej finałowy: ${c.kind === 'WC' ? 'Mistrzostwa Świata' : c.name.replace('Eliminacje: ', '')}! To ogromny sukces całej drużyny i sztabu.`, { important: true });
      } else {
        G.recent.eliminated = true;
        G.user.rep = clamp(G.user.rep - 3, 0, 100);
        msg('president', 'Brak awansu', 'Nie udało się wywalczyć awansu na turniej. Musimy poważnie porozmawiać o przyszłości.', { important: true });
      }
    }
  }
  if (e.type === 'compWon') {
    const w = e.winner;
    if (m && w === m) {
      G.recent.title = true;
      G.user.trophies.push({ name: c.name, year: c.year, nat: m });
      const bonus = c.type === 'FIN' ? (c.kind === 'WC' ? 25 : 15) : 8;
      G.user.rep = clamp(G.user.rep + bonus, 0, 100);
      trustChange({ fed: 15, fans: 20, media: 10, pl: 10 });
      if (c.type === 'LN') achieve('ln_title');
      if (c.type === 'FIN') achieve(c.kind === 'WC' ? 'wc_title' : 'cont_title');
      msg('president', 'MISTRZOSTWO!', `Fantastycznie! ${c.name}, triumf naszej reprezentacji. Przejdzie Pan do historii!`, { important: true });
    } else if (c.type === 'FIN' || (c.type === 'LN' && c.conf === 'EU')) {
      msg('system', `${c.name}: znamy zwycięzcę`, `Triumfatorem rozgrywek ${c.name} jest reprezentacja: ${natName(w)}.`);
    }
  }
}

function afterCreate(comps, kind) {
  const m = me();
  for (const c of comps) {
    if (!m || !inComp(c, m)) continue;
    addObjective(c);
    const gi = c.groups.findIndex((g) => g.teams.includes(m));
    const others = c.groups[gi].teams.filter((t) => t !== m).map(natName).join(', ');
    msg('system', `Losowanie: ${c.name}`, `Trafiliśmy do grupy ${c.groups[gi].name}. Rywale: ${others}.`, { important: true });
  }
  if (kind === 'FIN' && m && !comps.some((c) => inComp(c, m))) {
    msg('system', 'Losowanie turnieju finałowego', `Odbyło się losowanie grup turnieju: ${comps[0] ? comps[0].name : ''}. Niestety, nie bierzemy w nim udziału.`);
  }
}

const ROUND_TXT = { '1/16 finału': 'Awans do 1/16 finału', '1/8 finału': 'Awans do 1/8 finału', 'Ćwierćfinał': 'Awans do ćwierćfinału', 'Półfinał': 'Awans do półfinału', 'Finał': 'Awans do finału' };

export function addObjective(c) {
  const m = me();
  if (!m || G.objectives.some((o) => o.comp === c.id && o.nat === m) || c.done) return;
  const gi = c.groups.findIndex((g) => g.teams.includes(m));
  if (gi < 0) return;
  const grp = c.groups[gi].teams;
  const seed = grp.slice().sort((a, b) => G.rank[b] - G.rank[a]).indexOf(m);
  let o;
  if (c.type === 'LN') {
    const target = seed === 0 ? 1 : seed === 1 ? 2 : grp.length - 1;
    o = { type: 'pos', target, text: target === 1 ? 'Wygrać grupę w Lidze Narodów' : target === 2 ? 'Zająć co najmniej 2. miejsce w grupie Ligi Narodów' : 'Nie zająć ostatniego miejsca w grupie Ligi Narodów' };
  } else if (c.type === 'Q') {
    if (seed === 0) o = { type: 'pos', target: 1, text: 'Wygrać grupę eliminacyjną' };
    else if (seed === 1) o = { type: 'qual', target: 1, text: 'Wywalczyć awans na turniej finałowy' };
    else if (seed === 2) o = { type: 'pos', target: 3, text: 'Zająć co najmniej 3. miejsce w grupie eliminacyjnej' };
    else o = { type: 'pos', target: grp.length - 1, text: 'Nie zająć ostatniego miejsca w grupie eliminacyjnej' };
  } else if (c.type === 'FIN') {
    const all = c.groups.flatMap((g) => g.teams).sort((a, b) => G.rank[b] - G.rank[a]);
    const r = all.indexOf(m);
    const K = c.ko.rounds.length;
    let target;
    if (r <= 1) target = K;
    else if (r <= 3) target = K - 1;
    else if (r <= 7) target = Math.max(1, K - 2);
    else if (r < all.length / 2) target = 1;
    else target = 0;
    const text = target === 0 ? 'Zdobyć co najmniej 2 punkty w fazie grupowej' : target === 1 ? 'Wyjść z grupy' : ROUND_TXT[c.ko.rounds[target - 1].name] || 'Dobry występ';
    o = { type: 'round', target, text };
  } else return;
  G.objectives.push({ id: G.objectives.length + 1, comp: c.id, cname: c.name, nat: m, status: 'open', created: G.day, ...o });
}

function evalObjectives(c) {
  const m = me();
  if (!m) return;
  for (const o of G.objectives) {
    if (o.status !== 'open' || o.comp !== c.id || o.nat !== m) continue;
    let done = false, ok = false, gap = 0;
    if (c.type === 'LN' || c.type === 'Q') {
      const groupsFinished = c.type === 'LN' ? c.stage !== 'groups' : c.done;
      if (!groupsFinished) continue;
      const gi = c.groups.findIndex((g) => g.teams.includes(m));
      const pos = standings(G, c, gi).findIndex((r) => r.t === m) + 1;
      done = true;
      if (o.type === 'qual') { ok = (c.qualified || []).includes(m); gap = ok ? 0 : 2; }
      else { ok = pos <= o.target; gap = pos - o.target; }
    } else if (c.type === 'FIN') {
      if (stillIn(G, c, m) && !c.done) continue;
      if (c.stage === 'groups') continue;
      done = true;
      const reached = c.ko.rounds.filter((r) => r.fx.some((id) => { const f = fxById(G, id); return f && (f.h === m || f.a === m); })).length + (c.winner === m ? 1 : 0);
      if (o.target === 0) {
        const gi = c.groups.findIndex((g) => g.teams.includes(m));
        const row = standings(G, c, gi).find((r) => r.t === m);
        ok = reached > 0 || (row && row.pts >= 2);
        gap = ok ? 0 : 1;
      } else { ok = reached >= o.target; gap = o.target - reached; }
    }
    if (!done) continue;
    o.status = ok ? 'ok' : 'fail';
    if (ok) {
      trustChange({ fed: 12, fans: 6 });
      G.user.rep = clamp(G.user.rep + 3, 0, 100);
      msg('president', 'Cel zrealizowany', `Cel „${o.text}”, ${o.cname}, został zrealizowany. Zarząd jest zadowolony z Pana pracy.`);
    } else {
      trustChange({ fed: -(10 + 8 * Math.max(1, gap)), fans: -6 });
      msg('president', 'Cel niezrealizowany', `Nie udało się zrealizować celu „${o.text}”, ${o.cname}. Zarząd oczekuje poprawy wyników.`, { important: true });
    }
    checkSack();
  }
}

// =====================================================================
// PRACA: zwolnienie, kontrakt, oferty
// =====================================================================
function endSpell() {
  const sp = G.user.spells[G.user.spells.length - 1];
  if (sp && sp.to == null) sp.to = G.day;
}

function leaveJob() {
  const old = G.user.nat;
  endSpell();
  G.user.unemployed = true;
  G.user.nat = null;
  G.team = null;
  G.unempSince = G.day;
  if (old) {
    G.nats[old].squad = pickSquad(poolOf(old), 23);
    G.nats[old].coach = genName(NAT[old]);
    G.nats[old].sec = 65;
  }
  G.queue = G.queue.filter((e) => ['offer', 'sacked', 'contract', 'info'].includes(e.type));
  return old;
}

export function checkSack() {
  const m = me();
  if (!m) return;
  if (G.trust.fed < SACK[G.diff]) {
    G.user.sacked++;
    G.user.rep = clamp(G.user.rep - 8, 0, 100);
    const old = leaveJob();
    G.queue.unshift({ type: 'sacked', nat: old, title: 'Zwolnienie' });
    msg('president', 'Rozwiązanie umowy', 'Zarząd federacji podjął decyzję o rozwiązaniu umowy z Panem ze skutkiem natychmiastowym. Dziękujemy za współpracę.', { important: true });
  } else if (G.trust.fed < SACK[G.diff] + 12 && G.day - (G.flags.warned || 0) > 90) {
    G.flags.warned = G.day;
    msg('president', 'Ostrzeżenie zarządu', 'Wyniki reprezentacji są dalekie od oczekiwań. Jeśli sytuacja szybko się nie poprawi, zarząd będzie zmuszony wyciągnąć konsekwencje.', { important: true });
  }
}

function contractEnd() {
  G.flags.contractAsked = true;
  const offer = G.trust.fed >= 50;
  G.queue.push({ type: 'contract', offer, title: 'Koniec kontraktu' });
}

export function answerContract(ev, accept) {
  removeEvent(ev);
  if (ev.offer && accept) {
    G.user.contractEnd = contractEndFrom(G.day + 60);
    G.flags.contractAsked = false;
    trustChange({ fed: 3 });
    msg('president', 'Nowy kontrakt', `Cieszymy się, że zostaje Pan z nami! Nowa umowa obowiązuje do ${fmtDateLong(G.user.contractEnd)}.`);
  } else {
    leaveJob();
    msg('system', 'Koniec pracy z kadrą', 'Pana kontrakt dobiegł końca. Czas rozejrzeć się za nowym wyzwaniem.', { important: true });
  }
}

export function resign() {
  G.user.rep = clamp(G.user.rep - 3, 0, 100);
  leaveJob();
  msg('system', 'Rezygnacja', 'Złożył Pan rezygnację ze stanowiska selekcjonera.');
}

function offerFrom(nid, days = 21) {
  if (G.offers.some((o) => o.nat === nid)) return;
  G.offers.push({ nat: nid, until: G.day + days });
  G.queue.push({ type: 'offer', nat: nid, title: 'Oferta pracy' });
}

export function acceptOffer(nid) {
  G.queue = G.queue.filter((e) => !(e.type === 'offer' && e.nat === nid));
  if (me()) {
    endSpell();
    const old = me();
    G.nats[old].squad = pickSquad(poolOf(old), 23);
    G.nats[old].coach = genName(NAT[old]);
  }
  G.offers = [];
  G.nats[nid].coach = null;
  takeJob(nid);
}

export function declineOffer(nid) {
  G.offers = G.offers.filter((o) => o.nat !== nid);
  G.queue = G.queue.filter((e) => !(e.type === 'offer' && e.nat === nid));
}

function vacancyCheck() {
  const m = me();
  for (const n of NATIONS) {
    if (n.id === m) continue;
    const nat = G.nats[n.id];
    if (nat.sec < 18 || chance(0.004)) {
      nat.coach = genName(n);
      nat.sec = 65;
      if (m && G.day - G.user.since > 180 && n.str <= G.user.rep + 22 && n.str >= G.user.rep - 40 && chance(0.35)) offerFrom(n.id);
      else if (!m && n.str <= G.user.rep + 30 && n.str >= G.user.rep - 35) offerFrom(n.id, 45);
    }
  }
}

function unemployedTick(d) {
  G.offers = G.offers.filter((o) => o.until >= d);
  if (G.offers.length || d - (G.unempSince || d) < 20) return;
  if (chance(0.04)) {
    const last = G.user.spells.length ? G.user.spells[G.user.spells.length - 1].nat : null;
    const rep = G.user.rep;
    let cands = NATIONS.filter((n) => n.id !== last && n.str <= rep + 12 && n.str >= rep - 25).map((n) => n.id);
    if (!cands.length) cands = NATIONS.filter((n) => n.id !== last && n.str <= rep + 15).map((n) => n.id);
    if (cands.length) offerFrom(pick(cands), 45);
  }
}

// =====================================================================
// FEDERACJA: prośby
// =====================================================================
export const REQUESTS = [
  { id: 'camp', name: 'Obóz przygotowawczy', desc: 'Dodatkowe dni treningowe: +12 do wszystkich poziomów wytrenowania.', min: 45, cd: 120 },
  { id: 'medical', name: 'Rozbudowa sztabu medycznego', desc: 'Kontuzje będą leczone o 25% szybciej.', min: 60, once: true },
  { id: 'scouts', name: 'Sieć skautów', desc: 'Raporty o potencjale młodych zawodników.', min: 50, once: true },
  { id: 'friendly', name: 'Prestiżowy sparing', desc: 'Federacja spróbuje zorganizować mecz z czołową drużyną świata w najbliższym wolnym terminie.', min: 55, cd: 180 },
];

export function requestState(id) {
  const r = REQUESTS.find((x) => x.id === id);
  const t = G.team;
  if (r.once && t[id]) return { done: true };
  const last = t.req[id];
  if (last != null && r.cd && G.day - last < r.cd) return { wait: r.cd - (G.day - last) };
  return { ok: true };
}

export function makeRequest(id) {
  const r = REQUESTS.find((x) => x.id === id);
  const st = requestState(id);
  if (!st.ok) return { ok: false, msg: st.done ? 'To już zostało zrealizowane.' : `Wróć z tą prośbą za ${st.wait} dni.` };
  G.team.req[id] = G.day;
  const p = clamp(0.5 + (G.trust.fed - r.min) / 30, 0.05, 0.95);
  if (!chance(p)) { trustChange({ fed: -1 }); return { ok: false, msg: 'Zarząd odrzucił prośbę. Zaufanie federacji jest zbyt niskie.' }; }
  trustChange({ fed: -2 });
  const t = G.team;
  if (id === 'camp') { for (const k of TRAIN_KEYS) t.train.lvl[k] = clamp(t.train.lvl[k] + 12, 0, 100); return { ok: true, msg: 'Federacja zorganizowała obóz. Poziom wytrenowania wzrósł.' }; }
  if (id === 'medical') { t.medical = true; return { ok: true, msg: 'Sztab medyczny został rozbudowany.' }; }
  if (id === 'scouts') { t.scouts = true; return { ok: true, msg: 'Skauci będą raportować potencjał młodych zawodników.' }; }
  if (id === 'friendly') {
    const slot = friendlySlots().find((s) => !s.taken);
    if (!slot) return { ok: false, msg: 'Brak wolnych terminów.' };
    const opp = friendlyCandidates(slot.d).filter((x) => rankPositions(G)[x] <= 15)[0];
    if (!opp) return { ok: false, msg: 'Żadna czołowa drużyna nie ma wolnego terminu.' };
    addFriendly(G, slot.d, me(), opp);
    return { ok: true, msg: `Sukces! ${fmtDateLong(slot.d)} zagramy z reprezentacją: ${natName(opp)}.` };
  }
  return { ok: false, msg: '' };
}

// =====================================================================
// ROZMOWY Z ZAWODNIKAMI
// =====================================================================
export function talkTo(pid, kind) {
  const p = G.players[pid];
  const t = G.team;
  if (!p || !t) return { ok: false, text: '' };
  if (G.day - (t.talked[pid] ?? -999) < 30) return { ok: false, text: 'Rozmawiał pan z tym zawodnikiem niedawno. Proszę dać mu trochę czasu.' };
  t.talked[pid] = G.day;
  const n = fullName(p);
  let dm = 0, dpl = 0, text = '';
  const avgR = p.s && p.s.apps ? p.s.rs / p.s.apps : 6.5;
  if (kind === 'praise') {
    if (p.form >= 1 || avgR >= 7) { dm = rint(6, 10); text = `${n} dziękuje za słowa uznania i obiecuje, że nie zwolni tempa.`; }
    else { dm = rint(-1, 3); dpl = -1; text = `${n} wydaje się zaskoczony pochwałą, jego ostatnie występy nie były najlepsze.`; }
  } else if (kind === 'motivate') {
    if (p.a.ld >= 60 || chance(0.6)) { dm = rint(3, 7); if (chance(0.4)) p.form = clamp(p.form + 1, -2, 2); text = `${n} wziął sobie pana słowa do serca. Widać w nim nową energię.`; }
    else { dm = rint(-6, -2); text = `Rozmowa nie poszła najlepiej, ${n} uważa, że i tak daje z siebie wszystko.`; }
  } else if (kind === 'promise') {
    dm = rint(8, 12); t.promises[pid] = G.day; text = `${n} jest wyraźnie zadowolony. Pamiętaj jednak o złożonej obietnicy, musi zagrać od pierwszej minuty w najbliższym meczu!`;
  } else if (kind === 'criticize') {
    if (p.form <= -1) { dm = rint(-4, 0); if (chance(0.5)) p.form = clamp(p.form + 1, -2, 2); text = `${n} przyjął krytykę z pokorą i obiecuje poprawę.`; }
    else { dm = rint(-12, -6); dpl = -2; text = `${n} jest wyraźnie urażony. Uważa, że krytyka była niesprawiedliwa.`; }
  } else if (kind === 'club') {
    dm = rint(1, 3);
    const club = G.clubs[p.club];
    const st = CLUB_STATUS[p.cst].toLowerCase();
    text = p.cst <= 1 ? `${n}: „W ${club.n} czuję się świetnie, trener na mnie stawia, jestem tam ${st}.”` : p.cst === 2 ? `${n}: „W ${club.n} gram w rotacji. Chciałbym grać więcej.”` : `${n}: „W ${club.n} jestem tylko rezerwowym. Myślę o zmianie klubu.”`;
  }
  p.mor = clamp(p.mor + dm, 0, 100);
  if (dpl) trustChange({ pl: dpl });
  return { ok: true, text, dm };
}

// =====================================================================
// TICKI: dzienny, tygodniowy, miesięczny, roczny
// =====================================================================
function dailyTick(d) {
  for (const id in G.players) {
    const p = G.players[id];
    if (p.inj > 0) p.inj--;
    if (p.cond < 96) p.cond = Math.min(100, p.cond + 2.5);
  }
  if (G.team) {
    const w = windowAt(d);
    const inCamp = w && d >= w.days[0] - 3;
    const t = G.team.train;
    for (const k of TRAIN_KEYS) {
      if (inCamp) t.lvl[k] = clamp(t.lvl[k] + t.alloc[k] * 0.45, 0, 100);
      else t.lvl[k] = Math.max(10, t.lvl[k] - 0.12);
    }
  }
  G.offers = G.offers.filter((o) => o.until >= d);
}

function weeklyTick() {
  const m = me();
  const squad = m && G.team ? new Set(G.team.squad) : new Set();
  for (const id in G.players) {
    const p = G.players[id];
    if (!p.inj) p.cond = clamp(p.cond + rint(-6, 6), 72, 100);
    if (Math.random() < 0.25) {
      const up = Math.random() < 0.5 + 0.08 * (1.5 - p.cst);
      p.form = clamp(p.form + (up ? 1 : -1), -2, 2);
    }
    p.mor = Math.round(p.mor + (55 - p.mor) * 0.08);
    p.cond = Math.round(p.cond);
    if (!p.inj && Math.random() < 0.006 + (p.age > 30 ? 0.002 : 0)) {
      p.inj = injuryDays(p.nat);
      if (squad.has(p.id)) msg('doctor', `Uraz: ${fullName(p)}`, `${fullName(p)} doznał kontuzji w meczu klubowym. Przerwa potrwa ok. ${p.inj} ${plural(p.inj, 'dzień', 'dni', 'dni')}.`);
    }
  }
}

function monthlyTick() {
  for (const id in G.players) {
    const p = G.players[id];
    developMonthly(p, p.mp || 0);
    p.mp = 0;
  }
  for (const k of ['fed', 'fans', 'pl', 'media']) G.trust[k] = Math.round((G.trust[k] + (55 - G.trust[k]) * 0.04) * 10) / 10;
  G.rankPrev = rankPositions(G);
  const m = me();
  if (m) {
    const pos = G.rankPrev[m];
    if (pos <= 10) achieve('top10');
    if (pos === 1) achieve('no1');
    if (G.trust.pl < 15) { trustChange({ fed: -6 }); msg('assistant', 'Napięta atmosfera w szatni', 'Zawodnicy coraz otwarciej krytykują decyzje sztabu. Jeśli nic się nie zmieni, zarząd może stracić cierpliwość.'); }
  }
  vacancyCheck();
}

function newYear() {
  for (const id in G.players) G.players[id].age++;
}

function midYear(y) {
  const m = me();
  const squadSet = G.team ? new Set(G.team.squad) : new Set();
  const retired = [];
  for (const n of NATIONS) {
    const nat = G.nats[n.id];
    const keep = [];
    for (const pid of nat.pool) {
      const p = G.players[pid];
      if (!p) continue;
      const pr = p.age >= 38 ? 1 : p.age >= 34 ? 0.3 + (p.age - 34) * 0.15 : 0;
      if (pr && Math.random() < pr) {
        if (n.id === m && (squadSet.has(pid) || p.caps >= 30)) retired.push(p);
        delete G.players[pid];
        continue;
      }
      keep.push(pid);
    }
    nat.pool = keep;
    // zakończenia karier reprezentacyjnych (doświadczeni kadrowicze po trzydziestce)
    const ntRet = [];
    nat.pool = nat.pool.filter((pid) => {
      const p = G.players[pid];
      if (!p || p.age < 33 || p.caps < 30) return true;
      if (Math.random() < 0.12 + (p.age - 33) * 0.08) {
        ntRet.push(p);
        return false;
      }
      return true;
    });
    for (const p of ntRet) {
      if (n.id === m) msg('press', `${fullName(p)} kończy karierę w kadrze`, `${fullName(p)} ogłosił zakończenie kariery reprezentacyjnej. Bilans: ${p.caps} ${plural(p.caps, 'mecz', 'mecze', 'meczów')} i ${p.goals} ${plural(p.goals, 'gol', 'gole', 'goli')} w narodowych barwach. Dziękujemy!`);
      delete G.players[p.id];
    }
    const add = Math.max(4, 36 - nat.pool.length);
    for (let i = 0; i < Math.min(add, 9); i++) {
      const p = makeYouth(G, n.id, Math.random, rint(16, 18));
      nat.pool.push(p.id);
    }
    if (nat.pool.length > 50) {
      const sorted = nat.pool.map((id) => G.players[id]).filter((p) => p.age >= 26).sort((a, b) => ovr(a) - ovr(b));
      const drop = new Set(sorted.slice(0, nat.pool.length - 50).map((p) => p.id));
      nat.pool = nat.pool.filter((id) => !drop.has(id) || squadSet.has(id));
      for (const id of drop) if (!squadSet.has(id)) delete G.players[id];
    }
    nat.squad = (nat.squad || []).filter((id) => G.players[id]);
    nat.u21 = (nat.u21 || []).filter((id) => G.players[id]);
  }
  // transfery
  const moved = [];
  for (const id in G.players) {
    const p = G.players[id];
    const club = G.clubs[p.club];
    const o = ovr(p);
    if (!club) { assignClub(G, p); continue; }
    if (Math.abs(o - club.lv) > 4 ? Math.random() < 0.5 : Math.random() < 0.08) {
      const before = p.club;
      assignClub(G, p);
      if (squadSet.has(p.id) && before !== p.club) moved.push(`${fullName(p)}: ${G.clubs[before].n} → ${G.clubs[p.club].n}`);
    } else p.cst = clubStatusFor(o, club.lv);
  }
  if (G.team) {
    G.team.squad = G.team.squad.filter((id) => G.players[id]);
    G.team.prevSquad = (G.team.prevSquad || []).filter((id) => G.players[id]);
    G.team.u21 = G.team.u21.filter((id) => G.players[id] && G.players[id].age <= 21);
    if (G.team.lineup) G.team.lineup = G.team.lineup.map((id) => (id != null && G.players[id] ? id : null));
    if (G.team.bench) G.team.bench = G.team.bench.filter((id) => G.players[id]);
  }
  if (m) {
    if (retired.length) msg('assistant', 'Zakończenia karier', `Z profesjonalnym futbolem pożegnali się: ${retired.map(fullName).join(', ')}.`);
    if (moved.length) msg('assistant', 'Okno transferowe', `Transfery naszych kadrowiczów:\n${moved.slice(0, 12).join('\n')}`);
    const youngTalents = poolOf(m).filter((p) => p.age <= 18).sort((a, b) => b.pot - a.pot).slice(0, 3);
    if (youngTalents.length) msg('assistant', 'Nowe talenty', `Warto obserwować młodzież: ${youngTalents.map((p) => `${fullName(p)} (${p.pos}, ${p.age} l.)`).join(', ')}.`);
  }
  // archiwizacja starych rozgrywek
  for (const id of G.compOrder.slice()) {
    const c = G.comps[id];
    if (!c || !c.done || c.year > y - 4) continue;
    G.archive.push({ name: c.name, year: c.year, winner: c.winner || null, runnerUp: c.runnerUp || null, type: c.type });
    G.fixtures = G.fixtures.filter((f) => f.comp !== id);
    delete G.comps[id];
    G.compOrder = G.compOrder.filter((x) => x !== id);
  }
  G.fixtures = G.fixtures.filter((f) => G.comps[f.comp]);
  resetFxIndex();
}

// =====================================================================
// POMOCNICZE DLA UI
// =====================================================================
/** Przewidywana jedenastka rywala (bez zmiany stanu gry). */
export function predictLineup(nid) {
  const nat = G.nats[nid];
  const ids = nat.squad && nat.squad.length ? nat.squad : pickSquad(poolOf(nid), 23);
  const squad = ids.map((id) => G.players[id]).filter(Boolean);
  const opp = me();
  const tac = opp && opp !== nid ? aiTactics(nat.tac, strengthOf(nid), strengthOf(opp)) : { ...nat.tac };
  return { f: tac.f, tac, lineup: autoLineup(squad, tac.f) };
}

export function compsOf(nid) {
  return G.compOrder.map((id) => G.comps[id]).filter((c) => c && (c.groups || []).some((g) => g.teams.includes(nid)) || (c && c.type === 'FRI' && G.fixtures.some((f) => f.comp === c.id && (f.h === nid || f.a === nid))));
}

export function playerNat(pid) {
  const p = G.players[pid];
  return p ? p.nat : null;
}

export function topScorers(c, n = 10) {
  return Object.entries(c.sc || {}).map(([pid, g]) => ({ p: G.players[pid], g })).filter((x) => x.p).sort((a, b) => b.g - a.g).slice(0, n);
}

export function setTraining(k, delta) {
  const a = G.team.train.alloc;
  const total = TRAIN_KEYS.reduce((s, x) => s + a[x], 0);
  const nv = clamp(a[k] + delta, 0, 10);
  if (delta > 0 && total >= TRAIN_BUDGET) return false;
  a[k] = nv;
  return true;
}

export function trustLabel(v) {
  return v >= 80 ? 'bardzo wysokie' : v >= 60 ? 'wysokie' : v >= 40 ? 'umiarkowane' : v >= 25 ? 'niskie' : 'krytyczne';
}

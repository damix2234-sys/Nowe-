// Tryb zawodnika: kariera własnego piłkarza. Ligi, puchar, reprezentacja, mecze z decyzjami w kluczowych
// momentach, trening i punkty rozwoju, transfery, nagrody. Stan trzymany w PC (osobny od trybu selekcjonera).
import { mkRng, rint, gauss, pick, clamp, plural } from '../core/util.js';
import { NATIONS, NAT, LEAGUES } from '../data/nations.js';
import { makePlayer, genName, clubNameFor } from '../engine/db.js';
import { ovr, posRating, POS_W, ATTR_NAMES, FORM_MUL, applyDelta, GK_ATTRS } from '../engine/player.js';
import { SCEN, POS_SCEN } from './scenarios.js';
import { ensureRosters, teamMatchStats, relAfterMatch, rosterSeasonEnd, signPlayers, AWARDS, awardRace, globalRanking, globalAwardFor, addHist, ME, rosterOf } from './rosters.js';

export let PC = null;
export function setCareer(pc) { PC = pc; if (pc) migrateCareer(pc); }

/** Uzupełnia zapisy kariery z wcześniejszych wersji gry o nowe rozgrywki i pola. */
function migrateCareer(st) {
  if (!st.ss) return;
  // 0.9.9: stałe składy klubów ze statystykami zawodników
  if (st.clubs && !st.pl) ensureRosters(st);
  if (st.ss.euroApps == null) st.ss.euroApps = 0;
  // puchary europejskie: brak (zapisy sprzed 0.9.2) albo stary format bez grup (0.9.2–0.9.7) → nowe rozgrywki w trwającym sezonie
  // 0.9.9: w pucharach tylko kluby z Europy
  const nonEu = st.euro && st.euro.ucl && st.euro.ucl.teams && [st.euro.ucl, st.euro.usl].some((E) => E && E.teams.some((id) => st.clubs[id] && NAT[st.clubs[id].nat].conf !== 'EU'));
  if (st.leagues && st.clubs && (!st.euro || !st.euro.ucl || !st.euro.ucl.kind || nonEu)) {
    buildEuro(st, false);
    const done = st.phase === 'season' ? EURO_WEEKS.filter((w) => w < st.week).length : EURO_WEEKS.length;
    for (let i = 0; i < done; i++) for (const E of Object.values(st.euro)) euroRound(st, E, i);
  }
}

export const SEASON_WEEKS = 30;
export const INTL_WEEKS = [3, 7, 11, 19, 25];
export const CUP_WEEKS = [5, 10, 16, 23];
export const WINTER_WINDOW = 14;
// tygodnie meczów europejskich: 7 kolejek fazy grupowej, potem ćwierćfinał, półfinał i finał (Ultra Liga: 9 kolejek)
export const EURO_WEEKS = [1, 2, 4, 6, 8, 12, 13, 15, 17, 20];
export const EURO_NAMES = { ulg: 'Ultra Liga', ucl: 'Liga Mistrzów', usl: 'Super Liga' };
export const EURO_SIZE = 32;
export const KO_NAMES = ['ćwierćfinał', 'półfinał', 'finał'];
export const GROUP_NAMES = ['A', 'B', 'C', 'D'];
export const koStageName = (E) => ({ 4: 'ćwierćfinał', 2: 'półfinał', 1: 'finał' })[E.ko ? E.ko.ties.length : 0] || 'faza pucharowa';
const MONTHS = ['sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień', 'styczeń', 'luty', 'marzec', 'kwiecień', 'maj'];
const sig = (x) => 1 / (1 + Math.exp(-x));
const fname = (p) => `${p.fn} ${p.ln}`;

export const STATUS = ['Gwiazda zespołu', 'Podstawowy zawodnik', 'Rezerwowy', 'Młodzieżowiec'];
export const TRAIN_FOCUS = {
  tech: { name: 'Technika', ic: '⚽', keys: ['dr', 'ft', 'te', 'ps', 'cr', 'fla'], desc: 'Drybling, przyjęcie, technika, podania' },
  shoot: { name: 'Strzały', ic: '🎯', keys: ['sh', 'ls', 'fk', 'pen', 'hd', 'cm'], desc: 'Wykończenie, strzały z dystansu, stałe fragmenty' },
  def: { name: 'Obrona', ic: '🛡️', keys: ['tk', 'mk', 'psn', 'ant', 'brv', 'hd'], desc: 'Odbiór, krycie, ustawianie się' },
  phys: { name: 'Fizyczność', ic: '💪', keys: ['acc', 'sp', 'st', 'en', 'agi', 'jmp', 'bal', 'nf'], desc: 'Szybkość, siła, wytrzymałość' },
  mind: { name: 'Taktyka', ic: '🧠', keys: ['dec', 'vis', 'otb', 'tmw', 'wr', 'con', 'det'], desc: 'Decyzje, wizja, gra bez piłki' },
  gk: { name: 'Bramkarski', ic: '🧤', keys: ['gk', 'han', 'ovo', 'aer', 'coa', 'gw', 'kic', 'thr', 'com'], desc: 'Tylko dla bramkarzy' },
  rest: { name: 'Regeneracja', ic: '🛌', keys: [], desc: 'Odpoczynek: dużo świeżości, mało punktów' },
};

// ---------------------------------------------------------------------
// tworzenie świata kariery
// ---------------------------------------------------------------------
function buildWorld(st, r) {
  const clubs = [];
  const used = new Set();
  const leagues = {};
  const add = (n, nat, lv, div) => { const c = { id: clubs.length, n, nat, lv: Math.round(lv * 10) / 10, div }; clubs.push(c); return c.id; };
  const natList = [...new Set([...Object.keys(LEAGUES), st.me.nat])];
  for (const nid of natList) {
    const nat = NAT[nid];
    const lg = LEAGUES[nid];
    const cities = (lg ? lg.cities : nat.cities).slice();
    const top = lg ? (lg.tier === 1 ? 88 : lg.tier === 2 ? 79 : 73) : nat.str - 4;
    const divs = nid === st.me.nat ? 2 : 1;
    for (let d = 1; d <= divs; d++) {
      const ids = [];
      for (let i = 0; i < 12; i++) {
        const city = cities[(i + (d - 1) * 5) % cities.length];
        const lv = d === 1 ? top - i * (lg ? 1.5 : 1.3) + gauss(r) : top - 12 - i * 1.2 + gauss(r);
        ids.push(add(clubNameFor(nid, city, r, used), nid, clamp(lv, 38, 92), d));
      }
      leagues[`${nid}-${d}`] = { key: `${nid}-${d}`, nat: nid, div: d, teams: ids };
    }
  }
  st.clubs = clubs;
  st.leagues = leagues;
}

export function leagueName(L) {
  const n = NAT[L.nat].name;
  return L.div === 1 ? `Liga ${n}` : `${n}: II liga`;
}

function roundRobin(ids, r) {
  const t = ids.slice().sort(() => r() - 0.5);
  const n = t.length, rounds = [];
  for (let k = 0; k < n - 1; k++) {
    const rd = [];
    for (let i = 0; i < n / 2; i++) {
      const a = t[i], b = t[n - 1 - i];
      rd.push(k % 2 ? { h: a, a: b, r: null } : { h: b, a: a, r: null });
    }
    rounds.push(rd);
    t.splice(1, 0, t.pop());
  }
  return [...rounds, ...rounds.map((rd) => rd.map((m) => ({ h: m.a, a: m.h, r: null })))];
}

const emptyRow = () => ({ p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 });

/** Liga Mistrzów / Super Liga: 4 grupy (rozstawienie według siły), w grupie każdy z każdym, 2 najlepsze do ćwierćfinału. */
function mkGroups(st, name, teams, r) {
  const sorted = teams.slice().sort((a, b) => st.clubs[b].lv - st.clubs[a].lv);
  const groups = [[], [], [], []];
  sorted.forEach((id, i) => { const row = Math.floor(i / 4); groups[row % 2 ? 3 - (i % 4) : i % 4].push(id); });
  const per = groups.map((g) => (g.length < 2 ? [] : roundRobin(g.length % 2 ? [...g, -1] : g, r).slice(0, g.length % 2 ? g.length : g.length - 1).map((rd) => rd.filter((m) => m.h >= 0 && m.a >= 0))));
  const G = Math.max(0, ...per.map((x) => x.length));
  const gfx = Array.from({ length: G }, (_, i) => per.flatMap((x) => x[i] || []));
  return { kind: 'groups', name, teams: teams.slice(), groups, gfx, G, table: Object.fromEntries(teams.map((id) => [id, emptyRow()])), ko: null, stage: 'G', winner: null, rank: [] };
}

/** Ultra Liga: 10 najlepszych klubów z faz pucharowych, liga każdy z każdym, wygrywa pierwsze miejsce. */
function mkUltra(name, teams, r) {
  const fx = roundRobin(teams.length % 2 ? [...teams, -1] : teams, r).slice(0, teams.length % 2 ? teams.length : teams.length - 1).map((rd) => rd.filter((m) => m.h >= 0 && m.a >= 0));
  return { kind: 'league', name, teams: teams.slice(), fx, table: Object.fromEntries(teams.map((id) => [id, emptyRow()])), round: 0, winner: null, stage: 'L' };
}

/** Kluby w grupie posortowane jak w tabeli. */
export function groupTable(E, g) {
  return E.groups[g].map((id) => ({ id, ...E.table[id] })).sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf);
}

/** Puchary sezonu: kwalifikacja z lig (poprzedni sezon albo siła klubów) i Ultra Liga z poprzedniej fazy pucharowej. */
function buildEuro(st, useTables) {
  const r = Math.random;
  const ultra = (st.nextUltra || []).filter((id) => st.clubs[id]).slice(0, 10);
  const inU = new Set(ultra);
  const c1 = [], c2 = [];
  for (const L of Object.values(st.leagues)) {
    // puchary są europejskie: grają w nich tylko kluby z lig Europy
    if (L.div !== 1 || NAT[L.nat].conf !== 'EU') continue;
    const played = useTables && L.table && Object.values(L.table).some((t) => t.p > 0);
    const order = [...new Set((played ? sortedTable(L).map((t) => t.id).filter((id) => L.teams.includes(id)) : []).concat(L.teams.slice().sort((a, b) => st.clubs[b].lv - st.clubs[a].lv)))];
    c1.push(...order.slice(0, 3)); c2.push(...order.slice(3, 8));
  }
  const byLv = (a, b) => st.clubs[b].lv - st.clubs[a].lv;
  const ucl = c1.filter((id) => !inU.has(id)).sort(byLv).slice(0, EURO_SIZE);
  // za mało mistrzów i wicemistrzów: brakujące miejsca dostają najlepsze kluby z dalszych miejsc
  if (ucl.length < EURO_SIZE) ucl.push(...c2.filter((id) => !inU.has(id)).slice().sort(byLv).slice(0, EURO_SIZE - ucl.length));
  const inL = new Set(ucl);
  const usl = c2.concat(c1).filter((id) => !inU.has(id) && !inL.has(id)).sort(byLv).slice(0, EURO_SIZE);
  st.euro = { ucl: mkGroups(st, EURO_NAMES.ucl, ucl, r), usl: mkGroups(st, EURO_NAMES.usl, usl, r) };
  if (ultra.length >= 4) st.euro.ulg = mkUltra(EURO_NAMES.ulg, ultra, r);
}

function koResult(st, t) {
  if (t.w != null) return;
  const r = simScore(st.clubs[t.h].lv, st.clubs[t.a].lv, true);
  t.r = r;
  simStats(st, t.h, t.a, r);
  if (r[0] === r[1]) { const hw = Math.random() < 0.5 + (st.clubs[t.h].lv - st.clubs[t.a].lv) / 60; t.pens = hw ? [5, 4] : [3, 4]; t.w = hw ? t.h : t.a; }
  else t.w = r[0] > r[1] ? t.h : t.a;
}

/** Rozgrywa i-tą kolejkę pucharu (mecze, których nie zagrał gracz) i przechodzi do kolejnej fazy. */
export function euroRound(st, E, i) {
  if (!E) return;
  if (E.kind === 'league') {
    for (const m of E.fx[i] || []) { if (m.r) continue; m.r = simScore(st.clubs[m.h].lv, st.clubs[m.a].lv, true); applyResult(E, m); simStats(st, m.h, m.a, m.r); }
    E.round = Math.max(E.round, i + 1);
    return;
  }
  if (i < E.G) {
    for (const m of E.gfx[i] || []) { if (m.r) continue; m.r = simScore(st.clubs[m.h].lv, st.clubs[m.a].lv, true); applyResult(E, m); simStats(st, m.h, m.a, m.r); }
    E.round = i + 1;
    if (i === E.G - 1) {
      const T = [0, 1, 2, 3].map((g) => groupTable(E, g).map((x) => x.id));
      const pair = (a, b) => (a != null && b != null ? { h: a, a: b, r: null, w: null } : null);
      E.ko = { round: 0, ties: [pair(T[0][0], T[1][1]), pair(T[1][0], T[0][1]), pair(T[2][0], T[3][1]), pair(T[3][0], T[2][1])].filter(Boolean), out: [] };
      E.stage = 'KO';
    }
    return;
  }
  if (!E.ko || E.stage !== 'KO' || i - E.G !== E.ko.round) return;
  for (const t of E.ko.ties) koResult(st, t);
  const win = E.ko.ties.map((t) => t.w);
  const lose = E.ko.ties.map((t) => (t.w === t.h ? t.a : t.h));
  const gp = (id) => E.table[id].pts * 100 + (E.table[id].gf - E.table[id].ga);
  E.ko.out.unshift(lose.sort((a, b) => gp(b) - gp(a)));
  if (win.length === 1) {
    E.winner = win[0]; E.stage = 'done';
    E.rank = [win[0], ...E.ko.out.flat()];
    return;
  }
  E.ko.ties = [];
  for (let k = 0; k + 1 < win.length; k += 2) E.ko.ties.push({ h: win[k], a: win[k + 1], r: null, w: null });
  E.ko.round++;
}

function newSeason(st) {
  const r = Math.random;
  // kwalifikacja do pucharów europejskich według poprzedniego sezonu (pierwszy sezon: siła klubów)
  buildEuro(st, true);
  for (const L of Object.values(st.leagues)) {
    L.fx = roundRobin(L.teams, r);
    L.table = Object.fromEntries(L.teams.map((id) => [id, { p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }]));
    L.round = 0;
    L.scorers = {};
  }
  // puchar kraju zawodnika: 16 drużyn z obu lig
  const nat = st.me.nat;
  const teams = [...st.leagues[`${nat}-1`].teams, ...st.leagues[`${nat}-2`].teams.slice().sort((a, b) => st.clubs[b].lv - st.clubs[a].lv).slice(0, 4)];
  st.cup = { nat, round: 0, alive: teams.sort(() => r() - 0.5), ties: [], done: false, winner: null };
  st.week = 0;
  st.phase = 'season';
  st.ss = { apps: 0, starts: 0, goals: 0, assists: 0, rsum: 0, mom: 0, yc: 0, rc: 0, cupApps: 0, euroApps: 0, natApps: 0, natGoals: 0, cleanSheets: 0, min: 0 };
  st.trainedWeek = -1;
  st.tour = null;
}

export function startClubs(st) {
  return Object.values(st.leagues).filter((L) => L.nat === st.me.nat && L.div === 2)
    .flatMap((L) => L.teams).map((id) => st.clubs[id]).sort((a, b) => a.lv - b.lv).slice(0, 8);
}

/** Szkic kariery: zawodnik i świat klubów (bez klubu, wybierany w następnym kroku). */
export function draftCareer({ fn, ln, nat, pos, num, look, foot = 'R' }) {
  const r = Math.random;
  const tmp = { players: {}, nextPid: 1 };
  const target = 46 + rint(0, 4);
  const p = makePlayer(tmp, nat, pos, target, 17, r);
  delete p._o;
  Object.assign(p, { fn, ln, num, look, foot, form: 0, mor: 65, cond: 100, inj: 0, susp: 0, caps: 0, goals: 0 });
  p.pot = clamp(Math.round(80 + gauss(r) * 5), 72, 94);
  const st = {
    v: 1, mode: 'career', year: 2026, me: p, club: null, status: 2, tp: 6, money: 0, wage: 0, contract: 0,
    car: { apps: 0, goals: 0, assists: 0, rsum: 0, mom: 0, yc: 0, rc: 0, natApps: 0, natGoals: 0 },
    seasons: [], trophies: [], awards: [], msgs: [], msgSeq: 1, offers: [], listed: false, retired: false, log: [],
  };
  buildWorld(st, r);
  ensureRosters(st);
  return st;
}

export function finishCareer(st, clubId) {
  st.club = clubId;
  st.contract = st.year + 3;
  st.wage = wageFor(st.clubs[clubId].lv, ovr(st.me));
  newSeason(st);
  setCareer(st);
  updateStatus();
  msg('Witaj w klubie!', `${st.clubs[clubId].n} podpisał z Tobą pierwszy profesjonalny kontrakt do ${st.contract} roku. Trener liczy na Twój rozwój. Ciężka praca na treningach i dobre występy dadzą Ci miejsce w składzie.`);
  return st;
}

export function wageFor(lv, o) { return Math.round(150 * Math.pow(1.11, (lv + o) / 2 - 45) / 10) * 10; }

// ---------------------------------------------------------------------
// pomocnicze
// ---------------------------------------------------------------------
export const myClub = () => PC.clubs[PC.club];
export const myLeague = () => Object.values(PC.leagues).find((L) => L.teams.includes(PC.club));
export const meOvr = () => ovr(PC.me);
export function weekLabel(w = PC.week) {
  if (PC.phase === 'summer') return `Lato ${PC.year + 1}`;
  return `Sezon ${PC.year}/${String((PC.year + 1) % 100).padStart(2, '0')} · tydzień ${w + 1} · ${MONTHS[Math.min(9, Math.floor((w * 10) / SEASON_WEEKS))]}`;
}
export function msg(subj, body) { PC.msgs.unshift({ id: PC.msgSeq++, subj, body, w: PC.week, y: PC.year, read: false }); if (PC.msgs.length > 80) PC.msgs.length = 80; }

export function updateStatus() {
  const d = meOvr() - myClub().lv;
  PC.status = d >= 3 ? 0 : d >= -2 ? 1 : d >= -7 ? 2 : 3;
}

export function sortedTable(L) {
  return Object.entries(L.table).map(([id, t]) => ({ id: +id, ...t }))
    .sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf);
}

function poisson(l) { let k = 0, p = Math.exp(-l), s = p; const u = Math.random(); while (u > s && k < 10) { k++; p *= l / k; s += p; } return k; }
export function simScore(sh, sa, home = true) {
  const lh = (home ? 1.45 : 1.2) * Math.exp((sh - sa) / 17), la = (home ? 1.12 : 1.2) * Math.exp((sa - sh) / 17);
  return [poisson(lh), poisson(la)];
}
/** Statystyki zawodników obu klubów w meczu symulowanym. */
function simStats(st, h, a, r) { teamMatchStats(st, h, r[0], r[1]); teamMatchStats(st, a, r[1], r[0]); }

function applyResult(L, m) {
  const [hg, ag] = m.r, H = L.table[m.h], A = L.table[m.a];
  H.p++; A.p++; H.gf += hg; H.ga += ag; A.gf += ag; A.ga += hg;
  if (hg > ag) { H.w++; A.l++; H.pts += 3; } else if (hg < ag) { A.w++; H.l++; A.pts += 3; } else { H.d++; A.d++; H.pts++; A.pts++; }
}

/** Imiona kolegów z drużyny i rywali do komentarza (stałe dla klubu). */
export function rosterNames(clubOrNat, n = 14) {
  const isNat = typeof clubOrNat === 'string';
  const natId = isNat ? clubOrNat : PC.clubs[clubOrNat].nat;
  const rr = mkRng((isNat ? natId.charCodeAt(0) * 131 + natId.charCodeAt(1) * 7 : clubOrNat * 97 + 13) + PC.year);
  return Array.from({ length: n }, () => { const g = genName(NAT[natId], rr); return g.ln; });
}

// ---------------------------------------------------------------------
// tydzień: mecze zawodnika
// ---------------------------------------------------------------------
export function isIntlWeek(w = PC.week) { return PC.phase === 'season' && INTL_WEEKS.includes(w); }
export function leagueRoundForWeek(w) {
  if (INTL_WEEKS.includes(w)) return -1;
  const rd = w - INTL_WEEKS.filter((x) => x < w).length;
  return rd < 22 ? rd : -1;
}

/** W którym pucharze europejskim gra klub zawodnika w tym sezonie: 'ucl', 'usl' albo null. */
export function myEuro() {
  if (!PC.euro) return null;
  for (const k of ['ulg', 'ucl', 'usl']) if (PC.euro[k] && PC.euro[k].teams.includes(PC.club)) return k;
  return null;
}

/** Czy zawodnik jest powołany do reprezentacji (przy obecnej ocenie). */
export function natCallup() {
  const s = NAT[PC.me.nat].str;
  const o = meOvr();
  if (PC.me.inj > 0) return null;
  if (o >= s + 1) return 'start';
  if (o >= s - 5) return 'sub';
  return null;
}

function roleAtClub() {
  const p = PC.me;
  if (p.inj > 0 || p.susp > 0) return 'out';
  const st = PC.status;
  const formB = p.form * 0.05 + (p.cond < 60 ? -0.25 : 0);
  const u = Math.random();
  const start = [0.98, 0.85, 0.25, 0.06][st] + formB;
  const sub = [0, 0.12, 0.55, 0.3][st];
  return u < start ? 'start' : u < start + sub ? 'sub' : 'out';
}

/** Lista meczów zawodnika w bieżącym tygodniu (do rozegrania z decyzjami). */
export function weekMatches() {
  const w = PC.week, out = [];
  if (PC.phase === 'summer') {
    const t = PC.tour;
    if (t && !t.done && t.next) out.push(t.next);
    return out;
  }
  const eu = myEuro();
  if (eu && EURO_WEEKS.includes(w)) {
    const i = EURO_WEEKS.indexOf(w), E = PC.euro[eu];
    const mine = (x) => x.h === PC.club || x.a === PC.club;
    if (E.kind === 'league') { const m = E.fx[i] && E.fx[i].find(mine); if (m) out.push({ comp: eu, title: `${E.name}, kolejka ${i + 1}`, h: m.h, a: m.a, fx: m }); }
    else if (i < E.G) { const m = E.gfx[i] && E.gfx[i].find(mine); if (m) out.push({ comp: eu, title: `${E.name}, grupa ${GROUP_NAMES[E.groups.findIndex((g) => g.includes(PC.club))]}, kolejka ${i + 1}`, h: m.h, a: m.a, fx: m }); }
    else if (E.stage === 'KO' && i - E.G === E.ko.round) { const t = E.ko.ties.find((x) => mine(x) && x.w == null); if (t) out.push({ comp: eu, title: `${E.name}: ${koStageName(E)}`, h: t.h, a: t.a, tie: t, knock: true, euroTie: true }); }
  }
  if (CUP_WEEKS.includes(w) && PC.cup && !PC.cup.done) {
    const tie = cupTieFor(PC.club);
    if (tie) out.push({ comp: 'cup', title: `Puchar ${NAT[PC.cup.nat].name}: ${cupRoundName()}`, h: tie.h, a: tie.a, tie, knock: true });
  }
  if (isIntlWeek(w)) {
    const role = natCallup();
    if (role) {
      const opps = intlOpponents(2);
      for (const o of opps) out.push({ comp: 'intl', title: o.qual ? 'Reprezentacja: mecz eliminacyjny' : 'Reprezentacja: mecz towarzyski', hn: PC.me.nat, an: o.nid, home: Math.random() < 0.5, role });
    }
  } else {
    const rd = leagueRoundForWeek(w);
    const L = myLeague();
    if (rd >= 0 && L.fx[rd]) {
      const m = L.fx[rd].find((x) => x.h === PC.club || x.a === PC.club);
      if (m) out.push({ comp: 'league', title: `${leagueName(L)}, kolejka ${rd + 1}`, h: m.h, a: m.a, fx: m, rd });
    }
  }
  return out;
}

function intlOpponents(n) {
  const me = NAT[PC.me.nat];
  const cands = NATIONS.filter((x) => x.id !== me.id && Math.abs(x.str - me.str) < 14).sort(() => Math.random() - 0.5);
  return cands.slice(0, n).map((x) => ({ nid: x.id, qual: x.conf === me.conf && Math.random() < 0.7 }));
}

// ---------------------------------------------------------------------
// mecz z decyzjami
// ---------------------------------------------------------------------
/** Przygotowanie meczu: strony, siły, rola zawodnika, kluczowe momenty i tło. */
export function setupMatch(fx) {
  const p = PC.me;
  let us, them, usName, themName, usStr, themStr, home, usKey, themKey;
  if (fx.comp === 'intl' || fx.comp === 'tour') {
    home = fx.comp === 'tour' ? true : fx.home;
    usKey = PC.me.nat; themKey = fx.an === PC.me.nat ? fx.hn : fx.an;
    usName = NAT[usKey].name; themName = NAT[themKey].name;
    usStr = NAT[usKey].str; themStr = NAT[themKey].str;
    if (fx.comp === 'tour') home = false;
  } else {
    home = fx.h === PC.club;
    us = PC.club; them = home ? fx.a : fx.h;
    usKey = us; themKey = them;
    usName = PC.clubs[us].n; themName = PC.clubs[them].n;
    usStr = PC.clubs[us].lv; themStr = PC.clubs[them].lv;
  }
  const role = fx.role || roleAtClub();
  const enter = role === 'start' ? 0 : role === 'sub' ? rint(55, 75) : 99;
  const o = ovr(p);
  const onStr = usStr + (o - usStr) * 0.09;
  const M = {
    fx, comp: fx.comp, title: fx.title, home, usKey, themKey, usName, themName, usStr, themStr, role, enter, leave: 99,
    min: 0, goals: [0, 0], log: [], events: [], rating: role === 'out' ? null : 6.3, my: { g: 0, a: 0, yc: 0, rc: 0, saves: 0, ok: 0, bad: 0 },
    mates: rosterNames(fx.comp === 'intl' || fx.comp === 'tour' ? usKey : us), opps: rosterNames(fx.comp === 'intl' || fx.comp === 'tour' ? themKey : them),
    done: false, knock: !!fx.knock || (fx.comp === 'tour' && fx.ko),
  };
  // tło: gole drużyn poza kluczowymi momentami zawodnika
  const sUs = role === 'out' ? usStr : onStr;
  const [gu, gt] = simScore(home ? sUs : themStr, home ? themStr : sUs, home);
  const ourBg = home ? gu : gt, theirBg = home ? gt : gu;
  const scale = role === 'out' ? 1 : 0.72;
  const sround = (x) => Math.floor(x) + (Math.random() < x % 1 ? 1 : 0);
  for (let i = 0; i < sround(ourBg * scale); i++) M.events.push({ min: rint(2, 90), t: 'goal', side: 0 });
  for (let i = 0; i < sround(theirBg * scale); i++) M.events.push({ min: rint(2, 90), t: 'goal', side: 1 });
  // kluczowe momenty zawodnika
  if (role !== 'out') {
    const n = role === 'start' ? rint(3, 5) : rint(1, 2);
    for (let i = 0; i < n; i++) M.events.push({ min: rint(Math.max(2, enter + 2), 89), t: 'moment' });
    if (Math.random() < 0.09) M.events.push({ min: rint(Math.max(5, enter + 3), 88), t: 'moment', scen: p.pos === 'GK' ? 'gkPen' : 'pen', ifTaker: p.pos !== 'GK' });
    if (p.pos !== 'GK' && (p.a.fk ?? 40) >= 58 && Math.random() < 0.25) M.events.push({ min: rint(Math.max(5, enter + 3), 88), t: 'moment', scen: 'fk' });
  }
  M.events.sort((a, b) => a.min - b.min);
  M.line = `${M.home ? M.usName : M.themName} vs ${M.home ? M.themName : M.usName}`;
  return M;
}

/** Efektywny atrybut zawodnika w meczu. */
function E(k) {
  const p = PC.me;
  const f = FORM_MUL[p.form] ?? 1;
  const c = 0.82 + 0.18 * (p.cond ?? 100) / 100;
  const m = 1 + ((p.mor ?? 60) - 60) / 1500;
  return (p.a[k] ?? 40) * f * c * m;
}

const scenIsPen = (opt) => !!opt.pen;

/** Wybór scenariusza momentu dla pozycji zawodnika. */
export function pickScenario(M, ev) {
  if (ev.scen) return ev.scen;
  const tab = POS_SCEN[PC.me.pos] || POS_SCEN.CM;
  const tot = tab.reduce((s, x) => s + x[1], 0);
  let u = Math.random() * tot;
  for (const [id, w] of tab) { u -= w; if (u <= 0) return id; }
  return tab[0][0];
}

/** Szansa powodzenia opcji. */
export function optChance(M, opt) {
  let me = 0, tw = 0;
  for (const [k, w] of Object.entries(opt.w)) { me += w * E(k); tw += w; }
  me /= tw || 1;
  if (opt.height) me += ((PC.me.h || 182) - 182) * 0.35;
  const opp = M.themStr + (M.comp === 'intl' || M.comp === 'tour' ? 0 : 0);
  let pc = sig((me - opp) / 10 + (opt.bias || 0));
  // nawet celny strzał może obronić bramkarz: opcje kończące się golem są trudniejsze
  if (opt.ok && opt.ok.goal) pc *= scenIsPen(opt) ? 0.88 : 0.6;
  return clamp(pc, 0.03, opt.ok && opt.ok.goal ? 0.85 : 0.95);
}

function say(M, text, kind = '') { M.log.push({ min: M.min, text, kind }); }
function rate(M, d) { if (M.rating != null) M.rating = clamp(M.rating + d, 3, 10); }

function goalFor(M, side, txt) {
  M.goals[side]++;
  say(M, txt, side === 0 ? 'goal' : 'goalA');
  if (M.rating != null && M.min >= M.enter && M.min <= M.leave) rate(M, side === 0 ? 0.08 : (PC.me.pos === 'GK' || ['CB', 'LB', 'RB'].includes(PC.me.pos) ? -0.1 : -0.04));
}

/** Rozstrzygnięcie wybranej opcji. Zwraca { ok, text, next } (next: następny scenariusz w łańcuchu). */
export function resolveOption(M, scenId, optIdx) {
  const sc = SCEN[scenId];
  const opt = sc.opts[optIdx];
  const pc = optChance(M, opt);
  const ok = Math.random() < pc;
  const p = PC.me;
  const mate = pick(M.mates), opp = pick(M.opps);
  let text = '', next = null;
  const ef = ok ? opt.ok : opt.fail;
  if (ok) { M.my.ok++; rate(M, opt.rateOk ?? 0.22); } else { M.my.bad++; rate(M, opt.rateFail ?? -0.15); }
  text = (ok ? opt.okText : opt.failText) || (ok ? 'Udało się!' : 'Nie udało się.');
  if (ef) {
    if (ef.goal) { M.my.g++; rate(M, 0.85); goalFor(M, 0, `GOL! ${p.ln} trafia do siatki!`); text += ' GOL!'; }
    if (ef.assist && Math.random() < ef.assist) { M.my.a++; rate(M, 0.5); goalFor(M, 0, `GOL! ${mate} wykańcza akcję, asystował ${p.ln}!`); text += ` ${mate} strzela, masz asystę!`; }
    else if (ef.assist) text += ` ${mate} nie wykorzystuje okazji.`;
    if (ef.chain && (!opt.okChance || Math.random() < opt.okChance)) next = ef.chain;
    else if (ef.chain && opt.okChance) text = 'Walczysz, ale sędzia nie odgwizduje faulu.';
    if (ef.save) { M.my.saves++; }
    if (ef.concede && Math.random() < ef.concede) { goalFor(M, 1, `Gol dla rywali, strzela ${opp}.`); text += ` Rywale strzelają gola, ${opp} trafia.`; rate(M, -0.25); }
    if (ef.pen && Math.random() < ef.pen) { text += ' Sędzia dyktuje rzut karny!'; if (Math.random() < 0.76) { goalFor(M, 1, `Rzut karny wykorzystany, strzela ${opp}.`); text += ' Rywale wykorzystują karnego.'; } }
    if (ef.card && Math.random() < ef.card) {
      M.my.yc++;
      if (M.my.yc >= 2) { M.my.rc = 1; M.leave = M.min; rate(M, -1.0); say(M, `Druga żółta kartka i czerwona dla ${p.ln}!`, 'card'); text += ' Druga żółta kartka, wylatujesz z boiska!'; }
      else { rate(M, -0.2); say(M, `Żółta kartka dla ${p.ln}.`, 'card'); text += ' Dostajesz żółtą kartkę.'; }
    }
    if (ef.win && Math.random() < ef.win) next = 'counter';
  }
  say(M, `${p.ln}: ${sc.short || sc.title}: ${ok ? 'udane' : 'nieudane'}. ${text}`, ok ? 'ok' : 'bad');
  return { ok, text, next, chance: pc };
}

/** Przewija mecz do danej minuty. Zwraca pierwszy kluczowy moment zawodnika (mecz się zatrzymuje) albo null. */
export function runTo(M, minute) {
  M.evIdx = M.evIdx || 0;
  if (!M.started) { M.started = true; say(M, `Początek meczu: ${M.line}.`, 'info'); if (M.role === 'out') say(M, 'Nie ma Cię w składzie meczowym. Oglądasz mecz z trybun.', 'info'); else if (M.role === 'sub') say(M, 'Zaczynasz na ławce rezerwowych.', 'info'); }
  while (M.evIdx < M.events.length && M.events[M.evIdx].min <= minute) {
    const e = M.events[M.evIdx++];
    if (M.min < 45 && e.min >= 45) say(M, `Przerwa. Wynik ${M.goals[0]}:${M.goals[1]}.`, 'info');
    if (M.role === 'sub' && !M.subIn && e.min >= M.enter) { M.subIn = true; M.min = M.enter; say(M, `${M.enter}. minuta: wchodzisz na boisko!`, 'info'); }
    M.min = e.min;
    if (e.t === 'goal') {
      const who = pick(e.side === 0 ? M.mates : M.opps);
      goalFor(M, e.side, e.side === 0 ? `GOL! ${who} trafia dla drużyny ${M.usName}.` : `Gol dla rywali, strzela ${who}.`);
      continue;
    }
    if (e.t === 'moment') {
      if (M.min < M.enter || M.min > M.leave) continue;
      if (e.ifTaker && (PC.me.a.pen ?? 40) < 55 && !['CF', 'AM'].includes(PC.me.pos)) {
        const who = pick(M.mates);
        if (Math.random() < 0.76) goalFor(M, 0, `Rzut karny! ${who} pewnie wykorzystuje jedenastkę.`); else say(M, `Rzut karny! ${who} marnuje jedenastkę.`, 'info');
        continue;
      }
      return e;
    }
  }
  if (M.role === 'sub' && !M.subIn && minute >= M.enter && M.enter < 90) { M.subIn = true; say(M, `${M.enter}. minuta: wchodzisz na boisko!`, 'info'); }
  if (minute >= 45 && M.min < 45) say(M, `Przerwa. Wynik ${M.goals[0]}:${M.goals[1]}.`, 'info');
  M.min = Math.max(M.min, minute);
  return null;
}

/** Rozgrywa moment z łańcuchem decyzji automatycznie. */
export function autoMoment(M, ev) {
  let scen = pickScenario(M, ev), guard = 0;
  while (scen && guard++ < 4) { const r = resolveOption(M, scen, autoOption(M, scen)); scen = r.next; }
}

/** Cały mecz bez decyzji gracza. */
export function autoPlay(M) {
  let e;
  while ((e = runTo(M, 90))) autoMoment(M, e);
  return finishMatch(M);
}

/** Najlepsza opcja według szansy i nagrody (gdy gracz pomija decyzję). */
export function autoOption(M, scenId) {
  const sc = SCEN[scenId];
  let best = 0, bv = -1;
  sc.opts.forEach((o, i) => { const v = optChance(M, o) * (o.value ?? 1); if (v > bv) { bv = v; best = i; } });
  return best;
}

/** Zakończenie meczu: wynik, statystyki, punkty treningowe, forma, zmęczenie. */
export function finishMatch(M) {
  const p = PC.me;
  const [gu, gt] = M.goals;
  let hg = M.home ? gu : gt, ag = M.home ? gt : gu;
  M.done = true;
  let pens = null;
  if (M.knock && gu === gt) {
    const win = Math.random() < sig((M.usStr - M.themStr) / 15);
    pens = win ? [5, 4] : [3, 4];
    if (!M.home) pens = [pens[1], pens[0]];
  }
  M.result = { hg, ag, pens };
  const played = M.role !== 'out' && M.enter < 90;
  const won = gu > gt || (pens && ((M.home && pens[0] > pens[1]) || (!M.home && pens[1] > pens[0])));
  if (played) {
    if (won) rate(M, 0.25); else if (gu < gt) rate(M, -0.2);
    if (gt === 0 && (p.pos === 'GK' || ['CB', 'LB', 'RB', 'DM'].includes(p.pos))) { rate(M, 0.35); PC.ss.cleanSheets++; }
    M.rating = Math.round(M.rating * 10) / 10;
    const mins = Math.min(90, M.leave) - M.enter;
    const ss = PC.ss, car = PC.car;
    if (M.comp === 'intl' || M.comp === 'tour') { ss.natApps++; ss.natGoals += M.my.g; car.natApps++; car.natGoals += M.my.g; p.caps++; }
    else { ss.apps++; if (M.role === 'start') ss.starts++; ss.goals += M.my.g; ss.assists += M.my.a; ss.rsum += M.rating; ss.min += mins; if (M.comp === 'cup') ss.cupApps++; }
    car.apps++; car.goals += M.my.g; car.assists += M.my.a; car.rsum += M.rating; ss.yc += M.my.yc; ss.rc += M.my.rc; car.yc += M.my.yc; car.rc += M.my.rc;
    if (M.rating >= 8.0) { car.mom++; ss.mom++; }
    // punkty treningowe za mecz
    const tp = Math.max(1, Math.round(1 + (M.rating - 6.3) * 1.5 + Math.min(2, M.my.g + M.my.a * 0.5) + (M.role === 'start' ? 1 : 0)));
    PC.tp += tp; M.tp = tp;
    p.cond = clamp(p.cond - (M.role === 'start' ? 22 : 9) * (1.2 - (p.a.en ?? 60) / 200), 25, 100);
    if (M.rating >= 7.6 && Math.random() < 0.6) p.form = Math.min(2, p.form + 1);
    else if (M.rating <= 5.8 && Math.random() < 0.6) p.form = Math.max(-2, p.form - 1);
    p.mor = clamp(p.mor + (won ? 4 : gu === gt ? 1 : -3) + (M.rating >= 7.5 ? 3 : M.rating < 6 ? -3 : 0), 0, 100);
    if (M.my.rc) p.susp = 1;
    else if (M.my.yc && (PC.ss.yc % 5 === 0)) p.susp = 1;
    if (Math.random() < 0.025 * (1.3 - (p.a.nf ?? 60) / 120)) { p.inj = rint(1, 4); msg('Kontuzja', `Doznałeś urazu w meczu ${M.line}. Przerwa potrwa ok. ${p.inj} ${plural(p.inj, 'tydzień', 'tygodnie', 'tygodni')}.`); }
  } else M.tp = 0;
  // zapis wyniku w rozgrywkach
  if (M.comp === 'league') { const f = M.fx.fx; f.r = [hg, ag]; applyResult(myLeague(), f); }
  if (M.comp === 'ucl' || M.comp === 'usl' || M.comp === 'ulg') {
    if (M.fx.euroTie) { const t = M.fx.tie; t.r = [hg, ag]; t.pens = pens; t.w = won ? PC.club : (M.home ? M.fx.a : M.fx.h); }
    else { const f = M.fx.fx; f.r = [hg, ag]; applyResult(PC.euro[M.comp], f); }
    if (played) PC.ss.euroApps++;
  }
  if (M.comp === 'cup') { M.fx.tie.r = [hg, ag]; M.fx.tie.pens = pens; M.fx.tie.w = won ? PC.club : (M.home ? M.fx.a : M.fx.h); }
  if (M.comp === 'tour') tourAfterMatch(M, won, gu === gt && !pens);
  // statystyki kolegów i rywali, relacje z kolegami z boiska
  if (M.comp !== 'tour' && M.comp !== 'intl' && PC.pl) {
    const mates = teamMatchStats(PC, PC.club, gu, gt, { meIn: played, mePos: p.pos, skipG: played ? M.my.g : 0, skipA: played ? M.my.a : 0, live: M.liveUs });
    teamMatchStats(PC, M.themKey, gt, gu, { live: M.liveThem });
    if (played) relAfterMatch(PC, mates, M.relExtra || {});
  }
  PC.log.unshift({ y: PC.year, w: PC.week, line: M.line, res: `${hg}:${ag}${pens ? ` k. ${pens[0]}:${pens[1]}` : ''}`, comp: M.comp, r: played ? M.rating : null, g: M.my.g, a: M.my.a });
  if (PC.log.length > 120) PC.log.length = 120;
  return M;
}

// ---------------------------------------------------------------------
// puchar
// ---------------------------------------------------------------------
const CUP_ROUNDS = ['1/8 finału', 'ćwierćfinał', 'półfinał', 'finał'];
export const cupRoundName = () => CUP_ROUNDS[PC.cup.round] || '';
function cupTieFor(id) {
  const c = PC.cup;
  if (!c.alive.includes(id)) return null;
  if (!c.ties.length) {
    const a = c.alive.slice().sort(() => Math.random() - 0.5);
    c.ties = [];
    for (let i = 0; i + 1 < a.length; i += 2) c.ties.push({ h: a[i], a: a[i + 1], r: null, w: null });
  }
  return c.ties.find((t) => t.h === id || t.a === id) || null;
}
function cupWeek() {
  const c = PC.cup;
  if (!c || c.done) return;
  if (!c.ties.length) cupTieFor(c.alive[0]);
  for (const t of c.ties) {
    if (t.w != null) continue;
    const r = simScore(PC.clubs[t.h].lv, PC.clubs[t.a].lv, true);
    t.r = r;
    simStats(PC, t.h, t.a, r);
    if (r[0] === r[1]) { const hw = Math.random() < 0.5; t.pens = hw ? [5, 3] : [3, 5]; t.w = hw ? t.h : t.a; } else t.w = r[0] > r[1] ? t.h : t.a;
  }
  c.alive = c.ties.map((t) => t.w);
  c.ties = [];
  c.round++;
  if (c.alive.length === 1) {
    c.done = true; c.winner = c.alive[0];
    if (c.winner === PC.club && PC.ss.cupApps) { trophy(`Puchar ${NAT[c.nat].name}`, 'cup'); msg('Puchar zdobyty!', `${myClub().n} wygrywa Puchar ${NAT[c.nat].name}! To Twoje trofeum.`); }
  } else if (!c.alive.includes(PC.club) && c.round > 0 && c._out !== true && c.alive.length) {
    c._out = true;
  }
}

function trophy(name, type) { PC.trophies.push({ name, year: PC.year, type }); }

// ---------------------------------------------------------------------
// koniec tygodnia
// ---------------------------------------------------------------------
/** Symuluje pozostałe mecze tygodnia i przesuwa czas. */
export function endWeek() {
  const w = PC.week;
  const p = PC.me;
  if (PC.phase === 'summer') { summerStep(); return; }
  // ligi
  const rd = leagueRoundForWeek(w);
  if (rd >= 0) {
    for (const L of Object.values(PC.leagues)) {
      const round = L.fx[rd];
      if (!round) continue;
      for (const m of round) {
        if (m.r) continue;
        m.r = simScore(PC.clubs[m.h].lv, PC.clubs[m.a].lv, true);
        applyResult(L, m);
        simStats(PC, m.h, m.a, m.r);
      }
      L.round = rd + 1;
    }
  }
  if (CUP_WEEKS.includes(w)) cupWeek();
  if (PC.euro && EURO_WEEKS.includes(w)) {
    const i = EURO_WEEKS.indexOf(w);
    for (const E of Object.values(PC.euro)) euroRound(PC, E, i);
  }
  if (w === WINTER_WINDOW) clubChanges(true);
  // regeneracja, kontuzje, forma
  if (p.inj > 0) p.inj--;
  if (p.susp > 0 && rd >= 0) p.susp--;
  p.cond = clamp(p.cond + 24 * (0.7 + 0.6 * (p.a.nf ?? 60) / 100), 0, 100);
  if (Math.random() < 0.18) p.form = clamp(p.form + (Math.random() < 0.5 + (PC.status <= 1 ? 0.08 : -0.05) ? 1 : -1), -2, 2);
  p.mor = Math.round(p.mor + (62 - p.mor) * 0.06);
  PC.money += PC.wage;
  // naturalny rozwój co 4 tygodnie
  if (w % 4 === 3) naturalDevelop();
  updateStatus();
  if (w === WINTER_WINDOW) transferWindow('zimowe');
  if (isIntlWeek(w) && !natCallup() && meOvr() >= NAT[p.nat].str - 9 && Math.random() < 0.3) msg('Reprezentacja', `Selekcjoner obserwuje Twoje występy, ale tym razem nie dostałeś powołania. Do kadry potrzebujesz oceny około ${NAT[p.nat].str - 5}.`);
  if (isIntlWeek(w) && natCallup() && !PC.calledOnce) { PC.calledOnce = true; msg('Pierwsze powołanie!', `Selekcjoner reprezentacji ${NAT[p.nat].name} powołał Cię do kadry! To ogromne wyróżnienie.`); trophyNote('Debiut w reprezentacji'); }
  PC.week++;
  PC.offers = PC.offers.filter((o) => o.until >= PC.week);
  if (PC.week >= SEASON_WEEKS) endSeason();
}

/** Zmiany w klubach: wyniki, transfery i rozwój zawodników zmieniają siłę drużyn (latem mocniej, zimą lekko). */
function clubChanges(winter) {
  const before = myClub().lv;
  for (const L of Object.values(PC.leagues)) {
    const t = sortedTable(L), n = t.length || 1;
    t.forEach((row, i) => {
      const c = PC.clubs[row.id];
      if (!c) return;
      const perf = winter ? 0 : (n / 2 - i) / n * 1.6;
      const d = perf + gauss() * (winter ? 0.5 : 0.9);
      c.lv = clamp(Math.round((c.lv + d) * 10) / 10, 38, 93);
    });
  }
  const c = myClub(), diff = Math.round((c.lv - before) * 10) / 10;
  PC._lvDiff = diff;
  // latem nowych zawodników przynosi przebudowa składów (summerStep), zimą klub dokupuje 1–2 zawodników
  if (!winter) return;
  const names = signPlayers(PC, c.id, rint(1, 2)).map((p) => `${p.fn} ${p.ln}, ${p.pos}, ${p.o}`);
  msg('Zimowe okno: zmiany w klubie', `${c.n} uzupełnił skład. Nowi zawodnicy: ${names.join('; ')}. ` + (diff > 0.3 ? `Drużyna jest mocniejsza: siła klubu wzrosła do ${Math.round(c.lv)}.` : diff < -0.3 ? `Drużyna osłabła: siła klubu spadła do ${Math.round(c.lv)}.` : `Siła drużyny bez większych zmian: ${Math.round(c.lv)}.`));
}

function trophyNote(name) { PC.awards.push({ name, year: PC.year }); }

function naturalDevelop() {
  const p = PC.me;
  const a = p.age;
  const d = a <= 20 ? 0.22 : a <= 23 ? 0.12 : a <= 27 ? 0.03 : a <= 30 ? -0.06 : a <= 33 ? -0.25 : -0.45;
  applyDelta(p, d + gauss() * 0.05);
  if (a >= 30) for (const k of ['sp', 'acc', 'agi', 'en']) p.a[k] = clamp((p.a[k] ?? 60) - 0.25 * (a - 29) / 2, 1, 99);
}

// ---------------------------------------------------------------------
// trening i rozwój
// ---------------------------------------------------------------------
export const canTrain = () => PC.trainedWeek !== PC.week + PC.year * 100 && PC.me.inj === 0;

export function doTraining(focus) {
  const p = PC.me;
  const f = TRAIN_FOCUS[focus];
  PC.trainedWeek = PC.week + PC.year * 100;
  if (focus === 'rest') { p.cond = clamp(p.cond + 22, 0, 100); PC.tp += 1; return { tp: 1, gain: null, text: 'Odpoczynek pomógł się zregenerować.' }; }
  const tp = 2 + (p.form >= 1 ? 1 : 0) + ((p.a.det ?? 50) >= 70 ? 1 : 0);
  PC.tp += tp;
  p.cond = clamp(p.cond - 6, 0, 100);
  const keys = f.keys.filter((k) => p.pos === 'GK' || !GK_ATTRS.has(k));
  const k = pick(keys);
  const before = p.a[k];
  p.a[k] = clamp(Math.round(((p.a[k] ?? 40) + 0.4) * 10) / 10, 1, 99);
  if (Math.random() < 0.012) { p.inj = rint(1, 2); msg('Uraz na treningu', `Na treningu nabawiłeś się drobnego urazu. Przerwa: ${p.inj} ${plural(p.inj, 'tydzień', 'tygodnie', 'tygodni')}.`); }
  return { tp, gain: { k, before, after: p.a[k] }, text: `Trening: ${f.name}. Zdobywasz ${tp} ${plural(tp, 'punkt', 'punkty', 'punktów')} rozwoju.` };
}

/** Koszt podniesienia atrybutu o 1 punkt. */
export function attrCost(k) {
  const v = PC.me.a[k] ?? 40;
  let c = v < 45 ? 1 : v < 55 ? 2 : v < 63 ? 3 : v < 70 ? 4 : v < 77 ? 6 : v < 84 ? 8 : v < 90 ? 11 : 15;
  const o = ovr(PC.me);
  if (o >= PC.me.pot + 4) c *= 5; else if (o >= PC.me.pot) c *= 3;
  return c;
}
export function buyAttr(k) {
  const c = attrCost(k);
  if (PC.tp < c || (PC.me.a[k] ?? 40) >= 99) return false;
  PC.tp -= c;
  PC.me.a[k] = Math.min(99, Math.round(((PC.me.a[k] ?? 40) + 1) * 10) / 10);
  updateStatus();
  return true;
}

// ---------------------------------------------------------------------
// transfery
// ---------------------------------------------------------------------
function transferWindow(kind) {
  const o = meOvr();
  const avg = PC.ss.apps ? PC.ss.rsum / PC.ss.apps : 6.5;
  const interest = o + (avg - 6.8) * 5 + (PC.listed ? 2 : 0) + (PC.me.age <= 21 ? 2 : 0);
  const cur = myClub();
  const cands = PC.clubs.filter((c) => c.id !== PC.club && c.lv <= interest + 3 && c.lv >= Math.max(cur.lv - 2, interest - 9));
  cands.sort(() => Math.random() - 0.5);
  const n = Math.min(cands.length, (PC.listed ? 3 : 1) + (avg >= 7.2 ? 2 : avg >= 6.9 ? 1 : 0) + (Math.random() < 0.4 ? 1 : 0));
  PC.offers = cands.slice(0, n).sort((a, b) => b.lv - a.lv).map((c) => ({ club: c.id, wage: wageFor(c.lv, o), years: rint(2, 4), until: PC.week + 3, kind }));
  if (PC.offers.length) msg(`Okno transferowe ${kind}`, `Masz ${PC.offers.length} ${plural(PC.offers.length, 'ofertę', 'oferty', 'ofert')} transferowe. Sprawdź je w zakładce Transfery.`);
  PC.listed = false;
}

export function acceptOffer(i) {
  const o = PC.offers[i];
  if (!o) return false;
  const from = myClub().n;
  PC.club = o.club;
  PC.wage = o.wage;
  PC.contract = PC.year + o.years;
  PC.offers = [];
  // zawodnik przechodzi do nowej ligi; puchar tylko w kraju startowym
  updateStatus();
  msg('Transfer!', `Przechodzisz z ${from} do ${myClub().n}. Kontrakt do ${PC.contract} roku, ${o.wage.toLocaleString('pl-PL')} € tygodniowo.`);
  PC.transfers = (PC.transfers || 0) + 1;
  return true;
}
export function declineOffer(i) { PC.offers.splice(i, 1); }
export function requestTransfer() { PC.listed = true; msg('Lista transferowa', 'Klub wystawił Cię na listę transferową. W najbliższym oknie dostaniesz więcej ofert.'); }

// ---------------------------------------------------------------------
// koniec sezonu, nagrody, turniej reprezentacji
// ---------------------------------------------------------------------
function endSeason() {
  const p = PC.me;
  const ss = PC.ss;
  const L = myLeague();
  const tab = sortedTable(L);
  const pos = tab.findIndex((t) => t.id === PC.club) + 1;
  const avg = ss.apps ? ss.rsum / ss.apps : 0;
  const tr = [];
  if (pos === 1 && ss.apps >= 5) { trophy(`Mistrzostwo: ${leagueName(L)}`, 'league'); tr.push('mistrzostwo ligi'); }
  if (PC.cup && PC.cup.winner === PC.club && ss.cupApps) tr.push('puchar kraju');
  // nagrody indywidualne: wyścigi o nagrody w każdej lidze (dla wszystkich zawodników) i światowy ranking
  const aw = [];
  const seasonAw = { year: PC.year, leagues: {}, world: [] };
  for (const LL of Object.values(PC.leagues)) {
    const row = {};
    for (const A of AWARDS) {
      const w = awardRace(PC, LL, A, 1)[0];
      if (!w) continue;
      row[A.k] = { id: w.id, n: `${w.fn} ${w.ln}`, c: w.c, v: A.fmt(w) };
      const name = `${A.n}: ${leagueName(LL)}`;
      if (w.me) aw.push(name); else (w.aw = w.aw || []).push({ y: PC.year, n: name });
    }
    seasonAw.leagues[LL.key] = row;
  }
  globalRanking(PC, 100).forEach((x, i) => {
    const name = globalAwardFor(i + 1);
    if (i < 30) seasonAw.world.push({ place: i + 1, id: x.p.id, n: `${x.p.fn} ${x.p.ln}`, c: x.p.c, pos: x.p.pos, sc: x.sc });
    if (!name) return;
    if (x.p.me) aw.push(i < 3 ? name : `${name}: ${i + 1}. miejsce na świecie`);
    else (x.p.aw = x.p.aw || []).push({ y: PC.year, n: name });
  });
  PC.awHist = PC.awHist || [];
  PC.awHist.unshift(seasonAw);
  if (PC.awHist.length > 10) PC.awHist.length = 10;
  // trofea klubów w historii
  for (const LL of Object.values(PC.leagues)) if (LL.div === 1) { const ch = sortedTable(LL)[0]; if (ch && ch.p > 0) addHist(PC, ch.id, 'league'); }
  if (PC.cup && PC.cup.winner != null) addHist(PC, PC.cup.winner, 'cup');
  const o = ovr(p);
  for (const a of aw) PC.awards.push({ name: a, year: PC.year });
  // puchary europejskie
  const euroLines = [];
  if (PC.euro) {
    for (const [k, E] of Object.entries(PC.euro)) {
      for (let i = 0; i < EURO_WEEKS.length && E.stage !== 'done'; i++) euroRound(PC, E, i);
      if (E.kind === 'league') { E.winner = sortedTable(E)[0].id; }
      if (E.winner == null) continue;
      const pos = E.kind === 'league' ? sortedTable(E).findIndex((x) => x.id === PC.club) + 1 : E.rank.indexOf(PC.club) + 1;
      euroLines.push(`${E.name}: wygrywa ${PC.clubs[E.winner].n}${E.teams.includes(PC.club) ? (pos > 0 ? `, ${myClub().n} na ${pos}. miejscu` : `, ${myClub().n} odpada w fazie grupowej`) : ''}`);
      addHist(PC, E.winner, 'euro');
      if (E.winner === PC.club && ss.euroApps >= 2) { trophy(E.name, k); tr.push(E.name); }
    }
    // Ultra Liga w następnym sezonie: po 5 najlepszych klubów z faz pucharowych Ligi Mistrzów i Super Ligi
    const nu = [...new Set([...(PC.euro.ucl.rank || []).slice(0, 5), ...(PC.euro.usl.rank || []).slice(0, 5)])];
    PC.nextUltra = nu;
    if (nu.length) euroLines.push(`\nUltra Liga w następnym sezonie: ${nu.map((id) => PC.clubs[id].n).join(', ')}.` + (nu.includes(PC.club) ? ' Twój klub zagra w Ultra Lidze!' : ''));
  }
  PC.seasons.push({ year: PC.year, club: myClub().n, league: leagueName(L), pos, apps: ss.apps, goals: ss.goals, assists: ss.assists, avg: Math.round(avg * 100) / 100, nat: ss.natApps, natG: ss.natGoals, ovr: Math.round(o), tr, aw });
  msg(`Koniec sezonu ${PC.year}/${String((PC.year + 1) % 100).padStart(2, '0')}`, `${myClub().n} kończy sezon na ${pos}. miejscu. Twój bilans: ${ss.apps} ${plural(ss.apps, 'mecz', 'mecze', 'meczów')}, ${ss.goals} ${plural(ss.goals, 'gol', 'gole', 'goli')}, ${ss.assists} ${plural(ss.assists, 'asysta', 'asysty', 'asyst')}, średnia ocena ${avg ? avg.toFixed(2) : 'brak'}.` + (tr.length ? `\n\nTrofea: ${tr.join(', ')}.` : '') + (aw.length ? `\n\nNagrody indywidualne: ${aw.join(', ')}.` : ''));
  // awanse i spadki w kraju zawodnika
  const n = PC.me.nat;
  const L1 = PC.leagues[`${n}-1`], L2 = PC.leagues[`${n}-2`];
  if (L1 && L2) {
    const t1 = sortedTable(L1), t2 = sortedTable(L2);
    const down = t1.slice(-2).map((t) => t.id), up = t2.slice(0, 2).map((t) => t.id);
    L1.teams = L1.teams.filter((id) => !down.includes(id)).concat(up);
    L2.teams = L2.teams.filter((id) => !up.includes(id)).concat(down);
    for (const id of up) { PC.clubs[id].div = 1; PC.clubs[id].lv = Math.max(PC.clubs[id].lv, PC.clubs[L1.teams[L1.teams.length - 3]].lv - 1); }
    for (const id of down) PC.clubs[id].div = 2;
    if (up.includes(PC.club)) { trophy(`Awans do ${leagueName(L1)}`, 'promo'); msg('Awans!', `${myClub().n} awansuje do najwyższej ligi!`); }
    if (down.includes(PC.club)) msg('Spadek', `${myClub().n} spada do niższej ligi.`);
  }
  if (euroLines.length) msg('Puchary europejskie', euroLines.join('\n'));
  clubChanges(false);
  PC.phase = 'summer';
  PC.week = 0;
  setupTournament();
}

function summerStep() {
  const t = PC.tour;
  if (t && !t.done) { tourSimToEnd(); }
  // nowy sezon
  const p = PC.me;
  p.age++;
  PC.year++;
  if (PC.contract <= PC.year) {
    if (meOvr() >= myClub().lv - 8) { PC.contract = PC.year + 2; PC.wage = wageFor(myClub().lv, meOvr()); msg('Nowy kontrakt', `${myClub().n} przedłużył z Tobą kontrakt do ${PC.contract} roku.`); }
    else { msg('Koniec kontraktu', `${myClub().n} nie przedłużył kontraktu. Szukasz nowego klubu.`); PC.listed = true; }
  }
  // przebudowa składów: wiek, rozwój, emerytury, młodzi zawodnicy i transfery między klubami
  const { moves } = rosterSeasonEnd(PC);
  const mine = (moves[PC.club] || []).map((x) => `${x.fn} ${x.ln}, ${x.pos}, ${x.o}`);
  const diff = PC._lvDiff || 0, c = myClub();
  msg('Letnie okno: nowi zawodnicy w klubie', `${c.n} przebudował skład przed nowym sezonem.` + (mine.length ? ` Nowi zawodnicy: ${mine.join('; ')}.` : '') + ` ` + (diff > 0.3 ? `Drużyna jest mocniejsza: siła klubu wzrosła do ${Math.round(c.lv)}.` : diff < -0.3 ? `Drużyna osłabła: siła klubu spadła do ${Math.round(c.lv)}.` : `Siła drużyny bez większych zmian: ${Math.round(c.lv)}.`));
  transferWindow('letnie');
  if (p.age >= 40) { PC.retired = true; msg('Koniec kariery', 'W wieku 40 lat kończysz karierę piłkarską. Dziękujemy za wspaniałe lata!'); }
  newSeason(PC);
  updateStatus();
}

export function retire() { PC.retired = true; msg('Koniec kariery', `Ogłaszasz zakończenie kariery w wieku ${PC.me.age} lat.`); }

function tourName(y) {
  const conf = NAT[PC.me.nat].conf;
  if (y % 4 === 2) return `Mistrzostwa Świata ${y}`;
  return { EU: `Mistrzostwa Europy ${y}`, SA: `Copa América ${y}`, NA: `Złoty Puchar ${y}`, AF: `Puchar Narodów Afryki ${y}`, AS: `Puchar Azji ${y}`, OC: `Puchar Narodów Oceanii ${y}` }[conf] || `Turniej kontynentalny ${y}`;
}

function setupTournament() {
  const y = PC.year + 1;
  PC.tour = null;
  if (y % 2 !== 0) return;
  const me = NAT[PC.me.nat];
  const wc = y % 4 === 2;
  const pool = NATIONS.filter((x) => wc || x.conf === me.conf).sort((a, b) => b.str - a.str);
  const q = pool.slice(0, 16).map((x) => x.id);
  const qualified = q.includes(me.id) || (pool.indexOf(me) < 22 && Math.random() < 0.45);
  const name = tourName(y);
  if (!qualified) { msg(name, `${me.name} nie awansowała na turniej ${name}. Obejrzysz go w telewizji.`); return; }
  const teams = q.includes(me.id) ? q : [...q.slice(0, 15), me.id];
  const sh = teams.slice().sort(() => Math.random() - 0.5);
  const groups = [0, 1, 2, 3].map((g) => sh.slice(g * 4, g * 4 + 4));
  const called = natCallup();
  PC.tour = { name, groups, stage: 'G', md: 0, table: {}, ko: [], done: false, called: !!called, role: called, next: null, out: false, history: [] };
  for (const g of groups) for (const id of g) PC.tour.table[id] = { p: 0, pts: 0, gf: 0, ga: 0 };
  msg(name, called ? `Jesteś w kadrze reprezentacji ${me.name} na turniej ${name}! Zagrasz w fazie grupowej przeciwko: ${groups.find((g) => g.includes(me.id)).filter((x) => x !== me.id).map((x) => NAT[x].name).join(', ')}.` : `${me.name} jedzie na ${name}, ale nie znalazłeś się w kadrze.`);
  tourPrepareNext();
}

function tourPrepareNext() {
  const t = PC.tour;
  const me = PC.me.nat;
  t.next = null;
  if (t.done || t.out || !t.called) return;
  if (t.stage === 'G') {
    const g = t.groups.find((x) => x.includes(me));
    const others = g.filter((x) => x !== me);
    const opp = others[t.md];
    t.next = { comp: 'tour', title: `${t.name}: faza grupowa, mecz ${t.md + 1}`, hn: me, an: opp, role: t.role, ko: false };
  } else {
    const tie = t.ko.find((k) => k.a === me || k.b === me);
    if (tie) t.next = { comp: 'tour', title: `${t.name}: ${t.stageName}`, hn: me, an: tie.a === me ? tie.b : tie.a, role: t.role, ko: true, tie };
  }
}

function tourSimGroupMd() {
  const t = PC.tour;
  for (const g of t.groups) {
    const pairs = [[[0, 1], [2, 3]], [[0, 2], [1, 3]], [[0, 3], [1, 2]]][t.md];
    for (const [i, j] of pairs) {
      const a = g[i], b = g[j];
      if (t._played && t._played.has(`${t.md}:${a}:${b}`)) continue;
      const [x, y] = simScore(NAT[a].str, NAT[b].str, false);
      tourGroupResult(a, b, x, y);
    }
  }
}
function tourGroupResult(a, b, x, y) {
  const t = PC.tour, A = t.table[a], B = t.table[b];
  A.p++; B.p++; A.gf += x; A.ga += y; B.gf += y; B.ga += x;
  if (x > y) A.pts += 3; else if (y > x) B.pts += 3; else { A.pts++; B.pts++; }
}
function tourAdvance() {
  const t = PC.tour;
  if (t.stage === 'G') {
    t.md++;
    if (t.md < 3) return;
    const ord = (g) => g.slice().sort((a, b) => t.table[b].pts - t.table[a].pts || (t.table[b].gf - t.table[b].ga) - (t.table[a].gf - t.table[a].ga) || t.table[b].gf - t.table[a].gf);
    const G = t.groups.map(ord);
    t.ko = [{ a: G[0][0], b: G[1][1] }, { a: G[1][0], b: G[0][1] }, { a: G[2][0], b: G[3][1] }, { a: G[3][0], b: G[2][1] }];
    t.stage = 'QF'; t.stageName = 'ćwierćfinał';
    if (!t.ko.some((k) => k.a === PC.me.nat || k.b === PC.me.nat)) { t.out = true; msg(t.name, `${NAT[PC.me.nat].name} odpada w fazie grupowej turnieju ${t.name}.`); }
    return;
  }
  // rozstrzygnięcie pozostałych par fazy pucharowej
  for (const k of t.ko) if (!k.w) { const [x, y] = simScore(NAT[k.a].str, NAT[k.b].str, false); k.w = x > y ? k.a : y > x ? k.b : (Math.random() < 0.5 ? k.a : k.b); }
  const win = t.ko.map((k) => k.w);
  if (t.stage === 'F') {
    t.done = true; t.winner = win[0];
    if (t.winner === PC.me.nat && t.called) { trophy(t.name, 'intl'); msg(`${t.name}: MISTRZOSTWO!`, `${NAT[PC.me.nat].name} wygrywa ${t.name}! Jesteś mistrzem!`); }
    else msg(t.name, `Turniej ${t.name} wygrała reprezentacja: ${NAT[t.winner].name}.`);
    return;
  }
  if (t.called && !win.includes(PC.me.nat) && !t.out) { t.out = true; msg(t.name, `${NAT[PC.me.nat].name} odpada z turnieju ${t.name} w fazie: ${t.stageName}.`); }
  t.ko = [];
  for (let i = 0; i < win.length; i += 2) t.ko.push({ a: win[i], b: win[i + 1] });
  t.stage = t.stage === 'QF' ? 'SF' : 'F';
  t.stageName = t.stage === 'SF' ? 'półfinał' : 'finał';
}
function tourAfterMatch(M, won, draw) {
  const t = PC.tour;
  const me = PC.me.nat, opp = M.themKey;
  if (t.stage === 'G') {
    t._played = t._played || new Set();
    const g = t.groups.find((x) => x.includes(me));
    const pairs = [[[0, 1], [2, 3]], [[0, 2], [1, 3]], [[0, 3], [1, 2]]][t.md];
    tourGroupResult(me, opp, M.goals[0], M.goals[1]);
    for (const [i, j] of pairs) if ((g[i] === me && g[j] === opp) || (g[j] === me && g[i] === opp)) t._played.add(`${t.md}:${g[i]}:${g[j]}`);
    tourSimGroupMd();
    t._played = null;
  } else {
    const tie = t.ko.find((k) => k.a === me || k.b === me);
    if (tie) tie.w = won ? me : opp;
  }
  tourAdvance();
  tourPrepareNext();
  if (t.done || t.out || !t.next) PC.tourMineDone = true;
}
function tourSimToEnd() {
  const t = PC.tour;
  let guard = 0;
  while (!t.done && guard++ < 20) {
    if (t.stage === 'G') tourSimGroupMd();
    tourAdvance();
  }
}
/** Lato: czy jest jeszcze mecz turnieju do zagrania. */
export const summerHasMatch = () => !!(PC.phase === 'summer' && PC.tour && !PC.tour.done && PC.tour.next);

// ---------------------------------------------------------------------
// podsumowania
// ---------------------------------------------------------------------
export function careerAvg() { return PC.car.apps ? PC.car.rsum / PC.car.apps : 0; }
export function stars(pot) { return pot >= 90 ? 5 : pot >= 85 ? 4.5 : pot >= 80 ? 4 : pot >= 76 ? 3.5 : 3; }
export function careerMeta() {
  return { mode: 'career', name: `${PC.me.fn} ${PC.me.ln}`, club: myClub().n, nat: PC.me.nat, year: PC.year, week: PC.week, age: PC.me.age, ovr: Math.round(meOvr()), saved: Date.now() };
}
export { fname, posRating, POS_W, ATTR_NAMES };

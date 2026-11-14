// Rozgrywki: kalendarz zgrupowań, Liga Narodów, eliminacje, turnieje finałowe, mecze towarzyskie.
import { mkDay, ymd, shuffle, pick } from '../core/util.js';
import { NATIONS, NAT, CONFS, CONF_ORDER } from '../data/nations.js';
import { rankedIds } from './ranking.js';

export const FINALS_SIZE = { EU: 24, SA: 10, NA: 8, AF: 16, AS: 16, OC: 4 };
export const WC_SLOTS = { EU: 13, SA: 4, NA: 3, AF: 5, AS: 5, OC: 1 };
export const CONT_NAMES = { EU: 'Mistrzostwa Europy', SA: 'Mistrzostwa Ameryki Płd.', NA: 'Mistrzostwa Ameryki Płn.', AF: 'Puchar Narodów Afryki', AS: 'Puchar Azji', OC: 'Puchar Oceanii' };
export const CONT_SHORT = { EU: 'ME', SA: 'MAP', NA: 'MAN', AF: 'PNA', AS: 'PA', OC: 'PO' };
const KO_NAMES = { 32: '1/16 finału', 16: '1/8 finału', 8: 'Ćwierćfinał', 4: 'Półfinał', 2: 'Finał' };

// ---------------- kalendarz ----------------
export function finalsSchedule(y, groupSize, koRounds) {
  const groupRounds = groupSize === 5 ? 5 : groupSize - 1;
  const step = groupSize === 5 ? 3 : 4;
  const g = [];
  for (let i = 0; i < groupRounds; i++) g.push(mkDay(y, 6, 12) + i * step);
  const ko = [];
  let d = g[g.length - 1] + 5;
  for (let i = 0; i < koRounds; i++) { ko.push(d); d += 4; }
  return { g, ko };
}

export function windowsForYear(y) {
  const W = [];
  const add = (key, kind, md, opts = {}) => {
    const days = md.map(([m, d]) => mkDay(y, m, d));
    W.push({
      id: `${y}-${key}`, y, key, kind, days,
      fdays: opts.fdays ? opts.fdays.map(([m, d]) => mkDay(y, m, d)) : days.slice(),
      callup: days[0] - 12, size: opts.size || 23,
    });
  };
  if (y % 2 === 0) {
    add('MAR', 'fri', [[3, 21], [3, 25]]);
    const fs = finalsSchedule(y, 4, 4);
    const extra = finalsSchedule(y, 5, 4);
    const allDays = [...new Set([...fs.g, ...fs.ko, ...extra.g, ...extra.ko])].sort((a, b) => a - b);
    const w = { id: `${y}-FIN`, y, key: 'FIN', kind: 'fin', days: [mkDay(y, 6, 1), mkDay(y, 6, 5), ...allDays], fdays: [mkDay(y, 6, 1), mkDay(y, 6, 5)], callup: mkDay(y, 5, 20), size: 26 };
    W.push(w);
    add('SEP', 'ln', [[9, 5], [9, 9]]);
    add('OCT', 'ln', [[10, 10], [10, 14]]);
    add('NOV', 'ln', [[11, 14], [11, 18]]);
  } else {
    add('MAR', 'q', [[3, 21], [3, 25]]);
    add('JUN', 'q', [[6, 6], [6, 10]]);
    add('SEP', 'q', [[9, 5], [9, 9]]);
    add('OCT', 'q', [[10, 10], [10, 14]]);
    add('NOV', 'q', [[11, 14], [11, 18]]);
  }
  return W;
}

export const WINDOW_NAMES = { MAR: 'marcowe', JUN: 'czerwcowe', FIN: 'turniejowe', SEP: 'wrześniowe', OCT: 'październikowe', NOV: 'listopadowe' };

// ---------------- narzędzia ----------------
function newComp(G, c) {
  G.comps[c.id] = c;
  G.compOrder.push(c.id);
  return c;
}

export function addFixture(G, f) {
  f.id = G.fxSeq++;
  f.res = null;
  G.fixtures.push(f);
  return f;
}

export const fixturesOf = (G, compId) => G.fixtures.filter((f) => f.comp === compId);

export function roundRobin(teams, double = true) {
  const t = teams.slice();
  if (t.length % 2) t.push(null);
  const n = t.length;
  const arr = t.slice();
  const rounds = [];
  for (let r = 0; r < n - 1; r++) {
    const pairs = [];
    let bye = null;
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i], b = arr[n - 1 - i];
      if (!a || !b) { bye = a || b; continue; }
      const flip = i === 0 ? r % 2 === 1 : (r + i) % 2 === 1;
      pairs.push(flip ? [b, a] : [a, b]);
    }
    rounds.push({ pairs, bye });
    arr.splice(1, 0, arr.pop());
  }
  if (double) {
    const n2 = rounds.length;
    for (let r = 0; r < n2; r++) rounds.push({ pairs: rounds[r].pairs.map(([h, a]) => [a, h]), bye: rounds[r].bye });
  }
  return rounds;
}

function groupSizes(n, max = 4, min = 3) {
  if (n <= max + 2 && n < 2 * min) return [n];
  if (max === 4) {
    const b = (4 - (n % 4)) % 4;
    const a = (n - 3 * b) / 4;
    if (a >= 0) return [...Array(a).fill(4), ...Array(b).fill(3)];
    return [n];
  }
  const ng = Math.ceil(n / max);
  const base = Math.floor(n / ng), extra = n % ng;
  return Array.from({ length: ng }, (_, i) => base + (i < extra ? 1 : 0));
}

/** Rozdziela drużyny (posortowane wg rankingu) do grup z koszyków. */
function drawGroups(sorted, sizes, opts = {}) {
  const groups = sizes.map(() => []);
  let idx = 0;
  const maxS = Math.max(...sizes);
  for (let k = 0; k < maxS; k++) {
    const gi = sizes.map((s, i) => (s > k ? i : -1)).filter((i) => i >= 0);
    const pot = sorted.slice(idx, idx + gi.length);
    idx += gi.length;
    if (opts.fixedFirst && k === 0) {
      const rest = shuffle(pot.slice(1));
      groups[gi[0]].push(pot[0]);
      gi.slice(1).forEach((g, j) => { if (rest[j]) groups[g].push(rest[j]); });
      continue;
    }
    let best = null;
    for (let t = 0; t < (opts.check ? 40 : 1); t++) {
      const perm = shuffle(pot.slice());
      if (!opts.check || gi.every((g, j) => opts.check(groups[g], perm[j]))) { best = perm; break; }
      if (!best) best = perm;
    }
    gi.forEach((g, j) => { if (best[j]) groups[g].push(best[j]); });
  }
  return groups;
}

const cityOf = (nid) => pick(NAT[nid].cities);

export function nameOfRound(size) {
  return KO_NAMES[size] || `1/${size / 2} finału`;
}

// ---------------- tabele ----------------
export function standings(G, comp, gi) {
  const teams = comp.groups[gi].teams;
  const rows = {};
  for (const t of teams) rows[t] = { t, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0, form: [] };
  const fxs = G.fixtures.filter((f) => f.comp === comp.id && f.g === gi && f.res).sort((a, b) => a.d - b.d);
  for (const f of fxs) {
    const h = rows[f.h], a = rows[f.a];
    if (!h || !a) continue;
    const { hg, ag } = f.res;
    h.p++; a.p++; h.gf += hg; h.ga += ag; a.gf += ag; a.ga += hg;
    if (hg > ag) { h.w++; a.l++; h.pts += 3; h.form.push('W'); a.form.push('L'); }
    else if (hg < ag) { a.w++; h.l++; a.pts += 3; h.form.push('L'); a.form.push('W'); }
    else { h.d++; a.d++; h.pts++; a.pts++; h.form.push('D'); a.form.push('D'); }
  }
  const list = Object.values(rows);
  for (const r of list) r.gd = r.gf - r.ga;
  list.sort((x, y) => y.pts - x.pts || y.gd - x.gd || y.gf - x.gf || h2h(fxs, x.t, y.t) || (G.rank[y.t] || 0) - (G.rank[x.t] || 0));
  return list;
}

function h2h(fxs, a, b) {
  let pa = 0, pb = 0;
  for (const f of fxs) {
    if (f.h === a && f.a === b) { if (f.res.hg > f.res.ag) pa += 3; else if (f.res.hg < f.res.ag) pb += 3; else { pa++; pb++; } }
    if (f.h === b && f.a === a) { if (f.res.hg > f.res.ag) pb += 3; else if (f.res.hg < f.res.ag) pa += 3; else { pa++; pb++; } }
  }
  return pb - pa;
}

export function groupDone(G, comp, gi) {
  return G.fixtures.every((f) => f.comp !== comp.id || f.g !== gi || f.res);
}

export function koWinner(fx) {
  if (!fx.res) return null;
  const { hg, ag, pens } = fx.res;
  if (hg > ag) return fx.h;
  if (ag > hg) return fx.a;
  if (pens) return pens[0] > pens[1] ? fx.h : fx.a;
  return null;
}

// ---------------- Liga Narodów ----------------
export function createLN(G, y) {
  const created = [];
  const dates = [mkDay(y, 9, 5), mkDay(y, 9, 9), mkDay(y, 10, 10), mkDay(y, 10, 14), mkDay(y, 11, 14), mkDay(y, 11, 18)];
  for (const conf of CONF_ORDER) {
    const ids = rankedIds(G, (id) => NAT[id].conf === conf);
    if (ids.length < 4) continue;
    const sizes = groupSizes(ids.length, 4, 3);
    const groups = [];
    let ti = 0;
    for (let d = 0; d * 4 < sizes.length; d++) {
      const divSizes = sizes.slice(d * 4, d * 4 + 4);
      const total = divSizes.reduce((s, x) => s + x, 0);
      const divTeams = ids.slice(ti, ti + total);
      ti += total;
      const gs = drawGroups(divTeams, divSizes);
      const letter = 'ABCDEF'[d];
      gs.forEach((teams, i) => groups.push({ name: sizes.length > 1 ? `${letter}${i + 1}` : 'A', div: letter, teams }));
    }
    const c = newComp(G, {
      id: `LN${y}-${conf}`, type: 'LN', kind: 'LN', conf, year: y,
      name: `Liga Narodów ${y}/${String((y + 1) % 100).padStart(2, '0')}${conf !== 'EU' ? ' – ' + CONFS[conf].name : ''}`,
      short: 'LN', groups, ko: null, stage: 'groups', done: false, winner: null,
    });
    groups.forEach((g, gi) => {
      const rounds = roundRobin(g.teams, true);
      rounds.forEach((rd, ri) => {
        for (const [h, a] of rd.pairs) addFixture(G, { d: dates[ri], comp: c.id, g: gi, r: -1, h, a, city: cityOf(h), neutral: false, ko: false });
      });
    });
    created.push(c);
  }
  return created;
}

/** Wywoływane po kolejce: domknięcie fazy grupowej LN, ewentualny turniej finałowy. */
export function checkLN(G, c) {
  const ev = [];
  if (c.stage === 'groups' && c.groups.every((_, gi) => groupDone(G, c, gi))) {
    const divA = c.groups.map((g, gi) => ({ g, gi })).filter((x) => x.g.div === 'A');
    const ranked = [];
    for (const { gi } of divA) {
      standings(G, c, gi).forEach((row, pos) => ranked.push({ ...row, pos }));
    }
    ranked.sort((a, b) => a.pos - b.pos || b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);
    if (c.conf === 'EU') {
      const four = ranked.slice(0, 4).map((r) => r.t);
      const y = c.year + 1;
      const host = four[0];
      c.ko = { size: 4, host, rounds: [{ name: 'Półfinał', d: mkDay(y, 6, 6), fx: [] }, { name: 'Finał', d: mkDay(y, 6, 10), fx: [] }] };
      const pairs = [[four[0], four[3]], [four[1], four[2]]];
      for (const [h, a] of pairs) {
        const f = addFixture(G, { d: c.ko.rounds[0].d, comp: c.id, g: -1, r: 0, h, a, city: cityOf(host), neutral: true, ko: true });
        c.ko.rounds[0].fx.push(f.id);
      }
      c.stage = 'ko';
      ev.push({ type: 'lnFinals', comp: c.id, teams: four });
    } else {
      c.winner = ranked[0] ? ranked[0].t : null;
      c.stage = 'done';
      c.done = true;
      ev.push({ type: 'compWon', comp: c.id, winner: c.winner });
    }
    ev.push({ type: 'groupsDone', comp: c.id });
  } else if (c.stage === 'ko') {
    ev.push(...advanceKO(G, c));
  }
  return ev;
}

// ---------------- puchar (faza pucharowa) ----------------
export function advanceKO(G, c) {
  const ev = [];
  const ko = c.ko;
  const ri = ko.rounds.findIndex((r) => r.fx.length && r.fx.some((id) => !fxById(G, id).res));
  if (ri >= 0) return ev; // runda w toku
  const last = ko.rounds.map((r, i) => (r.fx.length ? i : -1)).filter((i) => i >= 0).pop();
  if (last === undefined) return ev;
  const winners = ko.rounds[last].fx.map((id) => koWinner(fxById(G, id)));
  if (last === ko.rounds.length - 1) {
    c.winner = winners[0];
    c.runnerUp = ko.rounds[last].fx.map((id) => fxById(G, id)).map((f) => (f.h === c.winner ? f.a : f.h))[0];
    c.stage = 'done';
    c.done = true;
    ev.push({ type: 'compWon', comp: c.id, winner: c.winner });
    return ev;
  }
  const next = ko.rounds[last + 1];
  for (let i = 0; i < winners.length; i += 2) {
    const h = winners[i], a = winners[i + 1];
    const venueNat = ko.host || c.host || h;
    const f = addFixture(G, { d: next.d, comp: c.id, g: -1, r: last + 1, h, a, city: cityOf(venueNat), neutral: true, ko: true });
    next.fx.push(f.id);
  }
  ev.push({ type: 'koRound', comp: c.id, round: last + 1 });
  return ev;
}

let _fxIndex = null, _fxIndexLen = -1, _fxIndexG = null;
export function fxById(G, id) {
  if (_fxIndexG !== G || _fxIndexLen !== G.fixtures.length) {
    _fxIndex = new Map(G.fixtures.map((f) => [f.id, f]));
    _fxIndexLen = G.fixtures.length;
    _fxIndexG = G;
  }
  return _fxIndex.get(id);
}
export function resetFxIndex() { _fxIndexG = null; }

// ---------------- eliminacje ----------------
export function pickHosts(G, fy, kind) {
  if (kind === 'WC') {
    if (fy === 2030) return { WC: 'ESP' };
    const c = NATIONS.filter((n) => n.str >= 72);
    return { WC: pick(c).id };
  }
  const h = {};
  for (const conf of CONF_ORDER) {
    if (fy === 2028 && conf === 'EU') { h.EU = 'ENG'; continue; }
    const list = NATIONS.filter((n) => n.conf === conf).sort((a, b) => b.str - a.str);
    const cands = list.filter((n) => n.str >= (conf === 'EU' ? 70 : 60)).slice(0, 8);
    h[conf] = (cands.length ? pick(cands) : list[0]).id;
  }
  return h;
}

export function createQualifiers(G, fy) {
  const kind = fy % 4 === 0 ? 'CONT' : 'WC';
  const y = fy - 1;
  if (!G.hosts[fy]) G.hosts[fy] = pickHosts(G, fy, kind);
  const hosts = G.hosts[fy];
  const lnEU = G.comps[`LN${y - 1}-EU`];
  const finalists = lnEU && lnEU.ko ? [...new Set(lnEU.ko.rounds[0].fx.flatMap((id) => { const f = fxById(G, id); return f ? [f.h, f.a] : []; }))] : [];
  const d10 = [mkDay(y, 3, 21), mkDay(y, 3, 25), mkDay(y, 6, 6), mkDay(y, 6, 10), mkDay(y, 9, 5), mkDay(y, 9, 9), mkDay(y, 10, 10), mkDay(y, 10, 14), mkDay(y, 11, 14), mkDay(y, 11, 18)];
  const d6 = [mkDay(y, 3, 21), mkDay(y, 3, 25), mkDay(y, 9, 5), mkDay(y, 9, 9), mkDay(y, 10, 10), mkDay(y, 10, 14)];
  const created = [];
  for (const conf of CONF_ORDER) {
    const host = kind === 'WC' ? hosts.WC : hosts[conf];
    const all = NATIONS.filter((n) => n.conf === conf).map((n) => n.id).filter((id) => id !== host);
    const slots = kind === 'WC' ? WC_SLOTS[conf] : FINALS_SIZE[conf] - 1;
    const id = `Q${fy}-${conf}`;
    const name = kind === 'WC' ? `Eliminacje MŚ ${fy} – ${CONFS[conf].name}` : `Eliminacje: ${CONT_NAMES[conf]} ${fy}`;
    const short = kind === 'WC' ? 'el. MŚ' : `el. ${CONT_SHORT[conf]}`;
    if (slots >= all.length) {
      newComp(G, { id, type: 'Q', kind, conf, year: y, fy, name, short, groups: [], direct: true, slots, stage: 'done', done: true, qualified: all });
      continue;
    }
    const sorted = rankedIds(G, (x) => all.includes(x));
    const sizes = groupSizes(sorted.length, 5, 3);
    const gs = drawGroups(sorted, sizes, { check: (grp, t) => !(finalists.includes(t) && grp.some((x) => finalists.includes(x))) });
    const groups = gs.map((teams, i) => ({ name: String.fromCharCode(65 + i), teams }));
    const c = newComp(G, { id, type: 'Q', kind, conf, year: y, fy, name, short, groups, slots, stage: 'groups', done: false, qualified: null });
    groups.forEach((g, gi) => {
      const rounds = roundRobin(g.teams, true);
      let dates;
      if (rounds.length >= 10) {
        dates = d10.slice();
        const fin = g.teams.find((t) => finalists.includes(t));
        const byeCount = fin ? rounds.filter((r) => r.bye === fin).length : 0;
        if (fin && byeCount >= 2) {
          const byeR = rounds.map((r, i) => (r.bye === fin ? i : -1)).filter((i) => i >= 0);
          const order = rounds.map((_, i) => i).filter((i) => !byeR.includes(i));
          const map = {};
          const nonJune = d10.filter((_, i) => i !== 2 && i !== 3);
          order.forEach((ri, k) => { map[ri] = nonJune[k]; });
          byeR.forEach((ri, k) => { map[ri] = d10[2 + k]; });
          dates = rounds.map((_, i) => map[i]);
        }
      } else dates = d6.slice(0, rounds.length);
      rounds.forEach((rd, ri) => {
        for (const [h, a] of rd.pairs) addFixture(G, { d: dates[ri], comp: c.id, g: gi, r: -1, h, a, city: cityOf(h), neutral: false, ko: false });
      });
    });
    created.push(c);
  }
  return created;
}

export function checkQual(G, c) {
  const ev = [];
  if (c.done || c.direct) return ev;
  if (!c.groups.every((_, gi) => groupDone(G, c, gi))) return ev;
  const tables = c.groups.map((_, gi) => standings(G, c, gi));
  const q = [];
  let pos = 0;
  while (q.length < c.slots && pos < 8) {
    const cands = tables.map((t) => t[pos]).filter(Boolean);
    if (!cands.length) break;
    if (q.length + cands.length <= c.slots) q.push(...cands.map((r) => r.t));
    else {
      cands.sort((a, b) => b.pts / b.p - a.pts / a.p || b.gd / b.p - a.gd / a.p || b.gf / b.p - a.gf / a.p);
      q.push(...cands.slice(0, c.slots - q.length).map((r) => r.t));
    }
    pos++;
  }
  c.qualified = q;
  c.stage = 'done';
  c.done = true;
  ev.push({ type: 'qualDone', comp: c.id, qualified: q });
  return ev;
}

// ---------------- turnieje finałowe ----------------
export function createFinals(G, fy) {
  const kind = fy % 4 === 0 ? 'CONT' : 'WC';
  const hosts = G.hosts[fy] || (G.hosts[fy] = pickHosts(G, fy, kind));
  const created = [];
  const qualOf = (conf) => {
    const c = G.comps[`Q${fy}-${conf}`];
    if (c && c.qualified) return c.qualified;
    const host = kind === 'WC' ? hosts.WC : hosts[conf];
    const slots = kind === 'WC' ? WC_SLOTS[conf] : FINALS_SIZE[conf] - 1;
    return rankedIds(G, (id) => NAT[id].conf === conf && id !== host).slice(0, slots);
  };
  if (kind === 'WC') {
    const teams = [hosts.WC, ...CONF_ORDER.flatMap((conf) => qualOf(conf))];
    created.push(buildFinals(G, { id: `WC${fy}`, kind: 'WC', conf: null, name: `Mistrzostwa Świata ${fy}`, short: 'MŚ', year: fy, teams, host: hosts.WC }));
  } else {
    for (const conf of CONF_ORDER) {
      const teams = [hosts[conf], ...qualOf(conf)];
      created.push(buildFinals(G, { id: `C${fy}-${conf}`, kind: 'CONT', conf, name: `${CONT_NAMES[conf]} ${fy}`, short: CONT_SHORT[conf], year: fy, teams, host: hosts[conf] }));
    }
  }
  return created;
}

function seededOrder(n) {
  let o = [1];
  while (o.length < n) {
    const m = o.length * 2;
    o = o.flatMap((x) => [x, m + 1 - x]);
  }
  return o;
}

function buildFinals(G, spec) {
  const N = spec.teams.length;
  const gsize = N === 10 ? 5 : N <= 6 ? N : 4;
  const ng = Math.max(1, Math.round(N / gsize));
  let bracket;
  if (N === 24) bracket = 16;
  else if (N <= 6) bracket = 2;
  else bracket = Math.min(16, Math.pow(2, Math.floor(Math.log2(ng * 2))));
  const koRounds = Math.log2(bracket);
  const sched = finalsSchedule(spec.year, gsize, koRounds);
  const others = rankedIds(G, (id) => spec.teams.includes(id) && id !== spec.host);
  const sorted = [spec.host, ...others];
  const sizes = Array(ng).fill(gsize);
  const check = spec.kind === 'WC'
    ? (grp, t) => {
      const conf = NAT[t].conf;
      const same = grp.filter((x) => NAT[x].conf === conf).length;
      return conf === 'EU' ? same < 2 : same < 1;
    }
    : null;
  const gs = drawGroups(sorted, sizes, { fixedFirst: true, check });
  // gospodarz w grupie A
  const hi = gs.findIndex((g) => g.includes(spec.host));
  if (hi > 0) { const t = gs[0]; gs[0] = gs[hi]; gs[hi] = t; }
  const groups = gs.map((teams, i) => ({ name: String.fromCharCode(65 + i), teams }));
  const thirds = Math.max(0, bracket - ng * 2);
  const c = newComp(G, {
    id: spec.id, type: 'FIN', kind: spec.kind, conf: spec.conf, year: spec.year, name: spec.name, short: spec.short, host: spec.host,
    groups, stage: 'groups', done: false, winner: null,
    ko: { size: bracket, top: Math.min(2, gsize), thirds, rounds: sched.ko.map((d, i) => ({ name: nameOfRound(bracket / Math.pow(2, i)), d, fx: [] })) },
  });
  const cities = NAT[spec.host].cities;
  let ci = 0;
  groups.forEach((g, gi) => {
    const rounds = roundRobin(g.teams, false);
    rounds.forEach((rd, ri) => {
      for (let [h, a] of rd.pairs) {
        if (a === spec.host) [h, a] = [a, h];
        addFixture(G, { d: sched.g[ri], comp: c.id, g: gi, r: -1, h, a, city: cities[ci++ % cities.length], neutral: true, ko: false });
      }
    });
  });
  return c;
}

export function checkFinals(G, c) {
  const ev = [];
  if (c.stage === 'groups') {
    if (!c.groups.every((_, gi) => groupDone(G, c, gi))) return ev;
    const tables = c.groups.map((_, gi) => standings(G, c, gi));
    const byPos = (p) => tables.map((t, gi) => (t[p] ? { ...t[p], gi } : null)).filter(Boolean)
      .sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || (G.rank[b.t] || 0) - (G.rank[a.t] || 0));
    let seeds = [];
    for (let p = 0; p < c.ko.top; p++) seeds.push(...byPos(p));
    if (c.ko.thirds) seeds.push(...byPos(c.ko.top).slice(0, c.ko.thirds));
    seeds = seeds.slice(0, c.ko.size);
    const order = seededOrder(c.ko.size).map((s) => seeds[s - 1]);
    // unikaj par z tej samej grupy w pierwszej rundzie
    for (let i = 0; i < order.length; i += 2) {
      if (order[i] && order[i + 1] && order[i].gi === order[i + 1].gi) {
        for (let j = i + 2; j < order.length; j += 2) {
          if (order[j + 1] && order[j + 1].gi !== order[i].gi && order[j].gi !== order[i + 1].gi) {
            const t = order[i + 1]; order[i + 1] = order[j + 1]; order[j + 1] = t;
            break;
          }
        }
      }
    }
    const r0 = c.ko.rounds[0];
    for (let i = 0; i < order.length; i += 2) {
      const h = order[i].t, a = order[i + 1].t;
      const f = addFixture(G, { d: r0.d, comp: c.id, g: -1, r: 0, h, a, city: pick(NAT[c.host].cities), neutral: true, ko: true });
      r0.fx.push(f.id);
    }
    c.stage = 'ko';
    c.koTeams = seeds.map((s) => s.t);
    ev.push({ type: 'groupsDone', comp: c.id, advanced: c.koTeams });
  } else if (c.stage === 'ko') {
    ev.push(...advanceKO(G, c));
  }
  return ev;
}

// ---------------- mecze towarzyskie ----------------
export function friendlyCompId(G, y) {
  const id = `FRI${y}`;
  if (!G.comps[id]) newComp(G, { id, type: 'FRI', kind: 'FRI', name: `Mecze towarzyskie ${y}`, short: 'Tow.', year: y, groups: [], done: false });
  return id;
}

export function addFriendly(G, d, h, a) {
  return addFixture(G, { d, comp: friendlyCompId(G, ymd(d).y), g: -1, r: -1, h, a, city: cityOf(h), neutral: false, ko: false });
}

export function hasFixture(G, nid, d) {
  return G.fixtures.some((f) => f.d === d && (f.h === nid || f.a === nid));
}

/** Opis etapu rozgrywek dla meczu. */
export function fixtureStage(G, f) {
  const c = G.comps[f.comp];
  if (!c) return '';
  if (c.type === 'FRI') return 'Mecz towarzyski';
  if (f.r >= 0 && c.ko) return c.ko.rounds[f.r].name;
  if (f.g >= 0 && c.groups[f.g]) return `Grupa ${c.groups[f.g].name}`;
  return '';
}

/** Czy drużyna nadal gra w danych rozgrywkach. */
export function stillIn(G, c, nid) {
  if (c.done) return false;
  if (c.stage === 'groups') return c.groups.some((g) => g.teams.includes(nid));
  if (c.stage === 'ko') {
    const r = c.ko.rounds.filter((x) => x.fx.length).pop();
    return r ? r.fx.some((id) => { const f = fxById(G, id); return f && (f.h === nid || f.a === nid) && (!f.res || koWinner(f) === nid); }) : false;
  }
  return false;
}

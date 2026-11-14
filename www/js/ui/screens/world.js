// Rozgrywki, przeciwnicy, ranking, mecze towarzyskie.
import { screen, actions, go, rerender, esc, icon, posBadge, rating, flag, team, seg, chips, resChip, toast, sheet, closeOverlay, natStars, empty, confirmBox } from '../ui.js';
import { G, me, natName, poolOf, topScorers, friendlySlots, friendlyCandidates, requestFriendly, cancelFriendly, userFixtures, predictLineup } from '../../engine/game.js';
import { pitchHTML } from './tactics.js';
import { STYLE_NAMES } from '../../engine/tactics.js';
import { NAT, CONFS, CONF_ORDER } from '../../data/nations.js';
import { standings, fixtureStage, fxById, koWinner, WINDOW_NAMES } from '../../engine/comps.js';
import { rankPositions, rankedIds } from '../../engine/ranking.js';
import { ovr, POS_ORDER } from '../../engine/player.js';
import { fullName } from '../../data/names.js';
import { fmtDate, fmtDateShort, fmtDateLong } from '../../core/util.js';
import { setLastList } from './squad.js';

const STAGE = { groups: 'faza grupowa', ko: 'faza pucharowa', done: 'zakończone' };
const cs = { filter: 'mine', tab: 'tables', conf: 'EU' };

function compStatus(c) {
  if (c.type === 'FRI') return '';
  if (c.direct) return 'wszyscy awansują bez eliminacji';
  if (c.done && c.winner) return `zwycięzca: ${NAT[c.winner].flag} ${natName(c.winner)}`;
  if (c.done && c.qualified) return `awans: ${c.qualified.length} drużyn`;
  return STAGE[c.stage] || '';
}

screen('comps', {
  render() {
    const m = me();
    const list = G.compOrder.map((id) => G.comps[id]).filter((c) => c && c.type !== 'FRI');
    let shown;
    if (cs.filter === 'mine') shown = list.filter((c) => m && (c.groups || []).some((g) => g.teams.includes(m)));
    else if (cs.filter === 'world') shown = list.filter((c) => c.kind === 'WC');
    else if (cs.filter === 'arch') shown = null;
    else shown = list.filter((c) => c.conf === cs.filter);
    let body = chips('cp.filter', [['mine', 'Moje'], ['world', 'Świat'], ...CONF_ORDER.map((c) => [c, CONFS[c].name]), ['arch', 'Archiwum']], cs.filter);
    if (shown === null) {
      const arch = G.archive.slice().reverse();
      body += arch.length ? `<div class="card tight"><div class="list">${arch.map((a) => `<div class="row"><div class="main"><div class="t1">${esc(a.name)}</div><div class="t2">${a.runnerUp ? `finalista: ${esc(natName(a.runnerUp))}` : ''}</div></div>${a.winner ? `<span class="row-flex">${flag(a.winner)}<b>${esc(natName(a.winner))}</b></span>` : ''}</div>`).join('')}</div></div>` : empty('Archiwum jest puste, zakończone rozgrywki trafią tu po kilku latach.');
      const done = list.filter((c) => c.done && c.winner).reverse();
      if (done.length) body += `<div class="card"><div class="card-h"><h3>Ostatni triumfatorzy</h3></div>${done.slice(0, 12).map((c) => `<div class="row tap" data-a="cp.open" data-k="${c.id}"><div class="main"><div class="t1">${esc(c.name)}</div></div><span class="row-flex">${flag(c.winner)}<b>${esc(natName(c.winner))}</b></span></div>`).join('')}</div>`;
    } else {
      body += shown.length ? `<div class="card tight"><div class="list">${shown.slice().reverse().map((c) => `<div class="row tap" data-a="cp.open" data-k="${c.id}"><span class="ic-wrap">${icon('trophy')}</span><div class="main"><div class="t1">${esc(c.name)}</div><div class="t2">${compStatus(c)}</div></div>${icon('right')}</div>`).join('')}</div></div>` : empty('Brak rozgrywek w tej kategorii.');
    }
    return { title: 'Rozgrywki', cls: 'nofoot', body };
  },
});

function tableHTML(c, gi, qualN = 0) {
  const rows = standings(G, c, gi);
  const m = me();
  return `<table class="tbl"><thead><tr><th>#</th><th class="tl">Drużyna</th><th>M</th><th>Z</th><th>R</th><th>P</th><th>Br.</th><th>Pkt</th></tr></thead><tbody>
    ${rows.map((r, i) => `<tr class="${r.t === m ? 'me' : ''} ${i < qualN ? 'q' : ''}"><td>${i + 1}</td><td class="tl">${flag(r.t)} <span class="tn">${esc(natName(r.t))}</span></td><td>${r.p}</td><td>${r.w}</td><td>${r.d}</td><td>${r.l}</td><td>${r.gf}:${r.ga}</td><td><b>${r.pts}</b></td></tr>`).join('')}
  </tbody></table>`;
}

function fxRow(f) {
  const res = f.res ? `${f.res.hg}:${f.res.ag}${f.res.et ? ' pd' : ''}${f.res.pens ? `, k. ${f.res.pens[0]}:${f.res.pens[1]}` : ''}` : 'vs';
  const m = me();
  return `<div class="fx-row ${f.h === m || f.a === m ? 'me' : ''}"><span class="d">${fmtDateShort(f.d)}</span>
    <span class="teams">${flag(f.h)}<span class="tn">${esc(natName(f.h))}</span><span class="muted">vs</span>${flag(f.a)}<span class="tn">${esc(natName(f.a))}</span></span><span class="r">${res}</span></div>`;
}

screen('comp', {
  render({ id }) {
    const c = G.comps[id];
    if (!c) return { title: 'Rozgrywki', body: empty('Brak danych.'), cls: 'nofoot' };
    const m = me();
    const hasKO = c.ko && c.ko.rounds.some((r) => r.fx.length);
    const tabs = [['tables', 'Tabele'], ['fixtures', 'Terminarz']];
    if (c.ko) tabs.push(['ko', 'Puchar']);
    tabs.push(['scorers', 'Strzelcy']);
    if (!tabs.some((t) => t[0] === cs.tab)) cs.tab = 'tables';
    let body = seg('cp.tab', tabs, cs.tab, { id });
    if (c.direct) body += `<div class="note mb">Wszystkie drużyny, łącznie ${c.qualified.length}, awansowały bez eliminacji: ${c.qualified.map(natName).join(', ')}.</div>`;
    if (c.qualified && !c.direct) body += `<div class="note mb">Awans wywalczyli: ${c.qualified.map((t) => `${NAT[t].flag} ${esc(natName(t))}`).join(', ')}.</div>`;
    if (c.winner) body += `<div class="note mb">🏆 Zwycięzca: <b>${NAT[c.winner].flag} ${esc(natName(c.winner))}</b>${c.runnerUp ? ` · finalista: ${esc(natName(c.runnerUp))}` : ''}</div>`;
    if (cs.tab === 'tables') {
      const order = c.groups.map((g, gi) => gi).sort((a, b) => (c.groups[b].teams.includes(m) ? 1 : 0) - (c.groups[a].teams.includes(m) ? 1 : 0));
      const qualN = c.type === 'FIN' ? c.ko.top : c.type === 'Q' ? 1 : c.type === 'LN' ? 1 : 0;
      body += order.length ? order.map((gi) => `<div class="card"><div class="card-h"><h3>Grupa ${esc(c.groups[gi].name)}</h3>${c.type === 'LN' ? `<span class="small muted">dywizja ${c.groups[gi].div}</span>` : ''}</div>${tableHTML(c, gi, qualN)}</div>`).join('') : empty('Brak fazy grupowej.');
    } else if (cs.tab === 'fixtures') {
      const fxs = G.fixtures.filter((f) => f.comp === c.id).sort((a, b) => a.d - b.d);
      const mineFirst = fxs.filter((f) => f.h === m || f.a === m);
      const byDate = {};
      for (const f of fxs) (byDate[f.d] = byDate[f.d] || []).push(f);
      body += mineFirst.length ? `<div class="card"><div class="card-h"><h3>Moje mecze</h3></div>${mineFirst.map(fxRow).join('')}</div>` : '';
      body += Object.entries(byDate).map(([d, l]) => `<div class="card"><div class="card-h"><h3>${fmtDateLong(+d)}</h3><span class="small muted">${l.length}</span></div>${l.map(fxRow).join('')}</div>`).join('') || empty('Brak meczów.');
    } else if (cs.tab === 'ko') {
      body += hasKO ? `<div class="bracket">${c.ko.rounds.map((r) => `<div class="rd"><div class="label mb">${esc(r.name)} · ${fmtDate(r.d)}</div>${r.fx.length ? r.fx.map((id2) => {
        const f = fxById(G, id2);
        const w = koWinner(f);
        return `<div class="ko-m"><span class="${w === f.h ? 'w' : ''}">${flag(f.h)} ${esc(natName(f.h))}</span><span class="s">${f.res ? f.res.hg : ''}${f.res && f.res.pens ? ` k${f.res.pens[0]}` : ''}</span><span class="${w === f.a ? 'w' : ''}">${flag(f.a)} ${esc(natName(f.a))}</span><span class="s">${f.res ? f.res.ag : ''}${f.res && f.res.pens ? ` (${f.res.pens[1]})` : ''}</span></div>`;
      }).join('') : '<div class="small muted">Pary zostaną ustalone po poprzedniej rundzie.</div>'}</div>`).join('')}</div>` : empty('Faza pucharowa jeszcze się nie rozpoczęła.');
    } else {
      const sc = topScorers(c, 20);
      body += sc.length ? `<div class="card tight"><div class="list">${sc.map((x, i) => `<div class="row tap" data-a="pl.open" data-k="${x.p.id}"><b style="width:22px">${i + 1}.</b>${posBadge(x.p.pos)}<div class="main"><div class="t1">${esc(fullName(x.p))}</div><div class="t2">${flag(x.p.nat)} ${esc(natName(x.p.nat))}</div></div><b>${x.g}</b></div>`).join('')}</div></div>` : empty('Brak goli.');
    }
    return { title: c.name, sub: compStatus(c), cls: 'nofoot', body };
  },
});

// ---------------- przeciwnicy ----------------
export function scoutTips(nid) {
  const squad = (G.nats[nid].squad && G.nats[nid].squad.length ? G.nats[nid].squad : G.nats[nid].pool).map((id) => G.players[id]).filter(Boolean);
  const best = squad.slice().sort((a, b) => ovr(b) - ovr(a)).slice(0, 14);
  if (!best.length) return [];
  const avg = (k, f = () => true) => { const l = best.filter(f); return l.length ? l.reduce((s, p) => s + p.a[k], 0) / l.length : 0; };
  const tips = [];
  const att = best.filter((p) => ['CF', 'LW', 'RW', 'AM'].includes(p.pos));
  const def = best.filter((p) => ['CB', 'LB', 'RB', 'DM'].includes(p.pos));
  const gk = best.find((p) => p.pos === 'GK');
  if (avg('hd', (p) => ['CB', 'CF'].includes(p.pos)) >= 72) tips.push('Bardzo groźni w powietrzu, uważaj na stałe fragmenty, wystaw wysokich obrońców.');
  if (avg('sp', (p) => att.includes(p)) >= 76) tips.push('Szybcy napastnicy i skrzydłowi, wysoka linia obrony i pułapki ofsajdowe są ryzykowne.');
  if (avg('sp', (p) => def.includes(p)) <= 58) tips.push('Wolni obrońcy, długie podania za linię obrony mogą przynieść efekty.');
  if (gk && gk.a.gk <= 62) tips.push('Słabszy bramkarz, warto częściej strzelać z dystansu.');
  if (avg('tk', (p) => def.includes(p)) >= 76) tips.push('Twarda, dobrze odbierająca obrona, drybling może się nie opłacać.');
  if (avg('ps', (p) => ['CM', 'DM', 'AM'].includes(p.pos)) >= 78) tips.push('Świetna druga linia, wysoki pressing utrudni im rozgrywanie.');
  if (!tips.length) tips.push('Zespół bez wyraźnych słabych punktów. Kluczowa będzie dyspozycja dnia.');
  return tips;
}

screen('opponents', {
  render() {
    const m = me();
    const fut = userFixtures().filter((f) => !f.res).slice(0, 8);
    const body = fut.length ? `<div class="card tight"><div class="list">${fut.map((f) => {
      const opp = f.h === m ? f.a : f.h;
      return `<div class="row tap" data-a="op.open" data-k="${opp}"><span class="flag" style="font-size:30px">${NAT[opp].flag}</span><div class="main"><div class="t1">${esc(natName(opp))}</div><div class="t2">${fmtDate(f.d)} · ${esc(G.comps[f.comp]?.short || '')} · ${f.h === m ? 'u siebie' : f.neutral ? 'teren neutralny' : 'na wyjeździe'}</div></div><span class="small muted">${rankPositions(G)[opp]}.</span>${icon('right')}</div>`;
    }).join('')}</div></div>` : empty('Brak zaplanowanych meczów. Rywale pojawią się tu po losowaniach i umówieniu sparingów.');
    return { title: 'Przeciwnicy', cls: 'nofoot', body };
  },
});

screen('opponent', {
  render({ nid }) {
    const n = NAT[nid];
    const nat = G.nats[nid];
    const pos = rankPositions(G)[nid];
    const squad = ((nat.squad && nat.squad.length) ? nat.squad : nat.pool).map((id) => G.players[id]).filter(Boolean);
    const top = squad.slice().sort((a, b) => ovr(b) - ovr(a)).slice(0, 8);
    setLastList(top.map((p) => p.id));
    const h2h = G.history.filter((h) => h.opp === nid).slice(-6).reverse();
    const coach = nat.coach ? fullName(nat.coach) : 'Ty';
    const recent = G.fixtures.filter((f) => f.res && (f.h === nid || f.a === nid)).sort((a, b) => b.d - a.d).slice(0, 5);
    const pred = nid !== me() ? predictLineup(nid) : null;
    const body = `<div class="card"><div class="pl-head"><span class="flag" style="font-size:54px">${n.flag}</span><div class="grow"><div class="big">${esc(n.name)}</div><div class="muted small">${CONFS[n.conf].name} · ${pos}. w rankingu · ${Math.round(G.rank[nid])} pkt</div><div>${natStars(nid)}</div></div></div></div>
      <div class="facts mb"><div class="fact"><div class="k">Selekcjoner</div><div class="v">${esc(coach)}</div></div><div class="fact"><div class="k">Ustawienie</div><div class="v">${nat.tac.f}</div></div></div>
      <div class="card"><div class="card-h"><h3>Raport asystenta</h3></div>${scoutTips(nid).map((t) => `<p class="small">• ${esc(t)}</p>`).join('')}</div>
      ${pred ? `<div class="card-h"><h3>Przewidywany skład</h3><span class="small muted">${pred.f} · ${STYLE_NAMES[pred.tac.style]}</span></div>${pitchHTML(pred.lineup, pred.f, {}, 'pl.open')}` : ''}
      <div class="card"><div class="card-h"><h3>Ostatnie mecze</h3></div>${recent.length ? recent.map(fxRow).join('') : '<div class="small muted">Brak danych.</div>'}</div>
      <div class="card"><div class="card-h"><h3>Najlepsi zawodnicy</h3></div><div class="list">${top.map((p) => `<div class="row tap" data-a="pl.open" data-k="${p.id}">${posBadge(p.pos)}<div class="main"><div class="t1">${esc(fullName(p))}</div><div class="t2">${p.age} l. · ${esc(G.clubs[p.club]?.n || '')}</div></div>${rating(ovr(p))}</div>`).join('')}</div></div>
      ${h2h.length ? `<div class="card"><div class="card-h"><h3>Bilans bezpośredni</h3></div>${h2h.map((h) => `<div class="row"><span class="tag">${fmtDate(h.d)}</span><div class="main"><div class="t1">${esc(h.cs)} · ${h.home ? 'dom' : 'wyjazd'}</div></div><b>${h.gf}:${h.ga}</b>${resChip(h.res)}</div>`).join('')}</div>` : ''}`;
    return { title: n.name, sub: 'Analiza rywala', cls: 'nofoot', body };
  },
});

// ---------------- ranking ----------------
const rk = { conf: 'all' };
screen('ranking', {
  render() {
    const pos = rankPositions(G);
    const prev = G.rankPrev || {};
    const ids = rankedIds(G, rk.conf === 'all' ? null : (id) => NAT[id].conf === rk.conf);
    const m = me();
    const body = chips('rk.conf', [['all', 'Świat'], ...CONF_ORDER.map((c) => [c, CONFS[c].name])], rk.conf)
      + `<div class="card tight"><div class="list">${ids.map((id) => {
        const p = pos[id], pp = prev[id] || p;
        const ch = pp - p;
        const arrow = ch > 0 ? `<span class="small" style="color:#8dee7e">▲${ch}</span>` : ch < 0 ? `<span class="small" style="color:#f37f71">▼${-ch}</span>` : '<span class="small muted">=</span>';
        return `<div class="row ${id === m ? 'me' : ''} tap" data-a="op.open" data-k="${id}" id="rk-${id}"><b style="width:30px;text-align:right">${p}.</b><span class="flag" style="font-size:22px">${NAT[id].flag}</span><div class="main"><div class="t1">${esc(NAT[id].name)}</div></div>${arrow}<b style="width:48px;text-align:right">${Math.round(G.rank[id])}</b></div>`;
      }).join('')}</div></div>`;
    return { title: 'Ranking światowy', sub: m ? `${natName(m)}: ${pos[m]}. miejsce` : '', cls: 'nofoot', body, right: m ? `<button class="iconbtn" data-a="rk.me">${icon('target')}</button>` : '' };
  },
});

// ---------------- mecze towarzyskie ----------------
const fr = { home: true, conf: 'all' };
screen('friendlies', {
  render() {
    const slots = friendlySlots();
    const m = me();
    const body = `<p class="small muted">Mecze towarzyskie można umawiać w wolnych terminach zgrupowań, najpóźniej 3 dni przed meczem. Sparingi z silnymi rywalami podnoszą ranking, a ze słabszymi pewność siebie.</p>
      <div class="card tight"><div class="list">${slots.length ? slots.map((s) => {
        if (s.taken) {
          const f = s.taken;
          const c = G.comps[f.comp];
          const opp = f.h === m ? f.a : f.h;
          return `<div class="row"><span class="tag">${fmtDate(s.d)}</span><div class="main"><div class="t1">${flag(opp)} ${esc(natName(opp))}</div><div class="t2">${esc(c ? c.name : '')}</div></div>${c && c.type === 'FRI' && !f.res && f.d >= G.day + 3 ? `<button class="btn small ghost" data-a="fr.cancel" data-k="${f.id}">Odwołaj</button>` : ''}</div>`;
        }
        return `<div class="row tap" data-a="fr.slot" data-k="${s.d}"><span class="tag acc">${fmtDate(s.d)}</span><div class="main"><div class="t1">Wolny termin</div><div class="t2">zgrupowanie ${WINDOW_NAMES[s.w.key]}</div></div><span class="btn small">Umów</span></div>`;
      }).join('') : empty('Brak terminów w najbliższym czasie.')}</div></div>`;
    return { title: 'Mecze towarzyskie', cls: 'nofoot', body };
  },
});

function friendlySheet(d) {
  const cands = friendlyCandidates(d).filter((id) => fr.conf === 'all' || NAT[id].conf === fr.conf);
  const pos = rankPositions(G);
  return `<div class="opt mb"><button class="${fr.home ? 'on' : ''}" data-a="fr.home" data-k="1" data-d="${d}">U siebie</button><button class="${!fr.home ? 'on' : ''}" data-a="fr.home" data-k="0" data-d="${d}">Na wyjeździe</button></div>
    ${chips('fr.conf', [['all', 'Wszyscy'], ...CONF_ORDER.map((c) => [c, CONFS[c].name])], fr.conf, { d })}
    <div class="list">${cands.slice(0, 80).map((id) => `<div class="row tap" data-a="fr.ask" data-k="${id}" data-d="${d}"><b style="width:30px;text-align:right">${pos[id]}.</b><span class="flag" style="font-size:22px">${NAT[id].flag}</span><div class="main"><div class="t1">${esc(NAT[id].name)}</div><div class="t2">${natStars(id)}</div></div>${icon('right')}</div>`).join('') || '<div class="empty">Brak wolnych rywali w tym terminie.</div>'}</div>`;
}

actions({
  'cp.filter': (d) => { cs.filter = d.k; rerender(); },
  'cp.open': (d) => { cs.tab = 'tables'; go('comp', { id: d.k }); },
  'cp.tab': (d) => { cs.tab = d.k; rerender(); },
  'op.open': (d) => go('opponent', { nid: d.k }),
  'rk.conf': (d) => { rk.conf = d.k; rerender(); },
  'rk.me': () => { const el = document.getElementById('rk-' + me()); if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' }); },
  'fr.slot': (d) => sheet(`<div id="fr-body">${friendlySheet(+d.k)}</div>`, { title: `Mecz towarzyski, ${fmtDate(+d.k)}` }),
  'fr.home': (d) => { fr.home = d.k === '1'; const el = document.getElementById('fr-body'); if (el) el.innerHTML = friendlySheet(+d.d); },
  'fr.conf': (d) => { fr.conf = d.k; const el = document.getElementById('fr-body'); if (el) el.innerHTML = friendlySheet(+d.d); },
  'fr.ask': (d) => {
    const r = requestFriendly(+d.d, d.k, fr.home);
    toast(esc(r.msg), r.ok ? 'good' : 'bad');
    if (r.ok) { closeOverlay(); rerender(); } else { const el = document.getElementById('fr-body'); if (el) el.innerHTML = friendlySheet(+d.d); }
  },
  'fr.cancel': async (d) => {
    const ok = await confirmBox('Odwołać ten mecz towarzyski? Federacja nie będzie zadowolona.', 'Odwołaj', 'Nie', true);
    if (!ok) return;
    const f = G.fixtures.find((x) => x.id === +d.k);
    if (f && cancelFriendly(f)) toast('Mecz odwołany.');
    rerender();
  },
});

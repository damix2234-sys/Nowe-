// Taktyka: ustawienie, polecenia drużyny i indywidualne, stałe fragmenty; ekran przedmeczowy.
import { screen, actions, go, rerender, esc, icon, posBadge, rating, sheet, closeOverlay, modal, seg, flag, team, resChip, toast, empty } from '../ui.js';
import { G, me, natName, userSquadPlayers, ensureLineup, prepareMatch, poolOf } from '../../engine/game.js';
import { FORMATIONS, FORMATION_NAMES, STYLE_NAMES, PRESS_NAMES, TW_NAMES, TRAP_NAMES, INSTR, defaultInstr, defaultSetPieces, autoLineup, matchScore, available } from '../../engine/tactics.js';
import { slotRating, familiarity, ovr, POS_NAMES, POS_ORDER } from '../../engine/player.js';
import { fullName } from '../../data/names.js';
import { fixtureStage } from '../../engine/comps.js';
import { rankPositions } from '../../engine/ranking.js';
import { fmtDateLong } from '../../core/util.js';
import { setLastList } from './squad.js';
import { unlockAudio } from '../sound.js';
import { scoutTips } from './world.js';

let quickBusy = false;

const PITCH_SVG = `<svg class="lines" viewBox="0 0 68 96" preserveAspectRatio="none" fill="none" stroke="rgba(255,255,255,.33)" stroke-width=".45">
<rect x="2" y="2" width="64" height="92" rx="1"/><line x1="2" y1="48" x2="66" y2="48"/><circle cx="34" cy="48" r="7"/>
<rect x="15" y="2" width="38" height="13"/><rect x="25" y="2" width="18" height="5"/><rect x="15" y="81" width="38" height="13"/><rect x="25" y="89" width="18" height="5"/>
<circle cx="34" cy="48" r=".7" fill="rgba(255,255,255,.4)"/></svg>`;

export function pitchHTML(lineup, formation, sp = {}, action = 'tac.slot') {
  const f = FORMATIONS[formation];
  const cnt = {};
  for (const id of lineup || []) { const q = id != null ? G.players[id] : null; if (q) cnt[q.ln] = (cnt[q.ln] || 0) + 1; }
  const label = (p) => (cnt[p.ln] > 1 && p.fn ? `${p.fn[0]}. ${p.ln}` : p.ln);
  const toks = f.map(([pos, x, y], i) => {
    const pid = lineup ? lineup[i] : null;
    const p = pid != null ? G.players[pid] : null;
    const top = 4 + (100 - y) * 0.9;
    const style = `left:${x}%;top:${top}%`;
    if (!p) return action === 'pl.open' ? '' : `<button class="tok empty" style="${style}" data-a="${action}" data-k="${i}"><span class="dot">+</span><span class="nm">${pos}</span></button>`;
    const fit = familiarity(p, pos);
    const cls = fit >= 0.95 ? '' : fit >= 0.85 ? 'fit-ok' : 'fit-bad';
    const key = action === 'pl.open' ? pid : i;
    const cnd = Math.round(p.cond);
    const cc = cnd >= 88 ? '' : cnd >= 75 ? 'md' : 'lo';
    return `<button class="tok ${cls}" style="${style}" data-a="${action}" data-k="${key}"><span class="dot">${Math.round(slotRating(p, pos))}</span><span class="nm">${esc(label(p))}</span><span class="cnd ${cc}" title="Kondycja ${cnd}%"><i style="width:${cnd}%"></i></span><span class="ps">${pos}${p.inj || p.susp ? ' ⚠' : ''}</span>${sp && sp.cap === pid ? '<span class="cap">C</span>' : ''}</button>`;
  });
  return `<div class="pitch">${PITCH_SVG}${toks.join('')}</div>`;
}

const tt = { tab: 'lineup' };

function formationChips(cur) {
  return `<div class="chips">${FORMATION_NAMES.map((f) => `<button class="chip ${f === cur ? 'on' : ''}" data-a="tac.form" data-k="${f}">${f}</button>`).join('')}</div>`;
}

function benchList() {
  const t = G.team;
  const bench = (t.bench || []).map((id) => G.players[id]).filter(Boolean);
  const inLu = new Set(t.lineup || []);
  const benchSet = new Set(t.bench || []);
  const out = userSquadPlayers().filter((p) => !inLu.has(p.id) && !benchSet.has(p.id));
  const row = (p) => `<div class="row tap" data-a="pl.open" data-k="${p.id}">${posBadge(p.pos)}<div class="main"><div class="t1">${esc(fullName(p))}</div></div><div class="end">${p.inj ? '<span class="status st-inj">✚</span>' : ''}${p.susp ? '<span class="status st-sus">zaw.</span>' : ''}${rating(ovr(p))}</div></div>`;
  return `<div class="card"><div class="card-h"><h3>Ławka rezerwowych</h3><span class="small muted">${bench.length}</span></div><div class="list">${bench.map(row).join('') || empty('Brak rezerwowych.')}</div>
    ${out.length ? `<div class="hr"></div><div class="label mb">Poza kadrą meczową</div><div class="list">${out.map(row).join('')}</div>` : ''}</div>`;
}

function lineupTab() {
  const t = G.team;
  return `${formationChips(t.tac.f)}
    ${pitchHTML(t.lineup, t.tac.f, t.sp)}
    <div class="btnrow mb"><button class="btn ghost small" data-a="tac.auto">${icon('bolt')} Automatyczny skład</button><button class="btn ghost small" data-a="tac.clear">${icon('x')} Wyczyść</button></div>
    <p class="small muted">Dotknij zawodnika na boisku, aby go zmienić. Kolor obwódki: zielony to nominalna pozycja, żółty pozycja zbliżona, a czerwony oznacza grę nie na swojej pozycji.</p>
    ${benchList()}`;
}

function optRow(label, key, names, val, hint) {
  return `<div class="card"><div class="card-h"><h3>${label}</h3></div><div class="opt">${names.map((n, i) => `<button class="${i === val ? 'on' : ''}" data-a="tac.team" data-k="${key}" data-v="${i}">${n}</button>`).join('')}</div><p class="small muted mt">${hint}</p></div>`;
}

function teamTab() {
  const t = G.team.tac;
  return optRow('Styl gry', 'style', STYLE_NAMES, t.style, 'Ofensywny styl daje więcej okazji, ale zostawia więcej miejsca rywalowi. Defensywny działa odwrotnie.')
    + optRow('Pressing', 'press', PRESS_NAMES, t.press, 'Wysoki pressing pomaga odzyskiwać piłkę, ale szybciej męczy zawodników.')
    + optRow('Gra na czas', 'tw', TW_NAMES, t.tw, 'Spowalnia grę i skraca czas na odrobienie strat przez rywala.')
    + optRow('Pułapki ofsajdowe', 'trap', TRAP_NAMES, t.trap, 'Więcej spalonych rywala, ale gdy pułapka zawiedzie, rywal wychodzi sam na sam.');
}

function instrSummary(ins) {
  return `Strzały: ${INSTR.sh.opts[ins.sh]} · Drybling: ${INSTR.dr.opts[ins.dr]} · Podania: ${INSTR.ps.opts[ins.ps]} · Odbiór: ${INSTR.tk.opts[ins.tk]}${ins.dv ? ' · Symulowanie: ' + INSTR.dv.opts[ins.dv] : ''}`;
}

function getInstr(pid, pos) {
  const t = G.team;
  if (!t.instr[pid]) t.instr[pid] = defaultInstr(G.players[pid], pos);
  return t.instr[pid];
}

function playersTab() {
  const t = G.team;
  const f = FORMATIONS[t.tac.f];
  const rows = (t.lineup || []).map((pid, i) => {
    const p = G.players[pid];
    if (!p) return '';
    const ins = getInstr(pid, f[i][0]);
    return `<div class="row tap" data-a="tac.instr" data-k="${pid}" data-pos="${f[i][0]}">${posBadge(f[i][0])}<div class="main"><div class="t1">${esc(fullName(p))}</div><div class="t2">${instrSummary(ins)}</div></div>${icon('right')}</div>`;
  }).join('');
  return `<div class="card tight"><div class="list">${rows}</div></div><button class="btn ghost block" data-a="tac.instrReset">Przywróć domyślne polecenia</button>`;
}

const SP_ROWS = [['cap', 'Kapitan'], ['pen', 'Rzuty karne'], ['fkn', 'Bliskie rzuty wolne'], ['fkf', 'Dalekie rzuty wolne'], ['cor', 'Rzuty rożne']];

function spTab() {
  const t = G.team;
  const sp = t.sp || {};
  const nm = (pid) => (G.players[pid] ? esc(fullName(G.players[pid])) : '');
  const rows = SP_ROWS.map(([k, label]) => `<div class="row tap" data-a="tac.spPick" data-k="${k}"><div class="main"><div class="t2">${label}</div><div class="t1">${nm(sp[k])}</div></div>${icon('right')}</div>`).join('');
  const lu = (t.lineup || []).filter((x) => x != null).map((id) => G.players[id]).filter((p) => p.pos !== 'GK');
  const box = new Set(sp.box || []);
  return `<div class="card tight"><div class="list">${rows}</div></div>
    <div class="card"><div class="card-h"><h3>W polu karnym przy stałych fragmentach</h3><span class="small muted">${box.size}/5</span></div>
    <p class="small muted">Zawodnicy, którzy idą w pole karne przy rzutach rożnych i dalekich rzutach wolnych. Liczy się gra głową.</p>
    <div class="list">${lu.map((p) => `<div class="row"><div class="main"><div class="t1">${esc(fullName(p))}</div><div class="t2">Gra głową: ${Math.round(p.a.hd)} · Siła: ${Math.round(p.a.st)}</div></div><button class="toggle ${box.has(p.id) ? 'on' : ''}" data-a="tac.box" data-k="${p.id}">${icon(box.has(p.id) ? 'check' : 'plus')}</button></div>`).join('')}</div></div>`;
}

screen('tactics', {
  render() {
    ensureLineup();
    let body = seg('tac.tab', [['lineup', 'Ustawienie'], ['team', 'Drużyna'], ['players', 'Zawodnicy'], ['sp', 'Stałe fragm.']], tt.tab);
    if (tt.tab === 'lineup') body += lineupTab();
    else if (tt.tab === 'team') body += teamTab();
    else if (tt.tab === 'players') body += playersTab();
    else body += spTab();
    return { title: 'Taktyka', sub: `${G.team.tac.f} · ${STYLE_NAMES[G.team.tac.style]}`, cls: 'nofoot', right: `<button class="iconbtn" data-a="tac.help" aria-label="Pomoc">${icon('help')}</button>`, body };
  },
});

// ---------------- ekran przedmeczowy ----------------
/** Uwagi asystenta przed meczem: zmęczenie, pozycje, kartki, rywal. */
export function assistantReport(f, opp) {
  const t = G.team;
  const fm = FORMATIONS[t.tac.f];
  const c = G.comps[f.comp];
  const notes = [];
  const starters = (t.lineup || []).map((id, i) => ({ p: G.players[id], pos: fm[i][0] })).filter((x) => x.p);
  const tired = starters.filter((x) => x.p.cond < 85).sort((a, b) => a.p.cond - b.p.cond);
  if (tired.length) notes.push(`🔋 Zmęczeni po ostatnich meczach: ${tired.slice(0, 4).map((x) => `${esc(x.p.ln)} ${Math.round(x.p.cond)}%`).join(', ')}. Warto rozważyć rotację.`);
  const off = starters.filter((x) => familiarity(x.p, x.pos) < 0.85);
  if (off.length) notes.push(`📍 Poza nominalną pozycją: ${off.map((x) => `${esc(x.p.ln)} ${x.p.pos} → ${x.pos}`).join(', ')}.`);
  if (c && c.type !== 'FRI') {
    const risk = starters.filter((x) => x.p.ycc === 1);
    if (risk.length) notes.push(`🟨 Jedna żółta kartka od pauzy: ${risk.map((x) => esc(x.p.ln)).join(', ')}.`);
  }
  const lowMor = starters.filter((x) => x.p.mor < 35);
  if (lowMor.length) notes.push(`😟 Niskie morale: ${lowMor.map((x) => esc(x.p.ln)).join(', ')}, może pomóc rozmowa.`);
  const bench = (t.bench || []).map((id) => G.players[id]).filter(Boolean);
  const betterOnBench = starters.filter((x) => bench.some((b) => b.pos === x.pos && slotRating(b, x.pos) > slotRating(x.p, x.pos) + 4 && b.cond >= 85));
  if (betterOnBench.length) notes.push(`🔁 Na ławce są mocniejsi zawodnicy na pozycjach: ${[...new Set(betterOnBench.map((x) => x.pos))].join(', ')}.`);
  const tips = scoutTips(opp);
  if (tips.length) notes.push(`🔎 ${esc(tips[0])}`);
  return notes;
}

export function oppInfo(nid) {
  const pos = rankPositions(G)[nid];
  const form = G.nats[nid].form.slice(-5);
  const squad = (G.nats[nid].squad || []).map((id) => G.players[id]).filter(Boolean);
  const top = (squad.length ? squad : poolOf(nid)).slice().sort((a, b) => ovr(b) - ovr(a)).slice(0, 3);
  return { pos, form, top, tac: G.nats[nid].tac };
}

screen('prematch', {
  render({ fx }) {
    const f = G.fixtures.find((x) => x.id === +fx);
    if (!f) return { title: 'Mecz', body: empty('Brak meczu.') };
    ensureLineup();
    const t = G.team;
    const opp = f.h === me() ? f.a : f.h;
    const oi = oppInfo(opp);
    const c = G.comps[f.comp];
    const warn = (t.lineup || []).some((id) => id == null) ? '<div class="note mb">⚠ W składzie brakuje zawodników.</div>' : '';
    setLastList((t.lineup || []).filter((x) => x != null));
    const body = `
      <div class="card next-match">
        <div class="card-h"><h3>${esc(c ? c.short : '')} · ${esc(fixtureStage(G, f))}</h3><span class="small muted">${esc(f.city)}</span></div>
        <div class="vs"><div>${flag(f.h)}<div class="nm">${esc(natName(f.h))}</div></div><div class="mid">${fmtDateLong(f.d)}</div><div>${flag(f.a)}<div class="nm">${esc(natName(f.a))}</div></div></div>
      </div>
      <div class="card" data-a="tac.oppDetails" data-k="${opp}"><div class="card-h"><h3>Rywal: ${esc(natName(opp))}</h3><span class="small muted">${oi.pos}. w rankingu</span></div>
        <div class="row-flex small"><span class="muted">Forma:</span>${oi.form.map(resChip).join('') || '<span class="muted">brak danych</span>'}<span class="grow"></span><span class="tag">${oi.tac.f}</span></div>
        <div class="small muted mt">Kluczowi zawodnicy: ${oi.top.map((p) => `${esc(fullName(p))} (${p.pos}, ${Math.round(ovr(p))})`).join(', ')}</div>
      </div>
      ${warn}
      <div class="card"><div class="card-h"><h3>Raport asystenta</h3><button class="link" data-a="tac.oppDetails" data-k="${opp}">Skład rywala ›</button></div>${assistantReport(f, opp).map((n) => `<p class="small">${n}</p>`).join('') || '<p class="small muted">Wszystko gotowe, zespół jest w dobrej dyspozycji.</p>'}</div>
      <div class="card-h"><h3>Wyjściowa jedenastka</h3><button class="link" data-a="go" data-k="tactics">Taktyka ›</button></div>
      ${formationChips(t.tac.f)}
      ${pitchHTML(t.lineup, t.tac.f, t.sp)}
      <div class="btnrow mb"><button class="btn ghost small" data-a="tac.auto">${icon('bolt')} Auto skład</button><button class="btn ghost small" data-a="go" data-k="tactics">${icon('clipboard')} Polecenia</button></div>
      <div class="note small">Styl: <b>${STYLE_NAMES[t.tac.style]}</b> · pressing: <b>${PRESS_NAMES[t.tac.press]}</b> · gra na czas: <b>${TW_NAMES[t.tac.tw]}</b> · pułapki: <b>${TRAP_NAMES[t.tac.trap]}</b></div>`;
    return {
      title: 'Przed meczem', sub: `${natName(f.h)} vs ${natName(f.a)}`, body,
      foot: `<button class="btn ghost" data-a="pm.quick" data-k="${f.id}">${icon('ff')} Symuluj</button><button class="btn" data-a="pm.live" data-k="${f.id}">${icon('play')} Graj</button>`,
    };
  },
});

// ---------------- akcje ----------------
function assign(i, pid) {
  const t = G.team;
  const lu = t.lineup;
  const j = lu.indexOf(pid);
  if (j >= 0) { const tmp = lu[i]; lu[i] = pid; lu[j] = tmp; }
  else {
    const prev = lu[i];
    lu[i] = pid;
    t.bench = (t.bench || []).filter((x) => x !== pid);
    if (prev != null) t.bench.unshift(prev);
  }
  ensureLineup();
}

actions({
  'tac.tab': (d) => { tt.tab = d.k; rerender(); },
  'tac.form': (d) => {
    const t = G.team;
    const players = (t.lineup || []).filter((x) => x != null).map((id) => G.players[id]);
    t.tac.f = d.k;
    const pool = players.length >= 11 ? players : userSquadPlayers();
    t.lineup = autoLineup(pool, d.k);
    ensureLineup();
    rerender();
  },
  'tac.auto': () => { G.team.lineup = autoLineup(userSquadPlayers(), G.team.tac.f); G.team.bench = null; G.team.sp = null; ensureLineup(); toast('Asystent ustawił najsilniejszy skład.', 'good'); rerender(); },
  'tac.clear': () => { G.team.lineup = new Array(11).fill(null); rerender(); toast('Skład wyczyszczony, uzupełnij pozycje.'); },
  'tac.slot': (d) => {
    const i = +d.k;
    const t = G.team;
    const pos = FORMATIONS[t.tac.f][i][0];
    const cand = userSquadPlayers().slice().sort((a, b) => (available(b) - available(a)) || matchScore(b, pos) - matchScore(a, pos));
    const where = (pid) => { const j = (t.lineup || []).indexOf(pid); return j >= 0 ? `w składzie: ${FORMATIONS[t.tac.f][j][0]}` : (t.bench || []).includes(pid) ? 'ławka' : 'poza kadrą meczową'; };
    sheet(`<p class="small muted">${POS_NAMES[pos]}, wybierz zawodnika:</p><div class="list">${cand.map((p) => `<div class="row tap ${t.lineup[i] === p.id ? 'me' : ''} ${available(p) ? '' : 'dim'}" data-a="tac.assign" data-i="${i}" data-k="${p.id}">
      ${posBadge(p.pos)}<div class="main"><div class="t1">${esc(fullName(p))}</div><div class="t2">${where(p.id)}${p.inj ? ' · kontuzja' : ''}${p.susp ? ' · zawieszony' : ''} · kondycja ${Math.round(p.cond)}%</div></div>${rating(slotRating(p, pos))}</div>`).join('')}</div>`, { title: `Pozycja: ${pos}` });
  },
  'tac.assign': (d) => {
    const p = G.players[+d.k];
    if (!available(p)) { toast('Ten zawodnik nie może zagrać z powodu kontuzji lub zawieszenia.', 'bad'); return; }
    assign(+d.i, +d.k);
    closeOverlay();
    rerender();
  },
  'tac.team': (d) => { G.team.tac[d.k] = +d.v; rerender(); },
  'tac.instr': (d) => {
    const pid = +d.k;
    const p = G.players[pid];
    sheet(`<div id="ins-body">${instrForm(pid, d.pos)}</div><button class="btn block mt" data-a="ui.close">Gotowe</button>`, { title: `${fullName(p)} (${d.pos})`, onClose: () => rerender() });
  },
  'tac.instrSet': (d) => {
    const ins = getInstr(+d.k, d.pos);
    ins[d.f] = +d.v;
    const el = document.getElementById('ins-body');
    if (el) el.innerHTML = instrForm(+d.k, d.pos);
  },
  'tac.instrReset': () => { G.team.instr = {}; toast('Przywrócono domyślne polecenia.'); rerender(); },
  'tac.spPick': (d) => {
    const t = G.team;
    const lu = (t.lineup || []).filter((x) => x != null).map((id) => G.players[id]).filter((p) => d.k === 'cap' || p.pos !== 'GK');
    const score = { cap: (p) => p.a.ld, pen: (p) => p.a.sh * 0.7 + p.a.te * 0.3, fkn: (p) => p.a.sh * 0.5 + p.a.te * 0.5, fkf: (p) => p.a.cr * 0.7 + p.a.te * 0.3, cor: (p) => p.a.cr * 0.75 + p.a.te * 0.25 }[d.k];
    const lbl = { cap: 'Przywództwo', pen: 'Strzały/technika', fkn: 'Strzały/technika', fkf: 'Dośrodkowania', cor: 'Dośrodkowania' }[d.k];
    sheet(`<div class="list">${lu.sort((a, b) => score(b) - score(a)).map((p) => `<div class="row tap ${t.sp[d.k] === p.id ? 'me' : ''}" data-a="tac.spSet" data-k="${d.k}" data-p="${p.id}">${posBadge(p.pos)}<div class="main"><div class="t1">${esc(fullName(p))}</div><div class="t2">${lbl}: ${Math.round(score(p))}</div></div>${t.sp[d.k] === p.id ? icon('check') : ''}</div>`).join('')}</div>`, { title: SP_ROWS.find((x) => x[0] === d.k)[1] });
  },
  'tac.spSet': (d) => { G.team.sp[d.k] = +d.p; closeOverlay(); rerender(); },
  'tac.box': (d) => {
    const sp = G.team.sp;
    const id = +d.k;
    sp.box = sp.box || [];
    if (sp.box.includes(id)) sp.box = sp.box.filter((x) => x !== id);
    else if (sp.box.length < 5) sp.box.push(id);
    else { toast('Maksymalnie 5 zawodników w polu karnym.', 'bad'); return; }
    rerender();
  },
  'tac.help': () => modal({
    title: 'Pomoc: taktyka',
    body: `<p><b>Ustawienie</b>: wybierz formację i obsadź pozycje. Liczba na żetonie to ocena zawodnika na danej pozycji.</p>
      <p><b>Drużyna</b>: styl gry, pressing, gra na czas i pułapki ofsajdowe wpływają na liczbę sytuacji, zmęczenie i ryzyko.</p>
      <p><b>Zawodnicy</b>: polecenia indywidualne, czyli jak często strzelać, dryblować, jakie podania grać i jak ostro odbierać piłkę.</p>
      <p><b>Stałe fragmenty</b>: wykonawcy rzutów karnych, wolnych i rożnych, kapitan oraz zawodnicy wchodzący w pole karne.</p>`,
    buttons: [{ label: 'Rozumiem', a: 'ui.close' }],
  }),
  'tac.oppDetails': (d) => go('opponent', { nid: d.k }),
  'pm.live': (d) => {
    ensureLineup();
    if ((G.team.lineup || []).some((x) => x == null)) { toast('Uzupełnij wyjściową jedenastkę.', 'bad'); return; }
    unlockAudio();
    go('match', { fx: +d.k }, { replace: true });
  },
  'pm.quick': async (d) => {
    const f = G.fixtures.find((x) => x.id === +d.k);
    if (!f || f.res || quickBusy) return;
    ensureLineup();
    quickBusy = true;
    modal({ title: 'Symulacja meczu', body: `<p class="center">${esc(natName(f.h))} vs ${esc(natName(f.a))}</p><p class="center"><b id="qs-min">0'</b> <span id="qs-sc" class="muted"></span></p>`, dismiss: false });
    try {
      const { quickSim } = await import('./match.js');
      await quickSim(f, (m) => {
        const el = document.getElementById('qs-min'); if (el) el.textContent = m.done ? 'Koniec' : m.minLabel();
        const sc = document.getElementById('qs-sc'); if (sc) sc.textContent = `${m.sides[0].goals}:${m.sides[1].goals}`;
      });
    } finally { quickBusy = false; }
    closeOverlay();
    go('postmatch', { fx: f.id }, { replace: true });
  },
});

function instrForm(pid, pos) {
  const ins = getInstr(pid, pos);
  return Object.entries(INSTR).map(([k, def]) => `<div class="field"><span>${def.name}</span><div class="opt">${def.opts.map((o, i) => `<button class="${ins[k] === i ? 'on' : ''}" data-a="tac.instrSet" data-k="${pid}" data-f="${k}" data-v="${i}" data-pos="${pos}">${o}</button>`).join('')}</div><span class="small muted">${def.hint}</span></div>`).join('');
}

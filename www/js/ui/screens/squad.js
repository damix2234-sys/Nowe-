// Kadra, powołania, U-21, profil zawodnika, rozmowy.
import { screen, actions, go, rerender, esc, icon, posBadge, rating, formIcon, chips, seg, toast, sheet, closeOverlay, modal, bar, attrVal, av, flag, stars, empty, current } from '../ui.js';
import { G, me, poolOf, natName, confirmCallup, talkTo, windowAt, trustChange, removeEvent } from '../../engine/game.js';
import { ovr, ovrI, ATTR_NAMES, ATTR_GROUPS, ATTR_HINTS, POS_W, POS_NAMES, POS_GROUP, POS_ORDER, value, CLUB_STATUS, FORM_NAMES, FORM_MUL } from '../../engine/player.js';
import { fullName } from '../../data/names.js';
import { NAT } from '../../data/nations.js';
import { TALKS } from '../../data/press.js';
import { pickSquad } from '../../engine/tactics.js';
import { fmtMoney, fmtDate, clamp, plural } from '../../core/util.js';
import { squadValid, nextEvent } from '../flow.js';

const st = { sort: 'pos', grp: 'all', draft: null, mode: null, q: '' };
const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l');
function matchQ(p) {
  if (!st.q) return true;
  return norm(fullName(p)).includes(norm(st.q.trim()));
}
let lastList = [];

export function squadLimit() {
  const w = windowAt(G.day);
  if (w && w.kind === 'fin') {
    const inFinals = G.compOrder.some((id) => { const c = G.comps[id]; return c && c.type === 'FIN' && c.year === w.y && c.groups.some((g) => g.teams.includes(me())); });
    if (inFinals) return 26;
  }
  const ev = G.queue.find((e) => e.type === 'callup');
  return ev ? ev.size : 23;
}

function sortPlayers(list) {
  const s = st.sort;
  return list.slice().sort((a, b) => {
    if (s === 'ovr') return ovr(b) - ovr(a);
    if (s === 'age') return a.age - b.age || ovr(b) - ovr(a);
    if (s === 'form') return b.form - a.form || ovr(b) - ovr(a);
    return POS_ORDER[a.pos] - POS_ORDER[b.pos] || ovr(b) - ovr(a);
  });
}

function filterGrp(list) {
  return st.grp === 'all' ? list : list.filter((p) => POS_GROUP[p.pos] === st.grp);
}

export function playerRow(p, opts = {}) {
  const club = G.clubs[p.club];
  const status = (p.inj ? `<span class="status st-inj">✚ ${p.inj} d</span>` : '') + (p.susp ? '<span class="status st-sus">zawieszony</span>' : '');
  const toggle = opts.toggle ? `<button class="toggle ${opts.on ? 'on' : ''}" data-a="${opts.toggle}" data-k="${p.id}" aria-label="${opts.on ? 'Usuń' : 'Dodaj'}">${icon(opts.on ? 'check' : 'plus')}</button>` : '';
  const sub = opts.sub || `${p.age} l. · ${esc(club ? club.n : 'bez klubu')} · ${p.caps}/${p.goals}`;
  return `<div class="row tap ${opts.cls || ''}" data-a="pl.open" data-k="${p.id}">
    ${posBadge(p.pos)}
    <div class="main"><div class="t1">${esc(fullName(p))}</div><div class="t2">${sub}</div></div>
    <div class="end">${status}${formIcon(p.form)}${rating(ovr(p))}${toggle}</div>
  </div>`;
}

function controls() {
  return chips('sq.grp', [['all', 'Wszyscy'], ['G', 'Bramkarze'], ['D', 'Obrońcy'], ['M', 'Pomocnicy'], ['A', 'Napastnicy']], st.grp)
    + chips('sq.sort', [['pos', 'Pozycja'], ['ovr', 'Ocena'], ['age', 'Wiek'], ['form', 'Forma']], st.sort);
}

screen('squad', {
  render(params) {
    const mode = params.mode || 'normal';
    const tab = params.tab || 'called';
    if (st.mode !== mode) { st.mode = mode; st.draft = mode === 'callup' ? new Set(G.team.squad) : null; }
    const sel = mode === 'callup' ? st.draft : new Set(G.team.squad);
    const limit = squadLimit();
    const pool = poolOf(me());
    const called = pool.filter((p) => sel.has(p.id));
    const gk = called.filter((p) => p.pos === 'GK').length;
    const rows = squadRows(mode, tab, sel, pool, called);
    const grpCount = (g) => called.filter((p) => POS_GROUP[p.pos] === g).length;
    const summary = `<div class="row-flex wrap small muted mb">
      <span class="tag ${called.length > limit ? 'red' : 'acc'}">${called.length}/${limit}</span>
      <span>BR ${gk}</span><span>OBR ${grpCount('D')}</span><span>POM ${grpCount('M')}</span><span>NAP ${grpCount('A')}</span>
      <span>· kontuzje: ${called.filter((p) => p.inj).length}</span></div>`;
    const foot = mode === 'callup'
      ? `<button class="btn ghost" data-a="sq.auto">${icon('bolt')} Auto</button><button class="btn" data-a="sq.confirm">Ogłoś powołania</button>`
      : '';
    return {
      title: mode === 'callup' ? 'Powołania' : 'Kadra', sub: `${natName(me())} · limit ${limit}`,
      cls: mode === 'callup' ? '' : 'nofoot',
      body: `${seg('sq.tab', [['called', `Powołani (${called.length})`], ['all', `Wszyscy (${pool.length})`]], tab, { mode })}
        ${summary}
        <input class="input mb" id="sq-search" type="search" data-input="sq.search" placeholder="Szukaj zawodnika…" value="${esc(st.q)}" autocomplete="off">
        ${controls()}
        <div class="card tight"><div class="list" id="sq-list">${rows}</div></div>
        ${mode !== 'callup' ? `<p class="small muted center">Zmiany w kadrze obowiązują od razu. Przed każdym zgrupowaniem dostaniesz przypomnienie o powołaniach.</p>` : ''}`,
      foot,
    };
  },
});

function squadRows(mode, tab, sel, pool, called) {
  const base = tab === 'called' ? called : pool;
  const list = sortPlayers(filterGrp(base)).filter(matchQ);
  lastList = list.map((p) => p.id);
  const toggle = mode === 'callup' ? 'sq.toggleDraft' : 'sq.toggle';
  return list.map((p) => playerRow(p, { toggle, on: sel.has(p.id), cls: tab === 'all' && sel.has(p.id) ? 'me' : '' })).join('') || empty(st.q ? 'Brak zawodników pasujących do wyszukiwania.' : 'Brak zawodników.');
}

// ---------------- U-21 ----------------
const u = { tab: 'squad' };
screen('u21', {
  render() {
    const sel = new Set(G.team.u21);
    let body = seg('u21.tab', [['squad', 'Skład'], ['cand', 'Kandydaci'], ['res', 'Mecze']], u.tab);
    if (u.tab === 'res') {
      const res = G.u21res.filter((r) => r.nat === me());
      body += res.length ? `<div class="card tight"><div class="list">${res.map((r) => `<div class="row"><span class="tag">${fmtDate(r.d)}</span>
        <div class="main"><div class="t1">${r.home ? `${esc(natName(me()))} – ${esc(natName(r.opp))}` : `${esc(natName(r.opp))} – ${esc(natName(me()))}`}</div><div class="t2">${r.sc.length ? 'Gole: ' + esc(r.sc.join(', ')) : 'bez goli'}</div></div>
        <b>${r.home ? `${r.gf}:${r.ga}` : `${r.ga}:${r.gf}`}</b></div>`).join('')}</div></div>` : empty('Nie rozegrano jeszcze żadnych meczów. Kadra U-21 gra podczas zgrupowań.');
    } else {
      const pool = poolOf(me()).filter((p) => p.age <= 21);
      let list = u.tab === 'squad' ? pool.filter((p) => sel.has(p.id)) : pool.filter((p) => !sel.has(p.id));
      list = sortPlayers(filterGrp(list));
      lastList = list.map((p) => p.id);
      body += `<p class="small muted">Młodzieżowcy (do 21 lat) rozwijają się szybciej, gdy regularnie grają w kadrze U-21. Zawodnicy powołani do pierwszej reprezentacji nie grają w meczach U-21. Limit: ${G.team.u21.length}/23.</p>`;
      body += controls();
      body += `<div class="card tight"><div class="list">${list.map((p) => playerRow(p, { toggle: 'u21.toggle', on: sel.has(p.id), sub: `${p.age} l. · ${esc(G.clubs[p.club] ? G.clubs[p.club].n : '')} · U-21: ${p.u21 ? p.u21.apps : 0}/${p.u21 ? p.u21.g : 0}${G.team.scouts ? ` · potencjał ${Math.round(p.pot)}` : ''}` })).join('') || empty('Brak zawodników.')}</div></div>`;
    }
    return { title: 'Kadra U-21', sub: natName(me()), cls: 'nofoot', body };
  },
});

// ---------------- profil zawodnika ----------------
function potentialText(p) {
  const o = ovr(p);
  if (p.age >= 27) return 'osiągnięty';
  if (!G.team || !G.team.scouts) return '? (skauci)';
  const gap = p.pot - o;
  return `${Math.round(p.pot)} ${gap >= 10 ? '🔥' : gap >= 5 ? '↗' : ''}`;
}

function formEffect(p) {
  const m = FORM_MUL[p.form] ?? 1;
  if (m === 1) return '';
  const pct = Math.round((m - 1) * 100);
  return ` <span class="${pct > 0 ? 'good-t' : 'bad-t'}">(${pct > 0 ? '+' : ''}${pct}% w meczu)</span>`;
}

function attrGroups(p) {
  const key = POS_W[p.pos];
  const gk = p.pos === 'GK';
  return ATTR_GROUPS.map(([name, keys]) => {
    // umiejętności bramkarskie pokazujemy bramkarzom; zawodnikom z pola tylko jako mały dopisek
    if (name === 'Bramkarskie' && !gk) return '';
    const rows = keys.map((k) => {
      const v = p.a[k] ?? 0;
      return `<div class="attr ${key[k] ? 'key' : ''}" title="${ATTR_HINTS[k]}"><span>${key[k] ? '★ ' : ''}${ATTR_NAMES[k]}</span>${attrVal(v)}${bar(v, v >= 66 ? 'good' : v >= 45 ? 'mid' : 'low')}</div>`;
    }).join('');
    return `<div class="attr-group"><div class="label">${name}</div>${rows}</div>`;
  }).join('');
}

screen('player', {
  render({ pid }) {
    const p = G.players[pid];
    if (!p) return { title: 'Zawodnik', body: empty('Zawodnik nie jest już dostępny.'), cls: 'nofoot' };
    const mine = me() && p.nat === me();
    const club = G.clubs[p.club];
    const idx = lastList.indexOf(+pid);
    const nav = idx >= 0 ? `<button class="iconbtn" data-a="pl.nav" data-k="${idx - 1}" ${idx <= 0 ? 'disabled' : ''}>${icon('left')}</button><button class="iconbtn" data-a="pl.nav" data-k="${idx + 1}" ${idx >= lastList.length - 1 ? 'disabled' : ''}>${icon('right')}</button>` : '';
    const s = p.s || null;
    const fact = (k, v) => `<div class="fact"><div class="k">${k}</div><div class="v">${v}</div></div>`;
    const inSquad = mine && G.team.squad.includes(p.id);
    const inU21 = mine && G.team.u21.includes(p.id);
    const statusLine = p.inj ? `<div class="note mt">✚ Kontuzja – przerwa jeszcze ${p.inj} ${plural(p.inj, 'dzień', 'dni', 'dni')}.</div>` : p.susp ? '<div class="note mt">Zawieszony na najbliższy mecz.</div>' : '';
    const body = `
      <div class="card"><div class="pl-head">${av(p.id * 7 + 3, { shirt: '#c6f432' }).replace('class="avatar"', 'class="avatar lg"')}
        <div class="grow"><div class="big">${esc(fullName(p))}</div><div class="muted small">${flag(p.nat)} ${esc(natName(p.nat))} · ${POS_NAMES[p.pos]}</div>
        <div class="row-flex mt">${posBadge(p.pos)}${p.alt.map(posBadge).join('')}<span class="grow"></span>${rating(ovr(p), 'big-r')}</div></div></div>
        ${statusLine}
      </div>
      <div class="facts mb">
        ${fact('Wiek', `${p.age} lat`)}
        ${fact('Występy / gole', `${p.caps} / ${p.goals}`)}
        ${fact('Klub', esc(club ? club.n : 'bez klubu'))}
        ${fact('Status w klubie', CLUB_STATUS[p.cst])}
        ${fact('Wartość', fmtMoney(value(p)))}
        ${fact('Potencjał', potentialText(p))}
        ${fact('Forma', `${formIcon(p.form)} ${FORM_NAMES[p.form + 2]}${formEffect(p)}`)}
        ${fact('Świeżość', `${Math.round(p.cond)}%`)}
      </div>
      <div class="card"><div class="card-h"><h3>Morale</h3><b>${Math.round(p.mor)}</b></div>${bar(p.mor)}</div>
      <div class="card"><div class="card-h"><h3>Umiejętności</h3><span class="big-ovr">${ovrI(p)}</span></div>
        <div class="small muted mb">★ – kluczowe na pozycji ${POS_NAMES[p.pos].toLowerCase()}</div>
        ${attrGroups(p)}
      </div>
      ${s && s.apps ? `<div class="card"><div class="card-h"><h3>Pod Twoją wodzą</h3></div><div class="facts">
        ${fact('Mecze', s.apps)}${fact('Gole / asysty', `${s.g} / ${s.a}`)}${fact('Średnia ocena', (s.rs / s.apps).toFixed(2))}${fact('Zawodnik meczu', s.mom)}${fact('Kartki ż/cz', `${s.yc} / ${s.rc}`)}${fact('Minuty', s.min)}
      </div></div>` : ''}
      ${p.u21 && p.u21.apps ? `<div class="card"><div class="card-h"><h3>Kadra U-21</h3></div><div class="small">${p.u21.apps} meczów, ${p.u21.g} goli</div></div>` : ''}`;
    const foot = mine ? `<button class="btn ghost" data-a="pl.talk" data-k="${p.id}">${icon('mic')} Rozmowa</button>
      <button class="btn ${inSquad ? 'danger' : ''}" data-a="pl.squad" data-k="${p.id}">${inSquad ? 'Usuń z kadry' : 'Powołaj'}</button>
      ${p.age <= 21 ? `<button class="btn ghost" data-a="pl.u21" data-k="${p.id}">${inU21 ? '− U-21' : '+ U-21'}</button>` : ''}` : '';
    return { title: fullName(p), sub: `${p.pos} · ${p.age} l.`, right: nav, body, foot, cls: mine ? '' : 'nofoot' };
  },
});

function toggleSquad(pid) {
  const t = G.team;
  const p = G.players[pid];
  const i = t.squad.indexOf(pid);
  if (i >= 0) {
    t.squad.splice(i, 1);
    p.mor = clamp(p.mor - (p.caps > 30 ? 8 : 4), 0, 100);
    if (p.caps > 40) trustChange({ pl: -1 });
    if (t.lineup) t.lineup = t.lineup.map((x) => (x === pid ? null : x));
    if (t.bench) t.bench = t.bench.filter((x) => x !== pid);
    toast(`${esc(fullName(p))} – usunięty z kadry.`);
  } else {
    if (t.squad.length >= squadLimit()) { toast(`Limit kadry to ${squadLimit()} zawodników.`, 'bad'); return; }
    t.squad.push(pid);
    p.mor = clamp(p.mor + 5, 0, 100);
    toast(`${esc(fullName(p))} – powołany.`, 'good');
  }
  G.nats[me()].squad = t.squad.slice();
}

actions({
  'sq.tab': (d) => go('squad', { mode: d.mode || 'normal', tab: d.k }, { replace: true }),
  'sq.grp': (d) => { st.grp = d.k; rerender(); },
  'sq.search': (d, el) => {
    st.q = el.value;
    const cur = current();
    const params = (cur && cur.params) || {};
    const mode = params.mode || 'normal';
    const tab = params.tab || 'called';
    const sel = mode === 'callup' ? st.draft : new Set(G.team.squad);
    const pool = poolOf(me());
    const listEl = document.getElementById('sq-list');
    if (listEl) listEl.innerHTML = squadRows(mode, tab, sel, pool, pool.filter((p) => sel.has(p.id)));
  },
  'sq.sort': (d) => { st.sort = d.k; rerender(); },
  'sq.toggle': (d) => { toggleSquad(+d.k); rerender(); },
  'sq.toggleDraft': (d) => {
    const id = +d.k;
    if (st.draft.has(id)) st.draft.delete(id);
    else {
      if (st.draft.size >= squadLimit()) { toast(`Limit to ${squadLimit()} zawodników.`, 'bad'); return; }
      st.draft.add(id);
    }
    rerender();
  },
  'sq.auto': () => {
    st.draft = new Set(pickSquad(poolOf(me()), squadLimit()));
    toast('Asystent przygotował listę powołań.', 'good');
    rerender();
  },
  'sq.confirm': () => {
    const ids = [...st.draft];
    const err = squadValid(ids, squadLimit());
    if (err) { toast(err, 'bad'); return; }
    const ev = G.queue.find((e) => e.type === 'callup');
    confirmCallup(ev || null, ids);
    st.mode = null;
    toast('Powołania ogłoszone!', 'good');
    nextEvent();
  },
  'u21.tab': (d) => { u.tab = d.k; rerender(); },
  'u21.toggle': (d) => {
    const id = +d.k;
    const t = G.team;
    const i = t.u21.indexOf(id);
    if (i >= 0) t.u21.splice(i, 1);
    else { if (t.u21.length >= 23) { toast('Limit kadry U-21 to 23 zawodników.', 'bad'); return; } t.u21.push(id); }
    rerender();
  },
  'pl.open': (d) => go('player', { pid: +d.k }),
  'pl.nav': (d) => { const id = lastList[+d.k]; if (id) go('player', { pid: id }, { replace: true }); },
  'pl.squad': (d) => { toggleSquad(+d.k); rerender(); },
  'pl.u21': (d) => {
    const id = +d.k;
    const t = G.team;
    const i = t.u21.indexOf(id);
    if (i >= 0) t.u21.splice(i, 1); else if (t.u21.length < 23) t.u21.push(id); else toast('Limit kadry U-21 to 23.', 'bad');
    rerender();
  },
  'pl.talk': (d) => {
    const p = G.players[+d.k];
    sheet(`<p class="small muted">O czym chcesz porozmawiać z zawodnikiem (${esc(fullName(p))})?</p>
      ${TALKS.map((t) => `<button class="ans" data-a="pl.talkDo" data-k="${p.id}" data-t="${t.id}">${t.t}</button>`).join('')}`, { title: 'Rozmowa indywidualna' });
  },
  'pl.talkDo': (d) => {
    closeOverlay();
    const r = talkTo(+d.k, d.t);
    setTimeout(() => modal({
      title: 'Rozmowa',
      body: `<p>${esc(r.text)}</p>${r.ok ? `<p class="small muted">Morale: ${r.dm >= 0 ? '+' : ''}${r.dm}</p>` : ''}`,
      buttons: [{ label: 'OK', a: 'ui.close' }],
      onClose: () => rerender(),
    }), 200);
  },
});

export { lastList };
export function setLastList(l) { lastList = l; }

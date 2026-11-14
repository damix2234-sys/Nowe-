// Trening, federacja, oferty, statystyki, osiągnięcia, ustawienia, zapis gry, edytor.
import { screen, actions, go, reset, rerender, esc, icon, posBadge, rating, flag, seg, chips, bar, toast, sheet, closeOverlay, modal, av, resChip, matchRating, natStars, empty, confirmBox, busy } from '../ui.js';
import { TRAIN_MAX, TRAIN_MIN, trainPct, monthlyGain, TRAIN_ATTR_LIST } from '../../engine/training.js';
import { G, me, natName, TRAIN_KEYS, TRAIN_NAMES, TRAIN_BUDGET, setTraining, REQUESTS, requestState, makeRequest, resign, acceptOffer, declineOffer, trustLabel } from '../../engine/game.js';
import { NAT, NATIONS, CONFS, CONF_ORDER } from '../../data/nations.js';
import { ACHIEVEMENTS } from '../../data/achievements.js';
import { fullName } from '../../data/names.js';
import { ovr, POSITIONS, POS_ORDER, POS_NAMES } from '../../engine/player.js';
import { generateWorld, DEFAULT_SEED } from '../../engine/db.js';
import { getSettings, setSettings, getAchievements, getEdits, setEdits, SLOTS, slotMeta } from '../../core/storage.js';
import { saveGame } from '../session.js';
import { fmtDate, fmtDateLong, hashStr, clamp } from '../../core/util.js';
import { rankPositions } from '../../engine/ranking.js';
import { nextEvent } from '../flow.js';
import { invalidateMetas } from './menu.js';
import { senderAvatar } from './home.js';
import { setLastList } from './squad.js';

// ---------------- trening ----------------
const TRAIN_DESC = {
  cond: 'Siła, szybkość i wytrzymałość. Wolniejsze męczenie się w meczu i mniej kontuzji.',
  poss: 'Podania, przyjęcie, technika i decyzje. Dokładniejsze rozegranie.',
  sp: 'Rożne, wolne, karne, wrzuty z autu i gra głową.',
  off: 'Wykończenie, strzały z dystansu, drybling, dośrodkowania i gra bez piłki.',
  def: 'Odbiór, krycie, ustawianie się, przewidywanie i pressing.',
  ment: 'Opanowanie, koncentracja, determinacja i przywództwo.',
  gk: 'Wszystkie umiejętności bramkarskie. Działa tylko na bramkarzy.',
};

function trainEffect(pts) {
  const pct = trainPct(pts);
  const g = monthlyGain(pts);
  const m = pct > 0 ? `<span class="good-t">+${pct}% w meczu</span>` : pct < 0 ? `<span class="bad-t">${pct}% w meczu</span>` : '<span class="muted">bez bonusu w meczu</span>';
  const d = g > 0 ? `<span class="good-t">+${g.toFixed(2).replace('.', ',')} pkt co miesiąc</span>` : g < 0 ? `<span class="bad-t">${g.toFixed(2).replace('.', ',')} pkt co miesiąc</span>` : '<span class="muted">atrybuty bez zmian</span>';
  return `${m} · ${d}`;
}

screen('training', {
  render() {
    const t = G.team.train;
    const used = TRAIN_KEYS.reduce((s, k) => s + t.alloc[k], 0);
    const asst = G.staff ? G.staff.assistant : null;
    const body = `<div class="card speech">${av(asst ? hashStr(asst.ln + 'a') : 1, { shirt: '#3d7bff' })}<div class="txt">Masz ${TRAIN_BUDGET} punktów do rozdzielenia, maksymalnie ${TRAIN_MAX} na kategorię. Każdy punkt powyżej ${TRAIN_MIN} wzmacnia atrybuty z tej kategorii w meczu o 2% i co miesiąc dodaje zawodnikom kadry punkty, najwięcej w atrybutach kluczowych dla ich pozycji. Poniżej ${TRAIN_MIN} punktów kategoria jest zaniedbana: atrybuty działają w meczu słabiej i co miesiąc trochę spadają.</div></div>
      <div class="card"><div class="card-h"><h3>Plan treningowy</h3><span class="tag ${used >= TRAIN_BUDGET ? 'acc' : 'gold'}">${used}/${TRAIN_BUDGET} pkt</span></div>
      ${TRAIN_KEYS.map((k) => `<div class="train-row ${t.alloc[k] < TRAIN_MIN ? 'low' : ''}"><div class="top"><div class="grow"><b>${TRAIN_NAMES[k]}</b><div class="small muted">${TRAIN_DESC[k]}</div></div>
        <button class="stepper" data-a="tr.step" data-k="${k}" data-v="-1" aria-label="Mniej">${icon('minus')}</button><span class="val">${t.alloc[k]}</span><button class="stepper" data-a="tr.step" data-k="${k}" data-v="1" aria-label="Więcej">${icon('plus')}</button></div>
        <div class="small mt">${trainEffect(t.alloc[k])}</div>
        <div class="train-attrs">${TRAIN_ATTR_LIST(k).map((n) => `<span>${n}</span>`).join('')}</div></div>`).join('')}
      </div>
      <p class="small muted center">Trening działa na zawodników powołanych do kadry i U-21. Pełne wyjaśnienie znajdziesz w Poradniku.</p>
      <button class="btn ghost block mb" data-a="guide.open" data-k="training">${icon('help')} Poradnik: trening</button>`;
    return { title: 'Trening', sub: 'Plan treningowy kadry', cls: 'nofoot', body };
  },
});

// ---------------- federacja ----------------
screen('federation', {
  render() {
    const pres = G.staff.president;
    const t = G.trust;
    const row = (k, label) => `<div class="trust-row"><span>${label}</span>${bar(t[k])}<b>${Math.round(t[k])}</b></div><div class="small muted" style="margin:-2px 0 6px 96px">${trustLabel(t[k])}</div>`;
    const objs = G.objectives.filter((o) => o.nat === me()).slice().reverse();
    const body = `<div class="card"><div class="pl-head">${senderAvatar('president').replace('class="avatar"', 'class="avatar lg"')}<div class="grow"><div class="label">Prezes federacji</div><div class="big">${esc(fullName(pres))}</div><div class="small muted">${flag(me())} ${esc(natName(me()))}</div></div></div></div>
      <div class="card"><div class="card-h"><h3>Zaufanie</h3></div>${row('fed', 'Federacja')}${row('fans', 'Kibice')}${row('pl', 'Piłkarze')}${row('media', 'Media')}
        <p class="small muted mt">Zbyt niskie zaufanie federacji oznacza zwolnienie. Kibice reagują na wyniki i styl gry, piłkarze na powołania i Twoje słowa, a media na konferencje prasowe.</p></div>
      <div class="facts mb"><div class="fact"><div class="k">Kontrakt do</div><div class="v">${fmtDate(G.user.contractEnd)}</div></div><div class="fact"><div class="k">Reputacja</div><div class="v">${Math.round(G.user.rep)} / 100</div></div></div>
      <div class="card"><div class="card-h"><h3>Cele</h3></div>${objs.length ? objs.map((o) => `<div class="row"><span class="tag ${o.status === 'ok' ? 'acc' : o.status === 'fail' ? 'red' : 'gold'}">${o.status === 'ok' ? '✓' : o.status === 'fail' ? '✗' : '…'}</span><div class="main"><div class="t1 wrap">${esc(o.text)}</div><div class="t2">${esc(o.cname)}</div></div></div>`).join('') : '<div class="small muted">Brak celów.</div>'}</div>
      <div class="card"><div class="card-h"><h3>Prośby do zarządu</h3></div>${REQUESTS.map((r) => {
        const st = requestState(r.id);
        const btn = st.done ? '<span class="tag acc">zrealizowano</span>' : st.wait ? `<span class="tag">za ${st.wait} dni</span>` : `<button class="btn small" data-a="fed.req" data-k="${r.id}">Poproś</button>`;
        return `<div class="row"><div class="main"><div class="t1">${r.name}</div><div class="t2" style="white-space:normal">${r.desc}</div></div>${btn}</div>`;
      }).join('')}</div>
      <button class="btn danger block" data-a="fed.resign">Podaj się do dymisji</button>`;
    return { title: 'Federacja', cls: 'nofoot', body };
  },
});

// ---------------- oferty ----------------
screen('offers', {
  render() {
    const offers = G.offers.filter((o) => o.until >= G.day);
    const pos = rankPositions(G);
    const body = `<div class="note mb">Reputacja: <b>${Math.round(G.user.rep)}</b>/100. Wyższa reputacja przyciąga oferty od silniejszych reprezentacji. Oferty pojawiają się, gdy federacje zwalniają selekcjonerów.</div>
      ${offers.length ? `<div class="card tight"><div class="list">${offers.map((o) => `<div class="row"><span class="flag" style="font-size:30px">${NAT[o.nat].flag}</span><div class="main"><div class="t1">${esc(natName(o.nat))}</div><div class="t2">${pos[o.nat]}. w rankingu · ważna do ${fmtDate(o.until)}</div><div>${natStars(o.nat)}</div></div>
        <div class="row-flex" style="flex-direction:column;gap:6px"><button class="btn small" data-a="of.yes" data-k="${o.nat}">Przyjmij</button><button class="btn small ghost" data-a="of.no" data-k="${o.nat}">Odrzuć</button></div></div>`).join('')}</div></div>` : empty('Obecnie nie masz żadnych ofert pracy.')}`;
    return { title: 'Oferty pracy', cls: 'nofoot', body };
  },
});

// ---------------- statystyki ----------------
const stt = { tab: 'career', sort: 'apps' };
screen('stats', {
  render() {
    let body = seg('st.tab', [['career', 'Kariera'], ['players', 'Zawodnicy'], ['matches', 'Mecze']], stt.tab);
    const s = G.stats;
    if (stt.tab === 'career') {
      const pct = s.m ? Math.round((s.w / s.m) * 100) : 0;
      const fact = (k, v) => `<div class="fact"><div class="k">${k}</div><div class="v">${v}</div></div>`;
      body += `<div class="facts mb">${fact('Mecze', s.m)}${fact('Bilans Z-R-P', `${s.w}-${s.d}-${s.l}`)}${fact('Bramki', `${s.gf}:${s.ga}`)}${fact('Skuteczność', pct + '%')}${fact('Seria bez porażki', `${s.unb}, rekord ${s.maxUnb}`)}${fact('Seria zwycięstw', `${s.ws}, rekord ${s.maxWs}`)}
        ${fact('Najwyższe zwycięstwo', s.best ? `${s.best.gf}:${s.best.ga}, ${esc(natName(s.best.opp))}` : '')}${fact('Najwyższa porażka', s.worst ? `${s.worst.gf}:${s.worst.ga}, ${esc(natName(s.worst.opp))}` : '')}</div>
        <div class="card"><div class="card-h"><h3>Trofea</h3></div>${G.user.trophies.length ? G.user.trophies.map((t) => `<div class="row"><span style="font-size:22px">🏆</span><div class="main"><div class="t1">${esc(t.name)}</div><div class="t2">${flag(t.nat)} ${esc(natName(t.nat))}</div></div></div>`).join('') : '<div class="small muted">Jeszcze bez trofeów, czas to zmienić!</div>'}</div>
        <div class="card"><div class="card-h"><h3>Przebieg kariery</h3></div>${G.user.spells.slice().reverse().map((sp) => `<div class="row"><span class="flag" style="font-size:24px">${NAT[sp.nat].flag}</span><div class="main"><div class="t1">${esc(natName(sp.nat))}</div><div class="t2">${fmtDate(sp.from)} vs ${sp.to ? fmtDate(sp.to) : 'obecnie'}</div></div><span class="small">${sp.m} m · ${sp.w}-${sp.d}-${sp.l}</span></div>`).join('')}</div>`;
    } else if (stt.tab === 'players') {
      const list = Object.values(G.players).filter((p) => p.s && p.s.apps);
      const key = { apps: (p) => p.s.apps, g: (p) => p.s.g, a: (p) => p.s.a, avg: (p) => p.s.rs / p.s.apps, mom: (p) => p.s.mom }[stt.sort];
      list.sort((a, b) => key(b) - key(a));
      setLastList(list.map((p) => p.id));
      body += chips('st.sort', [['apps', 'Mecze'], ['g', 'Gole'], ['a', 'Asysty'], ['avg', 'Średnia'], ['mom', 'MVP']], stt.sort);
      body += list.length ? `<div class="card tight"><table class="tbl"><thead><tr><th class="tl">Zawodnik</th><th>M</th><th>G</th><th>A</th><th>Śr.</th><th>MVP</th></tr></thead><tbody>${list.slice(0, 60).map((p) => `<tr data-a="pl.open" data-k="${p.id}"><td class="tl">${posBadge(p.pos)} <span class="tn">${esc(p.ln)}</span></td><td>${p.s.apps}</td><td>${p.s.g}</td><td>${p.s.a}</td><td>${(p.s.rs / p.s.apps).toFixed(2)}</td><td>${p.s.mom}</td></tr>`).join('')}</tbody></table></div>` : empty('Brak rozegranych meczów.');
    } else {
      const h = G.history.slice().reverse();
      body += h.length ? `<div class="card tight"><div class="list">${h.slice(0, 120).map((x, i) => `<div class="row tap" data-a="st.match" data-k="${G.history.length - 1 - i}"><span class="tag">${fmtDate(x.d)}</span><div class="main"><div class="t1">${flag(x.home ? x.nat : x.opp)} ${esc(natName(x.home ? x.nat : x.opp))} vs ${esc(natName(x.home ? x.opp : x.nat))} ${flag(x.home ? x.opp : x.nat)}</div><div class="t2">${esc(x.cs)} · ${esc(x.stage)}</div></div><b>${x.home ? `${x.gf}:${x.ga}` : `${x.ga}:${x.gf}`}</b>${resChip(x.res)}</div>`).join('')}</div></div>` : empty('Brak rozegranych meczów.');
    }
    return { title: 'Statystyki', cls: 'nofoot', body };
  },
});

// ---------------- osiągnięcia ----------------
screen('achievements', {
  render() {
    const got = getAchievements();
    const n = ACHIEVEMENTS.filter((a) => got[a.id]).length;
    const body = `<div class="note mb">Zdobyto ${n} z ${ACHIEVEMENTS.length} osiągnięć. Osiągnięcia zapisują się na tym urządzeniu i obejmują wszystkie kariery.</div>
      <div class="card">${ACHIEVEMENTS.map((a) => `<div class="ach ${got[a.id] ? '' : 'lock'}"><span class="em">${a.icon}</span><div class="grow"><b>${a.name}</b><div class="small muted">${a.desc}</div>${got[a.id] ? `<div class="small" style="color:var(--accent)">zdobyte ${new Date(got[a.id]).toLocaleDateString('pl-PL')}</div>` : ''}</div></div>`).join('')}</div>`;
    return { title: 'Osiągnięcia', sub: `${n}/${ACHIEVEMENTS.length}`, cls: 'nofoot', body };
  },
});

// ---------------- ustawienia ----------------
screen('settings', {
  render() {
    const s = getSettings();
    const sw = (k, label, desc) => `<div class="switch" data-a="set.toggle" data-k="${k}"><div><b>${label}</b><div class="small muted">${desc}</div></div><span class="sw ${s[k] ? 'on' : ''}"></span></div>`;
    const body = `<div class="card"><div class="card-h"><h3>Mecz</h3></div><div class="field"><span>Domyślna prędkość relacji</span><div class="opt">${['½×', '1×', '2×', '4×'].map((l, i) => `<button class="${s.speed === i ? 'on' : ''}" data-a="set.speed" data-k="${i}">${l}</button>`).join('')}</div></div>
      ${sw('sound', 'Dźwięki meczu', 'Gwizdek sędziego i reakcje kibiców.')}
      ${sw('vibrate', 'Wibracje', 'Krótka wibracja przy golu.')}</div>
      <div class="card"><div class="card-h"><h3>Gra</h3></div>${sw('autosave', 'Autozapis', 'Zapis automatyczny przed meczami i po wydarzeniach.')}</div>
      <div class="card"><button class="btn ghost block" data-a="go" data-k="about">${icon('info')} O grze</button></div>`;
    return { title: 'Ustawienia', cls: 'nofoot', body };
  },
});

// ---------------- zapis gry ----------------
let saveMetas = null;
screen('save', {
  render() {
    if (!saveMetas) {
      Promise.all(SLOTS.map((s) => slotMeta(s))).then((arr) => { saveMetas = Object.fromEntries(SLOTS.map((s, i) => [s, arr[i]])); rerender(); });
      return { title: 'Zapisz grę', body: '<div class="empty">Wczytywanie…</div>', cls: 'nofoot' };
    }
    const body = `<div class="card tight"><div class="list">${SLOTS.filter((s) => s !== 'auto').map((s) => {
      const m = saveMetas[s];
      const nat = m ? m.nat || m.lastNat : null;
      return `<div class="row tap" data-a="sv.slot" data-k="${s}"><span class="flag" style="font-size:26px">${nat ? NAT[nat].flag : '💾'}</span><div class="main"><div class="t1">Slot ${s}</div><div class="t2">${m ? `${esc(m.manager)} · ${fmtDateLong(m.day)}` : 'pusty'}</div></div><span class="btn small">Zapisz</span></div>`;
    }).join('')}</div></div>
    <p class="small muted center">Autozapis wykonywany jest automatycznie, można go wczytać z menu głównego.</p>`;
    return { title: 'Zapisz grę', cls: 'nofoot', body };
  },
});

// ---------------- edytor ----------------
let edWorld = null;
const ed = { conf: 'EU' };
function world() {
  if (!edWorld) edWorld = generateWorld(DEFAULT_SEED);
  return edWorld;
}
function edView(p, edits) {
  const o = edits[p.id] || {};
  return { fn: o.fn ?? p.fn, ln: o.ln ?? p.ln, age: o.age ?? p.age, pos: o.pos ?? p.pos, ovr: o.ovr ?? Math.round(ovr(p)), ord: p.ord, edited: !!edits[p.id] };
}

screen('editor', {
  render() {
    const edits = getEdits();
    const list = NATIONS.filter((n) => n.conf === ed.conf).sort((a, b) => a.name.localeCompare(b.name, 'pl'));
    const body = `<div class="note mb">Edytuj imiona, nazwiska, wiek, pozycję i umiejętności zawodników domyślnej bazy. Zmiany obowiązują w nowych grach z opcją „Domyślna baza”. Edycji: <b>${Object.keys(edits).length}</b>.</div>
      <div class="btnrow mb"><button class="btn small ghost" data-a="ed.export">${icon('upload')} Eksport</button><button class="btn small ghost" data-a="ed.import">${icon('download')} Import</button><button class="btn small danger" data-a="ed.clear">${icon('trash')} Wyczyść</button></div>
      ${chips('ed.conf', CONF_ORDER.map((c) => [c, CONFS[c].name]), ed.conf)}
      <div class="card tight"><div class="list">${list.map((n) => `<div class="row tap" data-a="ed.nat" data-k="${n.id}"><span class="flag" style="font-size:26px">${n.flag}</span><div class="main"><div class="t1">${esc(n.name)}</div></div>${icon('right')}</div>`).join('')}</div></div>`;
    return { title: 'Edytor zawodników', cls: 'nofoot', body };
  },
});

screen('editorNat', {
  render({ nid }) {
    busy(false);
    const w = world();
    const edits = getEdits();
    const players = w.nats[nid].pool.map((id) => w.players[id]).sort((a, b) => POS_ORDER[a.pos] - POS_ORDER[b.pos] || ovr(b) - ovr(a));
    const body = `<div class="card tight"><div class="list">${players.map((p) => {
      const v = edView(p, edits);
      const name = v.ord === 'fl' ? `${v.ln} ${v.fn}` : `${v.fn} ${v.ln}`.trim();
      return `<div class="row tap" data-a="ed.player" data-k="${p.id}" data-n="${nid}">${posBadge(v.pos)}<div class="main"><div class="t1">${esc(name)} ${v.edited ? '<span class="tag acc">edytowany</span>' : ''}</div><div class="t2">${v.age} l.</div></div>${rating(v.ovr)}</div>`;
    }).join('')}</div></div>`;
    return { title: NAT[nid].name, sub: 'Edytor, domyślna baza', cls: 'nofoot', body };
  },
});

function editForm(p, nid) {
  const v = edView(p, getEdits());
  return `<label class="field"><span>Imię</span><input class="input" id="ed-fn" value="${esc(v.fn)}" maxlength="30"></label>
    <label class="field"><span>Nazwisko</span><input class="input" id="ed-ln" value="${esc(v.ln)}" maxlength="30"></label>
    <div class="btnrow"><label class="field grow"><span>Wiek</span><input class="input" id="ed-age" type="number" min="15" max="45" value="${v.age}"></label>
    <label class="field grow"><span>Ocena ogólna</span><input class="input" id="ed-ovr" type="number" min="20" max="99" value="${v.ovr}"></label></div>
    <label class="field"><span>Pozycja</span><select class="input" id="ed-pos">${POSITIONS.map((x) => `<option value="${x}" ${x === v.pos ? 'selected' : ''}>${x}: ${POS_NAMES[x]}</option>`).join('')}</select></label>
    <div class="btnrow"><button class="btn ghost" data-a="ed.reset" data-k="${p.id}" data-n="${nid}">Przywróć</button><button class="btn" data-a="ed.save" data-k="${p.id}" data-n="${nid}">Zapisz</button></div>`;
}

actions({
  'tr.step': (d) => {
    if (!setTraining(d.k, +d.v)) toast(`Masz do rozdzielenia ${TRAIN_BUDGET} punktów.`, 'bad');
    rerender();
  },
  'fed.req': (d) => {
    const r = makeRequest(d.k);
    toast(esc(r.msg), r.ok ? 'good' : 'bad');
    rerender();
  },
  'fed.resign': async () => {
    const ok = await confirmBox('Czy na pewno chcesz zrezygnować z prowadzenia reprezentacji? Twoja reputacja nieco ucierpi.', 'Rezygnuję', 'Anuluj', true);
    if (!ok) return;
    resign();
    reset('home');
  },
  'of.yes': async (d) => {
    if (me()) {
      const ok = await confirmBox(`Objąć reprezentację (${esc(natName(d.k))})? Opuścisz obecną kadrę.`, 'Przyjmuję');
      if (!ok) return;
    }
    acceptOffer(d.k);
    toast(`Nowa praca: ${esc(natName(d.k))}!`, 'good');
    reset('home');
    nextEvent();
  },
  'of.no': (d) => { declineOffer(d.k); rerender(); },
  'st.tab': (d) => { stt.tab = d.k; rerender(); },
  'st.sort': (d) => { stt.sort = d.k; rerender(); },
  'st.match': (d) => {
    const x = G.history[+d.k];
    if (!x) return;
    const hsc = x.sc.filter((s) => (x.home ? s.own : !s.own)), asc = x.sc.filter((s) => (x.home ? !s.own : s.own));
    const l = (arr) => arr.map((s) => `${esc(s.n)} ${s.m}${s.pen ? ' karny' : ''}${s.og ? ' samobój' : ''}`).join('<br>') || '';
    const hn = x.home ? x.nat : x.opp, an = x.home ? x.opp : x.nat;
    modal({
      title: `${esc(natName(hn))} ${x.home ? x.gf : x.ga}:${x.home ? x.ga : x.gf} ${esc(natName(an))}`,
      body: `<p class="small muted">${esc(x.comp)} · ${esc(x.stage)} · ${fmtDateLong(x.d)}${x.et ? ' · po dogrywce' : ''}${x.pens ? ` · karne ${x.home ? x.pens[0] : x.pens[1]}:${x.home ? x.pens[1] : x.pens[0]}` : ''}</p>
        <div class="lineups"><div class="sc-list">${l(hsc)}</div><div class="sc-list" style="text-align:right">${l(asc)}</div></div>
        ${x.motm ? `<p class="small muted mt">⭐ ${esc(x.motm.n)}</p>` : ''}${x.att ? `<p class="small muted">Widzów: ${x.att.toLocaleString('pl-PL')}</p>` : ''}`,
      buttons: [{ label: 'Zamknij', cls: 'ghost', a: 'ui.close' }],
    });
  },
  'set.toggle': (d) => { const s = getSettings(); s[d.k] = !s[d.k]; setSettings(s); rerender(); },
  'set.speed': (d) => { const s = getSettings(); s.speed = +d.k; setSettings(s); rerender(); },
  'sv.slot': async (d) => {
    if (saveMetas && saveMetas[d.k]) {
      const ok = await confirmBox(`Nadpisać zapis w slocie ${d.k}?`, 'Nadpisz');
      if (!ok) return;
    }
    busy(true, 'Zapisywanie…');
    const ok = await saveGame(d.k);
    busy(false);
    saveMetas = null;
    invalidateMetas();
    toast(ok ? `Zapisano w slocie ${d.k}.` : 'Zapis nie powiódł się, być może brak miejsca.', ok ? 'good' : 'bad');
    rerender();
  },
  'ed.conf': (d) => { ed.conf = d.k; rerender(); },
  'ed.nat': (d) => { if (!edWorld) busy(true, 'Wczytywanie bazy…'); setTimeout(() => go('editorNat', { nid: d.k }), 30); },
  'ed.player': (d) => {
    const p = world().players[+d.k];
    sheet(editForm(p, d.n), { title: 'Edycja zawodnika' });
  },
  'ed.save': (d) => {
    const p = world().players[+d.k];
    const val = (id) => document.getElementById(id).value;
    const edits = getEdits();
    const o = {};
    const fn = val('ed-fn').trim(), ln = val('ed-ln').trim();
    if (!ln) { toast('Nazwisko nie może być puste.', 'bad'); return; }
    if (fn !== p.fn) o.fn = fn;
    if (ln !== p.ln) o.ln = ln;
    const age = clamp(+val('ed-age') || p.age, 15, 45);
    if (age !== p.age) o.age = age;
    const pos = val('ed-pos');
    if (pos !== p.pos) o.pos = pos;
    const ov = clamp(+val('ed-ovr') || Math.round(ovr(p)), 20, 99);
    if (ov !== Math.round(ovr(p))) o.ovr = ov;
    if (Object.keys(o).length) edits[p.id] = o; else delete edits[p.id];
    setEdits(edits);
    closeOverlay();
    toast('Zapisano zmiany w bazie.', 'good');
    rerender();
  },
  'ed.reset': (d) => {
    const edits = getEdits();
    delete edits[+d.k];
    setEdits(edits);
    closeOverlay();
    rerender();
  },
  'ed.export': () => {
    const txt = JSON.stringify(getEdits());
    modal({
      title: 'Eksport edycji', body: `<p class="small muted">Skopiuj poniższy tekst, aby przenieść edycje na inne urządzenie lub podzielić się nimi.</p><textarea class="input" id="ed-exp" readonly>${esc(txt)}</textarea>`,
      buttons: [{ label: 'Zamknij', cls: 'ghost', a: 'ui.close' }, { label: 'Kopiuj', a: 'ed.copy' }],
    });
  },
  'ed.copy': async () => {
    const el = document.getElementById('ed-exp');
    try { await navigator.clipboard.writeText(el.value); toast('Skopiowano.', 'good'); } catch (e) { el.select(); toast('Zaznacz tekst i skopiuj ręcznie.'); }
  },
  'ed.import': () => modal({
    title: 'Import edycji', body: '<p class="small muted">Wklej tekst wyeksportowany z edytora. Istniejące edycje tych samych zawodników zostaną zastąpione.</p><textarea class="input" id="ed-imp" placeholder="{...}"></textarea>',
    buttons: [{ label: 'Anuluj', cls: 'ghost', a: 'ui.close' }, { label: 'Importuj', a: 'ed.doImport' }],
  }),
  'ed.doImport': () => {
    try {
      const obj = JSON.parse(document.getElementById('ed-imp').value);
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('format');
      const clean = {};
      for (const [k, v] of Object.entries(obj)) {
        if (!/^\d+$/.test(k) || typeof v !== 'object' || !v) continue;
        const o = {};
        if (typeof v.fn === 'string') o.fn = v.fn.slice(0, 30);
        if (typeof v.ln === 'string') o.ln = v.ln.slice(0, 30);
        if (Number.isFinite(+v.age)) o.age = clamp(+v.age, 15, 45);
        if (POSITIONS.includes(v.pos)) o.pos = v.pos;
        if (Number.isFinite(+v.ovr)) o.ovr = clamp(+v.ovr, 20, 99);
        if (Object.keys(o).length) clean[k] = o;
      }
      setEdits({ ...getEdits(), ...clean });
      closeOverlay();
      toast(`Zaimportowano ${Object.keys(clean).length} edycji.`, 'good');
      rerender();
    } catch (e) {
      toast('Nieprawidłowy format danych.', 'bad');
    }
  },
  'ed.clear': async () => {
    const ok = await confirmBox('Usunąć wszystkie edycje zawodników?', 'Usuń', 'Anuluj', true);
    if (!ok) return;
    setEdits({});
    rerender();
  },
});

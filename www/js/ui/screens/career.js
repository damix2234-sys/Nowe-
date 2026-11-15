// Tryb zawodnika: ekrany kariery własnego piłkarza.
import { screen, actions, go, reset, rerender, esc, icon, posBadge, rating, sheet, closeOverlay, modal, toast, chips, seg, formIcon, bar, flag, empty, av, setRail, S as UIS, confirmBox, current } from '../ui.js';
import * as C from '../../career/engine.js';
import { SCEN } from '../../career/scenarios.js';
import { NATIONS, NAT, CONFS, CONF_ORDER } from '../../data/nations.js';
import { ovr, posRating, POS_W, POS_NAMES, ATTR_NAMES, ATTR_GROUPS, ATTR_HINTS, FORM_NAMES, POSITIONS } from '../../engine/player.js';
import { SKIN, HAIR } from '../avatar.js';
import { saveSlot, loadSlot, slotMeta, getSettings, setSettings } from '../../core/storage.js';
import { plural, clamp } from '../../core/util.js';
import { createLive, finishLive, liveSubCheck, USER_PID } from '../../career/live.js';
import { Pitch2D } from '../pitch2d.js';

const CSLOTS = ['cauto', 'c1', 'c2', 'c3'];
const SCREENS = new Set(['cstart', 'cnew', 'cclub', 'chome', 'cmatch', 'clive', 'ctrain', 'cdev', 'ctable', 'cnat', 'ctransfer', 'ccareer', 'cmsgs', 'csave']);
const PC = () => C.PC;
const fmtE = (v) => `${Math.round(v).toLocaleString('pl-PL')} €`;

// ---------------- boczny pasek ----------------
const RAIL = [
  ['cdev', 'statystyki', 'Rozwój'], ['ctrain', 'trening', 'Trening'], ['ctable', 'rozgrywki', 'Tabela'],
  ['cnat', 'u21', 'Kadra'], ['ctransfer', 'oferty', 'Transfery'], ['ccareer', 'osiagniecia', 'Kariera'],
  ['cmsgs', 'wiadomosci', 'Poczta'], ['csave', 'zapisz', 'Zapisz'],
];
const prevRail = UIS.rail;
setRail((name) => {
  if (!SCREENS.has(name)) return prevRail ? prevRail(name) : '';
  if (!PC() || ['cstart', 'cnew', 'cclub', 'cmatch', 'clive'].includes(name)) return '';
  const unread = PC().msgs.filter((m) => !m.read).length;
  const badge = { cmsgs: unread, ctransfer: PC().offers.length };
  const item = (k, img, label) => `<button class="rail-it ${name === k ? 'on' : ''}" data-a="crail.go" data-k="${k}" aria-label="${label}"><img class="rail-ic" src="img/rail/${img}.png" alt=""><span class="rail-lb">${label}</span>${badge[k] ? `<span class="badge">${badge[k]}</span>` : ''}</button>`;
  return `<button class="rail-it rail-home ${name === 'chome' ? 'on' : ''}" data-a="crail.go" data-k="chome" aria-label="Pulpit"><span class="rail-logo"><img src="img/logo.png" alt=""></span><span class="rail-lb">Pulpit</span></button>`
    + RAIL.map((x) => item(...x)).join('')
    + `<button class="rail-it rail-exit" data-a="c.menu" aria-label="Menu główne"><span class="rail-exit-ic">${icon('exit')}</span><span class="rail-lb">Menu</span></button>`;
});

// ---------------- wygląd zawodnika ----------------
function look(p, size = '') {
  const l = p.look || {};
  const html = av(1234 + (p.num || 9), { skin: SKIN[l.skin ?? 2], hairStyle: l.hair ?? 1, hairColor: l.hairColor ?? 0, beardOn: !!l.beard, glassesOn: false, old: false, shirt: l.shirt || '#7c3cff', bg: '#2a1458' });
  return size ? html.replace('class="avatar"', `class="avatar ${size}"`) : html;
}

const STAR = (n) => `<span class="stars" title="Potencjał">${'★'.repeat(Math.floor(n))}${n % 1 ? '½' : ''}</span>`;

// ---------------- start trybu zawodnika ----------------
let cmetas = null;
async function loadCMetas() { cmetas = {}; for (const s of CSLOTS) cmetas[s] = await slotMeta(s); }

screen('cstart', {
  render() {
    if (!cmetas) { loadCMetas().then(() => rerender()); return { title: 'Tryb zawodnika', body: empty('Wczytywanie…'), cls: 'nofoot' }; }
    const auto = cmetas.cauto;
    const slot = (s) => { const m = cmetas[s]; return m ? `<div class="row tap" data-a="c.load" data-k="${s}"><span class="flag" style="font-size:26px">${NAT[m.nat] ? NAT[m.nat].flag : '⚽'}</span><div class="main"><div class="t1">${esc(m.name)}${s === 'cauto' ? ' · autozapis' : ` · slot ${s.slice(1)}`}</div><div class="t2">${esc(m.club)} · ${m.age} l. · ocena ${m.ovr} · sezon ${m.year}/${String((m.year + 1) % 100).padStart(2, '0')}</div></div>${icon('right')}</div>` : ''; };
    const saved = CSLOTS.map(slot).join('');
    const body = `<div class="card center"><div style="font-size:52px">⚽</div><h2 class="mt">Tryb zawodnika</h2><p class="small muted">Stwórz własnego piłkarza i poprowadź jego karierę: od początkującego klubu przez transfery do wielkich lig, reprezentacji i turniejów. W kluczowych momentach meczu sam decydujesz, co zrobić, a o powodzeniu decydują Twoje umiejętności.</p></div>
      <button class="btn block mb" data-a="go" data-k="cnew">${icon('plus')} Nowa kariera</button>
      ${saved ? `<div class="card tight"><div class="card-h" style="padding:10px 12px 0"><h3>Zapisane kariery</h3></div><div class="list">${saved}</div></div>` : '<p class="small muted center">Nie masz jeszcze zapisanej kariery.</p>'}`;
    return { title: 'Tryb zawodnika', sub: 'Kariera piłkarza', cls: 'nofoot', body };
  },
});

// ---------------- kreator zawodnika ----------------
const cn = { fn: '', ln: '', nat: 'POL', conf: 'EU', pos: 'CF', num: 9, look: { skin: 2, hair: 1, hairColor: 0, beard: false }, foot: 'R' };
const POS_PICK = ['GK', 'CB', 'LB', 'RB', 'DM', 'CM', 'AM', 'LW', 'RW', 'CF'];
screen('cnew', {
  render() {
    const nats = NATIONS.filter((n) => n.conf === cn.conf).sort((a, b) => a.name.localeCompare(b.name, 'pl'));
    const swatch = (key, list, cur, kind) => `<div class="swatches">${list.map((c, i) => `<button class="swc ${i === cur ? 'on' : ''}" style="background:${c}" data-a="cn.look" data-k="${key}" data-v="${i}" aria-label="${kind} ${i + 1}"></button>`).join('')}</div>`;
    const body = `<div class="card cn-prev">${look({ look: cn.look, num: cn.num }, 'lg')}<div class="grow"><div class="big">${esc(cn.fn || 'Imię')} ${esc(cn.ln || 'Nazwisko')}</div><div class="small muted">${flag(cn.nat)} ${esc(NAT[cn.nat].name)} · ${POS_NAMES[cn.pos]} · nr ${cn.num}</div></div></div>
      <div class="card">
        <label class="field"><span>Imię</span><input class="input" id="cn-fn" data-input="cn.f" data-k="fn" value="${esc(cn.fn)}" maxlength="18" placeholder="np. Jan"></label>
        <label class="field"><span>Nazwisko</span><input class="input" id="cn-ln" data-input="cn.f" data-k="ln" value="${esc(cn.ln)}" maxlength="22" placeholder="np. Kowalski"></label>
        <label class="field"><span>Numer na koszulce</span><input class="input" type="number" min="1" max="99" data-input="cn.f" data-k="num" value="${cn.num}"></label>
      </div>
      <div class="card"><div class="card-h"><h3>Narodowość</h3></div>
        ${chips('cn.conf', CONF_ORDER.map((c) => [c, CONFS[c].name]), cn.conf).replace('class="chips"', 'class="chips wrap"')}
        <select class="input mt" data-change="cn.nat">${nats.map((n) => `<option value="${n.id}" ${n.id === cn.nat ? 'selected' : ''}>${n.flag} ${esc(n.name)}</option>`).join('')}</select>
      </div>
      <div class="card"><div class="card-h"><h3>Pozycja</h3></div>
        <div class="chips wrap">${POS_PICK.map((p) => `<button class="chip ${p === cn.pos ? 'on' : ''}" data-a="cn.pos" data-k="${p}">${POS_NAMES[p]}</button>`).join('')}</div>
        <div class="small muted mt">Lepsza noga</div>${chips('cn.foot', [['R', 'Prawa'], ['L', 'Lewa']], cn.foot)}
      </div>
      <div class="card"><div class="card-h"><h3>Wygląd</h3></div>
        <div class="small muted">Karnacja</div>${swatch('skin', SKIN, cn.look.skin, 'Karnacja')}
        <div class="small muted mt">Kolor włosów</div>${swatch('hairColor', HAIR, cn.look.hairColor, 'Kolor')}
        <div class="small muted mt">Fryzura</div>${chips('cn.hair', [['0', 'Krótkie'], ['1', 'Grzywka'], ['2', 'Na jeża'], ['3', 'Łysy'], ['4', 'Kręcone'], ['5', 'Długie'], ['6', 'Przedziałek']], String(cn.look.hair)).replace('class="chips"', 'class="chips wrap"')}
        <div class="small muted mt">Zarost</div>${chips('cn.beard', [['0', 'Bez brody'], ['1', 'Broda']], cn.look.beard ? '1' : '0')}
      </div>`;
    return { title: 'Nowy zawodnik', sub: 'Stwórz piłkarza', body, foot: `<button class="btn block" data-a="cn.next">Dalej: wybierz klub ${icon('right')}</button>` };
  },
});

let draft = null;
screen('cclub', {
  render() {
    if (!draft) return { title: 'Wybór klubu', body: empty('Najpierw stwórz zawodnika.'), cls: 'nofoot' };
    const list = C.startClubs(draft);
    const p = draft.me;
    const body = `<div class="card"><div class="pl-head">${look(p, 'lg')}<div class="grow"><div class="big">${esc(p.fn)} ${esc(p.ln)}</div><div class="small muted">${flag(p.nat)} ${POS_NAMES[p.pos]} · 17 lat · nr ${p.num}</div><div class="row-flex mt">${posBadge(p.pos)}<span class="grow"></span>${rating(ovr(p), 'big-r')}</div></div></div>
      <p class="small mt">Zaczynasz jako 17-latek z oceną ${Math.round(ovr(p))}. Wybierz jeden z początkujących klubów z drugiej ligi kraju. Im słabszy klub, tym łatwiej o miejsce w składzie.</p></div>
      <div class="card tight"><div class="list">${list.map((c) => {
        const d = ovr(p) - c.lv;
        const st = d >= 3 ? 'gwiazda zespołu' : d >= -2 ? 'podstawowy zawodnik' : d >= -7 ? 'rezerwowy' : 'młodzieżowiec';
        return `<div class="row tap" data-a="cc.pick" data-k="${c.id}"><span class="flag" style="font-size:26px">${NAT[c.nat].flag}</span><div class="main"><div class="t1">${esc(c.n)}</div><div class="t2">siła klubu ${Math.round(c.lv)} · na start: ${st}</div></div>${icon('right')}</div>`;
      }).join('')}</div></div>`;
    return { title: 'Wybierz klub', sub: 'Pierwszy kontrakt', body, cls: 'nofoot' };
  },
});

// ---------------- pulpit ----------------
const STATUS_TXT = ['Zawsze gra od pierwszej minuty.', 'Zwykle w podstawowym składzie.', 'Najczęściej wchodzi z ławki.', 'Rzadko dostaje szansę.'];
function head(p) {
  const club = C.myClub();
  return `<div class="card"><div class="pl-head">${look(p, 'lg')}<div class="grow"><div class="big">${esc(p.fn)} ${esc(p.ln)}</div>
    <div class="small muted">${flag(p.nat)} ${POS_NAMES[p.pos]} · ${p.age} l. · nr ${p.num}</div><div class="small muted">${esc(club.n)}</div>
    <div class="row-flex mt">${posBadge(p.pos)}${formIcon(p.form)}<span class="grow"></span>${rating(ovr(p), 'big-r')}</div></div></div>
    <div class="facts mt"><div class="fact"><div class="k">Punkty rozwoju</div><div class="v">${PC().tp}</div></div><div class="fact"><div class="k">Status</div><div class="v small">${C.STATUS[PC().status]}</div></div>
    <div class="fact"><div class="k">Świeżość</div><div class="v">${Math.round(p.cond)}%</div></div><div class="fact"><div class="k">Potencjał</div><div class="v">${STAR(C.stars(p.pot))}</div></div></div>
    ${p.inj ? `<div class="note mt">✚ Kontuzja: jeszcze ${p.inj} ${plural(p.inj, 'tydzień', 'tygodnie', 'tygodni')} przerwy.</div>` : ''}${p.susp ? '<div class="note mt">Pauza za kartki w najbliższym meczu.</div>' : ''}</div>`;
}

function fxLine(fx) {
  if (fx.comp === 'intl' || fx.comp === 'tour') return `${flag(fx.hn)} ${esc(NAT[fx.hn].name)} vs ${flag(fx.an)} ${esc(NAT[fx.an].name)}`;
  return `${esc(PC().clubs[fx.h].n)} vs ${esc(PC().clubs[fx.a].n)}`;
}

screen('chome', {
  render() {
    const pc = PC();
    if (!pc) return { title: 'Tryb zawodnika', body: empty('Brak aktywnej kariery.'), cls: 'nofoot' };
    const p = pc.me;
    if (pc.retired) return { title: 'Koniec kariery', sub: `${p.fn} ${p.ln}`, cls: 'nofoot', body: `${head(p)}${careerSummary()}<button class="btn block" data-a="c.menu">${icon('exit')} Menu główne</button>` };
    const fxs = C.weekMatches();
    const summer = pc.phase === 'summer';
    let next = '';
    if (fxs.length) next = fxs.map((fx) => `<div class="row"><span class="tag">${fx.comp === 'league' ? 'Liga' : fx.comp === 'cup' ? 'Puchar' : fx.comp === 'ucl' ? 'LM' : fx.comp === 'usl' ? 'SL' : fx.comp === 'ulg' ? 'UL' : fx.comp === 'tour' ? 'Turniej' : 'Kadra'}</span><div class="main"><div class="t1 wrap">${fxLine(fx)}</div><div class="t2">${esc(fx.title)}</div></div></div>`).join('');
    else next = `<div class="small muted">${summer ? (pc.tour && !pc.tour.done && pc.tour.called ? 'Turniej trwa.' : 'Przerwa letnia. Kliknij Dalej, aby rozpocząć nowy sezon.') : C.isIntlWeek() ? 'Przerwa na mecze reprezentacji. Nie masz powołania.' : 'W tym tygodniu nie masz meczu.'}</div>`;
    const recent = pc.log.slice(0, 5).map((l) => `<div class="row"><div class="main"><div class="t1 wrap">${esc(l.line)}</div><div class="t2">${l.r != null ? `ocena ${l.r.toFixed(1)}${l.g ? ` · ⚽ ${l.g}` : ''}${l.a ? ` · 🅰️ ${l.a}` : ''}` : 'nie grał'}</div></div><b>${esc(l.res)}</b></div>`).join('');
    const unread = pc.msgs.filter((m) => !m.read).slice(0, 2);
    const body = `<div class="dash-head"><span class="flag">${NAT[C.myClub().nat].flag}</span><div class="grow"><div class="date">${C.weekLabel()}</div><div class="small muted">${esc(C.myClub().n)} · ${esc(C.leagueName(C.myLeague()))}</div></div></div>
      ${head(p)}
      ${unread.map((m) => `<div class="note tap mb" data-a="cm.open" data-k="${m.id}">✉️ <b>${esc(m.subj)}</b></div>`).join('')}
      ${pc.offers.length ? `<div class="note tap mb" data-a="crail.go" data-k="ctransfer">💼 Masz ${pc.offers.length} ${plural(pc.offers.length, 'ofertę', 'oferty', 'ofert')} transferowe.</div>` : ''}
      <div class="card"><div class="card-h"><h3>${summer ? 'Lato' : 'Ten tydzień'}</h3><span class="small muted">${STATUS_TXT[pc.status]}</span></div>${next}</div>
      <div class="btnrow mb"><button class="btn ghost" data-a="crail.go" data-k="ctrain" ${C.canTrain() && !summer ? '' : 'disabled'}>${icon('bolt')} ${C.canTrain() ? 'Trening' : 'Po treningu'}</button><button class="btn ghost" data-a="crail.go" data-k="cdev">${icon('up')} Rozwój: ${pc.tp} pkt</button></div>
      ${recent ? `<div class="card tight"><div class="card-h" style="padding:10px 12px 0"><h3>Ostatnie mecze</h3></div><div class="list">${recent}</div></div>` : ''}`;
    return { title: 'Kariera', sub: `${p.fn} ${p.ln}`, body, foot: fxs.length ? `<button class="btn ghost" data-a="c.advance">Szybki mecz</button><button class="btn" data-a="c.play2d">${icon('play')} Graj na boisku</button>` : `<button class="btn block" data-a="c.advance">Dalej ${icon('right')}</button>`, back: false };
  },
});

// ---------------- mecz z decyzjami ----------------
let MQ = [], MI = 0, M = null, timer = 0, autoAll = false;
function stopTimer() { if (timer) clearInterval(timer); timer = 0; }
function startMatch() {
  M = C.setupMatch(MQ[MI]);
  autoAll = false;
  go('cmatch', {}, { replace: current() && current().name === 'cmatch' });
}
function logHTML() {
  return M.log.slice(-14).reverse().map((l) => `<div class="cm-line ${l.kind}"><span class="m">${l.min}'</span> ${esc(l.text)}</div>`).join('');
}
function scoreHTML() {
  const [a, b] = M.goals;
  const hs = M.home ? a : b, as = M.home ? b : a;
  return `<div class="cm-score"><div class="t">${esc(M.home ? M.usName : M.themName)}</div><div class="s">${hs}:${as}</div><div class="t">${esc(M.home ? M.themName : M.usName)}</div></div>
    <div class="cm-min">${M.done ? 'Koniec meczu' : `${M.min}'`}${M.rating != null ? ` · Twoja ocena: <b>${M.rating.toFixed(1)}</b>` : ''}</div>`;
}
function refresh() {
  const s = document.getElementById('cm-top'); if (s) s.innerHTML = scoreHTML();
  const l = document.getElementById('cm-log'); if (l) l.innerHTML = logHTML();
}
function tick() {
  if (!M || M.done) { stopTimer(); return; }
  const e = C.runTo(M, Math.min(90, M.min + 1));
  refresh();
  if (e) { stopTimer(); if (autoAll) { C.autoMoment(M, e); refresh(); play(); } else openMoment(C.pickScenario(M, e)); return; }
  if (M.min >= 90) { stopTimer(); C.finishMatch(M); rerender(); }
}
function play() { stopTimer(); const sp = getSettings().speed ?? 1; timer = setInterval(tick, [260, 150, 80, 35][sp] || 150); }

function momentHTML(scen, res) {
  const sc = SCEN[scen];
  if (res) {
    return `<div class="cm-res ${res.ok ? 'ok' : 'bad'}"><div class="big">${res.ok ? '✅ Udało się!' : '❌ Nie udało się'}</div><p>${esc(res.text)}</p><div class="small muted">Szansa wynosiła ${Math.round(res.chance * 100)}%.</div></div>
      <button class="btn block" data-a="cmx.cont" data-k="${res.next || ''}">${res.next ? 'Dalej: co teraz?' : 'Graj dalej'}</button>`;
  }
  return `<div class="cm-sit"><span class="ic">${sc.ic}</span><p>${esc(sc.text)}</p></div>
    <div class="list">${sc.opts.map((o, i) => {
      const c = Math.round(C.optChance(M, o) * 100);
      const cls = c >= 60 ? 'good-t' : c >= 35 ? '' : 'bad-t';
      const keys = Object.keys(o.w).map((k) => ATTR_NAMES[k]).slice(0, 3).join(', ');
      return `<button class="ans" data-a="cmx.opt" data-k="${scen}" data-i="${i}"><b>${esc(o.t)}</b><span class="small muted"> · ${keys}</span><span class="cm-ch ${cls}">${c}%</span></button>`;
    }).join('')}</div>
    <button class="btn ghost block mt small" data-a="cmx.auto" data-k="${scen}">Zdecyduj za mnie</button>`;
}
function openMoment(scen) {
  sheet(`<div id="cm-mom">${momentHTML(scen)}</div>`, { title: `${M.min}' · ${SCEN[scen].title}`, dismiss: false });
}

screen('cmatch', {
  render() {
    if (!M) return { title: 'Mecz', body: empty('Brak meczu.'), cls: 'nofoot' };
    const fin = M.done;
    let summary = '';
    if (fin) {
      const r = M.result;
      const played = M.role !== 'out' && M.enter < 90;
      summary = `<div class="card center"><h3>${esc(M.title)}</h3><div class="big mt">${r.hg}:${r.ag}${r.pens ? ` <span class="small">karne ${r.pens[0]}:${r.pens[1]}</span>` : ''}</div>
        ${played ? `<div class="facts mt"><div class="fact"><div class="k">Ocena</div><div class="v">${M.rating.toFixed(1)}</div></div><div class="fact"><div class="k">Gole / asysty</div><div class="v">${M.my.g} / ${M.my.a}</div></div>
        <div class="fact"><div class="k">Udane akcje</div><div class="v">${M.my.ok}/${M.my.ok + M.my.bad}</div></div><div class="fact"><div class="k">Punkty rozwoju</div><div class="v">+${M.tp}</div></div></div>` : '<p class="small muted mt">Nie zagrałeś w tym meczu.</p>'}</div>`;
    }
    const body = `<div class="card cm-top" id="cm-top">${scoreHTML()}</div>${summary}
      <div class="card"><div class="card-h"><h3>Relacja</h3><span class="small muted">${esc(M.title)}</span></div><div id="cm-log" class="cm-log">${logHTML()}</div></div>`;
    const foot = fin ? `<button class="btn block" data-a="cmx.next">${MI + 1 < MQ.length ? 'Następny mecz' : 'Zakończ tydzień'} ${icon('right')}</button>`
      : `<button class="btn ghost" data-a="cmx.sim">Symuluj do końca</button><button class="btn" data-a="cmx.play">${icon('play')} Graj</button>`;
    return { title: M.comp === 'league' ? 'Mecz ligowy' : M.comp === 'cup' ? 'Mecz pucharowy' : M.comp === 'ucl' ? 'Liga Mistrzów' : M.comp === 'usl' ? 'Super Liga' : M.comp === 'ulg' ? 'Ultra Liga' : 'Reprezentacja', sub: M.line, body, foot, back: false, cls: '' };
  },
  leave() { stopTimer(); },
});

// ---------------- mecz 2D ze sterowaniem ----------------
let L = null; // { M, sim, side, pitch, rate, ended }
const RATES = [1, 1.4, 2];
// poziomy przybliżenia kamery: mnożnik względem widoku całego boiska i nazwa na przycisku
const ZOOMS = [[1, 'Całe boisko'], [1.45, 'Zoom 1'], [1.9, 'Zoom 2'], [2.45, 'Zoom 3'], [3.1, 'Zoom 4'], [3.9, 'Zoom 5']];
function liveStart() {
  stopLive();
  M = C.setupMatch(MQ[MI]);
  if (M.role === 'out') { C.autoPlay(M); go('cmatch', {}, { replace: current() && ['cmatch', 'clive'].includes(current().name) }); return; }
  const { sim, userSide } = createLive(M);
  L = { M, sim, side: userSide, pitch: null, rate: RATES[clamp(getSettings().liveRate ?? 1, 0, 2)], ended: false, rateIdx: clamp(getSettings().liveRate ?? 1, 0, 2), waitT: 0 };
  go('clive', {}, { replace: current() && ['cmatch', 'clive'].includes(current().name) });
}
function stopLive() { if (L && L.pitch) { L.pitch.destroy(); L.pitch = null; } orient(false); }

// orientacja ekranu: na czas meczu 2D poziomo (Android: wtyczka ScreenOrientation, przeglądarka: API ekranu)
let SO = null;
async function orient(landscape) {
  try {
    const cap = window.Capacitor;
    if (cap && Array.isArray(cap.PluginHeaders) && cap.PluginHeaders.some((h) => h.name === 'ScreenOrientation')) {
      if (!SO) { const { registerPlugin } = await import('../../vendor/capacitor-core.js'); SO = registerPlugin('ScreenOrientation'); }
      await SO.lock({ orientation: landscape ? 'landscape' : 'portrait' });
      return;
    }
    if (screen.orientation && screen.orientation.lock) { if (landscape) await screen.orientation.lock('landscape'); else screen.orientation.unlock(); }
  } catch (e) { /* orientacja niedostępna: zostaje obecna */ }
}
/** Obrót boiska: w poziomie drużyna gracza zawsze atakuje w prawo. */
function rotFor(sim) {
  if (window.innerWidth <= window.innerHeight) return 0;
  return sim.goalY(L.side) > 52 ? 1 : -1;
}
/** Kierunek z ekranu (prawo, góra) na kierunek na boisku. */
function screenToWorld(ux, uy) {
  const r = L && L.pitch ? L.pitch.rot || 0 : 0;
  if (r === 1) return { x: -uy, y: ux };
  if (r === -1) return { x: uy, y: -ux };
  return { x: ux, y: uy };
}
function hudHTML() {
  const sim = L.sim, a = sim.sides[0], b = sim.sides[1];
  const S = sim.sides[L.side], ps = S.ps[USER_PID];
  const r = sim.liveRating(L.side, USER_PID);
  return `<div class="lv-sc"><span class="lv-tn">${esc(a.name)}</span><b>${a.goals}:${b.goals}</b><span class="lv-tn">${esc(b.name)}</span></div>
    <div class="lv-info">${sim.minLabel()}${r != null ? ` · ocena <b>${r.toFixed(1)}</b>` : ''}${ps && (ps.g || ps.a) ? ` · ⚽ ${ps.g || 0} 🅰️ ${ps.a || 0}` : ''}${!sim.ctrl ? (M.role === 'sub' && !M.subDone ? ` · wchodzisz w ${M.enter}. min` : ' · poza boiskiem') : ''}</div>`;
}
function liveFrame() {
  if (!L) return;
  const sim = L.sim;
  if (!L.autoSim && (!sim.ctrl || sim.ctrl.state === 'gone')) sim.ctrl = sim.agentOf(L.side, USER_PID);
  if (L.pitch) { const r = rotFor(sim); if (r !== (L.pitch.rot || 0)) { L.pitch.rot = r; L.pitch.resize(); if (L.joyU) { const w = screenToWorld(L.joyU.x, L.joyU.y); sim.input.jx = w.x; sim.input.jy = w.y; } } }
  liveSubCheck(M, sim, L.side);
  if (sim.waiting && !sim.done) { L.waitT += 1 / 60; if (L.waitT > 1.6) { L.waitT = 0; sim.resume(); } }
  const h = document.getElementById('lv-hud'); if (h) h.innerHTML = hudHTML();
  // przyciski kontekstowe: z piłką drybling/podanie, bez piłki odbiór/zawołaj
  const own = sim.ball.owner === sim.ctrl && sim.ctrl;
  if (L.own !== own) {
    L.own = own;
    const t = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
    t('lv-b-pass', own ? 'Podanie' : 'Zawołaj');
    t('lv-b-drb', own ? 'Drybling' : 'Odbiór');
    t('lv-b-lob', own ? 'Długie' : 'Wślizg');
  }
  if (sim.done && !L.ended) { L.ended = true; finishLive(M, sim, L.side); stopLive(); go('cmatch', {}, { replace: true }); }
}
const keys = new Set();
function keyDir() {
  let x = 0, y = 0;
  if (keys.has('ArrowLeft') || keys.has('a')) x -= 1;
  if (keys.has('ArrowRight') || keys.has('d')) x += 1;
  if (keys.has('ArrowUp') || keys.has('w')) y += 1;
  if (keys.has('ArrowDown') || keys.has('s')) y -= 1;
  return { x, y };
}
function cmd(c) { if (!L) return; L.sim.input.cmd = c; L.sim.input.lastT = L.sim.t; if (navigator.vibrate) try { navigator.vibrate(12); } catch (e) { /* brak */ } }
function bindLive(root) {
  // dynamiczny drążek: pojawia się w miejscu dotknięcia lewej połowy ekranu i podąża za palcem
  const zone = root.querySelector('#lv-zone'), joy = root.querySelector('#lv-joy'), knob = root.querySelector('#lv-knob');
  let jid = null, bx = 0, by = 0;
  const R = 52;
  const home = () => { joy.classList.remove('on'); joy.style.left = ''; joy.style.top = ''; knob.style.transform = ''; };
  const place = () => { const zr = zone.getBoundingClientRect(); joy.style.left = `${bx - zr.left}px`; joy.style.top = `${by - zr.top}px`; };
  const setJ = (px, py) => {
    let dx = px - bx, dy = py - by;
    const d = Math.hypot(dx, dy);
    if (d > R) { bx += (dx / d) * (d - R); by += (dy / d) * (d - R); place(); dx = px - bx; dy = py - by; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    if (!L) return;
    const m = Math.min(1, Math.hypot(dx, dy) / R);
    const u = m < 0.12 ? { x: 0, y: 0 } : { x: dx / R, y: -dy / R };
    L.joyU = m < 0.12 ? null : u;
    const w = screenToWorld(u.x, u.y);
    L.sim.input.jx = w.x; L.sim.input.jy = w.y; L.sim.input.lastT = L.sim.t; L.sim.input.stickT = L.sim.t;
  };
  zone.addEventListener('pointerdown', (e) => {
    if (jid != null) return;
    jid = e.pointerId; bx = e.clientX; by = e.clientY;
    joy.classList.add('on'); place(); knob.style.transform = '';
    zone.setPointerCapture(jid); e.preventDefault();
  });
  zone.addEventListener('pointermove', (e) => { if (e.pointerId === jid) setJ(e.clientX, e.clientY); });
  const up = (e) => { if (e.pointerId !== jid) return; jid = null; home(); if (L) { L.joyU = null; L.sim.input.jx = 0; L.sim.input.jy = 0; L.sim.input.stickT = L.sim.t; } };
  zone.addEventListener('pointerup', up); zone.addEventListener('pointercancel', up);
  for (const b of root.querySelectorAll('[data-lv]')) b.addEventListener('pointerdown', (e) => { e.preventDefault(); const c = b.dataset.lv; cmd(c === 'lob' && !(L && L.own) ? 'tackle' : c); b.classList.add('hit'); setTimeout(() => b.classList.remove('hit'), 140); });
  const kd = (e) => {
    if (!L || current().name !== 'clive') return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'w', 'a', 's', 'd'].includes(k)) { keys.add(k); const v = screenToWorld(...Object.values(keyDir())); L.sim.input.jx = v.x; L.sim.input.jy = v.y; L.sim.input.lastT = L.sim.t; L.sim.input.stickT = L.sim.t; e.preventDefault(); }
    if (k === 'j') cmd('pass'); if (k === 'k') cmd('shoot'); if (k === 'l') cmd('dribble'); if (k === 'i') cmd(L.own ? 'lob' : 'tackle');
  };
  const ku = (e) => { const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; keys.delete(k); if (L) { const v = screenToWorld(...Object.values(keyDir())); L.sim.input.jx = v.x; L.sim.input.jy = v.y; L.sim.input.stickT = L.sim.t; } };
  window.removeEventListener('keydown', window.__lvkd || (() => {})); window.removeEventListener('keyup', window.__lvku || (() => {}));
  window.__lvkd = kd; window.__lvku = ku;
  window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
}

// barwy klubów: stałe dla klubu, wyraźnie różne od rywala
const CLUB_COLORS = [['#d62828', '#ffffff'], ['#1e5bd8', '#ffffff'], ['#f5d000', '#111111'], ['#111111', '#f5d000'], ['#2a9d4b', '#ffffff'], ['#ffffff', '#1e3a8a'], ['#7c3cff', '#ffffff'], ['#ff7f11', '#111111'], ['#0d9488', '#ffffff'], ['#8b1e3f', '#f2d16b'], ['#38bdf8', '#0b2545'], ['#e11d74', '#ffffff']];
const hexDist = (a, b) => { const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); const x = p(a), y = p(b); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); };
function clubKits(L) {
  if (M.comp === 'intl' || M.comp === 'tour') return;
  const sim = L.sim;
  const keyOf = (s) => (s === L.side ? M.usKey : M.themKey);
  const idx = (k) => (Math.abs(String(PC().clubs[k].n).split('').reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7)) % CLUB_COLORS.length);
  let h = CLUB_COLORS[idx(keyOf(0))], a = CLUB_COLORS[idx(keyOf(1))];
  const ok = (x) => hexDist(h[0], x[0]) >= 170 && hexDist(h[1], x[0]) >= 120 && hexDist(h[0], x[1]) >= 120;
  if (!ok(a)) a = CLUB_COLORS.find(ok) || CLUB_COLORS.slice().sort((x, y) => hexDist(h[0], y[0]) - hexDist(h[0], x[0]))[0];
  const kit = (c, old) => ({ shirt: c[0], trim: c[1], pat: '', num: c[1], gk: old.gk });
  sim.teams[0].kit = kit(h, sim.teams[0].kit);
  sim.teams[1].kit = kit(a, sim.teams[1].kit);
}

screen('clive', {
  render() {
    if (!L) return { title: 'Mecz', body: empty('Brak meczu.'), cls: 'nofoot' };
    const body = `<div class="lv-wrap"><div id="lv-hud" class="lv-hud">${hudHTML()}</div><canvas id="lv-pitch" class="lv-pitch" aria-label="Boisko"></canvas>
      <div class="lv-ctl">
        <div id="lv-zone" class="lv-zone"><div id="lv-joy" class="lv-joy"><div id="lv-knob" class="lv-knob"></div></div></div>
        <div class="lv-btns">
          <button class="lv-b lv-shoot" data-lv="shoot">Strzał</button>
          <button class="lv-b lv-pass" data-lv="pass" id="lv-b-pass">Podanie</button>
          <button class="lv-b lv-drb" data-lv="dribble" id="lv-b-drb">Drybling</button>
          <button class="lv-b lv-lob" data-lv="lob" id="lv-b-lob">Długie</button>
        </div>
      </div>
      <div class="lv-bar"><button class="btn ghost small" data-a="lv.pause" id="lv-pause">${icon('pause')} Pauza</button><button class="btn ghost small" data-a="lv.rate" id="lv-rate">Tempo ${L.rate}×</button><button class="btn ghost small" data-a="lv.cam" id="lv-cam">${icon('search')} ${ZOOMS[clamp(getSettings().liveZoom ?? 2, 0, ZOOMS.length - 1)][1]}</button><button class="btn ghost small" data-a="lv.sim">Symuluj</button></div></div>`;
    return { title: M.title, sub: M.line, body, back: false, cls: 'nofoot live-view', noHeader: true, appCls: 'live-app' };
  },
  mount(root) {
    const cv = root.querySelector('#lv-pitch');
    if (!L || !cv) return;
    if (!L.pitch) {
      orient(true);
      L.pitch = new Pitch2D(cv, L.sim, { frame: liveFrame });
      L.pitch.rot = rotFor(L.sim);
      L.pitch.setRate(L.rate);
      L.pitch.bodyR = L.sim.bodyR;
      L.pitch.cam.mode = 'zoom';
      L.zoomIdx = clamp(getSettings().liveZoom ?? 2, 0, ZOOMS.length - 1);
      L.pitch.cam.z = ZOOMS[L.zoomIdx][0];
      clubKits(L);
    }
    else L.pitch.attach(cv);
    L.own = undefined;
    bindLive(root);
    if (!L.paused) L.pitch.play();
  },
});

function endWeekFlow() {
  const pc = PC();
  const summerTour = pc.phase === 'summer' && C.summerHasMatch();
  if (!summerTour) C.endWeek();
  autosaveCareer();
  MQ = []; MI = 0; M = null;
  reset('chome');
}

// ---------------- trening ----------------
screen('ctrain', {
  render() {
    const pc = PC(), p = pc.me;
    const can = C.canTrain() && pc.phase === 'season';
    const items = Object.entries(C.TRAIN_FOCUS).filter(([k]) => p.pos === 'GK' ? true : k !== 'gk');
    const body = `<p class="small muted">Raz w tygodniu możesz pójść na trening. Wybierz, nad czym pracujesz: trening daje punkty rozwoju, które wydajesz na dowolne atrybuty w zakładce Rozwój, i trochę poprawia jeden atrybut z wybranej grupy. Punkty dostajesz też za każdy rozegrany mecz.</p>
      ${can ? '' : `<div class="note mb">${p.inj ? 'Jesteś kontuzjowany, odpoczywaj.' : pc.phase !== 'season' ? 'Przerwa letnia, treningi wracają z nowym sezonem.' : 'W tym tygodniu byłeś już na treningu. Wróć po kolejnym meczu.'}</div>`}
      <div class="card tight"><div class="list">${items.map(([k, f]) => `<button class="row tap ${can ? '' : 'dim'}" data-a="ct.do" data-k="${k}" ${can ? '' : 'disabled'} style="width:100%;text-align:left;background:none;border:0;color:inherit"><span style="font-size:26px">${f.ic}</span><div class="main"><div class="t1">${f.name}</div><div class="t2 wrap">${f.desc}</div></div>${icon('right')}</button>`).join('')}</div></div>
      <button class="btn ghost block" data-a="crail.go" data-k="cdev">${icon('up')} Rozwój: wydaj ${pc.tp} pkt</button>`;
    return { title: 'Trening', sub: C.weekLabel(), body, cls: 'nofoot' };
  },
});

// ---------------- rozwój ----------------
screen('cdev', {
  render() {
    const pc = PC(), p = pc.me;
    const key = POS_W[p.pos];
    const groups = ATTR_GROUPS.filter(([n]) => p.pos === 'GK' ? n !== 'Techniczne' : n !== 'Bramkarskie');
    const seen = new Set();
    const body = `<div class="card"><div class="row-flex"><div class="grow"><div class="label">Punkty rozwoju</div><div class="big">${pc.tp}</div></div><div class="center"><div class="label">Ocena</div>${rating(ovr(p), 'big-r')}</div></div>
      <p class="small muted mt">Dotknij ➕, aby podnieść atrybut o 1. Im wyższy atrybut, tym drożej. Podświetlone atrybuty liczą się do oceny na Twojej pozycji. Powyżej potencjału ${STAR(C.stars(p.pot))} rozwój jest kilka razy droższy.</p></div>
      ${groups.map(([name, keys]) => `<div class="attr-group"><div class="label mb">${name}</div><div class="attr-grid">${keys.filter((k) => !seen.has(k) && seen.add(k)).map((k) => {
        const v = Math.round(p.a[k] ?? 40), c = C.attrCost(k);
        const cls = v >= 80 ? 'a5' : v >= 70 ? 'a4' : v >= 60 ? 'a3' : v >= 50 ? 'a2' : 'a1';
        return `<div class="attr2 dev ${key[k] ? 'key' : ''}"><span class="an">${ATTR_NAMES[k]}</span><b class="${cls}">${v}</b><button class="dev-plus" data-a="cd.buy" data-k="${k}" ${pc.tp >= c && v < 99 ? '' : 'disabled'}>+<small>${c}</small></button></div>`;
      }).join('')}</div></div>`).join('')}`;
    return { title: 'Rozwój', sub: `${p.fn} ${p.ln} · ${POS_NAMES[p.pos]}`, body, cls: 'nofoot' };
  },
});

// ---------------- tabela ----------------
const ctab = { t: 'table' };
screen('ctable', {
  render() {
    const pc = PC();
    const L = C.myLeague();
    let body = seg('ctab.t', [['table', 'Tabela'], ['fx', 'Terminarz'], ['cup', 'Puchar'], ['euro', 'Europa']], ctab.t);
    if (ctab.t === 'euro' && pc.euro) {
      const mine = C.myEuro();
      const keys = ['ucl', 'usl', ...(pc.euro.ulg ? ['ulg'] : [])];
      const k = keys.includes(ctab.e) ? ctab.e : mine || 'ucl';
      const E = pc.euro[k];
      const nm = (id) => `${flag(pc.clubs[id].nat)} ${esc(pc.clubs[id].n)}`;
      const tbl = (rows, hi) => `<table class="tbl"><tr><th>#</th><th class="tl">Klub</th><th>M</th><th>B</th><th>Pkt</th></tr>${rows.map((r, i) => `<tr class="${r.id === pc.club ? 'me' : ''} ${hi && i < hi ? 'q' : ''}"><td>${i + 1}</td><td class="tl">${nm(r.id)}</td><td>${r.p}</td><td>${r.gf}:${r.ga}</td><td><b>${r.pts}</b></td></tr>`).join('')}</table>`;
      body += chips('ctab.e', keys.map((x) => [x, C.EURO_NAMES[x]]), k).replace('class="chips"', 'class="chips wrap"');
      const info = {
        ucl: 'Liga Mistrzów: najlepsze kluby z miejsc 1–3 w najwyższych ligach.',
        usl: 'Super Liga: najlepsze kluby z miejsc 4–8 w najwyższych ligach.',
        ulg: 'Ultra Liga: najwyższe wyróżnienie. Gra w niej 10 klubów: po 5 najlepszych z fazy pucharowej Ligi Mistrzów i Super Ligi z poprzedniego sezonu. Każdy z każdym, wygrywa pierwsze miejsce w tabeli.',
      }[k];
      body += `<div class="card"><div class="facts"><div class="fact"><div class="k">Kluby</div><div class="v">${E.teams.length}</div></div><div class="fact"><div class="k">Etap</div><div class="v small">${E.kind === 'league' ? `kolejka ${Math.min(E.round + 1, E.fx.length)} z ${E.fx.length}` : E.stage === 'G' ? `faza grupowa, kolejka ${Math.min(E.round + 1, E.G)} z ${E.G}` : E.stage === 'KO' ? C.koStageName(E) : 'zakończone'}</div></div></div>
        <p class="small mt">${info}${E.kind === 'groups' ? ` ${E.teams.length} klubów w 4 grupach. W grupie każdy gra z każdym, a 2 najlepsze kluby z każdej grupy przechodzą do fazy pucharowej: ćwierćfinał, półfinał i finał o trofeum.` : ''}</p>
        <p class="small muted">${mine === k ? 'Twój klub gra w tych rozgrywkach.' : mine ? `Twój klub gra w tym sezonie w rozgrywkach: ${C.EURO_NAMES[mine]}.` : 'Twój klub nie gra w tym sezonie w pucharach europejskich.'}</p></div>`;
      if (E.kind === 'league') {
        body += `<div class="card tight">${tbl(C.sortedTable(E), 0)}</div>`;
      } else {
        if (E.ko || E.winner != null) {
          const ties = E.ko ? E.ko.ties : [];
          body += `<div class="card"><div class="card-h"><h3>Faza pucharowa</h3><span class="tag">${E.winner != null ? 'zakończona' : C.koStageName(E)}</span></div>
            ${E.winner != null ? `<p>🏆 Zwycięzca: <b>${nm(E.winner)}</b></p>` : ties.map((t) => `<div class="row"><div class="main"><div class="t1 wrap">${nm(t.h)} vs ${nm(t.a)}</div></div><b>${t.r ? `${t.r[0]}:${t.r[1]}${t.pens ? ` k. ${t.pens[0]}:${t.pens[1]}` : ''}` : ''}</b></div>`).join('')}</div>`;
        }
        body += E.groups.map((g, gi) => `<div class="card tight"><div class="card-h" style="padding:10px 12px 0"><h3>Grupa ${C.GROUP_NAMES[gi]}</h3></div>${tbl(C.groupTable(E, gi), 2)}</div>`).join('');
      }
      body += `<p class="small muted center">Mecze europejskie w tygodniach: ${C.EURO_WEEKS.map((w) => w + 1).join(', ')}.</p>`;
      return { title: 'Rozgrywki', sub: E.name, body, cls: 'nofoot' };
    }
    if (ctab.t === 'table') {
      const t = C.sortedTable(L);
      body += `<div class="card tight"><table class="tbl"><tr><th>#</th><th class="tl">Klub</th><th>M</th><th>B</th><th>Pkt</th></tr>${t.map((r, i) => `<tr class="${r.id === pc.club ? 'me' : ''}"><td>${i + 1}</td><td class="tl">${esc(pc.clubs[r.id].n)}</td><td>${r.p}</td><td>${r.gf}:${r.ga}</td><td><b>${r.pts}</b></td></tr>`).join('')}</table></div>
        <p class="small muted">${L.div === 2 ? 'Dwie najlepsze drużyny awansują do najwyższej ligi.' : L.nat === pc.me.nat && pc.leagues[`${L.nat}-2`] ? 'Dwie ostatnie drużyny spadają do II ligi.' : 'Mistrz zdobywa trofeum.'}</p>`;
    } else if (ctab.t === 'fx') {
      body += `<div class="card tight"><div class="list">${L.fx.map((rd, i) => { const m = rd.find((x) => x.h === pc.club || x.a === pc.club); if (!m) return ''; return `<div class="row ${i === L.round ? 'me' : ''}"><span class="tag">${i + 1}</span><div class="main"><div class="t1 wrap">${esc(pc.clubs[m.h].n)} vs ${esc(pc.clubs[m.a].n)}</div></div><b>${m.r ? `${m.r[0]}:${m.r[1]}` : '–'}</b></div>`.replace('–', 'vs'); }).join('')}</div></div>`;
    } else {
      const c = pc.cup;
      body += `<div class="card"><h3>Puchar ${esc(NAT[c.nat].name)}</h3><p class="small">${c.done ? `Zwycięzca: <b>${esc(pc.clubs[c.winner].n)}</b>` : `Etap: ${C.cupRoundName()} · w grze ${c.alive.length} drużyn`}</p>
        <p class="small muted">${c.alive.includes(pc.club) || c.winner === pc.club ? 'Twój klub jest wciąż w grze.' : pc.clubs[pc.club].nat === c.nat ? 'Twój klub odpadł z pucharu albo w nim nie gra.' : 'Grasz w lidze zagranicznej, puchar kraju Cię nie dotyczy.'}</p></div>`;
    }
    return { title: 'Rozgrywki', sub: C.leagueName(L), body, cls: 'nofoot' };
  },
});

// ---------------- reprezentacja ----------------
screen('cnat', {
  render() {
    const pc = PC(), p = pc.me, n = NAT[p.nat];
    const call = C.natCallup();
    const need = n.str - 5;
    let tour = '';
    const t = pc.tour;
    if (t) {
      const g = t.groups.find((x) => x.includes(p.nat)) || t.groups[0];
      tour = `<div class="card"><div class="card-h"><h3>${esc(t.name)}</h3><span class="tag">${t.done ? 'zakończony' : t.stage === 'G' ? 'faza grupowa' : esc(t.stageName || '')}</span></div>
        <table class="tbl"><tr><th class="tl">Grupa</th><th>M</th><th>B</th><th>Pkt</th></tr>${g.slice().sort((a, b) => t.table[b].pts - t.table[a].pts).map((id) => `<tr class="${id === p.nat ? 'me' : ''}"><td class="tl">${flag(id)} ${esc(NAT[id].name)}</td><td>${t.table[id].p}</td><td>${t.table[id].gf}:${t.table[id].ga}</td><td><b>${t.table[id].pts}</b></td></tr>`).join('')}</table>
        ${t.done ? `<p class="small mt">Zwycięzca: ${flag(t.winner)} <b>${esc(NAT[t.winner].name)}</b></p>` : ''}${!t.called ? '<p class="small muted mt">Nie znalazłeś się w kadrze na turniej.</p>' : ''}</div>`;
    }
    const body = `<div class="card"><div class="pl-head"><span class="flag" style="font-size:44px">${n.flag}</span><div class="grow"><div class="big">${esc(n.name)}</div><div class="small muted">Siła reprezentacji ${n.str}</div></div></div>
      <div class="facts mt"><div class="fact"><div class="k">Występy</div><div class="v">${p.caps}</div></div><div class="fact"><div class="k">Gole</div><div class="v">${pc.car.natGoals}</div></div>
      <div class="fact"><div class="k">Twoja ocena</div><div class="v">${Math.round(ovr(p))}</div></div><div class="fact"><div class="k">Status</div><div class="v small">${call === 'start' ? 'podstawowy' : call === 'sub' ? 'powoływany' : 'poza kadrą'}</div></div></div>
      <p class="small mt">${call ? 'Selekcjoner powołuje Cię na mecze reprezentacji. Zgrupowania są w tygodniach przerw na kadrę.' : `Aby dostać powołanie, potrzebujesz oceny około <b>${need}</b>. Graj dobrze w klubie i rozwijaj się.`}</p>
      <p class="small muted">Mistrzostwa Świata są co 4 lata, w 2030 i 2034. Mistrzostwa kontynentu też co 4 lata, w 2028 i 2032. Wielki turniej jest więc co 2 lata, na przemian.</p></div>${tour}`;
    return { title: 'Kadra narodowa', sub: n.name, body, cls: 'nofoot' };
  },
});

// ---------------- transfery ----------------
screen('ctransfer', {
  render() {
    const pc = PC(), club = C.myClub();
    const offers = pc.offers.map((o, i) => { const c = pc.clubs[o.club]; return `<div class="card"><div class="row-flex"><span class="flag" style="font-size:28px">${NAT[c.nat].flag}</span><div class="grow"><b>${esc(c.n)}</b><div class="small muted">${esc(C.leagueName(Object.values(pc.leagues).find((L) => L.teams.includes(c.id))))} · siła ${Math.round(c.lv)}</div></div></div>
      <div class="small mt">Kontrakt na ${o.years} ${plural(o.years, 'rok', 'lata', 'lat')} · ${fmtE(o.wage)} tygodniowo · oferta ważna ${Math.max(0, o.until - pc.week)} tyg.</div>
      <div class="btnrow mt"><button class="btn ghost" data-a="ctr.no" data-k="${i}">Odrzuć</button><button class="btn" data-a="ctr.yes" data-k="${i}">Przyjmij</button></div></div>`; }).join('');
    const body = `<div class="card"><div class="facts"><div class="fact"><div class="k">Klub</div><div class="v small">${esc(club.n)}</div></div><div class="fact"><div class="k">Kontrakt do</div><div class="v">${pc.contract}</div></div>
      <div class="fact"><div class="k">Zarobki</div><div class="v small">${fmtE(pc.wage)} / tydz.</div></div><div class="fact"><div class="k">Konto</div><div class="v small">${fmtE(pc.money)}</div></div></div>
      <p class="small muted mt">Okna transferowe: zimą w połowie sezonu i latem po sezonie. Oferty dostajesz zależnie od oceny i formy. Lista transferowa daje więcej ofert.</p>
      <button class="btn ghost block mt" data-a="ctr.list" ${pc.listed ? 'disabled' : ''}>${pc.listed ? 'Jesteś na liście transferowej' : 'Poproś o wystawienie na listę transferową'}</button></div>
      ${offers || empty('Brak ofert. Nowe pojawią się w najbliższym oknie transferowym.')}`;
    return { title: 'Transfery', sub: club.n, body, cls: 'nofoot' };
  },
});

// ---------------- kariera ----------------
function careerSummary() {
  const pc = PC(), c = pc.car;
  const avg = C.careerAvg();
  return `<div class="card"><div class="card-h"><h3>Bilans kariery</h3></div><div class="facts">
    <div class="fact"><div class="k">Mecze</div><div class="v">${c.apps}</div></div><div class="fact"><div class="k">Gole</div><div class="v">${c.goals}</div></div>
    <div class="fact"><div class="k">Asysty</div><div class="v">${c.assists}</div></div><div class="fact"><div class="k">Średnia ocena</div><div class="v">${avg ? avg.toFixed(2) : 'brak'}</div></div>
    <div class="fact"><div class="k">Reprezentacja</div><div class="v">${c.natApps} / ${c.natGoals}</div></div><div class="fact"><div class="k">Zawodnik meczu</div><div class="v">${c.mom}</div></div></div></div>
    <div class="card"><div class="card-h"><h3>Trofea</h3><span class="tag">${pc.trophies.length}</span></div>${pc.trophies.length ? pc.trophies.map((t) => `<div class="row"><span style="font-size:22px">🏆</span><div class="main"><div class="t1 wrap">${esc(t.name)}</div><div class="t2">${t.year}/${String((t.year + 1) % 100).padStart(2, '0')}</div></div></div>`).join('') : empty('Jeszcze bez trofeów.')}</div>
    <div class="card"><div class="card-h"><h3>Nagrody indywidualne</h3><span class="tag">${pc.awards.length}</span></div>${pc.awards.length ? pc.awards.map((a) => `<div class="row"><span style="font-size:22px">🏅</span><div class="main"><div class="t1 wrap">${esc(a.name)}</div><div class="t2">${a.year}</div></div></div>`).join('') : empty('Jeszcze bez nagród.')}</div>`;
}
screen('ccareer', {
  render() {
    const pc = PC(), p = pc.me, ss = pc.ss;
    const avg = ss.apps ? (ss.rsum / ss.apps).toFixed(2) : 'brak';
    const body = `<div class="card"><div class="card-h"><h3>Bieżący sezon</h3></div><div class="facts">
      <div class="fact"><div class="k">Mecze</div><div class="v">${ss.apps}</div></div><div class="fact"><div class="k">Gole / asysty</div><div class="v">${ss.goals} / ${ss.assists}</div></div>
      <div class="fact"><div class="k">Średnia ocena</div><div class="v">${avg}</div></div><div class="fact"><div class="k">Kartki</div><div class="v">${ss.yc} / ${ss.rc}</div></div></div></div>
      ${careerSummary()}
      <div class="card tight"><div class="card-h" style="padding:10px 12px 0"><h3>Historia sezonów</h3></div>${pc.seasons.length ? `<table class="tbl"><tr><th class="tl">Sezon</th><th class="tl">Klub</th><th>M</th><th>G</th><th>A</th><th>Śr</th></tr>${pc.seasons.slice().reverse().map((s) => `<tr><td class="tl">${s.year}/${String((s.year + 1) % 100).padStart(2, '0')}</td><td class="tl">${esc(s.club)}</td><td>${s.apps}</td><td>${s.goals}</td><td>${s.assists}</td><td>${s.avg || '–'}</td></tr>`.replace('>–<', '>brak<')).join('')}</table>` : empty('Pierwszy sezon w toku.')}</div>
      ${p.age >= 33 && !pc.retired ? '<button class="btn danger block" data-a="cc.retire">Zakończ karierę</button>' : ''}`;
    return { title: 'Kariera', sub: `${p.fn} ${p.ln}`, body, cls: 'nofoot' };
  },
});

// ---------------- poczta i zapis ----------------
screen('cmsgs', {
  render() {
    const pc = PC();
    const body = pc.msgs.length ? `<div class="card tight"><div class="list">${pc.msgs.map((m) => `<div class="row tap ${m.read ? '' : 'unread'}" data-a="cm.open" data-k="${m.id}"><div class="main"><div class="t1">${m.read ? '' : '● '}${esc(m.subj)}</div><div class="t2">${m.y}/${String((m.y + 1) % 100).padStart(2, '0')} · tydzień ${m.w + 1}</div></div>${icon('right')}</div>`).join('')}</div></div>` : empty('Brak wiadomości.');
    return { title: 'Poczta', sub: 'Wiadomości', body, cls: 'nofoot' };
  },
});

screen('csave', {
  render() {
    if (!cmetas) { loadCMetas().then(() => rerender()); return { title: 'Zapisz', body: empty('Wczytywanie…'), cls: 'nofoot' }; }
    const body = `<div class="card tight"><div class="list">${['c1', 'c2', 'c3'].map((s) => { const m = cmetas[s]; return `<div class="row tap" data-a="cs.save" data-k="${s}"><span class="tag">${s.slice(1)}</span><div class="main"><div class="t1">${m ? esc(m.name) : 'Pusty slot'}</div><div class="t2">${m ? `${esc(m.club)} · ${m.age} l. · ${new Date(m.saved).toLocaleString('pl-PL')}` : 'Dotknij, aby zapisać'}</div></div>${icon('save')}</div>`; }).join('')}</div></div>
      <p class="small muted center">Kariera zapisuje się też automatycznie co tydzień.</p>`;
    return { title: 'Zapisz karierę', sub: `${PC().me.fn} ${PC().me.ln}`, body, cls: 'nofoot' };
  },
});

async function autosaveCareer() { if (PC()) { await saveSlot('cauto', PC(), C.careerMeta()); cmetas = null; } }

// ---------------- akcje ----------------
actions({
  'crail.go': (d) => { const top = current(); if (top && top.name === d.k) return; if (d.k === 'chome') reset('chome'); else { reset('chome'); go(d.k); } },
  'c.menu': async () => { await autosaveCareer(); stopTimer(); reset('menu'); },
  'c.load': async (d) => {
    const st = await loadSlot(d.k);
    if (!st || st.mode !== 'career') { toast('Nie udało się wczytać kariery.', 'bad'); return; }
    C.setCareer(st);
    reset('chome');
  },
  // kreator
  'cn.f': (d, el) => { cn[d.k] = d.k === 'num' ? clamp(parseInt(el.value, 10) || 1, 1, 99) : el.value.trim(); const pv = document.querySelector('.cn-prev .big'); if (pv) pv.textContent = `${cn.fn || 'Imię'} ${cn.ln || 'Nazwisko'}`; },
  'cn.conf': (d) => { cn.conf = d.k; const first = NATIONS.filter((n) => n.conf === d.k).sort((a, b) => a.name.localeCompare(b.name, 'pl'))[0]; if (NAT[cn.nat].conf !== d.k) cn.nat = first.id; rerender(); },
  'cn.nat': (d, el) => { cn.nat = el.value; rerender(); },
  'cn.pos': (d) => { cn.pos = d.k; rerender(); },
  'cn.foot': (d) => { cn.foot = d.k; rerender(); },
  'cn.look': (d) => { cn.look[d.k] = +d.v; rerender(); },
  'cn.hair': (d) => { cn.look.hair = +d.k; rerender(); },
  'cn.beard': (d) => { cn.look.beard = d.k === '1'; rerender(); },
  'cn.next': () => {
    if (!cn.fn || !cn.ln) { toast('Podaj imię i nazwisko zawodnika.', 'bad'); return; }
    draft = C.draftCareer({ fn: cn.fn, ln: cn.ln, nat: cn.nat, pos: cn.pos, num: cn.num, look: { ...cn.look }, foot: cn.foot });
    go('cclub');
  },
  'cc.pick': async (d) => {
    C.finishCareer(draft, +d.k);
    draft = null;
    await autosaveCareer();
    reset('chome');
    toast('Witaj w zawodowym futbolu!', 'good');
  },
  // tydzień i mecze
  'c.advance': () => {
    const fxs = C.weekMatches();
    if (!fxs.length) { endWeekFlow(); return; }
    MQ = fxs; MI = 0; L = null;
    startMatch();
  },
  'cmx.play': () => { if (M && !M.done) play(); },
  'cmx.sim': () => { if (!M || M.done) return; autoAll = true; stopTimer(); timer = setInterval(tick, 12); },
  'cmx.opt': (d) => {
    const r = C.resolveOption(M, d.k, +d.i);
    refresh();
    const el = document.getElementById('cm-mom'); if (el) el.innerHTML = momentHTML(d.k, r);
  },
  'cmx.auto': (d) => {
    const r = C.resolveOption(M, d.k, C.autoOption(M, d.k));
    refresh();
    const el = document.getElementById('cm-mom'); if (el) el.innerHTML = momentHTML(d.k, r);
  },
  'cmx.cont': (d) => {
    if (d.k) { const el = document.getElementById('cm-mom'); if (el) el.innerHTML = momentHTML(d.k); const t = document.querySelector('.ov.show .m-title'); if (t) t.textContent = `${M.min}' · ${SCEN[d.k].title}`; return; }
    closeOverlay();
    if (M.min >= 90 || M.leave < 90 && M.min >= M.leave) { /* czerwona kartka: mecz toczy się bez zawodnika */ }
    play();
  },
  'cmx.next': () => {
    MI++;
    if (MI < MQ.length) { if (L) liveStart(); else startMatch(); }
    else { L = null; endWeekFlow(); }
  },
  'c.play2d': () => {
    const fxs = C.weekMatches();
    if (!fxs.length) { endWeekFlow(); return; }
    MQ = fxs; MI = 0; L = { pending: true };
    liveStart();
  },
  'lv.pause': () => {
    if (!L || !L.pitch) return;
    L.paused = !L.paused;
    if (L.paused) L.pitch.pause(); else L.pitch.play();
    const b = document.getElementById('lv-pause'); if (b) b.innerHTML = L.paused ? `${icon('play')} Graj` : `${icon('pause')} Pauza`;
  },
  'lv.cam': () => {
    if (!L || !L.pitch) return;
    L.zoomIdx = ((L.zoomIdx ?? 2) + 1) % ZOOMS.length;
    L.pitch.cam.mode = 'zoom'; L.pitch.cam.z = ZOOMS[L.zoomIdx][0];
    const st = getSettings(); st.liveZoom = L.zoomIdx; setSettings(st);
    const b = document.getElementById('lv-cam'); if (b) b.innerHTML = `${icon('search')} ${ZOOMS[L.zoomIdx][1]}`;
  },
  'lv.rate': () => {
    if (!L || !L.pitch) return;
    L.rateIdx = (L.rateIdx + 1) % RATES.length; L.rate = RATES[L.rateIdx]; L.pitch.setRate(L.rate);
    const st = getSettings(); st.liveRate = L.rateIdx; setSettings(st);
    const b = document.getElementById('lv-rate'); if (b) b.textContent = `Tempo ${L.rate}×`;
  },
  'lv.sim': async () => {
    if (!L) return;
    const ok = await confirmBox('Dograć resztę meczu automatycznie? Twój zawodnik zagra sam, według swoich statystyk.', 'Symuluj');
    if (!ok || !L) return;
    const sim = L.sim;
    if (L.pitch) L.pitch.pause();
    sim.input.jx = 0; sim.input.jy = 0; sim.input.lastT = -99;
    let guard = 0;
    // symulacja na życzenie gracza: zawodnik gra sam, według statystyk
    sim.ctrl = null; L.autoSim = true;
    while (!sim.done && guard++ < 400000) { sim.advance(0.05); liveSubCheck(M, sim, L.side); if (sim.waiting) sim.resume(); }
    liveFrame();
  },
  // trening i rozwój
  'ct.do': (d) => {
    const r = C.doTraining(d.k);
    autosaveCareer();
    modal({ title: 'Trening', body: `<p>${esc(r.text)}</p>${r.gain ? `<p class="small">${ATTR_NAMES[r.gain.k]}: ${Math.round(r.gain.before * 10) / 10} → <b>${r.gain.after}</b></p>` : ''}<p class="small muted">Masz teraz ${PC().tp} punktów rozwoju.</p>`, buttons: [{ label: 'Rozwój', a: 'ct.toDev' }, { label: 'OK', a: 'ui.close' }], onClose: () => rerender() });
  },
  'ct.toDev': () => { closeOverlay(); setTimeout(() => go('cdev'), 50); },
  'cd.buy': (d) => { if (C.buyAttr(d.k)) rerender(); },
  'ctab.t': (d) => { ctab.t = d.k; rerender(); },
  'ctab.e': (d) => { ctab.e = d.k; rerender(); },
  // transfery
  'ctr.yes': async (d) => {
    const o = PC().offers[+d.k];
    const ok = await confirmBox(`Przejść do klubu ${esc(PC().clubs[o.club].n)}?`, 'Transfer');
    if (!ok) return;
    C.acceptOffer(+d.k); autosaveCareer(); toast('Transfer zakończony!', 'good'); reset('chome');
  },
  'ctr.no': (d) => { C.declineOffer(+d.k); rerender(); },
  'ctr.list': () => { C.requestTransfer(); rerender(); },
  'cc.retire': async () => { const ok = await confirmBox('Na pewno zakończyć karierę? Tej decyzji nie można cofnąć.', 'Koniec kariery'); if (!ok) return; C.retire(); autosaveCareer(); reset('chome'); },
  // poczta i zapis
  'cm.open': (d) => {
    const m = PC().msgs.find((x) => x.id === +d.k);
    if (!m) return;
    m.read = true;
    modal({ title: esc(m.subj), body: `<p style="white-space:pre-line">${esc(m.body)}</p>`, buttons: [{ label: 'OK', a: 'ui.close' }], onClose: () => rerender() });
  },
  'cs.save': async (d) => { const ok = await saveSlot(d.k, PC(), C.careerMeta()); cmetas = null; toast(ok ? 'Kariera zapisana.' : 'Zapis nie powiódł się.', ok ? 'good' : 'bad'); rerender(); },
});

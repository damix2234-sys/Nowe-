// Mecz na żywo i podsumowanie.
import { screen, actions, go, reset, rerender, esc, icon, posBadge, matchRating, sheet, closeOverlay, modal, flag, seg, toast, S as UIS, empty } from '../ui.js';
import { G, me, natName, prepareMatch, completeUserMatch } from '../../engine/game.js';
import { FORMATIONS, FORMATION_NAMES, STYLE_NAMES, PRESS_NAMES, TW_NAMES, TRAP_NAMES } from '../../engine/tactics.js';
import { POS_ORDER, slotRating } from '../../engine/player.js';
import { fullName } from '../../data/names.js';
import { fixtureStage } from '../../engine/comps.js';
import { getSettings, setSettings } from '../../core/storage.js';
import { fmtDateLong } from '../../core/util.js';
import { nextEvent } from '../flow.js';
import { whistle, crowd, ambience, unlockAudio, soundOn, setSound } from '../sound.js';

const SPEEDS = [{ min: 1300, line: 1000, label: '½×' }, { min: 600, line: 520, label: '1×' }, { min: 200, line: 240, label: '2×' }, { min: 45, line: 70, label: '4×' }];

let M = null;
let timer = null;
let playing = false;
let speed = 1;
let queue = [];
let feed = [];
let shown = { score: [0, 0], min: "0'" };
let tab = 'feed';
let finished = false;
let lastInfo = null;
let subSel = { out: null, in: null };
let shownGoals = [];

export function setLastInfo(i) { lastInfo = i; }

function fx() { return M ? M.fx : null; }
const us = () => M.userSide;

function vib(ms) {
  try { if (getSettings().vibrate && navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* brak */ }
}

// ---------------- render ----------------
screen('match', {
  render({ fx: fid }) {
    const f = G.fixtures.find((x) => x.id === +fid);
    if (!f) return { title: 'Mecz', body: empty('Brak meczu.') };
    if (f.res && !M) {
      return { title: 'Mecz', body: empty('Ten mecz został już rozegrany.'), foot: '<button class="btn block" data-a="mt.home">Pulpit</button>' };
    }
    if (!M || M.fx.id !== f.id) {
      M = prepareMatch(f);
      queue = [];
      feed = [];
      shown = { score: [0, 0], min: "0'" };
      finished = false;
      tab = 'feed';
      speed = getSettings().speed ?? 1;
      playing = true;
      shownGoals = [];
    }
    const c = G.comps[f.comp];
    const [H, A] = M.sides;
    const body = `
      <div class="card">
        <div class="match-meta">${esc(c ? c.name : '')} · ${esc(fixtureStage(G, f))}<br>${esc(f.city)} · widzów: ${M.attendance.toLocaleString('pl-PL')}</div>
        <div class="score">
          <div class="tm">${flag(f.h)}<span class="tn">${esc(H.name)}</span></div>
          <div><div class="sc" id="mt-sc">${shown.score[0]}:${shown.score[1]}</div><div class="min ${playing && !finished ? 'live' : ''}" id="mt-min">${shown.min}</div><div id="mt-pens"></div></div>
          <div class="tm">${flag(f.a)}<span class="tn">${esc(A.name)}</span></div>
        </div>
        <div class="scorers" id="mt-scorers"></div>
        <div class="mom" id="mt-mom" style="--p:50%"></div>
        <div class="strip"><div class="ballpos" id="mt-ball" style="left:50%"></div></div>
      </div>
      <div class="ctrl">
        <button data-a="mt.subs">${icon('swap')}<span id="mt-subs">Zmiany (${M.sides[us()].subsLeft})</span></button>
        <button data-a="mt.tactics">${icon('clipboard')}Taktyka</button>
        <button class="main" data-a="mt.play" id="mt-play">${icon(playing ? 'pause' : 'play')}<span>${playing ? 'Pauza' : 'Graj'}</span></button>
        <button data-a="mt.speed" id="mt-speed">${icon('ff')}<span>${SPEEDS[speed].label}</span></button>
        <button data-a="mt.end">${icon('end')}Do końca</button>
      </div>
      <div class="bubble" id="mt-bubble">${icon('mic')}<span id="mt-line">${feed.length ? esc(feed[0].lines[feed[0].lines.length - 1]) : 'Zawodnicy wychodzą na murawę…'}</span></div>
      <div id="mt-banner"></div>
      <div class="mt">${seg('mt.tab', [['feed', 'Relacja'], ['lineups', 'Składy'], ['stats', 'Statystyki']], tab)}</div>
      <div class="card" id="mt-tabbody"></div>`;
    return { title: `${H.name} – ${A.name}`, sub: c ? c.short : '', back: false, body, cls: 'nofoot', right: `<button class="iconbtn" id="mt-snd" data-a="mt.sound" aria-label="Dźwięk">${icon(soundOn() ? 'volume' : 'mute')}</button>` };
  },
  mount() {
    updateDyn();
    renderTab();
    if (finished) showFinishBanner();
    else if (playing) { ambience(true); schedule(400); }
  },
  unmount() { clearTimeout(timer); timer = null; ambience(false); },
  onBack() {
    if (!M) return false;
    pause();
    modal({
      title: 'Mecz w toku', body: '<p>Nie można opuścić meczu w trakcie gry. Możesz wrócić do meczu albo dokończyć go symulacją.</p>',
      buttons: [{ label: 'Wróć do meczu', cls: 'ghost', a: 'ui.close' }, { label: 'Symuluj do końca', a: 'mt.endNow' }],
    });
    return true;
  },
});

function $(id) { return document.getElementById(id); }

function updateDyn() {
  if (!M) return;
  const sc = $('mt-sc'); if (sc) sc.textContent = `${shown.score[0]}:${shown.score[1]}`;
  const mn = $('mt-min'); if (mn) { mn.textContent = finished ? 'Koniec' : shown.min; mn.classList.toggle('live', playing && !finished); }
  const mom = $('mt-mom'); if (mom) mom.style.setProperty('--p', `${Math.round(50 + M.mom * 50)}%`);
  const ball = $('mt-ball'); if (ball) ball.style.left = `${Math.round(8 + M.ball * 84)}%`;
  const subs = $('mt-subs'); if (subs) subs.textContent = `Zmiany (${M.sides[us()].subsLeft})`;
  const pl = $('mt-play'); if (pl) pl.innerHTML = `${icon(playing ? 'pause' : 'play')}<span>${playing ? 'Pauza' : 'Graj'}</span>`;
  const sp = $('mt-speed'); if (sp) sp.innerHTML = `${icon('ff')}<span>${SPEEDS[speed].label}</span>`;
  const pens = $('mt-pens');
  if (pens && M.pens) pens.innerHTML = `<div class="small muted">karne ${M.pens[0]}:${M.pens[1]}</div>`;
  const scr = $('mt-scorers');
  if (scr) {
    const nameOf = (pid) => { const p = M.sides[0].spec.players[pid] || M.sides[1].spec.players[pid]; return p ? p.ln : '?'; };
    const col = (side) => shownGoals.filter((g) => g.side === side).map((g) => `${esc(nameOf(g.pid))} ${g.min}${g.og ? ' (sam.)' : ''}`).join('<br>');
    scr.innerHTML = shownGoals.length ? `<div>${col(0)}</div><div style="text-align:right">${col(1)}</div>` : '';
  }
}

const EV_ICON = { goal: '⚽', card: '🟨', pen: '🎯', sub: '🔁', inj: '✚', whistle: '📣', chance: '•', play: '', quiet: '', info: 'ℹ', pens: '🥅' };

function evIcon(e) {
  if (e.kind === 'card' || e.lines.some((l) => /czerwon|Druga żółta/.test(l))) return e.lines.some((l) => /czerwon|Czerwona|Druga żółta/.test(l)) ? '🟥' : '🟨';
  if (e.kind === 'chance' && e.lines.some((l) => /żółt|Żółt/.test(l))) return '🟨';
  return EV_ICON[e.kind] ?? '';
}

function renderTab() {
  const el = $('mt-tabbody');
  if (!el || !M) return;
  if (tab === 'feed') {
    const items = feed.filter((e) => e.kind !== 'quiet' || feed.indexOf(e) < 6).slice(0, 60);
    el.innerHTML = items.length ? `<div class="feed">${items.map((e) => `<div class="ev ${e.kind === 'goal' ? 'goal' : ''}"><span class="m">${e.min}</span><span class="i">${evIcon(e)}</span><span class="txt">${e.lines.map(esc).join(' ')}</span></div>`).join('')}</div>` : '<div class="empty">Mecz zaraz się rozpocznie.</div>';
  } else if (tab === 'lineups') {
    const col = (S) => {
      const on = S.on.filter(Boolean).sort((a, b) => POS_ORDER[a.pos] - POS_ORDER[b.pos]);
      const icons = (pid) => {
        const ps = S.ps[pid] || {};
        return `${'⚽'.repeat(ps.g || 0)}${ps.yc ? '🟨' : ''}${ps.rc ? '🟥' : ''}${ps.inj ? '✚' : ''}`;
      };
      const stm = (v) => `<span class="stm ${v >= 70 ? 'hi' : v >= 50 ? 'md' : 'lo'}">${Math.round(v)}%</span>`;
      const off = [...S.played].filter((pid) => !S.on.some((s) => s && s.pid === pid));
      return `<div><div class="label mb">${esc(S.name)}</div>
        ${on.map((s) => `<div class="lu-p">${posBadge(s.pos)}<span class="nm">${esc(s.p.ln)}</span><span>${icons(s.pid)}</span>${stm(S.st[s.pid])}</div>`).join('')}
        ${off.length ? `<div class="small muted mt">Zeszli: ${off.map((pid) => esc(S.spec.players[pid].ln) + ' ' + icons(pid)).join(', ')}</div>` : ''}
        <div class="small muted mt">Ławka: ${S.bench.map((pid) => esc(S.spec.players[pid].ln)).join(', ') || '—'}</div></div>`;
    };
    el.innerHTML = `<div class="lineups">${col(M.sides[0])}${col(M.sides[1])}</div>`;
  } else {
    const r = M.result();
    const [a, b] = r.stats;
    const row = (lbl, x, y, fmt = (v) => v) => {
      const t = (x + y) || 1;
      return `<div class="lbl center small muted">${lbl}</div><div class="stat-row"><b>${fmt(x)}</b><div class="dual"><i style="width:${(x / t) * 100}%"></i><i style="width:${(y / t) * 100}%"></i></div><b>${fmt(y)}</b></div>`;
    };
    el.innerHTML = row('Posiadanie piłki', a.poss, b.poss, (v) => v + '%') + row('Strzały', a.shots, b.shots) + row('Strzały celne', a.sot, b.sot)
      + row('Rzuty rożne', a.corners, b.corners) + row('Faule', a.fouls, b.fouls) + row('Spalone', a.offsides, b.offsides)
      + row('Żółte kartki', a.yc, b.yc) + row('Czerwone kartki', a.rc, b.rc) + row('Oczekiwane gole (xG)', a.xg, b.xg, (v) => (+v).toFixed(2));
  }
}

let tabTick = 0;

function schedule(ms) {
  clearTimeout(timer);
  timer = setTimeout(tick, ms);
}

function tick() {
  timer = null;
  if (!M || !playing) return;
  if (queue.length) {
    showLine(queue.shift());
    schedule(queue.length ? SPEEDS[speed].line : SPEEDS[speed].min);
    return;
  }
  if (M.done) { finishMatch(); return; }
  const evs = M.step();
  for (const e of evs) {
    feed.unshift(e);
    e.lines.forEach((l, i) => queue.push({ text: l, ev: e, last: i === e.lines.length - 1 }));
  }
  if (!evs.length || evs.every((e) => !e.lines.length)) shown.min = M.minLabel();
  if (++tabTick % 3 === 0 && tab !== 'feed') renderTab();
  updateDyn();
  const brk = evs.find((e) => e.ht);
  const inj = evs.find((e) => e.kind === 'inj' && e.side === us() && e.needSub);
  if (queue.length) { showLine(queue.shift()); }
  if (inj) {
    flushQueue();
    pause();
    toast('Kontuzja! Wprowadź zmianę.', 'bad');
    subSel = { out: inj.pid, in: null };
    setTimeout(openSubs, 300);
    return;
  }
  if (brk && !M.done) {
    flushQueue();
    pause();
    showBreakBanner(brk);
    return;
  }
  schedule(queue.length ? SPEEDS[speed].line : SPEEDS[speed].min);
}

function flushQueue() {
  while (queue.length) showLine(queue.shift(), true);
}

function lineSound(q, isGoal) {
  const e = q.ev;
  const first = e.lines[0] === q.text;
  if (isGoal) { crowd(e.side === us() ? 'goal' : 'groan', 1); return; }
  if (e.kind === 'whistle' && first) { whistle(e.ft ? 'end' : e.ht ? 'double' : 'short'); return; }
  if (e.kind === 'pen' && first) { whistle('long'); return; }
  if (/żółt|Żółt|czerwień|Czerwona/.test(q.text)) { whistle('short'); return; }
  if (/^(Słupek|Poprzeczka|W słupek|Pudło|Niewiarygodne|Fatalnie)/.test(q.text)) crowd('ooh', 0.8);
}

function showLine(q, silent = false) {
  shown.min = q.ev.min;
  const isGoal = q.ev.kind === 'goal' && /^(GO+L|GOL|Jest gol|Samobój)/.test(q.text);
  if (q.last || isGoal) shown.score = q.ev.score.slice();
  if (isGoal && !shownGoals.includes(q.ev)) shownGoals.push(q.ev);
  if (!silent) lineSound(q, isGoal);
  const ln = $('mt-line');
  const bub = $('mt-bubble');
  if (ln) ln.textContent = q.text;
  if (bub) {
    bub.classList.remove('goal');
    if (isGoal && !silent) { void bub.offsetWidth; bub.classList.add('goal'); vib([80, 60, 160]); }
  }
  updateDyn();
  if (q.last && tab === 'feed') renderTab();
}

function pause() {
  playing = false;
  clearTimeout(timer);
  timer = null;
  ambience(false);
  updateDyn();
}

function resume() {
  if (finished || !M) return;
  const b = $('mt-banner');
  if (b) b.innerHTML = '';
  playing = true;
  ambience(true);
  updateDyn();
  schedule(200);
}

function showBreakBanner(e) {
  const b = $('mt-banner');
  const label = e.lines[0] || 'Przerwa';
  if (b) b.innerHTML = `<div class="note mt"><b>${esc(label)}</b><div class="small muted">Możesz teraz wprowadzić zmiany lub skorygować taktykę.</div>
    <div class="btnrow mt"><button class="btn ghost small" data-a="mt.subs">${icon('swap')} Zmiany</button><button class="btn ghost small" data-a="mt.tactics">${icon('clipboard')} Taktyka</button><button class="btn small" data-a="mt.play">${icon('play')} Wznów</button></div></div>`;
}

function finishMatch() {
  finished = true;
  playing = false;
  ambience(false);
  shown.score = [M.sides[0].goals, M.sides[1].goals];
  shownGoals = M.events.filter((e) => e.kind === 'goal');
  updateDyn();
  renderTab();
  showFinishBanner();
}

function showFinishBanner() {
  const b = $('mt-banner');
  if (b) b.innerHTML = `<div class="note mt"><b>Koniec meczu!</b> ${esc(M.sides[0].name)} ${M.sides[0].goals}:${M.sides[1].goals} ${esc(M.sides[1].name)}${M.pens ? ` (karne ${M.pens[0]}:${M.pens[1]})` : ''}
    <div class="btnrow mt"><button class="btn" data-a="mt.summary">Podsumowanie ${icon('right')}</button></div></div>`;
}

function simulateToEnd() {
  if (!M) return;
  M.opts.autoSubs = M.opts.autoSubs || [false, false];
  M.opts.autoSubs[us()] = true;
  let guard = 0;
  while (!M.done && guard++ < 1000) {
    const evs = M.step();
    for (const e of evs) feed.unshift(e);
  }
  queue = [];
  finishMatch();
}

// ---------------- zmiany ----------------
function subsHTML() {
  const S = M.sides[us()];
  const on = S.on.filter(Boolean).sort((a, b) => POS_ORDER[a.pos] - POS_ORDER[b.pos]);
  const stm = (v) => `<span class="stm ${v >= 70 ? 'hi' : v >= 50 ? 'md' : 'lo'}">${Math.round(v)}%</span>`;
  const outSlot = on.find((s) => s.pid === subSel.out);
  const benchRows = S.bench.map((pid) => {
    const p = S.spec.players[pid];
    const r = outSlot ? Math.round(slotRating(p, outSlot.pos)) : Math.round(slotRating(p, p.pos));
    return `<div class="row tap ${subSel.in === pid ? 'me' : ''}" data-a="mt.subIn" data-k="${pid}">${posBadge(p.pos)}<div class="main"><div class="t1">${esc(fullName(p))}</div><div class="t2">${outSlot ? `na pozycji ${outSlot.pos}: ${r}` : `ocena ${r}`}</div></div>${stm(p.cond)}</div>`;
  }).join('');
  return `<p class="small muted">Pozostało zmian: <b>${S.subsLeft}</b>. Wybierz zawodnika schodzącego, a potem wchodzącego.</p>
    <div class="label mb">Na boisku</div>
    <div class="list">${on.map((s) => {
      const ps = S.ps[s.pid] || {};
      return `<div class="row tap ${subSel.out === s.pid ? 'me' : ''}" data-a="mt.subOut" data-k="${s.pid}">${posBadge(s.pos)}<div class="main"><div class="t1">${esc(fullName(s.p))} ${ps.yc ? '🟨' : ''}${ps.inj ? '✚' : ''}${'⚽'.repeat(ps.g || 0)}</div></div>${stm(S.st[s.pid])}</div>`;
    }).join('')}</div>
    <div class="label mb mt">Ławka</div><div class="list">${benchRows || '<div class="empty">Brak rezerwowych.</div>'}</div>
    <div class="btnrow mt"><button class="btn ghost" data-a="ui.close">Zamknij</button><button class="btn" data-a="mt.subDo" ${subSel.out && subSel.in && S.subsLeft > 0 ? '' : 'disabled'}>Wykonaj zmianę</button></div>`;
}

function openSubs() {
  if (!M || M.done) return;
  pause();
  sheet(`<div id="subs-body">${subsHTML()}</div>`, { title: 'Zmiany' });
}

function refreshSubs() {
  const el = document.getElementById('subs-body');
  if (el) el.innerHTML = subsHTML();
}

function tacticsHTML() {
  const t = M.sides[us()].tac;
  const opt = (label, key, names) => `<div class="field"><span>${label}</span><div class="opt">${names.map((n, i) => `<button class="${t[key] === i ? 'on' : ''}" data-a="mt.tac" data-k="${key}" data-v="${i}">${n}</button>`).join('')}</div></div>`;
  return `<div class="field"><span>Formacja</span><div class="chips">${FORMATION_NAMES.map((f) => `<button class="chip ${f === t.f ? 'on' : ''}" data-a="mt.tacF" data-k="${f}">${f}</button>`).join('')}</div></div>
    ${opt('Styl gry', 'style', STYLE_NAMES)}${opt('Pressing', 'press', PRESS_NAMES)}${opt('Gra na czas', 'tw', TW_NAMES)}${opt('Pułapki ofsajdowe', 'trap', TRAP_NAMES)}
    <button class="btn block" data-a="ui.close">Gotowe</button>`;
}

actions({
  'mt.play': () => { if (finished) return; if (playing) pause(); else { closeOverlayIfAny(); resume(); } },
  'mt.sound': () => {
    setSound(!soundOn());
    const b = $('mt-snd');
    if (b) b.innerHTML = icon(soundOn() ? 'volume' : 'mute');
    if (soundOn()) { unlockAudio(); if (playing) ambience(true); }
    toast(soundOn() ? 'Dźwięk włączony' : 'Dźwięk wyłączony');
  },
  'mt.speed': () => {
    speed = (speed + 1) % SPEEDS.length;
    const s = getSettings(); s.speed = speed; setSettings(s);
    updateDyn();
    if (playing) schedule(SPEEDS[speed].min);
  },
  'mt.tab': (d) => {
    tab = d.k;
    document.querySelectorAll('[data-a="mt.tab"]').forEach((b) => b.classList.toggle('on', b.dataset.k === tab));
    renderTab();
  },
  'mt.subs': () => { subSel = { out: null, in: null }; openSubs(); },
  'mt.subOut': (d) => { subSel.out = +d.k; refreshSubs(); },
  'mt.subIn': (d) => { subSel.in = +d.k; refreshSubs(); },
  'mt.subDo': () => {
    if (M.sub(us(), subSel.out, subSel.in)) {
      const e = M.events[M.events.length - 1];
      feed.unshift(e);
      const ln = $('mt-line'); if (ln) ln.textContent = e.lines[0];
      subSel = { out: null, in: null };
      refreshSubs();
      updateDyn();
      renderTab();
      toast('Zmiana przeprowadzona.', 'good');
    }
  },
  'mt.tactics': () => {
    if (!M || M.done) return;
    pause();
    sheet(`<div id="mtac-body">${tacticsHTML()}</div>`, { title: 'Taktyka w meczu' });
  },
  'mt.tac': (d) => {
    M.setTactics(us(), { [d.k]: +d.v });
    const el = document.getElementById('mtac-body'); if (el) el.innerHTML = tacticsHTML();
  },
  'mt.tacF': (d) => {
    M.setTactics(us(), { f: d.k });
    const el = document.getElementById('mtac-body'); if (el) el.innerHTML = tacticsHTML();
    toast(`Nowe ustawienie: ${d.k}`);
  },
  'mt.end': () => {
    if (finished) return;
    pause();
    modal({ title: 'Symulować do końca?', body: '<p>Pozostała część meczu zostanie rozegrana natychmiast. Zmiany przeprowadzi asystent.</p>', buttons: [{ label: 'Anuluj', cls: 'ghost', a: 'ui.close' }, { label: 'Symuluj', a: 'mt.endNow' }] });
  },
  'mt.endNow': () => { closeOverlayIfAny(); simulateToEnd(); },
  'mt.summary': () => {
    if (!M) return;
    const fid = M.fx.id;
    lastInfo = completeUserMatch(M);
    M = null;
    go('postmatch', { fx: fid }, { replace: true });
  },
  'mt.home': () => { reset('home'); nextEvent(); },
});

function closeOverlayIfAny() { while (UIS.overlays.length) closeOverlay(); }

// ---------------- podsumowanie ----------------
screen('postmatch', {
  render({ fx: fid }) {
    const f = G.fixtures.find((x) => x.id === +fid);
    const h = G.history.slice().reverse().find((x) => x.id === +fid);
    if (!f || !f.res || !h) return { title: 'Podsumowanie', body: empty('Brak danych meczu.'), foot: '<button class="btn block" data-a="mt.home">Dalej</button>' };
    const r = lastInfo && lastInfo.fx && lastInfo.fx.id === f.id ? lastInfo.r : null;
    const usSide = f.h === h.nat ? 0 : 1;
    const scH = h.sc.filter((s) => (usSide === 0 ? s.own : !s.own));
    const scA = h.sc.filter((s) => (usSide === 0 ? !s.own : s.own));
    const scList = (l) => l.map((s) => `${esc(s.n)} ${s.m}${s.pen ? ' (k)' : ''}${s.og ? ' (sam.)' : ''}`).join('<br>') || '—';
    const [a, b] = h.st || [{}, {}];
    const statRow = (lbl, x, y, fmt = (v) => v) => {
      const t = (x + y) || 1;
      return `<div class="lbl center small muted">${lbl}</div><div class="stat-row"><b>${fmt(x)}</b><div class="dual"><i style="width:${(x / t) * 100}%"></i><i style="width:${(y / t) * 100}%"></i></div><b>${fmt(y)}</b></div>`;
    };
    let ratings = '';
    if (r) {
      const ps = r.pl[usSide];
      const list = Object.entries(ps).map(([pid, s]) => ({ p: G.players[pid], s })).filter((x) => x.p).sort((x, y) => (POS_ORDER[x.s.pos || x.p.pos] - POS_ORDER[y.s.pos || y.p.pos]) || (x.s.on - y.s.on));
      ratings = `<div class="card"><div class="card-h"><h3>Oceny zawodników</h3></div><div class="list">${list.map(({ p, s }) => `<div class="row tap" data-a="pl.open" data-k="${p.id}">${posBadge(s.pos || p.pos)}<div class="main"><div class="t1">${esc(fullName(p))} ${'⚽'.repeat(s.g)}${s.a ? '🅰️'.repeat(Math.min(s.a, 3)) : ''}${s.yc ? '🟨' : ''}${s.rc ? '🟥' : ''}${s.inj ? '✚' : ''}</div><div class="t2">${s.min || 0}' ${r.motm && r.motm.pid == p.id ? '· ⭐ zawodnik meczu' : ''}</div></div>${matchRating(s.r)}</div>`).join('')}</div></div>`;
    }
    const others = G.fixtures.filter((x) => x.d === f.d && x.id !== f.id && x.res && (x.comp === f.comp || G.comps[x.comp]?.type !== 'FRI')).slice(0, 12);
    const othersHTML = others.length ? `<div class="card"><div class="card-h"><h3>Inne wyniki</h3></div>${others.map((x) => `<div class="fx-row"><span class="d">${esc(G.comps[x.comp]?.short || '')}</span><span class="teams">${flag(x.h)}<span class="tn">${esc(natName(x.h))}</span><span class="muted">–</span>${flag(x.a)}<span class="tn">${esc(natName(x.a))}</span></span><span class="r">${x.res.hg}:${x.res.ag}${x.res.pens ? '*' : ''}</span></div>`).join('')}</div>` : '';
    const body = `<div class="card">
        <div class="match-meta">${esc(h.comp)} · ${esc(h.stage)} · ${fmtDateLong(f.d)}</div>
        <div class="score"><div class="tm">${flag(f.h)}<span class="tn">${esc(natName(f.h))}</span></div>
        <div><div class="sc">${f.res.hg}:${f.res.ag}</div><div class="small muted">${f.res.et ? 'po dogrywce' : 'koniec meczu'}${f.res.pens ? `<br>karne ${f.res.pens[0]}:${f.res.pens[1]}` : ''}</div></div>
        <div class="tm">${flag(f.a)}<span class="tn">${esc(natName(f.a))}</span></div></div>
        <div class="lineups mt"><div class="sc-list">${scList(scH)}</div><div class="sc-list" style="text-align:right">${scList(scA)}</div></div>
        ${h.motm ? `<div class="small muted center mt">⭐ Zawodnik meczu: ${esc(h.motm.n)}</div>` : ''}
      </div>
      ${h.st ? `<div class="card">${statRow('Posiadanie', a.poss, b.poss, (v) => v + '%')}${statRow('Strzały', a.shots, b.shots)}${statRow('Celne', a.sot, b.sot)}${statRow('Rożne', a.corners, b.corners)}${statRow('Faule', a.fouls, b.fouls)}${statRow('Kartki', a.yc + a.rc, b.yc + b.rc)}</div>` : ''}
      ${ratings}${othersHTML}`;
    return { title: 'Podsumowanie meczu', back: false, body, foot: '<button class="btn block" data-a="mt.home">Dalej</button>' };
  },
  onBack() { reset('home'); nextEvent(); return true; },
});

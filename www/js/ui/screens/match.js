// Mecz na żywo (animowane boisko 2D z komentarzem zsynchronizowanym z akcjami) i podsumowanie.
import { screen, actions, go, reset, esc, icon, posBadge, matchRating, sheet, closeOverlay, modal, flag, seg, toast, S as UIS, empty } from '../ui.js';
import { G, natName, prepareMatch, completeUserMatch } from '../../engine/game.js';
import { FORMATION_NAMES, STYLE_NAMES, PRESS_NAMES, TW_NAMES, TRAP_NAMES } from '../../engine/tactics.js';
import { POS_ORDER, slotRating } from '../../engine/player.js';
import { fullName } from '../../data/names.js';
import { fixtureStage } from '../../engine/comps.js';
import { getSettings, setSettings } from '../../core/storage.js';
import { fmtDateLong } from '../../core/util.js';
import { matchKits } from '../../data/kits.js';
import { nextEvent } from '../flow.js';
import { Pitch2D } from '../pitch2d.js';
import { whistle, crowd, kick, post, ambience, unlockAudio, soundOn, setSound } from '../sound.js';

// rate – sekundy czasu boiska na sekundę rzeczywistą, min – długość spokojnej minuty na boisku
const SPEEDS = [{ rate: 1.4, min: 2.3, label: '½×' }, { rate: 2.5, min: 2.0, label: '1×' }, { rate: 4.2, min: 1.7, label: '2×' }, { rate: 7.5, min: 1.1, label: '4×' }];

let M = null;
let pitch = null;
let playing = false;
let speed = 1;
let feed = [];
let shown = { score: [0, 0], min: "0'", pens: null };
let tab = 'feed';
let finished = false;
let lastInfo = null;
let subSel = { out: null, in: null };
let shownGoals = [];
let tabTick = 0;
let lastLine = '';

export function setLastInfo(i) { lastInfo = i; }

const us = () => M.userSide;

function vib(ms) {
  try { if (getSettings().vibrate && navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* brak */ }
}

function $(id) { return document.getElementById(id); }

// ---------------- render ----------------
screen('match', {
  render({ fx: fid }) {
    const f = G.fixtures.find((x) => x.id === +fid);
    if (!f) return { title: 'Mecz', body: empty('Brak meczu.') };
    if (f.res && !M) {
      return { title: 'Mecz', body: empty('Ten mecz został już rozegrany.'), foot: '<button class="btn block" data-a="mt.home">Pulpit</button>' };
    }
    if (!M || M.fx.id !== f.id) {
      if (pitch) { pitch.destroy(); pitch = null; }
      M = prepareMatch(f);
      feed = [];
      shown = { score: [0, 0], min: "0'", pens: null };
      finished = false;
      tab = 'feed';
      speed = getSettings().speed ?? 1;
      playing = true;
      shownGoals = [];
      lastLine = 'Zawodnicy wychodzą na murawę…';
    }
    const c = G.comps[f.comp];
    const [H, A] = M.sides;
    const kits = matchKits(H.nid, A.nid);
    const kit = (k) => `<i class="kit" style="--k:${k.shirt};--t:${k.trim}"></i>`;
    const body = `
      <div class="mt-board">
        <div class="tm">${flag(f.h)}<span class="tn">${esc(H.name)}</span>${kit(kits[0])}</div>
        <div class="mid"><div class="sc" id="mt-sc">${shown.score[0]}:${shown.score[1]}</div><div class="min ${playing && !finished ? 'live' : ''}" id="mt-min">${shown.min}</div></div>
        <div class="tm r">${kit(kits[1])}<span class="tn">${esc(A.name)}</span>${flag(f.a)}</div>
        <div class="scorers" id="mt-scorers"></div>
      </div>
      <div class="pitch-wrap" id="mt-wrap">
        <canvas id="mt-pitch" aria-label="Boisko – animacja meczu"></canvas>
        <button class="pitch-cam" data-a="mt.cam" aria-label="Zmień widok">${icon('target')}</button>
        <div class="mom" id="mt-mom" style="--p:50%"></div>
        <div id="mt-banner"></div>
      </div>
      <div class="bubble" id="mt-bubble">${icon('mic')}<span id="mt-line">${esc(lastLine)}</span></div>
      <div class="ctrl mt-ctrl">
        <button data-a="mt.subs">${icon('swap')}<span id="mt-subs">Zmiany (${M.sides[us()].subsLeft})</span></button>
        <button data-a="mt.tactics">${icon('clipboard')}Taktyka</button>
        <button class="main" data-a="mt.play" id="mt-play">${icon(playing ? 'pause' : 'play')}<span>${playing ? 'Pauza' : 'Graj'}</span></button>
        <button data-a="mt.speed" id="mt-speed">${icon('ff')}<span>${SPEEDS[speed].label}</span></button>
        <button data-a="mt.end">${icon('end')}Do końca</button>
      </div>
      <div class="mt">${seg('mt.tab', [['feed', 'Relacja'], ['lineups', 'Składy'], ['stats', 'Statystyki']], tab)}</div>
      <div class="card" id="mt-tabbody"></div>`;
    const sub = `${c ? c.short + ' · ' : ''}${fixtureStage(G, f)} · ${f.city}`;
    return { title: `${H.name} – ${A.name}`, sub, back: false, body, cls: 'nofoot match-view', right: `<button class="iconbtn" id="mt-snd" data-a="mt.sound" aria-label="Dźwięk">${icon(soundOn() ? 'volume' : 'mute')}</button>` };
  },
  mount() {
    sizePitch();
    const cv = $('mt-pitch');
    if (cv) {
      if (!pitch) {
        pitch = new Pitch2D(cv, M, { need: pump, start: onStart, line: onLine, end: onEnd, sfx: onSfx });
        if (finished) pitch.finalState();
      } else pitch.attach(cv);
      pitch.setRate(SPEEDS[speed].rate);
      window.__pitch = pitch;
    }
    window.addEventListener('resize', sizePitch);
    updateDyn();
    renderTab();
    if (finished) showFinishBanner();
    else if (playing) { ambience(true); if (pitch) pitch.play(); }
  },
  unmount() {
    window.removeEventListener('resize', sizePitch);
    if (pitch) pitch.pause();
    ambience(false);
  },
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

/** Boisko jak największe, ale tak, by pod nim zmieściły się komentarz i przyciski. */
function sizePitch() {
  const wrap = $('mt-wrap');
  if (!wrap) return;
  const top = wrap.getBoundingClientRect().top + window.scrollY;
  const bub = $('mt-bubble'), ctrl = document.querySelector('.mt-ctrl');
  const below = (bub ? bub.offsetHeight : 48) + (ctrl ? ctrl.offsetHeight : 58) + 26;
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:var(--sab);visibility:hidden;pointer-events:none';
  document.body.appendChild(probe);
  const sab = probe.offsetHeight || 0;
  probe.remove();
  const w = wrap.clientWidth || 340;
  const full = w * (113.4 / 74);
  const avail = window.innerHeight - top - below - sab;
  const h = Math.round(Math.max(Math.min(avail, full), Math.min(330, full)));
  wrap.style.height = h + 'px';
  if (pitch) pitch.resize();
}

function nameOf(pid) {
  const p = M.sides[0].spec.players[pid] || M.sides[1].spec.players[pid];
  return p ? p.ln : '?';
}

function updateDyn() {
  if (!M) return;
  const sc = $('mt-sc'); if (sc) sc.textContent = `${shown.score[0]}:${shown.score[1]}`;
  const mn = $('mt-min');
  if (mn) {
    mn.textContent = finished ? 'Koniec' : shown.pens ? `karne ${shown.pens[0]}:${shown.pens[1]}` : shown.min;
    mn.classList.toggle('live', playing && !finished);
  }
  const mom = $('mt-mom'); if (mom) mom.style.setProperty('--p', `${Math.round(50 + M.mom * 50)}%`);
  const subs = $('mt-subs'); if (subs) subs.textContent = `Zmiany (${M.sides[us()].subsLeft})`;
  const pl = $('mt-play'); if (pl) pl.innerHTML = `${icon(playing ? 'pause' : 'play')}<span>${playing ? 'Pauza' : 'Graj'}</span>`;
  const sp = $('mt-speed'); if (sp) sp.innerHTML = `${icon('ff')}<span>${SPEEDS[speed].label}</span>`;
  const scr = $('mt-scorers');
  if (scr) {
    const col = (side) => shownGoals.filter((g) => g.side === side).map((g) => `${esc(nameOf(g.pid))} ${g.min}${g.og ? ' (sam.)' : ''}`).join('<br>');
    scr.innerHTML = shownGoals.length ? `<div>${col(0)}</div><div style="text-align:right">${col(1)}</div>` : '';
  }
}

function evIcon(e) {
  const t = new Set(e.acts.map((a) => a.t));
  if (t.has('goal') || t.has('ownGoal')) return '⚽';
  if (t.has('red') || t.has('secondYellow')) return '🟥';
  if (t.has('yellow')) return '🟨';
  if (t.has('sub')) return '🔁';
  if (t.has('injury')) return '✚';
  if (t.has('pk')) return '🥅';
  if (t.has('penalty') || (e.kind === 'pen')) return '🎯';
  if (e.kind === 'whistle') return '📣';
  if (t.has('stoppage')) return 'ℹ';
  if (e.kind === 'chance') return '•';
  return '';
}

function numOf(side, pid) {
  const n = pitch && pitch.teams[side].nums[pid];
  return n != null ? `<b class="num">${n}</b>` : '';
}

function renderTab() {
  const el = $('mt-tabbody');
  if (!el || !M) return;
  if (tab === 'feed') {
    const items = feed.filter((x) => x.n > 0).filter((x, i) => x.ev.kind !== 'quiet' || i < 6).slice(0, 60);
    el.innerHTML = items.length ? `<div class="feed">${items.map(({ ev: e, n }) => `<div class="ev ${e.kind === 'goal' && n === e.lines.length ? 'goal' : ''}"><span class="m">${e.min}</span><span class="i">${evIcon(e)}</span><span class="txt">${e.lines.slice(0, n).map(esc).join(' ')}</span></div>`).join('')}</div>` : '<div class="empty">Mecz zaraz się rozpocznie.</div>';
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
        ${on.map((s) => `<div class="lu-p">${numOf(S.idx, s.pid)}${posBadge(s.pos)}<span class="nm">${esc(s.p.ln)}</span><span>${icons(s.pid)}</span>${stm(S.st[s.pid])}</div>`).join('')}
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
    el.innerHTML = `<div class="small muted center mb">Widzów: ${M.attendance.toLocaleString('pl-PL')}</div>`
      + row('Posiadanie piłki', a.poss, b.poss, (v) => v + '%') + row('Strzały', a.shots, b.shots) + row('Strzały celne', a.sot, b.sot)
      + row('Rzuty rożne', a.corners, b.corners) + row('Faule', a.fouls, b.fouls) + row('Spalone', a.offsides, b.offsides)
      + row('Żółte kartki', a.yc, b.yc) + row('Czerwone kartki', a.rc, b.rc) + row('Oczekiwane gole (xG)', a.xg, b.xg, (v) => (+v).toFixed(2));
  }
}

// ---------------- współpraca z animacją ----------------
/** Animacja potrzebuje kolejnej minuty: krok silnika i akcje do odegrania. */
function pump() {
  if (!M || M.done || !pitch) return;
  const evs = M.step();
  let any = false;
  for (const e of evs) {
    if (!e.lines.length) continue;
    any = true;
    pitch.push(e.lines.map((text, i) => ({ type: 'act', act: e.acts[i], text, ev: e, i, last: i === e.lines.length - 1 })));
  }
  if (!any) {
    if (!evs.length) shown.min = M.minLabel();
    pitch.push([{ type: 'minute', s: M.poss, dur: SPEEDS[speed].min, min: M.minLabel() }]);
  }
  if (++tabTick % 4 === 0 && tab !== 'feed') renderTab();
}

function onStart(it) {
  shown.min = it.ev ? it.ev.min : it.min || shown.min;
  if (it.type === 'act' && it.i === 0 && !feed.some((x) => x.ev === it.ev)) feed.unshift({ ev: it.ev, n: 0 });
  updateDyn();
}

function onLine(it) {
  const e = it.ev, a = it.act || {};
  const f = feed.find((x) => x.ev === e);
  if (f) f.n = Math.max(f.n, it.i + 1);
  const isGoal = a.t === 'goal' || a.t === 'ownGoal';
  if (isGoal || it.last) shown.score = e.score.slice();
  if (isGoal && !shownGoals.includes(e)) shownGoals.push(e);
  if (a.t === 'pk' && a.score) shown.pens = a.score.slice();
  lastLine = it.text;
  const ln = $('mt-line');
  const bub = $('mt-bubble');
  if (ln) ln.textContent = it.text;
  if (bub) {
    bub.classList.remove('goal');
    if (isGoal) { void bub.offsetWidth; bub.classList.add('goal'); vib([80, 60, 160]); }
  }
  updateDyn();
  if (tab === 'feed') renderTab();
}

function onEnd(it) {
  if (!it.last || !M) return;
  const e = it.ev;
  if (e.ft) { finishMatch(); return; }
  if (e.ht && !M.done) {
    pause();
    showBreakBanner(e);
    return;
  }
  if (e.kind === 'inj' && e.side === us() && e.needSub && !M.done) {
    pause();
    toast('Kontuzja! Wprowadź zmianę.', 'bad');
    subSel = { out: e.pid, in: null };
    setTimeout(openSubs, 300);
  }
}

function onSfx(kind, data) {
  if (kind === 'whistle') whistle(data);
  else if (kind === 'kick') kick(data);
  else if (kind === 'post') post();
  else if (kind === 'goal') crowd(data === us() ? 'goal' : 'groan', 1);
  else if (kind === 'crowd' && data) {
    if (data.type === 'goal' || data.type === 'groan') crowd(data.type, data.small ? 0.6 : 1);
    else crowd('ooh', data.loud ? 1 : 0.7);
  }
}

function pause() {
  playing = false;
  if (pitch) pitch.pause();
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
  if (pitch) pitch.play();
}

function showBreakBanner(e) {
  const b = $('mt-banner');
  const label = e.lines[0] || 'Przerwa';
  if (b) b.innerHTML = `<div class="note pitch-note"><b>${esc(label)}</b><div class="small muted">Możesz teraz wprowadzić zmiany lub skorygować taktykę.</div>
    <div class="btnrow mt"><button class="btn ghost small" data-a="mt.subs">${icon('swap')} Zmiany</button><button class="btn ghost small" data-a="mt.tactics">${icon('clipboard')} Taktyka</button><button class="btn small" data-a="mt.play">${icon('play')} Wznów</button></div></div>`;
}

function finishMatch() {
  if (finished) return;
  finished = true;
  playing = false;
  ambience(false);
  shown.score = [M.sides[0].goals, M.sides[1].goals];
  if (M.pens) shown.pens = M.pens.slice();
  shownGoals = M.events.filter((e) => e.kind === 'goal');
  for (const x of feed) x.n = x.ev.lines.length;
  if (pitch) {
    pitch.finalState();
    pitch.play();
    const p = pitch;
    setTimeout(() => { if (p === pitch && finished) p.pause(); }, 5000);
  }
  updateDyn();
  renderTab();
  showFinishBanner();
}

function showFinishBanner() {
  const b = $('mt-banner');
  if (b) b.innerHTML = `<div class="note pitch-note"><b>Koniec meczu!</b> ${esc(M.sides[0].name)} ${M.sides[0].goals}:${M.sides[1].goals} ${esc(M.sides[1].name)}${M.pens ? ` (karne ${M.pens[0]}:${M.pens[1]})` : ''}
    <div class="btnrow mt"><button class="btn" data-a="mt.summary">Podsumowanie ${icon('right')}</button></div></div>`;
}

function simulateToEnd() {
  if (!M) return;
  M.opts.autoSubs = M.opts.autoSubs || [false, false];
  M.opts.autoSubs[us()] = true;
  if (pitch) pitch.clear();
  let guard = 0;
  while (!M.done && guard++ < 1000) {
    const evs = M.step();
    for (const e of evs) if (e.lines.length && !feed.some((x) => x.ev === e)) feed.unshift({ ev: e, n: e.lines.length });
  }
  for (const e of M.events) if (e.lines.length && !feed.some((x) => x.ev === e)) feed.unshift({ ev: e, n: e.lines.length });
  const last = M.events[M.events.length - 1];
  if (last) { lastLine = last.lines[last.lines.length - 1]; const ln = $('mt-line'); if (ln) ln.textContent = lastLine; }
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
  'mt.play': () => { if (finished) return; unlockAudio(); if (playing) pause(); else { closeOverlayIfAny(); resume(); } },
  'mt.cam': () => {
    if (!pitch) return;
    const m = pitch.toggleCam();
    toast(m === 'full' ? 'Widok: całe boisko' : m === 'near' ? 'Widok: kamera przy piłce' : 'Widok: automatyczny');
  },
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
    if (pitch) pitch.setRate(SPEEDS[speed].rate);
    updateDyn();
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
      if (pitch) pitch.push(e.lines.map((text, i) => ({ type: 'act', act: e.acts[i], text, ev: e, i, last: i === e.lines.length - 1 })));
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
    if (pitch) pitch.syncSlots();
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
    if (pitch) { pitch.destroy(); pitch = null; }
    window.__pitch = null;
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

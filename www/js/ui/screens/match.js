// Mecz na żywo: boisko 2D, na którym zawodnicy sami grają (silnik engine/sim.js), komentarz opisujący
// prawdziwe zdarzenia z boiska, oceny na żywo, zmęczenie, zmiany i taktyka w trakcie meczu, podsumowanie.
import { screen, actions, go, reset, esc, icon, posBadge, matchRating, sheet, closeOverlay, modal, flag, seg, toast, S as UIS, empty } from '../ui.js';
import { G, natName, prepareMatch, completeUserMatch } from '../../engine/game.js';
import { FORMATION_NAMES, STYLE_NAMES, PRESS_NAMES, TW_NAMES, TRAP_NAMES, LINE_NAMES } from '../../engine/tactics.js';
import { POS_ORDER, slotRating } from '../../engine/player.js';
import { fullName } from '../../data/names.js';
import { fixtureStage } from '../../engine/comps.js';
import { getSettings, setSettings } from '../../core/storage.js';
import { fmtDateLong } from '../../core/util.js';
import { matchKits } from '../../data/kits.js';
import { nextEvent } from '../flow.js';
import { Pitch2D } from '../pitch2d.js';
import { whistle, crowd, kick, post, ambience, unlockAudio, soundOn, setSound } from '../sound.js';

// rate, sekundy symulacji na sekundę rzeczywistą (sekunda symulacji = 10 s zegara meczu)
const SPEEDS = [{ rate: 0.8, label: '½×' }, { rate: 1.5, label: '1×' }, { rate: 3, label: '2×' }, { rate: 6, label: '4×' }];
const WAIT_LABEL = { HT: 'Przerwa', ETB: 'Przed dogrywką', ETH: 'Przerwa w dogrywce', PENB: 'Przed karnymi' };

let M = null;
let pitch = null;
let playing = false;
let speed = 1;
let feed = [];
let tab = 'feed';
let finished = false;
let lastInfo = null;
let subSel = { out: null, in: null };
let lastLine = '';
let simBusy = false;
let feedDirty = false;
let lastTabT = 0;
let lastMin = '';

export function setLastInfo(i) { lastInfo = i; }

const us = () => M.userSide;

function vib(ms) {
  try { if (getSettings().vibrate && navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* brak */ }
}

function $(id) { return document.getElementById(id); }

function hook(m) {
  m.onComm = onComm;
  m.onEvent = onEvent;
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
      if (pitch) { pitch.destroy(); pitch = null; }
      M = prepareMatch(f);
      hook(M);
      feed = [];
      finished = false;
      simBusy = false;
      tab = 'feed';
      speed = Math.min(SPEEDS.length - 1, getSettings().speed ?? 1);
      playing = true;
      lastLine = 'Zawodnicy wychodzą na murawę…';
    }
    const c = G.comps[f.comp];
    const [H, A] = M.sides;
    const kits = matchKits(H.nid, A.nid);
    const kit = (k) => `<i class="kit" style="--k:${k.shirt};--t:${k.trim}"></i>`;
    const body = `
      <div class="mt-board">
        <div class="tm">${flag(f.h)}<span class="tn">${esc(H.name)}</span>${kit(kits[0])}</div>
        <div class="mid"><div class="sc" id="mt-sc">${H.goals}:${A.goals}</div><div class="min ${playing && !finished ? 'live' : ''}" id="mt-min">${minText()}</div></div>
        <div class="tm r">${kit(kits[1])}<span class="tn">${esc(A.name)}</span>${flag(f.a)}</div>
        <div class="scorers" id="mt-scorers"></div>
      </div>
      <div class="pitch-wrap" id="mt-wrap">
        <canvas id="mt-pitch" aria-label="Boisko, animacja meczu"></canvas>
        <button class="pitch-cam" data-a="mt.cam" aria-label="Zmień widok">${icon('target')}</button>
        <div class="mom" id="mt-mom" style="--p:50%"></div>
        <div id="mt-banner"></div>
      </div>
      <div class="bubble" id="mt-bubble">${icon('mic')}<span id="mt-line">${esc(lastLine)}</span></div>
      <div class="ctrl mt-ctrl">
        <button data-a="mt.subs">${icon('swap')}<span id="mt-subs">Zmiany: ${M.sides[us()].subsLeft}</span></button>
        <button data-a="mt.tactics">${icon('clipboard')}Taktyka</button>
        <button class="main" data-a="mt.play" id="mt-play">${icon(playing ? 'pause' : 'play')}<span>${playing ? 'Pauza' : 'Graj'}</span></button>
        <button data-a="mt.speed" id="mt-speed">${icon('ff')}<span>${SPEEDS[speed].label}</span></button>
        <button data-a="mt.end">${icon('end')}Do końca</button>
      </div>
      <div class="mt">${seg('mt.tab', [['feed', 'Relacja'], ['lineups', 'Składy'], ['stats', 'Statystyki']], tab)}</div>
      <div class="card" id="mt-tabbody"></div>`;
    const sub = `${c ? c.short + ' · ' : ''}${fixtureStage(G, f)} · ${f.city}`;
    return { title: `${H.name} vs ${A.name}`, sub, back: false, body, cls: 'nofoot match-view', right: `<button class="iconbtn" id="mt-snd" data-a="mt.sound" aria-label="Dźwięk">${icon(soundOn() ? 'volume' : 'mute')}</button>` };
  },
  mount() {
    sizePitch();
    const cv = $('mt-pitch');
    if (cv) {
      if (!pitch) pitch = new Pitch2D(cv, M, { frame: onFrame });
      else pitch.attach(cv);
      pitch.setRate(SPEEDS[speed].rate);
      pitch.draw();
      window.__pitch = pitch;
    }
    window.addEventListener('resize', sizePitch);
    updateDyn();
    renderTab();
    if (finished) showFinishBanner();
    else if (M.waiting) showBreakBanner();
    else if (simBusy) showSimBanner();
    else if (playing) { ambience(true); if (pitch) pitch.play(); }
  },
  unmount() {
    window.removeEventListener('resize', sizePitch);
    if (pitch) pitch.pause();
    ambience(false);
  },
  onBack() {
    if (!M) return false;
    if (finished) return false;
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

function minText() {
  if (!M) return '';
  if (finished || M.done) return 'Koniec';
  if (M.phase === 'PEN' && M.pens) return `karne ${M.pens[0]}:${M.pens[1]}`;
  if (M.waiting) return WAIT_LABEL[M.waiting] || 'Przerwa';
  if (M.phase === 'PRE') return "0'";
  return M.minLabel();
}

function updateDyn() {
  if (!M) return;
  const sc = $('mt-sc'); if (sc) sc.textContent = `${M.sides[0].goals}:${M.sides[1].goals}`;
  const mn = $('mt-min');
  if (mn) {
    lastMin = minText();
    mn.textContent = lastMin;
    mn.classList.toggle('live', (playing || simBusy) && !finished);
  }
  const mom = $('mt-mom'); if (mom) mom.style.setProperty('--p', `${Math.round(50 + (M.mom || 0) * 50)}%`);
  const S = M.sides[us()];
  const subs = $('mt-subs'); if (subs) subs.textContent = `Zmiany: ${S.subsLeft}`;
  const pl = $('mt-play'); if (pl) pl.innerHTML = `${icon(playing ? 'pause' : 'play')}<span>${playing ? 'Pauza' : 'Graj'}</span>`;
  const sp = $('mt-speed'); if (sp) sp.innerHTML = `${icon('ff')}<span>${SPEEDS[speed].label}</span>`;
  const scr = $('mt-scorers');
  if (scr) {
    const goals = M.key.filter((k) => k.type === 'goal');
    const col = (side) => goals.filter((g) => g.side === side).map((g) => `${esc(g.pid != null ? nameOf(g.pid) : '?')} ${g.min}${g.og ? ' samobój' : g.pen ? ' karny' : ''}`).join('<br>');
    scr.innerHTML = goals.length ? `<div>${col(0)}</div><div style="text-align:right">${col(1)}</div>` : '';
  }
}

/** Co klatkę animacji: zegar, pasek przewagi, odświeżanie zakładek. */
function onFrame() {
  if (!M) return;
  const now = performance.now();
  if (minText() !== lastMin) updateDyn();
  else {
    const mom = $('mt-mom'); if (mom) mom.style.setProperty('--p', `${Math.round(50 + (M.mom || 0) * 50)}%`);
  }
  if ((tab === 'feed' && feedDirty && now - lastTabT > 350) || (tab !== 'feed' && now - lastTabT > 1500)) {
    lastTabT = now;
    renderTab();
  }
}

function numOf(side, pid) {
  const n = M.teams[side].nums[pid];
  return n != null ? `<b class="num">${n}</b>` : '';
}

const stm = (v) => `<span class="stm ${v >= 70 ? 'hi' : v >= 50 ? 'md' : 'lo'}">${Math.round(v)}%</span>`;

function renderTab() {
  const el = $('mt-tabbody');
  if (!el || !M) return;
  feedDirty = false;
  if (tab === 'feed') {
    const items = feed.slice(0, 70);
    el.innerHTML = items.length
      ? `<div class="feed">${items.map((e) => `<div class="ev ${e.kind === 'goal' ? 'goal' : ''} ${e.imp ? 'imp' : ''}"><span class="m">${esc(e.min)}</span><span class="i">${e.ic || ''}</span><span class="txt">${esc(e.text)}</span></div>`).join('')}</div>`
      : '<div class="empty">Mecz zaraz się rozpocznie.</div>';
  } else if (tab === 'lineups') {
    const col = (S) => {
      const on = S.on.filter(Boolean).sort((a, b) => POS_ORDER[a.pos] - POS_ORDER[b.pos]);
      const icons = (pid) => {
        const ps = S.ps[pid] || {};
        return `${'⚽'.repeat(ps.g || 0)}${ps.yc ? '🟨' : ''}${ps.rc ? '🟥' : ''}${ps.inj ? '✚' : ''}`;
      };
      const off = [...S.played].filter((pid) => !S.on.some((s) => s && s.pid === pid));
      const pend = new Set((S.pend || []).map((q) => q.out));
      return `<div><div class="label mb">${esc(S.name)}</div>
        ${on.map((s) => {
          const r = M.liveRating(S.idx, s.pid);
          return `<div class="lu-p">${numOf(S.idx, s.pid)}${posBadge(s.pos)}<span class="nm">${esc(s.p.ln)}${pend.has(s.pid) ? ' 🔁' : ''}</span><span>${icons(s.pid)}</span>${r != null ? matchRating(r) : ''}${stm(S.st[s.pid] ?? 0)}</div>`;
        }).join('')}
        ${off.length ? `<div class="small muted mt">Zeszli: ${off.map((pid) => esc(S.spec.players[pid].ln) + ' ' + icons(pid)).join(', ')}</div>` : ''}
        <div class="small muted mt">Ławka: ${S.bench.map((pid) => esc(S.spec.players[pid].ln)).join(', ') || ''}</div></div>`;
    };
    const u = us();
    el.innerHTML = `<div class="small muted mb">Ocena na żywo: od 7,0 zawodnik dostaje premię do umiejętności, a poniżej 6,3 karę i częściej się myli. Procent to świeżość, a zmęczenie obniża umiejętności.</div><div class="lineups one">${col(M.sides[u])}${col(M.sides[1 - u])}</div>`;
  } else {
    const r = M.result();
    const [a, b] = r.stats;
    const row = (lbl, x, y, fmt = (v) => v) => {
      const t = (x + y) || 1;
      return `<div class="lbl center small muted">${lbl}</div><div class="stat-row"><b>${fmt(x)}</b><div class="dual"><i style="width:${(x / t) * 100}%"></i><i style="width:${(y / t) * 100}%"></i></div><b>${fmt(y)}</b></div>`;
    };
    el.innerHTML = `<div class="small muted center mb">Widzów: ${(M.attendance || 0).toLocaleString('pl-PL')}</div>`
      + row('Posiadanie piłki', a.poss, b.poss, (v) => v + '%') + row('Strzały', a.shots, b.shots) + row('Strzały celne', a.sot, b.sot)
      + row('Rzuty rożne', a.corners, b.corners) + row('Faule', a.fouls, b.fouls) + row('Spalone', a.offsides, b.offsides)
      + row('Żółte kartki', a.yc, b.yc) + row('Czerwone kartki', a.rc, b.rc) + row('Oczekiwane gole xG', a.xg, b.xg, (v) => (+v).toFixed(2));
  }
}

// ---------------- komentarz i zdarzenia z silnika ----------------
function onComm(e) {
  if ((e.kind === 'assist' || e.kind === 'score') && feed[0] && feed[0].kind === 'goal') {
    feed[0] = { ...feed[0], text: `${feed[0].text} ${e.text}` };
    lastLine = feed[0].text;
  } else {
    feed.unshift(e);
    if (feed.length > 220) feed.length = 220;
    lastLine = e.text;
  }
  feedDirty = true;
  if (simBusy) return;
  const ln = $('mt-line');
  if (ln) ln.textContent = lastLine;
  if (e.kind === 'goal') {
    const bub = $('mt-bubble');
    if (bub) { bub.classList.remove('goal'); void bub.offsetWidth; bub.classList.add('goal'); }
  }
}

function onEvent(type, d) {
  if (!M) return;
  const quiet = simBusy;
  switch (type) {
    case 'goal':
      updateDyn();
      if (!quiet) { crowd(d.side === us() ? 'goal' : 'groan', 1); vib([80, 60, 160]); }
      break;
    case 'periodStart': if (!quiet) whistle('short'); updateDyn(); break;
    case 'halftime': case 'etStart': case 'etHalf': case 'pensStart':
      if (quiet) break;
      whistle('double');
      pause();
      showBreakBanner();
      break;
    case 'fulltime':
      if (quiet) break;
      whistle('end');
      finishMatch();
      break;
    case 'foul': case 'offside': if (!quiet) whistle('short'); break;
    case 'penalty': if (!quiet) whistle('long'); break;
    case 'shot': if (!quiet) kick(1); break;
    case 'pass': if (!quiet) kick(d.kind === 'air' ? 0.6 : 0.3); break;
    case 'cross': case 'clear': if (!quiet) kick(0.7); break;
    case 'save': if (!quiet) crowd('ooh', d.big ? 1 : 0.6); break;
    case 'miss': if (!quiet && (d.big || d.dist < 18)) crowd('ooh', d.big ? 1 : 0.6); break;
    case 'woodwork': if (!quiet) { post(); crowd('ooh', 1); } break;
    case 'sub': updateDyn(); refreshSubs(); break;
    case 'card': if (!quiet && d.red) crowd('groan', 0.6); break;
    case 'pk':
      updateDyn();
      if (!quiet) crowd(d.how === 'goal' ? (d.side === us() ? 'goal' : 'groan') : (d.side === us() ? 'groan' : 'goal'), 0.7);
      break;
    case 'injury':
      if (d.a && d.a.side === us() && d.needSub && !quiet && !M.done) {
        pause();
        toast(`Kontuzja: ${esc(d.a.ln)}. Wprowadź zmianę.`, 'bad');
        subSel = { out: d.a.pid, in: null };
        setTimeout(openSubs, 300);
      }
      break;
    default: break;
  }
}

function pause() {
  playing = false;
  if (pitch) pitch.pause();
  ambience(false);
  updateDyn();
}

function resume() {
  if (finished || !M || simBusy) return;
  if (M.waiting) M.resume();
  const b = $('mt-banner');
  if (b) b.innerHTML = '';
  playing = true;
  ambience(true);
  updateDyn();
  if (pitch) pitch.play();
}

function showBreakBanner() {
  const b = $('mt-banner');
  if (!b || !M) return;
  const w = M.waiting;
  const sc = `${M.sides[0].name} ${M.sides[0].goals}:${M.sides[1].goals} ${M.sides[1].name}`;
  const label = w === 'HT' ? 'Przerwa' : w === 'ETB' ? 'Remis, będzie dogrywka' : w === 'ETH' ? 'Przerwa w dogrywce' : w === 'PENB' ? 'Rzuty karne' : 'Przerwa';
  b.innerHTML = `<div class="note pitch-note"><b>${esc(label)}</b> · ${esc(sc)}<div class="small muted">Możesz teraz wprowadzić zmiany lub skorygować taktykę.</div>
    <div class="btnrow mt"><button class="btn ghost small" data-a="mt.subs">${icon('swap')} Zmiany</button><button class="btn ghost small" data-a="mt.tactics">${icon('clipboard')} Taktyka</button><button class="btn small" data-a="mt.play">${icon('play')} Wznów</button></div></div>`;
}

function showSimBanner() {
  const b = $('mt-banner');
  if (b) b.innerHTML = `<div class="note pitch-note"><b>Symulacja do końca…</b> <span id="mt-simmin">${esc(minText())}</span></div>`;
}

function finishMatch() {
  if (finished) return;
  finished = true;
  playing = false;
  ambience(false);
  if (pitch) { pitch.pause(); }
  updateDyn();
  renderTab();
  showFinishBanner();
}

function showFinishBanner() {
  const b = $('mt-banner');
  if (b) b.innerHTML = `<div class="note pitch-note"><b>Koniec meczu!</b> ${esc(M.sides[0].name)} ${M.sides[0].goals}:${M.sides[1].goals} ${esc(M.sides[1].name)}${M.pens ? `, karne ${M.pens[0]}:${M.pens[1]}` : ''}
    <div class="btnrow mt"><button class="btn" data-a="mt.summary">Podsumowanie ${icon('right')}</button></div></div>`;
}

/** Reszta meczu bez animacji, w porcjach, by nie blokować ekranu. */
async function simulateToEnd() {
  if (!M || finished || simBusy) return;
  const m = M;
  m.opts.autoSubs = m.opts.autoSubs || [false, false];
  m.opts.autoSubs[us()] = true;
  pause();
  simBusy = true;
  showSimBanner();
  while (!m.done) {
    const t0 = performance.now();
    while (!m.done && performance.now() - t0 < 35) {
      if (m.waiting) m.resume();
      m.advance(2);
    }
    const el = $('mt-simmin'); if (el) el.textContent = minText();
    updateDyn();
    await new Promise((r) => setTimeout(r, 0));
    if (m !== M) return;
  }
  simBusy = false;
  const ln = $('mt-line'); if (ln) ln.textContent = lastLine;
  finishMatch();
  if (pitch) pitch.draw();
}

// ---------------- zmiany ----------------
function subsHTML() {
  const S = M.sides[us()];
  const on = S.on.filter(Boolean).sort((a, b) => POS_ORDER[a.pos] - POS_ORDER[b.pos]);
  const outSlot = on.find((s) => s.pid === subSel.out);
  const pend = S.pend || [];
  const pendOut = new Set(pend.map((q) => q.out)), pendIn = new Set(pend.map((q) => q.in));
  const benchRows = S.bench.filter((pid) => !pendIn.has(pid)).map((pid) => {
    const p = S.spec.players[pid];
    const r = outSlot ? Math.round(slotRating(p, outSlot.pos)) : Math.round(slotRating(p, p.pos));
    return `<div class="row tap ${subSel.in === pid ? 'me' : ''}" data-a="mt.subIn" data-k="${pid}">${posBadge(p.pos)}<div class="main"><div class="t1">${esc(fullName(p))}</div><div class="t2">${outSlot ? `na pozycji ${outSlot.pos}: ${r}` : `ocena ${r}`}</div></div>${stm(p.cond ?? 95)}</div>`;
  }).join('');
  const pendHTML = pend.length ? `<div class="note small mb">🔁 Czeka na przerwę w grze: ${pend.map((q) => `${esc(S.spec.players[q.in].ln)} za ${esc(S.spec.players[q.out].ln)}`).join(', ')}</div>` : '';
  return `<p class="small muted">Pozostało zmian: <b>${S.subsLeft}</b>. Wybierz zawodnika schodzącego, a potem wchodzącego. Zmiana nastąpi przy najbliższej przerwie w grze.</p>
    ${pendHTML}
    <div class="label mb">Na boisku <span class="muted small">ocena na żywo · świeżość</span></div>
    <div class="list">${on.filter((s) => !pendOut.has(s.pid)).map((s) => {
      const ps = S.ps[s.pid] || {};
      const r = M.liveRating(S.idx, s.pid);
      return `<div class="row tap ${subSel.out === s.pid ? 'me' : ''}" data-a="mt.subOut" data-k="${s.pid}">${posBadge(s.pos)}<div class="main"><div class="t1">${esc(fullName(s.p))} ${ps.yc ? '🟨' : ''}${ps.inj ? '✚' : ''}${'⚽'.repeat(ps.g || 0)}</div></div>${r != null ? matchRating(r) : ''}${stm(S.st[s.pid] ?? 0)}</div>`;
    }).join('')}</div>
    <div class="label mb mt">Ławka</div><div class="list">${benchRows || '<div class="empty">Brak rezerwowych.</div>'}</div>
    <div class="btnrow mt"><button class="btn ghost" data-a="ui.close">Zamknij</button><button class="btn" data-a="mt.subDo" ${subSel.out && subSel.in && S.subsLeft > 0 ? '' : 'disabled'}>Wykonaj zmianę</button></div>`;
}

function openSubs() {
  if (!M || M.done || simBusy) return;
  pause();
  sheet(`<div id="subs-body">${subsHTML()}</div>`, { title: 'Zmiany' });
}

function refreshSubs() {
  const el = document.getElementById('subs-body');
  if (el && M) el.innerHTML = subsHTML();
}

function tacticsHTML() {
  const t = M.sides[us()].tac;
  const opt = (label, key, names) => `<div class="field"><span>${label}</span><div class="opt">${names.map((n, i) => `<button class="${t[key] === i ? 'on' : ''}" data-a="mt.tac" data-k="${key}" data-v="${i}">${n}</button>`).join('')}</div></div>`;
  return `<div class="field"><span>Formacja</span><div class="chips">${FORMATION_NAMES.map((f) => `<button class="chip ${f === t.f ? 'on' : ''}" data-a="mt.tacF" data-k="${f}">${f}</button>`).join('')}</div></div>
    ${opt('Styl gry', 'style', STYLE_NAMES)}${opt('Pressing', 'press', PRESS_NAMES)}${opt('Linia obrony', 'line', LINE_NAMES)}${opt('Gra na czas', 'tw', TW_NAMES)}${opt('Pułapki ofsajdowe', 'trap', TRAP_NAMES)}
    <button class="btn block" data-a="ui.close">Gotowe</button>`;
}

actions({
  'mt.play': () => {
    if (finished || simBusy) return;
    unlockAudio();
    if (playing) pause();
    else { closeOverlayIfAny(); resume(); }
  },
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
    const S = M.sides[us()];
    const outP = S.spec.players[subSel.out], inP = S.spec.players[subSel.in];
    if (M.sub(us(), subSel.out, subSel.in)) {
      const done = !S.pend.some((q) => q.in === subSel.in);
      subSel = { out: null, in: null };
      refreshSubs();
      updateDyn();
      renderTab();
      toast(done ? 'Zmiana przeprowadzona.' : `${esc(inP.ln)} za ${esc(outP.ln)}, przy najbliższej przerwie w grze.`, 'good');
    }
  },
  'mt.tactics': () => {
    if (!M || M.done || simBusy) return;
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
    if (finished || simBusy) return;
    pause();
    modal({ title: 'Symulować do końca?', body: '<p>Pozostała część meczu zostanie rozegrana bez animacji. Zmiany przeprowadzi asystent.</p>', buttons: [{ label: 'Anuluj', cls: 'ghost', a: 'ui.close' }, { label: 'Symuluj', a: 'mt.endNow' }] });
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

/** Szybka symulacja meczu (bez oglądania), w porcjach, z postępem na ekranie. */
export async function quickSim(f, onProgress) {
  const m = prepareMatch(f, { quick: true });
  while (!m.done) {
    const t0 = performance.now();
    while (!m.done && performance.now() - t0 < 35) {
      if (m.waiting) m.resume();
      m.advance(2);
    }
    if (onProgress) onProgress(m);
    await new Promise((r) => setTimeout(r, 0));
  }
  lastInfo = completeUserMatch(m);
  return lastInfo;
}

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
    const scList = (l) => l.map((s) => `${esc(s.n)} ${s.m}${s.pen ? ' karny' : ''}${s.og ? ' samobój' : ''}`).join('<br>') || '';
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
    const othersHTML = others.length ? `<div class="card"><div class="card-h"><h3>Inne wyniki</h3></div>${others.map((x) => `<div class="fx-row"><span class="d">${esc(G.comps[x.comp]?.short || '')}</span><span class="teams">${flag(x.h)}<span class="tn">${esc(natName(x.h))}</span><span class="muted">vs</span>${flag(x.a)}<span class="tn">${esc(natName(x.a))}</span></span><span class="r">${x.res.hg}:${x.res.ag}${x.res.pens ? '*' : ''}</span></div>`).join('')}</div>` : '';
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

// Ekran tytułowy, nowa gra, wczytywanie, informacje o grze.
import { screen, actions, go, reset, rerender, busy, toast, flag, natStars, esc, icon, chips, confirmBox, seg, modal, closeOverlay } from '../ui.js';
import { NATIONS, NAT, CONFS, CONF_ORDER, starsFor } from '../../data/nations.js';
import { newGame, G } from '../../engine/game.js';
import { slotMeta, SLOTS, getEdits, deleteSlot, lsGet, lsSet } from '../../core/storage.js';
import { loadGame, autosave } from '../session.js';
import { fmtDateLong, fmtDate } from '../../core/util.js';
import { nextEvent } from '../flow.js';

export const VERSION = '0.9.7';

export const LOGO = '<img class="logo-img" src="img/logo.png" alt="Selekcjoner" draggable="false">';

let metas = null;
async function loadMetas() {
  const out = {};
  for (const s of SLOTS) out[s] = await slotMeta(s);
  metas = out;
}

screen('menu', {
  render() {
    if (!metas) loadMetas().then(() => rerender());
    const auto = metas && metas.auto;
    const autoNat = auto ? auto.nat || auto.lastNat : null;
    return {
      noHeader: true, cls: 'nofoot', appCls: 'title-app',
      body: `<div class="title-screen">
        <div class="logo">${LOGO}<div class="tagline">Menedżer reprezentacji narodowej</div></div>
        <div class="menu-btns">
          ${G ? `<button class="btn" data-a="menu.resume">${icon('play')}<span class="continue-card">Wróć do gry<small>${G.user.nat ? esc(NAT[G.user.nat].name) : 'Bez pracy'} · ${fmtDate(G.day)}</small></span></button>` : ''}
          ${!G && auto ? `<button class="btn" data-a="menu.continue">${icon('play')}<span class="continue-card">Kontynuuj<small>${autoNat ? NAT[autoNat].flag + ' ' + esc(NAT[autoNat].name) : ''} · ${fmtDate(auto.day)}</small></span></button>` : ''}
          <button class="btn ${G || auto ? 'ghost' : ''}" data-a="menu.new">${icon('ball')}Nowa gra</button>
          <button class="btn ghost" data-a="go" data-k="cstart">${icon('user')}Tryb zawodnika</button>
          <button class="btn ghost" data-a="menu.load">${icon('save')}Wczytaj grę</button>
          <button class="btn ghost" data-a="menu.editor">${icon('pencil')}Edytor zawodników</button>
          <button class="btn ghost" data-a="menu.ach">${icon('star')}Osiągnięcia</button>
          <button class="btn ghost" data-a="guide.open">${icon('help')}Poradnik</button>
          <button class="btn ghost" data-a="menu.about">${icon('info')}O grze</button>
        </div>
        <div class="ver">wersja ${VERSION}</div>
      </div>`,
    };
  },
});

// ---------------- samouczek ----------------
const TUT = [
  { t: 'Witaj, selekcjonerze!', b: 'Przejmujesz reprezentację na kilka tygodni przed pierwszym zgrupowaniem. Czas w grze płynie po naciśnięciu przycisku <b>Dalej</b>: gra sama zatrzyma się przy każdym ważnym wydarzeniu: powołaniach, meczach, konferencjach i telefonach od dziennikarzy.' },
  { t: 'Powołania i skład', b: 'Przed każdym zgrupowaniem ogłaszasz kadrę: 23 zawodników, a na turniej 26. Przed meczem ustawiasz wyjściową jedenastkę, dotknij zawodnika na boisku, aby go zmienić. Pasek pod żetonem pokazuje kondycję, a <b>Raport asystenta</b> podpowie, kogo warto oszczędzać.' },
  { t: 'Zaufanie i cele', b: 'Federacja stawia cele w każdych rozgrywkach. Wyniki, decyzje kadrowe i odpowiedzi na konferencjach wpływają na zaufanie federacji, kibiców, piłkarzy i mediów. Gdy zaufanie federacji spadnie zbyt nisko, stracisz pracę i poczekasz na oferty innych krajów.' },
];
const tut = { step: 0, fromAbout: false };
export function showTutorial(fromAbout = false) {
  tut.step = 0;
  tut.fromAbout = fromAbout;
  openTut();
}
function openTut() {
  const s = TUT[tut.step];
  const last = tut.step === TUT.length - 1;
  modal({
    title: s.t,
    body: `<div class="qprog">${TUT.map((_, i) => `<i class="${i <= tut.step ? 'on' : ''}"></i>`).join('')}</div><p>${s.b}</p>`,
    dismiss: false,
    buttons: [{ label: 'Pomiń', cls: 'ghost', a: 'tut.end' }, { label: last ? 'Zaczynamy!' : 'Dalej', a: last ? 'tut.end' : 'tut.next' }],
  });
}

// ---------------- nowa gra ----------------
const ng = { conf: 'EU', nat: 'POL', name: '', db: 'edited', diff: 1 };

screen('newgame', {
  render() {
    const list = NATIONS.filter((n) => n.conf === ng.conf).sort((a, b) => a.name.localeCompare(b.name, 'pl'));
    const sel = NAT[ng.nat];
    const edits = Object.keys(getEdits()).length;
    return {
      title: 'Nowa gra', sub: 'Wybierz reprezentację',
      body: `
      ${chips('ng.conf', CONF_ORDER.map((c) => [c, CONFS[c].name]), ng.conf)}
      <div class="card tight"><div class="list">
        ${list.map((n) => `<div class="row tap ${n.id === ng.nat ? 'me' : ''}" data-a="ng.nat" data-k="${n.id}">
          <span class="flag" style="font-size:28px">${n.flag}</span>
          <div class="main"><div class="t1">${esc(n.name)}</div><div class="t2">${natStars(n.id)}</div></div>
          ${n.id === ng.nat ? `<span class="toggle on">${icon('check')}</span>` : ''}
        </div>`).join('')}
      </div></div>
      <div class="card">
        <div class="card-h"><h3>Twoja kariera</h3></div>
        <label class="field"><span>Imię i nazwisko selekcjonera</span><input class="input" data-input="ng.name" maxlength="40" placeholder="np. Jan Kowalski" value="${esc(ng.name)}"></label>
        <div class="field"><span>Baza zawodników</span>
          <div class="opt">
            <button class="${ng.db === 'edited' ? 'on' : ''}" data-a="ng.db" data-k="edited">Domyślna${edits ? `, ${edits} edycji` : ''}</button>
            <button class="${ng.db === 'random' ? 'on' : ''}" data-a="ng.db" data-k="random">Losowa nowa</button>
          </div>
        </div>
        <div class="field"><span>Poziom trudności</span>
          <div class="opt">
            ${['Łagodny', 'Normalny', 'Wymagający'].map((t, i) => `<button class="${ng.diff === i ? 'on' : ''}" data-a="ng.diff" data-k="${i}">${t}</button>`).join('')}
          </div>
        </div>
      </div>`,
      foot: `<button class="btn block" data-a="ng.start">${sel.flag}&nbsp; Start: ${esc(sel.name)}</button>`,
    };
  },
});

// ---------------- wczytywanie ----------------
screen('load', {
  render() {
    if (!metas) { loadMetas().then(() => rerender()); return { title: 'Wczytaj grę', body: '<div class="empty">Wczytywanie…</div>', cls: 'nofoot' }; }
    const rows = SLOTS.map((s) => {
      const m = metas[s];
      const label = s === 'auto' ? 'Autozapis' : `Slot ${s}`;
      if (!m) return `<div class="row dim"><div class="main"><div class="t1">${label}</div><div class="t2">pusty</div></div></div>`;
      const nat = m.nat || m.lastNat;
      return `<div class="row tap" data-a="load.slot" data-k="${s}">
        <span class="flag" style="font-size:28px">${nat ? NAT[nat].flag : '💼'}</span>
        <div class="main"><div class="t1">${label}: ${esc(m.manager || '')}</div><div class="t2">${nat ? esc(NAT[nat].name) : ''}${m.unemployed ? ', bez pracy' : ''} · ${fmtDateLong(m.day)}</div><div class="t2">zapisano ${new Date(m.saved).toLocaleString('pl-PL')}</div></div>
        <button class="iconbtn" data-a="load.del" data-k="${s}" aria-label="Usuń">${icon('trash')}</button>
      </div>`;
    }).join('');
    return { title: 'Wczytaj grę', body: `<div class="card tight"><div class="list">${rows}</div></div>`, cls: 'nofoot' };
  },
});

screen('about', {
  render() {
    return {
      title: 'O grze', cls: 'nofoot',
      body: `<div class="card center">${LOGO.replace('<img', '<img style="width:110px;height:110px"')}<h2 class="mt">Selekcjoner</h2><div class="muted">wersja ${VERSION}</div></div>
      <div class="card"><p>Wciel się w selekcjonera reprezentacji narodowej. Powołuj zawodników, ustalaj taktykę i trening, prowadź drużynę w Lidze Narodów, eliminacjach i turniejach finałowych. Dbaj o zaufanie federacji, kibiców, piłkarzy i mediów.</p>
      <p class="small muted">Wszyscy zawodnicy, kluby i dziennikarze są fikcyjni, nazwiska generowane są losowo. W edytorze możesz zmienić dane zawodników według własnego uznania.</p></div>
      <div class="card"><div class="card-h"><h3>Jak grać</h3></div>
      <button class="btn ghost small mb" data-a="menu.tutorial">${icon('help')} Pokaż samouczek</button>
      <p class="small">• Przycisk <b>Dalej</b> przesuwa czas do kolejnego ważnego wydarzenia.<br>• Przed każdym zgrupowaniem ogłaszasz powołania: 23 zawodników, a na turniej 26.<br>• Przed meczem ustaw wyjściową jedenastkę i polecenia. Mecz możesz oglądać na żywo i reagować zmianami.<br>• Odpowiedzi na konferencjach wpływają na zaufanie mediów, kibiców, piłkarzy i federacji.<br>• Zbyt niskie zaufanie federacji kończy się zwolnieniem, wtedy czekasz na oferty innych krajów.</p></div>`,
    };
  },
});

actions({
  'menu.new': () => go('newgame'),
  'menu.tutorial': () => showTutorial(true),
  'tut.next': () => { closeOverlay(); tut.step++; setTimeout(openTut, 160); },
  'tut.end': () => {
    closeOverlay();
    lsSet('tutorial', true);
    if (!tut.fromAbout) nextEvent();
  },
  'menu.load': () => { metas = null; go('load'); },
  'menu.editor': () => go('editor'),
  'menu.ach': () => go('achievements'),
  'menu.about': () => go('about'),
  'menu.resume': () => { reset('home'); nextEvent(); },
  'menu.continue': async () => {
    busy(true, 'Wczytywanie…');
    const ok = await loadGame('auto');
    busy(false);
    if (!ok) { toast('Nie udało się wczytać zapisu.', 'bad'); return; }
    reset('home');
    nextEvent();
  },
  'ng.conf': (d) => { ng.conf = d.k; const first = NATIONS.filter((n) => n.conf === d.k).sort((a, b) => a.name.localeCompare(b.name, 'pl'))[0]; if (NAT[ng.nat].conf !== d.k) ng.nat = first.id; rerender(); },
  'ng.nat': (d) => { ng.nat = d.k; rerender(); },
  'ng.name': (d, el) => { ng.name = el.value; },
  'ng.db': (d) => { ng.db = d.k; rerender(); },
  'ng.diff': (d) => { ng.diff = +d.k; rerender(); },
  'ng.start': async () => {
    if (G) {
      const ok = await confirmBox('Rozpocząć nową grę? Niezapisany postęp obecnej kariery zostanie utracony.', 'Nowa gra', 'Anuluj', true);
      if (!ok) return;
    }
    busy(true, 'Tworzenie świata piłkarskiego…');
    setTimeout(() => {
      try {
        newGame({ nat: ng.nat, manager: (ng.name || '').trim() || 'Selekcjoner', useEdited: ng.db === 'edited', overrides: getEdits(), diff: ng.diff });
      } catch (e) {
        console.error(e);
        busy(false);
        toast('Błąd tworzenia gry: ' + esc(e.message), 'bad');
        return;
      }
      busy(false);
      metas = null;
      autosave(true);
      reset('home');
      if (!lsGet('tutorial', false)) showTutorial();
      else nextEvent();
    }, 40);
  },
  'load.slot': async (d) => {
    if (G) {
      const ok = await confirmBox('Wczytać zapis? Niezapisany postęp obecnej gry zostanie utracony.', 'Wczytaj');
      if (!ok) return;
    }
    busy(true, 'Wczytywanie…');
    const ok = await loadGame(d.k);
    busy(false);
    if (!ok) { toast('Nie udało się wczytać zapisu.', 'bad'); return; }
    reset('home');
    nextEvent();
  },
  'load.del': async (d, el, e) => {
    e.stopPropagation();
    const ok = await confirmBox('Usunąć ten zapis?', 'Usuń', 'Anuluj', true);
    if (!ok) return;
    await deleteSlot(d.k);
    metas = null;
    rerender();
  },
});

export function invalidateMetas() { metas = null; }

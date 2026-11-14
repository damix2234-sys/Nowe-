// Przepływ gry: przycisk „Dalej” i obsługa zdarzeń z kolejki.
import { G, advance, me, natName, answerInvite, answerContract, acceptOffer, declineOffer, removeEvent, confirmCallup, userSquadPlayers } from '../engine/game.js';
import { NAT } from '../data/nations.js';
import { fmtDateLong, plural } from '../core/util.js';
import { rankPositions } from '../engine/ranking.js';
import { go, reset, modal, closeOverlay, busy, toast, rerender, actions, flag, natStars, esc, current, confirmBox } from './ui.js';
import { autosave } from './session.js';

let curEv = null;

export function doAdvance() {
  if (!G) return;
  if (G.queue.length) { openEvent(G.queue[0]); return; }
  busy(true, 'Mija czas…');
  setTimeout(() => {
    let s;
    try { s = advance(); } catch (e) { console.error(e); busy(false); toast('Błąd symulacji: ' + esc(e.message), 'bad'); return; }
    busy(false);
    handleStop(s);
  }, 30);
}

export function handleStop(s) {
  if (s.type === 'match') { autosave(); go('prematch', { fx: s.fx.id }); return; }
  if (s.type === 'event') { openEvent(s.ev); return; }
  rerender();
}

/** Otwiera kolejne zdarzenie z kolejki (wywoływane po zamknięciu poprzedniego). */
export function nextEvent() {
  if (!G) return;
  if (!current() || current().name !== 'home') reset('home');
  else rerender();
  if (G.queue.length) setTimeout(() => openEvent(G.queue[0]), 120);
  else autosave();
}

export function openEvent(ev) {
  curEv = ev;
  switch (ev.type) {
    case 'callup': return callupModal(ev);
    case 'press':
    case 'journalist': return go('press');
    case 'friendlyInvite': return inviteModal(ev);
    case 'offer': return offerModal(ev);
    case 'contract': return contractModal(ev);
    case 'sacked': return sackedModal(ev);
    default:
      removeEvent(ev);
      return nextEvent();
  }
}

export function squadValid(ids, size) {
  const ps = ids.map((id) => G.players[id]).filter(Boolean);
  const gk = ps.filter((p) => p.pos === 'GK').length;
  const fit = ps.filter((p) => !p.inj && !p.susp).length;
  if (ps.length < 18) return 'Powołaj co najmniej 18 zawodników.';
  if (ps.length > size) return `Limit to ${size} zawodników.`;
  if (gk < 2) return 'Potrzebujesz co najmniej dwóch bramkarzy.';
  if (fit < 14) return 'Zbyt wielu kontuzjowanych lub zawieszonych zawodników.';
  return null;
}

function callupModal(ev) {
  const err = squadValid(G.team.squad, ev.size);
  modal({
    title: ev.title,
    body: `<p>Czas ogłosić powołania. ${ev.n ? `Na zgrupowaniu rozegramy ${ev.n} ${plural(ev.n, 'mecz', 'mecze', 'meczów')}.` : ''} Limit: <b>${ev.size}</b> zawodników.</p>
      ${ev.note ? `<p class="small muted">${esc(ev.note)}</p>` : ''}
      ${err ? `<p class="small" style="color:#ff9a9a">Obecna kadra wymaga zmian: ${err}</p>` : '<p class="small muted">Możesz zatwierdzić obecną kadrę albo wprowadzić zmiany.</p>'}`,
    dismiss: false,
    buttons: [
      ...(err ? [] : [{ label: 'Zatwierdź obecną', cls: 'ghost', a: 'flow.callupKeep' }]),
      { label: 'Powołania', a: 'flow.callupGo' },
    ],
  });
}

function inviteModal(ev) {
  const pos = rankPositions(G)[ev.from];
  modal({
    head: `<div class="m-head">${flag(ev.from, 'xl')}<div><div class="label">Zaproszenie</div><b>${esc(natName(ev.from))}</b><div>${natStars(ev.from)}</div></div></div>`,
    title: 'Mecz towarzyski',
    body: `<p>Federacja (${esc(natName(ev.from))}) proponuje rozegranie meczu towarzyskiego <b>${fmtDateLong(ev.d)}</b> ${ev.home ? 'na naszym stadionie' : 'na wyjeździe'}.</p><p class="small muted">Rywal zajmuje ${pos}. miejsce w rankingu światowym.</p>`,
    dismiss: false,
    buttons: [{ label: 'Odrzuć', cls: 'ghost', a: 'flow.invite', x: { v: 0 } }, { label: 'Przyjmij', a: 'flow.invite', x: { v: 1 } }],
  });
}

function offerModal(ev) {
  const n = NAT[ev.nat];
  const pos = rankPositions(G)[ev.nat];
  modal({
    head: `<div class="m-head">${flag(ev.nat, 'xl')}<div><div class="label">Oferta pracy</div><b>${esc(n.name)}</b><div>${natStars(ev.nat)}</div></div></div>`,
    title: 'Propozycja objęcia kadry',
    body: `<p>Federacja (${esc(n.name)}) szuka nowego selekcjonera i składa Panu ofertę pracy.</p><p class="small muted">Ranking światowy: ${pos}. miejsce · ${esc(natName(ev.nat))} ${me() ? '· przyjęcie oznacza odejście z obecnej kadry' : ''}</p>`,
    dismiss: false,
    buttons: [{ label: 'Odrzuć', cls: 'ghost', a: 'flow.offer', x: { v: 'no' } }, { label: 'Później', cls: 'ghost', a: 'flow.offer', x: { v: 'later' } }, { label: 'Przyjmij', a: 'flow.offer', x: { v: 'yes' } }],
  });
}

function contractModal(ev) {
  modal({
    title: 'Koniec kontraktu',
    body: ev.offer
      ? '<p>Pana umowa dobiega końca. Zarząd jest zadowolony ze współpracy i proponuje przedłużenie kontraktu na kolejny cykl (do końca następnego turnieju).</p>'
      : '<p>Pana umowa dobiega końca. Zarząd federacji zdecydował, że nie przedłuży kontraktu. Dziękujemy za współpracę.</p>',
    dismiss: false,
    buttons: ev.offer
      ? [{ label: 'Odejdź', cls: 'ghost', a: 'flow.contract', x: { v: 0 } }, { label: 'Przedłuż', a: 'flow.contract', x: { v: 1 } }]
      : [{ label: 'Rozumiem', a: 'flow.contract', x: { v: 0 } }],
  });
}

function sackedModal(ev) {
  modal({
    head: `<div class="m-head">${flag(ev.nat, 'xl')}<div><div class="label">Zwolnienie</div><b>${esc(natName(ev.nat))}</b></div></div>`,
    title: 'Koniec pracy',
    body: '<p>Zarząd federacji rozwiązał z Panem umowę ze skutkiem natychmiastowym. Wyniki nie spełniły oczekiwań.</p><p class="small muted">Możesz czekać na oferty od innych federacji – czas płynie po naciśnięciu „Dalej”.</p>',
    dismiss: false,
    buttons: [{ label: 'Rozumiem', a: 'flow.sacked' }],
  });
}

actions({
  'flow.advance': () => doAdvance(),
  'flow.callupKeep': () => {
    confirmCallup(curEv, G.team.squad.slice());
    closeOverlay();
    toast('Powołania zatwierdzone.', 'good');
    nextEvent();
  },
  'flow.callupGo': () => {
    closeOverlay();
    go('squad', { mode: 'callup', tab: 'called' });
  },
  'flow.invite': (d) => {
    answerInvite(curEv, d.v === '1');
    closeOverlay();
    if (d.v === '1') toast('Mecz towarzyski umówiony.', 'good');
    nextEvent();
  },
  'flow.offer': async (d) => {
    const ev = curEv;
    if (d.v === 'yes') {
      if (me()) {
        closeOverlay();
        const ok = await confirmBox(`Czy na pewno chcesz objąć reprezentację (${esc(natName(ev.nat))})? Opuścisz obecną kadrę.`, 'Przyjmuję');
        if (!ok) { openEvent(ev); return; }
      } else closeOverlay();
      acceptOffer(ev.nat);
      toast(`Nowa praca: ${esc(natName(ev.nat))}!`, 'good');
      reset('home');
      nextEvent();
      return;
    }
    if (d.v === 'no') declineOffer(ev.nat);
    else removeEvent(ev);
    closeOverlay();
    nextEvent();
  },
  'flow.contract': (d) => {
    answerContract(curEv, d.v === '1');
    closeOverlay();
    nextEvent();
  },
  'flow.sacked': () => {
    removeEvent(curEv);
    closeOverlay();
    reset('home');
    nextEvent();
  },
});

export function squadPlayers() { return userSquadPlayers(); }

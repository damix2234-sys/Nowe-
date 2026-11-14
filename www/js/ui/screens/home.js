// Pulpit menedżera.
import { screen, actions, go, reset, rerender, flag, team, esc, icon, seg, bar, resChip, confirmBox, modal, av, toast } from '../ui.js';
import { G, me, natName, nextUserFixture, userFixtures, senderName, trustLabel, nextWindow, acceptOffer, declineOffer } from '../../engine/game.js';
import { NAT } from '../../data/nations.js';
import { fmtDateLong, fmtDateShort, fmtDate, plural, hashStr } from '../../core/util.js';
import { fixtureStage } from '../../engine/comps.js';
import { rankPositions } from '../../engine/ranking.js';
import { WINDOW_NAMES } from '../../engine/comps.js';

const ui = { tab: 'fx' };

function fxLine(f) {
  const c = G.comps[f.comp];
  const res = f.res ? `${f.res.hg}:${f.res.ag}${f.res.pens ? '*' : ''}` : '–:–';
  let chip = '';
  if (f.res) {
    const m = me() || G.user.spells.length && G.user.spells[G.user.spells.length - 1].nat;
    const us = f.h === m ? 0 : 1;
    const gf = us === 0 ? f.res.hg : f.res.ag, ga = us === 0 ? f.res.ag : f.res.hg;
    chip = resChip(gf > ga ? 'W' : gf < ga ? 'L' : 'D');
  }
  return `<div class="fx-row"><span class="d">${fmtDateShort(f.d)}</span>
    <span class="teams">${flag(f.h)}<span class="tn">${esc(natName(f.h))}</span><span class="muted">–</span>${flag(f.a)}<span class="tn">${esc(natName(f.a))}</span></span>
    <span class="row-flex"><span class="tag">${esc(c ? c.short : '')}</span><span class="r">${res}</span>${chip}</span></div>`;
}

function trustCard() {
  const t = G.trust;
  const row = (k, label) => `<div class="trust-row"><span>${label}</span>${bar(t[k])}<b>${Math.round(t[k])}</b></div>`;
  return `<div class="card" data-a="go" data-k="federation">
    <div class="card-h"><h3>Zaufanie</h3><span class="small muted">federacja: ${trustLabel(t.fed)}</span></div>
    ${row('fed', 'Federacja')}${row('fans', 'Kibice')}${row('pl', 'Piłkarze')}${row('media', 'Media')}
  </div>`;
}

function nextMatchCard() {
  const f = nextUserFixture();
  if (!f) {
    const w = nextWindow(G.day);
    return `<div class="card next-match"><div class="card-h"><h3>Następny mecz</h3></div><div class="muted">Brak zaplanowanych meczów.${w ? ` Najbliższe zgrupowanie (${WINDOW_NAMES[w.key]}): ${fmtDateLong(w.days[0])}.` : ''}</div>
      <div class="mt"><button class="btn small ghost" data-a="go" data-k="friendlies">${icon('handshake')} Umów mecz towarzyski</button></div></div>`;
  }
  const c = G.comps[f.comp];
  const days = f.d - G.day;
  const cd = days === 0 ? 'dzisiaj' : days === 1 ? 'jutro' : `za ${days} ${plural(days, 'dzień', 'dni', 'dni')}`;
  return `<div class="card next-match" data-a="go" data-k="opponents">
    <div class="card-h"><h3>Następny mecz</h3><span class="countdown">${cd}</span></div>
    <div class="vs">
      <div>${flag(f.h)}<div class="nm">${esc(natName(f.h))}</div></div>
      <div class="mid">${esc(c ? c.short : '')}<br><span class="small">${esc(fixtureStage(G, f))}</span></div>
      <div>${flag(f.a)}<div class="nm">${esc(natName(f.a))}</div></div>
    </div>
    <div class="meta"><span>${fmtDateLong(f.d)}</span><span>${esc(f.city)}${f.neutral ? ' (teren neutralny)' : ''}</span></div>
  </div>`;
}

function tabsCard() {
  const unread = G.msgs.filter((m) => !m.read).length;
  let body = '';
  if (ui.tab === 'fx') {
    const all = userFixtures();
    const past = all.filter((f) => f.res).slice(-3);
    const fut = all.filter((f) => !f.res).slice(0, 5);
    body = (past.length || fut.length) ? past.map(fxLine).join('') + fut.map(fxLine).join('') : '<div class="empty">Brak meczów w terminarzu.</div>';
  } else if (ui.tab === 'msg') {
    const list = G.msgs.slice(0, 5);
    body = list.length ? list.map((m) => `<div class="row tap ${m.read ? '' : 'unread'}" data-a="msg.open" data-k="${m.id}">
      <span class="tag">${fmtDateShort(m.d)}</span><div class="main"><div class="t1">${esc(m.subj)}</div><div class="t2">${esc(senderName(m.from))}</div></div>${m.read ? '' : '<span class="tag acc">nowa</span>'}</div>`).join('')
      + `<div class="mt"><button class="btn small ghost block" data-a="go" data-k="messages">Wszystkie wiadomości</button></div>` : '<div class="empty">Brak wiadomości.</div>';
  } else {
    const objs = G.objectives.filter((o) => o.nat === me()).slice(-6).reverse();
    body = objs.length ? objs.map((o) => `<div class="row"><span class="tag ${o.status === 'ok' ? 'acc' : o.status === 'fail' ? 'red' : 'gold'}">${o.status === 'ok' ? 'zrealizowany' : o.status === 'fail' ? 'porażka' : 'w toku'}</span><div class="main"><div class="t1 wrap">${esc(o.text)}</div><div class="t2">${esc(o.cname)}</div></div></div>`).join('') : '<div class="empty">Federacja nie postawiła jeszcze celów.</div>';
  }
  return `<div class="card">${seg('home.tab', [['fx', 'Terminarz'], ['msg', `Wiadomości${unread ? ` (${unread})` : ''}`], ['obj', 'Cele']], ui.tab)}${body}</div>`;
}

function tile(k, ic, label, color = '', badge = 0) {
  return `<button class="tile" data-a="go" data-k="${k}"><span class="ic-wrap ${color}">${icon(ic)}</span>${label}${badge ? `<span class="badge">${badge}</span>` : ''}</button>`;
}

function unemployedCard() {
  const offers = G.offers.filter((o) => o.until >= G.day);
  return `<div class="card"><div class="card-h"><h3>Bez pracy</h3><span class="tag gold">reputacja ${Math.round(G.user.rep)}</span></div>
    <p class="small muted">Obecnie nie prowadzisz żadnej reprezentacji. Naciskaj „Dalej”, aby czekać na oferty od federacji. Im wyższa reputacja, tym mocniejsze kadry się zgłoszą.</p>
    ${offers.length ? offers.map((o) => `<div class="row"><span class="flag" style="font-size:28px">${NAT[o.nat].flag}</span><div class="main"><div class="t1">${esc(natName(o.nat))}</div><div class="t2">oferta ważna do ${fmtDate(o.until)}</div></div><button class="btn small" data-a="home.offerYes" data-k="${o.nat}">Przyjmij</button></div>`).join('') : '<div class="empty">Brak ofert.</div>'}
  </div>`;
}

screen('home', {
  render() {
    if (!G) return { title: 'Selekcjoner', body: '<div class="empty">Brak aktywnej gry.</div>', cls: 'nofoot' };
    const m = me();
    const unread = G.msgs.filter((x) => !x.read).length;
    const offers = G.offers.filter((o) => o.until >= G.day).length;
    const pos = m ? rankPositions(G)[m] : null;
    const right = `<button class="iconbtn" data-a="go" data-k="messages" aria-label="Wiadomości" style="position:relative">${icon('mail')}${unread ? `<span class="badge" style="top:2px;right:2px">${unread}</span>` : ''}</button><button class="iconbtn" data-a="go" data-k="settings" aria-label="Ustawienia">${icon('gear')}</button>`;
    let body = '';
    if (m) {
      body += `<div class="dash-head">${flag(m)}<div class="grow"><div class="date">${fmtDateLong(G.day)}</div><div class="small muted">${esc(natName(m))} · ${pos}. w rankingu · ${esc(G.user.name)}</div></div></div>`;
      body += nextMatchCard();
      body += trustCard();
      body += tabsCard();
      body += `<div class="tiles">
        ${tile('squad', 'users', 'Kadra')}
        ${tile('tactics', 'clipboard', 'Taktyka')}
        ${tile('training', 'dumbbell', 'Trening')}
        ${tile('opponents', 'binoculars', 'Przeciwnicy')}
        ${tile('comps', 'trophy', 'Rozgrywki', 'gold')}
        ${tile('friendlies', 'handshake', 'Towarzyskie')}
        ${tile('u21', 'sprout', 'Kadra U-21')}
        ${tile('federation', 'building', 'Federacja', 'blue')}
        ${tile('ranking', 'globe', 'Ranking', 'blue')}
        ${tile('stats', 'chart', 'Statystyki', 'blue')}
        ${tile('offers', 'briefcase', 'Oferty pracy', 'gold', offers)}
        ${tile('achievements', 'star', 'Osiągnięcia', 'gold')}
        ${tile('messages', 'mail', 'Wiadomości', '', unread)}
        ${tile('save', 'save', 'Zapisz grę')}
        ${tile('settings', 'gear', 'Ustawienia')}
        <button class="tile" data-a="home.menu"><span class="ic-wrap red">${icon('exit')}</span>Menu główne</button>
      </div>`;
    } else {
      body += `<div class="dash-head"><span class="flag">💼</span><div class="grow"><div class="date">${fmtDateLong(G.day)}</div><div class="small muted">${esc(G.user.name)} · bez pracy</div></div></div>`;
      body += unemployedCard();
      body += tabsCard();
      body += `<div class="tiles">
        ${tile('offers', 'briefcase', 'Oferty pracy', 'gold', offers)}
        ${tile('comps', 'trophy', 'Rozgrywki', 'gold')}
        ${tile('ranking', 'globe', 'Ranking', 'blue')}
        ${tile('stats', 'chart', 'Statystyki', 'blue')}
        ${tile('achievements', 'star', 'Osiągnięcia', 'gold')}
        ${tile('messages', 'mail', 'Wiadomości', '', unread)}
        ${tile('save', 'save', 'Zapisz grę')}
        ${tile('settings', 'gear', 'Ustawienia')}
        <button class="tile" data-a="home.menu"><span class="ic-wrap red">${icon('exit')}</span>Menu główne</button>
      </div>`;
    }
    return {
      title: 'Pulpit', sub: m ? `Selekcjoner: ${esc(natName(m))}` : 'Bez pracy', back: false, right, body,
      foot: `<button class="btn block advance-btn" data-a="flow.advance">Dalej ${icon('right')}</button>`,
    };
  },
});

// ---------------- wiadomości ----------------
function senderAvatar(from) {
  if (!G.staff) return av(hashStr(from));
  if (from === 'president') return av(hashStr(G.staff.president.ln + 'p'), { old: true, shirt: '#1f2937', glasses: 0.3 });
  if (from === 'assistant') return av(hashStr(G.staff.assistant.ln + 'a'), { shirt: '#3d7bff' });
  if (from === 'doctor') return av(hashStr(G.staff.doctor.ln + 'd'), { shirt: '#e8eef0', glasses: 0.5 });
  return av(hashStr(from), { shirt: '#c6f432' });
}

screen('messages', {
  render() {
    const list = G.msgs;
    return {
      title: 'Wiadomości', sub: `${list.filter((m) => !m.read).length} nieprzeczytanych`, cls: 'nofoot',
      right: `<button class="iconbtn" data-a="msg.readAll" aria-label="Oznacz wszystkie">${icon('check')}</button>`,
      body: list.length ? `<div class="card tight"><div class="list">${list.map((m) => `<div class="row tap ${m.read ? '' : 'unread'}" data-a="msg.open" data-k="${m.id}">
        <div class="main"><div class="t1">${m.important ? '❗ ' : ''}${esc(m.subj)}</div><div class="t2">${fmtDate(m.d)} · ${esc(senderName(m.from))}</div></div>${icon('right')}</div>`).join('')}</div></div>` : '<div class="empty">Brak wiadomości.</div>',
    };
  },
});

actions({
  go: (d) => go(d.k),
  'home.tab': (d) => { ui.tab = d.k; rerender(); },
  'home.menu': async () => {
    const ok = await confirmBox('Wrócić do menu głównego? Gra zostanie zapisana w slocie autozapisu.', 'Menu główne');
    if (!ok) return;
    const { autosave } = await import('../session.js');
    autosave(true);
    reset('menu');
  },
  'home.offerYes': async (d) => {
    acceptOffer(d.k);
    toast(`Nowa praca: ${esc(natName(d.k))}!`, 'good');
    const { nextEvent } = await import('../flow.js');
    reset('home');
    nextEvent();
  },
  'msg.open': (d) => {
    const m = G.msgs.find((x) => x.id === +d.k);
    if (!m) return;
    m.read = true;
    modal({
      head: `<div class="m-head">${senderAvatar(m.from)}<div><div class="label">${fmtDateLong(m.d)}</div><b>${esc(senderName(m.from))}</b></div></div>`,
      title: esc(m.subj), body: `<div class="pre">${esc(m.body)}</div>`,
      buttons: [{ label: 'Zamknij', cls: 'ghost', a: 'ui.close' }],
      onClose: () => rerender(),
    });
  },
  'msg.readAll': () => { G.msgs.forEach((m) => { m.read = true; }); rerender(); },
});

export { senderAvatar };

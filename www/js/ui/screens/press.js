// Konferencje prasowe i telefony od dziennikarzy.
import { screen, actions, rerender, esc, av, toast, empty } from '../ui.js';
import { G, answerPress, answerGreeting, removeEvent } from '../../engine/game.js';
import { fullName } from '../../data/names.js';
import { nextEvent } from '../flow.js';

const ps = { ev: null, step: 0, sel: [], greeted: false, pick: null };

function curEvent() {
  const ev = G.queue.find((e) => e.type === 'press' || e.type === 'journalist');
  if (ev !== ps.ev) { ps.ev = ev; ps.step = 0; ps.sel = []; ps.greeted = false; ps.pick = null; }
  return ev;
}

function journalistCard(ev) {
  const j = G.journalists[ev.j] || G.journalists[0];
  if (!j) return '';
  return `<div class="press-card">${av(j.seed, { glasses: 0.45 })}<div><div class="t1"><b>${esc(fullName(j))}</b></div><div class="small muted">Dziennikarz · ${esc(j.outlet)}</div></div></div>`;
}

const fmtEff = (s) => {
  const lbl = { fans: 'kibice', media: 'media', pl: 'piłkarze', fed: 'federacja' };
  return Object.entries(s).filter(([, v]) => v).map(([k, v]) => `${lbl[k]} ${v > 0 ? '+' : ''}${v}`).join(', ');
};

screen('press', {
  render() {
    const ev = curEvent();
    if (!ev) return { title: 'Konferencja', body: empty('Brak pytań.'), foot: '<button class="btn block" data-a="pr.done">Dalej</button>' };
    let body = journalistCard(ev);
    let foot;
    if (ev.type === 'journalist' && !ps.greeted) {
      body += `<div class="press-q">${esc(ev.greet)}</div>`;
      body += ev.ga.map((a, i) => `<button class="ans ${ps.pick === i ? 'on' : ''}" data-a="pr.greetPick" data-k="${i}">${esc(a.t)}</button>`).join('');
      foot = `<button class="btn block" data-a="pr.greet" ${ps.pick == null ? 'disabled' : ''}>Odpowiedz</button>`;
    } else {
      const q = ev.qs[ps.step];
      if (!q) return { title: ev.title, body: empty('Brak pytań.'), foot: '<button class="btn block" data-a="pr.done">Dalej</button>' };
      body += `<div class="qprog">${ev.qs.map((_, i) => `<i class="${i <= ps.step ? 'on' : ''}"></i>`).join('')}</div>`;
      body += `<div class="press-q">${esc(q.q)}</div>`;
      body += q.a.map((a, i) => `<button class="ans ${ps.sel[ps.step] === i ? 'on' : ''}" data-a="pr.pick" data-k="${i}">${esc(a.t)}</button>`).join('');
      foot = `<button class="btn block" data-a="pr.next" ${ps.sel[ps.step] == null ? 'disabled' : ''}>${ps.step < ev.qs.length - 1 ? 'Następne pytanie' : 'Zakończ'}</button>`;
    }
    return { title: ev.title, sub: ev.sub || '', back: false, body, foot };
  },
  onBack() { return true; },
});

actions({
  'pr.greetPick': (d) => { ps.pick = +d.k; rerender(); },
  'pr.greet': () => {
    const ev = ps.ev;
    const a = ev.ga[ps.pick];
    answerGreeting(ev, a.k);
    if (a.k === 'yes' && ev.qs.length) { ps.greeted = true; rerender(); return; }
    toast(a.k === 'never' ? 'Dziennikarz nie będzie już dzwonił. Media: −4' : 'Media: −1');
    nextEvent();
  },
  'pr.pick': (d) => { ps.sel[ps.step] = +d.k; rerender(); },
  'pr.next': () => {
    const ev = ps.ev;
    if (ps.step < ev.qs.length - 1) { ps.step++; rerender(); return; }
    const sum = answerPress(ev, ps.sel);
    const txt = fmtEff(sum);
    toast(txt ? `Reakcje: ${txt}` : 'Konferencja zakończona.');
    ps.ev = null;
    nextEvent();
  },
  'pr.done': () => {
    const ev = ps.ev;
    if (ev) removeEvent(ev);
    ps.ev = null;
    nextEvent();
  },
});

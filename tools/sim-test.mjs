// Test bezgłowy: symulacja kilku lat kariery. node tools/sim-test.mjs [NAT] [lata]
import { newGame, advance, G, confirmCallup, answerPress, answerGreeting, answerInvite, answerContract, acceptOffer, declineOffer, removeEvent, quickSimUserMatch, me, setHooks } from '../www/js/engine/game.js';
import { ymd, fmtDate } from '../www/js/core/util.js';
import { NAT } from '../www/js/data/nations.js';
import { rankPositions } from '../www/js/engine/ranking.js';

const nat = process.argv[2] || 'POL';
const years = +(process.argv[3] || 6);
const achs = [];
setHooks({ achieve: (id) => achs.push(id) });
const t0 = Date.now();
newGame({ nat, manager: 'Test' });
const endDay = G.day + years * 365;
let matches = 0, events = {}, guard = 0;
while (G.day < endDay && guard++ < 20000) {
  const s = advance();
  if (s.type === 'match') { quickSimUserMatch(s.fx); matches++; continue; }
  if (s.type === 'event') {
    const ev = s.ev; events[ev.type] = (events[ev.type] || 0) + 1;
    switch (ev.type) {
      case 'callup': confirmCallup(ev, G.team.squad.slice(0, ev.size)); break;
      case 'press': answerPress(ev, ev.qs.map(() => Math.floor(Math.random() * 3))); break;
      case 'journalist': answerGreeting(ev, 'yes'); if (G.queue.includes(ev)) answerPress(ev, ev.qs.map(() => 1)); break;
      case 'friendlyInvite': answerInvite(ev, true); break;
      case 'contract': answerContract(ev, true); break;
      case 'offer': if (!me()) acceptOffer(ev.nat); else declineOffer(ev.nat); break;
      case 'sacked': removeEvent(ev); break;
      default: removeEvent(ev);
    }
    continue;
  }
  if (s.type === 'idle') { console.log('idle'); break; }
}
console.log('czas', Date.now() - t0, 'ms; dzień', fmtDate(G.day), 'mecze', matches, 'zdarzenia', events);
console.log('selekcjoner:', G.user.nat, 'reputacja', G.user.rep, 'zwolnienia', G.user.sacked, 'trofea', G.user.trophies.map(t => t.name));
console.log('bilans', G.stats, 'zaufanie', G.trust);
console.log('rozgrywki:', G.compOrder.length, 'archiwum', G.archive.length, 'mecze w bazie', G.fixtures.length, 'zawodnicy', Object.keys(G.players).length);
for (const id of G.compOrder) { const c = G.comps[id]; if (c.type !== 'FRI' && (c.conf === 'EU' || c.kind === 'WC')) console.log(' ', c.name, c.stage, c.winner ? 'zwycięzca: ' + NAT[c.winner].name : '', c.qualified ? 'awans: ' + c.qualified.length : ''); }
for (const a of G.archive) if (a.winner) console.log('  arch', a.name, a.winner);
console.log('osiągnięcia', achs.join(', '));
console.log('cele', G.objectives.map(o => `${o.cname}: ${o.text} → ${o.status}`).join('\n  '));
const pos = rankPositions(G); console.log('ranking top5', Object.entries(pos).sort((a,b)=>a[1]-b[1]).slice(0,5).map(([k,v])=>v+'.'+k).join(' '), '| moja drużyna:', me() ? pos[me()] : '-');
console.log('wiadomości', G.msgs.length, 'kolejka', G.queue.length, 'historia', G.history.length);
const size = JSON.stringify(G).length; console.log('rozmiar zapisu', (size/1024).toFixed(0), 'KB');
// akademia i baza zawodników prowadzonej reprezentacji
if (me()) {
  const { academyOf, poolOf } = await import('../www/js/engine/game.js');
  const { ovr } = await import('../www/js/engine/player.js');
  const ac = academyOf(me());
  const ages = {}; for (const p of ac) ages[p.age] = (ages[p.age] || 0) + 1;
  console.log('akademia', ac.length, 'wiek', JSON.stringify(ages), '| baza', poolOf(me()).length, '| U-21', G.team.u21.length, '| wychowankowie w bazie', poolOf(me()).filter((p) => p.hAdult != null).map((p) => `${p.age}l/${Math.round(ovr(p))}`).join(' '));
}

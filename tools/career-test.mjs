// Test bezgłowy trybu zawodnika: kilka sezonów na autopilocie. node tools/career-test.mjs [pozycja] [sezony]
import * as C from '../www/js/career/engine.js';
import { ovr, ATTR_NAMES, POS_W } from '../www/js/engine/player.js';
const pos = process.argv[2] || 'CF';
const seasons = +(process.argv[3] || 5);
const t0 = Date.now();
const st = C.draftCareer({ fn: 'Jan', ln: 'Testowy', nat: 'POL', pos, num: 9, look: {} });
const starts = C.startClubs(st);
C.finishCareer(st, starts[0].id);
const PC = C.PC;
let matches = 0, guard = 0;
const endYear = PC.year + seasons;
while (PC.year < endYear && !PC.retired && guard++ < 5000) {
  if (C.canTrain()) C.doTraining(pos === 'GK' ? 'gk' : ['tech', 'shoot', 'phys', 'mind'][guard % 4]);
  // wydawanie punktów na kluczowe atrybuty pozycji
  const keys = Object.keys(POS_W[PC.me.pos]).sort((a, b) => POS_W[PC.me.pos][b] - POS_W[PC.me.pos][a]);
  let spent = true;
  while (spent) { spent = false; for (const k of keys) if (C.attrCost(k) <= PC.tp && C.buyAttr(k)) { spent = true; break; } }
  for (const fx of C.weekMatches()) { const M = C.setupMatch(fx); C.autoPlay(M); matches++; }
  if (PC.offers.length && PC.clubs[PC.offers[0].club].lv > C.myClub().lv + 2) C.acceptOffer(0);
  C.endWeek();
}
console.log('czas', Date.now() - t0, 'ms, mecze', matches, 'rok', PC.year, 'wiek', PC.me.age, 'OVR', Math.round(ovr(PC.me)), 'pot', PC.me.pot, 'klub', C.myClub().n, 'lv', C.myClub().lv, 'status', C.STATUS[PC.status]);
for (const s of PC.seasons) console.log(` ${s.year}: ${s.club} (${s.league}) ${s.pos}. miejsce | mecze ${s.apps} gole ${s.goals} asysty ${s.assists} śr ${s.avg} | kadra ${s.nat}/${s.natG} | OVR ${s.ovr} ${s.tr.join(', ')} ${s.aw.join(', ')}`);
console.log('kariera', JSON.stringify(PC.car), 'trofea', PC.trophies.map((t) => `${t.name} ${t.year}`).join('; '));
console.log('nagrody', PC.awards.map((a) => `${a.name} ${a.year}`).join('; '));
console.log('transfery', PC.transfers || 0, 'pieniądze', PC.money, 'rozmiar zapisu', Math.round(JSON.stringify(PC).length / 1024), 'KB');
console.log('wiadomości:', PC.msgs.slice(0, 6).map((m) => m.subj).join(' | '));

// Kalibracja silnika meczu: node tools/calib.mjs
import { generateWorld } from '../www/js/engine/db.js';
import { ovr } from '../www/js/engine/player.js';
import { Match } from '../www/js/engine/match.js';
import { autoLineup, autoBench, defaultTactics, defaultSetPieces, pickSquad, aiTactics, lineupStrength } from '../www/js/engine/tactics.js';
import { NAT } from '../www/js/data/nations.js';

const w = generateWorld();
function spec(nid, home, oppStr) {
  const pool = w.nats[nid].pool.map(id => w.players[id]);
  const squad = pickSquad(pool, 23).map(id => w.players[id]);
  const players = Object.fromEntries(squad.map(p => [p.id, p]));
  let tac = defaultTactics(NAT[nid].str);
  if (oppStr != null) tac = aiTactics(tac, NAT[nid].str, oppStr);
  const lineup = autoLineup(squad, tac.f);
  const bench = autoBench(squad, lineup, 12);
  const sp = defaultSetPieces(lineup.map(id => players[id]));
  return { nid, name: NAT[nid].name, players, lineup, bench, tac, instr: {}, sp, train: {}, home, ai: true, str: lineupStrength(squad, lineup, tac.f) };
}
function run(h, a, n = 1500, opts = {}) {
  let W=0,D=0,L=0,gh=0,ga=0,sh=0,sot=0,cor=0,yc=0,rc=0,fo=0, pens=0, poss=0;
  for (let i=0;i<n;i++) {
    const m = new Match(spec(h, true, NAT[a].str), spec(a, false, NAT[h].str), opts);
    const r = m.simulate();
    gh += r.hg; ga += r.ag; if (r.hg>r.ag) W++; else if (r.hg===r.ag) D++; else L++;
    sh += r.stats[0].shots + r.stats[1].shots; sot += r.stats[0].sot + r.stats[1].sot; cor += r.stats[0].corners + r.stats[1].corners;
    yc += r.stats[0].yc + r.stats[1].yc; rc += r.stats[0].rc + r.stats[1].rc; fo += r.stats[0].fouls + r.stats[1].fouls; poss += r.stats[0].poss;
    if (r.pens) pens++;
  }
  const f = x => (x/n).toFixed(2);
  console.log(`${h}(${NAT[h].str}) - ${a}(${NAT[a].str}): W ${(W/n*100).toFixed(0)}% D ${(D/n*100).toFixed(0)}% L ${(L/n*100).toFixed(0)}% | gole ${f(gh)}:${f(ga)} (suma ${f(gh+ga)}) | strzały ${f(sh)} celne ${f(sot)} rożne ${f(cor)} faule ${f(fo)} żk ${f(yc)} czk ${f(rc)} pos ${f(poss)}%${opts.ko? ' karne '+(pens/n*100).toFixed(0)+'%':''}`);
}
const t0 = Date.now();
run('POL','UKR'); run('POL','NED'); run('FRA','SMR', 800); run('ENG','ALB'); run('ALB','ENG'); run('JPN','KOR'); run('BRA','ARG'); run('SCO','WAL');
run('GER','ESP', 800, { ko: true, neutral: true });
console.log('czas', Date.now()-t0, 'ms');

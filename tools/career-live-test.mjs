// Test meczu 2D trybu zawodnika: sterowana postać (symulowany gracz). node tools/career-live-test.mjs
import * as C from '../www/js/career/engine.js';
import { createLive, finishLive, liveSubCheck } from '../www/js/career/live.js';
for (const pos of (process.argv[2] ? [process.argv[2]] : ['CF', 'CB', 'GK', 'LW'])) {
  const st = C.draftCareer({ fn: 'Jan', ln: 'Test', nat: 'POL', pos, num: 9, look: {} });
  C.finishCareer(st, C.startClubs(st)[3].id);
  let tot = { g: 0, a: 0, gf: 0, ga: 0, r: 0, n: 0, touches: 0 };
  for (let k = 0; k < 4; k++) {
    const fx = C.weekMatches()[0];
    if (!fx) { C.endWeek(); k--; continue; }
    const M = C.setupMatch(fx);
    const { sim, userSide } = createLive(M);
    let steps = 0;
    while (!sim.done && steps++ < 200000) {
      // symulacja gracza: drążek w stronę piłki/bramki, losowe polecenia
      const a = sim.ctrl;
      if (a && steps % 4 === 0) {
        const b = sim.ball;
        const own = b.owner === a;
        const tx = own ? 34 : b.x, ty = own ? sim.goalY(userSide) : b.y;
        const dx = tx - a.x, dy = ty - a.y, d = Math.hypot(dx, dy) || 1;
        sim.input.jx = dx / d; sim.input.jy = dy / d; sim.input.lastT = sim.t;
        if (own) { tot.touches++; const yr = sim.ry(userSide, a.y); sim.input.cmd = yr > 85 ? 'shoot' : Math.random() < 0.3 ? 'dribble' : Math.random() < 0.5 ? 'pass' : null; }
        else if (Math.random() < 0.05) sim.input.cmd = Math.random() < 0.5 ? 'dribble' : 'pass';
      }
      sim.advance(0.05);
      if (!sim.ctrl || sim.ctrl.state === 'gone') sim.ctrl = sim.agentOf(userSide, 1);
      liveSubCheck(M, sim, userSide);
      if (sim.waiting) sim.resume();
    }
    finishLive(M, sim, userSide);
    tot.g += M.my.g; tot.a += M.my.a; tot.gf += M.goals[0]; tot.ga += M.goals[1]; tot.r += M.rating || 0; tot.n++;
    C.endWeek();
  }
  console.log(pos, 'mecze', tot.n, 'gole/asysty', tot.g, tot.a, 'bramki', tot.gf + ':' + tot.ga, 'śr. ocena', (tot.r / tot.n).toFixed(2), 'kontakty', tot.touches, '| tabela p', C.sortedTable(C.myLeague()).find((t) => t.id === C.PC.club).p);
}

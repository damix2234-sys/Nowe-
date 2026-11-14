// Test bezgłowy meczu na żywo (silnik engine/sim.js + widok Pitch2D bez rysowania). Sprawdza to, co widzi gracz:
// – zawodnicy i piłka poruszają się płynnie (bez teleportów w trakcie gry),
// – rzut rożny / aut / wybicie od bramki są tylko po prawdziwym wyjściu piłki za linię,
// – komentarz idzie po kolei w czasie, mecz się kończy, a efekty z silnika trafiają do widoku.
// node tools/view-test.mjs [mecze]
import { newGame, aiSpec } from '../www/js/engine/game.js';
import { LiveMatch } from '../www/js/engine/sim.js';
import { Pitch2D } from '../www/js/ui/pitch2d.js';

const N = +(process.argv[2] || 6);
newGame({ nat: 'POL', manager: 'Test' });
const pairs = [['POL', 'GER'], ['FRA', 'SMR'], ['BRA', 'ARG'], ['ENG', 'ITA'], ['SCO', 'WAL'], ['CRO', 'PER']];
const PW = 68, PL = 105;
const fails = [];
const tot = { m: 0, ticks: 0, comm: 0, corner: 0, throw: 0, goalkick: 0, fx: 0 };
for (let k = 0; k < N; k++) {
  const [h, a] = pairs[k % pairs.length];
  const M = new LiveMatch(aiSpec(h, { h, a, comp: null }, true), aiSpec(a, { h, a, comp: null }, false), { autoSubs: [true, true], ko: k % 3 === 2 });
  M.userSide = 0;
  const P = new Pitch2D(null, M);
  P.setRate(4);
  const prev = new Map();
  let pb = null, lastCommT = -1, fxSeen = 0;
  const origDead = M.setDead.bind(M);
  M.setDead = (type, side, x, y, o) => {
    const b = M.ball;
    if (type === 'corner' || type === 'goalkick') {
      if (b.y > 0.3 && b.y < PL - 0.3) fails.push(`${h}-${a} ${M.minLabel()}: ${type} bez wyjścia piłki za linię końcową (y=${b.y.toFixed(1)})`);
      tot[type]++;
    }
    if (type === 'throw') {
      if (b.x > 0.3 && b.x < PW - 0.3) fails.push(`${h}-${a} ${M.minLabel()}: aut bez wyjścia piłki za linię boczną (x=${b.x.toFixed(1)})`);
      tot.throw++;
    }
    return origDead(type, side, x, y, o);
  };
  M.onComm = (e) => {
    if (e.t < lastCommT) fails.push(`${h}-${a}: komentarz nie po kolei (${e.text})`);
    lastCommT = e.t;
    tot.comm++;
  };
  let guard = 0;
  const f0 = fails.length;
  while (!M.done && guard++ < 200000) {
    if (M.waiting) { M.resume(); prev.clear(); pb = null; }
    const period = M.period, phase = M.phase;
    const t0 = M.t;
    const before = M.fxq.length;
    P.step(0.05);
    fxSeen += Math.max(0, before - M.fxq.length) + 0;
    const dt = M.t - t0;
    tot.ticks++;
    if (dt <= 0) continue;
    const restart = M.period !== period || M.phase !== phase || M.phase !== 'PLAY';
    for (const T of M.teams) for (const ag of T.players) {
      if (!Number.isFinite(ag.x) || !Number.isFinite(ag.y)) fails.push(`${h}-${a}: NaN pozycji zawodnika ${ag.ln}`);
      const p = prev.get(ag);
      if (p && !restart && ag.state !== 'gone') {
        const d = Math.hypot(ag.x - p.x, ag.y - p.y);
        if (d > 14 * dt + 0.6) fails.push(`${h}-${a} ${M.minLabel()}: teleport zawodnika ${ag.ln} o ${d.toFixed(1)} m`);
      }
      prev.set(ag, { x: ag.x, y: ag.y });
      if (ag.state !== 'gone' && ag.state !== 'off' && (ag.x < -8 || ag.x > PW + 8 || ag.y < -8 || ag.y > PL + 8)) fails.push(`${h}-${a}: ${ag.ln} daleko poza boiskiem (${ag.x.toFixed(0)},${ag.y.toFixed(0)})`);
    }
    const b = M.ball;
    if (!Number.isFinite(b.x) || !Number.isFinite(b.y) || !Number.isFinite(b.z)) fails.push(`${h}-${a}: NaN pozycji piłki`);
    if (pb && !restart && !M.dead) {
      const d = Math.hypot(b.x - pb.x, b.y - pb.y);
      if (d > 45 * dt + 1.2) fails.push(`${h}-${a} ${M.minLabel()}: skok piłki o ${d.toFixed(1)} m w trakcie gry`);
    }
    pb = M.dead ? null : { x: b.x, y: b.y };
    if (fails.length - f0 > 12) break;
  }
  if (!M.done) fails.push(`${h}-${a}: mecz się nie zakończył`);
  if (M.fxq.length > 0) fails.push(`${h}-${a}: niewyczyszczona kolejka efektów (${M.fxq.length})`);
  tot.m++;
  tot.fx += fxSeen;
  const r = M.result();
  console.log(`${h} ${r.hg}:${r.ag} ${a}${r.pens ? ` (k. ${r.pens[0]}:${r.pens[1]})` : ''} | linie komentarza ${M.comm.length} | strzały ${r.stats[0].shots}-${r.stats[1].shots} rożne ${r.stats[0].corners}-${r.stats[1].corners}`);
}
console.log(`mecze ${tot.m}, kroki ${tot.ticks}, rożne ${tot.corner}, auty ${tot.throw}, wybicia od bramki ${tot.goalkick}, linie ${tot.comm}`);
console.log(fails.length ? 'BŁĘDY:\n' + [...new Set(fails)].slice(0, 20).join('\n') : 'OK – bez teleportów, stałe fragmenty tylko po wyjściu piłki, komentarz po kolei');
process.exit(fails.length ? 1 : 0);

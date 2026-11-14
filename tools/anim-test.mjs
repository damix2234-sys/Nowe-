// Test bezgłowy animacji 2D: rozgrywa mecze przez reżysera Pitch2D (bez rysowania) i sprawdza,
// że każda linia komentarza pojawia się dokładnie raz i w kolejności, akcje się nie zawieszają,
// a zawodnicy i piłka nie wychodzą poza rozsądny obszar. node tools/anim-test.mjs [mecze]
import { newGame, aiSpec } from '../www/js/engine/game.js';
import { Match } from '../www/js/engine/match.js';
import { Pitch2D } from '../www/js/ui/pitch2d.js';

const N = +(process.argv[2] || 24);
newGame({ nat: 'POL', manager: 'Test' });
const pairs = [['POL', 'GER'], ['FRA', 'SMR'], ['BRA', 'ARG'], ['ENG', 'ITA'], ['ESP', 'NED'], ['CRO', 'PER'], ['NGA', 'IRL']];
const RATES = [1.3, 2.2, 3.8, 7];
const MIN_DUR = [2.4, 2.2, 1.8, 1.1];
const spec = (nid, home, h, a) => aiSpec(nid, { h, a, comp: null }, home);

let fails = 0, missingTotal = 0;
const durs = {};
const totals = [];
const errs = [];
const origErr = console.error;
console.error = (...x) => { errs.push(x.map(String).join(' ')); };

for (let k = 0; k < N; k++) {
  const [h, a] = pairs[k % pairs.length];
  const M = new Match(spec(h, true, h, a), spec(a, false, h, a), { ko: k % 3 === 0, autoSubs: [true, true] });
  M.userSide = k % 2;
  const sp = k % 4;
  const expected = [], said = [];
  let ended = false, curStart = 0, curKey = '';
  const P = new Pitch2D(null, M, {
    need() {
      if (M.done) return;
      const evs = M.step();
      let any = false;
      for (const e of evs) {
        e.lines.forEach((text, i) => {
          any = true;
          expected.push(text);
          P.queue.push({ type: 'act', act: e.acts[i], text, ev: e, i, last: i === e.lines.length - 1 });
        });
      }
      if (!any) P.queue.push({ type: 'minute', s: M.poss, dur: MIN_DUR[sp], min: M.minLabel() });
    },
    start(it) { curStart = P.time; curKey = it.type === 'minute' ? 'minute' : it.act.t + (it.act.kind ? ':' + it.act.kind : '') + (it.act.v ? ':' + it.act.v : ''); },
    line(it) { said.push(it.text); },
    end(it) {
      const d = P.time - curStart;
      const r = durs[curKey] || (durs[curKey] = { n: 0, sum: 0, max: 0 });
      r.n++; r.sum += d; r.max = Math.max(r.max, d);
      if (it.ev && it.ev.ft && it.last) ended = true;
    },
  });
  P.setRate(RATES[sp]);
  P.play();
  let t = 0, bad = '';
  while (!ended && t < 4000) {
    P.advance(1 / 30);
    t += 1 / 30;
    const b = P.ball;
    if (!Number.isFinite(b.x) || !Number.isFinite(b.y) || !Number.isFinite(b.z)) { bad = 'piłka NaN'; break; }
    if (b.x < -8 || b.x > 76 || b.y < -8 || b.y > 113) { bad = `piłka poza obszarem ${b.x.toFixed(1)},${b.y.toFixed(1)}`; break; }
    for (const T of P.teams) for (const p of T.players) {
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) { bad = 'zawodnik NaN'; break; }
      if (p.state !== "gone" && (p.x < -6 || p.x > 74 || p.y < -6 || p.y > 111)) { bad = `zawodnik poza obszarem ${p.ln} ${p.x.toFixed(1)},${p.y.toFixed(1)} (${curKey}) st=${p.state} goal=${JSON.stringify(p.goal)} chase=${!!p.chase} gk=${p.gk} v=${p.vx.toFixed(1)},${p.vy.toFixed(1)} t=${p.tx.toFixed(1)},${p.ty.toFixed(1)}`; break; }
    }
    if (bad) break;
  }
  if (P.missing) missingTotal += P.missing;
  const same = said.length === expected.length && said.every((x, i) => x === expected[i]);
  if (!ended) bad = bad || 'mecz nie dobiegł końca';
  if (!same) bad = bad || `linie: powiedziano ${said.length}, oczekiwano ${expected.length}`;
  const realSec = t;
  totals.push({ sp, realSec, world: P.time });
  if (bad) { fails++; console.log(`mecz ${k} ${h}-${a}: BŁĄD ${bad}`); }
}
console.error = origErr;
const bySp = [0, 1, 2, 3].map((s) => totals.filter((x) => x.sp === s)).map((l) => (l.length ? (l.reduce((q, x) => q + x.realSec, 0) / l.length / 60).toFixed(1) + ' min' : '-'));
console.log('mecze:', N, 'błędy:', fails, '| średni czas meczu (½×, 1×, 2×, 4×):', bySp.join(', '));
console.log('wyjątki w skryptach:', errs.length ? errs.slice(0, 5).join('\n') : 'brak', '| nieznalezieni zawodnicy:', missingTotal);
const rows = Object.entries(durs).sort((x, y) => y[1].max - x[1].max).slice(0, 14);
console.log('najdłuższe akcje (czas świata, s):', rows.map(([k2, r]) => `${k2} śr ${(r.sum / r.n).toFixed(1)} max ${r.max.toFixed(1)}`).join(' | '));
process.exit(fails || errs.length || missingTotal ? 1 : 0);

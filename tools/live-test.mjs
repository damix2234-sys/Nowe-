// Test silnika meczu opartego na zawodnikach (bez rysowania): realizm statystyk, przewaga lepszych,
// spójność zdarzeń. node tools/live-test.mjs [mecze]
import { newGame, aiSpec } from '../www/js/engine/game.js';
import { LiveMatch } from '../www/js/engine/sim.js';

const N = +(process.argv[2] || 20);
newGame({ nat: 'POL', manager: 'Test' });
const spec = (nid, home, h, a) => aiSpec(nid, { h, a, comp: null }, home);
const pairs = (process.argv[3] || 'POL-GER,ITA-ESP,ENG-NED,SCO-WAL,FRA-SMR,BRA-ALB').split(',').map((x) => x.split('-'));
const errs = [];
const origErr = console.error;
console.error = (...x) => errs.push(x.map(String).join(' '));
const byPair = {};
const tot = { m: 0, g: 0, sh: 0, sot: 0, cor: 0, fl: 0, yc: 0, rc: 0, off: 0, xg: 0, sav: 0, ms: 0, comm: 0, pass: 0, passOk: 0, inj: 0 };
for (let k = 0; k < N; k++) {
  const [h, a] = pairs[k % pairs.length];
  const M = new LiveMatch(spec(h, true, h, a), spec(a, false, h, a), { autoSubs: [true, true] });
  M.userSide = 0;
  const t0 = Date.now();
  let r;
  try { r = M.simulate(); } catch (e) { console.log('WYJĄTEK', h, a, e.stack); process.exit(1); }
  const ms = Date.now() - t0;
  const [s0, s1] = r.stats;
  tot.m++; tot.g += r.hg + r.ag; tot.sh += s0.shots + s1.shots; tot.sot += s0.sot + s1.sot; tot.cor += s0.corners + s1.corners;
  tot.fl += s0.fouls + s1.fouls; tot.yc += s0.yc + s1.yc; tot.rc += s0.rc + s1.rc; tot.off += s0.offsides + s1.offsides;
  tot.xg += s0.xg + s1.xg; tot.sav += s0.saves + s1.saves; tot.ms += ms; tot.comm += M.comm.length;
  tot.pass += (M.sides[0].pass || [0])[0] + (M.sides[1].pass || [0])[0];
  tot.passOk += (M.sides[0].pass || [0, 0])[1] + (M.sides[1].pass || [0, 0])[1];
  tot.inj += r.key.filter((x) => x.type === 'inj').length;
  const key = `${h}-${a}`;
  const bp = byPair[key] || (byPair[key] = { n: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pos: 0, sh: 0, sha: 0, xg: 0, xga: 0 });
  bp.n++; bp.gf += r.hg; bp.ga += r.ag; bp.pos += s0.poss; bp.sh += s0.shots; bp.sha += s1.shots; bp.xg += s0.xg; bp.xga += s1.xg;
  for (const S of M.sides) for (const ps of Object.values(S.ps)) { tot.blk = (tot.blk || 0) + (ps.blk || 0); tot.drw = (tot.drw || 0) + (ps.drw || 0); tot.tk = (tot.tk || 0) + (ps.tk || 0); tot.int = (tot.int || 0) + (ps.int || 0); tot.rs = (tot.rs || []); if (ps.r != null) tot.rs.push(ps.r); }
  if (r.hg > r.ag) bp.w++; else if (r.hg === r.ag) bp.d++; else bp.l++;
  if (k < 2) console.log(`${h} ${r.hg}:${r.ag} ${a} | strzały ${s0.shots}-${s1.shots} celne ${s0.sot}-${s1.sot} rożne ${s0.corners}-${s1.corners} faule ${s0.fouls}-${s1.fouls} pos ${s0.poss}% xG ${s0.xg}-${s1.xg} | ${ms} ms | linie ${M.comm.length}`);
}
console.error = origErr;
const f = (v) => (v / tot.m).toFixed(2);
console.log(`mecze ${tot.m}: gole ${f(tot.g)} strzały ${f(tot.sh)} celne ${f(tot.sot)} rożne ${f(tot.cor)} faule ${f(tot.fl)} żk ${f(tot.yc)} czk ${f(tot.rc)} spalone ${f(tot.off)} xG ${f(tot.xg)} obrony ${f(tot.sav)} kontuzje ${f(tot.inj)}`);
console.log(`podania ${f(tot.pass)} celność ${(100 * tot.passOk / Math.max(1, tot.pass)).toFixed(0)}% | komentarz ${f(tot.comm)} linii | czas ${f(tot.ms)} ms/mecz`);
const rs = tot.rs || [];
const avgR = rs.reduce((q, x) => q + x, 0) / Math.max(1, rs.length);
console.log(`bloki ${f(tot.blk || 0)} dryblingi ${f(tot.drw || 0)} odbiory ${f(tot.tk || 0)} przechwyty ${f(tot.int || 0)} | oceny: śr ${avgR.toFixed(2)}, min ${Math.min(...rs).toFixed(1)}, max ${Math.max(...rs).toFixed(1)}, ≥8: ${rs.filter((x) => x >= 8).length}, <6: ${rs.filter((x) => x < 6).length}`);
for (const [k, v] of Object.entries(byPair)) console.log(`  ${k}: W${v.w} R${v.d} P${v.l} gole ${(v.gf / v.n).toFixed(2)}:${(v.ga / v.n).toFixed(2)} strzały ${(v.sh / v.n).toFixed(1)}:${(v.sha / v.n).toFixed(1)} xG ${(v.xg / v.n).toFixed(2)}:${(v.xga / v.n).toFixed(2)} posiadanie ${(v.pos / v.n).toFixed(0)}%`);
console.log('błędy:', errs.length ? errs.slice(0, 5).join('\n') : 'brak');

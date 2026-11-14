// Komentator meczu na żywo: zamienia prawdziwe zdarzenia z boiska na linie komentarza.
// Niczego nie wymyśla, mówi o tym, co zrobili zawodnicy (strzał, parada, drybling, odbiór, faul,
// piłka za linią…). Priorytety pilnują tempa: najważniejsze zdarzenia zawsze, drobne tylko w ciszy.
import { N } from '../data/commentary.js';
import { fullName } from '../data/names.js';

const fill = (t, v) => t.replace(/\{(\w+)\}/g, (_, k) => (v[k] ?? ''));
const GAP = [0, 0, 0.6, 1.8, 4.2]; // minimalny odstęp (s symulacji) od poprzedniej linii wg priorytetu

export class Narrator {
  constructor(m) {
    this.m = m;
    this.lastT = -9;
    this.fillT = -9;
    this.pressT = -99;
    this.streak = { side: null, t: 0, att: 0 };
    this.remarkT = 0;
  }

  nm(a, full = false) {
    if (!a) return '';
    const p = a.p || a;
    return full ? fullName(p) : p.ln;
  }

  team(s) { return this.m.sides[s].name; }

  /** Wybór wariantu bez powtarzania ostatnio użytych (komentarz nie brzmi jak zdarta płyta). */
  variant(key) {
    const list = N[key];
    const used = (this.used || (this.used = {}))[key] || [];
    const free = list.map((_, i) => i).filter((i) => !used.includes(i));
    const i = (free.length ? free : list.map((_, j) => j))[Math.floor(Math.random() * (free.length || list.length))];
    used.push(i);
    if (used.length > Math.min(3, list.length - 1)) used.shift();
    this.used[key] = used;
    return list[i];
  }

  say(key, v = {}, o = {}) {
    const m = this.m;
    const prio = o.prio ?? 3;
    if (m.t - this.lastT < GAP[prio]) return false;
    const list = N[key];
    if (!list) return false;
    // drobne opisy tej samej sytuacji nie częściej niż co kilkanaście sekund
    const kt = (this.keyT || (this.keyT = {}));
    if (prio >= 4 && m.t - (kt[key] ?? -99) < 14) return false;
    kt[key] = m.t;
    m.say(fill(this.variant(key), v), { ic: o.ic, side: o.side, imp: prio <= 1, kind: key });
    this.lastT = m.t;
    return true;
  }

  on(type, d) {
    const m = this.m;
    switch (type) {
      case 'periodStart': {
        const key = d.period === 1 ? 'kickoff' : d.period === 2 ? 'secondHalf' : d.period === 3 ? 'etKick1' : 'etKick2';
        this.say(key, { T: this.team(d.side) }, { prio: 1, ic: '📣' });
        break;
      }
      case 'kickoff':
        if (!d.first) this.say('restart', {}, { prio: 4 });
        break;
      case 'stoppage': this.say('stoppage', { N: d.n }, { prio: 1, ic: 'ℹ' }); break;
      case 'halftime': case 'etHalf': case 'etStart': case 'pensStart': case 'fulltime':
        this.say(type, {}, { prio: 1, ic: '📣' });
        break;
      case 'pass': {
        const ff = d.toY - d.fromY;
        if (d.kind === 'through' && d.toY > 62 && d.m) this.say('through', { A: this.nm(d.a), B: this.nm(d.m) }, { prio: 2, side: d.a.side });
        else if (d.kind === 'air' && d.d > 32 && ff > 15) this.say('longBall', { A: this.nm(d.a) }, { prio: 3, side: d.a.side });
        else if (d.kind === 'air' && Math.abs(d.R.x - d.a.x) > 30) this.say('switchPlay', { A: this.nm(d.a) }, { prio: 4, side: d.a.side });
        break;
      }
      case 'received':
        if (d.prog > 14 && m.ry(d.a.side, d.a.y) > 62 && d.kind !== 'through') this.say('progPass', { A: this.nm(d.by), B: this.nm(d.a) }, { prio: 4, side: d.a.side });
        break;
      case 'cross': this.say('cross', { A: this.nm(d.a) }, { prio: 2, side: d.a.side }); break;
      case 'takeon': this.say('takeon', { A: this.nm(d.a) }, { prio: 4, side: d.a.side }); break;
      case 'beaten': this.say('beat', { A: this.nm(d.a), D: this.nm(d.d) }, { prio: m.ry(d.a.side, d.a.y) > 60 ? 2 : 3, side: d.a.side }); break;
      case 'tackle': {
        const key = d.slide ? 'slide' : d.takeon ? 'tackleDrb' : 'tackle';
        const danger = m.ry(d.a.side, d.a.y) > 65;
        this.say(key, { A: this.nm(d.a), D: this.nm(d.d) }, { prio: danger ? 2 : 3, side: d.d.side });
        break;
      }
      case 'intercept':
        this.say('intercept', { D: this.nm(d.a) }, { prio: m.ry(1 - d.a.side, d.a.y) > 60 ? 2 : 3, side: d.a.side });
        break;
      case 'badTouch': this.say('badTouch', { A: this.nm(d.a) }, { prio: 4, side: d.a.side }); break;
      case 'clear': this.say(d.header ? 'clearHead' : 'clear', { A: this.nm(d.a) }, { prio: 4, side: d.a.side }); break;
      case 'claim': this.say('claim', { G: this.nm(d.G) }, { prio: 3, side: d.G.side, ic: '🧤' }); break;
      case 'punch': this.say('punch', { G: this.nm(d.G) }, { prio: 3, side: d.G.side, ic: '🧤' }); break;
      case 'headPass': break;
      case 'shot': {
        const v = { A: this.nm(d.a) };
        const key = d.kind === 'pen' ? null : d.kind === 'head' ? 'header' : d.kind === 'volley' ? 'volley' : d.kind === 'fk' ? 'fkShot' : d.big ? 'shotBig' : d.dist > 21 ? 'shotLong' : 'shotBox';
        if (key) this.say(key, v, { prio: 1, side: d.a.side, ic: '•' });
        break;
      }
      case 'save': {
        const v = { G: this.nm(d.G) };
        const key = d.kind === 'pen' ? 'penSave' : d.big ? 'saveBig' : d.how === 'catch' ? 'saveCatch' : d.how === 'dive' ? 'saveDive' : 'saveParry';
        this.say(key, v, { prio: 1, side: d.G.side, ic: '🧤' });
        break;
      }
      case 'block':
        if (d.cross) this.say('blockCross', { D: this.nm(d.d) }, { prio: 3, side: d.d.side });
        else this.say('block', { D: this.nm(d.d) }, { prio: 1, side: d.d.side });
        break;
      case 'miss': {
        const key = d.kind === 'pen' ? 'penMiss' : d.big ? 'missBig' : d.high ? 'missHigh' : 'missWide';
        this.say(key, { A: this.nm(d.a) }, { prio: 1, side: d.a.side });
        break;
      }
      case 'woodwork': this.say(d.what === 'bar' ? 'bar' : 'post', {}, { prio: 1 }); break;
      case 'goal': {
        const v = { A: this.nm(d.a, true), D: this.nm(d.a, true) };
        const key = d.og ? 'ownGoal' : d.pen ? 'goalPen' : d.kind === 'head' ? 'goalHeader' : d.kind === 'fk' ? 'goalFk' : d.kind === 'foot' && d.a && m.shotDistLast > 22 ? 'goalLong' : 'goal';
        m.say(fill(this.variant(key), v), { ic: '⚽', side: d.side, imp: true, kind: 'goal' });
        if (d.assist) m.say(fill(this.variant('assist'), { B: this.nm(d.assist, true) }), { ic: '', side: d.side, kind: 'assist' });
        m.say(fill(this.variant('score'), { S: `${d.score[0]}:${d.score[1]}` }), { kind: 'score', side: d.side });
        this.lastT = m.t;
        break;
      }
      case 'corner':
        if (d.by && Math.random() < 0.4) this.say('cornerBy', { D: this.nm(d.by) }, { prio: 2, side: d.side, ic: '⛳' });
        else this.say('corner', {}, { prio: 2, side: d.side, ic: '⛳' });
        break;
      case 'throw': this.say('throw', {}, { prio: 4 }); break;
      case 'goalkick': this.say('goalkick', {}, { prio: 4 }); break;
      case 'freekick': this.say(d.dist < 30 ? 'freekickNear' : 'freekick', {}, { prio: d.dist < 30 ? 2 : 4, side: d.side }); break;
      case 'foul': if (!d.inBox) this.say('foul', { D: this.nm(d.d) }, { prio: 2, side: d.d.side }); break;
      case 'penalty':
        this.say('penalty', { D: this.nm(d.by, true) }, { prio: 1, side: d.side, ic: '🎯' });
        break;
      case 'penTaker': this.say('penTaker', { A: this.nm(d.a, true) }, { prio: 1, side: d.side }); break;
      case 'card':
        this.say(d.red ? (d.second ? 'secondYellow' : 'red') : 'yellow', { D: this.nm(d.a, true) }, { prio: 1, side: d.a.side, ic: d.red ? '🟥' : '🟨' });
        break;
      case 'offside': this.say('offside', { A: this.nm(d.a) }, { prio: 2, side: d.a.side, ic: '🚩' }); break;
      case 'injury': this.say('injury', { A: this.nm(d.a, true) }, { prio: 1, side: d.a.side, ic: '✚' }); break;
      case 'sub':
        this.say('sub', { T: this.team(d.side), OUT: fullName(d.outP), IN: fullName(d.inP) }, { prio: 1, side: d.side, ic: '🔁' });
        break;
      case 'tired': if (d.a.side === m.userSide) this.say('tired', { A: this.nm(d.a) }, { prio: 3, side: d.a.side }); break;
      case 'pk': {
        const key = d.how === 'goal' ? 'pkGoal' : d.how === 'save' ? 'pkSave' : 'pkMiss';
        m.say(fill(this.variant(key), { T: this.team(d.side), A: this.nm(d.a), G: this.nm(d.G), S: `${d.score[0]}:${d.score[1]}` }), { ic: '🥅', side: d.side, imp: true, kind: 'pk' });
        this.lastT = m.t;
        break;
      }
      default: break;
    }
    if (type === 'shot') m.shotDistLast = d.dist;
    if (type === 'penalty' && d.side != null) this.pendingPen = true;
  }

  /** Wypełnianie ciszy opisem sytuacji, uwagi o formie zawodników. */
  tick(h) {
    const m = this.m;
    if (m.phase !== 'PLAY' || m.dead) return;
    const o = m.ball.owner;
    // naciskanie rywala: długie posiadanie na połowie przeciwnika
    const s = o ? o.side : m.poss;
    if (this.streak.side !== s) this.streak = { side: s, t: 0, att: 0 };
    this.streak.t += h;
    if (m.ry(s, m.ball.y) > 55) this.streak.att += h;
    if (this.streak.t > 16 && this.streak.att > 11 && m.t - this.pressT > 40 && this.say('pressure', { T: this.team(s) }, { prio: 4, side: s })) this.pressT = m.t;
    // rzut karny: zapowiedź wykonawcy
    if (m.dead && m.dead.type === 'penalty') return;
    if (m.t - this.lastT < 4.6 || m.t - this.fillT < 5.5 || !o || o.gk) {
      this.remarks(h);
      return;
    }
    const Y = m.ry(o.side, o.y), X = m.rx(o.side, o.x);
    const v = { A: this.nm(o), T: this.team(o.side) };
    const key = (X < 12 || X > 56) && Y > 45 ? 'wing' : Y < 40 ? 'buildOwn' : Y < 66 ? 'buildMid' : 'buildAtt';
    if (this.say(key, v, { prio: 4, side: o.side })) this.fillT = m.t;
  }

  remarks(h) {
    const m = this.m;
    this.remarkT += h;
    if (this.remarkT < 25) return;
    this.remarkT = 0;
    if (m.t - this.lastT < 3) return;
    for (const a of m.active(m.userSide)) {
      if (a.rating >= 8 && !a.flags.hot) { a.flags.hot = true; this.say('hot', { A: this.nm(a) }, { prio: 4, side: a.side }); return; }
      if (a.rating <= 5.6 && !a.flags.poor && m.clk > 1500) { a.flags.poor = true; this.say('poor', { A: this.nm(a) }, { prio: 4, side: a.side }); return; }
    }
  }
}

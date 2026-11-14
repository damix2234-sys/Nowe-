// Silnik meczu oparty na zawodnikach. Na boisku jest 22 „agentów” i piłka z fizyką; każdy zawodnik sam
// decyduje (podanie, prowadzenie, drybling, strzał, dośrodkowanie, wybicie), a wynik każdej akcji rozstrzyga
// pojedynek umiejętności: Strzały+Technika+Opanowanie ↔ Bramkarstwo, Drybling ↔ Odbiór, Podania ↔ Krycie
// (przechwyty), Gra głową+Siła ↔ Gra głową+Siła / Wyjścia bramkarza, Szybkość ↔ Szybkość, Kondycja → zmęczenie.
// Umiejętności w meczu zależą od formy, oceny na żywo i zmęczenia. Stałe fragmenty powstają wyłącznie z sytuacji
// na boisku (piłka za linią, faul, spalony), a komentator opisuje to, co się wydarzyło.
import { ATTRS, PHYS_ATTRS, familiarity, formMul, moraleMul, POS_GROUP, slotRating } from './player.js';
import { FORMATIONS, autoLineup } from './tactics.js';
import { Match } from './match.js';
import { Narrator } from './narrator.js';

export const CLOCK = 7.2;           // sekundy zegara meczu na sekundę symulacji (90 min = 12,5 min symulacji)
const DT = 0.05;
const PW = 68, PL = 105, GHW = 3.66, GH = 2.44, GRAV = 9.81;
const ROLL_A = 1.3, ROLL_K = 0.22;  // toczenie piłki: dv/dt = -(A + K·v)
const PERIOD_END = [0, 2700, 5400, 6300, 7200];
const NUMS = { GK: [1], RB: [2], LB: [3], CB: [4, 5, 15], DM: [6, 16], CM: [8, 14, 18], AM: [10, 20], RW: [7, 17], LW: [11, 21], CF: [9, 19, 22] };
const SHW = [0.45, 1, 1.6];         // skłonność do strzałów (polecenie)
const DRW = [0.55, 1, 1.5];         // skłonność do dryblingu
const TK_RATE = [0.45, 0.75, 1.15]; // próby odbioru na sekundę (delikatny / normalny / ostry) – obrońca najpierw asekuruje
const ATTR_SPREAD = 0.7;            // różnice umiejętności w meczu (1 = pełne); pojedynki mają też losowość

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rnd = (a, b) => a + Math.random() * (b - a);
const hyp = (x, y) => Math.sqrt(x * x + y * y);
const D2 = (a, b) => hyp(b.x - a.x, b.y - a.y);
const sig = (x) => 1 / (1 + Math.exp(-x));
function gaussR() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1e-9;
  const u = clamp(((px - ax) * dx + (py - ay) * dy) / L2, 0, 1);
  return { d: hyp(ax + dx * u - px, ay + dy * u - py), u };
}
const groundDist = (v0, va) => (v0 - va) / ROLL_K - (ROLL_A / (ROLL_K * ROLL_K)) * Math.log((ROLL_A + ROLL_K * v0) / (ROLL_A + ROLL_K * va));
const groundTime = (v0, va) => Math.log((ROLL_A + ROLL_K * v0) / (ROLL_A + ROLL_K * va)) / ROLL_K;
/** Prędkość piłki przy partnerze po podaniu po ziemi (mocniej przy dłuższych podaniach). */
const passVa = (d) => clamp(6.5 + d * 0.16, 7.5, 12.5);
function solveV0(d, va) {
  let lo = va, hi = 45;
  for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2; if (groundDist(m, va) < d) lo = m; else hi = m; }
  return (lo + hi) / 2;
}

export class LiveMatch extends Match {
  constructor(home, away, opts = {}) {
    super(home, away, opts);
    this.live = true;
    this.t = 0;
    this.clk = 0;
    this.period = 0;
    this.phase = 'PRE';
    this.waiting = null;
    this.stopMin = [0, null, null, null, null];
    this.firstKick = 0;
    this.userSide = 0;
    this.upSide = 0;
    this.ball = { x: PW / 2, y: PL / 2, z: 0, vx: 0, vy: 0, vz: 0, owner: null, last: null, spin: 0 };
    this.ref = { x: 28, y: 46, vx: 0, vy: 0, goal: null };
    this.lines = [{ x: -0.8, y: 30 }, { x: PW + 0.8, y: 75 }];
    this.teams = [0, 1].map((s) => this.mkTeam(s));
    this.teamMul = [1, 1];
    this.fxq = [];
    this.comm = [];
    this.onComm = null;
    this.onEvent = null;
    this.dead = null;
    this.shot = null;
    this.lastPass = null;
    this.lastLoss = null;
    this.thinkT = 0;
    this.aiT = 0;
    this.wonT = [-9, -9];
    this.goalsHalf = 0;
    this.subsHalf = 0;
    this.injHalf = 0;
    this.cardsHalf = 0;
    for (const S of this.sides) S.pend = [];
    this.narr = new Narrator(this);
  }

  // =====================================================================
  // drużyny i zawodnicy
  // =====================================================================
  mkTeam(s) {
    const S = this.sides[s];
    const T = { s, name: S.name, players: [], nums: {}, used: new Set(), line: 20 };
    const slots = S.on.filter(Boolean);
    for (const sl of slots) {
      const n = (NUMS[sl.pos] || []).find((k) => !T.used.has(k));
      if (n) { T.nums[sl.pid] = n; T.used.add(n); }
    }
    for (const sl of slots) if (T.nums[sl.pid] == null) T.nums[sl.pid] = this.freeNum(T);
    for (const pid of S.bench) if (T.nums[pid] == null) T.nums[pid] = this.freeNum(T);
    for (const sl of slots) T.players.push(this.mkAgent(s, sl, T));
    return T;
  }

  freeNum(T) {
    for (let n = 2; n < 99; n++) if (!T.used.has(n)) { T.used.add(n); return n; }
    return 99;
  }

  mkAgent(s, sl, T) {
    const p = sl.p;
    return {
      side: s, pid: sl.pid, p, pos: sl.pos, gk: sl.pos === 'GK', num: T.nums[sl.pid] ?? this.freeNum(T), ln: p.ln,
      sx: sl.x, sy: sl.y, x: PW / 2, y: PL / 2, vx: 0, vy: 0, face: 0, tx: PW / 2, ty: PL / 2,
      mode: 'shape', urg: 0.4, goal: null, gSpd: 1, target: null,
      state: 'play', stT: 0, kickT: 0, hl: 0, diveDir: 1, limp: false, injured: false,
      rating: 6.5, eff: {}, effT: -9, decT: 0, act: null, beatT: 0, tackleCd: 0, runT: 0, runTo: null, noTouch: 0, holdT: 0,
      flags: {}, ph1: Math.random() * 6.28, ph2: Math.random() * 6.28,
    };
  }

  active(s) {
    const c = this._act || (this._act = [null, null]);
    return c[s] || (c[s] = this.teams[s].players.filter((a) => a.state !== 'off' && a.state !== 'gone'));
  }
  agentOf(s, pid) { return this.teams[s].players.find((a) => a.pid === pid && a.state !== 'off' && a.state !== 'gone') || null; }
  gkOf(s) { return this.active(s).find((a) => a.gk) || null; }
  allAgents() { return this._all || (this._all = this.active(0).concat(this.active(1))); }
  invalidate() { this._act = null; this._all = null; }
  ps(a) { return this.pstat(this.sides[a.side], a.pid, a.pos); }
  instr(a) {
    const S = this.sides[a.side];
    const sl = S.on.find((x) => x && x.pid === a.pid);
    return sl ? this.ins(S, sl) : { sh: 1, dr: 1, ps: 1, tk: 1, dv: 0 };
  }

  // ---------------- umiejętności w meczu ----------------
  /** Efektywna umiejętność: atrybut × forma × morale × ocena na żywo × zmęczenie × pozycja × trening × drużyna. */
  E(a, k) {
    if (this.t - a.effT > 0.6) this.refreshEff(a);
    return a.eff[k];
  }

  refreshEff(a) {
    const p = a.p, S = this.sides[a.side];
    const st = S.st[a.pid] ?? 90;
    const fat = Math.max(0, 100 - st) / 100;
    const fatT = 1 - 0.3 * Math.pow(fat, 1.25);
    const fatP = 1 - 0.44 * Math.pow(fat, 1.25);
    const r = a.rating;
    const rMul = r >= 7.0 ? 1 + Math.min(0.06, (r - 7.0) * 0.04) : r < 6.3 ? 1 - Math.min(0.08, (6.3 - r) * 0.06) : 1;
    const fam = a.gk ? 1 : familiarity(p, a.pos);
    const base = formMul(p) * moraleMul(p) * rMul * this.teamMul[a.side] * (a.limp ? 0.85 : 1);
    const tr = S.train || {};
    const lv = (k) => (tr[k] || 0) / 100;
    for (const k of ATTRS) {
      let m = base * (PHYS_ATTRS.has(k) ? fatP : fatT);
      if (!PHYS_ATTRS.has(k)) m *= fam;
      if (k === 'sh' || k === 'dr') m *= 1 + 0.04 * lv('off');
      else if (k === 'tk' || k === 'mk') m *= 1 + 0.04 * lv('def');
      else if (k === 'ps' || k === 'te') m *= 1 + 0.04 * lv('poss');
      else if (k === 'cm') m *= 1 + 0.05 * lv('ment');
      a.eff[k] = (55 + ((p.a[k] ?? 40) - 55) * ATTR_SPREAD) * m;
    }
    a.effT = this.t;
  }

  /** Mnożnik błędów: słaba ocena i zmęczenie zwiększają rozrzut. */
  errMul(a) {
    const st = this.sides[a.side].st[a.pid] ?? 90;
    return (1 + Math.max(0, 6.3 - a.rating) * 0.25) * (1 + Math.max(0, 60 - st) / 120);
  }

  topSpeed(a) {
    const sp = this.E(a, 'sp');
    let v = 5.4 + 3.6 * sp / 100;
    if (this.ball.owner === a) v *= 0.82 + 0.1 * this.E(a, 'dr') / 100;
    if (a.beatT > 0) v *= 0.45;
    if (a.limp) v *= 0.6;
    if (a.state === 'stumble') v *= 0.4;
    return v;
  }

  rate(a, d) { if (a) a.rating = clamp(a.rating + d, 3, 10); }

  /** Przyspieszenie (m/s²) – realistyczne: ok. 6–6,7 u najszybszych. */
  accel(a) { return 4.5 + 2.5 * this.E(a, 'sp') / 100; }

  /** Czas dobiegnięcia na odległość d z uwzględnieniem rozpędzania się. */
  reachTime(a, d) {
    if (d <= 0) return 0;
    const v = this.topSpeed(a), A = this.accel(a);
    const v0 = Math.min(v * 0.9, hyp(a.vx, a.vy) * 0.5);
    const tAcc = (v - v0) / A, dAcc = ((v0 + v) / 2) * tAcc;
    if (d <= dAcc) return (-v0 + Math.sqrt(v0 * v0 + 2 * A * d)) / A;
    return tAcc + (d - dAcc) / v;
  }

  setTeamMul() {
    for (const S of this.sides) {
      let m = 1;
      if (!this.opts.neutral) m *= S.home ? 1.03 : 1;
      else if (S.spec.host) m *= 1.03;
      const cap = this.agentOf(S.idx, S.sp.cap);
      if (cap) m *= 1 + ((cap.p.a.ld - 50) / 50) * 0.02;
      this.teamMul[S.idx] = m;
    }
  }

  // =====================================================================
  // geometria (drużyna atakuje w górę albo w dół)
  // =====================================================================
  dirOf(s) { return s === this.upSide ? 1 : -1; }
  w(s, X, Y) { return this.dirOf(s) > 0 ? { x: X, y: Y } : { x: PW - X, y: PL - Y }; }
  rx(s, x) { return this.dirOf(s) > 0 ? x : PW - x; }
  ry(s, y) { return this.dirOf(s) > 0 ? y : PL - y; }
  goalY(s) { return this.dirOf(s) > 0 ? PL : 0; }
  inBox(s, x, y) { const Y = this.ry(s, y), X = this.rx(s, x); return Y > PL - 16.5 && X > 34 - 20.16 && X < 34 + 20.16; }
  inOwnBox(a) { return this.inBox(1 - a.side, a.x, a.y); }
  ahead(s, p, d, jx = 0, minY = 4, maxY = 101) {
    return this.w(s, clamp(this.rx(s, p.x) + jx, 3, PW - 3), clamp(this.ry(s, p.y) + d, minY, maxY));
  }

  /** Zagrożenie bramkowe z danego miejsca (ok. prawdopodobieństwo zdobycia gola z tej pozycji). */
  xT(s, x, y) {
    const X = this.rx(s, x), Y = this.ry(s, y);
    const dx = X - 34, dy = PL - Y;
    const d = hyp(dx, dy);
    return 0.3 * Math.exp(-d / 7.5) * (1 - Math.min(1, Math.abs(dx) / 30) * 0.6) + 0.006 + 0.0002 * Y;
  }

  lossCost(s, y) { return 0.004 + 0.05 * Math.exp(-this.ry(s, y) / 14); }

  /** Model goli oczekiwanych: odległość, kąt, rywale na linii strzału. */
  xg(s, x, y, by = null) {
    const X = this.rx(s, x), Y = this.ry(s, y);
    const dx = 34 - X, dy = PL - Y;
    const d = hyp(dx, dy);
    const ang = Math.atan2(7.32 * dy, dx * dx + dy * dy - GHW * GHW);
    let v = sig(-1.75 + 2.2 * Math.max(0, ang) - 0.085 * d);
    const gy = this.goalY(s);
    for (const o of this.active(1 - s)) {
      if (o.gk || o.state !== 'play') continue;
      const sd = segDist(o.x, o.y, x, y, 34, gy);
      if (sd.u > 0.04 && sd.d < 1.4) v *= 0.72;
    }
    if (by) {
      const pr = this.pressure(by);
      v *= 1 - pr * 0.25;
    }
    return clamp(v, 0.004, 0.85);
  }

  /** Presja na zawodnika: rywale w promieniu ok. 4,5 m (bliżej i w biegu na niego – mocniej). */
  pressure(a) {
    let p = 0;
    for (const o of this.active(1 - a.side)) {
      if (o.state !== 'play') continue;
      const dx = a.x - o.x, dy = a.y - o.y;
      const d = hyp(dx, dy);
      if (d >= 4.5) continue;
      const closing = d > 0.1 ? Math.max(0, (o.vx * dx + o.vy * dy) / d) : 0;
      p += ((4.5 - d) / 4.5) * (0.8 + Math.min(0.4, closing * 0.06));
    }
    return Math.min(1, p);
  }

  nearestOppDist(s, P) {
    let m = 99;
    for (const o of this.active(1 - s)) { if (o.state !== 'play') continue; const d = D2(o, P); if (d < m) m = d; }
    return m;
  }

  // =====================================================================
  // pętla symulacji
  // =====================================================================
  /** Krok symulacji o simDt sekund (czas boiska). */
  advance(simDt) {
    if (this.done || this.waiting) return;
    if (this.phase === 'PRE') this.startPeriod(1);
    let dt = simDt;
    while (dt > 1e-6 && !this.done && !this.waiting) {
      const h = Math.min(DT, dt);
      this.tick(h);
      dt -= h;
    }
  }

  /** Symulacja do końca bez rysowania (przerwy wznawiane automatycznie). */
  simulate() {
    let guard = 0;
    while (!this.done && guard++ < 400000) {
      if (this.waiting) this.resume();
      this.advance(1);
    }
    if (!this.done) this.finish();
    return this.result();
  }

  step() { this.advance(6); return []; }

  tick(h) {
    this.t += h;
    this.invalidate();
    if (this.phase === 'PEN') {
      this.penTick(h);
      this.moveAll(h);
      this.ballStep(h);
      this.refStep(h);
      return;
    }
    if (this.phase === 'PLAY') this.clk += h * CLOCK;
    this.periodCheck();
    if (this.waiting || this.done) return;
    this.thinkT -= h;
    if (this.thinkT <= 0) {
      this.thinkT = 0.15;
      for (const s of [0, 1]) this.teams[s].line = this.secondLast(s);
      for (const s of [0, 1]) this.shape(s);
      this.roles();
      if (!this.ball.owner && !this.dead) this.ballChase();
      this.runs();
    }
    for (const a of this.allAgents()) {
      if (a.noTouch > 0) a.noTouch -= h;
      if (a.beatT > 0) a.beatT -= h;
      if (a.tackleCd > 0) a.tackleCd -= h;
      if (a.runT > 0) { a.runT -= h; if (a.runT <= 0) { a.runTo = null; if (a.mode === 'run') a.mode = 'shape'; } }
    }
    if (this.dead) this.deadTick(h);
    else this.playTick(h);
    this.moveAll(h);
    this.ballStep(h);
    this.refStep(h);
    this.staminaTick(h);
    this.possTick(h);
    this.aiT -= h * CLOCK;
    if (this.aiT <= 0) { this.aiT = 150; for (const S of this.sides) if (S.spec.ai || (this.opts.autoSubs && this.opts.autoSubs[S.idx])) this.aiThink(S); }
    this.narr.tick(h);
  }

  // ---------------- okresy gry ----------------
  minLabel() {
    const c = this.clk, p = this.period;
    if (p >= 1 && p <= 4) {
      const end = PERIOD_END[p];
      if (c >= end) return `${end / 60}+${Math.floor((c - end) / 60) + 1}'`;
      return `${Math.floor(c / 60) + 1}'`;
    }
    return `${Math.floor(c / 60)}'`;
  }

  get minute() { return Math.floor(this.clk / 60); }

  startPeriod(n) {
    this.period = n;
    this.phase = 'PLAY';
    this.clk = PERIOD_END[n - 1];
    this.upSide = n % 2 === 1 ? this.userSide : 1 - this.userSide;
    const ks = n === 1 || n === 3 ? this.firstKick : 1 - this.firstKick;
    if (n > 1) for (const S of this.sides) for (const sl of S.on) if (sl) S.st[sl.pid] = Math.min(100, (S.st[sl.pid] ?? 90) + (n === 2 ? 4 : 2));
    this.goalsHalf = 0; this.subsHalf = 0; this.injHalf = 0; this.cardsHalf = 0;
    this.setTeamMul();
    this.shot = null; this.lastPass = null;
    this.placeKickoff(ks, true);
    this.setDead('kickoff', ks, PW / 2, PL / 2, { first: true });
    this.emit('periodStart', { period: n, side: ks });
  }

  periodCheck() {
    if (this.phase !== 'PLAY') return;
    const p = this.period, base = PERIOD_END[p];
    if (this.clk >= base && this.stopMin[p] == null) {
      const add = p <= 2
        ? clamp(Math.round(1 + this.goalsHalf * 0.5 + this.subsHalf * 0.35 + this.injHalf * 0.8 + this.cardsHalf * 0.25 + Math.random() * 1.2), p === 2 ? 2 : 1, 7)
        : Math.random() < 0.6 ? 1 : 0;
      this.stopMin[p] = add;
      if (add > 0) { this.emit('stoppage', { n: add }); this.addFx('board', { text: '+' + add }); }
    }
    if (this.stopMin[p] == null) return;
    const end = base + this.stopMin[p] * 60;
    if (this.clk < end) return;
    const b = this.ball, o = b.owner;
    const calm = !this.shot && (this.dead ? this.dead.type !== 'goal' && this.dead.type !== 'penalty' : true)
      && (!o || o.gk || (this.ry(o.side, o.y) < 68 && this.ry(o.side, o.y) > 25));
    if (calm || this.clk > end + 50) this.endPeriod();
  }

  endPeriod() {
    const p = this.period;
    const [h, a] = this.sides;
    this.phase = 'BREAK';
    this.dead = null;
    this.shot = null;
    this.ball.owner = null; this.ball.vx = 0; this.ball.vy = 0;
    for (const x of this.allAgents()) { x.mode = 'shape'; x.goal = { x: x.x + rnd(-3, 3), y: x.y + rnd(-3, 3) }; x.urg = 0.2; }
    if (p === 1) { this.waiting = 'HT'; this.emit('halftime', {}); return; }
    if (p === 3) { this.waiting = 'ETH'; this.emit('etHalf', {}); return; }
    if (this.opts.ko && h.goals === a.goals) {
      if (p === 2 && !this.opts.noET) { this.et = true; this.waiting = 'ETB'; this.emit('etStart', {}); return; }
      this.waiting = 'PENB';
      this.emit('pensStart', {});
      return;
    }
    this.finish();
  }

  /** Wznowienie po przerwie (interfejs albo symulacja automatyczna). */
  resume() {
    const w = this.waiting;
    if (!w) return;
    this.waiting = null;
    for (const S of this.sides) this.execSubs(S);
    if (w === 'HT') this.startPeriod(2);
    else if (w === 'ETB') this.startPeriod(3);
    else if (w === 'ETH') this.startPeriod(4);
    else if (w === 'PENB') this.startShootout();
  }

  finish() {
    if (this.done) return;
    this.done = true;
    this.phase = 'FT';
    this.dead = null;
    this.ball.owner = null;
    this.computeRatings();
    this.emit('fulltime', {});
  }

  // =====================================================================
  // myślenie zespołowe: ustawienie, role, pressing, wbiegnięcia
  // =====================================================================
  secondLast(s) {
    const ys = this.active(s).filter((a) => a.state !== 'down').map((a) => this.ry(s, a.y)).sort((a, b) => a - b);
    return ys.length > 1 ? ys[1] : 20;
  }

  /** Cel każdego zawodnika wg formacji: linie zależne od piłki i taktyki, szerokość, przesunięcie, krycie. */
  shape(s) {
    const T = this.teams[s];
    const S = this.sides[s];
    const tac = S.tac || {};
    const st = (tac.style ?? 2) - 2, pr = (tac.press ?? 1) - 1, trap = tac.trap ?? 0;
    const b = this.ball;
    const ref = b.owner ? b.owner : b;
    const bx = this.rx(s, ref.x), by = this.ry(s, ref.y);
    const att = this.poss === s && (b.owner ? b.owner.side === s : true);
    let dl, al, wid, shift;
    const offL = PL - this.teams[1 - s].line;
    if (att) {
      // napastnicy na linii spalonego rywala (rozciągają obronę), pomocnicy w przestrzeni między liniami
      dl = clamp(by - 36 + st * 3, 12, 56);
      al = clamp(Math.max(offL - 1.5, by + 8, dl + 34), 46, 99);
      wid = 1; shift = 0.18;
    } else {
      // defensywny styl: głębiej, węziej i ciaśniej między liniami; ofensywny: wyżej i szerzej (więcej miejsca dla rywala)
      dl = clamp(by - 27 + pr * 7 + st * 2.5 + trap * 2, 6, 46);
      al = clamp(dl + 33 + pr * 3 + st * 2, 28, 74);
      wid = 0.68 + st * 0.04; shift = 0.42;
    }
    const off = offL;
    const opp = this.active(1 - s);
    const tg = [];
    for (const a of T.players) {
      if (a.state === 'gone' || a.state === 'off') continue;
      let X, Y;
      if (a.gk) {
        if (att) { Y = clamp(dl - 18, 3, 14); X = 34 + (bx - 34) * 0.1; }
        else {
          const d = hyp(bx - 34, by);
          Y = clamp(1.2 + d * 0.06, 1.2, 10);
          // sam na sam: zawodnik z piłką blisko i nikogo między nim a bramką – bramkarz skraca kąt
          if (b.owner && b.owner.side !== s && d < 19) {
            let free = true;
            for (const q of this.active(s)) {
              if (q.gk || q.state !== 'play') continue;
              if (segDist(q.x, q.y, b.owner.x, b.owner.y, 34, this.goalY(1 - s)).d < 1.6) { free = false; break; }
            }
            if (free) Y = clamp(d * (0.3 + 0.18 * this.E(a, 'gw') / 100), Y, 8);
          }
          X = clamp(34 + (bx - 34) * clamp(Y / Math.max(1, by), 0.08, 0.6), 34 - 3.3, 34 + 3.3);
        }
      } else {
        const t = clamp((a.sy - 15) / 70, 0, 1);
        Y = lerp(dl, al, t);
        X = 34 + ((a.sx - 50) / 50) * 31 * wid + (bx - 34) * shift;
        // boczni obrońcy podłączają się przy ofensywnym stylu
        if (att && (a.pos === 'LB' || a.pos === 'RB') && st >= 1 && by > 55) Y += 8 + st * 3;
        if (att && Y > off - 0.8 && Y > by) Y = Math.max(by, off - 0.8);
        X += Math.sin(this.t * 0.55 + a.ph1) * 1.3;
        Y += Math.cos(this.t * 0.45 + a.ph2) * 1.1;
      }
      tg.push({ a, X, Y, mk: null });
    }
    if (!att) {
      // krycie przy własnym polu karnym: najgroźniejsi rywale dostają „opiekuna” ustawionego między nimi a bramką
      // (ciasność zależy od Krycia); pozostali bronią strefą z lekkim przesunięciem do najbliższego rywala
      const threats = [];
      for (const q of opp) {
        if (q.gk || q.state !== 'play' || q === b.owner) continue;
        const qX = this.rx(s, q.x), qY = this.ry(s, q.y);
        if (qY < 38) threats.push({ q, X: qX, Y: qY, dz: qY + Math.abs(qX - 34) * 0.5 });
      }
      threats.sort((u, v) => u.dz - v.dz);
      for (const th of threats) {
        let best = null, bd = 15;
        for (const t of tg) {
          if (t.a.gk || t.mk || t.a.mode === 'press') continue;
          const d = hyp(t.X - th.X, t.Y - th.Y);
          if (d < bd) { bd = d; best = t; }
        }
        if (!best) continue;
        best.mk = th;
        const tight = 1.0 + (1 - this.E(best.a, 'mk') / 100) * 1.8;
        const gx = 34 - th.X, gy = -th.Y, gl = hyp(gx, gy) || 1;
        best.X = th.X + (gx / gl) * tight; best.Y = th.Y + (gy / gl) * tight;
      }
      for (const t of tg) {
        if (t.a.gk || t.mk) continue;
        let m = null, md = 9;
        for (const q of opp) {
          if (q.gk || q.state !== 'play') continue;
          const qx = this.rx(s, q.x), qy = this.ry(s, q.y);
          const d = hyp(qx - t.X, qy - t.Y);
          if (d < md) { md = d; m = { x: qx, y: qy }; }
        }
        if (m) { const k = 0.3 + 0.15 * this.E(t.a, 'mk') / 100; t.X = lerp(t.X, m.x, k); t.Y = lerp(t.Y, m.y - 1.6, k); }
      }
    }
    for (const t of tg) {
      const pt = this.w(s, clamp(t.X, 1.2, PW - 1.2), clamp(t.Y, 0.8, PL - 0.8));
      t.a.tx = pt.x; t.a.ty = pt.y;
    }
  }

  /** Role bez piłki: pressing na zawodniku z piłką, asekuracja. */
  roles() {
    const b = this.ball, o = b.owner;
    for (const a of this.allAgents()) {
      if (a.mode === 'press' || a.mode === 'mark') { a.mode = 'shape'; a.markOn = null; }
    }
    if (!o || this.dead) return;
    const d = 1 - o.side;
    const tac = this.sides[d].tac || {};
    const pr = tac.press ?? 1;
    const zone = this.ry(d, o.y);
    const inOwnThird = zone < 36, inOwnHalf = zone < 52;
    const cands = this.active(d).filter((a) => !a.gk && a.state === 'play' && a.beatT <= 0 && !a.goal)
      .sort((p1, p2) => D2(p1, o) - D2(p2, o));
    const n = pr === 2 || zone < 62 ? 2 : 1;
    for (let i = 0; i < Math.min(n, cands.length); i++) {
      const a = cands[i];
      const dist = D2(a, o);
      // pressing wysoki zależy od polecenia; na własnej połowie każda drużyna doskakuje do rywala z piłką
      const lim = i === 0 ? (inOwnThird ? 40 : inOwnHalf ? Math.max(26, [16, 24, 32][pr]) : [16, 24, 32][pr]) : inOwnThird ? 18 : 14;
      if (dist > lim) continue;
      a.mode = 'press';
      a.urg = i === 0 ? (inOwnThird ? 1 : inOwnHalf ? Math.max(0.85, [0.62, 0.82, 1][pr]) : [0.62, 0.82, 1][pr]) : inOwnThird ? 0.9 : 0.7;
      a.pressCover = i > 0;
    }
    // pressing wysoko: kolejni zawodnicy odcinają najbliższe opcje podania (ustawiają się między rywalem a piłką)
    const K = zone > 58 ? [0, 1, 3][pr] : zone > 45 && pr === 2 ? 1 : 0;
    if (K > 0) {
      const recv = this.active(o.side).filter((m) => m !== o && !m.gk && m.state === 'play' && D2(m, o) < 26)
        .sort((p1, p2) => D2(p1, o) - D2(p2, o)).slice(0, K);
      for (const m of recv) {
        let best = null, bd = 16;
        for (const a of this.active(d)) {
          if (a.gk || a.state !== 'play' || a.mode === 'press' || a.mode === 'mark' || a.goal) continue;
          const dd = D2(a, m);
          if (dd < bd) { bd = dd; best = a; }
        }
        if (best) { best.mode = 'mark'; best.markOn = m; best.urg = pr === 2 ? 0.9 : 0.75; }
      }
    }
  }

  /** Kto ruszy do bezpańskiej piłki: przewidywany tor piłki i najwcześniejszy możliwy przechwyt. */
  ballChase() {
    const path = this.predictBall(3.3, 0.15);
    const lp = this.lastPass;
    const res = [{}, {}];
    for (const s of [0, 1]) {
      let best = null, bt = 1e9, bp = null;
      for (const a of this.active(s)) {
        if (a.state !== 'play' || a.goal) continue;
        if (a.gk && !this.inOwnBox(a) && !(lp && lp.to === a)) continue;
        const intended = lp && lp.to === a && this.t - lp.t < 3.5;
        const react = intended ? 0.08 : 0.18 + (1 - this.E(a, 'mk') / 100) * 0.12;
        const top = this.topSpeed(a);
        for (const q of path) {
          const zMax = a.gk && this.inOwnBox(a) ? 2.7 : 2.4;
          if (q.z > zMax) continue;
          const need = react + this.reachTime(a, hyp(q.x - a.x, q.y - a.y) - 0.7);
          if (need <= q.t + 0.02) {
            const tt = q.t - (intended ? 0.25 : 0);
            if (tt < bt) { bt = tt; best = a; bp = q; }
            break;
          }
        }
      }
      for (const a of this.active(s)) if (a.mode === 'chase' && a !== best) a.mode = 'shape';
      res[s] = { best, bt, bp };
    }
    for (const s of [0, 1]) {
      let { best, bp } = res[s];
      if (best && best.gk && res[1 - s].best && res[1 - s].bt < res[s].bt + 0.15) {
        best.mode = 'shape';
        best = null;
      }
      if (best) {
        best.mode = 'chase';
        best.target = { x: clamp(bp.x, -1, PW + 1), y: clamp(bp.y, -1, PL + 1) };
        best.urg = 1;
      }
    }
  }

  predictBall(T, step) {
    const b = this.ball;
    let x = b.x, y = b.y, z = b.z, vx = b.vx, vy = b.vy, vz = b.vz;
    const out = [];
    for (let t = step; t <= T + 1e-9; t += step) {
      const sub = 2, h = step / sub;
      for (let i = 0; i < sub; i++) {
        vz -= GRAV * h; z += vz * h;
        if (z < 0) { z = 0; vz = vz < -1.5 ? -vz * 0.45 : 0; if (vz) { vx *= 0.8; vy *= 0.8; } }
        if (z <= 0.02) {
          const sp = hyp(vx, vy);
          if (sp > 0) { const ns = Math.max(0, sp - (ROLL_A + ROLL_K * sp) * h); vx *= ns / sp; vy *= ns / sp; }
        }
        x += vx * h; y += vy * h;
      }
      out.push({ t, x, y, z });
    }
    return out;
  }

  /** Wbiegnięcia za linię obrony: napastnicy i skrzydłowi, przy ofensywnym stylu także boczni obrońcy. */
  runs() {
    const o = this.ball.owner;
    if (!o || this.dead) return;
    const s = o.side;
    const cy = this.ry(s, o.y);
    const st = (this.sides[s].tac.style ?? 2) - 2;
    const off = PL - this.teams[1 - s].line;
    // wysoko ustawiona obrona rywala: dużo miejsca za jej plecami – wybiegnięcia już przy rozegraniu od tyłu
    const highLine = this.teams[1 - s].line > 30;
    if (cy < (highLine ? 12 : 32)) return;
    const pres = this.pressure(o);
    for (const a of this.active(s)) {
      if (a === o || a.gk || a.state !== 'play' || a.runT > 0 || a.goal) continue;
      const fwd = a.pos === 'CF' || a.pos === 'LW' || a.pos === 'RW' || a.pos === 'AM';
      const fb = (a.pos === 'LB' || a.pos === 'RB') && st >= 1;
      if (!fwd && !(fb && Math.random() < 0.3) && !(a.pos === 'CM' && Math.random() < 0.15)) continue;
      const ay = this.ry(s, a.y);
      if (ay < off - 9 || ay > off + 0.5 || ay < cy - 4) continue;
      const p = 0.15 * (0.6 + 0.6 * this.E(a, 'sp') / 100) * (1 + st * 0.15) * (1 - pres * 0.6) * (a.pos === 'CF' ? 1.25 : 1) * (highLine ? 1.35 : 1);
      if (Math.random() < p) {
        a.runT = rnd(1.6, 2.6);
        a.runTo = this.w(s, clamp(this.rx(s, a.x) + rnd(-7, 7), 6, PW - 6), clamp(off + rnd(7, 15), 58, 102));
        a.mode = 'run';
      }
    }
  }

  // =====================================================================
  // ruch zawodników
  // =====================================================================
  moveAll(h) {
    for (const T of this.teams) for (const a of T.players) this.moveAgent(a, h);
    this.separate();
  }

  targetOf(a) {
    if (a.goal) return { x: a.goal.x, y: a.goal.y, u: a.urg };
    const b = this.ball;
    if (b.owner === a) {
      if (a.act && a.act.to) return { x: a.act.to.x, y: a.act.to.y, u: a.act.u ?? 0.75 };
      return { x: a.x + Math.cos(a.face) * 0.3, y: a.y + Math.sin(a.face) * 0.3, u: 0.2 };
    }
    if (a.mode === 'chase' && a.target) return { x: a.target.x, y: a.target.y, u: 1 };
    if (a.mode === 'press' && b.owner) {
      const o = b.owner;
      const gy = this.goalY(o.side);
      const ang = Math.atan2(gy - o.y, 34 - o.x);
      const dd = a.pressCover ? 5 : 1.1;
      return { x: o.x + o.vx * 0.3 + Math.cos(ang) * dd, y: o.y + o.vy * 0.3 + Math.sin(ang) * dd, u: a.urg };
    }
    if (a.mode === 'run' && a.runTo) return { x: a.runTo.x, y: a.runTo.y, u: 1 };
    if (a.mode === 'mark' && a.markOn && b.owner) {
      const m = a.markOn, o = b.owner;
      return { x: m.x + (o.x - m.x) * 0.22, y: m.y + (o.y - m.y) * 0.22, u: a.urg };
    }
    return { x: a.tx, y: a.ty, u: this.dead ? 0.35 : 0.45 };
  }

  moveAgent(a, h) {
    if (a.kickT > 0) a.kickT -= h;
    if (a.goalUntil && this.t > a.goalUntil) { a.goal = null; a.gSpd = 1; a.goalUntil = 0; }
    if (a.stT > 0) {
      a.stT -= h;
      if (a.stT <= 0 && a.state !== 'off' && a.state !== 'gone') {
        if (a.state === 'slide' || a.state === 'dive' || a.state === 'down') { a.vx *= 0.25; a.vy *= 0.25; }
        a.state = 'play';
      }
    }
    if (a.state === 'gone') return;
    if (a.state === 'down') { a.vx *= 0.85; a.vy *= 0.85; a.x += a.vx * h; a.y += a.vy * h; return; }
    const tg = this.targetOf(a);
    const dx = tg.x - a.x, dy = tg.y - a.y, d = hyp(dx, dy);
    // ustawianie się do stałych fragmentów: najwyżej trochę szybciej niż zwykle (bez nadludzkiego biegu);
    // bramkarz może rzucić się szybciej tylko przy obronie strzału i w serii rzutów karnych
    const g = Math.min(a.gSpd || 1, a.gk && (this.shot || this.phase === 'PEN') ? 2.4 : 1.15);
    let top = this.topSpeed(a) * g;
    let u = tg.u;
    if ((this.phase === 'BREAK' || (this.dead && this.dead.type === 'goal')) && !a.goal) { top *= 0.5; u = Math.min(u, 0.4); }
    if (a.state === 'dive' || a.state === 'slide') top = Math.min(top * 1.5, a.state === 'dive' ? 9 : 10);
    const want = d < 0.05 ? 0 : Math.min(top * (0.3 + 0.7 * u), d * 2.2 * g);
    const vx = d > 0 ? (dx / d) * want : 0, vy = d > 0 ? (dy / d) * want : 0;
    const acc = (a.state === 'dive' || a.state === 'slide' ? 30 : this.accel(a)) * g * g * h;
    const ax = vx - a.vx, ay = vy - a.vy, am = hyp(ax, ay);
    // hamowanie jest szybsze niż rozpędzanie (zwłaszcza powyżej prędkości maksymalnej)
    const brake = a.vx * ax + a.vy * ay < 0 ? (hyp(a.vx, a.vy) > top * 1.05 ? 3 : 1.6) : 1;
    const k = am > acc * brake ? (acc * brake) / am : 1;
    a.vx += ax * k; a.vy += ay * k;
    a.x += a.vx * h; a.y += a.vy * h;
    const sp = hyp(a.vx, a.vy);
    const b = this.ball;
    const fa = sp > 0.8 ? Math.atan2(a.vy, a.vx) : Math.atan2(b.y - a.y, b.x - a.x);
    let df = fa - a.face;
    while (df > Math.PI) df -= 2 * Math.PI;
    while (df < -Math.PI) df += 2 * Math.PI;
    a.face += df * Math.min(1, h * 8);
    if (a.state === 'off' && ((a.goal && d < 0.8) || this.t > a.offUntil)) { a.state = 'gone'; this.invalidate(); }
  }

  separate() {
    const all = [];
    for (const T of this.teams) for (const a of T.players) if (a.state === 'play' || a.state === 'stumble') all.push(a);
    const own = this.ball.owner;
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const a = all[i], b = all[j];
        const min = a.side === b.side ? 1.8 : 1.0;
        const dx = b.x - a.x, dy = b.y - a.y;
        const d2 = dx * dx + dy * dy;
        if (d2 >= min * min) continue;
        const d = Math.sqrt(d2);
        if (d > 0.001) {
          const push = (min - d) * 0.25, ux = dx / d, uy = dy / d;
          const wa = a === own || a.wall ? 0.15 : 1, wb = b === own || b.wall ? 0.15 : 1;
          a.x -= ux * push * wa; a.y -= uy * push * wa;
          b.x += ux * push * wb; b.y += uy * push * wb;
        }
      }
    }
  }

  refStep(h) {
    const r = this.ref, b = this.ball;
    let tx, ty;
    if (r.goal) { tx = r.goal.x; ty = r.goal.y; }
    else {
      const dir = this.dirOf(this.poss);
      tx = clamp(b.x - 9, 5, PW - 5);
      ty = clamp(b.y - dir * 10, 6, PL - 6);
    }
    const dx = tx - r.x, dy = ty - r.y, d = hyp(dx, dy);
    const want = Math.min(6.8, d * 1.5);
    const vx = d > 0 ? (dx / d) * want : 0, vy = d > 0 ? (dy / d) * want : 0;
    r.vx += (vx - r.vx) * Math.min(1, h * 4); r.vy += (vy - r.vy) * Math.min(1, h * 4);
    r.x += r.vx * h; r.y += r.vy * h;
    const su = this.upSide;
    this.lines[0].y += (clamp(this.teams[su].line, 4, 52) - this.lines[0].y) * Math.min(1, h * 3);
    this.lines[1].y += (clamp(PL - this.teams[1 - su].line, 53, PL - 4) - this.lines[1].y) * Math.min(1, h * 3);
  }

  staminaTick(h0) {
    this.stAcc = (this.stAcc || 0) + h0;
    if (this.stAcc < 0.2) return;
    const h = this.stAcc;
    this.stAcc = 0;
    const k = h * (CLOCK / 10);
    for (const S of this.sides) {
      const press = [0.88, 1, 1.22][S.tac.press ?? 1];
      const cond = 1 - 0.25 * ((S.train && S.train.cond) || 0) / 100;
      for (const a of this.active(S.idx)) {
        const sp = hyp(a.vx, a.vy);
        const top = 5.4 + 3.6 * (a.p.a.sp ?? 60) / 100;
        const inten = 0.35 + 0.65 * Math.min(1, sp / top);
        const en = a.p.a.en ?? 60;
        const age = 1 + Math.max(0, (a.p.age || 25) - 29) * 0.02;
        const drain = (a.gk ? 0.03 : 0.1) * inten * (1.3 - 0.6 * en / 100) * press * cond * age * k;
        S.st[a.pid] = Math.max(5, (S.st[a.pid] ?? 90) - drain);
        if (S.st[a.pid] < 45 && !a.flags.tired) { a.flags.tired = true; this.emit('tired', { a }); }
        if (!a.injured && this.phase === 'PLAY' && Math.random() < 0.0000013 * k * 10 * (1 + 2 * Math.max(0, 70 - S.st[a.pid]) / 70)) this.injure(a, false);
      }
    }
  }

  possTick(h) {
    if (this.phase !== 'PLAY') return;
    const o = this.ball.owner;
    if (o) this.poss = o.side;
    // posiadanie: piłka przy nodze albo w drodze do partnera (wybicia, strzały i bezpańskie piłki się nie liczą)
    const lp = this.lastPass;
    if (!this.dead && (o || (lp && !lp.done && lp.side === this.poss && this.t - lp.t < 4))) this.sides[this.poss].poss += h;
    const b = this.ball;
    const s = this.poss;
    const thr = Math.min(1, this.xT(s, b.x, b.y) / 0.06);
    const target = (s === 0 ? 1 : -1) * (0.25 + 0.75 * thr);
    this.mom += (target - this.mom) * Math.min(1, h * 0.35);
  }

  // =====================================================================
  // gra: decyzje zawodnika z piłką, pressing, odbiory
  // =====================================================================
  playTick(h) {
    const b = this.ball;
    const o = b.owner;
    if (!o) return;
    // bramkarz z piłką w rękach – chwila na ustawienie się drużyny
    if (o.gk && o.holdT > 0) {
      o.holdT -= h;
      o.act = null;
      if (o.holdT <= 0) o.decT = 0;
      else return;
    }
    // próby odbioru przez pressujących
    for (const d of this.active(1 - o.side)) {
      if (d.state !== 'play' || d.gk || d.beatT > 0 || d.tackleCd > 0) continue;
      const dist = D2(d, o);
      if (dist > 1.45) continue;
      const ins = this.instr(d).tk;
      const rate = TK_RATE[ins] * (d.mode === 'press' ? 1 : 0.6);
      if (Math.random() < 1 - Math.exp(-rate * h)) { this.duel(d, o, false); if (b.owner !== o) return; }
      else if (dist < 1.2 && Math.random() < h * (0.1 + 0.08 * ins) * (1.3 - this.E(d, 'tk') / 100)) {
        const back = Math.abs(Math.atan2(d.y - o.y, d.x - o.x) - o.face);
        this.foul(d, o, (back > Math.PI ? 2 * Math.PI - back : back) > 2.4, ins);
        return;
      }
    }
    // zawodnik z piłką
    o.decT -= h;
    const act = o.act;
    if (act && act.k === 'takeon') {
      const t = act.vs;
      if (!t || t.state !== 'play') o.decT = 0;
      else if (D2(o, t) < 1.7) { this.duel(t, o, true); return; }
      if (this.t > act.until) o.decT = 0;
    } else if (act && (act.k === 'carry' || act.k === 'hold')) {
      if (this.t > act.until || (this.pressure(o) > 0.55 && act.k === 'carry' && Math.random() < h * 3)) o.decT = Math.min(o.decT, 0);
    }
    if (o.decT <= 0) this.decide(o);
  }

  decisionDelay(a) {
    const pr = this.pressure(a);
    return clamp(0.22 + Math.random() * 0.45 * (1.15 - this.E(a, 'te') / 100) + (1 - pr) * 0.15, 0.12, 0.9);
  }

  /** Wybór akcji zawodnika z piłką – oceny opcji z uwzględnieniem ryzyka i umiejętności. */
  decide(a) {
    const s = a.side, S = this.sides[s];
    const b = this.ball;
    const X = this.rx(s, a.x), Y = this.ry(s, a.y);
    const pres = this.pressure(a);
    const ins = this.instr(a);
    const tac = S.tac || {};
    const style = (tac.style ?? 2) - 2;
    // defensywny styl = gra bezpośrednia (szybko do przodu, mało podań z tyłu); ofensywny = cierpliwe rozegranie
    const risk = [0.88, 0.94, 1, 1.02, 1.04][tac.style ?? 2];
    // kontratak: świeżo odzyskana piłka – gra do przodu, zanim rywal się ustawi (bardziej przy defensywnym stylu)
    const counter = this.t - (this.wonT[s] ?? -9) < 4.5 ? 1 + Math.max(0, -style) * 0.35 : 0;
    const wasting = tac.tw === 2 || (tac.tw === 1 && S.goals > this.sides[1 - s].goals && this.clk > 3600);
    const behind = this.sides[1 - s].goals - S.goals;
    const desperate = behind > 0 && this.clk > 4800 ? 0.35 : 0;
    const opts = [];
    const here = this.xT(s, a.x, a.y);
    const lc = this.lossCost(s, a.y);
    if (a.gk) { this.decideGK(a, pres); return; }
    // strzał
    if (Y > 66) {
      const xg = this.xg(s, a.x, a.y, a);
      if (xg > 0.012) opts.push({ k: 'shot', u: xg * SHW[ins.sh] * (1 + desperate) * (wasting ? 0.8 : 1) * 1.35 });
    }
    // podania
    const mates = this.active(s);
    for (const m of mates) {
      if (m === a || m.state !== 'play') continue;
      if (m.gk && Y > 35) continue;
      const d = D2(a, m);
      if (d < 4 || d > 52) continue;
      const types = [];
      types.push(d < 32 ? 'ground' : 'air');
      if (m.runT > 0 || (this.ry(s, m.y) > this.ry(s, a.y) + 4 && !m.gk)) types.push('through');
      if ((d >= 20 && d < 32) || (m.runT > 0 && d >= 14 && d < 32)) types.push('air');
      for (const kind of types) {
        const o = this.evalPass(a, m, kind, pres, risk, lc);
        if (!o) continue;
        if (counter && this.ry(s, o.R.y) - Y > 8) o.u += 0.0035 * counter;
        if (style < 0 && Y < 52 && this.ry(s, o.R.y) - Y < 3) o.u -= 0.0016 * -style;
        // gra bezpośrednia: długa piłka do przodu z własnej połowy (plan drużyny grającej defensywnie)
        if (style < 0 && Y < 55 && o.kind !== 'ground' && this.ry(s, o.R.y) - Y > 20) o.u += 0.0028 * -style;
        opts.push(o);
      }
    }
    // dośrodkowanie
    const wide = X < 18 || X > PW - 18;
    if (wide && Y > 68 && !a.gk) {
      const inBox = mates.filter((m) => m !== a && !m.gk && this.inBox(s, m.x, m.y)).length;
      if (inBox >= 1) {
        const cq = this.E(a, 'cr') / 100;
        opts.push({ k: 'cross', u: (0.022 + 0.014 * inBox) * (0.6 + 0.7 * cq) * (1 + style * 0.12) });
      }
    }
    // prowadzenie piłki i drybling
    const gy = this.goalY(s);
    const base = Math.atan2(gy - a.y, 34 - a.x);
    const dirs = [0, -0.55, 0.55, -1.1, 1.1];
    if (X < 12 || X > PW - 12) dirs.push(X < 34 ? -0.2 : 0.2);
    let bestOpp = null, bestOppD = 9;
    for (const o2 of this.active(1 - s)) { if (o2.state !== 'play') continue; const dd = D2(o2, a); if (dd < bestOppD) { bestOppD = dd; bestOpp = o2; } }
    let bestCarry = null, bestTake = null;
    for (const da of dirs) {
      const ang = base + da;
      const L = 6;
      const to = { x: clamp(a.x + Math.cos(ang) * L, 1.5, PW - 1.5), y: clamp(a.y + Math.sin(ang) * L, 4, PL - 4) };
      let block = null, bd = 9;
      for (const o2 of this.active(1 - s)) {
        if (o2.state !== 'play' || o2.beatT > 0) continue;
        const sd = segDist(o2.x, o2.y, a.x, a.y, to.x, to.y);
        if (sd.d < 2.3 && sd.u > 0.05 && sd.d < bd) { bd = sd.d; block = o2; }
      }
      if (!block) {
        const pk = 0.95 - pres * 0.25 - (Y > 70 ? 0.06 : 0);
        const o = { k: 'carry', to, u: pk * this.xT(s, to.x, to.y) * (1 + style * 0.05) - (1 - pk) * lc * risk + (counter && da === 0 ? 0.0015 * counter : 0) };
        if (!bestCarry || o.u > bestCarry.u) bestCarry = o;
      } else if (da === 0 || Math.abs(da) < 0.6) {
        const pb = this.beatChance(a, block);
        const past = { x: clamp(a.x + Math.cos(ang) * 9, 1.5, PW - 1.5), y: clamp(a.y + Math.sin(ang) * 9, 1.5, PL - 1.5) };
        const o = { k: 'takeon', vs: block, to: past, u: (pb * this.xT(s, past.x, past.y) - (1 - pb) * lc * risk) * 0.72 * DRW[ins.dr] * (wasting ? 0.6 : 1) };
        if (!bestTake || o.u > bestTake.u) bestTake = o;
      }
    }
    if (bestCarry) opts.push(bestCarry);
    if (bestTake) opts.push(bestTake);
    // utrzymanie piłki / gra na czas
    opts.push({ k: 'hold', u: here * (wasting ? 1.1 : 0.75) - pres * lc * 0.8 });
    // wybicie pod presją we własnym polu karnym
    if (Y < 18 && pres > 0.5) opts.push({ k: 'clear', u: 0.004 + pres * 0.008 });
    // wybór (lepsza decyzja przy lepszych podaniach, technice i opanowaniu)
    const dec = 0.5 * this.E(a, 'ps') + 0.3 * this.E(a, 'te') + 0.2 * this.E(a, 'cm');
    const tau = 0.0035 * (1.55 - dec / 100) * this.errMul(a);
    let mx = -1e9;
    for (const o of opts) if (o.u > mx) mx = o.u;
    let tot = 0;
    for (const o of opts) { o.w = Math.exp((o.u - mx) / tau); tot += o.w; }
    let r = Math.random() * tot;
    let pick = opts[opts.length - 1];
    for (const o of opts) { r -= o.w; if (r <= 0) { pick = o; break; } }
    if (this.dbg) this.dbg(a, opts, pick, tau);
    this.doAction(a, pick);
  }

  /** Bramkarz z piłką: krótko do obrońcy, gdy bezpiecznie, inaczej długie wybicie. */
  decideGK(a, pres) {
    const s = a.side;
    const short = (this.sides[s].tac.style ?? 2) <= 2 ? 0.75 : 0.85;
    let best = null;
    for (const m of this.active(s)) {
      if (m === a || m.state !== 'play') continue;
      for (const kind of ['ground', 'air']) {
        const o = this.evalPass(a, m, kind, pres, 1.4, 0.03);
        if (!o) continue;
        if (kind === 'ground' && o.ps < short) continue;
        o.u += kind === 'air' ? 0 : 0.004;
        if (!best || o.u > best.u) best = o;
      }
    }
    if (best && (best.kind === 'ground' || Math.random() < 0.85)) this.passTo(a, best.m, best.R, best.kind);
    else this.clear(a);
  }

  evalPass(a, m, kind, pres, risk, lc) {
    const s = a.side;
    let R;
    if (kind === 'through' || (kind === 'air' && m.runT > 0 && m.runTo)) {
      // podanie prostopadłe / za linię obrony (po ziemi albo górą nad obrońcami) – na wybieg partnera
      const dir = m.runT > 0 && m.runTo ? Math.atan2(m.runTo.y - m.y, m.runTo.x - m.x) : Math.atan2(this.goalY(s) - m.y, 34 - m.x);
      const lead = m.runT > 0 ? rnd(5, 9) * (kind === 'air' ? 1.4 : 1) : rnd(3, 6);
      R = { x: clamp(m.x + Math.cos(dir) * lead, 1.5, PW - 1.5), y: clamp(m.y + Math.sin(dir) * lead, 1.5, PL - 1.5) };
    } else {
      R = { x: clamp(m.x + m.vx * 0.45, 1, PW - 1), y: clamp(m.y + m.vy * 0.45, 1, PL - 1) };
    }
    const d = D2(a, R);
    if (d < 3.5 || d > 55) return null;
    const ground = kind !== 'air';
    const va = passVa(d);
    const v0 = ground ? solveV0(d, va) : 0;
    const T = ground ? groundTime(v0, va) : 0.55 + d / 25;
    let keep = 1;
    for (const o of this.active(1 - s)) {
      if (o.state !== 'play' || o.beatT > 0) continue;
      const sd = segDist(o.x, o.y, a.x, a.y, R.x, R.y);
      if (sd.u < 0.04) continue;
      if (!ground && sd.u > 0.16 && sd.u < 0.86) continue;
      const reach = Math.max(0, sd.d - 0.8);
      const tBall = T * sd.u * (ground ? 0.8 : 1);
      const tOpp = (o.gk ? 0.25 : 0.2) + this.reachTime(o, reach);
      let pi = sig((tBall - tOpp) / 0.16) * (0.5 + 0.45 * this.E(o, 'mk') / 100);
      if (sd.u > 0.88) pi *= 0.75;
      keep *= 1 - pi;
    }
    const skill = kind === 'air' ? 0.5 * this.E(a, 'ps') + 0.3 * this.E(a, 'cr') + 0.2 * this.E(a, 'te') : 0.7 * this.E(a, 'ps') + 0.3 * this.E(a, 'te');
    const acc = clamp(1 - (d / 70) * (1.3 - skill / 100) - pres * 0.12 * (1.2 - this.E(a, 'te') / 100), 0.25, 0.995);
    let ps = keep * acc;
    if (!ground) {
      const near = this.nearestOppDist(s, R);
      if (near < 3.5) ps *= 0.55 + 0.45 * near / 3.5;
      ps *= 0.92;
    }
    let V = this.xT(s, R.x, R.y);
    const space = this.nearestOppDist(s, R);
    V *= 0.75 + 0.25 * Math.min(1, space / 5);
    let u = ps * V - (1 - ps) * lc * risk;
    // podanie do zawodnika na spalonym – dobry rozgrywający to widzi
    if (kind === 'through' || kind === 'air') {
      const off = PL - this.teams[1 - s].line;
      if (this.ry(s, m.y) > Math.max(off, this.ry(s, a.y)) + 0.4 && this.ry(s, m.y) > PL / 2) {
        const notice = 0.12 + 0.4 * this.E(a, 'ps') / 100;
        if (Math.random() < notice) return null;
      }
    }
    return { k: 'pass', m, R, kind, u, ps };
  }

  /** Szansa minięcia obrońcy: Drybling (+technika, siła, szybkość) przeciw Odbiorowi (+siła, szybkość). */
  beatChance(a, d) {
    const att = (0.7 * this.E(a, 'dr') + 0.12 * this.E(a, 'te') + 0.1 * this.E(a, 'st') + 0.08 * this.E(a, 'sp'));
    const def = (0.75 * this.E(d, 'tk') + 0.15 * this.E(d, 'st') + 0.1 * this.E(d, 'sp'));
    return sig((att - def) / 26 - 0.25);
  }

  doAction(a, o) {
    const b = this.ball;
    a.act = null;
    switch (o.k) {
      case 'shot': this.shoot(a, b.z > 0.9 ? 'volley' : 'foot'); break;
      case 'pass': this.passTo(a, o.m, o.R, o.kind); break;
      case 'cross': this.cross(a); break;
      case 'clear': this.clear(a); break;
      case 'carry': a.act = { k: 'carry', to: o.to, until: this.t + rnd(0.45, 0.9), u: 0.75 }; a.decT = 0.5; break;
      case 'takeon': a.act = { k: 'takeon', vs: o.vs, to: o.to, until: this.t + 1.3, u: 1 }; a.decT = 1.4; this.emit('takeon', { a, d: o.vs }); break;
      default: a.act = { k: 'hold', to: null, until: this.t + rnd(0.4, 0.8) }; a.decT = 0.5;
    }
  }

  /** Pojedynek obrońcy z zawodnikiem z piłką: Odbiór (+siła, szybkość) przeciw Dryblingowi (+siła, technika). */
  duel(d, a, takeon) {
    const b = this.ball;
    const back = Math.abs(Math.atan2(d.y - a.y, d.x - a.x) - a.face);
    const fromBehind = (back > Math.PI ? 2 * Math.PI - back : back) > 2.4;
    const aggr = this.instr(d).tk;
    const pBeat = this.beatChance(a, d);
    let pWin = 1 - pBeat;
    if (fromBehind) pWin *= 0.6;
    if (takeon) pWin *= 0.95;
    const roll = Math.random();
    const won = roll < pWin * (takeon ? 1 : 0.75);
    // próba odbioru przez obrońcę: często nic się nie dzieje (zawodnik zasłania piłkę), czasem obrońca zostaje minięty
    if (!won && !takeon && roll > 1 - pBeat * 0.55) { /* minięty – niżej */ } else if (!won && !takeon) {
      d.tackleCd = 0.7;
      a.decT = Math.min(a.decT, 0.15);
      return;
    }
    d.tackleCd = 0.8;
    let foulP = won ? (fromBehind ? 0.2 : 0.06 + 0.04 * aggr) : 0.2 + 0.08 * aggr + (fromBehind ? 0.1 : 0) + Math.max(0, (60 - this.E(d, 'tk')) / 200);
    if (this.inBox(a.side, a.x, a.y)) foulP *= 0.42;
    if (Math.random() < foulP) { this.foul(d, a, fromBehind, aggr); return; }
    const dps = this.ps(d);
    dps.tka = (dps.tka || 0) + 1;
    const aps = this.ps(a);
    if (won) {
      dps.tk++;
      this.rate(d, 0.05);
      this.rate(a, takeon ? -0.04 : -0.025);
      aps.drl = (aps.drl || 0) + (takeon ? 1 : 0);
      this.loss(a);
      if (Math.random() < 0.62) {
        this.gainBall(d, 'tackle');
        d.state = 'play';
      } else {
        let ang = Math.atan2(a.y - d.y, a.x - d.x) + rnd(-0.9, 0.9);
        if ((a.x < 7 || a.x > PW - 7) && Math.random() < 0.45) ang = (a.x < 34 ? Math.PI : 0) + rnd(-0.7, 0.7);
        b.owner = null; b.vx = Math.cos(ang) * rnd(4, 8); b.vy = Math.sin(ang) * rnd(4, 8); b.vz = 0;
        b.last = d;
        d.state = 'slide'; d.stT = 0.5;
        a.state = 'stumble'; a.stT = 0.4; a.act = null;
        d.noTouch = 0.2; a.noTouch = 0.3;
      }
      this.emit('tackle', { d, a, takeon, slide: d.state === 'slide' });
    } else {
      d.beatT = rnd(0.55, 0.9);
      d.state = 'stumble'; d.stT = 0.45;
      this.rate(d, -0.04);
      this.rate(a, 0.05);
      aps.drw = (aps.drw || 0) + 1;
      if (a.act && a.act.k === 'takeon') { a.act.until = this.t + 0.4; a.act.vs = null; a.act.k = 'carry'; }
      this.emit('beaten', { d, a, takeon });
    }
  }

  // =====================================================================
  // akcje z piłką: podanie, strzał, dośrodkowanie, wybicie
  // =====================================================================
  kick(a, vx, vy, vz) {
    const b = this.ball;
    b.owner = null;
    b.vx = vx; b.vy = vy; b.vz = vz;
    b.last = a;
    a.noTouch = 0.28;
    a.kickT = 0.25;
    a.face = Math.atan2(vy, vx);
    a.act = null;
  }

  offsideSet(s, passer) {
    const set = new Set();
    const off = PL - this.teams[1 - s].line;
    const by = this.ry(s, this.ball.y);
    for (const m of this.active(s)) {
      if (m === passer || m.gk) continue;
      const my = this.ry(s, m.y);
      if (my > PL / 2 && my > off + 0.35 && my > by + 0.35) set.add(m.pid);
    }
    return set;
  }

  passTo(a, m, R, kind) {
    const s = a.side, b = this.ball;
    const d = D2(a, R);
    const pres = this.pressure(a);
    const skill = kind === 'air' ? 0.55 * this.E(a, 'ps') + 0.25 * this.E(a, 'cr') + 0.2 * this.E(a, 'te') : 0.7 * this.E(a, 'ps') + 0.3 * this.E(a, 'te');
    const err = (1.55 - skill / 100) * (1 + pres * 0.7) * this.errMul(a);
    this.lastPass = { side: s, by: a, to: m, t: this.t, R, kind, offside: this.offsideSet(s, a), from: { x: a.x, y: a.y }, done: false };
    const S = this.sides[s];
    S.pass = S.pass || [0, 0];
    S.pass[0]++;
    const p = this.ps(a);
    p.pa = (p.pa || 0) + 1;
    if (kind === 'air') {
      const land = { x: R.x + gaussR() * d * 0.065 * err, y: R.y + gaussR() * d * 0.065 * err };
      const T = clamp(0.55 + d / 25, 0.7, 2.6);
      const z1 = 0;
      this.kick(a, (land.x - b.x) / T, (land.y - b.y) / T, (z1 - b.z + 0.5 * GRAV * T * T) / T);
    } else {
      const va = passVa(d);
      const v0 = solveV0(d, va) * (1 + gaussR() * 0.05 * err);
      const ang = Math.atan2(R.y - b.y, R.x - b.x) + gaussR() * 0.028 * err;
      this.kick(a, Math.cos(ang) * v0, Math.sin(ang) * v0, 0);
    }
    if (m) { m.mode = 'chase'; m.target = { x: R.x, y: R.y }; m.urg = 1; }
    this.emit('pass', { a, m, kind, R, d, fromY: this.ry(s, a.y), toY: this.ry(s, R.y) });
  }

  cross(a) {
    const s = a.side, b = this.ball;
    const mates = this.active(s).filter((m) => m !== a && !m.gk && m.state === 'play' && this.ry(s, m.y) > PL - 24);
    let tgt = null, best = -1;
    for (const m of mates) {
      const sc = this.E(m, 'hd') + this.E(m, 'st') * 0.3 - this.nearestOppDist(s, m) * -3 + Math.random() * 10;
      if (sc > best) { best = sc; tgt = m; }
    }
    const spot = tgt ? { x: tgt.x + tgt.vx * 0.9, y: tgt.y + tgt.vy * 0.9 } : this.w(s, rnd(28, 40), PL - rnd(5, 11));
    const R = { x: clamp(spot.x, 30 - 8, 38 + 8), y: spot.y };
    const d = D2(a, R);
    const err = (1.45 - this.E(a, 'cr') / 100) * this.errMul(a) * (1 + this.pressure(a) * 0.5);
    const land = { x: R.x + gaussR() * 2.5 * err, y: R.y + gaussR() * 2.5 * err };
    const T = clamp(0.75 + d / 32, 0.9, 1.8);
    const z1 = rnd(1.5, 2.2);
    this.lastPass = { side: s, by: a, to: tgt, t: this.t, R: land, kind: 'cross', offside: this.offsideSet(s, a), from: { x: a.x, y: a.y }, done: false };
    const p = this.ps(a);
    p.cra = (p.cra || 0) + 1;
    // obrońca tuż przed dośrodkowującym może zablokować piłkę (często na rzut rożny)
    let blocker = null;
    for (const d of this.active(1 - s)) {
      if (d.gk || d.state !== 'play') continue;
      const sd = segDist(d.x, d.y, a.x, a.y, land.x, land.y);
      if (sd.u > 0 && sd.u < 0.12 && sd.d < 1.6 && D2(d, a) < 3.2) { blocker = d; break; }
    }
    if (blocker && Math.random() < 0.3 * (0.6 + 0.4 * this.E(blocker, 'mk') / 100)) {
      this.lastPass = null;
      const gyb = this.goalY(s);
      const dirY = gyb > 50 ? 1 : -1;
      this.kick(a, (blocker.x - a.x) * 0.5 + rnd(-2, 2), dirY * rnd(3, 7), rnd(0.5, 3));
      this.ball.last = blocker;
      blocker.state = 'slide'; blocker.stT = 0.4;
      this.ps(blocker).blk = (this.ps(blocker).blk || 0) + 1;
      this.rate(blocker, 0.04);
      this.emit('cross', { a, m: tgt });
      this.emit('block', { d: blocker, a, cross: true });
      return;
    }
    this.kick(a, (land.x - b.x) / T, (land.y - b.y) / T, (z1 - b.z + 0.5 * GRAV * T * T) / T);
    if (tgt) { tgt.mode = 'chase'; tgt.target = land; tgt.urg = 1; }
    this.emit('cross', { a, m: tgt });
  }

  clear(a, header = false) {
    const s = a.side, b = this.ball;
    let away = this.w(s, clamp(this.rx(s, a.x) + rnd(-18, 18), 3, PW - 3), clamp(this.ry(s, a.y) + rnd(25, 40), 20, 75));
    // pod presją blisko własnej bramki – bezpiecznie za linię końcową albo na aut
    const Yc = this.ry(s, a.y), Xc = this.rx(s, a.x);
    if (Yc < 55 && Yc >= 13 && (Xc < 14 || Xc > PW - 14) && Math.random() < 0.15 + this.pressure(a) * 0.35) {
      away = this.w(s, Xc < 34 ? -5 : PW + 5, Yc + rnd(6, 25));
    } else if (Yc < 13 && Math.random() < 0.16 + this.pressure(a) * 0.3 + (header ? 0.12 : 0)) {
      const wide = Xc < 34 ? -1 : 1;
      away = Math.random() < 0.6 ? this.w(s, clamp(Xc + wide * rnd(6, 16), -4, PW + 4), rnd(-7, -2.5)) : this.w(s, wide < 0 ? -5 : PW + 5, Yc + rnd(5, 22));
    }
    const d = D2(a, away);
    const T = clamp(0.9 + d / 28, 1, 2.2);
    this.lastPass = null;
    this.kick(a, (away.x - b.x) / T, (away.y - b.y) / T, ((header ? 0 : 0) - b.z + 0.5 * GRAV * T * T) / T);
    const p = this.ps(a);
    p.clr = (p.clr || 0) + 1;
    this.rate(a, 0.02);
    this.emit('clear', { a, header });
  }

  /** Strzał: kierunek i siła z umiejętności, blok i obrona bramkarza rozstrzygane pojedynkiem. */
  shoot(a, kind = 'foot') {
    const s = a.side, o = 1 - s, b = this.ball, S = this.sides[s];
    const gy = this.goalY(s);
    const G = this.gkOf(o);
    const sx = b.x, sy = b.y, sz = kind === 'head' ? Math.max(b.z, 1.7) : Math.max(0, b.z);
    const dist = hyp(34 - sx, gy - sy);
    const xg = kind === 'pen' ? 0.76 : kind === 'fk' ? clamp(0.12 - (dist - 17) * 0.008, 0.02, 0.12) : this.xg(s, sx, sy, a) * (kind === 'head' ? 0.75 : 1);
    const overWall = kind === 'fk' && Math.random() < 0.68 + 0.25 * this.E(a, 'te') / 100;
    const te = this.E(a, 'te'), sh = this.E(a, 'sh'), cm = this.E(a, 'cm'), hd = this.E(a, 'hd');
    const big = xg > 0.28 && kind !== 'pen';
    const gx = G ? G.x : 34;
    const open = gx >= 34 ? -1 : 1;
    const side = Math.random() < 0.72 ? open : -open;
    const margin = 0.25 + (1 - te / 100) * 0.6;
    const ax = 34 + side * Math.max(0.3, GHW - margin) * rnd(0.65, 1);
    const az = kind === 'head' ? rnd(0.2, 1.5) : kind === 'pen' ? rnd(0.15, 1.6) : rnd(0.15, 1.95);
    let v = kind === 'head' ? 9 + 8 * hd / 100 : kind === 'fk' ? 21 + 7 * sh / 100 : kind === 'volley' ? 15 + 12 * sh / 100 : kind === 'pen' ? 22 + 6 * sh / 100 : 17 + 15 * sh / 100;
    v *= rnd(0.92, 1.05);
    const pres = kind === 'pen' || kind === 'fk' ? 0 : this.pressure(a);
    const baseE = kind === 'head' ? 0.13 : kind === 'volley' ? 0.125 : kind === 'pen' ? 0.035 : kind === 'fk' ? 0.08 : 0.105;
    const skill = kind === 'head' ? hd : 0.7 * te + 0.3 * sh;
    let sg = baseE * (1.6 - skill / 100) * (1 + pres * 0.6) * (1 + dist / 45) * this.errMul(a);
    if (big || kind === 'pen') sg *= 1.3 - (cm / 100) * 0.6;
    const ux0 = ax - sx, uy0 = gy - sy, L0 = hyp(ux0, uy0) || 1;
    const rot = gaussR() * sg;
    const ux = (ux0 * Math.cos(rot) - uy0 * Math.sin(rot)) / L0, uy = (ux0 * Math.sin(rot) + uy0 * Math.cos(rot)) / L0;
    const T = Math.abs(uy) > 0.05 ? Math.abs(gy - sy) / (Math.abs(uy) * v) : 2;
    const cx = sx + ux * v * T;
    // pionowy rozrzut mniejszy niż boczny; strzał „w ziemię” odbija się i leci przy murawie
    const cz = clamp(az + gaussR() * sg * dist * 0.32, 0.05, 9);
    const vx = ux * v, vy = uy * v;
    const vz = (cz - sz + 0.5 * GRAV * T * T) / T;
    const onT = Math.abs(cx - 34) < GHW - 0.12 && cz < GH - 0.1;
    S.shots++;
    S.xg += xg;
    const p = this.ps(a);
    p.sh++;
    // asysta/kluczowe podanie
    const lp = this.lastPass;
    const assist = lp && lp.done && lp.side === s && lp.to === a && this.t - lp.recvT < 5 ? lp.by : null;
    if (assist) { this.ps(assist).kp++; this.rate(assist, 0.1); }
    this.shot = { by: a, side: s, t: this.t, xg, kind, onT, cx, cz, T, block: null, save: null, assist, big };
    // blok
    if (kind !== 'pen') {
      let first = null;
      for (const d of this.active(o)) {
        if (d.gk || d.state !== 'play') continue;
        if (overWall && hyp(d.x - sx, d.y - sy) < 11.5) continue;
        const sd = segDist(d.x, d.y, sx, sy, cx, gy);
        const wB = 1.0 + 0.9 * (1 - sd.u);
        if (sd.u < 0.04 || sd.u > 0.9 || sd.d > wB) continue;
        const zAt = sz + vz * T * sd.u - 0.5 * GRAV * (T * sd.u) ** 2;
        if (zAt > 1.9) continue;
        const pB = (kind === 'fk' ? 0.85 : 0.7) * (0.6 + 0.4 * this.E(d, 'mk') / 100) * (1 - sd.d / (wB + 0.15));
        if (Math.random() < pB && (!first || sd.u < first.u)) first = { d, u: sd.u };
      }
      if (first) this.shot.block = first;
    }
    // obrona bramkarza
    if (G && onT && !this.shot.block) {
      const gkP = Math.abs(G.y - gy);
      const tg = Math.max(0.05, T * (1 - gkP / Math.max(1, Math.abs(gy - sy))));
      const px = sx + vx * tg, pz = sz + vz * tg - 0.5 * GRAV * tg * tg;
      const lat = Math.abs(px - G.x) + Math.max(0, pz - 1.85) * 0.8 + Math.max(0, 0.25 - pz) * 0.5;
      const egk = this.E(G, 'gk'), egw = this.E(G, 'gw');
      let screen = 0;
      for (const d of this.allAgents()) if (d !== a && d !== G && d.state === 'play' && segDist(d.x, d.y, sx, sy, cx, gy).d < 0.8) screen = 0.06;
      const reaction = 0.32 - 0.12 * egk / 100 + screen + (kind === 'fk' ? 0.04 : 0);
      const reach = 0.85 + 0.55 * egk / 100;
      const speed = 2.6 + 3.4 * egk / 100;
      const need = reaction + Math.max(0, lat - reach) / speed;
      let pSave = sig((tg - need) / 0.06);
      if (lat < reach + 0.5) pSave = Math.max(pSave, 0.15 + 0.3 * egk / 100);
      if (kind === 'pen') pSave = clamp(0.2 + (egk - (0.4 * sh + 0.3 * te + 0.3 * cm)) / 240, 0.06, 0.4);
      if (dist < 9 && kind !== 'pen' && D2(G, a) < 6) pSave = clamp(pSave * 0.6 + 0.4 * sig((egw - cm) / 16), 0, 0.95);
      const saved = Math.random() < pSave;
      const pCatch = saved ? sig((egk - 58) / 14 - (v - 18) / 5 - lat * 0.8) : 0;
      this.shot.save = { G, saved, catch: Math.random() < pCatch, tg, px, pz };
      G.goal = { x: clamp(saved ? px : lerp(G.x, px, clamp((reach + speed * Math.max(0, tg - reaction)) / Math.max(0.1, Math.abs(px - G.x)), 0, 0.95)), 34 - GHW, 34 + GHW), y: G.y };
      G.urg = 1; G.gSpd = 2.4; G.goalUntil = this.t + T + 0.7;
      if (Math.abs(px - G.x) > 1.3) { G.state = 'dive'; G.stT = Math.max(0.8, tg + 0.5); G.diveDir = Math.sign(px - G.x); }
    } else if (G) {
      G.goal = { x: clamp(lerp(G.x, cx, 0.4), 34 - GHW, 34 + GHW), y: G.y }; G.urg = 1; G.gSpd = 2; G.goalUntil = this.t + T + 0.5;
    }
    this.kick(a, vx, vy, vz);
    a.noTouch = 0.5;
    this.addFx('shot', { kind });
    this.emit('shot', { a, kind, xg, big, dist, onT });
  }

  // =====================================================================
  // piłka: fizyka, przyjęcia, przechwyty, linie boiska
  // =====================================================================
  ballStep(h) {
    const b = this.ball;
    b.spin += h * (hyp(b.vx, b.vy) * 0.8);
    if (b.owner) {
      const o = b.owner;
      const sp = hyp(o.vx, o.vy);
      const lead = o.gk && o.holdT > 0 ? 0.3 : 0.5 + Math.min(1, sp / 7) * (0.5 + 0.35 * Math.sin(this.t * 8 + o.ph1));
      const tx = o.x + Math.cos(o.face) * lead, ty = o.y + Math.sin(o.face) * lead;
      const k = Math.min(1, h * 16);
      b.x += (tx - b.x) * k; b.y += (ty - b.y) * k;
      b.z = o.gk && o.holdT > 0 ? 1 : 0;
      b.vx = o.vx; b.vy = o.vy; b.vz = 0;
      if (!this.dead && this.phase === 'PLAY') this.touchLines(o);
      return;
    }
    const x0 = b.x, y0 = b.y, z0 = b.z;
    b.vz -= GRAV * h; b.z += b.vz * h;
    if (b.z < 0) {
      b.z = 0;
      if (b.vz < -1.5) { b.vz = -b.vz * 0.45; b.vx *= 0.82; b.vy *= 0.82; } else b.vz = 0;
    }
    if (b.z <= 0.02) {
      const sp = hyp(b.vx, b.vy);
      if (sp > 0) { const ns = Math.max(0, sp - (ROLL_A + ROLL_K * sp) * h); b.vx *= ns / sp; b.vy *= ns / sp; }
    }
    b.x += b.vx * h; b.y += b.vy * h;
    if (this.phase === 'PEN') {
      // seria rzutów karnych: wynik każdego strzału rozstrzyga penTick – piłka tylko zatrzymuje się w siatce
      this.netClamp();
      return;
    }
    if (this.phase !== 'PLAY') return;
    if (this.dead) {
      // piłka po gwizdku toczy się dalej (do siatki / za linię), ale nie jest w grze
      if (this.dead.type === 'goal') this.netClamp();
      return;
    }
    // strzał: blok i obrona w drodze do bramki
    if (this.shot) { if (this.shotFlight()) return; }
    // linia bramkowa
    for (const gy of [0, PL]) {
      if ((y0 - gy) * (b.y - gy) <= 0 && y0 !== b.y && Math.abs(b.y - gy) < 3) {
        const f = (gy - y0) / (b.y - y0);
        const xc = x0 + (b.x - x0) * f, zc = z0 + (b.z - z0) * f;
        const dx = Math.abs(xc - 34);
        if (Math.abs(dx - GHW) < 0.24 && zc < GH + 0.05) { this.woodwork(gy, 'post'); return; }
        if (dx < GHW && Math.abs(zc - GH) < 0.18) { this.woodwork(gy, 'bar'); return; }
        if (dx < GHW - 0.11 && zc < GH - 0.11) {
          const def = gy === this.goalY(0) ? 1 : 0;
          const G = this.gkOf(def);
          const sp = hyp(b.vx, b.vy);
          if (!this.shot && G && G.state !== 'down' && hyp(G.x - xc, G.y - gy) < 2.6 && sp < 17 && zc < 2.3) {
            // bramkarz w zasięgu rzuca się do toczącej się piłki (bez przenoszenia go)
            b.x = clamp(xc, 34 - GHW + 0.3, 34 + GHW - 0.3); b.y = gy === 0 ? 0.6 : PL - 0.6; b.z = 0.5;
            if (Math.abs(b.x - G.x) > 1) { G.state = 'dive'; G.stT = 0.7; G.diveDir = Math.sign(b.x - G.x); }
            G.x = lerp(G.x, b.x, 0.25); G.y = lerp(G.y, b.y, 0.25);
            this.gainBall(G, 'claim');
            G.holdT = rnd(1.2, 2);
            this.emit('claim', { G });
            return;
          }
          this.goal(gy);
          return;
        }
        this.outGoalLine(gy, xc);
        return;
      }
    }
    if (b.x < -0.15 || b.x > PW + 0.15) { this.outTouch(); return; }
    if (this.shot && this.t - this.shot.t < this.shot.T + 0.15) return;
    this.controlCheck();
  }

  touchLines(o) {
    const b = this.ball;
    if (b.x < -0.1 || b.x > PW + 0.1) { b.owner = null; this.outTouch(); return; }
    if (b.y < 0.5 || b.y > PL - 0.5) {
      // przy linii końcowej zawodnik zatrzymuje piłkę i musi coś zrobić (strzał, wycofanie, podanie)
      b.y = clamp(b.y, 0.5, PL - 0.5);
      o.vx *= 0.3; o.vy *= 0.3;
      if (o.act && o.act.k !== 'hold') { o.act = null; o.decT = Math.min(o.decT, 0.05); }
    }
  }

  netClamp() {
    const b = this.ball;
    for (const gy of [0, PL]) {
      const inside = gy === 0 ? b.y < 0 : b.y > PL;
      if (inside && Math.abs(b.x - 34) < GHW + 0.5) {
        const lim = gy === 0 ? -1.8 : PL + 1.8;
        if ((gy === 0 && b.y < lim) || (gy === PL && b.y > lim)) { b.y = lim; b.vx *= 0.2; b.vy = 0; b.vz = Math.min(0, b.vz); }
        b.x = clamp(b.x, 34 - GHW + 0.2, 34 + GHW - 0.2);
        b.z = Math.min(b.z, GH - 0.2);
      }
    }
  }

  /** Przebieg strzału: blok, parada, chwyt – zgodnie z rozstrzygnięciem pojedynku. */
  shotFlight() {
    const sh = this.shot, b = this.ball;
    const el = this.t - sh.t;
    if (sh.block && !sh.blockDone && el >= sh.T * sh.block.u - 0.02) {
      sh.blockDone = true;
      const d = sh.block.d;
      const sp = hyp(b.vx, b.vy) * rnd(0.25, 0.55);
      const ang = Math.atan2(-b.vy, -b.vx) + (Math.random() < 0.5 ? Math.PI + rnd(-1.6, 1.6) : rnd(-1.4, 1.4));
      b.vx = Math.cos(ang) * sp; b.vy = Math.sin(ang) * sp; b.vz = rnd(0, 3);
      b.last = d;
      d.state = 'slide'; d.stT = 0.5;
      this.ps(d).blk = (this.ps(d).blk || 0) + 1;
      this.rate(d, 0.06);
      this.emit('block', { d, a: sh.by });
      this.shot = null;
      return true;
    }
    if (sh.save && !sh.saveDone && el >= sh.save.tg - 0.02) {
      sh.saveDone = true;
      const sv = sh.save;
      const G = sv.G;
      if (sv.saved && G.state !== 'off') {
        const S = this.sides[sh.side], D = this.sides[G.side];
        S.sot++;
        this.ps(sh.by).sot++;
        D.saves++;
        this.ps(G).sv++;
        this.rate(sh.by, sh.big ? -0.12 : 0.03);
        this.rate(G, sh.big ? 0.35 : 0.18);
        this.shot = null;
        if (sv.catch) {
          b.x = G.x; b.y = G.y;
          this.gainBall(G, 'save');
          G.holdT = rnd(1.2, 2.2);
          this.emit('save', { G, a: sh.by, how: 'catch', big: sh.big, kind: sh.kind });
        } else {
          const gy = this.goalY(sh.side);
          const away = gy > 50 ? -1 : 1; // w stronę boiska
          const sideSign = Math.sign(b.x - 34) || (Math.random() < 0.5 ? -1 : 1);
          const r = Math.random();
          if (r < 0.42) {
            // sparowana na rzut rożny: obok słupka albo nad poprzeczką (nigdy do własnej bramki)
            const distLine = Math.max(0.2, Math.abs(gy - b.y));
            const vy = rnd(3, 7), tl = distLine / vy;
            const need = GHW + 0.8 - (b.x - 34) * sideSign;
            const vxNeed = (need + 0.4) / tl;
            if (vxNeed < 12) { b.vx = sideSign * Math.max(rnd(1.5, 4), vxNeed); b.vz = rnd(0.5, 3); }
            else { b.vx = sideSign * rnd(1, 3); b.vz = (2.9 - b.z + 4.9 * tl * tl) / tl + 0.5; }
            b.vy = -away * vy;
          } else if (r < 0.75) {
            // w bok, lekko w pole
            b.vx = sideSign * rnd(6, 11); b.vy = away * rnd(0.5, 3); b.vz = rnd(0.5, 3);
          } else {
            // odbita przed siebie – szansa na dobitkę
            const ang = Math.atan2(away, rnd(-1, 1)), sp = rnd(6, 11);
            b.vx = Math.cos(ang) * sp; b.vy = Math.sin(ang) * sp; b.vz = rnd(0.5, 3);
          }
          b.last = G;
          this.emit('save', { G, a: sh.by, how: Math.abs(sv.px - G.x) > 1.3 ? 'dive' : 'parry', big: sh.big, kind: sh.kind });
        }
        return true;
      }
    }
    if (el > sh.T + 0.6) this.shot = null;
    return false;
  }

  woodwork(gy, what) {
    const b = this.ball, sh = this.shot;
    const s = gy === this.goalY(0) ? 0 : 1;
    b.y = gy === 0 ? 0.2 : PL - 0.2;
    b.vy = -b.vy * rnd(0.45, 0.65);
    b.vx += (b.x > 34 ? 1 : -1) * rnd(-1, 2.5);
    if (what === 'bar') b.vz = -Math.abs(b.vz) * 0.4 - 1;
    if (sh) { this.ps(sh.by).sot += 0; this.rate(sh.by, 0.02); }
    this.shot = null;
    this.addFx('post', { x: b.x, y: b.y });
    this.emit('woodwork', { what, a: sh ? sh.by : b.last, side: s });
  }

  goal(gy) {
    const b = this.ball;
    const att = gy === this.goalY(0) ? 0 : 1;
    const def = 1 - att;
    const sh = this.shot;
    const last = b.last;
    const og = last && last.side === def && !(sh && sh.by.side === att && this.t - sh.t < 2.5 && (!sh.block || last !== sh.block.d));
    const scorer = og ? last : sh && sh.by.side === att && this.t - sh.t < 4 ? sh.by : last && last.side === att ? last : null;
    const S = this.sides[att], D = this.sides[def];
    S.goals++;
    this.goalsHalf++;
    let assist = null;
    if (!og && scorer) {
      const p = this.ps(scorer);
      p.g++;
      if (sh && sh.by === scorer) { S.sot++; p.sot++; }
      const pen = sh && sh.kind === 'pen';
      this.rate(scorer, pen ? 0.6 : sh && (sh.kind === 'head' || sh.xg < 0.06) ? 1.0 : 0.9);
      assist = sh && sh.assist && sh.assist !== scorer ? sh.assist : null;
      if (assist) { this.ps(assist).a++; this.rate(assist, 0.6); }
      for (const m of this.active(att)) if (m !== scorer) this.rate(m, 0.04);
    } else if (og && scorer) {
      this.ps(scorer).og++;
      this.rate(scorer, -0.9);
    }
    const G = this.gkOf(def);
    if (G) this.rate(G, -0.25);
    for (const m of this.active(def)) if (POS_GROUP[m.pos] === 'D') this.rate(m, -0.08);
    const ll = this.lastLoss;
    if (ll && ll.side === def && this.t - ll.t < 10 && ll.a.state !== 'gone') { this.rate(ll.a, -0.35); ll.a.flags.error = true; }
    const pen = !!(sh && sh.kind === 'pen');
    this.key.push({ min: this.minLabel(), side: att, type: 'goal', pid: scorer ? scorer.pid : null, pid2: assist ? assist.pid : null, og: !!og, pen });
    this.shot = null;
    this.lastPass = null;
    this.addFx('goal', { s: att, name: scorer ? scorer.ln + (og ? ' (sam.)' : '') : '' });
    this.addFx('net', { y: gy, x: clamp(b.x, 34 - GHW, 34 + GHW) });
    this.emit('goal', { side: att, a: scorer, assist, og: !!og, pen, kind: sh ? sh.kind : 'foot', score: [this.sides[0].goals, this.sides[1].goals] });
    this.setDead('goal', def, PW / 2, PL / 2, { scorer, att });
  }

  outGoalLine(gy, xc) {
    const b = this.ball;
    const att = gy === this.goalY(0) ? 0 : 1;
    const def = 1 - att;
    const last = b.last;
    const sh = this.shot;
    if (sh && sh.by.side === att) {
      this.rate(sh.by, sh.big ? -0.25 : -0.02);
      const high = b.z > GH;
      this.emit('miss', { a: sh.by, high, big: sh.big, kind: sh.kind });
      this.shot = null;
    }
    this.shot = null;
    if (last && last.side === def) {
      const fx = xc < 34 ? 0.6 : PW - 0.6;
      this.sides[att].corners++;
      this.setDead('corner', att, fx, gy === 0 ? 0.6 : PL - 0.6, { by: last });
    } else {
      this.setDead('goalkick', def, 34 + (xc < 34 ? -5 : 5), gy === 0 ? 5.5 : PL - 5.5);
    }
  }

  outTouch() {
    const b = this.ball;
    const last = b.last;
    const side = last ? 1 - last.side : this.poss;
    this.shot = null;
    this.setDead('throw', side, clamp(b.x, 0, PW) < PW / 2 ? 0.1 : PW - 0.1, clamp(b.y, 1, PL - 1));
  }

  /** Kontakt z piłką: przyjęcie, przechwyt, pojedynek w powietrzu, chwyt bramkarza. */
  controlCheck() {
    const b = this.ball;
    if (b.z > 3.1) return;
    const cands = [];
    for (const a of this.allAgents()) {
      if (a.state !== 'play' && a.state !== 'dive' && a.state !== 'jump') continue;
      if (a.noTouch > 0) continue;
      const hand = a.gk && this.inOwnBox(a);
      const reach = hand ? 1.25 : 0.9;
      const d = hyp(a.x - b.x, a.y - b.y);
      if (d > reach) continue;
      if (b.z > (hand ? 2.75 : 2.45)) continue;
      cands.push({ a, d });
    }
    if (!cands.length) return;
    if (b.z > 1.35) { this.aerial(cands.map((c) => c.a)); return; }
    cands.sort((p, q) => p.d - q.d);
    const sides = new Set(cands.map((c) => c.a.side));
    let who = cands[0].a;
    if (sides.size > 1) {
      // dwóch zawodników przy piłce – siła, technika i szybkość
      const A = cands.find((c) => c.a.side === 0).a, B = cands.find((c) => c.a.side === 1).a;
      const sc = (x) => this.E(x, 'st') * 0.3 + this.E(x, 'te') * 0.25 + this.E(x, 'sp') * 0.25 + this.E(x, 'tk') * 0.1 + this.E(x, 'dr') * 0.1 + gaussR() * 14;
      who = sc(A) >= sc(B) ? A : B;
      const loser = who === A ? B : A;
      this.ps(who).duel = (this.ps(who).duel || 0) + 1;
      this.rate(who, 0.02); this.rate(loser, -0.015);
    }
    this.tryControl(who);
  }

  tryControl(a) {
    const b = this.ball;
    const lp = this.lastPass;
    const intended = lp && lp.to === a && !lp.done;
    const hand = a.gk && this.inOwnBox(a);
    const vrel = hyp(b.vx - a.vx, b.vy - a.vy);
    const te = this.E(a, 'te');
    const pres = this.pressure(a);
    let pc;
    if (hand) pc = clamp(0.96 - Math.max(0, vrel - 18) * 0.02 + this.E(a, 'gk') / 2000, 0.6, 0.995);
    else {
      pc = 0.985 - Math.max(0, vrel - 11.5) * 0.018 * (1.45 - te / 100) - pres * 0.22 * (1.25 - te / 100) - (b.z > 0.7 ? 0.12 : 0);
      const opp = lp && lp.side !== a.side && this.t - lp.t < 4;
      if (opp) pc *= 0.72 + 0.28 * this.E(a, 'mk') / 100;
      pc -= Math.max(0, 6.3 - a.rating) * 0.03;
      pc = clamp(pc, 0.3, 0.995);
    }
    if (Math.random() < pc) {
      this.gainBall(a, intended ? 'pass' : lp && lp.side !== a.side && this.t - lp.t < 4 ? 'intercept' : 'loose');
      if (hand && b.z > 0.3) a.holdT = rnd(1, 2);
    } else {
      const sp = Math.max(2, hyp(b.vx, b.vy) * rnd(0.25, 0.5));
      const ang = Math.atan2(b.vy, b.vx) + rnd(-1.2, 1.2);
      b.vx = Math.cos(ang) * sp; b.vy = Math.sin(ang) * sp; b.vz = rnd(0, 1.6);
      b.last = a;
      a.noTouch = 0.35;
      if (intended) { this.rate(a, -0.03); this.emit('badTouch', { a }); }
    }
  }

  gainBall(a, how) {
    const b = this.ball;
    const prev = this.poss;
    const lp = this.lastPass;
    b.owner = a; b.vx = 0; b.vy = 0; b.vz = 0;
    b.last = a;
    a.mode = 'shape';
    a.target = null;
    a.runT = 0; a.runTo = null;
    a.act = null;
    a.decT = this.decisionDelay(a);
    // podanie: celne albo przechwycone
    if (lp && !lp.done) {
      lp.done = true;
      if (lp.side === a.side) {
        if (lp.offside && lp.offside.has(a.pid) && lp.by !== a) { this.offside(a, lp); return; }
        lp.recvT = this.t;
        if (lp.to !== a) lp.to = a;
        const S = this.sides[a.side];
        S.pass = S.pass || [0, 0];
        S.pass[1]++;
        const p = this.ps(lp.by);
        p.pc = (p.pc || 0) + 1;
        const prog = this.ry(a.side, a.y) - this.ry(a.side, lp.from.y);
        this.rate(lp.by, 0.004 + (prog > 12 && this.ry(a.side, a.y) > 66 ? 0.012 : 0));
        this.emit('received', { a, by: lp.by, kind: lp.kind, prog });
        // spóźniony atak na przyjmującego
        if (!a.gk && Math.random() < 0.05) {
          let dd = null, md = 1.3;
          for (const o of this.active(1 - a.side)) { if (o.gk || o.state !== 'play') continue; const q = D2(o, a); if (q < md) { md = q; dd = o; } }
          if (dd) { this.foul(dd, a, false, this.instr(dd).tk); return; }
        }
      } else {
        this.rate(lp.by, this.ry(lp.side, lp.from.y) < 35 ? -0.05 : -0.03);
        this.loss(lp.by);
        if (how === 'intercept') { this.ps(a).int = (this.ps(a).int || 0) + 1; this.rate(a, 0.05); }
        this.emit('intercept', { a, by: lp.by, kind: lp.kind });
      }
    } else if (prev !== a.side && how === 'loose') {
      this.emit('recover', { a });
    }
    if (prev !== a.side) this.wonT[a.side] = this.t;
    this.poss = a.side;
    this.shot = null;
  }

  loss(a) { this.lastLoss = { a, side: a.side, t: this.t }; }

  offside(a, lp) {
    const s = a.side;
    this.sides[s].offsides++;
    this.rate(a, -0.03);
    this.addFx('offside', { y: this.w(s, 34, PL - this.teams[1 - s].line).y });
    this.emit('offside', { a, by: lp.by });
    this.setDead('freekick', 1 - s, a.x, a.y, { offside: true });
  }

  /** Pojedynek w powietrzu: Gra głową + Siła (+ timing) ↔ to samo u rywali; bramkarz: Wyjścia (ręce). */
  aerial(cands) {
    const b = this.ball;
    let best = null, bs = -1e9;
    const scores = [];
    for (const a of cands) {
      const d = hyp(a.x - b.x, a.y - b.y);
      const hand = a.gk && this.inOwnBox(a);
      const sc = hand ? this.E(a, 'gw') * 0.75 + 24 - d * 5 + gaussR() * 7 : this.E(a, 'hd') * 0.55 + this.E(a, 'st') * 0.25 + this.E(a, 'sp') * 0.05 + gaussR() * 11 - d * 6;
      scores.push({ a, sc });
      if (sc > bs) { bs = sc; best = a; }
    }
    if (!best) return;
    // przepychanie w powietrzu: faul (najczęściej atakującego na obrońcy)
    const both = new Set(scores.map((x) => x.a.side)).size > 1;
    if (both && Math.random() < 0.1) {
      const lp0 = this.lastPass;
      const attS = lp0 ? lp0.side : this.poss;
      const atts = scores.filter((x) => x.a.side === attS && !x.a.gk), defs = scores.filter((x) => x.a.side !== attS && !x.a.gk);
      if (atts.length && defs.length) {
        const byAtt = Math.random() < 0.7;
        const fouler = (byAtt ? atts : defs)[0].a, victim = (byAtt ? defs : atts)[0].a;
        if (lp0) lp0.done = true;
        this.foul(fouler, victim, false, 0);
        return;
      }
    }
    for (const { a } of scores) {
      a.state = 'jump'; a.stT = 0.45;
      const p = this.ps(a);
      p.aer = (p.aer || 0) + 1;
      if (a !== best) { this.rate(a, -0.015); a.noTouch = 0.5; }
    }
    this.ps(best).aerw = (this.ps(best).aerw || 0) + 1;
    this.rate(best, 0.03);
    const s = best.side;
    const lp = this.lastPass;
    if (lp && !lp.done) {
      lp.done = true;
      if (lp.side === s && lp.offside && lp.offside.has(best.pid) && lp.by !== best) { this.offside(best, lp); return; }
      if (lp.side === s) lp.recvT = this.t;
      lp.to = best;
    }
    // bramkarz łapie albo wypiąstkowuje
    if (best.gk && this.inOwnBox(best)) {
      const caught = Math.random() < sig((this.E(best, 'gw') - 42) / 13);
      if (caught) {
        this.gainBall(best, 'claim');
        best.holdT = rnd(1.2, 2.2);
        this.rate(best, 0.06);
        this.emit('claim', { G: best });
      } else {
        const away = this.w(s, clamp(this.rx(s, best.x) + rnd(-15, 15), 4, PW - 4), clamp(this.ry(s, best.y) + rnd(14, 24), 12, 40));
        const T = 1.1;
        this.lastPass = null;
        this.kick(best, (away.x - b.x) / T, (away.y - b.y) / T, (0 - b.z + 0.5 * GRAV * T * T) / T);
        this.emit('punch', { G: best });
      }
      return;
    }
    const Y = this.ry(s, best.y), X = this.rx(s, best.x);
    if (Y < 18 || (Y < 40 && Math.random() < 0.45)) { this.clear(best, true); return; }
    if (Y > PL - 15 && Math.abs(X - 34) < 15 && this.xg(s, best.x, best.y) > 0.03) { this.shoot(best, 'head'); return; }
    // zgranie głową do partnera
    const mate = this.active(s).filter((m) => m !== best && !m.gk && m.state === 'play').sort((p1, p2) => D2(p1, best) - D2(p2, best))[0];
    if (mate && D2(mate, best) < 18 && D2(mate, best) > 4) {
      const R = { x: mate.x, y: mate.y };
      const T = 0.35 + D2(best, R) / 14;
      this.lastPass = { side: s, by: best, to: mate, t: this.t, R, kind: 'head', offside: this.offsideSet(s, best), from: { x: best.x, y: best.y }, done: false };
      this.kick(best, (R.x - b.x) / T, (R.y - b.y) / T, (0 - b.z + 0.5 * GRAV * T * T) / T);
      mate.mode = 'chase'; mate.target = R;
      this.emit('headPass', { a: best, m: mate });
    } else this.clear(best, true);
  }

  // =====================================================================
  // faule, kartki, kontuzje
  // =====================================================================
  foul(d, a, fromBehind, aggr) {
    const s = a.side;
    const D = this.sides[d.side];
    D.fouls++;
    this.ps(d).fl++;
    this.rate(d, -0.06);
    const inBox = this.inBox(s, a.x, a.y);
    a.state = 'down'; a.stT = rnd(1.2, 2.2);
    a.act = null;
    d.state = Math.random() < 0.5 ? 'slide' : 'play'; d.stT = 0.5;
    const b = this.ball;
    b.owner = null; b.vx = a.vx * 0.4; b.vy = a.vy * 0.4;
    // ocena przewinienia
    const toGoal = this.ry(s, a.y);
    const gy = this.goalY(s);
    let lastMan = toGoal > 62;
    if (lastMan) {
      for (const o of this.active(d.side)) {
        if (o === d || o.gk || o.state !== 'play') continue;
        if (Math.abs(o.y - gy) < Math.abs(a.y - gy) - 1) { lastMan = false; break; }
      }
    }
    const sev = 0.25 + 0.22 * aggr + (fromBehind ? 0.28 : 0) + (hyp(a.vx, a.vy) > 6 ? 0.12 : 0) + Math.random() * 0.45;
    let card = null;
    if (lastMan && !inBox) card = 'red';
    else if (lastMan && inBox) card = 'yellow';
    else if (sev > 1.12 && Math.random() < 0.18) card = 'red';
    else if (sev > 0.8 && Math.random() < 0.5) card = 'yellow';
    if (Math.random() < 0.004 + 0.02 * Math.max(0, sev - 0.6)) this.injure(a, true);
    this.emit('foul', { d, a, inBox, sev });
    if (card) this.card(d, card);
    if (inBox) {
      this.rate(d, -0.35);
      this.setDead('penalty', s, 34, this.w(s, 34, PL - 11).y, { fouled: a, by: d });
    } else {
      this.setDead('freekick', s, clamp(a.x, 1, PW - 1), clamp(a.y, 1, PL - 1), { fouled: a, by: d });
    }
  }

  card(a, kind) {
    const S = this.sides[a.side];
    const p = this.ps(a);
    this.cardsHalf++;
    let red = kind === 'red';
    if (!red) {
      S.yc[a.pid] = (S.yc[a.pid] || 0) + 1;
      S.yel++;
      p.yc++;
      this.rate(a, -0.3);
      if (S.yc[a.pid] >= 2) red = true;
      else this.key.push({ min: this.minLabel(), side: a.side, type: 'yc', pid: a.pid });
    }
    const second = red && kind !== 'red';
    this.addFx('card', { pid: a.pid, side: a.side, red });
    this.emit('card', { a, red, second });
    if (red) {
      S.red++;
      p.rc = 1;
      this.rate(a, -1.2);
      this.key.push({ min: this.minLabel(), side: a.side, type: 'rc', pid: a.pid });
      this.sendOffAgent(a);
    }
  }

  sendOffAgent(a) {
    const S = this.sides[a.side];
    this.pstat(S, a.pid).off = this.minute;
    S.off.add(a.pid);
    const i = S.on.findIndex((x) => x && x.pid === a.pid);
    const wasGK = a.gk;
    const slot = i >= 0 ? S.on[i] : null;
    if (i >= 0) S.on[i] = null;
    a.state = 'off'; a.offUntil = this.t + 6;
    this.invalidate();
    a.goal = { x: a.x < PW / 2 ? -1.5 : PW + 1.5, y: a.y }; a.urg = 0.3;
    if (this.ball.owner === a) this.ball.owner = null;
    if (wasGK && slot) {
      const benchGK = S.bench.find((pid) => S.spec.players[pid] && S.spec.players[pid].pos === 'GK');
      const out = this.active(a.side).filter((x) => !x.gk && x.state === 'play').sort((p1, p2) => p2.sy - p1.sy)[0];
      if (benchGK && S.subsLeft > 0 && out) {
        S.subsLeft--;
        S.pend.push({ out: out.pid, in: benchGK, gkSlot: i });
      } else if (out) {
        // zawodnik z pola staje w bramce
        const oi = S.on.findIndex((x) => x && x.pid === out.pid);
        S.on[i] = { ...slot, pid: out.pid, p: out.p };
        if (oi >= 0) S.on[oi] = null;
        out.gk = true; out.pos = 'GK'; out.sx = slot.x; out.sy = slot.y;
      }
    }
  }

  injure(a, contact = false) {
    const S = this.sides[a.side];
    if (a.injured) return;
    a.injured = true; a.limp = true;
    a.state = 'down'; a.stT = rnd(2.5, 4);
    S.injured.add(a.pid);
    this.pstat(S, a.pid).inj = true;
    S.st[a.pid] = Math.min(S.st[a.pid] ?? 90, 30);
    this.injHalf++;
    this.key.push({ min: this.minLabel(), side: a.side, type: 'inj', pid: a.pid });
    const auto = S.spec.ai || (this.opts.autoSubs && this.opts.autoSubs[a.side]);
    const needSub = !auto && S.subsLeft > 0 && S.bench.length > 0;
    this.addFx('medic', { pid: a.pid, side: a.side });
    this.emit('injury', { a, needSub, contact });
    if (auto) {
      const cand = this.bestBenchFor(S, a.pos);
      if (cand && S.subsLeft > 0) this.sub(a.side, a.pid, cand);
    }
    if (!contact && !this.dead) {
      const o = this.ball.owner;
      this.setDead('dropball', o ? o.side : this.poss, clamp(this.ball.x, 3, PW - 3), clamp(this.ball.y, 3, PL - 3));
    }
  }

  // =====================================================================
  // stałe fragmenty i wznowienia – tylko z prawdziwych sytuacji
  // =====================================================================
  setDead(type, side, x, y, o = {}) {
    const b = this.ball;
    this.dead = { type, side, x, y, t0: this.t, placed: false, taker: null, ...o };
    if (type === 'freekick' || type === 'penalty' || type === 'dropball') { b.owner = null; b.vx *= 0.3; b.vy *= 0.3; }
    this.lastPass = null;
    for (const a of this.allAgents()) { a.act = null; a.runT = 0; a.runTo = null; if (a.mode !== 'shape') a.mode = 'shape'; }
    if (type !== 'goal' && type !== 'kickoff') this.execAllSubs();
    if (type === 'corner') this.emit('corner', { side, by: o.by });
    else if (type === 'throw') this.emit('throw', { side });
    else if (type === 'goalkick') this.emit('goalkick', { side });
    else if (type === 'freekick' && !o.offside) this.emit('freekick', { side, x, y, dist: hyp(this.rx(side, x) - 34, PL - this.ry(side, y)) });
    else if (type === 'penalty') this.emit('penalty', { side, by: o.by, fouled: o.fouled });
    if (type === 'goal') this.celebrate(o.scorer, o.att);
  }

  execAllSubs() { for (const S of this.sides) this.execSubs(S); }

  celebrate(scorer, att) {
    const gy = this.goalY(att), dy = gy > 50 ? 1 : -1;
    if (scorer && scorer.side === att) {
      const cx = scorer.x < 34 ? rnd(5, 10) : rnd(58, 63);
      const cy = gy - dy * rnd(6, 14);
      scorer.goal = { x: cx, y: cy }; scorer.urg = 1; scorer.hl = 4;
      for (const m of this.active(att)) {
        if (m === scorer || m.gk || D2(m, scorer) > 45) continue;
        m.goal = { x: cx + rnd(-3, 3), y: cy - dy * rnd(1, 4) }; m.urg = 0.9;
      }
      this.addFx('confetti', { s: att, x: scorer.x, y: scorer.y });
    }
    const G = this.gkOf(1 - att);
    if (G) { G.state = 'down'; G.stT = 1.4; }
  }

  deadTick(h) {
    const d = this.dead;
    const el = this.t - d.t0;
    if (d.type === 'goal') {
      if (el > 3.6) {
        this.execAllSubs();
        this.placeKickoff(d.side, false);
        this.dead = { type: 'kickoff', side: d.side, x: PW / 2, y: PL / 2, t0: this.t, placed: true, taker: this.kicker };
        this.placeBall(PW / 2, PL / 2);
      }
      return;
    }
    if (!d.placed) {
      if (el < (d.type === 'kickoff' ? 0 : 0.55)) return;
      d.placed = true;
      if (d.type !== 'kickoff') this.placeBall(d.x, d.y);
      this.layout(d);
    }
    const tk = d.taker;
    if (!tk || tk.state === 'off' || tk.state === 'gone') { d.taker = this.pickTaker(d); this.layout(d); return; }
    const sp = d.spot || d;
    const dSpot = D2(tk, sp);
    const ready = dSpot < 1.4 || (tk.goal && D2(tk, tk.goal) < 0.9);
    const [mn, mx] = { kickoff: [0.9, 4.5], throw: [0.9, 2.6], goalkick: [1.4, 3.2], corner: [1.9, 3.6], freekick: [1.4, 3.6], penalty: [2.6, 4.2], dropball: [0.6, 1.6] }[d.type] || [1, 3];
    if (!d.runup && (el < mn || !ready)) {
      // wykonawca nie zdążył dobiec – piłkę bierze najbliższy zawodnik (nikt nie jest przenoszony)
      if (el > mx + 1.5 && !ready && !d.repicked && d.type !== 'penalty') {
        d.repicked = true;
        const nt = this.nearestTo(d.side, sp.x, sp.y, d.type !== 'goalkick');
        if (nt && nt !== tk) { d.taker = nt; this.layout(d); }
      }
      return;
    }
    if (!d.runup) {
      let settled = true;
      if (el < mx) for (const a of this.allAgents()) if (a.goal && a !== tk && D2(a, a.goal) > 1.8) { settled = false; break; }
      if (!settled) return;
    }
    // podbieg do piłki (rzut wolny, karny): wykonawca dobiega do piłki i dopiero wtedy uderza
    if (dSpot > 0.8) {
      if (!d.runup) { d.runup = true; tk.goal = { x: sp.x, y: sp.y }; tk.gSpd = 1.25; tk.urg = 0.85; }
      return;
    }
    this.execRestart(d);
  }

  placeBall(x, y) {
    const b = this.ball;
    b.owner = null; b.x = x; b.y = y; b.z = 0; b.vx = 0; b.vy = 0; b.vz = 0;
  }

  pickTaker(d) {
    const s = d.side;
    const S = this.sides[s];
    const byPid = (pid) => this.agentOf(s, pid);
    if (d.type === 'goalkick') return this.gkOf(s) || this.nearestTo(s, d.x, d.y);
    if (d.type === 'kickoff') return this.kicker && this.kicker.side === s && this.kicker.state === 'play' ? this.kicker : this.nearestTo(s, PW / 2, PL / 2, true);
    if (d.type === 'corner') return byPid(S.sp.cor) || this.bestBy(s, (a) => this.E(a, 'cr'));
    if (d.type === 'penalty') return byPid(S.sp.pen) || this.bestBy(s, (a) => 0.4 * this.E(a, 'sh') + 0.3 * this.E(a, 'te') + 0.3 * this.E(a, 'cm'));
    if (d.type === 'freekick' && !d.offside) {
      const dist = hyp(this.rx(s, d.x) - 34, PL - this.ry(s, d.y));
      if (dist < 32) return byPid(S.sp.fkn) || this.bestBy(s, (a) => 0.5 * this.E(a, 'sh') + 0.5 * this.E(a, 'te'));
      if (this.ry(s, d.y) > 55) return byPid(S.sp.fkf) || this.bestBy(s, (a) => this.E(a, 'cr'));
    }
    return this.nearestTo(s, d.x, d.y, true);
  }

  nearestTo(s, x, y, noGK = false) {
    let best = null, bd = 1e9;
    for (const a of this.active(s)) {
      if (a.state !== 'play' && a.state !== 'stumble') continue;
      if (noGK && a.gk) continue;
      const d = hyp(a.x - x, a.y - y);
      if (d < bd) { bd = d; best = a; }
    }
    return best;
  }

  bestBy(s, f) {
    let best = null, bs = -1e9;
    for (const a of this.active(s)) { if (a.gk || a.state === 'down') continue; const v = f(a); if (v > bs) { bs = v; best = a; } }
    return best;
  }

  clearGoals() { for (const a of this.allAgents()) { a.goal = null; a.gSpd = 1; a.wall = false; } }

  /** Ustawienie zawodników przy wznowieniu (rożny, wolny z murem, karny, wrzut, od bramki). */
  layout(d) {
    this.clearGoals();
    const s = d.side, o = 1 - s;
    d.taker = d.taker || this.pickTaker(d);
    const tk = d.taker;
    const spot = { x: d.x, y: d.y };
    d.spot = spot;
    if (!tk) return;
    const behind = (dist) => ({ x: spot.x + rnd(-0.4, 0.4), y: spot.y - this.dirOf(s) * dist });
    const set = (a, pt, g = 1.5, u = 0.9) => { a.goal = { x: clamp(pt.x, -1.5, PW + 1.5), y: clamp(pt.y, -1, PL + 1) }; a.gSpd = g; a.urg = u; };
    if (d.type === 'kickoff') {
      // wszyscy zostają na pozycjach do rozpoczęcia gry, wykonawca przy piłce na środku
      this.placeKickoff(s, false);
      if (this.kicker && this.kicker.side === s) d.taker = this.kicker;
      return;
    }
    if (d.type === 'throw') { set(tk, { x: spot.x < PW / 2 ? -0.6 : PW + 0.6, y: spot.y }, 1.5, 1); return; }
    if (d.type === 'goalkick') { set(tk, behind(1.2), 1.4, 0.8); return; }
    if (d.type === 'dropball') { set(tk, spot, 1.3, 1); return; }
    if (d.type === 'corner') {
      const sx = spot.x < PW / 2 ? -1 : 1, dy = this.dirOf(s);
      set(tk, { x: spot.x + sx * 0.8, y: spot.y + dy * 0.8 }, 2, 1);
      this.boxLayout(s, tk, spot);
      return;
    }
    if (d.type === 'penalty') {
      set(tk, behind(2.4), 1.4, 0.8);
      this.emit('penTaker', { a: tk, side: s });
      const G = this.gkOf(o);
      if (G) set(G, this.w(s, 34, PL - 0.3), 1.5, 0.7);
      for (const a of this.allAgents()) {
        if (a === tk || a.gk || a.state === 'down') continue;
        const X = clamp(this.rx(s, a.x) + rnd(-2, 2), 8, 60);
        let Y = this.ry(s, a.y);
        if (Y > PL - 18.5) Y = PL - 18.5 - rnd(0, 5);
        if (Math.abs(X - 34) < 10 && Y > PL - 21.5) Y = PL - 21.5 - rnd(0, 3);
        Y = Math.max(Y, PL - 32);
        set(a, this.w(s, X, Y), 1.3, 0.7);
      }
      d.spot = spot;
      return;
    }
    if (d.type === 'freekick') {
      const dist = hyp(this.rx(s, spot.x) - 34, PL - this.ry(s, spot.y));
      set(tk, behind(d.offside ? 1 : 2.2), 1.6, 1);
      if (d.offside) return;
      if (dist < 32) {
        d.direct = this.ry(s, spot.y) > 70 && Math.abs(this.rx(s, spot.x) - 34) < 22;
        const gy = this.goalY(s);
        const ang = Math.atan2(gy - spot.y, 34 - spot.x);
        const wx = spot.x + Math.cos(ang) * 9.15, wy = spot.y + Math.sin(ang) * 9.15;
        const px = -Math.sin(ang), py = Math.cos(ang);
        const defs = this.active(o).filter((a) => !a.gk && a.state === 'play').sort((p1, p2) => hyp(p1.x - wx, p1.y - wy) - hyp(p2.x - wx, p2.y - wy));
        const n = Math.min(dist < 22 ? 5 : 3, defs.length);
        defs.slice(0, n).forEach((a, i) => { set(a, { x: wx + px * (i - (n - 1) / 2) * 1.9, y: wy + py * (i - (n - 1) / 2) * 1.9 }, 1.8, 1); a.wall = true; });
        this.boxLayout(s, tk, spot, defs.slice(0, n));
        const G = this.gkOf(o);
        if (G) set(G, this.w(s, 34 + (this.rx(s, spot.x) < 34 ? 1.5 : -1.5), PL - 0.6), 1.5, 0.8);
      } else if (this.ry(s, spot.y) > 55) this.boxLayout(s, tk, spot);
    }
  }

  boxLayout(s, tk, spot, skip = []) {
    const o = 1 - s;
    const att = this.active(s).filter((a) => !a.gk && a !== tk && a.state === 'play');
    const tall = (a) => this.E(a, 'hd') + this.E(a, 'st') * 0.3;
    const inBox = att.slice().sort((p1, p2) => tall(p2) - tall(p1)).slice(0, 5);
    const SP = [[30, PL - 6], [38, PL - 6.5], [34, PL - 10], [27, PL - 12], [42, PL - 12]];
    const set = (a, pt, g = 1.6, u = 1) => { a.goal = { x: clamp(pt.x, 1, PW - 1), y: clamp(pt.y, 1, PL - 1) }; a.gSpd = g; a.urg = u; };
    inBox.forEach((a, i) => set(a, this.w(s, SP[i][0] + rnd(-1.5, 1.5), SP[i][1] + rnd(-1, 1))));
    att.filter((a) => !inBox.includes(a)).forEach((a, i) => set(a, i < 2 ? this.w(s, i ? 22 : 46, PL - 21) : this.w(s, [20, 48, 34, 10, 58][(i - 2) % 5], 55 + rnd(-3, 3)), 1.5, 0.8));
    const def = this.active(o).filter((a) => !a.gk && a.state === 'play' && !skip.includes(a));
    const used = new Set();
    const toGoal = this.dirOf(s);
    for (const ap of inBox) {
      const m = def.filter((x) => !used.has(x)).sort((p1, p2) => D2(p1, ap.goal) - D2(p2, ap.goal))[0];
      if (!m) continue;
      used.add(m);
      set(m, { x: ap.goal.x + rnd(-0.8, 0.8), y: ap.goal.y + toGoal * 1.2 });
    }
    def.filter((x) => !used.has(x)).forEach((x, i) => set(x, this.w(s, [26, 34, 42, 30, 38, 22, 46][i % 7], i < 3 ? PL - 8 : PL - 17), 1.6, 0.9));
    const G = this.gkOf(o);
    if (G && !G.goal) set(G, this.w(s, 34 + (this.rx(s, spot.x) > 34 ? 1.2 : -1.2), PL - 0.8), 1.5, 0.8);
  }

  execRestart(d) {
    const tk = d.taker, s = d.side;
    const b = this.ball;
    this.dead = null;
    this.clearGoals();
    b.x = (d.spot || d).x; b.y = (d.spot || d).y; b.z = 0;
    this.gainBall(tk, 'restart');
    tk.decT = 0;
    const mates = this.active(s).filter((m) => m !== tk && m.state === 'play' && !m.gk);
    if (d.type === 'kickoff') {
      const m = mates.filter((x) => this.ry(s, x.y) < this.ry(s, tk.y) - 3).sort((p1, p2) => D2(p1, tk) - D2(p2, tk))[0] || mates[0];
      if (m) this.passTo(tk, m, { x: m.x, y: m.y }, 'ground');
      this.emit('kickoff', { side: s, first: !!d.first });
      return;
    }
    if (d.type === 'throw') {
      const cand = mates.filter((m) => D2(m, tk) < 24).map((m) => ({ m, sc: this.nearestOppDist(s, m) + Math.random() * 3 + (this.ry(s, m.y) - this.ry(s, tk.y)) * 0.1 })).sort((p, q) => q.sc - p.sc)[0];
      if (cand) {
        const R = { x: cand.m.x, y: cand.m.y };
        const T = 0.5 + D2(tk, R) / 16;
        this.lastPass = { side: s, by: tk, to: cand.m, t: this.t, R, kind: 'throw', offside: new Set(), from: { x: tk.x, y: tk.y }, done: false };
        this.kick(tk, (R.x - b.x) / T, (R.y - b.y) / T, (0.2 - 0 + 0.5 * GRAV * T * T) / T);
        cand.m.mode = 'chase'; cand.m.target = R;
      }
      return;
    }
    if (d.type === 'goalkick') {
      const short = (this.sides[s].tac.style ?? 2) <= 2 && (this.sides[1 - s].tac.press ?? 1) < 2 && Math.random() < 0.55;
      const opts = mates.map((m) => this.evalPass(tk, m, short ? 'ground' : 'air', 0, 1, 0.01)).filter(Boolean).sort((p, q) => q.u - p.u);
      const pick = short ? opts.find((o) => o.ps > 0.8) : opts.find((o) => this.ry(s, o.R.y) > 40) || opts[0];
      if (pick) this.passTo(tk, pick.m, pick.R, pick.kind);
      return;
    }
    if (d.type === 'corner') { this.cross(tk); return; }
    if (d.type === 'penalty') { this.shoot(tk, 'pen'); return; }
    if (d.type === 'freekick' && d.direct && Math.random() < 0.5 + 0.3 * this.E(tk, 'sh') / 100) { this.shoot(tk, 'fk'); return; }
    if (d.type === 'freekick' && !d.offside && this.ry(s, tk.y) > 58) { this.cross(tk); return; }
    tk.decT = 0.05;
  }

  placeKickoff(ks, teleport) {
    for (const s of [0, 1]) {
      const pl = this.active(s);
      const adv = s === ks ? pl.filter((a) => !a.gk && a.state !== 'down').sort((a, b) => b.sy - a.sy).slice(0, 2) : [];
      for (const a of pl) {
        let X, Y;
        if (a.gk) { X = 34; Y = 3; }
        else {
          X = 34 + ((a.sx - 50) / 50) * 28;
          Y = clamp(4 + a.sy * 0.45, 6, 46);
          if (s !== ks && Math.abs(X - 34) < 11) Y = Math.min(Y, 42);
        }
        const i = adv.indexOf(a);
        if (i === 0) { X = 34; Y = 52; } else if (i === 1) { X = 37.5; Y = 50.5; }
        const pt = this.w(s, X, Y);
        a.mode = 'shape'; a.act = null; a.runT = 0;
        if (teleport) { a.x = pt.x; a.y = pt.y; a.vx = 0; a.vy = 0; a.goal = null; a.state = a.injured ? a.state : 'play'; }
        else { a.goal = pt; a.urg = 0.8; a.gSpd = 1.4; }
        a.face = this.dirOf(s) > 0 ? Math.PI / 2 : -Math.PI / 2;
      }
      if (s === ks) this.kicker = adv[0] || pl.find((a) => !a.gk) || pl[0];
    }
    this.placeBall(PW / 2, PL / 2);
    if (teleport) { this.ref.x = 28; this.ref.y = 46; }
  }

  // =====================================================================
  // zmiany, taktyka, decyzje sztabu rywala
  // =====================================================================
  /** Zmiana – wykonywana przy najbliższej przerwie w grze. */
  sub(sideIdx, outPid, inPid) {
    const S = this.sides[sideIdx];
    if (S.subsLeft <= 0 || this.done) return false;
    if (!S.on.some((x) => x && x.pid === outPid) || !S.bench.includes(inPid)) return false;
    if (S.pend.some((q) => q.out === outPid || q.in === inPid)) return false;
    S.subsLeft--;
    S.pend.push({ out: outPid, in: inPid });
    if (this.dead || this.waiting || this.phase !== 'PLAY') this.execSubs(S);
    return true;
  }

  execSubs(S) {
    if (!S.pend || !S.pend.length) return;
    const list = S.pend.splice(0);
    for (const q of list) {
      const i = q.gkSlot != null ? q.gkSlot : S.on.findIndex((x) => x && x.pid === q.out);
      const outA = this.agentOf(S.idx, q.out);
      if ((i < 0 && q.gkSlot == null) || !S.bench.includes(q.in)) { S.subsLeft++; continue; }
      const slot = q.gkSlot != null ? (S.on[i] || { pos: 'GK', x: 50, y: 5 }) : S.on[i];
      const inP = S.spec.players[q.in];
      if (q.gkSlot != null) {
        const oi = S.on.findIndex((x) => x && x.pid === q.out);
        if (oi >= 0) S.on[oi] = null;
        S.on[i] = { pid: q.in, p: inP, pos: 'GK', x: 50, y: 5, w: slot.w };
      } else S.on[i] = { ...slot, pid: q.in, p: inP };
      S.bench = S.bench.filter((x) => x !== q.in);
      S.st[q.in] = inP.cond ?? 95;
      S.played.add(q.in);
      this.pstat(S, q.in, S.on[i].pos).on = this.minute;
      this.pstat(S, q.out).off = this.minute;
      this.subsHalf++;
      const T = this.teams[S.idx];
      if (T.nums[q.in] == null) T.nums[q.in] = this.freeNum(T);
      const nA = this.mkAgent(S.idx, S.on[i], T);
      const benchY = PL / 2 + (S.idx === 0 ? -5 : 5);
      nA.x = -1.6; nA.y = benchY; nA.hl = 3;
      T.players.push(nA);
      this.invalidate();
      if (outA) {
        if (this.ball.owner === outA) this.ball.owner = null;
        outA.state = 'off'; outA.offUntil = this.t + 5;
        this.invalidate();
        outA.goal = { x: -1.6, y: benchY }; outA.urg = 0.35; outA.hl = 2.5;
      }
      this.key.push({ min: this.minLabel(), side: S.idx, type: 'sub', pid: q.in, pid2: q.out });
      this.addFx('sub', { s: S.idx, inN: nA.num, inName: nA.ln, outN: outA ? outA.num : '', outName: outA ? outA.ln : (S.spec.players[q.out] || {}).ln || '' });
      this.emit('sub', { side: S.idx, inP, outP: S.spec.players[q.out] });
    }
    this.setTeamMul();
  }

  setTactics(sideIdx, tac) {
    const S = this.sides[sideIdx];
    const oldF = S.tac.f;
    S.tac = { ...S.tac, ...tac };
    if (tac.f && tac.f !== oldF) {
      const players = S.on.filter(Boolean).map((x) => x.p);
      const ids = autoLineup(players, tac.f);
      const f = FORMATIONS[tac.f];
      S.on = ids.map((pid, i) => (pid != null ? this.mkSlot(S.spec, pid, f[i]) : null));
      for (const sl of S.on) {
        if (!sl) continue;
        this.pstat(S, sl.pid).pos = sl.pos;
        const a = this.agentOf(sideIdx, sl.pid);
        if (a) { a.sx = sl.x; a.sy = sl.y; a.pos = sl.pos; a.gk = sl.pos === 'GK'; a.effT = -9; }
      }
    }
  }

  aiThink(S) {
    const m = this.minute;
    if (m < 46 || this.done || this.phase !== 'PLAY') return;
    const opp = this.sides[1 - S.idx];
    const diff = S.goals - opp.goals;
    if (S.spec.ai) {
      if (m >= 65 && diff < 0 && !S.adj.a) { S.tac.style = Math.min(4, S.tac.style + 1); S.adj.a = true; }
      if (m >= 80 && diff < 0 && !S.adj.b) { S.tac.style = 4; S.tac.press = 2; S.adj.b = true; }
      if (m >= 78 && diff > 0 && !S.adj.c) { S.tac.style = Math.max(0, S.tac.style - 1); S.tac.tw = 1; S.adj.c = true; }
    }
    if (S.subsLeft - (S.pend ? S.pend.length : 0) <= 0 || m < 55) return;
    let worst = null, ws = 1e9;
    for (const a of this.active(S.idx)) {
      if (S.pend.some((q) => q.out === a.pid)) continue;
      let sc = S.st[a.pid] + (a.rating - 6.5) * 18;
      if (a.injured) sc = -100;
      else if (S.yc[a.pid] && m >= 65 && POS_GROUP[a.pos] !== 'A') sc -= 12;
      if (a.gk && !a.injured) continue;
      if (sc < ws) { ws = sc; worst = a; }
    }
    const thr = m >= 75 ? 70 : 60;
    if (worst && ws < thr && Math.random() < 0.6) {
      const cand = this.bestBenchFor(S, worst.pos);
      if (!cand) return;
      const cp = S.spec.players[cand];
      if (worst.injured || slotRating(cp, worst.pos) >= 0.8 * slotRating(worst.p, worst.pos)) this.sub(S.idx, worst.pid, cand);
    }
  }

  // =====================================================================
  // seria rzutów karnych
  // =====================================================================
  startShootout() {
    this.phase = 'PEN';
    this.pens = [0, 0];
    const kq = (a) => 0.4 * (a.p.a.sh ?? 50) + 0.3 * (a.p.a.te ?? 50) + 0.3 * (a.p.a.cm ?? 50);
    this.pk = {
      order: [0, 1].map((s) => {
        const on = this.active(s);
        const S = this.sides[s];
        const first = on.find((a) => a.pid === S.sp.pen && !a.gk);
        const rest = on.filter((a) => a !== first && !a.gk).sort((a, b) => kq(b) - kq(a));
        return [...(first ? [first] : []), ...rest, ...on.filter((a) => a.gk)];
      }),
      taken: [0, 0], turn: 0, stage: 'setup', t0: this.t, kicks: [],
    };
    this.upSide = this.userSide;
    for (const s of [0, 1]) {
      const pl = this.active(s).filter((a) => !a.gk);
      pl.forEach((a, i) => {
        const sg = s === 0 ? -1 : 1;
        a.pkHome = { x: PW / 2 + sg * (2 + (i % 2) * 2.7), y: PL / 2 + (Math.floor(i / 2) - 2) * 2.7 };
        a.goal = a.pkHome; a.urg = 0.8; a.gSpd = 1.6; a.mode = 'shape';
      });
      const g = this.gkOf(s);
      if (g) { g.goal = { x: s === 0 ? 24 : 44, y: PL - 18 }; g.urg = 0.8; g.gSpd = 1.6; }
    }
    this.placeBall(34, PL - 11);
    this.emit('shootoutStart', {});
  }

  penTick() {
    const k = this.pk;
    if (!k || this.done) return;
    const el = this.t - k.t0;
    const s = k.turn, o = 1 - s;
    if (k.stage === 'setup') {
      if (el < 2.2) return;
      const list = k.order[s];
      const T = list[k.taken[s] % list.length];
      const G = this.gkOf(o);
      k.T = T; k.G = G;
      for (const q of [0, 1]) { const g = this.gkOf(q); if (g && g !== G) { g.goal = { x: q === 0 ? 24 : 44, y: PL - 18 }; g.urg = 0.8; } }
      if (G) { G.goal = { x: 34, y: PL - 0.4 }; G.urg = 0.8; G.gSpd = 1.6; G.hl = 2; }
      if (T) { T.goal = { x: 34 + rnd(-1, 1), y: PL - 13.5 }; T.urg = 1; T.gSpd = 2.2; T.hl = 3; }
      this.placeBall(34, PL - 11);
      k.stage = 'walk'; k.t0 = this.t;
      return;
    }
    if (k.stage === 'walk') {
      if (el < 2.4) return;
      if (k.T) { k.T.goal = { x: 34, y: PL - 11 }; k.T.urg = 0.7; }
      k.stage = 'run'; k.t0 = this.t;
      return;
    }
    if (k.stage === 'run') {
      if (!k.T || D2(k.T, this.ball) < 0.9 || el > 1.2) {
        const T = k.T, G = k.G;
        const q = 0.4 * this.E(T, 'sh') + 0.3 * this.E(T, 'te') + 0.3 * this.E(T, 'cm');
        const egk = G ? this.E(G, 'gk') : 20;
        const pMiss = clamp(0.08 - (this.E(T, 'te') - 60) / 800 + (1 - this.E(T, 'cm') / 100) * 0.05, 0.02, 0.16);
        const pGoal = clamp(0.76 + (q - egk) / 250 + ((this.sides[s].train && this.sides[s].train.ment) || 0) / 2000, 0.55, 0.92);
        const x = Math.random();
        const how = x < pMiss ? 'miss' : x < pMiss + pGoal * (1 - pMiss) ? 'goal' : 'save';
        const side = Math.random() < 0.5 ? -1 : 1;
        let tg;
        if (how === 'goal') tg = { x: 34 + side * rnd(1.2, 3.2), y: PL + 0.4, z: rnd(0.2, 1.9) };
        else if (how === 'save') tg = { x: 34 + side * rnd(1.4, 3), y: PL - 0.5, z: rnd(0.2, 1.4) };
        else tg = Math.random() < 0.5 ? { x: 34 + side * rnd(4, 5.5), y: PL + 2.5, z: rnd(0.2, 1) } : { x: 34 + rnd(-3, 3), y: PL + 2.5, z: rnd(3, 4) };
        const b = this.ball;
        const Tf = 0.45;
        if (T) { T.kickT = 0.3; T.goal = null; }
        this.kick(T || this.gkOf(s), (tg.x - b.x) / Tf, (tg.y - b.y) / Tf, (tg.z - b.z + 0.5 * GRAV * Tf * Tf) / Tf);
        if (G) {
          const toward = how === 'save' ? tg.x : how === 'goal' ? (Math.random() < 0.6 ? 34 - side * 2.4 : lerp(34, tg.x, 0.45)) : 34 + rnd(-2, 2);
          G.goal = { x: toward, y: G.y }; G.urg = 1; G.gSpd = 2.4;
          if (Math.abs(toward - G.x) > 1.3) { G.state = 'dive'; G.stT = 1; G.diveDir = Math.sign(toward - G.x); }
        }
        k.how = how; k.tg = tg;
        this.addFx('shot', { kind: 'pen' });
        k.stage = 'flight'; k.t0 = this.t;
      }
      return;
    }
    if (k.stage === 'flight') {
      if (el < 0.5) return;
      const T = k.T, G = k.G;
      const ok = k.how === 'goal';
      if (ok) this.pens[s]++;
      k.taken[s]++;
      if (T) { this.rate(T, ok ? 0.1 : -0.4); }
      if (G && k.how === 'save') this.rate(G, 0.4);
      const kick = { side: s, pid: T ? T.pid : null, ok, score: this.pens.slice(), how: k.how };
      k.kicks.push(kick);
      if (ok) this.addFx('net', { y: PL, x: k.tg.x });
      else if (k.how === 'save') { const b = this.ball; b.vx = (k.tg.x > 34 ? 1 : -1) * 6; b.vy = -5; b.vz = 1; }
      this.emit('pk', { a: T, G, how: k.how, side: s, score: this.pens.slice(), n: k.kicks.length });
      k.stage = 'after'; k.t0 = this.t;
      return;
    }
    if (k.stage === 'after') {
      if (el < 1.4) return;
      if (k.T && k.T.pkHome) { k.T.goal = k.T.pkHome; k.T.urg = 0.6; }
      // koniec serii?
      const [a, b] = this.pens, [ta, tb] = k.taken;
      let over = false;
      if (ta <= 5 && tb <= 5) {
        const remA = 5 - ta, remB = 5 - tb;
        if (a > b + remB || b > a + remA) over = true;
        if (ta === 5 && tb === 5 && a !== b) over = true;
      } else if (ta === tb && a !== b) over = true;
      if (over || ta + tb > 60) { this.finish(); return; }
      k.turn = 1 - k.turn;
      k.stage = 'setup'; k.t0 = this.t - 1.6;
    }
  }

  // =====================================================================
  // oceny i wynik
  // =====================================================================
  computeRatings() {
    const endMin = this.et ? 120 : 90;
    const win = this.winnerSide();
    let motm = null, best = -1;
    const live = new Map();
    for (const T of this.teams) for (const a of T.players) live.set(`${a.side}:${a.pid}`, a.rating);
    for (const S of this.sides) {
      const opp = this.sides[1 - S.idx];
      for (const pid of S.played) {
        const ps = S.ps[pid];
        const on = ps.on ?? 0, off = ps.off ?? endMin;
        const mins = Math.max(1, off - on);
        let r = live.get(`${S.idx}:${pid}`) ?? 6.5;
        const g = POS_GROUP[ps.pos || S.spec.players[pid].pos];
        if (opp.goals === 0 && mins >= 60) r += g === 'G' ? 0.5 : g === 'D' ? 0.3 : 0;
        if (win === S.idx) r += 0.2;
        else if (win === 1 - S.idx) r -= 0.2;
        if (mins < 20) r = 6.5 + (r - 6.5) * 0.6;
        ps.r = Math.round(clamp(r, 3, 10) * 10) / 10;
        ps.min = mins;
        if (ps.r > best) { best = ps.r; motm = { side: S.idx, pid }; }
      }
    }
    this.motm = motm;
  }

  /** Bieżąca ocena zawodnika (na żywo). */
  liveRating(side, pid) {
    const a = this.teams[side].players.find((x) => x.pid === pid);
    return a ? a.rating : null;
  }

  // =====================================================================
  // komunikacja z widokiem i komentatorem
  // =====================================================================
  emit(type, d) {
    this.narr.on(type, d);
    if (this.onEvent) this.onEvent(type, d);
  }

  addFx(type, d = {}) { this.fxq.push({ type, ...d, at: this.t }); if (this.fxq.length > 60) this.fxq.shift(); }

  /** Linia komentarza (wywoływane przez komentatora). */
  say(text, o = {}) {
    const e = { id: this.comm.length + 1, t: this.t, min: this.minLabel(), text, ic: o.ic || '', side: o.side ?? null, imp: !!o.imp, kind: o.kind || '' };
    this.comm.push(e);
    if (this.comm.length > 400) this.comm.shift();
    if (this.onComm) this.onComm(e);
    return e;
  }
}

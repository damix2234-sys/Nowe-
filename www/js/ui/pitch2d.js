// Animowany silnik 2D meczu. Ustawienie drużyn wynika z formacji, położenia piłki i taktyki (linia obrony,
// szerokość, pressing, krycie, linia spalonego), a każda akcja silnika meczu – czyli każda linia komentarza –
// ma własną choreografię: podania, prostopadłe piłki, drybling, kontry, odbiory, strzały z wynikiem zgodnym
// z silnikiem (gol, parada, słupek, pudło), stałe fragmenty z murem i ustawieniem w polu karnym, kartki,
// zmiany, kontuzje, spalone i seria rzutów karnych. Komentarz pojawia się dokładnie w chwili akcji.
import { matchKits } from '../data/kits.js';
import { render, PW, PL } from './pitch2d-draw.js';

const GHW = 3.66;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rnd = (a, b) => a + Math.random() * (b - a);
const D2 = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);

const NUMS = { GK: [1], RB: [2], LB: [3], CB: [4, 5, 15], DM: [6, 16], CM: [8, 14, 18], AM: [10, 20], RW: [7, 17], LW: [11, 21], CF: [9, 19, 22] };
// akcje, przed którymi nie wznawia się gry od środka po golu (zmiana połowy, przerwa, koniec)
const NO_KICK = new Set(['kickoff', 'halftime', 'fulltime', 'etStart', 'pensStart', 'pk']);
const CAPTION = {
  corner: 'Rzut rożny', fkFar: 'Rzut wolny', fkNear: 'Rzut wolny', penalty: 'Rzut karny', offside: 'Spalony', sub: 'Zmiana',
  injury: 'Kontuzja', halftime: 'Przerwa', fulltime: 'Koniec meczu', etStart: 'Dogrywka', pensStart: 'Rzuty karne', counter: 'Kontratak',
};
const ZONES = { mid: [22, 72], own: [10, 50], switch: [25, 70], fight: [35, 65], pressure: [58, 90], slow: [8, 55] };

export class Pitch2D {
  /**
   * canvas – element <canvas> (null = tryb bez rysowania, np. testy), M – mecz (Match),
   * cb: { need(), start(item), line(item), end(item), sfx(kind, data) }
   */
  constructor(canvas, M, cb = {}) {
    this.cv = canvas;
    this.ctx = canvas ? canvas.getContext('2d') : null;
    this.M = M;
    this.cb = cb;
    this.user = M.userSide ?? 0;
    this.kits = matchKits(M.sides[0].nid, M.sides[1].nid);
    this.time = 0;
    this.frames = 0;
    this.rate = 2.2;
    this.slowF = 1;
    this.slowUntil = 0;
    this.running = false;
    this.raf = 0;
    this.last = 0;
    this.queue = [];
    this.cur = null;
    this.fx = [];
    this.trail = [];
    this.phase = 'dead';
    this.poss = 0;
    this.needKick = null;
    this.restart = null;
    this.foulSpot = null;
    this.cornerSide = null;
    this.blocker = null;
    this.lastShot = null;
    this.counterSide = -1;
    this.counterUntil = 0;
    this.half = 1;
    this.upSide = this.user;
    this.pkSetup = false;
    this.W = 0; this.H = 0; this.dpr = 1;
    this.cam = { mode: 'auto', k: 4, x: PW / 2, y: PL / 2 };
    this.ball = { x: PW / 2, y: PL / 2, z: 0, vx: 0, vy: 0, vz: 0, owner: null, fl: null, spin: 0 };
    this.ref = { x: 28, y: 45, vx: 0, vy: 0, goal: null };
    this.lines = [{ x: -0.8, y: 30 }, { x: PW + 0.8, y: 75 }];
    this.teams = [0, 1].map((s) => this.mkTeam(s));
    this.placeKickoff(0, true);
    if (canvas) {
      this.resize();
      if (typeof ResizeObserver !== 'undefined') { this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(canvas); }
    }
  }

  // ---------------- drużyny ----------------
  mkTeam(s) {
    const S = this.M.sides[s];
    const T = { s, name: S.name, kit: this.kits[s], players: [], nums: {}, used: new Set(), line: 20 };
    const slots = S.on.filter(Boolean);
    for (const sl of slots) {
      const n = (NUMS[sl.pos] || []).find((k) => !T.used.has(k));
      if (n) { T.nums[sl.pid] = n; T.used.add(n); }
    }
    for (const sl of slots) if (T.nums[sl.pid] == null) T.nums[sl.pid] = this.freeNum(T);
    for (const pid of S.bench) if (T.nums[pid] == null) T.nums[pid] = this.freeNum(T);
    for (const sl of slots) T.players.push(this.mkPlayer(s, sl.pid, sl, T));
    return T;
  }

  freeNum(T) {
    for (let n = 2; n < 99; n++) if (!T.used.has(n)) { T.used.add(n); return n; }
    return 99;
  }

  mkPlayer(s, pid, sl, T) {
    const p = this.M.sides[s].spec.players[pid];
    return {
      side: s, pid, num: T.nums[pid] ?? this.freeNum(T), ln: p ? p.ln : '?', pos: sl.pos, gk: sl.pos === 'GK',
      sx: sl.x, sy: sl.y, x: PW / 2, y: PL / 2, vx: 0, vy: 0, face: 0,
      top: 6.3 + ((p && p.a ? p.a.sp : 60) / 100) * 2.6,
      goal: null, gUrg: 0.5, gSpd: 1, chase: null, press: null, tx: PW / 2, ty: PL / 2,
      state: 'play', stT: 0, kickT: 0, hl: 0, limp: false, injured: false, diveDir: 1, offUntil: 0,
      ph1: Math.random() * 6.28, ph2: Math.random() * 6.28,
    };
  }

  /** Aktualizuje pozycje w ustawieniu po zmianie taktyki lub składu w silniku. */
  syncSlots() {
    for (const s of [0, 1]) {
      for (const sl of this.M.sides[s].on) {
        if (!sl) continue;
        const p = this.find(s, sl.pid);
        if (p) { p.sx = sl.x; p.sy = sl.y; p.pos = sl.pos; p.gk = sl.pos === 'GK'; }
      }
    }
  }

  addPlayer(s, pid, slot, x, y) {
    const ex = this.find(s, pid);
    if (ex) return ex;
    const T = this.teams[s];
    if (T.nums[pid] == null) T.nums[pid] = this.freeNum(T);
    const p = this.mkPlayer(s, pid, slot, T);
    p.x = x; p.y = y;
    T.players.push(p);
    return p;
  }

  // ---------------- geometria ----------------
  dirOf(s) { return s === this.upSide ? 1 : -1; }
  w(s, X, Y) { return this.dirOf(s) > 0 ? { x: X, y: Y } : { x: PW - X, y: PL - Y }; }
  rx(s, x) { return this.dirOf(s) > 0 ? x : PW - x; }
  ry(s, y) { return this.dirOf(s) > 0 ? y : PL - y; }
  goalY(s) { return this.dirOf(s) > 0 ? PL : 0; }
  ahead(s, p, d, jx = 0, minY = 6, maxY = 98) {
    return this.w(s, clamp(this.rx(s, p.x) + jx, 4, PW - 4), clamp(this.ry(s, p.y) + d, minY, maxY));
  }
  behind(s, pt, d) { return { x: pt.x + rnd(-0.5, 0.5), y: pt.y - this.dirOf(s) * d }; }

  active(s) { return this.teams[s].players.filter((p) => p.state !== 'off' && p.state !== 'gone'); }
  find(s, pid) {
    return pid == null ? null : this.teams[s].players.find((q) => q.pid === pid && q.state !== 'off' && q.state !== 'gone') || null;
  }

  /** Zawodnik z akcji silnika (licznik braków służy testom spójności). */
  pl(s, pid) {
    if (pid == null) return null;
    const p = this.find(s, pid);
    if (!p) this.missing = (this.missing || 0) + 1;
    return p;
  }

  /** Nazwisko z danych meczu (niezależnie od tego, czy zawodnik jest na boisku). */
  nameOf(s, pid) {
    const p = this.M.sides[s].spec.players[pid];
    return p ? p.ln : '';
  }
  gkOf(s) { return this.active(s).find((p) => p.gk) || null; }
  nearest(s, x, y, f) {
    let best = null, bd = 1e9;
    for (const p of this.active(s)) {
      if (f && !f(p)) continue;
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }
  mate(s, ex, f) {
    const c = this.active(s).filter((p) => p !== ex && p.state === 'play' && !p.gk && (!f || f(p)));
    if (!c.length) return this.active(s).find((p) => p !== ex && p.state === 'play' && !p.gk) || null;
    c.sort((a, b) => D2(a, ex) - D2(b, ex));
    return c[Math.floor(Math.random() * Math.min(3, c.length))];
  }
  role(s, roles) { return this.active(s).find((p) => roles.includes(p.pos) && p.state === 'play') || this.active(s).find((p) => !p.gk) || null; }

  // ---------------- sterowanie ----------------
  push(items) { for (const it of items) this.queue.push(it); }
  clear() { this.queue.length = 0; this.cur = null; }
  setRate(r) { this.rate = r; }

  play() {
    if (this.running) return;
    this.running = true;
    this.last = 0;
    if (this.cv) this.raf = requestAnimationFrame((t) => this.frame(t));
  }

  pause() {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.draw();
  }

  destroy() {
    this.pause();
    if (this.ro) this.ro.disconnect();
    this.cb = {};
  }

  /** Podpina nowy canvas (np. po ponownym narysowaniu ekranu). */
  attach(canvas) {
    if (this.ro) this.ro.disconnect();
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.resize();
    if (typeof ResizeObserver !== 'undefined') { this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(canvas); }
  }

  /** Pozycja końcowa po „symuluj do końca”: zawodnicy schodzą do środka boiska. */
  finalState() {
    this.clear();
    this.phase = 'dead';
    this.ball.owner = null; this.ball.fl = null;
    for (const T of this.teams) for (const p of T.players) {
      if (p.state === 'off' || p.state === 'gone') continue;
      p.state = 'play';
      p.goal = { x: PW / 2 + rnd(-14, 14), y: PL / 2 + rnd(-10, 10) };
      p.gUrg = 0.25;
    }
    this.cur = { it: null, gen: this.sIdle(), t: 0, said: true, max: 1e9 };
    this.fx.push({ type: 'caption', text: 'Koniec meczu', t: 0, dur: 4 });
  }

  debugState() {
    const c = this.cur && this.cur.it;
    return {
      frames: this.frames, time: Math.round(this.time * 10) / 10, queue: this.queue.length,
      cur: c ? (c.act ? c.act.t : c.type) : null, ball: { x: Math.round(this.ball.x), y: Math.round(this.ball.y) }, cam: this.cam.mode,
    };
  }

  toggleCam() {
    this.cam.mode = this.cam.mode === 'auto' ? (this.fits ? 'near' : 'full') : 'auto';
    this.draw();
    return this.cam.mode;
  }

  // ---------------- pętla ----------------
  frame(ts) {
    if (!this.running) return;
    const dt = this.last ? Math.min(0.05, (ts - this.last) / 1000) : 0.016;
    this.last = ts;
    this.advance(dt);
    this.camera(dt);
    this.draw();
    this.frames++;
    if (this.running) this.raf = requestAnimationFrame((t) => this.frame(t));
  }

  /** Krok symulacji o dtReal sekund czasu rzeczywistego (także w testach bez canvasa). */
  advance(dtReal) {
    for (const f of this.fx) f.t += dtReal;
    this.fx = this.fx.filter((f) => f.t < f.dur);
    for (const T of this.teams) for (const p of T.players) if (p.hl > 0) p.hl -= dtReal;
    const slow = this.time < this.slowUntil ? this.slowF : 1;
    let dt = dtReal * this.rate * slow;
    while (dt > 1e-6 && this.running) {
      const h = Math.min(dt, 1 / 30);
      this.tick(h);
      dt -= h;
    }
  }

  tick(h) {
    this.time += h;
    this.director(h);
    this.think();
    for (const T of this.teams) for (const p of T.players) this.movePlayer(p, h);
    this.separate();
    this.moveBall(h);
    this.moveRef(h);
  }

  draw() { if (this.ctx) render(this); }

  resize() {
    const cv = this.cv;
    if (!cv) return;
    const r = cv.getBoundingClientRect();
    const w = Math.max(120, r.width), h = Math.max(120, r.height);
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    this.W = w; this.H = h; this.dpr = dpr;
    const mx = 3, my = 4.2;
    this.kFull = Math.min(w / (PW + 2 * mx), h / (PL + 2 * my));
    this.kWide = w / (PW + 2 * mx);
    this.fits = this.kFull >= this.kWide * 0.88;
    this.camera(1, true);
    this.draw();
  }

  camera(dt, snap = false) {
    if (!this.W) return;
    const mode = this.cam.mode === 'auto' ? (this.fits ? 'full' : 'follow') : this.cam.mode;
    const kT = mode === 'full' ? this.kFull : mode === 'near' ? this.kWide * 1.45 : this.kWide;
    const f = snap ? 1 : Math.min(1, dt * 3.5);
    this.cam.k += (kT - this.cam.k) * f;
    const b = this.ball;
    const fx = b.fl ? b.fl.x1 : b.x, fy = b.fl ? b.fl.y1 : b.y;
    const tx = lerp(b.x, fx, 0.4), ty = lerp(b.y, fy, 0.4);
    const visH = this.H / this.cam.k, visW = this.W / this.cam.k;
    let cy = mode === 'full' ? PL / 2 : ty;
    const lo = -4.2 + visH / 2, hi = PL + 4.2 - visH / 2;
    cy = lo > hi ? PL / 2 : clamp(cy, lo, hi);
    let cx = PW / 2;
    if (visW < PW + 6) cx = clamp(tx, visW / 2 - 3, PW + 3 - visW / 2);
    this.cam.y += (cy - this.cam.y) * f;
    this.cam.x += (cx - this.cam.x) * f;
  }

  // ---------------- reżyser ----------------
  director(h) {
    if (!this.cur) this.nextItem();
    const c = this.cur;
    if (!c) return;
    c.t += h;
    let r;
    try { r = c.gen.next(h); } catch (e) { console.error('pitch2d', e); r = { done: true }; }
    if (r.done || c.t > c.max) this.endItem();
  }

  nextItem() {
    if (!this.queue.length && this.cb.need) this.cb.need();
    if (!this.running && this.cv) return;
    const it = this.queue.shift();
    if (!it) {
      this.cur = { it: null, gen: this.sAmbient(this.poss, 1, 'mid'), t: 0, said: true, max: 2 };
      return;
    }
    if (it.type === 'minute' || it.i === 0) this.resetOverrides();
    this.cur = { it, gen: this.script(it), t: 0, said: it.type === 'minute', max: it.type === 'minute' ? it.dur + 3 : 15 };
    if (this.cb.start) this.cb.start(it);
  }

  endItem() {
    const c = this.cur;
    this.cur = null;
    if (!c || !c.it) return;
    if (!c.said) { c.said = true; if (this.cb.line) this.cb.line(c.it); }
    if (this.cb.end) this.cb.end(c.it);
  }

  /** Pokazuje linię komentarza bieżącej akcji (dokładnie raz). */
  say() {
    const c = this.cur;
    if (c && c.it && !c.said) { c.said = true; if (this.cb.line) this.cb.line(c.it); }
  }

  sfx(kind, data) { if (this.cb.sfx) this.cb.sfx(kind, data); }
  whistle(kind = 'short') { this.sfx('whistle', kind); }
  caption(text) {
    this.fx = this.fx.filter((f) => f.type !== 'caption');
    this.fx.push({ type: 'caption', text, t: 0, dur: 2.3 });
  }
  slow(t) { this.slowF = this.rate > 3.5 ? 0.7 : 0.55; this.slowUntil = this.time + t; }

  resetOverrides() {
    for (const T of this.teams) for (const p of T.players) {
      if (p.state === 'off' || p.state === 'gone') continue;
      p.goal = null; p.chase = null; p.gSpd = 1; p.wall = false;
      if (p.state === 'jump' || p.state === 'slide' || p.state === 'dive' || p.state === 'stumble') p.state = 'play';
      if (p.injured && p.state === 'down') { p.state = 'play'; p.stT = 0; p.limp = true; }
    }
    this.ref.goal = null;
  }

  peek(it) { const n = this.queue[0]; return n && n.ev === it.ev ? n : null; }
  peekAll(it) {
    const out = [];
    for (const q of this.queue) { if (q.ev !== it.ev) break; out.push(q); }
    return out;
  }

  *script(it) {
    if (it.type === 'minute') {
      if (this.needKick != null) yield* this.sKickoffReset(this.needKick);
      yield* this.sAmbient(it.s ?? this.poss, it.dur, it.style || 'mid');
      return;
    }
    const a = it.act || { t: 'info' };
    if (this.needKick != null && !NO_KICK.has(a.t)) yield* this.sKickoffReset(this.needKick);
    if (CAPTION[a.t]) this.caption(CAPTION[a.t]);
    switch (a.t) {
      case 'kickoff': yield* this.sKickoff(it); break;
      case 'halftime': case 'fulltime': case 'etStart': case 'pensStart': yield* this.sStop(it); break;
      case 'stoppage': yield* this.sStoppage(it); break;
      case 'quiet': yield* this.sQuiet(it); break;
      case 'pressure': yield* this.sQuiet(it, 'pressure'); break;
      case 'timeWaste': yield* this.sQuiet(it, 'slow'); break;
      case 'build': yield* this.sBuild(it); break;
      case 'dribble': yield* this.sDribble(it); break;
      case 'counter': yield* this.sCounter(it); break;
      case 'lost': yield* this.sLost(it); break;
      case 'shot': yield* this.sShot(it); break;
      case 'goal': case 'ownGoal': yield* this.sGoal(it); break;
      case 'assist': yield* this.sAssist(it); break;
      case 'save': case 'penSave': yield* this.sSave(it); break;
      case 'saveCorner': yield* this.sSaveCorner(it); break;
      case 'miss': case 'penMiss': yield* this.sMiss(it); break;
      case 'woodwork': yield* this.sWoodwork(it); break;
      case 'blocked': yield* this.sBlocked(it); break;
      case 'foul': yield* this.sFoul(it); break;
      case 'penalty': yield* this.sFoul(it, 'box'); break;
      case 'yellow': case 'secondYellow': case 'red': yield* this.sCard(it); break;
      case 'fkFar': yield* this.sFkFar(it); break;
      case 'fkNear': yield* this.sFkNear(it); break;
      case 'corner': yield* this.sCorner(it); break;
      case 'cross': yield* this.sCross(it); break;
      case 'cleared': yield* this.sCleared(it); break;
      case 'offside': yield* this.sOffside(it); break;
      case 'dive': yield* this.sDive(it); break;
      case 'diveFoul': this.say(); this.whistle(); this.phase = 'dead'; yield* this.wait(0.8); break;
      case 'diveYellow': yield* this.sRefTo(this.pl(a.s, a.a)); break;
      case 'diveNothing': yield* this.sDiveNothing(it); break;
      case 'injury': yield* this.sInjury(it); break;
      case 'injuryOn': yield* this.sInjuryOn(it); break;
      case 'sub': yield* this.sSub(it); break;
      case 'pk': yield* this.sPk(it); break;
      default: this.say(); yield* this.sAmbient(this.poss, 1.2, 'mid');
    }
  }

  // ---------------- myślenie zespołowe ----------------
  think() {
    const b = this.ball;
    const ref = b.fl ? { x: b.fl.x1, y: b.fl.y1 } : b;
    for (const s of [0, 1]) this.teams[s].line = this.secondLast(s);
    for (const s of [0, 1]) this.shape(s, ref);
    this.assignPress();
  }

  secondLast(s) {
    const ys = this.active(s).map((p) => this.ry(s, p.y)).sort((a, b) => a - b);
    return ys.length > 1 ? ys[1] : 20;
  }

  /** Cel każdego zawodnika wg ustawienia: linie zależne od piłki i taktyki, szerokość, przesunięcie, krycie. */
  shape(s, ref) {
    const T = this.teams[s];
    const tac = this.M.sides[s].tac || {};
    const st = (tac.style ?? 2) - 2, pr = (tac.press ?? 1) - 1;
    const bx = this.rx(s, ref.x), by = this.ry(s, ref.y);
    const att = this.poss === s;
    const ctr = this.counterSide === s && this.time < this.counterUntil;
    let dl, al, wid, shift;
    if (att) {
      dl = clamp(by - 36 + st * 3 + (ctr ? 9 : 0), 12, 56);
      al = clamp(Math.max(dl + 44, by + 10), 50, 93);
      wid = 1; shift = 0.18;
    } else {
      dl = clamp(by - 27 + pr * 7 + st * 2.5, 6, 46);
      al = clamp(dl + 33 + pr * 3, 30, 74);
      wid = 0.68; shift = 0.42;
    }
    const off = PL - this.teams[1 - s].line;
    const opp = this.active(1 - s);
    for (const p of T.players) {
      if (p.state === 'gone') continue;
      let X, Y;
      if (p.gk) {
        if (att) { Y = clamp(dl - 15, 4, 24); X = 34 + (bx - 34) * 0.1; }
        else {
          const d = Math.hypot(bx - 34, by);
          Y = clamp(1.3 + d * 0.055, 1.3, 9);
          X = clamp(34 + (bx - 34) * 0.16, 34 - 3.2, 34 + 3.2);
        }
      } else {
        const t = clamp((p.sy - 15) / 70, 0, 1);
        Y = lerp(dl, al, t);
        X = 34 + ((p.sx - 50) / 50) * 31 * wid + (bx - 34) * shift;
        if (att && Y > off - 0.8 && Y > by) Y = Math.max(by, off - 0.8);
        X += Math.sin(this.time * 0.55 + p.ph1) * 1.4;
        Y += Math.cos(this.time * 0.45 + p.ph2) * 1.2;
        if (!att) {
          // krycie: przesunięcie w stronę najbliższego rywala w swojej strefie (od strony bramki)
          let m = null, md = 9;
          for (const q of opp) {
            if (q.gk) continue;
            const qx = this.rx(s, q.x), qy = this.ry(s, q.y);
            const d = Math.hypot(qx - X, qy - Y);
            if (d < md) { md = d; m = { x: qx, y: qy }; }
          }
          if (m) { X = lerp(X, m.x, 0.35); Y = lerp(Y, m.y - 1.6, 0.35); }
        }
      }
      const pt = this.w(s, clamp(X, 1.2, PW - 1.2), clamp(Y, 1, PL - 1));
      p.tx = pt.x; p.ty = pt.y;
    }
  }

  assignPress() {
    for (const T of this.teams) for (const p of T.players) p.press = null;
    const o = this.ball.owner;
    if (!o || this.phase !== 'play' || this.ball.fl) return;
    const d = 1 - o.side;
    const tac = this.M.sides[d].tac || {};
    const n = tac.press === 2 ? 2 : 1;
    const gy = this.goalY(o.side);
    const cand = this.active(d).filter((p) => !p.gk && !p.goal && !p.chase && p.state === 'play' && D2(p, o) < 24)
      .sort((a, b) => D2(a, o) - D2(b, o)).slice(0, n);
    const ang = Math.atan2(gy - o.y, 34 - o.x);
    cand.forEach((p, i) => {
      const dd = i === 0 ? 1.8 : 6;
      p.press = { x: o.x + Math.cos(ang) * dd, y: o.y + Math.sin(ang) * dd, u: [0.55, 0.75, 0.95][tac.press ?? 1] };
    });
  }

  movePlayer(p, h) {
    if (p.kickT > 0) p.kickT -= h;
    if (p.stT > 0) {
      p.stT -= h;
      if (p.stT <= 0 && p.state !== 'off' && p.state !== 'gone') p.state = 'play';
    }
    if (p.state === 'gone') return;
    if (p.state === 'down') {
      p.vx *= 0.85; p.vy *= 0.85;
      p.x += p.vx * h; p.y += p.vy * h;
      return;
    }
    let tx, ty, u;
    if (p.chase) { tx = p.chase.x + p.chase.vx * 0.35; ty = p.chase.y + p.chase.vy * 0.35; u = 1; }
    else if (p.goal) { tx = p.goal.x; ty = p.goal.y; u = p.gUrg; }
    else if (p.press) { tx = p.press.x; ty = p.press.y; u = p.press.u; }
    else { tx = p.tx; ty = p.ty; u = 0.42; }
    const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy);
    // gSpd przyspiesza ruch jak przewijanie: prędkość ×g, przyspieszenie ×g²
    const g = p.gSpd || 1;
    let top = p.top * (p.limp ? 0.5 : 1) * g;
    if (this.ball.owner === p) top *= 0.86;
    if (p.state === 'stumble') top *= 0.4;
    if ((this.phase === 'dead' || this.phase === 'celebrate') && !p.goal && !p.chase) { top *= 0.5; u = Math.min(u, 0.45); }
    if (p.state === 'dive' || p.state === 'slide') top *= 1.6;
    const want = d < 0.05 ? 0 : Math.min(top * (0.3 + 0.7 * u), d * 2.2 * g);
    const vx = d > 0 ? (dx / d) * want : 0, vy = d > 0 ? (dy / d) * want : 0;
    const acc = (p.state === 'dive' || p.state === 'slide' ? 30 : 8.5) * g * g * h;
    const ax = vx - p.vx, ay = vy - p.vy, am = Math.hypot(ax, ay);
    const k = am > acc ? acc / am : 1;
    p.vx += ax * k; p.vy += ay * k;
    p.x += p.vx * h; p.y += p.vy * h;
    const sp = Math.hypot(p.vx, p.vy);
    const fa = sp > 0.8 ? Math.atan2(p.vy, p.vx) : Math.atan2(this.ball.y - p.y, this.ball.x - p.x);
    let df = fa - p.face;
    while (df > Math.PI) df -= 2 * Math.PI;
    while (df < -Math.PI) df += 2 * Math.PI;
    p.face += df * Math.min(1, h * 8);
    if (p.state === 'off' && ((p.goal && d < 0.8) || this.time > p.offUntil)) p.state = 'gone';
  }

  separate() {
    const all = [];
    for (const T of this.teams) for (const p of T.players) if (p.state === 'play' || p.state === 'stumble') all.push(p);
    const own = this.ball.owner;
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const a = all[i], b = all[j];
        const min = a.side === b.side ? 1.9 : 1.1;
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        if (d > 0.001 && d < min) {
          const push = (min - d) * 0.25, ux = dx / d, uy = dy / d;
          const wa = a === own || a.wall ? 0.15 : 1, wb = b === own || b.wall ? 0.15 : 1;
          a.x -= ux * push * wa; a.y -= uy * push * wa;
          b.x += ux * push * wb; b.y += uy * push * wb;
        }
      }
    }
  }

  moveBall(h) {
    const b = this.ball;
    b.spin += h * (Math.hypot(b.vx, b.vy) * 0.8 + (b.fl ? 6 : 0));
    if (b.fl) {
      const f = b.fl;
      f.t += h;
      const u = Math.min(1, f.t / f.T);
      const e = f.kind === 'ground' ? 1 - Math.pow(1 - u, 1.6) : u;
      let px = lerp(f.x0, f.x1, e), py = lerp(f.y0, f.y1, e);
      if (f.bend) {
        const L = Math.hypot(f.x1 - f.x0, f.y1 - f.y0) || 1;
        const sb = Math.sin(Math.PI * u) * f.bend;
        px += (-(f.y1 - f.y0) / L) * sb;
        py += ((f.x1 - f.x0) / L) * sb;
      }
      b.vx = (px - b.x) / h; b.vy = (py - b.y) / h;
      b.x = px; b.y = py;
      b.z = Math.max(0, lerp(f.z0, f.z1, u) + 4 * f.h * u * (1 - u));
      if (f.trail) { this.trail.push({ x: b.x, y: b.y, z: b.z }); if (this.trail.length > 14) this.trail.shift(); }
      if (u >= 1) { b.fl = null; b.vx = 0; b.vy = 0; }
    } else if (b.owner) {
      const o = b.owner;
      const sp = Math.hypot(o.vx, o.vy);
      const lead = 0.5 + Math.min(1, sp / 7) * (0.55 + 0.35 * Math.sin(this.time * 8 + o.ph1));
      const tx = o.x + Math.cos(o.face) * lead, ty = o.y + Math.sin(o.face) * lead;
      const k = Math.min(1, h * 16);
      b.x += (tx - b.x) * k; b.y += (ty - b.y) * k; b.z = 0;
      b.vx = o.vx; b.vy = o.vy;
      if (this.trail.length) this.trail.shift();
    } else {
      b.x += b.vx * h; b.y += b.vy * h; b.z += b.vz * h; b.vz -= 9.8 * h;
      if (b.z <= 0) { b.z = 0; b.vz = b.vz < -1.5 ? -b.vz * 0.45 : 0; }
      const fr = b.z > 0.05 ? 0.15 : 1.1;
      b.vx *= Math.max(0, 1 - fr * h); b.vy *= Math.max(0, 1 - fr * h);
      b.x = clamp(b.x, -6, PW + 6); b.y = clamp(b.y, -6, PL + 6);
      if (this.trail.length) this.trail.shift();
    }
  }

  moveRef(h) {
    const r = this.ref, b = this.ball;
    let tx, ty;
    if (r.goal) { tx = r.goal.x; ty = r.goal.y; }
    else {
      const dir = this.dirOf(this.poss);
      tx = clamp(b.x - 9, 5, PW - 5);
      ty = clamp(b.y - dir * 10, 6, PL - 6);
    }
    const dx = tx - r.x, dy = ty - r.y, d = Math.hypot(dx, dy);
    const want = Math.min(6.8, d * 1.5);
    const vx = d > 0 ? (dx / d) * want : 0, vy = d > 0 ? (dy / d) * want : 0;
    r.vx += (vx - r.vx) * Math.min(1, h * 4); r.vy += (vy - r.vy) * Math.min(1, h * 4);
    r.x += r.vx * h; r.y += r.vy * h;
    // sędziowie liniowi trzymają linię spalonego swojej połowy
    const su = this.upSide;
    this.lines[0].y += (clamp(this.teams[su].line, 4, 52) - this.lines[0].y) * Math.min(1, h * 3);
    this.lines[1].y += (clamp(PL - this.teams[1 - su].line, 53, PL - 4) - this.lines[1].y) * Math.min(1, h * 3);
  }

  // ---------------- prymitywy choreografii ----------------
  *wait(t) { while (t > 0) t -= yield; }
  *until(fn, max = 3) { let e = 0; while (!fn() && e < max) e += yield; }
  *sIdle() { for (;;) yield; }

  fly(x1, y1, z1, T, h, kind, o = {}) {
    const b = this.ball;
    b.owner = null;
    b.fl = { x0: b.x, y0: b.y, z0: b.z, x1, y1, z1, T: Math.max(0.12, T), t: 0, h, kind, bend: o.bend || 0, trail: !!o.trail };
    this.trail.length = 0;
  }

  own(p) {
    const b = this.ball;
    b.owner = p; b.fl = null; b.vz = 0;
    this.poss = p.side;
  }

  placeBall(pt) {
    const b = this.ball;
    b.owner = null; b.fl = null;
    b.x = pt.x; b.y = pt.y; b.z = 0; b.vx = 0; b.vy = 0; b.vz = 0;
  }

  /** Zawodnik dobiega do piłki i ją opanowuje. */
  *getBall(p, max = 2.2) {
    const b = this.ball;
    if (!p || b.owner === p) return;
    if (b.fl) yield* this.until(() => !b.fl, 2.5);
    if (b.owner === p) return;
    p.goal = { x: b.x, y: b.y }; p.gUrg = 1;
    yield* this.until(() => { if (p.goal) { p.goal.x = b.x; p.goal.y = b.y; } return D2(p, b) < 1.25; }, max);
    if (D2(p, b) > 3) { b.x = p.x; b.y = p.y; }
    this.own(p);
    p.goal = null;
  }

  /** Podanie do zawodnika (z wyprzedzeniem jego biegu albo w punkt {x,y}). */
  *pass(from, to, kind = 'ground', o = {}) {
    if (!from || !to || from === to) return;
    if (this.ball.owner !== from) yield* this.getBall(from, 1.8);
    let rx = o.x, ry = o.y;
    if (rx == null) {
      const lead = o.lead ?? 1.2;
      rx = to.x + to.vx * 0.5;
      ry = to.y + to.vy * 0.5 + this.dirOf(to.side) * lead;
    }
    rx = clamp(rx, 0.8, PW - 0.8); ry = clamp(ry, 0.8, PL - 0.8);
    const d = Math.hypot(rx - from.x, ry - from.y);
    const spd = { ground: 15, through: 17, long: 22, cross: 21, throw: 11 }[kind] || 15;
    const T = clamp(d / spd + (kind === 'long' || kind === 'cross' ? 0.3 : 0), 0.3, 3.4);
    const hh = kind === 'long' ? clamp(d * 0.17, 3, 12) : kind === 'cross' ? clamp(d * 0.12, 2.5, 6) : kind === 'throw' ? 1.4 : 0;
    to.goal = { x: rx, y: ry }; to.gUrg = 1;
    from.face = Math.atan2(ry - from.y, rx - from.x);
    from.kickT = 0.25;
    if (from.goal && !o.keepFrom) from.goal = null;
    if (kind === 'long' || kind === 'cross') this.sfx('kick', 0.45);
    this.fly(rx, ry, o.z1 ?? 0, T, hh, kind === 'ground' || kind === 'through' ? 'ground' : 'air');
    yield* this.until(() => !this.ball.fl, T + 0.4);
    if (o.z1 && o.z1 > 0.5) { if (!o.keepGoal) to.goal = null; return; }
    this.own(to);
    if (!o.keepGoal) to.goal = null;
  }

  /** Zagranie piłki w punkt bez adresata (przechwyt, wybicie). */
  *kickTo(from, x, y, kind = 'ground', hh = 0, z1 = 0) {
    if (this.ball.owner !== from) yield* this.getBall(from, 1.5);
    const d = Math.hypot(x - from.x, y - from.y);
    const T = clamp(d / (kind === 'ground' ? 15 : 20) + (hh ? 0.25 : 0), 0.25, 3);
    from.face = Math.atan2(y - from.y, x - from.x);
    from.kickT = 0.25;
    this.fly(x, y, z1, T, hh, kind === 'ground' ? 'ground' : 'air');
    yield* this.until(() => !this.ball.fl, T + 0.3);
  }

  *carry(p, pt, urg = 0.8, max = 4) {
    if (!p) return;
    if (this.ball.owner !== p) yield* this.getBall(p, 1.6);
    p.goal = { x: clamp(pt.x, 1, PW - 1), y: clamp(pt.y, 1, PL - 1) };
    p.gUrg = urg;
    yield* this.until(() => !p.goal || D2(p, p.goal) < 1.0 || this.ball.owner !== p, max);
  }

  /** Doprowadza do tego, że drużyna s ma piłkę (wznowienie, przechwyt albo zebranie bezpańskiej piłki). */
  *gain(s, prefer = null) {
    const b = this.ball;
    if (b.fl) yield* this.until(() => !b.fl, 2.5);
    if (this.restart) yield* this.doRestart();
    if (b.fl) yield* this.until(() => !b.fl, 3);
    if (b.owner && b.owner.side === s && b.owner.state === 'play') { this.phase = 'play'; return; }
    this.phase = 'play';
    const o = b.owner;
    const q = (prefer && prefer.state === 'play' && D2(prefer, b) < 15 ? prefer : null)
      || this.nearest(s, b.x, b.y, (p) => !p.gk && p.state === 'play') || this.nearest(s, b.x, b.y);
    if (!q) return;
    if (o && o.side !== s) {
      const ix = lerp(o.x, q.x, 0.82), iy = lerp(o.y, q.y, 0.82);
      q.goal = { x: ix, y: iy }; q.gUrg = 1;
      yield* this.kickTo(o, ix, iy, 'ground');
      this.own(q);
      q.goal = null;
    } else {
      yield* this.getBall(q, 3);
    }
  }

  *doRestart() {
    const r = this.restart;
    this.restart = null;
    if (!r) return;
    this.phase = 'dead';
    if (r.type === 'goalkick') {
      const G = this.gkOf(r.side);
      const spot = this.w(r.side, 34 + rnd(-6, 6), 5.5);
      this.placeBall(spot);
      if (G) {
        G.goal = this.behind(r.side, spot, 1.2); G.gUrg = 1; G.gSpd = 1.6;
        yield* this.until(() => D2(G, G.goal) < 1.2, 2);
        this.own(G);
        yield* this.wait(0.3);
        this.phase = 'play';
        const rcv = this.mate(r.side, G, (p) => this.ry(r.side, p.y) > 35);
        if (rcv) yield* this.pass(G, rcv, 'long');
      }
    } else {
      const T = this.nearest(r.side, r.x, r.y, (p) => !p.gk && p.state === 'play');
      if (!T) return;
      this.placeBall({ x: r.x, y: r.y });
      T.goal = { x: r.x, y: r.y }; T.gUrg = 1; T.gSpd = 1.5;
      yield* this.until(() => D2(T, T.goal) < 1, 2.5);
      this.own(T);
      yield* this.wait(0.3);
      this.phase = 'play';
      const m = this.mate(r.side, T);
      if (m) yield* this.pass(T, m, r.type === 'throw' ? 'throw' : 'ground');
    }
    this.phase = 'play';
  }

  /** Czeka, aż zawodnicy z celami dojdą na pozycje, a maruderów płynnie dosuwa. */
  *settle(maxT) {
    const movers = () => {
      const out = [];
      for (const T of this.teams) for (const p of T.players) if (p.goal && p.state !== 'off' && p.state !== 'gone' && p.state !== 'down') out.push(p);
      return out;
    };
    let e = 0;
    while (e < maxT) {
      if (movers().every((p) => D2(p, p.goal) < 1.6)) return;
      e += yield;
    }
    let t = 0.3;
    while (t > 0) {
      const h = yield;
      t -= h;
      for (const p of movers()) { p.x += (p.goal.x - p.x) * Math.min(1, h * 9); p.y += (p.goal.y - p.y) * Math.min(1, h * 9); }
    }
  }

  clearGoals(s = null) {
    for (const T of this.teams) {
      if (s != null && T.s !== s) continue;
      for (const p of T.players) if (p.state !== 'off' && p.state !== 'gone') { p.goal = null; p.gSpd = 1; p.wall = false; }
    }
  }

  // ---------------- początek gry ----------------
  setHalf(h) {
    this.half = h;
    this.upSide = h % 2 === 1 ? this.user : 1 - this.user;
  }

  placeKickoff(ks, teleport) {
    for (const s of [0, 1]) {
      const pl = this.active(s);
      const adv = s === ks ? pl.filter((p) => !p.gk && p.state !== 'down').sort((a, b) => b.sy - a.sy).slice(0, 2) : [];
      for (const p of pl) {
        let X, Y;
        if (p.gk) { X = 34; Y = 3; }
        else {
          X = 34 + ((p.sx - 50) / 50) * 28;
          Y = clamp(4 + p.sy * 0.45, 6, 46);
          if (s !== ks && Math.abs(X - 34) < 11) Y = Math.min(Y, 42);
        }
        const i = adv.indexOf(p);
        if (i === 0) { X = 34; Y = 52; } else if (i === 1) { X = 37.5; Y = 50.5; }
        const pt = this.w(s, X, Y);
        if (teleport) { p.x = pt.x; p.y = pt.y; p.vx = 0; p.vy = 0; p.goal = null; }
        else { p.goal = pt; p.gUrg = 0.8; p.gSpd = 1.4; }
        p.face = this.dirOf(s) > 0 ? Math.PI / 2 : -Math.PI / 2;
        if (p.state !== 'down' || !p.injured) { p.state = 'play'; p.stT = 0; }
      }
      if (s === ks) this.kicker = adv[0] || pl.find((p) => !p.gk) || pl[0];
    }
    this.placeBall({ x: PW / 2, y: PL / 2 });
    if (teleport && this.kicker) { this.own(this.kicker); this.ref.x = 28; this.ref.y = 46; }
    this.phase = 'dead';
  }

  *kickoffPass(ks) {
    const K = this.kicker && this.kicker.state === 'play' ? this.kicker : this.nearest(ks, PW / 2, PL / 2);
    if (!K) return;
    if (this.ball.owner !== K) yield* this.getBall(K, 1.5);
    this.phase = 'play';
    this.clearGoals();
    const m = this.mate(ks, K, (p) => this.ry(ks, p.y) < this.ry(ks, K.y) - 4);
    if (m) yield* this.pass(K, m, 'ground');
  }

  *sKickoff(it) {
    const a = it.act;
    const ks = a.s ?? 0;
    if (a.half) this.setHalf(a.half);
    this.needKick = null; this.restart = null; this.pkSetup = false;
    for (const T of this.teams) for (const p of T.players) if (p.state === 'down' && !p.injured) { p.state = 'play'; p.stT = 0; }
    this.placeKickoff(ks, true);
    this.fx = [];
    this.trail.length = 0;
    this.caption(a.half === 2 ? 'Druga połowa' : a.half >= 3 ? 'Dogrywka' : 'Początek meczu');
    this.say();
    this.whistle('short');
    yield* this.wait(0.6);
    yield* this.kickoffPass(ks);
  }

  *sKickoffReset(ks) {
    this.needKick = null;
    this.placeKickoff(ks, false);
    this.placeBall({ x: PW / 2, y: PL / 2 });
    yield* this.settle(2.6);
    if (this.kicker) this.own(this.kicker);
    this.whistle('short');
    yield* this.wait(0.3);
    yield* this.kickoffPass(ks);
  }

  *sStop(it) {
    const a = it.act;
    this.fx = this.fx.filter((f) => f.type === 'caption');
    this.say();
    this.whistle(a.t === 'fulltime' ? 'end' : 'double');
    this.phase = 'dead';
    this.trail.length = 0;
    for (const T of this.teams) for (const p of T.players) {
      if (p.state !== 'play') continue;
      p.goal = a.t === 'fulltime' ? { x: PW / 2 + rnd(-12, 12), y: PL / 2 + rnd(-9, 9) } : { x: p.x + rnd(-2, 2), y: p.y + rnd(-2, 2) };
      p.gUrg = 0.2;
    }
    if (this.ball.owner) { const b = this.ball; b.owner = null; b.vx = 0; b.vy = 0; }
    if (a.t === 'pensStart') this.pkSetup = false;
    yield* this.wait(1.3);
  }

  *sStoppage(it) {
    this.say();
    this.fx.push({ type: 'board', text: '+' + (it.act.n || ''), t: 0, dur: 2.6 });
    yield* this.sAmbient(this.poss, 1.4, 'mid');
  }

  *sQuiet(it, style) {
    const a = it.act;
    const s = a.s ?? this.poss;
    const stl = style || ({ own: 'own', switch: 'switch', fight: 'fight' }[a.v] || 'mid');
    this.say();
    yield* this.sAmbient(s, 2.4, stl);
  }

  /** Spokojne rozgrywanie: krótkie prowadzenie i podania do najlepiej ustawionych partnerów. */
  *sAmbient(s, dur, style = 'mid') {
    const tEnd = this.time + dur;
    yield* this.gain(s);
    const zone = ZONES[style] || ZONES.mid;
    let swaps = style === 'fight' ? 2 : 0;
    let guard = 0;
    while (this.time < tEnd && guard++ < 40) {
      const o = this.ball.owner;
      if (!o || o.side !== s || this.ball.fl) { yield* this.gain(s); continue; }
      const ry = this.ry(s, o.y), rx = this.rx(s, o.x);
      const fwd = ry < zone[1] ? rnd(1, 6) : rnd(-4, 0);
      o.goal = this.w(s, clamp(rx + rnd(-4, 4), 4, 64), clamp(ry + fwd, zone[0], zone[1]));
      o.gUrg = style === 'slow' ? 0.2 : 0.45;
      yield* this.wait(rnd(0.35, 0.9) * (style === 'slow' ? 1.7 : 1));
      if (this.time >= tEnd) break;
      if (swaps > 0 && Math.random() < 0.5) {
        swaps--;
        const q = this.nearest(1 - s, o.x, o.y, (p) => !p.gk && p.state === 'play');
        if (q && D2(q, o) < 12) {
          q.chase = o;
          yield* this.until(() => D2(q, o) < 1.4, 1);
          q.chase = null;
          this.own(q);
          o.state = 'stumble'; o.stT = 0.4; o.goal = null;
          yield* this.wait(0.3);
          yield* this.gain(s);
          continue;
        }
      }
      const r = this.pickReceiver(o, style, zone);
      if (!r) continue;
      yield* this.pass(o, r, D2(o, r) > 27 ? 'long' : 'ground');
    }
    const o = this.ball.owner;
    if (o) o.goal = null;
  }

  pickReceiver(o, style, zone) {
    const s = o.side;
    let best = null, bs = -1e9;
    for (const p of this.active(s)) {
      if (p === o || p.state !== 'play') continue;
      if (p.gk && style !== 'own' && style !== 'slow') continue;
      const d = D2(o, p);
      if (d < 6 || d > 34) continue;
      const ry = this.ry(s, p.y);
      let open = 9;
      for (const q of this.active(1 - s)) open = Math.min(open, D2(p, q));
      let sc = open + (ry - this.ry(s, o.y)) * (style === 'own' || style === 'slow' ? -0.05 : 0.14);
      if (ry < zone[0] - 4 || ry > zone[1] + 6) sc -= 6;
      if (style === 'switch' && Math.abs(p.x - o.x) > 22) sc += 7;
      sc -= Math.abs(d - 16) * 0.12;
      sc += Math.random() * 3;
      if (sc > bs) { bs = sc; best = p; }
    }
    return best;
  }

  // ---------------- akcje ofensywne ----------------
  *sBuild(it) {
    const a = it.act, s = a.s;
    const A = this.pl(s, a.a) || this.role(s, ['CM', 'AM']);
    const B = this.pl(s, a.b);
    if (!A) { this.say(); return; }
    yield* this.gain(s, B && a.v !== 'carry' ? B : A);
    let own = this.ball.owner;
    if (!own || own.side !== s) { this.say(); return; }
    A.hl = 2.5;
    if (B) B.hl = 2;
    const v = a.v;
    if (v === 'pass' || v === 'long') {
      const P = B && B !== A ? B : own !== A ? own : this.mate(s, A);
      if (P && P !== own) { yield* this.pass(own, P, 'ground'); own = this.ball.owner; }
      if (!P || own !== P) { this.say(); return; }
      const long = v === 'long';
      const ty = long ? clamp(this.ry(s, P.y) + rnd(26, 38), 52, 84) : clamp(Math.max(this.ry(s, P.y) + rnd(9, 16), 42), 42, 82);
      const tgt = this.w(s, clamp(this.rx(s, A.x) + rnd(-5, 5), 5, 63), ty);
      A.goal = tgt; A.gUrg = 1;
      yield* this.wait(long ? 0.35 : 0.2);
      this.say();
      yield* this.pass(P, A, long ? 'long' : 'ground', { x: tgt.x, y: tgt.y });
      yield* this.carry(A, this.ahead(s, A, rnd(4, 8), rnd(-3, 3)), 0.7, 1.4);
      return;
    }
    if (v === 'one2') {
      const P = B && B !== A ? B : this.mate(s, A);
      if (own !== A) { yield* this.pass(own, A, 'ground'); if (this.ball.owner !== A) { this.say(); return; } }
      if (!P) { this.say(); return; }
      this.say();
      yield* this.pass(A, P, 'ground', { lead: 0.3 });
      const run = this.ahead(s, A, rnd(11, 16), rnd(-6, 6), 30, 90);
      A.goal = run; A.gUrg = 1;
      yield* this.wait(0.25);
      yield* this.pass(P, A, 'ground', { x: run.x, y: run.y });
      return;
    }
    const left = this.rx(s, A.x) < 34;
    if (own !== A) {
      if (v === 'wing') {
        const tgt = this.w(s, left ? rnd(3, 7) : rnd(61, 65), clamp(this.ry(s, A.y) + rnd(2, 8), 35, 80));
        A.goal = tgt; A.gUrg = 1;
        yield* this.wait(0.25);
        yield* this.pass(own, A, 'ground', { x: tgt.x, y: tgt.y });
      } else yield* this.pass(own, A, 'ground');
      if (this.ball.owner !== A) { this.say(); return; }
    }
    switch (v) {
      case 'receive':
        this.say();
        A.goal = { x: A.x, y: A.y }; A.gUrg = 0.1;
        yield* this.wait(0.55);
        break;
      case 'wing':
        this.say();
        yield* this.carry(A, this.w(s, left ? rnd(3, 7) : rnd(61, 65), clamp(this.ry(s, A.y) + rnd(12, 18), 40, 92)), 0.95, 2.6);
        break;
      case 'beat':
        yield* this.beat(A, 1, true);
        break;
      case 'around': {
        this.say();
        const m1 = this.mate(s, A, (p) => this.ry(s, p.y) > 60);
        if (m1) {
          yield* this.pass(A, m1, 'ground');
          yield* this.wait(0.15);
          const back = this.w(s, clamp(this.rx(s, A.x) + rnd(-8, 8), 14, 54), rnd(72, 82));
          A.goal = back; A.gUrg = 0.8;
          yield* this.pass(m1, A, 'ground', { x: back.x, y: back.y });
        }
        break;
      }
      default:
        this.say();
        yield* this.carry(A, this.ahead(s, A, rnd(12, 18), rnd(-4, 4), 20, 88), 0.85, 2.4);
    }
  }

  /** Mijanie rywali zwodem: obrońca rusza do wślizgu, zawodnik z piłką schodzi w bok i przyspiesza. */
  *beat(A, n, sayAtEnd) {
    const s = A.side;
    for (let i = 0; i < n; i++) {
      const D = this.nearest(1 - s, A.x, A.y, (p) => !p.gk && p.state === 'play' && this.ry(s, p.y) > this.ry(s, A.y) - 2)
        || this.nearest(1 - s, A.x, A.y, (p) => !p.gk && p.state === 'play');
      if (!D) break;
      D.chase = A; D.hl = 1.5;
      A.goal = { x: D.x, y: D.y }; A.gUrg = 0.75;
      yield* this.until(() => D2(A, D) < 2.6, 1.6);
      const side = Math.random() < 0.5 ? -1 : 1;
      A.goal = this.ahead(s, A, 3, side * 3.5); A.gUrg = 1;
      D.chase = null;
      D.goal = { x: A.x, y: A.y }; D.gUrg = 1;
      D.state = 'slide'; D.stT = 0.55;
      yield* this.wait(0.35);
      if (sayAtEnd && i === n - 1) this.say();
      A.goal = this.ahead(s, A, 8, side * 1.5); A.gUrg = 1;
      yield* this.wait(0.45);
      D.goal = null;
    }
    this.say();
  }

  *sDribble(it) {
    const a = it.act, s = a.s;
    const A = this.pl(s, a.a) || this.role(s, ['LW', 'RW', 'AM']);
    if (!A) { this.say(); return; }
    yield* this.gain(s, A);
    const own = this.ball.owner;
    if (own !== A && own && own.side === s) yield* this.pass(own, A, 'ground');
    if (this.ball.owner !== A) { this.say(); return; }
    A.hl = 3;
    this.say();
    yield* this.beat(A, 2, false);
  }

  *sCounter(it) {
    const a = it.act, s = a.s;
    const A = this.pl(s, a.a) || this.role(s, ['CF', 'LW', 'RW', 'AM']);
    if (!A) { this.say(); return; }
    yield* this.gain(s, A);
    const own = this.ball.owner;
    if (own !== A && own && own.side === s) {
      const tgt = this.ahead(s, A, 6, 0, 10, 80);
      A.goal = tgt; A.gUrg = 1;
      yield* this.pass(own, A, 'ground', { x: tgt.x, y: tgt.y });
    }
    this.counterSide = s;
    this.counterUntil = this.time + 4;
    this.say();
    A.hl = 3;
    yield* this.carry(A, this.ahead(s, A, rnd(18, 26), rnd(-5, 5), 30, 84), 1, 3);
  }

  *sLost(it) {
    const a = it.act, s = a.s, o = 1 - s;
    const C = this.pl(s, a.a);
    const D = this.pl(o, a.d) || this.nearest(o, this.ball.x, this.ball.y, (p) => !p.gk);
    yield* this.gain(s, C);
    const own = this.ball.owner;
    if (!own || own.side !== s || !D) { this.say(); return; }
    D.hl = 2.2;
    const v = a.v;
    if (v === 'intercept') {
      const m = this.mate(s, own, (p) => this.ry(s, p.y) > this.ry(s, own.y) - 6);
      if (m) {
        const ix = lerp(own.x, m.x, 0.62), iy = lerp(own.y, m.y, 0.62);
        D.goal = { x: ix, y: iy }; D.gUrg = 1; D.gSpd = 1.3;
        yield* this.wait(0.15);
        yield* this.kickTo(own, ix, iy, 'ground');
        this.own(D);
        this.say();
        D.goal = null;
        yield* this.wait(0.3);
        return;
      }
    }
    if (v === 'clear') {
      const tgt = this.w(s, clamp(this.rx(s, D.x), 18, 50), clamp(this.ry(s, D.y), 70, 96));
      D.goal = tgt; D.gUrg = 1;
      yield* this.wait(0.2);
      yield* this.kickTo(own, tgt.x, tgt.y, this.ry(s, own.y) > 70 ? 'air' : 'ground', 1.6, 0.6);
      this.say();
      D.kickT = 0.25;
      const away = this.w(o, clamp(this.rx(o, D.x) + rnd(-12, 12), 6, 62), clamp(this.ry(o, D.y) + rnd(25, 35), 20, 70));
      this.sfx('kick', 0.5);
      this.fly(away.x, away.y, 0, 1.4, 7, 'air');
      D.goal = null;
      yield* this.until(() => !this.ball.fl, 1.8);
      return;
    }
    if (v === 'quicker') {
      const lx = lerp(own.x, D.x, 0.55), ly = lerp(own.y, D.y, 0.55);
      this.fly(lx, ly, 0, 0.5, 0, 'ground');
      D.goal = { x: lx, y: ly }; D.gUrg = 1; D.gSpd = 1.2;
      yield* this.until(() => !this.ball.fl, 0.8);
      yield* this.getBall(D, 1.2);
      this.say();
      yield* this.wait(0.2);
      return;
    }
    // odbiór, wślizg albo przerwany drybling: obrońca dochodzi do zawodnika z piłką
    own.goal = this.ahead(s, own, 9, rnd(-3, 3), 8, 96); own.gUrg = v === 'dribble' ? 0.8 : 0.6;
    D.chase = own;
    yield* this.until(() => D2(D, own) < (v === 'slide' ? 2.8 : 1.5), 3);
    D.chase = null;
    if (v === 'slide') {
      D.state = 'slide'; D.stT = 0.6; D.goal = { x: own.x, y: own.y }; D.gUrg = 1;
      yield* this.wait(0.2);
      const ang = Math.atan2(own.y - D.y, own.x - D.x) + rnd(-0.6, 0.6);
      const b = this.ball;
      b.owner = null; b.fl = null; b.vx = Math.cos(ang) * 7; b.vy = Math.sin(ang) * 7;
      own.state = 'stumble'; own.stT = 0.5; own.goal = null;
      this.say();
      yield* this.wait(0.45);
      const q = this.nearest(o, b.x, b.y, (p) => !p.gk && p.state === 'play');
      if (q) yield* this.getBall(q, 1.6);
    } else {
      this.own(D);
      own.state = 'stumble'; own.stT = 0.45; own.goal = null;
      this.say();
      D.goal = this.ahead(o, D, 4, 0); D.gUrg = 0.6;
      yield* this.wait(0.4);
    }
    D.goal = null;
  }

  // ---------------- strzały ----------------
  /** Doprowadza piłkę do zawodnika P w punkcie spot (podaniem albo prowadzeniem). */
  *deliver(P, B, spot) {
    if (!P) return;
    const own = this.ball.owner;
    if (own === P) { yield* this.carry(P, spot, 0.85, 2.2); return; }
    const from = B && B !== P ? B : own;
    if (from && own && from.side === P.side && own.side === P.side) {
      if (from !== own) yield* this.pass(own, from, 'ground');
      const cur = this.ball.owner;
      if (!cur || cur.side !== P.side) { yield* this.getBall(P, 2); return; }
      if (cur === P) { yield* this.carry(P, spot, 0.85, 2.2); return; }
      P.goal = { x: spot.x, y: spot.y }; P.gUrg = 1;
      yield* this.wait(0.2);
      yield* this.pass(cur, P, D2(cur, P) > 28 ? 'long' : 'ground', { x: spot.x, y: spot.y });
    } else {
      yield* this.getBall(P, 2);
      yield* this.carry(P, spot, 0.85, 2.2);
    }
  }

  /** Partnerzy wbiegają w pole karne przed dośrodkowaniem lub podaniem. */
  boxRuns(s, A, n = 2) {
    const own = this.ball.owner;
    const runners = this.active(s).filter((p) => p !== A && p !== own && !p.gk && p.state === 'play' && ['CF', 'LW', 'RW', 'AM', 'CM'].includes(p.pos))
      .sort((p1, p2) => this.ry(s, p2.y) - this.ry(s, p1.y)).slice(0, n);
    const spots = [[29, PL - 7], [40, PL - 8], [34, PL - 13]];
    runners.forEach((p, i) => { p.goal = this.w(s, spots[i][0] + rnd(-2, 2), spots[i][1] + rnd(-1.5, 1.5)); p.gUrg = 0.9; });
  }

  /** Obrońcy gonią zawodnika wychodzącego na wolne pole. */
  chasers(s, A, n = 2) {
    this.active(1 - s).filter((p) => !p.gk && p.state === 'play').sort((p1, p2) => D2(p1, A) - D2(p2, A)).slice(0, n)
      .forEach((p) => { p.chase = A; p.gSpd = 0.93; });
  }

  stopChase() {
    for (const T of this.teams) for (const p of T.players) if (p.chase) { p.chase = null; p.gSpd = 1; }
  }

  prepBlock(a, s, spot) {
    if (a.res !== 'block') return;
    const o = 1 - s;
    const Bk = this.pl(o, a.d) || this.nearest(o, spot.x, spot.y, (p) => !p.gk);
    if (!Bk) return;
    const gy = this.goalY(s);
    const ang = Math.atan2(gy - spot.y, 34 - spot.x);
    Bk.goal = { x: spot.x + Math.cos(ang) * 3.2, y: spot.y + Math.sin(ang) * 3.2 };
    Bk.gUrg = 1; Bk.gSpd = 1.3;
    this.blocker = Bk;
  }

  *sShot(it) {
    const a = it.act, s = a.s, o = 1 - s;
    const A = this.pl(s, a.a) || this.role(s, ['CF', 'AM']);
    const B = this.pl(s, a.b);
    if (!A) { this.say(); return; }
    A.hl = 3;
    if (B) B.hl = 2;
    if (a.kind === 'head') { yield* this.headerShot(A, it); return; }
    if (a.kind === 'fk') { yield* this.fkShot(A, it); return; }
    if (a.kind === 'pen') { yield* this.penShot(A, it); return; }
    yield* this.gain(s, B || A);
    if (a.kind === 'long') {
      const spot = this.w(s, clamp(this.rx(s, A.x), 18, 50), rnd(75, 82));
      this.prepBlock(a, s, spot);
      yield* this.deliver(A, B, spot);
      A.goal = this.ahead(s, A, 1.5, 0); A.gUrg = 0.5;
      yield* this.wait(0.25);
      yield* this.strike(A, it);
      return;
    }
    if (a.kind === 'big') {
      const spot = this.w(s, rnd(28, 40), rnd(84, 90));
      A.goal = spot; A.gUrg = 1;
      const own = this.ball.owner;
      const P = B && B !== A ? B : own !== A ? own : null;
      if (P && P.side === s) {
        if (own !== P && own && own.side === s) yield* this.pass(own, P, 'ground');
        yield* this.wait(0.2);
        if (this.ball.owner === P) yield* this.pass(P, A, 'through', { x: spot.x, y: spot.y });
        else yield* this.getBall(A, 2);
      } else yield* this.carry(A, spot, 1, 2.5);
      this.say();
      this.chasers(s, A);
      const G = this.gkOf(o);
      if (G) { G.goal = this.w(s, 34 + (this.rx(s, A.x) - 34) * 0.4, PL - 7.5); G.gUrg = 1; }
      const fin = this.w(s, rnd(29, 39), rnd(92, 95));
      this.prepBlock(a, s, fin);
      yield* this.carry(A, fin, 1, 1.2);
      yield* this.strike(A, it);
      return;
    }
    const v = a.v;
    if (v === 'cross') {
      const left = Math.random() < 0.5;
      const wing = this.w(s, left ? rnd(4, 9) : rnd(59, 64), rnd(88, 97));
      const C = B || this.mate(s, A);
      yield* this.deliver(C, null, wing);
      this.boxRuns(s, A);
      const land = this.w(s, rnd(28, 40), rnd(92, 97));
      this.prepBlock(a, s, land);
      A.goal = land; A.gUrg = 1;
      yield* this.wait(0.3);
      if (this.ball.owner === C) yield* this.pass(C, A, 'cross', { x: land.x, y: land.y, z1: 0.9, keepGoal: true });
      yield* this.strike(A, it, { air: true });
      return;
    }
    if (v === 'cut') {
      const left = Math.random() < 0.5;
      const by = this.w(s, left ? rnd(18, 24) : rnd(44, 50), rnd(100, 102.5));
      const C = B || this.mate(s, A);
      yield* this.deliver(C, null, by);
      this.boxRuns(s, A, 1);
      const spot = this.w(s, rnd(30, 38), rnd(91, 94));
      this.prepBlock(a, s, spot);
      A.goal = spot; A.gUrg = 1;
      yield* this.wait(0.2);
      if (this.ball.owner === C) yield* this.pass(C, A, 'ground', { x: spot.x, y: spot.y });
      yield* this.strike(A, it);
      return;
    }
    if (v === 'pass') {
      const spot = this.w(s, rnd(27, 41), rnd(89, 94));
      const P = B || this.mate(s, A);
      if (this.ball.owner !== P) yield* this.deliver(P, null, this.w(s, clamp(this.rx(s, P.x), 14, 54), rnd(72, 80)));
      this.boxRuns(s, A, 1);
      this.prepBlock(a, s, spot);
      A.goal = spot; A.gUrg = 1;
      yield* this.wait(0.2);
      if (this.ball.owner === P) yield* this.pass(P, A, 'ground', { x: spot.x, y: spot.y });
      yield* this.strike(A, it);
      return;
    }
    // solo, obrót z piłką, ostry kąt
    const spot = v === 'angle' ? this.w(s, Math.random() < 0.5 ? rnd(13, 19) : rnd(49, 55), rnd(97, 101)) : this.w(s, rnd(26, 42), rnd(89, 94));
    yield* this.deliver(A, null, this.ahead(s, A, 0, 0, 60, 85));
    this.prepBlock(a, s, spot);
    yield* this.carry(A, spot, 0.9, 2.4);
    if (v === 'turn') { A.goal = { x: A.x, y: A.y }; A.gUrg = 0.1; yield* this.wait(0.3); }
    yield* this.strike(A, it);
  }

  shotTarget(s, a, G) {
    const gy = this.goalY(s), dy = gy > 50 ? 1 : -1;
    const side = Math.random() < 0.5 ? -1 : 1;
    const gx = G ? G.x : 34;
    let x = 34, y = gy, z = 0.5, h = 0.3, bend = 0;
    switch (a.res || 'missWide') {
      case 'goal': case 'og':
        x = 34 + side * rnd(1.2, 3.2); z = rnd(0.15, a.kind === 'head' ? 1.7 : 2.1); y = gy + dy * 0.4; break;
      case 'save': case 'penSave':
        if (a.sv === 'catch') { x = clamp(gx + rnd(-0.6, 0.6), 34 - 3, 34 + 3); z = rnd(0.4, 1.5); }
        else { x = 34 + side * rnd(1.6, 3.2); z = rnd(0.2, 2.0); }
        y = gy - dy * 0.5; break;
      case 'saveCorner': x = 34 + side * rnd(2.4, 3.4); z = rnd(1.6, 2.35); y = gy - dy * 0.3; break;
      case 'missWide': x = 34 + side * rnd(4.4, 8); z = rnd(0.1, 1.5); y = gy + dy * 2.5; break;
      case 'missHigh': x = 34 + rnd(-4.5, 4.5); z = rnd(3.2, 5.5); y = gy + dy * 2.5; h = 0.8; break;
      case 'missBig': case 'penMiss':
        if (a.mv === 'high') { x = 34 + rnd(-3.5, 3.5); z = rnd(3, 4.5); } else { x = 34 + side * rnd(4, 5.6); z = rnd(0.1, 1.2); }
        y = gy + dy * 2.5; break;
      case 'post': x = 34 + side * GHW; z = rnd(0.3, 2.1); y = gy; break;
      case 'bar': x = 34 + rnd(-3, 3); z = 2.44; y = gy; break;
      case 'block': if (this.blocker) { x = this.blocker.x; y = this.blocker.y; z = rnd(0.3, 1.0); } break;
    }
    if (a.kind === 'fk') { h = 1.3; bend = side * rnd(1, 2.5); }
    else if (a.kind === 'long' && Math.random() < 0.4) bend = rnd(-1.5, 1.5);
    return { x, y, z, h, bend };
  }

  /** Uderzenie: komentarz w chwili strzału, lot piłki w zwolnionym tempie, reakcja bramkarza. */
  *strike(A, it, o = {}) {
    const a = it.act, s = a.s;
    const b = this.ball;
    if (!o.air && b.owner !== A && !b.fl) yield* this.getBall(A, 1.2);
    if (b.fl) yield* this.until(() => !b.fl, 1.6);
    const G = this.gkOf(1 - s);
    const tg = this.shotTarget(s, a, G);
    this.say();
    A.kickT = 0.3; A.goal = null;
    A.face = Math.atan2(tg.y - A.y, tg.x - A.x);
    if (a.kind === 'fk') for (const p of this.active(1 - s)) if (p.wall) { p.state = 'jump'; p.stT = 0.5; }
    const spd = { long: 29, box: 26, big: 24, head: 17, fk: 24, pen: 25 }[a.kind] || 25;
    const d = Math.hypot(tg.x - b.x, tg.y - b.y);
    const T = clamp(d / spd, 0.24, 1.6);
    this.slow(T + 0.5);
    this.sfx('kick', a.kind === 'head' ? 0.5 : 1);
    if (b.owner === A) b.owner = null;
    this.fly(tg.x, tg.y, tg.z, T, tg.h, 'air', { bend: tg.bend, trail: true });
    if (G) this.gkReact(G, tg, T, a);
    this.lastShot = { s, A, G, tg, res: a.res };
    yield* this.until(() => !b.fl, T + 0.4);
  }

  gkReact(G, tg, T, a) {
    const r = a.res;
    const dx = tg.x - G.x;
    let cx = tg.x;
    if (r === 'goal' || r === 'og') cx = Math.random() < 0.35 ? G.x - Math.sign(dx || 1) * rnd(1, 2) : G.x + dx * rnd(0.3, 0.6);
    else if (r === 'missWide' || r === 'missHigh' || r === 'missBig' || r === 'penMiss') cx = G.x + dx * 0.3;
    else if (r === 'post' || r === 'bar') cx = G.x + dx * 0.5;
    else if (r === 'block') cx = G.x;
    const lat = Math.abs(cx - G.x);
    G.goal = { x: clamp(cx, 34 - 3.6, 34 + 3.6), y: G.y }; G.gUrg = 1; G.gSpd = lat > 1.2 ? 2.4 : 1.4;
    if (lat > 1.4) { G.state = 'dive'; G.stT = Math.max(0.8, T + 0.5); G.diveDir = Math.sign(cx - G.x); }
  }

  *headerShot(A, it) {
    const b = this.ball;
    if (b.fl) {
      A.goal = { x: b.fl.x1, y: b.fl.y1 }; A.gUrg = 1;
      yield* this.until(() => !b.fl, 2);
    }
    A.goal = { x: b.x, y: b.y }; A.gUrg = 1;
    yield* this.until(() => D2(A, b) < 1.3, 0.5);
    A.state = 'jump'; A.stT = 0.6;
    b.z = Math.max(b.z, 1.9);
    yield* this.strike(A, it, { air: true });
  }

  *fkShot(A, it) {
    const b = this.ball;
    if (D2(A, b) > 3) { A.goal = this.behind(A.side, b, 2.2); A.gUrg = 1; A.gSpd = 1.6; yield* this.until(() => D2(A, A.goal) < 0.8, 2); }
    yield* this.wait(0.4);
    A.goal = { x: b.x, y: b.y }; A.gUrg = 0.6;
    yield* this.until(() => D2(A, b) < 0.9, 1);
    yield* this.strike(A, it, { air: true });
  }

  *penShot(A, it) {
    const s = A.side, o = 1 - s;
    this.phase = 'setpiece';
    const spot = this.w(s, 34, PL - 11);
    this.placeBall(spot);
    this.say();
    for (const T of this.teams) for (const p of T.players) {
      if (p.state !== 'play') continue;
      if (p === A) { p.goal = this.behind(s, spot, 2.4); p.gUrg = 0.8; p.gSpd = 1.4; continue; }
      if (p.gk && p.side === o) { p.goal = this.w(s, 34, PL - 0.3); p.gUrg = 0.7; continue; }
      if (p.gk) continue;
      const X = clamp(this.rx(s, p.x) + rnd(-2, 2), 8, 60);
      let Y = this.ry(s, p.y);
      if (Y > PL - 18.5) Y = PL - 18.5 - rnd(0, 5);
      if (Math.abs(X - 34) < 10 && Y > PL - 21.5) Y = PL - 21.5 - rnd(0, 3);
      Y = Math.max(Y, PL - 32);
      p.goal = this.w(s, X, Y); p.gUrg = 0.7; p.gSpd = 1.3;
    }
    yield* this.settle(2.4);
    yield* this.wait(0.7);
    A.goal = { x: spot.x, y: spot.y }; A.gUrg = 0.7;
    yield* this.until(() => D2(A, this.ball) < 0.9, 1.2);
    yield* this.strike(A, it, { air: true });
  }

  // ---------------- efekty strzałów ----------------
  *sGoal(it) {
    this.stopChase();
    const a = it.act, s = a.s, o = 1 - s;
    const ls = this.lastShot;
    const og = a.t === 'ownGoal';
    const scorer = og ? (ls && ls.A) || this.pl(s, a.a) : this.pl(s, a.a) || (ls && ls.A);
    const b = this.ball;
    if (b.fl) yield* this.until(() => !b.fl, 1);
    const gy = this.goalY(s), dy = gy > 50 ? 1 : -1;
    this.fly(clamp(b.x, 34 - 3.3, 34 + 3.3), gy + dy * 1.7, Math.min(b.z, 1.6), 0.22, 0, 'air');
    this.say();
    this.sfx('goal', s);
    this.fx.push({ type: 'net', y: gy, x: b.x, t: 0, dur: 0.9 });
    const d = og ? this.pl(o, a.d) : null;
    this.fx.push({ type: 'goal', s, t: 0, dur: 2.8, name: og ? `${this.nameOf(o, a.d)} (sam.)` : this.nameOf(s, a.a) || (scorer ? scorer.ln : '') });
    this.phase = 'celebrate';
    this.trail.length = 0;
    if (d) { d.state = 'down'; d.stT = 1.6; }
    const G = this.gkOf(o);
    if (G) { G.state = 'down'; G.stT = 1.4; }
    if (scorer) {
      const cx = scorer.x < 34 ? rnd(5, 10) : rnd(58, 63);
      const cy = gy - dy * rnd(6, 14);
      scorer.goal = { x: cx, y: cy }; scorer.gUrg = 1; scorer.hl = 4;
      for (const p of this.active(s)) {
        if (p === scorer || p.gk || D2(p, scorer) > 45) continue;
        p.goal = { x: cx + rnd(-3, 3), y: cy - dy * rnd(1, 4) }; p.gUrg = 0.9;
      }
      this.fx.push({ type: 'confetti', s, x: scorer.x, y: scorer.y, t: 0, dur: 1.6 });
    }
    for (const p of this.active(o)) if (!p.gk && p !== d) p.goal = null;
    yield* this.wait(2.6);
    this.needKick = o;
  }

  *sAssist(it) {
    this.say();
    const B = this.pl(it.act.s, it.act.b);
    if (B) B.hl = 2.5;
    yield* this.wait(1.1);
  }

  *sSave(it) {
    this.stopChase();
    const a = it.act, s = a.s, o = 1 - s;
    const G = this.pl(o, a.g) || this.gkOf(o);
    const b = this.ball;
    if (b.fl) yield* this.until(() => !b.fl, 1);
    this.say();
    this.trail.length = 0;
    const sv = a.t === 'penSave' ? (Math.random() < 0.5 ? 'catch' : 'parry') : a.v || 'parry';
    if (sv === 'dive' || a.kind === 'big' || a.t === 'penSave') this.sfx('crowd', { type: 'ooh', side: s });
    if (G) G.hl = 2.5;
    if (sv === 'catch' && G) {
      b.x = G.x; b.y = G.y;
      this.own(G);
      G.goal = { x: G.x, y: G.y }; G.gUrg = 0.2;
      this.phase = 'dead';
      yield* this.wait(1.0);
      yield* this.gkDistribute(G);
      return;
    }
    const dy = this.goalY(s) > 50 ? 1 : -1;
    const sx = b.x < 34 ? -1 : 1;
    b.owner = null; b.fl = null;
    b.vx = sx * rnd(5, 9); b.vy = -dy * rnd(4, 8); b.vz = rnd(1, 3);
    yield* this.wait(0.7);
    const q = this.nearest(o, b.x, b.y, (p) => !p.gk && p.state === 'play');
    if (q) yield* this.getBall(q, 1.5);
  }

  *gkDistribute(G) {
    const s = G.side;
    this.phase = 'play';
    G.goal = null;
    const m = this.mate(s, G, (p) => this.ry(s, p.y) > 18);
    if (m) yield* this.pass(G, m, D2(G, m) > 30 ? 'long' : 'throw');
  }

  *sSaveCorner(it) {
    this.stopChase();
    const a = it.act, s = a.s, o = 1 - s;
    const G = this.pl(o, a.g) || this.gkOf(o);
    const b = this.ball;
    if (b.fl) yield* this.until(() => !b.fl, 1);
    this.say();
    this.trail.length = 0;
    if (G) G.hl = 2;
    const gy = this.goalY(s), dy = gy > 50 ? 1 : -1;
    const sx = b.x < 34 ? -1 : 1;
    this.fly(34 + sx * rnd(5, 9), gy + dy * 3, 0, 0.5, 1.5, 'air');
    this.cornerSide = sx;
    this.sfx('crowd', { type: 'ooh', side: s });
    yield* this.until(() => !b.fl, 0.8);
    this.phase = 'dead';
    yield* this.wait(0.4);
  }

  *sMiss(it) {
    this.stopChase();
    const a = it.act, s = a.s;
    const b = this.ball;
    if (b.fl) yield* this.until(() => !b.fl, 1);
    this.say();
    if (a.big || a.t === 'penMiss') this.sfx('crowd', { type: 'ooh', side: s });
    const dy = this.goalY(s) > 50 ? 1 : -1;
    b.vx = (b.x - 34) * 0.3; b.vy = dy * 4; b.vz = 0;
    this.phase = 'dead';
    yield* this.wait(0.9);
    this.trail.length = 0;
    this.restart = { type: 'goalkick', side: 1 - s };
  }

  *sWoodwork(it) {
    this.stopChase();
    const a = it.act, s = a.s, o = 1 - s;
    const b = this.ball;
    if (b.fl) yield* this.until(() => !b.fl, 1);
    this.say();
    this.sfx('post');
    this.sfx('crowd', { type: 'ooh', side: s, loud: true });
    this.fx.push({ type: 'post', x: b.x, y: b.y, t: 0, dur: 0.6 });
    this.trail.length = 0;
    const dy = this.goalY(s) > 50 ? 1 : -1;
    b.owner = null; b.fl = null;
    b.vx = (b.x - 34) * rnd(0.6, 1.4) + rnd(-3, 3); b.vy = -dy * rnd(6, 11); b.vz = a.v === 'bar' ? 0 : 1.5;
    yield* this.wait(0.8);
    const q = this.nearest(o, b.x, b.y, (p) => !p.gk && p.state === 'play');
    if (q) yield* this.getBall(q, 1.5);
  }

  *sBlocked(it) {
    this.stopChase();
    const a = it.act, s = a.s, o = 1 - s;
    const b = this.ball;
    if (b.fl) yield* this.until(() => !b.fl, 1);
    this.say();
    this.trail.length = 0;
    const Bk = this.blocker || this.pl(o, a.d);
    this.blocker = null;
    if (Bk) { Bk.hl = 2; Bk.state = 'slide'; Bk.stT = 0.5; Bk.goal = null; }
    const nxt = this.peek(it);
    const gy = this.goalY(s), dy = gy > 50 ? 1 : -1;
    b.owner = null; b.fl = null;
    if (nxt && nxt.act && nxt.act.t === 'corner') {
      const sx = b.x < 34 ? -1 : 1;
      this.cornerSide = sx;
      this.fly(34 + sx * rnd(12, 22), gy + dy * 2, 0, 0.7, 2, 'air');
      yield* this.until(() => !b.fl, 1);
      this.phase = 'dead';
      yield* this.wait(0.3);
    } else {
      b.vx = rnd(-8, 8); b.vy = -dy * rnd(3, 7); b.vz = 1.5;
      yield* this.wait(0.6);
      const q = this.nearest(o, b.x, b.y, (p) => !p.gk && p.state === 'play');
      if (q) yield* this.getBall(q, 1.4);
    }
  }

  // ---------------- faule, kartki, stałe fragmenty ----------------
  *sFoul(it, zoneOverride) {
    const a = it.act, s = a.s, o = 1 - s;
    const zone = zoneOverride || a.zone || 'mid';
    const D = this.pl(o, a.d) || this.nearest(o, this.ball.x, this.ball.y, (p) => !p.gk);
    yield* this.gain(s);
    let V = this.ball.owner;
    if (!V || V.side !== s || !D) { this.say(); this.whistle(); this.phase = 'dead'; yield* this.wait(0.8); return; }
    const vy = this.ry(s, V.y);
    const target = zone === 'box' ? this.w(s, rnd(24, 44), rnd(90, 97))
      : zone === 'near' ? this.w(s, rnd(22, 46), rnd(80, 86))
        : zone === 'far' ? this.w(s, rnd(10, 58), rnd(60, 76))
          : vy > 72 || vy < 22 ? this.w(s, rnd(10, 58), rnd(35, 65)) : null;
    if (target) {
      if (D2(V, target) > 16) {
        const m = this.nearest(s, target.x, target.y, (p) => !p.gk && p !== V && p.state === 'play');
        if (m) {
          m.goal = { x: target.x, y: target.y }; m.gUrg = 1;
          yield* this.wait(0.15);
          yield* this.pass(V, m, D2(V, target) > 28 ? 'long' : 'ground', { x: target.x, y: target.y });
          V = this.ball.owner;
        }
      }
      if (V && V.side === s) { V.goal = this.ahead(s, V, 4, rnd(-3, 3), 8, zone === 'box' ? 98 : 87); V.gUrg = 0.8; }
    } else if (V) { V.goal = this.ahead(s, V, 6, rnd(-3, 3)); V.gUrg = 0.6; }
    if (!V || V.side !== s) { this.say(); this.whistle(); this.phase = 'dead'; return; }
    D.hl = 2.5; D.chase = V; D.gSpd = 1.15;
    yield* this.until(() => D2(D, V) < 1.6, 2.6);
    D.chase = null;
    if (Math.random() < 0.5) { D.state = 'slide'; D.stT = 0.5; }
    D.goal = { x: V.x, y: V.y }; D.gUrg = 0.6;
    V.state = 'down'; V.stT = 1.6; V.goal = null;
    const b = this.ball;
    b.owner = null; b.fl = null; b.vx = V.vx * 0.6; b.vy = V.vy * 0.6;
    this.say();
    this.whistle(zone === 'box' ? 'long' : 'short');
    this.phase = 'dead';
    this.foulSpot = zone === 'box' ? this.w(s, 34, PL - 11) : { x: clamp(V.x, 1, PW - 1), y: clamp(V.y, 1, PL - 1) };
    this.ref.goal = { x: clamp(V.x + rnd(-4, 4), 2, PW - 2), y: clamp(V.y - this.dirOf(s) * 5, 2, PL - 2) };
    yield* this.wait(1.1);
    D.goal = null;
    this.ref.goal = null;
    const rest = this.peekAll(it);
    const setPiece = rest.some((q) => q.act && (q.act.t === 'fkFar' || q.act.t === 'fkNear' || (q.act.t === 'shot' && q.act.kind === 'pen')));
    if (!setPiece) this.restart = { type: 'fk', side: s, x: this.foulSpot.x, y: this.foulSpot.y };
  }

  *sCard(it) {
    const a = it.act, s = a.s;
    const p = this.pl(s, a.a);
    this.phase = 'dead';
    if (p) {
      p.hl = 3;
      this.ref.goal = { x: clamp(p.x + 1.6, 1, PW - 1), y: clamp(p.y + 1.2, 1, PL - 1) };
      yield* this.until(() => D2(this.ref, this.ref.goal) < 1.3, 1.4);
    }
    this.say();
    this.whistle('short');
    this.fx.push({ type: 'card', red: a.t !== 'yellow', p, t: 0, dur: 2.2 });
    yield* this.wait(1.0);
    if (p && a.t !== 'yellow') {
      p.state = 'off'; p.offUntil = this.time + 5;
      p.goal = { x: p.x < PW / 2 ? -1.5 : PW + 1.5, y: p.y }; p.gUrg = 0.3;
      if (this.ball.owner === p) this.ball.owner = null;
      if (this.restart && this.restart.side === s && p.gk) this.restart = null;
      yield* this.wait(0.8);
      this.syncSlots();
    }
    this.ref.goal = null;
  }

  /** Ustawienie przy dośrodkowaniu ze stałego fragmentu: wysocy w polu karnym, krycie, strefa, bramkarz. */
  boxLayout(s, taker, spot, H, Dc) {
    const o = 1 - s;
    const att = this.active(s).filter((p) => !p.gk && p !== taker && p.state === 'play');
    const tall = (p) => (p.pos === 'CB' || p.pos === 'CF' ? 1 : 0);
    const byAir = att.slice().sort((a, b) => tall(b) - tall(a));
    const inBox = [];
    if (H && H !== taker && att.includes(H)) inBox.push(H);
    for (const p of byAir) { if (inBox.length >= 5) break; if (!inBox.includes(p)) inBox.push(p); }
    const SP = [[30, PL - 6], [38, PL - 6.5], [34, PL - 10], [27, PL - 12], [42, PL - 12]];
    inBox.forEach((p, i) => { const [X, Y] = SP[i]; p.goal = this.w(s, X + rnd(-1.5, 1.5), Y + rnd(-1, 1)); p.gUrg = 1; p.gSpd = 1.7; });
    att.filter((p) => !inBox.includes(p)).forEach((p, i) => {
      p.goal = i < 2 ? this.w(s, i ? 22 : 46, PL - 21) : this.w(s, [20, 48, 34, 10, 58][(i - 2) % 5], 55 + rnd(-3, 3));
      p.gUrg = 0.8; p.gSpd = 1.5;
    });
    const def = this.active(o).filter((p) => !p.gk && p.state === 'play');
    const used = new Set();
    const toGoal = this.dirOf(s);
    for (const ap of inBox) {
      const m = def.filter((d) => !used.has(d) && d !== Dc).sort((x, y) => D2(x, ap) - D2(y, ap))[0];
      if (!m) continue;
      used.add(m);
      m.goal = { x: ap.goal.x + rnd(-0.8, 0.8), y: ap.goal.y + toGoal * 1.2 }; m.gUrg = 1; m.gSpd = 1.7;
    }
    if (Dc && !used.has(Dc)) {
      const tgt = inBox.length ? inBox[Math.floor(Math.random() * inBox.length)].goal : this.w(s, 34, PL - 8);
      Dc.goal = { x: tgt.x + rnd(-0.6, 0.6), y: tgt.y + toGoal * 0.9 }; Dc.gUrg = 1; Dc.gSpd = 1.7;
      used.add(Dc);
    }
    def.filter((d) => !used.has(d)).forEach((d, i) => {
      d.goal = this.w(s, [26, 34, 42, 30, 38, 22, 46][i % 7], i < 3 ? PL - 8 : PL - 17);
      d.gUrg = 0.9; d.gSpd = 1.6;
    });
    const G = this.gkOf(o);
    if (G) { G.goal = this.w(s, 34 + (this.rx(s, spot.x) > 34 ? 1.2 : -1.2), PL - 0.8); G.gUrg = 0.8; }
  }

  setPieceRoles(it) {
    const s = it.act.s, o = 1 - s;
    const rest = this.peekAll(it);
    const hdr = rest.find((x) => x.act && x.act.t === 'shot' && x.act.kind === 'head');
    const clr = rest.find((x) => x.act && x.act.t === 'cleared');
    return { H: hdr ? this.pl(s, hdr.act.a) : null, Dc: clr && clr.act.v === 'clear' ? this.pl(o, clr.act.d) : null };
  }

  *sFkFar(it) {
    const a = it.act, s = a.s;
    const T = this.pl(s, a.a) || this.role(s, ['CM', 'AM']);
    let spot = this.foulSpot || this.w(s, rnd(12, 56), rnd(62, 74));
    if (this.ry(s, spot.y) > 78 || this.ry(s, spot.y) < 45) spot = this.w(s, clamp(this.rx(s, spot.x), 8, 60), clamp(this.ry(s, spot.y), 50, 76));
    this.placeBall(spot);
    this.restart = null;
    this.phase = 'setpiece';
    this.say();
    const { H, Dc } = this.setPieceRoles(it);
    this.boxLayout(s, T, spot, H, Dc);
    if (T) { T.goal = this.behind(s, spot, 1.8); T.gUrg = 1; T.gSpd = 1.6; T.hl = 2.5; }
    yield* this.settle(2.2);
  }

  *sFkNear(it) {
    const a = it.act, s = a.s, o = 1 - s;
    const T = this.pl(s, a.a) || this.role(s, ['AM', 'CF']);
    const fy = this.foulSpot ? this.ry(s, this.foulSpot.y) : 0;
    let spot = fy > 74 && fy < 88 ? this.foulSpot : this.w(s, rnd(24, 44), rnd(80, 86));
    if (this.ry(s, spot.y) > 87) spot = this.w(s, this.rx(s, spot.x), 86.5);
    this.placeBall(spot);
    this.restart = null;
    this.phase = 'setpiece';
    this.say();
    const gy = this.goalY(s);
    const ang = Math.atan2(gy - spot.y, 34 - spot.x);
    const wx = spot.x + Math.cos(ang) * 9.15, wy = spot.y + Math.sin(ang) * 9.15;
    const px = -Math.sin(ang), py = Math.cos(ang);
    const wp = { x: wx, y: wy };
    const defs = this.active(o).filter((p) => !p.gk && p.state === 'play').sort((p1, p2) => D2(p1, wp) - D2(p2, wp));
    const n = Math.min(4, defs.length);
    defs.slice(0, n).forEach((p, i) => { const off = (i - (n - 1) / 2) * 1.9; p.goal = { x: wx + px * off, y: wy + py * off }; p.gUrg = 1; p.gSpd = 1.8; p.wall = true; });
    defs.slice(n).forEach((p, i) => { p.goal = this.w(s, [28, 40, 34, 22, 46, 31][i % 6], PL - [7, 7, 12, 14, 14, 18][i % 6]); p.gUrg = 0.9; p.gSpd = 1.6; });
    this.active(s).filter((p) => !p.gk && p !== T && p.state === 'play').forEach((p, i) => {
      p.goal = i < 4 ? this.w(s, [26, 42, 30, 38][i], PL - [9, 9, 15, 15][i]) : this.w(s, [18, 50, 34, 8, 60][(i - 4) % 5], 58 + rnd(-3, 3));
      p.gUrg = 0.9; p.gSpd = 1.6;
    });
    if (T) { T.goal = this.behind(s, spot, 2.4); T.gUrg = 1; T.gSpd = 1.8; T.hl = 2.5; }
    const G = this.gkOf(o);
    if (G) { G.goal = this.w(s, 34 + (this.rx(s, spot.x) < 34 ? 1.5 : -1.5), PL - 0.6); G.gUrg = 0.8; }
    yield* this.settle(2.4);
  }

  *sCorner(it) {
    const a = it.act, s = a.s;
    const T = this.pl(s, a.a) || this.role(s, ['LW', 'RW', 'CM']);
    const sx = this.cornerSide || (Math.random() < 0.5 ? -1 : 1);
    this.cornerSide = null;
    const gy = this.goalY(s), dy = gy > 50 ? 1 : -1;
    const spot = { x: sx < 0 ? 0.6 : PW - 0.6, y: gy - dy * 0.6 };
    this.placeBall(spot);
    this.restart = null;
    this.phase = 'setpiece';
    this.say();
    const { H, Dc } = this.setPieceRoles(it);
    this.boxLayout(s, T, spot, H, Dc);
    if (T) { T.goal = { x: spot.x + sx * 0.9, y: spot.y + dy * 0.9 }; T.gUrg = 1; T.gSpd = 2.2; T.hl = 2.5; }
    yield* this.settle(2.4);
  }

  /** Dośrodkowanie z rogu lub wolnego: piłka leci tam, gdzie czeka główkujący, wybijający lub bramkarz. */
  *sCross(it) {
    const a = it.act, s = a.s, o = 1 - s;
    const b = this.ball;
    const T = this.pl(s, a.a) || this.nearest(s, b.x, b.y);
    if (T && D2(T, b) > 1.6) {
      T.goal = { x: b.x, y: b.y }; T.gUrg = 1; T.gSpd = 1.5;
      yield* this.until(() => D2(T, b) < 1.4, 1.5);
    }
    const nx = (this.peekAll(it)[0] || {}).act;
    let land = null, z1 = 1.9;
    if (nx && nx.t === 'shot' && nx.kind === 'head') { const H = this.pl(s, nx.a); if (H) land = H.goal ? { x: H.goal.x, y: H.goal.y } : { x: H.x, y: H.y }; }
    else if (nx && nx.t === 'cleared' && nx.v === 'clear') { const Dd = this.pl(o, nx.d); if (Dd) land = Dd.goal ? { x: Dd.goal.x, y: Dd.goal.y } : { x: Dd.x, y: Dd.y }; }
    else if (nx && nx.t === 'cleared' && nx.v === 'claim') { land = this.w(s, rnd(31, 37), PL - rnd(3, 5)); z1 = 2.3; }
    if (!land) land = this.w(s, rnd(28, 40), PL - rnd(5, 11));
    this.say();
    if (T) { T.kickT = 0.3; T.face = Math.atan2(land.y - T.y, land.x - T.x); T.goal = null; }
    const d = Math.hypot(land.x - b.x, land.y - b.y);
    const Tf = clamp(d / 19 + 0.35, 0.8, 2.0);
    this.sfx('kick', 0.6);
    this.fly(land.x, land.y, z1, Tf, clamp(d * 0.13, 3, 6), 'air');
    this.phase = 'play';
    yield* this.until(() => !b.fl, Tf + 0.3);
  }

  *sCleared(it) {
    const a = it.act, s = a.s, o = 1 - s;
    const b = this.ball;
    if (b.fl) yield* this.until(() => !b.fl, 1.5);
    if (a.v === 'claim') {
      const G = this.pl(o, a.g) || this.gkOf(o);
      if (G) {
        G.goal = { x: b.x, y: b.y }; G.gUrg = 1; G.gSpd = 1.6; G.state = 'jump'; G.stT = 0.5;
        yield* this.until(() => D2(G, b) < 1.5, 0.7);
        b.x = G.x; b.y = G.y;
        this.own(G);
        G.hl = 2;
      }
      this.say();
      this.phase = 'dead';
      this.clearGoals(s);
      yield* this.wait(0.9);
      if (G) yield* this.gkDistribute(G);
      this.clearGoals();
      return;
    }
    const Dd = this.pl(o, a.d) || this.nearest(o, b.x, b.y, (p) => !p.gk);
    if (Dd) {
      Dd.goal = { x: b.x, y: b.y }; Dd.gUrg = 1;
      yield* this.until(() => D2(Dd, b) < 1.4, 0.6);
      Dd.state = 'jump'; Dd.stT = 0.4; Dd.hl = 2; Dd.kickT = 0.3;
    }
    this.say();
    const away = this.w(o, clamp(this.rx(o, b.x) + rnd(-14, 14), 4, 64), rnd(28, 45));
    this.sfx('kick', 0.5);
    this.fly(away.x, away.y, 0, 1.3, 8, 'air');
    this.clearGoals();
    this.phase = 'play';
    yield* this.until(() => !b.fl, 1.6);
  }

  *sOffside(it) {
    const a = it.act, s = a.s, o = 1 - s;
    const A = this.pl(s, a.a) || this.role(s, ['CF']);
    yield* this.gain(s);
    let P = this.ball.owner;
    if (!P || P.side !== s || !A) { this.say(); return; }
    if (P === A) { const m = this.mate(s, A); if (m) { yield* this.pass(A, m, 'ground'); P = this.ball.owner; } }
    if (!P || P.side !== s || P === A) { this.say(); return; }
    const line = PL - this.teams[o].line;
    const tgt = this.w(s, clamp(this.rx(s, A.x), 16, 52), clamp(line + rnd(2.5, 5), 60, 99));
    A.goal = tgt; A.gUrg = 1; A.hl = 2.5;
    yield* this.wait(0.45);
    this.fx.push({ type: 'offside', y: this.w(s, 34, line).y, t: 0, dur: 2.2 });
    this.say();
    this.whistle('short');
    yield* this.pass(P, A, 'through', { x: tgt.x, y: tgt.y });
    this.phase = 'dead';
    A.goal = null;
    yield* this.wait(0.6);
    this.restart = { type: 'fk', side: o, x: clamp(this.ball.x, 2, PW - 2), y: clamp(this.ball.y, 2, PL - 2) };
  }

  *sDive(it) {
    const a = it.act, s = a.s, o = 1 - s;
    const A = this.pl(s, a.a) || this.role(s, ['CF', 'LW', 'RW']);
    yield* this.gain(s, A);
    const own = this.ball.owner;
    if (A && own !== A && own && own.side === s) yield* this.pass(own, A, 'ground');
    if (!A || this.ball.owner !== A) { this.say(); return; }
    const tgt = this.w(s, rnd(22, 46), rnd(86, 91));
    const D = this.nearest(o, tgt.x, tgt.y, (p) => !p.gk && p.state === 'play');
    A.goal = tgt; A.gUrg = 0.9; A.hl = 2.5;
    if (D) D.chase = A;
    yield* this.until(() => (D && D2(A, D) < 1.8) || D2(A, tgt) < 1.2, 2.6);
    if (D) D.chase = null;
    A.state = 'down'; A.stT = 1.5; A.goal = null;
    const b = this.ball;
    b.owner = null; b.vx = A.vx * 0.5; b.vy = A.vy * 0.5;
    this.foulSpot = { x: A.x, y: A.y };
    this.say();
    this.phase = 'dead';
    yield* this.wait(0.9);
  }

  *sDiveNothing(it) {
    this.say();
    const o = 1 - it.act.s;
    const q = this.nearest(o, this.ball.x, this.ball.y, (p) => !p.gk && p.state === 'play');
    this.phase = 'play';
    if (q) yield* this.getBall(q, 1.4);
  }

  *sRefTo(p) {
    this.phase = 'dead';
    if (p) {
      this.ref.goal = { x: clamp(p.x + 1.5, 1, PW - 1), y: clamp(p.y + 1.5, 1, PL - 1) };
      yield* this.until(() => D2(this.ref, this.ref.goal) < 1.5, 1.3);
      p.state = 'play'; p.stT = 0;
    }
    this.say();
    this.whistle('short');
    yield* this.wait(0.6);
  }

  *sInjury(it) {
    const a = it.act, s = a.s;
    const P = this.pl(s, a.a);
    const b = this.ball;
    const o = b.owner;
    if (o && P !== o && !b.fl) yield* this.kickTo(o, o.x < PW / 2 ? -2 : PW + 2, o.y, 'ground');
    this.phase = 'dead';
    if (P) {
      P.state = 'down'; P.stT = 999; P.goal = null; P.hl = 3; P.injured = true;
      if (b.owner === P) b.owner = null;
    }
    this.say();
    this.whistle('short');
    this.fx.push({ type: 'medic', p: P, t: 0, dur: 2.6 });
    yield* this.wait(1.6);
    if (b.x < 0 || b.x > PW) this.restart = { type: 'throw', side: o ? 1 - o.side : s, x: clamp(b.x, 0.3, PW - 0.3), y: clamp(b.y, 2, PL - 2) };
  }

  *sInjuryOn(it) {
    const P = this.pl(it.act.s, it.act.a);
    this.say();
    if (P) { P.state = 'play'; P.stT = 0; P.limp = true; }
    yield* this.wait(0.6);
  }

  *sSub(it) {
    const a = it.act, s = a.s;
    const out = this.pl(s, a.b);
    this.say();
    const benchY = PL / 2 + (s === 0 ? -5 : 5);
    let slot = out ? { pos: out.pos, x: out.sx, y: out.sy } : null;
    if (!slot) {
      const sl = this.M.sides[s].on.find((x) => x && x.pid === a.a);
      slot = sl ? { pos: sl.pos, x: sl.x, y: sl.y } : { pos: 'CM', x: 50, y: 48 };
    }
    const pin = this.addPlayer(s, a.a, slot, -1.6, benchY);
    pin.hl = 3;
    this.fx.push({ type: 'sub', s, inN: pin.num, inName: pin.ln, outN: out ? out.num : '', outName: out ? out.ln : '', t: 0, dur: 2.8 });
    if (out) {
      if (this.ball.owner === out) { const b = this.ball; b.owner = null; b.vx = 0; b.vy = 0; }
      out.state = 'off'; out.offUntil = this.time + 4;
      out.goal = { x: -1.6, y: benchY }; out.gUrg = 0.35; out.hl = 2.5;
    }
    this.syncSlots();
    yield* this.wait(1.2);
  }

  // ---------------- seria rzutów karnych ----------------
  *setupShootout() {
    this.pkSetup = true;
    this.phase = 'setpiece';
    this.upSide = this.user;
    for (const s of [0, 1]) {
      const pl = this.active(s).filter((p) => !p.gk);
      pl.forEach((p, i) => {
        const sg = s === 0 ? -1 : 1;
        p.pkHome = { x: PW / 2 + sg * (2 + (i % 2) * 2.7), y: PL / 2 + (Math.floor(i / 2) - 2) * 2.7 };
        p.goal = p.pkHome; p.gUrg = 0.8; p.gSpd = 1.6;
      });
      const g = this.gkOf(s);
      if (g) { g.goal = { x: s === 0 ? 24 : 44, y: PL - 18 }; g.gUrg = 0.8; g.gSpd = 1.6; }
    }
    this.placeBall({ x: 34, y: PL - 11 });
    yield* this.settle(2.6);
  }

  *sPk(it) {
    const a = it.act;
    if (!this.pkSetup) yield* this.setupShootout();
    const s = a.s, o = 1 - s;
    const T = this.pl(s, a.a) || this.active(s).find((p) => !p.gk);
    const G = this.pl(o, a.g) || this.gkOf(o);
    const spot = { x: 34, y: PL - 11 };
    this.placeBall(spot);
    for (const q of [0, 1]) { const g = this.gkOf(q); if (g && g !== G) { g.goal = { x: q === 0 ? 24 : 44, y: PL - 18 }; g.gUrg = 0.8; g.gSpd = 1.5; } }
    if (G) { G.goal = { x: 34, y: PL - 0.4 }; G.gUrg = 0.8; G.gSpd = 1.6; G.hl = 2; }
    if (T) { T.goal = { x: 34 + rnd(-1, 1), y: PL - 13.5 }; T.gUrg = 1; T.gSpd = 2.2; T.hl = 3; }
    yield* this.settle(2.2);
    yield* this.wait(0.4);
    if (T) { T.goal = { x: spot.x, y: spot.y }; T.gUrg = 0.7; yield* this.until(() => D2(T, spot) < 0.9, 1); }
    const side = Math.random() < 0.5 ? -1 : 1;
    let tg;
    if (a.v === 'goal') tg = { x: 34 + side * rnd(1.2, 3.2), y: PL + 0.4, z: rnd(0.2, 1.9) };
    else if (a.v === 'save') tg = { x: 34 + side * rnd(1.4, 3.0), y: PL - 0.5, z: rnd(0.2, 1.4) };
    else tg = Math.random() < 0.5 ? { x: 34 + side * rnd(4, 5.5), y: PL + 2.5, z: rnd(0.2, 1) } : { x: 34 + rnd(-3, 3), y: PL + 2.5, z: rnd(3, 4) };
    if (T) { T.kickT = 0.3; T.goal = null; }
    this.sfx('kick', 1);
    const Tf = 0.45;
    this.slow(Tf + 0.5);
    this.fly(tg.x, tg.y, tg.z, Tf, 0.2, 'air', { trail: true });
    if (G) this.gkReact(G, tg, Tf, { res: a.v === 'goal' ? 'goal' : a.v === 'save' ? 'save' : 'missWide' });
    yield* this.until(() => !this.ball.fl, 0.8);
    this.say();
    this.trail.length = 0;
    if (a.v === 'goal') {
      this.fx.push({ type: 'net', y: PL, x: tg.x, t: 0, dur: 0.8 });
      this.sfx('crowd', { type: a.s === this.user ? 'goal' : 'groan', side: a.s, small: true });
    } else this.sfx('crowd', { type: 'ooh', side: a.s });
    if (a.v === 'save') { const b = this.ball; b.vx = side * 6; b.vy = -5; b.vz = 1; }
    yield* this.wait(1.1);
    if (T && T.pkHome) { T.goal = T.pkHome; T.gUrg = 0.6; }
  }
}

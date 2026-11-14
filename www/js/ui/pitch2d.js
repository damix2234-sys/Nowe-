// Widok meczu 2D: rysuje stan symulacji (silnik engine/sim.js) na canvasie, zawodników, piłkę, sędziów
// i efekty. Steruje tempem (czas boiska na sekundę), zwolnionym tempem przy strzałach, kamerą
// (całe boisko / przy piłce) i jakością (dynamiczna rozdzielczość na słabszych urządzeniach).
import { matchKits } from '../data/kits.js';
import { render, PW, PL } from './pitch2d-draw.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const FX_DUR = { goal: 2.8, net: 0.9, confetti: 1.6, card: 2.2, medic: 2.6, sub: 2.8, board: 2.6, offside: 2.2, post: 0.6, caption: 2.3 };

export class Pitch2D {
  /** canvas, element <canvas>, sim, mecz (LiveMatch), cb: { frame() } */
  constructor(canvas, sim, cb = {}) {
    this.cv = canvas;
    this.ctx = canvas ? canvas.getContext('2d') : null;
    this.sim = sim;
    this.cb = cb;
    this.kits = matchKits(sim.sides[0].nid, sim.sides[1].nid);
    sim.teams[0].kit = this.kits[0];
    sim.teams[1].kit = this.kits[1];
    this.fx = [];
    this.trail = [];
    this.rate = 2;
    this.slowF = 1;
    this.slowUntil = 0;
    this.running = false;
    this.raf = 0;
    this.last = 0;
    this.frames = 0;
    this.W = 0; this.H = 0; this.dpr = 1;
    this.cam = { mode: 'auto', k: 4, x: PW / 2, y: PL / 2 };
    if (canvas) {
      this.resize();
      if (typeof ResizeObserver !== 'undefined') { this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(canvas); }
    }
  }

  // dane dla renderera
  get teams() { return this.sim.teams; }
  get ball() { return this.sim.ball; }
  get ref() { return this.sim.ref; }
  get lines() { return this.sim.lines; }
  get user() { return this.sim.userSide; }
  get time() { return this.sim.t; }

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

  attach(canvas) {
    if (this.ro) this.ro.disconnect();
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.resize();
    if (typeof ResizeObserver !== 'undefined') { this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(canvas); }
  }

  toggleCam() {
    this.cam.mode = this.cam.mode === 'auto' ? (this.fits ? 'near' : 'full') : 'auto';
    this.draw();
    return this.cam.mode;
  }

  debugState() {
    const s = this.sim;
    return {
      frames: this.frames, time: Math.round(s.t * 10) / 10, clock: s.minLabel(), phase: s.phase, waiting: s.waiting,
      ball: { x: Math.round(s.ball.x), y: Math.round(s.ball.y) }, cam: this.cam.mode, fps: Math.round(this.fps || 0), dpr: this.dpr, qual: this.qual || 0,
    };
  }

  // ---------------- pętla ----------------
  frame(ts) {
    if (!this.running) return;
    const dt = this.last ? Math.min(0.2, (ts - this.last) / 1000) : 0.016;
    this.last = ts;
    this.step(dt);
    this.camera(dt);
    this.draw();
    this.frames++;
    this.quality(dt);
    if (this.cb.frame) this.cb.frame();
    if (this.running) this.raf = requestAnimationFrame((t) => this.frame(t));
  }

  /** Krok o dt sekund czasu rzeczywistego. */
  step(dt) {
    const s = this.sim;
    for (const f of this.fx) f.t += dt;
    this.fx = this.fx.filter((f) => f.t < f.dur);
    const dh = Math.max(dt, (dt * this.rate) / 2.5);
    for (const T of s.teams) for (const a of T.players) if (a.hl > 0) a.hl -= dh;
    if (!s.done && !s.waiting) {
      const slow = s.t < this.slowUntil ? this.slowF : 1;
      s.advance(dt * this.rate * slow);
    }
    this.drain();
    const b = s.ball;
    const sp = Math.hypot(b.vx, b.vy);
    if (!b.owner && sp > 16) { this.trail.push({ x: b.x, y: b.y, z: b.z }); if (this.trail.length > 14) this.trail.shift(); }
    else if (this.trail.length) this.trail.shift();
  }

  /** Efekty zgłoszone przez silnik (gol, kartka, zmiana, spalony…). */
  drain() {
    const s = this.sim;
    while (s.fxq.length) {
      const e = s.fxq.shift();
      if (e.type === 'shot') { this.slowF = this.rate > 3.5 ? 0.7 : 0.55; this.slowUntil = s.t + 0.9; continue; }
      const f = { ...e, t: 0, dur: FX_DUR[e.type] || 2 };
      if (e.type === 'card' || e.type === 'medic') f.p = s.teams[e.side].players.find((a) => a.pid === e.pid) || null;
      if (e.type === 'caption') this.fx = this.fx.filter((x) => x.type !== 'caption');
      if (e.type === 'goal') this.fx = this.fx.filter((x) => x.type !== 'goal');
      this.fx.push(f);
    }
  }

  draw() { if (this.ctx) render(this); }

  quality(dt) {
    this.fpsT = (this.fpsT || 0) + dt;
    this.fpsN = (this.fpsN || 0) + 1;
    if (this.fpsT < 2) return;
    this.fps = this.fpsN / this.fpsT;
    this.fpsT = 0; this.fpsN = 0;
    if (this.fps < 30 && (this.qual || 0) < 2) { this.qual = (this.qual || 0) + 1; this.resize(); }
  }

  resize() {
    const cv = this.cv;
    if (!cv) return;
    const r = cv.getBoundingClientRect();
    const w = Math.max(120, r.width), h = Math.max(120, r.height);
    const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2) * [1, 0.75, 0.55][this.qual || 0]);
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
    this.kTarget = kT;
    const f = snap ? 1 : Math.min(1, dt * 3.5);
    this.cam.k += (kT - this.cam.k) * f;
    const b = this.sim.ball;
    const tx = b.x + b.vx * 0.35, ty = b.y + b.vy * 0.35;
    const visH = this.H / this.cam.k, visW = this.W / this.cam.k;
    let cy = mode === 'full' ? PL / 2 : ty;
    const lo = -4.2 + visH / 2, hi = PL + 4.2 - visH / 2;
    cy = lo > hi ? PL / 2 : clamp(cy, lo, hi);
    let cx = PW / 2;
    if (visW < PW + 6) cx = clamp(tx, visW / 2 - 3, PW + 3 - visW / 2);
    this.cam.y = lerp(this.cam.y, cy, f);
    this.cam.x = lerp(this.cam.x, cx, f);
  }
}

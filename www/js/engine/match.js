// Silnik meczu – symulacja minuta po minucie z komentarzem.
import { clamp, gauss, pick, wpick, rint } from '../core/util.js';
import { familiarity, stateFactor, slotRating, POS_GROUP } from './player.js';
import { FORMATIONS, slotWeights, UNIT_BASE, defaultInstr, defaultSetPieces, autoLineup } from './tactics.js';
import { C } from '../data/commentary.js';
import { fullName } from '../data/names.js';

const R = Math.random;

// siła formacji z umiejętności (Odbiór, Krycie, Gra głową, Siła, Szybkość, Podania, Technika, Drybling,
// Opanowanie, Kondycja, Strzały, Dośrodkowania)
const av = (a, k) => a[k] ?? 50;
const unitDef = (a) => 0.22 * av(a, 'tk') + 0.16 * av(a, 'mk') + 0.14 * av(a, 'psn') + 0.1 * av(a, 'ant') + 0.1 * av(a, 'hd') + 0.08 * av(a, 'jmp') + 0.08 * av(a, 'st') + 0.06 * av(a, 'sp') + 0.06 * av(a, 'con');
const unitMid = (a) => 0.22 * av(a, 'ps') + 0.14 * av(a, 'vis') + 0.12 * av(a, 'dec') + 0.12 * av(a, 'te') + 0.1 * av(a, 'ft') + 0.08 * av(a, 'dr') + 0.08 * av(a, 'tmw') + 0.08 * av(a, 'wr') + 0.06 * av(a, 'en');
const unitAtt = (a) => 0.22 * av(a, 'sh') + 0.12 * av(a, 'otb') + 0.1 * av(a, 'te') + 0.1 * av(a, 'dr') + 0.1 * av(a, 'acc') + 0.08 * av(a, 'sp') + 0.08 * av(a, 'cm') + 0.08 * av(a, 'cr') + 0.06 * av(a, 'ls') + 0.06 * av(a, 'hd');
const gkQ = (a) => 0.4 * av(a, 'gk') + 0.18 * av(a, 'han') + 0.14 * av(a, 'ovo') + 0.14 * av(a, 'aer') + 0.14 * av(a, 'psn');

const POS_INVOLVE = { GK: 0, CB: 0.8, LB: 2.2, RB: 2.2, DM: 2, CM: 4, AM: 6.5, LW: 7, RW: 7, CF: 8 };
const SHOOT_W = { GK: 0, CB: 0.5, LB: 0.7, RB: 0.7, DM: 1.3, CM: 2.8, AM: 5.5, LW: 5.5, RW: 5.5, CF: 10 };
const BIG_W = { GK: 0, CB: 0.2, LB: 0.5, RB: 0.5, DM: 0.5, CM: 1.5, AM: 4, LW: 5, RW: 5, CF: 10 };
const PASS_W = { GK: 0.05, CB: 1, LB: 3, RB: 3, DM: 2.5, CM: 4, AM: 6, LW: 5, RW: 5, CF: 2.5 };
const DEF_W = { GK: 0, CB: 6, LB: 4, RB: 4, DM: 5, CM: 3, AM: 1.2, LW: 1.2, RW: 1.2, CF: 0.5 };
const FOUL_W = { GK: 0.2, CB: 5, LB: 4, RB: 4, DM: 5, CM: 3, AM: 1.5, LW: 1.5, RW: 1.5, CF: 1 };
const DRAIN_POS = { GK: 0.25, CB: 0.82, LB: 1.1, RB: 1.1, DM: 1.05, CM: 1.1, AM: 1.0, LW: 1.05, RW: 1.05, CF: 0.95 };
const STYLE_ATT = [0.84, 0.92, 1, 1.07, 1.13];
const STYLE_DEF = [1.13, 1.06, 1, 0.95, 0.89];
const STYLE_TEMPO = [0.82, 0.9, 1, 1.08, 1.16];
const STYLE_DRAIN = [0.92, 0.96, 1, 1.04, 1.08];
const PRESS_MID = [0.96, 1, 1.05];
const PRESS_TEMPO = [0.95, 1, 1.05];
const PRESS_DRAIN = [0.85, 1, 1.25];
const SH_INSTR = [0.25, 1, 1.8];
const XG = { long: 0.033, box: 0.115, big: 0.36, head: 0.1, fk: 0.065, pen: 0.76 };
const ON_T = { long: 0.3, box: 0.42, big: 0.62, head: 0.36, fk: 0.33, pen: 0.86 };

const fmt = (t, v) => t.replace(/\{(\w+)\}/g, (_, k) => (v[k] ?? ''));
const L = (key, v = {}) => fmt(pick(C[key]), v);
const nm = (p) => fullName(p);
const cap = (s) => s[0].toUpperCase() + s.slice(1);
export const stamF = (st) => 0.78 + 0.22 * Math.pow(Math.max(0, st) / 100, 0.8);

const WIDE = new Set(['LW', 'RW', 'LB', 'RB']);
const DEEP = new Set(['GK', 'CB', 'LB', 'RB', 'DM']);
// warianty efektów strzału zależne od rodzaju uderzenia
const SAVE_W = {
  long: { catch: 0.55, parry: 0.3, dive: 0.15 }, box: { catch: 0.3, parry: 0.45, dive: 0.25 }, big: { catch: 0.15, parry: 0.4, dive: 0.45 },
  head: { catch: 0.45, parry: 0.35, dive: 0.2 }, fk: { catch: 0.25, parry: 0.25, dive: 0.5 }, pen: { catch: 0.2, parry: 0.4, dive: 0.4 },
};
const HIGH_P = { long: 0.45, box: 0.35, big: 0.45, head: 0.5, fk: 0.6, pen: 0.4 };
const QUIET_W = { Mid: 4, Own: 2, Switch: 1.2, Fight: 1, Crowd: 0.8 };

/**
 * Narracja akcji: linie komentarza i odpowiadające im akcje (1:1) dla podglądu 2D.
 * Akcja: { t: rodzaj, s: strona, a/b/d/g: zawodnicy, v: wariant, kind, res ... }.
 */
export class Story {
  constructor() { this.lines = []; this.acts = []; }
  say(key, v, act) { this.lines.push(L(key, v || {})); const a = act || { t: key }; this.acts.push(a); return a; }
  raw(text, act) { this.lines.push(text); this.acts.push(act); return act; }
  get n() { return this.lines.length; }
}

export class Match {
  /**
   * spec: { nid, name, players: {pid: player}, lineup: [11 pid], bench: [pid], tac, instr, sp, train, home, ai }
   * opts: { ko, neutral, noET, autoSubs: [bool,bool] }
   */
  constructor(home, away, opts = {}) {
    this.opts = { ko: false, neutral: false, ...opts };
    this.clock = { phase: 'PRE', min: 0, add: 0 };
    this.st1 = rint(1, 4);
    this.st2 = rint(2, 6);
    this.events = [];
    this.key = [];
    this.done = false;
    this.pens = null;
    this.mom = 0;
    this.ball = 0.5;
    this.poss = 0;
    this.pending = [];
    this.sides = [this.initSide(home, 0), this.initSide(away, 1)];
    this.refresh();
  }

  // ---------------- inicjalizacja ----------------
  initSide(spec, idx) {
    const f = FORMATIONS[spec.tac.f];
    const S = {
      idx, spec, nid: spec.nid, name: spec.name,
      tac: { ...spec.tac },
      on: spec.lineup.map((pid, i) => (pid != null && spec.players[pid] ? this.mkSlot(spec, pid, f[i]) : null)),
      bench: (spec.bench || []).filter((pid) => spec.players[pid]),
      subsLeft: spec.maxSubs ?? 5,
      st: {}, yc: {}, off: new Set(), injured: new Set(), played: new Set(),
      goals: 0, shots: 0, sot: 0, corners: 0, fouls: 0, offsides: 0, yel: 0, red: 0, poss: 0, xg: 0, saves: 0,
      ps: {}, instr: { ...(spec.instr || {}) }, sp: { ...(spec.sp || {}) }, train: spec.train || {},
      home: !!spec.home, units: null, mods: null, adj: {},
    };
    for (const slot of S.on) {
      if (!slot) continue;
      S.st[slot.pid] = slot.p.cond ?? 95;
      S.played.add(slot.pid);
      this.pstat(S, slot.pid, slot.pos).on = 0;
    }
    return S;
  }

  mkSlot(spec, pid, fd) {
    return { pid, p: spec.players[pid], pos: fd[0], x: fd[1], y: fd[2], w: slotWeights(fd[2]) };
  }

  pstat(S, pid, pos) {
    if (!S.ps[pid]) S.ps[pid] = { on: null, off: null, pos: pos || null, g: 0, a: 0, sh: 0, sot: 0, sv: 0, tk: 0, kp: 0, fl: 0, yc: 0, rc: 0, inj: false, pm: 0, og: 0 };
    return S.ps[pid];
  }

  ins(S, slot) {
    if (!S.instr[slot.pid]) S.instr[slot.pid] = defaultInstr(slot.p, slot.pos);
    return S.instr[slot.pid];
  }

  onSlots(S) { return S.on.filter(Boolean); }
  slotOf(S, pid) { return S.on.find((s) => s && s.pid === pid) || null; }
  gkSlot(S) { return S.on.find((s) => s && s.pos === 'GK') || null; }
  lvl(S, k) { return (S.train[k] || 0) / 100; }

  pickSlot(S, wf, excl = null) {
    const c = this.onSlots(S).filter((s) => s.pid !== excl);
    if (!c.length) return this.onSlots(S)[0];
    return wpick(c, wf);
  }

  pickShooter(S, kind, excl = null) {
    const W = kind === 'big' ? BIG_W : SHOOT_W;
    return this.pickSlot(S, (s) => {
      const i = this.ins(S, s);
      return W[s.pos] * Math.pow(Math.max(10, kind === 'big' ? (s.p.a.sh + s.p.a.sp) / 2 : s.p.a.sh) / 60, 2) * SH_INSTR[i.sh];
    }, excl);
  }

  shootPropensity(S) {
    let s = 0, n = 0;
    for (const sl of this.onSlots(S)) {
      if (sl.pos === 'GK') continue;
      s += this.ins(S, sl).sh; n++;
    }
    return n ? s / n : 1;
  }

  // ---------------- siła formacji ----------------
  refresh() {
    for (const S of this.sides) { this.computeUnits(S); this.computeMods(S); }
  }

  computeUnits(S) {
    let def = 0, mid = 0, att = 0, gk = 8;
    for (const s of this.onSlots(S)) {
      const p = s.p;
      const f = familiarity(p, s.pos) * stateFactor(p) * stamF(S.st[s.pid]);
      if (s.pos === 'GK') { gk = gkQ(p.a) * f; continue; }
      def += s.w.d * unitDef(p.a) * f;
      mid += s.w.m * unitMid(p.a) * f;
      att += s.w.a * unitAtt(p.a) * f;
    }
    S.units = { gk, def: def / UNIT_BASE.d, mid: mid / UNIT_BASE.m, att: att / UNIT_BASE.a };
  }

  computeMods(S) {
    const t = S.tac;
    let all = 1;
    if (!this.opts.neutral) all *= S.home ? 1.035 : 0.99 + 0.01 * this.lvl(S, 'ment');
    else if (S.spec.host) all *= 1.03;
    const cap = this.slotOf(S, S.sp.cap);
    if (cap) all *= 1 + ((cap.p.a.ld - 50) / 50) * 0.015;
    let longF = 0, shortF = 0, hardF = 0, softF = 0, n = 0;
    for (const s of this.onSlots(S)) {
      if (s.pos === 'GK') continue;
      const i = this.ins(S, s);
      n++;
      if (i.ps === 2) longF++;
      if (i.ps === 0) shortF++;
      if (i.tk === 2) hardF++;
      if (i.tk === 0) softF++;
    }
    n = n || 1;
    longF /= n; shortF /= n; hardF /= n; softF /= n;
    const men = this.onSlots(S).length;
    const short = men < 11 ? 1 - (11 - men) * 0.035 : 1;
    S.mods = {
      att: all * short * STYLE_ATT[t.style] * (1 + 0.04 * this.lvl(S, 'off')),
      def: all * short * STYLE_DEF[t.style] * (1 + 0.04 * this.lvl(S, 'def')) * (1 + 0.02 * hardF),
      mid: all * short * PRESS_MID[t.press] * (1 + 0.04 * this.lvl(S, 'poss')) * (1 + 0.03 * shortF),
      tempo: STYLE_TEMPO[t.style] * PRESS_TEMPO[t.press] * (1 + 0.05 * longF),
      finish: 1 + 0.03 * this.lvl(S, 'ment'),
      sp: 1 + 0.3 * this.lvl(S, 'sp'),
      foul: 1 + 0.8 * hardF - 0.4 * softF,
      longF, shortF, hardF,
    };
  }

  // ---------------- zegar ----------------
  minLabel() {
    const c = this.clock;
    const base = c.phase === '1H' ? 45 : c.phase === '2H' ? 90 : c.phase === 'ET1' ? 105 : c.phase === 'ET2' ? 120 : null;
    if (base && c.add > 0) return `${base}+${c.add}'`;
    return `${c.min}'`;
  }

  /** lines: Story albo tablica tekstów (akcje uzupełniane wtedy rodzajem zdarzenia). */
  ev(kind, side, lines, extra = {}) {
    let acts = extra.acts;
    if (lines instanceof Story) { acts = lines.acts; lines = lines.lines; }
    const e = { min: this.minLabel(), m: this.clock.min, side, kind, lines, score: [this.sides[0].goals, this.sides[1].goals], ...extra, acts: acts || [] };
    while (e.acts.length < e.lines.length) e.acts.push({ t: 'info' });
    this.events.push(e);
    // zdarzenia odłożone w trakcie akcji (np. zmiana bramkarza po czerwonej kartce) idą po niej
    if (this.pending.length && !this._flushing) {
      this._flushing = true;
      for (const a of this.pending.splice(0)) this.ev(...a);
      this._flushing = false;
    }
    return e;
  }

  one(key, v, act) { const st = new Story(); st.say(key, v, act); return st; }

  step() {
    if (this.done) return [];
    const start = this.events.length;
    const c = this.clock;
    switch (c.phase) {
      case 'PRE':
        c.phase = '1H'; c.min = 0;
        this.ev('whistle', null, this.one('kickoff', { T: this.sides[0].name }, { t: 'kickoff', s: 0, half: 1 }));
        break;
      case '1H':
        if (c.min < 45) { c.min++; this.playMinute(); }
        else if (c.add < this.st1) { if (c.add === 0) this.ev('info', null, this.one('stoppage', { N: this.st1 }, { t: 'stoppage', n: this.st1 })); c.add++; this.playMinute(); }
        else { c.phase = 'HT'; c.add = 0; this.ev('whistle', null, this.one('halftime', {}, { t: 'halftime' }), { ht: true }); }
        break;
      case 'HT':
        c.phase = '2H'; c.min = 45; c.add = 0;
        for (const S of this.sides) for (const s of this.onSlots(S)) S.st[s.pid] = Math.min(100, S.st[s.pid] + 4);
        this.refresh();
        this.ev('whistle', null, this.one('secondHalf', {}, { t: 'kickoff', s: 1, half: 2 }));
        break;
      case '2H':
        if (c.min < 90) { c.min++; this.playMinute(); }
        else if (c.add < this.st2) { if (c.add === 0) this.ev('info', null, this.one('stoppage', { N: this.st2 }, { t: 'stoppage', n: this.st2 })); c.add++; this.playMinute(); }
        else this.endRegulation();
        break;
      case 'ETP':
        c.phase = 'ET1'; c.add = 0;
        this.ev('whistle', null, this.one('etKick1', {}, { t: 'kickoff', s: 0, half: 3 }));
        break;
      case 'ET1':
        if (c.min < 105) { c.min++; this.playMinute(); }
        else { c.phase = 'ETB'; this.ev('whistle', null, this.one('etHalf', {}, { t: 'halftime', et: true }), { ht: true }); }
        break;
      case 'ETB':
        c.phase = 'ET2';
        this.ev('whistle', null, this.one('etKick2', {}, { t: 'kickoff', s: 1, half: 4 }));
        break;
      case 'ET2':
        if (c.min < 120) { c.min++; this.playMinute(); }
        else this.endET();
        break;
      case 'PEN':
        this.shootout();
        this.finish();
        break;
    }
    return this.events.slice(start);
  }

  endRegulation() {
    const [h, a] = this.sides;
    const c = this.clock;
    c.add = 0;
    if (this.opts.ko && h.goals === a.goals) {
      if (this.opts.noET) { c.phase = 'PEN'; this.ev('whistle', null, this.one('pensStart', {}, { t: 'pensStart' }), { ht: true }); }
      else { c.phase = 'ETP'; this.et = true; this.ev('whistle', null, this.one('etStart', {}, { t: 'etStart' }), { ht: true }); }
    } else this.finish();
  }

  endET() {
    const [h, a] = this.sides;
    if (h.goals === a.goals) { this.clock.phase = 'PEN'; this.ev('whistle', null, this.one('pensStart', {}, { t: 'pensStart' }), { ht: true }); }
    else this.finish();
  }

  simulate() {
    let guard = 0;
    while (!this.done && guard++ < 1000) this.step();
    return this.result();
  }

  // ---------------- minuta gry ----------------
  playMinute() {
    const [H, A] = this.sides;
    for (const S of this.sides) this.updateStamina(S);
    this.refresh();
    const mh = Math.max(1, H.units.mid * H.mods.mid), ma = Math.max(1, A.units.mid * A.mods.mid);
    let pH = Math.pow(mh, 2.2) / (Math.pow(mh, 2.2) + Math.pow(ma, 2.2));
    pH = clamp(pH + (A.tac.style - H.tac.style) * -0.012, 0.2, 0.8);
    const ai = R() < pH ? 0 : 1;
    const att = this.sides[ai];
    att.poss++;
    this.poss = ai;
    this.mom = this.mom * 0.88 + (ai === 0 ? 0.12 : -0.12);
    let wasting = false;
    for (const S of this.sides) {
      const lead = S.goals > this.sides[1 - S.idx].goals;
      if (S.tac.tw === 2 || (S.tac.tw === 1 && lead && this.clock.min >= 60)) wasting = true;
    }
    let pMove = 0.4 * att.mods.tempo * (wasting ? 0.85 : 1);
    if (R() < pMove) {
      this.move(ai);
    } else {
      this.ball += (0.5 - this.ball) * 0.3;
      if (R() < 0.035) {
        const qv = wpick(Object.keys(QUIET_W), (k) => QUIET_W[k]);
        this.ev('quiet', null, this.one('quiet' + qv, { T: att.name }, { t: 'quiet', s: ai, v: qv.toLowerCase() }));
      } else if (Math.abs(this.mom) > 0.55 && R() < 0.05) {
        const ps = this.mom > 0 ? 0 : 1;
        this.ev('quiet', ps, this.one('pressure', { T: this.sides[ps].name }, { t: 'pressure', s: ps }));
      }
    }
    if (wasting && R() < 0.02) {
      const S = this.sides.find((s) => s.tac.tw === 2 || (s.tac.tw === 1 && s.goals > this.sides[1 - s.idx].goals));
      if (S) {
        this.ev('quiet', S.idx, this.one('timeWaste', { T: S.name }, { t: 'timeWaste', s: S.idx }));
        if (R() < 0.12) { const g = this.gkSlot(S); if (g) this.card(S, g, 1, null, true); }
      }
    }
    // faule w środku pola (drużyna bez piłki)
    const dS = this.sides[1 - ai];
    if (R() < 0.2 * dS.mods.foul && this.onSlots(dS).length) {
      const f = this.pickFouler(dS);
      dS.fouls++;
      this.pstat(dS, f.pid).fl++;
      const st = new Story();
      st.say('foul', { D: nm(f.p) }, { t: 'foul', s: ai, d: f.pid, zone: 'mid' });
      this.card(dS, f, 0, st);
      if (st.n > 1) this.ev('card', dS.idx, st);
      else if (R() < 0.12) this.ev('quiet', dS.idx, st);
    }
    if (this.pending.length) for (const a of this.pending.splice(0)) this.ev(...a);
    for (const S of this.sides) this.checkInjuries(S);
    for (const S of this.sides) {
      if (S.spec.ai || (this.opts.autoSubs && this.opts.autoSubs[S.idx])) this.aiThink(S);
    }
  }

  updateStamina(S) {
    const t = S.tac;
    const cond = 1 - 0.25 * this.lvl(S, 'cond');
    for (const s of this.onSlots(S)) {
      const drain = 0.33 * PRESS_DRAIN[t.press] * STYLE_DRAIN[t.style] * DRAIN_POS[s.pos] * cond * (1 + Math.max(0, s.p.age - 29) * 0.02) * (1.3 - 0.6 * av(s.p.a, 'en') / 100) * (0.9 + R() * 0.2);
      S.st[s.pid] = Math.max(5, S.st[s.pid] - drain);
    }
  }

  // ---------------- akcja ofensywna ----------------
  move(ai, opt = {}) {
    const A = this.sides[ai], D = this.sides[1 - ai];
    if (!this.onSlots(A).length || !this.onSlots(D).length) return;
    const st = new Story();
    const counter = !!opt.counter;
    const r = (A.units.att * A.mods.att) / Math.max(1, D.units.def * D.mods.def);
    const q = clamp(Math.pow(r, 1.25), 0.4, 2.4);
    const carrier = this.pickSlot(A, (s) => POS_INVOLVE[s.pos] * (0.5 + s.p.a.te / 100));
    const ci = this.ins(A, carrier);
    const trap = D.tac.trap;
    const w = {
      lost: (0.42 / q) * (counter ? 0.6 : 1) * (1 + 0.06 * A.mods.longF) * [0.95, 1, 1.06][D.tac.press] * (ci.dr === 2 ? 1.12 : ci.dr === 0 ? 0.95 : 1),
      long: 0.12 * (0.6 + 0.4 * this.shootPropensity(A)),
      chance: 0.17 * q * (counter ? 1.3 : 1),
      big: 0.036 * Math.pow(q, 1.3) * (1 + 0.35 * trap) * (1 + 0.15 * A.mods.longF) * (ci.dr === 2 ? 1.15 : 1) * (counter ? 2.2 : 1),
      foulFar: 0.05 * D.mods.foul,
      foulNear: 0.03 * Math.pow(q, 0.5) * D.mods.foul * (ci.dr === 2 ? 1.2 : 1),
      pen: 0.0072 * q * D.mods.foul * (ci.dr === 2 ? 1.25 : 1),
      corner: 0.15 * Math.pow(q, 0.6),
      offside: 0.022 + 0.05 * trap,
      dive: ci.dv ? 0.012 * ci.dv : 0,
    };
    const out = wpick(Object.keys(w), (k) => w[k]);
    const v = { A: nm(carrier.p), T: A.name };
    this.ball = ai === 0 ? 0.78 : 0.22;
    if (counter) st.say('counter', v, { t: 'counter', s: ai, a: carrier.pid });
    else if (out !== 'lost' || R() < 0.5) {
      if (R() < 0.55) {
        if (ci.dr === 2 && R() < 0.4) st.say('buildDribble', v, { t: 'dribble', s: ai, a: carrier.pid });
        else {
          const b = this.pickSlot(A, (s) => PASS_W[s.pos], carrier.pid);
          const bv = this.buildVariant(A, carrier, ci, b);
          st.say('build' + cap(bv), { ...v, B: nm(b.p) }, { t: 'build', s: ai, a: carrier.pid, b: bv === 'long' || bv === 'pass' || bv === 'one2' ? b.pid : null, v: bv });
        }
      }
    }
    let kind = 'play';
    let res = null;
    switch (out) {
      case 'lost': {
        const d = this.pickSlot(D, (s) => DEF_W[s.pos] * (s.p.a.tk / 60) * [0.9, 1, 1.1][this.ins(D, s).tk]);
        this.pstat(D, d.pid).tk++;
        if (st.n || R() < 0.3) {
          if (ci.dr === 2 && R() < 0.5) st.say('lostDribble', { A: nm(carrier.p), D: nm(d.p) }, { t: 'lost', s: ai, a: carrier.pid, d: d.pid, v: 'dribble' });
          else {
            const dtk = this.ins(D, d).tk;
            const lw = { tackle: 1.2, slide: dtk === 2 ? 1 : 0.5, clear: POS_GROUP[d.pos] === 'D' ? 1 : 0.4, intercept: 1.1, quicker: 0.6 };
            const lv = wpick(Object.keys(lw), (k) => lw[k]);
            st.say('lost' + cap(lv), { D: nm(d.p) }, { t: 'lost', s: ai, a: carrier.pid, d: d.pid, v: lv });
          }
        }
        break;
      }
      case 'long': {
        const s = this.pickShooter(A, 'long');
        const ast = R() < 0.3 ? this.pickSlot(A, (x) => PASS_W[x.pos], s.pid) : null;
        const act = st.say('longShot', { A: nm(s.p) }, { t: 'shot', kind: 'long', s: ai, a: s.pid, b: ast ? ast.pid : null });
        res = this.shot(A, D, s, 'long', ast, st, false, act);
        break;
      }
      case 'chance': {
        const s = this.pickShooter(A, 'box');
        const b = this.pickSlot(A, (x) => PASS_W[x.pos] * ((x.p.a.ps + x.p.a.cr) / 120), s.pid);
        const solo = R() < 0.3;
        let sv;
        if (solo) sv = (s.pos === 'LW' || s.pos === 'RW') && R() < 0.35 ? 'angle' : (s.pos === 'CF' || s.pos === 'AM') && R() < 0.3 ? 'turn' : 'solo';
        else sv = WIDE.has(b.pos) ? (R() < 0.6 ? 'cross' : 'cut') : (R() < 0.8 ? 'pass' : 'cut');
        const act = st.say('boxShot' + cap(sv), { A: nm(s.p), B: nm(b.p) }, { t: 'shot', kind: 'box', s: ai, a: s.pid, b: solo ? null : b.pid, v: sv });
        if (!solo) this.pstat(A, b.pid).kp++;
        res = this.shot(A, D, s, 'box', solo ? null : b, st, false, act);
        break;
      }
      case 'big': {
        const s = this.pickShooter(A, 'big');
        const b = R() < 0.7 ? this.pickSlot(A, (x) => PASS_W[x.pos] * (x.p.a.ps / 60), s.pid) : null;
        if (b) this.pstat(A, b.pid).kp++;
        const act = st.say(b && R() < 0.5 ? 'bigChancePass' : 'bigChance', { A: nm(s.p), B: b ? nm(b.p) : '' }, { t: 'shot', kind: 'big', s: ai, a: s.pid, b: b ? b.pid : null });
        res = this.shot(A, D, s, 'big', b, st, false, act);
        break;
      }
      case 'foulFar': {
        const f = this.pickFouler(D);
        st.say('foul', { D: nm(f.p) }, { t: 'foul', s: ai, d: f.pid, zone: 'far' });
        this.foulBy(D, f, 1, st);
        res = this.freeKickFar(A, D, st);
        break;
      }
      case 'foulNear': {
        const f = this.pickFouler(D);
        st.say('foul', { D: nm(f.p) }, { t: 'foul', s: ai, d: f.pid, zone: 'near' });
        this.foulBy(D, f, 1, st);
        res = this.freeKickNear(A, D, st);
        break;
      }
      case 'pen': {
        const f = this.pickFouler(D);
        st.say('penalty', { D: nm(f.p) }, { t: 'penalty', s: ai, d: f.pid });
        this.foulBy(D, f, 2, st);
        res = this.penaltyKick(A, D, st);
        kind = 'pen';
        break;
      }
      case 'corner':
        res = this.cornerSeq(A, D, st, 0);
        break;
      case 'offside': {
        const s = this.pickShooter(A, 'big');
        A.offsides++;
        st.say('offside', { A: nm(s.p) }, { t: 'offside', s: ai, a: s.pid });
        break;
      }
      case 'dive': {
        st.say('dive', v, { t: 'dive', s: ai, a: carrier.pid });
        const x = R();
        if (x < 0.42) {
          st.say('diveFoul', {}, { t: 'diveFoul', s: ai });
          const f = this.pickFouler(D);
          this.foulBy(D, f, 1, st);
          res = R() < 0.25 ? this.penaltyKick(A, D, st) : this.freeKickNear(A, D, st);
        } else if (x < 0.66) {
          st.say('diveYellow', v, { t: 'diveYellow', s: ai, a: carrier.pid });
          this.card(A, carrier, 1, st, true);
        } else st.say('diveNothing', {}, { t: 'diveNothing', s: ai });
        break;
      }
    }
    if (res && res.goal) kind = 'goal';
    else if (res && res.shot) kind = kind === 'pen' ? 'pen' : 'chance';
    if (st.n) this.ev(kind, ai, st, res && res.goal ? { pid: res.pid, pid2: res.ast, og: res.og } : {});
    if (out === 'lost' && !counter) {
      const pc = 0.045 * (1 + 0.25 * (A.tac.style - 2));
      if (R() < pc) this.move(1 - ai, { counter: true });
    }
  }

  /** Wariant rozegrania zgodny z rolami zawodników (skrzydło tylko dla bocznych, długa piłka od głębiej grających). */
  buildVariant(A, carrier, ci, b) {
    const w = {
      carry: 1, receive: 0.8, pass: 1.4,
      long: (DEEP.has(b.pos) ? 1.1 : 0.25) * (1 + 2 * A.mods.longF),
      wing: WIDE.has(carrier.pos) ? 2.2 : 0,
      around: carrier.pos === 'AM' || carrier.pos === 'CF' || carrier.pos === 'CM' ? 0.8 : 0.15,
      beat: ci.dr === 2 ? 1.2 : 0.4,
      one2: 0.5 * (1 + 2 * A.mods.shortF),
    };
    return wpick(Object.keys(w), (k) => w[k]);
  }

  pickFouler(D) {
    return this.pickSlot(D, (s) => FOUL_W[s.pos] * [0.6, 1, 1.7][this.ins(D, s).tk]);
  }

  foulBy(D, slot, sev, st) {
    D.fouls++;
    this.pstat(D, slot.pid).fl++;
    this.card(D, slot, sev, st);
  }

  card(S, slot, sev, st, forced = false) {
    const tk = this.ins(S, slot).tk;
    const booked = S.yc[slot.pid] ? 0.55 : 1;
    const pY = forced ? 1 : (sev === 0 ? [0.07, 0.13, 0.21][tk] : [0.08, 0.15, 0.25][tk] * (sev === 2 ? 2.2 : 1)) * booked;
    const pR = forced ? 0 : sev === 0 ? [0.0007, 0.0014, 0.004][tk] : [0.002, 0.004, 0.01][tk] * (sev === 2 ? 3 : 1);
    const x = R();
    const out = st || new Story();
    const v = { D: nm(slot.p) };
    if (x < pR) {
      out.say('red', v, { t: 'red', s: S.idx, a: slot.pid });
      this.sendOff(S, slot);
    } else if (x < pR + pY) {
      S.yc[slot.pid] = (S.yc[slot.pid] || 0) + 1;
      S.yel++;
      this.pstat(S, slot.pid).yc++;
      if (S.yc[slot.pid] >= 2) {
        out.say('secondYellow', v, { t: 'secondYellow', s: S.idx, a: slot.pid });
        this.sendOff(S, slot);
      } else {
        out.say('yellow', v, { t: 'yellow', s: S.idx, a: slot.pid });
        this.key.push({ min: this.minLabel(), side: S.idx, type: 'yc', pid: slot.pid });
      }
    }
    if (!st && out.n) this.ev('card', S.idx, out);
  }

  sendOff(S, slot) {
    S.red++;
    const ps = this.pstat(S, slot.pid);
    ps.rc = 1;
    ps.off = this.clock.min;
    S.off.add(slot.pid);
    const i = S.on.indexOf(slot);
    if (i >= 0) S.on[i] = null;
    this.key.push({ min: this.minLabel(), side: S.idx, type: 'rc', pid: slot.pid });
    if (slot.pos === 'GK') this.fixGoalkeeper(S, i, slot);
    this.refresh();
  }

  fixGoalkeeper(S, gkIndex, oldSlot) {
    // rezerwowy bramkarz za zawodnika z pola, inaczej obrońca w bramce
    const benchGK = S.bench.find((pid) => S.spec.players[pid].pos === 'GK');
    const outfield = this.onSlots(S).filter((s) => s.pos !== 'GK');
    if (benchGK && S.subsLeft > 0 && outfield.length) {
      const victim = outfield.slice().sort((a, b) => b.y - a.y)[0];
      const vi = S.on.indexOf(victim);
      this.pstat(S, victim.pid).off = this.clock.min;
      S.on[vi] = null;
      S.on[gkIndex] = { ...oldSlot, pid: benchGK, p: S.spec.players[benchGK] };
      S.bench = S.bench.filter((x) => x !== benchGK);
      S.subsLeft--;
      S.st[benchGK] = S.spec.players[benchGK].cond ?? 95;
      S.played.add(benchGK);
      this.pstat(S, benchGK, 'GK').on = this.clock.min;
      // zmiana pokazywana po zdarzeniu z czerwoną kartką
      this.pending.push(['sub', S.idx, this.one('sub', { T: S.name, OUT: nm(victim.p), IN: nm(S.spec.players[benchGK]) }, { t: 'sub', s: S.idx, a: benchGK, b: victim.pid }), { pid: benchGK, pid2: victim.pid }]);
      this.key.push({ min: this.minLabel(), side: S.idx, type: 'sub', pid: benchGK, pid2: victim.pid });
    } else if (outfield.length) {
      const d = outfield.slice().sort((a, b) => a.y - b.y)[0];
      const di = S.on.indexOf(d);
      S.on[di] = null;
      S.on[gkIndex] = { ...oldSlot, pid: d.pid, p: d.p };
    }
  }

  // ---------------- strzał ----------------
  /** act – akcja przygotowania strzału (ostatnia linia narracji); dostaje wynik (res) i bramkarza (g). */
  shot(A, D, s, type, ast, st, setPiece = false, act = null) {
    const p = s.p, a = p.a;
    const f = familiarity(p, s.pos) * stateFactor(p) * stamF(A.st[s.pid]);
    const sq = (type === 'head' ? 0.7 * a.hd + 0.3 * a.st : 0.5 * a.sh + 0.3 * a.te + 0.2 * av(a, 'cm')) * f;
    const gk = this.gkSlot(D);
    const gq = gk ? gkQ(gk.p.a) * familiarity(gk.p, 'GK') * stateFactor(gk.p) * stamF(D.st[gk.pid]) : 8;
    let xg = XG[type];
    if (type === 'fk' || setPiece) xg *= A.mods.sp;
    const ratio = clamp(Math.pow(Math.max(5, sq) / Math.max(5, gq), type === 'pen' ? 0.45 : 0.85), 0.4, 1.9);
    const pg = clamp(xg * ratio * A.mods.finish, 0.004, 0.93);
    const pon = Math.max(ON_T[type] * (0.85 + (sq - 60) / 220), pg + 0.04);
    A.shots++;
    A.xg += pg;
    const ps = this.pstat(A, s.pid);
    ps.sh++;
    const ga = act || {};
    ga.g = gk ? gk.pid : null;
    const base = { s: A.idx, a: s.pid, g: ga.g, kind: type };
    const x = R();
    if (x < pg) {
      // gol (rzadko samobój)
      let og = false, scorer = s;
      if ((type === 'box' || type === 'head') && R() < 0.02) {
        og = true;
        scorer = this.pickSlot(D, (d) => DEF_W[d.pos]);
      }
      A.goals++;
      A.sot++;
      this.ball = A.idx === 0 ? 1 : 0;
      if (og) {
        ga.res = 'og';
        ga.d = scorer.pid;
        this.pstat(D, scorer.pid).og++;
        st.say('ownGoal', { D: nm(scorer.p) }, { ...base, t: 'ownGoal', d: scorer.pid });
      } else {
        ga.res = 'goal';
        ps.g++; ps.sot++;
        const key = type === 'pen' ? 'penGoal' : type === 'long' || type === 'fk' ? 'goalLong' : type === 'head' ? 'goalHeader' : 'goal';
        st.say(key, { A: nm(p) }, { ...base, t: 'goal' });
        if (ast && ast.pid !== s.pid) {
          this.pstat(A, ast.pid).a++;
          st.say('assist', { B: nm(ast.p) }, { t: 'assist', s: A.idx, b: ast.pid });
        }
      }
      const rec = { min: this.minLabel(), side: A.idx, type: 'goal', pid: scorer.pid, pid2: !og && ast && ast.pid !== s.pid ? ast.pid : null, og, pen: type === 'pen' };
      this.key.push(rec);
      return { goal: true, shot: true, pid: scorer.pid, ast: rec.pid2, og };
    }
    if (x < pon) {
      A.sot++;
      ps.sot++;
      D.saves++;
      if (gk) this.pstat(D, gk.pid).sv++;
      const gv = { G: gk ? nm(gk.p) : '?', A: nm(p) };
      if (type === 'pen') {
        ga.res = 'penSave';
        st.say('penSave', gv, { ...base, t: 'penSave' });
        ps.pm++;
      } else if (type !== 'fk' && R() < 0.35 && !setPiece) {
        ga.res = 'saveCorner';
        st.say('saveCorner', gv, { ...base, t: 'saveCorner' });
        const r2 = this.cornerSeq(A, D, st, 1);
        if (r2 && r2.goal) return r2;
      } else {
        const sw = SAVE_W[type] || SAVE_W.box;
        const sv = wpick(Object.keys(sw), (k) => sw[k]);
        ga.res = 'save';
        ga.sv = sv;
        st.say('save' + cap(sv), gv, { ...base, t: 'save', v: sv });
      }
      return { goal: false, shot: true };
    }
    if (type === 'pen') {
      const mv = R() < 0.6 ? 'wide' : 'high';
      ga.res = 'penMiss';
      ga.mv = mv;
      st.say(mv === 'wide' ? 'penMissWide' : 'penMissHigh', { A: nm(p) }, { ...base, t: 'penMiss', v: mv });
      ps.pm++;
    } else if (type === 'box' && R() < 0.25) {
      const blk = this.pickSlot(D, (d) => DEF_W[d.pos]);
      ga.res = 'block';
      ga.d = blk.pid;
      st.say('blocked', {}, { ...base, t: 'blocked', d: blk.pid });
      if (!setPiece && R() < 0.5) { ga.out = 'corner'; const r2 = this.cornerSeq(A, D, st, 1); if (r2 && r2.goal) return r2; }
    } else if (R() < 0.08) {
      const pv = R() < 0.65 ? 'post' : 'bar';
      ga.res = pv;
      st.say(pv, {}, { ...base, t: 'woodwork', v: pv });
    } else {
      const mv = R() < (HIGH_P[type] ?? 0.4) ? 'high' : 'wide';
      ga.mv = mv;
      if (type === 'big') { ga.res = 'missBig'; st.say('missBig', { A: nm(p) }, { ...base, t: 'miss', v: mv, big: true }); }
      else { ga.res = mv === 'high' ? 'missHigh' : 'missWide'; st.say(mv === 'high' ? 'missHigh' : 'missWide', {}, { ...base, t: 'miss', v: mv }); }
    }
    return { goal: false, shot: true };
  }

  taker(S, key) {
    const s = this.slotOf(S, S.sp[key]);
    if (s && s.pos !== 'GK') return s;
    const def = defaultSetPieces(this.onSlots(S).map((x) => x.p));
    return this.slotOf(S, def[key]) || this.pickShooter(S, 'box');
  }

  boxSlots(S, exclPid) {
    let box = (S.sp.box || []).map((pid) => this.slotOf(S, pid)).filter((s) => s && s.pid !== exclPid);
    if (box.length < 2) {
      box = this.onSlots(S).filter((s) => s.pos !== 'GK' && s.pid !== exclPid)
        .sort((x, y) => (y.p.a.hd * 0.7 + y.p.a.st * 0.3) - (x.p.a.hd * 0.7 + x.p.a.st * 0.3)).slice(0, 4);
    }
    return box;
  }

  /** Wybicie dośrodkowania: obrońca głową albo bramkarz łapie piłkę. */
  clearance(A, D, st) {
    const gk = this.gkSlot(D);
    if (gk && R() < 0.3) { st.say('claimed', { G: nm(gk.p) }, { t: 'cleared', s: A.idx, v: 'claim', g: gk.pid }); return; }
    const defs = this.onSlots(D).filter((x) => x.pos !== 'GK');
    const d = defs.length ? wpick(defs, (x) => (POS_GROUP[x.pos] === 'D' ? 3 : x.pos === 'DM' ? 1.5 : 0.5) * Math.pow(x.p.a.hd / 60, 2)) : null;
    st.say('cleared', { D: d ? nm(d.p) : 'obrońca' }, { t: 'cleared', s: A.idx, v: 'clear', d: d ? d.pid : null });
  }

  cornerSeq(A, D, st, depth) {
    A.corners++;
    const t = this.taker(A, 'cor');
    st.say('corner', { A: nm(t.p) }, { t: 'corner', s: A.idx, a: t.pid });
    st.say('cornerCross', { A: nm(t.p) }, { t: 'cross', s: A.idx, a: t.pid, from: 'corner' });
    const box = this.boxSlots(A, t.pid);
    const defAir = this.avgAir(D);
    const attAir = box.length ? box.reduce((s, x) => s + x.p.a.hd, 0) / box.length : 40;
    const pHead = 0.3 * A.mods.sp * Math.pow(t.p.a.cr / 70, 0.5) * Math.pow(attAir / Math.max(30, defAir), 0.8) * (box.length / 4 + 0.25);
    if (box.length && R() < pHead) {
      const h = wpick(box, (x) => Math.pow(x.p.a.hd, 2));
      const act = st.say('header', { A: nm(h.p) }, { t: 'shot', kind: 'head', s: A.idx, a: h.pid, b: t.pid });
      return this.shot(A, D, h, 'head', t, st, true, act);
    }
    this.clearance(A, D, st);
    return null;
  }

  avgAir(S) {
    const d = this.onSlots(S).filter((s) => POS_GROUP[s.pos] === 'D' || s.pos === 'DM');
    return d.length ? d.reduce((s, x) => s + x.p.a.hd, 0) / d.length : 50;
  }

  freeKickFar(A, D, st) {
    const t = this.taker(A, 'fkf');
    st.say('fkFar', { A: nm(t.p) }, { t: 'fkFar', s: A.idx, a: t.pid });
    st.say('fkFarCross', { A: nm(t.p) }, { t: 'cross', s: A.idx, a: t.pid, from: 'fk' });
    const box = this.boxSlots(A, t.pid);
    const pHead = 0.26 * A.mods.sp * Math.pow(t.p.a.cr / 70, 0.5) * (box.length / 4 + 0.25);
    if (box.length && R() < pHead) {
      const h = wpick(box, (x) => Math.pow(x.p.a.hd, 2));
      const act = st.say('header', { A: nm(h.p) }, { t: 'shot', kind: 'head', s: A.idx, a: h.pid, b: t.pid });
      return this.shot(A, D, h, 'head', t, st, true, act);
    }
    this.clearance(A, D, st);
    return null;
  }

  freeKickNear(A, D, st) {
    const t = this.taker(A, 'fkn');
    st.say('fkNear', { A: nm(t.p) }, { t: 'fkNear', s: A.idx, a: t.pid });
    const act = st.say('fkShot', { A: nm(t.p) }, { t: 'shot', kind: 'fk', s: A.idx, a: t.pid });
    return this.shot(A, D, t, 'fk', null, st, false, act);
  }

  penaltyKick(A, D, st) {
    const t = this.taker(A, 'pen');
    const act = st.say('penTaker', { A: nm(t.p) }, { t: 'shot', kind: 'pen', s: A.idx, a: t.pid });
    return this.shot(A, D, t, 'pen', null, st, false, act);
  }

  // ---------------- kontuzje, zmiany ----------------
  checkInjuries(S) {
    const opp = this.sides[1 - S.idx];
    for (const s of this.onSlots(S)) {
      if (S.injured.has(s.pid)) continue;
      const p = 0.00011 * (1 + 0.5 * opp.mods.hardF) * (S.st[s.pid] < 45 ? 1.6 : 1) * (1 - 0.3 * this.lvl(S, 'cond'));
      if (R() < p) this.injure(S, s);
    }
  }

  injure(S, s) {
    S.injured.add(s.pid);
    this.pstat(S, s.pid).inj = true;
    S.st[s.pid] = Math.min(S.st[s.pid], 25);
    this.key.push({ min: this.minLabel(), side: S.idx, type: 'inj', pid: s.pid });
    const auto = S.spec.ai || (this.opts.autoSubs && this.opts.autoSubs[S.idx]);
    const e = this.ev('inj', S.idx, this.one('injury', { A: nm(s.p) }, { t: 'injury', s: S.idx, a: s.pid }), { pid: s.pid, needSub: !auto && S.subsLeft > 0 && S.bench.length > 0 });
    if (auto) {
      const cand = this.bestBenchFor(S, s.pos);
      if (cand && S.subsLeft > 0) this.sub(S.idx, s.pid, cand);
      else { e.lines.push(L('injuryOn', { A: nm(s.p) })); e.acts.push({ t: 'injuryOn', s: S.idx, a: s.pid }); }
    }
    this.refresh();
  }

  bestBenchFor(S, pos) {
    let best = null, bs = -1;
    for (const pid of S.bench) {
      const p = S.spec.players[pid];
      if (!p || (pos !== 'GK' && p.pos === 'GK') || (pos === 'GK' && p.pos !== 'GK')) continue;
      const sc = slotRating(p, pos) * stateFactor(p);
      if (sc > bs) { bs = sc; best = pid; }
    }
    return best;
  }

  sub(sideIdx, outPid, inPid) {
    const S = this.sides[sideIdx];
    if (S.subsLeft <= 0 || this.done) return false;
    const i = S.on.findIndex((s) => s && s.pid === outPid);
    if (i < 0 || !S.bench.includes(inPid)) return false;
    const slot = S.on[i];
    const inP = S.spec.players[inPid];
    S.on[i] = { ...slot, pid: inPid, p: inP };
    S.bench = S.bench.filter((x) => x !== inPid);
    S.subsLeft--;
    S.st[inPid] = inP.cond ?? 95;
    S.played.add(inPid);
    this.pstat(S, inPid, slot.pos).on = this.clock.min;
    this.pstat(S, outPid).off = this.clock.min;
    this.ev('sub', sideIdx, this.one('sub', { T: S.name, OUT: nm(slot.p), IN: nm(inP) }, { t: 'sub', s: sideIdx, a: inPid, b: outPid }), { pid: inPid, pid2: outPid });
    this.key.push({ min: this.minLabel(), side: sideIdx, type: 'sub', pid: inPid, pid2: outPid });
    this.refresh();
    return true;
  }

  /** Zmiana ustawienia lub poleceń w trakcie meczu. */
  setTactics(sideIdx, tac) {
    const S = this.sides[sideIdx];
    const oldF = S.tac.f;
    S.tac = { ...S.tac, ...tac };
    if (tac.f && tac.f !== oldF) {
      const players = this.onSlots(S).map((s) => s.p);
      const ids = autoLineup(players, tac.f);
      const f = FORMATIONS[tac.f];
      S.on = ids.map((pid, i) => (pid != null ? this.mkSlot(S.spec, pid, f[i]) : null));
      for (const s of this.onSlots(S)) this.pstat(S, s.pid).pos = s.pos;
    }
    this.refresh();
  }

  setInstr(sideIdx, pid, instr) {
    const S = this.sides[sideIdx];
    S.instr[pid] = { ...(S.instr[pid] || {}), ...instr };
    this.refresh();
  }

  aiThink(S) {
    const m = this.clock.min;
    if (m < 46) return;
    const opp = this.sides[1 - S.idx];
    const diff = S.goals - opp.goals;
    if (m >= 65 && diff < 0 && !S.adj.a) { S.tac.style = Math.min(4, S.tac.style + 1); S.adj.a = true; this.refresh(); }
    if (m >= 80 && diff < 0 && !S.adj.b) { S.tac.style = 4; S.tac.press = 2; S.adj.b = true; this.refresh(); }
    if (m >= 78 && diff > 0 && !S.adj.c) { S.tac.style = Math.max(0, S.tac.style - 1); S.tac.tw = 1; S.adj.c = true; this.refresh(); }
    if (S.subsLeft <= 0 || m < 56 || R() > 0.3) return;
    let worst = null, ws = 1e9;
    for (const s of this.onSlots(S)) {
      let sc = S.st[s.pid];
      if (S.injured.has(s.pid)) sc = -100;
      else if (S.yc[s.pid] && m >= 65 && POS_GROUP[s.pos] !== 'A') sc -= 14;
      if (s.pos === 'GK' && !S.injured.has(s.pid)) continue;
      if (sc < ws) { ws = sc; worst = s; }
    }
    const thr = m >= 75 ? 70 : 62;
    if (worst && ws < thr) {
      const cand = this.bestBenchFor(S, worst.pos);
      if (!cand) return;
      const cp = S.spec.players[cand];
      if (S.injured.has(worst.pid) || slotRating(cp, worst.pos) >= 0.8 * slotRating(worst.p, worst.pos) * stamF(S.st[worst.pid])) {
        this.sub(S.idx, worst.pid, cand);
      }
    }
  }

  // ---------------- rzuty karne po dogrywce ----------------
  shootout() {
    const order = (S) => {
      const on = this.onSlots(S);
      const pen = on.find((s) => s.pid === S.sp.pen && s.pos !== 'GK');
      const rest = on.filter((s) => s !== pen && s.pos !== 'GK').sort((a, b) => kickQ(b.p) - kickQ(a.p));
      const gk = on.filter((s) => s.pos === 'GK');
      return [...(pen ? [pen] : []), ...rest, ...gk];
    };
    const kickQ = (p) => 0.6 * av(p.a, 'pen') + 0.4 * av(p.a, 'cm');
    const k = [order(this.sides[0]), order(this.sides[1])];
    const sc = [0, 0], taken = [0, 0];
    const kicks = [];
    const st = new Story();
    const kick = (si) => {
      const S = this.sides[si], D = this.sides[1 - si];
      const list = k[si];
      const s = list[taken[si] % list.length];
      taken[si]++;
      const gk = this.gkSlot(D);
      const gq = gk ? gkQ(gk.p.a) : 20;
      const pr = clamp(0.75 + (kickQ(s.p) - gq) / 220 + 0.05 * (this.lvl(S, 'ment') - 0.5) + (stamF(S.st[s.pid]) - 0.95), 0.5, 0.92);
      const ok = R() < pr;
      if (ok) sc[si]++;
      const how = ok ? 'goal' : R() < 0.6 ? 'save' : 'miss';
      const txt = ok ? `${S.name}: ${nm(s.p)} – gol!` : `${S.name}: ${nm(s.p)} – ${how === 'save' ? 'obronił ' + (gk ? nm(gk.p) : 'bramkarz') : 'pudło'}!`;
      st.raw(`${txt} (${sc[0]}:${sc[1]})`, { t: 'pk', s: si, a: s.pid, g: gk ? gk.pid : null, v: how, score: [sc[0], sc[1]], n: kicks.length });
      kicks.push({ side: si, pid: s.pid, ok, score: [sc[0], sc[1]] });
    };
    for (let i = 0; i < 5; i++) {
      kick(0);
      if (sc[0] > sc[1] + (5 - i) || sc[1] > sc[0] + (5 - i - 1)) break;
      kick(1);
      if (sc[0] > sc[1] + (5 - i - 1) || sc[1] > sc[0] + (5 - i - 1)) break;
    }
    let guard = 0;
    while (sc[0] === sc[1] && guard++ < 30) { kick(0); kick(1); }
    this.pens = [sc[0], sc[1]];
    this.ev('pens', null, st, { kicks, pens: [sc[0], sc[1]] });
  }

  // ---------------- koniec meczu ----------------
  finish() {
    if (this.done) return;
    this.done = true;
    this.clock.phase = 'FT';
    this.ev('whistle', null, this.one('fulltime', {}, { t: 'fulltime' }), { ft: true });
    this.computeRatings();
  }

  winnerSide() {
    const [h, a] = this.sides;
    if (h.goals !== a.goals) return h.goals > a.goals ? 0 : 1;
    if (this.pens) return this.pens[0] > this.pens[1] ? 0 : 1;
    return null;
  }

  computeRatings() {
    const endMin = this.et ? 120 : 90;
    const win = this.winnerSide();
    let motm = null, best = -1;
    for (const S of this.sides) {
      const opp = this.sides[1 - S.idx];
      for (const pid of S.played) {
        const ps = S.ps[pid];
        const on = ps.on ?? 0, off = ps.off ?? endMin;
        const mins = Math.max(1, off - on);
        const frac = mins / endMin;
        const g = POS_GROUP[ps.pos || S.spec.players[pid].pos];
        let r = 6.0 + ps.g * 1.0 + ps.a * 0.6 + ps.kp * 0.12 + ps.sot * 0.08 + ps.tk * 0.07 + ps.sv * 0.32 - ps.yc * 0.3 - ps.rc * 1.5 - ps.pm * 0.6 - ps.og * 0.8;
        const conc = opp.goals * frac;
        if (g === 'G') r += opp.goals === 0 && mins >= 60 ? 0.7 : -0.35 * conc;
        else if (g === 'D') r += opp.goals === 0 && mins >= 60 ? 0.4 : -0.17 * conc;
        if (win === S.idx) r += 0.3;
        else if (win === 1 - S.idx) r -= 0.3;
        r += gauss() * 0.35;
        if (mins < 20) r = 6 + (r - 6) * 0.6;
        ps.r = Math.round(clamp(r, 3.5, 10) * 10) / 10;
        ps.min = mins;
        if (ps.r > best) { best = ps.r; motm = { side: S.idx, pid }; }
      }
    }
    this.motm = motm;
  }

  result() {
    const st = (S) => ({
      poss: 0, shots: S.shots, sot: S.sot, corners: S.corners, fouls: S.fouls, offsides: S.offsides, yc: S.yel, rc: S.red, xg: Math.round(S.xg * 100) / 100, saves: S.saves,
    });
    const s0 = st(this.sides[0]), s1 = st(this.sides[1]);
    const tp = this.sides[0].poss + this.sides[1].poss || 1;
    s0.poss = Math.round((this.sides[0].poss / tp) * 100);
    s1.poss = 100 - s0.poss;
    return {
      hg: this.sides[0].goals, ag: this.sides[1].goals, et: !!this.et, pens: this.pens, winner: this.winnerSide(),
      stats: [s0, s1], pl: [this.sides[0].ps, this.sides[1].ps], key: this.key, motm: this.motm,
    };
  }
}

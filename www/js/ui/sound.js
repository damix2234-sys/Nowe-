// Dźwięki meczu generowane w przeglądarce (Web Audio), gwizdek i kibice, bez plików audio.
import { getSettings, setSettings } from '../core/storage.js';

let ctx = null, master = null, noiseBuf = null, amb = null;

export const soundOn = () => getSettings().sound !== false;

function ac() {
  if (!soundOn()) return null;
  try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.85;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  } catch (e) {
    return null;
  }
}

/** Wywołać w obsłudze dotknięcia, przeglądarki wymagają gestu, by odtwarzać dźwięk. */
export function unlockAudio() { ac(); }

function noise() {
  if (noiseBuf) return noiseBuf;
  const len = ctx.sampleRate * 2;
  const b = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = b.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    last = (last + 0.02 * w) / 1.02;
    d[i] = last * 3.2 + w * 0.12;
  }
  noiseBuf = b;
  return b;
}

function blow(t, dur, vol = 0.1) {
  const o = ctx.createOscillator();
  o.type = 'triangle';
  o.frequency.setValueAtTime(2900, t);
  const o2 = ctx.createOscillator();
  o2.type = 'sine';
  o2.frequency.setValueAtTime(3170, t);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.02);
  g.gain.setValueAtTime(vol, Math.max(t + 0.03, t + dur - 0.05));
  g.gain.linearRampToValueAtTime(0, t + dur);
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 27;
  const lg = ctx.createGain();
  lg.gain.value = vol * 0.55;
  lfo.connect(lg);
  lg.connect(g.gain);
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = 3000;
  f.Q.value = 2;
  o.connect(f);
  o2.connect(f);
  f.connect(g);
  g.connect(master);
  for (const x of [o, o2, lfo]) { x.start(t); x.stop(t + dur + 0.05); }
}

/** kind: short (wznowienie, faul), long (rzut karny), double (przerwa), end (koniec meczu) */
export function whistle(kind = 'short') {
  const c = ac();
  if (!c) return;
  const t = c.currentTime + 0.02;
  if (kind === 'long') blow(t, 0.85);
  else if (kind === 'double') { blow(t, 0.3); blow(t + 0.42, 0.55); }
  else if (kind === 'end') { blow(t, 0.28); blow(t + 0.4, 0.28); blow(t + 0.8, 0.9); }
  else blow(t, 0.28);
}

/** type: goal (radość), groan (jęk zawodu), ooh (niewykorzystana okazja) */
export function crowd(type = 'goal', loud = 1) {
  const c = ac();
  if (!c) return;
  const t = c.currentTime + 0.01;
  const src = c.createBufferSource();
  src.buffer = noise();
  src.loop = true;
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.Q.value = 0.6;
  f.frequency.value = type === 'goal' ? 850 : type === 'groan' ? 420 : 650;
  const g = c.createGain();
  const peak = (type === 'goal' ? 0.6 : type === 'groan' ? 0.3 : 0.28) * loud;
  const dur = type === 'goal' ? 3.4 : type === 'groan' ? 1.8 : 1.3;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + (type === 'goal' ? 0.25 : 0.18));
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  if (type === 'goal') f.frequency.linearRampToValueAtTime(1350, t + 0.6);
  if (type === 'groan') f.frequency.linearRampToValueAtTime(240, t + dur);
  src.connect(f);
  f.connect(g);
  g.connect(master);
  src.start(t);
  src.stop(t + dur + 0.1);
}

/** Uderzenie piłki (power 0–1): krótki, głuchy dźwięk. */
export function kick(power = 1) {
  const c = ac();
  if (!c) return;
  const t = c.currentTime + 0.005;
  const o = c.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(150 + 40 * power, t);
  o.frequency.exponentialRampToValueAtTime(55, t + 0.09);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.32 * (0.4 + 0.6 * power), t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  const src = c.createBufferSource();
  src.buffer = noise();
  const f = c.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 900;
  const ng = c.createGain();
  ng.gain.setValueAtTime(0.18 * power, t);
  ng.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
  o.connect(g); g.connect(master);
  src.connect(f); f.connect(ng); ng.connect(master);
  o.start(t); o.stop(t + 0.15);
  src.start(t, Math.random()); src.stop(t + 0.07);
}

/** Piłka w słupek lub poprzeczkę, metaliczny dźwięk. */
export function post() {
  const c = ac();
  if (!c) return;
  const t = c.currentTime + 0.005;
  for (const [fq, v] of [[880, 0.16], [1320, 0.1], [2210, 0.05]]) {
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.value = fq;
    const g = c.createGain();
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + 0.5);
  }
}

/** Szum trybun w tle meczu. */
export function ambience(on) {
  if (!on) {
    if (amb && ctx) {
      try {
        amb.g.gain.setTargetAtTime(0, ctx.currentTime, 0.25);
        amb.src.stop(ctx.currentTime + 1.2);
        amb.lfo.stop(ctx.currentTime + 1.2);
      } catch (e) { /* już zatrzymane */ }
    }
    amb = null;
    return;
  }
  const c = ac();
  if (!c || amb) return;
  const src = c.createBufferSource();
  src.buffer = noise();
  src.loop = true;
  const f = c.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 700;
  const g = c.createGain();
  g.gain.value = 0;
  g.gain.setTargetAtTime(0.05, c.currentTime, 0.8);
  const lfo = c.createOscillator();
  lfo.frequency.value = 0.15;
  const lg = c.createGain();
  lg.gain.value = 0.015;
  lfo.connect(lg);
  lg.connect(g.gain);
  src.connect(f);
  f.connect(g);
  g.connect(master);
  src.start();
  lfo.start();
  amb = { src, g, lfo };
}

export function setSound(on) {
  const s = getSettings();
  s.sound = !!on;
  setSettings(s);
  if (!on) ambience(false);
}

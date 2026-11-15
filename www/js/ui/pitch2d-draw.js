// Rysowanie boiska 2D na canvasie: murawa w pasy, linie, bramki z siatką, zawodnicy w barwach drużyn
// (numery, kierunek patrzenia, wślizgi, parady, upadki), piłka z wysokością i cieniem, sędziowie i efekty.

export const PW = 68, PL = 105;
const GHW = 3.66;
const TAU = Math.PI * 2;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

/** Rysuje pełną klatkę. P, instancja Pitch2D. */
export function render(P) {
  const c = P.ctx;
  if (!c || !P.W) return;
  // tryb poziomy (rot = 1 albo -1): rysujemy „wirtualny pion” obrócony o 90°, napisy zostają poziome
  const rot = P.rot || 0;
  const W = rot ? P.H : P.W, H = rot ? P.W : P.H;
  c.setTransform(P.dpr, 0, 0, P.dpr, 0, 0);
  if (rot) {
    c.fillStyle = '#1d6a37';
    c.fillRect(0, 0, P.W, P.H);
    if (rot > 0) { c.translate(P.W, 0); c.rotate(Math.PI / 2); } else { c.translate(0, P.H); c.rotate(-Math.PI / 2); }
    uprightText(c, rot);
  }
  try { renderInner(P, c, W, H, rot); } finally { if (rot) plainText(c); }
  if (rot) { c.setTransform(P.dpr, 0, 0, P.dpr, 0, 0); drawScreenFx(P, c, P.W, P.H); }
}

/** Napisy w obróconym widoku: każdy tekst obracany z powrotem wokół swojego punktu zaczepienia. */
function uprightText(c, rot) {
  const f = CanvasRenderingContext2D.prototype.fillText, s = CanvasRenderingContext2D.prototype.strokeText;
  const a = rot > 0 ? -Math.PI / 2 : Math.PI / 2;
  c.fillText = function (t, x, y, m) { this.save(); this.translate(x, y); this.rotate(a); f.call(this, t, 0, 0, m); this.restore(); };
  c.strokeText = function (t, x, y, m) { this.save(); this.translate(x, y); this.rotate(a); s.call(this, t, 0, 0, m); this.restore(); };
}
function plainText(c) { delete c.fillText; delete c.strokeText; }

/** Komunikaty nakładane na ekran w widoku poziomym (gol, napisy), rysowane bez obrotu. */
function drawScreenFx(P, c, W, H) {
  for (const f of P.fx) {
    if (f.type !== 'goal' && f.type !== 'caption') continue;
    const a = f.t < 0.15 ? f.t / 0.15 : f.t > f.dur - 0.35 ? Math.max(0, (f.dur - f.t) / 0.35) : 1;
    c.save();
    c.globalAlpha = a;
    if (f.type === 'goal') {
      const T = P.teams[f.s];
      const h = 64, y = H * 0.36 - h / 2;
      const g = c.createLinearGradient(0, y, W, y);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.2, 'rgba(8,17,14,0.88)'); g.addColorStop(0.8, 'rgba(8,17,14,0.88)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.fillRect(0, y, W, h);
      c.fillStyle = T.kit.shirt; c.fillRect(W * 0.3, y + h - 3, W * 0.4, 3);
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.font = '900 30px system-ui, sans-serif'; c.fillStyle = '#c6f432'; c.fillText('GOL!', W / 2, y + 24);
      c.font = '700 12px system-ui, sans-serif'; c.fillStyle = '#ffffff'; c.fillText(`${f.name}${f.name ? ' · ' : ''}${T.name}`, W / 2, y + 48);
    } else {
      c.font = '800 11px system-ui, sans-serif';
      const w = c.measureText(f.text.toUpperCase()).width + 20;
      roundRect(c, W / 2 - w / 2, H - 34, w, 22, 11);
      c.fillStyle = 'rgba(8,17,14,0.78)'; c.fill();
      c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#ffffff';
      c.fillText(f.text.toUpperCase(), W / 2, H - 22.5);
    }
    c.restore();
  }
}

function renderInner(P, c, W, H, rot) {
  const k = P.cam.k;
  const cx = P.cam.x ?? PW / 2, cy = P.cam.y;
  const X = (x) => W / 2 + (x - cx) * k;
  const Y = (y) => H / 2 - (y - cy) * k;
  const V = { c, k, X, Y, W, H, R: P.bodyR ? clamp(P.bodyR * k, 4.5, 40) : clamp(1.45 * k, 5.5, 22) };

  // statyczne tło (murawa, linie, bramki) rysowane raz do osobnego płótna i kopiowane
  c.fillStyle = '#1d6a37';
  c.fillRect(0, 0, W, H);
  const bg = bgLayer(P, P.kTarget || k);
  if (bg) {
    const sc = k / P._bgK;
    c.drawImage(bg.cv, X(-BGM), Y(PL + BGM), bg.w * sc, bg.h * sc);
  } else {
    drawTurf(V);
    drawLines(V);
    drawGoal(V, P, PL, 1, true);
    drawGoal(V, P, 0, -1, true);
  }
  drawGoal(V, P, PL, 1, false);
  drawGoal(V, P, 0, -1, false);
  drawOffside(V, P);

  // cienie
  const people = [];
  for (const T of P.teams) for (const p of T.players) if (p.state !== 'gone') people.push(p);
  c.fillStyle = 'rgba(0,0,0,0.26)';
  for (const p of people) {
    const lift = p.state === 'jump' ? 0.6 : 0;
    c.beginPath();
    c.ellipse(X(p.x) + V.R * (0.3 + lift), Y(p.y) + V.R * (0.35 + lift), V.R * 0.95, V.R * 0.7, 0, 0, TAU);
    c.fill();
  }
  // sędziowie
  drawOfficial(V, P.ref.x, P.ref.y, V.R * 0.72);
  for (const l of P.lines) drawOfficial(V, l.x, l.y, V.R * 0.6);

  const own = P.ball.owner;
  const me = P.sim && P.sim.ctrl && P.sim.ctrl.state !== 'gone' ? P.sim.ctrl : null;
  if (me) {
    // znacznik sterowanej postaci: świecący pierścień pod zawodnikiem
    const mx = X(me.x), my = Y(me.y), pulse = 1 + Math.sin(P.time * 6) * 0.08;
    c.save();
    c.strokeStyle = '#ffe14d'; c.lineWidth = Math.max(2, V.R * 0.22);
    c.shadowColor = '#ffe14d'; c.shadowBlur = 10;
    c.beginPath(); c.ellipse(mx, my + V.R * 0.25, V.R * 1.45 * pulse, V.R * 1.05 * pulse, 0, 0, TAU); c.stroke();
    c.restore();
  }
  for (const p of people) if (p !== own) drawPlayer(V, P, p);
  if (own && own.state !== 'gone') drawPlayer(V, P, own);
  drawBall(V, P);
  drawLabels(V, P, people);
  if (me) {
    const mx = X(me.x), my = Y(me.y) - V.R * 2.1;
    c.fillStyle = '#ffe14d';
    c.beginPath(); c.moveTo(mx, my + V.R * 0.7); c.lineTo(mx - V.R * 0.55, my); c.lineTo(mx + V.R * 0.55, my); c.closePath(); c.fill();
    if (me !== own) label(c, me.ln, mx, my - 3, '#ffe14d', V.W);
  }
  drawFx(V, P);
}

const BGM = 8;

function bgLayer(P, k) {
  if (typeof document === 'undefined') return null;
  const dpr = P.dpr;
  const key = `${k.toFixed(3)}|${dpr}`;
  if (P._bg && P._bgKey === key) return P._bg;
  const w = (PW + 2 * BGM) * k, h = (PL + 2 * BGM) * k;
  const cv = (P._bg && P._bg.cv) || document.createElement('canvas');
  cv.width = Math.ceil(w * dpr);
  cv.height = Math.ceil(h * dpr);
  const c = cv.getContext('2d');
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  const V = { c, k, X: (x) => (x + BGM) * k, Y: (y) => (PL + BGM - y) * k, W: w, H: h };
  drawTurf(V);
  drawLines(V);
  drawGoal(V, P, PL, 1, true);
  drawGoal(V, P, 0, -1, true);
  P._bg = { cv, w, h };
  P._bgKey = key;
  P._bgK = k;
  return P._bg;
}

function drawTurf(V) {
  const { c, k, X, Y, W, H } = V;
  c.fillStyle = '#1d6a37';
  c.fillRect(0, 0, W, H);
  for (let i = -2; i < 16; i++) {
    const y0 = i * 7.5;
    const top = Y(y0 + 7.5), bot = Y(y0);
    if (bot < 0 || top > H) continue;
    c.fillStyle = i % 2 ? '#2a8143' : '#2e8a49';
    c.fillRect(X(-8), top, (PW + 16) * k, bot - top);
  }
  // przyciemnienie poza liniami boiska
  c.fillStyle = 'rgba(6,30,14,0.28)';
  c.fillRect(0, 0, X(0), H);
  c.fillRect(X(PW), 0, W - X(PW), H);
  c.fillRect(X(0), 0, PW * k, Y(PL));
  c.fillRect(X(0), Y(0), PW * k, H - Y(0));
}

function drawLines(V) {
  const { c, k, X, Y } = V;
  c.strokeStyle = 'rgba(255,255,255,0.82)';
  c.lineWidth = Math.max(1, 0.13 * k);
  c.beginPath();
  c.rect(X(0), Y(PL), PW * k, PL * k);
  c.moveTo(X(0), Y(PL / 2));
  c.lineTo(X(PW), Y(PL / 2));
  c.moveTo(X(34) + 9.15 * k, Y(PL / 2));
  c.arc(X(34), Y(PL / 2), 9.15 * k, 0, TAU);
  for (const [y0, d] of [[0, 1], [PL, -1]]) {
    c.rect(X(34 - 20.16), Y(y0), 40.32 * k, -16.5 * d * k);
    c.rect(X(34 - 9.16), Y(y0), 18.32 * k, -5.5 * d * k);
    // łuk pola karnego
    const sy = y0 + 11 * d;
    const a = Math.asin(5.5 / 9.15);
    const steps = 18;
    for (let i = 0; i <= steps; i++) {
      const t = a + ((Math.PI - 2 * a) * i) / steps;
      const px = 34 + Math.cos(t) * 9.15, py = sy + Math.sin(t) * 9.15 * d;
      if (i === 0) c.moveTo(X(px), Y(py)); else c.lineTo(X(px), Y(py));
    }
  }
  // narożniki
  for (const [x0, y0, a0] of [[0, 0, 0], [PW, 0, Math.PI / 2], [PW, PL, Math.PI], [0, PL, -Math.PI / 2]]) {
    c.moveTo(X(x0) + Math.cos(-a0) * k, Y(y0) + Math.sin(-a0) * k);
    c.arc(X(x0), Y(y0), 1 * k, -a0, -a0 - Math.PI / 2, true);
  }
  c.stroke();
  c.fillStyle = 'rgba(255,255,255,0.85)';
  for (const [x, y] of [[34, PL / 2], [34, 11], [34, PL - 11]]) {
    c.beginPath();
    c.arc(X(x), Y(y), Math.max(1.2, 0.22 * k), 0, TAU);
    c.fill();
  }
}

/** stat, rysowanie do tła (siatka w spoczynku); inaczej tylko wybrzuszona siatka po golu. */
function drawGoal(V, P, y0, d, stat) {
  const { c, k, X, Y } = V;
  let bulge = 0, bx = 34;
  if (!stat) {
    for (const f of P.fx) if (f.type === 'net' && Math.abs(f.y - y0) < 1) { bulge = Math.sin(Math.min(1, f.t / f.dur) * Math.PI) * 0.9; bx = f.x; }
    if (bulge <= 0.01) return;
  }
  const depth = 2;
  const x0 = 34 - GHW, x1 = 34 + GHW;
  const back = y0 + d * depth;
  c.save();
  c.fillStyle = 'rgba(255,255,255,0.14)';
  c.beginPath();
  c.moveTo(X(x0), Y(y0));
  c.lineTo(X(x0), Y(back));
  c.quadraticCurveTo(X(bx), Y(back + d * bulge * 2), X(x1), Y(back));
  c.lineTo(X(x1), Y(y0));
  c.closePath();
  c.fill();
  c.clip();
  c.strokeStyle = 'rgba(255,255,255,0.32)';
  c.lineWidth = 1;
  c.beginPath();
  for (let x = x0; x <= x1 + 0.01; x += 0.6) { c.moveTo(X(x), Y(y0)); c.lineTo(X(x), Y(back + d * bulge)); }
  for (let t = 0.4; t < depth + bulge; t += 0.5) { c.moveTo(X(x0), Y(y0 + d * t)); c.lineTo(X(x1), Y(y0 + d * t)); }
  c.stroke();
  c.restore();
  c.strokeStyle = '#ffffff';
  c.lineWidth = Math.max(2, 0.28 * k);
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(X(x0), Y(y0));
  c.lineTo(X(x0), Y(back));
  c.moveTo(X(x1), Y(y0));
  c.lineTo(X(x1), Y(back));
  c.moveTo(X(x0), Y(y0));
  c.lineTo(X(x1), Y(y0));
  c.stroke();
  c.lineCap = 'butt';
}

function drawOfficial(V, x, y, r) {
  const { c, X, Y } = V;
  c.beginPath();
  c.arc(X(x), Y(y), r, 0, TAU);
  c.fillStyle = '#151515';
  c.fill();
  c.lineWidth = Math.max(1, r * 0.3);
  c.strokeStyle = '#e9f542';
  c.stroke();
}

function shirtPattern(c, kit, r) {
  if (!kit.pat) return;
  c.save();
  c.clip();
  c.fillStyle = kit.trim;
  if (kit.pat === 's') {
    for (const ox of [-0.62, 0, 0.62]) c.fillRect(ox * r - r * 0.17, -r, r * 0.34, 2 * r);
  } else if (kit.pat === 'c') {
    const q = r * 0.66;
    for (let i = -2; i < 2; i++) for (let j = -2; j < 2; j++) if ((i + j) % 2 === 0) c.fillRect(i * q, j * q, q, q);
  } else if (kit.pat === 'd') {
    c.rotate(-0.75);
    c.fillRect(-r, -r * 0.24, 2 * r, r * 0.48);
  } else if (kit.pat === 'h') {
    c.fillRect(-r, -r * 0.25, 2 * r, r * 0.5);
  }
  c.restore();
}

function drawPlayer(V, P, p) {
  const { c, X, Y } = V;
  const T = P.teams[p.side];
  const kit = p.gk ? T.kit.gk : T.kit;
  let r = V.R;
  const x = X(p.x), y = Y(p.y);
  c.save();
  if (p.state === 'off') c.globalAlpha = 0.55;
  c.translate(x, y);
  if (p.state === 'jump') r *= 1.2;
  if (p.kickT > 0) r *= 1 + p.kickT * 0.35;
  if (p.state === 'down') {
    c.rotate(-p.face);
    c.scale(1.4, 0.6);
  } else if (p.state === 'dive') {
    c.rotate(p.diveDir < 0 ? 0 : Math.PI);
    c.scale(1.65, 0.72);
  } else if (p.state === 'slide') {
    c.rotate(-p.face);
    c.scale(1.5, 0.75);
  } else if (p.state === 'stumble') {
    c.rotate(Math.sin(P.time * 30) * 0.25);
  }
  c.beginPath();
  c.arc(0, 0, r, 0, TAU);
  c.fillStyle = kit.shirt;
  c.fill();
  shirtPattern(c, kit, r);
  const ring = Math.max(1.3, r * 0.2);
  c.beginPath();
  c.arc(0, 0, r - ring / 2, 0, TAU);
  c.lineWidth = ring;
  c.strokeStyle = kit.trim;
  c.stroke();
  c.beginPath();
  c.arc(0, 0, r + 0.4, 0, TAU);
  c.lineWidth = 1;
  c.strokeStyle = 'rgba(0,0,0,0.6)';
  c.stroke();
  c.restore();
  // kierunek patrzenia, jasny łuk na obwodzie
  if (p.state === 'play' || p.state === 'jump') {
    const a = -p.face;
    c.beginPath();
    c.arc(x, y, r + 1.6, a - 0.55, a + 0.55);
    c.lineWidth = Math.max(1.4, r * 0.22);
    c.strokeStyle = 'rgba(255,255,255,0.55)';
    c.stroke();
  }
  if (p.state !== 'down' && p.state !== 'dive' && r >= 5) {
    c.fillStyle = kit.num;
    c.font = `800 ${Math.round(r * 1.02)}px system-ui, sans-serif`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.globalAlpha = p.state === 'off' ? 0.55 : 1;
    c.fillText(String(p.num), x, y + r * 0.07);
    c.globalAlpha = 1;
  }
  if (P.ball.owner === p && p.state === 'play') {
    c.beginPath();
    c.arc(x, y, r + 3.2, 0, TAU);
    c.lineWidth = 1.5;
    c.strokeStyle = 'rgba(255,255,255,0.85)';
    c.stroke();
  }
}

// Piłka: cieniowana kula z czarnymi łatami obracającymi się zgodnie z ruchem, połysk i miękki cień.
function pentagon(c, x, y, r, rot) {
  c.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = rot + (i * TAU) / 5;
    if (i === 0) c.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r); else c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  c.closePath();
  c.fill();
}

function drawBall(V, P) {
  const { c, k, X, Y, R } = V;
  const b = P.ball;
  // smuga po mocnym uderzeniu
  if (P.trail.length > 1) {
    c.lineCap = 'round';
    for (let i = 1; i < P.trail.length; i++) {
      const a = P.trail[i - 1], q = P.trail[i];
      c.strokeStyle = `rgba(255,255,255,${(i / P.trail.length) * 0.42})`;
      c.lineWidth = Math.max(1, (i / P.trail.length) * R * 0.5);
      c.beginPath();
      c.moveTo(X(a.x), Y(a.y) - a.z * k * 0.55);
      c.lineTo(X(q.x), Y(q.y) - q.z * k * 0.55);
      c.stroke();
    }
    c.lineCap = 'butt';
  }
  const x = X(b.x), y = Y(b.y);
  const z = Math.max(0, b.z);
  const r = Math.max(4.4, 0.68 * k) * (1 + z * 0.07);
  // cień na murawie (oddala się i rozmywa z wysokością)
  c.fillStyle = `rgba(0,0,0,${0.38 / (1 + z * 0.4)})`;
  c.beginPath();
  c.ellipse(x + z * k * 0.28, y + z * k * 0.2 + r * 0.3, r * (1 + z * 0.08), r * 0.62 * (1 + z * 0.05), 0, 0, TAU);
  c.fill();
  const by = y - z * k * 0.55;
  // kula z cieniowaniem
  const g = c.createRadialGradient(x - r * 0.38, by - r * 0.42, r * 0.1, x, by, r);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.55, '#eef1f4');
  g.addColorStop(1, '#a7b0ba');
  c.beginPath();
  c.arc(x, by, r, 0, TAU);
  c.fillStyle = g;
  c.fill();
  // łaty, obrót zależny od drogi przebytej przez piłkę
  c.save();
  c.beginPath();
  c.arc(x, by, r * 0.98, 0, TAU);
  c.clip();
  const roll = b.spin * 1.6;
  const dir = Math.atan2(-(b.vy || 0.0001), b.vx || 0.0001);
  const off = Math.sin(roll) * r * 0.42;
  c.fillStyle = '#1e2127';
  pentagon(c, x + Math.cos(dir) * off, by + Math.sin(dir) * off, r * 0.36, roll * 0.5);
  for (let i = 0; i < 5; i++) {
    const a = dir + roll * 0.35 + (i * TAU) / 5;
    pentagon(c, x + Math.cos(a) * r * 0.98, by + Math.sin(a) * r * 0.98, r * 0.3, a);
  }
  c.restore();
  // obrys i połysk
  c.beginPath();
  c.arc(x, by, r, 0, TAU);
  c.lineWidth = 1;
  c.strokeStyle = 'rgba(0,0,0,0.7)';
  c.stroke();
  c.fillStyle = 'rgba(255,255,255,0.75)';
  c.beginPath();
  c.ellipse(x - r * 0.36, by - r * 0.42, r * 0.28, r * 0.17, -0.6, 0, TAU);
  c.fill();
}

function label(c, text, x, y, color = '#ffffff', W = 0) {
  c.font = '700 10.5px system-ui, sans-serif';
  if (W) { const hw = c.measureText(text).width / 2 + 3; x = clamp(x, hw, W - hw); }
  c.textAlign = 'center';
  c.textBaseline = 'bottom';
  c.lineWidth = 3;
  c.strokeStyle = 'rgba(0,0,0,0.75)';
  c.strokeText(text, x, y);
  c.fillStyle = color;
  c.fillText(text, x, y);
}

function drawLabels(V, P, people) {
  const { c, X, Y, R } = V;
  const own = P.ball.owner;
  for (const p of people) {
    if (p.state === 'gone') continue;
    const show = p === own || p.hl > 0;
    if (!show) continue;
    label(c, p.ln, X(p.x), Y(p.y) - R - 4, p.side === P.user ? '#e8ff8a' : '#ffffff', V.W);
  }
}

function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

function drawOffside(V, P) {
  const { c, k, X, Y } = V;
  for (const f of P.fx) {
    if (f.type !== 'offside') continue;
    const a = f.t < 0.2 ? f.t / 0.2 : f.t > f.dur - 0.4 ? (f.dur - f.t) / 0.4 : 1;
    c.save();
    c.globalAlpha = Math.max(0, a);
    c.setLineDash([6, 5]);
    c.strokeStyle = '#ffe14d';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(X(0), Y(f.y));
    c.lineTo(X(PW), Y(f.y));
    c.stroke();
    c.setLineDash([]);
    // chorągiewka sędziego liniowego
    const fx = X(f.y > PL / 2 ? PW : 0) + (f.y > PL / 2 ? 6 : -6), fy = Y(f.y);
    c.strokeStyle = '#fff';
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(fx, fy);
    c.lineTo(fx, fy - 2.6 * k - 8);
    c.stroke();
    c.fillStyle = '#ff4d2e';
    c.fillRect(fx, fy - 2.6 * k - 8, 9, 6);
    c.fillStyle = '#ffe14d';
    c.beginPath();
    c.moveTo(fx, fy - 2.6 * k - 8);
    c.lineTo(fx + 9, fy - 2.6 * k - 2);
    c.lineTo(fx, fy - 2.6 * k - 2);
    c.fill();
    c.restore();
  }
}

function drawFx(V, P) {
  const { c, X, Y, W, H, R } = V;
  for (const f of P.fx) {
    if (P.rot && (f.type === 'goal' || f.type === 'caption' || f.type === 'sub' || f.type === 'board')) continue;
    const a = f.t < 0.15 ? f.t / 0.15 : f.t > f.dur - 0.35 ? Math.max(0, (f.dur - f.t) / 0.35) : 1;
    c.save();
    c.globalAlpha = a;
    if (f.type === 'card' && f.p) {
      const x = X(f.p.x) + R + 2, y = Y(f.p.y) - R * 2.6;
      const s = 1 + Math.max(0, 0.3 - f.t) * 1.5;
      c.translate(x, y);
      c.rotate(0.15);
      c.scale(s, s);
      roundRect(c, -5, -7, 10, 14, 2);
      c.fillStyle = f.red ? '#e53935' : '#ffd600';
      c.fill();
      c.lineWidth = 1;
      c.strokeStyle = 'rgba(0,0,0,0.5)';
      c.stroke();
    } else if (f.type === 'medic' && f.p) {
      const x = X(f.p.x), y = Y(f.p.y) - R * 2.5;
      c.beginPath();
      c.arc(x, y, 7, 0, TAU);
      c.fillStyle = '#ffffff';
      c.fill();
      c.fillStyle = '#e53935';
      c.fillRect(x - 1.6, y - 4.6, 3.2, 9.2);
      c.fillRect(x - 4.6, y - 1.6, 9.2, 3.2);
    } else if (f.type === 'sub') {
      const w = 132, h = 40;
      const x = 8, y = clamp(Y(PL / 2) - h / 2, 8, H - h - 8);
      roundRect(c, x, y, w, h, 7);
      c.fillStyle = 'rgba(8,17,14,0.88)';
      c.fill();
      c.textAlign = 'left';
      c.textBaseline = 'middle';
      c.font = '700 11px system-ui, sans-serif';
      c.fillStyle = '#6ee26e';
      c.fillText(`▲ ${f.inN}  ${f.inName}`, x + 8, y + 12);
      c.fillStyle = '#ff6b5e';
      c.fillText(`▼ ${f.outN}  ${f.outName}`, x + 8, y + 28);
    } else if (f.type === 'board') {
      const w = 54, h = 30;
      const x = 8, y = clamp(Y(PL / 2) - h / 2, 8, H - h - 8);
      roundRect(c, x, y, w, h, 6);
      c.fillStyle = '#111';
      c.fill();
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.font = '800 16px system-ui, sans-serif';
      c.fillStyle = '#7dff5a';
      c.fillText(f.text, x + w / 2, y + h / 2 + 1);
    } else if (f.type === 'goal') {
      const T = P.teams[f.s];
      const h = 64, y = H * 0.42 - h / 2;
      const g = c.createLinearGradient(0, y, W, y);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(0.15, 'rgba(8,17,14,0.88)');
      g.addColorStop(0.85, 'rgba(8,17,14,0.88)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g;
      c.fillRect(0, y, W, h);
      c.fillStyle = T.kit.shirt;
      c.fillRect(W * 0.2, y + h - 3, W * 0.6, 3);
      const s = 1 + Math.max(0, 0.35 - f.t) * 1.2;
      c.translate(W / 2, y + 26);
      c.scale(s, s);
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.font = '900 30px system-ui, sans-serif';
      c.fillStyle = '#c6f432';
      c.fillText('GOL!', 0, 0);
      c.font = '700 12px system-ui, sans-serif';
      c.fillStyle = '#ffffff';
      c.fillText(`${f.name}${f.name ? ' · ' : ''}${T.name}`, 0, 24);
    } else if (f.type === 'confetti') {
      if (!f.parts) {
        const T = P.teams[f.s];
        f.parts = Array.from({ length: 34 }, (_, i) => ({ a: Math.random() * TAU, v: 40 + Math.random() * 90, c: i % 2 ? T.kit.shirt : T.kit.trim, r: 1.5 + Math.random() * 2 }));
        f.ox = X(f.x); f.oy = Y(f.y);
      }
      for (const q of f.parts) {
        const t = f.t;
        const px = f.ox + Math.cos(q.a) * q.v * t, py = f.oy + Math.sin(q.a) * q.v * t + 60 * t * t;
        c.fillStyle = q.c;
        c.fillRect(px, py, q.r * 1.6, q.r);
      }
    } else if (f.type === 'caption') {
      c.font = '800 11px system-ui, sans-serif';
      const w = c.measureText(f.text.toUpperCase()).width + 20;
      roundRect(c, W / 2 - w / 2, 8, w, 22, 11);
      c.fillStyle = 'rgba(8,17,14,0.78)';
      c.fill();
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillStyle = '#ffffff';
      c.fillText(f.text.toUpperCase(), W / 2, 19.5);
    } else if (f.type === 'post') {
      c.beginPath();
      c.arc(X(f.x), Y(f.y), 4 + f.t * 30, 0, TAU);
      c.lineWidth = 2;
      c.strokeStyle = '#ffffff';
      c.stroke();
    }
    c.restore();
  }
}

// Narzędzia wspólne: losowość, daty, formatowanie.

export const DAY_MS = 86400000;

/** Deterministyczny generator liczb losowych (mulberry32). */
export function mkRng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const rnd = (r = Math.random) => r();
export const rint = (a, b, r = Math.random) => a + Math.floor(r() * (b - a + 1));
export const chance = (p, r = Math.random) => r() < p;
export const pick = (arr, r = Math.random) => arr[Math.floor(r() * arr.length)];

export function wpick(items, wf, r = Math.random) {
  let tot = 0;
  const ws = items.map((it) => {
    const w = Math.max(0, wf(it) || 0);
    tot += w;
    return w;
  });
  if (tot <= 0) return items[Math.floor(r() * items.length)];
  let x = r() * tot;
  for (let i = 0; i < items.length; i++) {
    x -= ws[i];
    if (x <= 0) return items[i];
  }
  return items[items.length - 1];
}

export function shuffle(a, r = Math.random) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function gauss(r = Math.random) {
  let u = 0, v = 0;
  while (!u) u = r();
  while (!v) v = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
export const sum = (arr) => arr.reduce((s, x) => s + x, 0);
export const avg = (arr) => (arr.length ? sum(arr) / arr.length : 0);
export const round1 = (x) => Math.round(x * 10) / 10;

export function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// ---------- daty (liczba dni od 1970-01-01, UTC) ----------
export const mkDay = (y, m, d) => Math.round(Date.UTC(y, m - 1, d) / DAY_MS);
export function ymd(n) {
  const dt = new Date(n * DAY_MS);
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate(), wd: dt.getUTCDay() };
}
const pad = (x) => (x < 10 ? '0' + x : '' + x);
export const MONTHS = ['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca', 'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia'];
export const MONTHS_SHORT = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];
export const WEEKDAYS = ['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota'];
export function fmtDate(n) {
  const { y, m, d } = ymd(n);
  return `${pad(d)}.${pad(m)}.${y}`;
}
export function fmtDateShort(n) {
  const { m, d } = ymd(n);
  return `${pad(d)}.${pad(m)}`;
}
export function fmtDateLong(n) {
  const { y, m, d } = ymd(n);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}
export function fmtDayMonth(n) {
  const { m, d } = ymd(n);
  return `${d} ${MONTHS_SHORT[m - 1]}`;
}

export function fmtMoney(v) {
  if (v >= 1e6) return (Math.round(v / 1e5) / 10).toLocaleString('pl-PL') + ' mln €';
  if (v >= 1e3) return Math.round(v / 1e3).toLocaleString('pl-PL') + ' tys. €';
  return Math.round(v) + ' €';
}

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Polska odmiana liczebników: 1 mecz, 2 mecze, 5 meczów. */
export function plural(n, one, few, many) {
  const a = Math.abs(n);
  if (a === 1) return one;
  const d = a % 10, h = a % 100;
  if (d >= 2 && d <= 4 && (h < 12 || h > 14)) return few;
  return many;
}

export function uid() {
  return Math.random().toString(36).slice(2, 10);
}

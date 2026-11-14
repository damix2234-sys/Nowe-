// Ranking światowy, system punktowy oparty na wyniku względem oczekiwań (wzorowany na metodzie Elo).
import { NATIONS } from '../data/nations.js';

export function initRanking(G, r = Math.random) {
  G.rank = {};
  for (const n of NATIONS) G.rank[n.id] = Math.round(780 + (n.str - 30) * 18 + (r() - 0.5) * 40);
  G.rankPrev = rankPositions(G);
}

export function importance(G, fx) {
  const c = G.comps[fx.comp];
  if (!c) return 10;
  if (c.type === 'FRI') return 10;
  if (c.type === 'LN') return fx.r >= 0 ? 25 : 15;
  if (c.type === 'Q') return 25;
  if (c.type === 'FIN') {
    const wc = c.kind === 'WC';
    if (fx.r < 0) return wc ? 50 : 35;
    return wc ? 60 : 40;
  }
  return 10;
}

export function expected(G, a, b, homeAdv = 0) {
  const dr = (G.rank[a] || 1000) - (G.rank[b] || 1000) + homeAdv;
  return 1 / (Math.pow(10, -dr / 600) + 1);
}

export function updateRanking(G, fx) {
  const res = fx.res;
  if (!res) return;
  const I = importance(G, fx);
  let W;
  if (res.hg > res.ag) W = 1;
  else if (res.hg < res.ag) W = 0;
  else if (res.pens) W = res.pens[0] > res.pens[1] ? 0.75 : 0.5;
  else W = 0.5;
  let Wa = res.pens && res.hg === res.ag ? (res.pens[1] > res.pens[0] ? 0.75 : 0.5) : 1 - W;
  const We = expected(G, fx.h, fx.a);
  let dh = I * (W - We);
  let da = I * (Wa - (1 - We));
  const c = G.comps[fx.comp];
  if (c && c.type === 'FIN' && fx.r >= 0) { dh = Math.max(0, dh); da = Math.max(0, da); }
  G.rank[fx.h] = Math.round((G.rank[fx.h] + dh) * 100) / 100;
  G.rank[fx.a] = Math.round((G.rank[fx.a] + da) * 100) / 100;
}

/** Mapa id → pozycja w rankingu (1 = najlepszy). */
export function rankPositions(G) {
  const ids = Object.keys(G.rank).sort((a, b) => G.rank[b] - G.rank[a]);
  const pos = {};
  ids.forEach((id, i) => { pos[id] = i + 1; });
  return pos;
}

export function rankedIds(G, filter = null) {
  return Object.keys(G.rank).filter((id) => !filter || filter(id)).sort((a, b) => G.rank[b] - G.rank[a]);
}

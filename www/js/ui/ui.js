// Mini-framework interfejsu: ekrany, akcje, modale, panele dolne, powiadomienia + wspólne komponenty.
import { esc, clamp } from '../core/util.js';
import { icon } from './icons.js';
import { avatar } from './avatar.js';
import { NAT, starsFor } from '../data/nations.js';
import { POS_GROUP, FORM_ICONS, FORM_NAMES } from '../engine/player.js';

export const S = { screens: {}, actions: {}, stack: [], overlays: [], current: null, backHandler: null, rail: null };

/** Boczny pasek menu (ustawiany przez pulpit): fn(nazwaEkranu) → HTML albo ''. */
export function setRail(fn) { S.rail = fn; }

export function screen(name, def) { S.screens[name] = def; }
export function actions(obj) { Object.assign(S.actions, obj); }

const root = () => document.getElementById('app');

export function go(name, params = {}, opts = {}) {
  if (S.stack.length) S.stack[S.stack.length - 1].scroll = window.scrollY;
  const entry = { name, params, scroll: 0 };
  if (opts.replace && S.stack.length) S.stack[S.stack.length - 1] = entry;
  else S.stack.push(entry);
  closeAllOverlays();
  render();
}

export function reset(name, params = {}) {
  S.stack = [{ name, params, scroll: 0 }];
  closeAllOverlays();
  render();
}

export function current() { return S.stack[S.stack.length - 1]; }

/** Obsługa „wstecz” (przycisk w aplikacji, systemowy przycisk Androida). Zwraca true, jeśli coś obsłużono. */
export function handleBack() {
  if (S.overlays.length) {
    const top = S.overlays[S.overlays.length - 1];
    if (top.opts.dismiss !== false) closeOverlay();
    return true;
  }
  const cur = current();
  const def = cur && S.screens[cur.name];
  if (def && def.onBack && def.onBack(cur.params) === true) return true;
  if (S.stack.length > 1) {
    S.stack.pop();
    render(true);
    return true;
  }
  return false;
}

export function render(restoreScroll = false) {
  const top = current();
  if (!top) return;
  const def = S.screens[top.name];
  if (S.current && S.current.def && S.current.def.unmount) {
    try { S.current.def.unmount(); } catch (e) { console.error(e); }
  }
  let out;
  try {
    out = def.render(top.params || {});
  } catch (e) {
    console.error(e);
    out = { title: 'Błąd', body: `<div class="card"><p>Wystąpił błąd ekranu: ${esc(e.message)}</p></div>` };
  }
  if (typeof out === 'string') out = { body: out };
  const showBack = out.back ?? S.stack.length > 1;
  const backBtn = showBack ? `<button class="iconbtn" data-a="ui.back" aria-label="Wstecz">${icon('back')}</button>` : (out.left || '<span class="iconbtn-spacer"></span>');
  let rail = '';
  try { rail = S.rail && !out.noRail ? S.rail(top.name) : ''; } catch (e) { console.error(e); }
  root().className = 'app' + (out.appCls ? ' ' + out.appCls : '') + (rail ? ' with-rail' : '');
  root().innerHTML = `${rail ? `<nav class="rail" id="rail" aria-label="Menu">${rail}</nav>` : ''}${out.noHeader ? '' : `<header class="top">${backBtn}<div class="ttl"><h1>${out.title || ''}</h1>${out.sub ? `<div class="sub">${out.sub}</div>` : ''}</div><div class="right">${out.right || ''}</div></header>`}
<main class="view ${out.cls || ''}" id="view">${out.body || ''}</main>
${out.foot ? `<footer class="foot">${out.foot}</footer>` : ''}`;
  window.scrollTo(0, restoreScroll ? top.scroll || 0 : top.keepScroll || 0);
  top.keepScroll = 0;
  S.current = { def, params: top.params };
  if (def.mount) {
    try { def.mount(root(), top.params || {}); } catch (e) { console.error(e); }
  }
}

/** Odświeża bieżący ekran zachowując przewinięcie. */
export function rerender() {
  const top = current();
  if (!top) return;
  top.keepScroll = window.scrollY;
  render();
  window.scrollTo(0, top.keepScroll || window.scrollY);
}

// ---------------- nakładki ----------------
function overlayRoot() {
  let el = document.getElementById('overlays');
  if (!el) { el = document.createElement('div'); el.id = 'overlays'; document.body.appendChild(el); }
  return el;
}

function openOverlay(html, opts) {
  const wrap = document.createElement('div');
  wrap.className = 'ov ' + (opts.kind === 'sheet' ? 'ov-sheet' : 'ov-modal');
  wrap.innerHTML = `<div class="ov-bg" data-ovbg="1"></div><div class="ov-box ${opts.cls || ''}" role="dialog" aria-modal="true">${html}</div>`;
  overlayRoot().appendChild(wrap);
  requestAnimationFrame(() => wrap.classList.add('show'));
  const o = { el: wrap, opts };
  S.overlays.push(o);
  document.body.classList.add('noscroll');
  if (opts.mount) opts.mount(wrap.querySelector('.ov-box'));
  return wrap.querySelector('.ov-box');
}

export function closeOverlay() {
  const o = S.overlays.pop();
  if (!o) return;
  o.el.classList.remove('show');
  setTimeout(() => o.el.remove(), 180);
  if (!S.overlays.length) document.body.classList.remove('noscroll');
  if (o.opts.onClose) o.opts.onClose();
}

export function closeAllOverlays() {
  while (S.overlays.length) {
    const o = S.overlays.pop();
    o.el.remove();
  }
  document.body.classList.remove('noscroll');
}

/** Okno dialogowe. buttons: [{label, cls, a, x}] */
export function modal({ title = '', body = '', buttons = [], dismiss = true, cls = '', head = '', onClose = null, mount = null }) {
  const btns = buttons.map((b) => `<button class="btn ${b.cls || ''}" data-a="${b.a}" ${dataAttrs(b.x)}>${b.label}</button>`).join('');
  return openOverlay(`${head}${title ? `<h2 class="m-title">${title}</h2>` : ''}<div class="m-body">${body}</div>${btns ? `<div class="m-actions">${btns}</div>` : ''}`, { dismiss, cls, onClose, mount, kind: 'modal' });
}

/** Panel wysuwany od dołu. */
export function sheet(html, opts = {}) {
  return openOverlay(`<div class="grab"></div>${opts.title ? `<h2 class="m-title">${opts.title}</h2>` : ''}<div class="sheet-body">${html}</div>`, { ...opts, kind: 'sheet' });
}

export function dataAttrs(x) {
  if (!x) return '';
  return Object.entries(x).map(([k, v]) => `data-${k}="${esc(v)}"`).join(' ');
}

let confirmResolve = null;
export function confirmBox(text, ok = 'Tak', cancel = 'Anuluj', danger = false) {
  return new Promise((resolve) => {
    confirmResolve = resolve;
    modal({
      title: 'Potwierdź', body: `<p>${text}</p>`, dismiss: true,
      onClose: () => { if (confirmResolve) { confirmResolve(false); confirmResolve = null; } },
      buttons: [{ label: cancel, cls: 'ghost', a: 'ui.confirmNo' }, { label: ok, cls: danger ? 'danger' : '', a: 'ui.confirmYes' }],
    });
  });
}

let toastTimer = null;
export function toast(text, kind = '') {
  let el = document.getElementById('toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; document.body.appendChild(el); }
  el.className = 'toast show ' + kind;
  el.innerHTML = text;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

export function busy(on, text = '') {
  let el = document.getElementById('busy');
  if (!el) {
    el = document.createElement('div');
    el.id = 'busy';
    el.innerHTML = '<div class="spin"></div><div class="busy-t"></div>';
    document.body.appendChild(el);
  }
  el.querySelector('.busy-t').textContent = text;
  el.classList.toggle('show', on);
}

// ---------------- delegacja zdarzeń ----------------
export function initEvents() {
  document.addEventListener('click', (e) => {
    const bg = e.target.closest('[data-ovbg]');
    if (bg) {
      const top = S.overlays[S.overlays.length - 1];
      if (top && top.opts.dismiss !== false) closeOverlay();
      return;
    }
    const el = e.target.closest('[data-a]');
    if (!el || el.disabled || el.classList.contains('disabled')) return;
    const fn = S.actions[el.dataset.a];
    if (fn) {
      e.preventDefault();
      try { fn(el.dataset, el, e); } catch (err) { console.error(err); toast('Błąd: ' + esc(err.message), 'bad'); }
    }
  });
  const onField = (attr) => (e) => {
    const el = e.target.closest(`[data-${attr}]`);
    if (!el) return;
    const fn = S.actions[el.dataset[attr]];
    if (fn) fn(el.dataset, el, e);
  };
  document.addEventListener('change', onField('change'));
  document.addEventListener('input', onField('input'));
}

actions({
  'ui.back': () => handleBack(),
  'ui.close': () => closeOverlay(),
  'ui.confirmYes': () => { const r = confirmResolve; confirmResolve = null; closeOverlay(); if (r) r(true); },
  'ui.confirmNo': () => { const r = confirmResolve; confirmResolve = null; closeOverlay(); if (r) r(false); },
});

// ---------------- komponenty ----------------
export const flag = (nid, cls = '') => (NAT[nid] ? `<span class="flag ${cls}" title="${esc(NAT[nid].name)}">${NAT[nid].flag}</span>` : '<span class="flag">🏳️</span>');
export const team = (nid, cls = '') => `<span class="team ${cls}">${flag(nid)}<span class="tn">${esc(NAT[nid] ? NAT[nid].name : nid)}</span></span>`;
export const posBadge = (pos) => `<span class="pos g-${POS_GROUP[pos] || 'M'}">${pos}</span>`;

export function ratingBand(v) {
  return v >= 85 ? 5 : v >= 75 ? 4 : v >= 65 ? 3 : v >= 55 ? 2 : v >= 45 ? 1 : 0;
}
export const rating = (v, cls = '') => `<span class="rt b${ratingBand(v)} ${cls}">${Math.round(v)}</span>`;
export const attrVal = (v) => `<span class="av b${ratingBand(v)}">${Math.round(v)}</span>`;

export function matchRating(r) {
  const c = r >= 8 ? 5 : r >= 7 ? 4 : r >= 6.3 ? 3 : r >= 5.6 ? 2 : 1;
  return `<span class="mr b${c}">${r.toFixed(1)}</span>`;
}

export function stars(n) {
  let h = '<span class="stars" aria-label="' + n + ' gwiazdek">';
  for (let i = 1; i <= 5; i++) {
    const fill = n >= i ? 100 : n >= i - 0.5 ? 50 : 0;
    h += `<i style="--f:${fill}%">★</i>`;
  }
  return h + '</span>';
}
export const natStars = (nid, strength) => stars(starsFor(strength ?? NAT[nid].str));

export function bar(v, cls = '') {
  const c = cls || (v >= 66 ? 'good' : v >= 40 ? 'mid' : 'low');
  return `<div class="bar ${c}"><i style="width:${clamp(v, 0, 100)}%"></i></div>`;
}

export const formIcon = (f) => `<span class="form f${f + 2}" title="Forma: ${FORM_NAMES[f + 2]}">${FORM_ICONS[f + 2]}</span>`;

export function resChip(r) {
  const t = r === 'W' ? 'Z' : r === 'L' ? 'P' : 'R';
  return `<span class="res r${r}">${t}</span>`;
}

export const av = (seed, opts) => avatar(seed, opts);

export function seg(name, items, active, extra = {}) {
  return `<div class="seg" role="tablist">${items.map(([k, label]) => `<button class="${k === active ? 'on' : ''}" data-a="${name}" data-k="${esc(k)}" ${dataAttrs(extra)}>${label}</button>`).join('')}</div>`;
}

export function chips(name, items, active, extra = {}) {
  return `<div class="chips">${items.map(([k, label]) => `<button class="chip ${k === active ? 'on' : ''}" data-a="${name}" data-k="${esc(k)}" ${dataAttrs(extra)}>${label}</button>`).join('')}</div>`;
}

export function empty(text) {
  return `<div class="empty">${text}</div>`;
}

export { icon, esc };

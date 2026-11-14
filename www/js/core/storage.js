// Zapis gry (IndexedDB z awaryjnym localStorage) oraz małe ustawienia urządzenia.
const DB_NAME = 'selekcjoner';
const STORE = 'saves';
const LS_PREFIX = 'selekcjoner.';

let dbp = null;
function db() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    } catch (e) { reject(e); }
  });
  return dbp;
}

async function idb(mode, fn) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(STORE, mode);
    const st = tx.objectStore(STORE);
    const req = fn(st);
    tx.oncomplete = () => resolve(req ? req.result : undefined);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function saveSlot(slot, data, meta) {
  try {
    await idb('readwrite', (st) => { st.put(data, 'game:' + slot); return st.put(meta, 'meta:' + slot); });
    return true;
  } catch (e) {
    try {
      localStorage.setItem(LS_PREFIX + 'game:' + slot, JSON.stringify(data));
      localStorage.setItem(LS_PREFIX + 'meta:' + slot, JSON.stringify(meta));
      return true;
    } catch (e2) {
      console.warn('Zapis nieudany', e, e2);
      return false;
    }
  }
}

export async function loadSlot(slot) {
  try {
    const v = await idb('readonly', (st) => st.get('game:' + slot));
    if (v) return v;
  } catch (e) { /* awaryjnie localStorage */ }
  try {
    const s = localStorage.getItem(LS_PREFIX + 'game:' + slot);
    return s ? JSON.parse(s) : null;
  } catch (e) { return null; }
}

export async function slotMeta(slot) {
  try {
    const v = await idb('readonly', (st) => st.get('meta:' + slot));
    if (v) return v;
  } catch (e) { /* ignoruj */ }
  try {
    const s = localStorage.getItem(LS_PREFIX + 'meta:' + slot);
    return s ? JSON.parse(s) : null;
  } catch (e) { return null; }
}

export async function deleteSlot(slot) {
  try { await idb('readwrite', (st) => { st.delete('game:' + slot); return st.delete('meta:' + slot); }); } catch (e) { /* ignoruj */ }
  try { localStorage.removeItem(LS_PREFIX + 'game:' + slot); localStorage.removeItem(LS_PREFIX + 'meta:' + slot); } catch (e) { /* ignoruj */ }
}

export const SLOTS = ['auto', '1', '2', '3'];

// ---------- małe dane w localStorage ----------
export function lsGet(key, def) {
  try {
    const s = localStorage.getItem(LS_PREFIX + key);
    return s == null ? def : JSON.parse(s);
  } catch (e) { return def; }
}
export function lsSet(key, val) {
  try { localStorage.setItem(LS_PREFIX + key, JSON.stringify(val)); return true; } catch (e) { return false; }
}

export const DEFAULT_SETTINGS = { speed: 1, autosave: true, vibrate: true, sound: true, prePress: true, confirmAdvance: false };
export function getSettings() { return { ...DEFAULT_SETTINGS, ...lsGet('settings', {}) }; }
export function setSettings(s) { lsSet('settings', s); }

export function getAchievements() { return lsGet('achievements', {}); }
export function addAchievement(id) {
  const a = getAchievements();
  if (a[id]) return false;
  a[id] = Date.now();
  lsSet('achievements', a);
  return true;
}

export function getEdits() { return lsGet('edits', {}); }
export function setEdits(e) { return lsSet('edits', e); }

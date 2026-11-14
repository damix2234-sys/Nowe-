// Sesja gry: zapis, odczyt, autozapis, osiągnięcia.
import { G, setGame, setHooks } from '../engine/game.js';
import { saveSlot, loadSlot, getSettings, addAchievement } from '../core/storage.js';
import { ACH } from '../data/achievements.js';
import { toast } from './ui.js';

export function initSession() {
  setHooks({
    achieve: (id) => {
      if (addAchievement(id) && ACH[id]) setTimeout(() => toast(`${ACH[id].icon} Osiągnięcie: <b>${ACH[id].name}</b>`, 'good'), 400);
    },
  });
}

export function metaOf(g) {
  return { nat: g.user.nat, lastNat: g.user.spells.length ? g.user.spells[g.user.spells.length - 1].nat : null, manager: g.user.name, day: g.day, saved: Date.now(), unemployed: g.user.unemployed };
}

export async function saveGame(slot) {
  if (!G) return false;
  return saveSlot(slot, G, metaOf(G));
}

export async function loadGame(slot) {
  const g = await loadSlot(slot);
  if (!g || !g.v) return false;
  setGame(g);
  return true;
}

let lastAutoDay = -1;
export function autosave(force = false) {
  if (!G) return;
  if (!force && !getSettings().autosave) return;
  if (!force && G.day === lastAutoDay) return;
  lastAutoDay = G.day;
  saveGame('auto');
}

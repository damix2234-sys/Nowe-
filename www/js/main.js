// Punkt wejścia aplikacji.
import { initEvents, reset, handleBack, toast } from './ui/ui.js';
import { initSession } from './ui/session.js';
import './ui/flow.js';
import './ui/screens/menu.js';
import './ui/screens/home.js';
import './ui/screens/squad.js';
import './ui/screens/tactics.js';
import './ui/screens/match.js';
import './ui/screens/press.js';
import './ui/screens/world.js';
import './ui/screens/office.js';
import './ui/screens/guide.js';
import './ui/screens/career.js';

function historyBack() {
  // przeglądarka / PWA: przechwycenie przycisku „wstecz” (nie w osadzonej ramce)
  let embedded = false;
  try { embedded = window.self !== window.top; } catch (e) { embedded = true; }
  if (embedded) return;
  try {
    history.pushState({ guard: 1 }, '');
    window.addEventListener('popstate', () => {
      if (handleBack()) history.pushState({ guard: 1 }, '');
      else history.back();
    });
  } catch (e) { /* brak historii */ }
}

async function initBack() {
  const cap = window.Capacitor;
  const hasApp = !!(cap && Array.isArray(cap.PluginHeaders) && cap.PluginHeaders.some((h) => h.name === 'App'));
  if (hasApp) {
    // aplikacja na Androida: systemowy przycisk „wstecz” przez wtyczkę App
    try {
      const { registerPlugin } = await import('./vendor/capacitor-core.js');
      const App = registerPlugin('App');
      const ok = await Promise.race([
        App.addListener('backButton', () => { if (!handleBack()) App.exitApp(); }).then(() => true, () => false),
        new Promise((r) => setTimeout(() => r(false), 2500)),
      ]);
      if (ok) return;
    } catch (e) {
      console.warn('Wtyczka App niedostępna', e);
    }
  }
  historyBack();
}

function initSW() {
  if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !window.Capacitor) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
}

window.addEventListener('error', (e) => { console.error(e.error || e.message); });
window.addEventListener('unhandledrejection', (e) => { console.error(e.reason); });

initEvents();
initSession();
initBack();
initSW();
reset('menu');
document.getElementById('boot')?.remove();
window.__selekcjoner = { toast };

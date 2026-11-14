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

function initBack() {
  const App = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
  if (App && App.addListener) {
    App.addListener('backButton', () => {
      if (!handleBack()) App.exitApp();
    });
    return;
  }
  // przeglądarka / PWA: przechwycenie przycisku „wstecz”
  try {
    history.pushState({ guard: 1 }, '');
    window.addEventListener('popstate', () => {
      if (handleBack()) history.pushState({ guard: 1 }, '');
      else history.back();
    });
  } catch (e) { /* brak historii */ }
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

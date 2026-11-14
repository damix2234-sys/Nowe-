// Test interfejsu w przeglądarce: node tools/ui-test.mjs [url] [katalog-zrzutów]
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const URL = process.argv[2] || 'http://localhost:8765/';
const OUT = process.argv[3] || '.';
const errors = [];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
const shot = async (name) => page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
const click = async (sel) => { await page.locator(sel).first().click(); await page.waitForTimeout(150); };

await page.goto(URL);
await page.waitForSelector('.title-screen');
await shot('01-menu');
await click('[data-a="menu.new"]');
await shot('02-newgame');
await page.fill('[data-input="ng.name"]', 'Jan Testowy');
await click('[data-a="ng.start"]');
await page.waitForSelector('.dash-head', { timeout: 15000 });
await page.waitForTimeout(400);
await shot('03-home');

// pętla gry: obsługa zdarzeń aż do rozegrania 2 meczów
let matches = 0, steps = 0;
async function handle() {
  const ovBtn = page.locator('.ov.show .m-actions .btn');
  if (await page.locator('.ov.show').count()) {
    const title = await page.locator('.ov.show .m-title').first().textContent().catch(() => '');
    // wybierz ostatni (główny) przycisk
    const n = await ovBtn.count();
    if (n) { await ovBtn.nth(n - 1).click(); await page.waitForTimeout(250); return 'modal:' + title; }
  }
  const scr = await page.evaluate(() => document.querySelector('header.top h1')?.textContent || '');
  if (await page.locator('[data-a="sq.confirm"]').count()) { await click('[data-a="sq.confirm"]'); return 'callup'; }
  if (await page.locator('[data-a="pr.greetPick"]').count()) { await click('[data-a="pr.greetPick"]'); await click('[data-a="pr.greet"]'); return 'greet'; }
  if (await page.locator('[data-a="pr.pick"]').count()) { await click('[data-a="pr.pick"]'); await click('[data-a="pr.next"]'); return 'press'; }
  if (await page.locator('[data-a="pm.live"]').count()) {
    if (matches === 0) await shot('05-prematch');
    await click('[data-a="pm.live"]');
    await page.waitForTimeout(1500);
    if (matches === 0) await shot('06-match-live');
    // przyspiesz do 4x
    for (let i = 0; i < 3; i++) { const sp = await page.locator('#mt-speed span').textContent(); if (sp === '4×') break; await click('[data-a="mt.speed"]'); }
    for (let t = 0; t < 900; t++) {
      if (await page.locator('[data-a="mt.summary"]').count()) break;
      // po ok. 20 s oglądania – reszta meczu symulacją (w porcjach, bez blokowania ekranu)
      if (t === 80 && await page.locator('[data-a="mt.end"]').count()) {
        await page.locator('.ov.show [data-a="ui.close"]').first().click().catch(() => {});
        await click('[data-a="mt.end"]');
        if (await page.locator('.ov.show [data-a="mt.endNow"]').count()) await click('.ov.show [data-a="mt.endNow"]');
      }
      if (await page.locator('.ov.show [data-a="mt.subDo"]').count()) {
        // kontuzja – wybierz pierwszego rezerwowego
        const ins = page.locator('.ov.show [data-a="mt.subIn"]');
        if (await ins.count()) { await ins.first().click(); await page.waitForTimeout(100); await page.locator('.ov.show [data-a="mt.subDo"]').click(); }
        await page.locator('.ov.show [data-a="ui.close"]').first().click();
        await click('[data-a="mt.play"]');
      }
      const banner = page.locator('#mt-banner [data-a="mt.play"]');
      if (await banner.count()) { if (matches === 0 && t > 0) await shot('07-match-break'); await banner.click(); }
      await page.waitForTimeout(250);
    }
    await shot(`08-match-end-${matches}`);
    await click('[data-a="mt.summary"]');
    await page.waitForTimeout(300);
    await shot(`09-postmatch-${matches}`);
    matches++;
    await click('[data-a="mt.home"]');
    return 'match';
  }
  if (await page.locator('[data-a="flow.advance"]').count()) { await click('[data-a="flow.advance"]'); await page.waitForTimeout(300); return 'advance'; }
  if (await page.locator('[data-a="ui.back"]').count()) { await click('[data-a="ui.back"]'); return 'back'; }
  return 'none:' + scr;
}
const log = [];
while (matches < 2 && steps++ < 80) {
  const r = await handle();
  log.push(r);
  if (log.length === 3) await shot('04-first-event');
}
// dokończ zdarzenia, aż wrócimy na pulpit bez kolejki
for (let i = 0; i < 20; i++) {
  const onHome = await page.locator('.dash-head').count();
  const ov = await page.locator('.ov.show').count();
  const q = await page.evaluate(async () => (await import('./js/engine/game.js')).G.queue.length);
  if (onHome && !ov && !q) break;
  log.push(await handle());
}
console.log('kroki:', log.join(' | '));

// odwiedź ekrany
await page.evaluate(() => window.scrollTo(0, 0));
const screens = ['squad', 'tactics', 'training', 'opponents', 'comps', 'friendlies', 'u21', 'federation', 'ranking', 'stats', 'offers', 'achievements', 'messages', 'save', 'settings'];
for (const s of screens) {
  await page.evaluate((k) => { document.querySelector(`[data-a="go"][data-k="${k}"]`)?.click(); }, s);
  await page.waitForTimeout(350);
  await shot('s-' + s);
  if (s === 'squad') { await click('.row.tap[data-a="pl.open"]'); await page.waitForTimeout(250); await shot('s-player'); await click('[data-a="ui.back"]'); }
  if (s === 'tactics') { for (const t of ['team', 'players', 'sp']) { await click(`[data-a="tac.tab"][data-k="${t}"]`); await shot('s-tactics-' + t); } await click('[data-a="tac.tab"][data-k="lineup"]'); }
  if (s === 'comps') { await click('[data-a="cp.open"]'); await shot('s-comp'); await click('[data-a="ui.back"]'); }
  await click('[data-a="ui.back"]');
}
await shot('99-home-end');
console.log('błędy:', errors.length ? errors.join('\n') : 'brak');
await browser.close();

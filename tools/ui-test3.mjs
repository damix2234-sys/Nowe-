// Test ścieżki zwolnienia i bezrobocia: node tools/ui-test3.mjs [url] [katalog]
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const URL = process.argv[2] || 'http://localhost:8765/';
const OUT = process.argv[3] || '.';
const errors = [], results = [];
const ok = (n, c) => results.push(`${c ? 'OK ' : 'FAIL'} ${n}`);
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true })).newPage();
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
const click = async (s, i = 0) => { await page.locator(s).nth(i).click(); await page.waitForTimeout(200); };
await page.goto(URL);
await page.waitForSelector('.title-screen');
await click('[data-a="menu.new"]');
await click('[data-a="ng.start"]');
await page.waitForSelector('.dash-head');
// wymuszone zwolnienie
await page.evaluate(async () => {
  const g = await import('./js/engine/game.js');
  g.G.trust.fed = 3;
  g.checkSack();
  (await import('./js/ui/flow.js')).nextEvent();
});
await page.waitForSelector('.ov.show');
ok('okno zwolnienia', (await page.locator('.ov.show .m-title').textContent()).includes('Koniec pracy'));
await page.screenshot({ path: `${OUT}/t3-sacked.png` });
await click('.ov.show [data-a="flow.sacked"]');
await page.waitForTimeout(300);
ok('pulpit bez pracy', await page.locator('text=Bez pracy').count() > 0);
await page.screenshot({ path: `${OUT}/t3-unemployed.png` });
// czekaj na ofertę
let got = false;
for (let i = 0; i < 40 && !got; i++) {
  if (await page.locator('.ov.show [data-a="flow.offer"]').count()) { got = true; break; }
  if (await page.locator('.ov.show .m-actions .btn').count()) { const b = page.locator('.ov.show .m-actions .btn'); await b.nth((await b.count()) - 1).click(); await page.waitForTimeout(200); continue; }
  await click('[data-a="flow.advance"]');
  await page.waitForTimeout(400);
}
ok('oferta pracy po zwolnieniu', got);
if (got) {
  await page.screenshot({ path: `${OUT}/t3-offer.png` });
  await click('.ov.show [data-a="flow.offer"][data-v="yes"]');
  await page.waitForTimeout(500);
  const nat = await page.evaluate(async () => (await import('./js/engine/game.js')).G.user.nat);
  ok('nowa praca: ' + nat, !!nat);
  await page.screenshot({ path: `${OUT}/t3-newjob.png` });
  for (const s of ['squad', 'tactics', 'federation', 'stats']) {
    await page.evaluate((k) => document.querySelector(`[data-a="go"][data-k="${k}"]`)?.click(), s);
    await page.waitForTimeout(300);
    await click('[data-a="ui.back"]');
  }
}
console.log(results.join('\n'));
console.log('błędy konsoli:', errors.length ? errors.join('\n') : 'brak');
await browser.close();

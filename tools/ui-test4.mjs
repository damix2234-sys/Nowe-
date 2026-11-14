// Test funkcji pakietu 2: samouczek, wyszukiwarka, raport asystenta, skład rywala, dźwięk, strzelcy.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const URL = process.argv[2] || 'http://localhost:8765/';
const OUT = process.argv[3] || '.';
const errors = [], results = [];
const ok = (n, c) => results.push(`${c ? 'OK ' : 'FAIL'} ${n}`);
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
const click = async (s, i = 0) => { await page.locator(s).nth(i).click(); await page.waitForTimeout(200); };
const go = (k) => page.evaluate((x) => document.querySelector(`[data-a="go"][data-k="${x}"]`).click(), k);

await page.goto(URL);
await page.waitForSelector('.title-screen');
await click('[data-a="menu.new"]');
await click('[data-a="ng.start"]');
await page.waitForSelector('.dash-head');
ok('samouczek pokazany', await page.locator('.ov.show .m-title', { hasText: 'Witaj' }).count() > 0);
await page.screenshot({ path: `${OUT}/t4-tutorial.png` });
await click('.ov.show [data-a="tut.next"]');
await page.waitForTimeout(250);
ok('samouczek – krok 2', await page.locator('.ov.show .m-title', { hasText: 'Powołania' }).count() > 0);
await click('.ov.show [data-a="tut.end"]');
ok('samouczek zapamiętany', await page.evaluate(() => localStorage.getItem('selekcjoner.tutorial') === 'true'));
await page.waitForTimeout(300);
while (await page.locator('.ov.show .m-actions .btn').count()) { const b = page.locator('.ov.show .m-actions .btn'); await b.nth((await b.count()) - 1).click(); await page.waitForTimeout(250); }

// wyszukiwarka
await go('squad');
await page.waitForTimeout(250);
await click('[data-a="sq.tab"][data-k="all"]');
const all = await page.locator('#sq-list .row').count();
const firstName = (await page.locator('#sq-list .row .t1').first().textContent()).trim();
await page.fill('#sq-search', firstName.split(' ').pop());
await page.waitForTimeout(200);
const filtered = await page.locator('#sq-list .row').count();
ok(`wyszukiwarka: ${all} → ${filtered} (${firstName})`, filtered >= 1 && filtered < all);
await page.screenshot({ path: `${OUT}/t4-search.png` });
await page.fill('#sq-search', 'zzzzzz');
await page.waitForTimeout(150);
ok('wyszukiwarka – brak wyników', await page.locator('#sq-list .empty').count() === 1);
await page.fill('#sq-search', '');
await click('[data-a="ui.back"]');

// do meczu
for (let i = 0; i < 30; i++) {
  if (await page.locator('[data-a="pm.live"]').count()) break;
  if (await page.locator('.ov.show .m-actions .btn').count()) { const b = page.locator('.ov.show .m-actions .btn'); await b.nth((await b.count()) - 1).click(); await page.waitForTimeout(200); continue; }
  if (await page.locator('[data-a="sq.confirm"]').count()) { await click('[data-a="sq.confirm"]'); continue; }
  if (await page.locator('[data-a="pr.greetPick"]').count()) { await click('[data-a="pr.greetPick"]'); await click('[data-a="pr.greet"]'); continue; }
  if (await page.locator('[data-a="pr.pick"]').count()) { await click('[data-a="pr.pick"]'); await click('[data-a="pr.next"]'); continue; }
  if (await page.locator('[data-a="flow.advance"]').count()) { await click('[data-a="flow.advance"]'); await page.waitForTimeout(300); }
}
ok('raport asystenta przed meczem', await page.locator('.card-h h3', { hasText: 'Raport asystenta' }).count() > 0);
ok('pasek kondycji na żetonach', await page.locator('.pitch .tok .cnd').count() === 11);
await page.screenshot({ path: `${OUT}/t4-prematch.png`, fullPage: true });
await click('[data-a="tac.oppDetails"]', 1);
await page.waitForTimeout(300);
ok('przewidywany skład rywala (11 żetonów)', await page.locator('.pitch .tok').count() === 11);
await page.screenshot({ path: `${OUT}/t4-opponent.png`, fullPage: true });
await click('[data-a="ui.back"]');

// mecz: dźwięk i strzelcy
await click('[data-a="pm.live"]');
await page.waitForTimeout(800);
ok('przycisk dźwięku w meczu', await page.locator('#mt-snd').count() === 1);
await click('#mt-snd');
ok('dźwięk wyłączony w ustawieniach', await page.evaluate(() => JSON.parse(localStorage.getItem('selekcjoner.settings') || '{}').sound === false));
await click('#mt-snd');
ok('dźwięk ponownie włączony', await page.evaluate(() => JSON.parse(localStorage.getItem('selekcjoner.settings') || '{}').sound === true));
for (let i = 0; i < 3; i++) { if ((await page.locator('#mt-speed span').textContent()) === '4×') break; await click('[data-a="mt.speed"]'); }
for (let t = 0; t < 900; t++) {
  if (await page.locator('[data-a="mt.summary"]').count()) break;
  if (await page.locator('.ov.show [data-a="mt.subDo"]').count()) { await page.locator('.ov.show [data-a="ui.close"]').first().click(); await click('[data-a="mt.play"]'); }
  const banner = page.locator('#mt-banner [data-a="mt.play"]');
  if (await banner.count()) await banner.click();
  await page.waitForTimeout(200);
}
const score = (await page.locator('#mt-sc').textContent()).trim();
const goals = score.split(':').reduce((s, x) => s + (+x || 0), 0);
const scorerLines = await page.evaluate(() => (document.getElementById('mt-scorers')?.innerText || '').split('\n').filter((x) => x.trim()).length);
ok(`strzelcy pod wynikiem (${score}, wpisów: ${scorerLines})`, goals === 0 ? scorerLines === 0 : scorerLines >= 1);
await page.screenshot({ path: `${OUT}/t4-match.png` });
await click('[data-a="mt.summary"]');
await click('[data-a="mt.home"]');
await page.waitForTimeout(300);
while (await page.locator('.ov.show .m-actions .btn').count()) { const b = page.locator('.ov.show .m-actions .btn'); await b.nth((await b.count()) - 1).click(); await page.waitForTimeout(250); }
for (let i = 0; i < 6 && await page.locator('[data-a="pr.pick"]').count(); i++) { await click('[data-a="pr.pick"]'); await click('[data-a="pr.next"]'); }
await go('settings');
await page.waitForTimeout(250);
ok('ustawienie dźwięku', await page.locator('[data-a="set.toggle"][data-k="sound"]').count() === 1);

console.log(results.join('\n'));
console.log('błędy konsoli:', errors.length ? errors.join('\n') : 'brak');
await browser.close();

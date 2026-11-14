// Test interakcji UI: node tools/ui-test2.mjs [url] [katalog]
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const URL = process.argv[2] || 'http://localhost:8765/';
const OUT = process.argv[3] || '.';
const errors = [];
const results = [];
const ok = (name, cond) => results.push(`${cond ? 'OK ' : 'FAIL'} ${name}`);
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
const click = async (sel, i = 0) => { await page.locator(sel).nth(i).click(); await page.waitForTimeout(180); };
const G = () => page.evaluate(async () => { const m = await import('./js/engine/game.js'); return m.G; });
const ev = (fn) => page.evaluate(fn);

await page.goto(URL);
await page.waitForSelector('.title-screen');
await click('[data-a="menu.new"]');
await click('[data-a="ng.start"]');
await page.waitForSelector('.dash-head');

// taktyka: zamiana zawodnika na pozycji
await ev(() => document.querySelector('[data-a="go"][data-k="tactics"]').click());
await page.waitForTimeout(200);
const before = await ev(async () => (await import('./js/engine/game.js')).G.team.lineup.slice());
await click('.tok', 9);
await page.waitForSelector('.ov.show');
const rows = page.locator('.ov.show [data-a="tac.assign"]');
const n = await rows.count();
await rows.nth(n - 3).click();
await page.waitForTimeout(250);
const after = await ev(async () => (await import('./js/engine/game.js')).G.team.lineup.slice());
ok('zmiana zawodnika na boisku', JSON.stringify(before) !== JSON.stringify(after) && after.every((x) => x != null));
// polecenia indywidualne
await click('[data-a="tac.tab"][data-k="players"]');
await click('[data-a="tac.instr"]', 10);
await page.waitForSelector('#ins-body');
await click('#ins-body [data-a="tac.instrSet"][data-f="sh"][data-v="0"]');
const shOn = await ev(() => document.querySelector('#ins-body [data-f="sh"][data-v="0"]').classList.contains('on'));
ok('polecenie indywidualne zmienione w panelu', shOn);
await click('.ov.show [data-a="ui.close"]');
await click('[data-a="tac.tab"][data-k="team"]');
await click('[data-a="tac.team"][data-k="style"][data-v="3"]');
ok('styl gry ustawiony', (await ev(async () => (await import('./js/engine/game.js')).G.team.tac.style)) === 3);
await page.screenshot({ path: `${OUT}/t2-tactics-team.png` });
await click('[data-a="ui.back"]');

// rozmowa z zawodnikiem
await ev(() => document.querySelector('[data-a="go"][data-k="squad"]').click());
await page.waitForTimeout(200);
await click('.row.tap[data-a="pl.open"]', 5);
await click('[data-a="pl.talk"]');
await click('.ov.show [data-a="pl.talkDo"][data-t="praise"]');
await page.waitForTimeout(400);
ok('rozmowa – okno z odpowiedzią', await page.locator('.ov.show .m-title', { hasText: 'Rozmowa' }).count() > 0);
await page.screenshot({ path: `${OUT}/t2-talk.png` });
await click('.ov.show [data-a="ui.close"]');
await click('[data-a="ui.back"]');
await click('[data-a="ui.back"]');

// mecz towarzyski
await ev(() => document.querySelector('[data-a="go"][data-k="friendlies"]').click());
await page.waitForTimeout(200);
const slots = await page.locator('[data-a="fr.slot"]').count();
if (slots) {
  await click('[data-a="fr.slot"]');
  await click('.ov.show [data-a="fr.ask"]', 20);
  await page.waitForTimeout(300);
  const toast = await page.locator('#toast').textContent();
  ok('zaproszenie na sparing: ' + toast.trim(), /przyjęła|odrzuciła/.test(toast));
}
await page.screenshot({ path: `${OUT}/t2-friendly.png` });
if (await page.locator('.ov.show').count()) await page.keyboard.press('Escape');
await ev(async () => { const ui = await import('./js/ui/ui.js'); ui.closeAllOverlays(); ui.reset('home'); });

// zapis i wczytanie
await ev(() => document.querySelector('[data-a="go"][data-k="save"]').click());
await page.waitForTimeout(500);
await click('[data-a="sv.slot"][data-k="1"]');
await page.waitForTimeout(400);
if (await page.locator('.ov.show [data-a="ui.confirmYes"]').count()) await click('.ov.show [data-a="ui.confirmYes"]');
await page.waitForTimeout(600);
ok('zapis w slocie 1', /Zapisano/.test(await page.locator('#toast').textContent()));
const dayBefore = (await G()).day;
await ev(async () => { const ui = await import('./js/ui/ui.js'); ui.reset('menu'); });
await page.waitForTimeout(300);
await click('[data-a="menu.load"]');
await page.waitForTimeout(500);
await click('[data-a="load.slot"][data-k="1"]');
await page.waitForTimeout(300);
if (await page.locator('.ov.show [data-a="ui.confirmYes"]').count()) await click('.ov.show [data-a="ui.confirmYes"]');
await page.waitForSelector('.dash-head');
ok('wczytanie zapisu', (await G()).day === dayBefore);

// mecz: zmiany i taktyka w trakcie
for (let i = 0; i < 30; i++) {
  if (await page.locator('[data-a="pm.live"]').count()) break;
  if (await page.locator('.ov.show .m-actions .btn').count()) { const b = page.locator('.ov.show .m-actions .btn'); await b.nth((await b.count()) - 1).click(); await page.waitForTimeout(200); continue; }
  if (await page.locator('[data-a="sq.confirm"]').count()) { await click('[data-a="sq.confirm"]'); continue; }
  if (await page.locator('[data-a="pr.greetPick"]').count()) { await click('[data-a="pr.greetPick"]'); await click('[data-a="pr.greet"]'); continue; }
  if (await page.locator('[data-a="pr.pick"]').count()) { await click('[data-a="pr.pick"]'); await click('[data-a="pr.next"]'); continue; }
  if (await page.locator('[data-a="flow.advance"]').count()) { await click('[data-a="flow.advance"]'); await page.waitForTimeout(300); }
}
await click('[data-a="pm.live"]');
await page.waitForTimeout(1200);
await click('[data-a="mt.play"]'); // pauza
await click('[data-a="mt.subs"]');
await click('.ov.show [data-a="mt.subOut"]', 9);
await click('.ov.show [data-a="mt.subIn"]', 2);
await click('.ov.show [data-a="mt.subDo"]');
await page.waitForTimeout(300);
const subsLeft = await page.locator('#mt-subs').textContent();
ok('zmiana w meczu: ' + subsLeft, /\(4\)/.test(subsLeft));
await page.screenshot({ path: `${OUT}/t2-subs.png` });
await click('.ov.show [data-a="ui.close"]');
await click('[data-a="mt.tactics"]');
await click('.ov.show [data-a="mt.tac"][data-k="style"][data-v="4"]');
await click('.ov.show [data-a="mt.tacF"][data-k="3-5-2"]');
await page.screenshot({ path: `${OUT}/t2-match-tactics.png` });
await click('.ov.show [data-a="ui.close"]');
await click('[data-a="mt.tab"][data-k="lineups"]');
await page.screenshot({ path: `${OUT}/t2-lineups.png` });
await click('[data-a="mt.tab"][data-k="stats"]');
await click('[data-a="mt.end"]');
await click('.ov.show [data-a="mt.endNow"]');
await page.waitForSelector('[data-a="mt.summary"]', { timeout: 30000 });
await page.screenshot({ path: `${OUT}/t2-match-end.png` });
await click('[data-a="mt.summary"]');
ok('podsumowanie po symulacji', await page.locator('.score .sc').count() > 0);
await click('[data-a="mt.home"]');

// edytor
await ev(async () => { const ui = await import('./js/ui/ui.js'); ui.closeAllOverlays(); ui.reset('menu'); });
await click('[data-a="menu.editor"]');
await click('[data-a="ed.nat"][data-k="POL"]');
await page.waitForSelector('[data-a="ed.player"]', { timeout: 10000 });
await click('[data-a="ed.player"]');
await page.fill('#ed-fn', 'Robert');
await page.fill('#ed-ln', 'Testowski');
await click('.ov.show [data-a="ed.save"]');
ok('edytor – zapis zmian', await page.locator('.tag.acc', { hasText: 'edytowany' }).count() > 0);
await page.screenshot({ path: `${OUT}/t2-editor.png` });

console.log(results.join('\n'));
console.log('błędy konsoli:', errors.length ? errors.join('\n') : 'brak');
await browser.close();

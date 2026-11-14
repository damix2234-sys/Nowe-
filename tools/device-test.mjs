// Test gry na urządzeniu z Androidem (emulator w GitHub Actions lub telefon przez adb).
// Uruchamia zainstalowane APK, steruje grą przez WebView (Playwright) i robi zrzuty
// prawdziwego ekranu urządzenia (screencap).
//   node tools/device-test.mjs [katalog-wyników]
import fs from 'fs';
import path from 'path';
import { _android as android } from 'playwright-core';

const OUT = process.argv[2] || 'device-out';
const PKG = 'pl.selekcjoner.gra';
fs.mkdirSync(OUT, { recursive: true });

const report = { ok: false, checks: [], errors: [], shots: [], info: {} };
const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);
const check = (name, ok, extra = '') => { report.checks.push({ name, ok: !!ok, extra }); log(ok ? 'OK  ' : 'BŁĄD', name, extra); };
const save = () => fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let device, page, nShot = 0;
async function shot(name) {
  try {
    const buf = await device.screenshot();
    const file = `${String(++nShot).padStart(2, '0')}-${name}.png`;
    fs.writeFileSync(path.join(OUT, file), buf);
    report.shots.push(file);
    log('zrzut', file);
  } catch (e) { log('zrzut nieudany', name, e.message); }
}
const sh = async (cmd) => (await device.shell(cmd)).toString().trim();
const has = async (sel) => (await page.locator(sel).count()) > 0;
async function click(sel, wait = 250) {
  await page.locator(sel).first().click({ timeout: 8000 });
  await page.waitForTimeout(wait);
}

async function connectPage() {
  const wv = await device.webView({ pkg: PKG }, { timeout: 90000 });
  const p = await wv.page();
  p.on('console', (m) => { if (m.type() === 'error') report.errors.push('console: ' + m.text()); });
  p.on('pageerror', (e) => report.errors.push('pageerror: ' + e.message));
  return p;
}

// Jeden krok pętli gry – obsługa okien, powołań, konferencji i przejście do meczu.
async function stepGame() {
  if (await has('.ov.show')) {
    const btn = page.locator('.ov.show .m-actions .btn');
    const n = await btn.count();
    if (n) { await btn.nth(n - 1).click(); await page.waitForTimeout(300); return 'okno'; }
    if (await has('.ov.show [data-a="ui.close"]')) { await click('.ov.show [data-a="ui.close"]'); return 'zamknij'; }
  }
  if (await has('[data-a="tut.next"]')) { await click('[data-a="tut.end"]'); return 'samouczek'; }
  if (await has('[data-a="sq.confirm"]')) { await click('[data-a="sq.confirm"]', 400); return 'powołania'; }
  if (await has('[data-a="pr.greetPick"]')) { await click('[data-a="pr.greetPick"]'); await click('[data-a="pr.greet"]'); return 'powitanie'; }
  if (await has('[data-a="pr.pick"]')) { await click('[data-a="pr.pick"]'); await click('[data-a="pr.next"]'); return 'konferencja'; }
  if (await has('[data-a="pm.live"]')) return 'przedmeczowy';
  if (await has('[data-a="flow.advance"]')) { await click('[data-a="flow.advance"]', 400); return 'dalej'; }
  if (await has('[data-a="ui.back"]')) { await click('[data-a="ui.back"]'); return 'wstecz'; }
  return 'nic';
}

async function main() {
  const devices = await android.devices();
  check('urządzenie widoczne przez adb', devices.length > 0, `${devices.length}`);
  device = devices[0];
  report.info.model = device.model();
  report.info.android = await sh('getprop ro.build.version.release');
  report.info.sdk = await sh('getprop ro.build.version.sdk');
  report.info.screen = await sh('wm size');
  report.info.density = await sh('wm density');
  log('urządzenie', report.info);

  await sh(`am force-stop ${PKG}`);
  await sh(`am start -n ${PKG}/.MainActivity`);
  await sleep(2500);
  await shot('start');
  page = await connectPage();
  report.info.userAgent = await page.evaluate(() => navigator.userAgent);
  report.info.viewport = await page.evaluate(() => `${innerWidth}x${innerHeight} @${devicePixelRatio}`);
  log('WebView', report.info.userAgent, report.info.viewport);

  await page.waitForSelector('.title-screen', { timeout: 30000 });
  await page.waitForTimeout(600);
  await shot('menu');
  check('ekran tytułowy', true);

  // nowa kariera
  await click('[data-a="menu.new"]', 500);
  await shot('nowa-gra');
  await page.fill('[data-input="ng.name"]', 'Test Emulator');
  await click('[data-a="ng.start"]', 800);
  await page.waitForSelector('.dash-head', { timeout: 30000 });
  await page.waitForTimeout(500);
  await shot('pulpit');
  check('pulpit po starcie kariery', await has('.dash-head'));

  // przycisk systemowy WSTECZ: kadra -> pulpit
  await page.evaluate(() => document.querySelector('[data-a="go"][data-k="squad"]')?.click());
  await page.waitForTimeout(600);
  await shot('kadra');
  await sh('input keyevent 4');
  await page.waitForTimeout(900);
  check('systemowy przycisk wstecz wraca na pulpit', await has('.dash-head'));

  // aplikacja w tle i powrót
  await sh('input keyevent 3');
  await sleep(1500);
  await sh(`am start -n ${PKG}/.MainActivity`);
  await sleep(1500);
  check('powrót z tła zachowuje stan', await has('.dash-head'));

  // do pierwszego meczu
  const steps = [];
  for (let i = 0; i < 90; i++) {
    const r = await stepGame();
    steps.push(r);
    if (r === 'przedmeczowy') break;
    if (steps.length === 3) await shot('pierwsze-zdarzenie');
  }
  log('kroki:', steps.join(' | '));
  check('dotarcie do meczu', steps[steps.length - 1] === 'przedmeczowy', steps.length + ' kroków');
  await shot('przed-meczem');

  // mecz na żywo
  await click('[data-a="pm.live"]', 1200);
  check('ekran meczu', await has('[data-a="mt.play"]'));
  const canvas = await has('canvas#mt-pitch');
  check('boisko 2D (canvas)', canvas);
  for (let i = 0; i < 10; i++) {
    await page.waitForTimeout(1600);
    if (await has('.ov.show')) { await shot('mecz-okno'); break; }
    await shot(`mecz-${i + 1}`);
  }
  if (canvas) {
    const st = await page.evaluate(() => (window.__pitch ? window.__pitch.debugState() : null));
    report.info.pitch = st;
    check('animacja 2D działa', st && st.frames > 30, st ? `klatki: ${st.frames}` : 'brak');
  }
  // szybciej i do przerwy / końca
  for (let k = 0; k < 2; k++) await click('[data-a="mt.speed"]', 200);
  await page.waitForTimeout(4000);
  await shot('mecz-szybciej');
  // symulacja do końca
  if (await has('.ov.show')) await click('.ov.show [data-a="ui.close"]');
  if (await has('#mt-banner [data-a="mt.play"]')) await click('#mt-banner [data-a="mt.play"]');
  await click('[data-a="mt.end"]', 400);
  if (await has('.ov.show [data-a="mt.endNow"]')) await click('.ov.show [data-a="mt.endNow"]', 800);
  await page.waitForSelector('[data-a="mt.summary"]', { timeout: 20000 });
  await shot('mecz-koniec');
  await click('[data-a="mt.summary"]', 600);
  await shot('podsumowanie');
  check('podsumowanie meczu', await has('[data-a="mt.home"]'));
  await click('[data-a="mt.home"]', 600);
  for (let i = 0; i < 12; i++) { const r = await stepGame(); if (r === 'nic' || r === 'dalej' || r === 'przedmeczowy') break; }
  await shot('po-meczu');

  report.ok = report.checks.every((c) => c.ok) && report.errors.length === 0;
}

try {
  await main();
} catch (e) {
  report.errors.push('wyjątek testu: ' + (e && e.stack || e));
  log('wyjątek', e);
  if (device) await shot('blad');
} finally {
  save();
  log('błędy:', report.errors.length ? report.errors.join('\n') : 'brak');
  log('wynik:', report.ok ? 'SUKCES' : 'PORAŻKA');
  try { if (device) await device.close(); } catch (e) { /* ignoruj */ }
  process.exit(report.ok ? 0 : 1);
}

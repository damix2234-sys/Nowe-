// Generuje ikony PWA i Androida z logo SVG: node tools/make-icons.mjs
import { createRequire } from 'module';
import { writeFileSync, mkdirSync } from 'fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const OUT = process.argv[2] || 'tools/.icons';
mkdirSync(OUT, { recursive: true });

const crest = (stroke = 5) => `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e2ff6e"/><stop offset="1" stop-color="#78bf18"/></linearGradient></defs>
<path d="M60 6 L104 21 V57 C104 85 85 103 60 114 C35 103 16 85 16 57 V21 Z" fill="#0f1c18" stroke="url(#g)" stroke-width="${stroke}"/>
<path d="M60 22 V100" stroke="#24433a" stroke-width="3"/><circle cx="60" cy="60" r="19" fill="none" stroke="#24433a" stroke-width="3"/>
<path d="M60 39 l5.3 11.2 12.2 1.6 -9 8.5 2.2 12.1 -10.7-5.9 -10.7 5.9 2.2-12.1 -9-8.5 12.2-1.6z" fill="url(#g)"/>
<path d="M34 92 h52" stroke="url(#g)" stroke-width="4" stroke-linecap="round"/>`;

// pełna ikona: tło + tarcza (scale = udział tarczy w ikonie)
const full = (scale, bgRound = 0) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="1024" height="1024">
<defs><radialGradient id="bg" cx="50%" cy="35%" r="75%"><stop offset="0" stop-color="#173027"/><stop offset="1" stop-color="#08110e"/></radialGradient></defs>
<rect width="120" height="120" rx="${bgRound}" fill="url(#bg)"/>
<g transform="translate(60 60) scale(${scale}) translate(-60 -60)">${crest(5)}</g></svg>`;
const fg = (scale) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="1024" height="1024"><g transform="translate(60 60) scale(${scale}) translate(-60 -60)">${crest(5)}</g></svg>`;
const splash = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="1024" height="1024"><g transform="translate(60 52) scale(0.62) translate(-60 -60)">${crest(4)}</g>
<text x="60" y="104" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="900" font-size="9.5" letter-spacing="0.8" fill="#c6f432">SELEKCJONER</text></svg>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1024, height: 1024 } });
async function render(name, svg, transparent = true) {
  await page.setContent(`<html><body style="margin:0;background:${transparent ? 'transparent' : '#08110e'}">${svg}</body></html>`);
  await page.locator('svg').screenshot({ path: `${OUT}/${name}.png`, omitBackground: transparent });
}
await render('icon-full', full(0.86, 0));
await render('icon-rounded', full(0.8, 26));
await render('icon-maskable', full(0.62, 0));
await render('fg', fg(0.6));
await render('splash-logo', splash);
await browser.close();
console.log('ok', OUT);

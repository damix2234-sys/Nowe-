// Proceduralne awatary (płaskie portrety) generowane z ziarna, własna oprawa graficzna gry.
import { mkRng } from '../core/util.js';

export const SKIN = ['#F6D5B8', '#EEC39F', '#E2AF86', '#CF9A6E', '#B47D52', '#94613D', '#74472A', '#5A3620'];
export const HAIR = ['#21160F', '#3B2618', '#5E3B22', '#8A5A30', '#B9874D', '#DDB66A', '#151515', '#7E2F1A'];
const GREY = ['#9A9A9A', '#BDBDBD', '#D8D8D8'];
const BG = ['#1F3B33', '#24324A', '#3A2A44', '#43331F', '#1E3C48', '#2E3A1F', '#40252A', '#253E2E'];
const SHIRT = ['#C6F432', '#3D7BFF', '#FF5D5D', '#F5B83D', '#2DD4BF', '#E8EEF0', '#7C5CFF', '#1F2937', '#FF8A3D'];

export function avatar(seed, opts = {}) {
  const r = mkRng((seed >>> 0) + 7);
  const pick = (a) => a[Math.floor(r() * a.length)];
  const skin = opts.skin || pick(SKIN);
  const old = opts.old ?? r() < 0.15;
  let hair = old ? pick(GREY) : pick(HAIR);
  if (opts.hairColor != null) hair = HAIR[opts.hairColor] || hair;
  const bg = opts.bg || pick(BG);
  const shirt = opts.shirt || pick(SHIRT);
  let style = opts.bald ? 3 : Math.floor(r() * 7);
  if (opts.hairStyle != null) style = opts.hairStyle;
  let beard = r() < (opts.beard ?? 0.28);
  if (opts.beardOn != null) beard = opts.beardOn;
  let glasses = r() < (opts.glasses ?? 0.18);
  if (opts.glassesOn != null) glasses = opts.glassesOn;
  const smile = r() < 0.6;
  const rx = 20 + r() * 4, ry = 24 + r() * 3;
  const cy = 46;
  const top = cy - ry;
  let back = '', front = '';
  switch (style) {
    case 0: front = `<path d="M${50 - rx} ${cy - 4} Q${50 - rx} ${top - 4} 50 ${top - 5} Q${50 + rx} ${top - 4} ${50 + rx} ${cy - 4} Q${50 + rx - 3} ${top + 8} 50 ${top + 7} Q${50 - rx + 3} ${top + 8} ${50 - rx} ${cy - 4}Z" fill="${hair}"/>`; break;
    case 1: front = `<path d="M${50 - rx - 1} ${cy - 2} Q${50 - rx - 2} ${top - 6} ${52} ${top - 6} Q${50 + rx + 2} ${top - 4} ${50 + rx + 1} ${cy - 6} Q${58} ${top + 4} ${44} ${top + 9} Q${50 - rx + 4} ${top + 12} ${50 - rx - 1} ${cy - 2}Z" fill="${hair}"/>`; break;
    case 2: front = `<path d="M${50 - rx + 1} ${cy - 8} Q50 ${top - 3} ${50 + rx - 1} ${cy - 8} Q50 ${top + 4} ${50 - rx + 1} ${cy - 8}Z" fill="${hair}" opacity=".75"/>`; break;
    case 3: front = `<path d="M${50 - rx} ${cy - 2} q-1 -6 2 -9 M${50 + rx} ${cy - 2} q1 -6 -2 -9" stroke="${hair}" stroke-width="3" fill="none" opacity=".8"/>`; break;
    case 4: {
      let c = '';
      for (let i = 0; i < 9; i++) {
        const a = Math.PI * (0.05 + (i / 8) * 0.9);
        c += `<circle cx="${50 - Math.cos(a) * (rx - 1)}" cy="${cy - 6 - Math.sin(a) * (ry - 2)}" r="${6 + r() * 2}" fill="${hair}"/>`;
      }
      front = c; break;
    }
    case 5:
      back = `<path d="M${50 - rx - 3} ${cy + 18} Q${50 - rx - 6} ${top - 6} 50 ${top - 6} Q${50 + rx + 6} ${top - 6} ${50 + rx + 3} ${cy + 18}Z" fill="${hair}"/>`;
      front = `<path d="M${50 - rx} ${cy - 3} Q50 ${top - 8} ${50 + rx} ${cy - 3} Q50 ${top + 6} ${50 - rx} ${cy - 3}Z" fill="${hair}"/>`; break;
    default:
      front = `<path d="M${50 - rx + 2} ${cy - 6} Q${48} ${top - 12} ${50 + rx - 2} ${cy - 6} Q${52} ${top + 5} ${50 - rx + 2} ${cy - 6}Z" fill="${hair}"/>`;
  }
  const eyeY = cy - 1;
  const browY = eyeY - 6;
  const mouthY = cy + 13;
  const beardSvg = beard ? `<path d="M${50 - rx + 2} ${cy + 2} Q${50 - rx + 3} ${cy + ry + 3} 50 ${cy + ry + 3} Q${50 + rx - 3} ${cy + ry + 3} ${50 + rx - 2} ${cy + 2} Q${50 + rx - 6} ${cy + 18} 50 ${cy + 17} Q${50 - rx + 6} ${cy + 18} ${50 - rx + 2} ${cy + 2}Z" fill="${hair}" opacity=".85"/>` : '';
  const glassSvg = glasses ? `<g fill="none" stroke="#1b1b1b" stroke-width="1.8"><rect x="${50 - 15}" y="${eyeY - 5}" width="11" height="9" rx="3"/><rect x="${50 + 4}" y="${eyeY - 5}" width="11" height="9" rx="3"/><path d="M${50 - 4} ${eyeY - 1}h8"/></g>` : '';
  const mouth = smile
    ? `<path d="M${50 - 6} ${mouthY - 1} Q50 ${mouthY + 5} ${50 + 6} ${mouthY - 1}" stroke="#5a2b22" stroke-width="2" fill="${beard ? 'none' : '#fff'}" stroke-linecap="round"/>`
    : `<path d="M${50 - 5} ${mouthY} h10" stroke="#5a2b22" stroke-width="2" stroke-linecap="round"/>`;
  return `<svg class="avatar" viewBox="0 0 100 100" aria-hidden="true">
<rect width="100" height="100" rx="18" fill="${bg}"/>
${back}
<path d="M14 100 Q16 78 36 74 L64 74 Q84 78 86 100Z" fill="${shirt}"/>
<path d="M42 74 L50 84 L58 74Z" fill="${skin}" opacity=".9"/>
<rect x="${50 - 7}" y="${cy + ry - 8}" width="14" height="14" rx="5" fill="${skin}" filter="brightness(.92)"/>
<ellipse cx="${50 - rx}" cy="${cy + 1}" rx="3.5" ry="5" fill="${skin}"/>
<ellipse cx="${50 + rx}" cy="${cy + 1}" rx="3.5" ry="5" fill="${skin}"/>
<ellipse cx="50" cy="${cy}" rx="${rx}" ry="${ry}" fill="${skin}"/>
${beardSvg}
${front}
<path d="M${50 - 13} ${browY} q4 -2.5 8 0 M${50 + 5} ${browY} q4 -2.5 8 0" stroke="${hair === GREY[2] ? '#888' : hair}" stroke-width="2.2" fill="none" stroke-linecap="round"/>
<circle cx="${50 - 9}" cy="${eyeY}" r="2.4" fill="#1b1b1b"/><circle cx="${50 + 9}" cy="${eyeY}" r="2.4" fill="#1b1b1b"/>
<path d="M50 ${eyeY + 2} q-2.5 6 0 7" stroke="#000" stroke-opacity=".25" stroke-width="1.8" fill="none" stroke-linecap="round"/>
${mouth}
${glassSvg}
</svg>`;
}

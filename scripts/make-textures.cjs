/**
 * Generates the marble board textures and the cedar frame texture as JPEGs
 * in public/textures/. Run once; the output is committed.
 *
 *   node scripts/make-textures.cjs
 *
 * Needs Playwright with Chromium (npm i -g playwright && npx playwright install chromium).
 * How it works: each texture is an SVG using feTurbulence (Perlin noise) filters.
 * Chromium renders it once and we screenshot it, so the browser never has to
 * compute the noise at runtime (that would be slow on phones).
 */
const { chromium } = require('playwright');
const path = require('node:path');
const fs = require('node:fs');

const SIZE = 1200; // px; the board shows 1/8 of this per square
const OUT = path.join(__dirname, '..', 'public', 'textures');

/** Marble: a base colour, soft cloudy variation, and thin veins along noise "creases". */
function marble({ base, cloud, vein, veinOpacity, seed, freq }) {
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}">
  <filter id="cloud" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.003 0.006" numOctaves="5" seed="${seed}"/>
    <feColorMatrix type="matrix" values="0 0 0 0 ${cloud[0]}  0 0 0 0 ${cloud[1]}  0 0 0 0 ${cloud[2]}  0.9 0 0 0 -0.35"/>
  </filter>
  <filter id="veins" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="turbulence" baseFrequency="${freq}" numOctaves="6" seed="${seed + 7}"/>
    <!-- turbulence is ~0 along creases: alpha = 1 - R, then sharpen so only creases survive -->
    <feColorMatrix type="matrix" values="0 0 0 0 ${vein[0]}  0 0 0 0 ${vein[1]}  0 0 0 0 ${vein[2]}  -1 0 0 0 1"/>
    <feComponentTransfer><feFuncA type="gamma" amplitude="${veinOpacity}" exponent="9" offset="0"/></feComponentTransfer>
    <feGaussianBlur stdDeviation="0.6"/>
  </filter>
  <rect width="100%" height="100%" fill="rgb(${base.map((c) => Math.round(c * 255)).join(',')})"/>
  <rect width="100%" height="100%" filter="url(#cloud)"/>
  <rect width="100%" height="100%" filter="url(#veins)"/>
</svg>`;
}

/** Cedar: warm reddish-brown with long, wavy grain lines. */
function cedar({ seed }) {
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}">
  <filter id="grain" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.0025 0.06" numOctaves="5" seed="${seed}"/>
    <feColorMatrix type="matrix" values="0 0 0 0 0.24  0 0 0 0 0.09  0 0 0 0 0.04  3.2 0 0 0 -1.25"/>
  </filter>
  <filter id="pores" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="turbulence" baseFrequency="0.001 0.35" numOctaves="2" seed="${seed + 3}"/>
    <feColorMatrix type="matrix" values="0 0 0 0 0.35  0 0 0 0 0.15  0 0 0 0 0.07  -1.4 0 0 0 0.75"/>
  </filter>
  <linearGradient id="tone" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#8f4425"/><stop offset="0.35" stop-color="#b0603a"/><stop offset="0.6" stop-color="#a1532f"/><stop offset="1" stop-color="#7e3a1f"/>
  </linearGradient>
  <rect width="100%" height="100%" fill="url(#tone)"/>
  <rect width="100%" height="100%" filter="url(#pores)"/>
  <rect width="100%" height="100%" filter="url(#grain)"/>
</svg>`;
}

const TEXTURES = {
  // White Carrara: near-white with grey veins
  'marble-light': marble({ base: [0.95, 0.94, 0.92], cloud: [0.80, 0.80, 0.80], vein: [0.42, 0.43, 0.46], veinOpacity: 0.8, seed: 3, freq: '0.004 0.009' }),
  // Green Verde: deep green with pale veins
  'marble-dark': marble({ base: [0.20, 0.36, 0.30], cloud: [0.10, 0.22, 0.17], vein: [0.82, 0.88, 0.84], veinOpacity: 0.75, seed: 11, freq: '0.005 0.008' }),
  cedar: cedar({ seed: 5 }),
};

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  for (const [name, svg] of Object.entries(TEXTURES)) {
    await page.setContent(`<body style="margin:0">${svg}</body>`);
    const el = await page.$('svg');
    const file = path.join(OUT, `${name}.jpg`);
    await el.screenshot({ path: file, type: 'jpeg', quality: 82 });
    console.log(`${file}  ${(fs.statSync(file).size / 1024).toFixed(0)} KB`);
  }
  await browser.close();
})();

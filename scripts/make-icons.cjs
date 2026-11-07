/**
 * Renders public/icon.svg (the cigar knight) to the PNG sizes phones use for
 * "Add to Home Screen". Run once after changing the icon; output is committed.
 *
 *   node scripts/make-icons.cjs
 *
 * Needs Playwright with Chromium, like make-textures.cjs.
 */
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const PUBLIC = path.join(__dirname, '..', 'public');
const svg = fs.readFileSync(path.join(PUBLIC, 'icon.svg'), 'utf8');
const SIZES = { 'icon-192.png': 192, 'icon-512.png': 512, 'apple-touch-icon.png': 180 };

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  for (const [name, size] of Object.entries(SIZES)) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<body style="margin:0">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body>`);
    await page.screenshot({ path: path.join(PUBLIC, name), clip: { x: 0, y: 0, width: size, height: size } });
    console.log(`${name}  ${(fs.statSync(path.join(PUBLIC, name)).size / 1024).toFixed(0)} KB`);
  }
  await browser.close();
})();

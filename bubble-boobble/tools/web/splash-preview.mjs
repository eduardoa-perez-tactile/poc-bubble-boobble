/** Capture only the requested browser splash; never start or play the game. */
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { resolve, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { webContentTypes } from './content-types.mjs';

const project = fileURLToPath(new URL('../..', import.meta.url));
const site = resolve(project, 'build/web/site');
const out = resolve(project, 'artifacts/browser-splash');
mkdirSync(out, { recursive: true });
const manifest = JSON.parse(readFileSync(resolve(site, 'web-build.json'), 'utf8'));
const heldFile = manifest.files[Math.min(1, manifest.files.length - 1)].path;
const server = createServer((request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const file = resolve(site, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (relative(site, file).startsWith('..') || !statSync(file).isFile()) throw Error('Not found');
    response.setHeader('Content-Type', webContentTypes[extname(file)] ?? 'application/octet-stream');
    response.end(readFileSync(file));
  } catch { response.writeHead(404).end(); }
});
let browser;
let releaseDownload;
const held = new Promise(resolve => { releaseDownload = resolve; });
const report = { ok: false, checks: [], screenshots: [] };
try {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--enable-unsafe-webgpu', '--use-angle=metal', '--mute-audio'],
  });
  const page = await browser.newPage({ viewport: { width: 1024, height: 768 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  let intercepted;
  const requestHeld = new Promise(resolve => { intercepted = resolve; });
  await page.route(`**/game/${heldFile}`, async route => { intercepted(); await held; await route.continue(); });
  await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'domcontentloaded' });
  await Promise.race([requestHeld, new Promise((_, reject) => setTimeout(() => reject(Error('Engine never requested the game pack')), 60000).unref())]);
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.querySelectorAll('#launch img')].map(image => image.decode()));
  });
  const shot = async name => {
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.screenshot({ path: resolve(out, `${name}.png`) });
    report.screenshots.push(`artifacts/browser-splash/${name}.png`);
  };
  assert.equal(await page.locator('#start').isDisabled(), true);
  assert.equal(await page.locator('#launch').getAttribute('data-phase'), 'loading');
  await shot('loading');
  releaseDownload();
  await page.locator('#start:enabled').waitFor({ timeout: 120000 });
  await page.waitForFunction(() => document.querySelector('#launch').dataset.phase === 'ready');
  assert.equal(await page.locator('#load-progress').evaluate(node => node.value), 1);
  assert.equal(await page.locator('#status').textContent(), 'Ready');
  report.checks.push('Actual engine download, renderer preparation and ready state; Start stays disabled until ready');
  for (const [width, height] of [[1024, 768], [1680, 720], [800, 480], [375, 812], [320, 568]]) {
    await page.setViewportSize({ width, height });
    const layout = await page.evaluate(() => {
      const launch = document.querySelector('#launch');
      const rect = document.querySelector('#start').getBoundingClientRect();
      return { overflow: launch.scrollWidth > launch.clientWidth, x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom, images: [...document.querySelectorAll('#launch img')].every(image => image.complete && image.naturalWidth > 0), font: document.fonts.check('12px "Bubble Arcade"') };
    });
    assert.equal(layout.overflow, false, `Horizontal overflow at ${width}x${height}`);
    assert.equal(layout.images && layout.font, true, 'All original sprites, logo and arcade font must load');
    assert.ok(layout.x >= 0 && layout.right <= width && layout.y >= 0 && layout.bottom <= height, `Start must be visible at ${width}x${height}`);
    await shot(`ready-${width}x${height}`);
  }
  report.checks.push('No horizontal overflow; Start visible at desktop, ultrawide, short landscape and two narrow portrait sizes');
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.locator('.splash-controls summary').focus();
  await page.keyboard.press('Enter');
  assert.equal(await page.locator('.splash-controls').getAttribute('open') !== null, true);
  await page.locator('#launch').evaluate(node => { node.scrollTop = 0; });
  assert.ok(await page.locator('.splash-logo').evaluate(node => node.getBoundingClientRect().top >= 0), 'Expanded instructions must scroll from the top without clipping the logo');
  await shot('controls');
  await page.setViewportSize({ width: 320, height: 568 });
  assert.equal(await page.locator('#launch').evaluate(node => node.scrollWidth > node.clientWidth), false);
  await page.locator('.splash-shared-controls').scrollIntoViewIfNeeded();
  await shot('controls-narrow');
  report.checks.push('Keyboard opens How to Play; expanded controls scroll on narrow screens');
  await page.locator('.splash-controls').evaluate(node => { node.open = false; });
  await page.setViewportSize({ width: 1024, height: 768 });
  // Exercise the exact DOM changes used by the engine fail() path, including a failure after launch.
  await page.evaluate(() => { document.querySelector('#launch').hidden = true; });
  await page.evaluate(() => {
    document.querySelector('#launch').hidden = false;
    document.querySelector('#status').textContent = 'This game requires WebGPU. Open it in a supported browser over HTTPS or localhost.';
    document.querySelector('#start').hidden = true;
  });
  await page.waitForFunction(() => document.querySelector('#launch').dataset.phase === 'error');
  assert.equal(await page.locator('#load-progress').isVisible(), false);
  assert.equal(await page.locator('#start').isVisible(), false);
  await shot('unsupported-browser');
  report.checks.push('Engine errors stay readable and hide both Start and progress, including after the launch overlay was hidden');
  assert.deepEqual(errors, []);
  report.ok = true;
} catch (error) {
  report.error = error.stack ?? String(error);
  process.exitCode = 1;
} finally {
  releaseDownload();
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
  writeFileSync(resolve(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
}

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const playwright = await import('playwright').catch(() => {
  if (!process.env.APPDATA) throw new Error('Playwright no está disponible para la prueba E2E.');
  return import(pathToFileURL(path.join(process.env.APPDATA, 'npm/node_modules/playwright/index.mjs')).href);
});
const { chromium } = playwright;
const root = process.cwd();
const server = createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(root) || !existsSync(file) || statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' }[path.extname(file)] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': mime }); createReadStream(file).pipe(res);
});
await new Promise((resolve) => server.listen(0, resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const chrome = process.env.CHROME_PATH || (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : null);
const browser = await chromium.launch({ headless: true, ...(chrome && existsSync(chrome) ? { executablePath: chrome } : {}), args: ['--autoplay-policy=no-user-gesture-required'] });
try {
  for (const [spot, streamId] of process.argv.includes('--map-only') ? [] : [['MorroGos', '2815'], ['Heliopolis', '2816']]) {
    const page = await browser.newPage();
    const segmentos = [];
    page.on('response', (r) => { if (/speed-.*\.ts/.test(r.url())) segmentos.push(r.url()); });
    await page.goto(`${base}/#/spot/${spot}`, { waitUntil: 'domcontentloaded' });
    const player = page.frameLocator('#cam iframe').frameLocator('#sky_player').locator('#player_vid');
    await player.waitFor({ timeout: 25000 });
    await page.waitForFunction(() => document.querySelector('#cam iframe')?.dataset.videoReady === 'true', null, { timeout: 30000 });
    const estado1 = await player.evaluate((v) => { v.controls = false; return { width: v.videoWidth, height: v.videoHeight, time: v.currentTime, paused: v.paused }; });
    const imagen1 = createHash('sha256').update(await player.screenshot()).digest('hex');
    await page.waitForTimeout(3500);
    const estado2 = await player.evaluate((v) => ({ time: v.currentTime, paused: v.paused }));
    const imagen2 = createHash('sha256').update(await player.screenshot()).digest('hex');
    assert.ok(estado1.width >= 640 && estado1.height >= 360, `${spot}: vídeo decodificado`);
    assert.ok(!estado1.paused && !estado2.paused && estado2.time - estado1.time >= 2, `${spot}: el vídeo avanza`);
    assert.notEqual(imagen1, imagen2, `${spot}: los fotogramas visibles cambian`);
    assert.ok(segmentos.some((url) => url.includes(`${streamId}speed-`)), `${spot}: llegan fragmentos de la playa correcta`);
    assert.ok(!segmentos.some((url) => url.includes('copyright_violation')), `${spot}: sin cortinilla de marca`);
    console.log(`OK ${spot}: playa visible en movimiento, ${estado1.width}x${estado1.height}, ${segmentos.length} fragmentos`);
    await page.close();
  }

  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, deviceScaleFactor: 2 });
  await page.addInitScript(() => { delete window.navigator.serviceWorker; });
  await page.goto(`${base}/#/mapa`, { waitUntil: 'domcontentloaded' });
  await page.locator('#map .leaflet-tile-pane').waitFor({ state: 'attached', timeout: 20000 });
  await page.waitForTimeout(1500);
  assert.equal(await page.locator('.mapa-full').evaluate((e) => e.classList.contains('modo-3d')), false, 'El mapa abre en 2D');
  assert.equal(await page.locator('#btn-3d').innerText(), '3D', 'El botón ofrece 3D');
  await page.locator('.capas-barra button[data-capa="oleaje"]').click();
  await page.locator('.capas-leyenda strong').waitFor({ timeout: 30000 });
  await page.waitForFunction(() => document.querySelectorAll('.capa-punto').length > 0 || /No se ha podido cargar/.test(document.querySelector('.capas-estado')?.textContent || ''), null, { timeout: 70000 });
  assert.ok(await page.locator('.capa-punto').count() > 0, `La capa debe mostrar valores: ${await page.locator('.capas-estado').innerText()}`);
  assert.match(await page.locator('.capas-leyenda').innerText(), /Oleaje.*m/);
  assert.equal(await page.locator('.capas-barra button[data-capa="oleaje"]').getAttribute('aria-pressed'), 'true');
  assert.ok(await page.locator('.capa-punto').count() <= 30, 'La malla no tapa el mapa en móvil');
  if (process.env.MAP_SCREENSHOT) await page.screenshot({ path: process.env.MAP_SCREENSHOT });
  console.log('OK mapa: 2D inicial y capa de oleaje legible en móvil');
  await page.close();
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

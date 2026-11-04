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
const { chromium, devices } = playwright;
const root = process.cwd();
const server = createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(root) || !existsSync(file) || statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' }[path.extname(file)] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': mime }); createReadStream(file).pipe(res);
});
await new Promise((resolve) => server.listen(0, resolve));
const base = process.env.TEST_BASE_URL?.replace(/\/$/, '') || `http://127.0.0.1:${server.address().port}`;
const chrome = process.env.CHROME_PATH || (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : null);
const browser = await chromium.launch({ headless: true, ...(chrome && existsSync(chrome) ? { executablePath: chrome } : {}) });
const device = process.argv.includes('--iphone') ? 'iPhone 13' : process.argv.includes('--android') ? 'Pixel 7' : null;
const gestureTest = process.argv.includes('--gesture-test');
const retryTest = process.argv.includes('--retry-test');
try {
  for (const [spot, streamId] of process.argv.includes('--map-only') ? [] : [['MorroGos', '2815'], ['Heliopolis', '2816']]) {
    const page = await browser.newPage(device ? devices[device] : {});
    let allowRequests = false;
    let routeCount = 0;
    if (retryTest) {
      await page.route(/^https:\/\/www\.skylinewebcams\.com\/webcam\//, (route) => {
        routeCount++;
        if (!allowRequests) route.abort();
        else route.continue();
      });
    }
    if (gestureTest) await page.addInitScript(() => {
      const play = HTMLMediaElement.prototype.play;
      let rejected = false;
      document.addEventListener('DOMContentLoaded', () => {
        const video = document.getElementById('player_vid');
        if (video) video.autoplay = false;
      });
      HTMLMediaElement.prototype.play = function () {
        if (this.id === 'player_vid' && !rejected) {
          rejected = true;
          return Promise.reject(new DOMException('El navegador requiere un toque', 'NotAllowedError'));
        }
        return play.call(this);
      };
    });
    const segmentos = [];
    page.on('response', (r) => { if (/speed-.*\.ts/.test(r.url())) segmentos.push(r.url()); });
    await page.goto(`${base}/#/spot/${spot}`, { waitUntil: 'domcontentloaded' });
    const player = page.frameLocator('#cam iframe').locator('#player_vid');
    await player.waitFor({ timeout: 25000 });
    if (retryTest) {
      const retry = page.frameLocator('#cam iframe').locator('#start');
      try { await retry.getByText('Reintentar directo').waitFor({ state: 'visible', timeout: 30000 }); }
      catch (error) { throw new Error(`${spot}: ${error.message}; peticiones=${routeCount}; botón=${JSON.stringify(await retry.evaluate((e) => ({ text: e.textContent, hidden: e.hidden })).catch(() => null))}; badge=${await page.locator('#cam .cam-badge').innerText()}`); }
      assert.match(await page.locator('#cam .cam-badge').innerText(), /Sin señal/);
      allowRequests = true;
      await retry.click();
    }
    if (gestureTest) {
      const start = page.frameLocator('#cam iframe').locator('#start');
      await start.waitFor({ state: 'visible', timeout: 30000 });
      assert.match(await page.locator('#cam .cam-badge').innerText(), /Toca para ver/);
      await start.click();
    }
    await page.waitForFunction(() => document.querySelector('#cam iframe')?.dataset.videoReady === 'true', null, { timeout: 30000 });
    const estado1 = await player.evaluate((v) => { v.controls = false; return { width: v.videoWidth, height: v.videoHeight, time: v.currentTime, paused: v.paused }; });
    const imagen1 = createHash('sha256').update(await player.screenshot()).digest('hex');
    await page.waitForTimeout(3500);
    const estado2 = await player.evaluate((v) => ({ time: v.currentTime, paused: v.paused }));
    const imagen2 = createHash('sha256').update(await player.screenshot()).digest('hex');
    if (process.env.CAM_SCREENSHOT_DIR) await player.screenshot({ path: path.join(process.env.CAM_SCREENSHOT_DIR, `${spot}.png`) });
    assert.ok(estado1.width >= 640 && estado1.height >= 360, `${spot}: vídeo decodificado`);
    assert.ok(!estado1.paused && !estado2.paused && estado2.time - estado1.time >= 2, `${spot}: el vídeo avanza (${JSON.stringify({ estado1, estado2, segmentos: segmentos.length })})`);
    assert.notEqual(imagen1, imagen2, `${spot}: los fotogramas visibles cambian`);
    assert.ok(segmentos.some((url) => url.includes(`${streamId}speed-`)), `${spot}: llegan fragmentos de la playa correcta`);
    assert.ok(!segmentos.some((url) => url.includes('copyright_violation')), `${spot}: sin cortinilla de marca`);
    console.log(`OK ${device || 'escritorio'} ${spot}: playa visible en movimiento, ${estado1.width}x${estado1.height}, ${segmentos.length} fragmentos`);
    await page.close();
  }

  if (!process.argv.includes('--cams-only')) {
  if (!process.argv.includes('--map-only')) {
    const page = await browser.newPage();
    await page.goto(`${base}/#/spot/Piramides`, { waitUntil: 'domcontentloaded' });
    const video = page.locator('#cam video');
    await video.waitFor({ timeout: 20000 });
    await page.waitForFunction(() => document.querySelector('#cam .cam-badge-directo')?.textContent.includes('En directo'), null, { timeout: 30000 });
    const first = await video.evaluate((v) => ({ width: v.videoWidth, height: v.videoHeight, time: v.currentTime }));
    await page.waitForTimeout(2500);
    const second = await video.evaluate((v) => ({ time: v.currentTime, paused: v.paused }));
    assert.ok(first.width >= 640 && first.height >= 360, 'HLS: vídeo decodificado');
    assert.ok(!second.paused && second.time - first.time >= 1, 'HLS: el directo avanza');
    console.log(`OK Grao: HLS en directo, ${first.width}x${first.height}`);
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

  const rewindPage = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, deviceScaleFactor: 2 });
  await rewindPage.goto(`${base}/#/spot/Piramides`, { waitUntil: 'domcontentloaded' });
  await rewindPage.waitForFunction(() => document.querySelectorAll('[data-clip]').length > 0, null, { timeout: 20000 });
  await rewindPage.locator('.spot-head .rating-pill').waitFor({ timeout: 30000 });
  await rewindPage.locator('#rewind-toggle').click();
  assert.equal(await rewindPage.locator('#rewind-calendar-panel').isHidden(), true, 'El calendario empieza plegado en móvil');
  assert.ok(await rewindPage.locator('.rewind-day [data-clip]').count() > 0, 'Las horas siguen visibles sin calendario');
  const initialDay = await rewindPage.locator('.rewind-day-nav span').textContent();
  await rewindPage.locator('.rewind-day-nav button').first().click();
  assert.notEqual(await rewindPage.locator('.rewind-day-nav span').textContent(), initialDay, 'Se cambia de día sin abrir el calendario');
  assert.equal(await rewindPage.locator('#rewind-calendar-panel').isHidden(), true, 'Cambiar de día mantiene el calendario plegado');
  if (process.env.REWIND_SCREENSHOT) { await rewindPage.locator('#rewind-strip').scrollIntoViewIfNeeded(); await rewindPage.screenshot({ path: process.env.REWIND_SCREENSHOT }); }
  const toggle = rewindPage.locator('#rewind-calendar-toggle');
  assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
  await toggle.click();
  assert.equal(await rewindPage.locator('#rewind-calendar-panel').isVisible(), true, 'El calendario se despliega');
  assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
  await rewindPage.locator('.rewind-calendar [data-rewind-day]').first().click();
  assert.equal(await rewindPage.locator('#rewind-calendar-panel').isVisible(), true, 'La fecha elegida mantiene el calendario abierto');
  await rewindPage.locator('#rewind-calendar-toggle').click();
  assert.equal(await rewindPage.locator('#rewind-calendar-panel').isHidden(), true, 'El calendario se puede volver a ocultar');
  assert.ok(await rewindPage.locator('.rewind-day [data-clip]').count() > 0, 'Las horas permanecen al ocultarlo');
  assert.equal(await rewindPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'La página no desborda a lo ancho');
  console.log('OK Rewind: calendario plegable, horas visibles y sin desbordamiento móvil');
  await rewindPage.close();
  }
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

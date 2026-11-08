import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const playwright = await import('playwright').catch(() => {
  if (!process.env.APPDATA) throw new Error('Playwright no está disponible.');
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
const base = process.env.TEST_BASE_URL?.replace(/\/$/, '') || `http://127.0.0.1:${server.address().port}`;
const chrome = process.env.CHROME_PATH || (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : null);
const browser = await chromium.launch({ headless: true, ...(chrome && existsSync(chrome) ? { executablePath: chrome } : {}) });

try {
  // 1. Probar cámara estándar (Pirámides)
  {
    const page = await browser.newPage();
    await page.goto(`${base}/#/spot/Piramides`, { waitUntil: 'domcontentloaded' });
    const video = page.locator('#cam video');
    await video.waitFor({ timeout: 25000 });
    await page.waitForFunction(() => document.querySelector('#cam .cam-badge-directo')?.textContent.includes('En directo'), null, { timeout: 30000 });
    
    const t1 = await video.evaluate((v) => v.currentTime);
    assert.ok(t1 > 0, 'Vídeo reproduciendo inicialmente');
    console.log(`Paso 1 (Pirámides): Vídeo arrancado en directo (t = ${t1.toFixed(2)}s)`);

    // Simular cambio de pestaña a segundo plano
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { value: true, configurable: true });
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForTimeout(1500);

    const pausedInBg = await video.evaluate((v) => v.paused);
    assert.ok(pausedInBg, 'El vídeo se pausa limpiamente al cambiar de pestaña para ahorrar datos');
    console.log('Paso 2 (Pirámides): Pestaña oculta detectada, vídeo pausado sin errores');

    // Simular regreso a la pestaña
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { value: false, configurable: true });
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await page.waitForTimeout(3000);
    const estadoVuelta = await video.evaluate((v) => ({ paused: v.paused, t: v.currentTime }));
    assert.ok(!estadoVuelta.paused, 'El vídeo se reanuda automáticamente al regresar');
    assert.ok(estadoVuelta.t > t1, 'El vídeo sigue avanzando tras volver de la pestaña');
    console.log(`Paso 3 (Pirámides): Directo renovado al volver (t = ${estadoVuelta.t.toFixed(2)}s)`);

    // Simular pausa manual y posterior Play
    await video.evaluate((v) => v.pause());
    await page.waitForTimeout(1500);
    await video.evaluate((v) => v.play());
    await page.waitForTimeout(2500);

    const estadoPlay = await video.evaluate((v) => ({ paused: v.paused, t: v.currentTime }));
    assert.ok(!estadoPlay.paused && estadoPlay.t > estadoVuelta.t, 'Al pulsar Play tras pausa se renueva y reproduce sin quedarse en búfer');
    console.log(`Paso 4 (Pirámides): Pulsar Play reanuda el directo inmediatamente (t = ${estadoPlay.t.toFixed(2)}s)`);
    await page.close();
  }

  // 2. Probar Morro de Gos (cámara oficial Oropesa Costa 1080p en directo)
  {
    const page = await browser.newPage();
    await page.goto(`${base}/#/spot/MorroGos`, { waitUntil: 'domcontentloaded' });
    const video = page.locator('#cam video');
    await video.waitFor({ timeout: 25000 });
    await page.waitForFunction(() => document.querySelector('#cam .cam-badge-directo')?.textContent.includes('En directo'), null, { timeout: 30000 });

    const t1 = await video.evaluate((v) => v.currentTime);
    assert.ok(t1 > 0, 'Vídeo MorroGos reproduciendo inicialmente');
    console.log(`Paso 5 (MorroGos): Vídeo arrancado en directo (t = ${t1.toFixed(2)}s)`);

    // Pausa prolongada (10s)
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { value: true, configurable: true });
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForTimeout(10000);

    // Regreso
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { value: false, configurable: true });
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await page.waitForTimeout(4000);
    const estadoVuelta = await video.evaluate((v) => ({ paused: v.paused, t: v.currentTime }));
    assert.ok(!estadoVuelta.paused, 'MorroGos se reanuda tras volver de pestaña');
    console.log(`Paso 6 (MorroGos): Petición renovada al volver (t = ${estadoVuelta.t.toFixed(2)}s)`);

    // Pausa manual y Play
    await video.evaluate((v) => v.pause());
    await page.waitForTimeout(3000);
    await video.evaluate((v) => v.play());
    await page.waitForTimeout(3000);

    const estadoPlay = await video.evaluate((v) => ({ paused: v.paused, t: v.currentTime }));
    assert.ok(!estadoPlay.paused, 'MorroGos reproduce sin quedarse en búfer al pulsar Play');
    console.log(`Paso 7 (MorroGos): Pulsar Play tras pausa renueva y reproduce (t = ${estadoPlay.t.toFixed(2)}s)`);
    await page.close();
  }

  // 3. Probar Heliópolis (cámara oficial Heliópolis Escola de Vela 1080p en directo)
  {
    const page = await browser.newPage();
    await page.goto(`${base}/#/spot/Heliopolis`, { waitUntil: 'domcontentloaded' });
    const video = page.locator('#cam video');
    await video.waitFor({ timeout: 25000 });
    await page.waitForFunction(() => document.querySelector('#cam .cam-badge-directo')?.textContent.includes('En directo'), null, { timeout: 30000 });

    const t1 = await video.evaluate((v) => v.currentTime);
    assert.ok(t1 > 0, 'Vídeo Heliopolis reproduciendo inicialmente');
    console.log(`Paso 8 (Heliópolis): Vídeo arrancado en directo (t = ${t1.toFixed(2)}s)`);

    // Pausa prolongada (10s)
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { value: true, configurable: true });
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForTimeout(10000);

    // Regreso
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { value: false, configurable: true });
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await page.waitForTimeout(4000);
    const estadoVuelta = await video.evaluate((v) => ({ paused: v.paused, t: v.currentTime }));
    assert.ok(!estadoVuelta.paused, 'Heliópolis se reanuda tras volver de pestaña');
    console.log(`Paso 9 (Heliópolis): Petición renovada al volver (t = ${estadoVuelta.t.toFixed(2)}s)`);

    // Pausa manual y Play
    await video.evaluate((v) => v.pause());
    await page.waitForTimeout(3000);
    await video.evaluate((v) => v.play());
    await page.waitForTimeout(4000);

    const estadoPlay = await video.evaluate((v) => ({ paused: v.paused, t: v.currentTime }));
    assert.ok(!estadoPlay.paused, 'Heliópolis reproduce sin quedarse en búfer al pulsar Play');
    console.log(`Paso 10 (Heliópolis): Pulsar Play tras pausa renueva y reproduce (t = ${estadoPlay.t.toFixed(2)}s)`);
    await page.close();
  }

  console.log('OK: Prueba de renovación de stream por cambio de pestaña y Play superada en todas las playas.');
} finally {
  await browser.close();
  if (server.listening) await new Promise((resolve) => server.close(resolve));
}

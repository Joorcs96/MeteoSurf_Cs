import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');

// Playwright loader with fallback
let playwright;
try {
  playwright = await import('playwright');
} catch {
  const appData = process.env.APPDATA || 'C:\\Users\\Jordi\\AppData\\Roaming';
  const pwPath = path.join(appData, 'npm/node_modules/playwright/index.mjs');
  playwright = await import('file:///' + pwPath.replace(/\\/g, '/'));
}
const { chromium } = playwright;

// MIME types for static server
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.csv': 'text/csv; charset=utf-8'
};

function startServer(port = 8789) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const urlPath = req.url.split('?')[0].split('#')[0];
      let filePath = path.join(ROOT_DIR, urlPath === '/' ? 'index.html' : urlPath);
      
      // Prevent directory traversal
      if (!filePath.startsWith(ROOT_DIR)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }

      fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Not Found');
          return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        res.writeHead(200, {
          'Content-Type': contentType,
          'Access-Control-Allow-Origin': '*'
        });
        fs.createReadStream(filePath).pipe(res);
      });
    });

    server.listen(port, '127.0.0.1', () => {
      resolve(server);
    });
    server.on('error', reject);
  });
}

async function runPWABaseline() {
  const port = 8789;
  const server = await startServer(port);
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`Servidor local temporal iniciado en ${baseUrl}`);

  const results = {
    fecha: new Date().toISOString(),
    baseUrl,
    viewports: {},
    pruebasFlujos: {},
    resilienciaRed: {},
    serviceWorker: {},
    friccionesDetectadas: []
  };

  const browser = await chromium.launch({ headless: true });

  const viewports = [
    { name: 'movil_390x844_claro', width: 390, height: 844, isMobile: true, scheme: 'light' },
    { name: 'movil_390x844_oscuro', width: 390, height: 844, isMobile: true, scheme: 'dark' },
    { name: 'escritorio_1366x768_claro', width: 1366, height: 768, isMobile: false, scheme: 'light' },
    { name: 'escritorio_1366x768_oscuro', width: 1366, height: 768, isMobile: false, scheme: 'dark' }
  ];

  for (const vp of viewports) {
    console.log(`Probando viewport: ${vp.name}...`);
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      isMobile: vp.isMobile,
      hasTouch: vp.isMobile,
      colorScheme: vp.scheme,
      serviceWorkers: 'block' // Evita atrapar en worker en baseline
    });

    const page = await context.newPage();
    const consoleLogs = [];
    const pageErrors = [];
    const failedRequests = [];

    page.on('console', msg => consoleLogs.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', err => pageErrors.push(err.message));
    page.on('requestfailed', req => failedRequests.push({ url: req.url(), failure: req.failure()?.errorText }));

    // 1. Carga limpia
    const t0 = Date.now();
    await page.goto(`${baseUrl}/index.html`, { waitUntil: 'domcontentloaded' });
    const domLoadedTime = Date.now() - t0;

    // Medir tiempo hasta primer render de forecast útil
    let forecastRenderTime = null;
    try {
      await page.waitForSelector('.spot-card2, .sc-card', { timeout: 8000 });
      forecastRenderTime = Date.now() - t0;
    } catch (e) {
      forecastRenderTime = null;
    }

    // Comprobar Onboarding
    const onboardingStatus = await page.evaluate(() => {
      const ob = document.getElementById('onboard-overlay');
      if (!ob) return { existe: false };
      const style = window.getComputedStyle(ob);
      return {
        existe: true,
        visible: style.display !== 'none' && style.visibility !== 'hidden',
        titulo: ob.querySelector('h2, .ob-title')?.textContent?.trim() || null,
        tieneBotonCierre: !!ob.querySelector('.ob-btn-entendido, [data-action="cerrar-onboard"], button')
      };
    });

    // Cerrar onboarding si está visible
    if (onboardingStatus.visible) {
      try {
        const btn = page.locator('#onboard-overlay button, .ob-btn-entendido').first();
        if (await btn.count() > 0) {
          await btn.click();
          await page.waitForTimeout(500);
        }
      } catch (err) {
        console.warn('No se pudo cerrar onboarding con click:', err.message);
      }
    }

    // Auditoría de elementos interactivos (tamaño táctil < 44px, nombres accesibles)
    const interactivosAudit = await page.evaluate(() => {
      const interactivos = Array.from(document.querySelectorAll('button, a, input, select, [role="button"]'));
      const menores44px = [];
      const sinNombreAccesible = [];
      const recortesTexto = [];

      for (const el of interactivos) {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          if (rect.width < 44 || rect.height < 44) {
            menores44px.push({
              tag: el.tagName.toLowerCase(),
              id: el.id || null,
              className: el.className || null,
              parent: el.parentElement?.className || null,
              html: el.outerHTML.slice(0, 80),
              text: (el.textContent || '').trim().slice(0, 30),
              ancho: Math.round(rect.width),
              alto: Math.round(rect.height)
            });
          }
          const ariaLabel = el.getAttribute('aria-label') || el.getAttribute('title');
          const visibleText = (el.textContent || '').trim();
          if (!ariaLabel && !visibleText && el.tagName.toLowerCase() !== 'input') {
            sinNombreAccesible.push({
              tag: el.tagName.toLowerCase(),
              id: el.id || null,
              className: el.className || null
            });
          }
        }
      }

      // Comprobar desbordamiento horizontal
      const hasHorizontalOverflow = document.documentElement.scrollWidth > window.innerWidth;

      return {
        totalInteractivos: interactivos.length,
        menores44pxCount: menores44px.length,
        menores44pxMuestra: menores44px.slice(0, 10),
        sinNombreAccesibleCount: sinNombreAccesible.length,
        sinNombreAccesibleMuestra: sinNombreAccesible.slice(0, 5),
        hasHorizontalOverflow,
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth
      };
    });

    results.viewports[vp.name] = {
      domLoadedTime,
      forecastRenderTime,
      onboardingStatus,
      interactivosAudit,
      consoleErrors: consoleLogs.filter(l => l.type === 'error'),
      pageErrors,
      failedRequestsCount: failedRequests.length
    };

    await context.close();
  }

  // 2. Pruebas de Flujos de Navegación y Estado
  console.log('Probando flujo completo de navegación...');
  const navContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true
  });
  const navPage = await navContext.newPage();
  const navErrors = [];
  navPage.on('pageerror', err => navErrors.push(err.message));

  await navPage.goto(`${baseUrl}/index.html#/`, { waitUntil: 'domcontentloaded' });
  await navPage.waitForTimeout(1000);

  // Cerrar onboarding si aparece
  const obBtn = navPage.locator('#onboard-overlay button, .ob-btn-entendido');
  if (await obBtn.count() > 0 && await obBtn.isVisible()) {
    await obBtn.click();
    await navPage.waitForTimeout(500);
  }

  // Flujo: Buscar y abrir spot
  let spotAbierto = false;
  let spotId = null;
  const firstSpot = navPage.locator('.spot-card2, .sc-card').first();
  if (await firstSpot.count() > 0) {
    const link = firstSpot.locator('a, [data-spot]').first();
    spotId = await firstSpot.getAttribute('data-spot-id') || 'Planetario';
    await firstSpot.click();
    await navPage.waitForTimeout(1000);
    spotAbierto = navPage.url().includes('#/spot/');
  }

  // Verificar navegación a Horas en el spot
  let horasOk = false;
  const tabHoras = navPage.locator('[data-tab="horas"], button:has-text("Horas"), .spot-tab:has-text("Horas")');
  if (await tabHoras.count() > 0) {
    await tabHoras.first().click();
    await navPage.waitForTimeout(800);
    horasOk = (await navPage.locator('.hourly-scroll, .hourly-table, .spot-hours').count()) > 0;
  }

  // Navegar a Calendario
  await navPage.goto(`${baseUrl}/index.html#/calendario`, { waitUntil: 'domcontentloaded' });
  await navPage.waitForTimeout(1000);
  const calendarioOk = (await navPage.locator('.cal-grid, .cal-semana, #calendario-view').count()) > 0;

  // Navegar a Cámaras
  await navPage.goto(`${baseUrl}/index.html#/camaras`, { waitUntil: 'domcontentloaded' });
  await navPage.waitForTimeout(1000);
  const camarasOk = (await navPage.locator('.cam-card, #camaras-view').count()) > 0;

  // Navegar a Asistente
  await navPage.goto(`${baseUrl}/index.html#/asistente`, { waitUntil: 'domcontentloaded' });
  await navPage.waitForTimeout(1000);
  const asistenteOk = (await navPage.locator('#chat, #ask, #q').count()) > 0;

  // Prueba atrás/adelante y recarga
  await navPage.goBack();
  await navPage.waitForTimeout(500);
  const urlTrasBack = navPage.url();
  await navPage.reload({ waitUntil: 'domcontentloaded' });
  await navPage.waitForTimeout(800);
  const urlTrasReload = navPage.url();
  const pantallaSanaTrasReload = await navPage.evaluate(() => {
    return document.body.innerHTML.trim().length > 100 && !document.body.innerText.includes('Cannot GET');
  });

  results.pruebasFlujos = {
    spotAbierto,
    spotId,
    horasOk,
    calendarioOk,
    camarasOk,
    asistenteOk,
    urlTrasBack,
    urlTrasReload,
    pantallaSanaTrasReload,
    navErrors
  };

  await navContext.close();

  // 3. Resiliencia: Falta de red y datos incompletos
  console.log('Probando resiliencia ante falta de red...');
  const offlineContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true
  });
  const offlinePage = await offlineContext.newPage();
  
  // Bloquear llamadas a APIs externas (Open-Meteo, etc.)
  await offlinePage.route('**/*', route => {
    const url = route.request().url();
    if (url.includes('open-meteo.com') || url.includes('portus.puertos.es')) {
      route.abort('failed');
    } else {
      route.continue();
    }
  });

  await offlinePage.goto(`${baseUrl}/index.html#/`, { waitUntil: 'domcontentloaded' });
  await offlinePage.waitForTimeout(2000);

  const resilienciaUI = await offlinePage.evaluate(() => {
    const hasWhiteScreen = document.body.innerHTML.trim().length === 0;
    const bodyText = document.body.innerText;
    const hasErrorMessage = bodyText.includes('Sin conexión') || 
                            bodyText.includes('reintentar') || 
                            bodyText.includes('datos') ||
                            bodyText.includes('Error') ||
                            document.querySelectorAll('.error-banner, .aviso-offline, .state-empty').length > 0;
    return {
      hasWhiteScreen,
      hasErrorMessage,
      bodyExcerpt: bodyText.slice(0, 200).replace(/\s+/g, ' ')
    };
  });

  results.resilienciaRed = resilienciaUI;
  await offlineContext.close();

  // 4. Service Worker: comportamiento
  console.log('Probando Service Worker...');
  const swContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true
  });
  const swPage = await swContext.newPage();
  await swPage.goto(`${baseUrl}/index.html`, { waitUntil: 'networkidle' });
  const swRegistered = await swPage.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return { supported: false };
    const regs = await navigator.serviceWorker.getRegistrations();
    return {
      supported: true,
      registrationsCount: regs.length,
      scope: regs[0]?.scope || null
    };
  });
  results.serviceWorker = swRegistered;
  await swContext.close();

  await browser.close();
  server.close();

  // Guardar resultados brutos
  const outPath = path.join(__dirname, 'linea-base-pwa.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf-8');
  console.log(`Línea base PWA guardada con éxito en ${outPath}`);
  return results;
}

runPWABaseline().catch(err => {
  console.error('Error en línea base PWA:', err);
  process.exit(1);
});

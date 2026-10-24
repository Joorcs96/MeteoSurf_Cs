const { chromium } = require('playwright');
const fs = require('node:fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, // iPhone 12/13/14
    isMobile: true,
    hasTouch: true
  });

  const page = await context.newPage();
  const logs = [];
  const errors = [];
  page.on('console', msg => logs.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', err => errors.push(err.message));

  const results = {};

  console.log('--- 1. Portada (#/) ---');
  await page.goto('http://127.0.0.1:8767/#/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const spotCards = await page.locator('.spot-card2').all();
  results.spotCardsCount = spotCards.length;
  console.log(`Detectadas ${spotCards.length} tarjetas de spot (.spot-card2).`);

  // Chips de filtro
  const chips = await page.locator('.chips button').all();
  results.filterChipsCount = chips.length;

  // 2. Entrar a un spot individual
  console.log('--- 2. Detalle de Spot (#/spot/...) ---');
  const firstSpotLink = page.locator('.sc-link').first();
  if (await firstSpotLink.count() > 0) {
    const spotHref = await firstSpotLink.getAttribute('href');
    results.firstSpotHref = spotHref;
    await firstSpotLink.click();
    await page.waitForTimeout(1500);

    results.spotTitle = await page.locator('h1').textContent().catch(() => '');
    results.hasHourlyTable = await page.locator('.hourly-scroll, .hourly-table, .spot-hours').count() > 0;
    results.hasWindMeteo = await page.locator('.spot-stat, .stat-tile, .rating-badge').count() > 0;
    console.log(`Detalle de spot cargado: ${results.spotTitle}`);
  }

  // 3. Ir a Cámaras (#/camaras)
  console.log('--- 3. Vista Cámaras (#/camaras) ---');
  await page.goto('http://127.0.0.1:8767/#/camaras', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  const camCards = await page.locator('.cam-card').count();
  results.camCardsCount = camCards;
  console.log(`Tarjetas de cámara encontradas: ${camCards}`);

  // Botón Comparar
  const btnComparar = page.locator('.cmp-abrir, [data-camvista="comparar"]');
  if (await btnComparar.count() > 0) {
    await btnComparar.click();
    await page.waitForTimeout(1000);
    const compararView = await page.locator('.cmp-grid, .cam-grid-comparar, [data-comparar]').count();
    results.compararViewLoaded = compararView > 0 || (await page.content()).includes('Comparar');
    console.log('Vista Comparar cámaras activada:', results.compararViewLoaded);
  }

  // 4. Ir a Mapa (#/mapa)
  console.log('--- 4. Vista Mapa (#/mapa) ---');
  await page.goto('http://127.0.0.1:8767/#/mapa', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  results.mapContainerPresent = await page.locator('#map, .leaflet-container').count() > 0;
  console.log('Mapa 2D/3D container presente:', results.mapContainerPresent);

  // 5. Ir a Asistente (#/asistente)
  console.log('--- 5. Vista Asistente (#/asistente) ---');
  await page.goto('http://127.0.0.1:8767/#/asistente', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  results.asistentePresent = await page.locator('.chat-box, .assistant-view, #asistente-chat').count() > 0 || (await page.content()).includes('Asistente');
  console.log('Asistente presente:', results.asistentePresent);

  // 6. Probar formulario votar.html
  console.log('--- 6. Formulario Reportar Sesión (votar.html) ---');
  await page.goto('http://127.0.0.1:8767/votar.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  const spotSelect = await page.locator('#f-spot, select[name="spot"]').count() > 0;
  results.votarSpotSelect = spotSelect;

  fs.writeFileSync('tools/interaction_results.json', JSON.stringify({
    results,
    errors,
    recentLogs: logs.slice(-25)
  }, null, 2));

  console.log('--- Fin de pruebas de interacción ---');
  await browser.close();
})().catch(e => {
  console.error('Error en interacción:', e);
  process.exit(1);
});

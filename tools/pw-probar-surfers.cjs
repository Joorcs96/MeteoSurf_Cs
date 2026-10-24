// tools/pw-probar-surfers.cjs — Prueba REAL con ventana (Playwright, headed).
//
// Uso:
//   node tools/pw-probar-surfers.cjs <urlBase> [salidaJson]
//
// Abre Chromium CON VENTANA y ejecuta tools/probar_surfers.html. El vídeo va
// real a la webcam del club: comprueba que se decodifica, cuántos fotogramas da,
// qué MIME soporta el grabador y — lo importante — si el clip ensamblado tiene
// duración real. Con ventana, MediaRecorder sí codifica; sin ventana, no.
//
// La ruta del paquete de Playwright se pasa por NODE_PATH para no instalar nada.

const path = require('node:path');

(async () => {
  const { chromium } = require('playwright');
  const base = process.argv[2] || 'http://127.0.0.1:8767';
  const salida = process.argv[3] || '';
  const budget = Number(process.argv[4] || 60000);

  const navegador = await chromium.launch({ headless: false });
  const ctx = await navegador.newContext({ viewport: { width: 900, height: 700 } });
  const pagina = await ctx.newPage();
  const consola = [];
  pagina.on('console', (m) => consola.push(`[${m.type()}] ${m.text()}`));
  pagina.on('pageerror', (e) => consola.push(`[pageerror] ${e.message}`));

  await pagina.goto(`${base}/tools/probar_surfers.html`, { waitUntil: 'domcontentloaded' });

  let lineas = [];
  try {
    await pagina.waitForFunction(
      () => {
        const t = document.getElementById('resultado')?.textContent || '';
        return t.startsWith('RESULTADO') || t.startsWith('FALLO');
      },
      { timeout: budget }
    );
    lineas = (await pagina.locator('#resultado').textContent()).split('\n');
  } catch (e) {
    lineas = ['TIMEOUT', String(e.message)];
  }
  const texto = lineas.join('\n');
  console.log(texto);
  console.log('--- consola ---');
  console.log(consola.slice(-15).join('\n'));
  if (salida) require('node:fs').writeFileSync(salida, texto, 'utf8');
  await navegador.close();
})().catch((e) => {
  console.error('FALLO pw-probar-surfers:', e.message);
  process.exit(1);
});
void path;
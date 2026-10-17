// tools/pw-vigia-e2e.cjs — Prueba E2E de la vigía con navegador CON VENTANA.
//
// Uso:
//   node tools/pw-vigia-e2e.cjs <urlBase> [salidaJson]
//
// Abre `tools/vigia_e2e.html` en Chromium con ventana. La página monta una escena
// sintética (agua, espuma, boya y surfistas que la cruzan), la mete por el mismo
// camino que la web y espera a que el detector dispare de verdad. Luego mide el
// clip entregado: tamaño, si es un solo contenedor, y **su duración real
// reproduciéndolo**, que es donde se ve si el archivo está entero.
//
// No hace falta instalar nada: usa el Playwright que ya está en el perfil de
// usuario (NODE_PATH) y el Chromium ya descargado.

const fs = require('node:fs');

(async () => {
  const { chromium } = require('playwright');
  const base = process.argv[2] || 'http://127.0.0.1:8767';
  const salida = process.argv[3] || '';
  const budget = Number(process.argv[4] || 90000);
  const query = process.argv[5] || '';

  const navegador = await chromium.launch({ headless: false });
  const ctx = await navegador.newContext({ viewport: { width: 1000, height: 800 } });
  const pagina = await ctx.newPage();
  const consola = [];
  pagina.on('console', (m) => consola.push(`[${m.type()}] ${m.text()}`));
  pagina.on('requestfailed', (r) => consola.push(`[fallo-peticion] ${r.url()}`));
  pagina.on('pageerror', (e) => consola.push(`[pageerror] ${e.message}`));

  await pagina.goto(`${base}/tools/vigia_e2e.html${query}`, { waitUntil: 'domcontentloaded' });

  let texto = '';
  try {
    await pagina.waitForFunction(
      () => {
        const t = document.getElementById('resultado')?.textContent || '';
        return t.startsWith('RESULTADO') || t.startsWith('FALLO');
      },
      null,
      { timeout: budget }
    );
    texto = (await pagina.locator('#resultado').textContent()).trim();
  } catch (e) {
    texto = `FALLO ["error=${e.message}"]`;
  }
  const detalle = (await pagina.locator('#detalle').textContent().catch(() => '')) || '';
  console.log(texto);
  if (detalle) console.log('--- detalle ---\n' + detalle);
  console.log('--- consola ---\n' + consola.slice(-20).join('\n'));
  if (salida) fs.writeFileSync(salida, `${texto}\n${detalle}\n${consola.slice(-20).join('\n')}`, 'utf8');
  await navegador.close();
})().catch((e) => {
  console.error('FALLO pw-vigia-e2e:', e.message);
  process.exit(1);
});
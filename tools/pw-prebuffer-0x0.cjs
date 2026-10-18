// tools/pw-prebuffer-0x0.cjs — Regresión en navegador CON VENTANA del prebuffer
// con vídeo 0x0.
//
// Uso:
//   node tools/pw-prebuffer-0x0.cjs <urlBase> [salidaTxt] [budgetMs]
//
// Abre `tools/vigia_prebuffer_0x0.html` con el `js/cams.js` REAL y devuelve el
// `RESULTADO [...]` que escribe la página. Si el vídeo aún no tiene medidas al
// armar la vigía, el clip ya no puede salir con 2 píxeles de alto: o sale con la
// proporción de verdad, o la vigía no se arma y lo dice en pantalla.
//
// No instala nada: usa el Playwright ya presente en NODE_PATH.

const fs = require('node:fs');

(async () => {
  const { chromium } = require('playwright');
  const base = process.argv[2] || 'http://127.0.0.1:8768';
  const salida = process.argv[3] || '';
  const budget = Number(process.argv[4] || 60000);

  const navegador = await chromium.launch({ headless: false });
  const ctx = await navegador.newContext({ viewport: { width: 1000, height: 800 } });
  const pagina = await ctx.newPage();
  const consola = [];
  pagina.on('console', (m) => consola.push(`[${m.type()}] ${m.text()}`));
  pagina.on('pageerror', (e) => consola.push(`[pageerror] ${e.message}`));

  await pagina.goto(`${base}/tools/vigia_prebuffer_0x0.html`, { waitUntil: 'domcontentloaded' });

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
    texto = `FALLO ["error=${String(e.message).replace(/[\[\]",]/g, ' ')}"]`;
  }
  const detalle = (await pagina.locator('#detalle').textContent().catch(() => '')) || '';
  const enPantalla = (await pagina.locator('#errorVisible').textContent().catch(() => '')) || '';
  console.log(texto);
  if (detalle) console.log('--- detalle ---\n' + detalle);
  if (enPantalla) console.log('--- en pantalla ---\n' + enPantalla);
  if (consola.length) console.log('--- consola ---\n' + consola.slice(-15).join('\n'));
  if (salida) fs.writeFileSync(salida, `${texto}\n${detalle}\n${enPantalla}\n${consola.slice(-15).join('\n')}`, 'utf8');
  await navegador.close();
})().catch((e) => {
  console.error('FALLO pw-prebuffer-0x0:', e.message);
  process.exit(1);
});
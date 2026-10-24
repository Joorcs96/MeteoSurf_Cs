// tools/test_deteccion_ola.js — Pruebas del detector de surfista cogiendo ola.
//
// Uso: node tools/test_deteccion_ola.js
//
// Importa el código REAL de js/deteccion.js (no una réplica) y lo alimenta con
// fotogramas sintéticos en escala de grises, como los que salen de un canvas.
// Hay un positivo (surfista cruzando la rompiente) y cinco negativos que son los
// que de verdad confunden a un detector de movimiento: boya, espuma, bañista,
// surfista quieto esperando la serie y surfista que solo rema.
//
// Los fotogramas son sintéticos a propósito: no hay ningún clip del club con un
// surfista confirmado y etiquetado, así que la calidad real del detector NO está
// medida. Lo que sí se comprueba aquí es que la lógica de rechazo funciona y que
// no hace falta bajar ningún umbral para distinguir los casos.

import {
  AJUSTES_DETECCION,
  aGrisesReducidos,
  buscarPersonaYTabla,
  clasificarOla,
  componentes,
  crearDetector,
  ejesBlob,
  esPersona,
  esTabla,
  medirBlob,
} from '../js/deteccion.js';

let fallos = 0;
let total = 0;

function comprobar(nombre, condicion, detalle = '') {
  total++;
  if (condicion) {
    console.log(`  OK   ${nombre}`);
  } else {
    fallos++;
    console.log(`  FALLA ${nombre}${detalle ? ` — ${detalle}` : ''}`);
  }
}

function seccion(titulo) {
  console.log(`\n${titulo}`);
}

const A = AJUSTES_DETECCION;
const W = A.anchoAnalisis;
const H = A.altoAnalisis;
const FPS = A.cuadrosPorSegundo;
const MS = 1000 / FPS;

// ------------------------------------------------------- generador de escena

// Fondo: cielo arriba y agua abajo, con degradado suave. Un valor de gris alto
// para que la espuma (más clara) y el surfista (más oscuro) standout.
function fondoBase() {
  const g = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    const cielo = y < A.roiAgua[0] * H;
    const base = cielo ? 205 : 148;
    for (let x = 0; x < W; x++) {
      // Degradado horizontal suave para que el fondo no sea plano.
      g[y * W + x] = base + ((x * 3) % 7) - 3;
    }
  }
  return g;
}

function pintarRect(g, x0, y0, w, h, valor) {
  for (let y = y0; y < y0 + h; y++) {
    if (y < 0 || y >= H) continue;
    for (let x = x0; x < x0 + w; x++) {
      if (x < 0 || x >= W) continue;
      g[y * W + x] = valor;
    }
  }
}

function pintarDisco(g, cx, cy, r, valor) {
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      if (x < 0 || x >= W || y < 0 || y >= H) continue;
      if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) g[y * W + x] = valor;
    }
  }
}

const PERS_VIDA = 34; // gris del surfista y la tabla: mucho más oscuro que el agua
const ESPUMA = 248; // gris de la espuma: mucho más claro que el agua

// Surfista: persona vertical y tabla tendida. Por defecto se tocan (piernas
// apoyadas en la tabla), que es lo que sale en la realidad y produce un solo
// blob; con `separado` se deja un hueco y salen dos.
function dibujarSurfista(g, x, y, { persona = true, tabla = true, separado = false } = {}) {
  const tablaY = separado ? y + 10 : y + 7;
  if (persona) pintarRect(g, x, y, 3, 10, PERS_VIDA);
  if (tabla) pintarRect(g, x - 5, tablaY, 14, 2, PERS_VIDA);
}

// ------------------------------------------------------------------ geometría

seccion('Geometría de blobs');
{
  const horiz = ejesBlob(100, 0, 4);
  const vert = ejesBlob(4, 0, 100);
  comprobar('una barra horizontal da eje mayor horizontal', horiz.angulo < 5, `ángulo ${horiz.angulo.toFixed(1)}`);
  comprobar('una barra vertical da eje mayor a 90°', vert.angulo > 85 && vert.angulo < 95, `ángulo ${vert.angulo.toFixed(1)}`);
  comprobar('la elongación separa barra de mancha', horiz.ejeMayor > vert.ejeMenor);
}

seccion('Componentes conexas');
{
  const m = new Uint8Array(W * H);
  pintarRect(m, 10, 10, 4, 4, 1);
  pintarRect(m, 60, 40, 6, 3, 1);
  pintarRect(m, 100, 70, 2, 2, 1); // por debajo de areaMin
  const g = componentes(m, W, H, 10);
  comprobar('encuentra exactamente 2 blobs por encima del área mínima', g.length === 2, `encontró ${g.length}`);
  comprobar('el área mínima descarta la mota', g.every((x) => x.length >= 10));
  comprobar('el área del primer blob es 16', g[0].length === 16, `${g[0].length}`);
}

seccion('Reconocimiento de persona y tabla');
{
  const tabla = medirBlob(
    (() => { const m = new Uint8Array(W * H); pintarRect(m, 20, 60, 16, 2, 1); return componentes(m, W, H, 1)[0]; })(),
    W, H
  );
  const persona = medirBlob(
    (() => { const m = new Uint8Array(W * H); pintarRect(m, 26, 48, 3, 11, 1); return componentes(m, W, H, 1)[0]; })(),
    W, H
  );
  comprobar('una barra 16x2 cuenta como tabla', esTabla(tabla, A, W));
  comprobar('esa barra no cuenta como persona', !esPersona(tabla, A));
  comprobar('una columna 3x11 cuenta como persona', esPersona(persona, A));
  comprobar('esa columna no cuenta como tabla', !esTabla(persona, A, W));
  const par = buscarPersonaYTabla([persona, tabla], A, W);
  comprobar('se emparejan persona y tabla en contacto', !!par, JSON.stringify(par && par.contacto));
  comprobar('el emparejamiento no los fusiona', par && par.juntos === false);
}

seccion('Un surfista tumbado (persona y tabla en un solo blob)');
{
  const m = new Uint8Array(W * H);
  pintarRect(m, 20, 60, 16, 2, 1);  // tabla
  pintarRect(m, 26, 54, 3, 6, 1);    // torso encima
  pintarRect(m, 27, 62, 2, 2, 1);    // pies
  const blobs = componentes(m, W, H, A.areaMinPx).map((g) => medirBlob(g, W, H));
  const par = buscarPersonaYTabla(blobs, A, W);
  comprobar('encuentra la tabla dentro de la silueta', !!par, `blobs: ${blobs.length}`);
  comprobar('marca que vienen del mismo blob', !!(par && par.juntos));
  comprobar('la persona queda reconocida sobre la tabla', !!(par && par.persona.altoPx >= 5 && par.tabla.altoPx <= 3),
    JSON.stringify(par && { p: par.persona.altoPx, t: par.tabla.altoPx }));
}

// ------------------------------------------------------------- clasificación

function pista({ n, dx, dy, tablaAng = 0, persona = true, tabla = true, curva = null }) {
  const out = [];
  for (let i = 0; i < n; i++) {
    let x = 30 + i * dx;
    let y = 52 + i * (dy || 0);
    if (curva) [x, y] = curva(i);
    out.push({
      t: i * MS,
      x, y,
      area: 30, altoPx: 10,
      persona: persona ? { cx: x, cy: y, altoPx: 10, angulo: 90 } : null,
      tabla: tabla ? { cx: x, cy: y + 8, angulo: tablaAng, elongacion: 7, anchoPx: 14 } : null,
    });
  }
  return out;
}

seccion('Clasificación del rastro (motor sin píxeles)');
{
  const positivo = clasificarOla(pista({ n: 40, dx: 1.5 }), A);
  comprobar('POSITIVO: surfista cruzando la rompiente', positivo.esOla && positivo.tipo === 'coge_ola',
    JSON.stringify({ tipo: positivo.tipo, medida: positivo.medida }));
  comprobar('el positivo trae confianza por debajo de 1', positivo.confianza > 0.5 && positivo.confianza <= A.confianzaMax,
    String(positivo.confianza));
  comprobar('el positivo explica por qué', positivo.motivos.join(' ').includes('avance sostenido'));

  const boya = clasificarOla(pista({
    n: 40,
    persona: false,
    tabla: false,
    curva: (i) => [60 + 2.5 * Math.sin(i / 3), 55 + 1.5 * Math.cos(i / 4)],
  }), A);
  comprobar('NEGATIVO: boya que oscila', !boya.esOla && boya.tipo === 'boya', boya.tipo);
  comprobar('la boya se nombra por su movimiento, no por un umbral bajo', boya.motivos.join(' ').includes('oscila') || boya.motivos.join(' ').includes('Oscila'), boya.motivos.join(' '));

  const espuma = clasificarOla(pista({ n: 5, dx: 3 }), A);
  comprobar('NEGATIVO: rastro efímero', !espuma.esOla && espuma.tipo === 'espuma', espuma.tipo);

  const banista = clasificarOla(pista({ n: 40, dx: 1.5, tabla: false }), A);
  comprobar('NEGATIVO: bañista sin tabla', !banista.esOla && banista.tipo === 'banista', banista.tipo);

  const sinPersona = clasificarOla(pista({ n: 40, dx: 1.5, persona: false }), A);
  comprobar('NEGATIVO: algo que se mueve rápido sin nadie encima', !sinPersona.esOla, sinPersona.tipo);

  const quieto = clasificarOla(pista({ n: 40, dx: 0 }), A);
  comprobar('NEGATIVO: surfista quieto esperando la serie', !quieto.esOla && quieto.tipo === 'surfista_espera', quieto.tipo);
  comprobar('el surfista quieto no se confunde con una boya', quieto.tipo !== 'boya');

  const remando = clasificarOla(pista({ n: 40, dx: 0.3 }), A);
  comprobar('NEGATIVO: se mueve pero solo rema', !remando.esOla && remando.tipo === 'remando', remando.tipo);

  const erratico = clasificarOla(pista({
    n: 40,
    curva: (i) => [60 + 4 * Math.sin(i / 2), 55 + 4 * Math.cos(i / 2)],
  }), A);
  comprobar('NEGATIVO: trayectoria errática (va y viene)', !erratico.esOla, erratico.tipo);

  const lento = clasificarOla(pista({ n: 40, dx: 0.12 }), A);
  comprobar('NEGATIVO: recorrido de los dos lados lento y corto', !lento.esOla, lento.tipo);
}

// ------------------------------------------------------------------ motor real

function pasarSecuencia(det, cuadros, dibujar, { conFondo = 25 } = {}) {
  const base = fondoBase();
  for (let i = 0; i < conFondo; i++) det.push(base, i * MS);
  let deteccion = null;
  for (let i = 0; i < cuadros; i++) {
    const g = Uint8Array.from(base);
    dibujar(g, i);
    const salida = det.push(g, (conFondo + i) * MS);
    if (salida?.deteccion) deteccion = salida.deteccion;
  }
  return deteccion;
}

seccion('Motor completo con fotogramas sintéticos');
{
  const positivo = pasarSecuencia(crearDetector(), 30, (g, i) => dibujarSurfista(g, 20 + i * 1.6, 52));
  comprobar('POSITIVO por píxeles: detecta al surfista', !!positivo, 'no saltó el detector');
  if (positivo) {
    comprobar('el evento dice que coge ola', positivo.tipo === 'coge_ola' && positivo.esOla);
    comprobar('el evento lleva medidas', positivo.medida && positivo.medida.netoPx > 0);
    comprobar('el evento no inventa metros sin escala', positivo.medida.pixelesPorMetro === null && positivo.medida.netoM === null);
  }

  const boya = pasarSecuencia(crearDetector(), 30, (g, i) => pintarDisco(g, 70 + 2.5 * Math.sin(i / 3), 56, 3, PERS_VIDA));
  comprobar('NEGATIVO por píxeles: boya', boya === null, JSON.stringify(boya));

  const espuma = pasarSecuencia(crearDetector(), 30, (g, i) => pintarRect(g, 20 + i * 3, 50, 18, 4, ESPUMA));
  comprobar('NEGATIVO por píxeles: espuma que cruza rápido', espuma === null, JSON.stringify(espuma));

  const espumaLenta = pasarSecuencia(crearDetector(), 30, (g, i) => pintarRect(g, 40 + i * 1.6, 50, 18, 4, ESPUMA));
  comprobar('NEGATIVO por píxeles: espuma lenta tampoco', espumaLenta === null, JSON.stringify(espumaLenta));

  const banista = pasarSecuencia(crearDetector(), 30, (g, i) => pintarRect(g, 30 + i * 1.6, 50, 3, 10, PERS_VIDA));
  comprobar('NEGATIVO por píxeles: bañista que camina', banista === null, JSON.stringify(banista));

  const quieto = pasarSecuencia(crearDetector(), 45, (g) => dibujarSurfista(g, 60, 52));
  comprobar('NEGATIVO por píxeles: surfista quieto en el pico', quieto === null, JSON.stringify(quieto));

  const remando = pasarSecuencia(crearDetector(), 30, (g, i) => dibujarSurfista(g, 30 + i * 0.3, 52));
  comprobar('NEGATIVO por píxeles: solo rema', remando === null, JSON.stringify(remando));

  const fueraDeAgua = pasarSecuencia(crearDetector(), 30, (g, i) => dibujarSurfista(g, 20 + i * 1.6, 8));
  comprobar('NEGATIVO por píxeles: lo que pasa por encima del horizonte', fueraDeAgua === null, JSON.stringify(fueraDeAgua));
}

seccion('Consistencia: bajar un umbral NO convierte un negativo en positivo');
{
  // El punto del detector no es sensibilidad, sino rechazo explícito. Con
  // contrastes más laxos, los negativos deben seguir rejected por su forma o su
  // movimiento, no colarse por un umbral más bajo.
  const laxo = { ...A, contrasteOscuro: 6, contrasteClaro: 8, velNetaMinPxS: 1, linealidadMin: 0.1, duracionMinS: 0.1, quietoNetoMaxPx: 1, boyaNetoMaxPx: 1, paddleNetoMaxPx: 4, olaNetoMinPx: 4 };
  comprobar('con umbrales laxos, la boya sigue sin salir', !clasificarOla(pista({ n: 40, persona: false, tabla: false, curva: (i) => [60 + 2.5 * Math.sin(i / 3), 55] }), laxo).esOla);
  comprobar('con umbrales laxos, el bañista sigue sin salir', !clasificarOla(pista({ n: 40, dx: 1.5, tabla: false }), laxo).esOla);
  comprobar('con umbrales laxos, el surfista quieto sigue sin salir', !clasificarOla(pista({ n: 40, dx: 0 }), laxo).esOla);

}

seccion('Configuración y honestidad del informe');
{
  comprobar('los umbrales de movimiento están en px/s, no en metros inventados', typeof A.velNetaMinPxS === 'number' && A.pxPorMetro === null);
  comprobar('los umbrales de rechazo están en píxeles', typeof A.boyaNetoMaxPx === 'number' && typeof A.quietoNetoMaxPx === 'number');
  const conEscala = clasificarOla(pista({ n: 40, dx: 1.5 }), { ...A, pxPorMetro: 2 });
  comprobar('con escala declarada, el informe añade metros', conEscala.medida.netoM !== null && conEscala.medida.velNetaMs !== null);
  const det = crearDetector();
  comprobar('el motor expone sus ajustes', det.ajustes.anchoAnalisis === A.anchoAnalisis);
  det.reset();
  comprobar('reset deja el motor como nuevo', det.estado().cuadros === 0 && det.estado().tracks === 0);
}

seccion('Reducción a la rejilla de análisis');
{
  const rgba = new Uint8ClampedArray(320 * 180 * 4);
  for (let i = 0; i < 320 * 180; i++) {
    rgba[i * 4] = 200; rgba[i * 4 + 1] = 200; rgba[i * 4 + 2] = 200; rgba[i * 4 + 3] = 255;
  }
  const g = aGrisesReducidos(rgba, 320, 180, W, H);
  comprobar('devuelve la rejilla pedida', g.length === W * H);
  comprobar('un gris plano se mantiene', Math.abs(g[0] - 200) < 1 && Math.abs(g[g.length - 1] - 200) < 1);
}

seccion('Separación por polaridad: espuma clara, surfista oscuro');
{
  // La espuma es el falso positivo más dangerous y el más fácil de colar si se
  // relaja el contraste. Aquí se comprueba que la espuma se cuenta en la máscara
  // CLARA y que el surfista no aparece en ella, que es lo que impide que un
  // destello de espuma acabe cuando un surfista o al revés.
  const base = fondoBase();
  const det = crearDetector();
  for (let i = 0; i < 25; i++) det.push(base, i * MS);

  const conEspuma = Uint8Array.from(base);
  pintarRect(conEspuma, 50, 50, 18, 4, ESPUMA);
  const sEspuma = det.push(conEspuma, 25 * MS);
  comprobar('la espuma se cuenta como píxeles claros', sEspuma.espumaPx > 0, `espumaPx=${sEspuma.espumaPx}`);
  comprobar('la espuma no genera ningún candidato de ola', sEspuma.deteccion === null);

  const det2 = crearDetector();
  for (let i = 0; i < 25; i++) det2.push(base, i * MS);
  const conSurfista = Uint8Array.from(base);
  dibujarSurfista(conSurfista, 60, 52);
  const sSurfista = det2.push(conSurfista, 25 * MS);
  comprobar('un surfista oscuro no se cuenta como espuma', sSurfista.espumaPx === 0, `espumaPx=${sSurfista.espumaPx}`);
}

console.log(`\n${fallos ? 'FALLOS' : 'TODO EN VERDE'}: ${total - fallos}/${total} pruebas`);
process.exit(fallos ? 1 : 0);
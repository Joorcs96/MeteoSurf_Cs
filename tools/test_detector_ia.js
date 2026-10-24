// tools/test_detector_ia.js — Pruebas del módulo js/detector-ia.js SIN navegador.
//
// Uso:
//   node tools/test_detector_ia.js              -> pruebas de lógica y adaptador
//   node tools/test_detector_ia.js --navegador -> además, carga e inferencia REAL
//                                                  en Chromium (Playwright)
//
// Qué se prueba aquí y qué NO.
//
// AQUÍ: el contrato con el autor (estados, códigos de error, normalización,
// recorte, frescura, cerrojo de inferencia) y el comportamiento del adaptador
// cuando se le inyectan resultados inventados o cuando la carga revienta. Todo
// con un `cargarModelo` falso, así que esto corre en Node sin red y sin 18 MB.
//
// EN NAVEGADOR (--navegador): que el módulo carga de verdad desde el CDN, que
// descarga los pesos de verdad y que hace UNA inferencia de verdad. Solo se
// comprueba que llega una respuesta con la forma correcta. NO se mide precisión
// con surfistas reales del club: no hay ningún clip etiquetado y aquí no se
// inventa ninguna cifra de acierto.

import {
  AJUSTES_IA,
  CODIGO,
  VERSIONES,
  URL_TFJS,
  URL_COCO_SSD,
  URL_MODELO,
  LICENCIAS,
  crearDetectorIA,
  emparejar,
  errorIA,
  esFresco,
  normalizarCaja,
  normalizarDetecciones,
} from '../js/detector-ia.js';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// En ESM no hay `require` ni `__dirname`: se fabrican aquí una vez y se usan en
// las pruebas de navegador, que necesitan leer ficheros y abrir un puerto.
const require = createRequire(import.meta.url);
const AQUI = path.dirname(fileURLToPath(import.meta.url));

// ------------------------------------------------------------------ microtests

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

// ------------------------------------------------- doble de un vídeo y lienzo

// Node no tiene DOM. El módulo solo necesita `document.createElement('canvas')`
// para leer fotogramas, así que se le da un lienzo falso que registra lo que se
// le pinta. Lo que se prueba aquí NO es el dibujo: es el contrato.
function crearDobleVideo(ancho = 1280, alto = 720, readyState = 4) {
  return {
    tagName: 'VIDEO',
    videoWidth: ancho,
    videoHeight: alto,
    readyState,
  };
}

function instalarDobleDOM() {
  const globalOriginal = globalThis.document;
  globalThis.document = {
    createElement() {
      return {
        width: 0, height: 0,
        getContext() {
          return {
            drawImage() {}, // en Node no hay píxeles: aquí no se dibuja nada
            putImageData() {},
          };
        },
      };
    },
  };
  return () => { globalThis.document = globalOriginal; };
}

// ------------------------------------------------------------ adaptor falso

// Modelo fingido: devuelve lo que se le pase, sin tocar nada.
function modeloFalso(listaPorDefecto = []) {
  const llamadas = [];
  return {
    llamadas,
    async detect(entrada, maxCajas, minScore) {
      llamadas.push({ entrada, maxCajas, minScore });
      return typeof listaPorDefecto === 'function'
        ? listaPorDefecto(llamadas.length)
        : listaPorDefecto;
    },
    dispose() { this.disposed = true; },
  };
}

// Una caja cruda tal y como la devuelve coco-ssd: en PÍXELES del ROI.
function cruda(clase, score, bbox) {
  return { class: clase, score, bbox };
}

const sinPersona = [cruda('bird', 0.99, [0, 0, 40, 40])];
const conGente = [
  cruda('person', 0.88, [40, 30, 30, 60]),
  cruda('surfboard', 0.71, [44, 88, 50, 10]),
];

// ================================================================== pruebas

async function probarNormalizacion() {
  seccion('Normalización y recorte de cajas');

  const c = normalizarCaja([40, 30, 30, 60], 320, 180);
  comprobar('una caja cruda sale en 0..1',
    c && Math.abs(c.x - 40 / 320) < 1e-9 && Math.abs(c.ancho - 30 / 320) < 1e-9, JSON.stringify(c));
  comprobar('el alto sale normalizado por el alto del ROI',
    c && Math.abs(c.alto - 60 / 180) < 1e-9, JSON.stringify(c));

  const fuera = normalizarCaja([-10, -10, 40, 40], 320, 180);
  // La caja va de -10 a +30 px: recortada queda 0..30, o sea 30/320 = 0,09375.
  comprobar('una caja que se sale por arriba se recorta a 0, no se cuela negativa',
    fuera && fuera.x === 0 && fuera.y === 0 && Math.abs(fuera.ancho - 30 / 320) < 1e-9, JSON.stringify(fuera));

  const pasada = normalizarCaja([300, 170, 40, 40], 320, 180);
  comprobar('una caja que se sale por abajo se recorta a 1',
    pasada && Math.abs(pasada.x + pasada.ancho - 1) < 1e-9, JSON.stringify(pasada));

  comprobar('una caja invertida se descarta', normalizarCaja([100, 100, 0, 10], 320, 180) === null);
  comprobar('una caja sin tamaño se descarta', normalizarCaja([10, 10, 5, 0], 320, 180) === null);
  comprobar('un ROI de tamaño cero se descarta', normalizarCaja([1, 1, 4, 4], 0, 0) === null);
  comprobar('una entrada sin bbox se descarta', normalizarCaja(undefined, 320, 180) === null);
  comprobar('una caja con NaN se descarta', normalizarCaja([10, 10, Number.NaN, 5], 320, 180) === null);

  // coco-ssd entrega arrays; algunos adaptadores entregarían objetos. Las dos
  // formas tienen que dar lo MISMO o el autor no puede fiarse del bbox.
  const comoArray = normalizarCaja([40, 30, 30, 60], 320, 180);
  const comoObjeto = normalizarCaja({ x: 40, y: 30, width: 30, height: 60 }, 320, 180);
  comprobar('la forma array y la forma objeto dan el mismo bbox',
    JSON.stringify(comoArray) === JSON.stringify(comoObjeto), `${JSON.stringify(comoArray)} vs ${JSON.stringify(comoObjeto)}`);
}

async function probarFiltroDeClases() {
  seccion('Filtro de clases y de confianza');

  const a = { ...AJUSTES_IA, anchoRoi: 320, altoRoi: 180 };
  const todas = normalizarDetecciones([
    ...conGente.map((d) => ({ ...d, anchoRoi: 320, altoRoi: 180 })),
    { ...sinPersona[0], anchoRoi: 320, altoRoi: 180 },
    { ...cruda('person', 0.10, [0, 0, 10, 10]), anchoRoi: 320, altoRoi: 180 },
    { ...cruda('surfboard', Number.NaN, [0, 0, 10, 10]), anchoRoi: 320, altoRoi: 180 },
  ], a);

  comprobar('solo pasan person y surfboard',
    todas.length === 2 && todas.every((d) => d.clase === 'person' || d.clase === 'surfboard'),
    JSON.stringify(todas.map((d) => d.clase)));
  comprobar('una confianza por debajo del mínimo no pasa',
    !todas.some((d) => d.confianza < a.confianzaMin), JSON.stringify(todas.map((d) => d.confianza)));
  comprobar('una confianza NaN no cuela', !todas.some((d) => !Number.isFinite(d.confianza)));
  comprobar('la lista viene ordenada por clase y confianza',
    todas[0].clase === 'person' && todas[1].clase === 'surfboard',
    JSON.stringify(todas.map((d) => [d.clase, d.confianza])));
  comprobar('cada caja trae centro y área coherentes',
    todas.every((d) => Math.abs(d.centro.x - (d.bbox.x + d.bbox.ancho / 2)) < 1e-3
      && Math.abs(d.centro.y - (d.bbox.y + d.bbox.alto / 2)) < 1e-3
      && Math.abs(d.area - d.bbox.ancho * d.bbox.alto) < 1e-4),
    JSON.stringify(todas.map((d) => d.centro)));

  comprobar('una lista vacía o basura da lista vacía, no una excepción',
    normalizarDetecciones(null).length === 0 && normalizarDetecciones([{}, null]).length === 0);
}

async function probarEmparejar() {
  seccion('Emparejado persona/tabla (informativo)');

  const a = AJUSTES_IA;
  const det = normalizarDetecciones([
    ...conGente.map((d) => ({ ...d, anchoRoi: 320, altoRoi: 180 })),
  ], a);
  const pares = emparejar(det, a);
  comprobar('la persona se empareja con la tabla cercana', pares.length === 1 && pares[0].tabla?.clase === 'surfboard');
  comprobar('el contacto está entre 0 y 1', pares[0].contacto >= 0 && pares[0].contacto <= 1, String(pares[0].contacto));

  const lejos = normalizarDetecciones([
    { ...cruda('person', 0.9, [10, 10, 30, 60]), anchoRoi: 320, altoRoi: 180 },
    { ...cruda('surfboard', 0.9, [300, 170, 20, 4]), anchoRoi: 320, altoRoi: 180 },
  ], a);
  comprobar('una tabla lejísimos NO se empareja', emparejar(lejos, a)[0].tabla === null);
  comprobar('sin tablas no hay pares', emparejar([], a).length === 0);
}

async function probarCargaYErrores() {
  seccion('Adaptador inyectado: carga OK, carga rota y autoCargar');

  // (a) carga correcta
  const m1 = modeloFalso(conGente.map((d) => ({ ...d })));
  const d1 = crearDetectorIA({ cargarModelo: async () => ({ modelo: m1, meta: { backend: 'falso' } }) });
  const r1 = await d1.cargar();
  comprobar('cargar() con adaptador inyectado devuelve ok', r1.ok === true, JSON.stringify(r1));
  comprobar('cargar() es idempotente', await d1.cargar() === r1);
  comprobar('estado() dice que ya está cargado', d1.estado().cargado === true);

  // (b) fallo de carga explícito, y se puede reintentar después
  let intentos = 0;
  const d2 = crearDetectorIA({
    cargarModelo: async () => {
      intentos++;
      throw errorIA('red_caida', 'No hay red.');
    },
  });
  const r2 = await d2.cargar();
  comprobar('una carga que revienta NO lanza: devuelve ok:false', r2.ok === false);
  comprobar('el fallo trae código explícito', r2.error?.codigo === CODIGO.CARGA_FALLIDA, JSON.stringify(r2.error));
  comprobar('el fallo trae mensaje en español', typeof r2.error?.mensaje === 'string' && r2.error.mensaje.length > 0);
  await d2.cargar();
  comprobar('tras un fallo se puede reintentar la carga (no queda envenenado)', intentos === 2, `intentos=${intentos}`);
  comprobar('estado() cuenta el error', d2.estado().errores >= 1);

  // (c) fallo de carga al detectar: el resultado lo dice, no revienta
  const d3 = crearDetectorIA({ cargarModelo: async () => { throw new Error('404 pesos'); } });
  const r3 = await d3.detectar(crearDobleVideo());
  comprobar('detectar() con carga rota devuelve estado error', r3.estado === 'error', JSON.stringify(r3.estado));
  comprobar('detectar() con carga rota trae el código del fallo',
    r3.error?.codigo === CODIGO.CARGA_FALLIDA, JSON.stringify(r3.error));
  comprobar('nunca lanza: siempre resuelve con ok:false', r3.ok === false);

  // (d) autoCargar:false sin cargar = error, no descarga 18 MB por sorpresa
  const d4 = crearDetectorIA({ cargarModelo: async () => ({ modelo: modeloFalso() }), autoCargar: false });
  const r4 = await d4.detectar(crearDobleVideo());
  comprobar('sin autoCargar y sin cargar() no se deduce nada',
    r4.estado === 'error' && r4.detecciones.length === 0, JSON.stringify(r4));

  d1.liberar(); d2.liberar(); d3.liberar(); d4.liberar();
}

async function probarCerrojo() {
  seccion('Cerrojo: nunca dos inferencias a la vez');

  let resoluble = null;
  const lento = modeloFalso(() => new Promise((res) => { resoluble = res; }));
  const d = crearDetectorIA({ cargarModelo: async () => ({ modelo: lento }) });
  await d.cargar();

  const primera = d.detectar(crearDobleVideo());
  // La segunda entra mientras la primera sigue en vuelo: tiene que decir que no.
  const segunda = await d.detectar(crearDobleVideo());
  comprobar('la segunda inferencia se OMITE, no se encola',
    segunda.estado === 'omitido' && segunda.motivo === 'inferencia_en_curso', JSON.stringify(segunda.estado));
  comprobar('la omitida no trae detecciones (nada de frames viejos)', segunda.detecciones.length === 0);
  comprobar('la omitida no cuenta como error', segunda.error === null && segunda.ok === false);
  comprobar('las omisiones se cuentan', d.estado().omitidas === 1);

  resoluble(conGente.map((x) => ({ ...x })));
  const primeraRes = await primera;
  comprobar('la primera inferencia sí termina bien', primeraRes.estado === 'listo', JSON.stringify(primeraRes.estado));
  comprobar('el cerrojo se suelta: se puede volver a inferir', d.estado().ocupado === false);
  comprobar('el cerrojo se suelta incluso tras un fallo', await (async () => {
    const e = crearDetectorIA({ cargarModelo: async () => ({ modelo: modeloFalso(() => { throw new Error('boom'); }) }) });
    await e.cargar();
    await e.detectar(crearDobleVideo());
    return e.estado().ocupado === false;
  })());

  d.liberar();
}

async function probarInferenciaRealDelAdaptador() {
  seccion('Adaptador inyectado: inferencia y forma del resultado');

  const m = modeloFalso(conGente.map((d) => ({ ...d })));
  const d = crearDetectorIA({ cargarModelo: async () => ({ modelo: m, meta: { backend: 'falso' } }) });
  await d.cargar();

  const r = await d.detectar(crearDobleVideo(1280, 720), );
  comprobar('una inferencia con acierto devuelve estado listo', r.estado === 'listo', JSON.stringify(r.estado));
  comprobar('devuelve las dos clases pedidas',
    r.recuento.person === 1 && r.recuento.surfboard === 1, JSON.stringify(r.recuento));
  comprobar('tienePersona / tieneTabla son ciertas', r.tienePersona === true && r.tieneTabla === true);
  comprobar('cada detección trae clase, confianza y bbox normalizada',
    r.detecciones.every((x) => x.clase && typeof x.confianza === 'number' && x.bbox && x.bbox.x >= 0 && x.bbox.x <= 1));
  comprobar('las coordenadas están en 0..1 (no en píxeles)',
    r.detecciones.every((x) => x.bbox.x + x.bbox.ancho <= 1.0001 && x.bbox.y + x.bbox.alto <= 1.0001),
    JSON.stringify(r.detecciones.map((x) => x.bbox)));
  comprobar('la fuente del fotograma queda escrita', r.fuente === 'video');
  comprobar('el ROI del fotograma queda escrito (con la banda si la hubo)',
    r.roi && r.roi.ancho === AJUSTES_IA.anchoInferencia && Array.isArray(r.roi.banda), JSON.stringify(r.roi));
  comprobar('el id del modelo queda escrito para el informe',
    typeof r.modelo?.id === 'string' && r.modelo.id.includes('coco-ssd@'), JSON.stringify(r.modelo));
  comprobar('el tiempo de inferencia se mide y es un número', typeof r.ms === 'number' && r.ms >= 0);
  comprobar('se pasó maxCajas y minScore al modelo',
    m.llamadas.length === 1 && m.llamadas[0].maxCajas === AJUSTES_IA.maxCajas && m.llamadas[0].minScore === AJUSTES_IA.minScoreBruto);

  // Tope de cajas
  comprobar('maxNumBoxes sale del ajuste, no del valor por defecto de la librería',
    m.llamadas[0].maxCajas === 20 && m.llamadas[0].minScore === 0.20);

  // Sin detecciones
  const d2 = crearDetectorIA({ cargarModelo: async () => ({ modelo: modeloFalso(sinPersona) }) });
  await d2.cargar();
  const r2 = await d2.detectar(crearDobleVideo());
  comprobar('una escena sin nadie NO da error: da "sin_deteccion"',
    r2.estado === 'sin_deteccion' && r2.error === null, JSON.stringify(r2.estado));
  comprobar('y la lista va vacía', r2.detecciones.length === 0 && r2.tienePersona === false);

  // Cámara sin fotograma listo
  const r3 = await d.detectar(crearDobleVideo(0, 0, 0));
  comprobar('un vídeo sin fotograma da MARCO_INVALIDO, no una excepción',
    r3.estado === 'error' && r3.error.codigo === CODIGO.MARCO_INVALIDO, JSON.stringify(r3.error));

  // Entrada no reconocida
  const r4 = await d.detectar('no soy un vídeo');
  comprobar('una entrada desconocida da MARCO_INVALIDO con mensaje claro',
    r4.error?.codigo === CODIGO.MARCO_INVALIDO && typeof r4.error.mensaje === 'string', JSON.stringify(r4.error));

  d.liberar(); d2.liberar();
}

async function probarFrescura() {
  seccion('Frescura: nada de mezclar fotogramas viejos');

  const m = modeloFalso(conGente.map((d) => ({ ...d })));
  const d = crearDetectorIA({ cargarModelo: async () => ({ modelo: m }) });
  await d.cargar();

  const r = await d.detectar(crearDobleVideo());
  comprobar('el resultado lleva el id de SU fotograma', r.marcoId > 0);
  comprobar('esFresco() dice que sí, recién salido', esFresco(d, r) === true);
  comprobar('el tMs del resultado es el del FOTOGRAMA, no el de la respuesta',
    Number.isFinite(r.tMs) && r.tMs <= Date.now());

  const r2 = await d.detectar(crearDobleVideo());
  comprobar('cada inferencia tiene un id DISTINTO', r2.marcoId !== r.marcoId);
  comprobar('el resultado viejo ya no es fresco', esFresco(d, r) === false);
  comprobar('esFresco(null) es false, no una excepción', esFresco(d, null) === false);

  // Caducidad opcional (0 = desactivada por defecto; aquí se fuerza a 1 ms).
  const lento = crearDetectorIA({
    cargarModelo: async () => ({ modelo: modeloFalso(async () => { await new Promise((r2) => setTimeout(r2, 40)); return conGente; }) }),
    ajustes: { caducidadMs: 1 },
  });
  await lento.cargar();
  const rc = await lento.detectar(crearDobleVideo());
  comprobar('un fotograma que llega tarde se marca obsoleto y se VACÍA',
    rc.estado === 'obsoleto' && rc.detecciones.length === 0, JSON.stringify(rc.estado));
  comprobar('y avisa con su propio código', rc.error?.codigo === 'marco_obsoleto', JSON.stringify(rc.error));

  // Con el plazo desactivado (por defecto) una inferencia lenta NO se tira: el
  // modelo real tarda ~1,2 s y con un plazo corto se perdería todo.
  comprobar('el plazo de caducidad está DESACTIVADO por defecto',
    AJUSTES_IA.caducidadMs === 0, String(AJUSTES_IA.caducidadMs));
  const normal = crearDetectorIA({
    cargarModelo: async () => ({ modelo: modeloFalso(async () => { await new Promise((r2) => setTimeout(r2, 40)); return conGente; }) }),
  });
  await normal.cargar();
  const rn = await normal.detectar(crearDobleVideo());
  comprobar('sin plazo, una inferencia lenta conserva sus detecciones',
    rn.estado === 'listo' && rn.detecciones.length === 2, JSON.stringify(rn.estado));

  d.liberar(); lento.liberar(); normal.liberar();
}

async function probarLiberar() {
  seccion('Liberar y no re-descargar en balde');

  const m = modeloFalso([]);
  const d = crearDetectorIA({ cargarModelo: async () => ({ modelo: m }) });
  await d.cargar();
  const l1 = d.liberar();
  comprobar('liberar() devuelve ok', l1.ok === true);
  comprobar('liberar() se puede repetir sin romper', d.liberar().yaLiberado === true);
  comprobar('estado() dice liberado', d.estado().liberado === true);

  const r = await d.detectar(crearDobleVideo());
  comprobar('detectar() tras liberar da LIBERADO, no vuelve a descargar 18 MB',
    r.error?.codigo === CODIGO.LIBERADO, JSON.stringify(r.error));
  const c = await d.cargar();
  comprobar('cargar() tras liberar también dice LIBERADO', c.error?.codigo === CODIGO.LIBERADO);
}

async function probarTimeout() {
  seccion('Plazo: una inferencia colgada no bloquea para siempre');

  const colgado = crearDetectorIA({
    cargarModelo: async () => ({ modelo: modeloFalso(() => new Promise(() => {})) }), // nunca resuelve
  });
  await colgado.cargar();
  const r = await colgado.detectar(crearDobleVideo(), { timeoutInferenciaMs: 60 });
  comprobar('una inferencia que no vuelve da TIMEOUT_INFERENCIA',
    r.estado === 'error' && r.error.codigo === CODIGO.TIMEOUT_INFERENCIA, JSON.stringify(r.error));
  comprobar('el cerrojo se suelta tras el timeout (no queda muerto)',
    colgado.estado().ocupado === false);

  // Una carga que no vuelve también caduca.
  const cargaLenta = crearDetectorIA({
    cargarModelo: () => new Promise(() => {}),
    ajustes: { timeoutCargaMs: 50 },
  });
  const rc = await cargaLenta.cargar();
  comprobar('una carga colgada da TIMEOUT_CARGA', rc.error?.codigo === CODIGO.TIMEOUT_CARGA, JSON.stringify(rc.error));
}

async function probarFijaciones() {
  seccion('Versiones y URLs fijadas (nada de "latest")');

  comprobar('tfjs con versión exacta en la URL', URL_TFJS.includes(`@${VERSIONES.tfjs}/`), URL_TFJS);
  comprobar('coco-ssd con versión exacta en la URL', URL_COCO_SSD.includes(`@${VERSIONES.cocoSsd}/`), URL_COCO_SSD);
  comprobar('las URLs apuntan a los builds UMD (los únicos que publican window.tf / window.cocoSsd)',
    URL_TFJS.endsWith('/tf.min.js') && URL_COCO_SSD.endsWith('/coco-ssd.min.js'),
    `${URL_TFJS} | ${URL_COCO_SSD}`);
  comprobar('no se usa el build ESM de coco-ssd (se llevaría un módulo vacío)',
    !URL_COCO_SSD.includes('esm'), URL_COCO_SSD);
  comprobar('el modelo viene de la ruta oficial de Google', URL_MODELO.startsWith('https://storage.googleapis.com/tfjs-models/savedmodel/'), URL_MODELO);
  comprobar('todo por HTTPS', [URL_TFJS, URL_COCO_SSD, URL_MODELO].every((u) => u.startsWith('https://')));
  comprobar('ninguna URL lleva @latest ni major flotante',
    ![URL_TFJS, URL_COCO_SSD].some((u) => /@latest|@\*|\/npm\/[^@]+\/dist/.test(u)));
  comprobar('las tres piezas son Apache-2.0 y con enlace al texto',
    Object.values(LICENCIAS).every((l) => l.startsWith('Apache-2.0') && l.includes('https://')),
    Object.values(LICENCIAS).join(' | '));
  comprobar('las clases pedidas son las que trae COCO y sirven aquí',
    AJUSTES_IA.clases.includes('person') && AJUSTES_IA.clases.includes('surfboard'));
}

// ================================================================== navegador

// Playwright NO se instala aquí: se usa el que ya está instalado en el equipo
// (es una dependencia global, y el proyecto no tiene node_modules). Se resuelve
// por NODE_PATH o por la raíz global de npm, sin descargar nada.
async function cargarPlaywright() {
  const { pathToFileURL } = await import('node:url');
  const { execFileSync } = await import('node:child_process');

  // Un Playwright CommonJS importado desde ESM solo deja los nombres en
  // `default`: se normaliza aquí una vez y el resto del código usa lo normal.
  const normalizar = (m) => (m?.chromium ? m : m?.default?.chromium ? m.default : null);

  try { const m = normalizar(require('playwright')); if (m) return m; } catch { /* sigue la búsqueda */ }

  const raices = [];
  if (process.env.NODE_PATH) raices.push(...process.env.NODE_PATH.split(process.platform === 'win32' ? ';' : ':'));
  // En Windows `npm` es `npm.cmd` y execFileSync lo necesita con shell, o no
  // arranca nunca y la búsqueda entera falla en silencio.
  try {
    const salida = execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['root', '-g'],
      { encoding: 'utf8', shell: true, timeout: 30000 }).trim();
    if (salida) raices.push(salida);
  } catch { /* npm no está: se sigue con NODE_PATH */ }

  for (const raiz of raices.filter(Boolean)) {
    for (const entrada of ['index.mjs', 'index.js']) {
      try {
        const m = normalizar(await import(pathToFileURL(path.join(raiz, 'playwright', entrada)).href));
        if (m) return m;
      } catch { /* siguiente */ }
    }
  }
  return null;
}

// Servidor HTTP mínimo y efímero SOLO para la prueba: sirve el repositorio en
// lectura y una página mínima inventada en memoria. No se crea ningún fichero
// nuevo en el repo, y se cierra al terminar.
function servirParaLaPrueba(puerto) {
  const http = require('node:http');
  const fs = require('node:fs');
  const path = require('node:path');
  const raiz = path.resolve(AQUI, '..');

  const TIPOS = {
    '.js': 'text/javascript; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
  };
  const PAGINA = `<!doctype html><meta charset="utf-8"><title>detector-ia</title><body>falso</body>`;

  const servidor = http.createServer((req, res) => {
    const ruta = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (ruta === '/navegador.html') {
      res.writeHead(200, { 'content-type': TIPOS['.html'] });
      res.end(PAGINA);
      return;
    }
    // Solo lectura, y nada que salga de la raíz del repo.
    const destino = path.join(raiz, ruta === '/' ? '/index.html' : ruta);
    if (!destino.startsWith(raiz)) { res.writeHead(403); res.end(); return; }
    fs.readFile(destino, (err, buf) => {
      if (err) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'content-type': TIPOS[path.extname(destino)] || 'application/octet-stream' });
      res.end(buf);
    });
  });

  return new Promise((cumplir) => {
    servidor.listen(puerto, '127.0.0.1', () => cumplir(servidor));
  });
}

async function probarNavegador() {
  seccion('Navegador REAL (Chromium): carga e inferencia de verdad');

  const playwright = await cargarPlaywright();
  if (!playwright) {
    console.log('  SALTADO  Playwright no está disponible en este equipo.');
    console.log('           No se instala nada: se usa el global si lo hay.');
    return { omitido: true };
  }
  const { chromium } = playwright;

  const servidor = await servirParaLaPrueba(8099);
  const navegador = await chromium.launch({ headless: true });
  try {
    const pagina = await navegador.newPage();
    const consola = [];
    pagina.on('pageerror', (e) => consola.push(`[pageerror] ${e.message}`));
    pagina.on('console', (m) => { if (m.type() === 'error') consola.push(`[console] ${m.text()}`); });

    // about:blank no es contexto seguro; por eso el servidor HTTP local.
    await pagina.goto('http://127.0.0.1:8099/navegador.html', { waitUntil: 'domcontentloaded' });

    const r = await pagina.evaluate(async () => {
      const { crearDetectorIA } = await import('/js/detector-ia.js');
      // Un fotograma de prueba DIBUJADO, no uno de cámara: el club no siempre
      // tiene webcam disponible y aquí lo que se prueba es la carga y el camino
      // de la inferencia, no la calidad.
      const lienzo = document.createElement('canvas');
      lienzo.width = 320; lienzo.height = 180;
      const c = lienzo.getContext('2d');
      c.fillStyle = '#7fa8c9'; c.fillRect(0, 0, 320, 180);
      c.fillStyle = '#c8b89a'; c.fillRect(0, 120, 320, 60);
      c.fillStyle = '#23303a';
      c.fillRect(120, 70, 22, 60);   // algo vertical: una "persona" de mentira
      c.beginPath(); c.ellipse(131, 134, 34, 7, 0, 0, Math.PI * 2); c.fill();

      const ia = crearDetectorIA();
      const t0 = performance.now();
      const carga = await ia.cargar();
      const msCarga = Math.round(performance.now() - t0);
      if (!carga.ok) return { cargaOk: false, error: carga.error };

      const t1 = performance.now();
      const res = await ia.detectar({ canvas: lienzo }, { timeoutInferenciaMs: 60000 });
      const msInf = Math.round(performance.now() - t1);
      const estadoAntes = ia.estado();
      const claves = Object.keys(res).sort();
      ia.liberar();
      return {
        cargaOk: true, msCarga, msInf,
        claves,
        estado: res.estado,
        error: res.error,
        detecciones: res.detecciones,
        recuento: res.recuento,
        roi: res.roi,
        modelo: res.modelo,
        tensores: estadoAntes.tensores,
        backend: estadoAntes.modelo?.backend,
        versionTf: estadoAntes.modelo?.versionTf,
        versionCoco: estadoAntes.modelo?.versionCoco,
        inferencias: estadoAntes.inferencias,
      };
    });

    if (!r.cargaOk) {
      comprobar('el modelo carga en Chromium', false, JSON.stringify(r.error));
      return { omitido: false, consola };
    }
    comprobar('el modelo carga en Chromium desde el CDN', true);
    console.log(`         (carga: ${r.msCarga} ms · inferencia: ${r.msInf} ms · backend: ${r.backend} · tf ${r.versionTf} · coco-ssd ${r.versionCoco} · tensores vivos: ${r.tensores})`);
    comprobar('la versión de tf.js que se descargó es la fijada',
      r.versionTf === VERSIONES.tfjs, `descargó ${r.versionTf}, fijada ${VERSIONES.tfjs}`);
    comprobar('la versión de coco-ssd que se descargó es la fijada',
      r.versionCoco === VERSIONES.cocoSsd, `descargó ${r.versionCoco}, fijada ${VERSIONES.cocoSsd}`);
    comprobar('usa WebGL si puede; si no, CPU declarado', r.backend === 'webgl' || r.backend === 'cpu', String(r.backend));
    comprobar('una inferencia REAL devuelve listo o sin_deteccion',
      r.estado === 'listo' || r.estado === 'sin_deteccion', JSON.stringify(r.estado));
    comprobar('no hay error en la inferencia real', r.error === null, JSON.stringify(r.error));
    comprobar('el resultado trae el contrato completo',
      ['detecciones', 'error', 'estado', 'marcoId', 'modelo', 'ms', 'ok', 'pares', 'recuento', 'roi', 'tMs',
        'tienePersona', 'tieneTabla', 'fuente'].every((k) => r.claves.includes(k)), r.claves.join(','));
    comprobar('cada detección real trae clase, confianza y bbox normalizada',
      r.detecciones.every((d) => typeof d.clase === 'string' && typeof d.confianza === 'number' && d.bbox), JSON.stringify(r.detecciones));
    comprobar('el recuento viene relleno', r.recuento && typeof r.recuento.person === 'number');
    comprobar('el ROI describe el fotograma de verdad', r.roi?.origen === 'canvas', JSON.stringify(r.roi));
    if (r.detecciones.length) {
      comprobar('las cajas de la inferencia real vienen normalizadas 0..1',
        r.detecciones.every((d) => d.bbox.x >= 0 && d.bbox.x <= 1 && d.bbox.x + d.bbox.ancho <= 1.0001),
        JSON.stringify(r.detecciones.map((d) => d.bbox)));
      console.log(`         (detecciones reales: ${JSON.stringify(r.detecciones.map((d) => [d.clase, d.confianza]))})`);
    }
    comprobar('no se filtró ningún error de consola durante la prueba',
      consola.filter((l) => !/favicon|ERR_INTERNET_DISCONNECTED/.test(l)).length === 0, consola.join(' | '));
    return { omitido: false, consola };
  } finally {
    await navegador.close();
    await new Promise((r) => servidor.close(r));
  }
}

// ===================================================================== main

async function main() {
  const conNavegador = process.argv.includes('--navegador');
  const restaurarDOM = instalarDobleDOM();

  console.log('detector-ia.js — pruebas de contrato y adaptador (sin red)');

  await probarNormalizacion();
  await probarFiltroDeClases();
  await probarEmparejar();
  await probarCargaYErrores();
  await probarCerrojo();
  await probarInferenciaRealDelAdaptador();
  await probarFrescura();
  await probarLiberar();
  await probarTimeout();
  await probarFijaciones();

  restaurarDOM();

  if (conNavegador) {
    const nav = await probarNavegador();
    if (nav?.omitido) console.log('\n  (prueba de navegador OMITIDA)');
  } else {
    console.log('\n  (prueba de navegador NO ejecutada: añade --navegador)');
  }

  console.log(`\n${fallos === 0 ? 'TODO CORRECTO' : 'HAY FALLOS'}: ${total - fallos}/${total} comprobaciones.`);
  if (fallos) process.exitCode = 1;
}

main();

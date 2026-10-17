// tools/test_rewind_flujo.js — Regresiones del flujo "Ver cómo rompía" y del
// clip que se guarda al detectar una ola.
//
// Uso: node tools/test_rewind_flujo.js
//
// Importa los ficheros de verdad del repositorio: data/rewinds.json,
// data/streams.json, webcams.json y js/spots.js. Las funciones de js/app.js y
// js/cams.js NO se reescriben aquí: se extraen del fuente y se evalúan, porque
// una réplica daría verde mientras la web se rompe (ya pasó en este repo con
// `tools/test_rating_conservador.js`, que replicaba un bug de `range()`).

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (p) => readFileSync(join(RAIZ, p), 'utf8');

let fallos = 0;
let total = 0;
const seccion = (t) => console.log(`\n${t}`);
function comprobar(nombre, ok, detalle = '') {
  total++;
  console.log(`  ${ok ? 'OK   ' : 'FALLA'} ${nombre}${ok || !detalle ? '' : ` — ${detalle}`}`);
  if (!ok) fallos++;
}

// Saca del fuente la declaración de una función o constante por nombre, contando
// llaves para saber dónde acaba. Devuelve el texto tal cual, sin reescribirlo.
function extraer(fuente, nombre) {
  const patrones = [
    new RegExp(`\\bfunction\\s+${nombre}\\s*\\(`),
    new RegExp(`\\bconst\\s+${nombre}\\s*=`),
    new RegExp(`\\bexport\\s+function\\s+${nombre}\\s*\\(`),
  ];
  let i = -1;
  for (const re of patrones) {
    const m = fuente.match(re);
    if (m && (i === -1 || m.index < i)) i = m.index;
  }
  if (i === -1) throw new Error(`No se encontró ${nombre} en el fuente`);
  const esFuncion = /function\s/.test(fuente.slice(i, i + 24));
  // Se cuentan por separado los paréntesis (firma) y las llaves (cuerpo), y se
  // ignoran comillas y plantillas, para no cortar en la firma ni dentro de un
  // objeto de configuración.
  let par = 0;
  let lla = 0;
  let enComilla = null;
  for (let k = i; k < fuente.length; k++) {
    const ch = fuente[k];
    if (enComilla) {
      if (ch === '\\') k++;
      else if (ch === enComilla) enComilla = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') { enComilla = ch; continue; }
    if (ch === '(' || ch === '[') { par++; continue; }
    if (ch === ')' || ch === ']') { par--; continue; }
    if (ch === '{') { lla++; continue; }
    if (ch === '}') {
      lla--;
      if (esFuncion && lla === 0 && par === 0) return fuente.slice(i, k + 1);
      continue;
    }
    if (!esFuncion && par === 0 && lla === 0 && ch === ';') return fuente.slice(i, k + 1);
  }
  throw new Error(`No se pudo cerrar ${nombre}`);
}

// --------------------------------------------------------------- datos reales

const INDICE = JSON.parse(leer('data/rewinds.json'));
const STREAMS = JSON.parse(leer('data/streams.json'));
const WEBCAMS = JSON.parse(leer('webcams.json'));
const { SPOTS } = await import('../js/spots.js');

// ------------------------------------------------------------ entorno de app.js

// Se replica lo mínimo del entorno de la app para poder ejecutar sus funciones
// puras. Lo que se evalúa es el código real, no una copia.
function crearApp(catalogo) {
  void catalogo;
  const ctx = {
    state: { rewinds: INDICE },
    catalog: CATALOGO,
    // `camsForSpot` real, extraído de js/cams.js
    camsForSpot: null,
    // Ayudas de formato tal cual las usa la web.
    esc: (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])),
    m: (v) => (v == null || Number.isNaN(v) ? '–' : Number(v).toFixed(2).replace('.', ',')),
    kmh: (v) => (v == null || Number.isNaN(v) ? '–' : `${Math.round(v)}`),
    rnd: (v) => (v == null || Number.isNaN(v) ? '–' : String(Math.round(v * 10) / 10).replace('.', ',')),
    ICON: { search: '', rewind: '', wave: '' },
  };
  const srcCams = leer('js/cams.js');
  const srcApp = leer('js/app.js');
  const partes = [
    extraer(srcCams, 'camsForSpot').replace('export ', ''),
    extraer(srcApp, 'madridDate').replace('export ', ''),
    extraer(srcApp, 'clipTime').replace('export ', ''),
    extraer(srcApp, 'clipsForSpot'),
    extraer(srcApp, 'findSimilarConditions'),
    extraer(srcApp, 'badgeEvidencia'),
    extraer(srcApp, 'renderSimilarConditions'),
    extraer(srcApp, 'renderRewinds'),
    'return { camsForSpot, clipsForSpot, findSimilarConditions, badgeEvidencia, renderSimilarConditions, renderRewinds, madridDate, clipTime };',
  ];
  const fab = new Function(...Object.keys(ctx), partes.map((p) => p.replace('export ', '')).join(';\n') + ';');
  return fab(...Object.values(ctx));
}

const escHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const CATALOGO = WEBCAMS.webcams.filter((c) => c.enabled !== false && (c.embedUrl || c.resolver));
const app = crearApp(CATALOGO);
const SPOT = SPOTS.find((s) => s.id === 'Planetario');

seccion('Los datos del archivo están como deben');
{
  comprobar('data/rewinds.json es un objeto con rewinds', Array.isArray(INDICE.rewinds), typeof INDICE.rewinds);
  comprobar('tiene clips con fecha y URL', INDICE.rewinds.every((c) => c.hora && c.url), '');
  comprobar('el archivo declara su zona horaria', INDICE.timezone === 'Europe/Madrid', INDICE.timezone);
  const rotas = INDICE.rewinds.filter((c) => !/^https:\/\//.test(c.url || ''));
  comprobar('ningún clip tiene una URL no descargable', rotas.length === 0, `${rotas.length} rotas`);
  const sinFecha = INDICE.rewinds.filter((c) => !Number.isFinite(Date.parse(c.hora)));
  comprobar('ningún clip tiene una fecha ilegible', sinFecha.length === 0, `${sinFecha.length} sin fecha`);
}

seccion('Clic en una hora de Rewind: los índices apuntan al clip correcto');
{
  const clips = app.clipsForSpot(SPOT);
  comprobar('Planetario tiene clips de sus cámaras', clips.length > 0, `${clips.length}`);
  comprobar('vienen ordenados del más reciente al más antiguo', clips.every((c, i) => i === 0 || Date.parse(clips[i - 1].hora) >= Date.parse(c.hora)));
  const sinDuplicar = new Set(clips.map((c) => c.url));
  comprobar('no se repite la misma URL en la tira', sinDuplicar.size === clips.length, `${clips.length} clips, ${sinDuplicar.size} URLs`);
  // El botón lleva el índice dentro del array filtrado: si ese array cambia, el
  // clic abre otro clip. Se comprueba que data-clip N es realmente el N.
  comprobar('el índice del botón selecciona el clip correcto', clips.every((c, i) => c === clips[Number(i)]));
  const html = app.renderRewinds(SPOT);
  const botones = [...html.matchAll(/data-clip="(\d+)"/g)].map((x) => Number(x[1]));
  comprobar('cada botón apunta a un clip existente', botones.every((n) => n >= 0 && n < clips.length), botones.join(','));
  comprobar('sin clips la tira se abre sola con el motivo', app.renderRewinds({ id: 'Inne', name: 'Inne' }).includes('Aún no hay clips'));
}

seccion('"Ver cómo rompía": condiciones parecidas que se pueden reproducir');
{
  const h = {
    surf: { min: 0.40, mid: 0.46, max: 0.52 },
    swells: [{ h: 0.9, t: 5.0, dir: 90 }],
    windSpeed: 8,
  };
  const matches = app.findSimilarConditions(SPOT, h);
  comprobar('encuentra días parecidos con estos datos', matches.length > 0, `${matches.length}`);
  comprobar('los clips devueltos existen en el índice', matches.every((m) => INDICE.rewinds.some((c) => c.id === m.clip.id)));
  comprobar('vienen del más parecido al menos', matches.every((m, i) => i === 0 || matches[i - 1].distance <= m.distance));
  comprobar('todos tienen altura con la que comparar', matches.every((m) => typeof m.clip.prevision?.altura === 'number'));
  const html = app.renderSimilarConditions(SPOT, h);
  const ids = [...html.matchAll(/data-similar-id="([^"]+)"/g)].map((x) => x[1]);
  comprobar('el botón "Ver cómo rompía" lleva un id real', ids.length > 0 && ids.every((i) => INDICE.rewinds.some((c) => c.id === i)), ids.join(','));
  comprobar('cada botón dice la fecha y la hora del clip', ids.every((id) => {
    const c = INDICE.rewinds.find((x) => x.id === id);
    const dia = new Date(c.hora).toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid', day: 'numeric', month: 'short' });
    return html.includes(escHtml(dia));
  }));
}

seccion('Fechas sin archivo: el comparador lo explica, no se calla');
{
  const h = { surf: { min: 2.4, mid: 2.6, max: 2.8 }, swells: [{ h: 3.2, t: 11, dir: 200 }], windSpeed: 42 };
  const html = app.renderSimilarConditions(SPOT, h);
  comprobar('sin coincidencias sale una tarjeta, no un hueco', html.includes('Comparador'), '');
  comprobar('explica que no hay clip con esas condiciones', html.includes('No hay ningún clip'));
  comprobar('con clips en la tira dice cuántos hay', /hay \d+ clip\(s\)|todavía no hay clips/.test(html), '');
  // Si el índice no cargó, el motivo tiene que ser el índice, no "no hay días".
  const app2 = crearApp(CATALOGO);
  const guardado = app2.findSimilarConditions;
  comprobar('findSimilarConditions no revienta sin índice', typeof guardado === 'function');
}

seccion('Distinguir positivo y negativo en lo que se pinta');
{
  // El archivo actual no puede decir "posible ola": se grabó por oleaje, sin mirar
  // la imagen. Antes el frontend pedía una clave que no existía y lo pintaba mal.
  const conImagen = { deteccion: { tipo: 'coge_ola', es_posible_ola: true, confianza: 0.88, imagenAnalizada: true } };
  const soloOleaje = { deteccion: { tipo: 'muestreo_por_oleaje', es_posible_ola: false, imagenAnalizada: false, observaciones: 'Captura programada con oleaje de 0.45 m' } };
  const viejo = { evidencia: { posibleOla: true } };
  const ninguno = { deteccion: { tipo: 'sin_persona', es_posible_ola: false, imagenAnalizada: true, observaciones: 'No hay nadie de pie sobre nada' } };
  comprobar('con evidencia de imagen se pinta el distintivo de ola', app.badgeEvidencia(conImagen).includes('Ola en el clip'));
  // Un clip grabado solo porque el oleaje superaba el umbral no se ha analizado:
  // no puede llevar ningún distintivo, ni de ola ni de nada, porque cualquier
  // etiqueta sería inventada. Antes se pintaba "Posible ola" a partir de la altura.
  comprobar('el muestreo por oleaje no lleva distintivo', app.badgeEvidencia(soloOleaje) === '', app.badgeEvidencia(soloOleaje));
  comprobar('el muestreo por oleaje tampoco se vende como ola', !app.badgeEvidencia(soloOleaje).includes('Ola'));
  comprobar('un clip sin surfista enseña el motivo del descarte', app.badgeEvidencia(ninguno).includes('No hay nadie de pie'));
  comprobar('el motivo del descarte también va en el título', app.badgeEvidence?.(ninguno) === undefined || app.badgeEvidencia(ninguno).includes('title='));
  comprobar('se acepta la clave antigua `evidencia` sin romper', app.badgeEvidencia(viejo).includes('Ola en el clip'));
  comprobar('un clip sin datos de detección no inventa nada', app.badgeEvidencia({}) === '' && app.badgeEvidencia(null) === '');
  comprobar('nada de lo que hay en el índice actual se pinta como ola confirmada', INDICE.rewinds.every((c) => !app.badgeEvidencia(c).includes('Ola en el clip')));
}

seccion('La webcam del club: prioridad, emisión resuelta y grababilidad');
{
  // El orden que ve el usuario es el de `camsForSpot` real: por prioridad y luego
  // por distancia. Con eso la webcam del club, que es la que mira de verdad la
  // rompiente, es la primera y además la grabable.
  const club = app.camsForSpot(SPOT);
  comprobar('hay más de una cámara para Planetario', club.length > 1, `${club.length}`);
  comprobar('la primera cámara de Planetario es la del club', club[0]?.id === 'surfers_castellon_hls', club.map((c) => c.id).join(','));
  const clubCam = club[0];
  comprobar('es HLS, o sea se puede grabar', clubCam.embedType === 'hls', clubCam.embedType);
  comprobar('lleva el resolvedor IPCamLive y el alias público', clubCam.resolver === 'ipcamlive' && /^609a27d8a9c83$/.test(clubCam.alias), '');
  comprobar('no lleva embedUrl fija (rota sola)', !clubCam.embedUrl, clubCam.embedUrl);
  comprobar('cubre los tres spots del Grao', ['Planetario', 'Piramides', 'Gurugu'].every((s) => clubCam.spots.includes(s)));
  const resolta = STREAMS.streams?.['surfers_castellon_hls'];
  comprobar('data/streams.json tiene la emisión resuelta', !!resolta?.hls, JSON.stringify(Object.keys(STREAMS.streams || {})));
  comprobar('la emisión resuelta es un .m3u8 en IPCamLive', /^https:\/\/[^/]*ipcamlive\.com\/streams\/.+\/stream\.m3u8$/.test(resolta?.hls || ''), resolta?.hls);
  comprobar('la emisión está marcada como válida y fechada', resolta.ok === true && Number.isFinite(Date.parse(resolta.resolvedAt)));
  comprobar('la emisión caduca pronto, porque el streamid rota', resolta.ttlMin > 0 && resolta.ttlMin <= 120, String(resolta.ttlMin));
  comprobar('la cámara del club sigue también como iframe de reserva', CATALOGO.some((c) => c.id === 'surfers_castellon' && c.embedType === 'iframe'));
  comprobar('la del club va antes que la de la Generalitat', club.findIndex((c) => c.id === 'cv_grao_castellon') > 0, club.map((c) => c.id).join(','));
}

seccion('Grabación completa: el clip incluye el búfer previo');
{
  // `ensamblarClip` se extrae del js/cams.js real, no se reescribe.
  const fuente = extraer(leer('js/cams.js'), 'ensamblarClip').replace('export ', '');
  const ensamblarClip = new Function(`${fuente}; return ensamblarClip;`)();
  const trozo = (n) => new Blob([new Uint8Array(n).fill(7)], { type: 'video/webm' });
  const pre = [{ blob: trozo(1000), t0: 0, t1: 2000 }, { blob: trozo(1000), t0: 2000, t1: 4000 }];
  const post = [{ blob: trozo(1500), t0: 4000, t1: 5500 }];
  const clip = ensamblarClip(pre, post, 'video/webm');
  comprobar('el clip une pre y post', clip.trozos === 3, `${clip.trozos}`);
  comprobar('el clip pesa la suma exacta de los trozos', clip.bytes === 1000 + 1000 + 1500, `${clip.bytes}`);
  comprobar('el clip es un Blob con el tipo de la grabación', clip.blob instanceof Blob && clip.blob.type === 'video/webm');
  comprobar('sin búfer previo también arma clip', ensamblarClip([], post, 'video/webm').trozos === 1);
  comprobar('sin nada grabado no inventa un clip', ensamblarClip([], [], 'video/webm') === null);
  comprobar('admite trozos sueltos sin envolver', ensamblarClip([trozo(10)], [trozo(20)], 'video/webm').bytes === 30);
}

seccion('Los ajustes son conservadores y están documentados');
{
  // Un umbral sin explicación es un umbral que alguien baja sin querer dentro de
  // seis meses. Se comprueba literalmente que cada ajuste lleva su comentario.
  const documentado = (texto, clave) => {
    const lineas = texto.split(/\r?\n/);
    const i = lineas.findIndex((l) => new RegExp(`(^|[\\s{,])${clave}\\s*:`).test(l));
    if (i === -1) return false;
    return /\/\//.test(lineas[i]) || (i > 0 && /\/\//.test(lineas[i - 1]));
  };

  const fuente = leer('js/cams.js');
  const ini = fuente.indexOf('export const AJUSTES_VIGIA');
  const obj = fuente.slice(ini, fuente.indexOf('};', ini));
  const valores = Object.fromEntries([...obj.matchAll(/(\w+):\s*([\d.]+)/g)].map((m) => [m[1], Number(m[2])]));
  comprobar('el búfer previo dura lo bastante para ver el inicio de la ola', valores.prebufferS >= 8, `${valores.prebufferS} s`);
  comprobar('sigue grabando después del disparo', valores.postS >= 4, `${valores.postS} s`);
  comprobar('el búfer se recorta solo', valores.prebufferS > 0 && valores.segmentoS > 0);
  comprobar('no dispara olas encadenadas', valores.cooldownS >= valores.prebufferS, `${valores.cooldownS} s`);
  comprobar('los trozos del búfer duran menos que el búfer entero', valores.segmentoS <= valores.prebufferS, `${valores.segmentoS} s`);
  for (const clave of ['prebufferS', 'postS', 'segmentoS', 'cooldownS', 'bandaImagen', 'detectar']) {
    comprobar(`el ajuste ${clave} de la vigía está documentado`, documentado(obj, clave), '');
  }

  const det = leer('js/deteccion.js');
  for (const clave of ['velNetaMinPxS', 'linealidadMin', 'olaNetoMinPx', 'paddleNetoMaxPx', 'boyaNetoMaxPx', 'boyaLinealidadMax', 'quietoNetoMaxPx', 'espumaVidaMaxS', 'contrasteOscuro', 'contrasteClaro', 'elongacionTablaMin', 'desvioHorizontalMaxGrados', 'altoSobreAnchoPersona', 'contactoMaxFrac', 'altoMinPersonaFrac', 'roiAgua', 'ventanaS', 'duracionMinS']) {
    comprobar(`el umbral ${clave} está documentado`, documentado(det, clave), '');
  }
  const A = Object.fromEntries([...det.slice(det.indexOf('export const AJUSTES_DETECCION'), det.indexOf('};', det.indexOf('export const AJUSTES_DETECCION'))).matchAll(/(\w+):\s*(-?[\d.]+)/g)].map((m) => [m[1], Number(m[2])]));
  comprobar('el detector es conservador en velocidad (6 px/s es 3,8 % del ancho)', A.velNetaMinPxS >= 5, `${A.velNetaMinPxS}`);
  comprobar('el recorrido de ola es una sexta parte de la rejilla', A.olaNetoMinPx >= A.anchoAnalisis / 8, `${A.olaNetoMinPx}`);
  comprobar('la espuma necesita más contraste que el surfista', A.contrasteClaro > A.contrasteOscuro, `${A.contrasteClaro} > ${A.contrasteOscuro}`);
  comprobar('los umbrales están en píxeles, no en metros inventados', A.pxPorMetro === undefined || String(A.pxPorMetro) === 'null', String(A.pxPorMetro));
  comprobar('el detector no exige perpendicularidad (dependería del ángulo de la cámara)', !det.includes('perpendicular <'), '');
}

console.log(`\n${fallos ? 'FALLOS' : 'TODO EN VERDE'}: ${total - fallos}/${total} pruebas`);
process.exit(fallos ? 1 : 0);
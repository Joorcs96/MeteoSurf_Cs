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

seccion('Elegir grabador: cuál se puede usar y por qué se dice que no');
{
  // `elegirGrabador` recibe las capacidades del navegador, así que se puede probar
  // el caso de Safari de iOS sin tener un iPhone delante.
  const elegir = new Function(`${extraer(leer('js/cams.js'), 'elegirGrabador').replace('export ', '')}; return elegirGrabador;`)();
  const webcodecs = { VideoEncoder: function () {}, VideoFrame: function () {}, MediaRecorder: function () {}, captureStreamVideo: true };
  const sinWebcodecs = { VideoEncoder: null, VideoFrame: null, MediaRecorder: function () {}, captureStreamVideo: true };
  const soloSafariIOS = { VideoEncoder: null, VideoFrame: null, MediaRecorder: null, captureStreamVideo: false };

  const conWc = elegir(webcodecs);
  comprobar('con WebCodecs se usa el grabador codificado', conWc.modo === 'codificado', conWc.modo);
  comprobar('el codificado no necesita captureStream', elegir({ ...webcodecs, captureStreamVideo: false }).modo === 'codificado');
  comprobar('sin WebCodecs pero con captura, se usa el continuo', elegir(sinWebcodecs).modo === 'continuo');
  comprobar('el continuo avisa de que el clip será la grabación completa', /grabación en curso/.test(elegir(sinWebcodecs).aviso || ''), elegir(sinWebcodecs).aviso);
  const ios = elegir(soloSafariIOS);
  comprobar('en Safari de iOS sin WebCodecs no se promete grabar', ios.modo === 'ninguno', ios.modo);
  comprobar('el motivo de iOS es explícito y menciona la versión', /iOS 16\.4/.test(ios.motivo), ios.motivo);
  comprobar('ningún modo sin soporte devuelve un motivo vacío', elegir({}).modo === 'ninguno' && elegir({}).motivo.length > 5);
}

seccion('Clip con un solo contenedor: no se pegan grabaciones enteras');
{
  // `armarClipWebm` recibe el muxador inyectado, así que se prueba con uno falso que
  // anota lo que se le hace. Lo que importa: un solo `new Muxer` (una cabecera),
  // los trozos desde la primera trampa y nada anterior.
  const fuente = extraer(leer('js/cams.js'), 'armarClipWebm').replace('export ', '');
  let muxers = 0;
  const añadidos = [];
  let finalizados = 0;
  class MuxerFalso {
    constructor(opts) { muxers++; this.opts = opts; this.target = opts.target; }
    addVideoChunk(c, meta) { añadidos.push(meta.timestamp); }
    finalize() { finalizados++; this.target.buffer = new ArrayBuffer(3); }
  }
  class ArrayBufferTargetFalso { constructor() { this.buffer = null; } }
  const armar = new Function(
    'EncodedVideoChunk',
    `${fuente}; return armarClipWebm;`
  )(class { constructor(i) { Object.assign(this, i); } });

  const trozo = (timestamp, key) => ({ key, data: new Uint8Array(8), timestamp, duracion: 83333 });
  const ventana = [trozo(250000, true), trozo(333333, false), trozo(416666, false)];
  const clip = armar(ventana, { Muxer: MuxerFalso, ArrayBufferTarget: ArrayBufferTargetFalso, codec: 'V_VP8', ancho: 640, alto: 360, fps: 12 });

  comprobar('se escribe una sola cabecera de contenedor', muxers === 1, `${muxers}`);
  comprobar('se finaliza una sola vez', finalizados === 1, `${finalizados}`);
  comprobar('el clip empieza en una trampa, no en un delta suelto', clip.desdeTrampa === true);
  comprobar('entran todos los trozos de la ventana', clip.trozos === 3, `${clip.trozos}`);
  comprobar('los trozos van en orden de tiempo', añadidos.join(',') === [250000, 333333, 416666].join(','), añadidos.join(','));
  comprobar('la duración sale de los trozos escritos', clip.duracionMs === 416666 - 250000 + 83333, `${clip.duracionMs}`);

  // Si la ventana llega con deltas huérfanos de antes de la última trampa (por
  // ejemplo porque se pasó un poco el reloj), esos deltas no pueden ir delante:
  // sin punto de inicio no se decodifican, y un contenedor WebM con trozos sueltos
  // al principio es justo lo que rompe la reproducción.
  añadidos.length = 0;
  const conCola = armar([trozo(166666, false), ...ventana], { Muxer: MuxerFalso, ArrayBufferTarget: ArrayBufferTargetFalso, codec: 'V_VP8', ancho: 640, alto: 360, fps: 12 });
  comprobar('los deltas anteriores a la trampa se descartan', conCola.trozos === 3 && añadidos.join(',') === [250000, 333333, 416666].join(','), añadidos.join(','));

  comprobar('sin ninguna trampa no se inventa un clip', armar([trozo(0, false)], { Muxer: MuxerFalso, ArrayBufferTarget: ArrayBufferTargetFalso, codec: 'V_VP8', ancho: 640, alto: 360, fps: 12 }) === null);
}

seccion('La grabación de verdad, no la de nameof');
{
  const fuente = leer('js/cams.js');
  const app = leer('js/app.js');
  // El defecto crítico era pegar grabaciones independientes: dos contenedores
  // WebM o dos fragmentos MP4 pegados no forman un clip válido.
  comprobar('no se concatenan blobs de grabaciones en cams.js', !/new Blob\(\s*\[\s*\.\.\./.test(fuente), 'se sigue concatenando');
  comprobar('no hay ninguna función ensamblarClip', !fuente.includes('ensamblarClip'), '');
  comprobar('el grabador codificado no usa captureStream', !/crearGrabadorCodificado[\s\S]{0,4000}captureStream/.test(fuente), '');
  comprobar('el grabador codificado usa WebCodecs', fuente.includes('VideoEncoder') && fuente.includes('new VideoFrame(video'));
  comprobar('el grabador codificado fuerza trampas para poder volver atrás', /keyFrame: indice % GOP === 0/.test(fuente), '');
  comprobar('el codificado vuelve a escribir en un muxador nuevo', fuente.includes('firstTimestampBehavior'), '');
  comprobar('el respaldo continuo nunca concatena, entrega una grabación entera', /contenedorUnico: true/.test(fuente), '');
  // El botón de grabar el directo (que sí necesita captureStream) y el de vigía
  // (que no) se ocultan por separado, para que en iOS siga habiendo uno.
  comprobar('el botón de vigía no depende de captureStream', app.includes("$('#vigia-ola').hidden = !enDirecto()"), '');
  comprobar('el botón de grabar el directo sí depende de captureStream', /record-clip'\)\.hidden = !enDirecto\(\)[\s\S]{0,120}captureStream/.test(app), '');
  comprobar('si la vigía no puede grabar, el motivo se enseña', app.includes('No se pudo grabar:'), '');
  comprobar('el vídeo HLS lleva crossOrigin para no ensuciar el lienzo', /crossOrigin: 'anonymous'/.test(fuente), '');
}

seccion('Los clips del archivo se traen como blob, no como descarga');
{
  const fuente = leer('js/cams.js');
  const app = leer('js/app.js');
  // GitHub manda los adjuntos de las releases como descarga y con
  // application/octet-stream: en iOS y Android eso no arranca un <video>.
  comprobar('los clips del histórico se traen con fetch', fuente.includes('reproducirClip') && /fetch\(clip\.url/.test(fuente), '');
  comprobar('se usa un Blob para que el móvil lo reconozca como vídeo', fuente.includes('URL.createObjectURL(b)'), '');
  comprobar('si el fetch falla, se avisa con el motivo', /Clip con problemas/.test(fuente), '');
  comprobar('si el fetch falla, queda el enlace de descarga en la ficha', app.includes('Descargar'), '');
}

seccion('Un spot sin cámara no ve clips de otros');
{
  // La fuga: si un spot no tenía clips, la búsqueda caía a los 100 primeros del
  // índice global y Vinaròs acababa enseñando clips de Orihuela.
  const h = { surf: { min: 0.4, mid: 0.46, max: 0.5 }, swells: [{ h: 0.9, t: 5, dir: 90 }], windSpeed: 8 };
  const sinCamara = { id: 'Vinaros', name: 'Vinaros' };
  const matches = app.findSimilarConditions(sinCamara, h);
  comprobar('un spot sin clips no recibe ninguno', matches.length === 0, `${matches.length}`);
  comprobar('ninguno es de otro spot', matches.every((m) => m.clip.spot === 'Vinaros'), '');
  const fuente = leer('js/app.js');
  comprobar('ya no hay caída al índice global', !/slice\(0, 100\)/.test(fuente), '');
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
  comprobar('la trampa se renueva más a menudo que el búfer', valores.gopS > 0 && valores.gopS <= valores.prebufferS / 2, `${valores.gopS} s`);
  comprobar('no dispara olas encadenadas', valores.cooldownS >= valores.prebufferS, `${valores.cooldownS} s`);
  comprobar('la grabación continua tiene tope de ventana', valores.ventanaMaxS >= valores.prebufferS + valores.postS, `${valores.ventanaMaxS} s`);
  for (const clave of ['prebufferS', 'postS', 'gopS', 'ventanaMaxS', 'cooldownS', 'ancho', 'fps', 'bitrate', 'bandaImagen', 'detectar']) {
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
  comprobar('el detector de píxeles NO se presenta como un modelo entrenado', !/COCO|coco-ssd|tensorflow|tflite|onnx|mediapipe/i.test(det), '');
  comprobar('el detector de píxeles se describe como heurística', /sin usar ninguna librería/.test(det) || /solo píxeles en escala de grises/.test(det), '');
}

seccion('El modelo de persona y tabla decide junto al movimiento, no solo');
{
  // `js/deteccion.js` es heurística de píxeles y lo sigue siendo; el modelo de
  // persona y tabla entra como contrapeso. Lo que hay que comprobar es que los dos
  // hacen falta y que un fallo del modelo no se toma por un "no hay surfista".
  const fuente = leer('js/cams.js');
  const ia = leer('js/detector-ia.js');
  comprobar('la vigía importa el detector de persona y tabla', /import \{ crearDetectorIA \} from '\.\/detector-ia\.js'/.test(fuente), '');
  comprobar('el modelo se pide al armar la vigía, no al abrir la página', /await vigia\.ia\.cargar\(\)/.test(fuente), '');
  comprobar('el modelo no se pide al importar el módulo (solo dentro de preparar)', !/await vigia\.ia\.cargar\(\)/.test(fuente.slice(0, fuente.indexOf('async function preparar'))), '');
  comprobar('si el modelo no carga, la vigía no se arma', /vigia\.ia\.cargar\(\)[\s\S]{0,400}?vigia\.motivo = `No se ha podido cargar/.test(fuente), '');
  comprobar('el motivo del fallo de carga es explícito', /Sin ese modelo no se puede decidir que sea un surfista/.test(fuente), '');
  comprobar('un fallo del modelo limpia la evidencia y no dispara', /r\.estado === 'error'\)[\s\S]{0,200}?vigia\._iaUltima = null/.test(fuente), '');
  comprobar('sin evidencia del modelo no hay disparo', /if \(cfg\.usarIA && !ia\) return;/.test(fuente), '');
  comprobar('la evidencia del modelo tiene que ser reciente', /Date\.now\(\) - e\.tMs > cfg\.iaValidezMs/.test(fuente), '');
  comprobar('los resultados obsoletos se descartan con esFresco', /esFresco\(r\)/.test(fuente), '');
  comprobar('las omisiones por inferencia en curso no son fallos', /r\.estado === 'omitido'[\s\S]{0,80}?return;/.test(fuente), '');
  comprobar('el modelo va a su propio ritmo, más despacio que los píxeles', /iaFrecuenciaHz: 1/.test(fuente) && /setInterval\(analizarIA/.test(fuente), '');
  comprobar('exige persona Y tabla con confianza suficiente', /d\.clase === 'person' && d\.confianza >= cfg\.iaConfianzaMin/.test(fuente) && /d\.clase === 'surfboard' && d\.confianza >= cfg\.iaConfianzaMin/.test(fuente), '');
  comprobar('el clip dice si el modelo confirmó persona y tabla', /El modelo reconoce persona/.test(fuente), '');
  comprobar('sin modelo el clip lo dice en vez de ocultarlo', /Sin confirmación del modelo/.test(leer('js/app.js')), '');
  comprobar('al parar se sueltan los pesos del modelo', /vigia\.ia\?\.liberar\(\)/.test(fuente), '');
  comprobar('el módulo del modelo declara que NO decide si coge una ola', /NO decide si alguien coge una ola/.test(ia) || /no decide si alguien coge una ola/i.test(ia), '');
  comprobar('el módulo del modelo no afirma precisión medida con surfistas', !/precisi[oó]n medida/i.test(ia.replace(/NO hay ninguna medida de PRECISION con surfistas reales del club[^.]*\./i, '')), '');
}
console.log(`\n${fallos ? 'FALLOS' : 'TODO EN VERDE'}: ${total - fallos}/${total} pruebas`);
process.exit(fallos ? 1 : 0);
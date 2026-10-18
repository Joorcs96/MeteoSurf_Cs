// tools/test_prebuffer_dimensiones.js — El prebuffer no puede inventarse la
// proporción del vídeo ni callarse un `getImageData` prohibido por CORS.
//
// Uso: node tools/test_prebuffer_dimensiones.js
//
// Como en el resto de la suite, las funciones se EXTRAEN del fuente real de
// js/cams.js y se evalúan; no se reescriben aquí (una réplica daría verde con el
// bug puesto). Solo se sustituye la importación del muxador por CDN, que en Node
// no existe, por un muxador falso que anota lo que se le pasa.

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

function extraer(fuente, nombre) {
  const patrones = [
    new RegExp(`\\bfunction\\s+${nombre}\\s*\\(`),
    new RegExp(`\\bexport\\s+function\\s+${nombre}\\s*\\(`),
  ];
  let i = -1;
  for (const re of patrones) {
    const m = fuente.match(re);
    if (m && (i === -1 || m.index < i)) i = m.index;
  }
  if (i === -1) throw new Error(`No se encontró ${nombre} en el fuente`);
  const esFuncion = /function\s/.test(fuente.slice(i, i + 24));
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

// ------------------------------------------------------------- dobles de APIs

function videoFalso({ ancho = 0, alto = 0, readyState = 0 } = {}) {
  const oyentes = new Map();
  return {
    videoWidth: ancho,
    videoHeight: alto,
    readyState,
    addEventListener(t, f) { if (!oyentes.has(t)) oyentes.set(t, []); oyentes.get(t).push(f); },
    removeEventListener(t, f) {
      const l = oyentes.get(t) || [];
      const i = l.indexOf(f);
      if (i >= 0) l.splice(i, 1);
    },
    emit(t) { for (const f of [...(oyentes.get(t) || [])]) f({ type: t }); },
    oyentes,
    dimensions(ancho2, alto2) { this.videoWidth = ancho2; this.videoHeight = alto2; this.readyState = 1; },
    requestVideoFrameCallback: null,
    captureStream: undefined,
  };
}

class VideoEncoderFalso {
  static configuring = [];
  static async isConfigSupported(cfg) { return { supported: cfg.height > 2 }; }
  constructor({ output, error }) { this.state = 'unconfigured'; this._o = output; this._e = error; }
  configure(c) {
    VideoEncoderFalso.configuring.push({ width: c.width, height: c.height });
    if (c.height <= 2) throw new Error('el codificador no acepta una altura de 2 píxeles');
    this.state = 'configured';
  }
  encode() {
    this._o({ type: 'key', timestamp: 0, byteLength: 8, copyTo: (d) => { d.fill(1); } });
  }
  close() { this.state = 'closed'; }
}
class VideoFrameFalso { constructor(video, opts) { Object.assign(this, opts, { video }); } close() {} }

function paqueteMuxer() {
  return {
    Muxer: class {
      constructor(opts) { this.opts = opts; }
      addVideoChunk() {}
      finalize() {}
    },
    ArrayBufferTarget: class { constructor() { this.buffer = null; } },
  };
}

// --------------------------------------------------------- funciones reales

const FUENTE = leer('js/cams.js');
const esperarSrc = extraer(FUENTE, 'esperarDimensiones').replace('export ', '');
const esperarDimensiones = new Function(
  'PLAZO_DIMENSIONES_MS',
  `${esperarSrc}; return esperarDimensiones;`
)(5000);

const grabadorSrc = extraer(FUENTE, 'crearGrabadorCodificado')
  .replace(/await import\(MUXADOR_CDN\)/g, 'await Promise.resolve(paqueteMuxer())');

function crearGrabador(video, cfg, deps = {}) {
  const armados = [];
  const armar = deps.armarClipWebm || ((ventana, o) => {
    armados.push({ alto: o.alto, ancho: o.ancho });
    return { blob: null, duracionMs: 1000, trozos: ventana.length, bytes: 1 };
  });
  const fab = new Function(
    'esperarDimensiones', 'PLAZO_DIMENSIONES_MS', 'MUXADOR_CDN', 'VIDEOCODEC_A_WEBM',
    'paqueteMuxer', 'VideoEncoder', 'VideoFrame', 'armarClipWebm',
    `${grabadorSrc}; return crearGrabadorCodificado;`
  )(esperarDimensiones, 5000, 'cdn-falso', { vp8: 'V_VP8' }, paqueteMuxer, VideoEncoderFalso, VideoFrameFalso, armar);
  return { grabador: fab(video, cfg), armados };
}

const CFG = {
  ancho: 640, fps: 12, gopS: 1, prebufferS: 6, postS: 0, bitrate: 800_000,
  usarIA: false, detectar: false, bandaImagen: [0, 1], cooldownS: 5, iaConfianzaMin: 0.3,
  iaValidezMs: 2000, iaFrecuenciaHz: 1,
};

// ------------------------------------------------------- esperar dimensiones

seccion('Esperar a que el vídeo diga cuánto mide');
{
  const ya = videoFalso({ ancho: 1280, alto: 720, readyState: 1 });
  comprobar('si ya tiene medidas, resuelve al instante', (await esperarDimensiones(ya)) === true);

  const tarde = videoFalso();
  const p = esperarDimensiones(tarde);
  setTimeout(() => { tarde.dimensions(640, 360); tarde.emit('loadedmetadata'); }, 30);
  comprobar('si las medidas llegan tarde, se esperan', (await p) === true);

  const Also = videoFalso();
  const p2 = esperarDimensiones(Also);
  setTimeout(() => { Also.dimensions(640, 360); Also.emit('resize'); }, 30);
  comprobar('un `resize` con medidas nuevas también vale', (await p2) === true);

  const nunca = videoFalso();
  comprobar('si no llegan nunca, se rinde (y rápido)', (await esperarDimensiones(nunca, 80)) === false);
  comprobar('rendirse limpia los oyentes del vídeo', nunca.oyentes.get('loadedmetadata').length === 0 && nunca.oyentes.get('resize').length === 0);
  comprobar('el plazo por defecto es corto (5 s)', /PLAZO_DIMENSIONES_MS = 5000/.test(FUENTE));
}

// ------------------------------------------- cancelar al cambiar de cámara

seccion('Cambiar de cámara o desarmar mientras espera');
{
  let cancelado = false;
  const v = videoFalso();
  const t0 = Date.now();
  const esperando = esperarDimensiones(v, 60_000, () => cancelado);
  setTimeout(() => { cancelado = true; }, 30);   // el usuario cambia de cámara aquí
  const r = await esperando;
  comprobar('cambiar de cámara corta la espera al momento', r === false);
  comprobar('...y no espera al plazo entero', Date.now() - t0 < 3000, `${Date.now() - t0} ms`);
  comprobar('...limpiando oyentes al cancelar', v.oyentes.get('loadedmetadata').length === 0 && v.oyentes.get('resize').length === 0);
  cancelado = true;

  const yaCancelado = videoFalso();
  comprobar('si ya se había parado, no espera ni un instante', (await esperarDimensiones(yaCancelado, 60_000, () => true)) === false);

  // Y en el grabador: parar() mientras `iniciar()` espera no puede dejar
  // codificando en el aire, ni armar un clip con la cámara que ya no se mira.
  VideoEncoderFalso.configuring = [];
  const v2 = videoFalso();
  const { grabador: g, armados: a } = crearGrabador(v2, CFG);
  const arranque = g.iniciar();
  await new Promise((r2) => setTimeout(r2, 40));
  g.parar();                       // el usuario cambia de cámara aquí
  v2.dimensions(1280, 720);         // ...y las medidas llegan tarde
  v2.emit('loadedmetadata');
  let motivo = '';
  await arranque.catch((e) => { motivo = e.message; });
  await new Promise((r2) => setTimeout(r2, 40));
  comprobar('parar() durante la espera no configura ningún codificador', VideoEncoderFalso.configuring.length === 0, JSON.stringify(VideoEncoderFalso.configuring));
  comprobar('no se arma ningún clip de la cámara abandonada', a.length === 0, `${a.length}`);
  comprobar('el motivo dice que se paró la vigía', /parado la vigía|cambiado de cámara/.test(motivo), motivo);
  comprobar('la espera de medidas queda vacía', g.estado().bucle === 0);
}

// ----------------------------------------------------- 0x0 sin clip de 640x2

seccion('Vídeo 0x0: no se arma un clip de 640x2');
{
  VideoEncoderFalso.configuring = [];
  const v = videoFalso();
  const { grabador, armados } = crearGrabador(v, CFG);
  let motivo = '';
  try {
    await grabador.iniciar();
  } catch (e) {
    motivo = e.message;
  }
  comprobar('sin dimensiones, arrancar falla', grabador.estado().bucle === 0, `${grabador.estado().bucle}`);
  comprobar('el motivo explica que el directo no tiene medidas', /medidas del vídeo/.test(motivo), motivo);
  comprobar('nunca se configura el codificador con 2 píxeles de alto', VideoEncoderFalso.configuring.every((c) => c.height > 2), JSON.stringify(VideoEncoderFalso.configuring));

  const clip = await grabador.disparar();
  comprobar('disparar NO devuelve clip, devuelve un error', !!clip.error && clip.alto === undefined, JSON.stringify(clip));
  comprobar('no se arma ningún clip', armados.length === 0, `${armados.length}`);
  grabador.parar();
}

seccion('Con medidas reales el alto sale de la proporción del vídeo');
{
  const v = videoFalso({ ancho: 1280, alto: 720, readyState: 1 });
  const { grabador, armados } = crearGrabador(v, CFG);
  await grabador.iniciar();
  comprobar('1280x720 con ancho 640 da un clip de 640x360', /"ancho":640,"alto":360/.test(JSON.stringify(grabador.estado())), JSON.stringify(grabador.estado()));
  grabador.parar();
  v.emit('loadedmetadata');
  const v2 = videoFalso();
  const { grabador: g2, armados: a2 } = crearGrabador(v2, CFG);
  const arranque = g2.iniciar();
  setTimeout(() => { v2.dimensions(640, 480); v2.emit('loadedmetadata'); }, 30);
  await arranque;
  comprobar('si las medidas llegan después de arrancar, el alto también sale bien', /"ancho":640,"alto":480/.test(JSON.stringify(g2.estado())), JSON.stringify(g2.estado()));
  g2.parar();
  a2.length = 0;
}

seccion('CORS: leer el lienzo no puede morir en silencio');
{
  const analizar = extraer(FUENTE, 'analizar');
  comprobar('`getImageData` va dentro de un try/catch', /try\s*\{[\s\S]*?getImageData[\s\S]*?\}\s*catch/.test(analizar), '');
  comprobar('un SecurityError rellena `vigia.motivo`', /catch[\s\S]{0,500}?vigia\.motivo = /.test(analizar), '');
  comprobar('el motivo nombra el problema de origen/CORS', /CORS/.test(analizar), '');
  comprobar('tras el fallo la vigía deja de estar disponible', /catch[\s\S]{0,900}?vigia\.disponible = false/.test(analizar), '');
  comprobar('el fallo se cuenta, no se esconde', /_analisisFallos/.test(analizar) && /analisisFallos: vigia\._analisisFallos/.test(FUENTE), '');
  comprobar('el fallo se detiene ahí: no se sigue analizando en silencio', /catch[\s\S]{0,900}?return;/.test(analizar), '');
}

seccion('Traer el clip histórico no deja blobs huérfanos');
{
  const rep = extraer(FUENTE, 'reproducirClip');
  comprobar('guarda la sesión al empezar', /const sesion = sessions\.get\(el\)/.test(rep), '');
  comprobar('si ya no es la misma cámara, no crea la URL de objeto', /sessions\.get\(el\) !== sesion\) return;/.test(rep), '');
  comprobar('si el fetch falla, cae a la URL directa y avisa', /video\.src = clip\.url/.test(rep) && /onError\?\./.test(rep), '');
  comprobar('la URL creada se libera al cambiar de cámara', /revokeObjectURL\(url\)/.test(rep), '');
  comprobar('el fetch va con `mode: cors` a propósito, no credenciales', /fetch\(clip\.url, \{ mode: 'cors' \}\)/.test(rep), '');
}

seccion('La PWA entrega los js nuevos a quien ya la tenía instalada');
{
  const sw = leer('sw.js');
  const version = sw.match(/const CACHE = 'meteosurf-cs-v(\d+)/)?.[1];
  comprobar('la caché lleva número de versión', !!version, sw.split('\n')[2] || '');
  comprobar('está por encima de la versión que ya hay publicada', Number(version) >= 18, `v${version}`);
  comprobar('los js que cambian están en la lista de la PWA', ['./js/cams.js', './js/app.js', './js/deteccion.js'].every((u) => sw.includes(u)), '');
  comprobar('al activar borra las cachés viejas', /k !== CACHE[\s\S]{0,60}caches\.delete\(k\)/.test(sw), '');
  comprobar('red primero: si hay red, el usuario ve la versión nueva', /fetch\(e\.request, \{ cache: 'no-cache' \}\)/.test(sw), '');
}

console.log(`\n${fallos ? 'FALLOS' : 'TODO EN VERDE'}: ${total - fallos}/${total} pruebas`);
process.exit(fallos ? 1 : 0);
// cams.js — Reproductor de webcams incrustadas: iframe, YouTube, HLS, MJPEG y JPG refrescado.
//
// Además, la vigía de ola: un búfer circular de vídeo que se rellena solo mientras
// se ve el directo y que, cuando el detector de js/deteccion.js ve a un surfista
// cogiendo una ola, entrega el trozo YA GRABADO desde unos segundos antes (el
// inicio de la ola) más unos segundos después. Sin ese búfer, grabar al pulsar el
// botón siempre se loses el principio.
import { AJUSTES_DETECCION, aGrisesReducidos, crearDetector } from './deteccion.js';
import { crearDetectorIA } from './detector-ia.js';

let catalog = null;
let hlsLib = null;
let hlsLoading = null;
const active = new Map(); // contenedor → limpieza
const recordings = new Map();
export const vigias = new Map(); // contenedor → vigía de ola
const sessions = new WeakMap();

// Emisiones resueltas en el servidor (data/streams.json). Las cámaras de
// IPCamLive no dan un .m3u8 en su embedUrl y su player.php no manda CORS, así que
// el navegador no puede descubrir el `streamid` por su cuenta: lo resuelve
// backend/actualizar_webcams.py --streams y lo publica ahí.
let streams = null;

export async function loadCams() {
  if (catalog) return catalog;
  try {
    const r = await fetch('webcams.json', { cache: 'no-cache' });
    const todas = (await r.json()).webcams;
    // Las que se resuelven en el servidor no tienen embedUrl fija: si se
    // filtraran por `embedUrl` desaparecerían del catálogo y no habría forma de
    // explicar por qué. Se meten siempre y luego se ven o no según el estado.
    // `soloGrabacion`: la usa solo el grabador de Rewinds; en la web se ve la otra
    // entrada de la misma cámara (el visor siempre disponible).
    catalog = todas.filter((c) => c.enabled !== false && !c.soloGrabacion && (c.embedUrl || c.resolver));
  } catch { catalog = []; }
  return catalog;
}

export async function loadStreams() {
  if (streams) return streams;
  try {
    // Se resuelve contra la URL del propio módulo y no contra la del documento: si
    // la página se sirve desde un subdirectorio (como en las páginas de proyecto de
    // GitHub) o desde otra ruta, un `fetch('data/...')` apuntaría a otro sitio.
    const r = await fetch(new URL('../data/streams.json', import.meta.url), { cache: 'no-cache' });
    const datos = await r.json();
    streams = datos.streams || {};
  } catch { streams = {}; }
  return streams;
}

// Estado de una emisión dinámica: si se puede reproducir y por qué no.
export function estadoStream(cam) {
  if (!cam || cam.resolver !== 'ipcamlive') return { ok: true };
  const s = streams?.[cam.id];
  if (!s) return { ok: false, motivo: 'La emisión de esta cámara todavía no se ha resuelto en el servidor.' };
  if (!s.ok || !s.hls) return { ok: false, motivo: s.motivo || 'La emisión de esta cámara no se pudo resolver.' };
  const ttl = (s.ttlMin || 45) * 60000;
  const edad = Date.now() - Date.parse(s.resolvedAt || 0);
  if (Number.isFinite(edad) && edad > ttl) {
    return { ok: false, motivo: `La dirección en directo se resolvió hace más de ${s.ttlMin || 45} min y puede haber caducado.` };
  }
  return { ok: true, hls: s.hls, snapshot: s.snapshot, resolvedAt: s.resolvedAt };
}

// URL real de reproducción de una cámara, sea fija o resuelta en el servidor.
export function urlStream(cam) {
  const est = estadoStream(cam);
  return est.ok && est.hls ? est.hls : cam?.embedUrl || '';
}

export function camsForSpot(spot) {
  const list = catalog || [];
  return list
    .filter((c) => (c.spots || []).includes(spot.id))
    .sort((a, b) => (a.priority ?? 9) - (b.priority ?? 9) || (a.distanceKm ?? 99) - (b.distanceKm ?? 99));
}

export function stopCam(el) {
  sessions.set(el, {});
  delete el.dataset.cameraType;
  recordings.get(el)?.();
  vigias.get(el)?.parar();
  vigias.delete(el);
  const clean = active.get(el);
  if (clean) { try { clean(); } catch { /* nada */ } active.delete(el); }
  el.innerHTML = '';
}

const isApple = () => /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ||
  (/Safari/.test(navigator.userAgent) && !/Chrome|Chromium|Android/.test(navigator.userAgent));

async function getHls() {
  if (hlsLib) return hlsLib;
  hlsLoading ??= new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/hls.js@1.5.13/dist/hls.min.js';
    s.onload = res;
    s.onerror = () => { s.remove(); rej(new Error('No se pudo cargar el reproductor.')); };
    document.head.appendChild(s);
  }).catch((error) => { hlsLoading = null; throw error; });
  await hlsLoading;
  hlsLib = window.Hls;
  return hlsLib;
}

function msg(el, title, text) {
  el.insertAdjacentHTML('beforeend', `<div class="cam-msg"><div><b>${title}</b>${text}</div></div>`);
}

// Pinta la cámara en el contenedor .cam
export async function playCam(el, cam, { autoplay = true } = {}) {
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  stopCam(el);
  const session = sessions.get(el);
  el.dataset.cameraType = cam?.embedType || '';
  if (!cam) { msg(el, 'Sin cámara en este spot', 'Todavía no hay una cámara pública que enfoque esta playa.'); return; }
  if (cam.embedType === 'link') {
    // Cámara que solo se ve en la web de su propietario (p. ej. acceso de socios)
    el.insertAdjacentHTML('beforeend', `<div class="cam-msg cam-link"><div><b>${esc(cam.name)}</b>${esc(cam.notesShort) || 'Se abre en su web.'}` +
      `<a class="cam-link-btn" href="${esc(cam.pageUrl)}" target="_blank" rel="noopener">Abrir cámara</a></div></div>`);
    return;
  }
  const overlay = `<div class="cam-overlay"><span class="live-badge">${cam.embedType === 'jpg' ? 'FOTO' : 'EN DIRECTO'}</span></div>`;
  el.insertAdjacentHTML('beforeend', overlay);
  const t = cam.embedType;

  if (t === 'iframe' || t === 'youtube') {
    let src = cam.embedUrl;
    if (t === 'youtube' && !/embed/.test(src)) {
      const id = src.match(/(?:v=|youtu\.be\/|live\/)([\w-]{11})/)?.[1];
      src = id ? `https://www.youtube-nocookie.com/embed/${id}` : src;
    }
    if (t === 'youtube') src += (src.includes('?') ? '&' : '?') + `autoplay=${autoplay ? 1 : 0}&mute=1&playsinline=1&rel=0`;
    const f = document.createElement('iframe');
    f.src = src;
    f.allow = 'autoplay; fullscreen; picture-in-picture; encrypted-media';
    f.allowFullscreen = true;
    f.referrerPolicy = 'strict-origin-when-cross-origin';
    f.loading = 'lazy';
    f.title = cam.name;
    el.appendChild(f);
    active.set(el, () => { f.src = 'about:blank'; });
    return;
  }

  if (t === 'hls') {
    const est = estadoStream(cam);
    if (!est.ok) {
      msg(el, 'Emisión no disponible', `${esc(est.motivo)} Se puede ver la cámara del club en el reproductor del club.`);
      return;
    }
    const fuente = urlStream(cam);
    const v = document.createElement('video');
    // Sin `crossOrigin` el vídeo marca el lienzo como "tainted" en cuanto se
    // mezcla con otra cosa, y `getImageData` lanza SecurityError: eso es lo que
    // rompe la vigía de ola en algunos navegadores. Todas las fuentes HLS usadas
    // aquí contestan con Access-Control-Allow-Origin, así que no se pierde nada.
    Object.assign(v, { muted: true, autoplay, playsInline: true, controls: true, crossOrigin: 'anonymous' });
    v.setAttribute('playsinline', '');
    el.appendChild(v);
    let hls = null;
    const fail = () => { if (sessions.get(el) !== session) return; stopCam(el); msg(el, 'Cámara sin señal', 'La emisión no responde ahora mismo. Prueba otra cámara o vuelve en un rato.'); };
    active.set(el, () => { hls?.destroy(); v.pause(); v.removeAttribute('src'); v.load(); });
    if (isApple() && v.canPlayType('application/vnd.apple.mpegurl')) {
      v.src = fuente;
      v.addEventListener('error', fail, { once: true });
    } else {
      try {
        const Hls = await getHls();
        if (sessions.get(el) !== session || !el.isConnected) return;
        if (!Hls.isSupported()) { v.src = fuente; }
        else {
          hls = new Hls({ lowLatencyMode: true, backBufferLength: 30 });
          hls.loadSource(fuente);
          hls.attachMedia(v);
          hls.on(Hls.Events.ERROR, (_, d) => { if (d.fatal) fail(); });
        }
      } catch { fail(); return; }
    }
    v.play?.().catch(() => { /* el usuario pulsa play */ });
    return;
  }

  if (t === 'mjpeg' || t === 'jpg') {
    const img = document.createElement('img');
    img.alt = cam.name;
    img.decoding = 'async';
    const base = cam.embedUrl;
    const bust = () => base + (base.includes('?') ? '&' : '?') + '_=' + Date.now();
    img.src = t === 'jpg' ? bust() : base;
    img.onerror = () => { if (sessions.get(el) !== session) return; stopCam(el); msg(el, 'Cámara sin señal', 'La imagen no se puede cargar ahora mismo.'); };
    el.appendChild(img);
    let timer = null;
    if (t === 'jpg') timer = setInterval(() => { const n = new Image(); n.onload = () => { if (sessions.get(el) === session) img.src = n.src; }; n.src = bust(); }, (cam.refreshSeconds || 30) * 1000);
    active.set(el, () => { clearInterval(timer); img.src = ''; });
  }
}

// Reutiliza el reproductor y libera la emisión anterior antes de cargar el archivo.
// Los clips nuevos se sirven desde la propia web (`rewinds/`), con tipo video/mp4.
// Los de las releases de GitHub (clips antiguos) llegan como descarga forzada
// y en el móvil pueden no arrancar: el aviso de error deja ver el motivo.
export function reproducirClip(el, clip, { onError } = {}) {
  const video = document.createElement('video');
  Object.assign(video, { controls: true, playsInline: true, autoplay: true });
  video.setAttribute('playsinline', '');
  el.appendChild(video);
  // Directo a la URL: el `fetch` + blob de antes lo cortaba la CSP (connect-src) y
  // las releases no mandan CORS, así que siempre acababa en un aviso falso.
  video.src = clip.url;
  active.set(el, () => {
    video.pause();
    video.removeAttribute('src');
    video.load();
  });
  return video;
}

export function playClip(el, clip) {
  stopCam(el);
  const session = sessions.get(el);
  el.dataset.cameraType = 'clip';
  const video = reproducirClip(el, clip, {
    onError: (m) => { if (sessions.get(el) === session) msg(el, 'Clip con problemas', esc(m)); },
  });
  const label = document.createElement('div');
  label.className = 'cam-overlay';
  const badge = document.createElement('span');
  badge.className = 'live-badge';
  badge.textContent = 'Rewind · ' + new Date(clip.hora).toLocaleString('es-ES', { timeZone: 'Europe/Madrid', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  label.appendChild(badge); el.appendChild(label);
  if (/^https:\/\//.test(clip.foto || '')) video.poster = clip.foto;
  video.addEventListener('error', () => { if (sessions.get(el) === session) msg(el, 'Clip no disponible', 'Puedes intentar descargarlo o volver al directo.'); }, { once: true });
video.play().catch(() => {});
return video;
}

// No cambia ni detiene el directo; sólo finaliza las pistas capturadas.
export function recordClip(el, segundos = 20, onTick = () => {}) {
  return new Promise((resolve, reject) => {
    const video = el.querySelector('video');
    if (el.dataset.cameraType !== 'hls' || !video?.captureStream || !window.MediaRecorder) {
      reject(new Error('Este navegador no permite grabar esta cámara.')); return;
    }
    if (video.readyState < 2 || video.paused) { reject(new Error('Espera a que el directo se esté reproduciendo.')); return; }
    if (recordings.has(el)) { reject(new Error('Ya hay una grabación en curso.')); return; }
    if (!Number.isFinite(segundos) || segundos <= 0) { reject(new Error('La duración del clip no es válida.')); return; }
    let stream, recorder, timer, deadline, cancelled = false, failure = null;
    const chunks = [];
    const cleanup = () => { clearInterval(timer); clearTimeout(deadline); stream?.getTracks().forEach((track) => track.stop()); recordings.delete(el); };
    try {
      stream = video.captureStream();
      if (!stream.getVideoTracks().length) throw new Error('La cámara todavía no ofrece vídeo para grabar.');
      const type = ['video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find((t) => MediaRecorder.isTypeSupported(t));
      if (!type) throw new Error('No hay un formato de grabación compatible.');
      recorder = new MediaRecorder(stream, { mimeType: type });
      recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      recorder.onerror = () => { failure = new Error('No se ha podido grabar el clip.'); if (recorder.state !== 'inactive') recorder.stop(); else { cleanup(); reject(failure); } };
      recorder.onstop = () => {
        cleanup();
        if (cancelled || failure) { reject(failure || new Error('Grabación cancelada al cambiar de cámara.')); return; }
        const blob = new Blob(chunks, { type: recorder.mimeType });
        if (!blob.size) { reject(new Error('La cámara no ha generado vídeo para guardar.')); return; }
        onTick(0); resolve({ blob, extension: recorder.mimeType.startsWith('video/mp4') ? 'mp4' : 'webm' });
      };
      recordings.set(el, () => { cancelled = true; if (recorder.state !== 'inactive') recorder.stop(); });
      const duration = Math.max(1, Math.min(60, segundos));
      const started = Date.now();
      recorder.start(1000); onTick(duration);
      timer = setInterval(() => onTick(Math.max(0, Math.ceil(duration - (Date.now() - started) / 1000))), 250);
      deadline = setTimeout(() => { if (recorder.state !== 'inactive') recorder.stop(); }, duration * 1000);
    } catch (error) { cleanup(); reject(new Error(error.message || 'No se ha podido iniciar la grabación.')); }
  });
}

// --------------------------------------------------------------------- vigía de ola
//
// Vigila el directo y graba SOLO cuando el detector ve a alguien cogiendo una
// ola. Lo importante aquí es cómo se arma el clip, porque concatenar
// grabaciones independientes con `new Blob([a, b])` produce un archivo roto: dos
// contenedores WebM (o dos fragmentos MP4) pegados no forman un clip válido, se
// pierde el principio y la duración sale mal. Ese era el defecto que había.
//
// Aquí hay dos grabadores y se elige el mejor disponible:
//
//   1. CODIFICADO (preferido). WebCodecs (`VideoEncoder`) más el muxador de WebM
//      de la CDN. Los fotogramas se codifican en trozos con una marca de "empieza
//      aquí" cada `gopS`, y se guardan en un búfer circular. Al disparar se toma
//      la marca más reciente que quepa dentro de `prebufferS` y se escriben SOLO
//      esos trozos, desde esa marca hasta el final, en un muxador NUEVO. Sale un
//      WebM con una sola cabecera: arranca, la duración es la correcta y contiene
//      los segundos previos a la detección, que es lo que incluye el principio de
//      la ola. No usa `captureStream`, así que también funciona en Safari de iOS
//      (16.4 o superior), donde no existe.
//
//   2. CONTINUO (respaldo). Un único `MediaRecorder` que no se para mientras se
//      vigila. Al disparar se entrega la grabación entera en curso, que empezó
//      como mucho `prebufferS` antes: es un archivo único y válido, sin
//      concatenación, y contiene el principio de la ola. Necesita
//      `video.captureStream()`, que Safari de iOS no tiene; si no está, se dice con
//      claridad en vez de fingir.
//
// Si no hay ninguno de los dos, `iniciarVigiaOla` devuelve `disponible: false` con
// el motivo y la interfaz lo enseña. Los clips se quedan en el dispositivo del
// usuario: no se sube nada a ningún sitio.


const MUXADOR_CDN = 'https://cdn.jsdelivr.net/npm/webm-muxer@5.0.3/build/webm-muxer.mjs';

// Codec de WebCodecs → identificador de WebM que espera el muxador.
const VIDEOCODEC_A_WEBM = {
  vp8: 'V_VP8',
  'vp09.00.10.08': 'V_VP9',
};

export const AJUSTES_VIGIA = {
  prebufferS: 12, // segundos de histórico que se conservan grabados
  postS: 8, // segundos que se siguen grabando tras el disparo
  gopS: 2, // cada cuánto se fuerza una trampa (punto de inicio recuperable)
  ventanaMaxS: 45, // tope del grabador continuo antes de reiniciar
  cooldownS: 20, // margen para no disparar dos olas seguidas
  // Tamaño del clip codificado. 640x360 de sobra para ver una ola y no carga el
  // móvil; con el doble se ve mejor el detalle de la tabla.
  ancho: 640,
  fps: 12, // fotogramas por segundo que se codifican y se analizan
  bitrate: 1_400_000, // bits por segundo del clip codificado
  // Banda vertical de la imagen donde se busca surfista, en fracción del alto del
  // vídeo. Al recortar aquí el surfista ocupa más píxeles de la rejilla de análisis,
  // que es lo que hace falta a esta distancia. El resto (cielo y arena) no se mira.
  bandaImagen: [0.34, 0.94],
  detectar: true, // analizar la imagen mientras se ve el directo

  // Modelo de persona y tabla. El detector de píxeles decide si alguien COGE una
  // ola (persona + tabla + movimiento + recorrido, con sus rechazos probados);
  // coco-ssd solo responde a si hay persona y hay tabla, y sirve de contrapeso:
  // una silueta con forma de surfista no se da por buena sin que el modelo la
  // reconozca, ni al revés. Si el modelo no está o falla, NO se dispara: un fallo
  // de carga no puede contar como que no hay surfista.
  usarIA: true,
  iaFrecuenciaHz: 1, // la inferencia real tarda ~1,3 s: más rápido sería «omitido»
  // Qué tan cerca en el tiempo tiene que estar la evidencia del modelo para
  // contar. Si el modelo vio a alguien hace más de esto, ya no sirve para este
  // disparo: habría que estar combining una foto vieja con un rastro nuevo.
  iaValidezMs: 4000,
  // Confianza mínima del modelo para dar su visto bueno.
  iaConfianzaMin: 0.35,
};

// Qué grabador puede usar este navegador. Se exporta para poder probarlo sin
// navegador: se le pasan las capacidades y devuelve el motivo si no hay ninguna.
export function elegirGrabador(caps = {}) {
  const webcodecs = Boolean(caps.VideoEncoder && caps.VideoFrame);
  const capture = Boolean(caps.captureStreamVideo);
  const recorder = Boolean(caps.MediaRecorder);
  if (webcodecs) {
    return { modo: 'codificado', codec: '', webm: '', motivo: '', aviso: '' };
  }
  if (capture && recorder) {
    return {
      modo: 'continuo', codec: '', webm: '', motivo: '',
      aviso: 'Este navegador no tiene WebCodecs, así que el clip será la grabación en curso completa.',
    };
  }
  if (!webcodecs && capture && !recorder) {
    return { modo: 'ninguno', motivo: 'Este navegador no puede grabar el directo: no tiene WebCodecs ni MediaRecorder.' };
  }
  return {
    modo: 'ninguno',
    motivo: 'Este navegador no puede grabar el directo: ni tiene WebCodecs ni puede capturar el vídeo del elemento. En Safari de iOS hace falta iOS 16.4 o superior.',
  };
}

// ---------------------------------------------------------------- clip codificado

// Escribe en un muxador NUEVO solo los trozos indicados. Lo que hay que
// comprobar es que se escribe UNA cabecera y nada más: ningún trozo anterior a la
// trampa se cuela, y no se pega ninguna grabación entera dentro de otra.
// Se exporta con el muxador inyectado para poder probarlo con uno falso.
export function armarClipWebm(trozos, opciones) {
  const { Muxer, ArrayBufferTarget, codec, ancho, alto, fps } = opciones;
  // Se descartan los trozos sueltos que hubiera antes de la primera trampa: sin
  // punto de inicio no se pueden decodificar.
  const primero = trozos.findIndex((t) => t.key);
  if (primero < 0) return null;
  const utiles = trozos.slice(primero).sort((a, b) => a.timestamp - b.timestamp);

  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: { codec, width: ancho, height: alto, frameRate: fps },
    firstTimestampBehavior: 'offset',
  });
  for (const t of utiles) {
    muxer.addVideoChunk(
      new EncodedVideoChunk({ type: t.key ? 'key' : 'delta', timestamp: t.timestamp, data: t.data }),
      { timestamp: t.timestamp, duration: t.duracion },
    );
  }
  muxer.finalize();
  const bytes = new Uint8Array(target.buffer);
  const ultimo = utiles[utiles.length - 1];
  return {
    blob: new Blob([bytes], { type: 'video/webm' }),
    bytes: bytes.byteLength,
    trozos: utiles.length,
    duracionMs: ultimo.timestamp - utiles[0].timestamp + (ultimo.duracion || 0),
    desdeTrampa: utiles[0].key === true,
  };
}

// ------------------------------------------------------------------ grabadores

// El alto del clip sale de la proporción real del vídeo. Si se calcula antes de
// tiempo, con `videoWidth === 0` sale `Math.max(2, 0)` = 2 y el grabador se
// queda grabando en un búfer de 640x2 píxeles. Se espera a que el vídeo diga
// cuánto mide (o a que se dé por perdido, con un plazo corto).
export const PLAZO_DIMENSIONES_MS = 5000;

export function esperarDimensiones(video, plazoMs = PLAZO_DIMENSIONES_MS, cancelado = () => false) {
  const listo = () => video.videoWidth > 0 && video.videoHeight > 0;
  if (listo()) return Promise.resolve(true);
  return new Promise((resolver) => {
    let fin = null;
    let reloj = null;
    const limpiar = () => {
      clearTimeout(fin);
      clearInterval(reloj);
      video.removeEventListener('loadedmetadata', alBazar);
      video.removeEventListener('resize', alBazar);
    };
    // Un solo camino de salida: se resuelve una vez y se limpian los oyentes.
    const salir = (valor) => { limpiar(); resolver(valor); };
    const alBazar = () => { if (listo()) salir(true); };
    video.addEventListener('loadedmetadata', alBazar);
    video.addEventListener('resize', alBazar);
    // Si se cambia de cámara o se desarma la vigía mientras se espera, no se
    // espera ni al plazo entero: se rinde en el momento. Sin esto, al llegar las
    // medidas tarde `preparar()` seguía adelante con una cámara que ya no existe.
    if (cancelado()) salir(false);
    reloj = setInterval(() => { if (cancelado()) salir(false); }, 150);
    fin = setTimeout(() => salir(false), plazoMs);
  });
}

function crearGrabadorCodificado(video, cfg) {
  const W = cfg.ancho;
  // Se rellena al preparar, no antes: sin dimensiones reales no se sabe el alto
  // (0 = todavía sin saber, no "2 píxeles").
  let H = 0;
  const GOP = Math.max(1, Math.round(cfg.fps * cfg.gopS));
  const bucle = [];
  let Muxer = null;
  let ArrayBufferTarget = null;
  let encoder = null;
  let reloj = null;
  let capturando = false;
  let indice = 0;
  let error = null;
  let codigo = '';
  let codigoWebm = '';
  let parado = false;

  async function preparar() {
    if (typeof VideoEncoder === 'undefined' || typeof VideoFrame === 'undefined') {
      throw new Error('Este navegador no tiene WebCodecs.');
    }
    // Y luego las dimensiones. Con 0x0 el alto saldría 2 píxeles y el clip sería
    // una franja ilegible; mejor no armar nada y decir por qué. Se rinde antes
    // si `parar()` se ha llamado mientras esperaba (cambio de cámara o desarme).
    const alParar = 'Se ha parado la vigía (cambio de cámara o desarme) mientras se esperaba la imagen del directo, así que no se arma la grabación.';
    if (!await esperarDimensiones(video, undefined, () => parado)) {
      throw new Error(parado ? alParar
        : 'El directo no ha dado las medidas del vídeo a tiempo, así que no se puede grabar el clip con la proporción correcta.');
    }
    if (parado) throw new Error(alParar);
    H = Math.max(2, Math.round(((W * video.videoHeight) / Math.max(1, video.videoWidth)) / 2) * 2);
    const mod = await import(MUXADOR_CDN);
    Muxer = mod.Muxer;
    ArrayBufferTarget = mod.ArrayBufferTarget;
    let soporte = null;
    for (const c of ['vp8', 'vp09.00.10.08']) {
      try {
        const s = await VideoEncoder.isConfigSupported({ codec: c, width: W, height: H, bitrate: cfg.bitrate, framerate: cfg.fps });
        if (s.supported) { soporte = c; break; }
      } catch { /* se prueba el siguiente */ }
    }
    if (!soporte) throw new Error('Este navegador no tiene ningún códec de WebM disponible.');
    codigo = soporte;
    codigoWebm = VIDEOCODEC_A_WEBM[soporte];
    encoder = new VideoEncoder({
      output: (chunk) => {
        const data = new Uint8Array(chunk.byteLength);
        chunk.copyTo(data);
        bucle.push({
          key: chunk.type === 'key',
          data,
          timestamp: chunk.timestamp,
          duracion: Math.round(1e6 / cfg.fps),
        });
      },
      error: (e) => { error = e.message || 'fallo del codificador'; },
    });
    encoder.configure({ codec: codigo, width: W, height: H, bitrate: cfg.bitrate, framerate: cfg.fps, latencyMode: 'realtime' });
  }

  function paso() {
    if (!capturando || !encoder || encoder.state !== 'configured') return;
    if (video.readyState < 2 || !video.videoWidth) return;
    let frame;
    try {
      frame = new VideoFrame(video, { timestamp: Math.round(performance.now() * 1000) });
    } catch { return; }
    try {
      encoder.encode(frame, { keyFrame: indice % GOP === 0 });
    } catch (e) {
      error = e.message || 'no se pudo codificar el fotograma';
    }
    frame.close();
    indice++;
  }

  function podar() {
    // Se conserva una puerta de seguridad por si el búfer se llenara de más.
    const tope = (cfg.prebufferS / cfg.gopS + 2) * GOP * 2;
    if (bucle.length > tope) bucle.splice(0, bucle.length - Math.floor(tope / 2));
  }

  async function disparar() {
    // Cinturón de seguridad: si el vídeo no tiene medidas, el alto es un invento
    // y el clip sería una franja de 2 píxeles. No se arma.
    if (H <= 2 || !video.videoWidth || !video.videoHeight) {
      return { error: 'El directo no tiene medidas, así que el clip saldría con una proporción inventada.' };
    }
    // OJO con las unidades: WebCodecs da los trozos en MICROsegundos y
    // performance.now() va en milisegundos. Compararlos tal cual salía un búfer
    // previo negativo de miles de horas.
    const ahoraUs = performance.now() * 1000;
    const limite = ahoraUs - cfg.prebufferS * 1e6;
    // Trampa = la marca de inicio MÁS ANTIGUA que todavía cabe dentro de
    // `prebufferS`, que es la que más histórico mete en el clip. Si no hay
    // ninguna así (grabación recién empezada), se usa la más antigua que exista.
    const enVentana = bucle.filter((t) => t.key && t.timestamp >= limite).sort((a, b) => a.timestamp - b.timestamp);
    const todas = bucle.filter((t) => t.key).sort((a, b) => a.timestamp - b.timestamp);
    const trampa = enVentana[0] || todas[0] || null;
    if (!trampa) return { error: 'Todavía no hay ningún fotograma grabado que pueda servir de inicio.' };
    const segundosPrevio = Math.max(0, Math.round((ahoraUs - trampa.timestamp) / 1e6));

    const espera = performance.now() + cfg.postS * 1000;
    const ventana = [];
    await new Promise((resolver) => {
      const latido = setInterval(() => {
        for (const t of bucle) {
          if (t.timestamp >= trampa.timestamp && !ventana.includes(t)) ventana.push(t);
        }
        if (performance.now() >= espera) {
          clearInterval(latido);
          resolver();
        }
      }, 120);
    });
    for (const t of bucle) {
      if (t.timestamp >= trampa.timestamp && !ventana.includes(t)) ventana.push(t);
    }
    podar();
    const clip = armarClipWebm(ventana, { Muxer, ArrayBufferTarget, codec: codigoWebm, ancho: W, alto: H, fps: cfg.fps });
    if (!clip) return { error: 'Los trozos grabados no tenían ningún punto de inicio utilizable.' };
    return {
      ...clip,
      segundos: Math.round(clip.duracionMs / 1000),
      segundosPrevio,
      codec: codigo,
      contenedorUnico: true,
      ancho: W,
      alto: H,
      extension: 'webm',
    };
  }

  return {
    modo: 'codificado',
    async iniciar() {
      parado = false;
      await preparar();
      // `parar()` pudo llamarse mientras se esperaba la imagen (al cambiar de
      // cámara). Si se sigue aquí, el grabador se pondría a codificar en el
      // aire y no pararía nunca.
      if (parado) return;
      capturando = true;
      if (video.requestVideoFrameCallback) {
        const ciclo = () => {
          paso();
          podar();
          if (capturando) video.requestVideoFrameCallback(ciclo);
        };
        video.requestVideoFrameCallback(ciclo);
      } else {
        reloj = setInterval(() => { paso(); podar(); }, 1000 / cfg.fps);
      }
    },
    disparar,
    parar() {
      parado = true;
      capturando = false;
      if (reloj) clearInterval(reloj);
      try { encoder?.close(); } catch { /* nada */ }
    },
    estado: () => ({
      modo: 'codificado',
      codec: codigo,
      ancho: W,
      alto: H > 2 ? H : null,
      bucle: bucle.length,
      // Cuánto histórico hay guardado ahora mismo, que es lo que le importa a quien
      // vigila: la diferencia entre el trozo más viejo y el más nuevo.
      segundos: bucle.length > 1 ? Math.max(0, Math.round((bucle[bucle.length - 1].timestamp - bucle[0].timestamp) / 1e6)) : 0,
      error,
    }),
  };
}

function crearGrabadorContinuo(video, cfg) {
  const mime = ['video/webm;codecs=vp8', 'video/webm;codecs=vp9', 'video/webm', 'video/mp4']
    .find((t) => window.MediaRecorder?.isTypeSupported(t));
  if (!mime) return null;
  let stream = null;
  let rec = null;
  let trozos = [];
  let t0 = 0;
  let reloj = null;
  let error = null;

  function arrancar() {
    rec = new MediaRecorder(stream, { mimeType: mime });
    trozos = [];
    t0 = Date.now();
    rec.ondataavailable = (e) => { if (e.data.size) trozos.push(e.data); };
    rec.start(500);
  }

  return {
    modo: 'continuo',
    async iniciar() {
      stream = video.captureStream();
      if (!stream.getVideoTracks().length) throw new Error('La cámara todavía no ofrece vídeo.');
      arrancar();
      // Un único grabador mientras quepa en la ventana; al llegar al tope se
      // reinicia para que el siguiente clip empiece en una cabecera nueva.
      reloj = setInterval(() => {
        if (error) return;
        if (Date.now() - t0 > cfg.ventanaMaxS * 1000) {
          try { rec.stop(); } catch { /* nada */ }
          setTimeout(() => { if (stream) arrancar(); }, 300);
        }
      }, 1000);
    },
    async disparar() {
      if (!rec || rec.state !== 'recording') return { error: 'No había grabación en curso.' };
      const segundos = Math.round((Date.now() - t0) / 1000);
      // Un MediaRecorder en curso no se puede copiar: se entrega lo grabado y se
      // espera a que termine, para no recortar nada.
      const cierre = new Promise((r) => {
        const previo = rec.onstop;
        rec.onstop = () => { previo?.(); r(); };
      });
      try { rec.stop(); } catch { /* nada */ }
      await cierre;
      const blob = new Blob(trozos, { type: mime });
      if (stream) arrancar();
      if (!blob.size) return { error: 'La grabación en curso salió vacía.' };
      return {
        blob,
        bytes: blob.size,
        extension: mime.startsWith('video/mp4') ? 'mp4' : 'webm',
        segundos,
        segundosPrevio: Math.min(cfg.prebufferS, segundos),
        contenedorUnico: true,
      };
    },
    parar() {
      clearInterval(reloj);
      if (rec && rec.state !== 'inactive') { try { rec.stop(); } catch { /* nada */ } }
      stream?.getTracks().forEach((t) => t.stop());
    },
    estado: () => ({
      modo: 'continuo',
      mime,
      bucle: trozos.length,
      segundos: t0 ? Math.round((Date.now() - t0) / 1000) : 0,
      error,
    }),
  };
}

// ---------------------------------------------------------------------- vigía

// Vigila el directo. Devuelve un objeto con `preparar()`, `estado()` y `parar()`.
// Si este navegador no puede grabar, `preparar()` deja `disponible` en false y
// `motivo` explica por qué, para que la interfaz lo diga en vez de fallar en
// silencio.
export function iniciarVigiaOla(el, cam, opciones = {}) {
  const cfg = { ...AJUSTES_VIGIA, ...opciones };
  const detector = crearDetector({ ...AJUSTES_DETECCION, ...(opciones.ajustes || {}), roiAgua: [0, 1] });
  const video = el.querySelector('video');
  const vigia = {
    cfg, detector, disponible: false, motivo: '', aviso: '', parado: false,
    modo: 'ninguno', ultimo: null, eventos: [], grabador: null,
    _ultimoDisparo: 0, _iaUltima: null, _iaReloj: null, ia: null, _iaLlamadas: 0, _iaSinVideo: 0, _analisisFallos: 0,
  };

  if (!video || el.dataset.cameraType !== 'hls') {
    vigia.motivo = 'La vigía necesita una cámara en directo grabable.';
    return vigia;
  }

  const eleccion = elegirGrabador({
    VideoEncoder: typeof VideoEncoder === 'undefined' ? null : VideoEncoder,
    VideoFrame: typeof VideoFrame === 'undefined' ? null : VideoFrame,
    MediaRecorder: typeof window.MediaRecorder === 'undefined' ? null : window.MediaRecorder,
    captureStreamVideo: typeof video.captureStream === 'function',
  });
  vigia.modo = eleccion.modo;
  vigia.motivo = eleccion.motivo;
  vigia.aviso = eleccion.aviso || '';
  if (eleccion.modo === 'ninguno') return vigia;

  const lienzo = document.createElement('canvas');
  lienzo.width = detector.ajustes.anchoAnalisis;
  lienzo.height = detector.ajustes.altoAnalisis;
  const ctx = lienzo.getContext('2d', { willReadFrequently: true });
  let relojAnalisis = null;
  let _iaReloj = null;

  async function preparar() {
    try {
      vigia.grabador = eleccion.modo === 'codificado'
        ? crearGrabadorCodificado(video, cfg)
        : crearGrabadorContinuo(video, cfg);
      if (!vigia.grabador) {
        vigia.motivo = 'No hay un formato de grabación compatible en este navegador.';
        return false;
      }
      await vigia.grabador.iniciar();
      // Si mientras se esperaba la imagen se cambió de cámara o se desarmó, el
      // grabador ya está parado: no se reactiva ni se pone a analizar el directo
      // nuevo como si fuera el que se pidió mirar.
      if (vigia.parado) { vigia.grabador.parar(); vigia.grabador = null; return false; }
      if (cfg.usarIA) {
        // El modelo se pide solo al armar la vigía, nunca al abrir la página: son
        // unos 18 MB y no tiene sentido bajarlos si nadie está mirando.
        vigia.ia = crearDetectorIA();
        const carga = await vigia.ia.cargar();
        if (vigia.parado) { try { vigia.ia.liberar(); } catch { /* nada */ } vigia.ia = null; return false; }
        if (!carga.ok) {
          vigia.motivo = `No se ha podido cargar el detector de persona y tabla (${carga.error?.codigo || 'sin codigo'}): ${carga.error?.mensaje || 'motivo desconocido'}. Sin ese modelo no se puede decidir que sea un surfista, así que la vigía se queda apagada.`;
          vigia.grabador.parar();
          vigia.grabador = null;
          return false;
        }
        _iaReloj = setInterval(analizarIA, Math.max(250, Math.round(1000 / cfg.iaFrecuenciaHz)));
      }
      vigia.disponible = true;
      if (cfg.detectar) {
        relojAnalisis = setInterval(analizar, Math.max(60, Math.round(1000 / cfg.fps)));
      }
      return true;
    } catch (e) {
      if (vigia.parado) return false;
      vigia.motivo = e.message || 'No se pudo preparar la grabación.';
      return false;
    }
  }

  // El modelo va a su ritmo (~1 Hz) porque una inferencia real tarda más de un
  // segundo. Mientras está en vuelo devuelve «omitido» y eso es normal, no un fallo.
  async function analizarIA() {
    vigia._iaLlamadas++;
    if (vigia.parado || !vigia.ia) return;
    if (video.readyState < 2 || !video.videoWidth) { vigia._iaSinVideo = (vigia._iaSinVideo || 0) + 1; return; }
    let r;
    try {
      r = await vigia.ia.detectar({ video, banda: cfg.bandaImagen, tMs: Date.now() });
    } catch { return; }
    if (!r || r.estado === 'omitido' || r.estado === 'obsoleto') return;
    // Si al terminar ya se pidió otro fotograma, el resultado es viejo: no se usa.
    if (vigia.ia.esFresco && !vigia.ia.esFresco(r)) return;
    if (r.estado === 'error') {
      vigia._iaUltima = null;
      vigia.motivoIA = `El detector de persona y tabla falló (${r.error?.codigo || 'sin codigo'}).`;
      return;
    }
    vigia.motivoIA = '';
    // Solo cuenta si el modelo vio persona Y tabla, con confianza suficiente.
    const persona = (r.detecciones || []).find((d) => d.clase === 'person' && d.confianza >= cfg.iaConfianzaMin);
    const tabla = (r.detecciones || []).find((d) => d.clase === 'surfboard' && d.confianza >= cfg.iaConfianzaMin);
    vigia._iaUltima = persona && tabla
      ? { tMs: r.tMs, persona, tabla, pares: r.pares || [], ms: r.ms, modelo: r.modelo }
      : null;
  }

  // ¿Hay evidencia del modelo utilizable AHORA MISMO? Fresca, con persona y tabla.
  function evidenciaIA() {
    const e = vigia._iaUltima;
    if (!e) return null;
    if (Date.now() - e.tMs > cfg.iaValidezMs) return null;
    return e;
  }

  function analizar() {
    if (vigia.parado || !vigia.disponible) return;
    if (video.readyState < 2 || !video.videoWidth) return;
    const vh = video.videoHeight, vw = video.videoWidth;
    const sy = Math.floor(cfg.bandaImagen[0] * vh);
    const sh = Math.max(8, Math.floor((cfg.bandaImagen[1] - cfg.bandaImagen[0]) * vh));
    // Un directo que no manda cabeceras CORS tiene el lienzo "tainted" y
    // `getImageData` lanza SecurityError. Si eso ocurre NO se muere en silencio
    // ni se finge que no hay surfista: se dice en el motivo y se deja de leer.
    let datos;
    try {
      ctx.drawImage(video, 0, sy, vw, sh, 0, 0, lienzo.width, lienzo.height);
      datos = ctx.getImageData(0, 0, lienzo.width, lienzo.height).data;
    } catch (e) {
      vigia._analisisFallos = (vigia._analisisFallos || 0) + 1;
      vigia.motivo = `El directo no deja leer sus fotogramas (${e?.name || 'error de CORS'}): la cámara no manda cabeceras de origen, así que no se puede detectar ni grabar la ola.`;
      clearInterval(relojAnalisis);
      relojAnalisis = null;
      vigia.disponible = false;
      vigia.grabador?.parar();
      vigia.grabador = null;
      return;
    }
    const grises = aGrisesReducidos(datos, lienzo.width, lienzo.height, detector.ajustes.anchoAnalisis, detector.ajustes.altoAnalisis);
    const salida = detector.push(grises, Date.now());
    if (!salida?.deteccion) return;
    if (Date.now() - vigia._ultimoDisparo < cfg.cooldownS * 1000) return;
    // El píxel dice que alguien coge una ola; el modelo tiene que estar de acuerdo
    // con persona y tabla, y ser reciente. Con el modelo caído no se dispara.
    const ia = cfg.usarIA ? evidenciaIA() : { sinModelo: true };
    if (cfg.usarIA && !ia) return;
    vigia._ultimoDisparo = Date.now();
    lanzar({
      ...salida.deteccion,
      evidenciaIA: ia && !ia.sinModelo ? {
        tMs: ia.tMs,
        persona: { confianza: ia.persona.confianza, centro: ia.persona.centro },
        tabla: { confianza: ia.tabla.confianza, centro: ia.tabla.centro },
        ms: ia.ms,
        modelo: ia.modelo?.id || 'coco-ssd',
      } : null,
      motivo: salida.deteccion.motivos.join(' ') + (ia && !ia.sinModelo
        ? ` El modelo reconoce persona (${Math.round(ia.persona.confianza * 100)} %) y tabla (${Math.round(ia.tabla.confianza * 100)} %).`
        : ''),
    });
  }

  async function lanzar(deteccion) {
    let clip = null;
    try {
      clip = await vigia.grabador.disparar();
    } catch (e) {
      opciones.onError?.(e.message || 'No se pudo grabar el clip.');
      return;
    }
    if (!clip || clip.error) {
      opciones.onError?.(clip?.error || 'No se pudo grabar el clip.');
      return;
    }
    const entrega = { ...clip, deteccion, tMs: deteccion.tMs };
    vigia.ultimo = entrega;
    vigia.eventos.push(entrega);
    opciones.onOla?.(entrega);
  }

  vigia.preparar = preparar;
  vigia.analizar = analizar;
  vigia.parar = () => {
    if (vigia.parado) return;
    vigia.parado = true;
    clearInterval(relojAnalisis);
    clearInterval(_iaReloj);
    // El modelo son unos 18 MB de pesos y memoria de GPU: se sueltan al parar.
    try { vigia.ia?.liberar(); } catch { /* nada */ }
    vigia._iaUltima = null;
    vigia.grabador?.parar();
  };
  vigia.estado = () => ({
    ...(vigia.grabador?.estado?.() || { modo: vigia.modo }),
    disponible: vigia.disponible,
    motivo: vigia.motivo,
    motivoIA: vigia.motivoIA || '',
    eventos: vigia.eventos.length,
    detector: detector.estado(),
    ia: vigia.ia?.estado?.() || null,
    iaLlamadas: vigia._iaLlamadas,
    iaSinVideo: vigia._iaSinVideo,
    analisisFallos: vigia._analisisFallos,
    evidenciaIA: evidenciaIA() ? { tMs: evidenciaIA().tMs, persona: Math.round(evidenciaIA().persona.confianza * 100), tabla: Math.round(evidenciaIA().tabla.confianza * 100) } : null,
  });
  return vigia;
}
// Miniatura estática para tarjetas (solo tipos que tienen imagen)
export function camThumb(cam) {
  if (!cam) return null;
  if (cam.thumbUrl) return cam.thumbUrl;
  if (cam.embedType === 'jpg') return cam.embedUrl;
  const id = cam.embedType === 'youtube' && cam.embedUrl.match(/(?:v=|youtu\.be\/|embed\/|live\/)([\w-]{11})/)?.[1];
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault_live.jpg` : null;
}
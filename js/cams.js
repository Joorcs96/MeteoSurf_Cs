// cams.js — Reproductor de webcams incrustadas: iframe, YouTube, HLS, MJPEG y JPG refrescado.
//
// Además, la vigía de ola: un búfer circular de vídeo que se rellena solo mientras
// se ve el directo y que, cuando el detector de js/deteccion.js ve a un surfista
// cogiendo una ola, entrega el trozo YA GRABADO desde unos segundos antes (el
// inicio de la ola) más unos segundos después. Sin ese búfer, grabar al pulsar el
// botón siempre se loses el principio.
import { AJUSTES_DETECCION, aGrisesReducidos, crearDetector } from './deteccion.js';

let catalog = null;
let hlsLib = null;
let hlsLoading = null;
const active = new Map(); // contenedor → limpieza
const recordings = new Map();
const vigias = new Map(); // contenedor → vigía de ola
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
    catalog = todas.filter((c) => c.enabled !== false && (c.embedUrl || c.resolver));
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
    Object.assign(v, { muted: true, autoplay, playsInline: true, controls: true });
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
export function playClip(el, clip) {
  stopCam(el);
  const session = sessions.get(el);
  el.dataset.cameraType = 'clip';
  const video = document.createElement('video');
  Object.assign(video, { controls: true, playsInline: true, autoplay: true, src: clip.url });
  video.setAttribute('playsinline', '');
  el.appendChild(video);
  const label = document.createElement('div');
  label.className = 'cam-overlay';
  const badge = document.createElement('span');
  badge.className = 'live-badge';
  badge.textContent = 'Rewind · ' + new Date(clip.hora).toLocaleString('es-ES', { timeZone: 'Europe/Madrid', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  label.appendChild(badge); el.appendChild(label);
  video.addEventListener('error', () => { if (sessions.get(el) === session) msg(el, 'Clip no disponible', 'Puedes intentar descargarlo o volver al directo.'); }, { once: true });
  video.play().catch(() => {});
  active.set(el, () => { video.pause(); video.removeAttribute('src'); video.load(); });
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

// Ajustes de la vigía, todos conservative y documentados. `prebufferS` es lo que
// hace que el clip incluya el inicio de la ola: el búfer ya está grabado cuando
// el detector dice que hay una. `segmentoS` es la granularidad del búfer: el
// detector no puede entregar un trozo más antiguo que el segmento en curso.
export const AJUSTES_VIGIA = {
  prebufferS: 12, // segundos de histórico que se quedan grabados
  postS: 8, // segundos que se siguen grabando después del disparo
  segmentoS: 2, // duración de cada trozo de búfer
  minIntervaloS: 20, // no disparar dos olas seguidas más cerca que esto
  cooldownS: 45, // margen tras disparar, para no encadenar clips
  // Banda vertical de la imagen donde se busca surfista, en fracción del alto del
  // vídeo. Al recortar aquí, el surfista ocupa más píxeles de la rejilla de
  // análisis, que es lo que hace falta a esta distancia. El resto (el cielo y la
  // arena de detrás) no se analiza.
  bandaImagen: [0.34, 0.94],
  detectar: true, // analizar la imagen mientras se ve el directo
};

const mimeGrabacion = () => ['video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
  .find((t) => window.MediaRecorder?.isTypeSupported(t)) || null;

// Une el búfer previo y la cola posterior en un único clip. Está suelto a
// propósito para poder comprobar sin navegador que el clip final lleva el
// principio de la ola: si el búfer no se sumara, el clip empezaría justo cuando
// el detector gritó "ola" y se perdería lo interesante.
export function ensamblarClip(pre, post, mimeType) {
  const partes = [...(pre || []), ...(post || [])].map((p) => p?.blob ?? p).filter(Boolean);
  if (!partes.length) return null;
  return {
    blob: new Blob(partes, { type: mimeType }),
    bytes: partes.reduce((s, p) => s + (p.size || 0), 0),
    trozos: partes.length,
  };
}

// Vigila el directo y graba solo lo que de verdad sirve: cuando el detector ve a
// alguien cogiendo una ola. Devuelve un objeto con `parar()` y `estado()`.
//
// Lo grabado se queda en el dispositivo del usuario: no se sube a ningún sitio.
export function iniciarVigiaOla(el, cam, opciones = {}) {
  const cfg = { ...AJUSTES_VIGIA, ...opciones };
  const detector = crearDetector({ ...AJUSTES_DETECCION, ...(opciones.ajustes || {}), roiAgua: [0, 1] });
  const video = el.querySelector('video');
  const mic = mimeGrabacion();
  const vigia = {
    cfg, detector, armed: false, parada: false,
    ultimoDisparo: 0,
    bucle: [], // trozos de búfer {blob, t0, t1}
    ultimo: null, eventos: [], error: null,
  };

  if (!video || el.dataset.cameraType !== 'hls') {
    vigia.error = 'La vigía necesita una cámara en directo que se pueda grabar.';
    return vigia;
  }
  if (!video.captureStream || !window.MediaRecorder || !mic) {
    vigia.error = 'Este navegador no permite grabar el directo, así que no se puede vigilar la ola.';
    return vigia;
  }

  let stream = null;
  try { stream = video.captureStream(); } catch (e) { vigia.error = 'La cámara no ofrece vídeo para analizar.'; return vigia; }
  if (!stream.getVideoTracks().length) { vigia.error = 'La cámara todavía no ofrece vídeo.'; return vigia; }

  // Lienzo de análisis: el búfer de píxeles se dibuja y se lee una vez por cuadro.
  const lienzo = document.createElement('canvas');
  lienzo.width = detector.ajustes.anchoAnalisis;
  lienzo.height = detector.ajustes.altoAnalisis;
  const ctx = lienzo.getContext('2d', { willReadFrequently: true });

  let grabador = null;
  let trozos = [];
  let temporizadorTrozo = null;
  let temporizadorPost = null;
  let temporizadorAnalisis = null;
  let grabandoPost = false;

  function grabarTrozo() {
    // Mientras se está grabando la cola posterior de una ola no se rellena el
    // búfer: quien decide cuándo acaba ese clip es su propio temporizador, que
    // vuelve a arrancar la cadena al terminar (ver `fin()`).
    if (vigia.parada || !vigia.armed || grabandoPost) return;
    const rec = new MediaRecorder(stream, { mimeType: mic });
    const t0 = Date.now();
    const recogidos = [];
    grabador = rec;
    rec.ondataavailable = (e) => { if (e.data.size) recogidos.push(e.data); };
    rec.onstop = () => {
      grabador = null;
      if (recogidos.length) {
        vigia.bucle.push({ blob: new Blob(recogidos, { type: mic }), t0, t1: Date.now() });
        // Poda del búfer: nunca más de `prebufferS` de histórico.
        const limite = Date.now() - cfg.prebufferS * 1000;
        while (vigia.bucle.length && vigia.bucle[0].t1 < limite) vigia.bucle.shift();
      }
      clearTimeout(temporizadorTrozo);
      if (!vigia.parada && vigia.armed && !grabandoPost) grabarTrozo();
    };
    rec.start();
    temporizadorTrozo = setTimeout(() => { if (rec.state !== 'inactive') rec.stop(); }, cfg.segmentoS * 1000);
  }

  function analizar() {
    if (vigia.parada || video.readyState < 2 || video.videoWidth === 0) return;
    const vh = video.videoHeight, vw = video.videoWidth;
    const sy = Math.floor(cfg.bandaImagen[0] * vh);
    const sh = Math.max(8, Math.floor((cfg.bandaImagen[1] - cfg.bandaImagen[0]) * vh));
    ctx.drawImage(video, 0, sy, vw, sh, 0, 0, lienzo.width, lienzo.height);
    const datos = ctx.getImageData(0, 0, lienzo.width, lienzo.height).data;
    const grises = aGrisesReducidos(datos, lienzo.width, lienzo.height, detector.ajustes.anchoAnalisis, detector.ajustes.altoAnalisis);
    const salida = detector.push(grises, Date.now());
    if (!salida?.deteccion) return;
    const ahora = Date.now();
    if (ahora - vigia.ultimoDisparo < cfg.cooldownS * 1000) return;
    vigia.ultimoDisparo = ahora;
    disparo(salida.deteccion);
  }

  function disparo(deteccion) {
    vigia.ultimaDeteccion = deteccion;
    // El búfer ya contiene los segundos anteriores: por eso el clip empieza antes
    // de la detección y sí incluye el inicio de la ola.
    const pre = vigia.bucle.slice();
    const seguidos = [];
    grabandoPost = true;
    const fin = () => {
      grabandoPost = false;
      clearTimeout(temporizadorPost);
      const clip = ensamblarClip(pre, seguidos, mic);
      const inicio = pre[0]?.t0 ?? Date.now();
      const final = seguidos[seguidos.length - 1]?.t1 ?? Date.now();
      if (!clip) { if (!vigia.parada && vigia.armed) grabarTrozo(); return; }
      vigia.ultimo = {
        blob: clip.blob,
        bytes: clip.bytes,
        extension: mic.startsWith('video/mp4') ? 'mp4' : 'webm',
        mimeType: mic,
        deteccion,
        segundos: Math.max(1, Math.round((final - inicio) / 1000)),
        prebufferS: Math.round((deteccion.tMs - inicio) / 1000),
      };
      vigia.eventos.push(vigia.ultimo);
      opciones.onOla?.(vigia.ultimo);
      // El búfer vuelve a llenarse para el siguiente intento.
      if (!vigia.parada && vigia.armed) grabarTrozo();
    };
    const restantes = cfg.postS;
    const seguir = () => {
      if (restantes <= 0 || vigia.parada) { fin(); return; }
      const pedazo = Math.min(cfg.segmentoS, restantes);
      const rec = new MediaRecorder(stream, { mimeType: mic });
      const t0 = Date.now();
      const recogidos = [];
      rec.ondataavailable = (e) => { if (e.data.size) recogidos.push(e.data); };
      rec.onstop = () => {
        if (recogidos.length) seguidos.push({ blob: new Blob(recogidos, { type: mic }), t0, t1: Date.now() });
        seguir();
      };
      rec.start();
      temporizadorPost = setTimeout(() => { if (rec.state !== 'inactive') rec.stop(); }, pedazo * 1000);
    };
    seguir();
  }

  vigias.set(el, vigia);
  vigia.armed = true;
  grabarTrozo();
  if (cfg.detectar) {
    temporizadorAnalisis = setInterval(analizar, 1000 / detector.ajustes.cuadrosPorSegundo);
  }

  vigia.parar = () => {
    if (vigia.parada) return;
    vigia.parada = true;
    vigia.armed = false;
    clearInterval(temporizadorAnalisis);
    clearTimeout(temporizadorTrozo);
    clearTimeout(temporizadorPost);
    if (grabador && grabador.state !== 'inactive') grabador.stop();
    stream.getTracks().forEach((t) => t.stop());
  };
  vigia.estado = () => ({
    armed: vigia.armed,
    bucle: vigia.bucle.length,
    segundos: vigia.bucle.reduce((s, p) => s + (p.t1 - p.t0) / 1000, 0),
    eventos: vigia.eventos.length,
    error: vigia.error,
    detector: detector.estado(),
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

// cams.js — Reproductor de webcams incrustadas: iframe, YouTube, HLS, MJPEG y JPG refrescado.
let catalog = null;
let hlsLib = null;
let hlsLoading = null;
const active = new Map(); // contenedor → limpieza
const recordings = new Map();
const sessions = new WeakMap();

// Dominios conocidos de streaming para preconnect anticipado
const STREAM_ORIGINS = [
  'https://streaming.comunitatvalenciana.com',
  'https://cdn.jsdelivr.net',
  'https://cam1.voramar.net:445',
  'https://g0.ipcamlive.com',
  'https://webcams.windy.com',
  'https://cdn.skylinewebcams.com'
];

function preconnect(href) {
  try {
    const origin = new URL(href).origin;
    if (document.querySelector(`link[rel="preconnect"][href="${origin}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'preconnect';
    link.href = origin;
    if (href.includes('comunitatvalenciana') || href.includes('jsdelivr')) link.crossOrigin = '';
    document.head.appendChild(link);
    const dns = document.createElement('link');
    dns.rel = 'dns-prefetch';
    dns.href = origin;
    document.head.appendChild(dns);
  } catch {}
}

function initPreconnects() {
  STREAM_ORIGINS.forEach(preconnect);
  // Preload anticipado de hls.js
  if (!document.querySelector('link[href*="hls.min.js"]')) {
    const preload = document.createElement('link');
    preload.rel = 'preload';
    preload.href = 'https://cdn.jsdelivr.net/npm/hls.js@1.5.13/dist/hls.min.js';
    preload.as = 'script';
    document.head.appendChild(preload);
  }
}

// Inicializar preconnects de inmediato
if (typeof document !== 'undefined') {
  initPreconnects();
}

export async function loadCams() {
  if (catalog) return catalog;
  try {
    const r = await fetch('webcams.json', { cache: 'no-cache' });
    catalog = (await r.json()).webcams.filter((c) => c.embedUrl && c.enabled !== false);
    // Preconectar dinámicamente cualquier otro origen presente en el catálogo
    catalog.forEach((c) => {
      if (c.embedUrl) preconnect(c.embedUrl);
      if (c.snapshotUrl) preconnect(c.snapshotUrl);
    });
    // Calentar hls.js en segundo plano para que esté listo cuando el usuario abra una cámara
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(() => getHls().catch(() => {}));
    } else {
      setTimeout(() => getHls().catch(() => {}), 300);
    }
  } catch { catalog = []; }
  return catalog;
}

const TYPE_WEIGHT = { hls: 1, mjpeg: 2, jpg: 3, iframe: 4, youtube: 5, link: 6 };

export function camsForSpot(spot) {
  const list = catalog || [];
  return list
    .filter((c) => (c.spots || []).includes(spot?.id || spot))
    .sort((a, b) =>
      (a.priority ?? 9) - (b.priority ?? 9) ||
      (TYPE_WEIGHT[a.embedType] ?? 9) - (TYPE_WEIGHT[b.embedType] ?? 9) ||
      (a.distanceKm ?? 99) - (b.distanceKm ?? 99)
    );
}

export function stopCam(el) {
  sessions.set(el, {});
  delete el.dataset.cameraType;
  recordings.get(el)?.();
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

// Obtiene o deriva el poster/miniatura de la cámara de forma inmediata
export function getCamPoster(cam) {
  if (!cam) return null;
  if (cam.snapshotUrl) return cam.snapshotUrl;
  if (cam.posterUrl) return cam.posterUrl;
  if (cam.thumbUrl) return cam.thumbUrl;
  if (cam.embedType === 'jpg') return cam.embedUrl;
  if (cam.embedType === 'mjpeg' && cam.embedUrl?.includes('/mjpg/video.cgi')) {
    return cam.embedUrl.replace('/mjpg/video.cgi', '/jpg/image.cgi');
  }
  if (cam.embedType === 'hls' && cam.embedUrl?.includes('streaming.comunitatvalenciana.com/webcam/')) {
    const m = cam.embedUrl.match(/\/webcam\/([^/]+)\//);
    if (m) return `https://streaming.comunitatvalenciana.com/static/${m[1]}/webcam_mini.png`;
  }
  const id = cam.embedType === 'youtube' && cam.embedUrl?.match(/(?:v=|youtu\.be\/|embed\/|live\/)([\w-]{11})/)?.[1];
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault_live.jpg` : null;
}

export function camThumb(cam) {
  return getCamPoster(cam);
}

// Pinta la cámara en el contenedor .cam
export async function playCam(el, cam, { autoplay = true, spot, onFallback } = {}) {
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

  // Poster inmediato visible mientras el stream o iframe conecta
  const poster = getCamPoster(cam);
  let posterImg = null;
  if (poster) {
    posterImg = document.createElement('img');
    posterImg.className = 'cam-poster';
    posterImg.src = poster;
    posterImg.alt = cam.name || '';
    posterImg.loading = 'eager';
    posterImg.decoding = 'async';
    el.appendChild(posterImg);
  }

  const removePoster = () => {
    if (posterImg) {
      posterImg.classList.add('fade-out');
      setTimeout(() => { posterImg?.remove(); posterImg = null; }, 350);
    }
  };

  const overlay = `<div class="cam-overlay"><span class="live-badge">${cam.embedType === 'jpg' ? 'FOTO' : 'EN DIRECTO'}</span></div>`;
  el.insertAdjacentHTML('beforeend', overlay);
  const t = cam.embedType;

  // Lógica de fallo con paso rápido a cámara de respaldo
  let hasFailed = false;
  const fail = () => {
    if (sessions.get(el) !== session || hasFailed) return;
    hasFailed = true;
    const targetSpotId = spot?.id || cam.spots?.[0];
    const spotCams = targetSpotId ? (catalog || []).filter((c) => (c.spots || []).includes(targetSpotId)) : [];
    const currentIdx = spotCams.findIndex((c) => c.id === cam.id);
    const nextCam = currentIdx >= 0 ? spotCams[currentIdx + 1] : null;

    if (nextCam) {
      stopCam(el);
      if (onFallback) onFallback(nextCam, currentIdx + 1);
      playCam(el, nextCam, { autoplay, spot, onFallback });
      return;
    }
    stopCam(el);
    msg(el, 'Cámara sin señal', 'La emisión no responde ahora mismo. Prueba otra cámara o vuelve en un rato.');
  };

  if (t === 'iframe' || t === 'youtube') {
    let src = cam.embedUrl;
    if (t === 'youtube' && !/embed/.test(src)) {
      const id = src.match(/(?:v=|youtu\.be\/|live\/)([\w-]{11})/)?.[1];
      src = id ? `https://www.youtube-nocookie.com/embed/${id}` : src;
    }
    if (t === 'youtube') src += (src.includes('?') ? '&' : '?') + `autoplay=${autoplay ? 1 : 0}&mute=1&playsinline=1&rel=0`;

    const mountIframe = () => {
      if (sessions.get(el) !== session || !el.isConnected) return;
      const f = document.createElement('iframe');
      f.src = src;
      f.allow = 'autoplay; fullscreen; picture-in-picture; encrypted-media';
      f.allowFullscreen = true;
      f.referrerPolicy = 'strict-origin-when-cross-origin';
      f.loading = 'lazy';
      f.title = cam.name;
      f.onload = () => removePoster();
      el.appendChild(f);
      active.set(el, () => { f.src = 'about:blank'; f.remove(); posterImg?.remove(); });
    };

    // Iframe diferido hasta ser visible en el viewport
    const isVisible = () => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && r.top < window.innerHeight + 150 && r.bottom > -150;
    };

    if ('IntersectionObserver' in window && !isVisible()) {
      const io = new IntersectionObserver((entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            io.disconnect();
            mountIframe();
          }
        }
      }, { rootMargin: '100px' });
      io.observe(el);
      active.set(el, () => { io.disconnect(); posterImg?.remove(); });
    } else {
      mountIframe();
    }
    return;
  }

  if (t === 'hls') {
    const v = document.createElement('video');
    Object.assign(v, { muted: true, autoplay, playsInline: true, controls: true });
    v.setAttribute('playsinline', '');
    if (poster) v.poster = poster;
    el.appendChild(v);
    let hls = null;

    active.set(el, () => {
      clearTimeout(playTimeout);
      hls?.destroy();
      v.pause();
      v.removeAttribute('src');
      v.load();
      posterImg?.remove();
    });

    // Quitar poster al recibir los primeros fotogramas
    v.addEventListener('playing', removePoster, { once: true });
    v.addEventListener('loadeddata', removePoster, { once: true });

    // Timeout de 4s para arrancar vídeo: si la emisión cuelga, pasar a respaldo
    const playTimeout = setTimeout(() => {
      if (v.readyState < 2) fail();
    }, 4000);
    v.addEventListener('playing', () => clearTimeout(playTimeout), { once: true });
    v.addEventListener('loadeddata', () => clearTimeout(playTimeout), { once: true });

    if (isApple() && v.canPlayType('application/vnd.apple.mpegurl')) {
      v.src = cam.embedUrl;
      v.addEventListener('error', fail, { once: true });
    } else {
      try {
        const Hls = await getHls();
        if (sessions.get(el) !== session || !el.isConnected) return;
        if (!Hls.isSupported()) {
          v.src = cam.embedUrl;
          v.addEventListener('error', fail, { once: true });
        } else {
          hls = new Hls({
            lowLatencyMode: true,
            startLevel: 0, // Inicia en calidad menor para arranque ultra-rápido
            capLevelToPlayerSize: true, // No descargar 2K en pantallas de móvil
            maxBufferLength: 8,
            maxMaxBufferLength: 15,
            backBufferLength: 10,
            liveSyncDurationCount: 2,
            liveMaxLatencyDurationCount: 3,
            manifestLoadingTimeOut: 3500,
            manifestLoadingMaxRetry: 2,
            levelLoadingTimeOut: 3500,
            fragLoadingTimeOut: 4000,
            enableWorker: true
          });
          hls.loadSource(cam.embedUrl);
          hls.attachMedia(v);
          hls.on(Hls.Events.ERROR, (_, d) => { if (d.fatal) fail(); });
        }
      } catch {
        fail();
        return;
      }
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

    // Timeout corto de 3.5s para MJPEG: si puerto 445 está bloqueado o red móvil falla, salto a respaldo
    let mjpegOk = false;
    const mjpegTimer = setTimeout(() => {
      if (!mjpegOk && sessions.get(el) === session) fail();
    }, 3500);

    img.onload = () => {
      mjpegOk = true;
      clearTimeout(mjpegTimer);
      removePoster();
    };
    img.onerror = () => {
      clearTimeout(mjpegTimer);
      if (sessions.get(el) !== session) return;
      fail();
    };
    el.appendChild(img);
    let timer = null;
    if (t === 'jpg') {
      timer = setInterval(() => {
        if (document.hidden) return; // No refrescar si la pestaña está oculta
        const n = new Image();
        n.onload = () => { if (sessions.get(el) === session) img.src = n.src; };
        n.src = bust();
      }, (cam.refreshSeconds || 30) * 1000);
    }
    active.set(el, () => {
      clearTimeout(mjpegTimer);
      clearInterval(timer);
      img.src = '';
      posterImg?.remove();
    });
    return;
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

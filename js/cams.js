// cams.js — Reproductor de webcams incrustadas: iframe, YouTube, HLS, MJPEG y JPG refrescado.
let catalog = null;
let hlsLib = null;
const active = new Map(); // contenedor → limpieza

export async function loadCams() {
  if (catalog) return catalog;
  try {
    const r = await fetch('webcams.json', { cache: 'no-cache' });
    catalog = (await r.json()).webcams.filter((c) => c.embedUrl && c.enabled !== false);
  } catch { catalog = []; }
  return catalog;
}

export function camsForSpot(spot) {
  const list = catalog || [];
  return list
    .filter((c) => (c.spots || []).includes(spot.id))
    .sort((a, b) => (a.priority ?? 9) - (b.priority ?? 9) || (a.distanceKm ?? 99) - (b.distanceKm ?? 99));
}

export function stopCam(el) {
  const clean = active.get(el);
  if (clean) { try { clean(); } catch { /* nada */ } active.delete(el); }
  el.innerHTML = '';
}

const isApple = () => /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ||
  (/Safari/.test(navigator.userAgent) && !/Chrome|Chromium|Android/.test(navigator.userAgent));

async function getHls() {
  if (hlsLib) return hlsLib;
  await new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/hls.js@1.5.13/dist/hls.min.js';
    s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
  hlsLib = window.Hls;
  return hlsLib;
}

function msg(el, title, text) {
  el.insertAdjacentHTML('beforeend', `<div class="cam-msg"><div><b>${title}</b>${text}</div></div>`);
}

// Pinta la cámara en el contenedor .cam
export async function playCam(el, cam, { autoplay = true } = {}) {
  stopCam(el);
  if (!cam) { msg(el, 'Sin cámara en este spot', 'Todavía no hay una cámara pública que enfoque esta playa.'); return; }
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
    const v = document.createElement('video');
    Object.assign(v, { muted: true, autoplay, playsInline: true, controls: true });
    v.setAttribute('playsinline', '');
    el.appendChild(v);
    let hls = null;
    const fail = () => { stopCam(el); msg(el, 'Cámara sin señal', 'La emisión no responde ahora mismo. Prueba otra cámara o vuelve en un rato.'); };
    if (isApple() && v.canPlayType('application/vnd.apple.mpegurl')) {
      v.src = cam.embedUrl;
      v.addEventListener('error', fail, { once: true });
    } else {
      try {
        const Hls = await getHls();
        if (!Hls.isSupported()) { v.src = cam.embedUrl; }
        else {
          hls = new Hls({ lowLatencyMode: true, backBufferLength: 30 });
          hls.loadSource(cam.embedUrl);
          hls.attachMedia(v);
          hls.on(Hls.Events.ERROR, (_, d) => { if (d.fatal) { hls.destroy(); hls = null; fail(); } });
        }
      } catch { fail(); return; }
    }
    v.play?.().catch(() => { /* el usuario pulsa play */ });
    active.set(el, () => { hls?.destroy(); v.removeAttribute('src'); v.load(); });
    return;
  }

  if (t === 'mjpeg' || t === 'jpg') {
    const img = document.createElement('img');
    img.alt = cam.name;
    img.decoding = 'async';
    const base = cam.embedUrl;
    const bust = () => base + (base.includes('?') ? '&' : '?') + '_=' + Date.now();
    img.src = t === 'jpg' ? bust() : base;
    img.onerror = () => { stopCam(el); msg(el, 'Cámara sin señal', 'La imagen no se puede cargar ahora mismo.'); };
    el.appendChild(img);
    let timer = null;
    if (t === 'jpg') timer = setInterval(() => { const n = new Image(); n.onload = () => { img.src = n.src; }; n.src = bust(); }, (cam.refreshSeconds || 30) * 1000);
    active.set(el, () => { clearInterval(timer); img.src = ''; });
  }
}

// Miniatura estática para tarjetas (solo tipos que tienen imagen)
export function camThumb(cam) {
  if (!cam) return null;
  if (cam.thumbUrl) return cam.thumbUrl;
  if (cam.embedType === 'jpg') return cam.embedUrl;
  const id = cam.embedType === 'youtube' && cam.embedUrl.match(/(?:v=|youtu\.be\/|embed\/|live\/)([\w-]{11})/)?.[1];
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault_live.jpg` : null;
}

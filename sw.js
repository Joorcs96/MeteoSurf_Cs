// sw.js — Surfline Castellón Service Worker
// CACHE_NAME incrementado a v5 para forzar actualización en móviles con cache vieja
const CACHE_NAME = 'surfline-cs-v6';
const STATIC_ASSETS = [
  './',
  './index.html',
  './css/app.css',
  './app.js',
  './webcams.json',
  './votar.html',
  './manifest.json'
];

// Dominios/patrones de streaming que NUNCA deben cachearse ni interceptarse
function isStreamRequest(url) {
  // HLS playlists y segmentos
  if (url.pathname.endsWith('.m3u8') || url.pathname.endsWith('.ts')) return true;
  // MJPEG y streams de vídeo
  if (url.pathname.includes('mjpg') || url.pathname.includes('mjpeg')) return true;
  // Dominios de streaming externo
  if (url.hostname.includes('streaming.comunitatvalenciana.com')) return true;
  if (url.hostname.includes('voramar.net') && url.port === '445') return true;
  if (url.hostname.includes('cam1.voramar.net')) return true;
  if (url.hostname.includes('skylinewebcams.com')) return true;
  if (url.hostname.includes('surferscastellon.com')) return true;
  if (url.hostname.includes('aeroclubcastellon.com')) return true;
  return false;
}

// Instalar Service Worker y pre-cachear el App Shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activar y limpiar cachés anteriores
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Interceptar peticiones de red
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 0. No interceptar no-GET ni protocolos ajenos
  if (event.request.method !== 'GET' || !url.protocol.startsWith('http')) {
    return;
  }

  // 1. NUNCA interceptar streams, MJPEG, HLS ni dominios de cámara externos
  //    → dejar pasar directamente a la red sin tocar
  if (isStreamRequest(url)) {
    return;
  }

  // 2. Peticiones a Open-Meteo (Datos de previsión) → Network-First
  if (url.hostname.includes('open-meteo.com')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(event.request);
          if (cached) return cached;
          return new Response(JSON.stringify({ error: 'offline_fallback' }), {
            headers: { 'Content-Type': 'application/json' }
          });
        })
    );
    return;
  }

  // 3. Fuentes y CDN estáticos (hls.js, tailwind, leaflet, chart.js, material-icons)
  //    → Cache-First (son assets versionados que no cambian)
  if (
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com') ||
    url.hostname.includes('cdn.tailwindcss.com') ||
    url.hostname.includes('cdn.jsdelivr.net') ||
    url.hostname.includes('unpkg.com')
  ) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        }).catch(() => {
          return new Response('', { status: 408, statusText: 'CDN Timeout / Offline' });
        });
      })
    );
    return;
  }

  // 4. App Shell local (index.html, app.js, sw.js, manifest.json, votar.html)
  //    → Network-First: el móvil siempre recibe la versión más nueva
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          const cached = await caches.match(event.request);
          if (cached) return cached;
          return caches.match('./index.html');
        })
    );
    return;
  }
  // 5. Cualquier otro dominio externo no clasificado: dejar pasar sin interceptar
});

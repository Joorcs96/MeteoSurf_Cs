// sw.js — MeteoSurf_Cs. Archivos propios: red primero (siempre la última versión), caché si no hay conexión.
// Streams de cámaras y APIs externas no se interceptan.
// El nombre de la caché lleva la versión: al publicar, los usuarios que ya
// tenían la PWA instalada borran la suya vieja en `activate` y se quedan con
// esta. Va por encima de la v17 de `main` (que ya existe) para que, al integrar
// las dos ramas, el número nunca baje y nadie se quede con un shell viejo.
const CACHE = 'meteosurf-cs-v19-mapa-capas';
// `deteccion.js` y `detector-ia.js` también entran: los importa `cams.js`, y si
// no están en la lista, a quien ya tenía la PWA instalada le falla la vigía sin
// red aunque el resto de la app esté en caché.
const SHELL = ['./', './index.html', './css/app.css', './js/app.js', './js/spots.js', './js/forecast.js',
  './js/compass.js', './js/cams.js', './js/assistant.js', './js/physics.js', './js/nowcast.js', './js/mapa-capas.js',
  './js/deteccion.js', './js/detector-ia.js', './webcams.json', './manifest.json', './icon.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.endsWith('.mp4')) return;
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' })
      .then((r) => {
        if (r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
        return r;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('./index.html')))
  );
});

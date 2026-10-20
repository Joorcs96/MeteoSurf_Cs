// sw.js — MeteoSurf_Cs. Archivos propios: red primero (siempre la última versión), caché si no hay conexión.
// Streams de cámaras y APIs externas no se interceptan.
const CACHE = 'meteosurf-cs-v17-notificaciones';
const SHELL = ['./', './index.html', './css/app.css', './js/app.js', './js/spots.js', './js/forecast.js',
  './js/compass.js', './js/cams.js', './js/assistant.js', './js/physics.js', './js/nowcast.js',
  './js/config.js', './js/notificaciones.js', './webcams.json', './manifest.json', './icon.svg'];

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

// ---------- Push Web y Notificaciones ----------
self.addEventListener('push', (e) => {
  let payload = {};
  try {
    payload = e.data ? e.data.json() : {};
  } catch {
    payload = { body: e.data ? e.data.text() : '' };
  }
  const title = payload.title || 'MeteoSurf';
  const options = {
    body: payload.body || 'Nuevo aviso de condiciones para surfear en Castellón.',
    icon: payload.icon || 'icons/icon-192.png',
    tag: payload.tag || 'meteosurf-aviso',
    data: {
      url: payload.url || './'
    }
  };
  e.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const targetUrl = (e.notification.data && e.notification.data.url) || './';
  const fullUrl = new URL(targetUrl, self.location.origin).href;
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ('focus' in client) {
          if (client.url === fullUrl || client.url.startsWith(self.location.origin)) {
            if (client.navigate && client.url !== fullUrl) {
              client.navigate(fullUrl);
            }
            return client.focus();
          }
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(fullUrl);
      }
    })
  );
});

self.addEventListener('pushsubscriptionchange', (e) => {
  e.waitUntil(
    self.registration.pushManager.subscribe(
      e.oldSubscription ? e.oldSubscription.options : { userVisibleOnly: true }
    ).then((subscription) => {
      return self.clients.matchAll({ type: 'window' }).then((windowClients) => {
        windowClients.forEach((client) => {
          client.postMessage({ type: 'PUSH_SUBSCRIPTION_CHANGED', subscription });
        });
      });
    }).catch(() => { /* sin resuscripción */ })
  );
});

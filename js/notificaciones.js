// js/notificaciones.js — Gestión de notificaciones push y panel de preferencias en MeteoSurf_Cs.
import { WORKER_URL } from './config.js';
import { SPOTS } from './spots.js';

// ---------- Esquema y valores por defecto ----------
export const DEFAULT_PREFS = {
  spots: ['Planetario', 'Voramar', 'MorroGos', 'Palaciet'],
  alerts: {
    gente: true,
    olas_ahora: true,
    olas_tarde: true,
    dias_buenos: true
  },
  minStars: 3,
  quiet: {
    from: 22,
    to: 8
  },
  maxPerDay: 2
};

// ---------- Lógica pura: conversión base64url a Uint8Array ----------
export function urlBase64ToUint8Array(base64String) {
  if (!base64String || typeof base64String !== 'string') {
    return new Uint8Array(0);
  }
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = typeof atob === 'function'
    ? atob(base64)
    : Buffer.from(base64, 'base64').toString('binary');
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// ---------- Lógica pura: construir y sanear preferencias ----------
export function buildPrefs(raw = {}, defaultSpots = DEFAULT_PREFS.spots) {
  const spots = Array.isArray(raw?.spots) && raw.spots.length > 0
    ? [...new Set(raw.spots.filter((s) => typeof s === 'string' && s.trim().length > 0))]
    : [...defaultSpots];

  const rawAlerts = raw?.alerts || {};
  const alerts = {
    gente: typeof rawAlerts.gente === 'boolean' ? rawAlerts.gente : DEFAULT_PREFS.alerts.gente,
    olas_ahora: typeof rawAlerts.olas_ahora === 'boolean' ? rawAlerts.olas_ahora : DEFAULT_PREFS.alerts.olas_ahora,
    olas_tarde: typeof rawAlerts.olas_tarde === 'boolean' ? rawAlerts.olas_tarde : DEFAULT_PREFS.alerts.olas_tarde,
    dias_buenos: typeof rawAlerts.dias_buenos === 'boolean' ? rawAlerts.dias_buenos : DEFAULT_PREFS.alerts.dias_buenos
  };

  const parsedStars = Number(raw?.minStars);
  const minStars = Number.isInteger(parsedStars)
    ? Math.min(5, Math.max(2, parsedStars))
    : DEFAULT_PREFS.minStars;

  const rawQuiet = raw?.quiet || {};
  const parsedFrom = Number(rawQuiet.from);
  const parsedTo = Number(rawQuiet.to);
  const quiet = {
    from: Number.isInteger(parsedFrom) ? Math.min(23, Math.max(0, parsedFrom)) : DEFAULT_PREFS.quiet.from,
    to: Number.isInteger(parsedTo) ? Math.min(23, Math.max(0, parsedTo)) : DEFAULT_PREFS.quiet.to
  };

  const parsedMax = Number(raw?.maxPerDay);
  const maxPerDay = Number.isInteger(parsedMax)
    ? Math.min(3, Math.max(1, parsedMax))
    : DEFAULT_PREFS.maxPerDay;

  return {
    spots,
    alerts,
    minStars,
    quiet,
    maxPerDay
  };
}

// ---------- Lógica pura: validación del esquema de preferencias ----------
export function validatePrefs(prefs) {
  const errors = [];
  if (!prefs || typeof prefs !== 'object' || Array.isArray(prefs)) {
    return { valid: false, errors: ['Preferencias no válidas (debe ser un objeto).'] };
  }

  if (!Array.isArray(prefs.spots) || !prefs.spots.every((s) => typeof s === 'string' && s.length > 0)) {
    errors.push('spots debe ser un array de cadenas no vacías.');
  }

  if (!prefs.alerts || typeof prefs.alerts !== 'object') {
    errors.push('alerts debe ser un objeto.');
  } else {
    for (const key of ['gente', 'olas_ahora', 'olas_tarde', 'dias_buenos']) {
      if (typeof prefs.alerts[key] !== 'boolean') {
        errors.push(`alerts.${key} debe ser un valor booleano.`);
      }
    }
  }

  if (!Number.isInteger(prefs.minStars) || prefs.minStars < 2 || prefs.minStars > 5) {
    errors.push('minStars debe ser un entero entre 2 y 5.');
  }

  if (!prefs.quiet || typeof prefs.quiet !== 'object') {
    errors.push('quiet debe ser un objeto con from y to.');
  } else {
    if (!Number.isInteger(prefs.quiet.from) || prefs.quiet.from < 0 || prefs.quiet.from > 23) {
      errors.push('quiet.from debe ser un entero entre 0 y 23.');
    }
    if (!Number.isInteger(prefs.quiet.to) || prefs.quiet.to < 0 || prefs.quiet.to > 23) {
      errors.push('quiet.to debe ser un entero entre 0 y 23.');
    }
  }

  if (!Number.isInteger(prefs.maxPerDay) || prefs.maxPerDay < 1 || prefs.maxPerDay > 3) {
    errors.push('maxPerDay debe ser un entero entre 1 y 3.');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

// ---------- Detección de capacidades y plataforma ----------
export function checkPushCapabilities(workerUrl = WORKER_URL) {
  const isIOS = typeof navigator !== 'undefined' && (
    /iPad|iPhone|iPod/.test(navigator.userAgent || '') ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
  const isStandalone = typeof window !== 'undefined' && (
    window.navigator?.standalone === true ||
    Boolean(window.matchMedia?.('(display-mode: standalone)')?.matches)
  );
  const hasPush = typeof window !== 'undefined' && typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window;
  const hasWorker = Boolean(workerUrl && typeof workerUrl === 'string' && workerUrl.trim().length > 0);

  let status = 'ready';
  let message = '';

  if (isIOS && !isStandalone) {
    status = 'ios_uninstalled';
    message = 'En iPhone o iPad, Apple exige instalar la app antes de poder activar notificaciones.';
  } else if (!hasPush) {
    status = 'unsupported';
    message = 'Tu navegador o dispositivo no es compatible con notificaciones web.';
  } else if (!hasWorker) {
    status = 'unconfigured';
    message = 'Servicio de avisos en preparación. Próximamente disponible.';
  }

  return {
    isIOS,
    isStandalone,
    hasPush,
    hasWorker,
    status,
    message,
    supported: status === 'ready'
  };
}

// ---------- Almacenamiento local de suscripción y preferencias ----------
const NOTIF_STORAGE = {
  getId() {
    try { return localStorage.getItem('msc_notif_id') || null; } catch { return null; }
  },
  setId(id) {
    try {
      if (id) localStorage.setItem('msc_notif_id', id);
      else localStorage.removeItem('msc_notif_id');
    } catch { /* sin almacenamiento */ }
  },
  getPrefs() {
    try {
      const raw = localStorage.getItem('msc_notif_prefs');
      if (raw) return buildPrefs(JSON.parse(raw));
    } catch { /* continuar con defaults */ }
    // Si no hay preferencias guardadas, reutilizar los favoritos actuales
    let currentFavs = DEFAULT_PREFS.spots;
    try {
      const favsRaw = localStorage.getItem('msc_favs');
      if (favsRaw) {
        const arr = JSON.parse(favsRaw);
        if (Array.isArray(arr) && arr.length) currentFavs = arr;
      }
    } catch { /* noop */ }
    return buildPrefs({}, currentFavs);
  },
  setPrefs(prefs) {
    try { localStorage.setItem('msc_notif_prefs', JSON.stringify(prefs)); } catch { /* noop */ }
  }
};

// ---------- Estado en memoria ----------
let currentPrefs = NOTIF_STORAGE.getPrefs();
let activeSubscription = null;
let currentSubId = NOTIF_STORAGE.getId();

// ---------- Sincronización con el Cloudflare Worker ----------
export async function sendPrefsUpdate(prefs = currentPrefs, workerUrl = WORKER_URL) {
  currentPrefs = buildPrefs(prefs);
  NOTIF_STORAGE.setPrefs(currentPrefs);
  const id = currentSubId || NOTIF_STORAGE.getId();
  if (!id || !workerUrl) return { ok: true, localOnly: true };

  try {
    const res = await fetch(`${workerUrl.replace(/\/+$/, '')}/prefs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, prefs: currentPrefs })
    });
    if (res.ok) {
      return { ok: true };
    }
    return { ok: false, status: res.status };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

export async function subscribeUser(workerUrl = WORKER_URL) {
  const caps = checkPushCapabilities(workerUrl);
  if (!caps.supported) {
    return { ok: false, error: caps.message };
  }

  // 1. Permiso explícito del usuario (requisito iOS / navegadores modernos)
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return { ok: false, error: 'Permiso de notificaciones denegado.' };
  }

  // 2. Clave pública VAPID del worker
  let vapidKey = '';
  try {
    const keyRes = await fetch(`${workerUrl.replace(/\/+$/, '')}/vapid-public`);
    if (!keyRes.ok) throw new Error(`Error ${keyRes.status} al obtener clave pública.`);
    const keyData = await keyRes.json();
    vapidKey = keyData.key;
  } catch (e) {
    return { ok: false, error: 'No se pudo conectar con el servidor de avisos: ' + e.message };
  }

  // 3. Suscripción en el Service Worker
  const reg = await navigator.serviceWorker.ready;
  const applicationServerKey = urlBase64ToUint8Array(vapidKey);
  const subscription = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey
  });
  activeSubscription = subscription;

  // 4. Registro en el worker
  try {
    const subRes = await fetch(`${workerUrl.replace(/\/+$/, '')}/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription, prefs: currentPrefs })
    });
    if (!subRes.ok) throw new Error(`Error ${subRes.status} al registrar suscripción.`);
    const subData = await subRes.json();
    currentSubId = subData.id;
    NOTIF_STORAGE.setId(currentSubId);
    return { ok: true, id: currentSubId };
  } catch (e) {
    return { ok: false, error: 'Fallo al guardar la suscripción en el servidor: ' + e.message };
  }
}

export async function unsubscribeUser(workerUrl = WORKER_URL) {
  const id = currentSubId || NOTIF_STORAGE.getId();
  if (id && workerUrl) {
    try {
      await fetch(`${workerUrl.replace(/\/+$/, '')}/unsubscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
    } catch { /* proseguir con desuscripción local */ }
  }

  try {
    if (activeSubscription) {
      await activeSubscription.unsubscribe();
      activeSubscription = null;
    } else if (navigator.serviceWorker) {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
    }
  } catch { /* noop */ }

  currentSubId = null;
  NOTIF_STORAGE.setId(null);
  return { ok: true };
}

export async function sendTestNotification() {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return;
  }
  try {
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification('MeteoSurf', {
      body: 'Aviso de prueba: buenas condiciones en Planetario y Voramar.',
      icon: 'icon-192.png',
      tag: 'test-local-' + Date.now(),
      data: { url: './?spot=Planetario' }
    });
  } catch {
    // Si el SW no está listo, fallback a Notification nativa
    try {
      new Notification('MeteoSurf', {
        body: 'Aviso de prueba: buenas condiciones en Planetario y Voramar.',
        icon: 'icon-192.png'
      });
    } catch { /* noop */ }
  }
}

// ---------- Renderizado del Panel de Notificaciones ----------
let modalContainer = null;

export function renderNotificacionesPanel(container = document.body) {
  if (!modalContainer) {
    modalContainer = document.createElement('div');
    modalContainer.id = 'notif-modal-root';
    modalContainer.className = 'notif-overlay notif-hidden';
    container.appendChild(modalContainer);
  }

  const caps = checkPushCapabilities(WORKER_URL);
  currentPrefs = NOTIF_STORAGE.getPrefs();
  const id = currentSubId || NOTIF_STORAGE.getId();
  const isSubscribed = Boolean(id && activeSubscription);

  // Obtener lista completa de spots de spots.js
  const allSpots = Array.isArray(SPOTS) ? SPOTS : [];
  const selectedSpots = new Set(currentPrefs.spots);

  let statusSection = '';
  if (caps.status === 'ios_uninstalled') {
    statusSection = `
      <div class="notif-notice notif-ios-card">
        <h3 class="notif-notice-title">Añadir a pantalla de inicio</h3>
        <p class="notif-notice-text">Para recibir avisos en tu iPhone o iPad, Apple requiere instalar la aplicación en tu pantalla de inicio:</p>
        <ol class="notif-ios-steps">
          <li>Pulsa el botón <strong>Compartir</strong> en la barra de Safari.</li>
          <li>Desplázate hacia abajo y selecciona <strong>Añadir a pantalla de inicio</strong>.</li>
          <li>Abre MeteoSurf desde el icono creado para activar los avisos.</li>
        </ol>
      </div>`;
  } else if (caps.status === 'unsupported') {
    statusSection = `
      <div class="notif-notice notif-warning-card">
        <h3 class="notif-notice-title">Navegador no compatible</h3>
        <p class="notif-notice-text">${caps.message}</p>
      </div>`;
  } else if (caps.status === 'unconfigured') {
    statusSection = `
      <div class="notif-notice notif-info-card">
        <h3 class="notif-notice-title">Servicio en preparación</h3>
        <p class="notif-notice-text">${caps.message}</p>
      </div>`;
  }

  const disabledAttr = !caps.supported ? 'disabled' : '';

  modalContainer.innerHTML = `
    <div class="notif-dialog" role="dialog" aria-modal="true" aria-labelledby="notif-title">
      <div class="notif-header">
        <div class="notif-title-wrap">
          <h2 id="notif-title" class="notif-title">Avisos y notificaciones</h2>
          <span class="notif-sub">Previsiones favorables y surfistas en el agua</span>
        </div>
        <button class="notif-close-btn" id="notif-close-btn" aria-label="Cerrar panel de avisos">
          <svg class="notif-svg" viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <div class="notif-body">
        ${statusSection}

        <section class="notif-section">
          <div class="notif-activation-box">
            <div class="notif-act-info">
              <span class="notif-act-label">Estado del servicio</span>
              <span class="notif-act-status ${isSubscribed ? 'notif-status-active' : 'notif-status-inactive'}">
                ${isSubscribed ? 'Avisos activos' : (caps.supported ? 'Avisos desactivados' : 'No disponible')}
              </span>
            </div>
            ${caps.supported ? (
              isSubscribed
                ? `<div class="notif-act-actions">
                     <button type="button" class="notif-btn notif-btn-danger" id="notif-btn-unsubscribe">Desactivar avisos</button>
                     <button type="button" class="notif-btn notif-btn-secondary" id="notif-btn-test">Aviso de prueba</button>
                   </div>`
                : `<button type="button" class="notif-btn notif-btn-primary" id="notif-btn-subscribe">Activar avisos en este dispositivo</button>`
            ) : ''}
          </div>
        </section>

        <section class="notif-section ${disabledAttr ? 'notif-disabled-section' : ''}">
          <h3 class="notif-section-title">Tipos de aviso</h3>
          <div class="notif-switch-list">
            <label class="notif-switch-item">
              <div class="notif-switch-text">
                <strong>Gente en el agua</strong>
                <span>Surfistas detectados por las cámaras en tus spots favoritos</span>
              </div>
              <input type="checkbox" id="notif-alert-gente" class="notif-toggle" ${currentPrefs.alerts.gente ? 'checked' : ''} ${disabledAttr}>
            </label>

            <label class="notif-switch-item">
              <div class="notif-switch-text">
                <strong>Olas ahora</strong>
                <span>Olas surfeables con calidad suficiente en este momento</span>
              </div>
              <input type="checkbox" id="notif-alert-olas-ahora" class="notif-toggle" ${currentPrefs.alerts.olas_ahora ? 'checked' : ''} ${disabledAttr}>
            </label>

            <label class="notif-switch-item">
              <div class="notif-switch-text">
                <strong>Olas por la tarde</strong>
                <span>Aviso matinal si mejoran las condiciones de 14 a 20 h</span>
              </div>
              <input type="checkbox" id="notif-alert-olas-tarde" class="notif-toggle" ${currentPrefs.alerts.olas_tarde ? 'checked' : ''} ${disabledAttr}>
            </label>

            <label class="notif-switch-item">
              <div class="notif-switch-text">
                <strong>Días buenos</strong>
                <span>Resumen diario al atardecer de jornadas con 4 o más estrellas</span>
              </div>
              <input type="checkbox" id="notif-alert-dias-buenos" class="notif-toggle" ${currentPrefs.alerts.dias_buenos ? 'checked' : ''} ${disabledAttr}>
            </label>
          </div>
        </section>

        <section class="notif-section ${disabledAttr ? 'notif-disabled-section' : ''}">
          <h3 class="notif-section-title">Spots a vigilar</h3>
          <p class="notif-section-desc">Selecciona las playas para las que deseas recibir alertas:</p>
          <div class="notif-spots-grid">
            ${allSpots.map((spot) => {
              const checked = selectedSpots.has(spot.id);
              return `
                <label class="notif-spot-chip ${checked ? 'notif-spot-chip-checked' : ''}">
                  <input type="checkbox" class="notif-spot-checkbox" data-spot="${spot.id}" ${checked ? 'checked' : ''} ${disabledAttr}>
                  <span>${spot.name}</span>
                </label>`;
            }).join('')}
          </div>
        </section>

        <section class="notif-section ${disabledAttr ? 'notif-disabled-section' : ''}">
          <h3 class="notif-section-title">Calidad mínima de olas</h3>
          <p class="notif-section-desc">Puntuación mínima necesaria para enviar una alerta:</p>
          <div class="notif-stars-selector">
            ${[2, 3, 4, 5].map((val) => `
              <button type="button" class="notif-star-btn ${currentPrefs.minStars === val ? 'on' : ''}" data-stars="${val}" ${disabledAttr}>
                ${val} estrellas
              </button>
            `).join('')}
          </div>
        </section>

        <section class="notif-section ${disabledAttr ? 'notif-disabled-section' : ''}">
          <h3 class="notif-section-title">Horas de silencio</h3>
          <p class="notif-section-desc">No se enviarán notificaciones dentro de esta franja horaria:</p>
          <div class="notif-quiet-hours">
            <label class="notif-quiet-label">
              <span>Desde las</span>
              <select id="notif-quiet-from" class="notif-select" ${disabledAttr}>
                ${Array.from({ length: 24 }, (_, i) => `<option value="${i}" ${currentPrefs.quiet.from === i ? 'selected' : ''}>${String(i).padStart(2, '0')}:00</option>`).join('')}
              </select>
            </label>
            <label class="notif-quiet-label">
              <span>Hasta las</span>
              <select id="notif-quiet-to" class="notif-select" ${disabledAttr}>
                ${Array.from({ length: 24 }, (_, i) => `<option value="${i}" ${currentPrefs.quiet.to === i ? 'selected' : ''}>${String(i).padStart(2, '0')}:00</option>`).join('')}
              </select>
            </label>
          </div>
        </section>

        <section class="notif-section ${disabledAttr ? 'notif-disabled-section' : ''}">
          <h3 class="notif-section-title">Límite diario</h3>
          <div class="notif-limit-selector">
            ${[1, 2, 3].map((num) => `
              <button type="button" class="notif-limit-btn ${currentPrefs.maxPerDay === num ? 'on' : ''}" data-limit="${num}" ${disabledAttr}>
                ${num} ${num === 1 ? 'aviso al día' : 'avisos al día'}
              </button>
            `).join('')}
          </div>
          <p class="notif-limit-hint">Avisamos solo cuando merece la pena</p>
        </section>

        <div id="notif-feedback" class="notif-feedback" aria-live="polite"></div>
      </div>
    </div>
  `;

  attachPanelEvents();
}

function showFeedback(text, isError = false) {
  const el = document.getElementById('notif-feedback');
  if (!el) return;
  el.textContent = text;
  el.className = 'notif-feedback ' + (isError ? 'notif-feedback-error' : 'notif-feedback-success');
  setTimeout(() => {
    if (el) el.textContent = '';
  }, 3500);
}

function attachPanelEvents() {
  if (!modalContainer) return;

  // Botón cerrar
  const closeBtn = document.getElementById('notif-close-btn');
  closeBtn?.addEventListener('click', closeNotificacionesPanel);

  // Cerrar al pulsar el fondo oscuro
  modalContainer.addEventListener('click', (e) => {
    if (e.target === modalContainer) closeNotificacionesPanel();
  });

  // Botón activar
  const subBtn = document.getElementById('notif-btn-subscribe');
  subBtn?.addEventListener('click', async () => {
    subBtn.disabled = true;
    subBtn.textContent = 'Activando…';
    const res = await subscribeUser();
    if (res.ok) {
      showFeedback('Notificaciones activadas correctamente.');
      renderNotificacionesPanel();
    } else {
      showFeedback(res.error || 'No se pudieron activar las notificaciones.', true);
      subBtn.disabled = false;
      subBtn.textContent = 'Activar avisos en este dispositivo';
    }
  });

  // Botón desactivar
  const unsubBtn = document.getElementById('notif-btn-unsubscribe');
  unsubBtn?.addEventListener('click', async () => {
    unsubBtn.disabled = true;
    unsubBtn.textContent = 'Desactivando…';
    await unsubscribeUser();
    showFeedback('Avisos desactivados.');
    renderNotificacionesPanel();
  });

  // Botón de prueba
  const testBtn = document.getElementById('notif-btn-test');
  testBtn?.addEventListener('click', async () => {
    testBtn.disabled = true;
    await sendTestNotification();
    showFeedback('Aviso de prueba enviado.');
    setTimeout(() => { testBtn.disabled = false; }, 2000);
  });

  // Cambios en los interruptores
  const toggleAlert = async (key, checked) => {
    currentPrefs.alerts[key] = checked;
    await sendPrefsUpdate(currentPrefs);
    showFeedback('Preferencias guardadas.');
  };

  document.getElementById('notif-alert-gente')?.addEventListener('change', (e) => toggleAlert('gente', e.target.checked));
  document.getElementById('notif-alert-olas-ahora')?.addEventListener('change', (e) => toggleAlert('olas_ahora', e.target.checked));
  document.getElementById('notif-alert-olas-tarde')?.addEventListener('change', (e) => toggleAlert('olas_tarde', e.target.checked));
  document.getElementById('notif-alert-dias-buenos')?.addEventListener('change', (e) => toggleAlert('dias_buenos', e.target.checked));

  // Cambios en spots
  modalContainer.querySelectorAll('.notif-spot-checkbox').forEach((chk) => {
    chk.addEventListener('change', async (e) => {
      const spotId = e.target.dataset.spot;
      const set = new Set(currentPrefs.spots);
      if (e.target.checked) set.add(spotId);
      else set.delete(spotId);
      currentPrefs.spots = [...set];
      e.target.closest('.notif-spot-chip')?.classList.toggle('notif-spot-chip-checked', e.target.checked);
      await sendPrefsUpdate(currentPrefs);
      showFeedback('Spots actualizados.');
    });
  });

  // Selector de estrellas
  modalContainer.querySelectorAll('.notif-star-btn').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const val = Number(btn.dataset.stars);
      currentPrefs.minStars = val;
      modalContainer.querySelectorAll('.notif-star-btn').forEach((b) => b.classList.toggle('on', b === btn));
      await sendPrefsUpdate(currentPrefs);
      showFeedback('Calidad mínima guardada.');
    });
  });

  // Selector de horas de silencio
  const quietFrom = document.getElementById('notif-quiet-from');
  const quietTo = document.getElementById('notif-quiet-to');
  const onQuietChange = async () => {
    if (quietFrom && quietTo) {
      currentPrefs.quiet = {
        from: Number(quietFrom.value),
        to: Number(quietTo.value)
      };
      await sendPrefsUpdate(currentPrefs);
      showFeedback('Horas de silencio guardadas.');
    }
  };
  quietFrom?.addEventListener('change', onQuietChange);
  quietTo?.addEventListener('change', onQuietChange);

  // Selector de límite diario
  modalContainer.querySelectorAll('.notif-limit-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const num = Number(btn.dataset.limit);
      currentPrefs.maxPerDay = num;
      modalContainer.querySelectorAll('.notif-limit-btn').forEach((b) => b.classList.toggle('on', b === btn));
      await sendPrefsUpdate(currentPrefs);
      showFeedback('Límite diario actualizado.');
    });
  });
}

export function openNotificacionesPanel() {
  renderNotificacionesPanel();
  modalContainer?.classList.remove('notif-hidden');
  document.body.classList.add('notif-modal-open');
}

export function closeNotificacionesPanel() {
  modalContainer?.classList.add('notif-hidden');
  document.body.classList.remove('notif-modal-open');
}

// ---------- Inicialización del servicio en el cliente ----------
export async function initNotificaciones() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return;

  // Comprobar suscripción existente de manera no intrusiva
  if ('serviceWorker' in navigator && 'PushManager' in window) {
    try {
      const reg = await navigator.serviceWorker.ready;
      activeSubscription = await reg.pushManager.getSubscription();
      if (!activeSubscription && currentSubId) {
        // La suscripción expiró o fue eliminada en el navegador
        NOTIF_STORAGE.setId(null);
        currentSubId = null;
      }
    } catch { /* continuar sin error */ }

    // Escuchar mensajes del service worker (por ejemplo en pushsubscriptionchange)
    navigator.serviceWorker.addEventListener('message', async (event) => {
      if (event.data?.type === 'PUSH_SUBSCRIPTION_CHANGED') {
        activeSubscription = event.data.subscription;
        if (WORKER_URL) {
          await subscribeUser(WORKER_URL);
        }
      }
    });
  }

  // Enlazar botón en cabecera si existe
  const btn = document.getElementById('btn-notif');
  btn?.addEventListener('click', () => {
    openNotificacionesPanel();
  });
}

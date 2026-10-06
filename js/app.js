// app.js — MeteoSurf_Cs: rutas, vistas y renderizado.
import { SPOTS, ZONES } from './spots.js';
import { loadForecast, loadRealtime, antiguedadRealtime, nowIndex, tideExtremes, compass, RATINGS, norm360, windState } from './forecast.js';
import { compassSVG, dirArrow } from './compass.js';
import { loadCams, camsForSpot, playCam, stopCam, playClip, recordClip } from './cams.js';

const $ = (sel, root = document) => root.querySelector(sel);
const view = $('#view');
const state = { fc: null, realtime: null, rewinds: null, zone: 'all', dayIdx: 0, camIdx: 0, spotId: null };

// Asistente de previsión (se carga aparte para no retrasar el primer pintado)
let aiMod = null;
const assistant = () => (aiMod ??= import('./assistant.js'));

// ---------- Preferencias ----------
const store = {
  get(k, d) { try { const v = localStorage.getItem('msc_' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('msc_' + k, JSON.stringify(v)); } catch { /* sin almacenamiento */ } }
};
const DEFAULT_FAVS = ['Planetario', 'Voramar', 'MorroGos', 'Palaciet'];
const savedFavs = store.get('favs', null);
// Una sola vez: sin favoritos guardados (o lista vacía antigua) se cargan los 4 de Jordi; luego se respeta lo que elija
const favsInit = !store.get('favsInit', false) && (!Array.isArray(savedFavs) || !savedFavs.length);
const favs = new Set(favsInit ? DEFAULT_FAVS : savedFavs || []);
if (favsInit) store.set('favs', [...favs]);
store.set('favsInit', true);
const toggleFav = (id) => { favs.has(id) ? favs.delete(id) : favs.add(id); store.set('favs', [...favs]); };

// Planetario siempre primero; el resto en el orden de la costa
const DEFAULT_SPOT = 'Planetario';
const ordered = () => [...SPOTS].sort((a, b) => (b.id === DEFAULT_SPOT) - (a.id === DEFAULT_SPOT));
const favoriteSpots = () => [...favs].map((id) => SPOTS.find((s) => s.id === id)).filter(Boolean);

// ---------- Formato ----------
const m = (x) => (x == null || isNaN(x) ? '–' : x.toFixed(1));
const range = (s) => {
  if (!s || s.min == null || s.max == null || isNaN(s.min) || isNaN(s.max)) return '–';
  const a = Math.max(0, Math.round(s.min * 10) / 10), b = Math.round(s.max * 10) / 10;
  if (b < 0.2) return '0–0.2';
  return a === b ? `${a}` : `${a}–${b}`;
};
const kmh = (x) => (x == null || isNaN(x) ? '–' : Math.round(x) + ' km/h');
const rnd = (x) => (x == null || isNaN(x) ? '–' : Math.round(x));
const DOW = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MON = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const dayName = (date, i) => {
  const d = new Date(date + 'T12:00:00');
  return i === 0 ? 'Hoy' : i === 1 ? 'Mañana' : DOW[d.getDay()];
};
const dayShort = (date) => { const d = new Date(date + 'T12:00:00'); return `${d.getDate()} ${MON[d.getMonth()]}`; };
const ratingCls = (r) => (r == null || isNaN(r) ? 'r-na' : `r${r}`);
const ratingLabel = (r) => (r == null || isNaN(r) ? 'Sin datos' : (RATINGS[r]?.label ?? '–'));
const goodDay = (d) => d?.rating != null && Number(d.rating) >= 5;
const goodLabel = (r) => Number(r) >= 6 ? 'Día muy bueno' : 'Día bueno';
const hClass = (h) => (h == null || isNaN(h) ? 'hc0' : `hc${h < 0.2 ? 0 : h < 0.4 ? 1 : h < 0.6 ? 2 : h < 0.9 ? 3 : h < 1.3 ? 4 : h < 2 ? 5 : 6}`);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ICON = {
  star: '<svg class="icon" viewBox="0 0 24 24"><path d="M6 3h12v18l-6-4-6 4z"/></svg>',
  back: '<svg class="icon" viewBox="0 0 24 24" style="width:18px;height:18px"><path d="M15 18l-6-6 6-6"/></svg>',
  wave: '<svg class="icon" viewBox="0 0 24 24" style="width:16px;height:16px"><path d="M2 12c3 0 3-3 6-3s3 3 6 3 3-3 6-3M2 17c3 0 3-3 6-3s3 3 6 3 3-3 6-3"/></svg>',
  wind: '<svg class="icon" viewBox="0 0 24 24" style="width:16px;height:16px"><path d="M3 8h11a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h8"/></svg>',
  cam: '<svg class="icon" viewBox="0 0 24 24" style="width:16px;height:16px"><path d="M15 10l5-3v10l-5-3M3 7h12v10H3z"/></svg>'
};

const WIND_SHORT = { glassy: 'Calma', offshore: 'Terral', crossoff: 'T.cruz', cross: 'Cruz', crosson: 'M.cruz', onshore: 'Mar' };

// ---------- Observaciones de Puertos del Estado ----------
const realNumber = (v, min, max) => Number.isFinite(v) && v >= min && v <= max;
const realValue = (v, unit, decimals = 1, min = 0, max = 100) =>
  realNumber(v, min, max) ? `${v.toLocaleString('es-ES', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} ${unit}` : 'Sin dato';
function realStatus(obs) {
  const age = antiguedadRealtime(obs);
  const stale = age == null || age > 180 || obs?.obsoleto === true;
  const elapsed = age == null ? 'Sin fecha válida' : age < 1 ? 'hace menos de 1 min'
    : age < 60 ? `hace ${Math.floor(age)} min` : `hace ${Math.floor(age / 60)} h${Math.floor(age % 60) ? ` ${Math.floor(age % 60)} min` : ''}`;
  return { stale, label: obs ? `${elapsed}${stale ? ' · dato antiguo o no válido' : ''}` : 'Sin datos disponibles' };
}
function realDirection(obs) {
  return realNumber(obs?.direccion_grados, 0, 360) ? `${compass(obs.direccion_grados)} ${Math.round(obs.direccion_grados)}°` : 'dirección sin dato';
}
function realSource(obs, spot) {
  if (!obs) return '';
  let distance = '';
  if (spot && realNumber(obs.lat, -90, 90) && realNumber(obs.lon, -180, 180)) {
    const rad = Math.PI / 180;
    const a = Math.sin((obs.lat - spot.lat) * rad / 2) ** 2 + Math.cos(spot.lat * rad) * Math.cos(obs.lat * rad) * Math.sin((obs.lon - spot.lon) * rad / 2) ** 2;
    const km = 12742 * Math.asin(Math.sqrt(Math.min(1, a)));
    distance = ` · a ${Math.max(1, Math.round(km))} km del spot`;
  } else if (realNumber(obs.distancia_km, 0, 20000)) {
    distance = ` · a ${Math.round(obs.distancia_km)} km de Castellón`;
  }
  return esc(`${String(obs.estacion || 'Estación de Puertos del Estado').replace('Mareografo', 'Mareógrafo')}${distance}`);
}
function realComparison(spot, obs) {
  if (realStatus(obs).stale || !realNumber(obs?.altura_m, 0, 20) || state.fc?.stale) return '';
  // Open-Meteo devuelve horas civiles de Madrid, incluso si el visitante está en otra zona.
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23'
  }).formatToParts(new Date(obs.fecha)).map((p) => [p.type, p.value]));
  const key = `${parts.year}-${parts.month}-${parts.day}T${parts.hour}`;
  const matching = state.fc?.spots[spot.id]?.hours.filter((h) => h.time.slice(0, 13) === key) || [];
  // Sin coincidencia (o con hora duplicada por cambio de hora), no inventar comparación.
  if (matching.length !== 1 || !realNumber(matching[0].waveHeight, 0, 20)) return '';
  return `<p class="realtime-compare">${parts.hour}:00 · Previsto ${realValue(matching[0].waveHeight, 'm', 1, 0, 20)}, real ${realValue(obs.altura_m, 'm', 1, 0, 20)}<span>Oleaje mar adentro del spot frente a la boya; son lugares distintos.</span></p>`;
}
function realtimeCard(spot) {
  const wave = state.realtime?.oleaje?.principal;
  const wind = state.realtime?.viento;
  const sea = state.realtime?.nivel_mar;
  const row = (label, obs, valid, values) => {
    const status = realStatus(obs);
    return `<div class="realtime-row${status.stale || !valid ? ' is-stale' : ''}"><div class="realtime-row-top"><b>${label}</b><span>${esc(status.label)}</span></div>
      <div class="realtime-values">${valid ? values : 'Sin datos disponibles'}</div>${obs ? `<div class="realtime-source">${realSource(obs, spot)}</div>` : ''}</div>`;
  };
  return `<section class="card realtime-card" aria-label="Datos reales ahora"><h2>Datos reales ahora</h2>
    <p class="realtime-credit"><a href="https://portus.puertos.es/" target="_blank" rel="noopener">Puertos del Estado</a> · observaciones cercanas</p>
    ${row('Boya', wave, realNumber(wave?.altura_m, 0, 20), `<strong>${realValue(wave?.altura_m, 'm', 1, 0, 20)}</strong> · ${realValue(wave?.periodo_s, 's', 1, 0, 30)} · ${realDirection(wave)}`)}
    ${row('Viento real', wind, realNumber(wind?.velocidad_ms, 0, 75), `<strong>${realValue(wind?.velocidad_ms * 3.6, 'km/h', 0, 0, 270)}</strong> · racha ${realValue(wind?.racha_ms == null ? null : wind.racha_ms * 3.6, 'km/h', 0, 0, 360)} · ${realDirection(wind)}`)}
    ${row('Nivel del mar', sea, realNumber(sea?.nivel_m, -3, 5), `<strong>${realValue(sea?.nivel_m, 'm', 2, -3, 5)}</strong> · referencia del mareógrafo`)}
    ${realComparison(spot, wave)}
  </section>`;
}
function realtimeLine() {
  const wave = state.realtime?.oleaje?.principal;
  const status = realStatus(wave);
  const valid = realNumber(wave?.altura_m, 0, 20);
  return `<p class="realtime-line${status.stale || !valid ? ' is-stale' : ''}"><b>${esc(wave?.estacion || 'Boya')}</b> · ${valid ? `${realValue(wave.altura_m, 'm', 1, 0, 20)} · ${realValue(wave.periodo_s, 's', 1, 0, 30)} · ${realDirection(wave)}` : 'Sin datos disponibles'}<span>${esc(status.label)}${wave ? ` · ${realNumber(wave.distancia_km, 0, 20000) ? `${Math.round(wave.distancia_km)} km de Castellón · ` : ''}Puertos del Estado` : ''}</span></p>`;
}
function updateRealtime() {
  document.querySelectorAll('[data-realtime-spot]').forEach((el) => {
    const spot = SPOTS.find((s) => s.id === el.dataset.realtimeSpot);
    if (spot) el.innerHTML = realtimeCard(spot);
  });
  document.querySelectorAll('[data-realtime-list]').forEach((el) => { el.innerHTML = realtimeLine(); });
}

function toast(t) {
  const el = document.createElement('div');
  el.className = 'toast'; el.textContent = t;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

// ---------- Rutas ----------
function route() {
  const h = location.hash.replace(/^#\/?/, '');
  const [page, arg] = h.split('/');
  if (page !== 'spot') state.spotId = null;
  document.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('active', a.dataset.nav === (page || 'hoy')));
  renderQuickSpots();
  const savedClip = $('#save-clip');
  if (savedClip?.dataset.url) URL.revokeObjectURL(savedClip.dataset.url);
  document.querySelectorAll('.cam').forEach(stopCam);
  if (page === 'spot' && arg) return renderSpot(decodeURIComponent(arg));
  if (page === 'mapa') return renderMap();
  if (page === 'camaras') return renderCams();
  if (page === 'asistente') return renderAssistant();
  if (page === 'favoritos') { state.zone = 'fav'; return renderHome(); }
  if (state.zone === 'fav' && page !== 'favoritos') state.zone = 'all';
  return renderHome();
}

// ---------- Portada: lista regional ----------
function renderHome() {
  document.title = 'MeteoSurf_Cs · Previsión de surf en Castellón';
  const fc = state.fc;
  const zones = [['all', 'Todos'], ['fav', 'Favoritos'], ['cams', 'Con cámara'], ['offshore', 'Terral ahora'], ...ZONES.map((z) => [z.id, z.name])];
  const spots = (state.zone === 'fav' ? favoriteSpots() : ordered()).filter((s) => {
    if (state.zone === 'all') return true;
    if (state.zone === 'fav') return favs.has(s.id);
    if (state.zone === 'cams') return camsForSpot(s).length > 0;
    if (state.zone === 'offshore') {
      const sh = fc?.spots[s.id]?.hours[nowIndex(fc.spots[s.id].hours)];
      return sh && (sh.wind.key === 'offshore' || sh.wind.key === 'crossoff' || sh.wind.key === 'glassy');
    }
    return s.zone === state.zone;
  });

  view.innerHTML = `
    ${fc?.stale ? `<div class="banner">Sin conexión con el servicio de previsión. Mostrando la última previsión guardada (${new Date(fc.fetchedAt).toLocaleString('es-ES')}).</div>` : ''}
    <div class="region-head">
      <div>
        <h1>Costa de Castellón</h1>
        <p>${fc ? `Actualizado ${new Date(fc.fetchedAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} · ` : ''}${SPOTS.length} spots · previsión a 16 días</p>
      </div>
    </div>

    ${state.zone === 'fav' ? '' : '<div id="region-report" style="margin-bottom:14px"><div class="skeleton" style="height:64px"></div></div>'}
    <div class="chips" role="tablist">${zones.map(([id, n]) => `<button class="chip btn ${state.zone === id ? 'on' : ''}" data-zone="${id}">${n}</button>`).join('')}</div>
    <div class="section-title">Ahora mismo<span class="spacer"></span><span class="faint" style="text-transform:none;letter-spacing:0;font-weight:600">Próximos 7 días</span></div>
    ${state.zone === 'fav' ? `<div data-realtime-list>${realtimeLine()}</div>` : ''}
    <div class="spot-grid">${spots.length ? [...new Set(spots.map((s) => s.zone))].map((zone) => `<h2 class="zone-heading">${esc(ZONES.find((z) => z.id === zone)?.name || zone)}</h2>${spots.filter((s) => s.zone === zone).map(spotCard).join('')}`).join('') : `<div class="card pad muted">${state.zone === 'fav' ? 'Aún no tienes favoritos. Pulsa el marcador de un spot para añadirlo.' : 'No hay spots en esta zona.'}</div>`}</div>
    ${footer()}`;

  if (state.zone === 'fav') {
    view.querySelector('#region-report')?.remove();
    const heading = view.querySelector('.section-title');
    if (heading) heading.innerHTML = 'Mis spots<span class="spacer"></span><span class="faint" style="text-transform:none;letter-spacing:0;font-weight:600">Ahora + mejor franja de hoy</span>';
  }

  if (state.zone === 'fav' && spots.length) {
    const grid = view.querySelector('.spot-grid');
    if (grid) grid.outerHTML = favoriteComparison(spots);
  }

  view.querySelectorAll('[data-zone]').forEach((b) => b.addEventListener('click', () => {
    state.zone = b.dataset.zone;
    if (location.hash.startsWith('#/favoritos') && state.zone !== 'fav') history.replaceState(null, '', '#/');
    renderHome();
  }));
  bindFavs();
  if (fc && state.zone !== 'fav') assistant().then((ai) => { const el = $('#region-report'); if (el) el.innerHTML = reportBox(ai, SPOTS, ai.regionReport(fc, SPOTS) + '<p><a href="#/asistente">Preguntar al asistente</a></p>'); })
    .catch(() => $('#region-report')?.remove());
  else $('#region-report')?.remove();
}

// Parte plegable: titular de una línea con la mejor ventana y el texto completo al desplegar
function bestWindowToday(f) {
  const day = f?.days?.[0];
  if (!day?.hours?.length) return null;
  const daylight = day.hours.filter((h) => h.hour >= 7 && h.hour <= 20);
  const pool = (daylight.length ? daylight : day.hours).filter((h) => h.rating != null && !isNaN(h.rating));
  if (!pool.length) return null;
  const bestRating = Math.max(...pool.map((h) => h.rating));
  if (bestRating < 2) return null;
  const best = pool.filter((h) => h.rating === bestRating)
    .reduce((a, b) => ((b.surf?.mid ?? 0) > (a.surf?.mid ?? 0) ? b : a));
  const bestPos = pool.indexOf(best);
  let first = bestPos;
  let last = bestPos;
  while (first > 0 && pool[first - 1].rating === bestRating) first--;
  while (last < pool.length - 1 && pool[last + 1].rating === bestRating) last++;
  return { best, from: pool[first].hour, to: pool[last].hour + 1 };
}

function renderQuickSpots() {
  const nav = $('#quick-spots');
  if (!nav) return;
  const spots = favoriteSpots();
  nav.innerHTML = spots.map((s) => `<a href="#/spot/${encodeURIComponent(s.id)}" class="quick-spot ${state.spotId === s.id ? 'active' : ''}" aria-label="Abrir previsión de ${esc(s.name)}"${state.spotId === s.id ? ' aria-current="page"' : ''}><span>${esc(s.name)}</span></a>`).join('');
  nav.setAttribute('aria-label', spots.length ? 'Mis spots' : 'Spots favoritos');
}

function favoriteComparison(spots) {
  return `<div class="fav-comparison" aria-label="Comparativa de mis spots">${spots.map((s) => {
    const f = state.fc?.spots[s.id];
    const h = f?.hours?.[nowIndex(f.hours)];
    const sw = h?.swells?.[0];
    const win = bestWindowToday(f);
    return `<article class="card fav-row">
      <a class="fav-row-head" href="#/spot/${encodeURIComponent(s.id)}"><strong>${esc(s.name)}</strong><span>${esc(s.zoneName)}</span></a>
      ${h ? `<div class="fav-now" aria-label="Condiciones actuales">
        <div><span>Altura</span><b class="num">${range(h.surf)} m</b></div>
        <div><span>Periodo</span><b class="num">${h.wavePeriod ? Math.round(h.wavePeriod) + ' s' : '–'}</b></div>
        <div><span>Dirección</span><b>${sw ? `${dirArrow(sw.dir)} ${compass(sw.dir)}` : '–'}</b></div>
        <div><span>Viento</span><b>${h.windSpeed != null && !isNaN(h.windSpeed) ? Math.round(h.windSpeed) + ' km/h' : '–'} <em class="wind-tag wind-${h.wind?.key ?? 'na'}">${esc(h.wind?.label ?? '–')}</em></b></div>
        <div><span>Calidad</span><b class="rating-pill ${ratingCls(h.rating)}">${ratingLabel(h.rating)}</b></div>
      </div>
      <div class="fav-best"><span>Mejor franja de hoy</span><strong>${win ? `${String(win.from).padStart(2, '0')}:00–${String(win.to).padStart(2, '0')}:00 · ${range(win.best.surf)} m · ${esc(win.best.wind.label.toLowerCase())}` : 'Sin datos'}</strong></div>` : '<div class="fav-loading">Cargando previsión…</div>'}
    </article>`;
  }).join('')}</div>`;
}

function reportBox(ai, spots, fullHtml) {
  const fc = state.fc;
  const wins = ai.bestWindows(fc, spots, { days: 4, minRating: 3 });
  let head = '<b>Sin ventana clara en 4 días</b><span>Mar pequeño o viento de mar</span>';
  let pill = '';
  if (wins.length) {
    const top = wins[0].rating;
    const same = wins.filter((w) => w.rating === top)
      .sort((a, b) => (a.date === b.date ? a.from - b.from : a.date < b.date ? -1 : 1));
    const w = same[0];
    const f0 = fc.spots[w.spotId];
    const di = f0.days.findIndex((d) => d.date === w.date);
    const names = [...new Set(same.filter((x) => x.date === w.date && x.from === w.from).map((x) => SPOTS.find((s) => s.id === x.spotId)?.name))];
    const where = spots.length > 1 ? `${names.slice(0, 2).join(', ')}${names.length > 2 ? ` y ${names.length - 2} más` : ''} · ` : '';
    head = `<b>Mejor ventana: ${dayName(w.date, di)} ${w.from}–${w.to} h</b><span>${esc(where)}${range({ min: w.surfMin, max: w.surfMax })} m · ${esc(w.windLabel.toLowerCase())}</span>`;
    pill = `<span class="rating-pill ${ratingCls(top)}">${ratingLabel(top)}</span>`;
  }
  return `<details class="card report-box"><summary><div class="rh">${head}</div>${pill}<svg class="icon chev" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg></summary>
    <div class="report">${fullHtml}</div></details>`;
}

// ---------- Asistente ----------
const chat = [];
async function renderAssistant() {
  document.title = 'Asistente · MeteoSurf_Cs';
  const ctx = { spotId: state.spotId };
  view.innerHTML = `<div class="region-head"><div><h1>Asistente de previsión</h1>
      <p>Pregunta cuándo y dónde surfear. Responde con la previsión actual de los ${SPOTS.length} spots.</p></div></div>
    <div class="chat card" id="chat"></div>
    <div class="chips" id="sugg" style="margin:12px 0"></div>
    <form class="ask" id="ask" autocomplete="off">
      <input id="q" type="text" enterkeyhint="send" placeholder="Ej.: ¿cuándo hay olas esta semana en Gurugú?" aria-label="Pregunta">
      <button type="submit" class="ask-btn" aria-label="Enviar"><svg class="icon" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button>
    </form>${footer()}`;
  const box = $('#chat');
  let ai;
  try { ai = await assistant(); } catch { box.innerHTML = '<div class="pad muted">El asistente no está disponible.</div>'; return; }
  const draw = () => {
    box.innerHTML = chat.length ? chat.map((m) => `<div class="msg ${m.who}">${m.html}</div>`).join('')
      : `<div class="msg bot">${state.fc ? ai.regionReport(state.fc, SPOTS) : 'Cargando la previsión…'}</div>`;
    box.scrollTop = box.scrollHeight;
  };
  const ask = (q) => {
    if (!q.trim() || !state.fc) return;
    chat.push({ who: 'me', html: esc(q) });
    let html;
    try { html = ai.answer(q, state.fc, SPOTS, ctx); } catch (e) { html = 'No he podido calcular la respuesta.'; }
    chat.push({ who: 'bot', html });
    draw();
  };
  $('#sugg').innerHTML = ai.suggestions(ctx).map((q) => `<button class="chip btn" type="button">${esc(q)}</button>`).join('');
  $('#sugg').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => ask(b.textContent)));
  $('#ask').addEventListener('submit', (e) => { e.preventDefault(); const q = $('#q').value; $('#q').value = ''; ask(q); });
  draw();
}

function spotCard(s) {
  const f = state.fc?.spots[s.id];
  const h = f ? f.hours[nowIndex(f.hours)] : null;
  const cam = camsForSpot(s)[0];
  const sw = h?.swells[0];
  return `<a class="card spot-card ${h ? ratingCls(h.rating) : ''}" href="#/spot/${encodeURIComponent(s.id)}">
    <div class="body">
      <div class="top">
        <div style="min-width:0;flex:1">
          <div class="name">${esc(s.name)}${cam ? ' <span class="cam-dot" title="Cámara en directo">' + ICON.cam + '</span>' : ''}</div>
          <div class="zone">${esc(s.zoneName)}</div>
          ${h ? `<div class="height num">${range(h.surf)}<small> m</small> <span class="rating-pill ${ratingCls(h.rating)}" style="font-size:10px">${ratingLabel(h.rating)}</span></div><div class="human">${surfWords(h.surf.mid)}</div>` : '<div class="human">Previsión no disponible</div>'}
        </div>
        <button class="fav-btn fav ${favs.has(s.id) ? 'on' : ''}" data-fav="${esc(s.id)}" aria-label="Favorito">${ICON.star}</button>
      </div>
      ${h ? `<div class="meta">
          <span title="Mar de fondo">${ICON.wave}${m(sw?.h)} m · ${sw?.t ? Math.round(sw.t) + ' s' : '–'} ${dirArrow(sw?.dir)} ${compass(sw?.dir)}</span>
          <span title="Viento">${ICON.wind}${h.windSpeed != null && !isNaN(h.windSpeed) ? Math.round(h.windSpeed) + ' km/h' : '–'} ${dirArrow(h.windDir)} <span class="wind-tag wind-${h.wind?.key ?? 'na'}">${esc(h.wind?.label ?? '–')}</span></span>
        </div>
        <div class="spark" title="Próximos 7 días">${f.days.slice(0, 7).map((d, i) => `<div><i class="${ratingCls(d.rating)}"></i><span>${dayName(d.date, i).slice(0, 3)}</span></div>`).join('')}</div>` : ''}
    </div></a>`;
}

function bindFavs() {
  view.querySelectorAll('[data-fav]').forEach((b) => b.addEventListener('click', (e) => {
    e.preventDefault(); e.stopPropagation();
    toggleFav(b.dataset.fav);
    b.classList.toggle('on', favs.has(b.dataset.fav));
    toast(favs.has(b.dataset.fav) ? 'Añadido a favoritos' : 'Quitado de favoritos');
    if (state.zone === 'fav' && !location.hash.startsWith('#/spot')) renderHome();
  }));
}

function clipsForSpot(spot) {
  const ids = new Set(camsForSpot(spot).map((c) => c.id));
  const seen = new Set();
  return (state.rewinds?.rewinds || []).filter((c) => {
    if (!ids.has(c.camara) || seen.has(c.url) || !/^https:\/\//.test(c.url) || !Number.isFinite(Date.parse(c.hora))) return false;
    seen.add(c.url); return true;
  }).sort((a, b) => Date.parse(b.hora) - Date.parse(a.hora));
}
const madridDate = (date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
const clipTime = (date) => new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit' }).format(date);
function renderRewinds(spot) {
  const clips = clipsForSpot(spot);
  const today = madridDate(new Date());
  const yesterday = madridDate(new Date(Date.now() - 86400000));
  const groups = new Map();
  clips.forEach((c, i) => {
    const day = madridDate(new Date(c.hora));
    if (!groups.has(day)) groups.set(day, []);
    groups.get(day).push({ c, i });
  });
  return `<div id="rewind-strip" class="rewind-strip" hidden>${clips.length ? [...groups].map(([day, entries]) => `<section class="rewind-day"><h3>${day === today ? 'Hoy' : day === yesterday ? 'Ayer' : new Date(entries[0].c.hora).toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid', day: 'numeric', month: 'long' })}</h3><div class="clip-hours">${entries.map(({ c, i }) => `<button data-clip="${i}" title="${esc(c.camaraNombre || c.camaraCorta)}">${clipTime(new Date(c.hora))}</button>`).join('')}</div></section>`).join('') : '<p>Aún no hay clips guardados de las cámaras de este spot.</p>'}</div>`;
}
function bindClips(spot, camEl, showCam) {
  const clips = clipsForSpot(spot);
  const record = $('#record-clip'), status = $('#record-status'), save = $('#save-clip');
  $('#rewind-toggle').addEventListener('click', (e) => {
    const strip = $('#rewind-strip'); strip.hidden = !strip.hidden;
    e.currentTarget.setAttribute('aria-expanded', String(!strip.hidden));
  });
  $('#live-cam').addEventListener('click', showCam);
  view.querySelectorAll('[data-clip]').forEach((b) => b.addEventListener('click', () => {
    const clip = clips[Number(b.dataset.clip)];
    status.textContent = '';
    playClip(camEl, clip);
    view.querySelectorAll('[data-clip]').forEach((x) => x.classList.toggle('on', x === b));
    $('#live-cam').hidden = false; record.hidden = true;
    const info = $('#clip-info'), p = clip.prevision || {};
    info.hidden = false;
    info.innerHTML = `<b>Rewind · ${esc(new Date(clip.hora).toLocaleString('es-ES', { timeZone: 'Europe/Madrid', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }))}</b><p>${esc(clip.camaraNombre || clip.camaraCorta || '')}</p><p>Previsión de ese momento: ${m(p.altura)} m · ${rnd(p.periodo)} s · ${esc(p.direccionTxt || 'Sin dirección')} · viento ${kmh(p.viento)} ${esc(p.vientoDireccionTxt || '')} · rachas ${kmh(p.vientoRacha)}</p><a href="${esc(clip.url)}" target="_blank" rel="noopener" download>Descargar</a>`;
  }));
  record.addEventListener('click', async () => {
    record.disabled = true; save.hidden = true;
    try {
      const result = await recordClip(camEl, 20, (left) => { status.textContent = `Grabando · ${left} s`; });
      if (!camEl.isConnected) return;
      const stamp = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date()).replace(/[-:]/g, '').replace(' ', '-');
      const url = URL.createObjectURL(result.blob);
      if (save.dataset.url) URL.revokeObjectURL(save.dataset.url);
      save.dataset.url = url; save.href = url;
      save.download = `MeteoSurf_${spot.id}_${stamp}.${result.extension}`;
      save.hidden = false; save.click(); status.textContent = 'Clip listo para guardar.';
    } catch (e) { if (status.isConnected) status.textContent = e.message; }
    finally { record.disabled = false; }
  });
}
function nearbySpots(spot) {
  return SPOTS.filter((s) => s.id !== spot.id).sort((a, b) => Math.hypot(a.lat - spot.lat, a.lon - spot.lon) - Math.hypot(b.lat - spot.lat, b.lon - spot.lon)).slice(0, 5).map((s) => {
    const f = state.fc?.spots[s.id], h = f?.hours[nowIndex(f.hours)];
    return `<a href="#/spot/${encodeURIComponent(s.id)}" class="${ratingCls(h?.rating)}"><b>${esc(s.name)}</b><strong class="num">${range(h?.surf)} m</strong><span class="rating-pill ${ratingCls(h?.rating)}">${ratingLabel(h?.rating)}</span></a>`;
  }).join('');
}
function windChart(day) {
  const hours = day.hours, max = Math.max(10, ...hours.map((h) => h.windSpeed || 0));
  const x = (hour) => 24 + hour * 13.6;
  const y = (speed) => 76 - speed / max * 60;
  let path = '', open = false;
  hours.forEach((h) => { if (h.windSpeed == null) { open = false; return; } path += `${open ? 'L' : 'M'}${x(h.hour)} ${y(h.windSpeed)} `; open = true; });
  return `<svg class="chart" viewBox="0 0 360 105" role="img" aria-label="Viento por horas en kilómetros por hora"><path d="${path}" fill="none" stroke="var(--text-2)" stroke-width="1.8"/>${hours.filter((h) => h.hour % 3 === 0).map((h) => `<text x="${x(h.hour)}" y="${h.windSpeed == null ? 60 : y(h.windSpeed) - 7}" text-anchor="middle" font-size="10" fill="var(--text)">${rnd(h.windSpeed)}</text><text x="${x(h.hour)}" y="100" text-anchor="middle" font-size="10" fill="var(--text-2)">${h.hour}h</text>`).join('')}</svg>`;
}

// ---------- Página de spot ----------
function renderSpot(id) {
  const spot = SPOTS.find((s) => s.id === id);
  if (!spot) { location.hash = '#/'; return; }
  if (state.spotId !== id) { state.dayIdx = 0; state.camIdx = 0; state.spotId = id; }
  renderQuickSpots();
  document.title = `${spot.name} · MeteoSurf_Cs`;
  const f = state.fc?.spots[id];
  const cams = camsForSpot(spot);
  const ni = f ? nowIndex(f.hours) : 0;
  const h = f?.hours[ni];
  let bestDayIdx = 0;
  if (f) {
    let maxR = -1;
    f.days.forEach((d, i) => { if (d.rating != null && d.rating > maxR) { maxR = d.rating; bestDayIdx = i; } });
  }
  
  const isSwellOpt = h && h.swells[0] && (() => {
    let a = norm360(spot.swellWindow[0]), b = norm360(spot.swellWindow[1]), d = norm360(h.swells[0].dir);
    return a <= b ? (d >= a && d <= b) : (d >= a || d <= b);
  })();
  const isWindOpt = h && (h.wind.key === 'offshore' || h.wind.key === 'crossoff');

  view.innerHTML = `
    <a class="back" href="#/">${ICON.back} Costa de Castellón</a>
    <div class="spot-head">
      <div><h1>${esc(spot.name)}</h1><div class="sub">${esc(spot.zoneName)}</div></div>
      <button class="fav-btn ${favs.has(id) ? 'on' : ''}" data-fav="${esc(id)}" style="background:var(--surface-2);color:var(--text-2)" aria-label="Favorito">${ICON.star}</button>
    </div>
    <nav class="subnav" aria-label="Secciones del spot">
      <a href="#s-ahora" data-jump="s-ahora">Ahora</a><a href="#s-prevision" data-jump="s-prevision">Previsión</a>
      <a href="#s-tendencia" data-jump="s-tendencia">16 días</a><a href="#s-spot" data-jump="s-spot">Spot</a>
    </nav>
    <div class="spot-layout">
      <div class="a-cam">
        <div class="cam" id="cam"></div>
        ${cams.length > 1 ? `<div class="cam-switch">${cams.map((c, i) => `<button data-cam="${i}" class="${i === state.camIdx ? 'on' : ''}">${ICON.cam} ${esc(c.short || c.name)}</button>`).join('')}</div>` : ''}
        <div class="cam-source" id="cam-source"></div>
        <div class="cam-actions"><button id="rewind-toggle" aria-expanded="false" aria-controls="rewind-strip">Rewind</button><button id="record-clip" hidden>Grabar clip</button><button id="live-cam" hidden>Volver al directo</button></div>
        ${renderRewinds(spot)}<div id="clip-info" class="clip-info" hidden></div><p id="record-status" class="record-status" role="status"></p><a id="save-clip" class="save-clip" hidden>Guardar clip</a>
      </div>
      <div class="a-now" id="s-ahora">
        ${h ? nowPanel(spot, f, h) : loadingBlock()}
        <details><summary>Observaciones reales cercanas</summary><div data-realtime-spot="${esc(id)}">${realtimeCard(spot)}</div></details>
        <div id="spot-report" style="margin-top:12px"><div class="skeleton" style="height:56px"></div></div>
      </div>
      <div class="a-fc">
        ${f ? `
        <div class="section-title" id="s-prevision">Previsión por horas</div>
        <div class="days">${f.days.map((d, i) => `<button class="day ${i === state.dayIdx ? 'on' : ''} ${goodDay(d) ? `good-day ${ratingCls(d.rating)}` : ''}" data-day="${i}">
          ${i === bestDayIdx ? '<span class="day-badge-watch">MEJOR</span>' : ''}
          <div class="dn">${dayName(d.date, i)}</div><div class="dd">${dayShort(d.date)}</div>
          ${goodDay(d) ? `<span class="good-day-label">${goodLabel(d.rating)}</span>` : ''}<div class="dh num">${range({ min: d.surfMin, max: d.surfMax })}<small> m</small></div><span class="rating-pill ${ratingCls(d.rating)}">${ratingLabel(d.rating)}</span>
          <div class="rating-bar ${ratingCls(d.rating)}"></div></button>`).join('')}</div>
        <div class="card pad chart-wrap" style="margin-top:10px">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap">
            <b id="chart-title"></b><span class="faint" style="font-size:12px">Altura en rompiente (m) · color = calidad · flechas = viento</span></div>
          <div id="chart"></div>
        </div>
        <h3>Viento por horas · km/h</h3><div id="wind-chart"></div><h3>Marea · nivel del mar</h3><div class="tide" id="tide"></div><details><summary>Ver tabla horaria</summary><div class="ftable-wrap" id="ftable"></div></details>
        <div class="section-title" id="s-tendencia">Tendencia · días 5 a 16<span class="spacer"></span><span class="faint" style="text-transform:none;letter-spacing:0;font-weight:600">fiabilidad decreciente</span></div>
        <div class="card" id="longrange"></div>` : loadingBlock()}
      </div>
      <div class="a-side" id="s-spot">
        <h2>Spots cercanos</h2><div class="nearby">${nearbySpots(spot)}</div><details><summary>Ficha del spot y orientación</summary><div class="section-title">Orientación y condiciones ideales</div>
        <div class="card pad compass-card">
          ${compassSVG(spot, { swellDir: h?.swells[0]?.dir, windDir: h?.windDir })}
          <div class="legend">
            <div class="match-chips" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">
              ${isSwellOpt ? '<span class="chip-match on">Mar dentro de ventana</span>' : '<span class="chip-match off">Mar fuera de ventana</span>'}
              ${isWindOpt ? '<span class="chip-match on">Viento terral</span>' : ''}
            </div>
            <div><i style="background:rgba(0,163,196,.6)"></i>Mar útil: ${compass(spot.swellWindow[0])} a ${compass(spot.swellWindow[1])} (${Math.round(norm360(spot.swellWindow[0]))}°–${Math.round(norm360(spot.swellWindow[1]))}°)</div>
            <div><i style="background:rgba(26,214,76,.6)"></i>Terral: ${compass(spot.facing + 135)} a ${compass(spot.facing + 225)}</div>
            <div><i style="background:#00d1ff;border-radius:50%"></i>Centro: punto de datos del oleaje (mar adentro)</div>
            <div><i style="background:#ffd23f;border-radius:50%"></i>Rompiente, mira al ${compass(spot.facing)}</div>
            <div><i style="background:#314ee6"></i>Mar de fondo ahora</div>
            <div><i style="background:#ff8a00"></i>Viento ahora</div>
          </div>
        </div>
        <div class="section-title">Ficha del spot</div>
        <div class="card pad">
          <p style="margin:0 0 12px">${esc(spot.desc)}</p>
          <div class="facts">
            <div><div class="k">Fondo</div><div class="v">${esc(spot.bottom)}</div></div>
            <div><div class="k">Nivel</div><div class="v">${esc(spot.level)}</div></div>
            <div><div class="k">Mejor marea</div><div class="v">${esc(spot.bestTide)}</div></div>
            <div><div class="k">Mejor mar</div><div class="v">${esc(spot.bestSwell)}</div></div>
            <div><div class="k">Mejor viento</div><div class="v">${esc(spot.bestWind)}</div></div>
            <div><div class="k">Peligros</div><div class="v">${esc(spot.hazards)}</div></div>
          </div>
          <div style="margin-top:12px;font-size:13px"><a href="https://www.google.com/maps/search/?api=1&query=${spot.lat},${spot.lon}" target="_blank" rel="noopener">Cómo llegar</a></div>
        </div>
      </details></div>
    </div>
    ${footer()}`;

  view.querySelectorAll('[data-jump]').forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById(a.dataset.jump)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));
  if (f) {
    $('#longrange').innerHTML = longRange(f);
    assistant().then((ai) => { const el = $('#spot-report'); if (el && ai) el.innerHTML = reportBox(ai, [spot], ai.spotReport(f)); })
      .catch(() => { $('#spot-report')?.remove(); });
  } else $('#spot-report')?.remove();

  const camEl = $('#cam');
  const showCam = () => {
    $('#clip-info').hidden = true;
    $('#record-status').textContent = '';
    $('#live-cam').hidden = true;
    view.querySelectorAll('[data-clip]').forEach((b) => b.classList.remove('on'));
    $('#record-clip').hidden = cams[state.camIdx]?.embedType !== 'hls' || !HTMLVideoElement.prototype.captureStream || !window.MediaRecorder;
    const cam = cams[state.camIdx];
    playCam(camEl, cam);
    $('#cam-source').innerHTML = cam
      ? `${esc(cam.name)}${cam.credit ? ` · Imagen: <a href="${esc(cam.pageUrl)}" target="_blank" rel="noopener">${esc(cam.credit)}</a>` : ''}${cam.distanceKm ? ` · a ${cam.distanceKm} km del pico` : ''}`
      : '';
  };
  showCam();
  bindClips(spot, camEl, showCam);
  view.querySelectorAll('[data-cam]').forEach((b) => b.addEventListener('click', () => {
    state.camIdx = +b.dataset.cam;
    view.querySelectorAll('[data-cam]').forEach((x) => x.classList.toggle('on', x === b));
    showCam();
  }));
  view.querySelectorAll('[data-day]').forEach((b) => b.addEventListener('click', () => {
    state.dayIdx = +b.dataset.day;
    view.querySelectorAll('[data-day]').forEach((x) => x.classList.toggle('on', x === b));
    drawDay(spot, f);
  }));
  const spotLayout = $('.spot-layout');
  if (spotLayout) {
    let touchStart = null;
    const isScrollableTarget = (target) => target.closest('a, button, input, select, textarea, .days, .chart-wrap, .ftable-wrap');
    spotLayout.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1 || isScrollableTarget(e.target)) { touchStart = null; return; }
      touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }, { passive: true });
    spotLayout.addEventListener('touchend', (e) => {
      if (!touchStart || e.changedTouches.length !== 1) return;
      const dx = e.changedTouches[0].clientX - touchStart.x;
      const dy = e.changedTouches[0].clientY - touchStart.y;
      touchStart = null;
      if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
      const spots = favoriteSpots();
      const current = spots.findIndex((s) => s.id === id);
      if (current < 0 || spots.length < 2) return;
      const next = spots[(current + (dx < 0 ? 1 : -1) + spots.length) % spots.length];
      location.hash = `#/spot/${encodeURIComponent(next.id)}`;
    }, { passive: true });
  }
  bindFavs();
  if (f) drawDay(spot, f);
}

function loadingBlock() { return '<div class="banner">La previsión todavía no está disponible. Puedes consultar las cámaras y los clips guardados.</div>'; }

function nowPanel(spot, f, h) {
  const today = f.days[0];
  const ex = tideExtremes(f.hours.slice(Math.max(0, nowIndex(f.hours) - 1), nowIndex(f.hours) + 26));
  const next = ex[0];
  return `<h2>Condiciones actuales</h2><div class="now">
    <div class="wide"><div class="k">Calidad · ${h.hour}:00</div><span class="rating-pill ${ratingCls(h.rating)}">${ratingLabel(h.rating)}</span></div>
    <div><div class="k">Surf</div><div class="hero-wave num">${range(h.surf)}<small> m</small></div><div class="d">${surfWords(h.surf.mid)}</div></div>
    <div><div class="k">Viento</div><div class="v-sec num">${kmh(h.windSpeed)}</div><div class="d">${compass(h.windDir)} · ${h.wind.label}</div><div class="d">Rachas ${kmh(h.windGust)}</div></div>
    <div class="wide"><div class="k">Mar de fondo</div>
      ${h.swells.slice(0, 3).map((s, i) => `<div class="swell-line num"><span class="dot s${i + 1}"></span>${m(s.h)} m · ${s.t ? s.t.toFixed(0) : '–'} s · ${compass(s.dir)} ${Math.round(s.dir)}° ${dirArrow(s.dir)} <span class="faint" style="font-weight:500">${s.kind}</span></div>`).join('') || '<div class="muted">Sin mar de fondo</div>'}
    </div>
    <div><div class="k">Marea</div><div class="v-sec num">${h.tide != null ? (h.tide >= 0 ? '+' : '') + h.tide.toFixed(2) : '–'}<small> m</small></div>
      <div class="d">${next ? `${next.type === 'high' ? 'Pleamar' : 'Bajamar'} a las ${next.hour}:00` : ''}</div></div>
    <div><div class="k">Agua</div><div class="v-sec num">${h.sst != null ? Math.round(h.sst) : '–'}<small> °C</small></div>
      <div class="d">${wetsuit(h.sst)}</div></div>
    <div><div class="k">Tiempo</div><div class="v-sec num">${h.temp != null ? Math.round(h.temp) : '–'}<small> °C</small></div>
      <div class="d">Sol ${today.sunrise ?? '–'} – ${today.sunset ?? '–'}</div></div>
  </div>`;
}
function surfWords(h) {
  if (h == null || !Number.isFinite(h)) return 'Sin datos de altura';
  if (h < 0.2) return 'Plato';
  if (h < 0.4) return 'Tobillo a rodilla';
  if (h < 0.6) return 'Rodilla a muslo';
  if (h < 0.8) return 'Muslo a cintura';
  if (h < 1.1) return 'Cintura a pecho';
  if (h < 1.4) return 'Pecho a cabeza';
  if (h < 2) return 'Por encima de la cabeza';
  return 'Doble altura de cabeza';
}
function wetsuit(t) {
  if (t == null) return '';
  if (t >= 24) return 'Bañador o licra';
  if (t >= 21) return 'Neopreno corto de 2 mm';
  if (t >= 18) return 'Neopreno 3/2 mm';
  if (t >= 15) return 'Neopreno 4/3 mm';
  return 'Neopreno 5/4 mm y escarpines';
}

// Gráfica de barras del día + tabla + marea
function drawDay(spot, f) {
  const day = f.days[state.dayIdx];
  $('#chart-title').textContent = `${dayName(day.date, state.dayIdx)} ${dayShort(day.date)} · ${ratingLabel(day.rating)}`;
  $('#chart').innerHTML = barChart($('#chart').clientWidth || 640, day.hours, f.days[0].date === day.date ? nowIndex(f.hours) % 24 : -1, day);
  $('#wind-chart').innerHTML = windChart(day);
  $('#ftable').innerHTML = hourlyTable(f, state.dayIdx);
  const tideEl = $('#tide');
  if (tideEl) tideEl.innerHTML = tideChart(day);
  // Centrar la columna de la hora actual sin mover la página
  const wrap = $('#ftable'), nowCell = wrap.querySelector('.nowc');
  wrap.scrollLeft = nowCell ? Math.max(0, nowCell.offsetLeft - 120) : 0;
  
  // Scrubbing táctil en la gráfica
  const svg = $('#chart').querySelector('svg');
  if (svg) {
    const tip = document.createElement('div');
    tip.className = 'chart-tip hidden';
    svg.parentNode.style.position = 'relative';
    svg.parentNode.appendChild(tip);
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('class', 'chart-scrubber hidden');
    line.setAttribute('y1', 0);
    line.setAttribute('y2', svg.getAttribute('viewBox').split(' ')[3]);
    svg.appendChild(line);
    
    const w = parseFloat(svg.getAttribute('viewBox').split(' ')[2]);
    const padL = 28, padR = 4;
    const bw = (w - padL - padR) / day.hours.length;
    
    const onMove = (e) => {
      const rect = svg.getBoundingClientRect();
      let x = e.clientX || (e.touches && e.touches[0].clientX);
      if (x === undefined) return;
      x -= rect.left;
      let i = Math.floor((x - padL) / bw);
      if (i < 0) i = 0;
      if (i >= day.hours.length) i = day.hours.length - 1;
      const h = day.hours[i];
      line.setAttribute('x1', padL + i * bw + bw / 2);
      line.setAttribute('x2', padL + i * bw + bw / 2);
      line.classList.remove('hidden');
      tip.innerHTML = `<b>${h.hour}:00</b><br>${range(h.surf)} m · ${h.swells[0]?.t ? Math.round(h.swells[0].t)+'s' : '–'} · ${kmh(h.windSpeed)} · ${h.tide != null ? h.tide.toFixed(2)+' m' : '–'}`;
      tip.classList.remove('hidden');
      tip.style.left = Math.max(70, Math.min(w - 70, padL + i * bw + bw / 2)) + 'px';
    };
    svg.addEventListener('pointerdown', (e) => { svg.setPointerCapture(e.pointerId); onMove(e); });
    svg.addEventListener('pointermove', (e) => { if (svg.hasPointerCapture(e.pointerId)) onMove(e); });
    const hide = () => { line.classList.add('hidden'); tip.classList.add('hidden'); };
    svg.addEventListener('pointerup', (e) => { if (svg.hasPointerCapture(e.pointerId)) svg.releasePointerCapture(e.pointerId); setTimeout(hide, 1800); });
    svg.addEventListener('pointercancel', hide);
  }
}

function barChart(W, hours, nowH, day) {
  const H = W < 500 ? 200 : 220, pad = { l: 28, r: 4, t: 10, b: 44 };
  const maxV = Math.max(1, ...hours.map((h) => h.surf.max)) * 1.1;
  const bw = (W - pad.l - pad.r) / hours.length;
  const y = (v) => pad.t + (H - pad.t - pad.b) * (1 - v / maxV);
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" style="height:${H}px; touch-action: pan-y;" role="img" aria-label="Altura por horas">`;
  // Noche sombreada
  const [sr, ss] = [day.sunrise, day.sunset].map((t) => (t ? +t.slice(0, 2) + +t.slice(3) / 60 : null));
  if (sr != null) {
    s += `<rect x="${pad.l}" y="${pad.t}" width="${sr * bw}" height="${H - pad.t - pad.b}" fill="var(--surface-2)"/>`;
    s += `<rect x="${pad.l + ss * bw}" y="${pad.t}" width="${(24 - ss) * bw}" height="${H - pad.t - pad.b}" fill="var(--surface-2)"/>`;
  }
  for (let v = 0; v <= maxV; v += maxV > 2.5 ? 1 : 0.5) {
    s += `<line x1="${pad.l}" x2="${W - pad.r}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"/>`;
    s += `<text x="${pad.l - 6}" y="${y(v) + 4}" text-anchor="end" font-size="11" fill="var(--text-3)">${v.toFixed(1)}</text>`;
  }
  // Marea
  const tidePts = hours.filter(h => h.tide != null);
  if (tidePts.length) {
    const minT = Math.min(...tidePts.map(h => h.tide)), maxT = Math.max(...tidePts.map(h => h.tide));
    // Marea en la franja inferior (30 % de alto) para no competir con las barras
    const band = (H - pad.t - pad.b) * 0.3, base = H - pad.b - 4;
    const ty = (v) => base - band * ((v - minT) / (maxT - minT || 1));
    const path = tidePts.map((h, i) => `${i ? 'L' : 'M'}${pad.l + i * bw + bw/2} ${ty(h.tide)}`).join(' ');
    s += `<path d="${path}" fill="none" stroke="var(--accent)" stroke-width="1.5" opacity="0.6"/>`;
  }
  s += `<line x1="${pad.l}" x2="${W - pad.r}" y1="${H - 28}" y2="${H - 28}" stroke="var(--line)"/>`;
  hours.forEach((h, i) => {
    const x = pad.l + i * bw + 1.5, w = bw - 3;
    const color = RATINGS[h.rating]?.color ?? 'var(--r-flat)';
    s += `<rect x="${x}" y="${y(h.surf.max)}" width="${w}" height="${Math.max(1, y(0) - y(h.surf.max))}" rx="2" fill="${color}" opacity=".35"/>`;
    s += `<rect x="${x}" y="${y(h.surf.min)}" width="${w}" height="${Math.max(1, y(0) - y(h.surf.min))}" rx="2" fill="${color}"/>`;
    if (i === nowH) s += `<rect x="${x - 1.5}" y="${pad.t}" width="${bw}" height="${H - pad.t - pad.b}" fill="none" stroke="var(--brand)" stroke-width="2"/>`;
    if (i % 3 === 0) {
      s += `<text x="${x + w / 2}" y="${H - 28}" text-anchor="middle" font-size="11" fill="var(--text-3)">${h.hour}h</text>`;
      const wc = { offshore: 'var(--w-offshore)', crossoff: 'var(--w-offshore)', glassy: 'var(--w-glassy)', cross: 'var(--w-cross)' }[h.wind.key] || 'var(--w-onshore)';
      s += `<g transform="translate(${x + w / 2} ${H - 11}) rotate(${h.windDir + 180})"><path d="M0 -8 L5 5 L0 2 L-5 5 Z" fill="${wc}"/></g>`;
    }
  });
  return s + '</svg>';
}

function hourlyTable(f, dayIdx) {
  // Cuatro días desde el elegido, cada 3 h entre 6 y 21 h (como Surf-Forecast)
  const days = f.days.slice(dayIdx, dayIdx + 4);
  const cols = [];
  days.forEach((d, di) => d.hours.filter((h) => h.hour % 3 === 0 && h.hour >= 6 && h.hour <= 21).forEach((h, k) => cols.push({ h, first: k === 0, d, di })));
  const nowTime = f.hours[nowIndex(f.hours)].time;
  const nowCol = cols.findIndex((c) => c.h.time >= nowTime.slice(0, 11) + String(Math.floor(+nowTime.slice(11, 13) / 3) * 3).padStart(2, '0'));
  const td = (c, i, inner, cls = '') => `<td class="${cls}${c.first ? ' daysep' : ''}${i === nowCol && dayIdx === 0 ? ' nowc' : ''}">${inner}</td>`;
  const row = (label, fn, rowCls = '') => `<tr class="${rowCls}"><td class="lbl">${label}</td>${cols.map((c, i) => fn(c, i)).join('')}</tr>`;
  let s = '<table class="ftable num"><thead>';
  s += `<tr><th class="lbl"></th>${days.map((d, i) => `<th colspan="${cols.filter((c) => c.d === d).length}" class="daysep ${goodDay(d) ? `good-day ${ratingCls(d.rating)}` : ''}">${dayName(d.date, dayIdx + i)} ${dayShort(d.date)}</th>`).join('')}</tr>`;
  s += `<tr><th class="lbl">Hora</th>${cols.map((c) => `<th class="${c.first ? 'daysep' : ''}">${c.h.hour}h</th>`).join('')}</tr></thead><tbody>`;
  const kjCls = (e) => e == null ? '' : e < 50 ? 'kj-0' : e < 150 ? 'kj-1' : e < 400 ? 'kj-2' : 'kj-3';
  s += row('Calidad', (c, i) => td(c, i, `<div class="${ratingCls(c.h.rating)}" title="${ratingLabel(c.h.rating)}">${ratingLabel(c.h.rating)}</div>`, 'cell-r'));
  s += row('Surf (m)', (c, i) => td(c, i, range(c.h.surf), `big hcell ${hClass(c.h.surf.mid)}`));
  s += row('Mar total', (c, i) => td(c, i, `${m(c.h.waveHeight)}`));
  s += row('Energía', (c, i) => td(c, i, c.h.energy || '–', kjCls(c.h.energy)));
  s += row('Periodo', (c, i) => td(c, i, c.h.wavePeriod ? c.h.wavePeriod.toFixed(0) : '–'));
  s += row('Dir. mar', (c, i) => td(c, i, `${dirArrow(c.h.swells[0]?.dir ?? c.h.waveDir)}<br>${compass(c.h.swells[0]?.dir ?? c.h.waveDir)}`));
  s += row('Viento', (c, i) => td(c, i,
    `<div style="display:flex;flex-direction:column;align-items:center;gap:1px">
<span>${dirArrow(c.h.windDir)} <b>${kmh(c.h.windSpeed)}</b></span>
        <span class="faint" style="font-size:10px">r.${rnd(c.h.windGust)}</span>
       <span class="wind-tag wind-${c.h.wind.key}" style="font-size:9px;padding:1px 4px">${WIND_SHORT[c.h.wind.key] || c.h.wind.label}</span>
     </div>`,
    `wcell-${c.h.wind.key}`));
  s += row('Marea', (c, i) => td(c, i, c.h.tide != null ? c.h.tide.toFixed(2) : '–'));
  s += row('Aire °C', (c, i) => td(c, i, c.h.temp != null ? Math.round(c.h.temp) : '–'));
  return s + '</tbody></table>';
}

// Tendencia de días 5 a 16: mañana/tarde, tamaño, mar principal, viento y fiabilidad
function longRange(f) {
  const half = (hs) => hs.reduce((a, b) => (b.rating > a.rating ? b : a), hs[0]);
  const rows = f.days.slice(4).map((d, k) => {
    const i = k + 4;
    const am = d.hours.filter((h) => h.hour >= 7 && h.hour < 14);
    const pm = d.hours.filter((h) => h.hour >= 14 && h.hour <= 20);
    if (!am.length || !pm.length) return '';
    const a = half(am), p = half(pm), b = d.best, sw = b.swells[0];
    const winds = d.hours.filter((h) => h.hour >= 7 && h.hour <= 20).map((h) => h.windSpeed).filter((v) => v != null && !isNaN(v));
    const conf = i < 7 ? 'Media' : i < 10 ? 'Baja' : 'Muy baja';
    const bestRating = Math.max(d.rating ?? 0, a.rating, p.rating);
    return `<div class="lr-row ${goodDay({ rating: bestRating }) ? `good-day ${ratingCls(bestRating)}` : ''}">
      <div class="lr-day"><b>${dayName(d.date, i)}</b><span class="faint">${dayShort(d.date)}</span></div>
      <div class="lr-bars" title="Mañana: ${ratingLabel(a.rating)} · Tarde: ${ratingLabel(p.rating)}"><div class="${ratingCls(a.rating)}"></div><div class="${ratingCls(p.rating)}"></div></div><div class="rating-pill ${ratingCls(bestRating)}">${ratingLabel(bestRating)}</div>
      <div class="lr-h num"><b>${range({ min: d.surfMin, max: d.surfMax })}</b> m</div>
      <div class="lr-sw num">${sw ? `${m(sw.h)} m ${sw.t ? Math.round(sw.t) + ' s' : ''} ${dirArrow(sw.dir)} ${compass(sw.dir)}` : '–'}</div>
      <div class="lr-w num">${dirArrow(b.windDir)} ${winds.length ? `${Math.round(Math.min(...winds))}–${Math.round(Math.max(...winds))} km/h` : '–'}</div>
      <div class="lr-c faint">${conf}</div>
    </div>`;
  }).join('');
  return `<div class="lr-head"><span>Día</span><span>Mañ · Tarde</span><span>Calidad</span><span>Surf</span><span>Mar de fondo</span><span>Viento</span><span>Fiab.</span></div>${rows}`;
}

function tideChart(day) {
  const pts = day.hours.filter((h) => h.tide != null);
  if (!pts.length) return '<div class="muted">Sin datos de marea.</div>';
  const W = 400, H = 120, pad = 18;
  const vals = pts.map((p) => p.tide);
  const lo = Math.min(...vals) - 0.03, hi = Math.max(...vals) + 0.03;
  const x = (h) => pad + (W - 2 * pad) * (h / 23);
  const y = (v) => 12 + (H - 34) * (1 - (v - lo) / (hi - lo));
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.hour).toFixed(1)} ${y(p.tide).toFixed(1)}`).join(' ');
  let s = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">`;
  s += `<path d="${path} L${x(pts.at(-1).hour)} ${H - 22} L${x(pts[0].hour)} ${H - 22} Z" fill="color-mix(in srgb, var(--accent) 22%, transparent)"/>`;
  s += `<path d="${path}" fill="none" stroke="var(--accent)" stroke-width="2.5"/>`;
  // Extremos separados al menos 4 h para que las etiquetas no se pisen
  const ext = tideExtremes(pts).filter((e, i, a) => i === 0 || e.hour - a[i - 1].hour >= 4);
  ext.forEach((e) => {
    s += `<circle cx="${x(e.hour)}" cy="${y(e.tide)}" r="3.5" fill="var(--accent)"/>`;
    s += `<text x="${x(e.hour)}" y="${y(e.tide) + (e.type === 'high' ? -7 : 15)}" text-anchor="middle" font-size="10" font-weight="700" fill="var(--text-2)">${e.hour}h ${e.tide.toFixed(2)}</text>`;
  });
  [0, 6, 12, 18, 23].forEach((h) => { s += `<text x="${x(h)}" y="${H - 6}" text-anchor="middle" font-size="10" fill="var(--text-3)">${h}h</text>`; });
  return s + '</svg><div class="faint" style="font-size:12px;margin-top:4px">En el Mediterráneo la marea astronómica es de pocos centímetros; la presión y el viento pueden moverla más.</div>';
}

// ---------- Mapa ----------
let leaflet = null;
async function renderMap() {
  document.title = 'Mapa · MeteoSurf_Cs';
  view.innerHTML = '<div class="region-head"><h1>Mapa de spots</h1><p>Toca un punto para consultar su previsión.</p></div><div id="map"></div>';
  if (!window.L) {
    await new Promise((res) => {
      const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css'; document.head.appendChild(l);
      const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js'; s.onload = res; document.head.appendChild(s);
    });
  }
  leaflet?.remove();
  leaflet = L.map('map', { zoomControl: true });
  const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap', maxZoom: 19 });
  const sat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: 'Imagen © Esri', maxZoom: 19 });
  osm.addTo(leaflet);
  leaflet.attributionControl.setPrefix('Leaflet');
  L.control.layers({ 'Satélite': sat, 'Mapa': osm }, null, { position: 'topright' }).addTo(leaflet);
  const bounds = [];
  SPOTS.forEach((s) => {
    const f = state.fc?.spots[s.id];
    const h = f ? f.hours[nowIndex(f.hours)] : null;
    bounds.push([s.lat, s.lon]);
    const html = `<div class="map-pin ${h ? ratingCls(h.rating) : ''}"><span class="dot"></span><span class="lbl"><b>${esc(s.name)}</b>${h ? ' ' + range(h.surf) + ' m' : ''}</span></div>`;
    const mk = L.marker([s.lat, s.lon], { icon: L.divIcon({ html, className: '', iconSize: [18, 18], iconAnchor: [9, 9] }), title: s.name }).addTo(leaflet);
    mk.on('click', () => { location.hash = `#/spot/${encodeURIComponent(s.id)}`; });
    // Cuña que indica hacia dónde mira la playa y su ventana de mar
    const cosLat = Math.cos(s.lat * Math.PI / 180);
    const wedge = (from, to, d) => {
      const pts = [[s.lat, s.lon]];
      const span = norm360(to - from) || 360;
      for (let k = 0; k <= 12; k++) {
        const r = (from + (span * k) / 12) * Math.PI / 180;
        pts.push([s.lat + d * Math.cos(r), s.lon + (d * Math.sin(r)) / cosLat]);
      }
      return pts;
    };
    L.polygon(wedge(s.swellWindow[0], s.swellWindow[1], 0.012), { color: '#00a3c4', weight: 1, fillOpacity: 0.12, interactive: false }).addTo(leaflet);
    L.polyline([[s.lat, s.lon], [s.lat + 0.016 * Math.cos(s.facing * Math.PI / 180), s.lon + 0.016 * Math.sin(s.facing * Math.PI / 180) / cosLat]], { color: '#fff', weight: 2, interactive: false }).addTo(leaflet);
  });
  leaflet.fitBounds(bounds, { padding: [30, 30] });
  const syncLabels = () => document.getElementById('map')?.classList.toggle('show-labels', leaflet.getZoom() >= 11);
  leaflet.on('zoomend', syncLabels); syncLabels();
  setTimeout(() => leaflet.invalidateSize(), 50);
}

// ---------- Todas las camaras ----------
let camZone = 'all';
function renderCams() {
  document.title = 'Cámaras · MeteoSurf_Cs';
  const zones = [['all', 'Todas'], ...ZONES.map((z) => [z.id, z.name])];
  const allWithCams = ordered()
    .map((s) => ({ s, cams: camsForSpot(s) }))
    .filter((x) => x.cams.length > 0);
  const filtered = camZone === 'all' ? allWithCams : allWithCams.filter(({ s }) => s.zone === camZone);

  const PLAY_SVG = '<svg viewBox="0 0 48 48" width="56" height="56" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="24" cy="24" r="24" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.5)" stroke-width="1.5"/><polygon points="19,14 38,24 19,34" fill="white"/></svg>';

  view.innerHTML = `
    <div class="region-head"><div><h1>Cámaras en directo</h1>
      <p>${allWithCams.length} spots con cámara</p></div></div>
    <div class="chips" role="tablist" style="margin-bottom:14px">
      ${zones.map(([id, n]) => `<button class="chip btn ${camZone === id ? 'on' : ''}" data-camzone="${id}">${n}</button>`).join('')}
    </div>
    <div class="cam-grid">
      ${filtered.length ? filtered.map(({ s, cams }) => {
        const c = cams[0];
        const f = state.fc?.spots[s.id];
        const h = f ? f.hours[nowIndex(f.hours)] : null;
        return `<div class="cam-card">
          <div class="cam-card-head">
            <div class="cam-card-spot">
              <div class="cam-card-name">${esc(s.name)}</div>
              <div class="cam-card-zone">${esc(s.zoneName)}</div>
            </div>
            ${h ? `<div class="cam-card-surf">
              <span class="cam-card-height num">${range(h.surf)}<small> m</small></span>
              <span class="rating-pill ${ratingCls(h.rating)}" style="font-size:10px">${ratingLabel(h.rating)}</span>
            </div>` : ''}
          </div>
          <div class="cam cam-card-video" data-camspot="${esc(s.id)}">
            <button class="cam-placeholder" aria-label="Reproducir cámara de ${esc(s.name)}">
              <div class="cam-placeholder-overlay">
                <span class="cam-live-badge">EN DIRECTO</span>
                ${PLAY_SVG}
                <span class="cam-short-name">${esc(c.short || c.name)}</span>
              </div>
            </button>
          </div>
          <div class="cam-card-footer">
            <a href="#/spot/${encodeURIComponent(s.id)}" class="cam-forecast-link">Ver previsión</a>
            <span class="faint" style="font-size:12px;font-weight:600">${esc(c.credit || '')}</span>
          </div>
        </div>`;
      }).join('') : `<div class="card pad muted">No hay cámaras en esta zona.</div>`}
    </div>${footer()}`;

  // Chips de zona
  view.querySelectorAll('[data-camzone]').forEach((b) => b.addEventListener('click', () => {
    view.querySelectorAll('[data-camspot]').forEach(stopCam);
    camZone = b.dataset.camzone;
    renderCams();
  }));

  // Una sola camara activa a la vez
  view.querySelectorAll('[data-camspot]').forEach((el) => el.addEventListener('click', () => {
    const placeholder = el.querySelector('.cam-placeholder');
    if (!placeholder) return; // ya reproduciendo
    // Parar las demás y devolverles su portada para poder volver a reproducirlas
    view.querySelectorAll('[data-camspot]').forEach((other) => {
      if (other !== el && other.dataset.ph) { stopCam(other); other.innerHTML = other.dataset.ph; delete other.dataset.ph; }
    });
    el.dataset.ph = el.innerHTML;
    placeholder.remove();
    const spot = SPOTS.find((s) => s.id === el.dataset.camspot);
    playCam(el, camsForSpot(spot)[0]);
  }));
}

function footer() {
  return `<div class="footer">MeteoSurf_Cs · Datos: Open-Meteo (modelos ECMWF, DWD, Météo-France) · Cámaras de sus propietarios
    <br><span id="version"></span></div>`;
}

// ---------- Arranque ----------
async function loadRewinds() {
  try {
    const res = await fetch('data/rewinds.json');
    if (res.ok) state.rewinds = await res.json();
  } catch (e) {
    console.warn('No se pudo cargar rewinds:', e);
  }
}

async function refresh(force = false) {
  const realtime = loadRealtime().then((data) => { state.realtime = data; updateRealtime(); });
  try {
    state.fc = await loadForecast({ force });
  } catch (e) {
    view.insertAdjacentHTML('afterbegin', `<div class="banner">No se ha podido descargar la previsión (${esc(e.message)}). Revisa la conexión y vuelve a intentarlo.</div>`);
    return;
  } finally {
    await realtime;
  }
  route();
}

async function init() {
  window.addEventListener('hashchange', route);
  $('#refresh')?.addEventListener('click', () => { toast('Actualizando previsión…'); refresh(true); });
  $('#theme')?.addEventListener('click', () => {
    const cur = document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next; store.set('theme', next);
  });
  route(); // pinta esqueleto
  await Promise.all([loadCams(), loadRewinds()]);
  route();
  await refresh();
  // Refresco automático cada 30 min si la pestaña está visible
  setInterval(() => { if (document.visibilityState === 'visible') refresh(true); }, 30 * 60 * 1000);
  setInterval(() => { if (document.visibilityState === 'visible') updateRealtime(); }, 60 * 1000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') updateRealtime(); });
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').then((reg) => {
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        nw?.addEventListener('statechange', () => { if (nw.state === 'activated' && navigator.serviceWorker.controller) location.reload(); });
      });
    }).catch(() => { /* sin SW */ });
  }
}
const savedTheme = store.get('theme', null);
if (savedTheme) document.documentElement.dataset.theme = savedTheme;
init();

// mapa-capas.js — Capas meteorológicas del mapa, al estilo de Windy.
//
// Viento (con partículas animadas), oleaje, periodo, temperatura del mar y presión
// sobre una malla de puntos de Open-Meteo, con deslizador de hora y "pincho":
// al tocar el mapa se ve el tiempo de ese punto. Sin claves ni servidores propios.

const LATS = [39.5, 39.6, 39.7, 39.8, 39.9, 40.0, 40.1, 40.2, 40.3, 40.4, 40.5, 40.6, 40.7, 40.8];
const LONS = [-0.2, -0.1, 0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
const PASO = 0.1;
const HORAS = 72;
const CACHE_CLAVE = 'ms_mapa_malla_v2';
const CACHE_MIN = 60;
const KMH_A_KT = 0.539957;

const VARS_METEO = 'wind_speed_10m,wind_direction_10m,wind_gusts_10m,pressure_msl';
const VARS_MAR = 'wave_height,wave_direction,wave_period,sea_surface_temperature';

const CAPAS = {
  viento: { nombre: 'Viento', unidad: 'kt', paradas: [[0, '#9ad1ff'], [5, '#5fb3f0'], [10, '#4ed39a'], [15, '#c6e04a'], [20, '#f5c242'], [25, '#f08a3a'], [30, '#e0453a'], [40, '#a02a8f']] },
  oleaje: { nombre: 'Oleaje', unidad: 'm', paradas: [[0, '#b9e3f5'], [0.5, '#6cc4e8'], [1, '#3b8fd9'], [1.5, '#4ec27a'], [2, '#e4d23a'], [3, '#f08a3a'], [4, '#e0453a']] },
  periodo: { nombre: 'Periodo', unidad: 's', paradas: [[2, '#b9e3f5'], [4, '#6cc4e8'], [6, '#3b8fd9'], [8, '#4ec27a'], [10, '#e4d23a'], [12, '#f08a3a'], [16, '#e0453a']] },
  temp: { nombre: 'Temp. mar', unidad: '°C', paradas: [[12, '#4a6fe0'], [15, '#3b8fd9'], [18, '#4ec27a'], [21, '#e4d23a'], [24, '#f08a3a'], [27, '#e0453a']] },
  presion: { nombre: 'Presión', unidad: 'hPa', paradas: [[995, '#a02a8f'], [1005, '#3b8fd9'], [1013, '#4ec27a'], [1020, '#e4d23a'], [1030, '#f08a3a']] },
};

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const rosa = (g) => ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO'][Math.round(((g % 360) + 360) % 360 / 22.5) % 16];

function color(capa, v) {
  const p = CAPAS[capa].paradas;
  if (v <= p[0][0]) return p[0][1];
  for (let i = 1; i < p.length; i++) if (v <= p[i][0]) {
    const a = hexARgb(p[i - 1][1]), b = hexARgb(p[i][1]);
    const t = (v - p[i - 1][0]) / (p[i][0] - p[i - 1][0]);
    return `rgb(${a.map((x, j) => Math.round(x + (b[j] - x) * t)).join(',')})`;
  }
  return p[p.length - 1][1];
}

function hexARgb(h) { return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); }

// La malla marina de Open-Meteo extrapola valores sobre tierra. Recortar esos
// puntos con una línea de costa conservadora para esta zona fija de Castellón.
function puntoEnMar(p) {
  const lat = p.lat ?? p[0];
  const lon = p.lon ?? p.lng ?? p[1];
  if (lat == null || lon == null) return false;
  let c;
  if (lat < 39.98) c = -0.18 + (lat - 39.73) * 0.72;
  else if (lat < 40.055) c = 0.00 + (lat - 39.98) * 1.09;
  else if (lat < 40.095) c = 0.082 + (lat - 40.055) * 1.675;
  else if (lat < 40.38) c = 0.149 + (lat - 40.095) * 0.915;
  else c = 0.41 + (lat - 40.38) * 0.78;
  return lon >= c - 0.015;
}

async function pedir(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Open-Meteo respondió ${r.status}`);
  return r.json();
}

const comoLista = (x) => (Array.isArray(x) ? x : [x]);

// Descarga la malla completa: una petición de tiempo y otra de mar, con caché de 1 h.
async function cargarMalla() {
  try {
    const c = JSON.parse(localStorage.getItem(CACHE_CLAVE) || 'null');
    if (c && Date.now() - c.t < CACHE_MIN * 60000) return c.datos;
  } catch { /* caché ilegible: se vuelve a pedir */ }
  const lats = [], lons = [];
  LATS.forEach((la) => LONS.forEach((lo) => { lats.push(la); lons.push(lo); }));
  const comun = `latitude=${lats.join(',')}&longitude=${lons.join(',')}&hourly=`;
  const cola = `&timezone=Europe%2FMadrid&forecast_days=4`;
  const [met, mar] = await Promise.all([
    pedir(`https://api.open-meteo.com/v1/forecast?${comun}${VARS_METEO}${cola}`),
    pedir(`https://marine-api.open-meteo.com/v1/marine?${comun}${VARS_MAR}${cola}`).catch(() => null),
  ]);
  const m = comoLista(met), w = mar ? comoLista(mar) : [];
  const datos = { tiempos: m[0].hourly.time, puntos: m.map((p, i) => ({ lat: lats[i], lon: lons[i], met: p.hourly, mar: w[i]?.hourly || null })) };
  try { localStorage.setItem(CACHE_CLAVE, JSON.stringify({ t: Date.now(), datos })); } catch { /* sin espacio: da igual */ }
  return datos;
}

function valorPunto(capa, p, h) {
  const g = (o, k) => (o && o[k] ? o[k][h] : null);
  const rumbo = (o, k) => { const d = g(o, k); return d == null ? null : d + 180; };
  switch (capa) {
    case 'viento': { const v = g(p.met, 'wind_speed_10m'); return v == null ? null : { v: v * KMH_A_KT, dir: rumbo(p.met, 'wind_direction_10m') }; }
    case 'oleaje': { const v = g(p.mar, 'wave_height'); return v == null ? null : { v, dir: rumbo(p.mar, 'wave_direction') }; }
    case 'periodo': { const v = g(p.mar, 'wave_period'); return v == null ? null : { v, dir: rumbo(p.mar, 'wave_direction') }; }
    case 'temp': { const v = g(p.mar, 'sea_surface_temperature'); return v == null ? null : { v, dir: null }; }
    case 'presion': { const v = g(p.met, 'pressure_msl'); return v == null ? null : { v, dir: null }; }
    default: return null;
  }
}

function formato(capa, v) {
  if (capa === 'viento') return String(Math.round(v));
  if (capa === 'presion') return String(Math.round(v));
  return v.toFixed(1);
}

// Interpolación bilineal de valor y dirección en cualquier punto de la malla.
function interpolarPunto(datos, capa, h, lat, lon) {
  if (!datos || !datos.puntos || lat < LATS[0] || lat > LATS.at(-1) || lon < LONS[0] || lon > LONS.at(-1)) return null;
  const fi = Math.min(Math.max((lat - LATS[0]) / PASO, 0), LATS.length - 1.001);
  const fj = Math.min(Math.max((lon - LONS[0]) / PASO, 0), LONS.length - 1.001);
  const i = Math.floor(fi), j = Math.floor(fj);
  const a = fi - i, b = fj - j;

  const idx00 = i * LONS.length + j;
  const idx01 = i * LONS.length + (j + 1);
  const idx10 = (i + 1) * LONS.length + j;
  const idx11 = (i + 1) * LONS.length + (j + 1);

  const p00 = datos.puntos[idx00];
  const p01 = datos.puntos[idx01];
  const p10 = datos.puntos[idx10];
  const p11 = datos.puntos[idx11];

  const v00 = p00 ? valorPunto(capa, p00, h) : null;
  const v01 = p01 ? valorPunto(capa, p01, h) : null;
  const v10 = p10 ? valorPunto(capa, p10, h) : null;
  const v11 = p11 ? valorPunto(capa, p11, h) : null;

  const vals = [v00, v01, v10, v11].filter(Boolean);
  if (!vals.length) return null;

  let v;
  if (v00 && v01 && v10 && v11) {
    v = (v00.v * (1 - b) + v01.v * b) * (1 - a) + (v10.v * (1 - b) + v11.v * b) * a;
  } else {
    let sumW = 0, sumV = 0;
    if (v00) { const w = (1 - a) * (1 - b); sumW += w; sumV += v00.v * w; }
    if (v01) { const w = (1 - a) * b; sumW += w; sumV += v01.v * w; }
    if (v10) { const w = a * (1 - b); sumW += w; sumV += v10.v * w; }
    if (v11) { const w = a * b; sumW += w; sumV += v11.v * w; }
    v = sumW > 0 ? sumV / sumW : vals[0].v;
  }

  let dir = null;
  const dirs = [v00?.dir, v01?.dir, v10?.dir, v11?.dir];
  if (dirs.some((d) => d != null)) {
    let sinSum = 0, cosSum = 0, wSum = 0;
    const weights = [(1 - a) * (1 - b), (1 - a) * b, a * (1 - b), a * b];
    dirs.forEach((d, k) => {
      if (d != null) {
        const rad = (d * Math.PI) / 180;
        sinSum += Math.sin(rad) * weights[k];
        cosSum += Math.cos(rad) * weights[k];
        wSum += weights[k];
      }
    });
    if (wSum > 0) {
      const deg = (Math.atan2(sinSum, cosSum) * 180) / Math.PI;
      dir = ((deg % 360) + 360) % 360;
    }
  }

  return { v, dir };
}

// Viento (u: este, v: norte, en kt) interpolado en cualquier punto de la malla.
function vientoEn(datos, h, lat, lon) {
  const fi = Math.min(Math.max((lat - LATS[0]) / PASO, 0), LATS.length - 1.001);
  const fj = Math.min(Math.max((lon - LONS[0]) / PASO, 0), LONS.length - 1.001);
  const i = Math.floor(fi), j = Math.floor(fj), a = fi - i, b = fj - j;
  const uv = (ii, jj) => {
    const p = datos.puntos[ii * LONS.length + jj];
    const s = (p.met.wind_speed_10m[h] ?? 0) * KMH_A_KT, d = ((p.met.wind_direction_10m[h] ?? 0) * Math.PI) / 180;
    return [-s * Math.sin(d), -s * Math.cos(d)];
  };
  const q = [uv(i, j), uv(i, j + 1), uv(i + 1, j), uv(i + 1, j + 1)];
  const mezcla = (k) => (q[0][k] * (1 - b) + q[1][k] * b) * (1 - a) + (q[2][k] * (1 - b) + q[3][k] * b) * a;
  return [mezcla(0), mezcla(1)];
}

export const FLECHA = (grados, col, tam) => `<svg width="${tam}" height="${tam}" viewBox="0 0 24 24" style="transform:rotate(${grados}deg)" aria-hidden="true"><path d="M12 21V4 M6 10l6-6 6 6" fill="none" stroke="#09131d" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 21V4 M6 10l6-6 6 6" fill="none" stroke="${col}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

// Motor para el mapa plano (Leaflet).
export function motorLeaflet(mapa, L = window.L) {
  const grupo = L.layerGroup().addTo(mapa);
  return {
    contenedor: () => mapa.getContainer(),
    limpiar: () => grupo.clearLayers(),
    pintar(items) {
      grupo.clearLayers();
      items.forEach((it) => {
        const flecha = it.dir == null ? '' : FLECHA(it.dir, it.col, it.tam);
        const html = `<div class="capa-punto" style="--capa-color:${it.col}">${flecha}<b>${it.texto}</b></div>`;
        L.marker([it.lat, it.lon], { icon: L.divIcon({ html, className: '', iconSize: [40, 36], iconAnchor: [20, 18] }), interactive: false, keyboard: false, zIndexOffset: -1000 }).addTo(grupo);
      });
    },
    aLatLng: (x, y) => { const ll = mapa.containerPointToLatLng([x, y]); return { lat: ll.lat, lng: ll.lng }; },
    alCambiarVista(fn) { mapa.on('resize zoomend moveend', fn); return () => mapa.off('resize zoomend moveend', fn); },
    alTocar(fn) { mapa.on('click', (e) => fn(e.latlng.lat, e.latlng.lng)); },
    popup(lat, lng) {
      const p = L.popup({ maxWidth: 240 }).setLatLng([lat, lng]).setContent('Cargando…').openOn(mapa);
      return { poner: (html) => p.setContent(html) };
    },
    destruir: () => grupo.remove(),
  };
}

export function iniciarCapas(motor, host) {
  let capa = null;               // null = solo los spots
  let datos = null;
  let hora = 0;                  // índice dentro de datos.tiempos
  let h0 = 0;                    // primera hora que no ha pasado
  let particulas = null;
  let reproduciendo = null;
  let vivo = true;

  host.innerHTML = `
    <div class="capas-barra" role="group" aria-label="Capas del mapa">
      <button type="button" data-capa="" class="on">Spots</button>
      ${Object.entries(CAPAS).map(([k, c]) => `<button type="button" data-capa="${k}">${c.nombre}</button>`).join('')}
    </div>
    <div class="capas-abajo" hidden>
      <div class="capas-hora">
        <button type="button" class="capas-play" aria-label="Reproducir">▶</button>
        <input type="range" min="0" max="${HORAS - 1}" value="0" aria-label="Hora de la previsión">
        <output></output>
      </div>
      <div class="capas-leyenda"></div>
      <p class="capas-estado" hidden></p>
    </div>`;
  const barra = host.querySelector('.capas-barra');
  const abajo = host.querySelector('.capas-abajo');
  const bloqueHora = host.querySelector('.capas-hora');
  const slider = bloqueHora.querySelector('input');
  const salida = bloqueHora.querySelector('output');
  const play = bloqueHora.querySelector('.capas-play');
  const leyenda = host.querySelector('.capas-leyenda');
  const estado = host.querySelector('.capas-estado');

  const etiquetaHora = (h) => {
    const t = new Date(datos.tiempos[h]);
    return t.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' }) + ' · ' + String(t.getHours()).padStart(2, '0') + ':00';
  };

  function pintarLeyenda() {
    if (!capa) return;
    const c = CAPAS[capa];
    const min = c.paradas[0][0], max = c.paradas.at(-1)[0];
    const gradiente = c.paradas.map(([v, col]) => `${col} ${Math.round((v - min) * 100 / (max - min))}%`).join(',');
    leyenda.innerHTML = `<strong>${c.nombre} · ${c.unidad}</strong><div class="capas-escala" style="background:linear-gradient(90deg,${gradiente})"></div><div class="capas-valores"><span>${c.paradas[0][0]}</span><span>${c.paradas.at(-1)[0]} ${c.unidad}</span></div>`;
  }

  function pintarPuntos() {
    motor.limpiar();
    if (!capa || !datos) return;
    const h = hora;
    const cont = motor.contenedor();
    if (!cont) return;
    const rect = cont.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const esEscritorio = rect.width >= 800;
    const celda = esEscritorio ? 48 : 68;
    const items = [];
    const margenSup = esEscritorio ? 64 : 56;
    const margenInf = esEscritorio ? 24 : 64;
    const margenDer = esEscritorio ? 60 : 54;
    const margenIzq = 8;

    for (let x = margenIzq + celda / 2; x < rect.width - margenDer; x += celda) {
      for (let y = margenSup + celda / 2; y < rect.height - margenInf; y += celda) {
        const ll = motor.aLatLng(x, y);
        if (!ll || !Number.isFinite(ll.lat) || !Number.isFinite(ll.lng)) continue;
        if (['oleaje', 'periodo', 'temp'].includes(capa) && !puntoEnMar(ll)) continue;
        const val = interpolarPunto(datos, capa, h, ll.lat, ll.lng);
        if (!val || val.v == null || isNaN(val.v)) continue;
        items.push({
          lat: ll.lat, lon: ll.lng, dir: val.dir, col: color(capa, val.v), texto: formato(capa, val.v),
          tam: esEscritorio ? 18 : 20,
        });
      }
    }
    motor.pintar(items);
  }

  function actualizar() {
    salida.textContent = datos ? etiquetaHora(hora) : '';
    pintarPuntos();
  }
  const quitarPintadoVista = motor.alCambiarVista(() => { if (capa && datos) pintarPuntos(); });

  // Partículas de viento: canvas encima del mapa que no captura toques.
  function arrancarParticulas() {
    pararParticulas();
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const cont = motor.contenedor();
    const cv = document.createElement('canvas');
    cv.className = 'capas-canvas';
    cont.appendChild(cv);
    const ctx = cv.getContext('2d');
    const N = 700;
    let ps = [], anim = 0;
    const tamano = () => { const r = cont.getBoundingClientRect(); cv.width = r.width; cv.height = r.height; };
    const nueva = () => ({ x: Math.random() * cv.width, y: Math.random() * cv.height, vida: 40 + Math.random() * 60 });
    const reiniciar = () => { tamano(); ps = Array.from({ length: N }, nueva); ctx.clearRect(0, 0, cv.width, cv.height); };
    reiniciar();
    const quitarVista = motor.alCambiarVista(reiniciar);
    const paso = () => {
      if (!vivo || !datos || capa !== 'viento') return;
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = 'rgba(0,0,0,0.08)';
      ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.globalCompositeOperation = 'source-over';
      ctx.lineWidth = 1.4;
      ps.forEach((p, i) => {
        const ll = motor.aLatLng(p.x, p.y);
        if (!ll || !Number.isFinite(ll.lat) || !Number.isFinite(ll.lng)) { ps[i] = nueva(); return; }
        const [u, v] = vientoEn(datos, hora, ll.lat, ll.lng);
        const kt = Math.hypot(u, v);
        const k = 0.35;
        const nx = p.x + u * k, ny = p.y - v * k;
        ctx.strokeStyle = color('viento', kt);
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(nx, ny); ctx.stroke();
        p.x = nx; p.y = ny; p.vida -= 1;
        if (p.vida <= 0 || p.x < 0 || p.y < 0 || p.x > cv.width || p.y > cv.height) ps[i] = nueva();
      });
      anim = requestAnimationFrame(paso);
    };
    anim = requestAnimationFrame(paso);
    particulas = () => { cancelAnimationFrame(anim); quitarVista(); cv.remove(); };
  }
  function pararParticulas() { particulas?.(); particulas = null; }

  function parar() {
    clearInterval(reproduciendo); reproduciendo = null; play.textContent = '▶'; play.setAttribute('aria-label', 'Reproducir');
  }
  play.addEventListener('click', () => {
    if (reproduciendo) { parar(); return; }
    play.textContent = '⏸'; play.setAttribute('aria-label', 'Pausar');
    reproduciendo = setInterval(() => {
      hora = hora + 1 >= h0 + HORAS ? h0 : hora + 1;
      slider.value = hora - h0; actualizar();
    }, 600);
  });
  slider.addEventListener('input', () => { hora = h0 + Number(slider.value); actualizar(); });

  async function elegir(nueva) {
    capa = nueva || null;
    barra.querySelectorAll('button').forEach((b) => {
      const activo = (b.dataset.capa || null) === capa;
      b.classList.toggle('on', activo);
      b.setAttribute('aria-pressed', String(activo));
    });
    pintarLeyenda();
    parar();
    abajo.hidden = !capa;
    if (!capa) { estado.hidden = true; motor.limpiar(); pararParticulas(); return; }
    if (!datos) {
      estado.hidden = false; estado.textContent = 'Cargando la previsión de la malla…';
      try {
        datos = await cargarMalla();
        const ahora = Date.now();
        h0 = Math.max(0, datos.tiempos.findIndex((t) => new Date(t).getTime() >= ahora - 1800000));
        hora = h0; slider.value = 0;
        slider.max = Math.max(0, Math.min(HORAS, datos.tiempos.length - h0) - 1);
        estado.hidden = true;
      } catch (e) {
        estado.textContent = `No se ha podido cargar la previsión del mapa (${e.message}). Prueba en un rato.`;
        return;
      }
    }
    if (!vivo || capa !== nueva) return;
    actualizar();
    if (capa === 'viento') arrancarParticulas(); else pararParticulas();
  }
  barra.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-capa]');
    if (b) elegir(b.dataset.capa);
  });

  // Pincho: toca el mapa y ves el tiempo de ese punto a la hora elegida.
  motor.alTocar(async (lat, lng) => {
    if (!capa) return;
    const pop = motor.popup(lat, lng);
    try {
      const base = `latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}&timezone=Europe%2FMadrid&forecast_days=4&hourly=`;
      const [met, mar] = await Promise.all([
        pedir(`https://api.open-meteo.com/v1/forecast?${base}${VARS_METEO}`),
        pedir(`https://marine-api.open-meteo.com/v1/marine?${base}${VARS_MAR}`).catch(() => null),
      ]);
      const h = datos ? hora : met.hourly.time.findIndex((t) => new Date(t).getTime() >= Date.now() - 1800000);
      const m = met.hourly, w = mar?.hourly;
      const filas = [
        ['Viento', `${Math.round(m.wind_speed_10m[h] * KMH_A_KT)} kt de ${rosa(m.wind_direction_10m[h])} (rachas ${Math.round(m.wind_gusts_10m[h] * KMH_A_KT)} kt)`],
        ['Presión', `${Math.round(m.pressure_msl[h])} hPa`],
      ];
      if (w && w.wave_height[h] != null) {
        filas.push(['Oleaje', `${w.wave_height[h].toFixed(1)} m · ${Math.round(w.wave_period[h])} s del ${rosa(w.wave_direction[h])}`]);
        if (w.sea_surface_temperature[h] != null) filas.push(['Agua', `${w.sea_surface_temperature[h].toFixed(1)} °C`]);
      }
      pop.poner(`<div class="capas-pop"><b>${esc(new Date(m.time[h]).toLocaleString('es-ES', { weekday: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }))}</b>${filas.map(([k, v]) => `<div><span>${k}</span>${esc(v)}</div>`).join('')}</div>`);
    } catch (err) {
      pop.poner(`No se ha podido leer el tiempo de este punto (${esc(err.message)}).`);
    }
  });

  return {
    capaActual: () => capa,
    elegir: (c) => elegir(c),
    reiniciar() { elegir(null); },
    destruir() { vivo = false; parar(); pararParticulas(); quitarPintadoVista(); motor.destruir(); host.innerHTML = ''; },
  };
}

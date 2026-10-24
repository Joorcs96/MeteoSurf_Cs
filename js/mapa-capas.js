// mapa-capas.js — Capas meteorológicas del mapa, al estilo de Windy.
//
// Viento (con partículas animadas), oleaje, periodo, temperatura del mar y presión
// sobre una malla de puntos de Open-Meteo, con deslizador de hora y "pincho":
// al tocar el mapa se ve el tiempo de ese punto. Sin claves ni servidores propios.

const LATS = [39.7, 39.8, 39.9, 40.0, 40.1, 40.2, 40.3, 40.4, 40.5];
const LONS = [-0.25, -0.15, -0.05, 0.05, 0.15, 0.25, 0.35, 0.45, 0.55];
const PASO = 0.1;
const HORAS = 72;
const CACHE_CLAVE = 'ms_mapa_malla_v1';
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
  for (let i = 1; i < p.length; i++) if (v <= p[i][0]) return p[i][1];
  return p[p.length - 1][1];
}

function hexARgb(h) { return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); }

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
  switch (capa) {
    case 'viento': { const v = g(p.met, 'wind_speed_10m'); return v == null ? null : { v: v * KMH_A_KT, dir: g(p.met, 'wind_direction_10m') + 180 }; }
    case 'oleaje': { const v = g(p.mar, 'wave_height'); return v == null ? null : { v, dir: g(p.mar, 'wave_direction') + 180 }; }
    case 'periodo': { const v = g(p.mar, 'wave_period'); return v == null ? null : { v, dir: g(p.mar, 'wave_direction') + 180 }; }
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

const FLECHA = (grados, col, tam) => `<svg width="${tam}" height="${tam}" viewBox="0 0 24 24" style="transform:rotate(${grados}deg)" aria-hidden="true"><path d="M12 2 L19 20 L12 16 L5 20 Z" fill="${col}" stroke="#0a0f14" stroke-width="1.2" stroke-linejoin="round"/></svg>`;

export function iniciarCapas(mapa, host, { L = window.L } = {}) {
  let capa = null;               // null = solo los spots
  let datos = null;
  let hora = 0;                  // índice dentro de datos.tiempos
  let h0 = 0;                    // primera hora que no ha pasado
  let grupo = L.layerGroup().addTo(mapa);
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
    leyenda.innerHTML = `<span>${c.unidad}</span>` + c.paradas.map(([v, col]) => `<span style="background:${col}">${v}</span>`).join('');
  }

  function pintarPuntos() {
    grupo.clearLayers();
    if (!capa || !datos) return;
    const h = hora;
    datos.puntos.forEach((p) => {
      const val = valorPunto(capa, p, h);
      if (!val) return;
      const col = color(capa, val.v);
      const tam = capa === 'oleaje' ? 18 + Math.min(val.v, 4) * 5 : 22;
      const flecha = val.dir == null ? '' : FLECHA(val.dir, col, tam);
      const html = `<div class="capa-punto">${flecha}<b style="color:${col}">${formato(capa, val.v)}</b></div>`;
      L.marker([p.lat, p.lon], { icon: L.divIcon({ html, className: '', iconSize: [40, 40], iconAnchor: [20, 20] }), interactive: false, keyboard: false, zIndexOffset: -1000 }).addTo(grupo);
    });
  }

  function actualizar() {
    salida.textContent = datos ? etiquetaHora(hora) : '';
    pintarPuntos();
  }

  // Partículas de viento: canvas encima del mapa que no captura toques.
  function arrancarParticulas() {
    pararParticulas();
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const cont = mapa.getContainer();
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
    mapa.on('resize zoomend moveend', reiniciar);
    const paso = () => {
      if (!vivo || !datos || capa !== 'viento') return;
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = 'rgba(0,0,0,0.08)';
      ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.globalCompositeOperation = 'source-over';
      ctx.lineWidth = 1.4;
      ps.forEach((p, i) => {
        const ll = mapa.containerPointToLatLng([p.x, p.y]);
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
    particulas = () => { cancelAnimationFrame(anim); mapa.off('resize zoomend moveend', reiniciar); cv.remove(); };
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
    barra.querySelectorAll('button').forEach((b) => b.classList.toggle('on', (b.dataset.capa || null) === capa));
    pintarLeyenda();
    parar();
    abajo.hidden = !capa;
    if (!capa) { estado.hidden = true; grupo.clearLayers(); pararParticulas(); return; }
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
  mapa.on('click', async (e) => {
    if (!capa) return;
    const { lat, lng } = e.latlng;
    const pop = L.popup({ maxWidth: 240 }).setLatLng(e.latlng).setContent('Cargando…').openOn(mapa);
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
      pop.setContent(`<div class="capas-pop"><b>${esc(new Date(m.time[h]).toLocaleString('es-ES', { weekday: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }))}</b>${filas.map(([k, v]) => `<div><span>${k}</span>${esc(v)}</div>`).join('')}</div>`);
    } catch (err) {
      pop.setContent(`No se ha podido leer el tiempo de este punto (${esc(err.message)}).`);
    }
  });

  return {
    destruir() { vivo = false; parar(); pararParticulas(); grupo.remove(); host.innerHTML = ''; },
  };
}

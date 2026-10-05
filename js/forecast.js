// forecast.js — Descarga de Open-Meteo por spot y cálculo de ola en rompiente, viento y calidad.
// Además carga los datos reales (data/realtime.json) y el modelo ecmwf_wam025 para comparar.
import { SPOTS } from './spots.js';

const TZ = 'Europe/Madrid';
const DAYS = 16;
const CACHE_KEY = 'meteosurf_cs_forecast_v1';
const CACHE_MAX_AGE = 60 * 60 * 1000; // 1 h

const MARINE_VARS = [
  'wave_height', 'wave_period', 'wave_direction',
  'swell_wave_height', 'swell_wave_period', 'swell_wave_direction',
  'secondary_swell_wave_height', 'secondary_swell_wave_period', 'secondary_swell_wave_direction',
  'wind_wave_height', 'wind_wave_period', 'wind_wave_direction',
  'sea_level_height_msl', 'sea_surface_temperature'
];
const WEATHER_VARS = [
  'wind_speed_10m', 'wind_direction_10m', 'wind_gusts_10m',
  'temperature_2m', 'weather_code', 'is_day'
];

// ---------- Utilidades angulares ----------
export const norm360 = (a) => ((a % 360) + 360) % 360;
export const angDiff = (a, b) => { const d = Math.abs(norm360(a) - norm360(b)); return d > 180 ? 360 - d : d; };
const inWindow = (dir, [from, to]) => {
  const d = norm360(dir), f = norm360(from), t = norm360(to);
  return f <= t ? d >= f && d <= t : d >= f || d <= t;
};
const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO'];
export const compass = (deg) => (deg == null ? '–' : COMPASS[Math.round(norm360(deg) / 22.5) % 16]);

// ---------- Descarga ----------
async function fetchJson(url, ms = 12000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctrl.signal, cache: 'no-store' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally { clearTimeout(t); }
}

function buildUrls() {
  const seaLat = SPOTS.map((s) => s.seaLat).join(',');
  const seaLon = SPOTS.map((s) => s.seaLon).join(',');
  const lat = SPOTS.map((s) => s.lat).join(',');
  const lon = SPOTS.map((s) => s.lon).join(',');
  return {
    marine: `https://marine-api.open-meteo.com/v1/marine?latitude=${seaLat}&longitude=${seaLon}` +
      `&hourly=${MARINE_VARS.join(',')}&forecast_days=${DAYS}&timezone=${TZ}&cell_selection=sea`,
    // GFS-Wave llega a 16 días: rellena donde el modelo principal (≈10 días) ya no tiene datos
    marineExt: `https://marine-api.open-meteo.com/v1/marine?latitude=${seaLat}&longitude=${seaLon}` +
      `&hourly=${MARINE_VARS.slice(0, 12).join(',')}&models=ncep_gfswave016&forecast_days=${DAYS}&timezone=${TZ}&cell_selection=sea`,
    weather: `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&hourly=${WEATHER_VARS.join(',')}&daily=sunrise,sunset,temperature_2m_max` +
      `&forecast_days=${DAYS}&timezone=${TZ}&wind_speed_unit=kmh`
  };
}

// ---------- Datos reales (lo que se mide, no lo que se predice) ----------
// data/realtime.json lo escribe scripts/realtime.py desde el cron horario con la última
// observación de la boya más cercana, del mareógrafo más cercano y de la estación de viento del
// puerto de Castellón (todo de Puertos del Estado, sin claves).
//
// Aquí sólo se lee, y a propósito no lanza nunca: si el fichero aún no existe, si el cron lleva
// tiempo caído, si el servidor devuelve un 404 o si el JSON está truncado, loadRealtime()
// devuelve null y quien la llame sigue con la previsión sin más. Mientras el fichero no exista la
// web funciona exactamente igual que antes.
export async function loadRealtime({ ruta = 'data/realtime.json' } = {}) {
  let datos;
  try {
    datos = await fetchJson(ruta, 8000);
  } catch { return null; }
  return datos && typeof datos === 'object' && !Array.isArray(datos) ? datos : null;
}

// Minutos desde la observación; nunca usar la fecha de descarga como edad del sensor.
// Sirve para no pintar como "ahora" una observación vieja: el bloque trae "obsoleto", pero la
// cuenta fina la hace quien lo pinte.
export function antiguedadRealtime(datos) {
  const fecha = datos?.fecha;
  if (typeof fecha !== 'string' || !/(Z|[+-]\d{2}:\d{2})$/.test(fecha)) return null;
  const t = Date.parse(fecha);
  const edad = (Date.now() - t) / 60000;
  return Number.isFinite(t) && edad >= -5 ? Math.max(0, edad) : null;
}

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function writeCache(data) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch { /* sin almacenamiento */ }
}

// Devuelve { fetchedAt, stale, spots: { [id]: SpotForecast } }
export async function loadForecast({ force = false } = {}) {
  const cached = readCache();
  const sameDay = cached && new Date(cached.fetchedAt).toDateString() === new Date().toDateString();
  if (!force && cached && sameDay && Date.now() - new Date(cached.fetchedAt).getTime() < CACHE_MAX_AGE) {
    return { ...cached, spots: processAll(cached.raw), stale: false };
  }
  try {
    const urls = buildUrls();
    const [marine, weather, ext] = await Promise.all([
      fetchJson(urls.marine), fetchJson(urls.weather), fetchJson(urls.marineExt).catch(() => null)
    ]);
    const raw = { marine: fillFrom(toArray(marine), ext && toArray(ext)), weather: toArray(weather) };
    const data = { fetchedAt: new Date().toISOString(), raw };
    writeCache(data);
    return { ...data, spots: processAll(raw), stale: false };
  } catch (err) {
    if (cached) return { ...cached, spots: processAll(cached.raw), stale: true, error: String(err) };
    throw err;
  }
}
const toArray = (x) => (Array.isArray(x) ? x : [x]);

// Completa los huecos (null) del modelo principal con el modelo de respaldo, hora a hora
function fillFrom(main, ext) {
  if (!ext) return main;
  main.forEach((loc, i) => {
    const e = ext[i]?.hourly;
    if (!e || !loc?.hourly) return;
    for (const key of Object.keys(e)) {
      if (key === 'time' || !loc.hourly[key]) continue;
      loc.hourly[key] = loc.hourly[key].map((v, k) => (v == null ? e[key][k] ?? null : v));
    }
  });
  return main;
}

// ---------- Segundo modelo: ECMWF WAM025 ----------
// El modelo por defecto de Open-Meteo va a 0.25-0.5 grados. ecmwf_wam025 es el WAM del ECMWF a
// 0.25 grados, que en el Mediterráneo suele afinar la altura y el periodo. Va deliberadamente
// aparte: no entra en la caché de loadForecast(), no toca loadForecast() y no cambia nada de lo
// que ya se ve. Sólo sirve para contrastar, y quien lo pinte decide cómo.
//
// Tres cosas que conviene saber antes de usarlo:
//   · WAM025 sólo publica altura, periodo y dirección totales. Si se pide el desglose por trenes
//     de ola o el nivel del mar, Open-Meteo responde con los campos a null, así que aquí se piden
//     sólo los tres que de verdad trae.
//   · La malla no llega más arriba de 40.3°N, así que Vinaros y Peñíscola se quedan sin entrada.
//     No es un fallo: es que el modelo no cubre esa parte de la costa.
//   · El horizonte útil va hasta unos 12 días; más allá Open-Meteo empieza a devolver nulos al
//     final, así que { dias } se recorta a ese máximo. Tres días es lo que interesa para ver si la
//     previsión acierta con lo que hay medido ahora mismo.
const WAM_VARS = ['wave_height', 'wave_period', 'wave_direction'];
const WAM_DIAS_MAX = 12;

export async function loadEcmwfWam({ dias = 3 } = {}) {
  const pedido = Math.min(WAM_DIAS_MAX, Math.max(1, Math.round(dias) || 1));
  const seaLat = SPOTS.map((s) => s.seaLat).join(',');
  const seaLon = SPOTS.map((s) => s.seaLon).join(',');
  const url = `https://marine-api.open-meteo.com/v1/marine?latitude=${seaLat}&longitude=${seaLon}` +
    `&hourly=${WAM_VARS.join(',')}&models=ecmwf_wam025&forecast_days=${pedido}` +
    `&timezone=${TZ}&cell_selection=sea`;
  let crudo;
  try { crudo = await fetchJson(url); } catch { return {}; }
  const puntos = toArray(crudo);
  const out = {};
  SPOTS.forEach((spot, i) => {
    const h = puntos[i]?.hourly;
    if (!Array.isArray(h?.time) || !Array.isArray(h.wave_height)) return;
    // Fuera de la malla el modelo responde con la serie entera a null. Mejor no crear la entrada
    // que dejarla con ceros falsos: así se distingue "no hay dato" de "hay cero de oleaje".
    if (!h.wave_height.some((v) => Number.isFinite(v) && v >= 0)) return;
    out[spot.id] = {
      time: h.time,
      waveHeight: h.wave_height,
      wavePeriod: h.wave_period,
      waveDirection: h.wave_direction
    };
  });
  return out;
}

// ---------- Física de rompiente ----------
// Altura en rompiente (Komar & Gaudet): Hb = 0.39 · g^0.2 · (T · H²)^0.4
function breakingHeight(h, t) {
  if (!h || !t || h <= 0) return 0;
  return 0.39 * Math.pow(9.81, 0.2) * Math.pow(t * h * h, 0.4);
}

// Factor de exposición de un tren de olas para un spot: 1 de frente, cae con el ángulo,
// y casi 0 si viene de fuera de la ventana útil (sombra de puerto/cabo o de tierra).
function exposure(spot, dir) {
  if (dir == null) return 0;
  if (!inWindow(dir, spot.swellWindow)) return 0.08;
  const d = angDiff(dir, spot.facing);
  return Math.max(0.15, Math.pow(Math.cos((Math.min(d, 85) * Math.PI) / 180), 0.6));
}

function surfFromTrains(spot, trains) {
  // Suma energética de los trenes que llegan a la rompiente
  let e = 0;
  for (const tr of trains) {
    const hb = breakingHeight(tr.h, tr.t) * exposure(spot, tr.dir) * spot.exposureFactor;
    e += hb * hb;
  }
  const hb = Math.sqrt(e);
  return { min: hb * 0.75, max: hb * 1.15, mid: hb };
}

// ---------- Viento ----------
// Estados: offshore (terral), cross-off, cross, cross-on, onshore. Glassy si < 3 km/h o < 6 km/h con terral.
export function windState(spot, speed, dirFrom) {
  if (speed == null || dirFrom == null || isNaN(speed) || isNaN(dirFrom)) return { key: 'na', label: '–' };
  if (speed < 3.0) return { key: 'glassy', label: 'Calma' };
  const off = norm360(spot.facing + 180);
  const d = angDiff(dirFrom, off);
  if (speed < 6) {
    if (d <= 70) return { key: 'glassy', label: 'Calma' };
    if (d <= 110) return { key: 'cross', label: 'Cruzado' };
    if (d <= 145) return { key: 'crosson', label: 'Mar cruzado' };
    return { key: 'onshore', label: 'De mar' };
  }
  if (d <= 35) return { key: 'offshore', label: 'Terral' };
  if (d <= 70) return { key: 'crossoff', label: 'Terral cruzado' };
  if (d <= 110) return { key: 'cross', label: 'Cruzado' };
  if (d <= 145) return { key: 'crosson', label: 'Mar cruzado' };
  return { key: 'onshore', label: 'De mar' };
}

// ---------- Valoración (escala tipo Surfline) ----------
export const RATINGS = [
  { key: 'flat', label: 'Plato', color: 'var(--r-flat)' },
  { key: 'vpoor', label: 'Muy malo', color: 'var(--r-vpoor)' },
  { key: 'poor', label: 'Malo', color: 'var(--r-poor)' },
  { key: 'poorfair', label: 'Malo-Regular', color: 'var(--r-poorfair)' },
  { key: 'fair', label: 'Regular', color: 'var(--r-fair)' },
  { key: 'fairgood', label: 'Regular-Bueno', color: 'var(--r-fairgood)' },
  { key: 'good', label: 'Bueno', color: 'var(--r-good)' },
  { key: 'epic', label: 'Épico', color: 'var(--r-epic)' }
];

// Escala calibrada conservadora para el Mediterráneo:
// Evita estrellas infladas por periodo/terral con poca altura, incorpora el impacto de rachas
// y mar de viento desordenado como heurísticas, y distingue mar plato de datos ausentes.
export function rate(spot, surf, period, wind, speed, gust, extra = {}) {
  if (!surf || surf.mid == null || isNaN(surf.mid) || !isFinite(surf.mid)) return null;
  const h = surf.mid;
  if (h < 0.22) return 0;

  // Base según altura en rompiente (h)
  let s;
  if (h < 0.32) s = 1.0;
  else if (h < 0.45) s = 1.8;
  else if (h < 0.60) s = 2.6;
  else if (h < 0.75) s = 3.3;
  else if (h < 0.95) s = 4.0;
  else if (h < 1.25) s = 4.8;
  else if (h < 1.60) s = 5.5;
  else s = 6.0;

  if (spot?.maxGood && h > spot.maxGood) s -= 1.0;

  // Periodo (s)
  const p = (period != null && !isNaN(period) && isFinite(period)) ? period : 0;
  if (p < 4.0) s -= 1.2;
  else if (p < 5.2) s -= 0.5;
  else if (p >= 8.5) s += 0.9;
  else if (p >= 6.8) s += 0.5;

  // Viento y rachas
  const hasWind = wind && wind.key && wind.key !== 'na' && speed != null && !isNaN(speed) && isFinite(speed);
  if (hasWind) {
    const v = Math.max(0, speed);
    const g = (gust != null && !isNaN(gust) && isFinite(gust)) ? Math.max(v, gust) : v;
    const eff = Math.max(v, g * 0.65);

    let wAdj = 0;
    switch (wind.key) {
      case 'glassy':
        wAdj = 0.3;
        break;
      case 'offshore':
        wAdj = eff < 14 ? 0.4 : eff < 22 ? 0.1 : eff < 32 ? -0.5 : -1.2;
        break;
      case 'crossoff':
        wAdj = eff < 12 ? 0.2 : eff < 20 ? -0.2 : eff < 30 ? -0.8 : -1.5;
        break;
      case 'cross':
        wAdj = eff < 8 ? 0 : eff < 15 ? -0.6 : eff < 24 ? -1.3 : -2.2;
        break;
      case 'crosson':
        wAdj = eff < 6 ? -0.2 : eff < 12 ? -0.8 : eff < 20 ? -1.7 : -2.6;
        break;
      case 'onshore':
        wAdj = eff < 6 ? -0.4 : eff < 12 ? -1.1 : eff < 20 ? -2.0 : -3.0;
        break;
      default:
        wAdj = 0;
        break;
    }

    let gustPenalty = 0;
    if (g >= 26) gustPenalty += (g >= 40 ? 1.0 : g >= 30 ? 0.7 : 0.4);
    if (g >= 18 && g >= v * 1.8) gustPenalty += 0.4;
    if ((wind.key === 'onshore' || wind.key === 'crosson') && g >= 24) gustPenalty += 0.5;

    s += wAdj - gustPenalty;
  } else {
    if (s > 4.0) s = 4.0;
  }

  // Mar de viento corto / desordenado
  const wh = extra?.windWaveH;
  const wt = extra?.windWaveT;
  const sh = extra?.swellH ?? 0;
  if (wh != null && wh >= 0.35 && ((wt != null && wt < 4.8) || p < 4.8) && wh > sh * 1.2) {
    s -= 0.6;
  }

  // Techo duro por altura
  let maxCap = 7;
  if (h < 0.35) maxCap = 1;
  else if (h < 0.48) maxCap = 2;
  else if (h < 0.65) maxCap = 3;
  else if (h < 0.75) maxCap = 4;
  else if (h < 1.05) maxCap = 5;
  else if (h < 1.40) maxCap = 6;

  let rounded = Math.round(s);
  if (rounded >= 7) {
    const isCleanWind = wind && (wind.key === 'offshore' || wind.key === 'glassy' || wind.key === 'crossoff');
    if (!(h >= 1.40 && p >= 7.0 && isCleanWind && (speed ?? 0) < 25)) {
      rounded = 6;
    }
  }

  rounded = Math.min(rounded, maxCap);
  return Math.max(1, Math.min(7, rounded));
}

// Energía orientativa en kJ, proporcional a H²·T² (misma idea que la fila de energía de Surf-Forecast)
export const energyKJ = (h, t) => (h && t ? Math.round(0.5 * h * h * t * t * 10) : 0);

// ---------- Procesado por spot ----------
function processAll(raw) {
  const out = {};
  SPOTS.forEach((spot, i) => {
    const m = raw.marine[i]?.hourly;
    const w = raw.weather[i]?.hourly;
    const daily = raw.weather[i]?.daily;
    if (!m || !w) return;
    out[spot.id] = processSpot(spot, m, w, daily);
  });
  return out;
}

function processSpot(spot, m, w, daily) {
  const hours = m.time.map((time, k) => {
    const hasWaveData = (m.wave_height?.[k] != null && !isNaN(m.wave_height[k])) ||
      (m.swell_wave_height?.[k] != null && !isNaN(m.swell_wave_height[k])) ||
      (m.wind_wave_height?.[k] != null && !isNaN(m.wind_wave_height[k]));

    const windSpeed = w.wind_speed_10m?.[k];
    const windGust = w.wind_gusts_10m?.[k];
    const windDir = w.wind_direction_10m?.[k];
    const wind = windState(spot, windSpeed, windDir);

    if (!hasWaveData) {
      return {
        time, date: time.slice(0, 10), hour: +time.slice(11, 13),
        surf: { min: null, max: null, mid: null },
        rating: null,
        waveHeight: null, wavePeriod: null, waveDir: null,
        energy: 0,
        swells: [],
        windSpeed, windGust, windDir, wind,
        tide: m.sea_level_height_msl?.[k], sst: m.sea_surface_temperature?.[k],
        temp: w.temperature_2m?.[k], code: w.weather_code?.[k], isDay: w.is_day?.[k]
      };
    }

    const trains = [
      { h: m.swell_wave_height[k], t: m.swell_wave_period[k], dir: m.swell_wave_direction[k] },
      { h: m.secondary_swell_wave_height[k], t: m.secondary_swell_wave_period[k], dir: m.secondary_swell_wave_direction[k] },
      { h: m.wind_wave_height[k], t: m.wind_wave_period[k], dir: m.wind_wave_direction[k] }
    ];
    // Si la partición no existe, usar el total
    if (!trains.some((t) => t.h)) trains.push({ h: m.wave_height[k], t: m.wave_period[k], dir: m.wave_direction[k] });
    const surf = surfFromTrains(spot, trains);
    const period = m.wave_period[k] ?? m.swell_wave_period[k];
    const swells = trains
      .map((t, idx) => ({ ...t, kind: ['Fondo', 'Fondo 2', 'Viento', 'Total'][idx] }))
      .filter((t) => t.h && t.h >= 0.05)
      .sort((a, b) => b.h - a.h);
    const rating = rate(spot, surf, period, wind, windSpeed, windGust, {
      swellH: m.swell_wave_height?.[k],
      swellT: m.swell_wave_period?.[k],
      windWaveH: m.wind_wave_height?.[k],
      windWaveT: m.wind_wave_period?.[k]
    });
    return {
      time, date: time.slice(0, 10), hour: +time.slice(11, 13),
      surf, rating,
      waveHeight: m.wave_height[k], wavePeriod: period, waveDir: m.wave_direction[k],
      energy: energyKJ(m.wave_height[k], period),
      swells,
      windSpeed, windGust, windDir, wind,
      tide: m.sea_level_height_msl?.[k], sst: m.sea_surface_temperature?.[k],
      temp: w.temperature_2m?.[k], code: w.weather_code?.[k], isDay: w.is_day?.[k]
    };
  });

  const days = [];
  const byDate = new Map();
  hours.forEach((h) => { if (!byDate.has(h.date)) byDate.set(h.date, []); byDate.get(h.date).push(h); });
  let di = 0;
  for (const [date, hs] of byDate) {
    const daylight = hs.filter((h) => h.hour >= 7 && h.hour <= 20);
    const pick = daylight.length ? daylight : hs;
    const valid = pick.filter((h) => h.rating != null && !isNaN(h.rating));
    let dayRating = null;
    let best = null;
    if (valid.length > 0) {
      best = valid.reduce((a, b) => (b.rating > a.rating || (b.rating === a.rating && (b.surf?.mid ?? 0) > (a.surf?.mid ?? 0)) ? b : a));
      const topRatings = valid.map((h) => h.rating).sort((a, b) => b - a);
      if (topRatings[0] >= 5) {
        const countHigh = topRatings.filter((r) => r >= 5).length;
        dayRating = countHigh >= 2 ? topRatings[0] : (topRatings[1] ?? 4);
      } else {
        dayRating = topRatings[0];
      }
    }
    const validSurfs = pick.filter((h) => h.surf && h.surf.mid != null && !isNaN(h.surf.mid));
    days.push({
      date, hours: hs,
      rating: dayRating, best: best ?? hs[0],
      surfMin: validSurfs.length ? Math.min(...validSurfs.map((h) => h.surf.min)) : null,
      surfMax: validSurfs.length ? Math.max(...validSurfs.map((h) => h.surf.max)) : null,
      sunrise: daily?.sunrise?.[di]?.slice(11, 16), sunset: daily?.sunset?.[di]?.slice(11, 16),
      tempMax: daily?.temperature_2m_max?.[di]
    });
    di++;
  }
  return { spot, hours, days };
}

// Índice de la hora actual (o la más cercana) dentro de hours
export function nowIndex(hours) {
  const now = new Date();
  const key = new Intl.DateTimeFormat('sv-SE', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false })
    .format(now).replace(' ', 'T').slice(0, 13);
  const i = hours.findIndex((h) => h.time.slice(0, 13) === key);
  return i >= 0 ? i : 0;
}

// Extremos de marea (pleamar/bajamar) de un día
export function tideExtremes(hours) {
  const ex = [];
  for (let i = 1; i < hours.length - 1; i++) {
    const a = hours[i - 1].tide, b = hours[i].tide, c = hours[i + 1].tide;
    if (a == null || b == null || c == null) continue;
    if (b > a && b >= c) ex.push({ type: 'high', ...hours[i] });
    else if (b < a && b <= c) ex.push({ type: 'low', ...hours[i] });
  }
  return ex;
}

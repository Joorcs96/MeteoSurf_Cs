// forecast.js — Descarga de Open-Meteo por spot y cálculo de ola en rompiente, viento y calidad.
// Además carga los datos reales (data/realtime.json) y el modelo ecmwf_wam025 para comparar.
import { SPOTS } from './spots.js';
import { TIENE_FISICA, factorOleaje } from './physics.js';

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
  // Suma energética de los trenes que llegan a la rompiente.
  // En los 8 spots del estudio físico v3 el factor sale de trazar el rayo de ola sobre la
  // batimetría real (H_rompiente / H_offshore por dirección y periodo), así que sustituye a
  // Komar × exposure(), que era demasiado optimista: 0.36 m de 5.6 s del ESE en Planetario
  // daban 1.44× en vez de ~1.0×. En el resto de spots se sigue con Komar, que es lo único
  // que se puede afirmar sin medir el fondo.
  const v3 = TIENE_FISICA(spot.id);
  let e = 0;
  for (const tr of trains) {
    const hb = v3
      ? (tr.h || 0) * factorOleaje(spot.id, tr.dir, tr.t)
      : breakingHeight(tr.h, tr.t) * exposure(spot, tr.dir) * spot.exposureFactor;
    e += hb * hb;
  }
  const hb = Math.sqrt(e);
  return { min: hb * 0.75, max: hb * 1.15, mid: hb };
}

// ---------- Viento ----------
// Las rachas cuentan. Con 7 km/h de media y rachas de 18 el agua ya está revuelta, así que
// para decidir el estado y para castigar la nota se usa el viento efectivo
// max(media, 0.6 × racha), no la media sola.
export const windEfectivo = (speed, gust) => {
  const r = gust == null ? 0 : gust * 0.6;
  if (speed == null) return gust == null ? null : r;
  return Math.max(speed, r);
};

// Estados: offshore (terral), cross-off, cross, cross-on, onshore. Glassy si < 6 km/h.
export function windState(spot, speed, dirFrom, gust) {
  if (speed == null || dirFrom == null) return { key: 'na', label: '–', effective: null };
  const v = windEfectivo(speed, gust);
  if (v < 6) return { key: 'glassy', label: 'Calma', effective: v };
  const off = norm360(spot.facing + 180);
  const d = angDiff(dirFrom, off);
  if (d <= 35) return { key: 'offshore', label: 'Terral', effective: v };
  if (d <= 70) return { key: 'crossoff', label: 'Terral cruzado', effective: v };
  if (d <= 110) return { key: 'cross', label: 'Cruzado', effective: v };
  if (d <= 145) return { key: 'crosson', label: 'Mar cruzado', effective: v };
  return { key: 'onshore', label: 'De mar', effective: v };
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

// Escala calibrada para el Mediterráneo: con 0.5–0.7 m en rompiente y poco viento ya hay buen baño,
// y el periodo típico es de 4–6 s (no penaliza); a partir de 7 s es mar de fondo de calidad.
// El viento se puntúa con el efectivo (media o racha), que es lo que revuelve el agua.
function rate(spot, surf, period, wind, speed) {
  const h = surf.mid;
  if (h < 0.22) return 0;
  let s = h < 0.32 ? 1.5 : h < 0.45 ? 2.5 : h < 0.6 ? 3.5 : h < 0.85 ? 4.2 : h < 1.2 ? 5 : h < 1.8 ? 5.6 : 6;
  if (h > spot.maxGood) s -= 1; // el spot se satura o cierra
  if (period < 4) s -= 1; else if (period >= 9) s += 1; else if (period >= 7) s += 0.5;
  const v = wind?.effective ?? speed ?? 0;
  let pen = {
    glassy: 0.6,
    offshore: v < 25 ? 0.5 : v < 35 ? 0 : -1,
    crossoff: v < 20 ? 0.2 : -0.5,
    cross: v < 10 ? 0 : v < 18 ? -0.6 : v < 26 ? -1.2 : -2,
    crosson: v < 8 ? 0 : v < 14 ? -0.6 : v < 22 ? -1.5 : -2.5,
    onshore: v < 10 ? -0.4 : v < 15 ? -1 : v < 22 ? -2 : -3,
    na: 0
  }[wind.key];
  // Con el mar pequeño el viento de mar o de mar cruzado no sólo resta puntos: deshace las
  // olas que hay. Observado el 30/09 en Planetario, 0.34 m en rompiente con ~11 km/h
  // efectivos de ESE: "casi ninguna ola, se veía mar pero el viento lo estropeaba".
  if (h < 0.6 && (wind.key === 'onshore' || wind.key === 'crosson') && v >= 6 && v < 12) pen = Math.min(pen, -1);
  s += pen;
  s = Math.round(s);
  if (s >= 7 && !(h >= 1 && period >= 7 && (wind.key === 'offshore' || wind.key === 'glassy' || wind.key === 'crossoff'))) s = 6;
  return Math.max(1, Math.min(7, s));
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

// Una hora concreta a partir de los arrays horarios de Open-Meteo (marine m y weather w).
// Se exporta para que scripts/test_calibracion.mjs pueda comprobar la calibración con datos
// reales sin tocar la red ni la caché de localStorage.
export function horaForecast(spot, m, w, k) {
  const time = m.time[k];
  const trains = [
    { h: m.swell_wave_height[k], t: m.swell_wave_period[k], dir: m.swell_wave_direction[k] },
    { h: m.secondary_swell_wave_height[k], t: m.secondary_swell_wave_period[k], dir: m.secondary_swell_wave_direction[k] },
    { h: m.wind_wave_height[k], t: m.wind_wave_period[k], dir: m.wind_wave_direction[k] }
  ];
  // Si la partición no existe, usar el total
  if (!trains.some((t) => t.h)) trains.push({ h: m.wave_height[k], t: m.wave_period[k], dir: m.wave_direction[k] });
  const surf = surfFromTrains(spot, trains);
  const windSpeed = w.wind_speed_10m[k];
  const windDir = w.wind_direction_10m[k];
  const windGust = w.wind_gusts_10m[k];
  const wind = windState(spot, windSpeed, windDir, windGust);
  const period = m.wave_period[k] ?? m.swell_wave_period[k];
  const swells = trains
    .map((t, idx) => ({ ...t, kind: ['Fondo', 'Fondo 2', 'Viento', 'Total'][idx] }))
    .filter((t) => t.h && t.h >= 0.05)
    .sort((a, b) => b.h - a.h);
  return {
    time, date: time.slice(0, 10), hour: +time.slice(11, 13),
    surf, rating: rate(spot, surf, period ?? 0, wind, windSpeed),
    waveHeight: m.wave_height[k], wavePeriod: period, waveDir: m.wave_direction[k],
    energy: energyKJ(m.wave_height[k], period),
    swells,
    windSpeed, windGust, windDir, wind,
    tide: m.sea_level_height_msl[k], sst: m.sea_surface_temperature[k],
    temp: w.temperature_2m[k], code: w.weather_code[k], isDay: w.is_day[k]
  };
}

function processSpot(spot, m, w, daily) {
  const hours = m.time.map((time, k) => horaForecast(spot, m, w, k));

  const days = [];
  const byDate = new Map();
  hours.forEach((h) => { if (!byDate.has(h.date)) byDate.set(h.date, []); byDate.get(h.date).push(h); });
  let di = 0;
  for (const [date, hs] of byDate) {
    const daylight = hs.filter((h) => h.hour >= 7 && h.hour <= 20);
    const pick = daylight.length ? daylight : hs;
    const best = pick.reduce((a, b) => (b.rating > a.rating || (b.rating === a.rating && b.surf.mid > a.surf.mid) ? b : a));
    days.push({
      date, hours: hs,
      rating: best.rating, best,
      surfMin: Math.min(...pick.map((h) => h.surf.min)),
      surfMax: Math.max(...pick.map((h) => h.surf.max)),
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

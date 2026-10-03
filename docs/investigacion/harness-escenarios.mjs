// harness-escenarios.mjs — Auditoría de estrellas/calidad.
//
// Ejecuta el CÓDIGO REAL de js/forecast.js y las funciones exportadas de
// js/assistant.js sobre horas sintéticas. No modifica producción: sólo sustituye
// globalThis.fetch por un generador de respuestas Open-Meteo y llama a
// loadForecast({ force: true }), que es la misma ruta que usa la web.
//
// Uso:  node docs/investigacion/harness-escenarios.mjs
// Las entradas son SINTÉTICAS (inventadas a propósito para forzar casos), no
// medidas. Los factores de la tabla v3 sí son reales: salen del trazado de rayos
// sobre batimetría EMODnet del estudio calculos_v3 (fuera del repo).

import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { SPOTS } from '../../js/spots.js';
import * as F from '../../js/forecast.js';
import { bestWindows } from '../../js/assistant.js';

const N = 48;
const fmt = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', hourCycle: 'h23'
});
// Serie horaria sintética: las 24 h del día de hoy en Madrid y las 24 h del
// siguiente. Se construye con aritmética de calendario (sin conversiones de zona),
// así que el día 0 tiene las 24 horas y nowIndex() acierta. En un día de cambio de
// hora puede haber una hora repetida, como en la API real.
const HOY_MADRID = Object.fromEntries(fmt.formatToParts(new Date()).map((p) => [p.type, +p.value]));
const BASE = Date.UTC(HOY_MADRID.year, HOY_MADRID.month - 1, HOY_MADRID.day);
const TIMES = Array.from({ length: N }, (_, k) => {
  const d = new Date(BASE + k * 3600e3);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}T${String(k % 24).padStart(2, '0')}:00`;
});
// Guardar la salida en UTF-8 sin pasar por la consola de PowerShell
const OUTFILE = process.argv[2] || null;
const LINEAS = [];
const say = console.log;
console.log = (...a) => { LINEAS.push(a.map(String).join(' ')); say(...a); };
const fin = () => { if (OUTFILE) writeFileSync(OUTFILE, `${LINEAS.join('\n')}\n`, 'utf8'); };

// ---------- Réplica literal de app.js (para mostrar lo que ve el usuario) ----------
const starRating = (r) => r <= 1 ? 0 : r === 2 ? 1 : r === 3 ? 2 : r === 4 ? 3 : r === 5 ? 4 : 5; // app.js:50
const ratingLabel = (r) => F.RATINGS[r]?.label ?? '–';                                                 // app.js:49
const range = (s) => {                                                                                 // app.js:36-40
  const a = Math.max(0, Math.round(s.min * 10) / 10), b = Math.round(s.max * 10) / 10;
  if (b < 0.2) return '0–0.2';
  return a === b ? `${a}` : `${a}–${b}`;
};
const goodDay = (d) => Number(d?.rating) >= 5;                                                          // app.js:56
const goodLabel = (r) => Number(r) >= 6 ? 'Día muy bueno' : 'Día bueno';                                // app.js:57
// app.js:218-232 (bestWindowToday)
function bestWindowToday(f) {
  const day = f?.days?.[0];
  if (!day?.hours?.length) return null;
  const daylight = day.hours.filter((h) => h.hour >= 7 && h.hour <= 20);
  const pool = daylight.length ? daylight : day.hours;
  const bestRating = Math.max(...pool.map((h) => h.rating));
  const best = pool.filter((h) => h.rating === bestRating).reduce((a, b) => (b.surf.mid > a.surf.mid ? b : a));
  const bestPos = pool.indexOf(best);
  let first = bestPos, last = bestPos;
  while (first > 0 && pool[first - 1].rating === bestRating) first--;
  while (last < pool.length - 1 && pool[last + 1].rating === bestRating) last++;
  return { best, from: pool[first].hour, to: pool[last].hour + 1 };
}

// ---------- Generador de respuestas Open-Meteo ----------
let MARINE = null, WEATHER = null;
globalThis.fetch = async (url) => {
  const u = String(url);
  if (u.includes('ncep_gfswave016')) throw new Error('sin modelo de respaldo');
  if (u.startsWith('https://api.open-meteo.com')) return { ok: true, json: async () => WEATHER };
  return { ok: true, json: async () => MARINE };
};

const at = (s, key, k) => {
  const v = s[key];
  return typeof v === 'function' ? v(k) : v;
};
// Un escenario = una fila de datos horarios para un spot. Lo que no se declara
// va a null, que es lo mismo que un hueco de Open-Meteo.
function build(specs) {
  const marine = SPOTS.map(() => null), weather = SPOTS.map(() => null);
  for (const s of specs) {
    const i = SPOTS.findIndex((x) => x.id === s.id);
    const ser = (key) => TIMES.map((_, k) => at(s, key, k));
    marine[i] = { hourly: {
      time: TIMES,
      wave_height: ser('hs'), wave_period: ser('tp'), wave_direction: ser('dir'),
      swell_wave_height: ser('sh'), swell_wave_period: ser('st'), swell_wave_direction: ser('sd'),
      secondary_swell_wave_height: ser('xh'), secondary_swell_wave_period: ser('xt'), secondary_swell_wave_direction: ser('xd'),
      wind_wave_height: ser('wh'), wind_wave_period: ser('wt'), wind_wave_direction: ser('wdw'),
      sea_level_height_msl: ser('tide'), sea_surface_temperature: ser('sst')
    } };
    weather[i] = { hourly: {
      time: TIMES,
      wind_speed_10m: ser('ws'), wind_direction_10m: ser('wdir'), wind_gusts_10m: ser('gust'),
      temperature_2m: ser('temp'), weather_code: ser('code'), is_day: ser('day')
    } };
  }
  return { marine, weather };
}

async function run(specs) {
  const built = build(specs);
  MARINE = built.marine; WEATHER = built.weather;
  return F.loadForecast({ force: true });
}

// ---------- Escenarios (entradas sintéticas) ----------
const HOY = 'hoy';
const ESCENARIOS = [
  { n: 'A · Planetario — mar pequeño y corto con viento de mar',
    s: { id: 'Planetario', hs: 0.35, tp: 4, dir: 115, ws: 14, wdir: 115, gust: 22 } },
  { n: 'B · Planetario — mar pequeño pero limpio (terral flojo)',
    s: { id: 'Planetario', hs: 0.45, tp: 6, dir: 80, ws: 8, wdir: 300, gust: 12 } },
  { n: 'C · Planetario — mar bueno (0,9 m / 8 s / terral)',
    s: { id: 'Planetario', hs: 0.9, tp: 8, dir: 100, ws: 10, wdir: 300, gust: 16 } },
  { n: 'D · Planetario — el mismo mar bueno pero con rachas de 32 km/h',
    s: { id: 'Planetario', hs: 0.9, tp: 8, dir: 100, ws: 10, wdir: 300, gust: 32 } },
  { n: 'E · Voramar — mar pequeño del NE (fuera de su ventana [92,212])',
    s: { id: 'Voramar', hs: 0.5, tp: 5, dir: 60, ws: 10, wdir: 330, gust: 14 } },
  { n: 'F · Voramar — lo mismo con el mar en el borde de la ventana (92°)',
    s: { id: 'Voramar', hs: 0.5, tp: 5, dir: 92, ws: 10, wdir: 330, gust: 14 } },
  { n: 'G · Voramar — mar bueno del SE (1,0 m / 9 s / terral)',
    s: { id: 'Voramar', hs: 1.0, tp: 9, dir: 150, ws: 8, wdir: 330, gust: 12 } },
  { n: 'H · El Palaciet — mar pequeño del ESE con terral flojo',
    s: { id: 'Palaciet', hs: 0.5, tp: 5, dir: 130, ws: 10, wdir: 300, gust: 14 } },
  { n: 'I · El Palaciet — mismo mar pero con viento de mar de 18 km/h',
    s: { id: 'Palaciet', hs: 0.5, tp: 5, dir: 130, ws: 18, wdir: 130, gust: 26 } },
  { n: 'K · Planetario — satura (2,4 m / 10 s)',
    s: { id: 'Planetario', hs: 2.4, tp: 10, dir: 100, ws: 12, wdir: 300, gust: 18 } },
  { n: 'L · Planetario — sólo mar de viento del SE de 0,8 m / 3,5 s (sin mar de fondo)',
    s: { id: 'Planetario', wh: 0.8, wt: 3.5, wdw: 130, ws: 20, wdir: 130, gust: 28 } },
  { n: 'M · Planetario — mar de fondo pequeño del NE (0,45 m / 7 s) + mar de viento de 0,5 m del SE',
    s: { id: 'Planetario', sh: 0.45, st: 7, sd: 60, wh: 0.5, wt: 4, wdw: 130, hs: 0.62, tp: 6, dir: 60, ws: 16, wdir: 130, gust: 24 } },
  { n: 'N · Planetario — día partido: terral de 8 km/h hasta las 13h y de mar de 20 desde las 14h (mar fijo 0,6 m / 6 s)',
    s: { id: 'Planetario', hs: 0.6, tp: 6, dir: 100,
         ws: (k) => (TIMES[k].slice(11, 13) < '14' ? 8 : 20),
         wdir: (k) => (TIMES[k].slice(11, 13) < '14' ? 300 : 130),
         gust: (k) => (TIMES[k].slice(11, 13) < '14' ? 12 : 30) },
    detalleHoras: true }
];

// ---------- Tabla v3 (factores reales del estudio de rayos) ----------
const FACTOR_JSON = process.env.FACTOR_JSON ||
  'C:/Users/Jordi/orca/meteosurf_research/calculos_v3/datos/factor_oleaje.json';
let FACTORES = null;
if (existsSync(FACTOR_JSON)) {
  const j = JSON.parse(readFileSync(FACTOR_JSON, 'utf8'));
  FACTORES = j;
}
// Puerto de 05_calibration.py:factor_at (dirección circular, periodo saturado 4..10)
function factorAt(tbl, dir, T) {
  const fT = (dkey, tp) => {
    const row = tbl[String(((dkey % 360) + 360) % 360)];
    if (!row) return 0;
    const ts = Object.keys(row).map(Number).sort((a, b) => a - b);
    const lo = ts[0], hi = ts[ts.length - 1];
    tp = Math.min(hi, Math.max(lo, tp));
    if (tp <= lo) return row[String(lo)];
    if (tp >= hi) return row[String(hi)];
    const a = Math.max(...ts.filter((t) => t <= tp));
    const b = Math.min(...ts.filter((t) => t >= tp));
    if (a === b) return row[String(a)];
    return row[String(a)] + (row[String(b)] - row[String(a)]) * ((tp - a) / (b - a));
  };
  const d = ((dir % 360) + 360) % 360;
  const d0 = Math.floor(d / 10) * 10 % 360, d1 = (d0 + 10) % 360;
  return fT(d0, T) + (fT(d1, T) - fT(d0, T)) * ((d - d0) / 10);
}
const factorV3 = (sid, dir, T) => {
  const s = FACTORES?.[sid]?.factor_por_direccion_periodo;
  return s ? factorAt(s, dir, T) : null;
};

// ---------- Salida ----------
const pad = (s, n) => String(s).padEnd(n);
const num = (x, n = 2) => (x == null ? '–' : x.toFixed(n));

console.log(`Serie sintética: ${TIMES[0]} … ${TIMES[N - 1]} (${N} h, ${SPOTS.length} spots)\n`);

console.log('== 1. ESCENARIOS: qué ve el usuario ==');
for (const esp of ESCENARIOS) {
  const { n, s } = esp;
  const fc = await run([s]);
  const f = fc.spots[s.id];
  const h = f.hours[F.nowIndex(f.hours)];
  const dia = f.days[0];
  const win = bestWindowToday(f);
  const bw = bestWindows(fc, [f.spot], { days: 1, minRating: 3 });
  const mar = h.swells.map((x) => `${x.kind} ${num(x.h)}m ${x.t ?? '–'}s ${x.dir ?? '–'}°`).join(' + ') || 'sin trenes';
  console.log(`\n${n}`);
  const v = (x) => (typeof x === 'function' ? 'por horas' : x ?? '–');
console.log(`  entrada        Hs=${v(s.hs)} T=${v(s.tp)} dir=${v(s.dir)} viento=${v(s.ws)} km/h de ${v(s.wdir)}° (rachas ${v(s.gust)})`);
  console.log(`  mar de fondo   ${mar}`);
  console.log(`  altura rotunda ${range(h.surf)} m   (mid ${num(h.surf.mid)} · mín ${num(h.surf.min)} · máx ${num(h.surf.max)})`);
  console.log(`  viento         ${h.wind.label} ${num(h.windSpeed, 0)} km/h · ${h.wind.key} · rachas ${num(h.windGust, 0)}`);
  console.log(`  calidad        ${h.rating} "${ratingLabel(h.rating)}"  →  ${starRating(h.rating)} estrellas`);
  console.log(`  día completo   ${dia.rating} "${ratingLabel(dia.rating)}" ${starRating(dia.rating)}★ ${goodDay(dia) ? `· ${goodLabel(dia.rating)}` : ''}`);
  console.log(`  mejor franja   ${win ? `${String(win.from).padStart(2, '0')}–${String(win.to).padStart(2, '0')}h (${win.best.surf.mid.toFixed(2)} m, ${win.best.wind.label})` : '–'}`);
  console.log(`  ventanas ≥3    ${bw.length ? bw.map((w) => `${w.from}–${w.to}h r${w.rating}`).join(', ') : 'ninguna'}`);
  if (s.hs != null && FACTORES && factorV3(s.id, s.dir, s.tp) != null) {
    const f3 = factorV3(s.id, s.dir, s.tp);
    const h3 = s.hs * f3;
    console.log(`  v3 (rayos)     factor ${num(f3, 3)} → ${num(h3)} m   ·   ${f3 > 0 ? `app/v3 = ${num(h.surf.mid / h3)}×` : 'la app da altura donde el estudio v3 no entrega nada'}`);
  }
  if (esp.detalleHoras) {
    console.log('  hora a hora    ' + dia.hours.filter((x) => x.hour >= 6 && x.hour <= 21)
      .map((x) => `${x.hour}h=${x.rating}`).join(' '));
    const luz = dia.hours.filter((x) => x.hour >= 7 && x.hour <= 20);
    const buenas = luz.filter((x) => x.rating >= 5).length;
    console.log(`  resumen        ${buenas} de ${luz.length} horas de luz con calidad ≥5, pero el día se puntúa con la MEJOR → ${dia.rating} "${ratingLabel(dia.rating)}" (${starRating(dia.rating)}★${goodDay(dia) ? `, ${goodLabel(dia.rating)}` : ''})`);
  }
}

console.log('\n\n== 2. BARRIDO DE DIRECCIÓN en Planetario (Hs 0,6 m · T 6 s · calma) ==');
console.log('   Se ve el salto de la ventana de exposicion (js/forecast.js:189-194)');
console.log(`   ${pad('dir', 5)}${pad('v3 factor', 12)}${pad('surf.mid', 11)}${pad('stars', 8)}calidad`);
for (let d = 30; d <= 185; d += 5) {
  const fc = await run([{ id: 'Planetario', hs: 0.6, tp: 6, dir: d, ws: 3, wdir: 300, gust: 5 }]);
  const h = fc.spots.Planetario.hours[0];
  const f3 = factorV3('Planetario', d, 6);
  console.log(`   ${pad(d, 5)}${pad(f3 == null ? '–' : num(f3, 3), 12)}${pad(num(h.surf.mid), 11)}${pad(starRating(h.rating) + '★', 8)}${h.rating} ${ratingLabel(h.rating)}`);
}

console.log('\n\n== 3. BARRIDO DE ALTURA en Planetario (T 6 s · dir 100 · calma) ==');
console.log(`   ${pad('Hs', 6)}${pad('surf.mid', 11)}${pad('estrellas', 11)}calidad`);
for (const hs of [0.2, 0.3, 0.35, 0.4, 0.45, 0.5, 0.6, 0.7, 0.8, 0.9, 1.2, 1.6, 2.0, 2.5]) {
  const fc = await run([{ id: 'Planetario', hs, tp: 6, dir: 100, ws: 3, wdir: 300, gust: 5 }]);
  const h = fc.spots.Planetario.hours[0];
  console.log(`   ${pad(num(hs, 2), 6)}${pad(num(h.surf.mid), 11)}${pad(starRating(h.rating) + '★', 11)}${h.rating} ${ratingLabel(h.rating)}`);
}

console.log('\n\n== 4. BARRIDO DE PERIODO en Planetario (Hs 0,6 m · dir 100 · calma) ==');
console.log(`   ${pad('T', 6)}${pad('surf.mid', 11)}${pad('estrellas', 11)}calidad`);
for (const tp of [3, 4, 5, 6, 7, 8, 9, 10, 12]) {
  const fc = await run([{ id: 'Planetario', hs: 0.6, tp, dir: 100, ws: 3, wdir: 300, gust: 5 }]);
  const h = fc.spots.Planetario.hours[0];
  console.log(`   ${pad(tp, 6)}${pad(num(h.surf.mid), 11)}${pad(starRating(h.rating) + '★', 11)}${h.rating} ${ratingLabel(h.rating)}`);
}

console.log('\n\n== 5. BARRIDO DE VIENTO en Planetario (Hs 0,6 m · T 6 s · dir 100) ==');
console.log(`   ${pad('viento', 7)}${pad('estado', 16)}${pad('estrellas', 11)}calidad   (con rachas 3× la media)`);
for (const [wdir, ws, gust] of [[300, 4, 12], [300, 12, 24], [300, 20, 34], [340, 16, 26], [20, 8, 14], [115, 8, 20], [130, 16, 26], [160, 25, 38]]) {
  const fc = await run([{ id: 'Planetario', hs: 0.6, tp: 6, dir: 100, ws, wdir, gust }]);
  const h = fc.spots.Planetario.hours[0];
  console.log(`   ${pad(`${ws} de ${wdir}`, 7)}${pad(h.wind.label, 16)}${pad(starRating(h.rating) + '★', 11)}${h.rating} ${ratingLabel(h.rating)}`);
}

console.log('\n\n== 6. EL MISMO MAR, SÓLO CAMBIANDO EL VIENTO ==');
console.log('   Mar fijo (0,6 m / 6 s / 100°); sólo cambian viento y rachas.');
const misma = [];
for (const [wdir, ws, gust] of [[300, 6, 10], [300, 6, 30], [130, 4, 8], [130, 8, 14], [115, 6, 30], [130, 16, 30], [300, 20, 30]]) {
  const fc = await run([{ id: 'Planetario', hs: 0.6, tp: 6, dir: 100, ws, wdir, gust }]);
  const h = fc.spots.Planetario.hours[0];
  misma.push({ w: `${ws} km/h de ${wdir}° (rachas ${gust})`, r: h.rating, s: starRating(h.rating), l: ratingLabel(h.rating), k: h.wind.key });
}
for (const x of misma) console.log(`   ${pad(x.w, 28)}→ ${x.r} "${x.l}" ${x.s}★ [${x.k}]`);
console.log(`   ${misma[0].r === misma[1].r ? 'SIN cambio con el viento (las rachas no influyen)' : 'cambia'}`);

console.log('\n\n== 7. RESUMEN DE LA ESCALA DE ESTRELLAS (js/app.js:50) ==');
console.log('\n\n== 7. RESUMEN DE LA ESCALA DE ESTRELLAS (js/app.js:50) ==');
console.log(`   ${pad('rating', 8)}${pad('etiqueta', 16)}estrellas`);
for (let r = 0; r <= 7; r++) console.log(`   ${pad(r, 8)}${pad(F.RATINGS[r]?.label ?? '–', 16)}${starRating(r)}★`);
console.log('   8 niveles de calidad → 6 valores de estrellas: 6 y 7 son indistinguibles.');

console.log('\n\n== 8. FACTOR DE LA APP FRENTE AL FACTOR v3 (Planetario, dir = facing 102°) ==');
console.log('   app = surf.mid / Hs ;  v3 = factor_oleaje.json (rayos sobre batimetría)');
console.log(`   ${pad('Hs', 6)}${pad('T', 5)}${pad('app mid', 10)}${pad('app', 8)}${pad('v3', 8)}app/v3`);
for (const [hs, tp] of [[0.35, 4], [0.5, 5], [0.45, 6], [0.6, 6], [0.9, 8], [1.6, 9], [2.4, 10]]) {
  const fc = await run([{ id: 'Planetario', hs, tp, dir: 102, ws: 3, wdir: 300, gust: 5 }]);
  const mid = fc.spots.Planetario.hours[0].surf.mid;
  const f3 = factorV3('Planetario', 102, tp) || NaN;
  console.log(`   ${pad(num(hs, 2), 6)}${pad(tp, 5)}${pad(num(mid), 10)}${pad(num(mid / hs), 8)}${pad(num(f3), 8)}${num(mid / hs / f3)}×`);
}

fin();
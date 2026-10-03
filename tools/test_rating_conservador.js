// test_rating_conservador.js — Banco de pruebas de rating conservador y coherente
//
// Verifica:
// 1. Mar pequeño no produce notas altas ni estrellas infladas.
// 2. Periodo corto y rachas onshore penalizan la calidad como heurística.
// 3. Swell limpio aprovechable sigue alcanzando notas altas (Bueno / 5★).
// 4. Fronteras de categorías y monotonía sensata en 0–7 y estrellas 0–5.
// 5. Missing / NaN no inflan la calidad y se distingue mar plato de datos ausentes.
// 6. Coherencia de etiquetas, estrellas y clases en todos los consumidores.
//
// Ejecución: node tools/test_rating_conservador.js

import assert from 'node:assert';
import { SPOTS } from '../js/spots.js';
import * as F from '../js/forecast.js';
import { bestWindows } from '../js/assistant.js';

// Réplicas de formato de app.js
const ratingCls = (r) => (r == null || isNaN(r) ? 'r-na' : `r${r}`);
const ratingLabel = (r) => (r == null || isNaN(r) ? 'Sin datos' : (F.RATINGS[r]?.label ?? '–'));
const starRating = (r) => (r == null || isNaN(r) || r <= 1 ? 0 : r === 2 ? 1 : r === 3 ? 2 : r === 4 ? 3 : r === 5 ? 4 : 5);
const range = (s) => {
  if (!s || s.mid == null || isNaN(s.mid)) return '–';
  const a = Math.max(0, Math.round(s.min * 10) / 10), b = Math.round(s.max * 10) / 10;
  if (b < 0.2) return '0–0.2';
  return a === b ? `${a}` : `${a}–${b}`;
};
const goodDay = (d) => d?.rating != null && Number(d.rating) >= 5;
const goodLabel = (r) => (Number(r) >= 6 ? 'Día muy bueno' : 'Día bueno');

const spotPlanetario = SPOTS.find((s) => s.id === 'Planetario');
const spotVoramar = SPOTS.find((s) => s.id === 'Voramar');
const spotPalaciet = SPOTS.find((s) => s.id === 'Palaciet');

let passedTests = 0;
let totalTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  [OK] ${name}`);
  } catch (err) {
    console.error(`  [FAIL] ${name}`);
    console.error(`     Error: ${err.message}`);
    throw err;
  }
}

console.log('======================================================================');
console.log('PRUEBAS UNITARIAS: RATING CONSERVADOR, RACHAS Y DATOS NULOS');
console.log('======================================================================\n');

// 1. MAR PEQUEÑO NO ALTO
console.log('1. Verificación: Mar pequeño no alto (evitar inflar con periodo/terral)');
test('Hs 0.20m en rompiente no supera 1 estrella y r=0 para plato', () => {
  const rFlat = F.rate(spotPlanetario, { mid: 0.15 }, 8, { key: 'glassy' }, 2, 4);
  assert.strictEqual(rFlat, 0, 'h < 0.22 debe ser 0 Plato');
  assert.strictEqual(starRating(rFlat), 0, 'Plato debe ser 0 estrellas');

  const rTiny = F.rate(spotPlanetario, { mid: 0.30 }, 10, { key: 'offshore' }, 10, 12);
  assert(rTiny <= 1, `Olas de 0.30m no deben superar r=1 (obtenido ${rTiny})`);
  assert.strictEqual(starRating(rTiny), 0, '0.30m debe dar 0 estrellas');
});

test('Hs 0.45m con terral flojo no supera 2 estrellas (antes daba 4 estrellas)', () => {
  // Simulación: rompiente 0.46m (mid), T=6s, terral 8 km/h
  const r = F.rate(spotPlanetario, { mid: 0.46 }, 6, { key: 'offshore' }, 8, 12);
  assert(r <= 3, `0.46m con terral no debe superar r=3 (obtenido r=${r})`);
  assert(starRating(r) <= 2, `0.46m con terral no debe tener más de 2 estrellas (obtenido ${starRating(r)}★)`);
});

test('Hs 0.64m con terral flojo da máximo 3 estrellas (antes daba 4★ Día bueno)', () => {
  const r = F.rate(spotPlanetario, { mid: 0.64 }, 6, { key: 'offshore' }, 8, 12);
  assert(r <= 4, `0.64m en rompiente no debe superar r=4 Regular (obtenido r=${r})`);
  assert(starRating(r) <= 3, `0.64m no debe superar 3 estrellas (obtenido ${starRating(r)}★)`);
});

// 2. PERIODO CORTO Y RACHAS ONSHORE NO BUENOS
console.log('\n2. Verificación: Periodo corto y rachas onshore no buenos');
test('Rachas de 30 km/h penalizan respecto a rachas de 10 km/h con terral', () => {
  // Caso de la evidencia: mar 0.6m 6s 100° terral 6 km/h (h rompiente ~0.84m)
  const rCalmGusts = F.rate(spotPlanetario, { mid: 0.84 }, 6, { key: 'offshore' }, 6, 10);
  const rStrongGusts = F.rate(spotPlanetario, { mid: 0.84 }, 6, { key: 'offshore' }, 6, 30);
  assert(rStrongGusts < rCalmGusts, `Rachas de 30 deben bajar la nota respecto a rachas 10 (${rStrongGusts} < ${rCalmGusts})`);
  assert(rStrongGusts <= 3, `0.84m con rachas de 30 km/h no debe superar r=3 (obtenido ${rStrongGusts})`);
});

test('Viento onshore 6 km/h con rachas de 30 km/h da veredicto bajo (<= 2★, no 3★)', () => {
  const rOnshoreGusty = F.rate(spotPlanetario, { mid: 0.84 }, 6, { key: 'onshore' }, 6, 30);
  assert(rOnshoreGusty <= 2, `Onshore con rachas 30 debe dar r<=2 (obtenido r=${rOnshoreGusty})`);
  assert(starRating(rOnshoreGusty) <= 1, `Onshore con rachas 30 no debe tener más de 1 estrella (obtenido ${starRating(rOnshoreGusty)}★)`);
});

test('Periodo corto (3.5s) y mar de viento desordenado es fuertemente penalizado', () => {
  const rWindSea = F.rate(spotPlanetario, { mid: 0.79 }, 3.5, { key: 'onshore' }, 20, 28, {
    windWaveH: 0.8,
    windWaveT: 3.5,
    swellH: 0
  });
  assert(rWindSea <= 1, `Mar de viento corto de 3.5s debe dar r<=1 (obtenido r=${rWindSea})`);
  assert.strictEqual(starRating(rWindSea), 0, 'Mar de viento desordenado 3.5s debe ser 0 estrellas');
});

// 3. SWELL LIMPIO APROVECHABLE AÚN ALTO
console.log('\n3. Verificación: Swell limpio aprovechable sigue puntuando alto');
test('Swell de 0.9m / 8s con terral limpio sigue alcanzando Bueno (5 estrellas)', () => {
  // Rompiente ~1.30m, T=8s, terral 10 km/h, rachas 16 km/h
  const rGood = F.rate(spotPlanetario, { mid: 1.30 }, 8, { key: 'offshore' }, 10, 16);
  assert(rGood >= 6, `Swell limpio sólido debe ser r>=6 Bueno (obtenido r=${rGood})`);
  assert.strictEqual(starRating(rGood), 5, 'Debe alcanzar 5 estrellas');
});

test('Swell épico de 1.6m / 9s con terral flojo alcanza 7 (Épico, 5 estrellas)', () => {
  const rEpic = F.rate(spotPlanetario, { mid: 1.60 }, 9, { key: 'offshore' }, 8, 12);
  assert.strictEqual(rEpic, 7, `Debe alcanzar r=7 Épico (obtenido ${rEpic})`);
  assert.strictEqual(starRating(rEpic), 5, 'Debe ser 5 estrellas');
});

// 4. FRONTERAS DE CATEGORÍAS Y MONOTONÍA
console.log('\n4. Verificación: Fronteras de categorías y monotonía sensata');
test('Monotonía por altura: a igualdad de condiciones el rating nunca decrece', () => {
  const heights = [0.15, 0.25, 0.35, 0.50, 0.70, 0.90, 1.20, 1.50];
  let prevR = -1;
  for (const h of heights) {
    const r = F.rate(spotPlanetario, { mid: h }, 6, { key: 'offshore' }, 8, 12);
    assert(r >= prevR, `Monotonía rota en h=${h}: r=${r} < prev=${prevR}`);
    prevR = r;
  }
});

test('Monotonía por viento: terral >= cruzado >= de mar', () => {
  const rOff = F.rate(spotPlanetario, { mid: 0.85 }, 6, { key: 'offshore' }, 12, 16);
  const rCross = F.rate(spotPlanetario, { mid: 0.85 }, 6, { key: 'cross' }, 12, 16);
  const rOn = F.rate(spotPlanetario, { mid: 0.85 }, 6, { key: 'onshore' }, 12, 16);
  assert(rOff >= rCross, `Terral debe ser >= cruzado (${rOff} >= ${rCross})`);
  assert(rCross >= rOn, `Cruzado debe ser >= onshore (${rCross} >= ${rOn})`);
});

test('Monotonía por rachas: mayores rachas nunca aumentan la calidad', () => {
  const rGust10 = F.rate(spotPlanetario, { mid: 0.85 }, 6, { key: 'offshore' }, 8, 10);
  const rGust20 = F.rate(spotPlanetario, { mid: 0.85 }, 6, { key: 'offshore' }, 8, 20);
  const rGust30 = F.rate(spotPlanetario, { mid: 0.85 }, 6, { key: 'offshore' }, 8, 30);
  const rGust40 = F.rate(spotPlanetario, { mid: 0.85 }, 6, { key: 'offshore' }, 8, 40);
  assert(rGust10 >= rGust20 && rGust20 >= rGust30 && rGust30 >= rGust40, 'Rachas crecientes deben reducir o mantener el rating');
});

// 5. MISSING / NAN NO EXCELENTE Y DISTINCIÓN SIN DATOS / PLATO
console.log('\n5. Verificación: Missing/NaN no excelente y distinción sin datos vs plato');
test('surf.mid = NaN devuelve null (no r=6 "Bueno")', () => {
  const rNaN = F.rate(spotPlanetario, { mid: NaN }, 6, { key: 'glassy' }, 5, 8);
  assert.strictEqual(rNaN, null, 'NaN debe devolver null');
  assert.strictEqual(ratingLabel(rNaN), 'Sin datos', 'Etiqueta debe ser Sin datos');
  assert.strictEqual(starRating(rNaN), 0, 'Estrellas deben ser 0');
});

test('surf = null devuelve null y range() devuelve "–"', () => {
  const rNull = F.rate(spotPlanetario, null, 6, { key: 'glassy' }, 5, 8);
  assert.strictEqual(rNull, null, 'surf null debe devolver rating null');
  assert.strictEqual(range(null), '–', 'range(null) debe devolver "–"');
});

test('Diferenciación clara entre Plato real (0) y Sin datos (null)', () => {
  const rFlat = F.rate(spotPlanetario, { min: 0, max: 0.1, mid: 0.05 }, 4, { key: 'offshore' }, 5, 8);
  assert.strictEqual(rFlat, 0, 'Plato real debe ser 0');
  assert.strictEqual(ratingLabel(rFlat), 'Plato');
  assert.strictEqual(range({ min: 0, max: 0.1, mid: 0.05 }), '0–0.2');
  assert.strictEqual(ratingCls(rFlat), 'r0');

  const rMissing = null;
  assert.strictEqual(ratingLabel(rMissing), 'Sin datos');
  assert.strictEqual(range({ min: null, max: null, mid: null }), '–');
  assert.strictEqual(ratingCls(rMissing), 'r-na');
});

test('Periodo o viento NaN / ausentes no bonifican ni rompen el cálculo', () => {
  const rNoWind = F.rate(spotPlanetario, { mid: 0.8 }, 6, { key: 'na', label: '–' }, null, null);
  assert(rNoWind != null && rNoWind <= 4, `Sin viento no debe pasar de Regular (obtenido ${rNoWind})`);

  const rPeriodNaN = F.rate(spotPlanetario, { mid: 0.8 }, NaN, { key: 'offshore' }, 8, 12);
  assert(rPeriodNaN != null && rPeriodNaN <= 4, `Periodo NaN no debe recibir bonus de swell (obtenido ${rPeriodNaN})`);
});

// 6. COHERENCIA DE ETIQUETAS Y ESTRELLAS
console.log('\n6. Verificación: Coherencia de etiquetas y estrellas');
test('Escala de 0 a 7 mapea a etiquetas y estrellas correctas', () => {
  const expected = [
    { r: 0, label: 'Plato', stars: 0 },
    { r: 1, label: 'Muy malo', stars: 0 },
    { r: 2, label: 'Malo', stars: 1 },
    { r: 3, label: 'Malo-Regular', stars: 2 },
    { r: 4, label: 'Regular', stars: 3 },
    { r: 5, label: 'Regular-Bueno', stars: 4 },
    { r: 6, label: 'Bueno', stars: 5 },
    { r: 7, label: 'Épico', stars: 5 }
  ];
  for (const exp of expected) {
    assert.strictEqual(ratingLabel(exp.r), exp.label, `Rating ${exp.r} etiqueta errónea`);
    assert.strictEqual(starRating(exp.r), exp.stars, `Rating ${exp.r} estrellas erróneas`);
    assert.strictEqual(goodDay({ rating: exp.r }), exp.r >= 5, `goodDay erróneo en r=${exp.r}`);
  }
});

// 7. BANCO DE ESCENARIOS (COMPARACIÓN NUMÉRICA ANTES / DESPUÉS)
console.log('\n======================================================================');
console.log('DEMOSTRACIÓN NUMÉRICA: ESCENARIOS ANTES VS DESPUÉS');
console.log('======================================================================\n');

// Mock Open-Meteo para ejecutar el pipeline completo de loadForecast
const N = 48;
const fmt = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' });
const HOY_MADRID = Object.fromEntries(fmt.formatToParts(new Date()).map((p) => [p.type, +p.value]));
const BASE = Date.UTC(HOY_MADRID.year, HOY_MADRID.month - 1, HOY_MADRID.day);
const TIMES = Array.from({ length: N }, (_, k) => {
  const d = new Date(BASE + k * 3600e3);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}T${String(k % 24).padStart(2, '0')}:00`;
});

let MARINE = null, WEATHER = null;
globalThis.fetch = async (url) => {
  const u = String(url);
  if (u.includes('ncep_gfswave016')) throw new Error('sin modelo de respaldo');
  if (u.startsWith('https://api.open-meteo.com')) return { ok: true, json: async () => WEATHER };
  return { ok: true, json: async () => MARINE };
};

const at = (s, key, k) => (typeof s[key] === 'function' ? s[key](k) : s[key]);
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

async function runForecast(specs) {
  const built = build(specs);
  MARINE = built.marine;
  WEATHER = built.weather;
  return F.loadForecast({ force: true });
}

const COMPARATIVA = [
  {
    id: 'A',
    titulo: 'A · Planetario (0.35m / 4s / mar 14 km/h rachas 22)',
    spec: { id: 'Planetario', hs: 0.35, tp: 4, dir: 115, ws: 14, wdir: 115, gust: 22 },
    antes: '0.46m · 3 "Malo-Regular" 2★ · ventana 15–22h r3',
    esperado: '1★ o 0★, sin ventanas recomendadas'
  },
  {
    id: 'B',
    titulo: 'B · Planetario (0.45m / 6s / terral 8 km/h rachas 12)',
    spec: { id: 'Planetario', hs: 0.45, tp: 6, dir: 80, ws: 8, wdir: 300, gust: 12 },
    antes: '0.64m · 5 "Regular-Bueno" 4★ · Día bueno',
    esperado: '2★ o 3★ (no 4★), sin Día bueno'
  },
  {
    id: 'C',
    titulo: 'C · Planetario (0.90m / 8s / terral 10 km/h rachas 16)',
    spec: { id: 'Planetario', hs: 0.9, tp: 8, dir: 100, ws: 10, wdir: 300, gust: 16 },
    antes: '1.30m · 7 "Épico" 5★',
    esperado: '6 "Bueno" 5★ (conserva calificación alta de swell limpio)'
  },
  {
    id: 'D',
    titulo: 'D · Planetario (0.90m / 8s / terral 10 km/h con RACHAS 32 km/h)',
    spec: { id: 'Planetario', hs: 0.9, tp: 8, dir: 100, ws: 10, wdir: 300, gust: 32 },
    antes: '1.30m · 7 "Épico" 5★ (idéntico a rachas 16, no afectaba)',
    esperado: '5 "Regular-Bueno" 4★ (baja 1 nivel respecto a C por rachas 32)'
  },
  {
    id: 'H',
    titulo: 'H · El Palaciet (0.50m / 5s / terral 10 km/h rachas 14)',
    spec: { id: 'Palaciet', hs: 0.5, tp: 5, dir: 130, ws: 10, wdir: 300, gust: 14 },
    antes: '0.66m · 5 "Regular-Bueno" 4★ · Día bueno',
    esperado: '3 "Malo-Regular" 2★ (algo surfeable pero no inflado)'
  },
  {
    id: 'I',
    titulo: 'I · El Palaciet (0.50m / 5s / viento de mar 18 km/h rachas 26)',
    spec: { id: 'Palaciet', hs: 0.5, tp: 5, dir: 130, ws: 18, wdir: 130, gust: 26 },
    antes: '0.66m · 2 "Malo" 1★',
    esperado: '1 o 2 (0★ o 1★, estropeado por viento)'
  },
  {
    id: 'L',
    titulo: 'L · Planetario (sólo mar de viento 0.8m / 3.5s rachas 28)',
    spec: { id: 'Planetario', wh: 0.8, wt: 3.5, wdw: 130, ws: 20, wdir: 130, gust: 28 },
    antes: '0.79m · 1 "Muy malo" 0★',
    esperado: '1 "Muy malo" 0★'
  },
  {
    id: 'N',
    titulo: 'N · Planetario día partido (terral hasta 13h, onshore 20 rachas 30 desde 14h)',
    spec: {
      id: 'Planetario', hs: 0.6, tp: 6, dir: 100,
      ws: (k) => (TIMES[k].slice(11, 13) < '14' ? 8 : 20),
      wdir: (k) => (TIMES[k].slice(11, 13) < '14' ? 300 : 130),
      gust: (k) => (TIMES[k].slice(11, 13) < '14' ? 12 : 30)
    },
    antes: 'Día calificado con la mejor hora: 5 "Regular-Bueno" 4★ Día bueno',
    esperado: 'Día sin Día bueno si la tarde está destrozada'
  }
];

const pad = (s, n) => String(s).padEnd(n);

for (const sc of COMPARATIVA) {
  const fc = await runForecast([sc.spec]);
  const f = fc.spots[sc.spec.id];
  const h = f.hours[F.nowIndex(f.hours)];
  const dia = f.days[0];
  const bw = bestWindows(fc, [f.spot], { days: 1, minRating: 3 });

  console.log(`--- ${sc.titulo} ---`);
  console.log(`  ANTES:    ${sc.antes}`);
  console.log(`  AHORA:    ${h.surf.mid.toFixed(2)}m · ${h.rating} "${ratingLabel(h.rating)}" (${starRating(h.rating)}★)`);
  console.log(`            Día: ${dia.rating} "${ratingLabel(dia.rating)}" (${starRating(dia.rating)}★${goodDay(dia) ? `, ${goodLabel(dia.rating)}` : ''})`);
  console.log(`            Ventanas >=3: ${bw.length ? bw.map((w) => `${w.from}–${w.to}h r${w.rating}`).join(', ') : 'ninguna'}`);
  console.log(`  OBJETIVO: ${sc.esperado}\n`);

  if (sc.id === 'A') {
    assert(h.rating <= 2, 'Escenario A debe ser <= 2');
    assert(bw.length === 0, 'Escenario A no debe recomendar ventanas con mar pequeño y de mar');
  } else if (sc.id === 'B') {
    assert(h.rating <= 4, 'Escenario B no debe superar r=4');
    assert(starRating(h.rating) <= 3, 'Escenario B no debe superar 3★');
    assert(!goodDay(dia), 'Escenario B no debe ser Día bueno');
  } else if (sc.id === 'C') {
    assert(h.rating >= 6, 'Escenario C debe mantener calidad alta r>=6');
    assert.strictEqual(starRating(h.rating), 5, 'Escenario C debe ser 5★');
  } else if (sc.id === 'D') {
    assert(h.rating <= 5, 'Escenario D debe bajar de 6 a <=5 por rachas de 32 km/h');
  } else if (sc.id === 'H') {
    assert(h.rating <= 3, 'Escenario H Palaciet debe ser r<=3');
    assert(starRating(h.rating) <= 2, 'Palaciet mar pequeño debe ser <= 2★');
  }
}

console.log('======================================================================');
console.log(`TODAS LAS PRUEBAS SUPERADAS: ${passedTests}/${totalTests} pruebas unitarias y comparativas correctas.`);
console.log('======================================================================');

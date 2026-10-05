// test_calibracion.mjs — Comprueba que la prevision acierta con lo que se vio.
//
//   node scripts/test_calibracion.mjs
//
// El caso 1 es una observacion real de Jordi (30/09/2026, 18:40-19:00 en Planetario:
// "casi ninguna ola, pequena, se via mar pero el viento lo estropeaba"), con los datos de
// Open-Meteo de esa misma hora en el punto de mar. Los casos 2 y 3 son controles para que la
// calibracion no se quede corta por el otro lado: con mar de verdad y viento bueno la prevision
// tiene que seguir saliendo buena.
import { SPOTS } from '../js/spots.js';
import { RATINGS, horaForecast, windEfectivo, windState } from '../js/forecast.js';
import { TIENE_FISICA } from '../js/physics.js';

const spot = (id) => {
  const s = SPOTS.find((x) => x.id === id);
  if (!s) throw new Error(`Spot desconocido: ${id}`);
  return s;
};
const etiqueta = (r) => RATINGS.find((x) => x.key === ['flat', 'vpoor', 'poor', 'poorfair', 'fair', 'fairgood', 'good', 'epic'][r])?.label ?? '?';

// Monta los arrays horarios de Open-Meteo (marine m, weather w) que necesita horaForecast().
// h/t/dir son los valores del total; `swell` permite dar el mar de fondo por separado, que es
// como viene de la API cuando hay mas de un tren de ola.
function arrays({ hora = '2026-09-30T18:00', h, t, dir, swell, secundario, viento, vientoVela, vientoRacha, vientoDir }) {
  const sw = swell ?? { h, t, dir };
  const m = {
    time: [hora],
    wave_height: [h], wave_period: [t], wave_direction: [dir],
    swell_wave_height: [sw.h], swell_wave_period: [sw.t], swell_wave_direction: [sw.dir],
    secondary_swell_wave_height: [secundario?.h ?? 0], secondary_swell_wave_period: [secundario?.t ?? 4], secondary_swell_wave_direction: [secundario?.dir ?? sw.dir],
    wind_wave_height: [viento?.h ?? 0], wind_wave_period: [viento?.t ?? 3], wind_wave_direction: [viento?.dir ?? sw.dir],
    sea_level_height_msl: [0.1], sea_surface_temperature: [22]
  };
  const w = {
    time: [hora],
    wind_speed_10m: [vientoVela], wind_direction_10m: [vientoDir], wind_gusts_10m: [vientoRacha],
    temperature_2m: [22], weather_code: [0], is_day: [1]
  };
  return { m, w };
}

// La fórmula que usaba la web antes de este cambio (Komar × exposure), para comparar.
function breakingHeightAntigua(h, t) {
  if (!h || !t || h <= 0) return 0;
  return 0.39 * Math.pow(9.81, 0.2) * Math.pow(t * h * h, 0.4);
}
function alturaAntigua(s, m) {
  const dir = m.swell_wave_direction[0];
  const d = Math.abs(dir - s.facing);
  const dd = d > 180 ? 360 - d : d;
  const enVentana = dir >= s.swellWindow[0] && dir <= s.swellWindow[1];
  const expo = enVentana ? Math.max(0.15, Math.pow(Math.cos((Math.min(dd, 85) * Math.PI) / 180), 0.6)) : 0.08;
  return breakingHeightAntigua(m.swell_wave_height[0], m.swell_wave_period[0]) * expo * s.exposureFactor;
}

let fallos = 0;
let pruebas = 0;
function comprobar(nombre, ok, detalle) {
  pruebas++;
  if (!ok) fallos++;
  console.log(`${ok ? 'OK  ' : 'FALLO'} ${nombre}${detalle ? `  (${detalle})` : ''}`);
}

// ---------------------------------------------------------------------------------------------
// Caso 1. Observacion real: Planetario, 30/09/2026 18:40-19:00.
// Open-Meteo en el punto de mar: H 0.36-0.38 m, T 5.6 s, mar de fondo 0.34 m de 4.8-4.9 s del
// ESE (103-107), viento 6-8 km/h del ESE/ENE con rachas de 18 km/h, de cara a la playa.
// Jordi: "casi ninguna ola, pequena, se via mar pero el viento lo estropeaba".
// ---------------------------------------------------------------------------------------------
{
  const s = spot('Planetario');
  const { m, w } = arrays({
    hora: '2026-09-30T18:00',
    h: 0.37, t: 5.6, dir: 103,
    swell: { h: 0.34, t: 4.85, dir: 105 },
    secundario: { h: 0.02, t: 3.4, dir: 100 },
    viento: { h: 0.01, t: 2.6, dir: 95 },
    vientoVela: 7, vientoRacha: 18, vientoDir: 95
  });
  const f = horaForecast(s, m, w, 0);
  const antes = alturaAntigua(s, m);

  console.log('--- Caso 1: observacion real, Planetario 30/09 18:00 ---');
  console.log(`    mar de fondo ${m.swell_wave_height[0]} m / ${m.swell_wave_period[0]} s del ${m.swell_wave_direction[0]}`);
  console.log(`    total ${m.wave_height[0]} m / ${m.wave_period[0]} s`);
  console.log(`    viento ${w.wind_speed_10m[0]} km/h del ${w.wind_direction_10m[0]}, rachas ${w.wind_gusts_10m[0]}`);
  console.log(`    viento efectivo ${f.wind.effective.toFixed(1)} km/h (${f.wind.label})`);
  console.log(`    rompiente ANTES (Komar x exposure) ${antes.toFixed(2)} m -> AHORA ${f.surf.mid.toFixed(2)} m`);
  console.log(`    nota ${f.rating} (${etiqueta(f.rating)})`);

  comprobar('usa el factor del estudio v3', TIENE_FISICA(s.id));
  comprobar('altura en rompiente <= 0.35 m', f.surf.mid <= 0.35, `${f.surf.mid.toFixed(3)} m`);
  comprobar('nota <= 2 (Malo)', f.rating <= 2, `${f.rating} = ${etiqueta(f.rating)}`);
  comprobar('el viento de mar se reconoce', f.wind.key === 'onshore', f.wind.key);
  comprobar('las rachas cuentan (efectivo = max(media, 0.6 x racha))',
    Math.abs(f.wind.effective - windEfectivo(7, 18)) < 1e-9 && Math.abs(f.wind.effective - 10.8) < 1e-9,
    `${f.wind.effective.toFixed(1)} km/h`);
  comprobar('la nueva altura es menor que la de Komar', f.surf.mid < antes, `${antes.toFixed(2)} -> ${f.surf.mid.toFixed(2)} m`);

  // La misma hora un poco mas tarde (19:00) tiene que salir igual de mala.
  const m19 = { ...m, time: ['2026-09-30T19:00'] };
  const f19 = horaForecast(s, m19, w, 0);
  comprobar('tambien a las 19:00 <= 0.35 m y nota <= 2', f19.surf.mid <= 0.35 && f19.rating <= 2,
    `${f19.surf.mid.toFixed(2)} m, ${etiqueta(f19.rating)}`);
}

// ---------------------------------------------------------------------------------------------
// Caso 2 (control). 0.8 m de 7 s del E con terral de 8 km/h: tiene que ser un buen dia.
// La direccion 100 grados es la que la app rotula "E" (compass(100) = E) y es el sector bueno
// de Planetario, donde el estudio v3 da factor ~1.12 a 7 s.
// ---------------------------------------------------------------------------------------------
{
  const s = spot('Planetario');
  const { m, w } = arrays({ h: 0.8, t: 7, dir: 100, vientoVela: 8, vientoRacha: 10, vientoDir: 280 });
  const f = horaForecast(s, m, w, 0);
  console.log('--- Caso 2 (control): 0.8 m / 7 s del E con terral de 8 km/h ---');
  console.log(`    rompiente ${f.surf.mid.toFixed(2)} m, viento ${f.wind.label}, nota ${f.rating} (${etiqueta(f.rating)})`);
  comprobar('el terral se reconoce', f.wind.key === 'offshore', f.wind.key);
  comprobar('nota >= 5 (Regular-Bueno o mejor)', f.rating >= 5, `${f.rating} = ${etiqueta(f.rating)}`);
}

// ---------------------------------------------------------------------------------------------
// Caso 3 (control). 0.5 m de 5 s del E con calma: un bath sin viento tiene que ser Regular.
// ---------------------------------------------------------------------------------------------
{
  const s = spot('Planetario');
  const { m, w } = arrays({ h: 0.5, t: 5, dir: 100, vientoVela: 3, vientoRacha: 5, vientoDir: 100 });
  const f = horaForecast(s, m, w, 0);
  console.log('--- Caso 3 (control): 0.5 m / 5 s del E con calma ---');
  console.log(`    rompiente ${f.surf.mid.toFixed(2)} m, viento ${f.wind.label}, nota ${f.rating} (${etiqueta(f.rating)})`);
  comprobar('con 3 km/h y rachas de 5 sigue siendo Calma', f.wind.key === 'glassy', f.wind.key);
  comprobar('nota >= 3 (se puede surfear)', f.rating >= 3, `${f.rating} = ${etiqueta(f.rating)}`);
}

// ---------------------------------------------------------------------------------------------
// Caso 4. Observacion real: Planetario, 05/10/2026. Jordi: "solo se ha podido hacer surf por la
// manana temprano, de 6 a 9-11 h; a las 15 h casi plano". Open-Meteo (best_match) en el punto
// de mar daba casi lo mismo todo el dia (0.6 m), asi que la diferencia la tienen que marcar la
// fisica del fondo y la brisa de mar de la tarde (SE 9 km/h, rachas de 20).
// ---------------------------------------------------------------------------------------------
{
  const s = spot('Planetario');
  const manana = arrays({
    hora: '2026-10-05T07:00', h: 0.64, t: 5.45, dir: 81,
    swell: { h: 0.56, t: 4.4, dir: 72 }, secundario: { h: 0.3, t: 4.5, dir: 115 },
    viento: { h: 0.02, t: 2, dir: 340 }, vientoVela: 5.4, vientoRacha: 10.8, vientoDir: 318
  });
  const tarde = arrays({
    hora: '2026-10-05T15:00', h: 0.6, t: 5.8, dir: 79,
    swell: { h: 0.5, t: 4.4, dir: 69 }, secundario: { h: 0.24, t: 4.5, dir: 84 },
    viento: { h: 0.02, t: 2, dir: 101 }, vientoVela: 8.9, vientoRacha: 19.8, vientoDir: 133
  });
  const fm = horaForecast(s, manana.m, manana.w, 0);
  const ft = horaForecast(s, tarde.m, tarde.w, 0);
  console.log('--- Caso 4: observacion real, Planetario 05/10 ---');
  console.log(`    07 h: ${fm.surf.mid.toFixed(2)} m, ${fm.wind.label}, ${etiqueta(fm.rating)}`);
  console.log(`    15 h: ${ft.surf.mid.toFixed(2)} m, ${ft.wind.label}, ${etiqueta(ft.rating)}`);
  comprobar('a las 15 h casi plano: <= 0.40 m', ft.surf.mid <= 0.4, `${ft.surf.mid.toFixed(2)} m`);
  comprobar('a las 15 h nota <= 1 (Muy malo)', ft.rating <= 1, etiqueta(ft.rating));
  comprobar('la brisa de la tarde es viento de mar', ft.wind.key === 'onshore' || ft.wind.key === 'crosson', ft.wind.key);
  comprobar('la manana sale mejor que la tarde', fm.rating > ft.rating, `${fm.rating} > ${ft.rating}`);
}

// ---------------------------------------------------------------------------------------------
// Comprobaciones de que no se ha roto nada alrededor.
// ---------------------------------------------------------------------------------------------
{
  console.log('--- Resto ---');
  // Un spot sin tabla del estudio sigue con Komar y da una altura razonable.
  const s = spot('Nules');
  const { m, w } = arrays({ h: 0.9, t: 6, dir: 100, vientoVela: 10, vientoRacha: 14, vientoDir: 300 });
  const f = horaForecast(s, m, w, 0);
  comprobar('los spots sin estudio siguen usando Komar', !TIENE_FISICA(s.id) && f.surf.mid > 0 && f.surf.mid < 3,
    `${s.id}: ${f.surf.mid.toFixed(2)} m, ${etiqueta(f.rating)}`);

  // Calma con viento de tierra no puede pasar por 'Calma', y sin datos tampoco.
  const p = spot('Planetario');
  comprobar('sin viento no hay estado', windState(p, null, 100, null).key === 'na');
  comprobar('"Calma" solo por debajo de 6 km/h efectivos',
    windState(p, 5, 100, 4).key === 'glassy' && windState(p, 5, 100, 11).key !== 'glassy',
    `media 5 con rachas 11 -> ${windState(p, 5, 100, 11).key}`);

  // Las 8 tablas del estudio estan para 36 direcciones y 7 periodos.
  comprobar('los 7 spots del estudio tienen tabla', SPOTS.filter((x) => TIENE_FISICA(x.id)).length === 7,
    SPOTS.filter((x) => TIENE_FISICA(x.id)).map((x) => x.id).join(', '));
}

console.log('-'.repeat(60));
console.log(fallos ? `RESULTADO: FALLO (${fallos} de ${pruebas} comprobaciones)` : `RESULTADO: OK (${pruebas} comprobaciones)`);
process.exit(fallos ? 1 : 0);

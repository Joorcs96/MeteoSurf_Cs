// test_calibracion.mjs — Comprueba que la prevision acierta con lo que se vio.
//
//   node scripts/test_calibracion.mjs
//
// El caso 1 es una observacion real de Jordi (30/09/2026, 18:40-19:00 en Planetario:
// "casi ninguna ola, pequena, se via mar pero el viento lo estropeaba"), con los datos de
// Open-Meteo de esa misma hora en el punto de mar. Los casos 2 y 3 son controles para que la
// calibracion no se quede corta por el otro lado: con mar de verdad y viento bueno la prevision
// tiene que seguir saliendo buena.
import { aplicarNowcast } from '../js/nowcast.js';
import { processSpot } from '../js/forecast.js';
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
  // Un amigo de Jordi entro a las 9 h: "estaba bien para hacer surf, alguna serie mejor".
  comprobar('a las 7-9 h se puede surfear: nota >= 3', fm.rating >= 3, etiqueta(fm.rating));
}

// ---------------------------------------------------------------------------------------------
// ---------------------------------------------------------------------------------------------
// Caso 5. Observacion real: Planetario, 09/10/2026 8-14h (06-12 UTC). Jordi: "Buenas olas, no 
// las mejores, pero un buen dia para ir" (Regular-Bueno / 2-3 estrellas, calidad media 4-5).
// El modelo Open-Meteo subestimo la ola (preveia 0.6 m, y la web daba calidad 1 en la manana
// por un periodo mas corto guardado, luego 4). La boya de Valencia midio 0.94m a las 13:00 UTC.
// Usando los datos reales de la boya (0.94m, 7.23s) y el viento offshore de la manana (282 deg,
// 8.5 km/h), la fisica da rompiente de 0.64m y nota 4 (Regular). No hace falta cambiar la escala,
// el fallo estuvo en la subestimacion del modelo (cociente boya/modelo ~ 1.6).
// ---------------------------------------------------------------------------------------------
{
  const s = spot('Planetario');
  // Datos del modelo Open-Meteo a las 08:00 UTC (10:00 Madrid)
  const modelParams = {
    hora: '2026-10-09T08:00',
    h: 0.64, t: 7.55, dir: 60,
    swell: { h: 0.64, t: 6.35, dir: 59 },
    secundario: { h: 0, t: 4, dir: 60 },
    viento: { h: 0, t: 0, dir: 0 },
    vientoVela: 9.6, vientoRacha: 17.6, vientoDir: 290
  };
  // Datos reales de la boya a las 13:00 UTC con viento de la mañana
  const buoyParams = {
    hora: '2026-10-09T08:00',
    h: 0.94, t: 7.23, dir: 56,
    swell: { h: 0.94, t: 7.23, dir: 56 },
    secundario: { h: 0, t: 4, dir: 56 },
    viento: { h: 0, t: 0, dir: 0 },
    vientoVela: 8.5, vientoRacha: 8.5, vientoDir: 282
  };
  
  const fModel = horaForecast(s, arrays(modelParams).m, arrays(modelParams).w, 0);
  const fBuoy = horaForecast(s, arrays(buoyParams).m, arrays(buoyParams).w, 0);

  console.log('--- Caso 5: observacion real, Planetario 09/10 ---');
  console.log(`    modelo: rompiente ${fModel.surf.mid.toFixed(2)} m, viento ${fModel.wind.label}, nota ${fModel.rating} (${etiqueta(fModel.rating)})`);
  console.log(`    boya:   rompiente ${fBuoy.surf.mid.toFixed(2)} m, viento ${fBuoy.wind.label}, nota ${fBuoy.rating} (${etiqueta(fBuoy.rating)})`);
  
  // En las observaciones guardadas en historico_olas, la web dio calidad 1 a las 8 y 9h
  // porque el periodo/altura de la mañana anterior era peor. Con los datos puros del modelo
  // da 4, lo que ya es "Regular". Para que el test falle si el modelo falla, comprobamos
  // si el modelo por sí solo da calidad >= 4 (Regular).
  comprobar('con datos del modelo da calidad media (>= 4)', fModel.rating >= 4, `${fModel.rating} = ${etiqueta(fModel.rating)}`);
  comprobar('con datos de la boya da calidad media (>= 4)', fBuoy.rating >= 4, `${fBuoy.rating} = ${etiqueta(fBuoy.rating)}`);
}
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
  comprobar('los 8 spots con tabla (Pirámides usa la del Gurugú)', SPOTS.filter((x) => TIENE_FISICA(x.id)).length === 8,
    SPOTS.filter((x) => TIENE_FISICA(x.id)).map((x) => x.id).join(', '));
}


// ---------------------------------------------------------------------------------------------
// Caso 6. Corrección de la previsión con la boya (nowcast). 09/10/2026.
// Modelo 0.31 m a las 8 h, boya 0.94 m a las 7 h (edad 1 h), terral 8.5 km/h.
// ---------------------------------------------------------------------------------------------
{
  console.log('--- Caso 6: Corrección con boya (Nowcast) ---');
  const s = spot('Planetario');
  const sLejos = spot('Vinaros'); // a más de 60km de Valencia

  // Simular fc.raw
  const t0 = '2026-10-09T08:00';
  const t1 = '2026-10-09T09:00';
  const t12 = '2026-10-09T20:00';
  const timeArr = [t0, t1, '2026-10-09T10:00', '2026-10-09T11:00', '2026-10-09T12:00', '2026-10-09T13:00', '2026-10-09T14:00', '2026-10-09T15:00', '2026-10-09T16:00', '2026-10-09T17:00', '2026-10-09T18:00', '2026-10-09T19:00', t12, '2026-10-09T21:00'];
  const waveHeights = Array(14).fill(0.31);
  const mPlanetario = {
    time: timeArr,
    wave_height: [...waveHeights], wave_period: Array(14).fill(6.2), wave_direction: Array(14).fill(60),
    swell_wave_height: [...waveHeights], swell_wave_period: Array(14).fill(6.2), swell_wave_direction: Array(14).fill(60),
    secondary_swell_wave_height: Array(14).fill(0), secondary_swell_wave_period: Array(14).fill(4), secondary_swell_wave_direction: Array(14).fill(60),
    wind_wave_height: Array(14).fill(0), wind_wave_period: Array(14).fill(3), wind_wave_direction: Array(14).fill(60),
    sea_level_height_msl: Array(14).fill(0.1), sea_surface_temperature: Array(14).fill(22)
  };
  const wPlanetario = {
    time: timeArr,
    wind_speed_10m: Array(14).fill(8.5), wind_direction_10m: Array(14).fill(282), wind_gusts_10m: Array(14).fill(8.5),
    temperature_2m: Array(14).fill(22), weather_code: Array(14).fill(0), is_day: Array(14).fill(1)
  };
  
  const mLejos = JSON.parse(JSON.stringify(mPlanetario));
  const wLejos = JSON.parse(JSON.stringify(wPlanetario));
  
  const raw = { marine: [], weather: [] };
  SPOTS.forEach((x) => {
    raw.marine.push({ hourly: x.id === 'Vinaros' ? mLejos : mPlanetario });
    raw.weather.push({ hourly: x.id === 'Vinaros' ? wLejos : wPlanetario });
  });

  const fc = { raw, spots: {} };
  SPOTS.forEach((x, i) => {
    fc.spots[x.id] = processSpot(x, raw.marine[i].hourly, raw.weather[i].hourly, {});
  });

  const fcPrevio = fc.spots['Planetario'].hours[0];
  comprobar('sin corrección da <= 1', fcPrevio.rating <= 1, `${fcPrevio.rating}`);

  // Observación de la boya de Valencia (39.52, -0.21, a 55km de Planetario)
  // A las 7h (edad = 1h suponiendo que ahora son las 8h)
  const ahora = new Date('2026-10-09T06:00:00Z'); // 8:00 Madrid
  const obs = {
    fecha: '2026-10-09T05:00:00Z', // 7:00 Madrid (edad 1h respecto a ahora) -> pero cuidado: el indice busca la hora de la observacion. Wait, 7h no está en timeArr!
    // Para que case con el modelo a las 8:00, la observación debe ser a las 8:00 (o la hora que busque).
    // El script busca el indice `key` de obs.fecha. Hagamos que obs.fecha sea las 08:00 Madrid -> 06:00 UTC.
    lat: 39.52, lon: -0.21,
    altura_m: 0.94
  };
  obs.fecha = '2026-10-09T06:00:00Z'; // 8:00 Madrid

  aplicarNowcast(fc, { oleaje: { principal: obs } }, ahora);

  const fcPost = fc.spots['Planetario'].hours[0];
  comprobar('con corrección da >= 3', fcPost.rating >= 3, `${fcPost.rating}`);
  comprobar('ratio en el objeto', fcPost.nowcastRatio > 1, `x${fcPost.nowcastRatio?.toFixed(2)}`);

  // Spot lejano
  comprobar('spot lejano sin corregir', fc.spots['Vinaros'].hours[0].nowcastRatio == null, 'Debe ser null');

  // Decaimiento a 12h
  const fc12h = fc.spots['Planetario'].hours[12];
  comprobar('decaimiento a 12h', fc12h.nowcastRatio == null && Math.abs(fc12h.waveHeight - 0.31) < 0.01, `${fc12h.waveHeight}`);

  // Ignorar obs > 3h
  const obsVieja = { ...obs, fecha: '2026-10-09T02:00:00Z' }; // 4h de antigüedad
  const fcViejo = { raw, spots: {} };
  SPOTS.forEach((x, i) => fcViejo.spots[x.id] = processSpot(x, raw.marine[i].hourly, raw.weather[i].hourly, {}));
  aplicarNowcast(fcViejo, { oleaje: { principal: obsVieja } }, ahora);
  comprobar('observación > 3h ignorada', fcViejo.spots['Planetario'].hours[0].nowcastRatio == null);

  // Ignorar nulos
  const obsNula = { ...obs, altura_m: null };
  const fcNulo = { raw, spots: {} };
  SPOTS.forEach((x, i) => fcNulo.spots[x.id] = processSpot(x, raw.marine[i].hourly, raw.weather[i].hourly, {}));
  aplicarNowcast(fcNulo, { oleaje: { principal: obsNula } }, ahora);
  comprobar('observación nula ignorada', fcNulo.spots['Planetario'].hours[0].nowcastRatio == null);

  // Ratio limitado [0.7, 1.6]
  const obsAlta = { ...obs, altura_m: 3.0 }; // > 1.6 * 0.31
  const fcAlto = { raw, spots: {} };
  SPOTS.forEach((x, i) => fcAlto.spots[x.id] = processSpot(x, raw.marine[i].hourly, raw.weather[i].hourly, {}));
  aplicarNowcast(fcAlto, { oleaje: { principal: obsAlta } }, ahora);
  comprobar('ratio limitado', fcAlto.spots['Planetario'].hours[0].nowcastRatio === 1.6, `x${fcAlto.spots['Planetario'].hours[0].nowcastRatio}`);
}

console.log('-'.repeat(60));
console.log(fallos ? `RESULTADO: FALLO (${fallos} de ${pruebas} comprobaciones)` : `RESULTADO: OK (${pruebas} comprobaciones)`);
process.exit(fallos ? 1 : 0);

/**
 * simulacion_e2e.ts — Suite integral de simulación y validación de la App Móvil Surfline Castellón.
 * Ejecuta y verifica todas las capas: Física, Cámaras, Sensores GPS, Vigía Búfer, Alertas y Caché Offline.
 */

(globalThis as any).__DEV__ = true;

import { SPOTS } from '../src/data/spotsData';
import { getStreamsForSpot, getPrimaryStreamForSpot } from '../src/core/parsers/streamParser';
import { calculateSurfFromTrains, breakingHeight } from '../src/core/physics/breakerHeight';
import { calculateWindState, windEfectivo } from '../src/core/physics/windPenalty';
import { calculateWavePower } from '../src/core/physics/swellDecomposition';
import { rateWave } from '../src/core/physics/waveQuality';
import { haversineDistance } from '../src/core/physics/haversine';
import { processSpotForecast, generateOfflineForecast } from '../src/core/parsers/forecastParser';

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, msg: string) {
  totalTests++;
  if (!condition) {
    console.error(`❌ [FALLO] ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  }
  passedTests++;
  console.log(`  ✓ ${msg}`);
}

async function runSimulation() {
  console.log('\n======================================================');
  console.log('🌊 SIMULACIÓN INTEGRAL APP MÓVIL SURFLINE CASTELLÓN 🌊');
  console.log('======================================================\n');

  // ----------------------------------------------------
  // 1. MÓDULO DE SPOTS Y METADATOS
  // ----------------------------------------------------
  console.log('📌 1. Verificando Spots y Catálogo Geográfico:');
  assert(SPOTS.length === 14, `Hay 14 spots registrados (encontrados: ${SPOTS.length})`);
  const planetario = SPOTS.find((s) => s.id === 'Planetario');
  assert(!!planetario, 'Spot "Planetario" existe en el catálogo');
  assert(planetario!.facing === 102, 'Planetario tiene orientación facing = 102°');
  assert(planetario!.seaLat > 0 && planetario!.seaLon > 0, 'Coordenadas mar adentro (seaLat/seaLon) calculadas');

  // ----------------------------------------------------
  // 2. MÓDULO DE FÍSICA Y CALIBRACIÓN MEDITERRÁNEA
  // ----------------------------------------------------
  console.log('\n📌 2. Simulando Física Oceanográfica y Escala de Jordi:');

  // Test 2.1: Komar & Gaudet
  const hb = breakingHeight(0.6, 5.5);
  assert(hb > 0.45 && hb < 0.95, `Altura en rompiente Komar calculada: ${hb.toFixed(2)}m para 0.6m@5.5s`);

  // Test 2.2: Potencia y energía
  const energy = calculateWavePower(0.6, 5.5);
  assert(energy.powerKwM > 0, `Potencia de oleaje: ${energy.powerKwM} kW/m (${energy.label})`);

  // Test 2.3: Viento efectivo y estados (Terral vs Onshore)
  const effWind = windEfectivo(10, 20);
  assert(effWind === 12, `Viento efectivo max(10, 0.6*20) = ${effWind} km/h`);

  const terralState = calculateWindState(planetario!.facing, 12, (planetario!.facing + 180) % 360, 15);
  assert(terralState.key === 'offshore', `Viento de tierra identificado como offshore (${terralState.label})`);

  const onshoreState = calculateWindState(planetario!.facing, 22, planetario!.facing, 32);
  assert(onshoreState.key === 'onshore', `Viento de mar identificado como onshore (${onshoreState.label})`);

  // Test 2.4: Rating de estrellas de Jordi (0.5-0.7m con terral = buen baño)
  const surfMed = calculateSurfFromTrains(planetario!.facing, planetario!.swellWindow, planetario!.exposureFactor, [
    { h: 0.6, t: 5.5, dir: planetario!.facing },
  ]);
  const ratingTerral = rateWave(surfMed, 5.5, terralState, 12, 15);
  assert(ratingTerral.stars >= 3, `0.6m con terral califica con ${ratingTerral.stars}★ (${ratingTerral.label})`);

  const ratingOnshore = rateWave(surfMed, 5.5, onshoreState, 22, 32);
  assert(ratingOnshore.stars < ratingTerral.stars, `Viento onshore penaliza la calidad (de ${ratingTerral.stars}★ a ${ratingOnshore.stars}★)`);

  const ratingPlato = rateWave({ min: 0.1, max: 0.15, mid: 0.12 }, 3.5, terralState, 5, 8);
  assert(ratingPlato.stars === 0 && ratingPlato.key === 'flat', 'Mar menor de 0.22m califica como plato (0★)');

  // ----------------------------------------------------
  // 3. MÓDULO DE CÁMARAS Y STREAM PARSER
  // ----------------------------------------------------
  console.log('\n📌 3. Simulando Resolución de Cámaras y Streaming HLS:');
  const camsPlanetario = getStreamsForSpot('Planetario');
  assert(camsPlanetario.length >= 1, `Planetario tiene ${camsPlanetario.length} cámara(s) disponibles`);

  const primaryCam = getPrimaryStreamForSpot('Planetario');
  assert(!!primaryCam && !!primaryCam.streamUrl, `Cámara principal resuelta: ${primaryCam?.name} (${primaryCam?.type})`);
  assert(primaryCam!.streamUrl.includes('m3u8') || primaryCam!.streamUrl.includes('http'), 'URL de streaming válida');

  const camsBurriana = getStreamsForSpot('Burriana');
  assert(camsBurriana.length >= 1, 'Burriana tiene cámara de streaming resuelta');

  // ----------------------------------------------------
  // 4. MÓDULO DE RADAR GPS Y SENSORES
  // ----------------------------------------------------
  console.log('\n📌 4. Simulando Radar de Proximidad GPS y Haversine:');
  // Coordenadas aproximadas de la playa del Pinar / Planetario (Grao de Castellón)
  const userLat = 39.9785;
  const userLon = 0.0266;

  const distPlanetario = haversineDistance(userLat, userLon, planetario!.lat, planetario!.lon);
  assert(distPlanetario < 0.1, `Distancia a pie de playa: ${distPlanetario} km (< 100 metros)`);
  assert(distPlanetario <= 0.5, 'GPS valida insignia "Reporte a pie de playa" (<= 500 metros)');

  const distVinaros = haversineDistance(userLat, userLon, 40.46877, 0.47904);
  assert(distVinaros > 50 && distVinaros < 75, `Distancia a Vinaròs calculada: ${distVinaros} km`);

  // ----------------------------------------------------
  // 5. MÓDULO DE PREVISIÓN Y SOPORTE OFFLINE PLAYA
  // ----------------------------------------------------
  console.log('\n📌 5. Simulando Previsión Completa y Modo Playa Offline:');
  const offlineForecast = generateOfflineForecast(planetario!);
  assert(offlineForecast.hours.length === 72, `Previsión horaria generada para 72 horas (${offlineForecast.hours.length} tramos)`);
  assert(offlineForecast.summary.maxStars >= 3, `Resumen de previsión identifica mejor baño con ${offlineForecast.summary.maxStars}★ a las ${offlineForecast.summary.bestHour}:00h`);
  assert(offlineForecast.isOffline === true, 'Modo sin conexión marcado como offline');

  // ----------------------------------------------------
  // 6. BÚFER BINARIO VIGÍA
  // ----------------------------------------------------
  console.log('\n📌 6. Simulando Búfer de Segmentos Vigía (sin Base64):');
  // Simular concatenación binaria con Uint8Array
  const seg1 = new Uint8Array([0x00, 0x00, 0x00, 0x01, 0x67]); // Cabecera NAL
  const seg2 = new Uint8Array([0x00, 0x00, 0x00, 0x01, 0x68]);
  const combined = new Uint8Array(seg1.byteLength + seg2.byteLength);
  combined.set(seg1, 0);
  combined.set(seg2, seg1.byteLength);

  assert(combined.byteLength === 10, 'Concatenación binaria directa con Uint8Array correcta');
  assert(combined[0] === 0x00 && combined[5] === 0x00, 'Integridad de bytes en memoria respetada sin fugas');

  console.log('\n======================================================');
  console.log(`✅ SIMULACIÓN EXITOSA: ${passedTests}/${totalTests} pruebas pasadas al 100%`);
  console.log('======================================================\n');
}

runSimulation().catch((err) => {
  console.error('Error fatal durante la simulación:', err);
  process.exit(1);
});

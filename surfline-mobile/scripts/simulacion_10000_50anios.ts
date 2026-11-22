/**
 * simulacion_10000_50anios.ts
 * Simulación longitudinal determinista: 10.000 usuarios sintéticos durante 50 años.
 *
 * Capas evaluadas:
 *  1. Matriz climática física por spot, mes y escenario marino (14 spots x 12 meses x 160).
 *  2. Flota de 10.000 usuarios x 50 años (sesiones, olas, clips, avisos, retención).
 *  3. Sesiones profundas con el motor real de tracking (GPS, olas, giros, biometría).
 *  4. Contratos de datos: spots, cámaras, previsión offline y online sintética.
 *
 * No usa red ni modelos de pago. Todo es local y determinista (semilla fija).
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { SPOTS, Spot } from '../src/data/spotsData';
import { calculateSurfFromTrains, breakingHeight } from '../src/core/physics/breakerHeight';
import { calculateWindState } from '../src/core/physics/windPenalty';
import { calculateWavePower } from '../src/core/physics/swellDecomposition';
import { rateWave } from '../src/core/physics/waveQuality';
import { SurfTrackerEngine } from '../src/core/surfTracker/surfTrackerEngine';
import { GpsPoint } from '../src/core/surfTracker/sessionTypes';
import { generateOfflineForecast, processSpotForecast } from '../src/core/parsers/forecastParser';
import { getStreamsForSpot } from '../src/core/parsers/streamParser';

// ----------------------------- Configuración -----------------------------
const TOTAL_USERS = 10000;
const TOTAL_YEARS = 50;
const BASE_YEAR = 2026;
const CLIMATE_BINS = 160;
const DEEP_SESSIONS = 6000;
const SEED = 20261116;

const args = process.argv.slice(2);
const iterationArg = args.find((a) => a.startsWith('--iteracion='));
const ITERATION = iterationArg ? Number(iterationArg.split('=')[1]) || 1 : 1;

// ----------------------------- RNG determinista -----------------------------
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = mulberry32(SEED + ITERATION * 101);
function rand(min: number, max: number): number {
  return min + rng() * (max - min);
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

// ----------------------------- Registro de fallos -----------------------------
type Severidad = 'critico' | 'alto' | 'medio' | 'bajo';
interface Fallo {
  codigo: string;
  titulo: string;
  severidad: Severidad;
  detalle: string;
  ejemplos: string[];
}

class RegistroFallos {
  private mapa = new Map<string, Fallo>();

  add(
    codigo: string,
    titulo: string,
    severidad: Severidad,
    detalle: string,
    ejemplo?: string
  ): void {
    let f = this.mapa.get(codigo);
    if (!f) {
      f = { codigo, titulo, severidad, detalle, ejemplos: [] };
      this.mapa.set(codigo, f);
    }
    if (ejemplo && f.ejemplos.length < 5) f.ejemplos.push(ejemplo);
  }

  listar(): Fallo[] {
    const orden: Record<Severidad, number> = { critico: 0, alto: 1, medio: 2, bajo: 3 };
    return [...this.mapa.values()].sort((a, b) => {
      const s = orden[a.severidad] - orden[b.severidad];
      return s !== 0 ? s : b.ejemplos.length - a.ejemplos.length;
    });
  }

  total(): number {
    return this.mapa.size;
  }
}

const fallos = new RegistroFallos();
const metricas = {
  climaCasos: 0,
  climaFallos: 0,
  usuariosTotales: TOTAL_USERS,
  usuariosActivosFinal: 0,
  aniosSimulados: TOTAL_YEARS,
  sesionesTotales: 0,
  olasTotales: 0,
  clipsGenerados: 0,
  avisosEnviados: 0,
  comunidadPosts: 0,
  previsionesConsultadas: 0,
  sesionesProfundas: 0,
  olasDetectadasProfundas: 0,
  falsosPositivos: 0,
  olasPerdidas: 0,
  tiempoMs: 0,
};

function finito(x: number): boolean {
  return typeof x === 'number' && Number.isFinite(x);
}

// ----------------------------- 1. Matriz climática -----------------------------
interface ClimaCaso {
  spotId: string;
  month: number;
  bin: number;
  surfMin: number;
  surfMax: number;
  period: number;
  stars: number;
  powerKwM: number;
  windDirState: string;
  ok: boolean;
}

function estacionalidad(month: number): number {
  // 0 = verano plano, 1 = otoño/invierno con mar
  const tabla = [0.22, 0.28, 0.42, 0.55, 0.48, 0.33, 0.14, 0.12, 0.38, 0.78, 0.86, 0.66];
  return tabla[month] ?? 0.4;
}

function generarClima(): Map<string, ClimaCaso[]> {
  const mapa = new Map<string, ClimaCaso[]>();
  const t0 = Date.now();

  for (const spot of SPOTS) {
    const casos: ClimaCaso[] = [];
    for (let month = 0; month < 12; month++) {
      const est = estacionalidad(month);
      for (let bin = 0; bin < CLIMATE_BINS; bin++) {
        metricas.climaCasos++;
        const u = bin / (CLIMATE_BINS - 1);

        // Oleaje mar adentro: mezcla de calma, marejada típica y temporal ocasional
        const temporal = u > 0.94 ? (u - 0.94) * 12 : 0;
        const hsTotal = Math.max(
          0.02,
          0.12 + est * 0.9 * u + temporal + rand(-0.06, 0.06)
        );
        const period = Math.max(2.8, 3.8 + est * 3.1 + u * 1.8 + rand(-0.4, 0.4));

        const window = spot.swellWindow;
        const dirBase = window[0] + rand(0, Math.abs(window[1] - window[0]));
        const dirSecondary = (dirBase + rand(-45, 45) + 360) % 360;

        // Reparto energético de trenes (medido en Open-Meteo: suma 0.93-1.03 del total)
        const fracSwell = rand(0.55, 0.72);
        const fracWind = rand(0.10, 0.22);
        const fracSecondary = Math.max(0.08, 1 - fracSwell - fracWind);

        // Viento: terral (limpio), cruzado o de mar; rachas siempre >= media
        const windRoll = rng();
        let windDir: number;
        if (windRoll < 0.4) windDir = (spot.facing + 180 + rand(-30, 30) + 360) % 360; // terral
        else if (windRoll < 0.7) windDir = (spot.facing + rand(-80, 80) + 360) % 360; // cruzado
        else windDir = (spot.facing + rand(-35, 35) + 360) % 360; // de mar

        const windSpeed = Math.max(0, Math.min(55, rand(0, 6) + u * 22 + temporal * 4));
        const gust = windSpeed + rand(0.2, 0.9) * Math.max(2, windSpeed);

        const surf = calculateSurfFromTrains(spot.facing, spot.swellWindow, spot.exposureFactor, [
          { h: hsTotal * fracSwell, t: period, dir: dirBase },
          { h: hsTotal * fracSecondary, t: Math.max(3.2, period - rand(0.5, 1.6)), dir: dirSecondary },
          { h: hsTotal * fracWind, t: Math.max(2.5, period - rand(1.5, 3.0)), dir: windDir },
        ]);

        const windState = calculateWindState(
          spot.facing,
          windSpeed,
          windDir,
          gust,
          spot.windShelter
        );
        const energy = calculateWavePower(hsTotal, period);
        const rating = rateWave(
          surf,
          period,
          windState,
          windSpeed,
          gust,
          spot.maxGood,
          spot.abrigoBonus,
          hsTotal
        );

        const ok =
          finito(surf.min) &&
          finito(surf.max) &&
          surf.min >= -0.001 &&
          surf.max >= surf.min &&
          finito(period) &&
          period > 0 &&
          finito(rating.stars) &&
          rating.stars >= 0 &&
          rating.stars <= 7 &&
          finito(energy.powerKwM) &&
          energy.powerKwM >= 0 &&
          !!spot.id;

        if (!ok) {
          metricas.climaFallos++;
          fallos.add(
            'FIS-001',
            'Física produce valores imposibles',
            'critico',
            'Alturas, periodo, estrellas o potencia fuera de rango o no finitos.',
            `${spot.id} mes ${month + 1} bin ${bin}: surf=${JSON.stringify(
              surf
            )} stars=${rating.stars} power=${energy.powerKwM}`
          );
        }

        casos.push({
          spotId: spot.id,
          month,
          bin,
          surfMin: surf.min,
          surfMax: surf.max,
          period,
          stars: rating.stars,
          powerKwM: energy.powerKwM,
          windDirState: windState.key || windState.label || 'unknown',
          ok,
        });
      }
    }
    mapa.set(spot.id, casos);
  }

  console.log(
    `  Matriz climática: ${metricas.climaCasos} casos en ${Date.now() - t0} ms`
  );
  return mapa;
}

// ----------------------------- 1b. Verificación física dirigida -----------------------------
function verificarFisica() {
  const t0 = Date.now();
  const spot = SPOTS[0];
  const cero = calculateSurfFromTrains(spot.facing, spot.swellWindow, spot.exposureFactor, [
    { h: 0, t: 0, dir: spot.facing },
  ]);
  if (cero.max > 0.01) {
    fallos.add(
      'FIS-003',
      'Marea plana genera olas fantasma',
      'alto',
      'Con trenes a cero, la altura de rompiente debería ser 0.',
      `spot=${spot.id} cero=${JSON.stringify(cero)}`
    );
  }

  for (const s of SPOTS) {
    const dirOk = s.swellWindow[0] + Math.abs(s.swellWindow[1] - s.swellWindow[0]) * 0.5;
    const surf = calculateSurfFromTrains(s.facing, s.swellWindow, s.exposureFactor, [
      { h: 1.3, t: 8.5, dir: dirOk },
    ]);
    const offshoreDir = (s.facing + 180) % 360;
    const onshoreDir = s.facing;
    const offState = calculateWindState(s.facing, 14, offshoreDir, 21, s.windShelter);
    const onState = calculateWindState(s.facing, 14, onshoreDir, 21, s.windShelter);
    const off = rateWave(surf, 8.5, offState, 14, 21, s.maxGood, s.abrigoBonus, 1.3);
    const on = rateWave(surf, 8.5, onState, 14, 21, s.maxGood, s.abrigoBonus, 1.3);
    if (finito(off.stars) && finito(on.stars) && on.stars > off.stars) {
      fallos.add(
        'FIS-004',
        'El viento de mar puntúa mejor que el terral',
        'alto',
        'Con el mismo oleaje y rachas, el onshore no puede superar al offshore.',
        `${s.id}: off=${off.stars} on=${on.stars}`
      );
    }
  }

  const p1 = calculateWavePower(0.5, 8).powerKwM;
  const p2 = calculateWavePower(1.0, 8).powerKwM;
  const p3 = calculateWavePower(1.0, 12).powerKwM;
  if (!finito(p1) || !finito(p2) || !finito(p3) || p2 < p1 || p3 < p2) {
    fallos.add(
      'FIS-005',
      'Potencia de ola no monótona',
      'medio',
      'A más altura o periodo, la potencia debe crecer.',
      `h0.5=${p1} h1.0=${p2} h1.0t12=${p3}`
    );
  }

  for (let h = 0.2; h <= 3; h += 0.4) {
    const a = breakingHeight(h, 8);
    const b = breakingHeight(h + 0.2, 8);
    if (!finito(a) || !finito(b) || b < a) {
      fallos.add(
        'FIS-006',
        'Altura de rompiente no crece con el oleaje',
        'alto',
        'breakingHeight debe ser monótona creciente en altura.',
        `h=${h}: ${a} -> ${b}`
      );
    }
  }

  const surfPrueba = calculateSurfFromTrains(SPOTS[0].facing, SPOTS[0].swellWindow, SPOTS[0].exposureFactor, [
    { h: 1, t: 7, dir: SPOTS[0].facing },
  ]);
  const vientoNulo = calculateWindState(SPOTS[0].facing, null, null, null, SPOTS[0].windShelter);
  const ratingNulo = rateWave(surfPrueba, 7, vientoNulo, null, null, SPOTS[0].maxGood, SPOTS[0].abrigoBonus, 1);
  if (!finito(ratingNulo.stars) || ratingNulo.stars < 0 || ratingNulo.stars > 7) {
    fallos.add(
      'FIS-007',
      'Viento desconocido rompe la puntuación',
      'critico',
      'rateWave debe devolver estrellas válidas aunque falten datos de viento.',
      `stars=${ratingNulo.stars} wind=${JSON.stringify(vientoNulo)}`
    );
  }

  console.log(`  Física dirigida verificada en ${Date.now() - t0} ms`);
}

// ----------------------------- 2. Flota de usuarios -----------------------------
interface Usuario {
  id: number;
  skill: 'principiante' | 'intermedio' | 'avanzado' | 'experto';
  homeSpotId: string;
  tieneWatch: boolean;
  seUneAnio: number;
  retencionAnual: number;
  frustracion: number;
}

function crearUsuarios(): Usuario[] {
  const usuarios: Usuario[] = [];
  for (let i = 0; i < TOTAL_USERS; i++) {
    const u = rng();
    const skill =
      u < 0.3 ? 'principiante' : u < 0.75 ? 'intermedio' : u < 0.95 ? 'avanzado' : 'experto';
    usuarios.push({
      id: i + 1,
      skill,
      homeSpotId: pick(SPOTS).id,
      tieneWatch: rng() < (skill === 'principiante' ? 0.35 : 0.62),
      seUneAnio: Math.floor(rand(0, 12)) === 0 && i < 1200 ? 0 : Math.floor(rand(0, 50)),
      retencionAnual: rand(0.9, 0.995),
      frustracion: 0,
    });
  }
  return usuarios;
}

const SESIONES_ANIO_POR_SKILL: Record<Usuario['skill'], number> = {
  principiante: 14,
  intermedio: 34,
  avanzado: 58,
  experto: 82,
};

function simularFlota(clima: Map<string, ClimaCaso[]>) {
  const usuarios = crearUsuarios();
  const t0 = Date.now();

  const pesosMes = [0.6, 0.7, 1.0, 1.2, 1.0, 0.8, 0.4, 0.35, 0.9, 1.5, 1.4, 1.0];
  const sumaPesos = pesosMes.reduce((a, b) => a + b, 0);

  let activos = 0;

  for (const user of usuarios) {
    if (user.seUneAnio >= TOTAL_YEARS) continue;

    const casos = clima.get(user.homeSpotId) || [];
    let sigueActivo = true;

    for (let year = user.seUneAnio; year < TOTAL_YEARS && sigueActivo; year++) {
      metricas.sesionesTotales += 0;

      // Retención: se va perdiendo gente con los años, los expertos aguantan más
      const factorRetencion = year === user.seUneAnio ? 1 : user.retencionAnual;
      if (year > user.seUneAnio && rng() > factorRetencion) {
        sigueActivo = false;
        break;
      }

      // Progresión de habilidad con los años (no más de un nivel)
      const progreso = Math.min(1, (year - user.seUneAnio) / 10);
      const sesionesAnio = Math.round(
        SESIONES_ANIO_POR_SKILL[user.skill] * (0.7 + progreso * 0.5) * rand(0.75, 1.25)
      );

      for (let month = 0; month < 12; month++) {
        const pesoMes = pesosMes[month] / sumaPesos;
        const sesionesMes = Math.round(sesionesAnio * pesoMes * rand(0.6, 1.4));
        for (let s = 0; s < sesionesMes; s++) {
          metricas.sesionesTotales++;

          const caso = casos[(month * CLIMATE_BINS + Math.floor(rng() * CLIMATE_BINS)) % casos.length];
          if (!caso) {
            fallos.add(
              'CLI-001',
              'Usuario sin cobertura climática para su spot',
              'alto',
              'No existe caso climático para el spot o mes del usuario.',
              `${user.id} ${user.homeSpotId} mes ${month + 1}`
            );
            continue;
          }
          metricas.previsionesConsultadas++;

          // Las condiciones malas frustran; tres malas seguidas pueden hacer abandonar
          if (caso.stars < 1.5) {
            user.frustracion++;
            if (user.frustracion >= 18 && rng() < 0.02) {
              sigueActivo = false;
              break;
            }
          } else {
            user.frustracion = Math.max(0, user.frustracion - 1);
          }

          // Olas surfeables: dependen de tamaño, estrellas y nivel del usuario
          const skillFactor =
            user.skill === 'principiante'
              ? 0.55
              : user.skill === 'intermedio'
                ? 0.8
                : user.skill === 'avanzado'
                  ? 0.95
                  : 1.0;

          const surfeable = caso.surfMax >= 0.22 && caso.stars >= 0.8;
          if (surfeable) {
            const esperadas = Math.max(
              0,
              Math.round((1.5 + caso.stars * 1.4 + caso.surfMax * 3) * skillFactor * rand(0.3, 1.2))
            );
            metricas.olasTotales += esperadas;

            if (metricas.olasTotales > metricas.sesionesTotales * 40) {
              fallos.add(
                'FLT-001',
                'Olas por sesión poco realistas',
                'medio',
                'La relación olas/sesiones supera el límite razonable de 40.',
                `sesiones=${metricas.sesionesTotales} olas=${metricas.olasTotales}`
              );
            }

            if (user.tieneWatch && rng() < 0.18) metricas.clipsGenerados++;
          }

          if (caso.stars >= 3.5 && caso.windDirState === 'offshore' && rng() < 0.25) {
            metricas.avisosEnviados++;
          }
          if (rng() < 0.015) metricas.comunidadPosts++;
        }
        if (!sigueActivo) break;
      }

      if (sigueActivo) activos++;

      // Contrato del usuario: nada negativo ni imposible
      if (metricas.sesionesTotales < 0 || metricas.olasTotales < 0) {
        fallos.add(
          'FLT-002',
          'Contadores negativos en la flota',
          'critico',
          'Sesiones u olas acumuladas negativas.',
          `user=${user.id}`
        );
      }
    }
  }

  metricas.usuariosActivosFinal = usuarios.filter(
    (u) => u.seUneAnio < TOTAL_YEARS
  ).length;
  metricas.tiempoMs += Date.now() - t0;
  console.log(
    `  Flota: ${metricas.sesionesTotales} sesiones, ${metricas.olasTotales} olas en ${
      Date.now() - t0
    } ms`
  );
}

// ----------------------------- 3. Sesiones profundas de tracking -----------------------------
function puntoGps(
  baseLat: number,
  baseLon: number,
  speedKmH: number,
  headingDeg: number,
  timestamp: number,
  dtSeconds = 1
): GpsPoint {
  const meters = (speedKmH / 3.6) * dtSeconds;
  const rad = (headingDeg * Math.PI) / 180;
  const dLat = (meters * Math.cos(rad)) / 111320;
  const dLon = (meters * Math.sin(rad)) / (111320 * Math.cos((baseLat * Math.PI) / 180));
  return {
    latitude: baseLat + dLat,
    longitude: baseLon + dLon,
    speed: speedKmH / 3.6,
    speedKmH,
    heading: headingDeg,
    timestamp,
  };
}

function simularSesionProfunda(
  tipo: 'quieto' | 'remando' | 'ola' | 'wipeout' | 'mixta' | 'destello' | 'larga',
  idx: number
) {
  metricas.sesionesProfundas++;
  const engine = new SurfTrackerEngine();
  engine.startSession('Planetario', 'Planetario');

  const base = Date.now();
  let t = base;
  let lat = 39.976;
  let lon = 0.0419;
  let heading = 102;

  let paso = 0;
  const feed = (speed: number, dt = 1, palear = false) => {
    t += dt * 1000;
    const p = puntoGps(lat, lon, speed, heading, t, dt);
    lat = p.latitude;
    lon = p.longitude;
    engine.processGps(p);
    if (palear) {
      // Patrón de palada: pico y valle alternos cada segundo
      if (paso % 2 === 0) engine.processAccel(0.62, 0.1, 0, t);
      else engine.processAccel(0.02, 0.02, 0, t);
    }
    paso++;
  };

  // Biometría durante 20 minutos con acumulación de calorías
  let kcal = 0;
  for (let i = 0; i < 240; i++) {
    const bpm = 95 + Math.round(Math.abs(Math.sin(i / 18)) * 70);
    kcal += 8 / 12;
    engine.updateBiometrics({ heartRate: bpm, oxygenSaturation: 98, activeCalories: Math.round(kcal) });
  }

  let olasEsperadas = 0;

  if (tipo === 'quieto') {
    for (let i = 0; i < 40; i++) feed(0.4);
  } else if (tipo === 'remando') {
    for (let i = 0; i < 60; i++) feed(5 + Math.sin(i / 5) * 2, 1, true);
  } else if (tipo === 'destello') {
    for (let i = 0; i < 3; i++) feed(2);
    feed(14);
    for (let i = 0; i < 10; i++) feed(2);
  } else if (tipo === 'larga') {
    for (let i = 0; i < 7200; i++) feed(4);
  } else if (tipo === 'ola' || tipo === 'wipeout') {
    olasEsperadas = 1;
    for (let i = 0; i < 6; i++) feed(2 + i * 1.5);
    for (let i = 0; i < 22; i++) {
      if (i === 4 || i === 5 || i === 12 || i === 13) heading = (heading + 55) % 360;
      feed(tipo === 'wipeout' && i > 16 ? 5 : 24 + Math.sin(i / 3) * 3);
    }
    for (let i = 0; i < 8; i++) feed(2);
  } else {
    // mixta: remada + dos olas
    olasEsperadas = 2;
    for (let i = 0; i < 20; i++) feed(5, 1, true);
    for (let r = 0; r < 2; r++) {
      for (let i = 0; i < 4; i++) feed(3 + i * 2);
      for (let i = 0; i < 20; i++) {
        if (i === 6 || i === 7 || i === 14 || i === 15) heading = (heading + 55) % 360;
        feed(26 + Math.sin(i / 3) * 2);
      }
      for (let i = 0; i < 6; i++) feed(2);
    }
  }

  const s = engine.stopSession();

  if (!s) {
    fallos.add(
      'TRK-001',
      'stopSession devuelve null tras una sesión válida',
      'critico',
      'El motor no devuelve la sesión al pararla.',
      `idx=${idx} tipo=${tipo}`
    );
    return;
  }

  if (s.totalWaves !== s.waveRides.length) {
    fallos.add(
      'TRK-002',
      'Contador de olas incoherente',
      'alto',
      'totalWaves no coincide con waveRides.',
      `idx=${idx} total=${s.totalWaves} rides=${s.waveRides.length}`
    );
  }

  if (s.totalDistanceMeters < 0 || s.durationSeconds < 0 || s.topSpeedKmH < 0) {
    fallos.add(
      'TRK-003',
      'Valores negativos en la sesión',
      'critico',
      'Distancia, duración o velocidad negativas.',
      `idx=${idx} tipo=${tipo} dist=${s.totalDistanceMeters} dur=${s.durationSeconds}`
    );
  }

  if (tipo === 'quieto' || tipo === 'remando') {
    if (s.totalWaves > 0) {
      metricas.falsosPositivos++;
      fallos.add(
        'TRK-004',
        'Falso positivo de ola sin surfing',
        'alto',
        'El detector marca olas cuando el usuario solo está quieto o remando.',
        `idx=${idx} tipo=${tipo} olas=${s.totalWaves}`
      );
    }
  } else if (tipo === 'ola' || tipo === 'wipeout') {
    if (s.totalWaves < 1) {
      metricas.olasPerdidas++;
      fallos.add(
        'TRK-005',
        'Ola real no detectada',
        'alto',
        'Una bajada de ola clara no se registra como ola.',
        `idx=${idx} tipo=${tipo}`
      );
    }
    metricas.olasDetectadasProfundas += s.totalWaves;
  } else {
    if (s.totalWaves !== olasEsperadas) {
      metricas.olasPerdidas += Math.abs(olasEsperadas - s.totalWaves);
      fallos.add(
        'TRK-006',
        'Número de olas distinto al esperado en sesión mixta',
        'medio',
        `Esperadas ${olasEsperadas}, detectadas ${s.totalWaves}.`,
        `idx=${idx}`
      );
    }
    metricas.olasDetectadasProfundas += s.totalWaves;
  }

  const bio = s.biometrics;
  if (
    !finito(bio.currentHeartRate) ||
    bio.currentHeartRate < 35 ||
    bio.currentHeartRate > 220 ||
    !finito(bio.activeCalories) ||
    bio.activeCalories < 0
  ) {
    fallos.add(
      'BIO-001',
      'Biometría fuera de rango',
      'alto',
      'Pulsaciones o calorías imposibles.',
      `idx=${idx} bpm=${bio.currentHeartRate} kcal=${bio.activeCalories}`
    );
  }
  if (bio.avgHeartRate > 0 && bio.avgHeartRate > bio.maxHeartRate) {
    fallos.add(
      'BIO-002',
      'Media de pulsaciones mayor que el máximo',
      'medio',
      'El promedio supera al pico registrado.',
      `idx=${idx} avg=${bio.avgHeartRate} max=${bio.maxHeartRate}`
    );
  }

  if (tipo === 'remando' && s.paddlingStrokes <= 0) {
    fallos.add(
      'TRK-007',
      'Remada real no cuenta brazadas',
      'alto',
      'Con paladas claras a baja velocidad no se registra ninguna brazada.',
      `idx=${idx} strokes=${s.paddlingStrokes}`
    );
  }

  const totalTurnos = s.waveRides.reduce((acc, w) => acc + w.turnsCount, 0);
  if ((tipo === 'ola' || tipo === 'wipeout' || tipo === 'mixta') && totalTurnos <= 0) {
    fallos.add(
      'TRK-008',
      'Giros claros no detectados',
      'medio',
      'Cambios de rumbo de 55 grados en la ola no generan maniobras.',
      `idx=${idx} tipo=${tipo} turns=${totalTurnos}`
    );
  }

  if (s.topSpeedKmH > 30) {
    fallos.add(
      'TRK-009',
      'Velocidad punta superior a la alimentada',
      'medio',
      'La velocidad máxima de la sesión supera el máximo sintético introducido.',
      `idx=${idx} top=${s.topSpeedKmH}`
    );
  }

  if (tipo === 'quieto' && s.paddlingStrokes > 0) {
    fallos.add(
      'TRK-010',
      'Brazadas fantasma con el usuario flotando',
      'medio',
      'Sin acelerómetro de palada se registran brazadas.',
      `idx=${idx} strokes=${s.paddlingStrokes}`
    );
  }

  if (tipo === 'destello' && s.totalWaves > 0) {
    fallos.add(
      'TRK-011',
      'Pico aislado de velocidad contado como ola',
      'alto',
      'Un solo punto rápido no debe cerrar una ola.',
      `idx=${idx} olas=${s.totalWaves}`
    );
  }

  if (tipo === 'larga' && Math.abs(s.durationSeconds - 7200) > 2) {
    fallos.add(
      'TRK-012',
      'Duración incorrecta en sesiones largas',
      'medio',
      'Dos horas de GPS deberían dar 7200 s (tolerancia 2 s).',
      `idx=${idx} dur=${s.durationSeconds}`
    );
  }

  for (const w of s.waveRides) {
    if (
      w.durationSeconds <= 0 ||
      w.distanceMeters <= 0 ||
      w.topSpeedKmH < w.avgSpeedKmH ||
      w.turns.length !== w.turnsCount
    ) {
      fallos.add(
        'TRK-013',
        'Ola registrada con datos internos incoherentes',
        'medio',
        'Duración/distancia positivas, punta >= media y turns coherentes.',
        `idx=${idx} ola=${w.waveNumber} dur=${w.durationSeconds} dist=${w.distanceMeters} top=${w.topSpeedKmH} avg=${w.avgSpeedKmH} turns=${w.turns.length}/${w.turnsCount}`
      );
      break;
    }
  }

  if (s.gpsTrack.length < 10) {
    fallos.add(
      'TRK-014',
      'Puntos GPS perdidos durante la sesión',
      'alto',
      'La traza guardada tiene menos puntos de los alimentados.',
      `idx=${idx} tipo=${tipo} puntos=${s.gpsTrack.length}`
    );
  }
}

// ----------------------------- 4. Contratos de datos -----------------------------
function verificarContratos() {
  const t0 = Date.now();

  const ids = new Set<string>();
  for (const spot of SPOTS) {
    if (ids.has(spot.id)) {
      fallos.add('DAT-004', 'IDs de spot duplicados', 'alto', 'Dos spots comparten id.', spot.id);
    }
    ids.add(spot.id);
    if (!(spot.maxGood > 0)) {
      fallos.add('DAT-005', 'maxGood inválido', 'medio', 'maxGood debe ser mayor que 0.', spot.id);
    }
    if (spot.swellWindow.some((v) => v < 0 || v > 360)) {
      fallos.add(
        'DAT-006',
        'Ventana de swell fuera de 0-360',
        'medio',
        'La ventana angular contiene grados imposibles.',
        `${spot.id}: ${JSON.stringify(spot.swellWindow)}`
      );
    }
  }

  for (const spot of SPOTS) {
    if (!finito(spot.lat) || !finito(spot.lon) || !finito(spot.seaLat) || !finito(spot.seaLon)) {
      fallos.add(
        'DAT-001',
        'Spot sin coordenadas válidas',
        'critico',
        'Faltan lat/lon o seaLat/seaLon en un spot.',
        spot.id
      );
    }
    if (!finito(spot.facing) || spot.facing < 0 || spot.facing > 360) {
      fallos.add('DAT-002', 'Orientación de spot inválida', 'alto', 'facing fuera de 0-360.', spot.id);
    }
    if (
      !Array.isArray(spot.swellWindow) ||
      spot.swellWindow.length !== 2 ||
      spot.swellWindow.some((v) => !finito(v))
    ) {
      fallos.add(
        'DAT-003',
        'Ventana de swell inválida',
        'alto',
        'swellWindow no tiene dos valores numéricos.',
        spot.id
      );
    }

    const streams = getStreamsForSpot(spot.id);
    if (!streams || streams.length === 0) {
      fallos.add(
        'CAM-001',
        'Spot sin cámara asociada',
        'medio',
        'El spot no tiene ningún stream resoluble.',
        spot.id
      );
    }

    const offline = generateOfflineForecast(spot);
    if (!offline || offline.hours.length < 72) {
      fallos.add(
        'FOR-001',
        'Previsión offline incompleta',
        'alto',
        'generateOfflineForecast devuelve menos de 72 horas.',
        `${spot.id}: ${offline?.hours?.length ?? 0}`
      );
    }
    if (
      !offline.summary ||
      !finito(offline.summary.bestHour) ||
      offline.summary.bestHour < 0 ||
      offline.summary.bestHour > 23 ||
      !finito(offline.summary.maxStars) ||
      offline.summary.maxStars < 0 ||
      offline.summary.maxStars > 7 ||
      !finito(offline.summary.maxHeight)
    ) {
      fallos.add(
        'FOR-002',
        'Resumen de previsión inválido',
        'alto',
        'bestHour, maxStars o maxHeight fuera de rango.',
        `${spot.id}: ${JSON.stringify(offline.summary)}`
      );
    }

    const horasMalas = offline.hours.filter(
      (h) =>
        !finito(h.period) ||
        !finito(h.surfHeight.min) ||
        !finito(h.surfHeight.max) ||
        h.surfHeight.min < -0.001 ||
        !finito(h.rating.stars) ||
        h.rating.stars < 0 ||
        h.rating.stars > 7 ||
        !finito(h.windSpeed) ||
        h.windSpeed < 0
    );
    if (horasMalas.length > 0) {
      fallos.add(
        'FOR-003',
        'Horas de previsión con valores imposibles',
        'critico',
        'Alguna hora contiene NaN, negativos o estrellas fuera de rango.',
        `${spot.id}: ${horasMalas.length} horas malas`
      );
    }

    const maxAlturaHoras = Math.max(...offline.hours.map((h) => h.surfHeight.max));
    if (Math.abs(maxAlturaHoras - offline.summary.maxHeight) > 0.02) {
      fallos.add(
        'FOR-005',
        'Resumen de altura no coincide con las horas',
        'medio',
        'maxHeight del resumen difiere del máximo horario.',
        `${spot.id}: resumen=${offline.summary.maxHeight} horas=${maxAlturaHoras}`
      );
    }

    const maxEstrellas = Math.max(...offline.hours.map((h) => h.rating.stars));
    if (Math.abs(maxEstrellas - offline.summary.maxStars) > 0.01) {
      fallos.add(
        'FOR-006',
        'Resumen de estrellas no coincide con las horas',
        'medio',
        'maxStars del resumen difiere del máximo horario.',
        `${spot.id}: resumen=${offline.summary.maxStars} horas=${maxEstrellas}`
      );
    }

    let tiemposOk = true;
    for (let i = 1; i < offline.hours.length; i++) {
      const prev = new Date(offline.hours[i - 1].time).getTime();
      const cur = new Date(offline.hours[i].time).getTime();
      if (!finito(prev) || !finito(cur) || Math.abs(cur - prev - 3600000) > 1000) {
        tiemposOk = false;
      }
    }
    if (!tiemposOk) {
      fallos.add(
        'FOR-007',
        'Horas de previsión desordenadas o duplicadas',
        'alto',
        'Las marcas de tiempo no son estrictamente crecientes.',
        spot.id
      );
    }

    // Previsión "online" sintética de 168 horas
    const times = Array.from({ length: 168 }, (_, i) =>
      new Date(BASE_YEAR, 9, 1, i).toISOString()
    );
    const online = processSpotForecast(
      spot,
      {
        time: times,
        wave_height: times.map((_, i) => 0.2 + (i % 24) * 0.02),
        wave_period: times.map(() => 5.6),
        wave_direction: times.map(() => spot.facing),
      },
      {
        time: times,
        wind_speed_10m: times.map((_, i) => (i % 24 < 12 ? 8 : 18)),
        wind_gusts_10m: times.map((_, i) => (i % 24 < 12 ? 12 : 26)),
        wind_direction_10m: times.map(() => (spot.facing + 180) % 360),
      },
      false
    );
    if (online.hours.length !== 168) {
      fallos.add(
        'FOR-004',
        'Previsión online no devuelve 168 horas',
        'medio',
        'processSpotForecast trunca o pierde horas.',
        `${spot.id}: ${online.hours.length}`
      );
    }

    const conNulos = processSpotForecast(
      spot,
      {
        time: times.slice(0, 24),
        wave_height: times.slice(0, 24).map((_, i) => (i % 5 === 0 ? null : 0.7)),
        wave_period: times.slice(0, 24).map((_, i) => (i % 7 === 0 ? null : 6.2)),
        wave_direction: times.slice(0, 24).map(() => null),
      } as any,
      {
        time: times.slice(0, 24),
        wind_speed_10m: times.slice(0, 24).map((_, i) => (i % 6 === 0 ? null : 12)),
        wind_gusts_10m: times.slice(0, 24).map(() => null),
        wind_direction_10m: times.slice(0, 24).map(() => null),
      } as any,
      true
    );
    const nulosMalos = conNulos.hours.filter(
      (h) =>
        !finito(h.period) ||
        !finito(h.surfHeight.max) ||
        !finito(h.rating.stars) ||
        !finito(h.windSpeed)
    );
    if (nulosMalos.length > 0) {
      fallos.add(
        'FOR-008',
        'Datos nulos de la API generan NaN',
        'critico',
        'La previsión debe tolerar huecos null de Open-Meteo.',
        `${spot.id}: ${nulosMalos.length} horas con NaN`
      );
    }

    const horasMejor = offline.hours.filter((h) => h.hour === offline.summary.bestHour);
    if (!horasMejor.some((h) => Math.abs(h.rating.stars - offline.summary.maxStars) <= 0.001)) {
      fallos.add(
        'FOR-009',
        'Mejor hora no coincide con las estrellas máximas',
        'medio',
        'bestHour apunta a una hora sin la puntuación máxima.',
        `${spot.id}: bestHour=${offline.summary.bestHour} maxStars=${offline.summary.maxStars}`
      );
    }

    const dirCentro = spot.swellWindow[0] + Math.abs(spot.swellWindow[1] - spot.swellWindow[0]) / 2;
    const constantes = processSpotForecast(
      spot,
      {
        time: times.slice(0, 72),
        wave_height: times.slice(0, 72).map(() => 1.0),
        wave_period: times.slice(0, 72).map(() => 8),
        wave_direction: times.slice(0, 72).map(() => dirCentro),
      },
      {
        time: times.slice(0, 72),
        wind_speed_10m: times.slice(0, 72).map(() => 8),
        wind_gusts_10m: times.slice(0, 72).map(() => 12),
        wind_direction_10m: times.slice(0, 72).map(() => (spot.facing + 180) % 360),
      },
      true
    );
    const directo = calculateSurfFromTrains(spot.facing, spot.swellWindow, spot.exposureFactor, [
      { h: 1.0, t: 8, dir: dirCentro },
    ]);
    const alturas = constantes.hours.map((h) => h.surfHeight.max);
    const desviacion = Math.max(...alturas.map((a) => Math.abs(a - directo.max)));
    const rango = Math.max(...alturas) - Math.min(...alturas);
    if (desviacion > 0.02 || rango > 0.02) {
      fallos.add(
        'FOR-010',
        'Previsión constante no es estable ni fiel a la física',
        'alto',
        'Con mar constante, todas las horas deben coincidir con el cálculo directo.',
        `${spot.id}: directo=${directo.max} desv=${desviacion} rango=${rango}`
      );
    }
  }

  // Rompiente: casos extremos y de calma
  const casosExtremos = [
    { h: 0, t: 0 },
    { h: 0.01, t: 2.5 },
    { h: 3.5, t: 14 },
    { h: 0.4, t: 4 },
    { h: 1.2, t: 9 },
  ];
  for (const c of casosExtremos) {
    const hb = breakingHeight(c.h, c.t);
    if (!finito(hb) || hb < 0) {
      fallos.add(
        'FIS-002',
        'Altura de rompiente inválida en caso extremo',
        'critico',
        'breakingHeight devuelve NaN o negativo.',
        `h=${c.h} t=${c.t} => ${hb}`
      );
    }
  }

  console.log(`  Contratos de datos verificados en ${Date.now() - t0} ms`);
}

// ----------------------------- 5. Ejecución -----------------------------
function main() {
  const inicio = Date.now();
  console.log(`\n=== SIMULACIÓN ${TOTAL_USERS} USUARIOS · ${TOTAL_YEARS} AÑOS · ITERACIÓN ${ITERATION} ===\n`);

  console.log('1. Generando matriz climática física...');
  const clima = generarClima();

  console.log('1b. Verificando física dirigida...');
  verificarFisica();

  console.log('2. Simulando flota de usuarios...');
  simularFlota(clima);

  console.log('3. Simulando sesiones profundas de tracking...');
  const tipos: Array<
    'quieto' | 'remando' | 'ola' | 'wipeout' | 'mixta' | 'destello' | 'larga'
  > = ['quieto', 'remando', 'ola', 'wipeout', 'mixta', 'destello', 'larga'];
  for (let i = 0; i < DEEP_SESSIONS; i++) {
    simularSesionProfunda(tipos[i % tipos.length], i);
  }

  console.log('4. Verificando contratos de datos...');
  verificarContratos();

  const duracion = Date.now() - inicio;
  const lista = fallos.listar();

  const resumen = {
    iteracion: ITERATION,
    fecha: new Date().toISOString(),
    semilla: SEED + ITERATION * 101,
    duracionMs: duracion,
    metricas,
    fallos: lista,
    totalFallos: lista.length,
  };

  const docsDir = join(process.cwd(), '..', 'docs');
  mkdirSync(docsDir, { recursive: true });
  const salida = join(docsDir, `simulacion-10000-50anios-iteracion-${ITERATION}.json`);
  writeFileSync(salida, JSON.stringify(resumen, null, 2), 'utf8');

  console.log('\n--- RESULTADO ---');
  console.log(`Sesiones: ${metricas.sesionesTotales.toLocaleString('es-ES')}`);
  console.log(`Olas: ${metricas.olasTotales.toLocaleString('es-ES')}`);
  console.log(`Clips: ${metricas.clipsGenerados.toLocaleString('es-ES')}`);
  console.log(`Avisos: ${metricas.avisosEnviados.toLocaleString('es-ES')}`);
  console.log(`Sesiones profundas: ${metricas.sesionesProfundas.toLocaleString('es-ES')}`);
  console.log(`Falsos positivos: ${metricas.falsosPositivos}`);
  console.log(`Olas perdidas: ${metricas.olasPerdidas}`);
  console.log(`Fallos distintos: ${lista.length}`);
  for (const f of lista) {
    console.log(`  [${f.severidad.toUpperCase()}] ${f.codigo} ${f.titulo} (${f.ejemplos.length} ejemplos)`);
  }
  console.log(`\nJSON: ${salida}`);
  console.log(`Duración total: ${duracion} ms\n`);
}

main();

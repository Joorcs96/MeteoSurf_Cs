import { SurfTrackerEngine } from '../src/core/surfTracker/surfTrackerEngine';
import { WaveDetector } from '../src/core/surfTracker/waveDetector';
import { TurnDetector } from '../src/core/surfTracker/turnDetector';
import { PaddleDetector } from '../src/core/surfTracker/paddleDetector';
import { GpsPoint } from '../src/core/surfTracker/sessionTypes';

console.log('🏄‍♂️ INICIANDO TESTS DE DETECCIÓN Y TRACKING SURF (APPLE WATCH / GPS) 🏄‍♂️\n');

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, message: string) {
  totalTests++;
  if (condition) {
    console.log(`  ✓ ${message}`);
    passedTests++;
  } else {
    console.error(`  ✗ FALLO: ${message}`);
  }
}

// ----------------------------------------------------
// 1. Tests de PaddleDetector (Contador de remadas)
// ----------------------------------------------------
console.log('📌 1. Verificando Detector de Remadas (Cadencia y acelerómetro):');
const paddle = new PaddleDetector();
const t0 = 1000;

// Remada normal a 1.0 s de cadencia (60 brazadas/min)
paddle.processAccel(0.4, 0.3, 0.1, 4.0, t0); // Pico 1 -> contado
paddle.processAccel(0.05, 0.05, 0.1, 4.0, t0 + 400); // Valle (re-armar)
paddle.processAccel(0.38, 0.25, 0.1, 4.2, t0 + 1000); // Pico 2 -> contado
paddle.processAccel(0.02, 0.04, 0.1, 4.1, t0 + 1400); // Valle
paddle.processAccel(0.42, 0.31, 0.1, 4.5, t0 + 2000); // Pico 3 -> contado

assert(paddle.getStrokes() === 3, `Contadas 3 remadas rítmicas (resultado: ${paddle.getStrokes()})`);

// Si va a más de 8.5 km/h (surfeando ola), NO debe contar remadas
paddle.processAccel(0.05, 0.05, 0.1, 15.0, t0 + 2400);
paddle.processAccel(0.45, 0.35, 0.1, 16.0, t0 + 3000);
assert(paddle.getStrokes() === 3, `Bloqueo de remada a alta velocidad en ola (sigue en ${paddle.getStrokes()})`);

// ----------------------------------------------------
// 2. Tests de TurnDetector (Giros y maniobras)
// ----------------------------------------------------
console.log('\n📌 2. Verificando Detector de Giros y Maniobras (Giroscopio y rumbo):');
const turns = new TurnDetector();

// Simular un bottom turn potente: 60° acumulados con velocidad angular de 50°/s
const tTurn0 = 5000;
const dt = 0.05; // 20 Hz
const radPerSec = (50 * Math.PI) / 180; // 50 deg/s

// Iniciar giro sostenido (acumula ~50° en 1 segundo a 50°/s)
for (let i = 0; i < 20; i++) {
  turns.processGyro(radPerSec, dt, tTurn0 + i * 50);
}
// Concluir giro reduciendo velocidad angular
const turnResult = turns.processGyro(0.1, dt, tTurn0 + 20 * 50);

assert(turnResult !== null, 'Giro detectado correctamente');
assert(turnResult?.type === 'bottom_turn' || turnResult?.type === 'carve', `Tipo de maniobra identificado (${turnResult?.type}, ángulo: ${turnResult?.angleDeg}°)`);

// Simular un snap radical: rotación rápida > 90° con alta velocidad angular (110°/s)
turns.reset();
const radSnap = (110 * Math.PI) / 180;
for (let i = 0; i < 18; i++) {
  turns.processGyro(radSnap, dt, tTurn0 + 1000 + i * 50);
}
const snapResult = turns.processGyro(0.05, dt, tTurn0 + 1000 + 18 * 50);
assert(snapResult?.type === 'snap', `Snap radical detectado (>85° con alta velocidad angular, tipo: ${snapResult?.type})`);

// ----------------------------------------------------
// 3. Tests de WaveDetector (Inicio, duración y fin de ola)
// ----------------------------------------------------
console.log('\n📌 3. Verificando Detector de Olas (Swell takeoff y rompiente):');
const waveDet = new WaveDetector();

// Punto 1: Remando a 5 km/h
const p1: GpsPoint = {
  latitude: 39.983,
  longitude: 0.033,
  speed: 1.38,
  speedKmH: 5.0,
  heading: 280,
  timestamp: 10000,
};
const res1 = waveDet.processGpsPoint(p1);
assert(res1.event === 'none' && !waveDet.isRidingWave(), 'Remando: no se activa ola');

// Punto 2: Takeoff acelerando a 14.5 km/h
const p2: GpsPoint = {
  latitude: 39.9831,
  longitude: 0.0328,
  speed: 4.02,
  speedKmH: 14.5,
  heading: 285,
  timestamp: 11000,
};
const res2 = waveDet.processGpsPoint(p2);
assert(res2.event === 'wave_started' && waveDet.isRidingWave(), 'Takeoff: Inicio de ola detectado por velocidad de planeo');

// Puntos en ola: planeo sostenido a 18 km/h durante 6 segundos
for (let i = 1; i <= 6; i++) {
  const pWave: GpsPoint = {
    latitude: 39.9831 + i * 0.0001,
    longitude: 0.0328 - i * 0.0001,
    speed: 5.0,
    speedKmH: 18.0 + (i % 2 === 0 ? 2 : -1),
    heading: 285,
    timestamp: 11000 + i * 1000,
  };
  waveDet.processGpsPoint(pWave);
}

// Punto final: Pérdida de velocidad en la orilla (4 km/h) sostenida
const pEnd1: GpsPoint = {
  latitude: 39.9838,
  longitude: 0.0321,
  speed: 1.1,
  speedKmH: 4.0,
  heading: 285,
  timestamp: 18000,
};
waveDet.processGpsPoint(pEnd1);

const pEnd2: GpsPoint = {
  latitude: 39.9838,
  longitude: 0.0321,
  speed: 1.0,
  speedKmH: 3.5,
  heading: 285,
  timestamp: 20500, // +2500ms tras caída de velocidad
};
const resEnd = waveDet.processGpsPoint(pEnd2);

assert(resEnd.event === 'wave_ended', 'Fin de ola detectado');
assert(resEnd.wave !== undefined, 'Objeto WaveRide generado');
assert((resEnd.wave?.topSpeedKmH || 0) >= 18.0, `Velocidad punta registrada: ${resEnd.wave?.topSpeedKmH} km/h`);
assert((resEnd.wave?.durationSeconds || 0) >= 6.0, `Duración de ola calculada: ${resEnd.wave?.durationSeconds} s`);
assert((resEnd.wave?.distanceMeters || 0) > 20, `Distancia recorrida registrada: ${resEnd.wave?.distanceMeters} m`);

// ----------------------------------------------------
// 4. Test Integral de SurfTrackerEngine
// ----------------------------------------------------
console.log('\n📌 4. Verificando Motor Integral SurfTrackerEngine con Biometría:');
const engine = new SurfTrackerEngine();
let waveNotified = false;

engine.setCallbacks({
  onWaveEnded: (w) => {
    waveNotified = true;
  },
});

const session = engine.startSession('planetario', 'Planetario');
assert(session.spotName === 'Planetario', 'Sesión iniciada en Planetario');
assert(session.status === 'waiting', 'Estado inicial: en espera');

// Actualizar biometría (pulsaciones y oxígeno del Apple Watch)
engine.updateBiometrics({
  heartRate: 142,
  oxygenSaturation: 98.5,
  activeCalories: 350,
});

assert(session.biometrics.currentHeartRate === 142, 'Pulsaciones registradas (142 bpm)');
assert(session.biometrics.oxygenSaturation === 98.5, 'Saturación de oxígeno registrada (98.5%)');

// Ejecutar ola completa en el motor con tiempos consistentes
const tSession = session.startTime;
const pWaveStart: GpsPoint = {
  latitude: 39.983,
  longitude: 0.033,
  speed: 4.2,
  speedKmH: 15.1,
  heading: 280,
  timestamp: tSession + 5000,
};
engine.processGps(pWaveStart); // Inicia ola
assert(session.status === 'riding_wave', 'Estado actualizado en tiempo real a "riding_wave"');

// Registrar giros acumulando >40° en la ola
for (let i = 0; i < 20; i++) {
  engine.processGyro((60 * Math.PI) / 180, 0.05, tSession + 6000 + i * 50);
}
engine.processGyro(0.1, 0.05, tSession + 7000);

// Puntos en ola
for (let i = 1; i <= 4; i++) {
  engine.processGps({
    latitude: 39.983 + i * 0.0001,
    longitude: 0.033 - i * 0.0001,
    speed: 4.8,
    speedKmH: 17.2,
    heading: 280,
    timestamp: tSession + 7000 + i * 1000,
  });
}

// Finalizar ola
engine.processGps({
  latitude: 39.9835,
  longitude: 0.0325,
  speed: 1.0,
  speedKmH: 3.6,
  heading: 280,
  timestamp: tSession + 12000,
});

engine.processGps({
  latitude: 39.9835,
  longitude: 0.0325,
  speed: 0.9,
  speedKmH: 3.2,
  heading: 280,
  timestamp: tSession + 15000, // +3000ms
});

assert(session.totalWaves === 1, `Total de olas registradas: ${session.totalWaves}`);
assert(waveNotified, 'Notificación callback onWaveEnded recibida');
assert(session.waveRides[0]?.turnsCount >= 1, `Maniobras registradas en la ola: ${session.waveRides[0]?.turnsCount}`);

const finishedSession = engine.stopSession();
assert(finishedSession !== null, 'Sesión finalizada con éxito');
assert((finishedSession?.durationSeconds || 0) >= 15, `Duración total de sesión calculada (${finishedSession?.durationSeconds} s)`);

console.log(`\n======================================================`);
console.log(`✅ RESULTADO: ${passedTests}/${totalTests} tests pasados al 100%`);
console.log(`======================================================\n`);

if (passedTests !== totalTests) {
  process.exit(1);
}

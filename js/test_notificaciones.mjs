// js/test_notificaciones.mjs — Pruebas unitarias de lógica pura para notificaciones en MeteoSurf_Cs.
import assert from 'node:assert/strict';
import {
  DEFAULT_PREFS,
  urlBase64ToUint8Array,
  buildPrefs,
  validatePrefs,
  checkPushCapabilities
} from './notificaciones.js';

console.log('--- Iniciando pruebas de notificaciones ---');

// Test 1: Conversión urlBase64ToUint8Array
console.log('1. Probando urlBase64ToUint8Array...');
{
  const empty = urlBase64ToUint8Array('');
  assert.equal(empty.length, 0, 'Debe devolver un array vacío si la cadena está vacía');

  const nullVal = urlBase64ToUint8Array(null);
  assert.equal(nullVal.length, 0, 'Debe devolver un array vacío si el valor es nulo');

  // "Hello World" en base64 estándar = "SGVsbG8gV29ybGQ="
  const helloStd = urlBase64ToUint8Array('SGVsbG8gV29ybGQ=');
  const expectedHello = new TextEncoder().encode('Hello World');
  assert.deepEqual(Array.from(helloStd), Array.from(expectedHello), 'Debe decodificar base64 estándar con padding');

  // Base64URL sin padding con '-' y '_'
  // Clave pública simulada (ej. caracteres URL-safe)
  const testBytes = new Uint8Array([251, 255, 254, 1, 2, 3]);
  // En base64 estándar: "+//+AQID" -> En base64url: "-__-AQID"
  const urlSafe = '-__-AQID';
  const decoded = urlBase64ToUint8Array(urlSafe);
  assert.deepEqual(Array.from(decoded), Array.from(testBytes), 'Debe decodificar base64url con - y _');
}

// Test 2: Construcción de preferencias (buildPrefs)
console.log('2. Probando buildPrefs...');
{
  // Valores por defecto
  const def = buildPrefs();
  assert.deepEqual(def.spots, DEFAULT_PREFS.spots, 'Debe usar spots por defecto');
  assert.equal(def.minStars, 3, 'minStars por defecto debe ser 3');
  assert.equal(def.maxPerDay, 2, 'maxPerDay por defecto debe ser 2');
  assert.equal(def.quiet.from, 22, 'quiet.from por defecto debe ser 22');
  assert.equal(def.quiet.to, 8, 'quiet.to por defecto debe ser 8');
  assert.equal(def.alerts.gente, true);
  assert.equal(def.alerts.olas_ahora, true);
  assert.equal(def.alerts.olas_tarde, true);
  assert.equal(def.alerts.dias_buenos, true);

  // Sobrescribir spots favoritos
  const custom = buildPrefs({
    spots: ['Planetario', 'Voramar'],
    alerts: { gente: false, olas_ahora: true, olas_tarde: false, dias_buenos: true },
    minStars: 4,
    quiet: { from: 23, to: 7 },
    maxPerDay: 1
  });
  assert.deepEqual(custom.spots, ['Planetario', 'Voramar']);
  assert.equal(custom.alerts.gente, false);
  assert.equal(custom.alerts.olas_ahora, true);
  assert.equal(custom.alerts.olas_tarde, false);
  assert.equal(custom.alerts.dias_buenos, true);
  assert.equal(custom.minStars, 4);
  assert.equal(custom.quiet.from, 23);
  assert.equal(custom.quiet.to, 7);
  assert.equal(custom.maxPerDay, 1);

  // Saneado y límites (clamping)
  const clamped = buildPrefs({
    minStars: 10,
    maxPerDay: 99,
    quiet: { from: 30, to: -5 }
  });
  assert.equal(clamped.minStars, 5, 'minStars no debe superar 5');
  assert.equal(clamped.maxPerDay, 3, 'maxPerDay no debe superar 3');
  assert.equal(clamped.quiet.from, 23, 'quiet.from no debe superar 23');
  assert.equal(clamped.quiet.to, 0, 'quiet.to no debe ser inferior a 0');

  const clampedLow = buildPrefs({
    minStars: 1,
    maxPerDay: 0
  });
  assert.equal(clampedLow.minStars, 2, 'minStars no debe bajar de 2');
  assert.equal(clampedLow.maxPerDay, 1, 'maxPerDay no debe bajar de 1');
}

// Test 3: Validación de preferencias (validatePrefs)
console.log('3. Probando validatePrefs...');
{
  const valid = validatePrefs(DEFAULT_PREFS);
  assert.equal(valid.valid, true, 'DEFAULT_PREFS debe ser estrictamente válido');
  assert.equal(valid.errors.length, 0);

  // Objeto no válido
  const invalidNull = validatePrefs(null);
  assert.equal(invalidNull.valid, false);

  const invalidArray = validatePrefs([]);
  assert.equal(invalidArray.valid, false);

  // Spots no válidos
  const badSpots = validatePrefs({ ...DEFAULT_PREFS, spots: 'Planetario' });
  assert.equal(badSpots.valid, false);

  const badSpotsEmpty = validatePrefs({ ...DEFAULT_PREFS, spots: ['Planetario', ''] });
  assert.equal(badSpotsEmpty.valid, false);

  // Alertas incompletas o no booleanas
  const badAlerts = validatePrefs({
    ...DEFAULT_PREFS,
    alerts: { gente: 'si', olas_ahora: true, olas_tarde: true, dias_buenos: true }
  });
  assert.equal(badAlerts.valid, false);

  // minStars fuera de rango
  const badStarsLow = validatePrefs({ ...DEFAULT_PREFS, minStars: 1 });
  assert.equal(badStarsLow.valid, false);
  const badStarsHigh = validatePrefs({ ...DEFAULT_PREFS, minStars: 6 });
  assert.equal(badStarsHigh.valid, false);
  const badStarsFloat = validatePrefs({ ...DEFAULT_PREFS, minStars: 3.5 });
  assert.equal(badStarsFloat.valid, false);

  // maxPerDay fuera de rango
  const badMaxLow = validatePrefs({ ...DEFAULT_PREFS, maxPerDay: 0 });
  assert.equal(badMaxLow.valid, false);
  const badMaxHigh = validatePrefs({ ...DEFAULT_PREFS, maxPerDay: 4 });
  assert.equal(badMaxHigh.valid, false);

  // quiet fuera de rango
  const badQuiet = validatePrefs({ ...DEFAULT_PREFS, quiet: { from: 25, to: 8 } });
  assert.equal(badQuiet.valid, false);
}

// Test 4: Comprobación de capacidades con WORKER_URL vacío
console.log('4. Probando checkPushCapabilities con WORKER_URL vacío...');
{
  const caps = checkPushCapabilities('');
  assert.equal(caps.hasWorker, false, 'hasWorker debe ser false si la URL está vacía');
  assert.equal(caps.supported, false, 'supported debe ser false si la URL está vacía');
  assert.ok(caps.message.length > 0, 'Debe proporcionar un mensaje explicativo');
}

console.log('Todas las pruebas unitarias pasaron correctamente.');

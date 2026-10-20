// Topes duros y saneado de preferencias, sin levantar el Worker.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ahoraMadrid } from '../src/hora.js';
import { PREFS_POR_DEFECTO, sanearPrefs } from '../src/prefs.js';
import { conDiaActual, contarEnvio, duplicado, enSilencio, maximoDelDia, puedeEnviar, vistaPublica } from '../src/topes.js';

function momento(iso) {
  return ahoraMadrid(new Date(iso));
}

test('la hora se calcula en Madrid, no en UTC', () => {
  assert.deepEqual(
    { ...momento('2026-10-18T12:00:00Z'), unix: 0 },
    { fecha: '2026-10-18', hora: 14, minuto: 0, unix: 0 }
  );
  assert.deepEqual(
    { ...momento('2026-01-18T23:30:00Z'), unix: 0 },
    { fecha: '2026-01-19', hora: 0, minuto: 30, unix: 0 }
  );
  assert.equal(momento('2026-10-18T21:30:00Z').hora, 23, '23:30 en Madrid con UTC+2 de octubre');
});

test('las horas de silencio cubren el wrap de medianoche', () => {
  const prefs = { ...PREFS_POR_DEFECTO, quiet: { from: 22, to: 8 } };
  assert.equal(enSilencio(prefs, momento('2026-10-18T19:59:00Z')), false, '21:59 Madrid, aun no');
  assert.equal(enSilencio(prefs, momento('2026-10-18T20:00:00Z')), true, '22:00 Madrid');
  assert.equal(enSilencio(prefs, momento('2026-10-18T21:59:00Z')), true, '23:59 Madrid');
  assert.equal(enSilencio(prefs, momento('2026-10-18T22:00:00Z')), true, '00:00 Madrid');
  assert.equal(enSilencio(prefs, momento('2026-10-18T05:59:00Z')), true, '07:59 Madrid');
  assert.equal(enSilencio(prefs, momento('2026-10-18T06:00:00Z')), false, '08:00 Madrid');
  assert.equal(enSilencio(prefs, momento('2026-10-18T12:00:00Z')), false, '14:00 Madrid');
  assert.equal(enSilencio({ ...prefs, quiet: { from: 13, to: 15 } }, momento('2026-10-18T12:00:00Z')), true, 'sin wrap');
  assert.equal(enSilencio({ ...prefs, quiet: { from: 13, to: 15 } }, momento('2026-10-18T15:00:00Z')), false);
  assert.equal(enSilencio({ ...prefs, quiet: { from: 3, to: 3 } }, momento('2026-10-18T15:00:00Z')), false, 'mismo inicio y fin: sin silencio');
});

test('el tope diario se respeta con el valor por defecto y nunca pasa de 3', () => {
  assert.equal(maximoDelDia(PREFS_POR_DEFECTO), 2);
  assert.equal(maximoDelDia({ maxPerDay: 9 }), 3, 'techo absoluto');
  assert.equal(maximoDelDia({ maxPerDay: 0 }), 1, 'mínimo');

  const registro = { dia: '2026-10-18', enviadosHoy: 2, ultimoPorTag: {}, prefs: PREFS_POR_DEFECTO };
  const decision = puedeEnviar(registro, PREFS_POR_DEFECTO, 'x', momento('2026-10-18T12:00:00Z'));
  assert.deepEqual(decision, { ok: false, motivo: 'cap' });
});

test('el mismo tag no se repite en 6 h', () => {
  const base = momento('2026-10-18T12:00:00Z');
  const registro = contarEnvio({ dia: base.fecha, enviadosHoy: 0, ultimoPorTag: {} }, 'olas_ahora:planetario', base);
  assert.equal(duplicado(registro, 'olas_ahora:planetario', momento('2026-10-18T17:59:00Z')), true, '5 h 59 despues');
  assert.equal(duplicado(registro, 'olas_ahora:planetario', momento('2026-10-18T18:00:00Z')), false, '6 h despues');
  assert.equal(duplicado(registro, 'gente:planetario', momento('2026-10-18T12:30:00Z')), false, 'otro tag');
});

test('el contador se reinicia al cambiar de dia en Madrid', () => {
  const ayer = contarEnvio(
    { dia: '2026-10-17', enviadosHoy: 2, ultimoPorTag: { x: 1 } },
    'x',
    momento('2026-10-17T21:00:00Z')
  );
  const hoy = conDiaActual(ayer, momento('2026-10-18T12:00:00Z'));
  assert.equal(hoy.enviadosHoy, 0);
  assert.deepEqual(hoy.ultimoPorTag, {});
});

test('la vista publica de /subs nunca lleva endpoint ni claves', () => {
  const ahora = momento('2026-10-18T12:00:00Z');
  const registro = {
    id: '0123456789abcdef',
    endpoint: 'https://push.ejemplo.com/secreto',
    keys: { p256dh: 'x', auth: 'y' },
    prefs: PREFS_POR_DEFECTO,
    dia: ahora.fecha,
    enviadosHoy: 1,
    ultimoPorTag: { 'gente:planetario': ahora.unix }
  };
  const vista = vistaPublica(registro, ahora);
  assert.deepEqual(Object.keys(vista).sort(), ['id', 'lastByTag', 'prefs', 'sentToday']);
  assert.equal(JSON.stringify(vista).includes('secreto'), false);
  assert.equal(vista.sentToday, 1);
});

test('sanearPrefs aplica los valores por defecto y avisa de lo raro', () => {
  const { prefs, avisos } = sanearPrefs({
    spots: ['Planetario', 'planetario', 'Mal Valor', 'a'.repeat(50)],
    alerts: { gente: false, inventado: true, olas_ahora: 'si' },
    minStars: 99,
    quiet: { from: 99, to: -3 },
    maxPerDay: 7
  });
  assert.deepEqual(prefs.spots, ['planetario'], 'normaliza, quita repetidos y descarta lo invalido');
  assert.equal(prefs.alerts.gente, false);
  assert.equal(prefs.alerts.olas_ahora, true, 'un valor que no es booleano no cambia nada');
  assert.equal('inventado' in prefs.alerts, false);
  assert.equal(prefs.minStars, 3);
  assert.deepEqual(prefs.quiet, { from: 22, to: 8 });
  assert.equal(prefs.maxPerDay, 3);
  assert.ok(avisos.length >= 4);
});

test('sanearPrefs no lanza con basura', () => {
  for (const basura of [null, undefined, 42, 'texto', [], { spots: 'no', alerts: 5, quiet: 'no' }]) {
    const { prefs } = sanearPrefs(basura);
    assert.deepEqual(prefs, PREFS_POR_DEFECTO);
  }
});

test('sanearPrefs aguanta un cuerpo con __proto__', () => {
  const { prefs } = sanearPrefs(JSON.parse('{"__proto__":{"maxPerDay":9},"spots":["planetario"]}'));
  assert.equal(prefs.maxPerDay, 2, '__proto__ no cambia nada');
  assert.deepEqual(prefs.spots, ['planetario']);
});
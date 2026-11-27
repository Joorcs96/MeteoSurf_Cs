import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TZ,
  RANGES,
  SPORTS,
  LEVELS,
  DEFAULT_RANGE,
  fmtRangeM,
  periodOf,
  hoursInRange,
  forecastDates,
  chooseDefaultCompare,
  summarizeSpot,
  parseJornadaParams,
  buildJornadaHash,
  validateJornadaState,
  buildShareText,
  recommendWindows
} from '../js/jornada.js';

const DATE = '2026-11-25';

function hour(hour, surf, extra = {}) {
  return {
    date: DATE,
    hour,
    surf: surf ? { min: surf[0], max: surf[1], mid: surf[2] } : null,
    ...extra
  };
}

test('horas de la franja: incluye desde y excluye hasta', () => {
  const hours = [
    hour(8, [0.3, 0.5, 0.4]),
    hour(9, [0.4, 0.8, 0.6]),
    hour(10, [0.5, 0.9, 0.7]),
    hour(11, [0.6, 1.0, 0.8]),
    hour(12, [0.7, 1.1, 0.9]),
    { ...hour(10, [9, 9, 9]), date: '2026-11-26' }
  ];

  const result = hoursInRange(hours, DATE, 9, 12);
  assert.deepEqual(result.map((h) => h.hour), [9, 10, 11]);
  assert.ok(result.every((h) => h.date === DATE));
});

test('resumen de spot calcula extremos y no mezcla horas fuera de franja', () => {
  const spot = { id: 'Planetario', name: 'Planetario', zoneName: 'Grao' };
  const fc = {
    spots: {
      Planetario: {
        hours: [
          hour(8, [0.1, 0.2, 0.15], { windSpeed: 99, windGust: 150, rating: 0 }),
          hour(9, [0.4, 0.8, 0.6], { windSpeed: 12, windGust: 20, rating: 4, windDir: 270, wind: { label: 'Terral' }, swells: [{ t: 8 }] }),
          hour(10, [0.6, 1.0, 0.8], { windSpeed: 14, windGust: 25, rating: 5, windDir: 280, wind: { label: 'Terral' }, swells: [{ t: 10 }] }),
          hour(11, [0.5, 0.9, 0.7], { windSpeed: 16, windGust: 30, rating: 3, windDir: 290, wind: { label: 'Terral' }, swells: [{ t: 9 }] }),
          hour(12, [9, 9, 9], { windSpeed: 200, windGust: 300, rating: 1 })
        ]
      }
    }
  };

  const r = summarizeSpot(spot, fc, { date: DATE, from: 9, to: 12 });
  assert.equal(r.count, 3);
  assert.equal(r.withSurf, 3);
  assert.equal(r.missing, 0);
  assert.equal(r.surfMin, 0.4);
  assert.equal(r.surfMax, 1.0);
  assert.equal(r.periodMin, 8);
  assert.equal(r.periodMax, 10);
  assert.equal(r.windAvg, 14);
  assert.equal(r.gustMax, 30);
  assert.equal(r.bestRating, 5);
  assert.equal(r.bestHour, 10);
  assert.equal(r.windDir, 280);
});

test('resumen sin oleaje no inventa cero', () => {
  const spot = { id: 'Palaciet', name: 'El Palaciet' };
  const fc = {
    spots: {
      Palaciet: {
        hours: [
          hour(9, null, { windSpeed: 12, windGust: 18 }),
          hour(10, null, { windSpeed: 14, windGust: 20 })
        ]
      }
    }
  };

  const r = summarizeSpot(spot, fc, { date: DATE, from: 9, to: 12 });
  assert.equal(r.count, 2);
  assert.equal(r.expected, 3);
  assert.equal(r.withSurf, 0);
  assert.equal(r.missing, 3);
  assert.equal(r.partial, true);
  assert.equal(r.hasData, false);
  assert.equal(r.surfMin, null);
  assert.equal(r.surfMax, null);
  assert.equal(r.surfAvg, null);
});

test('periodo usa el swell principal y cae a wavePeriod', () => {
  assert.equal(periodOf({ swells: [{ t: null }, { t: 12 }], wavePeriod: 8 }), 12);
  assert.equal(periodOf({ swells: [{ t: '11' }], wavePeriod: 8 }), 11);
  assert.equal(periodOf({ wavePeriod: 7 }), 7);
  assert.equal(periodOf({ period: 6 }), 6);
  assert.equal(periodOf({}), null);
});

test('formato de rango en metros', () => {
  assert.equal(fmtRangeM(0.4, 0.8), '0,4–0,8 m');
  assert.equal(fmtRangeM(0.5, 0.5), '0,5 m');
  assert.equal(fmtRangeM(null, null), '–');
  assert.equal(fmtRangeM(-0.2, 0.3), '0,0–0,3 m');
});

test('fechas de previsión sin duplicados y ordenadas', () => {
  const fc = {
    spots: {
      A: { days: [{ date: '2026-11-26' }, { date: '2026-11-25' }] },
      B: { days: [{ date: '2026-11-25' }, { date: '2026-11-27' }] }
    }
  };
  assert.deepEqual(forecastDates(fc), ['2026-11-25', '2026-11-26', '2026-11-27']);
  assert.deepEqual(forecastDates(null), []);
});

test('comparación por defecto respeta favoritos y luego prioridad', () => {
  const spots = [
    { id: 'Planetario' },
    { id: 'Voramar' },
    { id: 'MorroGos' },
    { id: 'Palaciet' },
    { id: 'Otro' }
  ];
  assert.deepEqual(chooseDefaultCompare(spots, ['Otro', 'Nope']), ['Otro']);
  assert.deepEqual(chooseDefaultCompare(spots, [{ id: 'Voramar' }]), ['Voramar']);
  assert.deepEqual(chooseDefaultCompare(spots, []), ['Planetario', 'Voramar', 'MorroGos', 'Palaciet']);
});

test('hash y parámetros de jornada son reversibles', () => {
  const jr = {
    date: DATE,
    from: 12,
    to: 15,
    sport: 'Surf',
    level: 'Intermedio',
    selected: 'Planetario',
    compare: ['MorroGos', 'Planetario']
  };
  const hash = buildJornadaHash(jr);
  assert.ok(hash.startsWith('#/jornada?'));
  const parsed = parseJornadaParams(hash.split('?')[1]);
  assert.deepEqual(parsed, jr);
});

test('parámetros inválidos no se aceptan', () => {
  const parsed = parseJornadaParams('d=2026-13-01&f=5&t=21&sp=Yoga&n=Experto&s=&c=');
  assert.deepEqual(parsed, {});

  const old = parseJornadaParams('f=0&t=12');
  assert.equal(old.from, undefined);
  assert.equal(old.to, 12);

  const valid = parseJornadaParams('f=19&t=20');
  assert.equal(valid.from, 19);
  assert.equal(valid.to, 20);
});

test('estado inválido se corrige sin romper la vista', () => {
  const fixed = validateJornadaState(
    { date: 'nope', from: 0, to: 12, sport: 'Yoga', level: 'Experto', compare: ['Nope'], selected: 'Nope' },
    { dates: [DATE, '2026-11-26'], spotIds: ['Planetario', 'Voramar'], defaultCompare: ['Voramar'] }
  );
  assert.equal(fixed.date, DATE);
  assert.equal(fixed.from, DEFAULT_RANGE.from);
  assert.equal(fixed.to, 12);
  assert.equal(fixed.sport, 'Surf');
  assert.equal(fixed.level, 'Intermedio');
  assert.deepEqual(fixed.compare, ['Voramar']);
  assert.equal(fixed.selected, 'Voramar');

  const old = validateJornadaState({ from: 0, to: 12 }, { dates: [DATE], spotIds: ['Planetario'] });
  assert.equal(old.from, 9);
  assert.equal(old.to, 12);
});

test('el seleccionado se añade a la comparación si faltaba', () => {
  const fixed = validateJornadaState(
    { date: DATE, compare: ['Voramar'], selected: 'Planetario' },
    { dates: [DATE], spotIds: ['Planetario', 'Voramar'] }
  );
  assert.deepEqual(fixed.compare, ['Planetario', 'Voramar']);
  assert.equal(fixed.selected, 'Planetario');
});

test('el parte incluye fecha, franja, fuentes, observación y enlace', () => {
  const text = buildShareText({
    date: DATE,
    from: 9,
    to: 12,
    sport: 'Surf',
    level: 'Intermedio',
    rows: [{
      name: 'Planetario',
      hasData: true,
      surfMin: 0.4,
      surfMax: 0.8,
      periodMin: 8,
      periodMax: 10,
      windAvg: 12,
      windText: 'Terral',
      gustMax: 20,
      ratingLabel: 'Bueno'
    }],
    updatedAt: '25/11/2026 08:00',
    observation: 'Boya 0,8 m',
    url: 'https://example.test/#/jornada?d=2026-11-25'
  });

  assert.match(text, /Fecha:/);
  assert.match(text, /Franja: 09:00–12:00 \(3 h\) · Europe\/Madrid/);
  assert.match(text, /Planetario: ola en playa 0,4–0,8 m/);
  assert.match(text, /periodo 8–10 s/);
  assert.match(text, /viento 12 km\/h Terral/);
  assert.match(text, /rachas 20 km\/h/);
  assert.match(text, /calidad de surf Bueno/);
  assert.match(text, /Criterios: calidad de surf/);
  assert.match(text, /Fuente: Open-Meteo/);
  assert.match(text, /actualizado 25\/11\/2026 08:00/);
  assert.match(text, /Observación ahora: Boya 0,8 m/);
  assert.match(text, /Enlace: https:\/\/example\.test/);
  assert.match(text, /no un veredicto de seguridad/);
});

test('el parte declara ausencia de datos en vez de inventarlos', () => {
  const text = buildShareText({
    date: DATE,
    from: 9,
    to: 12,
    sport: 'Surf',
    level: 'Iniciación',
    rows: [
      { name: 'El Palaciet', hasData: false },
      { name: 'Voramar', hasData: true, surfMin: null, surfMax: null }
    ]
  });

  assert.match(text, /El Palaciet: sin datos de oleaje para esta franja\./);
  assert.match(text, /Voramar: ola en playa – · periodo sin dato · viento sin dato · rachas sin dato · calidad de surf sin valoración\./);
  assert.ok(!text.includes('0,0 m'));
});

test('el parte marca cobertura parcial sin extrapolar', () => {
  const text = buildShareText({
    date: DATE,
    from: 9,
    to: 12,
    rows: [{
      name: 'Planetario',
      hasData: true,
      surfMin: 0.4,
      surfMax: 0.8,
      expected: 3,
      withSurf: 2,
      partial: true,
      ratingLabel: 'Bueno'
    }]
  });

  assert.match(text, /cobertura 2\/3 h con dato, sin extrapolar/);
});

test('rangos y catálogos mantienen la franja esperada', () => {
  assert.equal(TZ, 'Europe/Madrid');
  assert.deepEqual(DEFAULT_RANGE, { from: 9, to: 12 });
  assert.ok(RANGES.some((r) => r.from === 9 && r.to === 12));
  for (const r of RANGES) {
    assert.ok(r.from >= 6 && r.from < r.to && r.to <= 20);
    assert.ok(r.to - r.from <= 12);
  }
  assert.ok(SPORTS.includes('Surf'));
  assert.ok(LEVELS.includes('Intermedio'));
});

test('recommendWindows solo propone franjas de 3 h completas y ordena por calidad', () => {
  const spots = [
    { id: 'Planetario', name: 'Planetario', zoneName: 'Grao' },
    { id: 'Voramar', name: 'Voramar', zoneName: 'Benicàssim' }
  ];
  const fc = {
    spots: {
      Planetario: {
        hours: [
          // 06-09 parcial (solo 2 horas con surf) -> debe descartarse aunque tenga rating 6
          hour(6, [0.7, 1.1, 0.9], { rating: 6, windSpeed: 8 }),
          hour(7, [0.7, 1.1, 0.9], { rating: 6, windSpeed: 8 }),
          hour(8, null, { rating: 6, windSpeed: 8 }),
          // 09-12 completa, rating 4
          hour(9, [0.4, 0.6, 0.5], { rating: 3, windSpeed: 10 }),
          hour(10, [0.5, 0.7, 0.6], { rating: 4, windSpeed: 10 }),
          hour(11, [0.4, 0.6, 0.5], { rating: 3, windSpeed: 10 })
        ]
      },
      Voramar: {
        hours: [
          // 12-15 completa, rating 5
          hour(12, [0.6, 0.9, 0.75], { rating: 5, windSpeed: 9 }),
          hour(13, [0.6, 0.9, 0.75], { rating: 5, windSpeed: 9 }),
          hour(14, [0.6, 0.9, 0.75], { rating: 4, windSpeed: 9 })
        ]
      }
    }
  };
  const recs = recommendWindows(spots, fc, { date: DATE, limit: 4 });
  assert.equal(recs.length, 2);
  assert.equal(recs[0].spotId, 'Voramar');
  assert.deepEqual([recs[0].from, recs[0].to], [12, 15]);
  assert.equal(recs[1].spotId, 'Planetario');
  assert.deepEqual([recs[1].from, recs[1].to], [9, 12]);
});

test('el parte empieza por la decisión elegida y separa alternativas', () => {
  const text = buildShareText({
    date: DATE,
    from: 12,
    to: 15,
    sport: 'Surf',
    level: 'Intermedio',
    selected: 'Voramar',
    rows: [
      { spotId: 'Planetario', name: 'Planetario', hasData: true, surfMin: 0.3, surfMax: 0.5, ratingLabel: 'Regular' },
      { spotId: 'Voramar', name: 'Voramar', hasData: true, surfMin: 0.6, surfMax: 0.9, ratingLabel: 'Bueno' }
    ]
  });
  const decIdx = text.indexOf('Decisión: Voramar');
  const altIdx = text.indexOf('Alternativas comparadas:');
  const plaIdx = text.indexOf('- Planetario:');
  assert.ok(decIdx > 0);
  assert.ok(altIdx > decIdx);
  assert.ok(plaIdx > altIdx);
});

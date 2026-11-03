import assert from 'node:assert/strict';
import { SPOTS } from '../js/spots.js';
import { geometriaOrientacion, puntoEnRumbo, LARGO_FLECHA } from '../js/orientaciones-mapa.js';
import { horaForecast } from '../js/forecast.js';

const cerca = (a, b) => Math.abs(a - b) < 1e-12;
const dentroDeVentana = (angulo, desde, hasta) => {
  const a = ((angulo % 360) + 360) % 360;
  const d = ((desde % 360) + 360) % 360;
  const h = ((hasta % 360) + 360) % 360;
  return d <= h ? a >= d && a <= h : a >= d || a <= h;
};

for (const spot of SPOTS) {
  const { sector, eje } = geometriaOrientacion(spot);
  const anillo = sector.geometry.coordinates[0];
  const [inicio, fin] = eje.geometry.coordinates;
  const esperado = puntoEnRumbo(spot.lat, spot.lon, spot.facing, LARGO_FLECHA);
  assert.equal(anillo.length, 15, `${spot.name}: sector cerrado con 12 tramos`);
  assert.ok(cerca(anillo[0][0], spot.lon) && cerca(anillo[0][1], spot.lat), `${spot.name}: sector empieza en el spot`);
  assert.ok(cerca(anillo.at(-1)[0], spot.lon) && cerca(anillo.at(-1)[1], spot.lat), `${spot.name}: sector se cierra en el spot`);
  assert.ok(cerca(inicio[0], spot.lon) && cerca(inicio[1], spot.lat), `${spot.name}: flecha empieza en el spot`);
  assert.ok(cerca(fin[0], esperado.lon) && cerca(fin[1], esperado.lat), `${spot.name}: flecha usa el rumbo común`);
  assert.ok(dentroDeVentana(spot.facing, ...spot.swellWindow), `${spot.name}: la flecha queda dentro de su ventana de mar`);
}
const limitesCosta = {
  Vinaros: [50, 175], Peniscola: [35, 160], MorroGos: [40, 176],
  Concha: [80, 175], Renega: [65, 210], Voramar: [80, 204],
  Heliopolis: [60, 190], Gurugu: [48, 182], Piramides: [48, 182],
  Planetario: [45, 150], Palaciet: [56, 210], Burriana: [48, 188],
  Nules: [50, 190], Almenara: [47, 187],
};
for (const [id, limites] of Object.entries(limitesCosta)) {
  const spot = SPOTS.find((s) => s.id === id);
  assert.deepEqual(spot.swellWindow, limites, `${id}: ventana contrastada con las teselas de costa OSM a 1,2 km`);
}
assert.equal(Object.keys(limitesCosta).length, SPOTS.length, 'Todos los spots tienen límites contrastados');
function altura(spot, dir) {
  const m = {
    time: ['2026-11-04T12:00'], wave_height: [1], wave_period: [7], wave_direction: [dir],
    swell_wave_height: [1], swell_wave_period: [7], swell_wave_direction: [dir],
    secondary_swell_wave_height: [0], secondary_swell_wave_period: [7], secondary_swell_wave_direction: [dir],
    wind_wave_height: [0], wind_wave_period: [7], wind_wave_direction: [dir],
  };
  return horaForecast(spot, m, { wind_speed_10m: [5], wind_gusts_10m: [8], wind_direction_10m: [270] }, 0).surf.mid;
}
const concha = SPOTS.find((s) => s.id === 'Concha');
const planetario = SPOTS.find((s) => s.id === 'Planetario');
for (const spot of SPOTS) {
  assert.equal(altura(spot, spot.swellWindow[0] - 10), 0, `${spot.id}: la tierra a la izquierda bloquea el oleaje`);
  assert.equal(altura(spot, spot.swellWindow[1] + 10), 0, `${spot.id}: la tierra a la derecha bloquea el oleaje`);
  assert.ok(altura(spot, spot.facing) > 0, `${spot.id}: el mar frontal sí entra`);
}
assert.equal(altura(concha, 40), 0, 'La Concha: el cabo bloquea el mar del NE');
assert.ok(altura(concha, 110) > 0, 'La Concha: el mar del E llega');
assert.equal(altura(planetario, 170), 0, 'Planetario: el puerto bloquea el mar del S');
assert.ok(altura(planetario, 90) > 0, 'Planetario: el mar del E llega con la física v3');
console.log(`OK: ${SPOTS.length} orientaciones 2D/3D comparten geometría y la flecha está dentro de cada ventana de mar.`);

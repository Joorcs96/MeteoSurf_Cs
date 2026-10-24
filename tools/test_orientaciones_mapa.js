import assert from 'node:assert/strict';
import { SPOTS } from '../js/spots.js';
import { geometriaOrientacion, puntoEnRumbo, LARGO_FLECHA } from '../js/orientaciones-mapa.js';

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
console.log(`OK: ${SPOTS.length} orientaciones 2D/3D comparten geometría y la flecha está dentro de cada ventana de mar.`);

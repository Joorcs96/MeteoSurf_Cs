// Geometría común de las orientaciones. Así 2D y 3D no pueden divergir.
export const RADIO_SECTOR = 0.012;
export const LARGO_FLECHA = 0.016;
const RAD = Math.PI / 180;

export function puntoEnRumbo(lat, lon, rumbo, distancia) {
  const r = rumbo * RAD;
  return {
    lat: lat + distancia * Math.cos(r),
    lon: lon + (distancia * Math.sin(r)) / Math.cos(lat * RAD),
  };
}

export function puntosSector(spot, radio = RADIO_SECTOR, pasos = 12) {
  const [desde, hasta] = spot.swellWindow;
  const amplitud = ((hasta - desde) % 360 + 360) % 360 || 360;
  const puntos = [{ lat: spot.lat, lon: spot.lon }];
  for (let i = 0; i <= pasos; i++) {
    puntos.push(puntoEnRumbo(spot.lat, spot.lon, desde + (amplitud * i) / pasos, radio));
  }
  return puntos;
}

export function geometriaOrientacion(spot) {
  const sector = puntosSector(spot);
  const eje = puntoEnRumbo(spot.lat, spot.lon, spot.facing, LARGO_FLECHA);
  return {
    sector: {
      type: 'Feature', properties: { id: spot.id, nombre: spot.name },
      geometry: { type: 'Polygon', coordinates: [[...sector.map((p) => [p.lon, p.lat]), [spot.lon, spot.lat]]] },
    },
    eje: {
      type: 'Feature', properties: { id: spot.id, nombre: spot.name },
      geometry: { type: 'LineString', coordinates: [[spot.lon, spot.lat], [eje.lon, eje.lat]] },
    },
  };
}

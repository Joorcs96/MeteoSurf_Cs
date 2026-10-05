// spots.js — Catálogo de spots de la costa de Castellón.
// facing: azimut hacia el que mira la playa (normal a la costa, hacia el mar), en grados desde el norte.
// swellWindow: sector de procedencia del mar que llega a la rompiente [desde, hasta] en sentido horario.
// seaLat/seaLon: punto mar adentro (~1 km) donde se piden los datos de oleaje.
// exposureFactor: reducción por abrigo o fondo (1 = playa abierta). maxGood: tamaño (m) a partir del que satura.

export const ZONES = [
  { id: 'norte', name: 'Vinaròs · Peñíscola' },
  { id: 'oropesa', name: 'Oropesa · Benicàssim' },
  { id: 'grao', name: 'Grao de Castellón' },
  { id: 'sur', name: 'Burriana · Almenara' }
];

const S = (o) => {
  const r = (o.facing * Math.PI) / 180;
  const k = 0.012; // ~1.2 km
  return {
    exposureFactor: 1, maxGood: 2.2, level: 'Todos los niveles', hazards: 'Ninguno destacable',
    seaLat: +(o.lat + k * Math.cos(r)).toFixed(4),
    seaLon: +(o.lon + (k * Math.sin(r)) / Math.cos((o.lat * Math.PI) / 180)).toFixed(4),
    swellWindow: [o.facing - 70, o.facing + 70],
    ...o
  };
};

export const SPOTS = [
  S({
    id: 'Vinaros', name: 'Vinaròs', zone: 'norte', zoneName: 'Vinaròs · El Fortí',
    lat: 40.46877, lon: 0.47904, facing: 106,
    bottom: 'Arena y escollera', bestTide: 'Media', bestSwell: 'E a SE', bestWind: 'O y NO flojo',
    level: 'Intermedio', desc: 'Playa urbana junto al puerto. Picos definidos cerca del dique con mar del Este.'
  }),
  S({
    id: 'Peniscola', name: 'Peñíscola Norte', zone: 'norte', zoneName: 'Peñíscola',
    lat: 40.3806, lon: 0.41021, facing: 106, swellWindow: [32, 162],
    bottom: 'Arena', bestTide: 'Media a alta', bestSwell: 'NE a E', bestWind: 'O y NO',
    desc: 'Playa Norte, larga y abierta al Gregal. Funciona con temporales del NE y E; con viento de poniente queda limpia.'
  }),
  S({
    id: 'MorroGos', name: 'Morro de Gos', zone: 'oropesa', zoneName: 'Oropesa del Mar',
    lat: 40.09491, lon: 0.14854, facing: 100, swellWindow: [40, 176], maxGood: 2.11,
    bottom: 'Arena con piedra', bestTide: 'Media subiendo', bestSwell: 'NE a SE', bestWind: 'O y NO',
    level: 'Intermedio', desc: 'Playa abierta al norte de Oropesa. De las más expuestas: recoge casi cualquier mar del primer cuadrante.'
  }),
  S({
    id: 'Renega', name: 'La Renegà', zone: 'oropesa', zoneName: 'Oropesa del Mar',
    lat: 40.06195, lon: 0.1206, facing: 148, exposureFactor: 0.9, swellWindow: [60, 212], maxGood: 1.5,
    bottom: 'Roca y lajas', bestTide: 'Alta', bestSwell: 'E con periodo', bestWind: 'O y NO',
    level: 'Avanzado', hazards: 'Fondo de roca y lajas; entrada y salida por piedras',
    desc: 'Costa rocosa entre Oropesa y Benicàssim. Necesita mar de fondo con fuerza; con tamaño rompe con más potencia que las playas.'
  }),
  S({
    id: 'Voramar', name: 'Voramar', zone: 'oropesa', zoneName: 'Benicàssim',
    lat: 40.05464, lon: 0.08248, facing: 142, exposureFactor: 0.85, swellWindow: [88, 204], maxGood: 1.5,
    bottom: 'Arena y roca', bestTide: 'Media a alta', bestSwell: 'E a SE', bestWind: 'NO y N',
    desc: 'Extremo norte de Benicàssim, al abrigo de la punta. Aguanta temporales grandes y queda protegido del viento del Norte.'
  }),
  S({
    id: 'Heliopolis', name: 'Heliópolis', zone: 'oropesa', zoneName: 'Benicàssim',
    lat: 40.02567, lon: 0.04526, facing: 115, swellWindow: [60, 190], maxGood: 1.98,
    bottom: 'Arena', bestTide: 'Media', bestSwell: 'NE a E', bestWind: 'O y NO',
    desc: 'Sur de Benicàssim, bancos de arena con buenas derechas cuando entra mar del Este.'
  }),
  S({
    // Jordi, 05/10/2026: el Gurugú es el pico del Serradal (antes estaba intercambiado con Pirámides).
    // Punto a ~80 m de la orilla sobre la costa de OSM, que aquí mira al 115.
    id: 'Gurugu', name: 'Gurugú', zone: 'grao', zoneName: 'Grao · Playa del Serradal',
    lat: 40.00838, lon: 0.03523, facing: 112, swellWindow: [48, 182], maxGood: 2.04,
    bottom: 'Arena', bestTide: 'Todas', bestSwell: 'NE a E', bestWind: 'O y NO',
    desc: 'Playa del Serradal, abierta y consistente. Picos variables según los bancos; la opción más fiable del Grao.'
  }),
  S({
    // Jordi, 05/10/2026: Pirámides es el pico de la Playa del Pinar, entre el Serradal y el Planetario
    // (antes estaba intercambiado con el Gurugú).
    id: 'Piramides', name: 'Pirámides', zone: 'grao', zoneName: 'Grao · Playa del Pinar',
    lat: 39.99872, lon: 0.03137, facing: 106, swellWindow: [48, 182], maxGood: 2.0,
    bottom: 'Arena', bestTide: 'Media', bestSwell: 'NE a E', bestWind: 'O y NO',
    desc: 'Playa del Pinar, al norte del Planetario. Picos variables sobre arena, olas largas y suaves; buena para tablón.'
  }),
  S({
    id: 'Planetario', name: 'Planetario', zone: 'grao', zoneName: 'Grao · Playa del Pinar',
    lat: 39.9784738, lon: 0.026575, facing: 102, swellWindow: [42, 168], maxGood: 2.37,
    bottom: 'Arena', bestTide: 'Media subiendo', bestSwell: 'NE a E', bestWind: 'O y NO',
    desc: 'Frente al Planetario, junto al dique norte del puerto. Rompiente clásica del Grao con Levante y Gregal.'
  }),
  S({
    id: 'Palaciet', name: 'El Palaciet', zone: 'sur', zoneName: 'Burriana · El Coso',
    lat: 39.90453, lon: -0.01584, facing: 143, swellWindow: [56, 210], maxGood: 1.53,
    bottom: 'Arena fina', bestTide: 'Media', bestSwell: 'E a SE', bestWind: 'O y NO',
    desc: 'Playa tranquila de Burriana, junto a El Coso, con rompiente suave; buena opción de tablón con mar pequeño.'
  }),
  S({
    id: 'Burriana', name: 'Burriana', zone: 'sur', zoneName: 'Burriana · El Arenal',
    lat: 39.86977, lon: -0.05905, facing: 118,
    bottom: 'Arena junto a escollera', bestTide: 'Todas', bestSwell: 'E a SE', bestWind: 'O y NO',
    desc: 'Junto a la escollera del puerto. Derecha larga y consistente sobre arena cuando entra mar del Este.'
  }),
  S({
    id: 'Nules', name: 'Nules', zone: 'sur', zoneName: 'Nules',
    lat: 39.82462, lon: -0.11001, facing: 120,
    bottom: 'Grava y arena entre espigones', bestTide: 'Media', bestSwell: 'E a SE', bestWind: 'O y NO',
    desc: 'Espigones cortos que ordenan picos rápidos de derecha e izquierda con temporales.'
  }),
  S({
    id: 'Almenara', name: 'Almenara', zone: 'sur', zoneName: 'Almenara · Casablanca',
    lat: 39.7332, lon: -0.18107, facing: 117, maxGood: 1.6,
    bottom: 'Grava y arena gruesa', bestTide: 'Media', bestSwell: 'E a SE', bestWind: 'O y NO',
    level: 'Intermedio', hazards: 'Orillera fuerte',
    desc: 'Playa de grava con olas rápidas y huecas cerca de la orilla.'
  })
];

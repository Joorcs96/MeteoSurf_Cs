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
    level: 'Intermedio', desc: 'Playa urbana junto al puerto. Picos definidos cerca del dique con mar del Este.',
    photo: {
      title: 'Platja del Fortí (Vinaròs)',
      thumb: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/46/Platja_del_Fort%C3%AD_%28Vinar%C3%B2s%29.jpg/960px-Platja_del_Fort%C3%AD_%28Vinar%C3%B2s%29.jpg',
      file: 'Platja_del_Fortí_(Vinaròs).jpg',
      author: 'Juan Emilio Prades Bel',
      license: 'CC BY-SA 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
      url: 'https://commons.wikimedia.org/wiki/File:Platja_del_Fort%C3%AD_%28Vinar%C3%B2s%29.jpg'
    }
  }),
  S({
    id: 'Peniscola', name: 'Peñíscola Norte', zone: 'norte', zoneName: 'Peñíscola',
    lat: 40.3806, lon: 0.41021, facing: 106, swellWindow: [32, 162],
    bottom: 'Arena', bestTide: 'Media a alta', bestSwell: 'NE a E', bestWind: 'O y NO',
    desc: 'Playa Norte, larga y abierta al Gregal. Funciona con temporales del NE y E; con viento de poniente queda limpia.',
    photo: {
      title: 'Platja del Nord (Peníscola)',
      thumb: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/54/100_Platja_del_Nord_%28Pen%C3%ADscola%29.jpg/960px-100_Platja_del_Nord_%28Pen%C3%ADscola%29.jpg',
      file: '100_Platja_del_Nord_(Peníscola).jpg',
      author: 'Enric',
      license: 'CC BY-SA 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
      url: 'https://commons.wikimedia.org/wiki/File:100_Platja_del_Nord_%28Pen%C3%ADscola%29.jpg'
    }
  }),
  S({
    id: 'MorroGos', name: 'Morro de Gos', zone: 'oropesa', zoneName: 'Oropesa del Mar',
    lat: 40.09491, lon: 0.14854, facing: 100, swellWindow: [40, 176], maxGood: 2.11,
    bottom: 'Arena con piedra', bestTide: 'Media subiendo', bestSwell: 'NE a SE', bestWind: 'O y NO',
    level: 'Intermedio', desc: 'Playa abierta al norte de Oropesa. De las más expuestas: recoge casi cualquier mar del primer cuadrante.',
    photo: {
      title: 'Platja del Morro de Gos (Oropesa del Mar)',
      thumb: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/55/Platja_del_Morro_de_Gos_Oropesa_del_Mar_Castell%C3%B3n_20180819_093007.jpg/960px-Platja_del_Morro_de_Gos_Oropesa_del_Mar_Castell%C3%B3n_20180819_093007.jpg',
      file: 'Platja_del_Morro_de_Gos_Oropesa_del_Mar_Castellón_20180819_093007.jpg',
      author: 'Josefito123',
      license: 'CC BY-SA 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
      url: 'https://commons.wikimedia.org/wiki/File:Platja_del_Morro_de_Gos_Oropesa_del_Mar_Castell%C3%B3n_20180819_093007.jpg'
    }
  }),
  S({
    id: 'Renega', name: 'La Renegà', zone: 'oropesa', zoneName: 'Oropesa del Mar',
    lat: 40.06195, lon: 0.1206, facing: 148, exposureFactor: 0.9, swellWindow: [60, 212], maxGood: 1.5,
    bottom: 'Roca y lajas', bestTide: 'Alta', bestSwell: 'E con periodo', bestWind: 'O y NO',
    level: 'Avanzado', hazards: 'Fondo de roca y lajas; entrada y salida por piedras',
    desc: 'Costa rocosa entre Oropesa y Benicàssim. Necesita mar de fondo con fuerza; con tamaño rompe con más potencia que las playas.',
    photo: {
      title: 'La Renegà',
      thumb: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/53/Renega.JPG/960px-Renega.JPG',
      file: 'Renega.JPG',
      author: 'Castellónenred',
      license: 'CC BY-SA 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
      url: 'https://commons.wikimedia.org/wiki/File:Renega.JPG'
    }
  }),
  S({
    id: 'Voramar', name: 'Voramar', zone: 'oropesa', zoneName: 'Benicàssim',
    lat: 40.05464, lon: 0.08248, facing: 142, exposureFactor: 0.85, swellWindow: [88, 204], maxGood: 1.5,
    bottom: 'Arena y roca', bestTide: 'Media a alta', bestSwell: 'E a SE', bestWind: 'NO y N',
    desc: 'Extremo norte de Benicàssim, al abrigo de la punta. Aguanta temporales grandes y queda protegido del viento del Norte.',
    photo: {
      title: 'Torreta y hotel Voramar de Benicàssim',
      thumb: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f1/Torreta_y_hotel_Voramar_de_Benic%C3%A0ssim_09.JPG/960px-Torreta_y_hotel_Voramar_de_Benic%C3%A0ssim_09.JPG',
      file: 'Torreta_y_hotel_Voramar_de_Benicàssim_09.JPG',
      author: '19Tarrestnom65',
      license: 'CC BY-SA 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
      url: 'https://commons.wikimedia.org/wiki/File:Torreta_y_hotel_Voramar_de_Benic%C3%A0ssim_09.JPG'
    }
  }),
  S({
    id: 'Heliopolis', name: 'Heliópolis', zone: 'oropesa', zoneName: 'Benicàssim',
    lat: 40.02567, lon: 0.04526, facing: 115, swellWindow: [60, 190], maxGood: 1.98,
    bottom: 'Arena', bestTide: 'Media', bestSwell: 'NE a E', bestWind: 'O y NO',
    desc: 'Sur de Benicàssim, bancos de arena con buenas derechas cuando entra mar del Este.',
    photo: {
      title: 'Platja d\'Heliòpolis (Benicàssim)',
      thumb: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d6/Platja_d%27Heli%C3%B2polis_%28Benic%C3%A0ssim%29.JPG/960px-Platja_d%27Heli%C3%B2polis_%28Benic%C3%A0ssim%29.JPG',
      file: 'Platja_d\'Heliòpolis_(Benicàssim).JPG',
      author: 'Juan Emilio Prades Bel',
      license: 'CC BY-SA 3.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
      url: 'https://commons.wikimedia.org/wiki/File:Platja_d%27Heli%C3%B2polis_%28Benic%C3%A0ssim%29.JPG'
    }
  }),
  S({
    // Jordi, 05/10/2026: el Gurugú es el pico del Serradal (antes estaba intercambiado con Pirámides).
    // Punto a ~80 m de la orilla sobre la costa de OSM, que aquí mira al 115.
    id: 'Gurugu', name: 'Gurugú', zone: 'grao', zoneName: 'Grao · Playa del Serradal',
    lat: 40.00838, lon: 0.03523, facing: 112, swellWindow: [48, 182], maxGood: 2.04,
    bottom: 'Arena', bestTide: 'Todas', bestSwell: 'NE a E', bestWind: 'O y NO',
    desc: 'Playa del Serradal, abierta y consistente. Picos variables según los bancos; la opción más fiable del Grao.',
    photo: {
      title: 'Platja del Serradal (Castelló de la Plana)',
      thumb: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/bc/Platja_del_Serradal_%28Castell%C3%B3_de_la_Plana%29.JPG/960px-Platja_del_Serradal_%28Castell%C3%B3_de_la_Plana%29.JPG',
      file: 'Platja_del_Serradal_(Castelló_de_la_Plana).JPG',
      author: 'Juan Emilio Prades Bel',
      license: 'CC BY-SA 3.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
      url: 'https://commons.wikimedia.org/wiki/File:Platja_del_Serradal_%28Castell%C3%B3_de_la_Plana%29.JPG'
    }
  }),
  S({
    // Jordi, 05/10/2026: Pirámides es el pico de la Playa del Pinar, entre el Serradal y el Planetario
    // (antes estaba intercambiado con el Gurugú).
    id: 'Piramides', name: 'Pirámides', zone: 'grao', zoneName: 'Grao · Playa del Pinar',
    lat: 39.99872, lon: 0.03137, facing: 106, swellWindow: [48, 182], maxGood: 2.0,
    bottom: 'Arena', bestTide: 'Media', bestSwell: 'NE a E', bestWind: 'O y NO',
    desc: 'Playa del Pinar, al norte del Planetario. Picos variables sobre arena, olas largas y suaves; buena para tablón.',
    photo: {
      title: 'Platja del Pinar (Castelló de la Plana)',
      thumb: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/30/Platja_del_Pinar_%28Castell%C3%B3_de_la_Plana%29.JPG/960px-Platja_del_Pinar_%28Castell%C3%B3_de_la_Plana%29.JPG',
      file: 'Platja_del_Pinar_(Castelló_de_la_Plana).JPG',
      author: 'Juan Emilio Prades Bel',
      license: 'CC BY-SA 3.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
      url: 'https://commons.wikimedia.org/wiki/File:Platja_del_Pinar_%28Castell%C3%B3_de_la_Plana%29.JPG'
    }
  }),
  S({
    id: 'Planetario', name: 'Planetario', zone: 'grao', zoneName: 'Grao · Playa del Pinar',
    lat: 39.9784738, lon: 0.026575, facing: 102, swellWindow: [42, 168], maxGood: 2.37,
    bottom: 'Arena', bestTide: 'Media subiendo', bestSwell: 'NE a E', bestWind: 'O y NO',
    desc: 'Frente al Planetario, junto al dique norte del puerto. Rompiente clásica del Grao con Levante y Gregal.',
    photo: {
      title: 'Platja del Pinar, Escollera (Castelló de la Plana)',
      thumb: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/eb/Platja_del_Pinar%2C_Escollera_%28Castell%C3%B3_de_la_Plana%29.JPG/960px-Platja_del_Pinar%2C_Escollera_%28Castell%C3%B3_de_la_Plana%29.JPG',
      file: 'Platja_del_Pinar,_Escollera_(Castelló_de_la_Plana).JPG',
      author: 'Juan Emilio Prades Bel',
      license: 'CC BY-SA 3.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
      url: 'https://commons.wikimedia.org/wiki/File:Platja_del_Pinar%2C_Escollera_%28Castell%C3%B3_de_la_Plana%29.JPG'
    }
  }),
  S({
    id: 'Palaciet', name: 'El Palaciet', zone: 'sur', zoneName: 'Burriana · El Coso',
    lat: 39.90453, lon: -0.01584, facing: 143, swellWindow: [56, 210], maxGood: 1.53,
    bottom: 'Arena fina', bestTide: 'Media', bestSwell: 'E a SE', bestWind: 'O y NO',
    desc: 'Playa tranquila de Burriana, junto a El Coso, con rompiente suave; buena opción de tablón con mar pequeño.',
    photo: {
      title: 'Clot de la Mare de Déu (Burriana)',
      thumb: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/fe/Clot_de_la_Mare_de_D%C3%A9u.jpg/960px-Clot_de_la_Mare_de_D%C3%A9u.jpg',
      file: 'Clot_de_la_Mare_de_Déu.jpg',
      author: 'Millars',
      license: 'CC BY-SA 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
      url: 'https://commons.wikimedia.org/wiki/File:Clot_de_la_Mare_de_D%C3%A9u.jpg'
    }
  }),
  S({
    id: 'Burriana', name: 'Burriana', zone: 'sur', zoneName: 'Burriana · El Arenal',
    lat: 39.86977, lon: -0.05905, facing: 118,
    bottom: 'Arena junto a escollera', bestTide: 'Todas', bestSwell: 'E a SE', bestWind: 'O y NO',
    desc: 'Junto a la escollera del puerto. Derecha larga y consistente sobre arena cuando entra mar del Este.',
    photo: {
      title: 'Puerto de Burriana (Castellón)',
      thumb: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/43/Puerto_de_Burriana_%28Castell%C3%B3n%29.jpg/960px-Puerto_de_Burriana_%28Castell%C3%B3n%29.jpg',
      file: 'Puerto_de_Burriana_(Castellón).jpg',
      author: 'Juan Emilio Prades Bel',
      license: 'CC BY 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
      url: 'https://commons.wikimedia.org/wiki/File:Puerto_de_Burriana_(Castell%C3%B3n).jpg'
    }
  }),
  S({
    id: 'Nules', name: 'Nules', zone: 'sur', zoneName: 'Nules',
    lat: 39.82462, lon: -0.11001, facing: 120,
    bottom: 'Grava y arena entre espigones', bestTide: 'Media', bestSwell: 'E a SE', bestWind: 'O y NO',
    desc: 'Espigones cortos que ordenan picos rápidos de derecha e izquierda con temporales.',
    photo: {
      title: 'Playa El Bovalar (Nules)',
      thumb: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/6b/Playa_El_Bovalar_-_Nules_-_Sur.jpg/960px-Playa_El_Bovalar_-_Nules_-_Sur.jpg',
      file: 'Playa_El_Bovalar_-_Nules_-_Sur.jpg',
      author: 'JavierMunozF',
      license: 'CC BY 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
      url: 'https://commons.wikimedia.org/wiki/File:Playa_El_Bovalar_-_Nules_-_Sur.jpg'
    }
  }),
  S({
    id: 'Almenara', name: 'Almenara', zone: 'sur', zoneName: 'Almenara · Casablanca',
    lat: 39.7332, lon: -0.18107, facing: 117, maxGood: 1.6,
    bottom: 'Grava y arena gruesa', bestTide: 'Media', bestSwell: 'E a SE', bestWind: 'O y NO',
    level: 'Intermedio', hazards: 'Orillera fuerte',
    desc: 'Playa de grava con olas rápidas y huecas cerca de la orilla.',
    photo: {
      title: 'Ones a la platja d\'Almenara',
      thumb: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/26/Ones_a_la_platja_d%27Almenara.JPG/960px-Ones_a_la_platja_d%27Almenara.JPG',
      file: 'Ones_a_la_platja_d\'Almenara.JPG',
      author: 'Joanbanjo',
      license: 'CC BY-SA 3.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
      url: 'https://commons.wikimedia.org/wiki/File:Ones_a_la_platja_d%27Almenara.JPG'
    }
  })
];

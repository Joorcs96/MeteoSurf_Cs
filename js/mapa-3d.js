// mapa-3d.js — Vista de relieve en 3D del mapa (MapLibre GL, sin claves).
//
// Satélite de Esri sobre un modelo de elevación gratuito (Terrarium, de Mapzen/AWS):
// se ve la costa de Castellón con las sierras de detrás. Los spots son los mismos
// puntos del mapa plano y al tocarlos se abre la misma ventana de previsión.

const VERSION = '4.7.1';
const BASE = `https://cdn.jsdelivr.net/npm/maplibre-gl@${VERSION}/dist/`;

function cargarMapLibre() {
  if (window.maplibregl) return Promise.resolve(window.maplibregl);
  return new Promise((ok, fallo) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet'; css.href = BASE + 'maplibre-gl.css';
    document.head.appendChild(css);
    const js = document.createElement('script');
    js.src = BASE + 'maplibre-gl.js';
    js.onload = () => (window.maplibregl ? ok(window.maplibregl) : fallo(new Error('MapLibre no se inició')));
    js.onerror = () => fallo(new Error('No se pudo descargar el mapa 3D'));
    document.head.appendChild(js);
  });
}

const ESTILO = {
  version: 8,
  sources: {
    satelite: {
      type: 'raster', tileSize: 256, maxzoom: 18,
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      attribution: 'Imagen © Esri · Relieve © Mapzen/AWS',
    },
    relieve: {
      type: 'raster-dem', encoding: 'terrarium', tileSize: 256, maxzoom: 14,
      tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
    },
    // Fuente aparte para el sombreado: MapLibre avisa de que compartirla con el terreno baja la calidad.
    sombreado: {
      type: 'raster-dem', encoding: 'terrarium', tileSize: 256, maxzoom: 14,
      tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
    },
  },
  layers: [
    { id: 'satelite', type: 'raster', source: 'satelite' },
    { id: 'sombras', type: 'hillshade', source: 'sombreado', paint: { 'hillshade-exaggeration': 0.35, 'hillshade-shadow-color': '#0a0f14' } },
  ],
  terrain: { source: 'relieve', exaggeration: 1.7 },
  sky: {
    'sky-color': '#7fb0e8', 'horizon-color': '#dbe8f5', 'fog-color': '#dbe8f5',
    'sky-horizon-blend': 0.5, 'horizon-fog-blend': 0.6, 'fog-ground-blend': 0.4,
  },
};

// `pinHtml(spot)` devuelve el HTML del punto (el mismo del mapa plano); `onSpot(spot)` abre la ventana.
export async function crear3D(cont, spots, { pinHtml, onSpot }) {
  const ml = await cargarMapLibre();
  const mapa = new ml.Map({
    container: cont, style: ESTILO,
    center: [-0.04, 40.02], zoom: 9.8, pitch: 66, bearing: -78, maxPitch: 80,
    attributionControl: { compact: true },
  });
  mapa.addControl(new ml.NavigationControl({ visualizePitch: true }), 'top-right');
  const etiquetas = () => cont.classList.toggle('show-labels', mapa.getZoom() >= 10);
  mapa.on('zoom', etiquetas); etiquetas();

  // Línea de orientación de cada playa (hacia dónde mira).
  mapa.on('load', () => {
    mapa.addSource('orientaciones', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: spots.map((s) => {
          const r = (s.facing * Math.PI) / 180, k = 0.012;
          return { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[s.lon, s.lat], [s.lon + (k * Math.sin(r)) / Math.cos((s.lat * Math.PI) / 180), s.lat + k * Math.cos(r)]] } };
        }),
      },
    });
    mapa.addLayer({ id: 'orientaciones', type: 'line', source: 'orientaciones', paint: { 'line-color': '#ffffff', 'line-width': 2, 'line-opacity': 0.85 } });
  });

  const marcadores = spots.map((s) => {
    const el = document.createElement('div');
    el.className = 'pin3d';
    el.innerHTML = pinHtml(s);
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      onSpot(s);
      mapa.easeTo({ center: [s.lon, s.lat], offset: [0, -Math.round(window.innerHeight * 0.18)], duration: 700 });
    });
    return new ml.Marker({ element: el, anchor: 'center' }).setLngLat([s.lon, s.lat]).addTo(mapa);
  });

  return {
    mostrar() { cont.hidden = false; mapa.resize(); },
    ocultar() { cont.hidden = true; },
    destruir() { marcadores.forEach((m) => m.remove()); mapa.remove(); },
  };
}

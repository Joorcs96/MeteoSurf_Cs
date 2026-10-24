// mapa-3d.js — Vista de relieve en 3D del mapa (MapLibre GL, sin claves).
//
// Mapa de calles de OpenStreetMap sobre un modelo de elevación gratuito (Terrarium, de
// Mapzen/AWS): se ve la costa de Castellón con las sierras de detrás, sin vista de satélite. Los spots son los mismos
// puntos del mapa plano y al tocarlos se abre la misma ventana de previsión.

import { FLECHA } from './mapa-capas.js';

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
    base: {
      type: 'raster', tileSize: 256, maxzoom: 19,
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      attribution: '© OpenStreetMap · Relieve © Mapzen/AWS',
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
    { id: 'base', type: 'raster', source: 'base' },
    { id: 'sombras', type: 'hillshade', source: 'sombreado', paint: { 'hillshade-exaggeration': 0.55, 'hillshade-shadow-color': '#37424b', 'hillshade-highlight-color': '#ffffff', 'hillshade-accent-color': '#5b6770' } },
  ],
  terrain: { source: 'relieve', exaggeration: 1.7 },
  sky: {
    'sky-color': '#9cc3ee', 'horizon-color': '#e8f0f8', 'fog-color': '#e8f0f8',
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

  // Motor para las capas tipo Windy (viento, oleaje…): flechas pegadas al terreno y etiquetas.
  const pegadas = [];
  const motor = {
    contenedor: () => cont,
    limpiar() { pegadas.splice(0).forEach((m) => m.remove()); },
    pintar(items) {
      motor.limpiar();
      items.forEach((it) => {
        if (it.dir != null) {
          const f = document.createElement('div');
          f.className = 'capa3d-flecha';
          f.innerHTML = FLECHA(0, it.col, Math.round(it.tam * 1.7));
          pegadas.push(new ml.Marker({ element: f, rotation: it.dir, rotationAlignment: 'map', pitchAlignment: 'map' }).setLngLat([it.lon, it.lat]).addTo(mapa));
        }
        const t = document.createElement('div');
        t.className = 'capa-punto capa3d-texto';
        t.innerHTML = `<b style="color:${it.col}">${it.texto}</b>`;
        pegadas.push(new ml.Marker({ element: t, offset: [0, it.dir != null ? 26 : 0] }).setLngLat([it.lon, it.lat]).addTo(mapa));
      });
    },
    aLatLng(x, y) { const p = mapa.unproject([x, y]); return { lat: p.lat, lng: p.lng }; },
    alCambiarVista(fn) { mapa.on('resize', fn); mapa.on('moveend', fn); return () => { mapa.off('resize', fn); mapa.off('moveend', fn); }; },
    alTocar(fn) { mapa.on('click', (e) => fn(e.lngLat.lat, e.lngLat.lng)); },
    popup(lat, lng) {
      const p = new ml.Popup({ maxWidth: '240px' }).setLngLat([lng, lat]).setHTML('Cargando…').addTo(mapa);
      return { poner: (html) => p.setHTML(html) };
    },
    destruir() { motor.limpiar(); },
  };

  return {
    motor,
    mostrar() { cont.hidden = false; mapa.resize(); },
    ocultar() { cont.hidden = true; },
    destruir() { marcadores.forEach((m) => m.remove()); mapa.remove(); },
  };
}

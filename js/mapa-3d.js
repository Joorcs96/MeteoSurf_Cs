// mapa-3d.js — Vista de relieve en 3D del mapa (MapLibre GL, sin claves).
//
// Mapa de calles de OpenStreetMap sobre un modelo de elevación gratuito (Terrarium, de
// Mapzen/AWS): se ve la costa de Castellón con las sierras de detrás, sin vista de satélite. Los spots son los mismos
// puntos del mapa plano y al tocarlos se abre la misma ventana de previsión.

import { FLECHA } from './mapa-capas.js';
import { geometriaOrientacion } from './orientaciones-mapa.js';

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
    { id: 'base', type: 'raster', source: 'base' },
    { id: 'satelite', type: 'raster', source: 'satelite', layout: { visibility: 'none' } },
    { id: 'sombras', type: 'hillshade', source: 'sombreado', paint: { 'hillshade-exaggeration': 0.55, 'hillshade-shadow-color': '#37424b', 'hillshade-highlight-color': '#ffffff', 'hillshade-accent-color': '#5b6770' } },
  ],
  terrain: { source: 'relieve', exaggeration: 1.7 },
  sky: {
    'sky-color': '#9cc3ee', 'horizon-color': '#e8f0f8', 'fog-color': '#e8f0f8',
    'sky-horizon-blend': 0.5, 'horizon-fog-blend': 0.6, 'fog-ground-blend': 0.4,
  },
};

// `pinHtml(spot)` devuelve el HTML del punto (el mismo del mapa plano); `onSpot(spot)` abre la ventana.
export async function crear3D(cont, spots, { pinHtml, onSpot, onBase }) {
  const ml = await cargarMapLibre();
  const mapa = new ml.Map({
    container: cont, style: ESTILO,
    center: [-0.04, 40.02], zoom: 9.8, pitch: 66, bearing: -78, maxPitch: 80,
    attributionControl: { compact: true },
  });
  mapa.addControl(new ml.NavigationControl({ visualizePitch: true }), 'top-right');
  // Base elegible: mapa de calles o satélite (se recuerda la elección).
  let satelite = false;
  try { satelite = localStorage.getItem('ms_mapa3d_sat') === '1'; } catch { /* sin almacenamiento */ }
  const aplicarBase = () => {
    if (!mapa.getLayer('satelite')) return;
    mapa.setLayoutProperty('satelite', 'visibility', satelite ? 'visible' : 'none');
    mapa.setLayoutProperty('base', 'visibility', satelite ? 'none' : 'visible');
    mapa.setPaintProperty('sombras', 'hillshade-exaggeration', satelite ? 0.3 : 0.55);
    onBase?.(satelite);
  };
  mapa.on('load', aplicarBase);
  const etiquetas = () => cont.classList.toggle('show-labels', mapa.getZoom() >= 10);
  mapa.on('zoom', etiquetas); etiquetas();

  // Mismo sector de mar útil y misma flecha que el mapa 2D.
  mapa.on('load', () => {
    const orientaciones = spots.map(geometriaOrientacion);
    mapa.addSource('sectores-mar', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: orientaciones.map((o) => o.sector),
      },
    });
    mapa.addLayer({ id: 'sectores-mar-relleno', type: 'fill', source: 'sectores-mar', paint: { 'fill-color': '#67c9e8', 'fill-opacity': 0.18 } });
    mapa.addLayer({ id: 'sectores-mar-borde', type: 'line', source: 'sectores-mar', paint: { 'line-color': '#8bdcf2', 'line-width': 1, 'line-opacity': 0.7 } });
    mapa.addSource('flechas-orientacion', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: orientaciones.map((o) => o.eje) },
    });
    mapa.addLayer({ id: 'flechas-orientacion', type: 'line', source: 'flechas-orientacion', paint: { 'line-color': '#ffffff', 'line-width': 2, 'line-opacity': 0.9 } });
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
    alternarBase() {
      satelite = !satelite;
      try { localStorage.setItem('ms_mapa3d_sat', satelite ? '1' : '0'); } catch { /* sin almacenamiento */ }
      aplicarBase();
      return satelite;
    },
    esSatelite: () => satelite,
    mostrar() { cont.hidden = false; mapa.resize(); },
    ocultar() { cont.hidden = true; },
    destruir() { marcadores.forEach((m) => m.remove()); mapa.remove(); },
  };
}

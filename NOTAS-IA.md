# NOTAS-IA — SURFLINE CASTELLÓN

## Arquitectura del proyecto
- **Sin** archivos CSS separados — los estilos estaban TODO en `<style>` dentro de `index.html` (Tailwind CDN)
- Estructura: `index.html` (812 líneas), `app.js` (2071 líneas, lógica y renderizado de spots), `sw.js`, `votar.html`, `manifest.json`
- Se ha creado `css/app.css` nuevo (tokens + componentes) y se enlaza desde `index.html`
- `app.js` usa `className` y `classList` para asignar clases Tailwind dinámicamente → NO tocar

## Clases críticas usadas por app.js (NO renombrar)
- `.spot-card` — tarjetas de spot (click handler)
- `.spot-filter-btn` — filtros de zona (se reasigna className completo)
- `.day-tab-btn` — tabs de día (se reasigna className completo)
- `.dark-tiles` — capa del mapa Leaflet invertida
- `.spot-tooltip` — tooltip de Leaflet
- `.hidden`, `.flex` — toggle de visibilidad en modales y players
- `.animate-spin` — spinner de icono de refresh
- `.opacity-50` — señal de cámara inactiva

## Diseño aplicado
- Fuente: Inter 400/500/600/700 (Google Fonts)
- Acento único: ocean blue `#0ea5e9` (--clr-primary)
- Modo oscuro: base `#070b12`, superficies `#0c1322` / `#111b30` / `#182442`
- Tokens en `:root` con modo claro en `@media (prefers-color-scheme: light)`
- `prefers-reduced-motion: reduce` aplicado en todas las animaciones
- Animaciones: fade-up en secciones, hover lift en cards, scale en imágenes

## Trampas encontradas
- Las clases de Tailwind asignadas dinámicamente en app.js (ej. `bg-sky-500 text-slate-950 shadow-md shadow-sky-500/20`) no pueden moverse a CSS custom porque el JS las reasigna completas
- El mapa Leaflet tiene `z-index: 10` forzado en el inline style de `#map` — no conflictar
- `animate-in fade-in zoom-in-95 duration-200` es de Tailwind animate-in plugin, NO es animación nativa — el modal ya tiene animation en CSS custom

## Rama y commits
- Rama: `Joorcs96/redisenar-web`
- Commit 1: `4d8a968` — sistema CSS, Inter, accesibilidad

## Pendiente
- Capturas con Playwright (instalando Chromium)
- Revisión de `votar.html` para misma fuente Inter

# NOTAS-IA · MeteoSurf_Cs

Notas para las IA que trabajen en este proyecto. Breves; actualizar al cerrar cada tarea.

## Datos básicos
- Web: https://joorcs96.github.io/MeteoSurf_Cs/ (GitHub Pages, rama main, raíz). Repo Joorcs96/MeteoSurf_Cs (antes Surfline_CS; Netlify ya no se usa).
- Carpeta local sigue llamándose C:/Users/Jordi/orca/Surfline_CS. Investigación e informes: C:/Users/Jordi/orca/meteosurf_research.
- Frontend sin build: index.html, css/app.css, js/{app,forecast,spots,cams,compass,assistant}.js, sw.js, webcams.json.
- Probar en local: `python -m http.server 8765` y abrir http://127.0.0.1:8765/. Capturas móvil: Chrome headless por CDP (script shot.mjs en el scratchpad de Claude; ancho 400).

## Preferencias de Jordi
- Como Surfline y Surf-Forecast pero con los spots de Castellón; móvil primero, profesional, directo, poco texto (partes plegables).
- Nada de emojis ni símbolos tipo check en la web.
- Planetario es el spot por defecto (primero en listas).
- Escala mediterránea: 0.5–0.7 m con poco viento ya es buen baño; periodo 4–6 s es normal.
- Publicar directo en main (tras verificar en móvil); trabajo en rama o worktree y fusión rápida.

## Decisiones y trampas
- Previsión: Open-Meteo marine por spot (punto seaLat/seaLon) + GFS-Wave (ncep_gfswave016) para rellenar días 11–16; forecast con viento/sol.
- Cámaras: Turisme CV HLS (streaming.comunitatvalenciana.com/webcam/<Nombre>/playlist.m3u8, CORS *, sin token), Hotel Voramar MJPEG, IPCamLive Peñíscola, Windy como respaldo. Skyline no se puede iframear y sus JPG no cargan fuera de su web.
- Surfers Castellón: su cámara está tras login de socios. Solo hay una pestaña de enlace (embedType 'link' en webcams.json, se abre su web). NO extraer claves ni automatizar login ni pedir credenciales a Jordi; solo incrustar si el club da enlace público o permiso.
- El cron de webcams (.github/workflows/webcams.yml, cada 30 min) solo reescribe webcams.json si cambia algo real.
- CARTO pide API key: el mapa usa OSM + Esri satélite.
- Orca: workers gemini en worktree distinto fallan en agent_readiness; usar `--agent antigravity --model gemini-3.1-pro-high`. Worktrees nuevos de Orca parten de un commit viejo: resetear a main antes.
- Si un worker Antigravity queda quieto, leer su terminal: puede ser 'Individual quota reached' (Gemini 3.1 Pro, reset ~2 h) o el prompt sin enviar (mandar Intro con `orca terminal send --enter`). Relevo: `--agent antigravity --model claude-sonnet-4-6`.
- Los workers a veces escriben sin tildes: revisar textos visibles antes de publicar.

## Pendiente de Jordi
- Confirmar orientaciones medidas con OSM que cambian mucho: La Renegà 148°, Voramar 142°, El Palaciet 143°.
- Cámara de Surfers Castellón: pedir al club enlace público o permiso.

# NOTAS-IA · MeteoSurf_Cs

Notas para las IA que trabajen en este proyecto. Breves; actualizar al cerrar cada tarea.

## Datos básicos
- Web: https://joorcs96.github.io/MeteoSurf_Cs/ (GitHub Pages, rama main, raíz). Repo Joorcs96/MeteoSurf_Cs (antes Surfline_CS; Netlify ya no se usa).
- Carpeta local sigue llamándose C:/Users/Jordi/orca/Surfline_CS. Investigación e informes: C:/Users/Jordi/orca/meteosurf_research.
- Frontend sin build: index.html, css/app.css, js/{app,forecast,spots,cams,compass,assistant}.js, sw.js, webcams.json.
- Probar en local: `python -m http.server 8765` y abrir http://127.0.0.1:8765/. Capturas móvil: Chrome headless por CDP (script shot.mjs en el scratchpad de Claude; ancho 400).
- Datos reales: `python scripts/realtime.py` escribe data/realtime.json (cron horario en .github/workflows/realtime.yml, igual que webcams.yml pero con `--comprobar`). Python en este equipo: `C:\Users\Jordi\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe`.

## Preferencias de Jordi
- Como Surfline y Surf-Forecast pero con los spots de Castellón; móvil primero, profesional, directo, poco texto (partes plegables).
- Nada de emojis ni símbolos tipo check en la web.
- Planetario es el spot por defecto (primero en listas).
- Escala mediterránea: 0.5–0.7 m con poco viento ya es buen baño; periodo 4–6 s es normal.
- Publicar directo en main (tras verificar en móvil); trabajo en rama o worktree y fusión rápida.

## Decisiones y trampas
- Previsión: Open-Meteo marine por spot (punto seaLat/seaLon) + GFS-Wave (ncep_gfswave016) para rellenar días 11–16; forecast con viento/sol.
- Datos reales (scripts/realtime.py + data/realtime.json, todo de Puertos del Estado, sin claves):
  - No hay boya ni mareógrafo en Castellón. Oleaje = Boya de Valencia (REDEXT, id 2630), a 55 km; nivel del mar = Mareógrafo de Sagunto (id 3655), a 44 km, y el JSON lo avisa. Viento = estación REMPOR del puerto, la de Castellón Mistral (id 4660) está a 1 km y hay seis a menos de 5 km; cada una es con su nombre de viento (Mistral, Gregal, Levante, Poniente, Siroco, Tamontana), así que si una cae el script prueba la siguiente.
  - La API no tiene documentación pública: las rutas salen del JavaScript de portus.puertos.es. Base `https://portus.puertos.es/portussvr/api`:
    - `GET /estaciones/rt/{WAVE,SEA_LEVEL,WIND}?locale=es` → catálogo (nombre, coordenadas, `disponible`, `estado`, `cadencia`). Sin `locale` da 400.
    - `POST /parametros/<id>?locale=es` con `["WAVE","WIND"]` → los ids numéricos de los parámetros.
    - `POST /RTData/station/<id>?locale=es` con esos ids → las últimas observaciones. Ojo: los valores son enteros y hay que dividirlos por `factor`; `averia: true` y los centinelas (9999) son basura, scripts/realtime.py los descarta con límites por parámetro.
  - `estaciones/rt/WAVE` incluye también puntos de "Propagación de Oleaje" que son un modelo matemático, no medidas. El script se queda sólo con los que son boya de verdad.
  - TLS: en este host falla la confianza en la cadena de Portus. Excepción limitada a `https://portus.puertos.es:443/portussvr/api/`, sin redirecciones, sólo para errores de cadena (no caducidad/hostname). El JSON avisa del riesgo de datos manipulados; `REALTIME_CA_BUNDLE` obliga a verificar. No se envían secretos.
  - `data/realtime.json` no lleva la edad en minutos a propósito: cambia en cada ejecución y el cron commitearía cada hora aunque las medidas fueran idénticas. `js/forecast.js` la calcula con `antiguedadRealtime()`.
  - Retirado el adaptador experimental AEMET: ruta/esquema incorrectos y sin prueba real. Workflow y script usan sólo las tres fuentes públicas de Portus, sin claves.
  - UI integrada: tarjeta en cada ficha y línea de boya en Mis spots. Edad por `fecha` de cada observación (no `generado`), gris tras 3 h o fecha inválida; se recalcula cada minuto y al volver a la pestaña. Distancias por coordenadas del spot. Comparación con `waveHeight` mar adentro de la misma hora de Madrid, nunca con la rompiente; señala que son lugares distintos.
  - Validación: `python -m unittest scripts.test_realtime`; capturas reales 390×844 claro/oscuro y pruebas de estados en `.capturas/` (sin commit). Caché SW `meteosurf-cs-v7-realtime`.
- Modelo de contraste `ecmwf_wam025` (loadEcmwfWam() en js/forecast.js): sólo publica altura, periodo y dirección totales; si se le pide el desglose por trenes de ola o el nivel del mar responde todo a null. Su malla no pasa de 40.3°N, así que **Vinaros y Peñíscola no tienen dato** de este modelo. Horizonte útil hasta 12 días. Va aparte de loadForecast() a propósito: un tercer array horario de 13 puntos en la caché de localStorage es arriesgado.
- Cámaras: Turisme CV HLS (streaming.comunitatvalenciana.com/webcam/<Nombre>/playlist.m3u8, CORS *, sin token), Hotel Voramar MJPEG, IPCamLive Peñíscola, Windy como respaldo. Skyline no se puede iframear y sus JPG no cargan fuera de su web.
- Surfers Castellón: su cámara está tras login de socios. Solo hay una pestaña de enlace (embedType 'link' en webcams.json, se abre su web). NO extraer claves ni automatizar login ni pedir credenciales a Jordi; solo incrustar si el club da enlace público o permiso.
- El cron de webcams (.github/workflows/webcams.yml, cada 30 min) solo reescribe webcams.json si cambia algo real.
- CARTO pide API key: el mapa usa OSM + Esri satélite.
- Orca: workers gemini en worktree distinto fallan en agent_readiness; usar `--agent antigravity --model gemini-3.1-pro-high`. Worktrees nuevos de Orca parten de un commit viejo: resetear a main antes.
- Si un worker Antigravity queda quieto, leer su terminal: puede ser 'Individual quota reached' (Gemini 3.1 Pro, reset ~2 h) o el prompt sin enviar (mandar Intro con `orca terminal send --enter`). Relevo: `--agent antigravity --model claude-sonnet-4-6`.
- Estrellas (0-5) derivadas de la calidad 0-7 en js/app.js (starRating/stars); días con calidad >= 5 se resaltan ('Día bueno'/'Día muy bueno').
- 29/09: cuotas de Antigravity agotadas (Gemini ~4 h; Claude Sonnet y GPT-OSS ~5 días). Codex como relevo (arranca con el prompt sin enviar: mandar Intro). Tras worker-start, comprobar la terminal.
- Los workers a veces escriben sin tildes: revisar textos visibles antes de publicar.

## Normas de trabajo (incluir en specs)
- Parar bucles: 3 fallos seguidos de la misma prueba = parar, causa en 3 líneas, volver al último commit bueno y preguntar.
- Logs de más de 50 líneas: solo 20 primeras + 20 últimas.
- Antes de integrar en main: rebase sobre el main actual y repetir la prueba.

## Pendiente de Jordi
- Confirmar orientaciones medidas con OSM que cambian mucho: La Renegà 148°, Voramar 142°, El Palaciet 143°.
- Cámara de Surfers Castellón: pedir al club enlace público o permiso.

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
- Los workers a veces escriben sin tildes: revisar textos visibles antes de publicar.

## Rewinds (clips de las cámaras)
- `scripts/rewind.py` graba 20 s de las cámaras HLS de Turisme CV que cubren Planetario/Gurugu
  (Grao, cv_grao_castellon), Voramar/Heliopolis (Benicàssim, cv-benicassim-vela-hls) y
  MorroGos/Renega (Oropesa, cv-oropesa-hls); 854x480, H.264 sin audio, boxblur 2 para que no se
  reconozcan caras, objetivo <= 3 MB (medido y reintentado con ffmpeg). Una clip por cámara y una
  entrada de índice por cada spot que cubre (apuntan al mismo clip).
- Índice `data/rewinds.json`: `{updatedAt, timezone, dias, rewinds: [...]}`. Cada entrada:
  `id, spot, spotNombre, camara, camaraNombre, camaraCorta, credito, hora` (ISO con desfase de
  Madrid), `horaLocal` ("2026-10-01 14:00"), `url`, `archivo`, `release, duracion, bytes, ancho,
  alto, desenfoque` y `prevision` con `altura, periodo, direccion, direccionTxt, swellAltura,
  swellPeriodo, marDeVientoAltura, temperaturaAgua, viento, vientoRacha, vientoDireccion,
  vientoDireccionTxt, temperatura, horaApi`. La web puede pintarlo tal cual.
- El parser de `js/spots.js` replica la fórmula de `S()` para el punto de mar; contrastado con Node.
- `gh release upload` a la release mensual `rewinds-AAAA-MM`; los assets de más de 30 días se
  borran con `gh release delete-asset` y la release, si queda vacía, con `gh release delete`.
- `.github/workflows/rewinds.yml`: cada 2 h de 05:00 a 19:00 UTC; el script solo graba de 8 a 20 h
  de Madrid (así el cambio de hora no obliga a tocar el cron) y solo si algún spot llega a 0,5 m.
- ffmpeg no está en el PATH de este portátil. Para probar en local: `npm i ffmpeg-static
  ffprobe-static` en una carpeta temporal y usar las variables FFMPEG y FFPROBE. En GitHub
  Actions los runners ya los traen.
- El canal de Benicàssim Vela da 404 durante minutos cuando el servidor de Turisme CV
  re-publica: el grabador reintenta dos veces (5 s y 12 s) antes de seguir con el resto.
- En local NO subir nada a la release; eso lo hace el workflow.


## Calidad y estrellas (03/10/2026)
- Techos estrictos por altura en rompiente (h < 0.35m: máx r1/0★, < 0.48m: máx r2/1★, < 0.65m: máx r3/2★, < 0.75m: máx r4/3★, < 1.05m: máx r5/4★, < 1.40m: máx r6/5★). Evita que periodo o terral inflen sesiones sin tamaño surfeable.
- Viento y rachas: `windState()` no asigna 'glassy' con viento de mar; velocidad efectiva `max(v, g * 0.65)` y penalización acumulativa por rachas fuertes (g >= 26 km/h) y rachas desproporcionadas respecto al viento medio (g >= 1.8 * v).
- Mar de viento corto/desordenado: si domina mar de viento con periodo < 5.2 s se aplica penalización de calidad (-0.6).
- Distinción estricta de datos: mar plato real = `rating: 0` (Plato, 0★, `0–0.2 m`), previsiones ausentes/NaN = `rating: null` (Sin datos, 0★, `– m`, clase `.r-na`).
- Swell limpio aprovechable: mantiene calificaciones altas (0.9m+ a 8s con terral alcanza r6 Bueno, 5★).
- Banco de pruebas: ejecutable con `node tools/test_rating_conservador.js` (16 pruebas unitarias y comparativas sintéticas).

## Auditoría independiente de las estrellas (05/10/2026)
- Regresión grave que quedaba viva tras 89c1d42: `range()` de `app.js` decidía la validez por `s.mid`, pero tres vistas la llaman con `{min, max}` sin `mid` (franja de 7 días, cabecera de mejor ventana y panel de 5-16 días). Mostraban siempre `– m` en vez del rango de altura. Ahora `range()` guarda por `min`/`max`. Comprobado revirtiendo el arreglo: `node tools/test_formato_null.js` pasa a 3 fallos.
- Trampa de pruebas: `tools/test_rating_conservador.js` replicaba `range()` con el mismo bug, así que daba verde mientras la app rompía. Las réplicas de formato no sirven como prueba; `tools/test_formato_null.js` extrae el código real de `js/app.js` y `js/assistant.js` y lo evalúa.
- Nulo que se vestía de 0: `Math.round(null)` = 0, así que sin viento se veía `0 km/h`, rachas `0` y `NaN–NaN km/h`. Ahora hay `kmh()` y `rnd()` en `app.js` y `kmh()` en `assistant.js`. El 0 medido sigue mostrándose como 0.
- El asistente calculaba `Math.min(...horas.map(h => h.surf.min))`; con todos los nulos eso da 0 y pintaba `0–0 m`, que lee como mar plano en vez de sin datos. Ahora filtra nulos y delega en `fmtRange(null, null)` = `–`.
- Comprobado que 5★ solo con buenas condiciones: por debajo de 1.05 m en rompiente ninguna combinación de periodo, viento y rachas llega a 5★ (barrido en `test_formato_null.js`), y 1.2 m a 7 s con calma sí las alcanza.
- Suite nueva: `node tools/test_formato_null.js` (15 pruebas). Suite completa: `node tools/test_rating_conservador.js` (16) + `python -m unittest scripts.test_realtime backend.test_motor_fisica scripts.test_rewind` (84).

## Publicación en main (05/10/2026)
- PR2 https://github.com/Joorcs96/MeteoSurf_Cs/pull/2 mergeado con commit de merge `c4040d8` (estilo del repo, como PR1); HEAD probado y mergeado `04d1bf8`. main local intacto y sin force-push.
- main solo había avanzado con `277b2d5` (auto `[skip ci]` de `data/realtime.json`), que no toca ningún fichero del PR: no hizo falta rebase y el merge fue CLEAN con blobs idénticos a los del SHA probado.
- [VERIFICADO] Pages `pages build and deployment` run 37278886847 con headSha `c4040d8` en `success`; y GET a https://joorcs96.github.io/MeteoSurf_Cs devuelve 200 en `js/app.js`, `js/forecast.js`, `js/assistant.js` y `sw.js` con el mismo hash de blob que `c4040d8` (comparado con `git hash-object` sobre lo descargado), más `index.html` y `data/realtime.json` en 200.
- [VERIFICADO] En producción: `range()` en app.js:36, `kmh()`/`rnd()` en app.js:42-43, `kmh()` en assistant.js:40 y caché del SW subida a `meteosurf-cs-v9-rating` (sw.js:3). El bump de versión del SW es lo que hace que los móviles recojan el arreglo.
- Trampa de verificación: comparar "el fichero publicado" con `git hash-object` del archivo descargado, no solo con `git rev-parse`; si el SW no bumpara la caché, un GET puede devolver la versión antigua desde la caché del navegador y dar un falso verde.

## Normas de trabajo (incluir en specs)
- Parar bucles: 3 fallos seguidos de la misma prueba = parar, causa en 3 líneas, volver al último commit bueno y preguntar.
- Logs de más de 50 líneas: solo 20 primeras + 20 últimas.
- Antes de integrar en main: rebase sobre el main actual y repetir la prueba.

- GitHub: la rama por defecto es main desde 01/10/2026 (antes desarrollo-web-surf, y por eso los cron de main no corrían). Los cron solo corren en la rama por defecto.
- Planetario: Jordi surfea exactamente en 39.9784738, 0.0265750 (junto al dique norte del puerto).
- Calibración real (Jordi, 30/09 18:40-19 h, Planetario): casi sin olas y el viento de mar lo estropeaba, con 0.36-0.38 m y 5.6 s mar adentro y un viento de 6-8 km/h del ESE con rachas de 18. La web daba 0.4-0.6 m, demasiado optimista: el factor de Komar multiplica x1.44 y el estudio v3 da x0.85 a 5 s. Las rachas cuentan.
- Estudio físico v3 (rayos OSM + EMODnet, verificado con check.py) en meteosurf_research/calculos_v3/.

## Pendiente de Jordi
- Confirmar orientaciones medidas con OSM que cambian mucho: La Renegà 148°, Voramar 142°, El Palaciet 143°.
- Cámara de Surfers Castellón: pedir al club enlace público o permiso.

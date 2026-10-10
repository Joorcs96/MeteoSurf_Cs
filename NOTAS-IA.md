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
- **Publicar siempre:** cada cambio verificado se despliega en el momento (push a main y comprobar la web online). Lo que no esté listo permanece en su rama y se avisa. Cada norma nueva de Jordi se apunta aquí y en las globales.

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

## Normas de trabajo (incluir en specs)
- Parar bucles: 3 fallos seguidos de la misma prueba = parar, causa en 3 líneas, volver al último commit bueno y preguntar.
- Logs de más de 50 líneas: solo 20 primeras + 20 últimas.
- Antes de integrar en main: rebase sobre el main actual y repetir la prueba.

- GitHub: la rama por defecto es main desde 01/10/2026 (antes desarrollo-web-surf, y por eso los cron de main no corrían). Los cron solo corren en la rama por defecto.
- Planetario: Jordi surfea exactamente en 39.9784738, 0.0265750 (junto al dique norte del puerto).
- Calibración real (Jordi, 30/09 18:40-19 h, Planetario): casi sin olas y el viento de mar lo estropeaba, con 0.36-0.38 m y 5.6 s mar adentro y un viento de 6-8 km/h del ESE con rachas de 18. La web daba 0.4-0.6 m, demasiado optimista: el factor de Komar multiplica x1.44 y el estudio v3 da x0.85 a 5 s. Las rachas cuentan.
- Nowcast con boya: si hay dato reciente (≤ 3h) de boya, se calcula un ratio de corrección frente al modelo mar adentro, limitado a [0.7, 1.6].
- Este ratio se aplica a las alturas futuras en un radio de 60 km, decayendo linealmente a 1 a las 12 horas.
- Estudio físico v3 (rayos OSM + EMODnet, verificado con check.py) en meteosurf_research/calculos_v3/.
- **Hay dos motores, no uno.** La web (`js/forecast.js`) usa el v3 (Komar por trenes, `exposureFactor`, `maxGood`, `swellWindow`) y puntúa 1-7; el backend (`backend/motor_fisica.py`) usa el heredado (sigmoide, sin trenes) y puntúa 0-5, y es el que llena `historico_olas.csv`. El histórico no registra lo que ve el usuario. Decidir en `DUDAS.md` 1; no lo cambies por tu cuenta.
- Trenes de oleaje: Open-Meteo publica `swell_*`, `secondary_swell_*` y `wind_wave_*`; el total `wave_height` es la suma energética de los tres (medido: la suma es del 0.93 al 1.03 del total). Pedir solo dos pierde hasta un 18% de altura. El prefijo del viento es `wind`, no `wind_wave`: las variables son `wind_wave_height`. `desglose_oleaje()` en `backend/actualizar_prevision.py` es puro y sin red, y devuelve además `fraccion_viento`, que todavía no usa nadie.
- `dir_swell_deg` del histórico guarda la dirección del **tren dominante**, no la del total; si manda el mar de viento, esa es la que se registra.
- Periodo 4-6 s en el Mediterráneo: no penaliza (estudio v3 y escala de Jordi). Por debajo de 4 s sí, -0.5. El estado heredado del worker arrived a castigar hasta 5 s, en contra del estudio.
- Viento de mar: un solo tramo, -0.5 desde 12 km/h; por encima de 20 entra el tramo global (-1) y por encima de 30 otro (-1). No añadas un segundo tramo de viento de mar, que es como se restaba dos veces.
- Pruebas del backend: `python -m unittest backend.test_motor_fisica backend.test_actualizar_prevision` (44). `unittest discover -s backend` falla: `backend` no es paquete importable.
- El worker que inicia `orden/relevo-cuota.ps1` puede morir dejando el worktree con cambios a medias: guarda primero un commit de checkpoint antes de corregir nada.


- 05/10: Planetario casi plano a las 15 h con 0.6 m / 4.4 s del ENE en el modelo: Komar daba 0.75 m. Ahora la web usa la tabla v3 (`js/physics.js`) en 8 spots, viento efectivo max(media, 0.6 x racha), Calma < 6 km/h efectivos y el periodo 4-6 s no penaliza. Caso 4 en `node scripts/test_calibracion.mjs`. Los modelos (MF, ECMWF, GFS) daban casi lo mismo todo el día: el bajón real lo marcaron la boya (mar del E de 8 s que se apaga y gira a S) y la brisa de mar.
- Spots del Grao de norte a sur (Jordi, 05/10): Gurugú = Serradal (40.00838, 0.03523), Pirámides = Playa del Pinar (39.99872, 0.03137), Planetario. Antes estaban intercambiados. Ambos usan la tabla v3 calculada en 39.99872 (la de 'Gurugu') hasta recalcular. La cámara del Grao y los rewinds cubren Planetario y Pirámides.
- 05/10 por la mañana un amigo de Jordi surfeó bien a las 9 h con 0.47 m en rompiente y terral: la escala era pesimista. Ahora 0.40-0.50 m con terral o calma da Regular (techo sube un escalón con viento limpio); con viento de mar sigue Muy malo. Los otros 12 spots comprobados con costa OSM + Nominatim: en el agua y en su playa.
- Seguridad: CSP en index/votar (permite jsdelivr, Open-Meteo, Turisme CV, IPCamLive, Windy, YouTube; vídeos https). Nada de scripts inline: el de votar está en `js/votar.js`. Si se añade una fuente externa nueva, hay que añadirla a la CSP o se bloquea.

## Pendiente de Jordi
- Confirmar orientaciones medidas con OSM que cambian mucho: La Renegà 148°, Voramar 142°, El Palaciet 143°.
- Cámara de Surfers Castellón: pedir al club enlace público o permiso.


## Rediseño y clips · 06/10/2026
- [VERIFICADO] SPEC completado en rama Joorcs96/rediseno-surfline; resultados y límites en INFORME-REDISENO.md. Capturas sólo locales en .capturas/rediseno/.
- [VERIFICADO] stopCam invalida la sesión y cancela recordClip; callbacks HLS/JPG/clip deben respetar esa sesión para no borrar un reproductor posterior.
- [VERIFICADO] Leaflet carga CSS después del nuestro: usar #map en controles para que se conserven los 44 px. shot.mjs necesita carpeta absoluta para el perfil Chrome en este host.
- [VERIFICADO] Node --check con dos archivos sólo comprueba el primero: ejecutar también js/cams.js por separado. Safari físico pendiente; ocultación sin captureStream comprobada en Chrome.

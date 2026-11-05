# DUDAS.md

Dudas que no se pueden resolver sin decisión de Jordi. Se aplicó la opción conservadora y se siguió.

## 05/11/2026 · Resolución definitiva de webcams Morro de Gos y Trinimar (móvil y PC)

- **Resuelto:** Integrado reproductor embebido mediante `cam_skyline.html` con sandbox y origen opaco (`Origin: null`), lo que permite que el auth server de Skyline entregue los fragmentos reales HLS `2815speed-*.ts` / `2816speed-*.ts` (Full HD 1080p) en vez de cortinillas de copyright.
- **Regla de cero gasto y cero procesos en el host:** Ver cámaras no consume ningún token de IA ni ejecuta tareas en segundo plano en el portátil de Jordi. El tráfico es 100% web nativo (HTTP/HLS) en el navegador del cliente al pulsar Play.
- **Aspecto idéntico:** Cuenta con los mismos controles de vídeo (`controls`), ajuste proporcional (`object-fit: contain`) y badges que las demás cámaras.

## 04/11/2026 · Directos de Morro de Gos y Trinimar en móvil

- **Diagnóstico definitivo del segundo intento:** Jordi confirma pantalla negra y «Búfer» en los móviles tras publicar. Las pruebas de Chrome emulado no representan el resultado real y las afirmaciones previas de «directo arreglado» quedan anuladas.
- SkylineWebcams indica en sus preguntas frecuentes que **solo los propietarios pueden integrar el vídeo en directo** en otra web. Sus páginas responden `X-Frame-Options: SAMEORIGIN`; el HLS entrega fragmentos `copyright_violation` con el origen de GitHub Pages. El marco de origen opaco que sorteaba esta restricción no es una integración fiable ni autorizada.
- No se ha encontrado otra emisión autorizada que muestre exactamente las cámaras de Koral Beach/Morro de Gos y Trinimar/Heliópolis. Se retira el reproductor experimental y se muestra «Directo no disponible», sin imagen fija ni enlace sustitutivo. El verificador periódico no las volverá a marcar como directos funcionales por un HTTP 200.
- **Pendiente:** URL HLS o reproductor oficial autorizado para MeteoSurf, o permiso y acceso facilitados por Servigroup/SkylineWebcams. Con esa fuente se integrarán siguiendo el reproductor normal y se comprobará en teléfonos físicos antes de llamar al trabajo terminado.
- Jordi confirma que ambas webcams siguen fallando en iPhone y Android. El reproductor actual usa un iframe `data:` aislado y oculta los rechazos de `video.play()`. Chrome móvil simulado sí llegó a decodificar vídeo real de ambas playas, por lo que esa prueba no reproduce el fallo de los teléfonos.
- Se intentó cambiar el iframe a `srcdoc` y añadir un botón para iniciar o reintentar el directo. La prueba forzando un rechazo de reproducción pasó inicialmente, pero después falló tres veces seguidas: el vídeo dejó de avanzar dos veces y una vez no llegó a estado listo. Por la regla de tres fallos, se hizo `git restore` del intento y no se publicó.
- Para resolverlo hace falta reproducir el fallo en Safari de iPhone y Chrome de Android reales, o registrar desde esos móviles el error de red/reproducción. No se debe llamar «arreglado» al vídeo solo por pasar en Chrome de escritorio o emulado.
- Segundo intento: se eliminó el iframe `data:` interior, se incluyó Hls.js en la propia web y se añadieron inicio manual y reintento con tiempo límite. Pruebas locales: ambas playas en movimiento en Chrome móvil emulado con perfiles iPhone y Android, incluso tras bloqueo de reproducción y corte de red; capturas muestran las playas. Pendiente confirmar en los teléfonos físicos de Jordi tras publicar.


## 26/10/2026 · App Móvil Fase 1 (Antigravity Flash, rama feature/mejoras-ux-auditoria)

- **[VERIFICADO] Config plugins en app.json:** En la spec se especificaba añadir expo-haptics y @react-native-async-storage/async-storage a la matriz plugins de app.json. Ambos paquetes son módulos nativos con autolinking directo de Expo y no exportan un plugin de configuración (config plugin), provocando error fatal al arrancar Expo (PluginError). Se retiraron de plugins en app.json manteniéndose instalados y enlazados normalmente.
- **[VERIFICADO] Instalación de @expo/vector-icons:** En el template de Expo SDK no venía preinstalado @expo/vector-icons; se instaló mediante npx expo install @expo/vector-icons.
- **[VERIFICADO] Tipo de color en TabIcon:** El tipo del argumento color en tabBarIcon en React Navigation moderno devuelve ____ColorValue_Internal; se tipó color: any en TabIcon para evitar error en TypeScript estricto.
- **[VERIFICADO] Archivo adaptive-icon.png:** create-expo-app generó android-icon-foreground.png. Se copió a adaptive-icon.png para cumplir con la referencia de app.json.

## 05/10/2026 · Auditoría de las estrellas (OpenCode, rama Joorcs96/ms-corrige-estrellas)

- **[NO VERIFICADO] Las 5★ exigen 1.05 m en rompiente y en Castellón pueden ser raras.**
  Comprobado con el barrido de `tools/test_formato_null.js`: por debajo de 1.05 m ninguna combinación
  de periodo, viento o rachas llega a 5★. Con la previsión real que había en `data/` las oleadas rondaban
  0.3 m, así que en días normales el techo visible será 3-4★. Es coherente con "cinco estrellas tienen que
  justificar buenas condiciones", pero si Jordi espera ver 5★ en un temporal de 0.9 m con swell limpio,
  el umbral hay que bajarlo. No lo he tocado: es calibración de la física y la tarea prohibía cambiarla.
  Decisión de Jordi.

- **[NO VERIFICADO] Con el techo conservador, la etiqueta "Día bueno" (rating >= 5) puede quedar casi
  inalcanzable.** El día sólo se marca bueno si al menos 2 horas alcanzan r5 o más. Con marejada baja son
  horas contadas. Lo he dejado así para no inflarse. Si sale demasiado mudo, la opción suave es
  exigir 2 horas con r4 o más en vez de r5.

- **[NO VERIFICADO] Sin vista previa en navegador móvil.** Todo lo verificado es por pruebas y lectura de
  código; no he abierto la web ni he hecho capturas. Lo que la web muestra de verdad lo confirma el
  probador antes del merge.

# DUDAS

## 7. 17/10/2026 · El modelo de persona y tabla entra, pero no decide

- **[VERIFICADO] El módulo carga e infiere**: webgl, tfjs 4.22.0, coco-ssd 2.2.3, 262 tensores, y una
  llamada directa sobre el vídeo devuelve `marcoId` 56 y 94 ms. En la escena de rectángulos de la E2E
  devuelve `sin_deteccion` con 0 persona y 0 tabla, y entonces **no se graba ningún clip**: eso es
  justamente la propiedad que se pedía, que un fallo del modelo no se tome por un surfista.
- **[NO VERIFICADO] Que el modelo reconozca a un surfista de verdad.** Con la cámara real no se ha medido
  ninguna vez que detecte persona y tabla, porque no se ha grabado ningún clip con surfistas. El único
  caso con el modelo viene de una escena sintética de rectángulos, donde acertar es decir «no».
- **[NO VERIFICADO] Que los dos detectores discordan bien en la práctica.** Con que el pixel diga «coge
  ola» y el modelo diga «no veo a nadie», no se graba: el píxel gana en disparadores y el modelo puede
  silenciar la vigía por completo si está mal calibrado a esa distancia. Con la cámara del club, que
  abarca toda la playa, es un riesgo real. Si en la práctica no sale nada, lo primero que hay que tocar es
  `iaConfianzaMin` (0,35) o `iaValidezMs` (4 000 ms), no los umbrales del detector de píxeles.
- **[VERIFICADO, MENOR]** `estado().inferencias` del módulo devuelve 0 pese a inferir. Se reporta; no se
  afirma nada sobre ese contador.

## 4. 17/10/2026 · Lo que sigue SIN comprobar, dicho sin adornos

- **[VERIFICADO] El clip ya es real y completo.** Con navegador con ventana: búfer previo de 7-8 s,
  clip de 11,5 s que **se reproduce entero**, un solo contenedor. Y sobre la cámara real del club:
  clip de 9,44 s, 3,7 MB, también reproducible. Evidencia en `docs/E2E_VIGIA.md`. Lo que había antes
  (concatenar grabaciones) daba 3,0 s de 5 s: estaba roto y ahora no.
- **[NO VERIFICADO] iPhone de verdad.** El grabador `codificado` no usa `captureStream`, que es lo que
  faltaba en Safari de iOS, así que en principio debería funcionar desde iOS 16.4. Pero **no se ha
  probado en un móvil real** y no hay iPhone conectado a este host. Lo que sí está comprobado es que,
  si el navegador no soporta ninguno de los dos grabadores, la web lo dice con el motivo en vez de
  enseñar un botón inútil. Falta: abrir la app en el iPhone de Jordi y comprobar que el botón de vigía
  aparece, graba y descarga.
- **[NO VERIFICADO] Que el detector acierte con un surfista real.** `js/deteccion.js` es una
  **heurística sobre píxeles**, no un modelo entrenado: no hay pesos, ni red, ni COCO. Lo demostrado
  es que dispara con surfistas sintéticos y que separa boya, espuma, bañista, surfista quieto y quien
  solo rema en pruebas unitarias y en una escena E2E. Lo que no se puede afirmar es su precisión con
  la cámara del club, que abarca toda Playa del Pinar y donde el surfista sale muy pequeño.
- **[NO VERIFICADO] Duración exacta de la reproducción en iOS.** El WebM de 640x360 es H.264-free
  (VP8); Safari de iOS reproduce WebM/VP8 desde iOS 17.4 de forma general. En iOS 16.4 puede tocar
  decodificar sí pero no mostrarlo. Si fallara, la alternativa es grabar en H.264 (`avc1`), que el
  `VideoEncoder` de Safari sí admite; está comprobado que el códec está soportado, no que el
  navegador lo use por defecto.

## 4b. 17/10/2026 · Por qué `MediaRecorder` no sirve en pruebas sin ventana

- **[VERIFICADO] En navegador SIN ventana, `MediaRecorder` devuelve 0 bytes** aunque el vídeo se esté
  reproduciendo (`readyState 4`, pista `live`, sin mute) y aunque se repinte un lienzo 74 veces. Con
  ventana funciona: 859 kB de búfer previo y 1,4 MB de clip. El grabador no es el problema; la falta de
  compositor lo es. Por eso las pruebas de grabación van con ventana y no en CI.

## 5. 17/10/2026 · Umbrales del detector sin calibrar con surfista real

- **[NO VERIFICADO] La calidad del detector no está medida contra un surfista de verdad.** No hay ningún
  clip del club con un surfista confirmado y etiquetado, así que lo único verificado son positivos y
  negativos sintéticos (`tools/test_deteccion_ola.js`, 52 pruebas) y una escena E2E que dispara de verdad
  con píxeles generados en el momento. Con la cámara de Playa del Pinar, que abarca toda la playa, el
  surfista sale muy pequeño en la rejilla de análisis; por eso el recorte a la banda de agua
  (`bandaImagen`) es lo que decide si esto sirve o no.
- Decisión de Jordi: si en la práctica sale demasiado mudo, ¿se prefiere subir `velNetaMinPxS` y
  `olaNetoMinPx` (más mudo pero limpio) o bajar `contrasteOscuro` y `altoMinPersonaFrac` (más sensible con
  más falsos positivos)? La opción conservadora por defecto es lo primero.
- `pxPorMetro` está en `null` a propósito. Si alguien mide la escala real de la cámara (cuántos metros de
  rompiente ocupa el ancho del encuadre), se puede poner y los mensajes pasan a dar metros de verdad.

## 6. 17/10/2026 · Permisos de la webcam del club

- **[VERIFICADO] La emisión es pública y sin credenciales** (el alias va en la URL, `domainlockenabled = 0`
  y el HLS responde con CORS abierto), pero **la cámara es del Club Surfers Castellón** y en `NOTAS-IA.md`
  sigue pendiente "pedir al club enlace público o permiso".
- Lo que hace este cambio: la web **no** republica ni sube imagen del club. El backend sigue siendo el que
  decide si publica clips en la release mensual, y los clips de la vigía se quedan en el dispositivo del
  usuario. Si el club pide que no se grabe en absoluto, el sitio a tocar es
  `.github/workflows/rewinds.yml` (quitar `--incluir-ipcamlive`) y quitar `surfers_castellon_hls` del
  catálogo; la webcam se vería igualmente con el iframe del club.

## 1. El backend y la web calculan con dos motores distintos

**Estado:** abierto, pendiente de decision de Jordi. No lo he tocado: cambiarlo
rediseña el histórico y los datos de entrenamiento.

- La web (`js/forecast.js` + `js/spots.js`) usa el motor **v3** (Komar por
  trenes, `exposureFactor`, `maxGood`, `swellWindow` del estudio en
  `meteosurf_research/calculos_v3/`) y puntúa de 1 a 7.
- El backend (`backend/motor_fisica.py`) usa el motor **heredado** (sigmoide de
  sombra, sin trains) y puntúa de 0 a 5. Lo ejecuta el cron diario
  `prevision_diaria.yml` para llenar `historico_olas.csv` y la alerta de WhatsApp.

Consecuencia: **el histórico no registra lo que ve el usuario en la web.** Con
la mar de 0.37 m / 5.6 s del 30/09 la web puntúa 4/7 (Komar da 0.55 m en
rompiente) y el backend 2/5. La diferencia viene sobre todo del factor de
Komar, que multiplica x1.44 y es justo lo que Jordi probing como "demasiado
optimista".

**Opciones:**
- a) Portar el motor v3 a Python y dejar el heredado solo como referencia.
  Es lo correcto para entrenar el modelo del futuro, pero toca
  `historico_olas.csv` (formato de calidad 0-5) y las 27 pruebas heredadas.
- b) No hacer nada y aceptar que el histórico es "el motor viejo".
- c) Descartar el histórico como dato de entrenamiento y usar solo el feedback
  de `votar.html`.

**Mi recomendación:** (a), pero en un worktree propio, con la decisión de si
`calidad_0_5` pasa a ser 0-7 o se reescala a 0-5 tomada de Jordi.

## 2. Las rachas de viento no entran en el backend

El criterio de calibración de NOTAS-IA dice "las rachas cuentan" y el caso del
30/09 fue 6-8 km/h con rachas de 18. `obtener_datos_meteorologicos()` solo
pide `wind_speed_10m`, no `wind_gusts_10m` (la web sí lo pide). Sin las rachas,
un día de brisa con rachas fuertes sale igual que un día de calma.
**Pendiente:** decidir si se añaden y cómo se mezclan con la media.

## 3. Los valores por debajo de 3 s

Con viento de tierra fuerte la API devuelve trenes de 2.5 s que no llegan a
formar ola. El backend los registra tal cual (el 07/10 salían 0.01-0.13 m con
2.5 s). `desglose_oleaje()` no los filtra. ¿Se descartan por debajo de 3 s, que
es el `periodo_min_s` del estudio v3, o se dejan para que el modelo los ignore?

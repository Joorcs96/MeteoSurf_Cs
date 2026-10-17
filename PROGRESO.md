# Vigía de ola con clip real · 17/10/2026 (segunda vuelta, cierra el defecto crítico)

| Tarea | Estado | Rama | Siguiente paso |
| --- | --- | --- | --- |
| Contenedor único (crítico del auditor) | Hecho y medido: se eliminó la concatenación de grabaciones. Los trozos se vuelven a escribir en un muxador nuevo desde una marca de inicio, así que el clip tiene una sola cabecera. Antes: 1,4 MB que solo duraban 3,0 s de 5 | Joorcs96/reparar-surfers | — |
| Clip reproducible con búfer previo real | Hecho: grabador con WebCodecs + muxador. Medido 11,5 s de clip con 7-8 s previos (escena con detector) y 9,44 s (cámara real del club) | Joorcs96/reparar-surfers | — |
| E2E detector → clip | Hecho: escena sintética, 6 disparos `coge_ola`, clip reproducido y medido (`python scripts/probar_vigia_e2e.py`) | Joorcs96/reparar-surfers | — |
| E2E cámara real del club | Hecho: emisión resuelta, vídeo 1280x720, búfer de 6 s, clip de 9,44 s reproducible. **Disparo manual**: no hay surfista etiquetado | Joorcs96/reparar-surfers | Calibrar con imágenes reales |
| Móvil / Safari de iOS | Hecho el camino: el grabador no usa `captureStream`, así que no depende de lo que faltaba en iOS. Si no hay soporte, el motivo se enseña. **Sin probar en un iPhone real** | Joorcs96/reparar-surfers | Probar en el móvil de Jordi |
| Fuga de clips a otros spots | Hecho: la búsqueda ya solo mira las cámaras del propio spot (Vinaròs enseñaba clips de Orihuela) | Joorcs96/reparar-surfers | — |
| Clips del histórico en móvil | Hecho: se traen con fetch y Blob, porque GitHub los manda como descarga y en iOS/Android no arrancaban | Joorcs96/reparar-surfers | — |
| `crossOrigin` en el vídeo HLS | Hecho: sin eso el lienzo queda tainted y la vigía no puede leer píxeles | Joorcs96/reparar-surfers | — |
| Caducidad del streamid | Hecho: `data/streams.json` se refresca aunque la URL no cambie, si no la webava a apagar una emisión sana | Joorcs96/reparar-surfers | Vigilar el TTL |
| Pruebas | 52 detector + 114 flujo + 73 rewind + 131 suite + 4 UI + 2 suites JS + 2 E2E con ventana | Joorcs96/reparar-surfers | Probador antes de integrar |

Evidencia medida en `docs/E2E_VIGIA.md`. Lo que **no** está demostrado y está dicho sin adornos en
`DUDAS.md` 4: que el detector acierte con un surfista real, y que funcione en el iPhone de Jordi.

---

# Vigía de ola y reparación de "Ver cómo rompía" · 17/10/2026

| Tarea | Estado | Rama | Siguiente paso |
| --- | --- | --- | --- |
| Causa de por qué se rompía "Ver cómo rompía" | Hecho y reproducida: `prevision_spots()` tenía el `return` dentro del bucle (regresión de `0afa82a`), así que solo se pedía previsión de MorroGos y solo `cv-oropesa-hls` podía grabarse. Planetario, Pirámides, Gurugú, Voramar, Heliopolis y la webcam del club quedaban con 0 clips | Joorcs96/reparar-surfers | Regresión cubierta por prueba |
| Cobertura de Gurugú | Hecho: `SPOTS_CON_CAMARA` ya incluye `Gurugu`, que antes quedaba fuera aunque su cámara lo cubre | Joorcs96/reparar-surfers | — |
| Evidencia de surf honesta | Hecho: el muestreo por oleaje ya no se vende como "posible ola"; escribe `imagenAnalizada: false` y la web solo pinta el distintivo con evidencia de imagen de verdad | Joorcs96/reparar-surfers | — |
| Webcam del club grabable | Hecho: nueva entrada `surfers_castellon_hls` (prioridad 0) cuya emisión HLS resuelve el backend en `data/streams.json`; el iframe del club queda de reserva | Joorcs96/reparar-surfers | Revisar el TTL de 45 min |
| Detector de surfista cogiendo ola | Hecho: `js/deteccion.js` sin dependencias, con evidencia de persona + tabla, movimiento sostenido y recorrido; rechaza boya, espuma, bañista, surfista quieto y quien solo rema | Joorcs96/reparar-surfers | Calibrar con clips reales |
| Prebuffer y clip al coger ola | Hecho: búfer circular de 12 s antes del disparo + 8 s después; el clip incluye el inicio de la ola. Solo en el dispositivo del usuario | Joorcs96/reparar-surfers | Comprobar la grabación en navegador con ventana |
| Errores claros | Hecho: sin índice, sin coincidencias, clip que ya no está y emisión sin resolver explican el motivo en pantalla | Joorcs96/reparar-surfers | — |
| Pruebas | 52 detector + 81 flujo/Ver + 73 `test_rewind` + 131 suite completa + 4 UI en Edge + 2 JS heredadas | Joorcs96/reparar-surfers | Probador antes de integrar |

Limitación real declarada: **la grabación con `MediaRecorder` no se ha podido comprobar en navegador sin ventana**
en este host (devuelve 0 bytes aunque el vídeo se reproduzca). Ver `DUDAS.md` 4.

---

# Imágenes libres, clips Planetario y evidencia de surf · 11/10/2026

| Tarea | Estado | Rama | Siguiente paso |
| --- | --- | --- | --- |
| Fotografías reales por spot (13 spots) | Hecho: fotos verificadas de Wikimedia Commons con atribución, autor y enlaces de licencia (CC BY-SA / CC BY) | Joorcs96/imagenes-clips | Revisión independiente |
| Muestreo diurno Planetario (Surfers IPCamLive) | Hecho: resolución dinámica HLS (`player.php?alias=609a27d8a9c83`), ventana olas pequeñas (Hs >= 0.35m con terral/calma), metadatos completos y procedencia de modelo | Joorcs96/imagenes-clips | Revisión independiente |
| Detector cinemático de surfistas | Hecho: filtro explícito de falsos positivos (boyas oscilantes, bañistas en orilla, nadadores y reflejos), etiquetado honesto como posible ola | Joorcs96/imagenes-clips | Calibración con capturas reales |
| Comparador de condiciones similares | Hecho: distancia euclídea normalizada mediterránea (Hs, periodo, swell, viento) en UI y reproducción de clips | Joorcs96/imagenes-clips | Acumular clips archivados |
| Registro de sesiones ("He surfeado hoy") | Hecho: botones de confirmación de baño y mar plano en ficha de spot, preservación en localStorage para calibración de olas pequeñas | Joorcs96/imagenes-clips | Conectar con historico-datos |
| Pruebas y validación responsiva | Hecho: 98 tests Python (rewind + física), 62 tests JS (rating + formato + calibración), 4 tests UI en Edge headless (390 px y 1366 px) | Joorcs96/imagenes-clips | PR y entrega a coordinador |

---

# Ajuste con boya · 10/10/2026

| Tarea | Estado | Rama | Siguiente paso |
| --- | --- | --- | --- |
| DiagnÃ³stico sesiÃ³n de Jordi 09/10 8-14 h Planetario | Hecho: la fÃ­sica acierta; el modelo se quedÃ³ corto (0.31-0.58 m vs boya 0.94 m, x1.6). Web daba Muy malo a las 8-9 h | main | â |
| CorrecciÃ³n con boya (js/nowcast.js) | Publicado: ratio boya/modelo limitado a 0.7-1.6, decae a 0 en 12 h, solo obs <= 3 h y spots <= 60 km. Caso 6: 1 -> 4 | main | Vigilar: el cron de realtime corre cada 4-5 h (retrasos de GitHub), asÃ­ que la boya a menudo llega vieja y no corrige |
| Integrar webcam en directo de Surfers Castellón | Hecho: identificada fuente IPCamLive (alias 609a27d8a9c83), integrada como iframe en directo en Planetario, Pirámides y Gurugú sin requerir login ni exponer credenciales | main | Verificada en móvil |
| Auditoría y archivo histórico de boyas + Excel | Hecho: recuperadas 814 observaciones reales de Git (486 boyas), histórico JSONL/CSV deduplicado, exportador Excel (6 hojas) y suite de pruebas | Joorcs96/historico-datos | Revisar por coordinador y activar workflow |

---

# RediseÃ±o Surfline Â· 06/10/2026

| Tarea | Estado | Rama | Siguiente paso |
| --- | --- | --- | --- |
| Completar WIP 8053158 | Hecho; cÃ¡mara, Rewind, grabaciÃ³n y limpieza al navegar | Joorcs96/rediseno-surfline | RevisiÃ³n independiente |
| Afinar mÃ³vil claro/oscuro | Hecho; controles 44 px, cifras legibles, formulario y barras | Joorcs96/rediseno-surfline | Revisar capturas locales |
| AceptaciÃ³n del SPEC | 20 + 17 + 15 pruebas, sintaxis, shot, CSP y 65 comprobaciones correctas | Joorcs96/rediseno-surfline | Ver INFORME-REDISENO.md |
| PublicaciÃ³n | Pendiente; sin integraciÃ³n ni push a main | Joorcs96/rediseno-surfline | Coordinar revisiÃ³n y publicaciÃ³n |

Capturas y logs: `.capturas/rediseno/` (no subir a git). GrabaciÃ³n MP4 real de 20 s y alternativa WebM comprobadas. Se conserva a continuaciÃ³n el historial anterior.

---

# Datos reales Â· 05/10/2026

| Tarea | Estado | Rama | Siguiente paso |
| --- | --- | --- | --- |
| Revisar captura Portus y workflow | Hecha: TLS acotado, sin secretos, valores/fechas validados y selecciÃ³n de fuente reciente | Joorcs96/ms-realtime-reviewed | Revisar al integrar |
| Mostrar observaciones en ficha y Mis spots | Hecha: edad por sensor, distancias, gris tras 3 h, comparaciÃ³n horaria mar adentro | Joorcs96/ms-realtime-reviewed | Integrar por coordinador |
| Pruebas y capturas mÃ³viles | Hechas: script real, 8 pruebas Python, escenarios de navegador, sintaxis JS y claro/oscuro 390Ã844 | Joorcs96/ms-realtime-reviewed | Capturas e informes locales en `.capturas/` |
| CorrecciÃ³n conservadora de estrellas y calidad | Hecha: techos por altura en rompiente, heurÃ­stica de rachas y viento de mar, mar de viento corto penalizado, distinciÃ³n Plato (0) vs Sin datos (null), y coherencia total | Joorcs96/ms-corrige-estrellas | RevisiÃ³n independiente |
| AuditorÃ­a de las estrellas (OpenCode) | Hecha: corregida regresiÃ³n de `range()` que ocultaba el rango de altura en 3 vistas, nulos que se veÃ­an como 0 km/h y NaN, y `0â0 m` falso del asistente; suite propia de 15 pruebas | Joorcs96/ms-corrige-estrellas | PR abierto, sin merge; probar el probador antes de integrar |

Sin merge a main; `js/spots.js` y `js/compass.js` intactos. Pruebas Python reproducibles con `python -m unittest scripts.test_realtime backend.test_motor_fisica scripts.test_rewind` (84 tests OK). Pruebas JS con `node tools/test_rating_conservador.js` (16 tests OK) y `node tools/test_formato_null.js` (15 tests OK).
La excepciÃ³n TLS mantiene un riesgo de autenticidad en los datos pÃºblicos; `REALTIME_CA_BUNDLE` permite exigir verificaciÃ³n. AEMET experimental retirado: las fuentes requeridas funcionan sin secretos.

<<<<<<< HEAD
| Pruebas y capturas mÃ³viles | Hechas: script real, 8 pruebas Python, escenarios de navegador, sintaxis JS y claro/oscuro 390â844 | Joorcs96/ms-realtime-reviewed | Capturas e informes locales en `.capturas/` |
| Calibrar la previsiÃ³n (relevo del worker sin cuota) | Hecha: trenes de oleaje separados, periodo 4â6 s sin penalizar, viento de mar penaliza desde 12 km/h. 44 pruebas en verde | Joorcs96/calibracion-prevision | Decidir DUDAS.md 1 (portar el motor v3 al backend) |

## Calibrar la previsiÃ³n (05/10/2026)

El worker anterior muriÃ³ por cuota a medias. Lo que habÃ­a dejado y cÃ³mo quedÃ³:

- **Checkpoint** `59a8e03` guarda su estado tal cual, con 7 de 27 pruebas en
  rojo. No borrar: es el punto de vuelta.
- **`cd0df3d`** â `desglose_oleaje()` separa fondo, fondo 2 y viento antes de
  calcular. Antes solo se pedÃ­an dos trenes, asÃ­ que la altura se quedaba
  entre un 6% y un 18% corta. La API sÃ­ publica `secondary_swell_wave_*`.
- `f8671d7` `calcularCalidad()`: el periodo de 4â6 s no penaliza (el
  estado heredado restaba 1 por debajo de 5 s, contra el estudio v3) y el viento
  de mar tiene un Ãºnico tramo desde 12 km/h (antes se restaba dos veces por
  encima de 20).

Prueba de aceptaciÃ³n: `python -m unittest backend.test_motor_fisica backend.test_actualizar_prevision` â 44 pruebas, OK.

Verificado ademÃ¡s contra la API real (`forecast_days=3`, sin tocar
`historico_olas.csv`): alturas en rompiente de 0.01 a 0.48 m y calidad
repartida entre 0 y 4, con el 4/5 entrando solo con terral.

Sin merge a main. `js/` y `historico_olas.csv` intactos.
=======
| Rediseño | Hecha: adaptado a main (Outfit, motion, data preserved) | Joorcs96/redisenar-main | Revisar |
>>>>>>> seguridad-csp

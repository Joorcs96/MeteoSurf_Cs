# Rediseño visual profesional y herramientas de diseño · 16/10/2026

| Tarea | Estado | Rama | Siguiente paso |
| --- | --- | --- | --- |
| Contrato visual y tokens costeros | Hecho: paleta azul tinta y arena (#f7f8f9 / #0d1b2a / #1d7090) en claro y oscuro en `:root` de `css/app.css` | Joorcs96/diseno-profesional | Revisión independiente |
| Supresión de barras inferiores en escritorio | Hecho: ocultadas `.tabbar` y `.quick-spots` en `>= 800px`, liberando 120 px de viewport vertical y eliminando redundancia con `.topnav` | Joorcs96/diseno-profesional | Revisión independiente |
| Tarjetas de spot y resumen de mejor ventana | Hecho: tarjetas elevadas con sutil borde, tipografía `tabular-nums` en altura, metadatos estructurados y banner sobrio | Joorcs96/diseno-profesional | Revisión independiente |
| Integración de las 5 herramientas y guía técnica | Hecho: `docs/diseno-web.md` documenta Taste Skill, Web Design Guidelines, Awesome Design, Image-to-Code y Playwright CLI | Joorcs96/diseno-profesional | Revisión independiente |
| Validación Playwright y smoke visual | Hecho: 32 checks en verde (390×844 y 1440×1000 en claro/oscuro), 0 errores JS propios, 0 overflow horizontal, capturas guardadas | Joorcs96/diseno-profesional | PR y entrega a coordinador |

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
| Diagnóstico sesión de Jordi 09/10 8-14 h Planetario | Hecho: la física acierta; el modelo se quedó corto (0.31-0.58 m vs boya 0.94 m, x1.6). Web daba Muy malo a las 8-9 h | main | — |
| Corrección con boya (js/nowcast.js) | Publicado: ratio boya/modelo limitado a 0.7-1.6, decae a 0 en 12 h, solo obs <= 3 h y spots <= 60 km. Caso 6: 1 -> 4 | main | Vigilar: el cron de realtime corre cada 4-5 h (retrasos de GitHub), así que la boya a menudo llega vieja y no corrige |
| Integrar webcam en directo de Surfers Castellón | Hecho: identificada fuente IPCamLive (alias 609a27d8a9c83), integrada como iframe en directo en Planetario, Pirámides y Gurugú sin requerir login ni exponer credenciales | main | Verificada en móvil |
| Auditoría y archivo histórico de boyas + Excel | Hecho: recuperadas 814 observaciones reales de Git (486 boyas), histórico JSONL/CSV deduplicado, exportador Excel (6 hojas) y suite de pruebas | Joorcs96/historico-datos | Revisar por coordinador y activar workflow |

---

# Rediseño Surfline · 06/10/2026

| Tarea | Estado | Rama | Siguiente paso |
| --- | --- | --- | --- |
| Completar WIP 8053158 | Hecho; cámara, Rewind, grabación y limpieza al navegar | Joorcs96/rediseno-surfline | Revisión independiente |
| Afinar móvil claro/oscuro | Hecho; controles 44 px, cifras legibles, formulario y barras | Joorcs96/rediseno-surfline | Revisar capturas locales |
| Aceptación del SPEC | 20 + 17 + 15 pruebas, sintaxis, shot, CSP y 65 comprobaciones correctas | Joorcs96/rediseno-surfline | Ver INFORME-REDISENO.md |
| Publicación | Pendiente; sin integración ni push a main | Joorcs96/rediseno-surfline | Coordinar revisión y publicación |

Capturas y logs: `.capturas/rediseno/` (no subir a git). Grabación MP4 real de 20 s y alternativa WebM comprobadas. Se conserva a continuación el historial anterior.

---

# Datos reales · 05/10/2026

| Tarea | Estado | Rama | Siguiente paso |
| --- | --- | --- | --- |
| Revisar captura Portus y workflow | Hecha: TLS acotado, sin secretos, valores/fechas validados y selección de fuente reciente | Joorcs96/ms-realtime-reviewed | Revisar al integrar |
| Mostrar observaciones en ficha y Mis spots | Hecha: edad por sensor, distancias, gris tras 3 h, comparación horaria mar adentro | Joorcs96/ms-realtime-reviewed | Integrar por coordinador |
| Pruebas y capturas móviles | Hechas: script real, 8 pruebas Python, escenarios de navegador, sintaxis JS y claro/oscuro 390×844 | Joorcs96/ms-realtime-reviewed | Capturas e informes locales en `.capturas/` |
| Corrección conservadora de estrellas y calidad | Hecha: techos por altura en rompiente, heurística de rachas y viento de mar, mar de viento corto penalizado, distinción Plato (0) vs Sin datos (null), y coherencia total | Joorcs96/ms-corrige-estrellas | Revisión independiente |
| Auditoría de las estrellas (OpenCode) | Hecha: corregida regresión de `range()` que ocultaba el rango de altura en 3 vistas, nulos que se veían como 0 km/h y NaN, y `0–0 m` falso del asistente; suite propia de 15 pruebas | Joorcs96/ms-corrige-estrellas | PR abierto, sin merge; probar el probador antes de integrar |
| Pruebas y capturas móviles | Hechas: script real, 8 pruebas Python, escenarios de navegador, sintaxis JS y claro/oscuro 390–844 | Joorcs96/ms-realtime-reviewed | Capturas e informes locales en `.capturas/` |
| Calibrar la previsión (relevo del worker sin cuota) | Hecha: trenes de oleaje separados, periodo 4–6 s sin penalizar, viento de mar penaliza desde 12 km/h. 44 pruebas en verde | Joorcs96/calibracion-prevision | Decidir DUDAS.md 1 (portar el motor v3 al backend) |
| Rediseño | Hecha: adaptado a main (preservación de datos técnicos) | Joorcs96/redisenar-main | Revisar |

## Calibrar la previsión (05/10/2026)

El worker anterior murió por cuota a medias. Lo que había dejado y cómo quedó:

- **Checkpoint** `59a8e03` guarda su estado tal cual, con 7 de 27 pruebas en
  rojo. No borrar: es el punto de vuelta.
- **`cd0df3d`** — `desglose_oleaje()` separa fondo, fondo 2 y viento antes de
  calcular. Antes solo se pedían dos trenes, así que la altura se quedaba
  entre un 6% y un 18% corta. La API sí publica `secondary_swell_wave_*`.
- `f8671d7` `calcularCalidad()`: el periodo de 4–6 s no penaliza (el
  estado heredado restaba 1 por debajo de 5 s, contra el estudio v3) y el viento
  de mar tiene un único tramo desde 12 km/h (antes se restaba dos veces por
  encima de 20).

Prueba de aceptación: `python -m unittest backend.test_motor_fisica backend.test_actualizar_prevision` → 44 pruebas, OK.

Verificado además contra la API real (`forecast_days=3`, sin tocar
`historico_olas.csv`): alturas en rompiente de 0.01 a 0.48 m y calidad
repartida entre 0 y 4, con el 4/5 entrando solo con terral.

Sin merge a main. `js/` y `historico_olas.csv` intactos.

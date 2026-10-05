# Datos reales · 30/09/2026

| Tarea | Estado | Rama | Siguiente paso |
| --- | --- | --- | --- |
| Revisar captura Portus y workflow | Hecha: TLS acotado, sin secretos, valores/fechas validados y selección de fuente reciente | Joorcs96/ms-realtime-reviewed | Revisar al integrar |
| Mostrar observaciones en ficha y Mis spots | Hecha: edad por sensor, distancias, gris tras 3 h, comparación horaria mar adentro | Joorcs96/ms-realtime-reviewed | Integrar por coordinador |
| Pruebas y capturas móviles | Hechas: script real, 8 pruebas Python, escenarios de navegador, sintaxis JS y claro/oscuro 390×844 | Joorcs96/ms-realtime-reviewed | Capturas e informes locales en `.capturas/` |
| Corrección conservadora de estrellas y calidad | Hecha: techos por altura en rompiente, heurística de rachas y viento de mar, mar de viento corto penalizado, distinción Plato (0) vs Sin datos (null), y coherencia total | Joorcs96/ms-corrige-estrellas | Revisión independiente |
| Auditoría de las estrellas (OpenCode) | Hecha: corregida regresión de `range()` que ocultaba el rango de altura en 3 vistas, nulos que se veían como 0 km/h y NaN, y `0–0 m` falso del asistente; suite propia de 15 pruebas | Joorcs96/ms-corrige-estrellas | PR abierto, sin merge; probar el probador antes de integrar |

Sin merge a main; `js/spots.js` y `js/compass.js` intactos. Pruebas Python reproducibles con `python -m unittest scripts.test_realtime backend.test_motor_fisica scripts.test_rewind` (84 tests OK). Pruebas JS con `node tools/test_rating_conservador.js` (16 tests OK) y `node tools/test_formato_null.js` (15 tests OK).
La excepción TLS mantiene un riesgo de autenticidad en los datos públicos; `REALTIME_CA_BUNDLE` permite exigir verificación. AEMET experimental retirado: las fuentes requeridas funcionan sin secretos.

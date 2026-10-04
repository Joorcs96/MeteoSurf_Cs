# Datos reales 路 30/09/2026

| Tarea | Estado | Rama | Siguiente paso |
| --- | --- | --- | --- |
| Revisar captura Portus y workflow | Hecha: TLS acotado, sin secretos, valores/fechas validados y selecci贸n de fuente reciente | Joorcs96/ms-realtime-reviewed | Revisar al integrar |
| Mostrar observaciones en ficha y Mis spots | Hecha: edad por sensor, distancias, gris tras 3 h, comparaci贸n horaria mar adentro | Joorcs96/ms-realtime-reviewed | Integrar por coordinador |
| Pruebas y capturas m贸viles | Hechas: script real, 8 pruebas Python, escenarios de navegador, sintaxis JS y claro/oscuro 390脳844 | Joorcs96/ms-realtime-reviewed | Capturas e informes locales en `.capturas/` |

Sin merge a main; `js/spots.js` y `js/compass.js` intactos. Pruebas Python reproducibles con `python -m unittest scripts.test_realtime`.
La excepci贸n TLS mantiene un riesgo de autenticidad en los datos p煤blicos; `REALTIME_CA_BUNDLE` permite exigir verificaci贸n. AEMET experimental retirado: las fuentes requeridas funcionan sin secretos.

| Redise駉 | Hecha: adaptado a main (Outfit, motion, data preserved) | Joorcs96/redisenar-main | Revisar |

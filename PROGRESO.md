# Datos reales · 05/10/2026

| Tarea | Estado | Rama | Siguiente paso |
| --- | --- | --- | --- |
| Revisar captura Portus y workflow | Hecha: TLS acotado, sin secretos, valores/fechas validados y selección de fuente reciente | Joorcs96/ms-realtime-reviewed | Revisar al integrar |
| Mostrar observaciones en ficha y Mis spots | Hecha: edad por sensor, distancias, gris tras 3 h, comparación horaria mar adentro | Joorcs96/ms-realtime-reviewed | Integrar por coordinador |
| Pruebas y capturas móviles | Hechas: script real, 8 pruebas Python, escenarios de navegador, sintaxis JS y claro/oscuro 390–844 | Joorcs96/ms-realtime-reviewed | Capturas e informes locales en `.capturas/` |
| Calibrar la previsión (relevo del worker sin cuota) | Hecha: trenes de oleaje separados, periodo 4–6 s sin penalizar, viento de mar penaliza desde 12 km/h. 44 pruebas en verde | Joorcs96/calibracion-prevision | Decidir DUDAS.md 1 (portar el motor v3 al backend) |

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

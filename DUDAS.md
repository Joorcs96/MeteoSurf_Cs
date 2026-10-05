# DUDAS.md

Dudas que no se pueden resolver sin decisión de Jordi. Se aplicó la opción conservadora y se siguió.

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

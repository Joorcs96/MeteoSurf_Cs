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
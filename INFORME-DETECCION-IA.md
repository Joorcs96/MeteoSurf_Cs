# Detección IA de persona y tabla — informe

> Worker: `task_9d2420c5a353` · Fecha: 2026-10-17 · Rama compartida `Joorcs96/reparar-surfers`
> Ficheros añadidos: `js/detector-ia.js`, `tools/test_detector_ia.js`, este informe.
> **No se ha tocado `js/app.js`, `js/cams.js`, ni nada del grabador.**

## Qué aporta y qué NO

La vigía actual (`js/deteccion.js`) decide con heurística de píxeles: manchas
oscuras contra un fondo temporal, cuatro señales geométricas y umbrales altos.
Eso no tiene clases: no sabe qué es un loro y qué es una persona, solo qué forma
tiene cada cosa.

Este módulo añade un modelo **ya entrenado** que sí tiene clases. COCO
[VERIFICADO: `https://github.com/tensorflow/tfjs-models/blob/master/coco-ssd/src/classes.ts`
contiene `person` y `surfboard`] responde a "¿hay alguien?" y "¿hay una tabla?",
que es exactamente el punto flaco de la heurística.

Lo que **no** es:

- **No sustituye a `js/deteccion.js`.** El modelo no sabe si alguien coge ola,
  solo rema o está esperando la serie: eso lo decide el movimiento, el recorrido y
  el contacto. Este módulo es un contrapeso, no un reemplazo.
- **No hay ninguna medida de precisión.** No existe ningún clip del club con un
  surfista confirmado y etiquetado, así que **no se publica ninguna cifra de
  acierto**. Lo único comprobado es que carga, infiere y devuelve cajas con la
  forma correcta. Cualquier número de acierto aquí sería inventado.

## Piezas, versiones y licencias

| Pieza | Versión | Licencia | Origen |
|---|---|---|---|
| TensorFlow.js | `4.22.0` | Apache-2.0 | https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js |
| coco-ssd | `2.2.3` | Apache-2.0 | https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js |
| Pesos SSD Lite MobileNet V2 (COCO) | `ssdlite_mobilenet_v2` | Apache-2.0 | https://storage.googleapis.com/tfjs-models/savedmodel/ssdlite_mobilenet_v2/model.json |

Textos de licencia [VERIFICADO, HTTP 200]:
https://github.com/tensorflow/tfjs/blob/master/LICENSE ·
https://github.com/tensorflow/tfjs-models/blob/master/LICENSE

Versiones y URLs están **fijas**, sin `@latest` ni rangos: se descargan ~19 MB y
hay que saber qué se descarga. Sin cuentas, sin claves, sin servicios de pago, sin
instalaciones globales. La inferencia ocurre **en el navegador**; ninguna imagen
sale del dispositivo.

### Trampa encontrada (y corregida)

`dist/tf.min.js` y `dist/coco-ssd.min.js` son **UMD**, no ESM
[VERIFICADO: el primero acaba en `}))` sin `export`; el segundo es
`!function(e,a){...}(this,...)` y publica `globalThis.cocoSsd`]. El build "ESM"
de coco-ssd (`coco-ssd.es2017.esm.min.js`) sí exporta, pero `dist/index.js` de
estos paquetes usa especificadores desnudos (`@tensorflow/tfjs-core`) que un
navegador sin empaquetador no resuelve. Por eso la carga es **inyección de
`<script async>`**, no `import()` dinámico. Está escrito en el código y hay una
prueba que lo fija, para que nadie lo cambie por costumbre.

## Decisiones que importan

- **Carga bajo demanda.** Cero red hasta que se llama a `cargar()` o al primer
  `detectar()`. Los `<script>` son `async` y el módulo cede el hilo antes de
  inferir: la interfaz no se congela.
- **Cerrojo, no cola.** Nunca hay dos inferencias a la vez. La llamada que llega
  con otra en vuelo devuelve `estado:'omitido'` al instante; no se encola, porque
  encolar acumularía fotogramas viejos. **Consecuencia práctica:** la inferencia
  real tarda ~1,3 s, así que el autor debe llamar a ~1 Hz, no a los 10 fps de la
  vigía.
- **Nada de fotogramas viejos.** Cada resultado lleva `marcoId`, `tMs` (el del
  fotograma, no el de la respuesta), `fuente` y `roi`. Si al terminar ya se ha
  pedido otro fotograma, el resultado se marca `obsoleto` y **se le vacían las
  detecciones**. Además existe `esFresco()`.
- **Sin plazo de caducidad por defecto.** Una inferencia real tarda ~1,3 s; un
  plazo más corto tiraría *todos* los resultados. El descarte que se aplica
  siempre es el de `marcoId`, no el del reloj. `caducidadMs` sigue existiendo por
  si el autor lo quiere activar.
- **Errores explícitos.** `detectar()` **siempre resuelve** y nunca lanza. Los
  códigos son cerrados (`CODIGO`), no texto libre. Tras un fallo de carga se puede
  reintentar: la promesa no queda envenenada.
- **Libre de tensores.** `liberar()` suelta el modelo y la memoria de GPU; no
  vuelve a descargar 18 MB. Después da `liberado`.

## Contrato (resumen; el completo se envió al autor por `orchestration send`)

```js
const ia = crearDetectorIA();          // { ajustes, cargar, detectar, liberar, estado, ultimoMarcoId, esFresco }
await ia.cargar();                     // { ok, meta } | { ok:false, error:{codigo,mensaje} }
const r = await ia.detectar({ video, banda: [y0, y1] });   // siempre resuelve
// r.estado: 'listo' | 'sin_deteccion' | 'omitido' | 'obsoleto' | 'error'
// r.detecciones[i]: { clase:'person'|'surfboard', confianza, bbox:{x,y,ancho,alto} en 0..1, centro, area }
```

Ojo con el `bbox`: es **relativo al ROI** (la banda recortada), no al fotograma
completo. `r.roi` dice cuál es. El módulo dibuja en su propio lienzo de 320×180 y
no toca el del autor.

## Pruebas ejecutadas

```
node tools/test_detector_ia.js              -> 92/92   [VERIFICADO]
node tools/test_detector_ia.js --navegador  -> 92/92   [VERIFICADO]
```

Sin red ni navegador, con un adaptador inyectado: normalización y recorte de
cajas, filtro de clases y confianza, emparejado persona/tabla, carga correcta,
carga rota con reintento, `autoCargar:false`, cerrojo (conCURRENTE, con fallo y con
timeout), forma del resultado, frescura y descarte de obsoletos, `liberar()`, y
plazos de carga e inferencia.

En Chromium real, dentro de la misma prueba: carga desde CDN y **una inferencia
real** sobre un fotograma dibujado a mano.

```
carga 12,6 s · inferencia 1,29 s · backend webgl · tf 4.22.0 · coco-ssd 2.2.3 · tensores vivos 262
```

Playwright se usa desde la instalación global del equipo (no se instala nada), y
la prueba levanta un servidor HTTP efímero en el puerto 8099 que cierra al
terminar; no crea ficheros nuevos en el repositorio.

Regresión de lo existente, [VERIFICADO]:
`test_deteccion_ola` 52/52 · `test_rewind_flujo` 114/114 · `test_rating_conservador` 17/17.

## Lo que falta (pendiente, y no depende de este módulo)

1. **Clips etiquetados del club.** Sin ellos no hay forma honesta de saber si
   coco-ssd ve a un surfista a 150 m con la cámara del pico. Es el requisito para
   que este módulo valga algo: grabador + etiquetado manual + medir.
2. **El enganche en `js/cams.js`** es del autor principal (autoridad sobre
   `cams.js`, `app.js` y el grabador). Aquí no se ha tocado nada.
3. **Posible CSP o sin red:** la carga puede fallar con `import_fallido`. Está
   contemplado y se puede enseñar en la interfaz; no se ha medido en el hosting
   real, solo en local.

# Evidencia E2E de la vigía de ola · 17/10/2026

Todo lo de aquí sale de ejecutar el código de la web, no de describirlo.
Reproducible con:

```
python scripts/probar_vigia_e2e.py                 # las dos pruebas
python scripts/probar_vigia_e2e.py --solo deteccion
python scripts/probar_vigia_e2e.py --solo club
```

Necesita Playwright ya instalado (lo busca en el perfil de usuario, no instala
nada) y el Chromium con ventana. **No debe correr en CI**: sin ventana,
`MediaRecorder` no codifica nada y la comprobación de grabación no sería real.

## Prueba 1 · Del detector al clip (escena sintética)

`tools/vigia_e2e.html` monta una escena en un canvas —agua con degradado, espuma
clara que cruza, una boya que oscila y surfistas oscuros que atraviesan la
rompiente—, la convierte en vídeo con `captureStream` y se la pasa a
`iniciarVigiaOla` por el mismo camino que la web. El detector ve surfistas de
verdad y dispara solo.

Medido sobre el último clip entregado:

| Medida | Valor | Qué significa |
| --- | --- | --- |
| Eventos del detector | 6 | El detector dispara en directo y se repite |
| Tipo de detección | `coge_ola` | Persona + tabla + movimiento sostenido + recorrido |
| Confianza | 0,72 | Estimación, nunca 1 |
| Modo de grabación | `codificado` | WebCodecs, un solo contenedor |
| Códec | `vp8` | El primero que declara soporte |
| Búfer previo en el clip | 7–8 s | Los segundos anteriores a la detección |
| **Duración real del clip** | **11,5 s** |(prebuffer 8 + post 4) |
| Tamaño | 117 868 B | Archivo de un solo WebM |
| Resolución | 640x360 | La del clip, no la de la cámara |
| Gris medio / rango | 171 / 7-255 | Reproduce imagen real, no está negro |

Serie de clips de la misma sesión: `5,2 s` el primero (el búfer aún se llenaba) y
`11,2-12,1 s` los siguientes, que es `prebufferS + postS`. Coherente y sin recortes.

### Por qué esto no estaba antes

La versión anterior concatenaba grabaciones independientes con `new Blob([...])`.
Medido en navegador con ventana: el archivo pesaba 1 402 305 B pero **solo duraba 3,0 s** cuando se habían grabado casi 5 s. Dos contenedores WebM (o dos fragmentos MP4) pegados no forman un clip válido: el principio se pierde. Ahora no se pega nada: los trozos se vuelven a escribir en un muxador nuevo desde una marca de inicio, y sale una cabecera sola.

## Prueba 2 · La cámara real del club

Misma grabadora sobre la emisión real del Club Surfers Castellón (IPCamLive,
alias público `609a27d8a9c83`). **El disparo es manual y la prueba lo dice**: no hay
ningún clip del club con un surfista confirmado y etiquetado, así que aquí no se
demuestra que el detector acierte, sino que la grabación de la cámara de verdad
entrega un archivo entero.

| Medida | Valor |
| --- | --- |
| Emisión resuelta / playlist | `ok` / `ok` |
| Vídeo | `readyState 4`, 1280x720 |
| Modo / códec | `codificado` / `vp8` |
| Trozos en búfer | 144 |
| Histórico en búfer | 6 s |
| Clip | 3 715 862 B, un solo contenedor |
| Búfer previo en el clip | 5 s |
| **Duración real** | **9,44 s** |
| Gris medio / rango | 103 / 0-255 |

## Lo que NO está demostrado

- **Que el detector acierte con un surfista real.** `js/deteccion.js` es una
  heurística sobre píxeles: modelo de fondo temporal, polaridad (la espuma es más
  clara, el surfista más oscuro), componentes conexas, forma vertical para la
  persona y forma tendida para la tabla, y movimiento en el tiempo. **No es un
  modelo entrenado**, no hay pesos ni red neuronal, y no se ha medido su precisión
  contra ningún surfista etiquetado. Solo se ha probado con positivos y negativos
  sintéticos (52 pruebas) y con la escena sintética de arriba.
- **Safari de iOS.** El grabador `codificado` no usa `captureStream`, así que en
  principio funciona en iOS 16.4 o superior; **no está probado en un iPhone real**.
  Cuando el navegador no tiene WebCodecs ni `captureStream`, `elegirGrabador()`
  devuelve `modo: 'ninguno'` con un motivo explícito y la interfaz lo enseña, en vez
  de mostrar un botón que no va a funcionar.
- **Que la escena real tenga surfistas legibles.** La cámara del club abarca toda
  Playa del Pinar y el surfista sale muy pequeño en la rejilla de análisis. Por eso
  el recorte a la banda de agua (`bandaImagen`) es lo que decide si esto sirve, y es
  justo el ajuste que no se ha calibrado con imágenes reales.
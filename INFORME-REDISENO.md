# Aceptación del rediseño MeteoSurf · 06/10/2026

[VERIFICADO] Continuación de `8053158` sin reset en `Joorcs96/rediseno-surfline`. Cambios de código terminados en `4357e3f`; checkpoints anteriores `a80406f` y `e548c72`.

[VERIFICADO] Revisados el SPEC y las ocho referencias p0–p7. Sistema de diseño en DISENO.md (46 líneas). Cabecera tipográfica, calidad sin estrellas, condiciones en rejilla, previsión con gráficos, cercanos, cámaras, mapa, asistente, favoritos y formulario con temas claro/oscuro. Evidencia: archivos y capturas indicados abajo.

[VERIFICADO] Rewind filtra por cámaras del spot, elimina duplicados por URL y agrupa por día/hora de Madrid. Planetario muestra 17 clips únicos; reproducción real del archivo 854 × 480, 20 s; rótulo, previsión archivada, descarga y vuelta al directo comprobados. Evidencia: verificar.log, detalles.txt y capturas rewind.

[VERIFICADO] Grabación HLS real de 20 s: MP4 reproducible de 19,95 s, 2560 × 1440, 4.770.879 bytes; cuenta atrás y enlace Guardar clip. Alternativa WebM comprobada con un clip real de 2 s, 259.518 bytes. Se cancela al cambiar de cámara y se oculta sin captureStream. Los errores tardíos del reproductor anterior ya no sustituyen la cámara nueva. Evidencia: resultado.json, detalles.txt y MP4 local.

[VERIFICADO] Sin dependencias ni hosts nuevos; sin modificaciones a forecast/physics/spots/assistant, scripts, backend, data, webcams.json ni .github respecto al inicio del rediseño (`git diff 477b5ec --name-only`). Sólo presentación, cámaras, caché, prueba de dibujo y documentación; borrada la vista previa rediseno/.

## Pruebas exigidas y salida

[VERIFICADO] `node scripts/test_calibracion.mjs` — salida 0:

```text
--- Caso 1: observacion real, Planetario 30/09 18:00 ---
    mar de fondo 0.34 m / 4.85 s del 105
    total 0.37 m / 5.6 s
    viento 7 km/h del 95, rachas 18
    viento efectivo 10.8 km/h (De mar)
    rompiente ANTES (Komar x exposure) 0.49 m -> AHORA 0.34 m
    nota 1 (Muy malo)
OK   usa el factor del estudio v3
OK   altura en rompiente <= 0.35 m  (0.337 m)
OK   nota <= 2 (Malo)  (1 = Muy malo)
OK   el viento de mar se reconoce  (onshore)
OK   las rachas cuentan (efectivo = max(media, 0.6 x racha))  (10.8 km/h)
OK   la nueva altura es menor que la de Komar  (0.49 -> 0.34 m)
OK   tambien a las 19:00 <= 0.35 m y nota <= 2  (0.34 m, Muy malo)
--- Caso 2 (control): 0.8 m / 7 s del E con terral de 8 km/h ---
    rompiente 0.90 m, viento Terral, nota 5 (Regular-Bueno)
OK   el terral se reconoce  (offshore)
OK   nota >= 5 (Regular-Bueno o mejor)  (5 = Regular-Bueno)
--- Caso 3 (control): 0.5 m / 5 s del E con calma ---
    rompiente 0.49 m, viento Calma, nota 4 (Regular)
OK   con 3 km/h y rachas de 5 sigue siendo Calma  (glassy)
OK   nota >= 3 (se puede surfear)  (4 = Regular)
--- Caso 4: observacion real, Planetario 05/10 ---
    07 h: 0.45 m, Terral cruzado, Malo-Regular
    15 h: 0.36 m, De mar, Muy malo
OK   a las 15 h casi plano: <= 0.40 m  (0.36 m)
OK   a las 15 h nota <= 1 (Muy malo)  (Muy malo)
OK   la brisa de la tarde es viento de mar  (onshore)
OK   la manana sale mejor que la tarde  (3 > 1)
OK   a las 7-9 h se puede surfear: nota >= 3  (Malo-Regular)
--- Resto ---
OK   los spots sin estudio siguen usando Komar  (Nules: 1.12 m, Regular-Bueno)
OK   sin viento no hay estado
OK   "Calma" solo por debajo de 6 km/h efectivos  (media 5 con rachas 11 -> onshore)
OK   los 8 spots con tabla (Pirámides usa la del Gurugú)  (MorroGos, Renega, Voramar, Heliopolis, Gurugu, Piramides, Planetario, Palaciet)
------------------------------------------------------------
RESULTADO: OK (20 comprobaciones)
```

[VERIFICADO] `node tools/test_rating_conservador.js` — salida 0; log largo abreviado según las normas del host:

```text
======================================================================
PRUEBAS UNITARIAS: RATING CONSERVADOR, RACHAS Y DATOS NULOS
======================================================================

1. Verificación: Mar pequeño no alto (evitar inflar con periodo/terral)
  [OK] Hs 0.20m en rompiente no supera 1 estrella y r=0 para plato
  [OK] Hs 0.46m con terral flojo es Regular: se surfea (Planetario 05/10 a las 9 h)
  [OK] Hs 0.46m con viento de mar sigue siendo malo
  [OK] Hs 0.64m con terral flojo da máximo Regular-Bueno (4 estrellas)

2. Verificación: Periodo corto y rachas onshore no buenos
  [OK] Rachas de 30 km/h penalizan respecto a rachas de 10 km/h con terral
  [OK] Viento onshore 6 km/h con rachas de 30 km/h da veredicto bajo (<= 2★, no 3★)
  [OK] Periodo corto (3.5s) y mar de viento desordenado es fuertemente penalizado

3. Verificación: Swell limpio aprovechable sigue puntuando alto
  [OK] Swell de 0.9m / 8s con terral limpio sigue alcanzando Bueno (5 estrellas)
  [OK] Swell épico de 1.6m / 9s con terral flojo alcanza 7 (Épico, 5 estrellas)

4. Verificación: Fronteras de categorías y monotonía sensata
[Salida abreviada: registro completo en .capturas/rediseno/rating.txt]
            Ventanas >=3: ninguna
  OBJETIVO: 1 o 2 (0★ o 1★, estropeado por viento)

--- L · Planetario (sólo mar de viento 0.8m / 3.5s rachas 28) ---
  ANTES:    0.79m · 1 "Muy malo" 0★
  AHORA:    0.50m · 1 "Muy malo" (0★)
            Día: 1 "Muy malo" (0★)
            Ventanas >=3: ninguna
  OBJETIVO: 1 "Muy malo" 0★

--- N · Planetario día partido (terral hasta 13h, onshore 20 rachas 30 desde 14h) ---
  ANTES:    Día calificado con la mejor hora: 5 "Regular-Bueno" 4★ Día bueno
  AHORA:    0.63m · 4 "Regular" (3★)
            Día: 4 "Regular" (3★)
            Ventanas >=3: 7–14h r4
  OBJETIVO: Día sin Día bueno si la tarde está destrozada

======================================================================
TODAS LAS PRUEBAS SUPERADAS: 17/17 pruebas unitarias y comparativas correctas.
======================================================================
```

[VERIFICADO] `node tools/test_formato_null.js` — salida 0:

```text
======================================================================
PRUEBAS DE FORMATO: NULO vs 0 Y RANGOS DE ALTURA (código real de js/)
======================================================================

1. Regresión: range() con {min,max} sin mid NO puede devolver siempre guion
  [OK] range({min,max}) devuelve el rango, no "–" (regresión de 89c1d42)
  [OK] range() no debe decidir la validez por s.mid
  [OK] range() con mid presente sigue funcionando
  [OK] range() mar plano devuelve 0–0.2
  [OK] range() sin datos o NaN devuelve guion y nunca NaN
  [OK] todos los range({min,max}) de app.js pasan min y max

2. Nulo no puede vestirse de 0 en viento y rachas
  [OK] kmh(null) y rnd(null) muestran guion, no 0
  [OK] kmh(0) sí es 0 km/h: el cero medido es un dato válido
  [OK] el asistente usa el mismo kmh y no Math.round(windSpeed)

3. Rango de altura del asistente: sin datos no puede decir 0–0 m
  [OK] fmtRange distingue sin datos de mar plano
  [OK] Math.min de nulos no llega a formatear alturas

4. La calidad alta tiene que justificar buenas condiciones
  [OK] con menos de 1.05 m en rompiente nunca alcanza calidad buena
  [OK] 1.2 m limpios (7 s y calma) sí alcanzan calidad buena
  [OK] la calidad no baja al subir la altura con viento limpio
  [OK] mar plato es 0 y sin datos es null: nunca se confunden

======================================================================
TODAS LAS PRUEBAS SUPERADAS: 15/15.
======================================================================
```

[VERIFICADO] Sintaxis ejecutada con el comando del SPEC y también por archivo, porque Node sólo analiza el primer archivo del comando conjunto:

```text
node --check js/app.js js/cams.js
node --check js/app.js
node --check js/cams.js
Sin salida; código 0 en los tres comandos.
```

[VERIFICADO] `shot.mjs http://127.0.0.1:8797/ <carpeta absoluta>`: 390 × 844, DPR 2, cinco vistas, sin errores de consola ni avisos CSP. Para oscuro se usó una copia local del script con Emulation.setEmulatedMedia(prefers-color-scheme: dark); el original no se modificó.

Claro — código 0:

```text
--- portada
--- planetario
--- piramides
--- camaras
--- mapa
```

Oscuro — código 0:

```text
--- portada
--- planetario
--- piramides
--- camaras
--- mapa
```

[VERIFICADO] Búsqueda equivalente a grep con rg, sin coincidencias (código 1 de rg = ninguna coincidencia):

```text
rg -nP '[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}\x{2B50}]' index.html votar.html js css
Sin salida.
```

[VERIFICADO] `git diff --check`: sin errores de espacios. Los avisos de normalización LF/CRLF son propios de Git en Windows.

## Navegador y revisión visual

[VERIFICADO] `.capturas/rediseno/verificar.cjs`: 65 comprobaciones correctas, cero errores. Incluye 8 vistas por tema, anchura del documento de 390 px, eventos securitypolicyviolation vacíos, selección de día, Rewind, descarga, grabación y cancelación. Resultado duradero local: resultado.json y verificar.log.

[VERIFICADO] `.capturas/rediseno/detalles.cjs` — salida 0:

```text
OK zoom light: 44x44
OK reproducción Rewind light: {"width":854,"height":480,"duration":20}
OK zoom dark: 44x44
OK reproducción Rewind dark: {"width":854,"height":480,"duration":20}
OK alternativa WebM y error tardío: {"extension":"webm","size":259518,"width":2560,"lateErrorIgnored":true}
OK errores JavaScript: 0
```

[VERIFICADO] Revisadas una a una las cinco capturas finales en `claro/` y `oscuro/`: portada, planetario, piramides, camaras y mapa. Revisadas además las capturas light-/dark- de condiciones, previsión, gráficos, cercanos, Rewind, asistente, favoritos y votar. Cifras sin partir, texto legible en oscuro y sin desbordamiento de página. Los selectores horizontales se desplazan intencionadamente; las barras inferiores permanecen fijas. El mapa conserva sus teselas originales; sus controles sí respetan 44 × 44 px.

[VERIFICADO] Capturas y scripts de comprobación conservados en `.capturas/rediseno/`, excluidos del commit mediante selección explícita de archivos. Los vídeos son de la cámara pública real del Grao. Ningún informe de sesión se ha enviado al registro público.

## Límites y entrega

[NO VERIFICADO] Safari/iPhone físico: se comprobó en Chrome la ocultación al retirar captureStream, no en un teléfono real. La carga de cámaras y teselas depende de sus proveedores; una captura de shot puede mostrar el primer fotograma aún cargando (Pirámides oscuro), mientras las pruebas de reproducción real y las otras capturas confirman vídeo.

[VERIFICADO] El primer lanzamiento final de shot con carpeta relativa no pudo conectar con Chrome; al usar la ruta absoluta recomendada, claro y oscuro terminaron correctamente. No fue un error de la aplicación.

[VERIFICADO] No se ha integrado ni publicado en main. Pendiente: revisión independiente e integración/publicación por el coordinador. No se requiere implementar nada más del SPEC.

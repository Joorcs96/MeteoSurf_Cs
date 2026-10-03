# 01 · Auditoría de estrellas y optimismo general

**Alcance:** sólo lectura de código + un banco de pruebas que ejecuta el código real. **No se ha tocado producción**
(`js/*.js`, `css/app.css`, `index.html`, `backend/*`, `scripts/*` están intactos; `git diff --stat` lo confirma al final).
Todo lo de este informe es **reproducible** con los comandos del apartado 2.

Rama: `Joorcs96/ms-audita-estrellas`. Worker: `ms-audita-estrellas`.

---

## 1. Resumen ejecutivo

El optimismo no viene de un solo sitio: son **cinco mecanismos acumulativos**, todos medibles con el código tal cual está.

1. **La escala de estrellas está mal repartida y se satura por arriba.** Hay 8 niveles de calidad pero sólo 6 valores de
   estrellas (`js/app.js:50`): *Bueno* (6) y *Épico* (7) son **las mismas 5 estrellas**, y **5★ ya se alcanzan con 0,95 m
   en rompiente** — y también con 2,6 m. En la práctica, "5 estrellas" significa desde muslo hasta por encima de la cabeza.
2. **La altura está inflada de forma sistemática.** El factor de rotura de Komar multiplica la altura mar adentro por
   **1,10×–1,85×** respecto al factor que sale de trazar rayos sobre batimetría real (estudio v3). Con mar pequeño y corto
   la app dice 0,46 m donde el estudio entrega 0,28 m.
3. **Hay un bonus por "calma" que también se aplica con viento de mar.** 4 km/h de mar (de 130°, del mar) puntúa
   **4 estrellas "Regular-Bueno"**, exactamente igual que 20 km/h de terral.
4. **Las rachas no influyen.** Con el mismo mar y el mismo viento medio, rachas de 10 o de 30 km/h dan **el mismo
   veredicto**. En `NOTAS-IA.md` está escrito que "las rachas cuentan", y es la observación real de Jordi: no está
   implementado en ninguna parte de la puntuación.
5. **La nota del día y las ventanas recomendadas se puntúan con la mejor hora, no con el día.** Un día con 8 horas de
   1★ y 8 horas de 4★ se etiqueta **"Día bueno" (4 estrellas)**. Y el asistente considera "ventana clara" cualquier hora
   ≥ 3 (= 2 estrellas).

Además hay un **salto de 3 estrellas con 5° de cambio de dirección** en el borde de la ventana de exposición, y el
backend lleva un **tercer algoritmo** (y una escala 0–5 distinta) que nadie ve en la web pero sí acaba en
`historico_olas.csv`.

---

## 2. Qué se ha ejecutado (comandos exactos y resultados)

### 2.1 Pruebas que ya existían (ninguna instalada, nada nuevo)

```
$ python -m unittest scripts.test_realtime
Ran 8 tests in 0.044s
OK

$ python -m unittest backend.test_motor_fisica
Ran 27 tests in 0.004s
OK

$ python -m unittest scripts.test_rewind
Ran 49 tests in 0.988s
OK
```

Python: `C:\Users\Jordi\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe` (el del `PATH` da
3.12.14 también). **No hay ninguna prueba de JavaScript en el repo**: `js/` no tiene test ni runner, así que el rating y
las estrellas no están cubiertos por nada. Eso es en sí un hallazgo (§5, R4).

### 2.2 Banco de pruebas nuevo (sólo lectura de producción)

```
$ node docs/investigacion/harness-escenarios.mjs docs/investigacion/salida-harness.txt
```

`docs/investigacion/harness-escenarios.mjs` sustituye `globalThis.fetch` por un generador de respuestas de Open-Meteo y
llama a `loadForecast({ force: true })`, o sea **la misma ruta de código que la web** (`js/forecast.js` entero, incluido
`processSpot`, `surfFromTrains`, `exposure`, `rate`) y las funciones reales de `js/assistant.js` (`bestWindows`). Replica en
4 líneas `starRating`, `range`, `goodDay`, `goodLabel` y `bestWindowToday` de `js/app.js` (queda apuntado el número de
línea de cada una). No modifica ningún fichero del repo y no toca red.

Salida completa guardada en `docs/investigacion/salida-harness.txt` (253 líneas). **Las entradas de los escenarios son
sintéticas**: inventadas a propósito para forzar un caso, no son medidas ni previsiones. Lo único que sí es real son los
factores de la columna "v3", que salen de `meteosurf_research/calculos_v3/datos/factor_oleaje.json` (trazado de rayos
sobre batimetría EMODnet, ya verificado en el repo de investigación) y se leen con el mismo `factor_at()` que usa
`calculos_v3/scripts/05_calibration.py`.

### 2.3 Estado del otro worker (`ms-calibra`)

```
$ git -C .../ms-calibra log --oneline -1
6f7e9ce Notas: rama por defecto main, punto exacto de Planetario y calibración real
$ git diff HEAD...Joorcs96/ms-calibra --stat
(vacío)
```

**No hay diff que contrastar todavía**: `ms-calibra` está en el mismo contenido que `main` y sin commits nuevos. Este
informe no depende de él, pero los tres paquetes de §5 tocan `js/forecast.js` y `js/spots.js`, que es justo lo que
tocará la calibración: hay que serializar antes de integrar.

---

## 3. El recorrido real del dato (para no auditar el sitio equivocado)

```
Open-Meteo marine  ─┬─ wave_height/period/direction          (total)
(open-meteo)        ├─ swell/secondary_swell/wind_wave       (trenes)
                    └─ sea_level_height_msl, sst
Open-Meteo weather ─── wind_speed_10m, wind_gusts_10m, wind_direction_10m
        │
        ▼  js/forecast.js:272 processSpot
   Trenes → breakingHeight() (Komar, :182) × exposure() (:189) × exposureFactor  →  sqrt(Σ hb²)  (:196)
        │   y surf = { min: 0,75·hb · mid: hb · max: 1,15·hb }  (:204)
        ▼  js/forecast.js:235 rate()
   s = f(surf.mid) + f(periodo) + f(estado de viento) → Math.round → clamp 1..7   (0 si h < 0,22)
        ▼
   hour.rating  ──►  día.days[].rating = MEJOR hora de 7–20 h  (:306-318)
        │
        ├─► js/app.js:50  starRating()  → 0,0,1,2,3,4,5,5 estrellas   (todas las estrellas de la app)
        ├─► js/app.js:56  goodDay() / goodLabel() → "Día bueno" / "Día muy bueno"
        ├─► css/app.css:35-43 + 157-158 → color por nivel (RATINGS[0..7])
        ├─► js/app.js:697 kjCls / :58 hClass → escalas de color paralelas
        └─► js/assistant.js:174 bestWindows(minRating 3) → "Mejor ventana", partes y chat
```

Lo que **no** participa en la puntuación: `wind_gusts_10m` (se descarga, se pinta, no puntúa), el nivel del mar, la
temperatura, la hora, y el dato real de `data/realtime.json` (se muestra aparte en la ficha, nunca se mezcla con el
rating).

---

## 4. Hallazgos, con número reproducido

### H1 · La escala de estrellas: 8 niveles, 6 valores y techo saturado

`js/app.js:50`
```js
const starRating = (r) => r <= 1 ? 0 : r === 2 ? 1 : r === 3 ? 2 : r === 4 ? 3 : r === 5 ? 4 : 5;
```
Salida del banco (§7 del `salida-harness.txt`):

```
rating  etiqueta        estrellas
0       Plato           0★
1       Muy malo        0★
2       Malo            1★
3       Malo-Regular    2★
4       Regular         3★
5       Regular-Bueno   4★
6       Bueno           5★
7       Épico           5★      ← indistinguible de 6
```

Y con el barrido de altura (Planetario, T 6 s, dir 100°, calma) — `salida-harness.txt` §3:

```
Hs    surf.mid   estrellas  calidad
0.20  0.35       2★         3 Malo-Regular
0.30  0.48       3★         4 Regular
0.40  0.61       4★         5 Regular-Bueno
0.60  0.84       4★         5 Regular-Bueno
0.70  0.95       5★         6 Bueno      ← 5★ ya con 0,95 m
0.90  1.16       5★         6 Bueno
1.60  1.84       5★         6 Bueno
2.50  2.62       5★         6 Bueno
```

Con las palabras que usa la propia app para el tamaño (`js/app.js:571 surfWords`): 0,95 m es "muslo a cintura" y 2,62 m es
"doble altura de cabeza". **Las mismas 5 estrellas para las dos cosas**, y entre 0,95 m y 2,62 m no cambia ni la estrella
ni el color. El rating 7 sale sólo con T ≥ 9 s y mar grande (h ≥ 1,8 m) —en el barrido de periodo, sólo con T ≥ 10 s— y
es indistinguible del 6, así que en la práctica **la app nunca muestra una calidad que no sea "Bueno" por arriba**: el
techo es 5★ desde 0,95 m.

Consecuencia directa: "prioridad estrellas" se cumple en la letra (nunca 5★ sin motivo) pero la escala no **ordena** bien
el rango alto, que es justo donde el usuario decide si sale a surfear.

### H2 · "Calma" da bonificación también con viento de mar

`js/forecast.js:211` clasifica `speed < 6` como `glassy` **sin mirar la dirección**, y `js/forecast.js:243` da `+0.6`
a `glassy` siempre.

`salida-harness.txt` §6 (mismo mar 0,6 m / 6 s / 100°, sólo cambia el viento):
```
4 km/h de 130° (rachas 8)   → 5 "Regular-Bueno" 4★ [glassy]   ← viento DE MAR
8 km/h de 130° (rachas 14)  → 4 "Regular" 3★ [onshore]
20 km/h de 300° (rachas 30) → 5 "Regular-Bueno" 4★ [offshore] ← terral fuerte
```
**4 km/h de mar = 20 km/h de terral.** Y como `windState` devuelve `glassy` antes de mirar la dirección, un jerk de brisa
de tierra de 3 km/h y una brisa de mar de 5 km/h son exactamente lo mismo para la calidad. El caso de H2 explica
directamente el caso "Palaciet surfeable pero la app mucho mejor": si el día era de brisa de mar floja, la app no lo
penaliza.

### H3 · Las rachas no influyen (ni se descargan para nada)

`wind_gusts_10m` se pide en la API (`js/forecast.js:18`), se guarda (`js/forecast.js:296`) y se pinta
(`js/app.js:561`, `:708`), pero **`rate()` sólo recibe `windSpeed`** (`js/forecast.js:292`). Demostrado:

```
6 km/h de 300° (rachas 10)  → 5 "Regular-Bueno" 4★
6 km/h de 300° (rachas 30)  → 5 "Regular-Bueno" 4★     ← idéntico
```
y en §1, escenarios C y D (0,9 m / 8 s / terral): rachas 16 y rachas 32 → **los dos 7 "Épico", 5 estrellas**.

`NOTAS-IA.md:74` dice, de la sesión real del 30/09: *"un viento de 6-8 km/h del ESE con rachas de 18. Las rachas
cuentan"*. La app da exactamente el mismo veredicto con rachas de 18 que con rachas de 6.

### H4 · La altura está inflada: 1,10×–1,85× sobre el estudio de rayos

La altura en rompiente se calcula con Komar (`js/forecast.js:182`) y después se multiplica por `exposure()`
(`:189`), que es una ventana dura: fuera de `swellWindow` → `0.08`; dentro → `cos^0.6` con suelo `0.15`.

Comparado con el factor real de `calculos_v3` (`H_rompiente / H_offshore`, rayos sobre batimetría) — `salida-harness.txt` §1:

```
escenario                                    app     v3     app/v3
A Planetario 0,35 m / 4 s / 115° de mar      0.46   0.28    1.60×
B Planetario 0,45 m / 6 s /  80° terral      0.64   0.49    1.30×
C Planetario 0,90 m / 8 s / 100° terral      1.30   1.06    1.23×
F Voramar    0,50 m / 5 s /  92° terral      0.44   0.27    1.62×
G Voramar    1,00 m / 9 s / 150° terral      1.25   1.11    1.13×
H Palaciet   0,50 m / 5 s / 130° terral      0.66   0.52    1.26×
K Planetario 2,40 m / 10 s/ 100° terral      3.11   2.83    1.10×
M Planetario 0,45+0,50 m (fondo + viento)    0.82   0.45    1.85×
```

Coincide con `NOTAS-IA.md:74` ("el factor de Komar multiplica ×1,44 y el estudio v3 da ×0,85 a 5 s"), medido en
el caso real de Planetario. Los factores exactos que produce el código hoy, con la mar en el `facing` (102°) —
`salida-harness.txt` §8, `app = surf.mid / Hs`:

```
Hs    T     app mid   app      v3       app/v3
0.35  4     0.46      1.32     0.84     1.57×
0.50  5     0.67      1.35     0.85     1.59×
0.45  6     0.67      1.48     1.16     1.28×
0.60  6     0.84      1.40     1.16     1.20×
0.90  8     1.30      1.44     1.17     1.24×
1.60  9     2.16      1.35     1.17     1.15×
2.40  10    3.12      1.30     1.22     1.07×
```

Lo importante no es sólo la magnitud sino **la forma**: v3 da ×0,84 a 4–5 s y ×1,16 a 6–8 s (en el Mediterráneo corto
el oleaje no crece hacia la playa, se rompe antes), mientras que Komar **siempre** crece con la altura y el periodo. Por
eso **el error es peor cuanto más pequeño y más corto es el mar** (×1,57 a 1,59 con 0,35–0,5 m y 4–5 s), que es
justamente el caso habitual en la costa de Castellón en otoño. Con mar grande la app se acerca a v3 (×1,07) y el
problema se diluye.

### H5 · Salto de 3 estrellas con 5° de dirección (y borde de ventana que no debería entrar)

`js/forecast.js:189-194`: dentro de la ventana el factor es `cos^0.6` (mínimo 0,15), fuera es 0,08 fijo. En el borde
justo de la ventana el factor vale ~0,53 y un grado después 0,08: un factor **6,6×** de golpe.

`salida-harness.txt` §2 (Planetario, 0,6 m / 6 s):
```
dir  v3 factor   surf.mid   estrellas  calidad
160  0.669       0.57       3★         4 Regular
165  0.465       0.52       3★         4 Regular
170  0.260       0.46       3★         4 Regular      ← último dentro de [40,170]
175  0.130       0.07       0★         0 Plato        ← 5° después
180  0.000       0.07       0★         0 Plato
```
5 grados → de 3 estrellas a 0. Y en el otro borde:
```
40   0.000       0.53       3★         4 Regular      ← el estudio dice que NO llega nada
45   0.192       0.58       3★         4 Regular
```
`inWindow()` es **inclusivo en los dos extremos**, así que justo en el borde (donde la v3 da factor 0,00 por sombra de
cabo/dique) la app entrega 0,53 m y 3 estrellas.

### H6 · El mar de viento cuenta como mar limpio

`js/forecast.js:274-281` mete los tres trenes (fondo, fondo 2, viento) en la **misma suma en cuadratura**
(`surfFromTrains`, `:196`). Un mar de viento de 0,5 m del SE a 4 s aporta exactamente lo mismo que un mar de fondo de
0,5 m del NE a 7 s a efectos de altura; lo único que lo penaliza es el viento, y ya se vio (H2/H3) que ese castigo es
débil. Escenario M (fondo 0,45 m / 7 s del NE + viento 0,50 m / 4 s del SE, brisa de mar de 16 km/h): la app da
**0,82 m** (1,85× el 0,45 m de v3). Para el usuario "0,8 m" significa "rodilla a muslo" cuando en realidad lo
surfeable son los 0,45 m del fondo limpios y el resto es viento.

### H7 · El día se puntúa con su mejor hora

`js/forecast.js:306-318`: `days[].rating` = máximo de las horas de luz (7–20 h). Escenario N (mismo mar 0,6 m / 6 s todo
el día; terral de 8 km/h hasta las 13 h y de mar de 20 desde las 14 h):

```
hora a hora    6h=5 7h=5 8h=5 9h=5 10h=5 11h=5 12h=5 13h=5 | 14h=2 15h=2 … 21h=2
resumen        7 de 14 horas de luz con calidad ≥5, pero el día se puntúa con la MEJOR
               → 5 "Regular-Bueno" 4★ "Día bueno"
```

Con la misma fuente, `js/app.js:223` (`bestWindowToday`) también toma el máximo, `js/app.js:728` toma
`Math.max(d.rating, mañana, tarde)` y `js/assistant.js:236` (parte regional) compara días por su máximo. **Cuatro sitios
distintos eligen la mejor hora**, así que el optimismo se multiplica al resumir.

### H8 · "Ventana clara" a partir de 2 estrellas

`js/assistant.js:174` usa `minRating = 3` por defecto, y `js/app.js:264` lo llama así en la portada. Rating 3 es
"Malo-Regular" = 2 estrellas. Escenario A (0,35 m / 4 s con viento de mar de 14 km/h):
```
calidad        3 "Malo-Regular"  →  2 estrellas
ventanas ≥3    15–22h r3
mejor franja   07–21h (0.46 m, De mar)
```
La portada puede titular **"Mejor ventana: hoy 15–22 h"** en un día de 0,3–0,5 m con viento de mar, y
`js/assistant.js:272` (`trendParagraph`) llama "repuntes probables" a cualquier día con `surfMax ≥ 0,8` aunque su calidad
sea 4.

### H9 · Lo que se ve: bandas, colores y dos escalas paralelas

- `surfFromTrains` devuelve `{min: 0,75·hb, mid: hb, max: 1,15·hb}` y **`range()` pinta el techo**: con mid 0,72 la
  tarjeta muestra "0,5–0,9 m". El número grande de la pantalla es siempre el límite superior, un 15% por encima del
  valor con el que se calcula la estrella.
- `css/app.css:157-158` mapea rating→color con 8 colores, pero **6 y 7 son los dos morados** (`--r-good: #6851f4` y
  `--r-epic: #5c00d0`), igual que las estrellas: el tope de la escala es visualmente redundante.
- El verde brillante (`--r-fair: #0bd674`) entra ya en **rating 4 = "Regular" = 3 estrellas**, que es la calidad que la
  web trata como "normal". El verde debería empezar en "Bueno". El verde debería ser para "Bueno".
- `js/app.js:58 hClass` es **una segunda escala** (7 cortes en `<0.2 <0.4 <0.6 <0.9 <1.3 <2 < resto`, azul `app.css:53`)
  para la celda "Surf (m)" de la tabla horaria, y `js/app.js:697 kjCls` una tercera para la energía. Tres escalas de
  color para el mismo dato en la misma pantalla.

### H10 · El backend lleva otro algoritmo y otra escala, y nadie lo sabe

`backend/motor_fisica.py` es el algoritmo antiguo de `MASTER_CONTEXT.md` §6: factor sigmoidal de sombra, exponente de
periodo y `calcularCalidad` en **0–5**, con `SPOT_CONFIG` de 10 spots que **no incluye Palaciet, Heliópolis ni Morro de
Gos** (caen en el config por defecto, `motor_fisica.py:31`). `backend/actualizar_prevision.py:193` lo aplica a un **único
punto marino** para todos los spots, y por eso `historico_olas.csv` tiene alturas idénticas en todos ellos:

```
2026-09-25,00:00,Almenara,0.17,4.8,84,4.5,284,0,
2026-09-25,00:00,Burriana,0.17,4.8,84,4.5,284,0,
```

Ese `calidad_0_5` nunca se enseña en la web, pero es lo único que se ha estado midiendo como "calidad" fuera del
navegador, y el CSV es el histórico que algún día alimentará un modelo. Los 27 tests de `backend/test_motor_fisica.py`
conservan ese algoritmo, así que arreglarlo es un cambio aparte (ver §5, R3).

### H11 · Caché y datos nulos: lo que está bien y lo que no se ha podido reproducir

- La caché de previsión (`js/forecast.js:88-118`) guarda el `raw` y **recalcula el rating en cada carga**
  (`processAll(cached.raw)`), así que un cambio de umbrales se ve sin borrar caché. Correcto.
- `stale: true` sólo cuando falla la descarga; la tarjeta lo avisa. Correcto.
- **No reproducido**: si `wind_speed_10m` llega a `null` (posible en los días 11–16, donde el modelo marino ya se rellena
  con GFS-Wave), `rate()` no se rompe (`speed ?? 0`, `wind.key = 'na'`), pero `js/app.js:254` y `:338` hacen
  `Math.round(h.windSpeed)` sin guardia y pintarían "NaN km/h". No lo he visto en producción ni lo he reproducido con
  datos nulos; queda apuntado como riesgo, no como fallo confirmado.

---

## 5. Propuesta (conservadora, **sin** validación empírica)

> Todo lo que sigue es **propuesta**, no resultado. Los umbrales salen de (a) la estructura del código, (b) los cortes que
> ya documenta el estudio v3 (`surfeable 0,30 m`, `bueno 0,50 m`, `muy bueno 0,80 m`, `maxGood 1,5–3,5 m`) y (c) la
> observación real de Jordi del 30/09. **No hay ninguna medición nueva** que valide estos números: la única fuente real
> disponible son las sesiones que Jordi describe y la boya de Valencia a 55 km. La forma de comprobarlo es la de §7, y
> hasta que haya 5–10 sesiones anotadas estos umbrales deben considerarse "a probar en móvil", no "calibrados".

### Paquete A · Escala de estrellas (el más barato y el que más se nota)

| # | Cambio | Dónde | Efecto esperado |
|---|---|---|---|
| A1 | Estrellas con medio: 0, 0.5, 1, 1.5, 2.5, 3.5, 4.5, 5 para los ratings 0–7 (o al menos separar 6 y 7) | `js/app.js:50-55` | *Bueno* y *Épico* dejan de ser la misma estrella; el SVG no cambia, sólo la condición de relleno |
| A2 | 5★ exige además **h ≥ 1,2 m y T ≥ 7 s**; *Épico* (rating 7) exige **h ≥ 1,8 m** | `js/forecast.js:235-254` | 5★ deja de aparecer con 0,95 m y con 2,6 m a la vez |
| A3 | Subir el suelo: 3★ ("Regular") exige **h ≥ 0,50 m** (corte "bueno" de v3) y 4★ **h ≥ 0,70 m** | `js/forecast.js:238` | 0,48 m deja de ser "Regular" |
| A4 | `glassy` sólo con `speed < 4`, y `+0.3` en vez de `+0.6` | `js/forecast.js:211, 243` | 4 km/h de mar dejan de puntuar como 20 km/h de terral |
| A5 | "Día bueno" exige **≥ 3 horas de luz con calidad ≥ 5**, no 1 | `js/forecast.js:306-318`, `js/app.js:56` | un día partido deja de rotularse "Día bueno" |

### Paquete B · Viento y rachas

| # | Cambio | Dónde | Efecto esperado |
|---|---|---|---|
| B1 | Velocidad efectiva = `max(media, 0,65 × racha)` y penalización por rachas: racha ≥ 18 km/h y ≥ 1,8× la media → −1; ≥ 30 km/h → −2 | `js/forecast.js:292` (pasar el viento a `rate()`) | el caso real del 30/09 baja de 4★ a 2–3★ |
| B2 | `glassy` exige `speed < 4` o dirección sin dato | `js/forecast.js:209-219` | desaparece el bonus con brisa de mar |
| B3 | **No** añadir un segundo castigo por viento de mar: el estado (`onshore`/`crosson`) ya penaliza, y duplicar sería el error opuesto | — | — |

### Paquete C · Altura (el cambio de fondo, el que más justifica medir después)

| # | Cambio | Dónde | Comentario |
|---|---|---|---|
| C1 | Sustituir Komar+`exposure()` por `H_rompiente = Hs_total × factor_v3(dirección, periodo)`, con la tabla de `calculos_v3` copiada al repo (`data/factor_oleaje.json`, ~82 KB) y `factor_at()` portado a `js/forecast.js` | `js/forecast.js:182-205` | elimina la doble amplificación (H4) y el salto (H5) de un plumazo; `app/v3` pasa a 1,00 |
| C2 | Si C1 no entra: al menos hacer la ventana continua (interpolar a 0 en los bordes en vez del salto a 0,08) y bajar el suelo de 0,15 a 0,05 | `js/forecast.js:189-194` | quita el cliff de 3 estrellas |
| C3 | **El mar de viento no suma en cuadratura con el mar de fondo**: altura de surf = la que aportan los trenes de mar de fondo; el viento se queda como penalización | `js/forecast.js:274-281` | quita H6 |
| C4 | La tabla v3 sólo cubre 8 spots. Para Vinaròs, Peñíscola Norte, Burriana, Nules y Almenara **no inventar**: usar el factor del spot equivalente más próximo (Grao para Vinaròs/Peñíscola, Almenara para Nules) y decirlo en la ficha, o dejar 1,0 con la ventana actual marcado como "sin calibrar" | `js/spots.js`, `js/forecast.js` | riesgo de que 5 spots queden fuera del estudio |
| C5 | Bandas `min/max` de 0,75/1,15 → 0,85/1,10, y el `mid` como número grande con la banda en texto pequeño | `js/forecast.js:204`, `js/app.js:36-40` | el número que se ve es el que puntúa |

### Paquete D · Coherencia de la escala en toda la app

| # | Cambio | Dónde |
|---|---|---|
| D1 | `minRating` de las ventanas 3 → 4, y exigir además `surf.mid ≥ 0,5 m` | `js/assistant.js:174`, `js/app.js:264` |
| D2 | Quitar el 8º color (o el 7º) y hacer que el color salga de las estrellas; `--r-fair` pasa a "Regular-Bueno" y "Regular" se queda en amarillo | `css/app.css:35-43, 157-158` |
| D3 | Que `hClass` use los mismos cortes que la escala de estrellas, o borrar la clase | `js/app.js:58`, `css/app.css:53` |
| D4 | Un solo sitio que calcule "la mejor hora" y que lo reutilicen `app.js`, `assistant.js` y el parte regional | `js/forecast.js`, `js/app.js:223`, `js/assistant.js:236` |

---

## 6. Lista acotada de archivos a cambiar

| Archivo | Qué | Prioridad |
|---|---|---|
| `js/forecast.js` | `rate()` y `windState()` (182-254), `exposure()`/`surfFromTrains()` (182-205) si entra C1, y pasar rachas a `rate()` | **Alta** |
| `js/app.js` | `starRating()`/`stars()` (50-55), `goodDay`/`goodLabel` (56-57), `bestWindowToday` (218-232), `minRating` (264), `range()` (36-40), `hClass` (58) | **Alta** |
| `js/assistant.js` | `bestWindows` (174), `daySummaryParagraph` (236-245), `trendParagraph` (272), `spotReport` (306) | Media |
| `css/app.css` | `--r-*` (35-43), `.r0..r7` (157-158) | Media |
| `data/factor_oleaje.json` | **nuevo**, copia de `meteosurf_research/calculos_v3/datos/` (sólo si entra C1) | Media |
| `js/spots.js` | sólo si C4 (marcador de spots sin calibrar) — **choca con `ms-calibra`** | Baja |
| `docs/investigacion/` | este informe + el banco de pruebas (ya en la rama) | — |

**No tocar en esta tarea:** `backend/motor_fisica.py` y `backend/actualizar_prevision.py` (algoritmo y escala propios,
con 27 tests que los fijan: cambio aparte y con su propio veredicto sobre el CSV), `scripts/*`, `sw.js`, `index.html`,
`js/compass.js` y `js/cams.js` (verificado: **no usan `rating` en absoluto**).

---

## 7. Escenarios de comprobación (los del banco, con el "antes" medido)

Los "esperado" son la predicción del cambio propuesto, **no** una medición. Se comprueba reejecutando el banco: si un
escenario no se mueve, el cambio no está aplicado.

| Escenario | Hoy (medido con el código actual) | Paquete A+B esperado | Paquete C esperado |
|---|---|---|---|
| A · 0,35 m / 4 s / viento de mar 14 km/h | 0,46 m · 3 "Malo-Regular" **2★** · *ventana 15–22 h* | 2★ y **sin ventana recomendada** | ~0,28 m (v3) |
| B · 0,45 m / 6 s / terral 8 km/h | 0,64 m · 5 **4★** "Día bueno" | 4★ sólo si h ≥ 0,70 | ~0,49 m |
| C · 0,9 m / 8 s / terral 10, rachas 16 | 1,30 m · 7 "Épico" **5★** | **4,5★** (con medio) | ~1,06 m |
| D · igual que C con rachas 32 | 1,30 m · 7 "Épico" **5★** | baja a **3,5–4★** por rachas | ~1,06 m |
| E · Voramar 0,5 m del NE (fuera de ventana) | 0,05 m · 0 "Plato" 0★ | igual | 0,00 m (v3 da 0) |
| F · Voramar 0,5 m en el borde (92°) | 0,44 m · 3 **2★** | igual | ~0,27 m |
| G · Voramar 1,0 m / 9 s del SE | 1,25 m · 7 **5★** | 4,5★, y 5★ sólo con h ≥ 1,2 m | ~1,11 m |
| H · Palaciet 0,5 m / 5 s del ESE con terral 10 | 0,66 m · 5 **4★** | 4★ → 3★ si baja el suelo | ~0,52 m |
| I · el mismo con viento de mar 18 km/h | 0,66 m · 2 **1★** | igual | ~0,52 m (altura no cambia) |
| L · sólo mar de viento 0,8 m / 3,5 s | 0,79 m · 1 **0★** | igual | mar de fondo ≈ 0 |
| M · fondo 0,45 m/7 s + viento 0,5 m | 0,82 m · 2 **1★** | igual | ~0,45 m (sólo el fondo) |
| N · día partido (7 h de 4★ + 7 h de 1★) | día **4★ "Día bueno"** | día **sin** "Día bueno" | — |

Comprobaciones numéricas fijas que hay que mirar en la salida, no sólo "ha cambiado":

- **Hs 0,20 m no puede dar más de 1★** y **Hs 2,5 m no puede dar lo mismo que Hs 0,7 m** (saturación, H1).
- **Rachas 10 y 30 con el mismo viento medio tienen que dar valores distintos** (H3).
- **Ninguna dirección de la ventana puede dar 3★ donde el factor v3 sea 0,00** (H5).
- **El `app/v3` de todos los escenarios debe quedar entre 0,9 y 1,1** si entra C1 (H4).

---

## 8. Comandos de regresión

```bash
# 1) Pruebas que ya existían (deben seguir en verde)
python -m unittest scripts.test_realtime
python -m unittest backend.test_motor_fisica
python -m unittest scripts.test_rewind

# 2) Banco de la auditoría: ejecuta el código real con entradas sintéticas
node docs/investigacion/harness-escenarios.mjs docs/investigacion/salida-harness.txt
# Si se toca js/forecast.js o js/app.js, este banco DEBE cambiar en los números citados en §7.
# Si no cambia, el cambio no está aplicado.

# 3) Comprobar que los ficheros de producción siguen siendo los de main
git diff main --stat -- js css index.html backend scripts sw.js manifest.json   # vacío = intacto

# 4) El banco tiene que seguir arrancando (importa forecast.js y assistant.js de verdad)
node --input-type=module -e "import('./js/forecast.js').then(m=>console.log('forecast ok',Object.keys(m).length))"
node --input-type=module -e "import('./js/assistant.js').then(m=>console.log('assistant ok',Object.keys(m).length))"
```

En móvil, después de integrar (no en esta tarea): `python -m http.server 8765`, abrir `http://127.0.0.1:8765/` y mirar
Planetario, Voramar y Palaciet en la misma hora.

---

## 9. Riesgos y lo que falta

- **R1 · Choque de integración.** `ms-calibra` (y posiblemente `ms-fisica`) van a tocar `js/forecast.js` y
  `js/spots.js`. El paquete C debería ir **después** de la calibración, o en el mismo worker, no en paralelo.
- **R2 · La tabla v3 cubre 8 de 13 spots** y no cubre el mar de viento por trenes. C1 es una simplificación (un solo
  tren, el total): mejora la precisión y pierde la partición. Hay que decidirlo explícitamente.
- **R3 · `backend/` y `historico_olas.csv`.** Mientras el CSV se rellene con el algoritmo antiguo y una calidad 0–5 que
  no aparece en la web, cualquier trabajo futuro de ML o de "histórico" parte de una escala que nadie ve. Decisión del
  coordinador, no de este informe.
- **R4 · Cero cobertura automática de JS.** Todo lo anterior puede romperse sin que ninguna prueba se entere. Lo
  mínimo: convertir el banco en un test con `node --test` y valores esperados fijos.
- **R5 · Sin validación empírica.** No hay ninguna medición nueva aquí. La comprobación honesta es la de §8 más las
  sesiones de Jordi (día, hora, spot, "surfeable sí/no", altura percibida) contra lo que mostraba la app ese mismo día.
  Con 5–10 casos se puede decidir si los umbrales de §5 se quedan, se suben o se bajan.

---

*Generado por el worker `ms-audita-estrellas`. Producción sin tocar: `git diff main --stat -- js css index.html backend
scripts sw.js manifest.json` no devuelve nada.*
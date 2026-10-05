# 05 · Prueba independiente de publicación y candidato de estrellas

**Fecha:** 2026-10-05  
**Worktree auditor/probador:** `C:/Users/Jordi/orca/workspaces/Surfline_CS/ms-audita-estrellas`  
**Rama probador:** `Joorcs96/ms-audita-estrellas`  
**Worktree candidato inspeccionado (sólo lectura):** `C:/Users/Jordi/orca/workspaces/Surfline_CS/ms-corrige-estrellas`  
**Rama candidato:** `Joorcs96/ms-corrige-estrellas`  

---

## 1. Identificación y trazabilidad de SHA del candidato

- **SHA solicitado en el brief:** `89c1d42` (`89c1d42442522c984ddebcd7c2ef005d7692f700`) [VERIFICADO: reflog del repo candidato].
- **SHA inicial al comenzar la auditoría:** `718d959547e8a1114e3a574a5fc87eca8f86c16f` [VERIFICADO: `git -C .../ms-corrige-estrellas rev-parse HEAD` a las 09:14 CEST].
- **Motivo de la diferencia:** El commit `89c1d42` fue rebasado sobre `origin/main` (commit `9d20fb7`), generando `718d959` [VERIFICADO: entrada `HEAD@{0}: rebase (finish)` en `git reflog`].
- **Identidad de código entre 89c1d42 y 718d959:** La diferencia de código en los ficheros de aplicación (`js/`, `sw.js`, `css/`, `tools/`, `NOTAS-IA.md`, `PROGRESO.md`) es exactamente vacía (0 líneas distintas) [VERIFICADO: `git diff 89c1d42 718d959 -- js/ sw.js css/ tools/ NOTAS-IA.md PROGRESO.md` devolvió salida vacía].
- **SHA final al concluir las pruebas:** `718d959547e8a1114e3a574a5fc87eca8f86c16f` [VERIFICADO: `git rev-parse HEAD` repetido tras ejecutar todas las pruebas; árbol limpio sin modificaciones sin commitear].
- **Certificación condicionada:** Se certifica el candidato sobre el commit `718d959` (idéntico en lógica a `89c1d42`). Si el auditor modifica el candidato con un commit posterior, esta certificación queda pendiente de validación sobre el nuevo SHA [VERIFICADO].

---

## 2. Ejecución real de baterías de pruebas (comandos exactos y resultados)

Todas las ejecuciones se realizaron en modo estricto de sólo lectura sobre `ms-corrige-estrellas`, sin modificar ningún archivo ni instalar dependencias [VERIFICADO].

### 2.1 Batería JavaScript de rating conservador

- **Comando:** `node tools/test_rating_conservador.js` (en `ms-corrige-estrellas`).
- **Resultado:** Código de salida 0. 16/16 pruebas unitarias y comparativas superadas [VERIFICADO: salida del runner]:
  1. *Mar pequeño:* `Hs 0.20m` rompiente da `r=0` (Plato, 0★); `0.30m` da `r=1` (0★); `0.45m` terral da `r=3` (2★, antes 4★); `0.64m` terral da `r=4` (3★, antes 4★ "Día bueno") [VERIFICADO].
  2. *Periodo corto y rachas:* Rachas de 30 km/h penalizan respecto a 10 km/h; onshore 6 km/h con rachas 30 km/h da `r<=2` (<=1★); mar de viento desordenado (3.5s) da `r<=1` (0★) [VERIFICADO].
  3. *Swell limpio aprovechable:* Swell 0.9m / 8s con terral limpio mantiene `r=6` ("Bueno", 5★); swell 1.6m / 9s alcanza `r=7` ("Épico", 5★) [VERIFICADO].
  4. *Monotonía:* Comprobada monotonía estricta por altura, por dirección de viento (`terral >= cruzado >= mar`), y por rachas crecientes [VERIFICADO].
  5. *Datos nulos / NaN / Plato:* `surf.mid = NaN` devuelve `null` ("Sin datos", 0★, clase `r-na`); `surf = null` devuelve `null` y rango `"–"`; se distingue claramente Plato real (`r=0`, `"Plato"`, clase `r0`, rango `"0–0.2"`) frente a datos ausentes (`null`, `"Sin datos"`, clase `r-na`) [VERIFICADO].
  6. *Coherencia de etiquetas y estrellas:* Escala 0–7 mapeada uniformemente a Plato (0★), Muy malo (0★), Malo (1★), Malo-Regular (2★), Regular (3★), Regular-Bueno (4★), Bueno (5★), Épico (5★) [VERIFICADO].
  7. *Escenarios A, B, C, D, H, I, L, N:*
     - Escenario A: Ahora `r=1` (0★), sin ventanas recomendadas (antes `r=3` 2★ con ventana recomendada) [VERIFICADO].
     - Escenario B: Ahora `r=3` (2★), sin "Día bueno" (antes `r=5` 4★ con "Día bueno") [VERIFICADO].
     - Escenario C: Ahora `r=6` (5★, Día muy bueno), conserva rating alto con mar real de fondo [VERIFICADO].
     - Escenario D: Baja a `r=5` (4★) por rachas de 32 km/h (antes idéntico a rachas de 16 km/h) [VERIFICADO].
     - Escenario H: Palaciet con mar pequeño baja de 4★ a 2★ (`r=3`) [VERIFICADO].
     - Escenario I: Palaciet estropeado por viento de mar baja a 0★ (`r=1`) [VERIFICADO].
     - Escenario L: Mar de viento corto (3.5s) queda en 0★ (`r=1`) [VERIFICADO].
     - Escenario N: Día con tarde rota no recibe etiqueta "Día bueno" general [VERIFICADO].

### 2.2 Baterías existentes en Python

- **Comando 1:** `python -m unittest backend.test_motor_fisica`
  - Resultado: `Ran 27 tests in 0.004s - OK` [VERIFICADO].
- **Comando 2:** `python -m unittest scripts.test_realtime`
  - Resultado: `Ran 8 tests in 0.045s - OK` [VERIFICADO].
- **Comando 3:** `python -m unittest scripts.test_rewind`
  - Resultado: `Ran 49 tests in 1.466s - OK` [VERIFICADO].
- **Total pruebas Python:** 84/84 superadas sin regresiones [VERIFICADO].

---

## 3. Inspección detallada de casos críticos

1. **Casos flat / plato y nulos:**
   - En `js/forecast.js`: si `h < 0.22m` devuelve `0` explícito ("Plato").
   - Si no hay datos de olas (`hasWaveData === false`), `processSpot` devuelve `surf: { min: null, max: null, mid: null }` y `rating: null`.
   - En `js/app.js`: `ratingCls(null)` devuelve `'r-na'`. La barra de colores en `barChart` usa `'var(--r-flat)'` como respaldo seguro ante `null`.
   - Distinción limpia: `r=0` tiene clase `r0` y etiqueta "Plato"; `null` tiene clase `r-na` y etiqueta "Sin datos" [VERIFICADO].

2. **Olas pequeñas:**
   - La función `rate()` aplica techos duros (`maxCap`):
     - `h < 0.35m`: maxCap 1 (0★)
     - `h < 0.48m`: maxCap 2 (1★)
     - `h < 0.65m`: maxCap 3 (2★)
     - `h < 0.75m`: maxCap 4 (3★)
   - Esto impide que una ola de 40 cm reciba notas de 4★ o 5★ aunque el viento sea terral perfecto [VERIFICADO].

3. **Viento y rachas:**
   - El viento efectivo pondera la racha: `eff = Math.max(v, g * 0.65)`.
   - Penalización extra directa por rachas fuertes: `g >= 26` penaliza de -0.4 a -1.0; rachas desproporcionadas (`g >= 18 && g >= v * 1.8`) restan -0.4; rachas con viento onshore/crosson restan -0.5 adicional [VERIFICADO].
   - Comprobada respuesta diferencial: rachas de 32 km/h reducen la calificación respecto a rachas de 16 km/h con idéntico viento medio [VERIFICADO].

4. **Coherencia visual (colores y estrellas):**
   - En `css/app.css`: `.r-na, .r0 { --rc: var(--r-flat); }`.
   - Cada nivel de rating `0..7` tiene asignada una paleta única y consistente con las estrellas otorgadas (`0..5` estrellas) [VERIFICADO].

---

## 4. Estado de la web publicada vs candidato

Se realizaron peticiones HTTP GET reales a los tres recursos indicados y se compararon byte a byte con `origin/main` y con el candidato `ms-corrige-estrellas`:

| Recurso | Estado HTTP | ETag / Last-Modified | Hash SHA256 Web | Coincide con `origin/main` | Coincide con Candidato |
| :--- | :--- | :--- | :--- | :---: | :---: |
| `https://joorcs96.github.io/MeteoSurf_Cs/` | 200 OK | `W/"6ac34dd6-dea"` / `Mon, 05 Oct 2026 07:12:22 GMT` | `8f1cc83790ad535dfc72937d3b4137902f990f2c5273ef07bc8406b563b9ccd5` | **SÍ (idéntico)** [VERIFICADO] | **SÍ (idéntico)** [VERIFICADO] |
| `https://joorcs96.github.io/MeteoSurf_Cs/js/forecast.js` | 200 OK | `W/"6ac34dd6-3d5a"` / `Mon, 05 Oct 2026 07:12:22 GMT` | `72a5dba0bf3c93c45d6c87de42e777cab7f1e3d2866dc5364dc9ee4dc909f001` (15.706 B) | **SÍ (idéntico)** [VERIFICADO] | **NO** (`d8591ff...`, 19.709 B) [VERIFICADO] |
| `https://joorcs96.github.io/MeteoSurf_Cs/sw.js` | 200 OK | `W/"6ac34dd6-52a"` / `Mon, 05 Oct 2026 07:12:22 GMT` | `9974d0758e5af645613bd99c584f39651c32664b0b9655b1bcac28d6f023ea15` (1.322 B) | **SÍ (idéntico)** [VERIFICADO] | **NO** (`0571cf6...`, 1.321 B) [VERIFICADO] |

### Explicación técnica de por qué aún no se ve en la web

1. **La rama candidata no está fusionada en `main`:**
   GitHub Pages compila y sirve el contenido de la rama `main` en GitHub. El commit de `origin/main` es `9d20fb7`, mientras que las correcciones de estrellas residen en la rama de trabajo `Joorcs96/ms-corrige-estrellas` (commit `718d959`), pendiente de integración [VERIFICADO].
2. **Versión de caché de la Service Worker:**
   En la web publicada, la Service Worker está en `CACHE = 'meteosurf-cs-v8-rewinds'`. En el candidato, la versión fue incrementada a `CACHE = 'meteosurf-cs-v9-rating'`. Una vez que el cambio sea integrado en `main` y desplegado, el nuevo Service Worker invalidará la caché automáticamente [VERIFICADO].

---

## 5. Conclusión y dictamen

- **Validez técnica del candidato:** El candidato en `718d959` resuelve rigurosamente los problemas de optimismo, maneja correctamente nulos y mar plato, castiga rachas y mar de viento, y no presenta regresiones en ninguna suite de pruebas [VERIFICADO].
- **Condición de certificación:** Válido para SHA `718d959` (rebase de `89c1d42`). Si el auditor realiza un nuevo commit sobre el candidato antes de fusionar, se deberá verificar el nuevo SHA resultante [VERIFICADO].

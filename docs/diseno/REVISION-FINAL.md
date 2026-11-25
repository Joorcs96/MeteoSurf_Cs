# Revisión independiente · Planificación profesional (`288f10b`)

**Veredicto:** `fix`  
**Rama y commit revisados:** `feature/planificacion-profesional` @ `288f10b304746c4744e00ca659c6cae07a1ef9d7`  
**Fecha de revisión:** 2026-11-26  
**Alcance:** Revisión independiente de acabado y funcionamiento sin modificar código ni publicar. Sustituye de forma manual a la revisión Impeccable (binario y detectores automáticos no ejecutados).

---

## 1. Disposición y alcance

La aplicación evoluciona de una portada comercial con tarjetas a una mesa de planificación costera centrada en **Jornada** (`index.html`, `css/sistema.css`, `js/jornada.js`), conservando **Previsión**, **Mapa** (con capas Open-Meteo y mapa marítimo AEMET), **Cámaras** (incluyendo Rewind), **Mis spots**, **Asistente**, **Avisos** y el enlace legacy `#/ahora`.

- **Veredicto `fix`:** La arquitectura base, la separación modular en ES modules, la persistencia/compartición por hash y la honestidad general entre ola estimada en playa, Hs mar adentro y boya están bien encaminadas; no procede `rebuild`. Sin embargo, se han comprobado **fallos materiales P1** (autoplay de cámara en móvil/tablet, contraste WCAG AA por debajo de 4,5:1 en botones primarios oscuros y en toda la tipografía secundaria `--text-3` en claro, desbordamientos del selector y filas en `1280px` y `375px/390px`, y modales intrusivos heredados con datos que contradicen Jornada) que impiden aprobar `ship`.
- **Fuera de alcance:** No se han modificado código, datos meteorológicos, física, calibración, backend, app móvil, URLs de cámaras, rama ni historial Git.

---

## 2. Evidencia revisada y límites

### Código y pruebas verificadas
- Código inspeccionado: [index.html](file:///C:/Users/Jordi/orca/Surfline_CS/index.html), [css/sistema.css](file:///C:/Users/Jordi/orca/Surfline_CS/css/sistema.css), [css/app.css](file:///C:/Users/Jordi/orca/Surfline_CS/css/app.css), [js/jornada.js](file:///C:/Users/Jordi/orca/Surfline_CS/js/jornada.js), diff y rutas en [js/app.js](file:///C:/Users/Jordi/orca/Surfline_CS/js/app.js), [js/notificaciones.js](file:///C:/Users/Jordi/orca/Surfline_CS/js/notificaciones.js), [sw.js](file:///C:/Users/Jordi/orca/Surfline_CS/sw.js), [js/cams.js](file:///C:/Users/Jordi/orca/Surfline_CS/js/cams.js), [js/forecast.js](file:///C:/Users/Jordi/orca/Surfline_CS/js/forecast.js), [js/assistant.js](file:///C:/Users/Jordi/orca/Surfline_CS/js/assistant.js), [tests/jornada.test.mjs](file:///C:/Users/Jordi/orca/Surfline_CS/tests/jornada.test.mjs).
- Documentos y guías leídos: [PRODUCT.md](file:///C:/Users/Jordi/orca/Surfline_CS/PRODUCT.md), [DESIGN.md](file:///C:/Users/Jordi/orca/Surfline_CS/DESIGN.md), [SPEC-IMPLEMENTACION.md](file:///C:/Users/Jordi/orca/Surfline_CS/docs/diseno/SPEC-IMPLEMENTACION.md), guías `frontend-design` y referencias Impeccable (`craft-floor.md`, `polish.md`, `critique-rubric.md`).
- Ejecución local verificada:
  - `node --check js/jornada.js js/app.js js/notificaciones.js sw.js`: correcto.
  - `node --test tests/jornada.test.mjs`: **14/14** pruebas unitarias de lógica pura en verde (no cubren DOM, CSS, foco, cámaras ni rutas).
  - Comprobación de los 26 archivos listados en `SHELL` de `sw.js`: todos presentes en disco.

### Capturas y navegador en vivo (`orca-cli`)
- **Renders aprobados:** `docs/diseno/renders/escritorio-claro-v1.png`, `escritorio-oscuro-v1.png` y `movil-claro-v1.png`.
- **Evidencia original del implementador (`docs/evidencia/`, 8 PNG):** Corresponden al código del commit `288f10b` (capturadas el 25 nov a las 01:20), pero **todas muestran únicamente el primer viewport**, recortando la curva de la gráfica SVG, la tabla horaria detallada, el mapa AEMET, el pie y gran parte de la vista móvil. En esas capturas ya eran visibles el desbordamiento del selector `Añadir lugar…` en móvil `390px` y el solapamiento visual `m / 1` en el eje Y de la gráfica.
- **Evidencia nueva generada en `docs/evidencia/revision/` (18 PNG) sobre servidor local temporal en Chromium (`127.0.0.1:8792`):**
  - Páginas completas: `jornada-1440-claro-full.png`, `jornada-1440-oscuro-full.png`, `jornada-390-claro-full.png`, `jornada-375-claro-full.png`, `jornada-768-oscuro-full.png`, `jornada-720-zoom200-claro-full.png` (reflow equivalente a zoom 200 % de 1440 px).
  - Breakpoint `1280x900` (`jornada-1280-claro.png`) y diálogo compartir / avisos (`dialog-compartir-1440-oscuro.png`, `notificaciones-390-oscuro.png`).
  - Rutas secundarias en tema oscuro `1440x900`: `ruta-prevision-1440-oscuro.png`, `ruta-mapa-1440-oscuro.png`, `ruta-camaras-1440-oscuro.png`, `ruta-favoritos-1440-oscuro.png`, `ruta-asistente-1440-oscuro.png`, `ruta-spot-Planetario-1440-oscuro.png`, `spot-horas-1440-oscuro.png`, `ruta-ahora-1440-oscuro.png`, `ruta-calendario-1440-oscuro.png`.
  - Mediciones DOM/WCAG AA computadas en claro y oscuro, comprobaciones interactivas (persistencia, restauración por URL, fallback de compartir, foco/Escape en Avisos, ciclo de cámaras, horizonte día 16, `320px`, `640px`, `1280px`).

### Límites explícitos
1. **Sin puertas automáticas ni binario Impeccable:** No se ha ejecutado ningún ejecutable ni detector automático; todas las comprobaciones de contraste y acabado son manuales/DOM.
2. **Datos en vivo con observaciones locales antiguas:** Durante la prueba en navegador (`2026-11-26 00:12`), Open-Meteo devolvió previsión real de 16 días con mar plano (`0,0–0,1 m`), mientras que `data/realtime.json` (`2026-11-22T18:00:00Z`) tenía **77 h de antigüedad** y `data/streams.json` tenía el TTL de 45 min expirado (por lo que `Planetario` reprodujo el `iframe` de respaldo de IPCamLive y `Morro de Gos` el HLS en `<video>`).
3. **Lector de pantalla real y iPhone físico:** Se verificó semántica ARIA (`radiogroup`, `role="dialog"`, `role="region"`, `tabindex="0"`), foco programático y cierre con `Escape`, pero no se probó con NVDA/VoiceOver ni con Safari táctil en iPhone físico (incluido `navigator.share` nativo y ajuste de fuentes OS).

---

## 3. Fidelidad al encargo

- **Lo logrado respecto a `PRODUCT.md`, `DESIGN.md` y `SPEC-IMPLEMENTACION.md`:**
  - **Mesa de planificación real:** `Jornada` integra comparación multi-spot (hasta 8 lugares), gráfica SVG con banda de playa estimada, línea media, Hs mar adentro discontinua y franja resaltada, tabla horaria, inspector con ficha/Rewind y mapa AEMET, sin alumnos, reservas ni cobros.
  - **Navegación y rutas conservadas:** 4 destinos principales (`Jornada`, `Previsión`, `Mapa`, `Cámaras`) + utilidades (`Mis spots`, `Asistente`, `Avisos`, `Actualizar`, `Tema`, `Histórico`); rutas `#/ahora`, `#/favoritos`, `#/calendario` y `#/spot/:id` operativas.
  - **Persistencia y enlace compartible:** Fecha, franja, deporte, nivel, selección y lista comparada persisten en `localStorage` y en hash restaurable; el parte incluye zona `Europe/Madrid`, disclaimer de seguridad, fuentes y diálogo fallback con `textarea`.
  - **Honestidad de boya vs modelo:** La observación antigua (`> 3 h`) se marca explícitamente como `Observación antigua · dato antiguo o no válido` con borde discontinuo y nota aclaratoria cuando se consulta un día futuro.
  - **Limpieza de cámara al cambiar de ruta:** Probado en escritorio (`#/jornada` -> `#/prevision` -> `#/jornada`): `stopCam` destruye `<video>`/`<iframe>` al salir de Jornada (`media: 1 -> 0 -> 1`).
- **Desviaciones frente al encargo y guías (`frontend-design` / `craft-floor.md`):**
  - **Móvil no cumple el patrón de comparación compacto ni el póster sin autoplay:** En `<= 760px` cada lugar ocupa ~240 px verticales en 5 filas apiladas en lugar de la fila compacta en 2 columnas del render aprobado (`movil-claro-v1.png`), y la cámara se autorreproduce en móvil/tablet.
  - **Contraste insuficiente y acabado oscuro incompleto:** El botón primario claro sobre azul pastel en oscuro (`#fff` sobre `#72adff` = 2,30:1) y el gris `--text-3` (`#8a9099` = 2,84–3,22:1) rompen la legibilidad prometida.
  - **Modales heredados intrusivos:** `#onboard-overlay` y `#pro-modal` (con precio hipotético `2,99 €/mes`) saltan automáticamente al entrar a rutas secundarias.

---

## 4. Hallazgos materiales priorizados

### P1 · Errores funcionales, accesibilidad y rotura de layout

#### P1-1. Autoplay de cámara activo en móvil y tablet (código de póster inoperante)
- **Ubicación:** [js/jornada.js:290](file:///C:/Users/Jordi/orca/Surfline_CS/js/jornada.js#L290), [js/jornada.js:449-450](file:///C:/Users/Jordi/orca/Surfline_CS/js/jornada.js#L449-L450), [js/jornada.js:724-745](file:///C:/Users/Jordi/orca/Surfline_CS/js/jornada.js#L724-L745)
- **Reproducción:** Abrir `#/jornada` a `390x844`, `375x812` o `768x1024` (o cambiar de spot en móvil). `render()` llama a `update({ first: true })`, por lo que `mountCam(first || camSpot !== spot.id)` recibe `force = true` tanto en la carga inicial como en cada cambio de spot (`camSpot !== spot.id`). En `mountCam(force)`, el bloque `if (force) { playCam(el, cam, { autoplay: true }); return; }` se ejecuta **antes** de comprobar `matchMedia('(min-width: 1000px)').matches`.
- **Impacto:** `.jr-cam-poster` nunca se muestra; el `<video>` HLS (`videoAutoplay: true, videoPaused: false`) o `<iframe>` (`&autoplay=1`) arrancan automáticamente en móvil/tablet consumiendo datos móviles y contradiciendo `DESIGN.md` y `SPEC-IMPLEMENTACION.md`. Evidencia en `docs/evidencia/revision/jornada-390-claro-full.png`, `jornada-375-claro-full.png` y `jornada-768-oscuro-full.png`.

#### P1-2. Contraste insuficiente (`2,30:1`) en botones primarios y chips activos en modo oscuro
- **Ubicación:** [css/sistema.css:164-168](file:///C:/Users/Jordi/orca/Surfline_CS/css/sistema.css#L164-L168), [css/sistema.css:556-560](file:///C:/Users/Jordi/orca/Surfline_CS/css/sistema.css#L556-L560) (contrasta con la corrección parcial solo para avisos en [css/sistema.css:2116-2118](file:///C:/Users/Jordi/orca/Surfline_CS/css/sistema.css#L2116-L2118))
- **Reproducción:** Activar tema oscuro (`data-theme="dark"`) y observar `.jr-btn-primary` (`Compartir parte`, `Copiar texto` en `#jr-share-dialog`, `▶` de AEMET) y `.chip.on` en `#/prevision`, `#/camaras`, `#/favoritos` y `#/calendario`.
- **Impacto:** Texto blanco `#ffffff` sobre `--sel: #72adff` medido en **2,30:1** (mínimo WCAG AA: 4,5:1). Afecta a la acción principal de Jornada y a los filtros activos en todas las rutas. Evidencia en `jornada-1440-oscuro-full.png`, `dialog-compartir-1440-oscuro.png`, `ruta-prevision-1440-oscuro.png`, `ruta-camaras-1440-oscuro.png`.

#### P1-3. Contraste insuficiente (`2,84–3,22:1` en claro; `4,00–4,23:1` en oscuro) en toda la tipografía secundaria `--text-3`
- **Ubicación:** [css/sistema.css:10,42](file:///C:/Users/Jordi/orca/Surfline_CS/css/sistema.css#L10) y [DESIGN.md:45](file:///C:/Users/Jordi/orca/Surfline_CS/DESIGN.md#L45)
- **Reproducción:** Medición computada en Chromium sobre `#/jornada`:
  - Claro (`--text-3: #8a9099`, 9–11 px): **3,22:1** sobre `#ffffff` (`.rail-label`, `.rail-foot`, `.jr-field span`, `.jr-hint`, `.jr-compare-head`, `.jr-compare-note`, `.jr-axis-text`, `.jr-kpis span`, `.jr-obs-head`, `.jr-source`, `.jr-note`, `.footer`), **2,97:1** sobre `#f5f6f8` (`.jr-context-box span`) y **2,84:1** sobre `#e9f2fc` (`.jr-row.is-selected .jr-cell small`).
  - Oscuro (`--text-3: #7f8791`): **4,00:1** sobre `#1b2a3d` (fila seleccionada) y **4,23:1** sobre `#22252a` (`.jr-context-box span`).
- **Impacto:** Fallo generalizado de WCAG AA (`>= 4,5:1`) en textos clave pequeños de 9–11 px (etiquetas `estimación`, advertencia legal, unidades/ejes de gráfica, fuentes y antigüedad), especialmente crítico al consultar la pantalla al aire libre o al amanecer.

#### P1-4. Desbordamiento de controles en `1280px` y `375px/390px`, y recorte de la franja en móvil
- **Ubicación:** [css/sistema.css:709-720,730,1530-1535,1570-1574,1677-1679](file:///C:/Users/Jordi/orca/Surfline_CS/css/sistema.css#L727-L733)
- **Reproducción:**
  1. A **1280x900** (`jornada-1280-claro.png`): la suma mínima de columnas en `.jr-compare-head, .jr-row` (`150 + 4*72 + 86 + 82 + 48 px de gaps = 654 px`) excede el ancho interior de `.jr-panel` (`617 px`, pues `.jr-main` mide `651 px` con el inspector de `320 px` al lado). Los botones `×` de quitar lugar sobresalen por fuera del borde derecho de la tarjeta hacia el espacio entre columnas.
  2. A **375x812** y **390x844** (`jornada-375-claro-full.png`, `docs/evidencia/jornada-movil-390-claro.png`): `#jr-add-spot` dentro del contenedor flex `.jr-compare-actions` no tiene `min-width: 0; max-width: 100%;` y conserva el ancho intrínseco mínimo de su opción más larga (`338 px` vs `343 px` de panel total a 375 px -> `addSelRect.right = 368 > panel.right = 359`), saliendo por el borde derecho del panel.
  3. A **375x812** y **390x844**: el selector `#jr-range` (`FRANJA`) recorta `09:00–12:00 · 3 h` en `09:00–12:00 ·` contra la flecha derecha del `<select>`.

#### P1-5. Modales heredados intrusivos en rutas secundarias (`#onboard-overlay` y `#pro-modal` con precio)
- **Ubicación:** [index.html:75-123](file:///C:/Users/Jordi/orca/Surfline_CS/index.html#L75-L123), [js/app.js:13-40,566,660,900](file:///C:/Users/Jordi/orca/Surfline_CS/js/app.js#L13-L40)
- **Reproducción:** Con sesión limpia (`localStorage` sin `ob_done`), entrar en `#/jornada` (no aparece), luego navegar a `#/prevision`, `#/mapa` o `#/camaras` -> salta `#onboard-overlay` (*"Guía rápida de previsión"*) bloqueando toda la pantalla con información obsoleta y contradictoria (*"Hs = altura de ola"*, *"Estrellas = calidad 0-5"*). Al entrar en `#/asistente`, salta además `#pro-modal` (*"MeteoSurf Pro · 2,99 €/mes (hipotético)"*) encima de `#onboard-overlay` (ver `ruta-asistente-1440-oscuro.png`).
- **Impacto:** Contradice la honestidad científica de Jornada (`Hs` vs ola en playa), la escala actual (`Plato`..`Épico`), la exclusión de cobros y la regla de no mostrar pop-ups comerciales intrusivos.

---

### P2 · Desajustes funcionales, densidad móvil y claridad de datos

#### P2-1. Densidad móvil excesiva en la comparación (`<= 760px`) y tabla recortada
- **Ubicación:** [css/sistema.css:1584-1636](file:///C:/Users/Jordi/orca/Surfline_CS/css/sistema.css#L1584-L1636), [css/sistema.css:984-993](file:///C:/Users/Jordi/orca/Surfline_CS/css/sistema.css#L984-L993)
- **Reproducción:** Abrir `#/jornada` en `390x844` o `375x812` (`jornada-390-claro-full.png`). Cada lugar apila 5 subfilas verticales (`OLA EN PLAYA`, `PERIODO`, `VIENTO`, `RACHAS`, `CALIDAD`), alcanzando ~240 px por spot; comparar 4 spots requiere ~1000 px de scroll vertical y no permite ver ni dos lugares completos a la vez (alejándose del patrón compacto en 2 columnas del render `movil-claro-v1.png`). Además, la tabla `Detalle de la franja` (`min-width: 560px`) corta la columna `VIENTO` por la mitad en primer plano sin un indicador claro de desplazamiento horizontal.

#### P2-2. Solapamiento de etiqueta `m` en eje Y de la gráfica y caída bajo el pliegue en `1440x900`
- **Ubicación:** [js/jornada.js:546-549,575,592](file:///C:/Users/Jordi/orca/Surfline_CS/js/jornada.js#L546-L549)
- **Reproducción:** En `jornada-1440-claro-full.png` y `jornada-escritorio-1440-claro.png`, el texto `m` (`y = padT - 6 = 12`) queda pegado encima de la marca superior `0,5` o `1` (`y = padT + 4 = 22`), leyéndose como `m / 0,5` o `m / 1`. Asimismo, en `1440x900` la cabecera, filtros, aviso y 4 filas dejan prácticamente toda la curva SVG por debajo del primer viewport (solo se ve la banda superior de `1` / `0,5`), a diferencia del render aprobado `escritorio-claro-v1.png`.

#### P2-3. Horas incompletas / parcialmente nulas ocultadas en el resumen de la franja y célula `Sin dato` + `–`
- **Ubicación:** [js/jornada.js:113-116,499-503,679-688](file:///C:/Users/Jordi/orca/Surfline_CS/js/jornada.js#L113-L116) y [js/forecast.js:233](file:///C:/Users/Jordi/orca/Surfline_CS/js/forecast.js#L233)
- **Reproducción:**
  1. `summarizeSpot` calcula `count` y `missing`, pero `renderCompare()` y `renderInspectorInfo()` solo comprueban `sum.hasData` (`withSurf > 0`). Si faltan 2 de las 3 horas de la franja (p. ej. hueco de modelo o límite del horizonte), la tabla presenta los datos de la única hora válida como si representaran toda la franja sin avisar de cobertura parcial.
  2. Comprobado en el último día del horizonte real (`2026-12-11`, franja `18:00–20:00`): el modelo marino existe (`0,0 m`, `6 s`, `Plato`), pero Open-Meteo meteorológico ya no devuelve viento -> la celda `Viento` muestra `Sin dato` arriba y `–` debajo (procedente de `windState` en `forecast.js:233`).

#### P2-4. Criterios implícitos de resumen y relación entre `Deporte`, `Nivel` y `Calidad`
- **Ubicación:** [js/jornada.js:91-130,486-503](file:///C:/Users/Jordi/orca/Surfline_CS/js/jornada.js#L91-L130)
- **Reproducción:** Cambiar `Deporte` (`Surf` -> `Windsurf` / `SUP`) y `Nivel` (`Iniciación` -> `Competición`): la tabla comparativa y `Calidad` no varían ni aclaran que `Calidad` evalúa **oleaje para surf** (en un mar de `0,0–0,1 m` marca `Plato` incluso con `SUP` o `Windsurf`). Tampoco se indica en la comparación que `Viento` es media con la dirección de la hora central, `Rachas` el máximo y `Calidad` la **mejor hora** de la franja (dato solo visible en el inspector). En spots abrigados (`Voramar`, `La Concha`), `windAvg`/`gustMax` usan la velocidad bruta sin abrigo mientras `windLabel` y `rating` usan `vientoAbrigado`.

#### P2-5. Regresiones menores de navegación heredadas en `js/app.js`
- **Ubicación:** [js/app.js:711,924,1379,2531-2534](file:///C:/Users/Jordi/orca/Surfline_CS/js/app.js#L2531-L2534)
- **Detalle:**
  1. En `#/calendario`, el botón `< Previsión` apunta a `href="#/"`, que ahora redirige a `#/jornada` en lugar de `#/prevision` (mismo enlace `#/` en `renderPro` y `renderSpot`).
  2. En `forecast:ready`, si `localStorage.sort_mode === 'best_week'` y el usuario está en `#/favoritos`, ejecuta `renderHome()` (`renderAhora()`) reemplazando la vista de favoritos por `#/ahora`.
  3. En `#/jornada`, si el usuario ha dejado 0 favoritos intencionadamente y pulsa `#jr-favs-btn` (`Mis spots`), `chooseDefaultCompare` carga silenciosamente los 4 spots por defecto sin informar de que no hay favoritos guardados.

---

### P3 · Acabado visual y coherencia de sistema

- **Bordes unilaterales en cajas redondeadas (`craft-floor.md`):** `.notif-notice` ([css/sistema.css:2062](file:///C:/Users/Jordi/orca/Surfline_CS/css/sistema.css#L2062)) usa `border-left: 3px solid ...` sobre `border-radius: var(--r)` (visible en `notificaciones-movil-390.png` y `notificaciones-390-oscuro.png`); `.jr-row.is-selected` ([css/sistema.css:762](file:///C:/Users/Jordi/orca/Surfline_CS/css/sistema.css#L762)) usa `box-shadow: inset 3px 0 0 var(--sel)` sobre `border-radius: 8px` junto a fondo azulado.
- **Formato decimal incoherente entre rutas:** Jornada formatea metros con coma española (`0,0–0,1 m`), mientras `Previsión`, `Ahora`, `Mapa` y `Spot` siguen usando punto (`0–0.2 m`, `0.1–0.2 m`).
- **Enlaces con flecha añadida (`Ver recomendación de ahora →`, `Ficha y Rewind →`):** Acompañados de icono SVG; menor relevancia frente a los puntos P1/P2.

---

### Preferencias y dudas reales (no bloqueantes)

- **Preferencia:** En `#/mapa` modo oscuro (`ruta-mapa-1440-oscuro.png`), los controles nativos de Leaflet (`+`, `-`, capas) permanecen en blanco puro frente a la barra superior oscura de capas, y los rótulos de spots cercanos (`Morro de Gos`, `La Concha`, `Voramar`, `Heliópolis`) se solapan al zoom inicial; es comportamiento previo de `app.css`/`Leaflet`, no regresión de `288f10b`.
- **Duda real para producto (Jordi / coordinador):** Cuando un entrenador elige **SUP**, **Windsurf** o **Kitesurf** en `Jornada`, ¿debe etiquetarse la columna como `Calidad (surf)` / deshabilitarse como métrica específica de surf, o simplemente aclararlo en nota sin alterar la física de `forecast.js`?
- **Duda real sobre el botón `Mis spots` en Jornada:** Cuando el usuario tiene 0 favoritos guardados, ¿debe avisar con un toast y mantener la comparación actual o mostrar los 4 spots de referencia explicándolo?

---

## 5. Criterios verificables de resolución

Para pasar de `fix` a `ship`, los cambios deberán cumplir y demostrar con captura/medición en navegador todos estos puntos:

1. **Sin autoplay móvil/tablet (`<= 999px`):** Al abrir `#/jornada` o cambiar de spot en `375px`, `390px` y `768px`, `#jr-cam` debe mostrar `.jr-cam-poster` y `document.querySelectorAll('#jr-cam video, #jr-cam iframe').length === 0` hasta pulsar explícitamente `Ver cámara en directo`.
2. **Contraste WCAG AA (`>= 4,5:1`) en claro y oscuro:**
   - Texto de `.jr-btn-primary` y `.chip.on` en modo oscuro contra `--sel` (`#72adff`) con ratio `>= 4,5:1` (por ejemplo, texto `#0b1220` como ya usa `.notif-btn-primary`).
   - Todas las etiquetas pequeñas (`--text-3`) en claro y oscuro con ratio `>= 4,5:1` sobre `#ffffff`, `#f5f6f8`, `#e9f2fc`, `#17191d`, `#22252a` y `#1b2a3d`.
3. **Cero desbordamiento ni truncamiento en `320px`, `375px`, `390px`, `768px`, `1280px` y `1440px`:**
   - A `1280px`, ningún elemento de `.jr-row` sobresale de `.jr-panel` (`row.right <= panelInnerRight`).
   - A `375px` y `390px`, `#jr-add-spot` queda dentro de `.jr-panel` (`addSel.right <= panelInnerRight`) y el `<select>` de franja muestra completa la franja seleccionada sin cortar `· 3 h` (o con formato compacto legible).
4. **Eliminación/actualización de pop-ups intrusivos:** Ni `#onboard-overlay` (con datos contradictorios de `Hs` y estrellas `0-5`) ni `#pro-modal` (con tarifa hipotética) deben aparecer automáticamente al navegar entre rutas desde Jornada.
5. **Comparación móvil y gráfica legibles:**
   - En móvil (`<= 760px`), las filas de comparación muestran al menos 2–3 lugares visibles de un vistazo sin apilar 5 filas altas por cada lugar.
   - En la gráfica SVG, la etiqueta de unidad (`m` o `Altura (m)`) no se superpone ni toca la marca numérica superior del eje Y (`0,5` / `1`).
6. **Transparencia de franja parcial, viento nulo y enlaces:** Indicar si faltan horas dentro de la franja elegida, omitir el sub-rótulo `–` cuando el viento es `Sin dato`, aclarar que `Calidad` mide condiciones de surf, corregir el enlace `< Previsión` en `#/calendario` (`#/prevision`), y no reemplazar `#/favoritos` con `renderHome()` en `forecast:ready`.
7. **Evidencia nueva completa:** Repetir verificación en `375px`, `390px`, `768px`, `1280px`, `1440px` y zoom 200 % en claro/oscuro abriendo capturas completas (y primer viewport para el pliegue de `1440x900`).

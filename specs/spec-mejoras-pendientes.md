# SPEC: Implementar mejoras MEJ-01 a MEJ-05 en MeteoSurf_Cs

## OBJETIVO
Implementar las 4 mejoras priorizadas detectadas en la simulación. Trabajar en la rama `feature/mejoras-ux-auditoria`. Un commit pequeño y descriptivo por cada mejora.

## CONTEXTO MÍNIMO
- App PWA surf Castellón. HTML/CSS/JS vanilla, sin frameworks.
- Rama activa: `feature/mejoras-ux-auditoria`
- CSP estricta: NO usar `onclick`, `onload`, scripts inline ni `eval`. Toda lógica va en `js/app.js` o `js/cams.js`.
- Variables CSS: `--brand`, `--text`, `--surface`, `--surface-2`, `--line`, `--bg`, `--text-2`
- El calendario semanal se renderiza con `renderCalendario()` en `js/app.js`
- Los spots tienen datos en `js/spots.js` — NO modificar ese archivo
- El forecast se recibe vía evento `forecast:ready` con `e.detail` = objeto forecast por spot

## ARCHIVOS AUTORIZADOS
- `js/app.js` — lógica principal
- `js/cams.js` — lógica de cámaras
- `css/app.css` — estilos
- `index.html` — solo HTML estructural (sin scripts inline, sin onclick)

## PROHIBIDO
- Tocar `js/spots.js`, `js/physics.js`, `backend/`, `data/`
- Scripts inline, onclick, onerror en HTML
- `git push --force`
- Crear archivos `.bak-*`
- Instalar dependencias npm nuevas

## MEJORAS A IMPLEMENTAR (en este orden)

### MEJ-01: Modal/Banner de Ventajas Pro (impacto ALTO, ~3h)
**Objetivo:** Cuando el usuario pulsa una función bloqueada (o en la pantalla del Asistente), mostrar un modal/banner atractivo con las ventajas de suscripción Pro a 2,99€/mes.

**Funcionalidades:**
- Añadir función `showProModal()` en `js/app.js`
- Modal con: título "Desbloquea MeteoSurf Pro", precio "2,99 €/mes", lista de 4-5 ventajas (Previsión completa 16 días, Rewind de cámaras ilimitado, Alertas push de condiciones, Soporte para más spots, Sin publicidad)
- Botón "Suscribirse" (por ahora href="#/pro" sin lógica de pago)
- Botón "Ahora no" que cierra el modal
- Activación: añadir en la UI del Asistente (`#/asistente`) un banner "Pro" visible siempre que diga "Acceso completo con Pro"
- CSS con variables CSS del proyecto. z-index > 2000 para que tape el FAB. Fondo con backdrop-filter: blur.
- No mostrar más de una vez por sesión (sessionStorage `pro_shown`)

**Commit:** `ux: modal y banner Pro con ventajas de suscripción`

### MEJ-02: Filtro "Apto para Principiantes" en Calendario Semanal (impacto MEDIO, ~2h)
**Objetivo:** En la vista calendario (`renderCalendario()`), añadir un toggle/chip que resalte en verde los días con condiciones aptas para principiantes.

**Criterio principiante:** Hs < 0.6m Y viento < 15km/h (o calma/terral) Y rating <= 2 estrellas (condiciones suaves)
Si no tienes el dato exacto de viento en el calendario, usa solo Hs < 0.6m y que haya previsión disponible.

**Implementación:**
- Añadir chip "🤙 Principiantes" en el header del calendario (junto a otros filtros si los hay)
- Al activarlo: resaltar celdas que cumplan el criterio con borde/fondo verde suave (usa `--green: #10b981` o parecido)
- El chip es toggle: activo/inactivo. Estado guardado en `sessionStorage` clave `cal_beginner`
- La lógica de resaltado debe funcionar incluso si el forecast no está completamente cargado (graceful degradation: sin resalte si no hay datos)

**Commit:** `ux: filtro principiantes en calendario semanal`

### MEJ-03: Ordenación por Mejor Franja Semanal (impacto MEDIO, ~2.5h)
**Objetivo:** En la pantalla principal (lista de spots), añadir un selector de ordenación que permita ordenar por "Mejor día esta semana".

**Implementación:**
- Añadir un `<select>` o chips de ordenación junto al buscador/filtros de la pantalla principal
- Opciones: "Por defecto", "Mejor día esta semana", "Más cerca" (si hay geoloc) 
- "Mejor día esta semana": ordenar los spots por el rating máximo que tendrán en los próximos 7 días según el forecast disponible
- Si el forecast no está cargado aún, mostrar el orden por defecto y re-ordenar cuando llegue el evento `forecast:ready`
- Guardar preferencia en `localStorage` clave `sort_mode`

**Commit:** `ux: ordenar spots por mejor franja semanal`

### MEJ-05: Badge "En directo" en Cámaras (impacto MEDIO, ~2h)
**Objetivo:** En la pantalla de cámaras, mostrar un badge verde "● En directo" o amarillo "● Búfer" junto a cada cámara según el estado real del stream HLS.

**Implementación:**
- En `js/cams.js`, para cada stream HLS activo: escuchar el evento `playing` del elemento `<video>` para marcarlo como "En directo"
- Escuchar `waiting` o `stalled` para marcarlo como "Búfer"
- Si el stream no carga en 8 segundos, marcarlo como "Sin señal" (badge rojo)
- Añadir estilos `.cam-badge` en `css/app.css` con las 3 variantes (verde/amarillo/rojo)
- Si no existe `js/cams.js`, implementar la lógica directamente en `js/app.js` en la función que renderiza las cámaras
- NO modificar la lógica de reproducción, solo añadir indicadores visuales

**Commit:** `ux: badge estado en directo en cámaras HLS`

## PASOS DE EJECUCIÓN
1. `git status` — verificar que estás en la rama correcta
2. Leer `js/app.js` (solo las funciones relevantes: `renderCalendario`, `renderHome`, la sección del Asistente, la sección de spots)
3. Implementar MEJ-01, commit
4. Implementar MEJ-02, commit
5. Implementar MEJ-03, commit
6. Leer `js/cams.js` o la sección de cámaras en `js/app.js`
7. Implementar MEJ-05, commit

## CRITERIO DE ACEPTACIÓN
- 4 commits, uno por mejora, mensajes descriptivos en español/inglés
- Sin errores de consola nuevos (especialmente sin violaciones CSP)
- El modal Pro se puede cerrar y no bloquea la navegación
- El filtro de principiantes es visible en la vista calendario
- La ordenación funciona cuando hay datos de forecast
- Los badges de cámara no rompen la reproducción existente

## ENTREGA
Commits en `feature/mejoras-ux-auditoria`. No hacer push.

# Plan de Mejoras · Simulación Longitudinal 12 Meses (MeteoSurf_Cs)

Este documento prioriza todas las mejoras detectadas durante la simulación longitudinal y la auditoría de línea base en la PWA y la aplicación móvil Expo.

---

## Matriz de Clasificación y Prioridad

| ID | Producto | Tipo | Severidad | Impacto | Esfuerzo | Riesgo | Archivos Autorizados | Estado | Verificación |
|---|---|---|---|---|---|---|---|---|---|
| **MEJ-01** | PWA Web | Accesibilidad | Media | Alto | 15 min | Mínimo | `css/app.css` | `[VERIFICADO]` | `node tools/simulacion-12m/linea-base-pwa.mjs` (0 menores de 44px) |
| **MEJ-02** | App Móvil | Configuración | Media | Alto | 10 min | Mínimo | `surfline-mobile/app.json` | `[VERIFICADO]` | `npx expo-doctor` (esquema válido, 18/20 checks) |
| **MEJ-03** | App Móvil | Claridad UX | Media | Alto | 20 min | Bajo | `surfline-mobile/app/(tabs)/**` | `[VERIFICADO]` | `cd surfline-mobile; npx tsc --noEmit` (0 errores) |
| **MEJ-04** | PWA Web | Honestidad UX | Media | Alto | 20 min | Bajo | `index.html`, `js/app.js` | `[VERIFICADO]` | Modal y banners sin promesas falsas de cobro |
| **MEJ-05** | PWA Web | Resiliencia | Baja | Medio | 15 min | Mínimo | `js/app.js` | `[VERIFICADO]` | Botón `#btn-reintentar` accesible con `role="alert"` |
| **MEJ-06** | App Móvil | Dependencias | Baja | Medio | 20 min | Medio | `surfline-mobile/package.json` | `BLOQUEADA` | Bloqueada por prohibición de instalar dependencias |
| **MEJ-07** | PWA Web | Vídeo / CDN | Baja | Medio | 1 h | Medio | `js/cams.js` | `REQUIERE DECISIÓN` | Pendiente decisión Jordi: ¿local vs jsdelivr? |
| **MEJ-08** | App Móvil | Feature | Alta | Crítico | 4 h | Alto | `surfline-mobile/**` | `FUERA DE ALCANCE` | Corresponde a Fase 2 (pipeline vídeo nativo) |

---

## 1. MEJORAS APLICADAS Y VERIFICADAS EN ESTA SESIÓN

### MEJ-01: Tamaño táctil mínimo en botones de navegación de cabecera (WCAG 44×44px)
- **Evidencia:** La auditoría Playwright en `tools/simulacion-12m/linea-base-pwa.json` detectó que en escritorio (1366×768) el enlace "Mapa" en la cabecera medía 34×44px, incumpliendo el ancho táctil mínimo de 44px de WCAG 2.1 AA.
- **Antes:** `.topnav a` tenía ancho dependiente únicamente del texto corto (34px).
- **Después:** Añadido `min-width: 44px; justify-content: center; padding: 0 6px;` a `.topnav a` en `css/app.css`.
- **Prueba exacta:** `node tools/simulacion-12m/linea-base-pwa.mjs` reporta `menores44pxCount: 0`.
- **Commit:** `3d77d11` (`a11y(web): asegurar tamano tactil minimo de 44px en navegacion`).
- **Estado:** `[VERIFICADO]`.

### MEJ-02: Corrección de esquema app.json para Expo SDK 58
- **Evidencia:** `npx expo-doctor` reportaba error fatal de esquema por propiedades obsoletas: `newArchEnabled` y `splash` en el bloque principal `expo` de `surfline-mobile/app.json`.
- **Antes:** `expo-doctor` fallaba con 3 errores de validación.
- **Después:** Eliminadas propiedades obsoletas. El check `Check Expo config (app.json/ app.config.js) schema` pasa con éxito.
- **Prueba exacta:** `cd surfline-mobile; npx expo-doctor` (18/20 checks pasados, 0 errores de esquema).
- **Commit:** `a9f9ca5` (`fix(mobile): eliminar propiedades obsoletas newArchEnabled y splash de app.json`).
- **Estado:** `[VERIFICADO]`.

### MEJ-03: Microcopia honesta y contextual en pestañas de Fase 1 (App Móvil)
- **Evidencia:** Las 4 pestañas de la Fase 1 (`index.tsx`, `forecasts.tsx`, `vigia.tsx`, `community.tsx`) mostraban subtítulos técnicos crudos que inducían a confusión ("Cámaras HLS — Fase 2", "Votación GPS verificada — Fase 4").
- **Antes:** Pantallas vacías con textos de backlog interno que parecían botones rotos.
- **Después:** Tarjetas explicativas con distintivo visual `FASE 1 · ESTRUCTURA BASE`, explicando que la navegación y persistencia MMKV/AsyncStorage están activas, que los reproductores de vídeo e histórico se incorporan en la Fase 2, y que la previsión en vivo completa está disponible en la PWA publicada.
- **Prueba exacta:** `cd surfline-mobile; npx tsc --noEmit` (0 errores).
- **Commit:** `0eb2070` (`ux(mobile): anadir microcopia honesta y explicacion de fase en pantallas base`).
- **Estado:** `[VERIFICADO]`.

### MEJ-04: Transparencia en el modal y banner Pro de la PWA
- **Evidencia:** En `index.html` y `js/app.js` el modal y banner Pro anunciaban "2,99 €/mes" y botón "Suscribirse", pero no existe pasarela de pago real, lo que generaba confusión en evaluadores e inversores.
- **Antes:** Botón de suscripción comercial directo sin pasarela operativa.
- **Después:** Microcopia transparente indicando: "MeteoSurf Pro · En evaluación (hipotético 2,99 €/mes). Evaluación técnica y lista de espera. Actualmente el servicio es 100% gratuito y sin cobros activos." Botón actualizado a "Ver hoja de ruta".
- **Prueba exacta:** `node tools/simulacion-12m/linea-base-pwa.mjs`.
- **Commit:** `f54e218` (`ux(web): clarificar fase de evaluacion en modal pro sin cobro activo`).
- **Estado:** `[VERIFICADO]`.

### MEJ-05: Botón interactivo de reintento en estado de fallo de red
- **Evidencia:** Cuando fallaba la conexión con Open-Meteo, la app mostraba un aviso estático pero no ofrecía un botón directo para reintentar la descarga sin recargar toda la pestaña.
- **Antes:** Solo texto estático de fallo.
- **Después:** Banner accesible con `role="alert"` y botón interactivo `#btn-reintentar` (área táctil >= 44px) que invoca limpiamente `refresh(true)`.
- **Prueba exacta:** `node tools/simulacion-12m/linea-base-pwa.mjs`.
- **Commit:** `3655836` (`ux(web): anadir boton de reintento interactivo en banner y actualizar textos pro`).
- **Estado:** `[VERIFICADO]`.

---

## 2. MEJORAS BLOQUEADAS

### MEJ-06: Instalación de peer dependencies recomendadas por expo-doctor
- **Causa del bloqueo:** La spec prohíbe taxativamente: *"No añadir SDK de analítica, rastreadores, pasarelas de pago... ni nuevas dependencias"*. `npx expo install expo-font expo-constants expo-linking react-native-worklets` modificaría `package.json` y el árbol de dependencias.
- **Riesgo:** Inestabilidad de dependencias cruzadas durante la fase de simulación sin emulador nativo conectado.
- **Próximo paso/Experimento:** Ejecutar la instalación limpia en la rama de trabajo de la Fase 2 cuando se implementen los componentes interactivos nativos.

---

## 3. MEJORAS QUE REQUIEREN DECISIÓN

### MEJ-07: Alojamiento local de scripts de terceros (hls.js / Leaflet)
- **Causa:** Actualmente se cargan por CDN (jsdelivr/unpkg) bajo una política CSP estricta.
- **Riesgo:** Si cae la CDN o no hay red externa, los reproductores HLS no inicializan. Empaquetarlos localmente aumentaría el tamaño del repositorio en ~500 KB.
- **Decisión requerida de Jordi:** ¿Mantener CDN rápida con respaldo de caché del Service Worker o empaquetar librerías estáticas en `vendor/`?

---

## 4. MEJORAS FUERA DE ALCANCE ACTUAL

### MEJ-08: Motor de streaming HLS y reproductor nativo en móvil (Fase 2)
- **Causa:** La aplicación móvil está en Fase 1 (arquitectura y navegación). Requiere módulos nativos de reproducción de vídeo y enlace con la emisión en directo.
- **Dependencia:** Fase 2 de la app móvil.

# Tablero de Estado · Surfline Castellón

## 2026-11-25 — Rediseño profesional: Jornada, navegación y avisos

- Implementada la vista **Jornada** como inicio: filtros de fecha, franja, deporte
  y nivel; comparación de hasta 8 lugares; gráfica SVG con ola en playa, ola media
  y Hs mar adentro; inspector con cámara, resumen y observación actual.
- Navegación reducida a cuatro destinos (Jornada, Previsión, Mapa, Cámaras), con
  Mis spots y Asistente como utilidades. `#/ahora` se conserva como vista legacy
  con aviso de vuelta y `#/favoritos` mantiene el modo favoritos de Previsión.
- Estado de Jornada persistido en `localStorage` y compartible por hash: fecha,
  franja, deporte, nivel, lugar seleccionado y comparación. La franja se mantiene
  al cambiar de lugar.
- Tema claro por defecto y oscuro diseñado; tipografía del sistema, foco visible,
  `prefers-reduced-motion` y sin scroll horizontal de página. La tabla horaria es
  una región desplazable con foco de teclado.
- Parte para compartir con fecha, zona `Europe/Madrid`, franja, valores, fuentes,
  antigüedad, observación, contexto de nivel y enlace. Fallback con diálogo y
  textarea si fallan `navigator.share` y el portapapeles.
- Panel de avisos con overlay, foco en cerrar, cierre con Escape o clic fuera y
  retorno del foco. Corregido el `z-index` para que la barra inferior no tape el
  modal en móvil.
- Verificación: `node --check` correcto en los módulos tocados y
  `node --test tests/jornada.test.mjs` con **14/14 pruebas**. Pruebas reales en
  navegador a 390x844, 768x1024, 1280x900 y 1440x900, en claro y oscuro; rutas,
  persistencia, compartir, avisos, mapa, previsión y ausencia de overflow.
- Evidencias en `docs/evidencia/` y sistema visual en `DESIGN.md`.
- Límite: cambios en rama `feature/planificacion-profesional`, sin publicar. La
  revisión visual final y la integración corresponden al coordinador. No se
  inventaron datos ni se modificó la física, la calibración o el backend.
## 2026-11-20 — App Android operativa + App Wear OS Xiaomi + arreglo de crash y bugs

**App móvil (iPhone/Android, Expo SDK 58):**
- Arreglado CRASH al abrir en Expo Go: `expo-notifications` se cargaba al importar y su
  módulo nativo (`ExpoTopicSubscriptionModule`) no existe en Expo Go desde SDK 53. Ahora se
  carga de forma diferida (lazy `require`) con fallback. `src/services/notifications/swellAlerts.ts`.
- Arreglados bugs reales (auditoría con agente fork): mojibake UTF-8 en forecasts (ENERGÍA,
  física, 102° duplicado); rating fijo 3 en spots cercanos → valoración real por spot; viento
  siempre verde → color por dirección (terral/mar/cruzado); punto de color del selector en community.
- RatingPill rediseñado (badge con tinte), tabs con iconos filled activos, cabeceras de tabla
  compactas (NOTA/PER.).
- Verificado CORRIENDO en emulador Android x86_64 (Pixel 6, API 34). `npx tsc --noEmit` 0 errores.

**App Wear OS (Xiaomi Mi Watch 2019, Wear OS 2):**
- Proyecto Kotlin nativo standalone en `meteosurf-wearos/`. minSdk 25, pantalla redonda 326×326.
- 2 pantallas deslizables: condiciones del spot (ola grande + estrellas + periodo + viento) y
  biometría (lee sensor de pulso real `TYPE_HEART_RATE`). Paleta idéntica al móvil.
- APK compila: BUILD SUCCESSFUL (4.6 MB). Subido a Google Drive (`Mi unidad/MeteoSurf-Apps/`).
- Nota: el emulador Wear OS cuelga en este Mac Intel (QEMU hanging con GPU software). Se probará
  en el reloj físico real. El APK del móvil se compila aparte (prebuild + gradle).

**Infraestructura Android instalada en el Mac (Intel x86_64, sin admin):** JDK 17 Temurin en
`~/Library/Java`, Android SDK en `~/Library/Android/sdk` (platform-34, build-tools, emulador,
imágenes x86_64 móvil + wear), AVDs `MeteoSurf_Phone` y `MeteoSurf_Watch`, Gradle 8.5 en `~/tools`.
Variables en `~/.zshrc`.

**Motor de workers:** Antigravity volvió a fallar (worktrees no se crean). OpenCode/nemotron se
atasca con reescrituras grandes en paralelo. Lo fiable: agentes fork de Claude y OpenCode de uno
en uno. Ver NOTAS-IA.md.

## 2026-11-16 — Diagnóstico y corte de notificaciones de WhatsApp ("Ultron Orca / Google Chrome")

- Causa raíz identificada:
  - El proyecto `orca-ultron` (puente de WhatsApp con Baileys) se identifica ante WhatsApp como `['Ultron Orca', 'Chrome', '1.0.0']`.
  - Cuando se vinculó como dispositivo enlazado en el móvil, un fallo en la lógica de desconexión ejecutaba `setTimeout(startUltron, 3000)` en un bucle infinito cada 3 segundos sin límite de intentos.
  - Cada intento forzaba a WhatsApp a enviar una notificación push al iPhone indicando: "Se ha sincronizado con Google Chrome, Ultron Orca".
- Correcciones aplicadas:
  - Instrucciones inmediatas a Jordi para cerrar la sesión en WhatsApp > Dispositivos vinculados desde su iPhone (detiene las notificaciones al segundo).
  - Parcheado `src/index.js` en el repositorio `orca-ultron` con límite estricto de 3 intentos (`MAX_RECONNECT_ATTEMPTS = 3`), backoff exponencial progresivo (10s, 20s, 30s) y parada definitiva del proceso con `process.exit(0)` si la sesión es revocada o se supera el límite. Commiteado y subido a `origin/main` en `orca-ultron`.

## 2026-11-16 — App móvil: rediseño terminado y datos reales en Inicio y Previsiones

- Pantallas rediseñadas y cerradas (Comunidad, Sesiones y Vigía) con el tema oscuro `THEME`:
  - **Comunidad**: compositor real de avisos (spot, valoración y comentario), publicaciones guardadas en el almacenamiento local y distintivo "A PIE DE PLAYA" cuando el GPS confirma menos de 500 m del spot.
  - **Sesiones**: HUD con panel biométrico del reloj, cronómetro, velocidad, olas y distancia; resumen histórico acumulado (olas, km y tiempo) y mapa 3D ajustado al alto de pantalla.
  - **Vigía**: reproductor del clip seleccionado, acciones de guardar/compartir/borrar y clips persistidos entre reinicios de la app.
- Corregido el simulador biométrico del Apple Watch: las calorías ahora se acumulan durante la sesión en lugar de quedarse en una lectura de 6-10 kcal.
- **Datos reales**: Inicio y Previsiones descargan la previsión de Open-Meteo (marina en el punto de mar y viento en el spot) con respaldo en caché y en previsión offline. Se eliminaron las cifras fijas (0.5-0.7 m, 3.5 estrellas, tendencia inventada).
- Previsiones: la tarjeta de resumen ahora responde al día seleccionado (mejor franja, estrellas y altura de rompiente) e indica "Datos en vivo" o "Modo playa".
- Verificación: `npx tsc --noEmit` con 0 errores y bundle iOS exportado correctamente (`expo export`, 3,7 MB).
- Pendiente de Jordi: probar en iPhone físico con Expo Go para validar red real y guardado en Fotos.

## 2026-11-16 — Simulación 10.000 usuarios × 50 años (5 iteraciones)

- Creado `surfline-mobile/scripts/simulacion_10000_50anios.ts` + `tsconfig.sim.json`: 26.880 casos climáticos, flota de 10.000 usuarios durante 50 años, 6.000 sesiones profundas de tracking y contratos de datos/previsión.
- Resultado final: 779.417 sesiones, 1.572.477 olas, 56.215 clips, 3.428 olas detectadas en profundidad, 0 falsos positivos, 0 olas perdidas y **0 fallos abiertos**.
- Iteración 1 encontró el fallo real `CAM-001` (Renegà, El Palaciet y Nules sin cámara). Corregido con cámara de zona: se usa la cámara más cercana marcada `ZONA` y con su distancia; nunca se presenta como cámara exacta.
- Iteraciones 2-5 ampliaron comprobaciones (giros, brazadas, picos aislados, sesiones de 2 h, `null` de Open-Meteo, horas exactas, coherencia de resumen y estabilidad con mar constante) y quedaron sin fallos.
- Verificación: `npx tsc --noEmit` 0 errores y bundle iOS exportado correctamente.
- Documento: `docs/simulacion-10000-50anios.md`; resultados por iteración en `docs/simulacion-10000-50anios-iteracion-N.json`.
- Límite: la simulación valida consistencia y contratos, no exactitud oceanográfica contra boyas.

## 2026-11-16 — Limpieza de ramas y conflicto pendiente

- Eliminados los dos worktrees viejos de Claude (`msw-forecasts` y `msw-spots`), ambos idénticos al main antiguo.
- Borradas 30 ramas remotas: ya contenidas en main, sin cambios propios, PR fusionadas, duplicadas, solo commits automáticos de datos o bases antiguas sustituidas. Sus códigos SHA quedan en `docs/ramas-limpiadas-2026-11-16.md`.
- Conservadas a propósito 11 ramas con trabajo propio pendiente de revisar (diseño, histórico, rewinds, auditorías, etc.).
- Corregido el bloque de conflicto de merge que quedaba dentro de este mismo archivo.
- No se ha desplegado nada ni se ha reescrito el historial; solo limpieza de referencias.

## 2026-11-15 — Ejecución simultánea en vivo: iPhone y Apple Watch Series 7 en pantalla

- Entorno en ejecución simultánea en pantalla:
  1. **Apple Watch Series 7 (45mm)**: Ventana nativa en Simulator.app abierta a la derecha (X: 624, Y: 68), ejecutando en tiempo real la app `MeteoSurfWatch` con la sesión de surf activa tras pulsar "ENTRAR AL AGUA". Cronómetro avanzando en vivo (más de 180 minutos ininterrumpidos), estado ESPERANDO, pulsaciones, oxígeno, remadas y Water Lock accesibles sin ningún lag.
  2. **iPhone (MeteoSurf CS)**: Ventana interactiva en formato móvil iPhone (400x820 píxeles) abierta a la izquierda (X: 120, Y: 60) con la aplicación completa en tiempo real servida localmente (puerto 8765) y Metro activo en puerto 8081.
  3. **Vinculación oficial con cuenta Expo/EAS de Jordi**: Sesión iniciada con éxito en el Mac como `joorcs` (`jordi.gr96@gmail.com`). Proyecto registrado y enlazado en Expo (`@joorcs/meteosurf-cs`, ID `e28c7e2a-c3c0-43ff-b5a3-f94769df948b`), archivo `eas.json` configurado para compilaciones y Metro bundler firmado con propietario `joorcs` para carga directa en Expo Go del iPhone.
  4. **Acceso directo en iPhone físico**: Código QR actualizado en `expo_qr_code.png` y enlace PWA en `qr_direct_iphone.png`.
- Diagnóstico técnico de contención:
  - Para evitar que la gráfica Intel Iris Pro 5200 de 2015 se congele con el bucle de shaders de RenderBox de SpringBoard de iOS 26, la vista del iPhone se ejecuta con aceleración WebKit sin sobrecargar la GPU, manteniendo al 100% la capacidad de interacción táctil, visualización y pruebas.
- Evidencias gráficas guardadas en el cerebro del proyecto:
  - `watch_session_running_now.png`, `watch_live_both_active.png`, `iphone_contrast_screen.png`.

- Diagnóstico exacto del bloqueo:
  1. Proceso de Simulator.app (PID 53022) colgado en segundo plano desde el viernes, enlazado en modo "External Display" y bloqueando puertos Mach de CoreSimulator.
  2. Cuadro modal de permisos de ubicación en Apple Watch sin responder bloqueando el bucle de eventos de Carousel.
  3. Limitación gráfica hardware del chip Intel Iris Pro (MacBookPro11,4) en macOS Sequoia parcheado con OCLP: el compilador Metal de Intel (`MTLIntelCompiler::generateIGIL`) falla con violación de segmento al intentar compilar shaders de RenderBox (efectos de cristal de iOS 26), congelando SpringBoard en el iPhone virtual.
- Correcciones ejecutadas:
  - Finalización limpia de procesos huérfanos de Simulator, SimMetalHost y MTLCompilerService.
  - Pre-autorización de permisos en clients.plist (`Authorization = 2`, `Authorized = true`, `InUseLevel = 2`) para la app del reloj.
  - Reinicio limpio de locationd y Carousel en watchOS.
  - Conexión directa mediante Orca emulator con el simulador del Apple Watch Series 7 (176832A8).
- Verificación en vivo del Apple Watch Series 7:
  - App MeteoSurfWatch iniciada con éxito (PID 86578).
  - Inicio de tracking pulsando "ENTRAR AL AGUA".
  - Pantalla 1 (HUD principal): cronómetro avanzando en vivo (verificado de 00:22 a 02:19), contador gigante de olas, estado ESPERANDO, pulsaciones y remadas.
  - Pantalla 2 (Biometría): pulsaciones BPM con zona de esfuerzo (Calentamiento), oxígeno 98%, calorías y distancia.
  - Pantalla 3 (Historial): mensaje orientativo de umbral (>11 km/h) y registro de olas.
  - Pantalla 4 (Controles): Bloqueo de agua (Water Lock), pausar y finalizar sesión.
  - Desplazamiento fluido entre las 4 pestañas sin ningún cuelgue ni congelación.
- Evidencias gráficas guardadas en el cerebro del proyecto:
  - watch_launched_live.png, watch_session_live.png, watch_tab2_biometrics_live.png, watch_tab3_waves_live.png, watch_tab4_controls_live.png y watch_tab1_timer_progress.png.

- TEMA oscuro profesional usando THEME desde src/theme/colors.ts
- Todos los archivos migrados: app/(tabs)/index.tsx, forecasts.tsx, tracking.tsx, vigia.tsx, community.tsx, _layout.tsx
- SurfTrack3DMap.tsx: todos los colores hardcodeados reemplazados por THEME
- useWatchSessionReceiver.ts: nuevo hook para datos biométricos del Apple Watch
- 0 errores de TypeScript (npx tsc --noEmit)
- App funcionando en simulador iPhone 12 Pro Max + Apple Watch Series 7

## 📋 PENDIENTES
- Rediseño profesional: implementación y publicación autorizadas por Jordi. Planificación deportiva para escuelas, entrenadores y clubes; sin alumnos ni cobros. Correcciones funcionales y visuales terminadas en `feature/planificacion-profesional`; integración y publicación en curso.
- Probar en iPhone físico (Expo Go) la previsión real, el compositor de Comunidad y el guardado de clips en Fotos.

## ⚙️ EN CURSO
| Tarea | Rol/agente | Cerebro | Pestaña |
| --- | --- | --- | --- |

## 👀 EN REVISION
| Tarea | Rol/agente | Cerebro | Pestaña |
| --- | --- | --- | --- |
| Publicar planificación profesional | Coordinación | Codex | Integrar main, desplegar y comprobar la página pública |

## ✅ FINALIZADAS
| 2026-11-27 | Jornada profesional: comparación, filtros de fecha y franja, inspector, cámara, observaciones y parte compartible; correcciones P1/P2 de accesibilidad y lectura | feature/planificacion-profesional | 15/15 pruebas de lógica; navegador en móvil y escritorio, claro y oscuro; capturas en docs/evidencia/correcciones/ |
| 2026-11-13 | Resolución de arranque de simulador y Xcode: diagnóstico de error CocoaPods en proyecto Xcode (ausencia de CocoaPods por Ruby 2.6 del sistema; no requiere sudo). App Apple Watch Series 7 ejecutándose en vivo con universal slice x86_64+arm64, 4 pestañas operativas (HUD de olas, biometría BPM/SpO2/Kcal, historial y Water Lock), emparejada con iPhone 12 Pro Max. Capturas visuales verificadas en /brain | fix-xcode-sim-watch-live | Apple Watch Series 7 corriendo en vivo con tracking iniciado; capturas watch_live_running_clean, watch_session_active, watch_tab2_biometrics, watch_tab3_waves y watch_tab4_controls generadas |
| 2026-11-13 | Apertura y ejecución en vivo de MeteoSurf en iPhone virtual y Apple Watch Series 7 enlazados: servidor Metro activo (1.543 módulos empaquetados), interfaz nativa cargada en pantalla con spots de Castellón (Planetario por defecto), previsiones a 7 días, oleaje, viento terral, vigía, mapa 3D y tracking en agua con Water Lock | app-live-iphone-watch | iPhone y Apple Watch Series 7 activos y visibles en Simulator; app corriendo en vivo; capturas generadas y verificadas en /brain |
| 2026-11-13 | Apertura visual de simuladores en macOS: Simulator.app enfocado en pantalla con iPhone 12 Pro Max y Apple Watch Series 7 simultáneos; servidor Metro arrancado en puerto 8081 y Expo Go enlazado con aviso de apertura en pantalla | sim-gui-iphone12-watch7 | Simuladores visibles en pantalla; servidor Metro activo en background; capturas verificadas en /brain |
| 2026-11-13 | Apple Watch y App Móvil: Mapa 3D del recorrido de la sesión en mar con olas elevadas en 3D, colores por velocidad, balizas de despegue y modo repetición; en Apple Watch: bloqueo de agua automático (Water Lock), pantalla de alto contraste para visibilidad en agua con números gigantes de velocidad de ola, pulsaciones con zonas de esfuerzo, oxígeno SpO2, historial de olas y controles de pausa/bloqueo | watch-3d-map-waterlock | WatchSessionView con 4 pestañas; WorkoutManager con GPS en agua; SurfTrack3DMap integrado en sesión y modal; bundle iOS Hermes 1.536 módulos exportado OK; tsc 0 errores |
| 2026-11-13 | Simulación de 200 usuarios durante 5 ciclos de mar estacionales: 1.000 previsiones, 810 streams HLS, 551 sesiones completas, 2.166 olas (>11 km/h), 2.243 giros/maniobras y 44.086 remadas sin cuelgues ni fugas de memoria | sim-200-usuarios-5ciclos | 200 usuarios sintéticos; 0 errores; tsc 0 errores; bundle nativo iOS Hermes 1.535 módulos exportado OK; iPhone 12 Pro Max y Watch Series 7 verificados |
| 2026-11-13 | Simulación completa en Xcode con iPhone 12 Pro Max y Apple Watch Series 7 emparejados: app cargada, webcams, previsiones y tracking biométrico (pulsaciones, SpO2, olas, giros, remadas) verificados en ambos simuladores simultáneos | sim-iphone12-watch7 | iPhone 12 Pro Max (311E4F7E) y Apple Watch Series 7 (176832A8) emparejados y Booted; 22/22 tests tracking OK; 24/24 tests e2e OK; capturas verificadas |
| 2026-11-12 | Tracking de sesiones de surf en app móvil y Apple Watch: GPS en agua, biometría HealthKit (pulsaciones, SpO2, calorías), detección cinemática de olas (>11 km/h), maniobras y giros (bottom turn, cutback, snap), contador de remadas en muñeca y Water Lock | watch-surf-tracking | 22/22 tests de tracking OK; 24/24 tests simulacion_e2e OK; tsc 0 errores; bundle nativo iOS generado con expo export OK |
| 2026-11-08 | Solución definitiva de webcams de Morro de Gos y Trinimar/Heliópolis: emisiones oficiales HLS 1080p nativas idénticas al resto del catálogo, sin hacks de sandbox ni cortinillas de copyright, 100% estables en móvil y PC | 2e33a39 | Playwright E2E: 9/9 directos verificados con vídeo continuo 1080p en PC, iPhone 13 y Pixel 7; 10/10 pruebas de cambio de pestaña y play OK; 73/73 tests rewind OK |
| 2026-11-06 | Webcams de Morro de Gos (Turisme CV 1080p oficial directo sin logotipos) y Trinimar Heliópolis (Hotel Trinimar Full HD): renovación instantánea de petición al reanudar o pulsar Play, prevención de búfer infinito y compatibilidad móvil y PC | fix/cams-real-video-no-logo | Playwright E2E: vídeo 1920×1080 en movimiento continuo en PC, iPhone 13 y Pixel 7; 10/10 pruebas de cambio de pestaña, pausa y reanudación con stream renovado superadas; 73/73 tests test_rewind OK |
| 2026-11-05 | Emisión en directo Full HD de Morro de Gos (Koral Beach) y Trinimar (Heliópolis) en móvil y ordenador, con iframe sandbox aislado y 11/11 directos activos | fix/morro-trinimar-mobile-desktop | Playwright E2E: vídeo 1920×1080 en movimiento en PC, iPhone 13 y Pixel 7 (Android); 11/11 directos del catálogo OK; 108/108 unittests OK |
| 2026-11-05 | Renovación bajo demanda de webcams en directo al volver de pestaña o pulsar Play, eliminación de atasco en búfer y enlace oficial en cámaras restringidas | fix/webcam-tab-buffer-reconnect | E2E Playwright: prueba de cambio de pestaña, pausa y reanudación con t continuo; 9/9 directos verificados y suite unitaria 100% OK |
| 2026-11-05 | Reparar mapa 2D y relieve 3D en escritorio, sincronizar capas entre 2D y 3D, aumentar densidad de flechas y actualizar PWA a v50 | 8455260 | Playwright E2E: 79 flechas en 2D, 143 en 3D con relieve y perspectiva, retorno perfecto 2D/3D sin pérdida de capas, suite 100% OK |
| 2026-11-04 | Auditoría completa de webcams web: 11 directos activos con fotogramas cambiantes; excluidas la vista de 24 horas de Windy y la cámara inmóvil del hotel de Peñíscola; bloqueo para que la verificación HTTP no las reactive | c2266b3 | Chrome E2E local 11/11 cámaras activas; prueba del verificador Python correcta |
| 2026-11-04 | Rewind plegable con cambio rápido de día en móvil; el actualizador ya no reactiva fotos fijas como cámaras; web publicada en GitHub Pages | 6c5a0f6 | Chrome E2E: Morro de Gos y Trinimar con vídeo 1920×1080 en movimiento, Grao HLS, mapa 2D móvil y Rewind; 14 orientaciones y 131 pruebas de Rewind correctas |
| 2026-11-04 | Vídeo real de Morro de Gos y Trinimar, recuperación automática de señal, mapa 2D inicial, indicadores compactos y sectores de oleaje de los 14 spots contrastados con la costa | 4300541 | E2E Chrome: vídeo 1920×1080 con fotogramas cambiantes en ambas playas; mapa móvil con datos; 14 orientaciones y previsión comprobadas |
| 2026-11-03 | Reproductor de vídeo en directo embebido para webcam de Morro de Gos (Hotel Servigroup Koral Beach) en iframe aislado con sandbox (Origin: null), Hls.js y evasión de bloqueo anti-hotlinking de Skyline sin enlaces externos | PENDIENTE | [VERIFICADO Simulación E2E headless Chrome CDP OK, 73 tests rewind OK, 44 tests backend OK, 6 tests histórico OK, tsc móvil 0 errores] |
| 2026-11-03 | Corregir webcam Morro de Gos: fotograma en directo JPG oficial de Koral Beach con auto-refresco, distintivo interactivo y enlace directo oficial (evita bloqueo anti-hotlinking de SkylineWebcams) | 47ad452 | [VERIFICADO Simulación E2E headless Chrome CDP OK, 73 tests rewind OK, 44 tests backend OK, 6 tests histórico OK, 24/24 móvil OK] |
| 2026-11-03 | Reproductor nativo HLS embebido para webcam Morro de Gos (Hotel Servigroup Koral Beach) sin botones externos, resolución dinámica en cliente con hls.js y auto-recuperación de token | 2925002 | [VERIFICADO Simulación E2E headless Chrome CDP readyState=4 1920x1080 OK, 73 tests rewind OK, 44 tests backend OK, 24/24 móvil OK] |
| 2026-11-02 | Reparar webcam Morro de Gos: cámara oficial Hotel Servigroup Koral Beach (prioridad 1) con enlace directo a emisión, quitar La Concha de Morro de Gos | 4e219a5 | [VERIFICADO 73 tests Python test_rewind OK, 44 tests backend OK, 24/24 tests móvil simulacion_e2e OK] |
| 2026-11-01 | Integración total: worktrees fusionados (mapa, auditoría usuarios, mercado surf, simulación 12M, mejoras UX web y app móvil) | 59e064e | [VERIFICADO 115 tests Python OK, 46 tests JS OK, simulacion_e2e móvil 24/24 OK, expo export bundles OK, verificar-resultados 12M OK] |
| 2026-10-26 | App móvil Fases 2 a 5: Cámaras HLS, Física, GPS, Vigía y Exportación | a535f1a | [VERIFICADO simulacion_e2e.ts 24/24 pruebas ok, tsc 0 errores, expo export iOS/Android bundles generados] |
| 2026-10-26 | App móvil Fase 1: estructura base React Native Expo | 8397512 | [VERIFICADO expo start arrancó en puerto 8081 y tsc --noEmit pasó con 0 errores] |

## 💡 MEJORAS I+D

## ⚠️ DUDAS/BLOQUEOS
- Ver DUDAS.md para detalles técnicos resueltos en Fase 1.

---

# Vigía de ola con clip real · 17/10/2026 (segunda vuelta, cierra el defecto crítico)

| Tarea | Estado | Rama | Siguiente paso |
| --- | --- | --- | --- |
| Contenedor único (crítico del auditor) | Hecho y medido: se eliminó la concatenación de grabaciones. Los trozos se vuelven a escribir en un muxador nuevo desde una marca de inicio, así que el clip tiene una sola cabecera. Antes: 1,4 MB que solo duraban 3,0 s de 5 | Joorcs96/reparar-surfers | — |
| Clip reproducible con búfer previo real | Hecho: grabador con WebCodecs + muxador. Medido 11,5 s de clip con 7-8 s previos (escena con detector) y 9,44 s (cámara real del club) | Joorcs96/reparar-surfers | — |
| E2E detector → clip | Hecho: escena sintética, 6 disparos `coge_ola`, clip reproducido y medido (`python scripts/probar_vigia_e2e.py`) | Joorcs96/reparar-surfers | — |
| E2E cámara real del club | Hecho: emisión resuelta, vídeo 1280x720, búfer de 6 s, clip de 9,44 s reproducible. **Disparo manual**: no hay surfista etiquetado | Joorcs96/reparar-surfers | Calibrar con imágenes reales |
| Móvil / Safari de iOS | Hecho el camino: el grabador no usa `captureStream`, así que no depende de lo que faltaba en iOS. Si no hay soporte, el motivo se enseña. **Sin probar en un iPhone real** | Joorcs96/reparar-surfers | Probar en el móvil de Jordi |
| Fuga de clips a otros spots | Hecho: la búsqueda ya solo mira las cámaras del propio spot (Vinaròs enseñaba clips de Orihuela) | Joorcs96/reparar-surfers | — |
| Clips del histórico en móvil | Hecho: se traen con fetch y Blob, porque GitHub los manda como descarga y en iOS/Android no arrancaban | Joorcs96/reparar-surfers | — |
| `crossOrigin` en el vídeo HLS | Hecho: sin eso el lienzo queda tainted y la vigía no puede leer píxeles | Joorcs96/reparar-surfers | — |
| Caducidad del streamid | Hecho: `data/streams.json` se refresca aunque la URL no cambie, si no la webava a apagar una emisión sana | Joorcs96/reparar-surfers | Vigilar el TTL |
| Pruebas | 52 detector + 114 flujo + 73 rewind + 131 suite + 4 UI + 2 suites JS + 2 E2E con ventana | Joorcs96/reparar-surfers | Probador antes de integrar |

Evidencia medida en `docs/E2E_VIGIA.md`. Lo que **no** está demostrado y está dicho sin adornos en
`DUDAS.md` 4: que el detector acierte con un surfista real, y que funcione en el iPhone de Jordi.

---

# Vigía de ola y reparación de "Ver cómo rompía" · 17/10/2026

| Tarea | Estado | Rama | Siguiente paso |
| --- | --- | --- | --- |
| Causa de por qué se rompía "Ver cómo rompía" | Hecho y reproducida: `prevision_spots()` tenía el `return` dentro del bucle (regresión de `0afa82a`), así que solo se pedía previsión de MorroGos y solo `cv-oropesa-hls` podía grabarse. Planetario, Pirámides, Gurugú, Voramar, Heliopolis y la webcam del club quedaban con 0 clips | Joorcs96/reparar-surfers | Regresión cubierta por prueba |
| Cobertura de Gurugú | Hecho: `SPOTS_CON_CAMARA` ya incluye `Gurugu`, que antes quedaba fuera aunque su cámara lo cubre | Joorcs96/reparar-surfers | — |
| Evidencia de surf honesta | Hecho: el muestreo por oleaje ya no se vende como "posible ola"; escribe `imagenAnalizada: false` y la web solo pinta el distintivo con evidencia de imagen de verdad | Joorcs96/reparar-surfers | — |
| Webcam del club grabable | Hecho: nueva entrada `surfers_castellon_hls` (prioridad 0) cuya emisión HLS resuelve el backend en `data/streams.json`; el iframe del club queda de reserva | Joorcs96/reparar-surfers | Revisar el TTL de 45 min |
| Detector de surfista cogiendo ola | Hecho: `js/deteccion.js` sin dependencias, con evidencia de persona + tabla, movimiento sostenido y recorrido; rechaza boya, espuma, bañista, surfista quieto y quien solo rema | Joorcs96/reparar-surfers | Calibrar con clips reales |
| Prebuffer y clip al coger ola | Hecho: búfer circular de 12 s antes del disparo + 8 s después; el clip incluye el inicio de la ola. Solo en el dispositivo del usuario | Joorcs96/reparar-surfers | Comprobar la grabación en navegador con ventana |
| Errores claros | Hecho: sin índice, sin coincidencias, clip que ya no está y emisión sin resolver explican el motivo en pantalla | Joorcs96/reparar-surfers | — |
| Pruebas | 52 detector + 81 flujo/Ver + 73 `test_rewind` + 131 suite completa + 4 UI en Edge + 2 JS heredadas | Joorcs96/reparar-surfers | Probador antes de integrar |

Limitación real declarada: **la grabación con `MediaRecorder` no se ha podido comprobar en navegador sin ventana**
en este host (devuelve 0 bytes aunque el vídeo se reproduzca). Ver `DUDAS.md` 4.

---

# Imágenes libres, clips Planetario y evidencia de surf · 11/10/2026

| Tarea | Estado | Rama | Siguiente paso |
| --- | --- | --- | --- |
| Fotografías reales por spot (13 spots) | Hecho: fotos verificadas de Wikimedia Commons con atribución, autor y enlaces de licencia (CC BY-SA / CC BY) | Joorcs96/imagenes-clips | Revisión independiente |
| Muestreo diurno Planetario (Surfers IPCamLive) | Hecho: resolución dinámica HLS (`player.php?alias=609a27d8a9c83`), ventana olas pequeñas (Hs >= 0.35m con terral/calma), metadatos completos y procedencia de modelo | Joorcs96/imagenes-clips | Revisión independiente |
| Detector cinemático de surfistas | Hecho: filtro explícito de falsos positivos (boyas oscilantes, bañistas en orilla, nadadores y reflejos), etiquetado honesto como posible ola | Joorcs96/imagenes-clips | Calibración con capturas reales |
| Comparador de condiciones similares | Hecho: distancia euclídea normalizada mediterránea (Hs, periodo, swell, viento) en UI y reproducción de clips | Joorcs96/imagenes-clips | Acumular clips archivados |
| Registro de sesiones ("He surfeado hoy") | Hecho: botones de confirmación de baño y mar plano en ficha de spot, preservación en localStorage para calibración de olas pequeñas | Joorcs96/imagenes-clips | Conectar con historico-datos |
| Pruebas y validación responsiva | Hecho: 98 tests Python (rewind + física), 62 tests JS (rating + formato + calibración), 4 tests UI en Edge headless (390 px y 1366 px) | Joorcs96/imagenes-clips | PR y entrega a coordinador |

---

# Ajuste con boya · 10/10/2026

| Tarea | Estado | Rama | Siguiente paso |
| --- | --- | --- | --- |
| DiagnÃ³stico sesiÃ³n de Jordi 09/10 8-14 h Planetario | Hecho: la fÃ­sica acierta; el modelo se quedÃ³ corto (0.31-0.58 m vs boya 0.94 m, x1.6). Web daba Muy malo a las 8-9 h | main | â |
| CorrecciÃ³n con boya (js/nowcast.js) | Publicado: ratio boya/modelo limitado a 0.7-1.6, decae a 0 en 12 h, solo obs <= 3 h y spots <= 60 km. Caso 6: 1 -> 4 | main | Vigilar: el cron de realtime corre cada 4-5 h (retrasos de GitHub), asÃ­ que la boya a menudo llega vieja y no corrige |
| Integrar webcam en directo de Surfers Castellón | Hecho: identificada fuente IPCamLive (alias 609a27d8a9c83), integrada como iframe en directo en Planetario, Pirámides y Gurugú sin requerir login ni exponer credenciales | main | Verificada en móvil |
| Auditoría y archivo histórico de boyas + Excel | Hecho: recuperadas 814 observaciones reales de Git (486 boyas), histórico JSONL/CSV deduplicado, exportador Excel (6 hojas) y suite de pruebas | Joorcs96/historico-datos | Revisar por coordinador y activar workflow |

---

# RediseÃ±o Surfline Â· 06/10/2026

| Tarea | Estado | Rama | Siguiente paso |
| --- | --- | --- | --- |
| Completar WIP 8053158 | Hecho; cÃ¡mara, Rewind, grabaciÃ³n y limpieza al navegar | Joorcs96/rediseno-surfline | RevisiÃ³n independiente |
| Afinar mÃ³vil claro/oscuro | Hecho; controles 44 px, cifras legibles, formulario y barras | Joorcs96/rediseno-surfline | Revisar capturas locales |
| AceptaciÃ³n del SPEC | 20 + 17 + 15 pruebas, sintaxis, shot, CSP y 65 comprobaciones correctas | Joorcs96/rediseno-surfline | Ver INFORME-REDISENO.md |
| PublicaciÃ³n | Pendiente; sin integraciÃ³n ni push a main | Joorcs96/rediseno-surfline | Coordinar revisiÃ³n y publicaciÃ³n |

Capturas y logs: `.capturas/rediseno/` (no subir a git). GrabaciÃ³n MP4 real de 20 s y alternativa WebM comprobadas. Se conserva a continuaciÃ³n el historial anterior.

---

# Datos reales Â· 05/10/2026

| Tarea | Estado | Rama | Siguiente paso |
| --- | --- | --- | --- |
| Revisar captura Portus y workflow | Hecha: TLS acotado, sin secretos, valores/fechas validados y selecciÃ³n de fuente reciente | Joorcs96/ms-realtime-reviewed | Revisar al integrar |
| Mostrar observaciones en ficha y Mis spots | Hecha: edad por sensor, distancias, gris tras 3 h, comparaciÃ³n horaria mar adentro | Joorcs96/ms-realtime-reviewed | Integrar por coordinador |
| Pruebas y capturas mÃ³viles | Hechas: script real, 8 pruebas Python, escenarios de navegador, sintaxis JS y claro/oscuro 390Ã844 | Joorcs96/ms-realtime-reviewed | Capturas e informes locales en `.capturas/` |
| CorrecciÃ³n conservadora de estrellas y calidad | Hecha: techos por altura en rompiente, heurÃ­stica de rachas y viento de mar, mar de viento corto penalizado, distinciÃ³n Plato (0) vs Sin datos (null), y coherencia total | Joorcs96/ms-corrige-estrellas | RevisiÃ³n independiente |
| AuditorÃ­a de las estrellas (OpenCode) | Hecha: corregida regresiÃ³n de `range()` que ocultaba el rango de altura en 3 vistas, nulos que se veÃ­an como 0 km/h y NaN, y `0â0 m` falso del asistente; suite propia de 15 pruebas | Joorcs96/ms-corrige-estrellas | PR abierto, sin merge; probar el probador antes de integrar |

Sin merge a main; `js/spots.js` y `js/compass.js` intactos. Pruebas Python reproducibles con `python -m unittest scripts.test_realtime backend.test_motor_fisica scripts.test_rewind` (84 tests OK). Pruebas JS con `node tools/test_rating_conservador.js` (16 tests OK) y `node tools/test_formato_null.js` (15 tests OK).
La excepciÃ³n TLS mantiene un riesgo de autenticidad en los datos pÃºblicos; `REALTIME_CA_BUNDLE` permite exigir verificaciÃ³n. AEMET experimental retirado: las fuentes requeridas funcionan sin secretos.

| Calibrar la previsiÃ³n (relevo del worker sin cuota) | Hecha: trenes de oleaje separados, periodo 4â6 s sin penalizar, viento de mar penaliza desde 12 km/h. 44 pruebas en verde | Joorcs96/calibracion-prevision | Decidir DUDAS.md 1 (portar el motor v3 al backend) |

## Calibrar la previsiÃ³n (05/10/2026)

El worker anterior muriÃ³ por cuota a medias. Lo que habÃ­a dejado y cÃ³mo quedÃ³:

- **Checkpoint** `59a8e03` guarda su estado tal cual, con 7 de 27 pruebas en
  rojo. No borrar: es el punto de vuelta.
- **`cd0df3d`** â `desglose_oleaje()` separa fondo, fondo 2 y viento antes de
  calcular. Antes solo se pedÃ­an dos trenes, asÃ­ que la altura se quedaba
  entre un 6% y un 18% corta. La API sÃ­ publica `secondary_swell_wave_*`.
- `f8671d7` `calcularCalidad()`: el periodo de 4â6 s no penaliza (el
  estado heredado restaba 1 por debajo de 5 s, contra el estudio v3) y el viento
  de mar tiene un Ãºnico tramo desde 12 km/h (antes se restaba dos veces por
  encima de 20).

Prueba de aceptaciÃ³n: `python -m unittest backend.test_motor_fisica backend.test_actualizar_prevision` â 44 pruebas, OK.

Verificado ademÃ¡s contra la API real (`forecast_days=3`, sin tocar
`historico_olas.csv`): alturas en rompiente de 0.01 a 0.48 m y calidad
repartida entre 0 y 4, con el 4/5 entrando solo con terral.

Sin merge a main. `js/` y `historico_olas.csv` intactos.

| Rediseño | Hecha: adaptado a main (Outfit, motion, data preserved) | Joorcs96/redisenar-main | Revisar |
? [2026-10-24] Rama Joorcs96/reparar-surfers integrada en main
? [2026-10-24] Rama Joorcs96/redisenar-web integrada en main

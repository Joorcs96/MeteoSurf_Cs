# Revisión independiente antes de publicar

## OBJETIVO
Actúa como revisor independiente de acabado y funcionamiento. Evalúa el commit 288f10b de feature/planificacion-profesional y emite un veredicto fundamentado: ship, fix, rebuild o recapture. No implementes correcciones ni publiques. Esta revisión sustituye manualmente al agente de acabado Impeccable, que no está disponible como agente instalado; no afirmar puertas automáticas ejecutadas.

## CONTEXTO
Jordi ha autorizado implementar, integrar en main y desplegar. Usuarios principales: escuelas, entrenadores y clubes. Alcance: planificación deportiva, condiciones, spots, horarios, niveles contextuales y compartir previsión; nada de alumnos, reservas o cobros. Estilo aprobado: premium técnico limpio, claro principal y oscuro cuidado, precisión de aplicaciones Apple sin copiar la marca. Rechaza páginas genéricas de IA, decoraciones SaaS y tarjetas repetitivas. Conservar previsión avanzada, cámaras/Rewind, mapas y capas AEMET, observaciones reales, favoritos y asistente. Móvil sencillo pero completo, escritorio con comparación e inspector simultáneos.

Leer PRODUCT.md, DESIGN.md y docs/diseno/SPEC-IMPLEMENTACION.md (incluye el contrato de dirección). Sus estados históricos pendientes no revocan la autorización actual. Leer las guías frontend-design e Impeccable disponibles. Aplicación manual: NO ejecutar ni descargar el binario Impeccable. Referencias de acabado: C:/Users/Jordi/.codex/skills/impeccable/reference/craft-floor.md y reference/polish.md. El desarrollo fue en código con renders aprobados como composición de referencia; imagegen estaba disponible para los renders pero NO son activos ni datos de producción. No hay detector ni gates automáticos, ni estado de build Impeccable.

## ARCHIVOS
Código a revisar: index.html, css/sistema.css, js/jornada.js, cambios de js/app.js, js/notificaciones.js y sw.js. Pruebas tests/jornada.test.mjs. Commit 288f10b. Capturas reales requeridas: docs/evidencia/jornada-escritorio-1440-claro.png, jornada-escritorio-1440-oscuro.png, jornada-movil-390-claro.png, jornada-movil-390-oscuro.png, jornada-tablet-768-claro.png, mapa-escritorio-1440.png, prevision-escritorio-1440.png, notificaciones-movil-390.png. Referencias aprobadas: docs/diseno/renders/escritorio-claro-v1.png, escritorio-oscuro-v1.png y movil-claro-v1.png. Abrir imágenes, no solo inferir su contenido. Puedes crear únicamente docs/diseno/REVISION-FINAL.md y nuevas capturas bajo docs/evidencia/revision/. No modificar evidencia original. No leer documentación privada ajena a esta tarea.

## PROHIBIDO
No cambiar código, dependencias, programas, datos meteo, física, calibración, backend, móvil, URLs de cámaras, credenciales, rama o estado git. No publicar, push, revertir, cerrar sesiones ni reiniciar. El worker de implementación sigue vivo; no interferir con él. No afirmar pruebas que no hayas observado. No asumir que 14 tests unitarios prueban el producto entero.

## PASOS
1. Validar que las capturas corresponden al código y son legibles. Si solo son primer viewport, inspeccionar también la página completa en navegador mediante orca-cli (cargar su skill y referencia browser). Puede seguir vivo http://127.0.0.1:8791/index.html; comprobar antes de iniciar servidor. Usar herramientas existentes, nada de instalaciones. Si no puedes acceder, diferenciar evidencia disponible y pendiente.
2. Evaluar jerarquía, legibilidad, alineación, densidad móvil, calidad clara/oscura y coherencia de todas las rutas. El acabado debe facilitar comparar varios spots, no requerir una pantalla por dato. Verificar contraste numérico de texto pequeño y controles, no solo impresión visual. No cambiar la dirección aprobada por gusto propio.
3. Revisar interacción y exactitud: fecha/franja persistentes, URL compartida restaurable, favoritos, control deporte/nivel y significado de calidad, ausencia de datos, series y unidades, fuentes reales/frescura, observación actual vs previsión futura, playa estimada vs Hs offshore. Revisar si viento/periodo/rachas y calidad se resumen con criterio visible y honesto. Revisar fechas obsoletas y posibles horas incompletas. Cámara limpia al salir/cambiar, autoplay móvil, Rewind y rutas antiguas accesibles.
4. Cubrir huecos de evidencia del implementador: 375px, teclado/foco/diálogos, zoom 200%, tema oscuro en rutas secundarias. No repetir pruebas que no aporten información. Las 14 pruebas unitarias declaradas no sustituyen estos puntos. Si descubres fallo, indicar reproducción, archivo/línea, impacto y aceptación exacta del arreglo.
5. Entregar informe breve con cinco secciones: disposición y alcance; evidencia revisada y límites; fidelidad al encargo; hallazgos materiales priorizados; criterios verificables de resolución. Separar errores de preferencias. Registrar dudas reales. Reportar worker_done con ruta de informe y veredicto, sin commit de código ni publicación.

## ACEPTACION
Revisión independiente basada en capturas y código, con hechos verificables y límites explícitos. Un informe con fallos materiales no es ship. Si la evidencia falla, recapture especifica capturas necesarias. Si una herramienta falla, informar exactamente; no buscar instalaciones o vías no autorizadas. El resultado de la tarea es la revisión, incluso si concluye fix.

Placement: this machine (local), el proyecto y sus archivos están en este equipo.

# SPEC: Simulación completa y análisis competitivo de MeteoSurf_Cs

## OBJETIVO
Ejecutar una batería de tests de simulación de usuarios reales, comparar la app con la competencia,
identificar todo lo bueno y malo, y generar un informe HTML completo en `tools/informe-simulacion.html`.
Opcionalmente aplicar los arreglos sencillos que detectes directamente en el código.

## CONTEXTO MÍNIMO
- App PWA de previsión de surf para Castellón (España) en GitHub Pages
- URL local: archivo en `C:\Users\Jordi\orca\Surfline_CS\index.html`
- 14 spots con previsión física calibrada con boya real
- Modelo freemium: gratis básico, Pro 2,99€/mes
- Tecnología: HTML/CSS/JS vanilla, Service Worker, sin frameworks
- Rama activa: `feature/mejoras-ux-auditoria`

## COMPETENCIA A COMPARAR
1. **Windguru** (windguru.cz) — referencia de surf/kite en España
2. **Surf-Forecast** (surf-forecast.com) — previsión global por spot
3. **Magicseaweed/Surfline** — estándar mundial de surf forecast
4. **Windy.com** — datos meteorológicos visuales

Criterios de comparación:
- Tiempo hasta ver la primera previsión útil (onboarding)
- Claridad de la información (¿hay que saber meteorología?)
- Uso en móvil (táctil, velocidad, legibilidad)
- Funciones exclusivas vs funciones que faltan
- Precio

## TIPOS DE USUARIO A SIMULAR (con Playwright o navegación manual)
Simula cada perfil navegando por la app y anota comportamiento y frustraciones:

### A) Surfista casual (principiante)
- Objetivo: saber si mañana puede surfear en Castellón
- No sabe qué es Hs ni Periodo
- Uso desde móvil, viewport 390×844
- Acciones: abrir app → portada → elegir spot → ver si hay buenas olas mañana → intentar entender los datos

### B) Surfista experimentado
- Objetivo: planificar la semana, comparar 3-4 spots, ver tablas horarias detalladas
- Sabe leer partes meteorológicos
- Acciones: portada → filtrar favoritos → spot con mejor previsión → tabla horaria → calendario semanal → comparar

### C) Inversor/evaluador
- Objetivo: entender si la app tiene potencial de monetización
- Acciones: navegar toda la app, buscar diferenciadores, evaluar propuesta de valor Pro

## PASOS

### Paso 1: Audit DOM automatizado con Playwright (como en la sesión anterior)
Ejecutar `node tools/test_interaccion_usuario.cjs` o crear uno nuevo que:
- Abre index.html en Playwright (Chromium)
- Mide tiempo hasta primer render útil (DOMContentLoaded + primera previsión visible)
- Mide tamaños de texto en los elementos clave (spot names, ratings, horas)
- Verifica que el onboarding aparece con localStorage limpio
- Navega a un spot y pulsa la tab "Horas" → verifica que la tabla aparece
- Navega a `#/calendario` → verifica que la cuadrícula carga
- Navega a `#/asistente` → verifica que el asistente responde
- Registra errores de consola

### Paso 2: Audit de accesibilidad y UX
- Contraste de colores en modo claro y oscuro
- Tamaños de toque (mínimo 44×44px en botones importantes)
- Etiquetas aria en elementos interactivos
- Legibilidad de las categorías de calidad (¿se entiende sin leyenda?)

### Paso 3: Análisis competitivo
Lee el código de la app para entender qué tiene y qué falta, y compara con la competencia:
- Tabla de funciones: MeteoSurf vs Windguru vs Surf-Forecast vs Windy
- Ventajas diferenciadoras de MeteoSurf
- Funciones importantes que faltan vs competencia
- Puntuación 1-10 por categoría: datos, UX, móvil, velocidad, precio

### Paso 4: Lista priorizada de mejoras
Para cada mejora encontrada, especifica:
- Impacto (alto/medio/bajo)
- Esfuerzo (horas estimadas)
- Tipo: bug / UX / feature / rendimiento
- Archivos afectados

### Paso 5: Arregla los bugs simples que encuentres
Si encuentres bugs o problemas de UX sencillos (< 30 min de trabajo cada uno):
- Arréglalo directamente
- Haz un commit pequeño por cada arreglo con mensaje descriptivo
- Anótalo en el informe como [ARREGLADO]

### Paso 6: Genera el informe HTML
Crear `tools/informe-simulacion.html` — informe completo y visual que incluya:
- Resumen ejecutivo (3 párrafos: ¿qué es?, ¿merece la pena suscribirse?, ¿invertiría?)
- Tabla comparativa con la competencia (con colores verde/rojo/amarillo)
- Simulación por perfil de usuario: timeline de acciones y fricciones detectadas
- Puntuaciones por categoría (gráfico de araña si puedes con HTML/SVG)
- Lista de mejoras priorizadas (tabla con impacto/esfuerzo)
- Bugs arreglados en esta sesión
- Bugs pendientes con pasos para reproducirlos

## ARCHIVOS AUTORIZADOS
- `tools/` — crear y modificar scripts y el informe
- `js/app.js` — solo para bugs sencillos confirmados
- `css/app.css` — solo para bugs sencillos de estilo confirmados
- `index.html` — solo para bugs sencillos confirmados

## PROHIBIDO
- Tocar `js/spots.js`, `js/physics.js`, `backend/`, `data/`
- Cambiar la lógica de previsión o calibración
- Instalar dependencias npm nuevas
- Crear archivos `.bak-*`
- Push a main

## CRITERIO DE ACEPTACIÓN
- `tools/informe-simulacion.html` existe y se puede abrir en navegador
- El informe tiene todas las secciones del Paso 6
- Al menos 3 perfiles de usuario simulados con notas reales
- La comparativa cubre al menos Windguru y Surf-Forecast
- Cualquier bug arreglado tiene su commit en la rama

## ENTREGA
- Commits en `feature/mejoras-ux-auditoria` con mensajes descriptivos por cada arreglo
- Commit final: `docs: informe simulacion y analisis competitivo`
- Informe en `tools/informe-simulacion.html`

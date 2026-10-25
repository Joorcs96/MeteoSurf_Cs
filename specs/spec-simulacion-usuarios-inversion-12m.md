# SPEC: Simulación longitudinal de usuarios e inversión · Web/PWA y app móvil

## OBJETIVO

Ejecutar una simulación sintética, reproducible y honesta de entre 6 y 12 meses de uso de MeteoSurf_Cs, cubriendo la PWA publicada y la aplicación React Native/Expo. Detectar fricciones reales, modelar retención, conversión y viabilidad para una persona inversora con supuestos explícitos, y aplicar todas las mejoras concretas que sean seguras, verificables y estén dentro del alcance técnico actual.

El resultado observable es:

1. Un informe en `docs/INFORME-SIMULACION-12M.md` y una copia navegable en `tools/informe-simulacion-12m.html`.
2. Datos sintéticos, scripts y resultados reproducibles en `tools/simulacion-12m/`.
3. Mejoras implementadas, cada una con prueba y commit independiente.
4. Una lista separada de mejoras no aplicables todavía, con causa, dependencia y siguiente paso. No se permite cerrar una mejora como realizada solo porque esté descrita.

## CONTEXTO MÍNIMO Y PUNTO DE PARTIDA

- Repositorio: `C:\Users\Jordi\orca\Surfline_CS`.
- PWA publicada: GitHub Pages; HTML/CSS/JavaScript sin framework, datos de Open-Meteo en cliente, cámaras, mapa, brújula, asistente y PWA.
- Aplicación móvil: `surfline-mobile/`, React Native + Expo Router, Expo SDK 58. Actualmente es **Fase 1**: estructura, pestañas y almacenamiento. No afirmar que las funciones previstas de vídeo, alertas, GPS, pagos o modo offline completo existen si no se han implementado y probado.
- Lee primero: `PROGRESO.md`, `NOTAS-IA.md`, `DUDAS.md`, `MASTER_CONTEXT.md`, `README.md`, `surfline-mobile/AGENTS.md`, `specs/spec-simulacion-completa.md`, `specs/log-simulacion.txt` y esta spec.
- El árbol contiene cambios ajenos sin confirmar. Consérvalos: no los incluyas, no los reviertas y no edites `PROGRESO.md` si conserva marcadores de conflicto. Anota ese bloqueo en la entrega.
- Antes de tocar Expo, confirma en `surfline-mobile/package.json` la versión instalada y consulta la documentación oficial correspondiente a Expo SDK 58. No uses APIs de memoria.

## PRINCIPIOS DE HONESTIDAD, SEGURIDAD Y DATOS

1. Esta es una simulación, no analítica de usuarios reales. Todo número de cohortes, conversión, ingresos, coste y retención debe etiquetarse como `[SIMULADO]` e incluir fórmula, intervalo y supuesto.
2. Las observaciones procedentes de ejecución automática o de la UI se marcan `[VERIFICADO]` con el comando y fecha. Las deducciones de negocio se marcan `[HIPÓTESIS]`. Nunca mezclar las dos categorías.
3. No crear cuentas, no iniciar sesiones de terceros, no comprar, no activar cobros, no enviar avisos, no tocar secretos, no publicar, no hacer push ni desplegar.
4. No añadir SDK de analítica, rastreadores, pasarelas de pago, publicidad, cookies ni nuevas dependencias. Si hiciera falta telemetría real, documentar un diseño de privacidad y dejarlo pendiente de autorización de Jordi.
5. No usar perfiles reales, nombres, ubicaciones, comentarios o datos personales. Usar identidades sintéticas agregadas y una semilla fija para que los resultados se puedan repetir.
6. Ninguna mejora podrá convertir una funcionalidad futura en una promesa comercial: no incluir precios, ventajas Pro, alertas, cámara, GPS, IA o pagos como existentes si no hay una ruta que funcione hoy y una prueba que lo demuestre.

## ALCANCE AUTORIZADO

Se puede crear o modificar únicamente:

- `tools/simulacion-12m/**` y `tools/informe-simulacion-12m.html`.
- `docs/INFORME-SIMULACION-12M.md` y `docs/MEJORAS-SIMULACION-12M.md`.
- Para la PWA, solo archivos que un hallazgo reproducido exija entre `index.html`, `css/app.css`, `js/app.js`, `js/cams.js`, `js/assistant.js`, `sw.js` y sus pruebas específicas en `tools/`.
- Para móvil, solo `surfline-mobile/app/**`, `surfline-mobile/src/**`, `surfline-mobile/app.json` y pruebas/documentación dentro de `surfline-mobile/`, siempre que la mejora sea compatible con Expo SDK 58 y no añada dependencias.

## PROHIBIDO

- Modificar `js/spots.js`, `js/physics.js`, `backend/`, `data/`, `historico_olas.csv`, `webcams.json`, workflows de GitHub Actions, secretos o configuraciones de despliegue.
- Instalar paquetes, regenerar proyectos Expo, crear `ios/` o `android/`, usar WebView, añadir pagos, publicar o hacer `git push`.
- Usar scripts inline, atributos `onclick`/`onerror`, `eval` o relajar la CSP de la PWA.
- Inventar métricas de rendimiento, funciones, comparativas, precios de la competencia o resultados de pruebas.
- Hacer más de tres intentos de la misma prueba fallida. Tras el tercer fallo: restaurar el último commit bueno, explicar la causa en `DUDAS.md` y pasar al siguiente bloque.

## PERFILES Y COHORTES SINTÉTICAS

Modela al menos 5.000 usuarios sintéticos, con semilla fija `meteosurf-12m-v1`. La distribución, parámetros y fórmulas van en `tools/simulacion-12m/supuestos.json`.

| Cohorte | Peso inicial | Necesidad principal | Canales y dispositivo | Señal de valor |
| --- | ---: | --- | --- | --- |
| Principiante local | 30 % | Decidir “¿puedo surfear mañana?” | Búsqueda, móvil/PWA | entiende el resumen y abre un spot |
| Habitual local | 25 % | Elegir hora y playa | favorito, PWA/móvil | compara previsión, cámara y tabla |
| Avanzado | 15 % | Contrastar viento, período y ahora | directo, móvil/PWA | usa horas, brújula o cámaras |
| Visitante de fin de semana | 15 % | Planificar antes de viajar | búsqueda, móvil | consulta varios spots y rutas |
| Evaluador/inversor | 15 % | Validar producto, mercado y costes | escritorio/móvil | comprende propuesta, evidencia y riesgos |

Para cada cohorte define: frecuencia esperada según estación, abandono razonable, tolerancia al error de datos, ruta principal, fricciones esperadas y motivo de retorno. No presentar esas tasas como comportamiento real.

## VENTANA DE 12 MESES Y ESCENARIOS

Ejecutar dos simulaciones: `base_6m` y `anual_12m`. Cada mes debe representar estacionalidad mediterránea, no doce copias iguales:

- Temporada baja: menos sesiones, más consulta de previsión y retención frágil.
- Otoño/invierno: más oleaje, más uso recurrente de alertas/previsión y cámaras.
- Primavera: visitas de planificación y prueba de spots.
- Verano: menos condiciones de surf, más turismo, cámaras y valor de información clara.

Para cada ventana calcular tres escenarios con los mismos perfiles:

| Escenario | Qué varía | Finalidad |
| --- | --- | --- |
| Conservador | adquisición baja, recurrencia y conversión bajas, más abandono | no sobrevalorar la inversión |
| Base | supuestos centrales documentados | referencia operativa |
| Favorable | adquisición y recurrencia altas, sin superar límites razonables | sensibilidad, no promesa |

Para cada mes y escenario reportar: usuarios nuevos, activos mensuales, activados, WAU/MAU simulado, D7/D30, sesiones, consultas de spot, retornos, abandonos, embudo de valor y conversiones potenciales. Incluir una tabla de sensibilidad; no dar un único número como verdad.

## MÉTRICAS Y MODELO DE INVERSIÓN

### Métricas de producto

- Activación PWA: llega a una previsión útil, abre una ficha y entiende un resumen en una misma sesión.
- Activación móvil: abre una pestaña real y ejecuta una interacción disponible en la Fase 1. Las pantallas de marcador “Fase N” no cuentan como activación de una función futura.
- Retención: retorno simulado por cohorte; explicar que no equivale a telemetría real.
- Fricción: error de consola, acción imposible, estado vacío sin explicación, control sin etiqueta, texto cortado, interacción menor de 44 px o flujo de más de tres pasos sin valor claro.

### Métricas de inversión

Crear un modelo mensual de ingresos y costes **solo con variables visibles y editables en `supuestos.json`**:

- Usuarios activos, porcentaje de conversión simulado, precio mensual hipotético, ingresos brutos y netos tras una tasa de plataforma configurable.
- Costes explícitos: dominio/hosting, soporte, APIs si existieran y mantenimiento. Si no se conoce un coste, usar `null` y marcarlo como pendiente; no sustituirlo por cero.
- CAC, LTV y periodo de retorno únicamente cuando la fórmula tenga todos los datos. Si faltan, decir “no calculable con evidencia actual”.
- Señalar que GitHub Pages y Open-Meteo no prueban capacidad comercial, SLA, derechos de uso de cámaras ni cumplimiento de tiendas.

El informe inversor debe contener: tesis de valor local, evidencia que la apoya, riesgos (datos, cámaras, estacionalidad, distribución, mantenimiento, privacidad, App Store/Google Play), experimentos de bajo coste para validar cada riesgo y condiciones que invalidarían la tesis.

## PASOS OBLIGATORIOS

### 0. Preparación segura

1. Ejecutar `git status --short`, anotar rama y preservar todo cambio ajeno.
2. Crear rama de trabajo `feature/simulacion-usuarios-12m` desde el commit actual únicamente si el worktree no está reservado por otro agente. Si ya hay trabajo en curso, crear un worktree de Orca separado desde la rama principal actual y no rebasar ni integrar ramas ajenas.
3. Registrar versiones de Node, Playwright y Expo, la semilla de simulación y la fecha. No iniciar servidor persistente sin cerrarlo al terminar.

### 1. Línea base verificable: PWA

Crear/ajustar un script Playwright que arranque un servidor local temporal y pruebe en 390×844 y 1366×768, claro y oscuro:

1. Primera carga con `localStorage` limpio y con estado ya conocido.
2. Onboarding: visible, comprensible y cerrable.
3. Inicio → lista/búsqueda → ficha de spot → tabla Horas → Calendario → Cámaras → Asistente.
4. Navegación atrás/adelante y recarga; que el estado no rompa la URL ni la pantalla.
5. Falta de red simulada y datos incompletos: debe haber mensaje útil, nunca pantalla en blanco o datos falsos.
6. Errores de consola, errores de página, peticiones fallidas, tiempo de primera vista útil, elementos interactivos sin nombre, tamaño táctil y recortes de texto.
7. Service Worker: comprobar que la actualización/caché no impide abrir la aplicación tras una recarga local. No afirmar soporte offline completo sin prueba real.

Guardar JSON bruto por caso. Cada selector debe ser estable, no depender de texto frágil cuando haya atributo semántico disponible.

### 2. Línea base verificable: app Expo

Antes de probar, verificar que las versiones de dependencias son compatibles con Expo 58. Ejecutar como mínimo:

```powershell
cd surfline-mobile
npx tsc --noEmit
npx expo-doctor
npx expo start --port 8081 --no-dev
```

Esperar el arranque, registrar URL/QR o error y detenerlo limpiamente. Si hay emulador disponible, recorrer las cuatro pestañas con evidencia de captura y árbol de accesibilidad; si no, declarar esa parte `[NO VERIFICADO: no hay emulador]` sin sustituirla por una opinión.

Comprobar solo capacidades realmente presentes: arranque, navegación, áreas seguras, modo claro/oscuro si existe, textos, estados de carga, pestañas, error y almacenamiento implementado. Para cualquier botón que anuncie una fase futura, registrar el estado como “en construcción” y proponer una microcopia honesta en vez de fingir el flujo.

### 3. Recorridos longitudinales

Crear una matriz de al menos 12 recorridos: cada cohorte en PWA y, cuando aplique, app móvil. Simular primer día, primera semana, primer mes, temporada baja y temporada de oleaje. Cada recorrido debe incluir:

- Contexto y objetivo de la persona sintética.
- Ruta de pantallas y acción esperada.
- Resultado observado, evidencia y tiempo.
- Fricción, severidad (bloqueante/alta/media/baja), accesibilidad y abandono simulado.
- Hipótesis de mejora vinculada a un archivo, criterio de éxito y prueba posterior.

Los recorridos no se cierran con frases generales (“funciona bien”). Deben contener pasos concretos, datos observables y un resultado reproducible.

### 4. Generar la simulación 6/12 meses

Implementar un script Node determinista que lea `supuestos.json` y genere `resultados-base-6m.json` y `resultados-anual-12m.json`. Debe:

- Mantener una semilla reproducible y no llamar a servicios externos.
- Separar hechos de interfaz, supuestos y resultados simulados.
- Incluir pruebas de invariantes: usuarios, conversiones e ingresos nunca negativos; conversiones no superan activos; sumas de cohortes coinciden con total; mismas entradas producen mismo JSON.
- Exponer todas las fórmulas principales en el informe, no solo en código.

### 5. Priorizar antes de cambiar código

Crear `docs/MEJORAS-SIMULACION-12M.md` con todas las mejoras halladas, cada una con:

- ID, evidencia, producto afectado, tipo, severidad, impacto, esfuerzo, riesgo y archivos permitidos.
- Criterio “antes/después” medible y prueba exacta.
- Estado: `APLICABLE AHORA`, `BLOQUEADA`, `FUERA DE ALCANCE` o `REQUIERE DECISIÓN`.

Orden: primero errores bloqueantes, luego accesibilidad/claridad y flujos que afectan activación, después rendimiento y finalmente mejoras cosméticas. No aplicar cambios de producto irreversible (precio, paywall, analítica o permisos) sin autorización de Jordi.

### 6. Aplicar todas las mejoras aplicables ahora

Para cada elemento `APLICABLE AHORA`:

1. Crear una prueba o ampliar una existente que reproduzca el fallo.
2. Implementar la mejora mínima.
3. Ejecutar la prueba específica y la batería afectada.
4. Revisar consola, CSP y accesibilidad en los viewports de la línea base.
5. Hacer un commit pequeño con formato `fix(web): ...`, `fix(mobile): ...`, `ux(web): ...` o `a11y: ...`.
6. Actualizar su fila a `[VERIFICADO]` indicando comando y salida resumida.

Si una mejora requiere datos reales, servicio externo, API, permisos, facturación, una dependencia nueva, diseño de marca o una función futura de la app, no forzarla. Debe seguir apareciendo como pendiente con el experimento más pequeño posible y la decisión requerida.

### 7. Regresión final y entrega

Ejecutar como mínimo:

```powershell
node tools/simulacion-12m/simular.mjs --scenario base_6m
node tools/simulacion-12m/simular.mjs --scenario anual_12m
node tools/simulacion-12m/verificar-resultados.mjs
python -m unittest backend.test_motor_fisica
cd surfline-mobile; npx tsc --noEmit
```

Ejecutar además el test Playwright de la PWA y toda prueba específica añadida. Si `expo-doctor` informa problemas, no esconderlos: clasificar si ya existían o si los introdujo el cambio. Conservar solo primeros y últimos 20 renglones de logs extensos.

## CRITERIOS DE ACEPTACIÓN

- Se han generado resultados de 6 y 12 meses que se repiten exactamente al ejecutar de nuevo con la misma semilla.
- Los dos productos se evalúan según su estado real; toda capacidad no implementada de la app está marcada como tal.
- Hay al menos 12 recorridos concretos, 5 cohortes, 3 escenarios y una tabla mensual de 6/12 meses.
- El modelo de inversión separa hipótesis de evidencia, muestra fórmulas y no inventa costes, precios ni validación de mercado.
- Cada mejora aplicable tiene prueba antes/después, commit propio y estado `[VERIFICADO]`.
- Las mejoras bloqueadas no se silencian: incluyen dependencia, riesgo y próximo experimento.
- PWA sin nuevos errores de consola/CSP en los recorridos probados; TypeScript de móvil sin errores.
- No hay dependencias, secretos, despliegues, compras, analítica ni cambios en archivos prohibidos.

## ENTREGA

1. Commits locales pequeños en la rama de trabajo. No hacer push ni merge.
2. Informe final con un resumen de una página: qué está demostrado, qué es simulado, mejoras aplicadas, mejoras pendientes y recomendación inversora condicionada.
3. Actualizar `PROGRESO.md` y `NOTAS-IA.md` solo si no contienen conflictos ni cambios ajenos; si no es seguro, explicarlo en la entrega sin tocarlos.
4. Cerrar con `worker_done` (máximo cinco líneas): trabajo realizado, commits, pruebas con salida, bloqueos y siguiente acción concreta.

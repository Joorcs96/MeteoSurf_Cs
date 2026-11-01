# Auditoría de Producto y Usuarios · MeteoSurf_Cs (24/10/2026)

**Fecha:** 24 de octubre de 2026  
**Proyecto:** MeteoSurf_Cs (PWA estática de previsión de surf en Castellón)  
**Entorno auditado:** Repositorio local `C:\Users\Jordi\orca\Surfline_CS`, rama base `main` (commit `5202f5b`) y versión pública en producción (`https://joorcs96.github.io/MeteoSurf_Cs/`, commit `bf0a31a`).  
**Alcance:** Auditoría pura de producto, usabilidad y código. No se han modificado archivos de código, dependencias ni configuración durante esta inspección.  
**Limitación técnica declarada:** La inspección se ha ejecutado mediante análisis estático de código fuente, ejecución de suites de pruebas en Node.js/Python y consulta directa de cabeceras/código desplegado en GitHub Pages vía HTTP, sin levantar navegadores gráficos ni instalar navegadores headless para respetar las directrices de estabilidad del host.

---

## 1. Resumen Ejecutivo

MeteoSurf_Cs es una PWA de alto valor técnico y coste cero, concebida para ofrecer previsión de surf precisa en los 13 spots de la provincia de Castellón. Combina APIs marinas y meteorológicas abiertas de Open-Meteo, física adaptada a la batimetría del Mediterráneo (estudio v3), un catálogo de webcams en vivo, boyas en tiempo real y un asistente local de previsión en español sin dependencias de IA en la nube.

Sin embargo, la auditoría revela una **grave divergencia entre el código en producción y el repositorio local**:
1. **P0 Crítico — Marcadores de conflicto git en `index.html` y `PROGRESO.md`:** El último merge a main (`5202f5b`) introdujo 5 bloques de conflicto sin resolver (`<<<<<<< HEAD`, `|||||||`, `=======`, `>>>>>>>`) en `index.html` y uno en `PROGRESO.md:89`. Si se desplegara este commit a GitHub Pages, la aplicación quedaría rota y no operativa.
2. **P0 Crítico — Error de sintaxis en carga modular ES (`js/nowcast.js:2`):** El módulo `js/nowcast.js` importa `{ processSpot } from './forecast.js'`, pero `js/forecast.js:331` perdió el `export` en el commit `09ef95d`. Esto provoca un `SyntaxError` inmediato que aborta la ejecución antes de iniciar la app.
3. **P0 Crítico — Bloqueo de Content Security Policy (CSP):** En el bloque en conflicto de `index.html` (líneas 34 y 125) se inyecta Tailwind CDN (`cdn.tailwindcss.com`) y Leaflet (`unpkg.com`), pero la directiva CSP de la línea 5 (`script-src 'self' https://cdn.jsdelivr.net`) bloquea tajantemente la ejecución de ambos scripts externos y de scripts inline.
4. **P1 — Corrupción binaria en `css/app.css`:** En el commit `de62015`, líneas 1273–1275, se concatenaron reglas en codificación UTF-16 LE mediante PowerShell, insertando 216 bytes nulos (`\0`) que corrompen el parser CSS y fuerzan a Git a tratarlo como binario.
5. **P1 — Desconexión del Service Worker con los módulos:** `sw.js:8` precachea `'./app.js'` (el monolito histórico de 2070 líneas), ignorando los módulos reales `js/*.js` que componen la arquitectura moderna, poniendo en riesgo el funcionamiento offline.

---

## 2. Evaluación de los Cuatro Perfiles de Usuario

### Perfil 1: Surfista ocasional que decide si va hoy
* **Objetivo del usuario:** Saber en 5 segundos si "hay olas hoy", a qué spot cercano ir y qué traje ponerse, sin interpretar gráficos complejos.
* **Comportamiento observado y fricciones:**
  * **Sobrecarga de jerga técnica:** La ficha del spot y las tablas horarias muestran energía en kJ (`js/forecast.js:282`), ventanas angulares en grados (`js/spots.js:21`) y particiones de tres trenes de oleaje (swell primario, secundario y mar de viento). Para un usuario ocasional esto es ininteligible frente a un semáforo directo tipo "Baño divertido / Mar revuelto / Plato".
  * **Desalineación de webcams:** En `webcams.json:22,66`, varias cámaras no enfocan el pico de surf, sino la bocana del puerto deportivo (Grao CV) o están a más de 1.6 km del rompiente (Burriana CV). El usuario ocasional ve un puerto en calma y asume erróneamente que no hay olas en la playa contigua.
  * **Asistente infrautilizado:** El asistente de previsión (`js/assistant.js:43-58`) calcula con precisión el traje adecuado (desde licra hasta 5/4 mm) y la tabla sugerida (tablón, evolutiva, shortboard), pero se encuentra relegado a una pestaña secundaria (`#/asistente`) en lugar de alimentar un resumen rápido en la portada.

### Perfil 2: Surfista habitual que planifica su semana
* **Objetivo del usuario:** Anticipar baños con 3 a 7 días de antelación, contrastar con la boya en vivo (nowcast), revisar periodos, dirección de fondo vs viento terral y mareas óptimas.
* **Comportamiento observado y fricciones:**
  * **Aciertos:** La tabla horaria a 4 días cada 3 horas, el desglose de mar de fondo y la brújula dinámica (`js/compass.js`) aportan exactamente los parámetros que busca un surfista experimentado.
  * **Fallo en Nowcast de boya:** La corrección en tiempo real que compara la boya de Puertos del Estado con el modelo (`js/nowcast.js`) está rota debido a la falta del export de `processSpot` en `js/forecast.js:331`.
  * **Avisos automáticos desconectados:** El panel de notificaciones push (`js/notificaciones.js:151-154`) informa al usuario que el servicio de alertas está en preparación debido a que `WORKER_URL = ''` en `js/config.js:3`. El surfista no puede recibir alertas proactivas de picos de oleaje.
  * **Barrera en el reporte de sesiones:** El formulario `votar.html` está pensado para calibrar el modelo con observaciones reales. Sin embargo, al pulsar enviar (`js/votar.js:5,53`), genera una URL a `https://github.com/Joorcs96/MeteoSurf_Cs/issues/new`, lo que exige que el surfista disponga de una cuenta de GitHub activa.

### Perfil 3: Potencial cliente dispuesto a pagar (Propuesta Premium)
* **Objetivo del usuario:** Experiencia prémium tipo *Surfline Premium*: cámaras de alta definición sin cortes, rebobinado/videocontrol de sus propios baños (Rewinds), alertas prioritarias en el móvil y detección del aforo/crowd en el agua.
* **Comportamiento observado y fricciones:**
  * **Fragilidad de los streams dinámicos:** Las cámaras con resolución HLS dinámica (IPCamLive, `js/cams.js:57-61`) dependen de un archivo temporal (`data/streams.json:11`) con un TTL de 45 minutos. Si el cron de GitHub Actions falla o se retrasa, las cámaras entran en expiración y muestran errores de caducidad.
  * **Sobrecarga de IA en el cliente:** La detección de surfistas mediante visión artificial (`js/deteccion.js`, `js/detector-ia.js`) se procesa localmente en el canvas del navegador. En dispositivos móviles, esto genera sobrecalentamiento, consumo severo de batería y caídas de frames, impidiendo un servicio fluido que justifique un modelo de suscripción.
  * **Ausencia de persistencia y backend:** Al ser una arquitectura 100% estática servida en GitHub Pages, no existe sistema de cuentas de usuario, persistencia sincronizada ni pasarela de pago. Toda preferencia se reduce a `localStorage` en un único dispositivo.

### Perfil 4: Programador que mantiene la PWA
* **Objetivo del programador:** Un repositorio limpio, arquitectura desacoplada, pruebas reproducibles, despliegue continuo fiable y coste 0 € en infraestructura.
* **Comportamiento observado y fricciones:**
  * **Dualidad de código en el repositorio:** Coexisten un archivo `app.js` monolítico de 2070 líneas en la raíz y un árbol modular moderno en `js/` (`js/app.js`, `js/spots.js`, `js/forecast.js`, etc.). Esto genera confusión sobre cuál es la fuente de verdad.
  * **Falta de pre-commit linter:** El hecho de que se haya podido hacer commit de marcadores de conflicto `<<<<<<< HEAD` en `5202f5b` demuestra la ausencia de un hook de Git o comprobación de CI básica que aborte commits con conflictos o archivos corrompidos por codificación.
  * **Inconsistencias en CSP:** La etiqueta `<meta http-equiv="Content-Security-Policy">` en `index.html:5` no está alineada con los recursos que las diferentes ramas han intentado cargar (Tailwind CDN, Leaflet unpkg), provocando bloqueos de seguridad silenciosos en el navegador.

---

## 3. Riesgos Técnicos, de UX y de Accesibilidad

| Categoría | Riesgo Identificado | Evidencia en Código | Impacto |
|---|---|---|---|
| **Técnico** | Marcadores de conflicto Git en HTML y Docs | `index.html:13,203,355,1422,1448`, `PROGRESO.md:89` | **P0 - Crítico:** Rompe la estructura del DOM y bloquea el renderizado. |
| **Técnico** | Sintaxis ES Modules rota en Nowcast | `js/nowcast.js:2` y `js/forecast.js:331` | **P0 - Crítico:** `SyntaxError: processSpot is not exported`. Impide la ejecución de la app y tests. |
| **Técnico** | Content Security Policy restrictiva bloquea Tailwind y Leaflet | `index.html:5,34,69,125,160` | **P0 - Crítico:** Las CDNs no permitidas son bloqueadas por el navegador. |
| **Técnico** | Corrupción por bytes nulos UTF-16 en CSS | `css/app.css:1273-1275` (216 null bytes) | **P1 - Alto:** Rompe la regla `.animate-refresh` e invalida el diff textual en git. |
| **Técnico** | Desincronización en caché del Service Worker | `sw.js:4-12` | **P1 - Alto:** Se cachea `./app.js` pero no los módulos `./js/*.js`, inutilizando la PWA sin conexión. |
| **Técnico** | Caducidad de emisiones de cámaras (TTL 45 min) | `js/cams.js:57-61`, `data/streams.json:11` | **P1 - Alto:** Pantalla negra o error de emisión si el cron de Actions tarda más de 45 min. |
| **UX** | Reporte de sesión restringido a desarrolladores | `votar.html`, `js/votar.js:5,53` | **P2 - Medio:** Exige cuenta de GitHub para registrar la calibración de un spot. |
| **UX** | Complejidad técnica excesiva para el usuario novato | `index.html`, `js/forecast.js:282` | **P2 - Medio:** Ausencia de un semáforo visual simple y resumen directo para el día de hoy. |
| **Accesibilidad** | Botones e interactivos duplicados con IDs idénticos | `index.html:1458,1548`, `1517,1607` | **P1 - Alto:** Violación de WCAG 2.1 (IDs duplicados desorientan lectores de pantalla). |
| **Accesibilidad** | Contraste de texto en estados de viento y calidad | `css/app.css` (tokens de `--r-poor`, `--r-fair`) | **P2 - Medio:** En modo claro, badges con texto claro sobre fondo brillante no alcanzan ratio 4.5:1. |

---

## 4. Backlog Priorizado de Mejoras (Máximo 10 Cambios)

Priorizando intervenciones pequeñas, atómicas, verificables y 100% reversibles:

### [P0] 1. Resolver los conflictos de fusión en `index.html` y consolidar arquitectura modular
* **Archivos implicados:** `index.html`
* **Acción:** Eliminar los 5 bloques con marcadores `<<<<<<< HEAD`, `|||||||`, `=======`, `>>>>>>>` en `index.html`. Mantener la arquitectura modular aprobada (`<script type="module" src="js/app.js"></script>`) que funciona limpiamente en producción.
* **Criterio de aceptación:** `git grep "<<<<<<<" index.html` devuelve código de salida 1 (0 coincidencias); `index.html` pasa validación HTML w3c sin IDs duplicados.

### [P0] 2. Restaurar export de `processSpot` en `js/forecast.js`
* **Archivos implicados:** `js/forecast.js:331`
* **Acción:** Cambiar `function processSpot(` por `export function processSpot(`.
* **Criterio de aceptación:** La ejecución de `node scripts/test_calibracion.mjs` no arroja SyntaxError de importación y carga correctamente.

### [P0] 3. Alinear Content Security Policy con los recursos autorizados
* **Archivos implicados:** `index.html:5`
* **Acción:** Ajustar la directiva CSP para no invocar CDNs externas conflictivas y servir librerías requeridas (Leaflet, Chart.js) desde orígenes declarados en `script-src` o empaquetadas localmente.
* **Criterio de aceptación:** Consola del navegador con 0 violaciones de CSP (`Refused to load the script because it violates Content Security Policy directive`).

### [P1] 4. Sanear `css/app.css` eliminando los 216 bytes nulos UTF-16
* **Archivos implicados:** `css/app.css:1273-1275`
* **Acción:** Eliminar las líneas 1273–1275 mal codificadas y reescribir en UTF-8 puro la regla `.animate-refresh { animation: refresh-spin 0.4s var(--ease-std) 1; }`.
* **Criterio de aceptación:** Script Node `buf.indexOf(0)` devuelve `-1`; `git diff css/app.css` se muestra como texto regular y no como binario.

### [P1] 5. Actualizar la lista `STATIC_ASSETS` en `sw.js`
* **Archivos implicados:** `sw.js:4-12`
* **Acción:** Reemplazar `'./app.js'` por los módulos activos: `'./js/app.js'`, `'./js/spots.js'`, `'./js/forecast.js'`, `'./js/cams.js'`, `'./js/compass.js'`, `'./js/assistant.js'`, `'./js/notificaciones.js'`, `'./js/nowcast.js'`, `'./js/physics.js'`.
* **Criterio de aceptación:** Al simular modo offline en el Service Worker, todas las rutas de la PWA se renderizan sin errores 404 ni fallos de red.

### [P1] 6. Eliminar el archivo obsoleto `app.js` de la raíz
* **Archivos implicados:** `app.js` (raíz)
* **Acción:** Retirar el archivo monolítico redundante de 2070 líneas una vez verificado que toda la lógica activa reside en `js/`.
* **Criterio de aceptación:** Ningún archivo HTML o JS referencia a `./app.js`; la aplicación funciona íntegramente a través de `js/app.js`.

### [P1] 7. Gestión defensiva y aviso de caducidad en webcams (`js/cams.js`)
* **Archivos implicados:** `js/cams.js:57-63`
* **Acción:** Cuando un stream supere los 45 minutos de caducidad, mostrar un botón de recarga o enlace directo alternativo en lugar de dejar el reproductor bloqueado en negro.
* **Criterio de aceptación:** En caso de stream expirado, el usuario ve una tarjeta explicativa con enlace a la fuente oficial sin congelar la interfaz.

### [P2] 8. Tarjeta de resumen directo "¿Hay baño hoy?" en la portada
* **Archivos implicados:** `js/app.js`, `css/app.css`
* **Acción:** Crear un componente superior en la vista principal para surfistas ocasionales: semáforo general, spot más favorable de las 4 zonas y recomendación resumida del asistente.
* **Criterio de aceptación:** En el primer pliegue de la versión móvil (viewport 390x844), el usuario lee en una sola frase si merece la pena desplazarse hoy.

### [P2] 9. Desacoplar el formulario de reporte de sesión de GitHub Issues
* **Archivos implicados:** `votar.html`, `js/votar.js:5,53`
* **Acción:** Permitir exportar el reporte a WhatsApp (mensaje preformateado vía `https://wa.me/?text=...`) o copiar JSON al portapapeles, además del botón GitHub Issue para desarrolladores.
* **Criterio de aceptación:** Un usuario sin cuenta técnica puede enviar su reporte de olas en dos toques desde el móvil.

### [P2] 10. Implementar verificación de integridad pre-commit y CI
* **Archivos implicados:** `.github/workflows/` o script de control
* **Acción:** Añadir un paso rápido en GitHub Actions que ejecute `git grep "<<<<<<<"` y compruebe que no existen archivos con bytes nulos en carpetas de código/documentación.
* **Criterio de aceptación:** Un intento de commit con marcadores de conflicto falla automáticamente en el pipeline de CI.

---

## 5. Distinción entre Hechos Comprobados e Hipótesis

### Hechos Comprobados [VERIFICADO]
1. `index.html` contiene 5 bloques con marcadores de conflicto de Git en las líneas 13, 203, 355, 1422 y 1448 generados en el commit `5202f5b`.
2. `PROGRESO.md` contiene un marcador de conflicto de Git en la línea 89 (`<<<<<<< HEAD`).
3. `js/forecast.js:331` carece de la sentencia `export` para `processSpot`, rompiendo la importación en `js/nowcast.js:2` y produciendo un `SyntaxError` verificado con Node.js v24.21.0.
4. `css/app.css` contiene 216 bytes nulos (`\0`) a partir del offset 38719, introducidos en el commit `de62015` por concatenación UTF-16 LE.
5. La versión en producción servida en GitHub Pages (`https://joorcs96.github.io/MeteoSurf_Cs/`) responde 200 OK con 60 líneas de HTML correspondientes al commit `bf0a31a`, sin haber absorbido todavía los conflictos de `main`.
6. En `index.html:5`, la directiva CSP `script-src 'self' https://cdn.jsdelivr.net;` bloquea `https://cdn.tailwindcss.com` y `https://unpkg.com`.
7. `data/streams.json` tiene fecha del 17/10/2026 y un TTL de 45 minutos (`ttlMin: 45`), por lo que su estado stream está actualmente caducado.

### Hipótesis que requieren validación con usuarios reales [HIPÓTESIS]
1. **Comprensión de la escala de calidad:** Se asume que la escala de 8 niveles (Plato a Épico) es preferida por los usuarios locales frente a un sistema tradicional de 5 estrellas o notas numéricas (1 a 10).
2. **Impacto de la cámara desalineada:** Se hipotetiza que los surfistas novatos descartan acudir a la playa al ver la cámara del puerto del Grao en calma, mientras que los experimentados ya conocen la diferencia entre el puerto y la rompiente.
3. **Disposición de pago por Rewinds:** No hay evidencia de campo sobre si los surfistas de Castellón pagarían una cuota mensual por grabaciones de vídeo personalizadas en spots con frecuencia de olas moderada/baja como el Mediterráneo.
4. **Preferencia tipográfica:** La prueba entre `Inter` (técnica, legible, modular) y `Outfit` (deportiva, geométrica) no ha sido contrastada en encuestas de percepción visual con usuarios activos.

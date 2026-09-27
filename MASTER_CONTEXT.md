# MASTER CONTEXT: MeteoSurf_Cs

## 1. OBJETIVO Y RESTRICCIONES (INMUTABLE)
*   **Misión:** Construir una plataforma de previsión de surf (MeteoSurf_Cs) para la costa de Castellón, con estética y funciones al estilo Surfline/Surf-Forecast, alertas automáticas y cámaras en directo.
*   **Restricción Estricta:** Coste 0€. Prohibido el uso de servidores 24/7 (VPS, Raspberry), bases de datos de pago o APIs que requieran tarjeta de crédito (ej. Meta Cloud API). Todo debe ser *Serverless* y usar "Free Tiers".

## 2. HISTORIAL DE DECISIONES Y CONTEXTO (RESUMEN DEL CHAT)
*Esta sección resume la evolución del proyecto para que cualquier IA entienda el "por qué" de la arquitectura sin leer todo el historial previo.*
*   **Origen:** El sistema partió de un bot de Telegram con base en Google Apps Script y Google Sheets (versión v50.0).
*   **Evolución Serverless:** Se descartó Google Sheets para evitar cuotas y problemas de mantenimiento. Se optó por almacenar los datos en un simple CSV alojado en GitHub, actualizado automáticamente por GitHub Actions.
*   **WhatsApp sin coste:** Se rechazaron soluciones oficiales de Meta (piden tarjeta) y librerías tipo Puppeteer (requieren PC encendido). Se eligió **CallMeBot API** por ser 100% gratuita para grupos reducidos mediante peticiones GET.
*   **Diseño UI:** El usuario solicitó expresamente abandonar los emojis y adoptar una estética profesional.
*   **Rebranding y frontend nuevo:** El proyecto pasó de llamarse "Surfline Castellón / Surfline CS" a **MeteoSurf_Cs** y se reescribió el frontend por completo: interfaz propia en `index.html` + `css/app.css` + módulos ES en `js/` (`app.js`, `spots.js`, `forecast.js`, `compass.js`, `cams.js`, `assistant.js`), sin Tailwind ni dependencias de build. Se abandonó Netlify (Forms incluido) en favor de GitHub Pages; `votar.html` ahora guarda el reporte en `localStorage` y ofrece enviarlo como issue de GitHub.
*   **Cálculo en el navegador:** La previsión (física de rompiente, viento, marea, calidad) se calcula en el propio `js/forecast.js` a partir de Open-Meteo, no solo en el backend Python. El backend Python (`backend/motor_fisica.py`) sigue siendo la referencia física para el histórico diario y sus tests.
*   **Evolución a IA:** Se ideó un sistema donde los usuarios envían feedback de sus sesiones ("Épico", "Bueno", "Plato"...) que alimenta el CSV. En el futuro, un modelo de Machine Learning (`scikit-learn`) podría tomar el control para predecir la calidad de forma probabilística; de momento la calidad es puramente física/heurística.
*   **Asistente de previsión:** Se añadió `js/assistant.js`, un asistente en español que responde preguntas sobre la previsión calculando localmente en el navegador (sin llamadas a APIs de IA ni claves).

## 3. ARQUITECTURA Y STACK TECNOLÓGICO
*   **Frontend (Escaparate):** **GitHub Pages** (`https://joorcs96.github.io/MeteoSurf_Cs/`, repositorio `Joorcs96/MeteoSurf_Cs`). PWA estática: HTML5, CSS propio con tokens claro/oscuro (`css/app.css`), JavaScript en módulos ES (`js/*.js`), sin frameworks ni build. Reproductores incrustados para webcams (iframe, YouTube, HLS vía `hls.js`/nativo en iOS, MJPEG, JPG con refresco).
*   **Backend / Automatización (El Vigilante):** GitHub Actions. Dos workflows: `prevision_diaria.yml` (histórico de olas + alerta WhatsApp, diario) y `webcams.yml` (verificación del catálogo de webcams, cada 30 min).
*   **Base de Datos (Memoria):** Archivo `historico_olas.csv` alojado en el propio repositorio de GitHub. Catálogo `webcams.json` con el estado de cada cámara.
*   **Alertas:** CallMeBot API (WhatsApp).
*   **Inteligencia Artificial (Cerebro):** Motor físico/heurístico en `backend/motor_fisica.py` (Python) y `js/forecast.js` (JavaScript, ejecutado en el navegador). `scikit-learn` queda como posible evolución futura, no implementada todavía.
*   **Feedback Humano:** `votar.html`, guardado en `localStorage` del navegador del usuario, con envío opcional como issue de GitHub (no hay backend de formularios).

## 4. FUENTES DE DATOS Y REFERENCIAS
*   **API Meteorológica:** `Open-Meteo Marine API` (altura, periodo y dirección de ola total y por componentes de swell, nivel del mar, temperatura del agua) y `Open-Meteo Weather API` (viento a 10 m, ráfagas, temperatura, sol). Modelo `ncep_gfswave016` (GFS-Wave) como respaldo para los días 11–16, donde el modelo marino principal ya no tiene datos.
*   **API Alertas:** `CallMeBot` (WhatsApp). Formato: `https://api.callmebot.com/whatsapp.php?phone=[NUM]&text=[TXT]&apikey=[KEY]`
*   **Webs de Referencia (Inspiración UX/UI):** Surfline, Surf-Forecast, Windguru.

## 5. INSTRUCCIONES PARA EL ENJAMBRE MULTI-IA (ORCA)
**Directiva del Sistema:** Actúas como un agente especializado en un enjambre de desarrollo. Lee este archivo de contexto. Ejecuta tu tarea sin explicaciones superfluas. Tu salida debe ser código estrictamente funcional.
*   **No modifiques** el frontend nuevo (`index.html`, `css/app.css`, `js/*.js`, `sw.js`, `manifest.json`, iconos) ni `webcams.json` salvo que tu tarea sea explícitamente esa: otros agentes trabajan en ellos en paralelo.
*   **Claude / Antigravity:** Encargados de la lógica de backend (Python), traducción matemática del motor costero y automatización (GitHub Actions YAML).
*   **ChatGPT / Gemini:** Frontend (HTML/CSS/JS de `index.html`, `css/`, `js/`) y estructura de datos (CSV, JSON, parseo de Open-Meteo).

**REGLA DE AUTOCOMPILADO:** Al finalizar tu tarea, debes añadir al final de tu respuesta un bloque exacto con el formato `[MEMORY_UPDATE]`. Este bloque contendrá un resumen técnico de máximo 3 líneas indicando los archivos creados o modificados. El usuario copiará este bloque en la sección "ESTADO ACTUAL" de este documento.

## 6. CÓDIGO FUENTE (LÓGICA FÍSICA A TRADUCIR)
El siguiente código JavaScript contiene la física de los spots (Mediterráneo) y el algoritmo de calidad pre-IA. El agente de Backend debe traducirlo a Python.

```javascript
var SPOT_CONFIG = {
  'Planetario':  { azimut: 26,  thetaCrit: 45, sBase: 0.15, offshoreMin: 275, offshoreMax: 315 },
  'Gurugu':      { azimut: 26,  thetaCrit: 45, sBase: 0.15, offshoreMin: 275, offshoreMax: 315 },
  'Pirámides':   { azimut: 38,  thetaCrit: 50, sBase: 0.10, offshoreMin: 285, offshoreMax: 330 },
  'Voramar':     { azimut: 54,  thetaCrit: 65, sBase: 0.05, offshoreMin: 300, offshoreMax: 350 },
  'La Renegà':   { azimut: 172, thetaCrit: 10, sBase: 0.90, offshoreMin: 230, offshoreMax: 290 },
  'Burriana':    { azimut: 26,  thetaCrit: 45, sBase: 0.20, offshoreMin: 275, offshoreMax: 315 },
  'Nules':       { azimut: 26,  thetaCrit: 40, sBase: 0.25, offshoreMin: 275, offshoreMax: 315 },
  'Almenara':    { azimut: 26,  thetaCrit: 35, sBase: 0.30, offshoreMin: 275, offshoreMax: 315 },
  'Peñíscola N': { azimut: 10,  thetaCrit: 10, sBase: 0.80, offshoreMin: 260, offshoreMax: 300 },
  'Vinaròs':     { azimut: 10,  thetaCrit: 10, sBase: 0.85, offshoreMin: 260, offshoreMax: 300 }
};

function getSpotConfig(nombre) {
  var keys = Object.keys(SPOT_CONFIG);
  for (var i = 0; i < keys.length; i++) {
    if (nombre.indexOf(keys[i]) !== -1) return SPOT_CONFIG[keys[i]];
  }
  return { azimut: 26, thetaCrit: 40, sBase: 0.20, offshoreMin: 275, offshoreMax: 315 };
}

function calcularFisica(nombre, h, periodo, dirSwell) {
  h = Number(h) || 0; periodo = Number(periodo) || 0; dirSwell = Number(dirSwell) || 0;
  if (h <= 0) return 0;

  var cfg = getSpotConfig(nombre);
  var k = 0.15; 
  var sf = cfg.sBase + (1 - cfg.sBase) / (1 + Math.exp(-k * (dirSwell - cfg.thetaCrit)));

  var amplificador = 1.0;
  if (dirSwell < 75) {
    var ganancia = Math.pow(periodo / 4.0, 2);           
    ganancia = Math.min(Math.max(ganancia, 1.0), 2.5);   
    var factorSombra = 1.0 - sf;                         
    amplificador = 1.0 + ((ganancia - 1.0) * factorSombra);
  }

  var normalCosta = cfg.azimut + 90;
  var exposicion = Math.abs(Math.cos((dirSwell - normalCosta) * Math.PI / 180));
  exposicion = Math.max(exposicion, 0.05); 

  return Math.round(h * sf * amplificador * exposicion * 100) / 100;
}

function calcularCalidad(h, p, ws, wd, nombre, presion, visib) {
  h = Number(h) || 0; p = Number(p) || 0; ws = Number(ws) || 0; wd = Number(wd) || 0;
  if (h < 0.2) return 0;  
  if (h < 0.35) return 1; 

  var s = 2;
  if (h >= 0.5) s++;
  if (h >= 0.9) s++;
  if (p >= 6) s += 0.5;
  if (p >= 8) s += 0.5;
  var energia = h * h * p;
  if (energia >= 5)  s += 0.5;
  if (energia >= 15) s += 0.5;

  var cfg = nombre ? getSpotConfig(nombre) : null;
  if (cfg) {
    var isOffshore = (cfg.offshoreMin < cfg.offshoreMax) 
      ? (wd >= cfg.offshoreMin && wd <= cfg.offshoreMax)
      : (wd >= cfg.offshoreMin || wd <= cfg.offshoreMax);
    if (isOffshore && ws < 15) s += 1;     
    if (isOffshore && ws < 8)  s += 0.5;   
  } else {
    var offGen = (wd >= 260 && wd <= 360) || (wd >= 0 && wd < 45);
    if (offGen && ws < 12) s++;
  }
  if (ws > 20) s -= 1;
  if (ws > 30) s -= 1;
  
  presion = Number(presion) || 1013;
  if (presion > 0 && presion < 1008) s += 0.5;  
  if (presion > 0 && presion < 995) s += 0.5;   

  return Math.min(Math.max(Math.round(s), 0), 5);
}

## 7. ESTADO ACTUAL
- Rebranding a **MeteoSurf_Cs** completado: frontend reescrito (`index.html`, `css/app.css`, `js/app.js`, `js/spots.js`, `js/forecast.js`, `js/compass.js`, `js/cams.js`, `js/assistant.js`, `sw.js`, `manifest.json`, iconos), sin Tailwind ni dependencias de build. Archivos obsoletos de la versión anterior (`app.js` en raíz, `patch_*.py`, `update_*.py`) eliminados.
- Hosting movido de Netlify a **GitHub Pages** (`https://joorcs96.github.io/MeteoSurf_Cs/`); `votar.html` reescrito con el estilo del frontend nuevo, sin Netlify Forms (guarda en `localStorage` y ofrece enviar un issue de GitHub).
- Backend (`backend/motor_fisica.py`, `backend/actualizar_prevision.py`, `backend/actualizar_webcams.py`, `backend/test_motor_fisica.py`) con 27 tests unitarios pasando. Automatización por GitHub Actions con dos workflows: `prevision_diaria.yml` (diario) y `webcams.yml` (cada 30 min).
- Repositorio organizado en rama `main` (renombrado de `desarrollo-web-surf`) con `.gitignore` estricto para coste 0€.
# Investigación de Mercado: Viabilidad y Expectativas de Pago en PWAs de Previsión de Surf

**Proyecto:** MeteoSurf_Cs ([https://joorcs96.github.io/MeteoSurf_Cs/](https://joorcs96.github.io/MeteoSurf_Cs/))  
**Fecha de consulta e investigación:** 24 de octubre de 2026  
**Autor:** Antigravity (I+D de Producto)  
**Destinatario:** Coordinación de Producto y Arquitectura de MeteoSurf  
**Estado:** Documento de análisis de producto y negocio (Sin cambios en código fuente ni configuración)

---

## 1. Resumen Ejecutivo

El mercado del software meteorológico costero y de surf ha experimentado una consolidación acelerada hacia modelos de suscripción de pago (SaaS). Líderes globales como **Surfline** han endurecido progresivamente el acceso a sus activos más codiciados (particularmente el streaming de cámaras en directo y los rebobinados de sesiones *Cam Rewind*), mientras que herramientas técnicas especializadas como **Windguru** o **Windy.com** monetizan la alta resolución espacial de modelos numéricos y la frecuencia de actualización horaria.

Sin embargo, trasladar este modelo a **MeteoSurf_Cs** presenta particularidades operativas y geográficas ineludibles:

1. **La dinámica mediterránea:** A diferencia de las costas atlánticas u oceánicas con marejadas de largo periodo que duran días, las sesiones de surf en Castellón y la costa este española dependen de temporales locales con ventanas de baño efímeras (a menudo de 2 a 4 horas antes de que el viento role o el mar caiga). El valor percibido por el surfista local no radica en una previsión a 16 días, sino en **no perderse la ventana óptima de hoy**.
2. **Restricción de infraestructura a coste cero (0 €):** MeteoSurf se ejecuta como una Progressive Web App (PWA) 100 % estática servida en GitHub Pages, calculando la refracción y calidad en el navegador del cliente mediante la API libre de Open-Meteo. No dispone de servidores dedicados 24/7, ni de una red privada de cámaras, ni de satélites o batimetría propia.
3. **Peligro de las falsas expectativas:** Prometer datos "garantizados", alertas críticas en tiempo real o streaming ininterrumpido sin backend propio es el camino más rápido a la pérdida de confianza de la comunidad surfista. Cualquier modelo de monetización o fidelización debe sustentarse en la transparencia, el soporte voluntario o funciones de conveniencia personal que **no privaticen los datos públicos básicos ni bloquen el uso libre**.

---

## 2. Análisis de Referentes del Mercado

A continuación se examinan las propuestas de valor, esquemas tarifarios y estrategias de retención de los 4 servicios meteorológicos y de surf más representativos a nivel internacional.

*(Fuentes directas consultadas el 24 de octubre de 2026)*.

### 2.1. Surfline (Referente global de surf)
* **Fuentes directas oficiales:**
  * Planes y suscripciones: [https://www.surfline.com/upgrade](https://www.surfline.com/upgrade)
  * Documentación Cam Rewind: [https://support.surfline.com/hc/en-us/articles/115002476567-Cam-Rewind-Frequently-Asked-Questions](https://support.surfline.com/hc/en-us/articles/115002476567-Cam-Rewind-Frequently-Asked-Questions)
* **Estructura de precios (2025–2026):**
  * **Free ($0):** Reportes de texto básicos, previsión de corto plazo (hasta 3-5 días), tablas de mareas y datos de boyas públicas. *El acceso continuo a las cámaras en directo ha sido eliminado o fuertemente restringido a previsualizaciones estáticas o de pocos segundos.*
  * **Premium with Ads ($69,99/año):** Acceso ilimitado a la red de cámaras y a *Cam Rewind*, pero con anuncios de 15 segundos al abrir la señal.
  * **Standard Premium ($15,99/mes o $119,99/año):** Sin publicidad. Cámaras HD ilimitadas, previsión completa a 16 días, desgloses avanzados de swell y viento, alertas personalizadas y *Cam Rewind* con histórico de hasta 5 días, recorte de vídeos de hasta 1 minuto, velocidad 8x y descarga directa.
  * **Premium+ ($149,99/año):** Añade funciones de visión artificial e IA (*Smart Rewind*, líneas de tiempo automáticas de olas surfeadas, análisis de aglomeraciones/crowd) y hasta 3 cuentas simultáneas compartidas.
* **Driver de pago principal:** La red exclusiva de cámaras en directo y la posibilidad de verse surfeando (*Cam Rewind*). El surfista paga para no conducir en balde y por validación/recuerdo de su sesión.

### 2.2. Surf-Forecast.com (Referente de tablas operativas)
* **Fuente directa oficial:**
  * Suscripción SurfPro: [https://www.surf-forecast.com/membership](https://www.surf-forecast.com/membership)
* **Estructura de precios (2025–2026):**
  * **Free ($0):** Tablas de previsión con intervalos de 3 o 6 horas, publicidad agresiva (banners/interstitials), avisos estándar y días limitados.
  * **SurfPro ($4,99/mes o $34,99/año):** Previsión detallada completa a 16 días, desglose horario estricto hora a hora, herramienta *16-Day Wavefinder* para escanear rompientes activas en mapas, alertas personalizadas de viento/oleaje y eliminación total de publicidad.
* **Driver de pago principal:** Comodidad de lectura horaria sin publicidad invasiva y avisos proactivos para planificar fines de semana o escapadas.

### 2.3. Windguru (Referente técnico para deportes de viento y olas)
* **Fuente directa oficial:**
  * Tarifas y modelos Windguru PRO: [https://www.windguru.cz/pro/](https://www.windguru.cz/pro/)
* **Estructura de precios (2025–2026):**
  * **Free ($0):** Acceso a 9 modelos numéricos genéricos (GFS estándar), resolución espacial gruesa, intervalos de 3 horas, actualización retardada y publicidad.
  * **Windguru PRO (25,90 €/año, 39,90 € por 2 años, o 3,90 €/mes):** *Pago único no recurrente* (sin suscripciones trampa ni cobros sorpresa). Desbloquea más de 87 modelos de alta resolución (WRF 3km/9km, ICON-D2, ECMWF, AROME), predicción puntual en cualquier coordenada del mapa (spots personalizados), alertas meteorológicas por email, mareas locales completas y sin anuncios.
* **Driver de pago principal:** Fiabilidad meteorológica contrastada, acceso a modelos de mesoescala (clave para brisas y térmicos) y un modelo de cobro respetuoso y transparente que goza de altísima fidelidad entre navegantes y surfistas.

### 2.4. Windy.com (Referente de visualización cartográfica e interactividad)
* **Fuente directa oficial:**
  * Windy Premium: [https://www.windy.com/subscription](https://www.windy.com/subscription)
* **Estructura de precios (2025–2026):**
  * **Free ($0):** Visualización global en capas, 2 actualizaciones de modelos al día, pasos de 3 horas, bucle de radar limitado.
  * **Windy Premium (~$2,99/mes o entre 18,99 € y 24,99 €/año en renovación automática; opción de pago único anual ~29,99 €):** Actualización de modelos de 4 a 6 veces al día (vital cuando una baja presión se profundiza rápidamente), resolución temporal de 1 hora, horizonte a 15 días, bucle de radar/satélite de 24 horas continuo y archivo histórico de hasta 1 año.
* **Driver de pago principal:** Inmediatez en la actualización de modelos ante frentes cambiantes y visualización fluida de alta resolución.

---

## 3. Tabla Comparativa de Oportunidades de Mercado

| Plataforma | Modelo de Ingresos | Precio Anual Estimado | Principales Palancas de Pago | Factibilidad para MeteoSurf (Coste 0 €) |
|---|---|---|---|---|
| **Surfline** | Freemium cerrado / SaaS | 69,99 $ – 149,99 $/año | Webcams HD exclusivas + *Cam Rewind* con recorte y descarga de vídeos | **Muy Baja:** MeteoSurf no posee cámaras propias ni ancho de banda de vídeo dedicado. |
| **Surf-Forecast** | Freemium publicitario / Pro | 34,99 $/año (~2,92 $/mes) | Previsión hora a hora, alertas de oleaje, mapas Wavefinder, adiós anuncios | **Media:** Las tablas horarias ya se calculan en MeteoSurf; las alertas requieren infraestructura fiable. |
| **Windguru** | Freemium técnico / Pago único | 25,90 €/año (~2,16 €/mes) | Acceso a modelos WRF/AROME de alta resolución, coordenadas libres, sin anuncios | **Baja-Media:** Open-Meteo ya ofrece modelos regionales, pero MeteoSurf depende de la API gratuita. |
| **Windy** | Freemium visual / Suscripción | ~19 € – 25 €/año | Actualizaciones 4–6x al día, intervalo de 1 h, radar de 24 h y archivo | **Baja:** La tasa de actualización depende de las ejecuciones de Open-Meteo y workflows externos. |

---

## 4. Análisis de MeteoSurf: Capacidades Reales vs Expectativas de Pago

Para evaluar qué expectativas de valor puede satisfacer MeteoSurf sin promesas engañosas, contrastamos su inventario real de funciones (verificado en `README.md`, `FUNCIONES.md` y `MASTER_CONTEXT.md`):

### 4.1. Funciones Existentes Verificadas en MeteoSurf
* **Cobertura local hiperfocalizada:** 10 spots de la provincia de Castellón organizados en 4 zonas (Vinaròs-Peñíscola, Oropesa-Benicàssim, Grao de Castellón, Burriana-Almenara).
* **Motor físico específico de rompiente:** Algoritmo en `js/forecast.js` y `backend/motor_fisica.py` que calcula sombra costera, amplificación por periodo y ventana de oleaje/viento adaptada al mar de viento y fondo mediterráneo (escala de 8 niveles).
* **Brújula interactiva del spot:** Representación gráfica SVG (`js/compass.js`) con las ventanas angulares reales de cada playa.
* **Integración de webcams públicas:** Reproductor unificado (`js/cams.js`) con soporte HLS/YouTube/MJPEG para cámaras de Turisme Comunitat Valenciana y entidades locales.
* **Sistema de clips Rewinds:** Workflow automatizado de GitHub Actions (`scripts/rewind.py`) que graba clips de 20s en baja resolución (480p) con desenfoque facial cuando la altura supera 0,5 m.
* **Asistente en lenguaje natural local:** Lógica heurística en `js/assistant.js` que responde preguntas sin consumir cuotas de APIs externas de pago ni exponer claves.
* **Registro de baños:** Formulario estático `votar.html` guardado en el `localStorage` del cliente.

### 4.2. Categorización de Funciones: Básicas vs Plausibles de Pago

```
┌────────────────────────────────────────────────────────────────────────┐
│                        NIVEL 1: BÁSICAS Y ABIERTAS                     │
│                  (Garantizan masa crítica y comunidad)                 │
│  • Previsión a 4 días (3h) y tendencia 16 días                         │
│  • Brújula del spot y ángulos de costa                                │
│  • Catálogo de cámaras públicas embebidas                              │
│  • Calificación heurística de calidad (Plato a Épico)                  │
│  • Diario de sesiones local en el navegador                            │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   NIVEL 2: VALOR EXTRA / PATROCINIO                    │
│          (Funciones de conveniencia que no bloquean la base)           │
│  • Filtros avanzados de sesión guardados (p. ej. "Avisar en fin de sem")│
│  • Comparativa lado a lado entre 3 spots para decidir ruta en coche   │
│  • Histórico visual de temporales pasados (archivado en CSV/GitHub)    │
│  • Calibración personalizada de umbrales físicos del usuario           │
│  • Carnet/Insignia de mecenas ("Amigo de MeteoSurf")                   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│              NIVEL 3: RIESGO CRÍTICO / NO ASUMIBLES EN PWA 0 €          │
│                (PROMETEN LO QUE LA ARQUITECTURA NO PUEDE DAR)          │
│  ✕ Garantía de streaming ininterrumpido en webcams ajenas              │
│  ✕ Alertas push instantáneas críticas por WhatsApp de pago             │
│  ✕ Telemetría oceanográfica en tiempo real a pie de rompiente          │
│  ✕ Muro de pago que cierre la información meteorológica pública        │
└────────────────────────────────────────────────────────────────────────┘
```

### 4.3. Riesgos Operativos y de Reputación
1. **Fragilidad de las webcams públicas:** Las cámaras integradas pertenecen a terceros (Generalitat, municipios, puertos). Cambian de URL, sufren caídas de red o bloqueos por CORS sin previo aviso. Cobrar directa o indirectamente prometiendo "cámaras en directo" provocaría quejas inmediatas y devoluciones.
2. **Límites de los modelos globales:** Open-Meteo suministra datos procedentes de modelos sinópticos/marinos globales (GFS-Wave, ECMWF). Aunque el motor de MeteoSurf aplica una heurística geométrica de refracción, no tiene capacidad de resolver bancos de arena dinámicos ni batimetría milimétrica.
3. **Disponibilidad de notificaciones sin servidor:** Notificaciones vía `CallMeBot` o Web Push gratuito en PWA dependen del estado del dispositivo del usuario y de servicios sin garantía de entrega (SLA).

---

## 5. Hipótesis de Monetización y Retención Aplicables a MeteoSurf

A continuación se plantean 6 hipótesis concebidas estrictamente bajo el principio de **no bloquear el uso libre de la PWA**, protegiendo la comunidad local y orientando experimentos falsables.

---

### Hipótesis 1: El Detector de Ventanas Cortas ("Avisos de Baño Exprés")
* **Enunciado:** *Si permitimos a los surfistas configurar una "Condición Soñada" para su spot favorito (ej. "Voramar con ola > 0,6 m y viento W/NW") y recibir una notificación local/ics cuando el motor de previsión detecte esa ventana, aumentará la retención semanal (WAU) sin necesidad de cobrar por la previsión general.*
* **Perfil de usuario:** Surfista trabajador o estudiante con agenda ajustada que solo dispone de 2 horas libres y no puede revisar la web constantemente.
* **Señal de validación (Métrica):** > 25 % de los usuarios que consultan un spot activan el botón "Avisarme si se pone Bueno" en un periodo de prueba de 30 días.
* **Experiencia Mínima Viable (MVE sin bloqueo):** Un botón en la ficha del spot que genera un evento de calendario descargable (.ics) o activa Web Push local en navegadores compatibles. En caso de ofrecer alertas externas avanzadas (email/bot), evaluar un micro-pago o cuota anual voluntaria.
* **Contraste con el código actual:** En `js/spots.js` y `js/forecast.js` ya existen los umbrales de terral y calidad. Falta únicamente la capa de suscripción o generación de recordatorio.

---

### Hipótesis 2: El Rebobinado de Sesiones de Bajo Coste ("Rewinds de Fin de Semana")
* **Enunciado:** *Si organizamos los clips de vídeo de `data/rewinds.json` por spot, fecha y hora en una biblioteca visual histórica ("¿Cómo rompió el último temporal en El Grao?"), los usuarios volverán a la app los días posteriores a una marejada.*
* **Perfil de usuario:** Surfista que entró al agua durante un repunte y quiere verificar el aspecto visual del pico o rememorar la jornada.
* **Señal de validación (Métrica):** Las vistas a la sección `#cams` / Rewinds superan el 40 % del tráfico total en las 48 horas posteriores a un evento de oleaje registrado en `historico_olas.csv`.
* **Experiencia Mínima Viable (MVE sin bloqueo):** El visor de Rewinds actual muestra los clips públicos generados por GitHub Actions. Si se desea monetizar, la visualización sigue siendo libre, pero se ofrece un enlace de "Descargar clip en HD/conservar vídeo" mediante micro-donación o apoyo al proyecto.
* **Contraste con el código actual:** `scripts/rewind.py` ya almacena clips en releases de GitHub y `data/rewinds.json`. No se inventa almacenamiento nuevo; se explota el existente.

---

### Hipótesis 3: Calibrador Personal de Calidad ("Mi Nivel / Mi Quiver")
* **Enunciado:** *Si permitimos que el usuario ajuste la escala de calidad en su navegador (por ejemplo, alguien con longboard prefiere olas de 0,4 m con poco viento antes que olas de 1,2 m huecas), el valor percibido del diagnóstico se multiplicará.*
* **Perfil de usuario:** Surfistas de diferentes modalidades (longboard, corcho, shortboard, principiantes) a quienes la escala estándar fija no les resulta óptima.
* **Señal de validación (Métrica):** Al menos un 20 % de los usuarios recurrentes modifican los deslizadores de preferencia en los ajustes locales.
* **Experiencia Mínima Viable (MVE sin bloqueo):** En la configuración de la PWA, añadir tres perfiles: "Principiante/Longboard" (bonifica mar pequeño y limpio), "Estándar" y "Shortboard/Exigente" (penaliza periodos menores de 5s). Persistencia 100 % en `localStorage`.
* **Contraste con el código actual:** La función `calcularCalidad()` en `js/forecast.js` utiliza umbrales fijos (0.2 m, 0.5 m, 0.9 m, periodos 6s/8s). Parametrizar estos coeficientes desde `localStorage` requiere menos de 30 líneas de código y no cuesta nada.

---

### Hipótesis 4: El Cuaderno de Baños Inteligente ("Mi Histórico de Sesiones")
* **Enunciado:** *Si convertimos el formulario actual de `votar.html` en un diario personal de surf con estadísticas (días surfeados al mes, spots más frecuentados y tasa de acierto de la previsión), la fidelidad de uso se disparará.*
* **Perfil de usuario:** Surfista local comprometido que lleva cuenta de sus baños y quiere aprender qué condiciones reales corresponden a lo que preveía el modelo.
* **Señal de validación (Métrica):** Más de 5 reportes de baño registrados por usuario activo en una temporada de otoño/invierno.
* **Experiencia Mínima Viable (MVE sin bloqueo):** Visualización en la propia PWA de las sesiones guardadas en `localStorage` (actualmente `msc_sessions`), con opción de exportar a CSV/JSON o compartir una tarjeta resumen gráfica en redes sociales.
* **Contraste con el código actual:** `votar.html` ya almacena la fecha, spot, tamaño, calidad y comentarios en `localStorage`. La funcionalidad de captura de datos está hecha; solo falta el panel de visualización.

---

### Hipótesis 5: La Matriz Comparadora Multi-Spot ("¿Adónde voy?")
* **Enunciado:** *Si ofrecemos una vista comparativa en cuadrícula que ponga frente a frente en una sola pantalla los 3 spots principales de una franja horaria (ej. Benicàssim vs Grao vs Burriana para el sábado a las 8:00), los usuarios ahorrarán tiempo de decisión y aumentará la recurrencia.*
* **Perfil de usuario:** Surfistas que viajan en coche desde el interior o se desplazan entre pueblos costeros de Castellón.
* **Señal de validación (Métrica):** La vista comparativa recibe al menos 2 accesos por usuario único cada viernes y sábado previo a una entrada de mar.
* **Experiencia Mínima Viable (MVE sin bloqueo):** Una pestaña adicional en el router `#compare` que permite elegir 2 o 3 spots de la lista existente y renderiza sus tarjetas "Ahora" y previsión a 24 horas en columnas paralelas.
* **Contraste con el código actual:** El catálogo `spots.js` y el parseador de `forecast.js` ya manejan las peticiones simultáneas; la lógica visual se apoya en los componentes CSS existentes.

---

### Hipótesis 6: Mecenazgo Comunitario Local ("Club Amigos de MeteoSurf")
* **Enunciado:** *Si habilitamos una pasarela de mecenazgo voluntario (Ko-fi, Buy Me a Coffee o GitHub Sponsors a 1 € - 3 €/mes o aportación única) explicando con total transparencia que los fondos sostienen el dominio, las automatizaciones y las pruebas de cámaras, una base leal de usuarios aportará fondos sin necesidad de un muro de pago.*
* **Perfil de usuario:** Surfistas locales veteranos y simpatizantes del proyecto que valoran tener una herramienta específica para Castellón sin publicidad intrusiva.
* **Señal de validación (Métrica):** Al menos un 1,5 % de los usuarios activos mensuales realizan una donación de cualquier importe tras 60 días de campaña visible pero discreta.
* **Experiencia Mínima Viable (MVE sin bloqueo):** Un botón discreto en el pie de página o en la vista de información ("Invitar a una parafina") que lleva a un enlace de donación directa, ofreciendo como agradecimiento un tema de color exclusivo en la app o una mención de honor en `CREDITOS.md`.
* **Contraste con el código actual:** `CREDITOS.md` ya existe en el proyecto. No requiere backend ni almacenamiento; se integra mediante un enlace estático externo.

---

## 6. Declaración de Incertidumbres y Límites del Estudio

1. **Volumen de audiencia real no auditado:** Al no disponer de analíticas de terceros (como Google Analytics o Plausible) activas en el repositorio para preservar la privacidad y el coste 0, se desconoce el volumen exacto de usuarios únicos diarios (DAU) que visitan `MeteoSurf_Cs`.
2. **Elasticidad precio en la costa de Castellón:** La comunidad surfista de Castellón es apasionada pero numéricamente reducida en comparación con regiones como el País Vasco, Cantabria o Canarias. Un modelo de pago cerrado (*paywall*) sobre un nicho reducido provocaría casi con total seguridad el abandono masivo hacia Windguru o Windy gratuitos.
3. **Persistencia de los flujos de vídeo:** Las emisiones en directo de Turisme Comunitat Valenciana están sujetas a decisiones administrativas ajenas. Si las cámaras públicas cambian su infraestructura de entrega hacia esquemas cerrados con token temporal, el catálogo de vídeo de MeteoSurf se verá afectado.

---

## 7. Recomendación de Prioridades para Producto

Basándonos en la relación entre **impacto de retención**, **factibilidad técnica** y **riesgo de incumplimiento**:

```text
PRIORIDAD ALTA (Inmediata - Retención sin fricción):
  ├── 1. Matriz comparativa multi-spot (#compare) en el frontend.
  ├── 2. Calibrador de preferencias personales (Longboard / Shortboard) en localStorage.
  └── 3. Botón de mecenazgo voluntario ("Invita a una parafina") con transparencia de costes.

PRIORIDAD MEDIA (Medio plazo - Validación de interés):
  ├── 4. Panel visual del diario de sesiones (aprovechando datos de votar.html).
  └── 5. Recordatorio/evento de calendario (.ics) ante ventanas de oleaje óptimo.

PROHIBIDO / DESCARTADO:
  ├── ✕ Implementar muro de pago (paywall) sobre previsiones o cámaras públicas.
  ├── ✕ Prometer alertas críticas 24/7 sin backend dedicado.
  └── ✕ Contratar servicios de vídeo o APIs meteorológicas de pago mensual.
```

### Conclusión Estratégica
El verdadero diferencial competitivo de MeteoSurf no es competir con el músculo financiero de Surfline, sino ser **el radar hiperlocal más honesto, rápido y específico de la costa de Castellón**. Su modelo de viabilidad debe asentarse en el **orgullo de comunidad y la utilidad pura**, apoyándose en la retención orgánica y el mecenazgo voluntario antes de cualquier intento de privatización de contenidos.

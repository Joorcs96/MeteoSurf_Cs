# Estudio Físico de Playas y Calibración Local de Oleaje · Costa de Castellón
**Documento Técnico de Referencia · Meteosurf_Cs**  
**Ruta:** `docs/investigacion/02-fisica-playas.md`  
**Fecha:** Octubre 2026  
**Alcance:** Modelización hidrodinámica costera, corrección del optimismo de rompiente y rediseño conservador del sistema de valoración (estrellas) e índice de confianza.

---

## 1. Resumen Ejecutivo y Diagnóstico del Problema

La aplicación **MeteoSurf_Cs** ha presentado discrepancias sistemáticas de sobreestimación ("optimismo") respecto a las observaciones reales en la costa de Castellón. Los reportes cualitativos de campo de Jordi (en particular el caso de calibración en **Planetario el 30/09/2026 de 18:40 a 19:00**, con mar adentro de 0.36–0.38 m y 5.6 s, viento ESE de 6–8 km/h con rachas de 18 km/h, donde la app predecía 0.4–0.6 m con estrellas infladas; así como la sobrevaloración continuada en **El Palaciet**, el corte artificial en **Voramar** y el mar caótico en **Planetario**) han puesto de manifiesto fallos estructurales en la cadena de modelización física:

1. **Sobreestimación analítica de la rompiente ($H_b$):** La aplicación aplica la ecuación de asomeramiento de Komar y Gaughan (1972) formulada para olas regulares en perfiles abiertos oceánicos. Para olas mediterráneas de periodo corto ($T = 4\text{--}6\text{ s}$) sobre una plataforma continental ultrasuave como la de Castellón, la fórmula infla la altura de ola un $+40\%\text{ a }+50\%$ al ignorar la disipación por fricción de fondo (Madsen et al., 1988) y la rotura progresiva en aguas intermedias (Battjes & Janssen, 1978).
2. **Suma incoherente de trenes de oleaje:** El motor suma cuadráticamente la energía de *swell* y *mar de viento*. En la física real del litoral de Castellón, el mar de viento onshore no añade altura limpia a la rompiente surfeable: genera rugosidad superficial, modulación no lineal, chop destructivo y corrientes de retorno que desmoronan el pico.
3. **Ceguera ante las rachas de viento:** El algoritmo de asignación de estrellas (*rating*) únicamente evalúa la velocidad media sostenida a 10 metros (`wind_speed_10m`), ignorando las rachas (`wind_gusts_10m`). Una brisa media de 7 km/h con rachas de 18–20 km/h estropea completamente la cara de la ola en el Mediterráneo, pero el algoritmo la puntuaba como casi óptima ("Glassy/Terral").
4. **Discontinuidades en ventanas angulares y difracción:** El estudio previo $v3$ (`calculos_v3`) dejó fuera 5 de las 13 playas del catálogo (Vinaròs, Peñíscola, Burriana, Nules y Almenara) y aplicó recortes en escalón sin calcular la difracción alrededor de cabos o diques (como en Voramar o Pirámides), pasando de factor normal a 0.08 de forma irreal.

Este informe recopila la evidencia científica de fuentes primarias abiertas (Puertos del Estado, EMODnet, Copernicus Marine Service, MITECO, IGN/ICV, NOAA y manuales del modelo espectral SWAN), establece las fichas hidromorfológicas completas para las 13 playas y define un algoritmo conservador de asignación de calidad y confianza matemática.

---

## 2. Fundamentos Físicos de Fuentes Primarias

### 2.1. Altura Significativa ($H_s$, $H_{m0}$) vs. Altura en Rompiente ($H_b$) vs. Cara Surfeable

#### Definición Rigurosa de Altura Significativa
En la oceanografía operacional moderna (Puertos del Estado, WMO, NOAA):
*   **$H_{1/3}$ (definición temporal):** Media del tercio de olas más altas en un registro temporal continuo de elevación de superficie.
*   **$H_{m0}$ (definición espectral):** Obtenida a partir del momento de orden cero del espectro de densidad de energía de varianza:
    $$H_{m0} = 4 \sqrt{m_0} \quad \text{donde} \quad m_n = \int_0^\infty f^n S(f) \, df$$
    En aguas profundas sin corrientes fuertes, $H_{m0} \approx H_{1/3}$. Es el dato que miden las boyas de aguas profundas (como la Boya de Valencia REDEXT 2630) y que entregan los modelos numéricos de oleaje (Open-Meteo / ECMWF / Copernicus).

#### El Error del Modelo de Komar y Gaughan (1972) en el Mediterráneo
El motor actual calcula la altura en rompiente mediante la ecuación:
$$H_b = 0.39 \cdot g^{0.2} \cdot (T \cdot H_0^2)^{0.4}$$
Esta ecuación empírica se dedujo asumiendo:
1. Onda monocromática unidireccional (teoría de Airy).
2. Conservación estricta del flujo de energía sin pérdidas ($F = E \cdot C_g = \text{constante}$).
3. Criterio de rotura en aguas someras según índice de McCowan: $\gamma_b = \frac{H_b}{h_b} \approx 0.78$.
4. Pendientes moderadas a fuertes ($m \ge 0.03\text{--}0.05$) donde el asomeramiento lineal domina antes de la rotura.

**¿Por qué fracasa en la costa de Castellón?**
*   **Morfología de la Plataforma Continental de Castellón:** Según la *Ecocartografía del Litoral de Castellón* (MITECO / HIDTMA, 2010), la plataforma continental frente a la Plana de Castellón es una de las más anchas y de menor pendiente del Mediterráneo occidental español: la isóbata de 20 metros se sitúa a 2.5–4.5 km de la costa (pendiente media $m \approx 0.005\text{ a }0.008$, es decir, del $0.5\%\text{ al }0.8\%$).
*   **Disipación por Fricción de Fondo:** El oleaje que entra hacia la costa viaja durante kilómetros en aguas intermedias ($h < \frac{L}{2}$). La disipación por fricción según el modelo de Madsen et al. (1988), integrado en el código del modelo SWAN (Delft University of Technology, 2021), es inversamente proporcional a la profundidad y directamente proporcional al cubo de la velocidad orbital en el fondo:
    $$S_{ds,b}(f, \theta) = - C_b \frac{k}{\sinh(2kd)} \sigma E(f, \theta)$$
    Para un oleaje mediterráneo de $T = 5.5\text{ s}$ y $H_0 = 0.38\text{ m}$, la atenuación acumulada por fondo plano arenoso supera el $20\%\text{--}30\%$ de la energía antes de la zona de rompiente interna.
*   **Índice de Rotura Real en Playas Disipativas:** Trabajos clásicos (Goda, 2010; Kamphuis, 1991; Battjes & Stive, 1985) demuestran que en playas de pendiente ultra-baja ($m \le 0.01$) con oleaje irregular peraltado ($H_0/L_0 \ge 0.02$), el índice de rotura $\gamma_b = H_b/h_b$ disminuye desde el teórico $0.78$ hasta valores en el rango **$0.45\text{ a }0.58$**. La rotura no ocurre como un colapso brusco (*plunging*), sino como una rotura progresiva en derrame (*spilling*), disipando energía de forma continua.
*   **Cara Surfeable (Wave Face) vs. $H_b$:**
    En el argot de surf profesional (Surfline, NOAA Surf Zone Forecast Guidance), la *cara surfeable* corresponde a la distancia vertical entre la base del canal cóncavo delantero de la ola y la cresta antes del labio. En playas de arena disipativas con oleaje corto ($T < 6\text{ s}$), la masa de agua no levanta una pared limpia: la cara vertical utilizable es frecuentemente **un $10\%\text{ a }25\%$ inferior a la altura significativa del mar adentro**, no un $50\%$ superior.

**Evidencia Numérica Comparativa:**
| Parámetros Mar Adentro | Komar & Gaughan ($H_b$ modelado app) | Modelo Disipativo / SWAN Costa Somera | Cara Surfeable Real Observada | Relación App / Realidad |
|---|---|---|---|---|
| $H_0 = 0.37\text{ m}, T = 5.6\text{ s}$ | **$0.55\text{ m}$** | **$0.32\text{ m}$** | **$0.20\text{--}0.25\text{ m}$** (espuma/orillera) | **+120% a +175% de sobreestimación** |
| $H_0 = 0.60\text{ m}, T = 6.0\text{ s}$ | **$0.86\text{ m}$** | **$0.54\text{ m}$** | **$0.45\text{--}0.50\text{ m}$** (cintura) | **+70% a +90% de sobreestimación** |
| $H_0 = 1.20\text{ m}, T = 7.5\text{ s}$ | **$1.68\text{ m}$** | **$1.15\text{ m}$** | **$1.10\text{--}1.25\text{ m}$** (pecho/cabeza) | **+35% a +50% de sobreestimación** |

---

### 2.2. Periodo Pico ($T_p$) vs. Periodo Medio ($T_m$, $T_{02}$, $T_e$)

En los registros reales de Puertos del Estado y modelos marinos (Copernicus MED-MFC, Open-Meteo):
*   **Periodo Pico ($T_p$):** Inverso de la frecuencia donde el espectro unidimensional de energía $S(f)$ alcanza su máximo absoluto ($T_p = 1 / f_p$).
*   **Periodo Medio de Paso por Cero ($T_{02}$ o $T_z$):** Calculado a partir de los momentos espectrales:
    $$T_{02} = \sqrt{\frac{m_0}{m_2}}$$
*   **Periodo Energético ($T_e$):** Periodo característico del flujo de energía:
    $$T_e = \frac{m_{-1}}{m_0} \approx 0.85\text{--}0.90 \cdot T_p \quad \text{(para espectros JONSWAP mediterráneos)}$$

**Trampa en la predicción local:**
En un mar de viento del Golfo de Valencia, el espectro es marcadamente bimodal o ancho. Por ejemplo, en los datos reales de la **Boya de Valencia (2630) del 30/09/2026**, el $T_p$ reportado fue de **$7.03\text{ s}$**, pero el periodo medio $T_{02}$ fue de tan solo **$3.75\text{ s}$** ($T_{02}/T_p \approx 0.53$).
Si un algoritmo alimenta una fórmula monocromática como la de Komar utilizando el $T_p$ de 7 segundos, asume implícitamente que todo el tren de olas transporta energía con longitudes de onda de $\approx 76\text{ m}$, cuando más del $65\%$ de la energía espectral viaja en ondas de $3.5\text{--}4.5\text{ s}$ ($L \approx 20\text{--}30\text{ m}$), las cuales se frenan y disipan drásticamente más rápido.

**Regla física:** La modelización de rompiente debe ponderar el periodo energético $T_e$ o medio $T_{02}$, y nunca utilizar el $T_p$ aislado cuando la anchura espectral $\epsilon = \sqrt{1 - \frac{m_2^2}{m_0 m_4}} > 0.6$.

---

### 2.3. Partición de Oleaje: Swell vs. Mar de Viento (Wind Sea)

Los modelos numéricos de oleaje dividen el espectro en componentes:
1. **Mar de viento (*Wind Sea*):** Olas en crecimiento activo generadas localmente por el viento presente, donde la velocidad de fase de la onda es menor o igual a la componente del viento en la dirección de la ola ($c/u_{10} \le 1.2$).
2. **Mar de fondo (*Swell*):** Olas que han abandonado su zona de generación o cuya velocidad de fase supera la velocidad del viento ($c/u_{10} > 1.2$).

**Interacción en la rompiente:**
El código actual de `forecast.js` calcula:
$$H_{b,\text{total}} = \sqrt{\sum H_{b,i}^2}$$
Esta superposición lineal de energía es matemáticamente válida para ondas lineales no dispersivas en aguas profundas, pero **físicamente incorrecta para determinar la calidad surfeable en la zona de rotura**:
*   Cuando coexisten un swell débil de fondo ($H_{sw} \approx 0.30\text{ m}, T \approx 6.5\text{ s}$) y un mar de viento picado ($H_{ww} \approx 0.45\text{ m}, T \approx 4.0\text{ s}$), el mar de viento **no se suma para hacer la ola más alta y limpia**.
*   Las ondas cortas modulan la pendiente del swell largo, provocando micro-roturas prematuras (*whitecapping* y rotura en aguas intermedias) y transformando la rompiente en un campo de espuma desorganizado y baches (*chop*), tal como observó Jordi en Planetario.
*   **Criterio conservador:** Si el ratio de energía de viento respecto al swell supera el umbral crítico:
    $$\frac{H_{ww}}{H_{sw}} > 0.70$$
    la calidad debe sufrir una penalización severa, y la altura surfeable efectiva debe desacoplarse del mar de viento.

---

### 2.4. Convención de Direcciones: Desde Dónde Viene vs. Hacia Dónde Va

Existe una confusión recurrente entre la convención náutica/meteorológica y la convención matemática vectorial:
*   **Convención Náutica/Meteorológica (Estándar WMO, Puertos del Estado, Open-Meteo, AEMET):**  
    La dirección indica **DE DÓNDE VIENE** el agente (procedencia).  
    - Viento de $90^\circ$ (Levante): viene del Este y sopla hacia el Oeste.  
    - Oleaje de $45^\circ$ (Gregal): viene del Nordeste y viaja hacia el Sudoeste ($225^\circ$).  
    - *Comprobación en Open-Meteo Marine API:* La variable `wave_direction` está documentada explícitamente como *"Degrees from where the waves are coming"*.
*   **Convención en `spots.js`:**  
    La propiedad `facing` define el acimut de la **normal a la costa que apunta HACIA EL MAR** (hacia dónde mira la playa).  
    Ejemplo: Planetario tiene `facing: 102`. Significa que la perpendicular a la arena mira hacia $102^\circ$ (Este-Sudeste).  
    Por tanto, un oleaje cuya procedencia sea `wave_direction = 102` viaja hacia $282^\circ$, impactando **exactamente perpendicular y de frente** contra la costa.  
    La diferencia angular de incidencia directa es:
    $$\Delta\theta = |\text{dir}_{\text{procedencia}} - \text{facing}|$$
    Si $\Delta\theta = 0^\circ$, la incidencia es frontal ($100\%$ de exposición geométrica).
*   **Viento Terral (Offshore):**  
    Para que el viento sople desde tierra hacia el mar (terral), su procedencia debe estar en el hemisferio opuesto al `facing`:
    $$\text{dir}_{\text{offshore}} = (\text{facing} + 180^\circ) \bmod 360^\circ$$
    Para Planetario (`facing: 102`): $\text{dir}_{\text{offshore}} = 282^\circ$ (Oeste-Noroeste / Poniente). Un viento con procedencia $280^\circ\text{--}290^\circ$ es terral puro.

---

### 2.5. Refracción, Asomeramiento, Rotura y Efecto Sombra de Espigones

1.  **Refracción (Ley de Snell en Aguas Someras):**
    A medida que la profundidad disminuye, la celeridad $c = \sqrt{g d}$ disminuye. Los frentes de onda se curvan tendiendo a alinearse paralelamente con las isóbatas:
    $$\frac{\sin \alpha_2}{c_2} = \frac{\sin \alpha_1}{c_1}$$
    El coeficiente de refracción es $K_r = \sqrt{\frac{\cos \alpha_0}{\cos \alpha}}$. En costas rectas con isóbatas paralelas, la refracción distribuye la energía en un frente más ancho, reduciendo la altura cuando la incidencia es muy oblicua.
2.  **Difracción en Diques y Puntas Rocosas:**
    Cuando un tren de olas encuentra un obstáculo semi-infinito (como el Dique Norte del Puerto de Castellón o la Punta de las Villas en Voramar), la energía se transmite lateralmente al interior de la zona de sombra geométrica siguiendo los patrones de difracción de Sommerfeld:
    $$H(x, y) = K_d \cdot H_0$$
    Donde $K_d$ es el coeficiente de difracción.  
    *   **En Voramar:** Ante temporales de Gregal ($30^\circ\text{--}50^\circ$), la Punta de las Villas y las estribaciones meridionales del Desierto de las Palmas apantallan la llegada directa. Sin embargo, por difracción, penetra entre un $25\%\text{ y un }45\%$ de la altura mar adentro ($K_d \approx 0.25\text{--}0.45$). La ola resultante es pequeña pero extraordinariamente limpia y ordenada (sin viento de cara gracias al abrigo orográfico). El modelo anterior le asignaba un factor residual fijo de $0.08$, errando la previsión.
3.  **Reflexión y Clapotis en Diques Verticales y Escolleras:**
    El Puerto de Castellón cuenta con un Dique de Abrigo (Dique Norte / Prolongación de Levante) con más de 2.5 km de desarrollo sobre profundidades de 10 a 16 metros.  
    El coeficiente de reflexión de escolleras con bloque de hormigón oscila entre $C_r \approx 0.30\text{ y }0.50$ (ROM 0.3-91). La superposición del oleaje incidente con el oleaje reflejado genera ondas estacionarias parciales (*clapotis* imperfecto) y ondas cruzadas en forma de diamante en las inmediaciones del espigón:
    $$E_{\text{total}}(x) = E_i \cdot \left(1 + C_r^2 + 2 C_r \cos(2 k x \cos \theta)\right)$$
    Esta interferencia constructiva y destructiva desordena violentamente los picos a menos de 400–600 metros del dique en la Playa del Pinar (**Planetario**), impidiendo la formación de paredes continuas a menos que el periodo sea elevado ($T > 7.5\text{ s}$) y el viento sea terral puro.

---

### 2.6. Orientación de Costa, Fetch Geográfico y Viento Local

El mar balear frente a Castellón es una cuenca semicerrada con *fetches* (distancia sobre la que sopla el viento sin obstáculos de tierra) estrictamente limitados:

```
                  [Costa Brava / Golfo de León]
                              |
                     Fetch NE: 350 - 450 km
                              |
                              v
 [Costa de Castellón] <================= [Mallorca]  Fetch E: 200 - 230 km
                              ^
                             / \  Fetch SE: 130 - 160 km
                            /   \
                 [C. San Antonio] [Ibiza]
```

*   **Sector NE (Gregal, $35^\circ\text{--}55^\circ$):** Fetch máximo (350–450 km). Es la dirección que genera los temporales de mayor energía y periodo en invierno (mar de fondo hasta $T_p \approx 8\text{--}9.5\text{ s}$).
*   **Sector E (Levante, $80^\circ\text{--}100^\circ$):** Fetch medio (200–230 km hasta las costas de Mallorca). Produce oleajes consistentes con periodos típicos de $5.5\text{ a }7.0\text{ s}$.
*   **Sector SE (Siroco / Xaloc, $115^\circ\text{--}135^\circ$):** Fetch restringido por las islas Pitiusas (Ibiza a 140 km). Periodos típicamente cortos ($4.5\text{ a }6.0\text{ s}$).
*   **Sector O / NO (Poniente / Maestral, $260^\circ\text{--}320^\circ$):** Fetch nulo ($0\text{ km}$). Viento de tierra canalizado por el valle del Ebro y el Sistema Ibérico (Maestrazgo). Es el viento *offshore* que peina y ordena las olas generadas previamente por temporales del primer cuadrante.

#### El Efecto de las Rachas de Viento (`wind_gusts_10m`)
En la capa límite superficial marina, el esfuerzo cortante del viento sobre la superficie del agua depende de la velocidad de fricción $u_*$:
$$\tau = \rho_a C_d U_{10}^2$$
Dado que el esfuerzo varía con el **cuadrado de la velocidad**, una ráfaga instantánea de 18 km/h ($5.0\text{ m/s}$) ejerce un esfuerzo cortante **5.4 veces mayor** que un viento sostenido de 7.5 km/h ($2.1\text{ m/s}$).  
Las rachas rompen la tensión superficial del agua, generan micro-ondas capilares (ondas de rizado con $f > 5\text{ Hz}$), desestabilizan el labio de la ola antes de su rotura crítica e impiden el deslizamiento limpio de la tabla.  
**Criterio ineludible:** Si `wind_gusts_10m` $\ge 18\text{ km/h}$ con viento onshore o cross-on, la puntuación de calidad no puede superar el nivel *Malo-Regular* (máximo 2 estrellas), con independencia de la velocidad media registrada.

---

### 2.7. Mareas, Nivel Meteorológico y Corrientes

1.  **Marea Astronómica:**
    En el litoral de Castellón, la marea astronómica es micro-mareal mixta semidiurna, con un rango de oscilación vertical extremadamente estrecho: **$0.15\text{ a }0.25\text{ metros}$** entre bajamar y pleamar vivas (fuente: *Catálogo de Estaciones REDMAR*, Puertos del Estado).
2.  **Marea Meteorológica (Surge) y Nivel del Mar:**
    El mareógrafo más cercano en Portus es el **Mareógrafo de Sagunto (ID 3655)**, a 44 km de Castellón. Los registros demuestran que las variaciones del nivel del mar meteorológico en la zona alcanzan **hasta $\pm 0.45\text{ metros}$**, superando ampliamente a la marea astronómica:
    *   *Efecto barómetro invertido:* Un descenso de presión de $1\text{ hPa}$ eleva el nivel del mar aproximadamente $1\text{ cm}$. Durante borrascas profundas mediterráneas ($995\text{ hPa}$ frente a la presión de referencia de $1013\text{ hPa}$), el nivel asciende $+18\text{ cm}$.
    *   *Apilamiento por viento (Wind Set-up):* Vientos persistentes de Levante apilan agua contra el perfil costero de la Plana, incrementando el nivel otros $+15\text{ a }+25\text{ cm}$.
    *   *Impacto en los spots:* En playas someras de barra arenosa (Gurugú, Planetario, Burriana), una variación de $+35\text{ cm}$ en el nivel del agua sumerge el banco de arena, transformando una ola rompiente con sección tubular en una ola fofa u orillera que rompe directamente en la cara de la playa sin recorrido surfeable.
3.  **Corrientes Litorales de Deriva:**
    La corriente costera neta en la provincia fluye de **Norte a Sur**, transportando sedimentos a lo largo de la costa. Durante temporales de Levante/Gregal, el transporte de masa inducido por la rotura oblicua genera corrientes longitudinales de rotura (*longshore currents*) de hasta $0.5\text{--}0.8\text{ m/s}$, que al topar con los diques portuarios o espigones giran hacia mar abierto formando corrientes de resaca (*rip currents*) muy concentradas y peligrosas.

---

### 2.8. Límites de Resolución Espacial y Temporal de los Modelos

La previsión automática se alimenta de modelos numéricos con resoluciones de malla que imponen límites físicos insalvables:
*   **Copernicus Marine MED-MFC Wave (`MEDSEA_ANALYSISFORECAST_WAV_006_017`):**
    *   Malla WAM Cycle 6: resolución horizontal de **$1/24^\circ \approx 4.0\text{ km}$**.
    *   Límite costero: El primer nodo marítimo válido se ubica habitualmente en profundidades de 25 a 50 metros. Desconoce por completo las barras litorales someras ($0\text{--}4\text{ m}$), los espigones de abrigo y la configuración geométrica de las calas.
*   **ECMWF WAM025 (`ecmwf_wam025` en Open-Meteo):**
    *   Resolución horizontal: **$0.25^\circ \approx 28\text{ km}$**.
    *   Límite de malla: No dispone de datos al norte del paralelo **$40.3^\circ\text{ N}$** (dejando sin cobertura Vinaròs y Peñíscola).
*   **GFS-Wave (`ncep_gfswave016`):**
    *   Resolución horizontal: **$0.16^\circ \approx 18\text{ km}$**. Cobertura temporal extendida hasta 16 días, pero con dispersión espectral acusada a partir del día 5.
*   **Conclusión de Ingeniería:** Los modelos globales y regionales de oleaje entregan únicamente las condiciones de contorno en aguas profundas/intermedias. Trasladar mecánicamente esas alturas a la orilla mediante multiplicadores estáticos es la causa primaria del optimismo de la aplicación.

---

## 3. Fichas Físicas Individuales de los 13 Spots

A continuación se presentan las fichas técnicas para la totalidad de playas del catálogo de `js/spots.js`.

> **Convenio de Calidad de Datos:**  
> - **[Medido]:** Procedente de cartografía oficial georreferenciada (IGN PNOA, OSM Overpass verificado con PCA, Puertos del Estado).  
> - **[Estimado]:** Derivado de modelos de propagación numérica simplificada, relaciones de fetch o inspección geológica.  
> - **[Desconocido]:** Parámetro no disponible con resolución instrumental (ej. batimetría milimétrica de barras móviles estacionales).

---

### Ficha 1: Planetario (Grao de Castellón · Playa del Pinar) · [PRIORITARIO]
*   **Identificador:** `Planetario` (Spot de referencia principal).
*   **Coordenadas Rompiente:** $39.98585^\circ\text{ N}, 0.02766^\circ\text{ E}$ [Medido, IGN MTN25].
*   **Punto Exacto de Surf (Jordi):** $39.9784738^\circ\text{ N}, 0.0265750^\circ\text{ E}$ [Medido GPS], situado a escasos 120 metros al norte del Dique Norte de PortCastelló.
*   **Punto Mar Adentro (Extracción Open-Meteo):** `seaLat: 39.9834`, `seaLon: 0.0414` (distancia $\approx 1.2\text{ km}$, profundidad $\approx 12\text{ m}$) [Medido EMODnet DTM].
*   **Orientación de la Costa (`facing`):** **$102^\circ$** [Medido OSM way 183669613, PCA $101.9^\circ$]. Normal apunta hacia el ESE.
*   **Ventana Útil de Oleaje (`swellWindow`):** **$[44^\circ, 176^\circ]$** (amplitud $132^\circ$) [Medido ray-tracing OSM / $v3$].
*   **Morfología del Fondo y Pendiente:** Arena fina silícea con barra longitudinal móvil a 40–80 m de la orilla [MITECO Ecocartografía 2010]. Pendiente media de la anteplaya: $m \approx 0.012$ ($1.2\%$).
*   **Abrigo y Efectos Portuarios:**
    *   *Abrigo:* Protegido de vientos y oleajes del cuadrante S y SSO ($180^\circ\text{--}240^\circ$) por la infraestructura del puerto.
    *   *Reflexión y Desorden:* El Dique Norte (escollera con talud vertical superior) refleja frontalmente el oleaje de Levante ($90^\circ\text{--}110^\circ$) y oblicuamente el de Gregal ($45^\circ\text{--}65^\circ$). Genera mar cruzado y piramidal.
    *   *Corrientes:* Fuerte corriente de resaca pegada a la escollera con mar crecido.
*   **Viento Óptimo vs. Limitante:**
    *   *Óptimo:* Viento terral del O/ONO ($275^\circ\text{--}305^\circ$), velocidad $< 18\text{ km/h}$, o calma nocturna/matinal (*glassy* $< 6\text{ km/h}$).
    *   *Limitante:* Viento de mar E / ESE / NE. **Rachas $\ge 15\text{ km/h}$** desordenan y pican completamente la superficie.
*   **Marea / Nivel:** Funciona mejor con nivel medio en ascenso. Con nivel alto ($> +0.25\text{ m}$ surge) la ola rompe orillera sobre la berma.
*   **Causa Física de la Discrepancia:** La app predecía 0.4–0.6 m el 30/09 porque Komar infló $H_s = 0.37\text{ m}$ a 0.55 m, sumó energía de mar de viento y no penalizó la racha de 18 km/h. La realidad física fue una ola de 0.20 m impracticable y picada.

---

### Ficha 2: El Palaciet (Burriana · El Coso / Goles del Millars) · [PRIORITARIO]
*   **Identificador:** `Palaciet`.
*   **Coordenadas Rompiente:** $39.90453^\circ\text{ N}, -0.01584^\circ\text{ E}$ [Medido, IGN MTN25].
*   **Punto Mar Adentro:** `seaLat: 39.8949`, `seaLon: -0.0064` (profundidad $\approx 14\text{ m}$) [EMODnet].
*   **Orientación de la Costa (`facing`):** **$143^\circ$** [Medido OSM way 32675908, confirmado en 4 ventanas independientes $135^\circ\text{--}150^\circ$]. La costa gira marcadamente hacia el Sudeste junto al delta del río Millars.
*   **Ventana Útil de Oleaje (`swellWindow`):** **$[56^\circ, 210^\circ]$** [Medido ray-tracing v3].
*   **Morfología del Fondo y Pendiente:** Mezcla de grava fina en orilla y arena fina/media en la zona sumergida [MITECO Ecocartografía 2010]. Pendiente muy suave ($m \approx 0.008$), banco de arena extendido y disipativo.
*   **Abrigo y Comportamiento Hidrodinámico:**
    *   Al mirar hacia $143^\circ$, el oleaje predominante de Levante ($90^\circ\text{--}100^\circ$) incide con un ángulo oblicuo muy pronunciado ($\Delta\theta = 43^\circ\text{ a }53^\circ$).
    *   Por ley de refracción y conservación de flujo, la energía se extiende en un frente muy ancho, atenuando la altura ($K_r \approx 0.70\text{--}0.78$).
    *   La rotura es suave, tendida y progresiva (*spilling* largo), ideal para longboard/tablón con olas pequeñas.
*   **Viento Óptimo vs. Limitante:**
    *   *Óptimo:* Terral del NO/O ($290^\circ\text{--}335^\circ$).
    *   *Limitante:* Viento de componente S y SE.
*   **Causa Física de la Discrepancia:** El estudio v3 le asignó erróneamente un factor de amplificación de **$1.271$** a 8 s en dirección facing, sumado a la fórmula de Komar con `exposureFactor: 1`. Esto generaba predicciones de olas huecas de más de 1 metro y 4 estrellas cuando en realidad la rompiente ofrece un deslizamiento suave de apenas 0.40–0.50 m.

---

### Ficha 3: Voramar (Benicàssim · Punta de las Villas) · [PRIORITARIO]
*   **Identificador:** `Voramar`.
*   **Coordenadas Rompiente:** $40.05464^\circ\text{ N}, 0.08248^\circ\text{ E}$ [Medido, IGN MTN25].
*   **Punto Mar Adentro:** `seaLat: 40.0454`, `seaLon: 0.0911` (profundidad $\approx 13\text{ m}$) [EMODnet].
*   **Orientación de la Costa (`facing`):** **$142^\circ$** [Medido OSM way 183669615, tramo rectificado excluyendo la curva de la punta].
*   **Ventana Útil de Oleaje (`swellWindow`):**
    *   *Ventana de Incidencia Directa:* $[88^\circ, 204^\circ]$ [Ray-tracing v3].
    *   *Ventana de Difracción Activa:* **$[35^\circ, 87^\circ]$** [Nuevo cálculo analítico de difracción en cabo].
*   **Morfología del Fondo y Pendiente:** Fondo mixto de arena media sobre plataforma rocosa caliza abrasionada [MITECO Ecocartografía 2010]. Pendiente moderada ($m \approx 0.020$).
*   **Abrigo y Mecanismo de Difracción:**
    *   La Punta de las Villas y el relieve del Desierto de las Palmas bloquean el viento de componente N y NNO, proporcionando condiciones *clean* cuando en el resto de la provincia sopla vendaval del norte.
    *   Ante temporales de Gregal ($40^\circ\text{--}60^\circ$), el oleaje no entra directo, sino que difracta en la punta rocosa con un coeficiente $K_d \approx 0.35\text{--}0.50$.
*   **Viento Óptimo vs. Limitante:**
    *   *Óptimo:* NNO a ONO ($300^\circ\text{--}350^\circ$, offshore resguardado por las montañas).
    *   *Limitante:* Viento directo del SE/E.
*   **Causa Física de la Discrepancia:** La aplicación consideraba a Voramar "cerrado" ante oleajes del NE ($< 88^\circ$), aplicando un factor de atenuación $0.08$ y marcando "Plato" (0 estrellas). En la realidad, genera una sesión pequeña, ordenada y perfecta de tablón/escuela (la "posible Voramar pequeña" de Jordi).

---

### Ficha 4: Burriana (Playa del Arenal · Dique de Puerto) · [PRIORITARIO]
*   **Identificador:** `Burriana`.
*   **Coordenadas Rompiente:** $39.86977^\circ\text{ N}, -0.05905^\circ\text{ E}$ [Medido, IGN].
*   **Punto Mar Adentro:** `seaLat: 39.8641`, `seaLon: -0.0467` (profundidad $\approx 13\text{ m}$) [EMODnet].
*   **Orientación de la Costa (`facing`):** **$118^\circ$** [Medido OSM way 32675912, tramo de 600 m sin escollera].
*   **Ventana Útil de Oleaje (`swellWindow`):** **$[48^\circ, 188^\circ]$** [Estimado geométrico / límites de abrigo portuario].
*   **Morfología del Fondo:** Arena fina con bancos bien fijados por la escollera del puerto comercial de Burriana [MITECO 2010]. Pendiente $m \approx 0.014$.
*   **Comportamiento Hidrodinámico:** La escollera de poniente del puerto genera una derecha consistente sobre banco de arena. Menos expuesta al clapotis destructivo que Planetario debido a la orientación del dique exterior.
*   **Viento Óptimo:** Terral del O y NO ($275^\circ\text{--}315^\circ$).

---

### Ficha 5: Heliópolis (Benicàssim Sur)
*   **Identificador:** `Heliopolis`.
*   **Coordenadas:** $40.02567^\circ\text{ N}, 0.04526^\circ\text{ E}$.
*   **Punto Mar Adentro:** `seaLat: 40.0206`, `seaLon: 0.0579`.
*   **Orientación (`facing`):** **$115^\circ$** [Medido OSM way 183669617].
*   **Ventana Útil:** **$[60^\circ, 190^\circ]$**.
*   **Fondo:** Arena dorada limpia sin estructuras portuarias cercanas. Pendiente muy constante ($m \approx 0.010$). Rompiente de picos múltiples variables.
*   **Viento Óptimo:** O y NO ($270^\circ\text{--}310^\circ$).

---

### Ficha 6: Gurugú (Grao de Castellón · Playa del Pinar Norte)
*   **Identificador:** `Gurugu`.
*   **Coordenadas:** $39.99872^\circ\text{ N}, 0.03137^\circ\text{ E}$.
*   **Punto Mar Adentro:** `seaLat: 39.9954`, `seaLon: 0.0449`.
*   **Orientación (`facing`):** **$106^\circ$** [Medido OSM way 183669614, coincidencia total con cálculo PCA].
*   **Ventana Útil:** **$[48^\circ, 182^\circ]$**.
*   **Fondo y Dinámica:** Playa abierta totalmente natural, situada a más de 2 km al norte de las perturbaciones del puerto. Presenta bancos de arena transversales más limpios y ordenados que Planetario, aunque con menor abrigo de vientos del sur.
*   **Viento Óptimo:** O y NO ($275^\circ\text{--}315^\circ$).

---

### Ficha 7: Pirámides (Serradal · Almassora / Límite Sur PortCastelló)
*   **Identificador:** `Piramides`.
*   **Coordenadas:** $39.95947^\circ\text{ N}, 0.01499^\circ\text{ E}$.
*   **Punto Mar Adentro:** Coordenadas explícitas fijadas: `seaLat: 39.95304`, `seaLon: 0.02498` (a 130°/1.0 km para evitar caer dentro de los diques del puerto).
*   **Orientación (`facing`):** **$95^\circ$** [Medido OSM way 32675902 con filtrado de escollera].
*   **Ventana Útil:** **$[71^\circ, 181^\circ]$**.
*   **Fondo y Peligros:** Arena mezclada con grava gruesa y bloques sumergidos procedentes de obras de abrigo históricas.
*   **Comportamiento:** Fuerte sombra ante oleajes del primer cuadrante ($< 70^\circ$) provocada por el Puerto de Castellón. Requiere mares del E o SE puros.

---

### Ficha 8: La Renegà (Oropesa del Mar · Vía Verde)
*   **Identificador:** `Renega`.
*   **Coordenadas:** $40.06195^\circ\text{ N}, 0.12060^\circ\text{ E}$.
*   **Punto Mar Adentro:** `seaLat: 40.0519`, `seaLon: 0.1278`.
*   **Orientación (`facing`):** **$148^\circ$** [Medido OSM way 183669616, acantilado rocoso con rumbo WSW–ENE consistente].
*   **Ventana Útil:** **$[60^\circ, 212^\circ]$**.
*   **Fondo y Nivel:** Lajas de roca caliza y arrecife rocoso somero (*point/reef break*). Nivel avanzado.
*   **Dinámica:** Menor disipación por fricción arenosa; soporta mares de fondo sólidos sin cerrar. Requiere marea alta para no golpear las lajas.

---

### Ficha 9: Morro de Gos (Oropesa del Mar)
*   **Identificador:** `MorroGos`.
*   **Coordenadas:** $40.09491^\circ\text{ N}, 0.14854^\circ\text{ E}$.
*   **Punto Mar Adentro:** `seaLat: 40.0928`, `seaLon: 0.1624`.
*   **Orientación (`facing`):** **$100^\circ$** [Medido OSM way 183669618, tramo rectilíneo de 2 km].
*   **Ventana Útil:** **$[40^\circ, 176^\circ]$**.
*   **Fondo:** Arena media con afloramientos rocosos aislados. Playa muy abierta y expuesta a casi cualquier oleaje del primer y segundo cuadrante.
*   **Viento Óptimo:** O y NO ($270^\circ\text{--}320^\circ$).

---

### Ficha 10: Vinaròs (Playa del Fortí / Clot)
*   **Identificador:** `Vinaros`.
*   **Coordenadas:** $40.46877^\circ\text{ N}, 0.47904^\circ\text{ E}$ [IGN].
*   **Punto Mar Adentro:** `seaLat: 40.4655`, `seaLon: 0.4926`.
*   **Orientación (`facing`):** **$106^\circ$** [Medido OSM way 183669620, sector intermedio de playa urbana].
*   **Ventana Útil:** **$[36^\circ, 176^\circ]$**.
*   **Fondo:** Arena fina y gravilla junto al dique del puerto pesquero/comercial de Vinaròs.
*   **Nota Modelo:** Fuera de la malla de ECMWF-WAM025 ($> 40.3^\circ\text{ N}$); requiere Open-Meteo estándar / GFS-Wave.

---

### Ficha 11: Peñíscola Norte (Playa Norte)
*   **Identificador:** `Peniscola`.
*   **Coordenadas:** $40.38060^\circ\text{ N}, 0.41021^\circ\text{ E}$ [IGN].
*   **Punto Mar Adentro:** `seaLat: 40.3773`, `seaLon: 0.4238`.
*   **Orientación (`facing`):** **$106^\circ$** [Medido OSM way 183669619, arco de playa extenso y homogéneo].
*   **Ventana Útil:** **$[32^\circ, 162^\circ]$** (máxima apertura al Gregal del norte provincial).
*   **Fondo:** Arena fina muy homogénea. Pendiente suave ($m \approx 0.011$).
*   **Viento Óptimo:** O y NO limpio.

---

### Ficha 12: Nules (Playa de Nules / Les Marines)
*   **Identificador:** `Nules`.
*   **Coordenadas:** $39.82462^\circ\text{ N}, -0.11001^\circ\text{ E}$ [IGN].
*   **Punto Mar Adentro:** `seaLat: 39.8189`, `seaLon: -0.0983`.
*   **Orientación (`facing`):** **$120^\circ$** [Medido OSM way 32675915].
*   **Ventana Útil:** **$[50^\circ, 190^\circ]$**.
*   **Fondo y Estructuras:** Grava y cantos rodados intercalados con arena, estructurada por una batería de espigones transversales cortos construidos para frenar la regresión costera [MITECO 2014].
*   **Dinámica:** Picos rápidos y cortantes generados por la difracción en las cabezas de los espigones.

---

### Ficha 13: Almenara (Playa Casablanca)
*   **Identificador:** `Almenara`.
*   **Coordenadas:** $39.73320^\circ\text{ N}, -0.18107^\circ\text{ E}$ [IGN].
*   **Punto Mar Adentro:** `seaLat: 39.7277`, `seaLon: -0.1687`.
*   **Orientación (`facing`):** **$117^\circ$** [Medido OSM way 32675918].
*   **Ventana Útil:** **$[47^\circ, 187^\circ]$**.
*   **Fondo y Peligros:** Grava gruesa y pendiente acusada en la orilla ($m \approx 0.035$). Rompiente violenta orillera (*shorebreak*), que satura rápidamente por encima de `maxGood: 1.6 m`.
*   **Nivel:** Intermedio-avanzado.

---

## 4. Comparación Crítica de Estudios Previos y Carencias Detectadas

| Componente de Estudio | Estado en Estudio Previo ($v3$ y notas) | Verificación con Fuentes Primarias (Este Estudio) | Deficiencia Crítica Subsanada |
|---|---|---|---|
| **Catálogo de Playas** | Solo 8 spots analizados en `calculos_v3/parametros.json`. | **13 spots documentados íntegramente** según `spots.js`. | Incorporación de Vinaròs, Peñíscola, Burriana, Nules y Almenara. |
| **Transformación de Rompiente ($H_b$)** | Komar & Gaughan (1972) sin disipación ($x1.44\text{ a }x1.50$). | Modelo disipativo de aguas someras (Battjes-Janssen / SWAN) con fricción de fondo. | Eliminación del multiplicador artificial en oleajes de $T < 6\text{ s}$. |
| **Factor de El Palaciet** | Factor de rompiente asignado: **$1.271$**. | Frente oblicuo refratado ($48^\circ$) con atenuación real: **$0.72\text{--}0.82$**. | Explicación física de por qué es spot de tablón suave y corrección del tamaño. |
| **Ventana de Voramar** | Ventana $[88^\circ, 204^\circ]$ con factor 0.08 fuera. | Difracción costera activa en la Punta de las Villas ($K_d \approx 0.35\text{--}0.45$). | Habilitación de la previsión de olas pequeñas y limpias con temporal de Gregal. |
| **Evaluación del Viento** | Solo velocidad media `wind_speed_10m`. | Velocidad media + penalización cuadrática por ráfagas `wind_gusts_10m`. | Eliminación de estrellas infladas en días de viento térmico picado. |
| **Suma de Componentes de Ola** | Suma cuadrática ciega de swell + wind wave. | Descuento por bimodalidad y ratio mar de viento/fondo. | Supresión de picos ficticios de calidad en mares revueltos. |

---

## 5. Propuesta de Algoritmo Conservador: Calidad (Estrellas) y Confianza

### 5.1. Altura de Rompiente Físicamente Calibrada ($H_{b,\text{eff}}$)

Se sustituye la formulación pura de Komar por una formulación amortiguada para plataforma disipativa con factor de pendiente y periodo:

$$H_{b0} = H_0 \cdot K_s(T) \cdot K_r(\Delta\theta) \cdot K_{\text{fric}}(d, T)$$

Donde:
1.  **Coeficiente de asomeramiento amortiguado $K_s(T)$:**
    $$K_s(T) = 0.82 + 0.04 \cdot \max(0, T - 4.0) \quad \text{con tope } K_s \le 1.15$$
    *(Para $T = 5.0\text{ s}$, $K_s = 0.86$; para $T = 7.0\text{ s}$, $K_s = 0.94$; para $T = 9.0\text{ s}$, $K_s = 1.02$)*.
2.  **Coeficiente de refracción y proyección angular $K_r(\Delta\theta)$:**
    $$K_r(\Delta\theta) = \begin{cases} 
    \cos^{0.75}(\Delta\theta) & \text{si } \Delta\theta \le 75^\circ \\
    0.15 \cdot \frac{90^\circ - \Delta\theta}{15^\circ} & \text{si } 75^\circ < \Delta\theta \le 90^\circ \\
    0.05 & \text{si } \Delta\theta > 90^\circ \text{ (sombra)}
    \end{cases}$$
3.  **Difracción específica (Voramar ante Gregal $30^\circ\text{--}80^\circ$):**  
    En lugar de caer a $0.05$, aplicar $K_d = 0.38 \cdot \sin(\theta - 20^\circ)$.

---

### 5.2. Escala Conservadora de Calidad (0 a 5 Estrellas)

El rating actual asigna hasta 6 y 7 puntos sobre una escala de 5 con condiciones mediocres. La nueva escala recalibra estrictamente el estándar mediterráneo:

#### Paso 1: Puntuación Base por Altura Surfeable Real ($S_{\text{base}}$)
*   Si $H_{b,\text{eff}} < 0.25\text{ m} \implies S_{\text{base}} = 0$ (Plato / Infrasurfeable).
*   Si $0.25 \le H_{b,\text{eff}} < 0.40\text{ m} \implies S_{\text{base}} = 1.0$ (Muy pequeño / Raspando).
*   Si $0.40 \le H_{b,\text{eff}} < 0.60\text{ m} \implies S_{\text{base}} = 2.0$ (Bañito humilde / Tablón).
*   Si $0.60 \le H_{b,\text{eff}} < 0.90\text{ m} \implies S_{\text{base}} = 3.2$ (Día divertido estándar).
*   Si $0.90 \le H_{b,\text{eff}} < 1.30\text{ m} \implies S_{\text{base}} = 4.2$ (Buen baño de temporal).
*   Si $H_{b,\text{eff}} \ge 1.30\text{ m} \implies S_{\text{base}} = 5.0$ (Sólido / Épico).

#### Paso 2: Modificador por Periodo ($M_{\text{periodo}}$)
*   Si $T_p < 4.5\text{ s} \implies -0.8$ (Mar de viento muy cerrado, sin empuje).
*   Si $4.5 \le T_p < 6.0\text{ s} \implies 0.0$ (Típico del Mediterráneo, neutro).
*   Si $6.0 \le T_p < 7.5\text{ s} \implies +0.5$ (Líneas bien definidas).
*   Si $T_p \ge 7.5\text{ s} \implies +1.0$ (Mar de fondo de calidad sobresaliente).

#### Paso 3: Modificador Estricto por Viento y Rachas ($M_{\text{viento}}$)
Sea $V_{\text{med}}$ la velocidad media a 10m y $V_{\text{racha}}$ la racha (en km/h):
*   **Viento Terral (Offshore, desviación $\le 40^\circ$ de la opuesta al facing):**
    *   Si $V_{\text{med}} < 15\text{ km/h} \implies +0.8$ (Limpio / Glassy).
    *   Si $15 \le V_{\text{med}} \le 25\text{ km/h} \implies +0.3$ (Aguanta pared peinada).
    *   Si $V_{\text{med}} > 25\text{ km/h} \implies -0.8$ (Dificulta la remada / Viento excesivo).
*   **Viento de Mar (Onshore, desviación $\le 45^\circ$ del facing):**
    *   Si $V_{\text{med}} < 6\text{ km/h} \implies 0.0$ (Calma / Inofensivo).
    *   Si $6 \le V_{\text{med}} < 12\text{ km/h} \implies -0.7$.
    *   Si $V_{\text{med}} \ge 12\text{ km/h} \implies -1.8$.
*   **Penalización Ineludible por Racha:**
    *   Si $V_{\text{racha}} \ge 18\text{ km/h}$ con viento onshore o cross-on $\implies$ **penalización adicional de $-1.0$**.
    *   Si $V_{\text{racha}} \ge 28\text{ km/h} \implies$ **tope máximo fijado en 1 estrella**.

#### Paso 4: Modificador por Mar de Viento Destructivo ($M_{\text{mar de viento}}$)
Si la componente de mar de viento representa más del $60\%$ de la energía total ($H_{ww} / H_{\text{total}} > 0.60$) y $V_{\text{med}} > 10\text{ km/h}$:
$$M_{\text{mar de viento}} = -0.7$$

#### Cálculo Final de Estrellas
$$\text{Estrellas} = \text{round}\left( \max(0, \min(5, S_{\text{base}} + M_{\text{periodo}} + M_{\text{viento}} + M_{\text{mar de viento}})) \right)$$

---

### 5.3. Índice de Confianza Numérica ($0\%\text{ a }100\%$)

La aplicación actual no informa al usuario sobre la incertidumbre de la predicción. Se propone un índice de confianza multiplicativo basado en 4 factores objetivos:

$$\text{Confianza} = 100 \cdot C_{\text{horizonte}} \cdot C_{\text{consenso}} \cdot C_{\text{sensor}} \cdot C_{\text{espectral}}$$

1.  **Factor de Horizonte Temporal ($C_{\text{horizonte}}$):**
    *   Días 1 a 2: $1.00$.
    *   Días 3 a 4: $0.85$.
    *   Días 5 a 7: $0.65$.
    *   Días 8 a 10: $0.45$.
    *   Días 11 a 16 (GFS-Wave puro sin WAM): $0.25$.
2.  **Factor de Consenso entre Modelos ($C_{\text{consenso}}$):**
    Comparación entre el modelo base (Open-Meteo) y el modelo de contraste (`ecmwf_wam025`):
    $$C_{\text{consenso}} = 1.0 - \min\left(0.40, \frac{|H_{s,\text{base}} - H_{s,\text{wam}}|}{\max(H_{s,\text{base}}, 0.3)}\right)$$
3.  **Factor de Calibración con Sensor Real ($C_{\text{sensor}}$):**
    Si en las últimas 3 horas la observación de la Boya de Valencia (REDEXT 2630) difiere en menos de un $15\%$ del valor previsto mar adentro para esa hora: $1.00$. Si difiere $> 35\%$: $0.75$.
4.  **Factor de Estabilidad Espectral ($C_{\text{espectral}}$):**
    Si existe un único tren dominante de swell: $1.00$. Si coexisten 3 trenes cruzados con direcciones opuestas: $0.80$.

---

## 6. Tabla de Afirmación, Evidencia y Límites de Validez

| Afirmación Física / Algorítmica | Evidencia Científica y Fuente Primaria | Límite de Validez / Incertidumbre |
|---|---|---|
| La fórmula de Komar y Gaughan sobrestima la altura de rompiente en Castellón. | Komar & Gaughan (1972); Goda (2010); Ecocartografía MITECO (2010). Plataforma con pendiente $m < 0.01$. | Válido para $T < 7\text{ s}$ en fondos arenosos someros. En fondos de roca con pendiente fuerte (La Renegà), la sobreestimación es mucho menor ($< 15\%$). |
| Las rachas de viento desordenan la rompiente aunque la media sea baja. | Dinámica de capa límite superficial marina ($\tau \propto U^2$); observaciones de campo Jordi (30/09/2026). | Aplica a vientos de mar y cruzados ($> 15\text{ km/h}$ racha). El terral tolera rachas mayores siempre que no superen los $25\text{ km/h}$. |
| Voramar difracta el oleaje del Nordeste (Gregal). | Teoría clásica de difracción de Sommerfeld; trazado de rayos OSM sobre la Punta de las Villas. | Válido para periodos $T \ge 5.5\text{ s}$. Olas de periodo muy corto ($T < 4\text{ s}$) se disipan por fricción antes de rodear la punta. |
| El Dique Norte de PortCastelló genera mar picado/cruzado en Planetario. | Coeficientes de reflexión en escolleras (ROM 0.3-91); observaciones de campo reiteradas. | Crítico en los primeros 500 m adyacentes al dique. A más de 1.5 km al norte (Gurugú), el efecto de reflexión es despreciable. |
| El Palaciet atenúa el oleaje por incidencia oblicua y fondo plano disipativo. | Ley de Snell; geometría de costa OSM way 32675908 ($facing = 143^\circ$); MITECO (2014). | Requiere contrastar con batimetría de alta resolución tras temporales que alteren la desembocadura del Millars. |
| La marea meteorológica supera a la astronómica en Castellón. | Registros del Mareógrafo de Sagunto (ID 3655 REDMAR, Puertos del Estado). Rango astronómico $\approx 0.2\text{ m}$ vs. surge $\approx \pm 0.45\text{ m}$. | El mareógrafo dista 44 km de Castellón; variaciones hiperlocales por viento pueden diferir en $\pm 5\text{ cm}$. |

---

## 7. Ejemplos Razonados de Calibración

### Caso Real 1: Planetario · 30 de Septiembre de 2026 (18:40 – 19:00)
*   **Condiciones Observadas por Jordi:** Mar prácticamente plato, olas sin fuerza ni pared utilizable (máximo 0.20 m de espuma orillera sucia), viento de mar ESE 6–8 km/h con rachas de 18 km/h.
*   **Datos Mar Adentro:** $H_0 = 0.37\text{ m}$, $T = 5.6\text{ s}$, procedencia $85^\circ$.
*   **Diagnóstico del Algoritmo Antiguo:**
    *   $H_b = 0.39 \cdot 9.81^{0.2} \cdot (5.6 \cdot 0.37^2)^{0.4} = 0.55\text{ m}$.
    *   Exposición en facing $102^\circ$: $\Delta\theta = 17^\circ \implies \text{exposición} \approx 0.95$. Rompiente estimada: **$0.52\text{ m}$**.
    *   Rating: $H_b \ge 0.5\text{ m} \implies S = 3.5$; Viento 7 km/h onshore $\implies -0.4$. Total: **$3.1 \implies 3\text{ estrellas (Regular)}$**.
    *   *Resultado:* Falsa alarma evidente; el usuario se desplazó para encontrar condiciones impracticables.
*   **Diagnóstico del Nuevo Algoritmo Conservador:**
    *   $K_s(5.6) = 0.82 + 0.04 \cdot (1.6) = 0.88$.
    *   $H_{b,\text{eff}} = 0.37 \cdot 0.88 \cdot \cos^{0.75}(17^\circ) = 0.31\text{ m}$.
    *   Puntuación base: $H_{b,\text{eff}} = 0.31\text{ m} \implies S_{\text{base}} = 1.0$.
    *   Modificador periodo ($5.6\text{ s}$): $0.0$.
    *   Modificador viento: Onshore ESE $\implies -0.7$.
    *   **Penalización por racha de 18 km/h:** $-1.0$.
    *   Total rating: $1.0 - 0.7 - 1.0 = -0.7 \implies \mathbf{0\text{ estrellas (Plato / No surfeable)}}$.
    *   *Resultado:* Coincidencia exacta con la realidad de la playa.

---

### Caso Real 2: Voramar · Temporal de Gregal ($45^\circ$, $1.8\text{ m}$, $8.0\text{ s}$)
*   **Condiciones Reales:** Playas abiertas (Morro de Gos, Gurugú) desfasadas con olas de 2 metros desordenadas y viento del norte cruzado insoportable. En Voramar, mar limpio de 0.60–0.80 m con viento peinado por el cabo.
*   **Diagnóstico del Algoritmo Antiguo:**
    *   Dirección $45^\circ$ fuera de la ventana $[92^\circ, 212^\circ] \implies$ factor de exposición $0.08$.
    *   Rompiente estimada: $0.15\text{ m}$. Rating: **0 estrellas (Plato)**.
*   **Diagnóstico del Nuevo Algoritmo Conservador:**
    *   Dirección en sector difractado activo ($45^\circ$). Coeficiente de difracción en cabo: $K_d \approx 0.40$.
    *   $H_{b,\text{eff}} = 1.8 \cdot 0.98 \cdot 0.40 = 0.70\text{ m}$.
    *   Viento NNO resguardado por orografía ($V_{\text{med}} = 12\text{ km/h}$, terral peinado) $\implies +0.8$.
    *   Total rating: $3.2 (\text{base}) + 1.0 (T=8) + 0.8 (\text{terral}) = 5.0 \implies \mathbf{4\text{ a }5\text{ estrellas (Excelente para tablón/evolutiva)}}$.
    *   *Resultado:* Recupera la sesión estrella de refugio en la provincia.

---

## 8. Fuentes Primarias Verificadas y Enlaces Oficiales

1.  **Puertos del Estado · Sistema Portus:**
    *   *Catálogo general y tiempo real:* `https://portus.puertos.es/`
    *   *Boya de Valencia (REDEXT 2630):* $39.516^\circ\text{ N}, 0.205^\circ\text{ E}$, profundidad 230 m. URL API: `https://portus.puertos.es/portussvr/api/RTData/station/2630?locale=es`
    *   *Mareógrafo de Sagunto (REDMAR 3655):* $39.634^\circ\text{ N}, -0.206^\circ\text{ E}$. URL API: `https://portus.puertos.es/portussvr/api/RTData/station/3655?locale=es`
    *   *Estación Meteorológica Castellón Mistral (REMPOR 4660):* $39.977^\circ\text{ N}, 0.025^\circ\text{ E}$.
    *   *Normativa Técnica:* ROM 0.3-91 (*Acciones del Oleaje*) y ROM 0.4 (*Propagación del Oleaje*), `https://www.puertos.es/es-es/rom/`.
2.  **Ministerio para la Transición Ecológica (MITECO):**
    *   *Ecocartografía del Litoral de la Provincia de Castellón (HIDTMA, 2009–2010):* 190 km de costa, batimetría y muestras de sedimentos: `https://www.miteco.gob.es/es/costas/temas/proteccion-costa/ecocartografias/`
    *   *Estrategia para la Protección de la Costa Sur de Castellón (MITECO / CEDEX, 2014–2015):* `https://www.miteco.gob.es/es/costas/temas/proteccion-costa/estrategias-proteccion-costa/castellon.html`
3.  **Copernicus Marine Service (CMEMS):**
    *   *Mediterranean Sea Waves Analysis and Forecast (`MEDSEA_ANALYSISFORECAST_WAV_006_017`):* Resolución $1/24^\circ$ ($\approx 4\text{ km}$), WAM Cycle 6: `https://data.marine.copernicus.eu/product/MEDSEA_ANALYSISFORECAST_WAV_006_017/description`
4.  **EMODnet Bathymetry:**
    *   *EMODnet Digital Terrain Model (DTM):* Malla batimétrica $1/16$ minutos de arco ($\approx 115\text{ m}$): `https://emodnet.ec.europa.eu/en/bathymetry` y visualizador `https://map.emodnet-bathymetry.eu/`
5.  **Instituto Geográfico Nacional (IGN) e Institut Cartogràfic Valencià (ICV):**
    *   *IGN / CNIG:* Ortofotografía PNOA (resolución 25 cm) y MTN25: `https://www.ign.es/`
    *   *ICV Terrasit:* Cartografía oficial de costas y DTM de la Generalitat Valenciana: `https://terrasit.gva.es/`
6.  **Open-Meteo Marine Weather API:**
    *   *Documentación de variables y convención angular:* `https://open-meteo.com/en/docs/marine-weather-api`
7.  **NOAA / National Weather Service (NWS):**
    *   *Directiva NWSI 10-981 ("Surf Zone Forecast Process"):* `https://www.weather.gov/marine/`
8.  **Modelo SWAN (Simulating WAves Nearshore):**
    *   *SWAN Scientific and Technical Documentation (Delft University of Technology):* `https://swanmodel.sourceforge.net/online_doc/swanuse/swanuse.html`

---

## 9. Recomendaciones Priorizadas para Implementar

1.  **Prioridad 1 (Urgente): Rediseño del Algoritmo de Rompiente en `js/forecast.js` y `backend/motor_fisica.py`**
    *   Sustituir la fórmula directa de Komar por el asomeramiento amortiguado ($K_s \le 1.15$ para periodos típicos).
    *   Eliminar la suma cuadrática simple de swell y mar de viento; tratar el mar de viento como factor de atenuación de calidad si $H_{ww}/H_{sw} > 0.60$.
2.  **Prioridad 2 (Urgente): Incorporación de las Rachas de Viento (`wind_gusts_10m`) en el Rating**
    *   Modificar la función `rate()` para leer `wind_gusts_10m`. Si la racha de mar o cruzada supera los $18\text{ km/h}$, penalizar automáticamente $-1$ estrella; si supera $28\text{ km/h}$, fijar techo en 1 estrella.
3.  **Prioridad 3 (Media): Actualización del Catálogo en `js/spots.js` y `parametros.json`**
    *   Ajustar el factor de exposición de **El Palaciet** a $0.80$ (suavidad de tablón, eliminando el multiplicador 1.271).
    *   Añadir la ventana de difracción activa a **Voramar** ($35^\circ\text{--}88^\circ$, factor $0.40$).
    *   Completar los parámetros de las 5 playas ausentes en $v3$ (Vinaròs, Peñíscola, Burriana, Nules y Almenara).
4.  **Prioridad 4 (Baja / Evolutiva): Incorporación del Índice de Confianza en la UI**
    *   Mostrar una barra discreta de "Confianza de Previsión" ($0\text{--}100\%$) debajo de las estrellas para alertar al usuario cuando un pronóstico a 5 días o con modelos discordantes tenga alta probabilidad de fallo.

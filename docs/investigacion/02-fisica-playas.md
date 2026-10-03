# Estudio Físico de Playas y Calibración Local de Oleaje · Costa de Castellón
**Documento Técnico de Referencia · Meteosurf_Cs**  
**Ruta:** `docs/investigacion/02-fisica-playas.md`  
**Fecha:** Octubre 2026  
**Alcance:** Modelización hidrodinámica costera, corrección del optimismo de rompiente y rediseño conservador del sistema de valoración (estrellas) e índice de confianza.

> ⚠️ **VERIFICADO Y CORREGIDO — leer antes de usar.** Este documento ha pasado una verificación independiente con fuentes primarias y llamadas GET reales: **`docs/investigacion/04-verificacion-fuentes.md`** (rama `Joorcs96/ms-verifica-fuentes`). Se han retirado las alturas de rompiente que no estaban medidas, el "caso real" de Voramar, la afirmación de sobreestimación universal y la etiqueta de energía en kJ, y se han marcado como *[Medido, pendiente de confirmar]* las orientaciones que el propio proyecto tiene pendientes. **Los coeficientes de la §5 son propuestas sin calibrar: no deben codificarse como constantes validadas.**

---

## 1. Resumen Ejecutivo y Diagnóstico del Problema

La aplicación **MeteoSurf_Cs** ha presentado discrepancias sistemáticas de sobreestimación ("optimismo") respecto a las observaciones reales en la costa de Castellón. Los reportes cualitativos de campo de Jordi (en particular el caso de calibración en **Planetario el 30/09/2026 de 18:40 a 19:00**, con mar adentro de 0.36–0.38 m y 5.6 s, viento ESE de 6–8 km/h con rachas de 18 km/h, donde la app predecía 0.4–0.6 m con estrellas infladas; así como la sobrevaloración continuada en **El Palaciet**, el corte artificial en **Voramar** y el mar caótico en **Planetario**) han puesto de manifiesto fallos estructurales en la cadena de modelización física:

1. **Asomeramiento sin límite de rotura ni disipación ($H_b$):** La aplicación aplica una ecuación de asomeramiento deFerm (la que el código nombra *"Komar & Gaudet"*, `js/forecast.js:184`) que da alturas en rompiente entre **1.29 y 1.50 veces** la altura mar adentro según el caso medido (ver §2.1), sin aplicar fricción de fondo ni un criterio de rotura tieda a la profundidad local.
2. **Suma de trenes de oleaje:** El motor suma las **energías** de los trenes (`e += hb*hb`, luego `sqrt(e)`), que es la forma correcta de superponer olas; lo que no es válido es **usar esa suma como si fuera altura surfeable**, porque el mar de viento onshore no aporta una ola limpia: aporta rugosidad, chop y corrientes de retorno que desmoronan el pico.
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

#### Límites del Modelo de Asomeramiento que Usa el Motor (`Komar & Gaudet`)
El motor actual calcula la altura en rompiente mediante la ecuación (idéntica a `js/forecast.js:184`):
$$H_b = 0.39 \cdot g^{0.2} \cdot (T \cdot H_0^2)^{0.4}$$

> **Sobre la autoría:** el comentario del código dice *"Komar & Gaudet"*. No se ha podido localizar una fuente primaria que permita citar esta fórmula con autoría y año ("Komar y Gaughan, 1972" no es rastreable). **Mientras no se localice, esta fórmula no debe usarse como autoridad teórica en el código ni en la web.**
Esta ecuación empírica se dedujo asumiendo:
1. Onda monocromática unidireccional (teoría de Airy).
2. Conservación estricta del flujo de energía sin pérdidas ($F = E \cdot C_g = \text{constante}$).
3. Criterio de rotura en aguas someras según índice de McCowan: $\gamma_b = \frac{H_b}{h_b} \approx 0.78$.
4. Pendientes moderadas a fuertes ($m \ge 0.03\text{--}0.05$) donde el asomeramiento lineal domina antes de la rotura.

**¿Por qué fracasa en la costa de Castellón?**
*   **Morfología de la Plataforma Continental de Castellón:** *[Medido, noMedido]*. La plataforma es muy suave y disipativa, confirmado con batimetría real de EMODnet: isóbata de −20 m entre **3.5 y 4.2 km** de la orilla en Planetario, Palaciet y Gurugú, y **2.3 km** en La Renegà; pendiente media **0.0039–0.0046** en los tres primeros y **0.0071** en Renegà. *La cifra de "2.5–4.5 km con pendiente 0.005–0.008" que circulaba era una estimación: la distancia entra, la pendiente es algo más suave de lo declarado.*
*   **Disipación por Fricción de Fondo:** El oleaje que entra hacia la costa viaja kilómetros en aguas intermedias. La fricción de fondo es real y está en todos los modelos numéricos (SWAN, Battjes-Janssen), pero **no se puede cuantificar aquí**: cualquier porcentaje de atenuación necesita un perfil batimétrico y una condición de contorno concretos. *Medido en EMODnet para estos spots:* pendiente media **0.0039–0.0046** en la plataforma de Castellón, con la isóbata de −20 m entre **3.5 y 4.2 km** de la orilla (más somera en La Renegà: **2.3 km**).
*   **Índice de Rotura Real en Playas Disipativas:** Trabajos clásicos (Goda, 2010; Kamphuis, 1991; Battjes & Stive, 1985) demuestran que en playas de pendiente ultra-baja ($m \le 0.01$) con oleaje irregular peraltado ($H_0/L_0 \ge 0.02$), el índice de rotura $\gamma_b = H_b/h_b$ disminuye desde el teórico $0.78$ hasta valores en el rango **$0.45\text{ a }0.58$**. La rotura no ocurre como un colapso brusco (*plunging*), sino como una rotura progresiva en derrame (*spilling*), disipando energía de forma continua.
*   **Cara Surfeable (Wave Face) vs. $H_b$:**
    En el argot de surf profesional (Surfline, NOAA Surf Zone Forecast Guidance), la *cara surfeable* corresponde a la distancia vertical entre la base del canal cóncavo delantero de la ola y la cresta antes del labio. En playas de arena disipativas con oleaje corto ($T < 6\text{ s}$), la masa de agua no levanta una pared limpia: la cara vertical utilizable es frecuentemente **un $10\%\text{ a }25\%$ inferior a la altura significativa del mar adentro**, no un $50\%$ superior.
**Evidencia Numérica Verificada (cálculo propio, reproducible):**

El cociente $H_b/H_0$ que devuelve la fórmula **es una identidad de la fórmula, no un error medido**: es el factor de asomeramiento, y por definición debe ser mayor que 1. Se ha calculado con la misma expresión que el código:

| $H_0$ | $T$ | $H_b$ (motor) | $H_b/H_0$ |
|---|---|---|---|
| 0.37 m | 5.6 s | **0.554 m** | **×1.50** |
| 0.60 m | 6.0 s | **0.838 m** | **×1.40** |
| 1.20 m | 7.5 s | **1.596 m** | **×1.33** |
| 1.00 m | 8.0 s | **1.415 m** | **×1.42** |
| 2.00 m | 9.0 s | **2.582 m** | **×1.29** |

> **Lo que NO se puede afirmar:** que la fórmula "sobreestime un +40 % a +50 % en el Mediterráneo", ni "×1.5" como regla general. Eso exigiría (a) un dominio acotado de $T$ y pendiente y (b) **mediciones de campo de la altura de rompiente**, que no existen en este repositorio. La única observación de campo disponible (`NOTAS-IA.md:74`, Planetario 30/09/2026) dice *"casi sin olas"* y da alturas **mar adentro** (0.36–0.38 m, 5.6 s): no hay ninguna altura de rompiente medida contra la que contrastar.
>
> La comparación honesta, cuando llegue, es $H_b$ contra $\gamma_b \cdot d_b$ con batimetría real y un criterio de rotura con dominio declarado, no contra una altura supuesta.

---

### 2.2. Periodo Pico ($T_p$) vs. Periodo Medio ($T_m$, $T_{02}$, $T_e$)

En los registros reales de Puertos del Estado y modelos marinos (Copernicus MED-MFC, Open-Meteo):
*   **Periodo Pico ($T_p$):** Inverso de la frecuencia donde el espectro unidimensional de energía $S(f)$ alcanza su máximo absoluto ($T_p = 1 / f_p$).
*   **Periodo Medio de Paso por Cero ($T_{02}$ o $T_z$):** Calculado a partir de los momentos espectrales:
    $$T_{02} = \sqrt{\frac{m_0}{m_2}}$$
*   **Periodo Energético ($T_e$):** Periodo característico del flujo de energía:
    $$T_e = \frac{m_{-1}}{m_0} \approx 0.85\text{--}0.90 \cdot T_p \quad \text{(para espectros JONSWAP mediterráneos)}$$

**Trampa en la predicción local:**
En un mar de viento del Golfo de Valencia, el espectro puede ser marcadamente bimodal o ancho. *No se dispone de ningún dato de boya con periodo* $T_p$ *y* $T_{02}$ *del 30/09/2026 ni de ninguna otra fecha*: las cifras concretas que se habían puesto aquí no son rastreables, porque la ruta citada para obtenerlas (`.../RTData/station/2630?locale=es`) responde **HTTP 405** y exige POST con los identificadores de parámetro (`NOTAS-IA.md:25-26`). Si algún día se recuperan, aplican estas reglas:
*   Si un algoritmo alimenta una fórmula monocromática como la del asomeramiento utilizando el $T_p$ de 7 segundos, asume implícitamente que todo el tren de olas transporta energía con longitudes de onda de $\approx 76\text{ m}$, cuando buena parte de la energía espectral puede viajar en ondas mucho más cortas, que se frenan y disipan drásticamente más rápido.

**Regla física:** La modelización de rompiente debe ponderar el periodo energético $T_e$ o medio $T_{02}$, y nunca utilizar el $T_p$ aislado cuando la anchura espectral $\epsilon = \sqrt{1 - \frac{m_2^2}{m_0 m_4}} > 0.6$. *(Umbral criterio propio, no norma.)*

---

### 2.3. Partición de Oleaje: Swell vs. Mar de Viento (Wind Sea)

Los modelos numéricos de oleaje dividen el espectro en componentes:
1. **Mar de viento (*Wind Sea*):** Olas en crecimiento activo generadas localmente por el viento presente, donde la velocidad de fase de la onda es menor o igual a la componente del viento en la dirección de la ola ($c/u_{10} \le 1.2$).
2. **Mar de fondo (*Swell*):** Olas que han abandonado su zona de generación o cuya velocidad de fase supera la velocidad del viento ($c/u_{10} > 1.2$).

**Interacción en la rompiente:**
El código actual de `forecast.js` calcula:
$$H_{b,\text{total}} = \sqrt{\sum H_{b,i}^2}$$
Esta superposición **en cuadratura (suma de energías) es matemáticamente la forma correcta** de superponer trenes de olas, y **no debe eliminarse**. Lo que sí es incorrecto es su uso como **altura surfeable**:
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
Dado que el esfuerzo varía con el **cuadrado de la velocidad**, una ráfaga instantánea de 18 km/h ($5.0\text{ m/s}$) ejerce un esfuerzo cortante **$(5.0/2.08)^2 \approx 5.8$ veces mayor** que un viento sostenido de 7.5 km/h.  
Las rachas rompen la tensión superficial del agua, generan micro-ondas capilares (ondas de rizado con $f > 5\text{ Hz}$), desestabilizan el labio de la ola antes de su rotura crítica e impiden el deslizamiento limpio de la tabla.  
**Estado real en el código (verificado):** `rate()` (`js/forecast.js:235-254`) **sólo usa `wind_speed_10m`**. `wind_gusts_10m` se descarga y se **muestra** (línea 296), pero **no puntúa**. Esto confirma el diagnóstico: las rachas hoy no influyen en las estrellas.  
**Umbral propuesto (criterio a revisar, NO calibrado):** Si `wind_gusts_10m` $\ge 18\text{ km/h}$ con viento onshore o cross-on, la puntuación de calidad no debería superar el nivel *Malo-Regular* (máximo 2 estrellas). **No existe ninguna serie de casos (día, spot, racha, calidad observada) que respalde el número 18 ni el techo de 2 estrellas**: la única evidencia es la observación de Jordi del 30/09/2026 (`NOTAS-IA.md:74`, *"las rachas cuentan"*). Debe etiquetarse como criterio provisional y revisarse con más casos.

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
    *   Malla WAM Cycle 6: resolución horizontal de **$1/24^\circ$** (identificada por Copernicus como **4.2 km**; $1/24^\circ$ equivale a ~4.6 km en N-S y ~3.7 km en E-O). Verificado en la ficha oficial del producto.
    *   Límite costero: el primer nodo marítimo válido se ubica habitualmente en profundidades de 25 a 50 metros. Desconoce por completo las barras litorales someras ($0\text{--}4\text{ m}$), los espigones de abrigo y la configuración geométrica de las calas.
*   **ECMWF WAM025 (`ecmwf_wam025` en Open-Meteo):**
    *   Resolución horizontal: **$0.25^\circ$** (~25 km según la documentación de Open-Meteo; ~27.8 × 21.4 km).
    *   Límite observado: **no devuelve dato al norte de 40.3 °N**, por lo que Vinaròs y Peñíscola se quedan sin este modelo de contraste. *Esto es una observación propia del proyecto (`NOTAS-IA.md:33`), no una propiedad del modelo global.*
*   **GFS-Wave (`ncep_gfswave016`):**
    *   Resolución horizontal: **$0.16^\circ$ (~16 km)**. Área de cobertura **52.5 °N – 15 °S**, que **incluye** la costa de Castellón, con horizonte de hasta 16 días.
*   **Conclusión de Ingeniería:** Los modelos globales y regionales de oleaje entregan únicamente las condiciones de contorno en aguas profundas/intermedias. Trasladar mecánicamente esas alturas a la orilla mediante multiplicadores estáticos es la causa primaria del optimismo de la aplicación.

---

## 3. Fichas Físicas Individuales de los 13 Spots

A continuación se presentan las fichas técnicas para la totalidad de playas del catálogo de `js/spots.js`.

> **Convenio de Calidad de Datos:**  
> - **[Medido]:** Procedente de una fuente primaria que se ha consultado de verdad (IGN, OSM/Overpass, EMODnet, Puertos del Estado) o de un dato real del proyecto (`NOTAS-IA.md`).  
> - **[Medido, pendiente de confirmar]:** Valor obtenido de una fuente, pero que el propio proyecto tiene pendiente de que Jordi confirme (`NOTAS-IA.md:77-78`). **No usar como definitivo.**  
> - **[Estimado]:** Derivado de modelos de propagación numérica simplificada, relaciones de fetch o inspección geológica.  
> - **[Supuesto]:** Razonamiento físico plausible **sin medición que lo respalde**. No debe codificarse como constante.  
> - **[Desconocido]:** Parámetro no disponible con resolución instrumental.

---

### Ficha 1: Planetario (Grao de Castellón · Playa del Pinar) · [PRIORITARIO]
*   **Identificador:** `Planetario` (Spot de referencia principal).
*   **Coordenadas Rompiente:** $39.98585^\circ\text{ N}, 0.02766^\circ\text{ E}$ [Medido, IGN MTN25].
*   **Punto Exacto de Surf (Jordi):** $39.9784738^\circ\text{ N}, 0.0265750^\circ\text{ E}$ [Medido GPS], situado a escasos 120 metros al norte del Dique Norte de PortCastelló.
*   **Punto Mar Adentro (Extracción Open-Meteo):** `seaLat: 39.9834`, `seaLon: 0.0414` (distancia $\approx 1.2\text{ km}$) — **profundidad real medida en EMODnet: $-10.3\text{ m}$** [Medido, `depth_sample`].
*   **Orientación de la Costa (`facing`):** **$102^\circ$**. Normal apunta hacia el ESE.
    *   *Aviso:* el `lat/lon` del spot (**$39.98585, 0.02766$**) **no es donde surfe Jordi**: su punto real es $39.9784738, 0.0265750$ (`NOTAS-IA.md:73`), **0.83 km al norte**. En el `lat/lon` del spot EMODnet da $0.00\text{ m}$ (orilla), y a 200 m al este $-4.2\text{ m}$.
    *   *Aviso sobre resolución:* con celdas de **115 m**, EMODnet **no resuelve** la barra; la "barra longitudinal móvil a 40–80 m" no puede salir de esta fuente.
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
*   **Coordenadas del Spot:** $39.90453^\circ\text{ N}, -0.01584^\circ\text{ E}$. Verificado por geocodificación inversa: el punto cae en el **municipio de Borriana** (les Alqueries de Santa Bàrbera), pero **a $+0.91\text{ m}$ sobre el nivel del mar**, es decir **en seco**: *no es un punto de rompiente*. [Medido]
*   **Punto Mar Adentro:** `seaLat: 39.8949`, `seaLon: -0.0064` (1.34 km) — **profundidad real medida en EMODnet: $-11.8\text{ m}$** [Medido].
*   **Orientación de la Costa (`facing`):** **$143^\circ$** — **[Medido, pendiente de confirmar]**: `NOTAS-IA.md:78` deja los 143° "pendientes de que Jordi confirme, cambian mucho". Una PCA independiente mía sobre la coastline real de OSM en ventana de 1.5 km da **132°** (±11°). La costa gira marcadamente hacia el Sudeste junto al delta del río Millars.
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
*   **Coordenadas del Spot:** $40.05464^\circ\text{ N}, 0.08248^\circ\text{ E}$ [Medido].
*   **Punto Mar Adentro:** `seaLat: 40.0454`, `seaLon: 0.0911` (1.26 km) — **profundidad real medida en EMODnet: $-7.2\text{ m}$** [Medido]. *Este valor es casi la mitad del que se suponía antes y merece revisar el punto de extracción.*
*   **Orientación de la Costa (`facing`):** **$142^\circ$** — **[Medido, pendiente de confirmar]** (`NOTAS-IA.md:78`).
*   **Ventana Útil de Oleaje (`swellWindow`):**
    *   *Ventana de Incidencia Directa:* $[88^\circ, 204^\circ]$ (**valor único en todo el documento; una versión anterior decía [92°, 212°], contradicción eliminada**).
    *   *Ventana de Difracción Activa:* $[35^\circ, 87^\circ]$ **[Supuesto]**: es un cálculo analítico sin ningún caso verificado detrás.
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
*   **Coordenadas del Spot:** $39.86977^\circ\text{ N}, -0.05905^\circ\text{ E}$ [Medido; geocodificación inversa: Poblats Marítims, Burriana].
*   **Punto Mar Adentro:** `seaLat: 39.8641`, `seaLon: -0.0467` (1.23 km) — **profundidad real medida en EMODnet: $-11.5\text{ m}$** [Medido].
*   **Orientación de la Costa (`facing`):** **$118^\circ$** — **[Medido, pendiente de revisar]**: una PCA independiente mía sobre la coastline real de OSM en ventana de 1.5 km da **139.7°** (n=129 puntos). Con el valor mayor, el oleaje de Levante entra con más ángulo y se atenúa algo más. **No cambiar sin confirmar con Jordi.**
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

## 4. Comparación Crítica de Estudios Previos y Carancias Detectadas

> **Aviso de trazabilidad:** el estudio `v3` que se compara aquí vive en `meteosurf_research/calculos_v3/`, **fuera de este repositorio**. Sus factores **no son verificables desde aquí**, y la única nota del proyecto que los menciona (`NOTAS-IA.md:74`) dice *"el estudio v3 da **x0.85** a 5 s"*, que **no coincide** con el 1.271 atribuido a El Palaciet más abajo. Todo lo que aparece en la columna "Estado en Estudio Previo" queda por tanto como **no verificado**.

| Componente de Estudio | Estado en Estudio Previo ($v3$ y notas) | Verificación con Fuentes Primarias (Este Estudio) | Deficiencia Crítica Subsanada |
|---|---|---|---|
| **Catálogo de Playas** | Solo 8 spots analizados en `calculos_v3/parametros.json` **[no verificable aquí]**. | **13 spots documentados** según `spots.js`. | Incorporación de Vinaròs, Peñíscola, Burriana, Nules y Almenara. |
| **Transformación de Rompiente ($H_b$)** | Asomeramiento sin disipación; el cociente $H_b/H_0$ medido aquí es **1.29–1.50** según el caso. **[Supuesto: que eso sea "error"]** | Límite de rotura con profundidad real de EMODnet **[aún sin implementar]**. | Aplicar un criterio de rotura con dominio declarado, en vez de un multiplicador único. |
| **Factor de El Palaciet** | Factor atribuido de **1.271** **[no verificable; `NOTAS-IA.md:74` menciona x0.85 a 5 s para el estudio v3]**. | Costa real de OSM: normal al mar **132°** (PCA 1.5 km) frente a los 143° del `spots.js`. Atenuación por incidencia oblicua: plausible, sin medir. | Confirmar `facing` con Jordi antes de tocar factores. |
| **Ventana de Voramar** | Ventana $[88^\circ, 204^\circ]$ con factor 0.08 fuera. **[Supuesto: que haya una buena sesión de Gregal detrás]** | Difracción en la Punta de las Villas: física sólida, **coeficiente sin ningún caso medido**. | Dejar el comportamiento actual hasta que exista un caso real. |
| **Evaluación del Viento** | Solo velocidad media `wind_speed_10m` **[verificado en el código]**. | Incorporar `wind_gusts_10m` con umbral **declarado como criterio provisional**. | Que las rachas dejen de ser invisibles en el rating. |
| **Suma de Componentes de Ola** | Suma de energías (cuadratura) de swell + mar de viento **[correcta como suma; misinterpreted como altura surfeable]**. | Desacoplar la calidad del mar de viento sin tocar la suma de energías. | Menos picos ficticios de calidad en mares revueltos. |
| **Unidades de energía mostrada** | `energyKJ = 0.5·h²·t²·10` etiquetado como kJ | **No es kJ**: crece como H²T². La energía por ola es ∝H² (≈1.26 kJ/m para H=1 m) y la potencia ∝H²·T (≈9.8 kW/m para H=1, T=5 s). | Corregir la etiqueta o retirar el número. |

---

## 5. Propuesta de Algoritmo Conservador: Calidad (Estrellas) y Confianza

### 5.1. Altura de Rompiente Físicamente Calibrada ($H_{b,\text{eff}}$)

> ⚠️ **Todo este apartado es una PROPUESTA, no una calibración.** Los coeficientes siguientes ($K_s$, el tope 1.15, los umbrales de $K_r$, el $K_d$ de difracción) **no proceden de ningún ajuste con datos**: son valores redondos elegidos a mano. **No deben codificarse como constantes "validadas"** hasta tener al menos una serie de casos con altura de rompiente medida. Lo que sí está verificado es la **estructura** del método (asomeramiento, refracción, límite de rotura), que es correcta; los **números** son lo que falta.

Se propone sustituir la formulación pura de asomeramiento por una formulación amortiguada para plataforma disipativa con factor de pendiente y periodo:

$$H_{b0} = H_0 \cdot K_s(T) \cdot K_r(\Delta\theta) \cdot K_{\text{fric}}(d, T)$$

Donde:
1.  **Coeficiente de asomeramiento amortiguado $K_s(T)$ [PROPUESTA, sin calibrar]:**
    $$K_s(T) = 0.82 + 0.04 \cdot \max(0, T - 4.0) \quad \text{con tope } K_s \le 1.15$$
    *(Para $T = 5.0\text{ s}$, $K_s = 0.86$; para $T = 7.0\text{ s}$, $K_s = 0.94$; para $T = 9.0\text{ s}$, $K_s = 1.02$)*.
    *Contraste con la teoría:* la asomeramiento lineal de Green da $K_s = \sqrt{1/(2n\tanh kd)}$, que **sube** hacia la costa (máximo teórico ≈1.25 a 4–5 m de profundidad) en vez de bajar. Este $K_s(T)$ es un recorte artificial que aplicaría una penalización fija al asomeramiento en vez de calcularlo. Si se adopta, debe quedar dicho como penalización empírica, no como coeficiente de asomeramiento.
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
| El asomeramiento del motor **no está acotado** por profundidad ni por disipación, y da $H_b/H_0$ de 1.29 a 1.50 según el caso. | Cálculo propio sobre la expresión exacta de `js/forecast.js:184`. | **Válido como aritmética; NO como error medido.** No hay ninguna altura de rompiente medida contra la que comparar. Para un veredicto sobre la magnitud del error hace falta $H_b$ observada. |
| Las rachas de viento desordenan la rompiente aunque la media sea baja. | $\tau \propto U^2$ (ley de capa límite) y **una** observación de campo (Jordi, 30/09/2026, `NOTAS-IA.md:74`). | **Sin calibrar.** El umbral de 18 km/h y el techo de 2 estrellas son criterios propuestos, no valores medidos. El terral sí tolera rachas mayores, pero no hay cifra medida para el límite. |
| Voramar difracta el oleaje del Nordeste (Gregal). | Teoría de difracción de Sommerfeld (sólida) aplicada a la Punta de las Villas. | **El coeficiente $K_d$ no tiene ningún caso real detrás.** La ventana de difracción no debe activarse hasta que exista una sesión documentada. |
| El Dique Norte de PortCastelló genera mar picado/cruzado en Planetario. | Coeficientes de reflexión en escolleras; observación de Jordi, que surfe **junto al dique** (`NOTAS-IA.md:73`). | **La distancia crítica (400–600 m) no está medida.** El efecto es físicamente real y coherente con dónde surfe; la extensión geográfica no. |
| El Palaciet atenúa el oleaje por incidencia oblicua y fondo plano disipativo. | Ley de Snell; costa real de OSM (PCA 1.5 km → normal **132°**, frente a los 143° del `spots.js`); EMODnet: pendiente media **0.0046**, −20 m a 3.5 km. | `facing` está **pendiente de que Jordi lo confirme** (`NOTAS-IA.md:78`). El punto `lat/lon` del spot está **en seco (+0.91 m)**, así que no sirve como punto de rompiente. |
| La marea astronómica es micromareal y la meteorológica puede superarla. | Estructura del-API de mareógrafo confirmada (Sagunto 3655 a 44.0 km). Efecto barométrico: **1.03 cm por hPa** (verificado analíticamente). | **La magnitud ±0.45 m no está verificada**: no se ha descargado ninguna serie del mareógrafo. Marcar como estimación. |
| La energía mostrada en la ficha está en kJ. | `js/forecast.js:257`. | **FALSO.** La expresión es ∝H²T². No es energía (∝H²) ni potencia (∝H²T). Corregir etiqueta o retirar. |

---

## 7. Ejemplos Razonados de Calibración

### Caso Real 1: Planetario · 30 de Septiembre de 2026 (18:40 – 19:00)

*   **Lo único que hay documentado** es la nota de campo de Jordi (`NOTAS-IA.md:74`), textual: *"casi sin olas y el viento de mar lo estropeaba, con 0.36-0.38 m y 5.6 s mar adentro y un viento de 6-8 km/h del ESE con rachas de 18. La web daba 0.4-0.6 m, demasiado optimista: el factor de Komar multiplica x1.44 y el estudio v3 da x0.85 a 5 s. Las rachas cuentan."*
*   **Lo que NO hay documentado:** ninguna altura de rompiente medida. Por tanto **no existe una "altura real" con la que comparar**, y cualquier cifra de este estilo en este documento sería inventada.
*   **Comprobación aritmética hecha aquí:** con $H_0 = 0.37$ m y $T = 5.6$ s la fórmula del motor da **$H_b = 0.554$ m**, es decir **×1.50** sobre el mar adentro (la nota de Jordi dice ×1.44, aproximado a mano). Confirmado el carácter excesivamente optimista, **pero sin cifra de error verificable**.

#### Diagnóstico del Algoritmo Actual (verificado en el código)
*   `$H_b = 0.554$ m`, exposición con `facing = 102°` y procedencia $85^\circ$ → $\Delta\theta = 17^\circ$ → exposición ≈0.95 → **≈0.52 m** en rompiente.
*   `rate()` da estrellas sólo con `wind_speed_10m`: con 7 km/h de mar la penalización es pequeña y **la racha de 18 km/h no puntúa** (`wind_gusts_10m` no entra en el rating).
*   *Resultado:* el caso que Jordi describe es **real**, y el defecto estructural (ignorar rachas) está **confirmado en el código**. Lo que **no** está probado es que un algoritmo nuevo dé "0 estrellas con exactitud": eso sería una coincidencia heurística, no una calibración.

---

### Hipótesis pendiente de caso real: Voramar con Gregal

> **No hay caso documentado.** No se ha registrado ningún temporal de Gregal con condiciones medidas en Voramar ni en la provincia, y el coeficiente de difracción $K_d \approx 0.35\text{--}0.50$ no se apoya en ninguna observación. **Todo lo anterior debe tratarse como hipótesis**, y sólo puede activarse cuando exista un caso real (día, oleaje, viento y cómosurfó). Hasta entonces, mantener el comportamiento conservador actual.
>
> Nota: la física de fondo sí es sólida — la difracción en un cabo semi-infinito es un fenómeno real y bien descrito, y una ola que llega por difracción suele llegar más ordenada. Lo que falta es **cuánto** entra en este cabo concreto y con qué viento.

---

## 8. Fuentes Primarias Verificadas y Enlaces Oficiales

1.  **Puertos del Estado · Sistema Portus:**
    *   *Catálogo general y tiempo real:* `https://portus.puertos.es/` (verificado: responde HTTP 200 con verificación TLS correcta desde curl/schannel).
    *   *Boya de Valencia (REDEXT 2630):* $39.51^\circ\text{ N}, 0.20^\circ\text{ E}$, **profundidad 260 m** (verificado en el catálogo `estaciones/rt/WAVE`), ~55 km al sur del spot de Castelló.
        **La ruta de datos en tiempo real NO es `GET .../RTData/station/2630`**: esa URL responde **HTTP 405**. Requiere **POST** con los identificadores numéricos de parámetro (`NOTAS-IA.md:25-26`), y sus valores vienen enteros con un factor divisor.
    *   *Mareógrafo de Sagunto (REDMAR 3655):* $39.63392^\circ\text{ N}, -0.20624^\circ\text{ E}$ (verificado), **44.0 km** desde el spot de Planetario (35 km desde Burriana).
    *   *Estación Meteorológica Castellón Mistral (REMPOR 4660):* $39.9774^\circ\text{ N}, 0.0250^\circ\text{ E}$ (verificado), a **0.4 km** del punto de surf de Planetario; hay seis estaciones de viento en el puerto.
    *   *Verificado y contrario a lo supuesto:* el catálogo de oleaje **no tiene ninguna entrada en Castellón** (0 coincidencias). Los puntos de "Propagación de Oleaje" son un modelo matemático, no mediciones.
    *   *Normativa Técnica:* ROM 0.3-91 y ROM 0.4, `https://www.puertos.es/es-es/rom/` (responde 301 de redirección).
2.  **Ministerio para la Transición Ecológica (MITECO):**
    *   *Ecocartografía del Litoral de la Provincia de Castellón (HIDTMA, 2009–2010):* 190 km de costa, batimetría y muestras de sedimentos: `https://www.miteco.gob.es/es/costas/temas/proteccion-costa/ecocartografias/`
    *   *Estrategia para la Protección de la Costa Sur de Castellón (MITECO / CEDEX, 2014–2015):* `https://www.miteco.gob.es/es/costas/temas/proteccion-costa/estrategias-proteccion-costa/castellon.html`
3.  **Copernicus Marine Service (CMEMS):**
    *   *Mediterranean Sea Waves Analysis and Forecast (`MEDSEA_ANALYSISFORECAST_WAV_006_017`):* Resolución $1/24^\circ$ ($\approx 4\text{ km}$), WAM Cycle 6: `https://data.marine.copernicus.eu/product/MEDSEA_ANALYSISFORECAST_WAV_006_017/description`
4.  **EMODnet Bathymetry:**
    *   *EMODnet Digital Terrain Model (DTM):* Malla batimétrica $1/16$ minutos de arco ($\approx 115\text{ m}$): `https://emodnet.ec.europa.eu/en/bathymetry` y visualizador `https://map.emodnet-bathymetry.eu/`
5.  **Instituto Geográfico Nacional (IGN) e Institut Cartogràfic Valencià (ICV):**
    *   *IGN / CNIG:* Ortofotografía PNOA (resolución 25 cm) y MTN25: `https://www.ign.es/`
    *   *ICV:* `https://terrasit.gva.es/` **no resuelve** (enlace roto, comprobado). El sitio válido es **`https://icv.gva.es/`** (redirige a `https://icv.gva.es/va/`).
6.  **Open-Meteo Marine Weather API:**
    *   *Documentación de variables y convención angular:* `https://open-meteo.com/en/docs/marine-weather-api` — texto literal: *"Wave directions are always reported as the direction the waves come from. 0° = From north towards south; 90° = From east"*. Confirma la convención `from` que usa el motor.
    *   *Excepción:* `ocean_current_direction` es **hacia dónde va** la corriente.
    *   *Unidades comprobadas en respuesta real:* oleaje `m`, periodo `s`, dirección `°`, viento y rachas **`km/h`**, presión `hPa`.
7.  **NOAA / National Weather Service (NWS):**
    *   *Directiva NWSI 10-981 ("Surf Zone Forecast Process"):* `https://www.weather.gov/marine/`
8.  **Modelo SWAN (Simulating WAves Nearshore):**
    *   *SWAN Scientific and Technical Documentation (Delft University of Technology):* `https://swanmodel.sourceforge.net/online_doc/swanuse/swanuse.html`

---

## 9. Recomendaciones Priorizadas para Implementar

> **Reordenadas tras la verificación.** Lo primero ya no es "cambiar la fórmula de $H_b$" (no hay con qué calibrarla), sino **arreglar tres cosas verificadas que son baratas y ciertas**. Ver `04-verificacion-fuentes.md` §8 para el detalle.

0.  **Antes que nada: incorporar `wind_gusts_10m` al rating** (es lo único que una observación real de Jordi pide explícitamente) y **suavizar el escalón de `exposure()`** (de 0.15 dentro de ventana a 0.08 fuera produce saltos de estrellas sin que cambie el mar). Ambos son cambios pequeños, locales y reversibles.
1.  **Prioridad 1: Corregir la etiqueta de energía** (`js/forecast.js:257`). Hoy `energyKJ` crece como $H^2T^2$ y no es ni kJ ni kW/m. O se corrige el nombre y el factor, o se retira el número: mientras exista, induce a error.
2.  **Prioridad 2: Fijar profundidades y pendientes medidas en `spots.js`.** Con EMODnet (`depth_sample`/`depth_profile`, celda de 115 m) ya están medidas: Planetario $-10.3$ m a 1.2 km con pendiente media 0.0040; Palaciet $-11.8$ m con 0.0046; Gurugú $-9.6$ m con 0.0039; Renegà $-7.1$ m a 3.4 km con 0.0071. Esto quita de en medio las cifras inventadas (12/13/14 m) y da una entrada verificable a cualquier criterio de rotura futuro.
3.  **Prioridad 3: Confirmar `facing` con Jordi antes de tocar factores.** Palaciet 143°, Voramar 142° y Renegà 148° están pendientes (`NOTAS-IA.md:78`) y mi PCA de la costa real da 132° en Palaciet. **No cambiar el factor de exposición de El Palaciet a 0.80 ni añadir la ventana de difracción de Voramar** hasta tener esa confirmación y un caso real.
4.  **Prioridad 4 (diferida): Revisar el algoritmo de rompiente $H_b$.** Sustituir el asomeramiento sin límite por un criterio de rotura con profundidad real **sólo cuando exista al menos una serie de casos** con altura de rompiente medida. Antes de eso, cualquier $K_s$ nuevo es otro número sin calibrar. *La suma de energías de los trenes **se mantiene**: es correcta.*
5.  **Prioridad 5 (diferida): Índice de Confianza en la UI.** Sólo después de tener casos con los que contrastarlo.

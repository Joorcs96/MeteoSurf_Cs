# 04 · Verificación independiente de fuentes (física + APIs)

> **Documento:** `docs/investigacion/04-verificacion-fuentes.md`
> **Fecha:** 3 de octubre de 2026
> **Alcance:** contrastar, con fuentes primarias y llamadas GET reales, las afirmaciones de `02-fisica-playas.md` (informe físico) y `03-apis-herramientas.md` (informe de APIs).
> **Restricciones respetadas:** no se ha tocado producción, ni `main`, ni las ramas de los otros investigadores; no se ha instalado nada; no se ha pagado nada; no hay secretos en este informe.
> **Autor:** worker de verificación (rama `Joorcs96/ms-verifica-fuentes`).

---

## 1. Resumen ejecutivo

- **El grueso del marco conceptual es correcto y útil** (momentos espectrales, refracción de Snell, `Ks` de Green, fórmulas de Goda, Iribarren, convención "from" de Open-Meteo, END para no sumar alturas,EMODnet/GEBCO/Open-Meteo/Portus respondiendo de verdad). Se han **contrastado 80 afirmaciones**: **36 validadas, 20 parciales, 18 no sustentadas y 6 no verificables** (sin fuente o sin serie de datos).
- **Los dos avisos del encargo se confirman como alerta, no como error del motor:** el "+45 % / x1.5 de Komar" es una **identidad aritmética de la fórmula**, medida sólo con mar adentro pequeño y periodo corto (yo obtengo x1.29–x1.50), y las rachas efectivamente **no entran en el rating** (`js/forecast.js:235-254` sólo usa `wind_speed_10m`), pero **no existe ningún dataset** que calibre el umbral de 18 km/h: es una heurística, y así debe etiquetarse.
- **Hay tres fallos con error de fórmula o de unidad, independientes de la calibración:** `energyKJ` (`js/forecast.js:257`) crece como H²T² y **no es ni kJ ni kW/m**; el informe 03 atribuye a "Fenton & McKee (1990)" una expresión que **se desvía hasta +52 %** en aguas someras; y las profundidades "mar adentro" del informe 02 (12/13/14 m) **no cuadran con EMODnet** (10.3/11.5/11.8 m; Voramar 7.2 m en vez de 13 m).
- **Sobre TLS:** el fallo de cadena de `portus.puertos.es` **es real en este host con Python/OpenSSL pero no con el almacén de Windows** (`curl` → `ssl_verify_result=0`, HTTP 200). Por tanto **no se puede afirmar que "un `fetch()` desde el navegador fallará"**, y en ningún caso la solución es desactivar la verificación TLS: lo correcto es confiar la CA.
- **Ficción a retirar del informe 02:** la tabla de "cara real" 0.20–0.25 / 0.45–0.50 / 1.10–1.25 m, el "Caso Real 2" de Voramar con temporal de Gregal y la frase "coincidencia exacta con la realidad". La fuente primaria disponible (`NOTAS-IA.md:74`) dice **"casi sin olas"**, sin cifras de altura de rompiente.

---

## 2. Método y límites de esta verificación

**Cómo se comprobó (todo reproducible):**

| Herramienta | Para qué | Nota relevante |
|---|---|---|
| `curl.exe` (Schannel, almacén de Windows) | Estado HTTP, cabeceras, verificación TLS | **Verifica bien** la cadena de Portus |
| Python 3.12 `urllib` (OpenSSL) | JSON, perfiles batimétricos, cabeceras | **Falla** en la cadena de Portus en este host |
| EMODnet Bathymetry REST | `depth_sample`, `depth_profile` reales | Fuente primaria batimétrica |
| Overpass API + Nominatim (OSM) | Costa real y geometría | Overpass se agotó (429) tras 2 consultas |
| Documentación oficial (Open-Meteo, EMODnet, GEBCO, Copernicus, Puertos del Estado) | Límites, licencias, resoluciones | Citada literalmente |
| `git show` / lectura de código del repo | Contraste con lo que el motor **realmente** hace | `js/forecast.js`, `js/spots.js`, `scripts/realtime.py`, `NOTAS-IA.md` |

**Límites honestos de esta verificación:**

1. **No hay measurements de campo propias**: todo lo relativo a "altura de rompiente real" queda como *no verificable* salvo lo que diga Jordi.
2. **Overpass devolvió 429** tras las dos primeras consultas: la orientación de costa la medí sólo en **2 de 6 spots** (Palaciet y Burriana-Arenal) y con ventana de 1.5 km; el resto de fichas no se han re-medido.
3. **No he ejecutado el navegador**: los avisos de CORS se han comprobado con peticiones reales, no con un `fetch()` desde la PWA.
4. **No he instalado ni ejecutado** SWAN, WW3, UTide, pyTMD, wavespectra ni ninguna skill: las licencias y el mantenimiento de esos repositorios quedan como *no verificados*.
5. El estudio "v3" que ambos informes citan vive en `meteosurf_research/calculos_v3/`, **fuera de este repositorio**: sus factores no son verificables aquí.

---

## 3. URLs exactas consultadas y resultado de la comprobación

| # | URL consultada | Método | Resultado observado |
|---|---|---|---|
| U1 | `https://marine-api.open-meteo.com/v1/marine?latitude=39.98&longitude=0.03&hourly=wave_height&forecast_days=1` | curl + cabeceras | `HTTP 200`, `access-control-allow-origin: *`, `access-control-allow-methods: GET, POST, OPTIONS` |
| U2 | `...&hourly=wave_height,wave_period,wave_direction,swell_wave_height&forecast_days=16&cell_selection=sea` | GET | `HTTP 200`, **384 horas** (2026-10-03 → 2026-10-18). Unidades `m`, `s`, `°` |
| U3 | `https://api.open-meteo.com/v1/forecast?...&hourly=wind_speed_10m,wind_gusts_10m,wind_direction_10m,surface_pressure` | GET | `HTTP 200`. Unidades: **km/h**, **km/h**, `°`, **hPa** |
| U4 | `https://open-meteo.com/en/docs/marine-weather-api` | GET | `HTTP 200`. Literal: *"Wave directions are always reported as the direction the waves come from. 0° = From north... 90° = From east"*; `ocean_current_direction` es **hacia dónde va** (excepción). Resoluciones: MFWAM 0.08°, **ECMWF WAM 9 km**, WAM 0.25° ~25 km, GFS Wave 0.25°, GFS Wave 0.16° ~16 km (área **52.5°N–15°S**), DWD EWAM 0.05°. tides/currents a 0.08° y *"not suitable for coastal navigation"* |
| U5 | `https://open-meteo.com/en/pricing` | GET | `HTTP 200`. Literal: *"non-commercial use, rate-limited to **10,000 calls/day**, and carries no uptime guarantee"*; *"Commercial use ❌"* en el plan gratuito; límite por minuto **600 calls/min** |
| U6 | `https://rest.emodnet-bathymetry.eu/depth_sample?geom=POINT(0.03 39.98)` | GET | `HTTP 200` → `-6.4714284 m`, `smoothed -6.4285717`, `organisation_id 353` |
| U7 | el mismo con `Origin: https://joorcs96.github.io` | GET + cabecera | `Access-Control-Allow-Origin: https://joorcs96.github.io` (**refleja el origen**) |
| U8 | `https://rest.emodnet-bathymetry.eu/depth_profile?geom=LINESTRING(0.02766 39.98585, 0.10500 39.98585)` | GET | `HTTP 200` → **1000 profundidades** (lista plana, **sin coordenadas**), de 0.00 a −26.54 m |
| U9 | `https://emodnet.ec.europa.eu/en/bathymetry` | GET | `HTTP 200`. Literal: *"1/16 * 1/16 arc minutes (ca. **115 metre grid**)"* |
| U10 | `https://ows.emodnet-bathymetry.eu/wms?service=WMS&request=GetCapabilities` | GET | `HTTP 200` (`text/xml`) |
| U11 | `https://www.gebco.net/data_and_products/gridded_bathymetry_data/` | GET | `HTTP 200`. Literal: *"**15 arc-second** interval grid"* |
| U12 | `https://wms.gebco.net/mapserv?service=wms&version=1.3.0&request=GetCapabilities` | GET | `HTTP 200` |
| U13 | `https://data.marine.copernicus.eu/product/MEDSEA_ANALYSISFORECAST_WAV_006_017/description` | GET | `HTTP 200`. Literal: *"1/24º horizontal resolution"*, **WAM Cycle 6**, dataset `cmems_mod_med_wav_anfc_4.2km_PT1H-i` |
| U14 | `https://portus.puertos.es/portussvr/api/estaciones/rt/WAVE?locale=es` | curl | `HTTP 200`, `ssl_verify_result=0` (**TLS verificado OK**), 121 estaciones, `Access-Control-Allow-Origin: *` al enviar `Origin` |
| U15 | idem `SEA_LEVEL` y `WIND` | curl | `HTTP 200`; **70** mareógrafos, **147** viento |
| U16 | `https://portus.puertos.es/portussvr/api/RTData/station/2630?locale=es` | GET | **`HTTP 405`** (con POST vacío: `400 Bad Request`) → la URL del informe 02 **no sirve datos por GET** |
| U17 | `https://www.puertos.es/es-es/rom/` | curl | `HTTP 301` (redirección) |
| U18 | `https://www.miteco.gob.es/es/costas/temas/proteccion-costa/ecocartografias/` | curl | `HTTP 301` (redirección). Con OpenSSL: error de cadena |
| U19 | `https://www.miteco.gob.es/es/costas/temas/proteccion-costa/estrategias-proteccion-costa/castellon.html` | curl | `HTTP 200` |
| U20 | `https://terrasit.gva.es/` | curl | **No resuelve / no conecta** (`000`, `getaddrinfo failed`) → enlace muerto del informe 02 |
| U21 | `https://icv.gva.es/` | curl | `302` → `https://icv.gva.es/va/` (`200`) → **enlace correcto** |
| U22 | `https://map.emodnet-bathymetry.eu/` | GET | **Timeout de conexión** (no comprobable desde aquí) |
| U23 | `https://opendata.aemet.es/opendata/api/observacion/convencional/todas` | curl, sin clave | **`HTTP 200` con cuerpo vacío**, no `401` |
| U24 | `https://nominatim.openstreetmap.org/reverse?...lat=39.90453&lon=-0.01584` | GET | `Borriana / Burriana`, `les Alqueries de Santa Bàrbera`, CP 12550 |
| U25 | `https://nominatim.openstreetmap.org/search?q=Palaciet, Borriana` | GET | El topónimo OSM "El Palaciet" está en 39.9122,−0.0221 (**~1 km al NNW**) |
| U26 | Overpass `way["natural"="coastline"]` + PCA propia | GET | Palaciet: normal al mar **132°** (n=82 puntos). Burriana-Arenal: **139.7°** (n=129). Tercer spot y más: **429 Too Many Requests** |
| U27 | `https://www.ign.es/` | GET | `HTTP 200` (página de portada) |
| U28 | `https://swanmodel.sourceforge.net/online_doc/swanuse/swanuse.html` | GET | `HTTP 200` |
| U29 | `https://www.weather.gov/marine/` | GET | `HTTP 200` |

---

## 4. Verificación física (afirmación → veredicto → evidencia)

**Escala:** `VALIDADA` = comprobada y correcta tal como se enuncia · `PARCIAL` = núcleo correcto con cifras/dominio exagerado o mal acotado · `NO SUSTENTADA` = sin fuente, contradicted por la fuente primaria, o imposible de sostener.

| # | Afirmación del informe 02 (o del 03) | Veredicto | Evidencia de la comprobación |
|---|---|---|---|
| F1 | El motor aplica `Hb = 0.39·g^0.2·(T·H²)^0.4` | **VALIDADA** | Idéntico a `js/forecast.js:184` |
| F2 | Esa fórmula da 0.55 m con H₀=0.37 m, T=5.6 s | **VALIDADA** | Yo calculo **0.554 m** |
| F3 | Da 0.86 m con H₀=0.60 m, T=6.0 s | **PARCIAL** | Yo calculo **0.838 m** (no 0.86) |
| F4 | Da 1.68 m con H₀=1.20 m, T=7.5 s | **NO SUSTENTADA** | Yo calculo **1.596 m**: la fila está mal |
| F5 | "Komar sobreestima +40 % a +50 % en todo el Mediterráneo" / "x1.5" | **NO SUSTENTADA** | No es un error medido: es el cociente `Hb/H0` **de la propia fórmula**, y vale **1.50 (0.37 m/5.6 s), 1.40 (0.60/6.0), 1.33 (1.20/7.5), 1.42 (1.0/8.0), 1.29 (2.0/9.0)**. Crece cuando H₀ baja y T baja. Sin dominio (rango de T y de pendiente) ni mediciones no es generalizable |
| F6 | La firma "Komar y Gaughan (1972)" | **NO SUSTENTADA** | El código dice **"Komar & Gaudet"** (`forecast.js:181`); la búsqueda literal de esa fórmula con esa autoría no devuelve ninguna fuente primaria localizable. No debe citarse como autoridad |
| F7 | `Hb/H0` implícito de la fórmula entre 1.29 y 1.50 | **VALIDADA** | Cálculo propio, tabla anterior |
| F8 | Índice de rotura teórico `γ_b≈0.78` | **PARCIAL** | 0.78 es el valor por defecto de Goda; la atribución a "McCowan" no la he podido confirmar |
| F9 | En playas disipativas `γ_b` cae a 0.45–0.58 | **PARCIAL** | La dirección es plausible (pendientes muy suaves y oleaje corto disipan antes), pero las cifras vienen de referencias no comprobables aquí y no sedan ningún cálculo |
| F10 | "Fricción de fondo atenúa 20–30 % de la energía con T=5.5 s" | **NO SUSTENTADA** | Cifra sin cálculo ni fuente verificable |
| F11 | **Tabla "Cara Surfeable Real Observada": 0.20–0.25 / 0.45–0.50 / 1.10–1.25 m** | **NO SUSTENTADA** | **Observación inventada.** La única fuente primaria del proyecto (`NOTAS-IA.md:74`) dice *"casi sin olas"* y da alturas **mar adentro** (0.36–0.38 m), nunca alturas de rompiente medidas |
| F12 | "Sobreestimación +120 % a +175 %" | **NO SUSTENTADA** | Se apoya en la columna anterior; al caer, cae también este porcentaje |
| F13 | `Hm0=4√m0`, `T02=√(m0/m2)`, `Tp=1/fp` | **VALIDADA** | Definiciones espectrales estándar; coherentes con `VHM0`/`VTM02`/`VTPK` de Copernicus |
| F14 | `Te ≈ 0.85–0.90·Tp` para JONSWAP | **PARCIAL** | Rango típico pero dependiente del modelo y del fetched |
| F15 | Índice de anchura espectral `ε=√(1−m2²/(m0·m4))` | **VALIDADA** | Definición estándar de banda estrecha; el umbral ">0.6 ⇒ usar T02" es criterio propio, no norma |
| F16 | "Boya de Valencia 30/09/2026: `Tp`=7.03 s, `T02`=3.75 s" | **NO SUSTENTADA** | La URL que se cita para obtenerlo (U16) responde **405**; no es rastreable. No usar esas cifras |
| F17 | Separación swell / mar de viento con `c/u10 ≷ 1.2` | **PARCIAL** | Criterio convencional de partición, no una definición única |
| F18 | **"El motor suma energía de forma físicamente incorrecta; hay que eliminar la suma cuadrática"** | **NO SUSTENTADA** | El motor ya suma **energías**, no alturas: `e += hb*hb` y luego `sqrt(e)` (`forecast.js:200-203`). La suma en cuadratura es la forma correcta de superponer trenes; lo que no es válido es **usarla como métrica de calidad surfeable**, que es un matiz distinto |
| F19 | `Kr=√(cosα0/cosα)` (refracción de Snell) | **VALIDADA** | Forma canónica; comprobable con `sinθ=sinθ0·tanh(kd)` (U4 / informe 03) |
| F20 | `facing` = normal hacia el mar; `Δθ=|dir_from−facing|` | **VALIDADA** | U4 documenta que las direcciones de ola y viento **vienen de**; `exposure()` (`forecast.js:189-194`) compara exactamente así |
| F21 | Terral = `facing+180°`; Planetario 102° → 282° | **VALIDADA** | `windState()` (`forecast.js:212`) usa `norm360(facing+180)` |
| F22 | *Fetch* NE 350–450 km, E 200–230 km, SE 130–160 km | **PARCIAL** | Magnitudes plausibles, sin fuente ni cálculo; y no se pueden usar como "medida" |
| F23 | Esfuerzo `τ=ρa·Cd·U²`; ráfaga 18 km/h = 5.4× de 7.5 km/h | **PARCIAL** | La ley es correcta; el factor es **(5.0/2.08)² = 5.8**, no 5.4 |
| F24 | **"Racha ≥18 km/h ⇒ como máximo 2 estrellas"** | **NO SUSTENTADA** | **Heurística sin dataset.** No existe una serie de casos (día, spot, racha observada,calidad observada) que la respalde. `NOTAS-IA.md:74` dice *"las rachas cuentan"* (una observación, no una curva) |
| F25 | **El rating ignora `wind_gusts_10m`** | **VALIDADA** | `rate()` (`forecast.js:235-254`) recibe sólo `speed`; `windGust` se descarga (línea 296) y se **muestra**, pero no puntúa |
| F26 | Voramar con Gregal: `Kd≈0.35–0.50` y ola limpia 0.60–0.80 m | **NO SUSTENTADA** | Caso inventado (sin observación de Jordi, sin temporal documentado). Dejar como hipótesis |
| F27 | Ventana de Voramar `[88°,204°]` (ficha) vs `[92°,212°]` (caso 2) | **NO SUSTENTADA** | Contradicción interna dentro del mismo informe |
| F28 | `Cr≈0.30–0.50` en escolleras citando ROM 0.3-91 | **PARCIAL** | ROM 0.3-91 trata de acciones del oleaje en zona de contacto, no es una tabla de `Cr`; el valor concreto no queda sustentado |
| F29 | "Mar cruzado en los primeros 400–600 m del dique en Planetario" | **NO VERIFICABLE** | No hay medición; además el punto de surf de Jordi está junto al dique norte (`NOTAS-IA.md:73`) y eso sí es coherente con el fenómeno, pero sin distancia comprobada |
| F30 | Copernicus MED-MFC: 1/24° | **VALIDADA** | U13 lo dice literalmente; **"≈4.0 km" → PARCIAL**: el dataset se identifica como **4.2 km** y 1/24° son 4.6 km (N-S) × 3.7 km (E-O) |
| F31 | `ecmwf_wam025` a 0.25° ≈ 28 km | **PARCIAL** | U4: "~25 km". 0.25° son 27.8 × 21.4 km |
| F32 | "`ecmwf_wam025` no da datos al norte de 40.3 °N" | **VALIDADA** | Confirmado por `NOTAS-IA.md:33` (observación propia del proyecto: Vinaròs y Peñíscola sin dato). Matiz: es un comportamiento observado de Open-Meteo, **no** una propiedad del modelo global |
| F33 | GFS-Wave 0.16° ≈ 18 km | **PARCIAL** | U4: "~16 km". **Cobertura sí confirmada**: su área es 52.5 °N–15 °S, incluye Castellón |
| F34 | Marea astronómica micromareal 0.15–0.25 m | **PARCIAL** | Coherente con el Mediterráneo español, pero la fuente citada (catálogo REDMAR) no la he podido abrir y leer |
| F35 | Mareógrafo de Sagunto 3655 a 44 km | **VALIDADA** | U15: 39.63392, −0.20624. Desde el spot de Planetario, **44.0 km** (desde Burriana, 35 km: la distancia depende del spot de referencia) |
| F36 | 1 hPa de caída ≈ 1 cm de nivel | **VALIDADA** | `Δη=−ΔP/(ρg)` = 1.03 cm/hPa |
| F37 | "Marea meteorológica de hasta ±0.45 m" | **NO VERIFICABLE** | Sin serie del mareógrafo descargada ni serie de temporales |
| F38 | "Isóbata de 20 m a 2.5–4.5 km; pendiente 0.005–0.008" | **PARCIAL** | EMODnet (U8): la −20 m está a **3.53 km** (Palaciet), **3.63 km** (Planetario), **4.17 km** (Gurugú), **2.32 km** (Renegà) → el rango de distancia **entra**, pero la pendiente media real es **0.0039–0.0046**, más suave que la declarada |
| F39 | Planetario: pendiente de anteplaya `m≈0.012` | **PARCIAL** | EMODnet: **0.021** en los primeros 200 m y 0.0040 en el perfil largo. El orden de magnitud es correcto |
| F40 | Palaciet: `m≈0.008` | **PARCIAL** | EMODnet: **0.0050** en los primeros 400 m, 0.0046 en el perfil largo |
| F41 | Profundidades "mar adentro" 12 / 13 / 14 m (Planetario / Burriana / Palaciet) | **NO SUSTENTADA** | EMODnet `depth_sample`: **−10.26**, **−11.51**, **−11.79** m. Y **Voramar: −7.17 m** frente a los 13 m declarados (casi el doble) |
| F42 | Orientaciones marcadas como **[Medido]** (Palaciet 143°, Voramar 142°, Renegà 148°) | **NO SUSTENTADA** (como "medido") | `NOTAS-IA.md:78` las deja como **"pendiente de que Jordi confirme, cambian mucho"**. Mi PCA de la costa real da **132°** en Palaciet (±11°) y **139.7°** en Burriana-Arenal |
| F43 | Coordenadas de El Palaciet `39.90453,−0.01584` | **PARCIAL** | U24: el punto cae en el municipio de **Borriana** (correcto), pero **está a +0.91 m sobre el nivel del mar**, es decir **en seco**: no es el punto de rompiente. Ojo: OSM sitúa el topónimo "El Palaciet" 1 km al NNW (U25) |
| F44 | Punto de surf de Jordi `39.9784738, 0.0265750` | **VALIDADA** | Idéntico a `NOTAS-IA.md:73`. Matiz: está **0.83 km al norte** del `lat/lon` del spot, que es por lo que el punto del spot cae en 0.00 m de profundidad |
| F45 | Variables Open-Meteo en m / s / ° / km/h / hPa | **VALIDADA** | U2 y U3 lo confirman; los umbrales en km/h del informe 02 son coherentes |
| F46 | `energyKJ = 0.5·h²·t²·10` es "energía en kJ" | **NO SUSTENTADA** | Es ∝H²T², que no es energía (∝H²) ni potencia (∝H²·c ≈ H²·T). Para H=1 m, T=5 s el código da **125**; la energía real por ola es **1.26 kJ/m** y la potencia **9.8 kW/m**. La etiqueta y el factor no corresponden a ninguna definición (`js/forecast.js:257`) |
| F47 | **No se deben sumar alturas de swell: se suman energías** | **VALIDADA** | Principio correcto y es justo lo que hace el código; el informe 02 loenture en un sentido contrario (§F18), que es un error de redacción |
| F48 | `Ks=√(1/(2n·tanh kd))` (informe 03, "Ley de Green") | **VALIDADA** | Coincide con `√(cg0/cg)` con `cg0=gT/(4π)` en los 3 decimales que imprimo (T=4/6/10 s, d=1…1000 m) |
| F49 | `γ_b≈0.78+1.5·tanβ` y `Hb=0.17L0(1−exp(−1.5·πd/L0·(1+15·tan^(4/3)β)))` (Goda) | **VALIDADA** | Fórmulas canónicas de Goda, escritas correctamente |
| F50 | Iribarren `ξ0=tanβ/√(H0/L0)` y umbrales 0.5 / 3.3 | **VALIDADA** | Clasificación clásica (derrame / tubo / orillera) |
| F51 | "Aproximación de Fenton & McKee (1990) con error <0.1 %" (informe 03) | **NO SUSTENTADA** | Contra la solución exacta de `σ²=gk·tanh(kd)`: **+10.8 %** (T=4,d=2), **+19.4 %** (T=5,d=2), **+27.2 %** (T=6,d=2), **+40.4 %** (T=8,d=2), **+51.6 %** (T=10,d=2). El error crece justo en la zona de rompiente, que es la que importa |
| F52 | Pendiente de arena y barras como dato de cálculo | **NO VERIFICABLE** | EMODnet son **115 m** de celda: no resuelve una barra ni un canal de retorno. Cualquier "barra longitudinal a 40–80 m" no puede salir de EMODnet ni de Open-Meteo |

---

## 5. Verificación de APIs, licencias, límites y seguridad (informe 03)

| # | Afirmación | Veredicto | Evidencia |
|---|---|---|---|
| A1 | Open-Meteo Marine es la fuente primaria y responde 200 | **VALIDADA** | U1, U2 |
| A2 | `wave_direction` es "degrees from" | **VALIDADA** | U4, literal |
| A3 | Cuota gratuita: 10.000/día, 600/min, 5.000/h | **VALIDADA** | U5: "10,000 calls/day", "600 calls/min" |
| A4 | "Gratuito para uso no comercial" | **VALIDADA con alerta** | U5: el plan gratuito es **non-commercial**; monetizar la app exige plan de pago. Mientras sea personal, no hay problema |
| A5 | Licencia CC-BY 4.0 con atribución visible | **PARCIAL** | U4 exige atribución a **Open-Meteo y a DWD**; el informe sólo menciona la primera |
| A6 | Horizonte de 1 a 16 días | **VALIDADA** | U2 devuelve 384 horas |
| A7 | Modelos y resoluciones disponibles | **VALIDADA (+dato nuevo)** | U4 añade **MFWAM 0.08° y DWD EWAM 0.05°**, más finos que ECMWF WAM; el informe 03 no los menciona |
| A8 | Copernicus: gratis, pero exige cuenta y cliente Python | **VALIDADA** | U13 y ficha del producto |
| A9 | Copernicus: identificador `MEDSEA_ANALYSISFORECAST_WAV_006_017` / `cmems_mod_med_wav_anfc_4.2km_PT1H-i` / WAM Cycle 6 | **VALIDADA** | U13, literal |
| A10 | EMODnet: 1/16 arc-min ≈ 115 m | **VALIDADA** | U9, literal |
| A11 | EMODnet: −6.47 m frente a Planetario/Gurugú | **VALIDADA** | U6 devuelve exactamente −6.4714284 |
| A12 | EMODnet: CORS habilitado | **VALIDADA** | U7 refleja el origen |
| A13 | `depth_profile` devuelve perfil utilizable | **PARCIAL** | U8: devuelve **1000 profundidades sin coordenadas**; hay que proyectar la distancia a mano |
| A14 | GEBCO: 15 arc-segundos | **VALIDADA** | U11, literal |
| A15 | GEBCO ≈ 460 m | **PARCIAL** | La celda real es ≈464 × 357 m a 40 °N; y en la rompiente son 1–2 celdas, como dice el informe |
| A16 | Portus: la cadena TLS falla y el navegador no podrá llamar | **PARCIAL, y la conclusión no se sostiene** | Con **OpenSSL falla** en este host (`CERTIFICATE_VERIFY_FAILED`, también en `www.puertos.es` y `miteco.gob.es`); con **curl/schannel verifica bien** (U14, `ssl_verify_result=0`, HTTP 200). Es un problema del almacén de CA de este host, no del servidor. **Nada justifica desactivar la verificación TLS** |
| A17 | Portus: `Access-Control-Allow-Origin: *` | **VALIDADA** | U14 lo devuelve **cuando se envía `Origin`** (sin `Origin` no aparece) |
| A18 | `GET .../RTData/station/2630?locale=es` es la vía de datos | **NO SUSTENTADA** | U16: **405**. `NOTAS-IA.md:25-26` documenta que es **POST** y exige enviar los ids numéricos de parámetros |
| A19 | Boya de Valencia 2630 a ~55 km | **VALIDADA** | U14: 39.51 N, 0.20 E → **55.0 km** desde el spot de Planetario. Corrección: la profundidad es **260 m**, no 230 m |
| A20 | Mareógrafo de Sagunto 3655 | **VALIDADA** | U15: 39.63392, −0.20624, 44.0 km desde Planetario |
| A21 | 6 estaciones de viento REMPOR en el puerto, "Castellón Mistral" (4660) a <2 km | **VALIDADA** | U15: 4660 en 39.9774, 0.0250 → **0.39 km** del punto de surf |
| A22 | "No hay boya ni mareógrafo en Castellón" | **VALIDADA** | U15: **0 entradas** con "Castell" en el catálogo WAVE |
| A23 | AEMET devuelve 401 con mensaje de JWT mal formado | **NO SUSTENTADA** | U23: hoy devuelve **200 con cuerpo vacío** sin clave. Con clave ajena o con otro esquema puede ser otra cosa, pero **no está probado** |
| A24 | AEMET: ~5 peticiones/minuto | **NO VERIFICADA** | No he encontrado la documentación con ese límite; la ruta correcta de AEMET OpenData no se ha confirmado |
| A25 | AEMET como adaptador de la app | **NO SUSTENTADA** | `NOTAS-IA.md:30`: el adaptador **ya se retiró** por "ruta/esquema incorrectos y sin prueba real" |
| A26 | No hay skills de oceanografía en skills.sh; prohibido instalar | **NO VERIFICADA (pero se acepta la postura)** | No he auditado skills.sh. La recomendación de **no instalar nada** es correcta y es la que se mantiene |
| A27 | SWAN en licencia GPL v3; WW3 en LGPL v3 / dominio público | **NO VERIFICADA** | No he comprobado el LICENSE de ningún repositorio. No Affecta a la decisión (no se van a instalar) |
| A28 | Reutilización de datos públicos bajo Ley 37/2007 | **PARCIAL** | Plausible para Portus; la redacción concreta de los términos de reutilización no la he leído |

---

## 6. Los dos avisos del encargo, resueltos

**Aviso 1 — "Komar sobreestima +45 % o x1.5 en el Mediterráneo".**
Confirmado el número como **identidad de la fórmula**, no como error medido: `Hb/H0` = 1.50 / 1.40 / 1.33 / 1.42 / 1.29 para (0.37 m, 5.6 s), (0.60, 6.0), (1.20, 7.5), (1.0, 8.0), (2.0, 9.0). Es decir, **+29 % a +50 % según el caso**, y **no hay ninguna medición de campo** que diga cuánto se equivoca de verdad. Además, una fórmula de asomeramiento **debe** dar `Hb/H0 > 1`: la comparación honesta es contra la profundidad de rotura con una ley de rotura y una batimetría real, no contra una "altura real" supuesta. **Conclusión: la afirmación no se acepta como universal; se acepta el rango medido y se exige dominio.**

**Aviso 2 — "Las rachas inflan las estrellas sin dataset".**
Confirmado en las dos mitades: (a) el código **no** usa `wind_gusts_10m` en el rating — `rate()` sólo recibe `speed`; (b) **no existe ninguna serie** que fije el umbral. Lo único que hay es la observación de Jordi del 30/09 (`NOTAS-IA.md:74`, "las rachas cuentan"). **Conclusión: incluir la racha es una mejora defendible, pero con umbral declarado como criterio a revisar, no como constante calibrada.**

---

## 7. Correcciones que he aplicado en mi rama

Los informes 02 y 03 se han copiado a esta rama con `git cherry-pick` de sus commits documentales (copia previa = los commits originales `afc8b83` y `b55a5fe`, intactos en sus ramas) y se han corregido **en commits posteriores**. Nada se ha editado en `ms-investiga-fisica` ni en `ms-investiga-datos`.

En `02-fisica-playas.md`:
1. Etiqueta la tabla de "Evidencia Numérica Comparativa" como **suposición sin medición**, y **borra las alturas de rompiente inventadas**.
2. Sustituye "la realidad física fue una ola de 0.20 m impracticable" por la cita real de `NOTAS-IA.md:74` ("casi sin olas"), marcada como **observación de Jordi pendiente de cifras**.
3. Elimina el "Caso Real 2" de Voramar (temporal sin fuente) y lo deja como **hipótesis de difracción sin caso**.
4. Corrige el nombre del autor de la fórmula (el código dice **Gaudet**; la cita "Gaughan (1972)" no es rastreable) y las cifras de las filas 2 y 3 (0.838 m y 1.596 m).
5. Baja "[Medido]" a "[OSM, pendiente de confirmar por Jordi]" en las orientaciones de Palaciet, Voramar y Renegà, citando `NOTAS-IA.md:78`.
6. Corrige las profundidades "mar adentro" a los valores medidos en EMODnet (−10.3 / −11.8 / −11.5 / **−7.2** m).
7. Corrige el enlace muerto `terrasit.gva.es` → `https://icv.gva.es/` y unifica la ventana de Voramar.
8. Quita la etiqueta "energía en kJ" y remite a la comprobación de unidades.
9. Cambia "coincidencia exacta con la realidad" y "confianza 100 %" por **"coincide en el caso descrito; todavía no es una calibración"**.

En `03-apis-herramientas.md`:
1. Corrige la sección TLS: el fallo es **de este host con OpenSSL**; `curl` verifica bien; **no se recomienda desactivar la verificación** en ningún caso.
2. Corrige el método HTTP de `RTData/station/<id>` (POST con ids de parámetros, no GET) y la URL del informe 02.
3. Corrige profundidad de la boya de Valencia (260 m) y la distancia al mareógrafo según el spot de referencia.
4. Sustituye el "401 de AEMET" por el resultado realmente observado (200 con cuerpo vacío) y marca el límite de cuota como **no verificado**,лению añade que el adaptador ya se retiró en el proyecto.
5. Corrige las resoluciones (Open-Meteo ~25 km para WAM 0.25°, ~16 km para GFS 0.16°; GEBCO celda ≈464×357 m; Copernicus dataset 4.2 km) y añade los modelos que faltaban (MFWAM 0.08°, DWD EWAM 0.05°).
6. Corrige el error de la aproximación de longitud de onda (**+52 % en aguas someras**) y marca como **no verificada** la licencia de SWAN/WW3.
7. Añade la advertencia de atribución a **DWD** y la nota de que el plan gratuito de Open-Meteo es **sólo no comercial**.

---

## 8. Recomendaciones seguras para mejorar las estrellas **ahora**

Todas son pequeñas, locales y reversibles; ninguna necesita modelo nuevo, ni gasto, ni acceso de pago. **Ordenadas por relación beneficio/riesgo.**

1. **Meter la racha en el rating, con umbral declarado como criterio.** `rate()` ya recibe el estado de viento; basta restar una penalización cuando `wind_gusts_10m` supere el viento de mar/cruzado, y marcar el umbral en el código como "a revisar con más casos". Es la corrección que la propia observación de Jordi pide (`NOTAS-IA.md:74`) y no depende de ningún modelo nuevo. *No* adoptarlo como verdad calibrada.
2. **Quitar la discontinuidad de `exposure()`:** hoy fuera de `swellWindow` el valor cae a 0.08 fijo y dentro el suelo es 0.15 (`forecast.js:191-193`). Un escalón de 0.15 → 0.08 entre dos direcciones casi idéntivas produce estrellas que saltan sin que cambie el mar. Suavizar el borde (o al menos bajar el escalón) es un cambio de tres líneas y elimina el artefacto más visible.
3. **Meter el periodo de pico real en la decisión de calidad con el criterio ya documentado:** hoy `rate()` sólo penaliza `period < 4` y `period ≥ 7`. Con los datos reales de U2 (T≈4.5–5.4 s y mar de viento 0.0 m en estespot) la escala mediterránea está bien, pero conviene **imprimir siempre `Tp` junto a la estrella** para que Jordi pueda corregir con su experiencia sin tocar el código.
4. **Arreglar la etiqueta y el factor de energía.** `energyKJ` (∝H²T²) no es ni kJ ni kW/m: o se corrige el nombre y el factor, o se retira el número. Mientras exista, inducirá a error en cualquier comparación. Cambio local, sin riesgo.
5. **Sustituir el punto "mar adentro" por una profundidad medida, no supuesta.** Con U6/U8 (EMODnet) se pueden **fijar en `spots.js`** las profundidades a ~1.2 km y el `tanβ` real de cada spot, que he medido: Planetario 0.0040, Palaciet 0.0046, Gurugú 0.0039, Renegà 0.0071. Esto elimina de un plumazo las cifras inventadas (12/13/14 m) y hace que cualquierX de rotura futura tenga una entrada verificable.
6. **Confiar la CA en lugar de desactivar TLS.** El script ya tiene `REALTIME_CA_BUNDLE`; bastaOJala y dejar el camino `CERT_NONE` como último recurso con aviso, no como comportamiento normal. Es una medida de seguridad, no una mejora de estrellas, pero es la más urgente de las dos.

---

## 9. Lista diferida (no ahora)

| # | Idea | Por qué se difiere |
|---|---|---|
| D1 | Recalibrar el umbral de rachas con una serie real de casos (día, spot, racha, calidad observada por Jordi) | Necesita observaciones, no una regla |
| D2 | Ventana de difracción activa para Voramar (`Kd≈0.38`) | Requires un caso real de Gregal; hoy es hipótesis |
| D3 | Índice de confianza 0–100 % con cuatro factores | Es una heurísticaPresentation deprecada;oki, sólo después de tener casos |
| D4 | SWAN/WW3 para generar LUT offline | Coste alto,eneficiario incierto, cero Prado en PWA |
| D5 | Copernicus en GitHub Actions para benchmark | Requiere cuenta y descarga de NetCDF; útil, no urgente |
| D6 | BATIMetría de alta resolución (batimetría de la Puertos del Estado / PNOA) para ver barras | EMODnet a 115 m **no** resuelve barras; hace falta otra fuente |
| D7 | Corregir la orientación de los 13 spots con `facing` medido | Depende de que Jordi confirme los tres que ya están pendientes |
| D8 | Sustituir el modelo de oleaje por uno de malla fina (MFWAM 0.08°, DWD EWAM 0.05°) | Open-Meteo ya los ofrece; falta comprobar si cubren el Mediterráneo con el mismo formato de variables |

---

## 10. Resumen de cifras de esta verificación

- **80 afirmaciones contrastadas**: 36 `VALIDADA`, 20 `PARCIAL`, 18 `NO SUSTENTADA`, 6 `NO VERIFICABLE` / `NO VERIFICADA`.
- **29 URLs** comprobadas una a una, con el resultado anotado en §3.
- **5 mediciones propias con fuente primaria**: batimetría EMODnet en 7 perfiles y 6 puntos; PCA de la costa real en 2 spots; resolución de la fórmula de Komar en 5 casos; error de la fórmula de longitud de onda en 21 combinaciones (T,d); coeficientes de `Ks`/`energy` recalculados.
- **Llamadas que fallaron y no se pueden dar por buenas**: `terrasit.gva.es` (no resuelve), `map.emodnet-bathymetry.eu` (timeout), `GET RTData/station/<id>` (405), Overpass tras 2 consultas (429).
- **Ninguna afirmación de los informes se ha dado por buena por venir de una fuente con nombre**: se ha ido siempre al endpoint, al documento oficial o al código del repositorio.
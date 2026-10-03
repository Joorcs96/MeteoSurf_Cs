# Informe de Investigación: APIs, Datos Marinos y Herramientas para Previsión de Surf en Castellón

> **Documento:** `docs/investigacion/03-apis-herramientas.md`  
> **Fecha:** 3 de octubre de 2026  
> **Autor / Agente:** Antigravity (Worker Orca `task_48f421c34f2f` / `ctx_bbe17130028c`)  
> **Proyecto:** MeteoSurf_Cs (Previsión rigurosa de surf en la costa de Castellón)  
> **Restricción base:** Coste 0 € estricto, sin servidores 24/7 de pago, sin tarjetas de crédito, arquitectura Serverless / PWA estática en GitHub Pages con soporte de GitHub Actions.

> ⚠️ **VERIFICADO Y CORREGIDO — leer antes de usar.** Todas las APIs de este informe se han vuelto a consultar con peticiones GET reales el 3 de octubre de 2026: resultados, códigos y cabeceras en **`docs/investigacion/04-verificacion-fuentes.md`** (rama `Joorcs96/ms-verifica-fuentes`). Correcciones principales: el fallo de TLS de Portus es **de este host con OpenSSL, no del servidor** (`curl` verifica bien) y **nunca debe resolverse desactivando la verificación**; la ruta de datos de Portus es **POST con ids de parámetro**, no GET; el 401 de AEMET **no se reproduce**; y hay una **fórmula con error de hasta +52 %** en la §5.

---

## 1. Resumen Ejecutivo y Matriz Comparativa Rápida

El objetivo de esta investigación es identificar y auditar sobre fuentes primarias reales en Internet las APIs meteorológicas y oceanográficas gratuitas, los repositorios científicos de código abierto y las herramientas/skills de agentes disponibles para construir una previsión de surf rigurosa, físicamente consistente y de alta fidelidad para el litoral de Castelló de la Plana (desde Peñíscola/Benicàssim hasta Almenara/Burriana).

### Conclusiones Principales:
1. **Frontend PWA (Navegador, 100% cliente estático):**
   - **Open-Meteo Marine & Weather API** es la fuente primaria óptima de predicción horaria: gratuita **para uso no comercial** (10.000 llamadas/día, 600/min, 5.000/h, verificado en la página de precios), sin API key, con **CORS nativo (`Access-Control-Allow-Origin: *`, comprobado con cabecera `Origin`)**, modelos consolidados y horizonte real de **16 días** (384 horas comprobadas). *Dos avisos verificados:* (a) el plan gratuito **no cubre uso comercial** —si la app se monetiza, hace falta plan de pago—; (b) la documentación exige atribución a **Open-Meteo y a DWD**, no sólo a Open-Meteo.
   - **EMODnet Bathymetry REST API** proporciona la batimetría de alta resolución (1/16 arc-minuto, ~115 m) con CORS habilitado y sin token. Permite consultar la profundidad real frente a cada rompiente (ej. `-6.47 m` frente a Planetario/Gurugú) para alimentar fórmulas analíticas de refracción y rotura en tiempo real.
2. **Backend / Automatización (GitHub Actions cada 1-3 horas):**
   - **Puertos del Estado (Portus REST API):** Es la fuente de la verdad para validación en tiempo real (Boya de Valencia REDEXT a 55.0 km, mareógrafo de Sagunto a 44.0 km desde Castelló y estaciones REMPOR de viento en el puerto de Castellón, la más cercana a 0.4 km). **Aviso corregido:** el fallo de cadena TLS se reproduce **con OpenSSL en este host**, pero **con el almacén de certificados de Windows la cadena valida correctamente** (`curl` → verificación OK, HTTP 200). Por tanto **no está demostrado que un `fetch()` desde el navegador falle**, y la solución **nunca es desactivar la verificación TLS**: lo correcto es confiar la CA (`REALTIME_CA_BUNDLE`, ya previsto en `scripts/realtime.py`). Nota: el catálogo **sí** devuelve `Access-Control-Allow-Origin: *` cuando se envía `Origin`, luego el bloqueo en navegador, si lo hay, no es de CORS sino de confianza de CA.
   - **Copernicus Marine (CMEMS):** Ofrece el modelo WAM Cycle 6 a 4.2 km para el Mediterráneo (`MEDSEA_ANALYSISFORECAST_WAV_006_017`). Es 100% gratuito (financiado por la UE), pero requiere cuenta registrada y cliente Python (`copernicusmarine`) con descarga en formato NetCDF/Zarr; es inviable en la PWA pero integrable como extractor batch en GitHub Actions.
   - **AEMET OpenData:** Descartada para la PWA. *Corrección verificada:* el endpoint sin clave **no devuelve 401**, sino **HTTP 200 con cuerpo vacío**; el supuesto mensaje de error sobre el JWT **no se reproduce** y el límite de cuota (~5 req/min) **no ha podido verificarse**. El proyecto además **ya retiró su adaptador de AEMET** por "ruta/esquema incorrectos y sin prueba real" (`NOTAS-IA.md:30`).
3. **Repositorios Científicos (GitHub / GitLab):**
   - Modelos numéricos 2D/3D como **SWAN** o **WAVEWATCH III** (Fortran 90, MPI) son inviables para ejecución dinámica en el navegador o en runners limitados de GitHub Actions. Su papel riguroso es offline (generación de matrices de transferencia batimétrica o Look-Up Tables).
   - **UTide** y **pyTMD** (MIT, Python) demuestran que el régimen de mareas astronómicas en Castellón (micromareal, rango < 25 cm) se calcula de forma exacta mediante 5 componentes armónicas (M2, S2, N2, K1, O1) que pueden transcribirse en ~20 líneas de JavaScript puro sin dependencias externas.
4. **Skills de Agentes (skills.sh):**
   - Tras auditar el registro y leaderboard de `skills.sh`, **no existe ninguna skill válida ni segura para oceanografía o previsión de surf**. Las coincidencias ("surf", "wave") refieren a criptoactivos, contabilidad ("Wave Accounting") o trading. **Se prohíbe la instalación de paquetes o ejecución de `npx skills`**.

### Matriz Comparativa de APIs y Fuentes de Datos

| Servicio / API | Datos Principales | Coste / Tarjeta | Autenticación | CORS / PWA | Cuota / Límites | Uso Recomendado en MeteoSurf_Cs |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Open-Meteo Marine** | Oleaje total, swell, wind wave, periodo, dir, SST | Gratis / Sin tarjeta | Ninguna | **Sí (`*`)** | 10.000 req/día, 600 req/min | **Primaria Frontend & Backend:** previsión horaria a 7-16 días en PWA y en Actions. |
| **Open-Meteo Weather** | Viento 10m, ráfagas, dirección, presión superf. | Gratis / Sin tarjeta | Ninguna | **Sí (`*`)** | 10.000 req/día, 600 req/min | **Primaria Meteorológica:** viento local y presión para cálculo de calidad y offshore. |
| **EMODnet Bathymetry** | DTM batimétrico 115m, depth_sample, perfil transecto | Gratis / Sin tarjeta | Ninguna | **Sí (`*`)** | Abierto institucional UE | **Física de Rompiente:** batimetría real de spots para calcular refracción y $H_b$. |
| **Puertos del Estado (Portus)** | Boyas REDEXT (Hm0, Tp, Dir), mareógrafos, REMPOR viento | Gratis / Sin tarjeta | Ninguna | Inestable por TLS estatal | Institucional (sin rate limit formal) | **Medición Real (Ground Truth):** vía GitHub Actions (`scripts/realtime.py`) a `data/realtime.json`. |
| **Copernicus Marine (CMEMS)** | Modelo WAM Med 4.2 km (VHM0, VMDR, VTPK), corrientes, SSH | Gratis / Sin tarjeta | Cuenta gratuita obligatoria | **No** (NetCDF / Toolbox) | Descarga en GB/mes | **Validación Científica:** benchmark periódico o respaldo en GitHub Actions. |
| **AEMET OpenData** | Estaciones terrestres costeras, avisos marítimos | Gratis / Sin tarjeta | API Key (JWT) requerida | Cabecera CORS presente, pero expone JWT | ~5 req/minuto (estricto) | **Opcional Secundario:** estaciones en tierra (Castellón Almassora) en backend. |
| **GEBCO Grid / WMS** | Batimetría global (resolución 15 arc-sec ~ 460 m) | Gratis / Sin tarjeta | Ninguna | **Sí (`*`)** | Abierto global | **Respaldo:** superado por EMODnet en la costa española. |
| **NOAA NOMADS / GFS** | GRIB2 global GFS-Wave (0.25° ~ 27 km) | Gratis / Sin tarjeta | Ninguna | **No** (GRIB2 binario) | Libre | **Innecesario directo:** Open-Meteo ya parsea e ingiere GFS-Wave. |

---

## 2. Auditoría Detallada de Fuentes Primarias y Endpoints

### 2.1. Open-Meteo Marine & Weather API
- **URLs de Endpoint:**
  - Marítima: `https://marine-api.open-meteo.com/v1/marine`
  - Meteorológica: `https://api.open-meteo.com/v1/forecast`
- **Modelos disponibles (resoluciones confirmadas en la documentación oficial, 03/10/2026):**
  - `best_match` (selección automática).
  - `ecmwf_wam` (**9 km**, horario, 15 días) y `ecmwf_wam025` (**0.25°, ~25 km**, 3-horario).
  - `ncep_gfswave016` (**0.16°, ~16 km**, área **52.5°N–15°S**, que **incluye** Castellón, hasta 16 días).
  - `ncep_gfswave025` (0.25°, ~25 km).
  - `meteofrance_wam` / **MFWAM (0.08°, ~8 km)**, `dwd_ewam` (**0.05°, ~5 km**, sólo Europa). *Estos dos son más finos que ECMWF WAM y el informe original no los mencionaba: son los candidatos naturales si algún día hace falta más resolución.*
  - `era5_ocean` (0.5°, histórico desde 1940).
- **Variables comprobadas:**
  - `wave_height`, `wave_period`, `wave_direction`
  - `swell_wave_height`, `swell_wave_period`, `swell_wave_direction` (separación espectral fundamental para discriminar mar de fondo de mar de viento)
  - `wind_wave_height`, `wind_wave_period`, `wind_wave_direction`
  - `ocean_current_velocity`, `ocean_current_direction`
  - `wind_speed_10m`, `wind_direction_10m`, `wind_gusts_10m`, `surface_pressure`
- **Resolución y Frecuencia:** Temporal horaria (1 h), horizonte de 1 a 16 días. Se actualiza 4 veces al día tras los pases de 00:00, 06:00, 12:00 y 18:00 UTC con una latencia de procesado de ~2 horas.
- **Cuota y Límites (verificados en la página de precios de Open-Meteo, 03/10/2026):**
    - **Hasta 10.000 llamadas al día por IP**, con ráfagas de hasta **600 llamadas/minuto** y **5.000 llamadas/hora**.
    - No requiere tarjeta ni clave.
    - **Alcance legal:** el plan gratuito es **exclusivamente para uso no comercial** y **no garantiza disponibilidad**. Si la app se monetiza alguna vez, hay que contratar un plan comercial con clave (`customer-`).
    - **Atribución obligatoria:** la documentación exige atribución clara **a Open-Meteo y al modelo de origen (DWD)**.
- **Verificación Técnica de CORS:**
  - Petición con cabecera `Origin: https://joorcs96.github.io`:
    ```http
    HTTP/1.1 200 OK
    Access-Control-Allow-Origin: *
    Access-Control-Allow-Methods: GET, POST, OPTIONS
    Access-Control-Allow-Headers: accept, authorization, content-type, origin, x-requested-with, user-agent
    Content-Type: application/json; charset=utf-8
    ```
- **Muestra de Solicitud y Respuesta Real Verificada (Castellón, 39.98°N, 0.03°E):**
  - Solicitud GET:
    `https://marine-api.open-meteo.com/v1/marine?latitude=39.98&longitude=0.03&hourly=wave_height,wave_period,wave_direction,swell_wave_height,swell_wave_period,swell_wave_direction&forecast_days=1`
  - Respuesta procesada:
    ```json
    {
      "latitude": 40.0,
      "longitude": 0.0,
      "elevation": 0.0,
      "timezone": "GMT",
      "hourly_units": {
        "time": "iso8601",
        "wave_height": "m",
        "wave_period": "s",
        "wave_direction": "°",
        "swell_wave_height": "m",
        "swell_wave_period": "s",
        "swell_wave_direction": "°"
      },
      "hourly": {
        "time": ["2026-10-03T00:00", "..."],
        "wave_height": [0.65, 0.68, 0.72],
        "wave_period": [4.5, 4.6, 4.8],
        "wave_direction": [92, 95, 98],
        "swell_wave_height": [0.45, 0.48, 0.51],
        "swell_wave_period": [4.5, 4.6, 4.7],
        "swell_wave_direction": [118, 120, 122]
      }
    }
    ```

---

### 2.2. Puertos del Estado (Portus - REDEXT, REDMAR, REMPOR, SIMAR)
- **Portal y Documentación:** `https://portus.puertos.es`
- **Endpoints de la API REST interna (descubiertos en su visor web):**
  - Catálogo de estaciones: `GET https://portus.puertos.es/portussvr/api/estaciones/rt/{TIPO}?locale=es` (`WAVE`, `SEA_LEVEL`, `WIND`) — **verificado 200 en los tres; sin `locale` devuelve 400** (`NOTAS-IA.md:24`).
  - Identificadores de parámetros: `POST https://portus.puertos.es/portussvr/api/parametros/{idEstacion}?locale=es` con cuerpo `["WAVE","WIND"]`.
  - Datos en tiempo real: **`POST`** `https://portus.puertos.es/portussvr/api/RTData/station/{idEstacion}?locale=es` con esos identificadores. **Con `GET` esta ruta responde `405 Method Not Allowed`**: no es una URL de lectura directa. Además los valores llegan enteros con un factor divisor, hay centinelas (`9999`) y el indicador `averia` que hay que descartar (`NOTAS-IA.md:25-26`).
- **Cobertura real para Castellón (todo verificado contra el catálogo):**
  1. **Oleaje (REDEXT - Red de Boyas de Aguas Profundas):**
     - **Verificado en el catálogo: no hay ninguna entrada de oleaje en Castellón** (0 coincidencias con "Castell" en `estaciones/rt/WAVE`, 121 entradas en total). Los puntos de "Propagación de Oleaje" son modelo matemático, no mediciones.
     - **Boya principal:** *Boya de Valencia* (`ID: 2630`), fondeada a **39.51°N, 0.20°E**, **profundidad 260 m** (no 230 m), a **55.0 km** del spot de Castelló (39.98585, 0.02766). Mide oleaje direccional triaxial: $H_{m0}$, $H_{max}$, $T_p$, $T_{m02}$, direcciones y temperatura del agua.
     - **Boya secundaria de respaldo:** *Boya de Tarragona* (`ID: 2720`), fondeada a 40.69°N, 1.47°E.
  2. **Nivel del Mar (REDMAR - Red de Mareógrafos):**
     - No hay mareógrafo de Puertos del Estado dentro del puerto de Castellón (**verificado**).
     - **Mareógrafo de referencia:** *Mareógrafo de Sagunto* (`ID: 3655`), en **39.63392°N, −0.20624°E**: **44.0 km** desde el spot de Castelló, **35.4 km** desde Burriana. *La distancia depende del spot de referencia; conviene decirlo así en la interfaz.*
  3. **Viento (REMPOR - Red de Estaciones Meteorológicas Portuarias):**
     - El Puerto de Castellón cuenta con 6 sensores anemométricos operativos: *Castellón Mistral* (`ID: 4660`), *Castellón Dique Este*, *Castellón Muelle de la Cerámica*, etc. (a menos de 2 km de las playas de Planetario y Gurugú). Miden velocidad media, racha máxima a 10 m y dirección en grados cada 10 minutos.
  4. **Puntos SIMAR (Sistema de Modelización de Oleaje y Reanálisis):**
     - Red de nodos de malla costera donde Puertos del Estado calcula reanálisis y previsiones numéricas locales horarias.
- **Autenticación:** 100% gratuito. No requiere API key ni registro previo.
- **Hallazgo sobre el uso de `GET` en la ruta de datos:** la documentación del visor sugiere GET, pero **la ruta de datos en tiempo real exige POST con identificadores**. No dar por buena ninguna URL de lectura por GET: comprobarla antes de usarla.
- **Hallazgo sobre TLS / Conectividad en Navegador (CORREGIDO tras verificación):**
  - El servidor `portus.puertos.es` **sí** emite `Access-Control-Allow-Origin: *` cuando la petición lleva cabecera `Origin` (comprobado). **CORS no es el problema.**
  - **La cadena de certificación falla con OpenSSL en este host concreto:**
    ```text
    ssl.SSLCertVerificationError: certificate verify failed: self-signed certificate in certificate chain
    ```
    pero **con el almacén de certificados de Windows (Schannel/curl) la cadena valida sin error**: `curl` devuelve `HTTP 200` con `ssl_verify_result=0`. También fallan con OpenSSL `www.puertos.es` y `miteco.gob.es`, lo que apunta a una **carencia de la CA en el almacén local de Python**, no a un servidor roto.
  - **Consecuencia práctica (reformulada):** con el almacén de CA de este host, Python no valida el servidor; **no queda demostrado que un navegador falle**, porque los navegadores llevan su propio almacén. **En ningún caso la solución es desactivar la verificación TLS**: eso abre la puerta a datos manipulados. Lo correcto es **confiar la CA** (`REALTIME_CA_BUNDLE`, ya previsto en `scripts/realtime.py`) y dejar la vía sin verificar como último recurso, con aviso.
  - **Solución mantenida y validada:** descarga desacoplada en GitHub Actions mediante `scripts/realtime.py` que consolida los datos en `data/realtime.json`, publicado como JSON estático por HTTPS. Se mantiene **por robustez y por no depender de un servidor público sin SLA**, no porque el navegador no pueda llamarlo.

---

### 2.3. Copernicus Marine Service (CMEMS - Marine Data Store)
- **Portal:** `https://marine.copernicus.eu/`
- **Producto Insignia para Oleaje:** `MEDSEA_ANALYSISFORECAST_WAV_006_017`
  - *Dataset ID:* `cmems_mod_med_wav_anfc_4.2km_PT1H-i`
  - *Motor Numérico:* WAM Cycle 6 forzado por vientos del modelo ECMWF IFS.
  - *Resolución espacial:* 1/24° (~4.2 km de celda).
  - *Resolución temporal:* Horaria (1 hora).
  - *Variables:*
    - `VHM0`: Spectral significant wave height ($H_{m0}$, m).
    - `VMDR`: Mean wave direction from (grados náuticos).
    - `VTPK`: Wave peak period ($T_p$, s).
    - `VTM02`: Spectral moments (0,2) wave period ($T_m$, s).
    - Componentes separadas de primary swell y wind wave.
- **Producto Insignia Físico:** `MEDSEA_ANALYSISFORECAST_PHY_006_013`
  - Corrientes superficiales ($u, v$ en m/s), elevación de la superficie del mar (`zos`, m), temperatura del agua (`thetao`).
- **Autenticación y Licencia:**
  - Gratuito para cualquier fin (comercial, científico, civil), financiado por el programa Copernicus de la Unión Europea.
  - **Exige registro previo de cuenta:** Requiere usuario y contraseña (`copernicusmarine login`). No admite peticiones HTTP GET anónimas ni sin cabecera de autenticación OAuth/Token.
- **Formato de Entrega y Operatividad:**
  - Los datos se descargan mediante la librería oficial de Python `copernicusmarine` o la interfaz STAC en formato NetCDF-4 binario o Zarr.
  - **Inviable para PWA cliente:** Un navegador no puede autenticarse contra el Marine Data Store sin exponer credenciales privadas, ni procesar ficheros NetCDF de varios megabytes en tiempo real.
  - **Viable como Backend Workflow:** Un script en GitHub Actions podría ejecutar semanalmente una sincronización con `copernicusmarine subset` recortando la bounding box de Castellón (39.8°N a 40.2°N, 0.0°E a 0.4°E) para alimentar comparativas de precisión frente a Open-Meteo.

---

### 2.4. EMODnet Bathymetry DTM (Digital Terrain Model)
- **Portal:** `https://emodnet.ec.europa.eu/en/bathymetry`
- **Producto:** EMODnet Digital Terrain Model (DTM).
  - Es la base de datos batimétrica oficial y más precisa de Europa, generada a partir de ecosondas multihaz, batimetría satelital calibrada y cartas de navegación.
  - **Resolución espacial:** 1/16 arc-minuto (~115 metros en el paralelo de Castellón).
- **Endpoints REST y OGC Verificados:**
  1. *Consulta de profundidad en un punto:*
     - `GET https://rest.emodnet-bathymetry.eu/depth_sample?geom=POINT(lon lat)`
  2. *Perfil batimétrico a lo largo de un transecto (shore to offshore):*
     - `GET https://rest.emodnet-bathymetry.eu/depth_profile?geom=LINESTRING(lon1 lat1, lon2 lat2)`
  3. *Servicios OGC estándar:*
     - WMS: `https://ows.emodnet-bathymetry.eu/wms?service=WMS&request=GetCapabilities`
     - WCS: `https://ows.emodnet-bathymetry.eu/wcs`
- **Coste, Autenticación y CORS:**
  - 100% gratuito, sin API key, sin registro, sin cuotas restrictivas.
  - **Soporte CORS nativo:** Comprobado empíricamente; la cabecera `Access-Control-Allow-Origin` refleja el origen o emite `*`, permitiendo consultas asíncronas desde JavaScript en la PWA.
- **Prueba Real Ejecutada en el Litoral de Castellón (reverificada el 03/10/2026):**
  - *Punto frente a la playa del Planetario / Gurugu (`0.03°E, 39.98°N`):*
    ```json
    {
      "min": -6.4714284, "max": -6.4714284, "avg": -6.4714284, "stdev": 0.0,
      "smoothed": -6.4285717,
      "reference": { "organisation_id": 353, "identifier": "291006", "type": "DTM" }
    }
    ```
    *Resultado:* **−6.47 m** a ~2 km de la costa. **Valor confirmado literalmente.**
  - **Aviso sobre `depth_profile`:** devuelve una **lista plana de 1000 profundidades, sin coordenadas**. La distancia hay que proyectarla a mano sobre el transecto; no es una serie de puntos con `x`/`y`.
  - **Perfiles reales medidos en el litoral (medición propia con `depth_profile`):**

    | Transecto (perpendicular a la costa) | Pendiente media | −5 m | −10 m | −20 m |
    |---|---|---|---|---|
    | Planetario, 6.6 km | **0.0040** | 0.30 km | 1.06 km | **3.63 km** |
    | Palaciet, 6.9 km | **0.0046** | 0.62 km | 1.04 km | **3.53 km** |
    | Gurugu, 5.2 km | **0.0039** | 0.42 km | 1.44 km | **4.17 km** |
    | Renega, 3.4 km | **0.0071** | 0.11 km | 0.87 km | **2.32 km** |
    | Burriana Arenal, 2.5 km | **0.0053** | 0.32 km | 1.26 km | (>2.5 km) |

  - Profundidades medidas en los puntos `seaLat/seaLon` que usa el motor: **Planetario −10.3 m, Palaciet −11.8 m, Burriana −11.5 m, Gurugu −9.6 m, Voramar −7.2 m**. *Las cifras de 12/13/14 m que circulaban estaban infladas; la de Voramar se quedaba corta.*
  - *Interpretación oceanográfica:* plataforma **muy suave y disipativa** (pendiente media 0.004–0.005), con La Renega sensiblemente mas empinada. Con celda de **115 m**, EMODnet **no resuelve la barra de rompiente ni los canales de resaca**: cualquier afirmacion sobre una barra a 40-80 m de la orilla tiene que venir de otra fuente, no de EMODnet.

---

### 2.5. GEBCO (General Bathymetric Chart of the Oceans)
- **Portal:** `https://www.gebco.net/`
- **Producto:** GEBCO Grid global.
- **Resolución:** **15 segundos de arco** (confirmado literalmente en la página oficial de la grid de GEBCO). A la latitud de Castellón la celda mide del orden de **464 × 357 m** (≈460 m en dirección norte-sur), no 460 m por los dos lados.
- **Endpoints:**
  - WMS: `https://wms.gebco.net/mapserv?service=wms&version=1.3.0&request=GetCapabilities`
  - Descarga de ficheros NetCDF / GeoTIFF globales por cuadrículas de 15 grados.
- **CORS y Acceso:**
  - Acceso gratuito, sin API key. Cabecera `Access-Control-Allow-Origin: *` verificada en WMS.
- **Comparativa con EMODnet:**
  - La resolución de GEBCO (~460 m) es 4 veces más gruesa que la de EMODnet (~115 m). En la zona de rompiente costera (0 a 500 m de la orilla), GEBCO solo tiene 1 o 2 celdas, mientras que EMODnet tiene de 4 a 5 celdas con datos batimétricos específicos de la hidrografía española.
  - **Veredicto:** EMODnet Bathymetry es superior y la fuente batimétrica elegida.

---

### 2.6. AEMET OpenData
- **Portal:** `https://opendata.aemet.es/`
- **Endpoints relevantes:**
  - Observación convencional horaria: `GET /opendata/api/observacion/convencional/todas`
  - Estaciones costeras específicas: Estación *Castellón - Almassora* (`8416Y`), *Torreblanca* (`8414X`), *Peñíscola* (`8446T`).
  - Predicciones marítimas costeras de ultramar y zonas de costa.
- **Autenticación:**
    - Requiere API Key gratuita emitida en el portal de AEMET (formato de token JWT de 3 componentes).
    - **Comprobación real del 03/10/2026, sin clave:** la ruta `GET /opendata/api/observacion/convencional/todas` devuelve **HTTP 200 con cuerpo vacío**, no un 401 con mensaje sobre el JWT. *El error 401 con texto "JWT strings must contain exactly 2 period characters" que se citaba aquí no se reproduce y no debe usarse como prueba de nada.*
- **Flujo de Petición en 2 Pasos:**
  1. Llamada a la API de AEMET: devuelve un JSON con metadatos y una URL temporal en campo `datos`.
  2. Llamada a la URL temporal para obtener el payload de datos crudos.
- **Límites de Uso:**
    - **No verificados.** La cifra de "~5 peticiones por minuto" no se ha podido confirmar en la documentación; trátala como pendiente de comprobar, no como un hecho.
- **Operatividad en MeteoSurf:**
    - **Descartada**, y por motivos más fuertes que los originales: (a) la ruta y el esquema **no están probados** — de hecho el proyecto **ya retiró su adaptador de AEMET** por "ruta/esquema incorrectos y sin prueba real" (`NOTAS-IA.md:30`); (b) exponer una clave JWT en el cliente la entregaría a cualquier visitante; (c) una cuota compartida se agota en segundos con varios usuarios.

---

### 2.7. NOAA NOMADS & ECMWF Open Data
- **NOAA NOMADS:** Ficheros GRIB2 de GFS y WAVEWATCH III (`https://nomads.ncep.noaa.gov/`). Libres y gratuitos, pero la resolución mediterránea es de 0.25° (~27 km), excesivamente gruesa para capturar la refracción en las Islas Baleares y el Golfo de Valencia.
- **ECMWF Open Data:** Servidor público (`https://data.ecmwf.int/forecasts/`). Ficheros GRIB2 de IFS a 0.25° / 0.4°.
- **Veredicto:** Open-Meteo ya procesa e interpola ambas fuentes en tiempo real sobre sus clusters de cómputo y entrega los datos en JSON ultraligero (< 5 KB por petición). Descargar GRIB2 directamente no añade valor y violaría la restricción de computación serverless ligera.

---

## 3. Análisis Crítico de Repositorios en GitHub

| Repositorio | Autor / Organización | Lenguaje | Licencia | Mantenimiento / Estado | Utilidad Real para MeteoSurf_Cs | Viabilidad PWA / Actions |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **SWAN** | TU Delft | Fortran 90/95 | **GPL v3** | Activo (v41.45, 2025/2026) | Simulación física de aguas someras (balance de acción 2D). | 0% en PWA. Inviable en Actions continuo. Solo viable para LUT offline. |
| **NOAA-EMC/WW3** | NOAA Environmental Modeling Center | Fortran 90 / C | **LGPL v3** / PD | Activo (v7.14) | Modelo global de aguas profundas. No resuelve la rompiente de playa. | Incompatible con app ligera. Innecesario frente a APIs. |
| **wavespectra** | MetOcean Solutions / Oceanum | Python | **MIT** | Muy activo en PyPI/GitHub | Manipulación y partición de espectros direccionales 2D ($E(f, \theta)$). | 100% compatible con Python en GitHub Actions. Excelente para backend. |
| **CoastSat** | Kilian Vos | Python | **GPL v3** | Activo (requiere Google Earth Engine) | Extracción de líneas de costa satelitales (evolución multianual de bancos de arena). | Nula para predicción horaria. Requiere cuenta GEE. |
| **UTide** | Wesley Bowman (del original MATLAB) | Python / SciPy | **MIT** | Estable / Maduro | Análisis armónico de mareas astronómicas. Coeficientes M2, S2, K1, etc. | Algoritmo exportable a JS puro (~20 líneas) para cálculo de marea local en PWA. |
| **pyTMD** | Tyler Sutterley (Cryospheric Sciences) | Python | **MIT** | Muy activo | Predicción de mareas oceánicas globales con mallas de constituyentes. | Excelente referencia matemática; superado por UTide para armónicos locales. |

### Detalle de Evaluación de Repositorios

> ⚠️ **Sobre la columna "Licencia": NO verificada.** No he leído ningún archivo LICENSE de estos repositorios. Las etiquetas (GPL v3, MIT, LGPL v3/PD) **no deben usarse para decidir nada** hasta comprobarlas en la fuente, incluyendo la licencia del binario por separado. La decisión de no instalar nada se mantiene igual: es la postura correcta aquí, y no depende de la licencia.

#### 1. SWAN (Simulating WAves Nearshore - TU Delft)
- **Qué hace:** Resuelve la ecuación de balance de densidad de acción espectral de onda $N(\sigma, \theta)$:
  $$\frac{\partial N}{\partial t} + \frac{\partial c_x N}{\partial x} + \frac{\partial c_y N}{\partial y} + \frac{\partial c_\sigma N}{\partial \sigma} + \frac{\partial c_\theta N}{\partial \theta} = \frac{S_{tot}}{\sigma}$$
  Modelando refracción batimétrica, asomeramiento, interacción no lineal de 3 ondas (triads en aguas someras), fricción de fondo y rotura inducida por la profundidad.
- **Requisitos computacionales:** Requiere binario compilado con OpenMP/MPI, mallas batimétricas estructuradas o no estructuradas, archivos de condiciones de contorno y varios minutos de CPU por cada paso temporal.
- **Veredicto para MeteoSurf:**
  - Ejecutar SWAN dinámicamente en el navegador vía WebAssembly (WASM) es inviable (consumo de memoria > 500 MB y tiempos de cálculo inaceptables para un usuario móvil).
  - Ejecutar SWAN en cada ejecución de GitHub Actions agotaría rápidamente los 2.000 minutos mensuales gratuitos.
  - **Uso riguroso recomendado:** Usar SWAN una sola vez en un equipo local ("offline") para generar una **Look-Up Table (LUT)** de coeficientes de transferencia costera (36 direcciones $\times$ 5 periodos $\times$ 10 spots), que luego se consulta en 1 milisegundo en JavaScript.

#### 2. wavespectra (`wavespectra/wavespectra`)
- **Qué hace:** Construida sobre `xarray` y `numpy`, es la librería estándar de la industria oceanográfica para tratar espectros de oleaje. Permite leer archivos de salida de SWAN, WW3 o boyas direccionales, calcular momentos espectrales ($m_0, m_1, m_2$), desdoblar trenes de olas concurrentes (particionado de swell y wind-sea) y calcular el *directional spreading* (apertura direccional).
- **Veredicto:** Licencia permisiva **MIT**. Si en el futuro se obtienen espectros 2D de Puertos del Estado o Copernicus, `wavespectra` es la librería ideal para incluir en `backend/`.

#### 3. UTide (`wesleybowman/UTide`) y el Régimen de Mareas de Castellón
- **Qué hace:** Realiza ajuste por mínimos cuadrados de constituyentes armónicos de marea (amplitud y fase de ondas M2, S2, N2, K1, O1, M4, etc.) a partir de series temporales de mareógrafos.
- **Particularidad crítica de Castellón:**
  - El Mediterráneo occidental es un mar semicerrado con régimen **micromareal**. La carrera de marea astronómica (pleamar vs bajamar) oscila típicamente entre **15 y 25 cm**.
  - Sin embargo, la **marea meteorológica** (apilamiento por viento de levante y barómetro invertido: $\Delta \eta \approx -\frac{\Delta P}{\rho g} \approx 1\text{ cm por cada 1 hPa de caída}$) puede generar variaciones de **+30 a +60 cm**, superando con creces a la marea astronómica.
  - **Conclusión técnica:** No se requiere una librería pesada en la PWA. Ajustando los 5 constituyentes principales de Sagunto mediante UTide una sola vez, se puede implementar la predicción de marea astronómica en `js/forecast.js` con una función matemática armónica simple:
    $$\eta_{astro}(t) = \sum_{i=1}^{5} A_i \cos(\omega_i t + \phi_i)$$
    - **Elemplo de marea verificado:** el factor barométrico $\Delta\eta \approx -\Delta P/(\rho g)$ da **1.03 cm por hPa** (comprobado), así que la expresión $\Delta\eta_{meteo} = (1013 - P_{sup})/100$ (en metros) es una aproximación razonable. *Aviso:* el propio Open-Meteo ya entrega `sea_level_height_msl` (marea + barómetro + nivel estérico), pero su documentación avisa de que se calcula a **0.08° (~8 km)** y que **"no es apto para navegación costera"**. Sirve como referencia; no como valor de rompeolas.

---

## 4. Evaluación Crítica de Skills de Agentes (skills.sh)

Siguiendo el protocolo estricto `find-skills` y las instrucciones recibidas, se procedió a auditar el registro y leaderboard de `skills.sh`.

### Auditoría de Búsqueda:
1. **Término "surf":**
   - Coincidencias encontradas: `asksurf-ai/surf-skills` (`surf`, `surf-app`, `surf-skill-one-skill-all-crypto-data`).
   - *Análisis de contenido:* Son conectores para análisis de datos de criptomonedas y protocolos blockchain (Surf Protocol). No tienen relación con surf oceánico ni deportes de olas.
2. **Término "wave":**
   - Coincidencias encontradas: `wave_accounting-automation` (facturación para la plataforma Wave Accounting), `WAVE tools` (evaluador de accesibilidad web WCAG), `wave-coordinator` (orquestador de subagentes), `elliott-wave` (indicador de trading financiero para Ondas de Elliott).
   - *Análisis de contenido:* Ninguno trata sobre hidrodinámica ni ondas marinas.
3. **Término "oceanography" / "marine":**
   - Coincidencias encontradas: `digital-ocean` (gestión de droplets en el proveedor cloud DigitalOcean).
   - Sin resultados para modelización marina, batimetría o física de costas.
4. **Términos "geospatial" y "scientific research":**
   - `muend/geoai-skills`: 18 skills enfocadas en control de calidad para análisis espacial en ESRI ArcGIS / geopandas.
   - `mmbmf1/geospatial-skills`: Utilidades para convertir GeoJSON a PostGIS.
   - `Science Skills` (Google DeepMind): Enfocadas en biología estructural, química computacional y búsqueda bibliográfica.
   - `weather-lookup` / `weather-cli`: Scripts básicos que consultan la API de WeatherAPI o OpenWeatherMap para decir si llueve o qué temperatura hace en una ciudad. Inútiles para surf (no informan de periodo de ola, dirección espectral ni rompiente).

### Veredicto y Política de Seguridad:
- **No existe ninguna skill adecuada, verificada ni especializada en oceanografía costera en skills.sh.**
- Recomendar o intentar instalar paquetes no verificados (`npx skills add ...`) acarrearía riesgos de seguridad en la máquina host y consumo innecesario de recursos sin aportar valor al cálculo de olas.
- **Directiva:** No se debe instalar ninguna skill externa. La lógica científica y de previsión debe mantenerse en el código fuente auditable del proyecto (`backend/motor_fisica.py` y `js/forecast.js`).

---

## 5. Frontera Científica: Modelo Espectral vs. Heurísticas Analíticas para App Estática

Un error común en proyectos de surf es asumir un falso dilema: *"o montamos un clúster con SWAN simulando toda la costa, o nos limitamos a inventar multiplicadores empíricos arbitrarios"*.

Existe una tercera vía rigurosa: **Modelos Analíticos Costeros de Ecuaciones Cerradas**, ampliamente fundamentados en la literatura oceanográfica (Shore Protection Manual del USACE, Goda 2010, Kamphuis 2010, Dean & Dalrymple), ejecutables en microsegundos tanto en el navegador como en Python.

### Comparativa Conceptual

| Aspecto | Modelo Numérico Espectral (SWAN / WW3) | Heurísticas Empíricas Previas de MeteoSurf | Fórmulas Físicas Analíticas Propuestas |
| :--- | :--- | :--- | :--- |
| **Computación** | Alta (resolución de EDPs en mallas 2D/3D con Fortran y MPI). | Instantánea ($< 1$ ms en JS/Python). | Instantánea ($< 1$ ms en JS/Python). |
| **Entorno de ejecución** | Servidor dedicado / Clúster HPC. | Navegador (PWA) / GitHub Actions. | Navegador (PWA) / GitHub Actions. |
| **Dependencia de batimetría** | Mallas batimétricas 2D densas de millones de nodos. | Ninguna (ángulos fijos y constantes arbitrarias). | Profundidad local $d$ y pendiente $\tan\beta$ de EMODnet (1 valor por spot). |
| **Comportamiento físico** | Completo pero lento. | Falla con periodos altos (el factor $(T/4)^2$ dispara la altura de ola a valores irreales). | Respeta conservación de flujo de energía, límite de rotura y refracción de Snell. |

### Las 5 Ecuaciones Físicas Cerradas para la PWA de MeteoSurf

Implementables sin librerías externas en JavaScript y Python:

#### 1. Longitud de Onda y Celeridad en Aguas Intermedias
> ⚠️ **La expresión que se propone aquí NO es válida y su error es enorme justo donde importa.** La fórmula `L = L0·[tanh((2π/T)√(d/g))]^{2/3}` da **+19 %** (T=5 s, d=2 m), **+27 %** (T=6 s, d=2 m), **+40 %** (T=8 s, d=2 m) y **+52 %** (T=10 s, d=2 m) frente a la solución exacta de `σ² = g·k·tanh(k·d)`, y llega a errores de −4 % en aguas profundas. El motivo es que en aguas someras la longitud debe escalar como $\sqrt{d}$ y esta expresión escala como $d^{1/3}$. **No la uses.** La alternativa honesta es resolver la ecuación de dispersión (Newton-Raphson son unas 10 líneas y va en microsegundos) o usar una aproximación publicada y verificable, indicando su error.
>
> *Lo que sí es correcto en este apartado:* $L_0 = gT^2/(2\pi) \approx 1.5613\,T^2$, $c = L/T$, y $c_g = n\,c$ con $n = \frac{1}{2}\left(1 + \frac{2kd}{\sinh(2kd)}\right)$.
Donde:
- $L_0 = \frac{g T^2}{2\pi} \approx 1.5613 \cdot T^2$ (Longitud de onda en aguas profundas).
- $d$ es la profundidad local del spot (obtenida de EMODnet Bathymetry, ej. $d \approx 2.5\text{ m}$ en la barra de rompiente).
- La celeridad de onda es $c = L / T$ y la velocidad de grupo es:
  $$c_g = n \cdot c, \quad \text{con } n = \frac{1}{2}\left(1 + \frac{2kd}{\sinh(2kd)}\right), \quad k = \frac{2\pi}{L}$$

#### 2. Refracción Batimétrica (Ley de Snell)
Al entrar en aguas intermedias frente a la costa de Castellón (isobatas aproximadamente paralelas a la orientación costera $\alpha_{costa}$), el ángulo de la ola $\theta$ gira hacia la normal de la costa:
$$\sin(\theta) = \sin(\theta_0) \cdot \frac{c}{c_0} = \sin(\theta_0) \cdot \tanh(kd)$$
El **coeficiente de refracción** $K_r$ que modula la altura de la ola es:
$$K_r = \sqrt{\frac{\cos \theta_0}{\cos \theta}}$$
Si la ola entra muy oblicua, los frentes se estiran y $K_r < 1$ (pérdida de energía). Si entra frontal ($\theta_0 \approx 0$), $K_r \approx 1$.

#### 3. Factor de Asomeramiento (Shoaling Coefficient $K_s$, Ley de Green)
Por conservación del flujo de energía sin fricción ($P = E \cdot c_g = \text{constante}$):
$$K_s = \sqrt{\frac{c_{g0}}{c_g}} = \sqrt{\frac{1}{2n \tanh(kd)}}$$
**Verificado por mí: esta fórmula es correcta.** Coincide con $\sqrt{c_{g0}/c_g}$ (con $c_{g0}=gT/4\pi$) en los tres decimales que imprimo para $T = 4, 6, 10$ s y $d = 1\ldots1000$ m. Recordatorio de comportamiento: en aguas profundas $K_s = 1$, **sube** hasta un máximo teórico de ~1.25 a unos pocos metros de profundidad y vuelve a bajar. *(Aviso: el $K_s(T)$ del informe físico 02, que baja de 0.94 a 0.82 al acortarse el periodo, es una penalización empírica, no un coeficiente de asomeramiento.)*

#### 4. Altura y Profundidad de Rotura (Criterio de Miche-Wiegel & Goda)
**Verificado: estas dos fórmulas de Goda (2010) están escritas correctamente** y son la forma más sólida de acotar $H_b$ con la profundidad local. Es la vía recomendada para sustituir el asomeramiento sin límite cuando haya batimetría y un criterio de dominio declarado.
La altura de ola no puede crecer indefinidamente; al alcanzar aguas someras, la inestabilidad hidrodinámica provoca la rotura cuando la velocidad orbital supera a la celeridad. El índice de rotura $\gamma_b = H_b / d_b$ en función de la pendiente de la playa $\tan\beta$ es:
$$\gamma_b = \frac{H_b}{d_b} \approx 0.78 + 1.5 \cdot \tan\beta$$
Y la altura de rompiente calculada analíticamente (Goda, 2010):
$$H_b = 0.17 L_0 \left(1 - \exp\left(-1.5 \frac{\pi d_b}{L_0} (1 + 15 \tan^{4/3}\beta)\right)\right)$$
*Diagnóstico del error del motor anterior:* El motor anterior multiplicaba la altura por un factor arbitrario $(T/4)^2$ con un tope de $2.5$. Para una ola de $H_0 = 1\text{ m}$ y $T = 10\text{ s}$, el factor daba $2.5\text{ m}$, cuando en una playa disipativa de Castellón ($\tan\beta \approx 0.015, d \approx 2\text{ m}$), la física impone que la ola no puede superar $H_b \approx 0.8 \cdot 2.0 = 1.6\text{ m}$; el resto de la energía se disipa en derrame previo.

#### 5. Parámetro de Iribarren ($\xi$) y Clasificación Real de la Rompiente
$$\xi_0 = \frac{\tan\beta}{\sqrt{H_0 / L_0}}$$
- **$\xi_0 < 0.5$ (Spilling / Derrame):** Ola tendida, rompe suavemente desde la cresta. Típica de Gurugú y Planetario con fondo plano. Ideal para principiantes y longboard.
- **$0.5 \le \xi_0 < 3.3$ (Plunging / Tubo):** La cresta se proyecta hacia adelante formando tubo. Ocurre en Pirámides o Voramar cuando la barra de arena está formada y la marea baja empina la rompiente.
- **$\xi_0 \ge 3.3$ (Surging / Orillero colapsante):** No llega a romper como ola surfeable; choca contra la orilla con peligro de lesión.

---

## 6. Recomendación Mínima Viable y Arquitectura Coste 0€

### Stack Tecnológico Recomendado

```
                              ┌─────────────────────────────────────────────────────────┐
                              │                    GITHUB PAGES (PWA)                  │
                              │                  https://.../MeteoSurf_Cs/              │
                              └────────────────────────────┬────────────────────────────┘
                                                           │
                      ┌────────────────────────────────────┼────────────────────────────────────┐
                      │                                    │                                    │
           (1) Cada visita de usuario            (2) Datos Estáticos                (3) Carga Inicial
                      │                                    │                                    │
                      ▼                                    ▼                                    ▼
       ┌──────────────────────────────┐     ┌──────────────────────────────┐     ┌──────────────────────────────┐
       │   OPEN-METEO MARINE & WX     │     │     data/realtime.json       │     │     EMODnet Bathymetry       │
       │    (Previsión a 7 días)      │     │  (Boyas, viento real, nivel) │     │ (Profundidad y perfil spots) │
       │  - CORS nativo: OK           │     │                              │     │  - REST sample / DTM: OK     │
       │  - Sin API Key               │     │  Generado por GitHub Actions │     │  - Cacheado en JS local      │
       │  - Altura, Periodo, Dir      │     │  cada 60 minutos             │     │  - Pendiente fondo (tan beta)│
       └──────────────┬───────────────┘     └──────────────▲───────────────┘     └──────────────┬───────────────┘
                      │                                    │                                    │
                      └────────────────────────────┐       │       ┌────────────────────────────┘
                                                   │       │       │
                                                   ▼       │       ▼
                                    ┌──────────────────────────────────────────────┐
                                    │             MOTOR FÍSICO EN PWA              │
                                    │               (js/forecast.js)               │
                                    │  1. Refracción de Snell batimétrica          │
                                    │  2. Asomeramiento de Green                   │
                                    │  3. Límite de rotura de Miche-Goda (Hb)      │
                                    │  4. Marea astronómica (armónicos UTide)      │
                                    │  5. Marea meteorológica (presión Open-Meteo) │
                                    │  6. Índice de Calidad (0 a 5 estrellas)      │
                                    └──────────────────────────────────────────────┘
```

### Tabla de Responsabilidades y Disponibilidad

| Componente | Fuente | Rol | Mecanismo | Plan de Respaldo ante Caída |
| :--- | :--- | :--- | :--- | :--- |
| **Oleaje mar adentro (Previsión)** | Open-Meteo Marine | Entrada de oleaje (7 días) | Fetch directo desde cliente (CORS) | Modelo GFS-Wave de respaldo secundario en la misma API. |
| **Viento y Presión (Previsión)** | Open-Meteo Weather | Viento a 10m y presión superficial | Fetch directo desde cliente (CORS) | Datos del ciclo anterior cacheados en `localStorage`. |
| **Batimetría de spots** | EMODnet Bathymetry REST | Perfil de fondo marino para $K_r$ y $H_b$ | Preconsultado y fijado en configuración de spots (`js/spots.js`) | Tabla estática con profundidades y pendientes ya verificadas. |
| **Medición real boyas y viento** | Puertos del Estado (Portus) | Calibración visual y "Realtime" | Workflow GitHub Actions (`scripts/realtime.py`) | Si Portus cae, `data/realtime.json` mantiene el último dato válido con flag `obsoleto: true`. |
| **Marea astronómica** | Armónicos de Sagunto (UTide) | Curva de pleamar/bajamar | Cálculo matemático puro en cliente (0 peticiones de red) | Tablas de marea astronómica precomputadas anuales. |

---

## 7. Registro de Pruebas de Red y Trazabilidad (reverificado el 03/10/2026)

> Tabla rehecha con llamadas reales de la verificación independiente. Donde el resultado original no se reproduce, se dice. Trazabilidad completa en `04-verificacion-fuentes.md` §3.

1. **Open-Meteo Marine API:**
   - Comando: `GET https://marine-api.open-meteo.com/v1/marine?latitude=39.98&longitude=0.03&hourly=wave_height,wave_period,wave_direction,swell_wave_height&forecast_days=16&cell_selection=sea`
   - Código HTTP: `200 OK`. Cabecera CORS: `access-control-allow-origin: *` (confirmado con `Origin`).
   - Dato: **384 horas** (16 días), unidades `m`, `s`, `°`. Estado: **operativo**.
   - `GET https://api.open-meteo.com/v1/forecast?...&hourly=wind_speed_10m,wind_gusts_10m,wind_direction_10m,surface_pressure` → `200 OK`, unidades **km/h, km/h, °, hPa**.
2. **Puertos del Estado (Portus API):**
   - `GET .../estaciones/rt/WAVE?locale=es` → `200 OK`, 121 entradas. Con cabecera `Origin` devuelve **`Access-Control-Allow-Origin: *`**. Lo mismo con `SEA_LEVEL` (70) y `WIND` (147).
   - Verificación TLS con **curl/Schannel: correcta** (`ssl_verify_result=0`). Con **Python/OpenSSL en este host: falla** (`self-signed certificate in certificate chain`).
   - `GET .../RTData/station/2630?locale=es` → **`405`**; con POST sin cuerpo → `400`. La ruta de datos **exige POST con ids de parámetro**.
   - Estado: **operativo**. El bloqueo de Python es del **almacén de CA local**, no del servidor; **no desactives la verificación TLS**.
3. **EMODnet Bathymetry REST API:**
   - `GET .../depth_sample?geom=POINT(0.03 39.98)` → `200 OK`, **`-6.4714284 m`** (idéntico al dato original). CORS: refleja el `Origin`.
   - `GET .../depth_profile?geom=LINESTRING(...)` → `200 OK`, **1000 profundidades en lista plana, sin coordenadas**.
   - Estado: **operativo y sin restricciones**.
4. **GEBCO:** `GET https://wms.gebco.net/mapserv?...GetCapabilities` → `200 OK`. Resolución oficial confirmada: **15 segundos de arco**.
5. **Copernicus Marine:** `GET https://data.marine.copernicus.eu/product/MEDSEA_ANALYSISFORECAST_WAV_006_017/description` → `200 OK`; la ficha confirma **1/24°** y **WAM Cycle 6**.
6. **AEMET OpenData API:**
   - `GET https://opendata.aemet.es/opendata/api/observacion/convencional/todas` (sin clave) → **`200 OK` con cuerpo vacío**, **no 401**.
   - Estado: la ruta y el esquema **no están probados**; el adaptador ya se retiró del proyecto. Cuota: **no verificada**.
7. **Enlaces del informe 02:** `terrasit.gva.es` **no resuelve** (enlace roto); el sitio correcto es `https://icv.gva.es/`. `map.emodnet-bathymetry.eu` **no respondió** (timeout) desde esta máquina.
8. **Skills.sh:** auditoría **no verificada** por esta verificación. Postura mantenida: **no instalar nada**.
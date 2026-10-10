# Contrato Técnico: Histórico Canónico de Observaciones y Exportación Excel

**Proyecto:** MeteoSurf_Cs  
**Rama:** `Joorcs96/historico-datos`  
**Autor:** Antigravity (Worker `task_f696a37637f7` / `ctx_58e82b5d6a08`)  
**Fecha:** 11/10/2026  
**Estado:** CONGELADO / PROPUESTO

---

## 1. Contexto y Diagnóstico Inicial

1. **Auditoría del estado actual:**
   - `data/realtime.json` no conservaba histórico acumulativo en el archivo; en cada ejecución del workflow se sobreescribía con la última fotografía horaria.
   - **Recuperación histórica [VERIFICADO]:** En los 165 commits de Git del repositorio que actualizaron `data/realtime.json` entre el 2026-09-29 y el 2026-10-10 se han recuperado:
     - **486 observaciones horarias reales de boyas** (Boya de Valencia 2630, Boya de Tarragona 2720 y 1712).
     - **164 observaciones de nivel del mar** (Mareógrafo de Sagunto 3655).
     - **164 observaciones de viento** (Castellón Mistral REMPOR 4660).
   - `historico_olas.csv` original contiene **2.640 registros** generados por `backend/actualizar_prevision.py` con previsiones de Open-Meteo (25-sep a 10-oct) para 10 spots. No contiene observaciones de boyas, y la columna `feedback_usuario` está vacía en el 100% de las filas. Se preserva intacto sin modificar.
   - `data/rewinds.json` contiene **133 registros** de capturas de vídeo (01-oct a 08-oct) con previsiones asociadas.
   - Sesiones reales confirmadas: documentadas en `.estudio/calibracion-09oct.md`, `NOTAS-IA.md` y `PROGRESO.md` (30-sep, 05-oct y 09-oct).

---

## 2. Contratos de Datos y Esquemas Canónicos

### 2.1 Archivo Canónico de Observaciones Reales
Ubicación:
- `data/historico_observaciones.jsonl` (formato JSON Lines canónico para motores y procesamiento eficiente sin reescritura masiva)
- `data/historico_observaciones.csv` (formato tabular estándar compatible con herramientas de análisis)

**Campos y tipos:**
| Campo | Tipo | Unidades / Formato | Descripción |
|---|---|---|---|
| `tiempo_utc` | string (ISO-8601) | `YYYY-MM-DDTHH:MM:SSZ` | Marca temporal real de la observación del sensor físico |
| `tiempo_recuperado_utc` | string (ISO-8601) | `YYYY-MM-DDTHH:MM:SSZ` | Marca temporal en la que MeteoSurf descargó el dato |
| `tipo_sensor` | string | `BOYA` \| `MAREOGRAFO` \| `VIENTO` | Categoría del sensor |
| `estacion_id` | integer | ID numérico | ID oficial de Puertos del Estado (ej. 2630) |
| `estacion_nombre` | string | Texto | Nombre descriptivo del sensor |
| `lat` | float | Grados decimales | Latitud geográfica |
| `lon` | float | Grados decimales | Longitud geográfica |
| `distancia_km` | float | Kilómetros | Distancia a Castellón (Planetario: 39.9858, 0.0277) |
| `fuente` | string | Texto | Red oficial ("Puertos del Estado · REDEXT", etc.) |
| `url_fuente` | string | URL | Endpoint de consulta |
| `altura_m` | float / null | Metros (Hm0) | Altura significante de oleaje (boya) |
| `altura_max_m` | float / null | Metros (Hmax) | Altura máxima de ola (boya) |
| `periodo_s` | float / null | Segundos (Tp) | Periodo de pico (boya) |
| `periodo_medio_s` | float / null | Segundos (Tm02) | Periodo medio (boya) |
| `direccion_grados` | integer / null | Grados [0–360] | Dirección media de procedencia del oleaje |
| `direccion_pico_grados` | integer / null | Grados [0–360] | Dirección en el pico espectral |
| `temperatura_agua_c` | float / null | °C | Temperatura del agua |
| `nivel_mar_m` | float / null | Metros | Nivel medido por mareógrafo |
| `viento_velocidad_ms` | float / null | m/s | Velocidad media del viento |
| `viento_velocidad_kmh` | float / null | km/h | Velocidad media convertida a km/h |
| `viento_racha_ms` | float / null | m/s | Racha máxima de viento |
| `viento_racha_kmh` | float / null | km/h | Racha máxima convertida a km/h |
| `viento_direccion_grados` | integer / null | Grados [0–360] | Dirección de procedencia del viento |
| `temperatura_aire_c` | float / null | °C | Temperatura del aire |
| `calidad_flag` | string | `OK` \| `DUDOSO` \| `AVERIA` | Validación frente a rangos físicos |
| `raw_payload` | string / JSON | JSON compacto | Registro crudo recibido de Portus |

**Clave de deduplicación idempotente:**
`ID = (tipo_sensor, estacion_id, tiempo_utc)`
Cualquier nueva ejecución verifica si la clave ya existe; si ya existe, no añade duplicado y preserva el registro existente.

### 2.2 Archivo de Sesiones Confirmadas
Ubicación:
- `data/sesiones_confirmadas.json`

**Campos:**
- `id`: Identificador único (ej: `SESION-20261009-PLANETARIO`)
- `fecha`: `YYYY-MM-DD`
- `hora_inicio_local`: `HH:MM`
- `hora_fin_local`: `HH:MM`
- `tiempo_utc_inicio`: ISO-8601 UTC
- `tiempo_utc_fin`: ISO-8601 UTC
- `spot_id`: Identificador del spot (ej: `planetario`)
- `spot_nombre`: Nombre del spot ("Planetario")
- `fuente_reporte`: Documento u origen del reporte
- `surfista`: Nombre del observador ("Jordi", etc.)
- `calidad_percibida`: Texto ("Regular", "Bueno", etc.)
- `calidad_escala_0_5`: Entero o decimal (0 a 5)
- `altura_rompiente_estimada_m`: Altura observada en la rompiente
- `boya_simultanea_altura_m`: Hm0 de la Boya de Valencia en esa franja
- `boya_simultanea_periodo_s`: Tp de la Boya de Valencia
- `modelo_emitido_altura_m`: Altura emitida por el modelo en esa franja
- `modelo_emitido_calidad_0_5`: Calidad emitida por la web en esa franja
- `comentarios`: Diagnóstico y notas cualitativas

---

## 3. Contrato del Cuaderno Excel (`.xlsx`)

Generado mediante script reproducible `scripts/exportar_excel.py` utilizando la librería estándar `openpyxl` (conforme a la directiva de fallback autorizado del skill `spreadsheets`).

### Estructura de Hojas:
1. **`Resumen`**: Portada ejecutiva con contexto del proyecto, metadatos, fuentes oficiales con URLs completas, estadísticas de registros y conteos de calidad.
2. **`Observaciones Boyas`**: Registro histórico cronológico de las observaciones de oleaje de boyas (Valencia 2630, Tarragona 2720 y 1712).
3. **`Nivel y Viento`**: Registro histórico de mareógrafos (Sagunto 3655) y estaciones REMPOR (Castellón 4660).
4. **`Previsiones Emitidas`**: Registro histórico de las previsiones de Open-Meteo guardadas en `historico_olas.csv` sin modificación.
5. **`Sesiones Confirmadas`**: Tabla de sesiones de surf reportadas y documentadas con evaluación cualitativa y cuantitativa.
6. **`Calibracion y Diagnostico`**: Cruce analítico entre Boya real, Previsión del Modelo y Evaluación Humana (incluye el caso clave de calibración del 09/10/2026), con fórmulas de ratio y desviación calculadas en celdas de Excel auditables.

### Reglas de Diseño y Calidad del Excel (Skill Spreadsheets):
- Formatos numéricos invariant: `#,##0.00` para metros, `#,##0.0` para segundos y km/h, `yyyy-mm-dd hh:mm` para fechas.
- Encabezados congelados (freeze panes) y cuadrícula (gridlines) activada en todas las hojas.
- Ajuste automático de ancho de columna para evitar textos o números truncados.
- Tratamiento explícito de valores faltantes (celda vacía o guión, sin ceros falsos).
- Cero fórmulas rotas (`#REF!`, `#VALUE!`, `#NAME?`).

---

## 4. Estrategia de Automatización en Nube Gratis (Coste Cero)

Para mantener el histórico alimentado de forma continua sin depender del ordenador personal ni tarjetas de crédito:
- Se añade un paso liviano en el flujo existente `.github/workflows/realtime.yml` de GitHub Actions (que ya corre cada hora).
- Tras ejecutar `realtime.py`, se ejecuta `python scripts/archivar_historico.py`, que:
  1. Lee `data/realtime.json`.
  2. Extrae las nuevas observaciones de boya, mareógrafo y viento.
  3. Las añade deduplicadas a `data/historico_observaciones.jsonl` y `data/historico_observaciones.csv`.
  4. Regenera opcionalmente el Excel `data/MeteoSurf_Historico_Calibracion.xlsx`.
  5. GitHub Actions hace commit de los archivos de histórico y push automático.
- No se requiere ningún servicio externo de pago ni servidor propio.

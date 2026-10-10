# Auditoría de Datos, Archivo Histórico y Cuaderno de Calibración

**Proyecto:** MeteoSurf_Cs  
**Rama:** `Joorcs96/historico-datos`  
**Autor:** Antigravity (Worker `task_f696a37637f7` / `ctx_58e82b5d6a08`)  
**Fecha:** 11/10/2026  
**Estado:** [VERIFICADO] en suite de pruebas automatizadas y validación manual.

---

## 1. Auditoría Inicial: ¿MeteoSurf guardaba TODOS los datos de boyas?

### Respuesta ejecutiva a Jordi:
**NO.** Hasta ahora MeteoSurf **NO** guardaba de forma acumulativa las observaciones reales de boyas ni de las demás estaciones:
- `data/realtime.json`: se sobreescribía en cada ejecución horaria del workflow (`.github/workflows/realtime.yml`). Solo contenía la *última observación puntual* (1 registro instantáneo de la Boya de Valencia, 2 boyas cercanas, 1 de mareógrafo y 1 de viento).
- `historico_olas.csv`: a pesar de llamarse histórico, **no contiene observaciones reales de boyas**. Contiene **2.640 filas** de predicciones del modelo numérico de **Open-Meteo** (del 25-sep al 10-oct) para 10 spots, calculadas por `backend/actualizar_prevision.py`. La columna `feedback_usuario` estaba vacía en el 100% de los registros.
- Sesiones confirmadas: no existía base de datos centralizada; `votar.html` solo guardaba en el `localStorage` del navegador del usuario (`msc_sessions`).

### Hallazgo de recuperación crítica [VERIFICADO]:
Afortunadamente, el workflow de GitHub Actions (`realtime.yml`) hacía commit automático de `data/realtime.json` cada vez que detectaba cambios en las medidas.
- A través de los **165 commits históricos de Git** (entre 2026-09-30T00:19Z y 2026-10-10T09:43Z), se ha podido rescatar y reconstruir el histórico real sin inventar un solo dato.
- Se han recuperado y deduplicado exactamente **814 observaciones reales de Puertos del Estado**:
  - **486 observaciones horarias de boyas de oleaje**:
    - Boya de Valencia (REDEXT profunda, id 2630): 162 mediciones (2026-09-29T22:00Z a 2026-10-10T09:00Z).
    - Boya de Tarragona (Exterior, id 2720): 161 mediciones.
    - Boya de Tarragona (Costera, id 1712): 163 mediciones.
  - **164 observaciones de nivel del mar**: Mareógrafo de Sagunto (REDMAR, id 3655).
  - **164 observaciones de viento**: Estación Meteorológica Castellón Mistral (REMPOR, id 4660).
- **Huecos detectados [VERIFICADO]:** En la Boya de Valencia existen 14 huecos temporales mayores a 1.5 horas (por caídas puntuales del runner de GitHub o de la API de Portus), destacando el intervalo de 22 h entre el 08-oct 15:00Z y el 09-oct 13:00Z. Conforme al principio de honestidad de datos, **los datos faltantes se preservan como faltantes (null / vacío)** y nunca se inventan interpolaciones ficticias.

---

## 2. Nueva Arquitectura del Histórico Acumulativo

Se han creado tres componentes independientes y modulares sin alterar archivos existentes de otros agentes:

### 2.1 Script Archivador Canónico (`scripts/archivar_historico.py`) [VERIFICADO]
- **Objetivo:** Ingesta y deduplicación acumulativa estricta.
- **Clave de deduplicación:** `(tipo_sensor, estacion_id, tiempo_utc_sensor)`.
- **Diferenciación temporal:**
  - `tiempo_utc`: Hora exacta del sensor físico (campo `fecha` de Portus).
  - `tiempo_recuperado_utc`: Hora en que el sistema de recolección descargó el dato (campo `generado`).
  - `commit_hash`: Hash del commit original de procedencia (para trazabilidad).
- **Formatos duales canónicos:**
  - `data/historico_observaciones.jsonl`: Formato JSON Lines, óptimo para append rápido, motores de cálculo y versionado ligero.
  - `data/historico_observaciones.csv`: Formato CSV tabular con 26 columnas canónicas y tipado homogéneo.
- **Idempotencia probada:** Ejecutarlo múltiples veces seguidas produce exactamente 0 duplicados y preserva el 100% de los datos previos.

### 2.2 Catálogo de Sesiones Confirmadas (`data/sesiones_confirmadas.json`) [VERIFICADO]
Registra las sesiones de surf contrastadas y documentadas por Jordi y surfistas locales:
1. `SESION-20260930-PLANETARIO`: 30/09/2026 18:40-19:00 (Jordi). Mar plato/escaso (0.25 m en rompiente), viento ESE con rachas. Modelo daba 0.50 m (sobreestimación Komar).
2. `SESION-20261005-PLANETARIO-MANANA`: 05/10/2026 09:00 (amigo Jordi). 0.47 m rompiente limpia con terral, sesión navegable (Regular-Bueno, 2★).
3. `SESION-20261005-PLANETARIO-TARDE`: 05/10/2026 15:00 (Jordi). Bajón drástico de mar a plano, viento de mar picó el agua.
4. `SESION-20261009-PLANETARIO`: 09/10/2026 08:00-14:00 (Jordi). Sesión aprovechable (calidad 4 Regular-Bueno, 0.64 m rompiente). Boya midió 0.94 m y 7.23 s, mientras la emisión matinal de la web daba 0.31 m y calidad 1 (Muy malo) por subestimación del modelo marino de Open-Meteo mar adentro (factor 1.62x a 3x).

### 2.3 Exportador Excel Profesional (`scripts/exportar_excel.py`) [VERIFICADO]
Genera `data/MeteoSurf_Historico_Calibracion.xlsx` cumpliendo estrictamente el estándar Spreadsheets (openpyxl):
- **Hoja 1 (`Resumen`):** Metadatos, tabla de fuentes oficiales con URLs completas (`https://portus.puertos.es/portussvr/api`), estadísticas de conteo y cobertura.
- **Hoja 2 (`Observaciones Boyas`):** 486 registros cronológicos con Hm0, Hmax, Tp, Tm02, Dir, Temp Agua, banderas de calidad y commit de origen.
- **Hoja 3 (`Nivel Mar y Viento`):** 328 registros combinados de nivel del mar y anemometría (velocidad km/h, racha km/h y dirección).
- **Hoja 4 (`Previsiones Emitidas`):** Las 2.640 previsiones emitidas originalmente por Open-Meteo (`historico_olas.csv`), sin mezcla con boyas ni lookahead bias.
- **Hoja 5 (`Sesiones Confirmadas`):** Las 4 sesiones documentadas con evaluación empírica y fórmulas de ratio boya/modelo.
- **Hoja 6 (`Calibracion y Diagnostico`):** Cruce horario analítico y fórmulas auditables de desviación (`=Boya - Modelo`), ratio y diagnóstico cualitativo automatizado (`=IF(Ratio>1.35, "Subestimación", ...)`).
- **Calidad visual:** Paneles congelados (`freeze_panes`), cuadrícula visible (`showGridLines = True`), anchos automáticos sin truncar texto ni números (`###`), cero fórmulas con error (`#REF!`, `#DIV/0!`, `#VALUE!`).

---

## 3. Automatización en la Nube con Coste Cero

Para garantizar que el histórico se alimente permanentemente sin depender de que el ordenador de Jordi esté encendido y sin gastar cuotas de pago ni tarjetas:
- Se integra en el flujo existente de GitHub Actions: `.github/workflows/realtime.yml`.
- Se añade un paso inmediatamente posterior a la ejecución de `realtime.py`:

```yaml
      - name: Archivar observaciones en histórico canónico y regenerar Excel
        run: |
          python scripts/archivar_historico.py --agregar-snapshot
          python scripts/exportar_excel.py

      - name: Guardar cambios en los datos reales e histórico
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add data/realtime.json data/historico_observaciones.jsonl data/historico_observaciones.csv data/MeteoSurf_Historico_Calibracion.xlsx
          if ! git diff --staged --quiet; then
            git commit -m "Auto: actualización de observaciones en tiempo real e histórico acumulado [skip ci]"
            git pull --rebase origin "$GITHUB_REF_NAME"
            git push
          fi
```

*Ventajas de coste cero:*
1. Aprovecha los minutos gratuitos mensuales de GitHub Actions (runners públicos de Ubuntu).
2. No realiza llamadas duplicadas a la API de Puertos del Estado: `archivar_historico.py` lee directamente el `data/realtime.json` que acaba de generar `realtime.py`.
3. Es 100% idempotente: si las boyas no han emitido datos nuevos, no genera duplicados.
4. El Excel queda siempre actualizado y disponible para descarga en GitHub o GitHub Pages.

---

## 4. Comandos de Validación y Reproducibilidad

Todos los comandos son ejecutables en la raíz del proyecto:

```bash
# 1. Reconstruir histórico completo desde commits de Git y verificar estadísticas
python scripts/archivar_historico.py --bootstrap

# 2. Agregar el snapshot actual deduplicadamente
python scripts/archivar_historico.py --agregar-snapshot

# 3. Exportar el cuaderno Excel completo
python scripts/exportar_excel.py

# 4. Ejecutar la suite completa de pruebas de integridad, dedup y Excel
python -m unittest scripts.test_historico_datos

# 5. Ejecutar la suite general de pruebas del proyecto
python -m unittest scripts.test_realtime backend.test_motor_fisica scripts.test_rewind
node tools/test_rating_conservador.js
node tools/test_formato_null.js
```

---

## 5. Tabla de Verificación de Requisitos

| Requisito | Estado | Evidencia |
|---|---|---|
| Auditoría si se guardaban boyas | [VERIFICADO] | Confirmado que no se guardaban acumuladas; solo la última foto. |
| Recuperación de datos reales pasados | [VERIFICADO] | 814 observaciones recuperadas de 165 commits de Git (486 boyas, 164 mareógrafo, 164 viento). |
| Preservación de `historico_olas.csv` original | [VERIFICADO] | Archivo intacto con sus 2.640 filas de predicción. |
| No solapamiento con otros agentes (`ctx_3c7fd5ee9ed3`) | [VERIFICADO] | No se ha tocado `rewind.py`, UI ni workflows de clips. |
| Deduplicación e idempotencia estricta | [VERIFICADO] | Probado en `test_02_persistencia_e_idempotencia_dedup`. |
| Cuaderno Excel `.xlsx` generado profesionalmente | [VERIFICADO] | 6 hojas, cero errores de fórmula, validado con openpyxl. |
| Automatización en nube a coste cero propuesta | [VERIFICADO] | Diseño integrado para `.github/workflows/realtime.yml`. |
| Ausencia de lookahead bias (fuga futura) | [VERIFICADO] | Previsiones guardadas tal como se emitieron, sin mezclar con boyas. |
| Publicación o merge prematuro a main | [VERIFICADO] | Ninguno realizado; trabajo aislado en rama `Joorcs96/historico-datos`. |

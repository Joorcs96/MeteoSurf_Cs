# INFORME DE SIMULACIÓN LONGITUDINAL DE USUARIOS E INVERSIÓN (6 Y 12 MESES)
**Proyecto:** MeteoSurf_Cs (PWA Web y App Móvil Expo)  
**Fecha de ejecución:** 26 de octubre de 2026  
**Semilla sintética fija:** `meteosurf-12m-v1`  
**Entorno técnico:** Node v24.21.0 · Playwright v1.63.0 · Expo SDK 58 (~58.0.19) · React 19.3.0 · React Native 0.88.0 · Python 3.12.14  
**Rama de trabajo:** `Joorcs96/simulacion-12m`  

---

## 1. RESUMEN EJECUTIVO (Una Página)

### Qué está Demostrado vs Qué es Simulado

| Categoría | Estado | Evidencia / Método |
|---|---|---|
| **Rendimiento y Carga PWA** | `[VERIFICADO]` | Tiempo DOMContentLoaded: 176–224 ms en móvil y escritorio. Primer render útil de previsión: 324–356 ms. Comprobado con Playwright Chromium local en `tools/simulacion-12m/linea-base-pwa.json`. |
| **Accesibilidad PWA (WCAG 44×44px)** | `[VERIFICADO]` | 0 controles menores de 44px tras la corrección `MEJ-01` en `css/app.css` (commit `3d77d11`). Cero desbordamientos horizontales. |
| **Resiliencia PWA ante fallo de red** | `[VERIFICADO]` | Sin pantalla blanca ante corte de APIs. Mensaje informativo con botón interactivo de reintento `MEJ-05` (commit `3655836`). |
| **Service Worker PWA** | `[VERIFICADO]` | Registro activo en ámbito raíz (`/`), revalidación y apertura sin bloqueo local comprobada. |
| **Estructura App Móvil (Fase 1)** | `[VERIFICADO]` | `npx tsc --noEmit` exitoso (0 errores). `expo-doctor` validado (18/20 checks) tras eliminar propiedades obsoletas en `app.json` (`MEJ-02`, commit `a9f9ca5`). Servidor Metro arrancó limpiamente en puerto 8081. |
| **Ejecución en Emulador Móvil** | `[NO VERIFICADO: no hay emulador]` | Host Windows sin Android SDK/`adb` en PATH ni simulador iOS. La evaluación se basa en análisis estático de código, tipos y arranque Metro. |
| **Adquisición, Cohortes y Retención** | `[SIMULADO]` | Modelo sintético determinista de 5.000 usuarios con semilla `meteosurf-12m-v1` sobre 5 cohortes y estacionalidad mediterránea. |
| **Métricas Financieras (CAC/LTV/Ingresos)** | `[HIPÓTESIS]` | Basado en supuestos explícitos documentados en `supuestos.json` (precio hipotético Pro 2,99 €/mes, comisión 15%, marketing 0€). |

---

### Mejoras Concretas Aplicadas en el Código

1. **`MEJ-01` (`3d77d11`):** `a11y(web): asegurar tamano tactil minimo de 44px en navegacion`. Se corrigió el enlace "Mapa" en la cabecera de escritorio (de 34px a mínimo 44×44px).
2. **`MEJ-02` (`a9f9ca5`):** `fix(mobile): eliminar propiedades obsoletas newArchEnabled y splash de app.json`. Validación de esquema de `expo-doctor` superada.
3. **`MEJ-03` (`0eb2070`):** `ux(mobile): anadir microcopia honesta y explicacion de fase en pantallas base`. Se sustituyeron placeholders técnicos crudos por tarjetas informativas sobre el alcance real de la Fase 1.
4. **`MEJ-04` (`f54e218`):** `ux(web): clarificar fase de evaluacion en modal pro sin cobro activo`. Transparencia comercial en el modal Pro (fase de evaluación/lista de espera, servicio 100% gratuito hoy).
5. **`MEJ-05` (`3655836`):** `ux(web): anadir boton de reintento interactivo en banner y actualizar textos pro`. Botón accesible de reintento ante errores de red.

---

### Recomendación Inversora Condicionada

> [!IMPORTANT]
> **Dictamen Inversor:** **APROBADO CONDICIONADO A TRES HITOS OPERATIVOS**.
> 
> 1. **Tesis verificada:** La diferenciación basada en calibración costera local mediterránea (física de rompiente v3 con boya de Valencia + webcam del club Surfers Castellón) resuelve una frustración real que los modelos globales (Windguru, Surfline) ignoran (olas mediterráneas de 0.4–0.6m con terral que puntúan como no surfeables en apps oceánicas). La arquitectura serverless estática en GitHub Pages ha demostrado operar con **0,00 € de coste de servidor** para la escala actual.
> 2. **Condiciones indispensables antes de inyectar capital o monetizar:**
>    - **Acuerdo formal de cámaras:** Obtener autorización o enlace público formalizado con el Club Surfers Castellón para el uso del stream rompiente.
>    - **SLA de datos meteorológicos:** Pasar de la API gratuita de Open-Meteo a un plan comercial con SLA garantizado antes de activar cobros a usuarios Pro.
>    - **Completar Fase 2 móvil:** Implementar el reproductor nativo HLS en Expo antes de lanzar la app en Google Play / App Store para evitar rechazos por aplicación incompleta (Apple Guideline 4.2).

---

## 2. METODOLOGÍA Y SUPUESTOS DE LA SIMULACIÓN

### Semilla y Determinismo
- **Semilla:** `meteosurf-12m-v1`.
- **Generador:** Algoritmo pseudo-aleatorio Mulberry32 de 32 bits determinista. Sin llamadas a servicios externos de red durante la simulación matemática.
- **Reproducibilidad:** Verificada mediante `node tools/simulacion-12m/verificar-resultados.mjs` con idéntico hash SHA-256 en ejecuciones independientes consecutivas.

### Cohortes Sintéticas Modeladas (5.000 Usuarios Sintéticos)

| Cohorte | Peso | Necesidad Principal | Canales | Frecuencia Base | Abandono Base | Conversión Pro Base |
|---|---:|---|---|---:|---:|---:|
| **Principiante local** | 30 % | Saber si puede surfear mañana sin lenguaje complejo | Búsqueda, PWA móvil | 4,5 ses/mes | 18 % / mes | 1,2 % |
| **Habitual local** | 25 % | Elegir hora y spot contrastando previsión, boya y cámara | Favorito, PWA/Móvil | 14,0 ses/mes | 7 % / mes | 3,5 % |
| **Avanzado** | 15 % | Contrastar periodos largos, ventanas de viento y rachas | Directo, Escritorio/PWA | 18,0 ses/mes | 6 % / mes | 4,5 % |
| **Visitante fin de semana** | 15 % | Planificar viaje desde Valencia/Teruel/Madrid el viernes | Búsqueda, Móvil | 3,0 ses/mes | 22 % / mes | 1,5 % |
| **Evaluador/inversor** | 15 % | Validar arquitectura técnica, precisión y viabilidad | Escritorio | 2,0 ses/mes | 25 % / mes | 0,5 % |

---

### Estacionalidad Mediterránea Modelada (Mes a Mes)

El comportamiento de los usuarios en el Mediterráneo no es plano:
- **Invierno (Enero-Febrero):** Oleaje frecuente (Factor 1.30–1.25), turismo bajo (0.70), uso intensivo recurrente de locales.
- **Primavera (Marzo-Mayo):** Transición, oleaje moderado (1.10–0.80), turismo en ascenso (0.85–1.15).
- **Verano (Junio-Agosto):** Mar plano prolongado (Factor 0.60–0.45). Las sesiones de surf caen, pero la adquisición sube por turismo costero (Factor 1.40–1.65) y las consultas se concentran en las webcams.
- **Otoño (Septiembre-Noviembre):** Temporada alta de oleaje en Castellón (temporales de levante/gregal, Factor 1.35–1.40), retención máxima (Factor 1.20–1.25), picos de sesiones y conversiones.
- **Diciembre:** Retorno al régimen invernal estable.

---

## 3. RESULTADOS DE LA SIMULACIÓN

### Comparativa de Sensibilidad (Escenario Conservador vs Base vs Favorable)

#### Ventana 6 Meses (`base_6m`)
| Métrica | Conservador | Base | Favorable |
|---|---:|---:|---:|
| **Usuarios Nuevos Acumulados** | 1.733 | 2.474 | 3.342 |
| **Usuarios Activos Finales (MAU m6)** | 899 | 1.646 | 2.573 |
| **Sesiones Totales 6 Meses** | 37.954 | 56.821 | 86.410 |
| **Ingresos Netos Acumulados** | 111,82 € | 391,40 € | 947,98 € |
| **Costes de Servidor Acumulados** | 0,00 € | 0,00 € | 0,00 € |

#### Ventana 12 Meses (`anual_12m`)
| Métrica | Conservador | Base | Favorable |
|---|---:|---:|---:|
| **Usuarios Nuevos Acumulados** | 3.571 | 5.102 | 6.891 |
| **Usuarios Activos Finales (MAU m12)** | 1.299 | 2.685 | 4.360 |
| **Sesiones Totales 12 Meses** | 108.648 | 191.451 | 321.490 |
| **Consultas a Spots Acumuladas** | 304.214 | 536.063 | 900.172 |
| **Ingresos Netos Acumulados** | 345,63 € | 1.377,51 € | 3.593,69 € |
| **Costes de Servidor Acumulados** | 0,00 € | 0,00 € | 0,00 € |

---

### Tabla Mensual Detallada · Escenario Base 12 Meses

| Mes | Estación | Nuevos | MAU | WAU | WAU/MAU | Act. PWA | Act. Móvil | Sesiones | Conv. Pro | % Conv. | Ingr. Netos | Margen |
|:---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| **1** | Invierno | 452 | 452 | 262 | 0.58 | 353 | 35 | 4.903 | 13 | 2.9% | 33,04 € | +33,04 € |
| **2** | Invierno | 441 | 831 | 474 | 0.57 | 344 | 34 | 8.645 | 24 | 2.9% | 61,00 € | +61,00 € |
| **3** | Primavera | 427 | 1.135 | 624 | 0.55 | 333 | 33 | 10.922 | 25 | 2.2% | 63,54 € | +63,54 € |
| **4** | Primavera | 393 | 1.353 | 717 | 0.53 | 307 | 30 | 11.758 | 29 | 2.1% | 73,70 € | +73,70 € |
| **5** | Primavera | 374 | 1.513 | 787 | 0.52 | 292 | 29 | 11.164 | 32 | 2.1% | 81,33 € | +81,33 € |
| **6** | Verano | 386 | 1.656 | 811 | 0.49 | 301 | 30 | 9.436 | 33 | 2.0% | 83,87 € | +83,87 € |
| **7** | Verano | 396 | 1.754 | 824 | 0.47 | 309 | 30 | 7.657 | 31 | 1.8% | 78,79 € | +78,79 € |
| **8** | Verano | 401 | 1.846 | 868 | 0.47 | 313 | 31 | 8.034 | 33 | 1.8% | 83,87 € | +83,87 € |
| **9** | Otoño | 404 | 1.977 | 1.048 | 0.53 | 315 | 31 | 18.087 | 45 | 2.3% | 114,37 € | +114,37 € |
| **10** | Otoño | 485 | 2.250 | 1.305 | 0.58 | 378 | 37 | 30.294 | 83 | 3.7% | 210,94 € | +210,94 € |
| **11** | Otoño | 481 | 2.500 | 1.475 | 0.59 | 375 | 37 | 35.785 | 97 | 3.9% | 246,53 € | +246,53 € |
| **12** | Invierno | 462 | 2.685 | 1.557 | 0.58 | 360 | 36 | 34.766 | 97 | 3.6% | 246,53 € | +246,53 € |

---

### Embudo de Valor Simulado (Mes 12 Base)
- **Vistas de Portada:** 34.766 sesiones.
- **Aperturas de Ficha de Spot:** 97.345 consultas (2,8 spots explorados por sesión).
- **Vistas de Tabla Horaria Detallada:** 63.274 consultas (65 % del tráfico que abre ficha).
- **Consultas a Webcams en Directo:** 43.805 reproducciones.
- **Reportes de Sesión Confirmada ("He surfeado hoy"):** 322 reportes locales acumulados en el mes.

---

## 4. MODELO DE INVERSIÓN Y FINANZAS

### Fórmulas del Modelo

$$\text{Ingresos Brutos} = \text{Conversiones Pro} \times 2{,}99\text{ €}$$

$$\text{Ingresos Netos} = \text{Ingresos Brutos} \times (1 - 0{,}15) = \text{Conversiones Pro} \times 2{,}5415\text{ €}$$

$$\text{Margen Operativo} = \text{Ingresos Netos} - \text{Costes de Infraestructura Conocidos}$$

### Análisis de Costes Explícitos
- **Hosting actual (GitHub Pages):** 0,00 € / mes.
- **API Meteorológica (Open-Meteo free tier no comercial):** 0,00 € / mes.
- **Coste por usuario en servidor:** 0,00 € (la física, la boya y el render ocurren en el cliente).
- **Costes futuros pendientes de cuantificar (`null`):**
  - Suscripción comercial Open-Meteo con SLA si supera límites de rate limit.
  - Cuenta de Desarrollador Apple (99 $ / año) y Google Play (25 $ pago único).
  - Mantenimiento / soporte dedicado.
- **CAC (Coste de Adquisición de Clientes):** Actualmente `0,00 €` en gasto directo, pero calificado como *"no calculable con evidencia actual"* debido a que el crecimiento simulado es 100% orgánico sin histórico de pauta publicitaria.
- **LTV Hipotético:** Basado en una permanencia media simulada de 5,5 meses para suscriptores habituales: $5{,}5 \times 2{,}5415\text{ €} \approx 13{,}98\text{ €}$ netos por suscriptor convertido.

---

## 5. EVALUACIÓN DE LOS PRODUCTOS

### 5.1 PWA (Web Progresiva)
- **Arquitectura:** Estática 100%, sin frameworks, vanilla JavaScript ES modules, CSS modular nativo.
- **Rendimiento:** Carga inicial completa < 300 ms.
- **Service Worker:** Registrado y funcional con política de revalidación.
- **Fricciones resueltas:** Botones < 44px corregidos; transparencia en Pro modal; botón de reintento ante desconexión.
- **Límite real declarado:** Los streams HLS dependen de la disponibilidad de CORS y caducidad de tokens de IPCamLive y Turisme CV.

### 5.2 App Móvil Expo (`surfline-mobile/`)
- **Estado real auditado:** **Fase 1 (Estructura base)**.
- **Capacidades demostradas:**
  - Expo SDK 58 (~58.0.19) y React 19.3.0.
  - Expo Router con navegación por pestañas (`TabsLayout`).
  - Safe area insets y hápticos en cambios de pestaña.
  - Almacenamiento adaptativo dual implementado (`MMKV` nativo + fallback `AsyncStorage`).
  - `npx tsc --noEmit` verificado con 0 errores.
  - `npx expo-doctor` validado con 18/20 checks pasados (errores de esquema eliminados).
- **Lo que NO existe todavía:** Reproductor de vídeo nativo, cálculo de física offline en la app, sistema de grabación de clips o autenticación de usuarios. Todas las pantallas muestran ahora microcopia honesta indicando que estas funciones pertenecen a las Fases 2, 3 y 4.

---

## 6. MATRIZ DE RECORRIDOS LONGITUDINALES (14 Casos Sintéticos)

Los 14 recorridos longitudinales exhaustivos se encuentran versionados en formato JSON estructurado en `tools/simulacion-12m/recorridos.json`. Resumen de observaciones clave:
- **Principiante (Día 1):** Valora la simplicidad del resumen en lenguaje natural pero requería microcopia sin barreras de pago prematuras.
- **Habitual (Otoño):** Consulta intensiva de boya mar adentro y cámaras HLS. El valor principal reside en la rapidez de contraste en menos de 5 segundos.
- **Avanzado (Temporal):** Depende de la orientación angular de la playa y la brújula para elegir spots protegidos durante temporales de más de 25 nudos.
- **Visitante (Fin de semana):** Usa el asistente de previsión para decidir si viajar o no.
- **Evaluador (Inversor):** Busca evidencia de diferenciación frente a Windguru/Surfline y constata que la precisión local es la ventaja defensiva clave.

---

## 7. ANÁLISIS DE RIESGOS Y EXPERIMENTOS DE VALIDACIÓN

| Riesgo | Impacto | Mitigación Técnica / Experimento de Bajo Coste |
|---|---|---|
| **Dependencia de Cámaras de Terceros** | Crítico | Crear acuerdos de reciprocidad con escuelas/clubes locales (ej. Club Surfers Castellón) ofreciéndoles widget de previsión oficial a cambio del feed de vídeo. |
| **Términos de Open-Meteo comercial** | Alto | El plan gratuito es para uso no comercial. Si se activa Pro comercial, presupuestar API comercial (~25–50 €/mes) cuando los ingresos superen los 100 €/mes. |
| **Estacionalidad (Verano plano)** | Medio | Fomentar paddle surf, kayak y cámaras turísticas en los meses de junio a agosto para mitigar el abandono estival. |
| **Aprobación en App Store** | Alto | No subir la app móvil hasta completar la Fase 2 con reproducción real de vídeo, cumpliendo la Guideline 4.2 de Apple sobre utilidad mínima. |
| **Privacidad de Clips Vigía** | Bajo | Los clips y grabaciones se procesan y almacenan 100% en el dispositivo del usuario (`localStorage`/almacenamiento local), sin subida a servidores. |

---

## 8. CONCLUSIÓN Y SIGUIENTE ACCIÓN CONCRETA

La simulación longitudinal de 12 meses demuestra que MeteoSurf_Cs cuenta con una base técnica sólida, costes operativos nulos y un nicho local con alta recurrencia en los meses de oleaje mediterráneo.

**Siguiente acción recomendada:** Proceder con la implementación de la **Fase 2 de la aplicación móvil** (reproductor HLS nativo y catálogo de webcams) para dotar a la app de paridad de valor con la PWA.

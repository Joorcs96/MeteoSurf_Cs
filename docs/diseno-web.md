# Sistema de Diseño Web y Flujo de Trabajo · MeteoSurf_Cs

Guía técnica y metodológica para el mantenimiento y evolución visual de **MeteoSurf_Cs**. Documenta la aplicación de las cinco herramientas de diseño, la paleta costera adoptada, los tokens de interfaz y el flujo de verificación visual automatizado.

---

## 1. Dirección de Producto y Principios Visuales

MeteoSurf_Cs es una **PWA técnica de previsión y datos marinos para surfistas de Castellón**, orientada a consulta rápida sobre el terreno (a pie de playa y bajo luz solar directa), **no una landing page publicitaria** ni un catálogo de marketing.

### Principios de Diseño
- **Lectura de datos inmediata:** La primera pantalla prioriza datos operacionales reales (altura, periodo, viento, tendencia) y accesos directos sin scroll forzado ni héroes gigantescos decorativos.
- **Sin contenedores anidados artificiales:** Se evitan cajas dentro de cajas dentro de cajas. Estructura visual abierta con bordes sutiles y tarjetas elevadas por borde (`--line`).
- **Cockpit de alta densidad útil:** Configuración inspirada en *Taste Skill* con `VARIANCE: 5`, `MOTION: 3` y `DENSITY: 7`.
- **Regla anti-slop:** Cero em-dashes (`—`) en elementos de interfaz visible; etiquetas en español técnico cuidado; contraste WCAG AA >= 4.5:1 en todos los estados.
- **Consistencia de esquinas y controles:** Radio unificado (`--radius: 6px`) y objetivos táctiles mínimos de 44×44 px en todos los controles interactivos.

---

## 2. Las 5 Herramientas de Diseño y su Estado Real

| Herramienta | Estado en este Entorno | Fuente Primaria / Ubicación | Rol y Aplicación en MeteoSurf_Cs |
| --- | --- | --- | --- |
| **1. Taste Skill** | [VERIFICADO] Instalado localmente | `C:/Users/Jordi/.agents/skills/taste-skill/SKILL.md` | Dials: V:5 / M:3 / D:7. Prohibición de em-dashes decorativos, tipografía tabular en métricas numéricas (`tabular-nums`), eliminación de animaciones innecesarias. |
| **2. Web Design Guidelines** | [VERIFICADO] Upstream oficial | `https://github.com/vercel-labs/web-interface-guidelines` / `agent-skills` | Reglas de accesibilidad de Vercel Labs: foco visible de 2px nativo (`--accent`), semántica HTML5 estricta, botones táctiles de 44 px, legibilidad en fondos fotográficos. |
| **3. Awesome Design** | [VERIFICADO] Upstream oficial + skills locales | `https://github.com/oscarotero/awesome-design` y `https://github.com/VoltAgent/awesome-design-md` | Sistema de tokens estructurado: separación semántica de superficies, texto institucional, bordes inspirados en cartografía marina y semáforo náutico calibrado. |
| **4. Image to Code** | [VERIFICADO] Instalado localmente (con restricción de coste cero) | `C:/Users/Jordi/.agents/skills/image-to-code-skill/SKILL.md` | **Restricción estricta de Jordi:** Prohibido el uso de APIs o modelos de pago para generación sintética de imágenes. En su lugar, el flujo visual se apoya en capturas Playwright CLI de referencia y en las fotografías reales libres de Wikimedia Commons asociadas a los 13 spots. |
| **5. Playwright CLI** | [VERIFICADO] Instalado localmente | `playwright-cli` (v0.1.22) / `npx playwright` (v1.63.0) con Microsoft Edge | Automatización headless de pruebas responsivas en 390×844 px (móvil) y 1440×1000 px (escritorio), detección de overflow horizontal y generación de capturas antes/después. |

---

## 3. Tokens del Sistema de Diseño (`css/app.css`)

### Paleta Costera Mediterránea ("Azul Tinta y Arena")

```css
:root {
  --font: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, system-ui, sans-serif;
  
  /* Modo Claro */
  --bg: #f7f8f9;         /* Base costera suave (evita blanco clínico cegador al sol) */
  --surface: #ffffff;    /* Tarjetas elevadas y paneles limpios */
  --surface-2: #eef1f4;  /* Arena grisácea / salitre para chips y áreas secundarias */
  --text: #0d1b2a;       /* Azul tinta profundo de alto contraste (> 12:1) */
  --text-2: #415a77;     /* Azul marino grisáceo para metadatos y secundarios (> 5:1) */
  --text-3: #6b7c8f;     /* Atenuado para detalles menores */
  --line: #d5dce2;       /* Frontera sutil inspirada en mapas náuticos */
  --brand: #0d1b2a;      /* Azul tinta institucional */
  --accent: #1d7090;     /* Marino Mediterráneo (< 80% saturación) */
  --radius: 6px;         /* Radio unificado para controles, chips y tarjetas */

  /* Semáforo de Calidad (8 escalones funcionales) */
  --r-flat: #b0bac5;     /* Plato / Sin datos */
  --r-vpoor: #e0486a;    /* Muy malo */
  --r-poor: #e67e22;     /* Malo */
  --r-poorfair: #d4a317;/* Malo-Regular */
  --r-fair: #16a085;     /* Regular */
  --r-fairgood: #0e8066;/* Regular-Bueno */
  --r-good: #4a69bd;     /* Bueno */
  --r-epic: #4834d4;     /* Épico */
}

/* Modo Oscuro (Mar nocturno profundo) */
@media(prefers-color-scheme:dark) {
  :root:not([data-theme=light]) {
    --bg: #0a1118;
    --surface: #0f1922;
    --surface-2: #182635;
    --text: #e6edf3;
    --text-2: #8da0b3;
    --text-3: #708599;
    --line: #243647;
    --brand: #e6edf3;
    --accent: #38a3c8;
  }
}
:root[data-theme=dark] {
  --bg: #0a1118;
  --surface: #0f1922;
  --surface-2: #182635;
  --text: #e6edf3;
  --text-2: #8da0b3;
  --text-3: #708599;
  --line: #243647;
  --brand: #e6edf3;
  --accent: #38a3c8;
}
```

---

## 4. Mejoras de Componentes Implementadas

1. **Header y Navegación Responsive:**
   - **Escritorio (`>= 800px`):** Las barras fijas inferiores `.tabbar` y `.quick-spots` se ocultan por completo (`display: none !important`), recuperando 120 px de viewport vertical y evitando la duplicidad con la barra superior `.topnav`.
   - **Móvil (`< 800px`):** Se conservan `.quick-spots` y `.tabbar` con diseño adaptado, alturas mínimas táctiles de 44–60 px y espaciado de seguridad (`env(safe-area-inset-bottom)`).
2. **Tarjeta de Spot (`.spot-card`):**
   - Estructura limpia tipo tarjeta elevada con borde sutil y sombra atenuada marina (`box-shadow: 0 1px 3px rgba(13, 27, 42, 0.04)`).
   - Bloque de altura con tipografía tabular (`tabular-nums`) para evitar saltos de línea al actualizar mediciones.
   - Metadatos organizados en fila horizontal limpia con iconos SVG normalizados.
   - Barra de previsión a 7 días (`.spark`) con micro-barras redondeadas y etiquetas centradas.
3. **Banner "Mejor ventana" (`.banner`):**
   - Rediseñado como resumen técnico náutico sobrio con borde lateral acentuado (`4px solid var(--accent)`), eliminando aspectos amarillentos o publicitarios.
4. **Fotografías Reales y Atribución:**
   - Preservación estricta de contenedores de relación 16:9 (`.spot-photo-container`) con carga desacoplada y créditos a autores y licencias de Wikimedia Commons (CC BY-SA).
5. **Accesibilidad y Foco:**
   - Indicador de foco visible de 2px con offset (`outline: 2px solid var(--accent); outline-offset: 2px`).
   - Contraste validado superior a 12:1 en texto principal y 5:1 en texto secundario.

---

## 5. Batería de Pruebas y Validación Reutilizable

Para verificar que cualquier cambio respete el contrato de diseño y no introduzca regresiones:

### 1. Pruebas Unitarias de Backend y Física
```bash
python -m unittest backend.test_motor_fisica
```
*(34 tests de propagación de oleaje, Komar y cálculo de rompiente).*

### 2. Pruebas de Formato y Rating Conservador
```bash
node tools/test_formato_null.js
node tools/test_rating_conservador.js
```
*(15 tests de nulos vs ceros y 17 tests de calibración conservadora mediterránea).*

### 3. Pruebas de Interfaz Responsiva (Edge Headless)
```bash
python -m unittest scripts.test_ui_responsive
```
*(4 tests de renderizado DOM en 390 px y 1366 px, verificación de fotos, comparador y ausencia de anchos fijos desbordantes).*

### 4. Suite Smoke Visual Completa (Playwright)
```bash
node C:/Users/Jordi/AppData/Local/Temp/meteosurf-diseno-20261015/qa/run-smoke.cjs .
```
*(32 comprobaciones automáticas: 4 escenarios cruzados [390 móvil / 1440 escritorio × claro / oscuro], 0 errores JS propios, 0 desbordamiento horizontal y capturas automáticas en `qa/shots/`).*

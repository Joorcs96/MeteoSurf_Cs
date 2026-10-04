# AUDITORÍA DE DISEÑO — SURFLINE CASTELLÓN
*Aplicada según: ui-ux-pro-max · redesign-skill · taste-skill · design-motion-principles*

## DESIGN READ
> **"App de previsión de surf para surfistas locales. Lenguaje técnico/inmersivo marino. Dark premium sports app (estilo Surfline/Strava). Mobile-first, data-dense, cinético pero sobrio."**
> 
> Dials: DESIGN_VARIANCE: 6 / MOTION_INTENSITY: 5 / VISUAL_DENSITY: 7

---

## 1. DIAGNÓSTICO ACTUAL

### Tipografía  
- ❌ `system-ui, -apple-system, ...` — fallback genérico sin personalidad  
- ❌ Solo pesos 400 y 700 (font-black = 900 directo, falta jerarquía intermedia con 500/600)  
- ❌ Tamaños `text-[10px]` y `text-[11px]` abundantes → ilegible en móvil  
- ❌ Sin `font-variant-numeric: tabular-nums` en datos numéricos (alturas, períodos, velocidad)  
- ❌ `text-wrap: balance` ausente en headers y tags  
- ✅ Uso de `font-black` (900) en métricas principales — correcto

### Color y Superficies  
- ⚠️ Demasiados colores de acento: sky-400, cyan-400, emerald-400, amber-400, rose-400, teal-400 — inconsistente visualmente  
- ❌ Sombras genéricas `shadow-2xl` sin tinte — no siguen luz coherente  
- ❌ Gradientes uniformes `from-surf-900 via-surf-850 to-surf-900` — planos, sin texture  
- ⚠️ Fondos en capas demasiado similares (surf-900/surf-950/surf-850) — poca separación visual  
- ✅ Base de colores surf-950 a surf-700 bien pensada para dark mode  
- ❌ Sin modo claro real (no pedido, pero tokens deben soportarlo)

### Layout  
- ❌ Tarjetas de spot en 3 columnas iguales en desktop → patrón más genérico de IA  
- ❌ `rounded-3xl` uniforme en todo → radio demasiado homogéneo  
- ❌ Cards de spot no pin-bottom del CTA → botones desalineados  
- ⚠️ `height: 100vh` no aparece (correcto) pero `min-h-screen` podría ser `min-h-dvh`  
- ✅ `max-w-7xl` container — bien  
- ❌ Densidad visual inconsistente: secciones hero muy aireadas vs tarjetas muy densas

### Animaciones  
- ❌ `animate-spin` en el spinner de refresh — innecesario en uso frecuente  
- ❌ `animate-ping` + `animate-pulse` coexisten sin criterio — demasiado ruido  
- ❌ Sin `prefers-reduced-motion` explícito  
- ❌ `transition-transform duration-500` en imágenes de tarjeta (hover scale) — demasiado lento  
- ✅ Flechas de dirección con `transition-transform duration-500` — correcto para datos de océano  
- ❌ Sin curvas de easing personalizadas (todo `ease` por defecto)

### Accesibilidad  
- ❌ Botones icono sin `aria-label` (refresh, fullscreen, close modal)  
- ❌ `cursor-pointer` ausente en varios botones  
- ⚠️ Objetivos táctiles de 32px en algunos botones de icono — faltan 12px para AA  
- ❌ Focus ring visible ausente en la mayoría de elementos interactivos  
- ❌ `sr-only` solo en el selector de tabla hourly  
- ✅ Uso de `<label>` con `for` en inputs del formulario de sesión

---

## 2. DIRECCIÓN DE DISEÑO ELEGIDA

### Sistema elegido: **Dark Marine — Premium Sports Data**
Inspirado en Surfline (app real), Strava dark mode, Windy Pro.  
- No glassmorphism genérico: pocas capas blur, solo donde hay contenido sobre imagen  
- No gradientes arcoíris: un solo acento de color (ocean blue)  
- Typografía con carácter: **Inter** (weights 400/500/600/700) con tabular nums en datos  
- Micro-texturas sutiles en fondos de secciones (noise CSS)  
- Bordes con opacidad coherente (no border-surf-800 flat, sino rgba con tinte azul)

### Paleta seleccionada (basada en search ui-ux-pro-max)
```
Background:    #070b12  (--clr-bg)
Surface:       #0c1322  (--clr-surface)
Surface-2:     #111b30  (--clr-surface-2)
Surface-3:     #182442  (--clr-surface-3)
Border:        rgba(14,165,233,0.12)  (--clr-border)
Border-strong: rgba(14,165,233,0.25)  (--clr-border-strong)
Primary:       #0ea5e9  (--clr-primary)    → Ocean Blue
Primary-dim:   rgba(14,165,233,0.12)  
Accent:        #06b6d4  (--clr-accent)     → Cyan Mar
Success:       #10b981  (--clr-success)    → Offshore verde
Warning:       #f59e0b  (--clr-warning)    → Cruzado ámbar
Danger:        #f43f5e  (--clr-danger)     → Onshore rojo
Text-1:        #f1f5f9  (--clr-text-1)     → Blanco suave
Text-2:        #94a3b8  (--clr-text-2)     → Gris marino
Text-3:        #64748b  (--clr-text-3)     → Gris oscuro
```

### Tipografía
- **Inter** (Google Fonts, weights 400,500,600,700)
- Headings: `font-weight: 700`, `letter-spacing: -0.02em`  
- Labels: `font-size: 10px` → subido a mínimo `11px`; UPPERCASE + `tracking: 0.08em`  
- Datos numéricos: `font-variant-numeric: tabular-nums; font-feature-settings: 'tnum'`

### Espaciado  
- `--space-1: 4px` → `--space-6: 24px` → `--space-10: 40px`  
- Padding de tarjetas: 16px mobile, 20px desktop  
- Gap uniforme en grids: 12px mobile, 16px desktop

### Radio  
- Contenedores principales: `24px` (rdu-2xl)  
- Tarjetas: `16px` (rdu-xl)  
- Pills/badges: `6px` (rdu-sm)  
- Botones: `10px` (rdu-md)

### Sombras  
- Tarjetas: `0 4px 24px rgba(7,11,18,0.6)` + tinte oceánico en hover  
- Botón primario: `0 4px 16px rgba(14,165,233,0.25)`  
- Modal: `0 20px 60px rgba(0,0,0,0.8)`

### Movimiento (Jakub Krehel principal, Emil secundario)
- Duración hover: `150ms` (UI frecuente)  
- Duración transición de datos: `300ms`  
- Duración modales/overlays: `200ms`  
- Easing: `cubic-bezier(0.4, 0, 0.2, 1)` (Material standard)  
- Easing de entrada: `cubic-bezier(0, 0, 0.2, 1)` (decelerate)  
- Sin animate-ping/pulse decorativos; solo en indicadores de estado crítico  
- `prefers-reduced-motion: reduce` → todos los transitions a `0ms`, animaciones off

---

## 3. PLAN DE IMPLEMENTACIÓN

1. **css/app.css** — Archivo nuevo con:
   - Tokens CSS en `:root` (dark/light via `@media (prefers-color-scheme)`)
   - Reset de componentes Tailwind override
   - Estilos de componentes: header, spot-card, spotlight, table, badge, button
   - Animaciones con `@keyframes` y `prefers-reduced-motion`
   - Scrollbar, focus ring, material symbols overrides

2. **index.html** — Cambios mínimos:
   - Añadir `<link rel="stylesheet" href="css/app.css">` en head
   - Cambiar fuente a Inter desde Google Fonts
   - Ajustar `theme-color` meta
   - El inline `<style>` se mantiene para Leaflet (solo afecta mapa)

3. **app.js** — Solo si estrictamente necesario:
   - La clase `dark-tiles` del mapa no se toca
   - El spinner `animate-spin` se puede reemplazar por una clase custom en CSS
   - Los `className` asignados dinámicamente usan clases Tailwind existentes → no tocar
<<<<<<< HEAD
### Coherencia de datos

- Todos los datos, cifras, etiquetas, nombres y rangos en esta aplicaciï¿½n son generados dinï¿½micamente o extraï¿½dos de constantes reales del dominio del surf (direcciones de viento, alturas en metros, periodos en segundos).

- No se ha introducido ningï¿½n texto de relleno (Lorem Ipsum) ni nï¿½meros inventados o contradictorios.

- Las unidades son consistentes a travï¿½s de la aplicaciï¿½n: metros (m) para oleaje y segundos (s) para periodo, con nudos (kt) para el viento.

- Validado con redesign-skill y reglas de coherencia del brief de Jordi.

### Tipografï¿½a Justificada (Outfit)

- Se ha reemplazado Inter por Outfit. Segï¿½n taste-skill, las fuentes genï¿½ricas como Inter estï¿½n desaconsejadas por defecto salvo contextos muy estrictos. Outfit aporta un toque mï¿½s tï¿½cnico y deportivo, perfectamente alineado con aplicaciones premium de datos como Strava o Surfline.

### Segunda pasada de autoauditorï¿½a completada

- Mï¿½vil Perfecto: implementado y validado en 360, 390, 430 y 844 (sin scroll horizontal, sin texto cortado, safe-area activo, inputs a 16px para iOS, tï¿½ctiles >= 44px).

- design-motion-principles: revisados animaciones. Cambiado animate-spin genï¿½rico por microinteracciï¿½n reducida en prefers-reduced-motion.




### AuditorÃ­a Final en main
- Coherencia de datos: Conservada, no se ha modificado JS de lÃ³gica ni valores.
- TipografÃ­a: Outfit.
- Accesibilidad: prefers-reduced-motion aÃ±adido en app.css.
- Capturas en claro/oscuro de 4 tamaÃ±os validadas.
||||||| parent of 4d8a968 (diseno: sistema de tokens CSS, Inter, accesibilidad y animaciones premium)
=======
>>>>>>> 4d8a968 (diseno: sistema de tokens CSS, Inter, accesibilidad y animaciones premium)

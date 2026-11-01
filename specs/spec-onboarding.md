# SPEC: Onboarding para principiantes en MeteoSurf_Cs

## OBJETIVO
Añadir un tooltip/banner de onboarding que aparece solo la primera vez que un usuario abre la app, explicando los 3 términos técnicos principales: Hs (altura significativa de ola), Periodo (segundos entre olas) y Calidad (estrellas de 0 a 5).

## CONTEXTO MÍNIMO
- App web PWA, solo frontend (HTML/CSS/JS, sin backend propio)
- CSS en: `css/app.css`
- HTML principal: `index.html`
- JS principal: `js/app.js`
- El estado persiste en `localStorage`
- Rama activa: `feature/mejoras-ux-auditoria`

## ARCHIVOS AUTORIZADOS
- `css/app.css` — añadir estilos del onboarding
- `index.html` — añadir el HTML del panel de onboarding
- `js/app.js` — añadir lógica para mostrarlo/ocultarlo

## PROHIBIDO
- Tocar `js/spots.js`, `js/physics.js`, `backend/`, `data/`
- Instalar dependencias
- Crear archivos `.bak-*`

## PASOS
1. Añadir al final de `css/app.css` los estilos de `.onboard-overlay` y `.onboard-card` (modal centrado, fondo semitransparente, máx 380px, botón "Entendido")
2. Añadir en `index.html` antes del primer `<script>` el HTML del panel: 3 items (ola icon + "Hs = altura de ola", clock icon + "Periodo = segundos entre olas", star icon + "Estrellas = calidad 0-5") y botón "Entendido"
3. Añadir en `js/app.js` al inicio (después de imports) la función `showOnboarding()`: si `!localStorage.getItem('ob_done')`, mostrar el panel; al pulsar "Entendido", `localStorage.setItem('ob_done','1')` y ocultar
4. Llamar a `showOnboarding()` desde la función que ya existe `renderHome()` (solo cuando se renderiza home la primera vez)

## CRITERIO DE ACEPTACIÓN
- En navegador con localStorage limpio, al abrir index.html aparece el panel de onboarding
- Al pulsar "Entendido" desaparece y no vuelve a aparecer en recargas posteriores
- En pantalla de 390px no hay overflow horizontal

## ENTREGA
Commit en rama `feature/mejoras-ux-auditoria` con mensaje: `ux: onboarding para principiantes con explicación de términos`

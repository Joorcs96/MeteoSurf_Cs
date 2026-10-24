# SPEC: Vista de calendario semanal de previsión

## OBJETIVO
Añadir una vista de 7 días con semáforo de colores para planificar sesiones con antelación. Accesible desde la portada (botón "Ver semana") o como tab en la navegación.

## CONTEXTO MÍNIMO
- La previsión de 16 días ya existe y se renderiza en `renderHome()` / ficha de spot
- Los datos de forecast están en `state.fc.spots[id].hours[]` con campos: `rating` (0-5), `surf` (m), `wind` (km/h), `hour` (ISO string)
- La función `ratingCls(r)` devuelve clases CSS de color según rating
- `ratingLabel(r)` devuelve el texto ("Muy bueno", "Bueno", etc.)
- CSS de días existente: `.days`, `.day`, `.dn`, `.dd`, `.dh`

## ARCHIVOS AUTORIZADOS
- `js/app.js` — añadir función `renderCalendario()` y registrar ruta `#/calendario`
- `css/app.css` — añadir estilos `.cal-grid`, `.cal-day`, `.cal-hour`
- `index.html` — añadir enlace en `.topnav` (desktop) si cabe

## PROHIBIDO
- Cambiar la lógica de física o previsión
- Tocar `js/spots.js`, `js/physics.js`, `backend/`, `data/`
- Añadir dependencias externas

## PASOS
1. Crear función `renderCalendario()` en `app.js`:
   - Leer `state.fc` para todos los SPOTS
   - Para cada uno de los 7 próximos días, calcular el mejor momento del día (max rating en franjas 6-20h)
   - Renderizar una cuadrícula: filas = días, columnas = spots favoritos (o top 5 por zona)
   - Cada celda: color semáforo (clases CSS del rating), altura en m y hora óptima
2. Registrar la ruta: añadir `if (page === 'calendario') return renderCalendario();` en el router
3. Añadir enlace `<a href="#/calendario" data-nav="calendario">Semana</a>` en `.topnav` de index.html
4. Añadir en la tabbar móvil un enlace si hay espacio, o dejarlo solo en desktop

## CRITERIO DE ACEPTACIÓN
- Al entrar en `#/calendario` se muestra la cuadrícula 7 días × spots
- Los colores coinciden con los de la previsión principal
- En móvil hace scroll horizontal limpio
- Sin errores en consola

## ENTREGA
Commit en rama `feature/mejoras-ux-auditoria` con mensaje: `feat: vista de calendario semanal de previsión por spots`

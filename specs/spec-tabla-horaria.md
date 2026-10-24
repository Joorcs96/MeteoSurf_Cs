# SPEC: Tabla horaria visible por defecto en ficha de spot

## OBJETIVO
La auditoría detectó `hasHourlyTable: false` — la tabla de horas existe en el código pero no está visible al entrar en la ficha de un spot. Hacer que la tab "Horas" sea accesible y que la tabla horaria se muestre con los datos del día seleccionado.

## CONTEXTO MÍNIMO
- El spot tiene tabs: Ahora | Horas | 16 días | Fotos | Spot
- El código de renderizado de la tabla está en `js/app.js` función `drawDay(spot, f)`
- La tab "Horas" activa el panel `data-panel="horas"` y llama `drawDay`
- La función `irTab('horas')` existe y llama `drawDay` si `f` (forecast) está disponible
- La auditoría de interacción detectó que la tabla no estaba presente al navegar a la ficha
- CSS de la tabla: `.ftable`, `.ftable-wrap`, `.ftable .lbl`, `.ftable .big`

## ARCHIVOS AUTORIZADOS
- `js/app.js` — verificar que `drawDay` se llama correctamente al activar la tab Horas
- `css/app.css` — si hay estilos que ocultan la tabla

## PROHIBIDO
- Cambiar la lógica de física o previsión
- Tocar `js/spots.js`, `js/physics.js`, `backend/`, `data/`

## PASOS
1. Buscar en `app.js` dónde se llama `drawDay` y verificar que se ejecuta cuando `data-panel="horas"` está activo
2. Verificar que `.ftable-wrap` no tiene `display:none` o `visibility:hidden` en el CSS en ningún estado
3. Si la tabla no se dibujaba por un race condition (forecast aún no cargado), añadir un listener que llame `drawDay` cuando el forecast llega y la tab activa es "horas"
4. Añadir una fila de cabecera con "Hora | Ola | Calidad | Viento | Dir" si no existe

## CRITERIO DE ACEPTACIÓN
- Al navegar a cualquier spot y pulsar la tab "Horas", la tabla aparece con datos
- En móvil 390px la tabla hace scroll horizontal sin romper el layout
- No hay errores en consola al mostrar la tabla

## ENTREGA
Commit en rama `feature/mejoras-ux-auditoria` con mensaje: `ux: tabla horaria visible al activar tab Horas en ficha de spot`

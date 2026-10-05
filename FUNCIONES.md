# Inventario de Funciones de MeteoSurf_Cs (Antes del Rediseño v2)

Este documento contiene el inventario completo de funciones extraídas del código actual de la rama main y verificadas. Según la regla estricta: ninguna de estas funciones puede perderse tras el rediseño radical. Al finalizar, este archivo servirá como lista de verificación.

## 1. Navegación Global y Ajustes
- [x] **Routing por hash:** Navegación SPA entre Portada (#/), Spot (#/spot/:id), y vistas como #cams.
- [x] **Modo Claro/Oscuro:** Botón (#theme) en la cabecera (o menú) que altera el atributo data-theme en :root y persiste en localStorage (msc_theme).
- [x] **Refrescar Previsión:** Botón (#refresh) que fuerza la recarga de datos (
efresh(true)) y muestra un *toast* "Actualizando previsión…".
- [x] **Offline y Actualizaciones (PWA):** Cachea la shell (sw.js). Si hay nueva versión, recarga automáticamente (listener updatefound).
- [x] **Restauración de Visibilidad:** Actualiza datos en tiempo real (observaciones) al volver a la app (isibilitychange).

## 2. Portada (Home)
- [x] **Lista de Spots Favoritos (Quick Spots):** Tarjetas cortas en portada generadas si hay favoritos guardados.
- [x] **Observaciones en Tiempo Real (Realtime):** Tarjetas de spots/boyas cargadas desde data/realtime.json y data/buoys.json.
- [x] **Grisado por antigüedad (Realtime):** Si un dato tiene más de 3 horas de antigüedad, se le aplica la clase .is-stale (texto gris).
- [x] **Filtrado por Zona (Realtime):** Botones [data-zone] que muestran/ocultan partes de la lista de spots en portada según la zona.
- [x] **Instalar PWA:** Botón flotante (#install-pwa) que lanza el prompt de instalación si el navegador lo soporta.
- [x] **Pestaña Inferior (Tab bar):** Navegación rápida entre "Previsión" (#/), "Cámaras" (#cams), "Asistente" y "Reportar" (otar.html).

## 3. Ficha de Spot (#/spot/:id)
- [x] **Cabecera de Spot:** Nombre del spot, nombre de la zona, botón "Volver" (o botón de retroceso).
- [x] **Botón Favorito:** Botón de la cabecera ([data-fav]) que añade/quita el spot de localStorage.
- [x] **Gesto Swipe para volver:** Deslizar desde el borde izquierdo (listeners 	ouchstart, 	ouchend en spotLayout) vuelve atrás (history.back()).
- [x] **Panel Ahora (Now Panel):** Datos actuales (oleaje, viento, periodo, calidad).
- [x] **Selector de Días:** Botones rápidos por día ([data-day]) para cambiar la tabla activa o scrollear ([data-jump]).
- [x] **Tabla de Previsión (Hourly Table):** Columnas por horas con tamaño de ola (barras o números), periodo, energía, viento (flechas), calidad (color), mareas.
- [x] **Compass (Brújula interactiva):** SVG que soporta pointerdown, pointermove, pointerup para visualizar direcciones (viento/oleaje) dinámicamente (js/compass.js).
- [x] **Sección de Webcams In-line:** Si el spot tiene webcams, botón [data-cam] para abrir/reproducir la cámara en la ficha.
- [x] **Sección de Rewinds:** Lista de vídeos cortos generados previamente (
enderRewinds()).

## 4. Directorio de Cámaras (#cams)
- [x] **Listado de Webcams:** Todas las webcams organizadas, sacadas de webcams.json.
- [x] **Filtros de Zona en Cámaras:** Botones [data-camzone] para filtrar el listado de cámaras por área.
- [x] **Enlace a Spot desde Cámara:** Clic en [data-camspot] redirige a la previsión del spot asociado a esa cámara.

## 5. Asistente (Chat)
- [x] **Formulario #ask:** Envío del formulario captura el input #q y llama a sk(q) para hablar con el asistente (js/assistant.js).
- [x] **Sugerencias #sugg:** Botones rápidos que insertan un prompt predefinido (ej. "Mejor baño hoy").

## 6. Reportar Sesión (otar.html)
- [x] **Formulario:** Select de spot, datetime (por defecto la actual local), tamaño, calidad (estrellas/radios), comentario.
- [x] **Persistencia Local:** Guarda reportes en localStorage (msc_sessions).
- [x] **Generar URL de GitHub:** Botón "Enviar al registro" crea una URL issues/new pre-rellenada con los datos de la sesión.
- [x] **Borrar Sesión / Borrar Todo:** Botones [data-del] y #clear-all para limpiar el historial local.

## 7. Formato de Datos
- [x] **Prevención de Inventos:** Uso de m(x) => x == null ? '–' : x para evitar variables "undefined", "NaN" o "0" cuando no hay dato.
- [x] **Unidades y Comas:** Altura en metros con 1 decimal y coma (1,2m), periodo en segundos (9s), viento en km/h (15 km/h).


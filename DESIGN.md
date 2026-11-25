# Diseño · Planificación profesional

Estado: implementado en `feature/planificacion-profesional` (2026-11-25).

## Principio

La aplicación es una mesa de planificación costera, no una portada comercial. El
objetivo es comparar el mismo intervalo entre varios lugares y contrastar el
seleccionado con la cámara y las observaciones disponibles. La jerarquía visual
prioriza la decisión: fecha, franja, deporte y nivel; después lugares, gráfica y
detalle.

## Navegación

- Cuatro destinos principales: Jornada, Previsión, Mapa y Cámaras.
- Jornada es el inicio y sustituye a la portada de tarjetas.
- Mis spots y Asistente quedan como utilidades, también en móvil.
- Avisos, Actualizar, Tema e Histórico viven en el rail de escritorio y en la
  barra superior móvil.
- `#/ahora` sigue disponible como vista legacy con un aviso de vuelta a Jornada.
- `#/favoritos` conserva el modo favoritos de Previsión.

## Composición

- Escritorio ancho (>=1280 px): rail de 212 px, zona central flexible y
  inspector de 320 px. La comparación y la gráfica se apilan en la zona central.
- Escritorio (1000-1279 px): rail + contenido; el inspector pasa a ser una
  sección secuencial.
- Tablet y móvil (<=999 px): barra superior de 56 px y barra inferior de cuatro
  destinos de 58 px. El contenido se apila.
- Móvil estrecho (<=420 px): filtros en dos columnas con más ancho para la fecha;
  filas de lugar con nombre encima y valores debajo.
- Sin scroll horizontal de página. La tabla horaria es la única región que puede
  desplazarse en horizontal, con `tabindex="0"` y etiqueta accesible.

## Tokens

| Token | Claro | Oscuro |
| --- | --- | --- |
| `--bg` / `--surface` | `#ffffff` | `#17191d` |
| `--surface-2` | `#f5f6f8` | `#22252a` |
| `--surface-3` | `#eceef2` | `#2a2e34` |
| `--text` | `#1d1d1f` | `#f2f4f7` |
| `--text-2` | `#62676e` | `#aab1ba` |
| `--text-3` | `#8a9099` | `#7f8791` |
| `--line` | `#e3e5e9` | `#2e3238` |
| `--sel` | `#0066cc` | `#72adff` |
| `--sel-soft` | `#e9f2fc` | `#1b2a3d` |
| `--wind` | `#217c86` | `#5fb6c0` |
| `--good` | `#2e7d5b` | `#6cc59c` |
| `--warn` | `#a15c00` | `#e0a458` |
| `--bad` | `#b42318` | `#f08a82` |

El claro es el tema principal. El oscuro está diseñado para consulta al amanecer,
no es una inversión automática. El color nunca es la única clave: los estados
llevan texto o forma además del color.

## Tipografía y controles

- Sans del sistema (`-apple-system`, `Segoe UI`, `Roboto`, etc.) y números
  tabulares en tablas y gráficas.
- Escala contenida: título de vista 28-34 px, títulos de panel 17-20 px, cuerpo
  13-15 px, metadatos 10-12 px.
- Controles con altura mínima de 38 px en escritorio y 44 px en acciones táctiles.
- Foco visible azul de 2 px. Sin animaciones decorativas; se respeta
  `prefers-reduced-motion`.

## Componentes

- **Filtros de jornada**: fecha, franja, deporte y nivel. La franja es persistente
  al cambiar de lugar.
- **Comparación**: hasta 8 lugares; columnas de ola en playa, periodo, viento,
  rachas y calidad. La fila seleccionada se marca con radio, fondo y borde.
- **Gráfica**: SVG con banda de ola en playa, línea de ola media, Hs mar adentro
  discontinua, rejilla, unidades, leyenda, franja resaltada y huecos donde falta
  dato. En móvil usa un viewBox compacto de 360x220.
- **Inspector**: lugar, zona, fondo, marea, cámara, resumen de la franja,
  observación actual y enlace a la ficha completa.
- **Cámara**: reproducción automática silenciada en escritorio; en móvil se
  muestra un póster con reproducción explícita. Se detiene al cambiar de lugar o
  de ruta.
- **Compartir**: parte en texto con fecha, zona horaria, franja, valores,
  fuentes, antigüedad, observación, contexto de nivel y enlace. Usa
  `navigator.share`, después portapapeles y, si falla, un diálogo con textarea.
- **Avisos**: panel modal con overlay, foco en cerrar, cierre con Escape o clic
  fuera y retorno del foco al botón de origen.

## Honestidad de datos

- Previsión es modelo, no medición.
- La ola en playa es una estimación de rompiente; Hs mar adentro se muestra
  aparte y no se mezcla con la boya.
- Las horas fuera de la franja no se extrapolan ni se usan para resumir.
- Los datos ausentes se muestran como «Sin dato», no como cero.
- La observación actual se rotula con antigüedad, fuente y distancia; si es
  antigua, se avisa de que no representa la franja planificada.
- El nivel del grupo es contexto, no un veredicto de seguridad.

## Archivos

- `index.html`: estructura de navegación y contenedores.
- `css/sistema.css`: tokens, layout y componentes del rediseño.
- `js/jornada.js`: lógica pura y vista de Jornada.
- `js/app.js`: routing, estado, tema y orquestación.
- `js/notificaciones.js`: panel de avisos.
- `tests/jornada.test.mjs`: pruebas de la lógica de Jornada.
- `docs/evidencia/`: capturas reales de las pruebas de navegador.

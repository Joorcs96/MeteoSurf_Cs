# Renders de planificación · primera exploración

Estado: propuestas para revisión, no implementación ni aprobación. Datos e imágenes de mar sintéticos, no utilizables para decidir una actividad. El alcance de planificación deportiva sí está confirmado.

## Plan visual
- Base: blanco `#FFFFFF`, superficie auxiliar `#F5F6F8`, texto `#1D1D1F`, secundario `#62676E`, selección azul `#0066CC`, dato de viento verde azulado `#217C86`. No usar color como única clave.
- Una familia sans de sistema; cifras tabulares, títulos discretos y etiquetas completas. Tamaños y contraste se validarán en código, no a partir del render.
- Tema oscuro: fondo grafito `#17191D`, superficies `#22252A`, texto `#F2F4F7`, selección `#72ADFF`. Sin brillos neón ni cristal sobre gráficos.
- Todo alineado a la izquierda excepto magnitudes tabulares. Controles convencionales, selección visible y bordes de agrupación solo donde aclaran relaciones.
- Elemento propio: una franja horaria común une la comparación de spots con el detalle de previsión, cámara y observaciones. La precisión de esta relación aporta identidad; no una decoración marina.

## Composición de la propuesta
Escritorio: navegación estrecha, comparación central de varios spots en el mismo horario y detalle lateral del lugar seleccionado con cámara, observación y fuente. La acción Compartir previsión pertenece al plan, no a una gran portada.

Móvil: misma tarea dividida en lectura secuencial, lugares comparables en filas y detalle accesible, con cuatro destinos inferiores. No es una tabla de escritorio encogida.

Oscuro: conserva la misma estructura de escritorio, jerarquía y datos, para evaluar legibilidad y separación de superficies.

## Revisión del plan antes de generar
Se descarta una cuadrícula de métricas independientes: rompe la relación entre lugar y hora. Se descarta una foto de ola como protagonista: ocupa espacio sin ayudar a comparar. Se mantiene la cámara como evidencia visual auxiliar, rotulada como simulación en los renders. El nivel figura como criterio, no como veredicto de aptitud. Los controles de compartir y niveles son propuestas de recorrido, no capacidades verificadas del código actual.

## Límites del procedimiento
Se usan las guías de Impeccable de forma manual: no se ejecutan su lanzador, selección aleatoria ni sus fases automáticas porque requieren un ejecutable adicional. No se presenta este trabajo como una ejecución completa de ese flujo. Se generan imágenes de exploración mediante la herramienta integrada; no se escribe interfaz ni se modifica el sistema visual de producción.

## Entregables
- [Escritorio claro](renders/escritorio-claro-v1.png).
- [Escritorio oscuro](renders/escritorio-oscuro-v1.png).
- [Móvil claro](renders/movil-claro-v1.png).
- [Prompts completos y procedencia](renders/prompts.json): herramienta integrada, con correcciones registradas; ninguna imagen aprobada aún.

Se inspeccionaron visualmente las salidas. Se corrigió la confusión entre ola en playa y Hs prevista en escritorio, y se reorganizaron las filas móviles en dos líneas. No son tres alternativas de arquitectura: son tres vistas de la misma propuesta inicial.

Pendiente antes de implementación: comprobar si Jornada es el inicio adecuado; definir qué modifica el criterio de nivel; resolver el flujo y formato de compartir; identificar estación y distancia de la observación; mantener fuente y antigüedad accesibles en móvil; unificar marca e iconos exactos con los recursos originales. La selección única del detalle debe distinguirse de la selección múltiple de spots a compartir. No dar por resueltas esas interacciones por aparecer un botón en una imagen.

Las imágenes se mostraron en la conversación. Deben revisarse por organización y dirección visual; texto pequeño, curvas y valores necesitan reconstrucción y verificación en un prototipo funcional. La proporción de la imagen móvil no prueba comportamiento a 390 px: eso sigue pendiente. No hay pruebas de accesibilidad, reproducción de cámaras ni comportamiento real superadas en esta fase.

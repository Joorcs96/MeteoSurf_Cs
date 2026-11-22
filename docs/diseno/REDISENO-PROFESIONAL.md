# Rediseño profesional · propuesta de organización

22 de noviembre de 2026. Estado: estudio y propuesta, no implementado ni aprobado. Revisión estática de código, no auditoría visual completa.

## OBJETIVO
Reorganizar MeteoSurf para escuelas, entrenadores y clubes, manteniendo profundidad técnica y facilidad móvil. Conseguir coherencia de producto antes de producir más variantes visuales.

## CONTEXTO
Jordi confirma este público principal y el alcance: planificación deportiva (condiciones, spots, horarios, niveles y compartir la previsión), sin gestionar alumnos ni cobros. Solicita calidad de interacción y acabado inspirada en Apple, claro como tema principal y oscuro cuidado. La gestión interna de grupos, alumnos y calendario de sesiones queda fuera de esta primera versión.

### Problemas concretos observados
Las referencias corresponden a la revisión actual y pueden desplazarse al editar.

| Evidencia | Consecuencia | Propuesta |
| --- | --- | --- |
| `index.html:31` y `index.html:58`: seis destinos principales; `index.html:68`: acceso adicional al asistente | Herramientas auxiliares compiten con las tareas centrales | Separar navegación principal, colecciones y ayuda contextual |
| `css/app.css:46`: etiquetas de navegación inferior de 9,5 px | Lectura difícil en una zona de uso frecuente | Reducir destinos y validar tamaño legible en móvil real |
| `js/app.js:1436`: al salir de Ahora se detienen cámara y vigía | No se puede contrastar cámara y previsión horaria dentro de ese flujo | En escritorio, proponer cámara acoplada junto a previsión; en móvil, control explícito de reproducción y consumo |
| `js/app.js:1330`: cambiar de spot reinicia día, cámara y pestaña | Comparar varios lugares para la misma franja requiere repetir pasos | Conservar el contexto temporal al comparar; explicar los datos que no estén disponibles |
| `js/forecast.js:52` y `js/forecast.js:122`: cobertura ampliada mediante otro modelo | La lectura profesional necesita conocer el origen de cada tramo | Mostrar modelo, actualización, horizonte disponible y transición de fuente |

Ya existen foco visible, objetivos táctiles de 44 px en algunos controles y cifras tabulares en `css/app.css:23`, `:40` y `:28`. No se debe presentar su ausencia como un fallo actual. Los documentos históricos de diseño contienen decisiones contradictorias; no sustituyen la comprobación del código actual.

## Organización propuesta, pendiente de aprobación

| Área | Función principal | Funciones que conserva o integra |
| --- | --- | --- |
| Jornada | Preparar y revisar la actividad del día | Resumen de condiciones y accesos a lugares guardados; nueva composición de funciones existentes |
| Previsión | Comparar sitios y franjas con detalle | Ahora, horas, varios días, modelos, observaciones y sus fuentes |
| Mapa | Explorar alternativas geográficas | Spots, capas y herramientas actuales |
| Cámaras | Contrastar el estado visual del mar | Directo, Rewind y herramientas existentes de cámara |

Favoritos serían una colección accesible desde el contexto; no se eliminan. El asistente pasa a ayuda contextual accesible, no desaparece. Fotos e información del spot se agrupan en su ficha. Exportaciones e históricos deben conservar un acceso identificable.

No se añade un área de Escuela/Club para gestión administrativa. El nivel deportivo será un criterio del plan, sin guardar fichas de alumnos ni asignar automáticamente una etiqueta de seguridad. Compartir debe conservar lugar, fecha, franja y antigüedad de los datos; el formato definitivo se resolverá en el prototipo.

### Escritorio
Navegación lateral o superior estable, lugar y franja temporal compartidos entre vistas, previsión central y panel auxiliar de cámara u observaciones. Comparar spots sin perder el día seleccionado. La información técnica ocupa el espacio; no una cabecera publicitaria. La disposición definitiva requiere un prototipo para comprobar anchuras y densidad.

### Móvil
Cuatro destinos como hipótesis inicial, resumen inmediato y detalle progresivo. Acceso completo a datos técnicos sin comprimir una tabla de escritorio. Los controles de hora, lugar y fuente deben conservar su estado. No mantener vídeo reproduciéndose oculto como efecto secundario del rediseño.

### Acabado visual
Una familia tipográfica legible, jerarquía por tamaño y peso, cifras alineadas, controles coherentes y superficies neutras. Color para selección, variables y estados, no como decoración. Evitar vidrio que perjudique lectura, pastillas para todo, sombras excesivas y grandes titulares vacíos. Oscuro con contraste propio, no simple inversión. La referencia Apple se traduce en comportamiento y detalle, no en copiar su identidad.

## ARCHIVOS
Esta fase añade `PRODUCT.md`, este documento y el registro de skills. Actualiza el tablero. No modifica `index.html`, `css/`, `js/`, servicios ni el proyecto móvil.

## PROHIBIDO
- Cambiar modelos, cálculos, calibración o significado de variables como parte de una reforma visual.
- Presentar estimaciones como observaciones, inventar porcentajes de confianza o sustituir datos ausentes por cero.
- Garantizar seguridad de una actividad a partir de un indicador automático.
- Eliminar funciones existentes sin inventario y aprobación.
- Implementar gestión de alumnos, pagos o reservas sin delimitar alcance.
- Desplegar o sustituir la interfaz actual antes de aprobar y verificar la propuesta.

## PASOS
1. Alcance confirmado: planificación deportiva sin gestión interna. Priorizar comparación de spots para la misma franja y preparación de una previsión compartible.
2. Validar el mapa de funciones con el producto actual y cerrar el recorrido principal de un entrenador.
3. Preparar propuestas visuales del mismo recorrido: escritorio claro, móvil claro y oscuro. Datos de ejemplo identificados; no portadas desconectadas de la aplicación.
4. Revisar con Jordi jerarquía, densidad, controles y organización antes de programar la interfaz.
5. Tras aprobación, dividir implementación acotada mediante Orca; Antigravity para investigación y los trabajadores disponibles para código, siguiendo las reglas del proyecto. Verificar resultados antes de integrar.

## ACEPTACION
Criterios previstos, todavía NO ejecutados:
- Un entrenador puede comparar lugares para una misma franja sin perder contexto.
- En escritorio puede contrastar cámara y previsión sin el corte causado por cambiar de pestaña, con reproducción explícita.
- Todas las capacidades actuales conservan un destino claro.
- Fuente, antigüedad, unidad y ausencia de datos son comprensibles; medición y modelo no se confunden.
- Pruebas a 375, 390, 768, 1280 y 1440 px, sin desbordamiento accidental ni controles tapados.
- Navegación por teclado, foco visible, etiquetas accesibles, zoom al 200 % y reducción de movimiento.
- Contraste WCAG AA; objetivo ergonómico de 44 px para controles táctiles principales, sin confundirlo con el mínimo normativo universal.
- Tema oscuro comprobado por pantalla, incluyendo gráficos, estados y superficies.
- Ninguna regresión en cámaras, mapa, previsión, favoritos o consulta de datos.

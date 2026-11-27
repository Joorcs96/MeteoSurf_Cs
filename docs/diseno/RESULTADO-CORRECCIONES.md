# Resultado de correcciones · planificación profesional

Fecha: 27 de noviembre de 2026. Rama `feature/planificacion-profesional`.

## Resuelto

- P1 cámara: en móvil la reproducción exige pulsación; al cambiar de lugar o vista se limpia el reproductor. Botón legible en claro y oscuro.
- P1 contraste y disposición: texto secundario y acciones primarias con tokens propios por tema; comparación sin desbordamiento en 320, 375, 390, 1280 y 1440 px; gráfico visible en la primera pantalla de 1440×900.
- P1 modales: ayuda y oferta heredadas dejan de abrirse solas. La guía sigue disponible por acción voluntaria.
- P2 densidad: filas compactas de ola y viento en móvil; periodo y rachas desplegables; tabla horaria desplazable con foco.
- P2 datos: cobertura parcial y ausencia explicadas sin extrapolar ni convertir ausencia en cero. El parte compartido incluye fecha, franja, fuente y antigüedad. Se aclaran mínimo y máximo de ola y periodo, viento medio, dirección central, racha máxima y mejor valoración de surf.
- P2 navegación: Previsión conduce a su vista y Mis spots informa cuando no hay guardados.

## Evidencia

- `node --test tests/jornada.test.mjs`: 15 de 15 pruebas superadas.
- Navegador local: 390 px en claro y oscuro, ancho de página igual al viewport, sin vídeo/iframe antes de pulsar la cámara; colores computados del texto del botón correctos en ambos temas. Revisión anterior del mismo lote en 320, 375, 768, 1280 y 1440 px, rutas, compartir y mapa AEMET.
- Capturas finales: `docs/evidencia/correcciones/jornada-390-claro-final.png` y `jornada-1440-claro-final.png`. Informe y capturas de la revisión independiente: `docs/diseno/REVISION-FINAL.md` y `docs/evidencia/revision/`.

## Límite

El cambio de anchura del navegador no acredita zoom real al 200 %. La valoración existente es de calidad de surf y no una recomendación automática de seguridad para el nivel del grupo. La observación de boya mide Hs mar adentro y se distingue de la ola estimada en playa.

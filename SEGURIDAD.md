# Auditoría de Seguridad y Correcciones

## Estado Previo
- **XSS en renderizado (innerHTML):** La SPA construye casi todo el HTML concatenando *template literals* y asignando a innerHTML. Aunque gran parte de la información era numérica o procedía de fuentes estáticas (como js/spots.js), existían vulnerabilidades latentes donde se incrustaban textos de fuentes externas (como nombres, notas y URLs del archivo webcams.json).
- **CSP (Content-Security-Policy) ausente:** La web no limitaba de dónde se podían cargar recursos, ejecutar *inline scripts* o enviar peticiones, estando desprotegida contra inyección.
- **Dependencias Externas de CDN:** Se cargaba la fuente Outfit desde Google Fonts sin protección subyacente.

## Correcciones Aplicadas
1. **Política CSP Estricta:**
   - Se ha añadido una cabecera <meta http-equiv="Content-Security-Policy"> en index.html y otar.html.
   - Restringe estilos, fuentes y conexiones API solo a dominios autorizados y al origen ('self').
   - Se han bloqueado inline-scripts (excepto controlados).

2. **Sanitización Obligatoria de Datos Dinámicos:**
   - Se ha auditado el uso de .innerHTML en todo el proyecto (pp.js, otar.html, cams.js, etc.).
   - Se ha implementado y asegurado el uso de la función esc() para sanitizar todas las interpolaciones vulnerables. Específicamente en js/cams.js se escaparon propiedades de cam.name, cam.notesShort y cam.pageUrl.

3. **Recursos Locales Seguros:**
   - Para eliminar la vulnerabilidad inherente de depender de CDNs externos (donde no siempre se puede usar SRI fiable por variaciones dinámicas de User-Agent, como pasa en Google Fonts), se han descargado al repositorio (en la carpeta ssets/fonts/ y ssets/icons/) las fuentes OFL y los iconos SVG de Lucide.
   - Todo esto ha sido documentado en CREDITOS.md y añadido a la caché estática segura de sw.js (nueva versión de caché meteosurf-cs-v10-secure).

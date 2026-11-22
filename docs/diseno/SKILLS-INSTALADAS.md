# Skills de diseño instaladas

22 de noviembre de 2026. Instaladas en `C:/Users/Jordi/.codex/skills/` mediante el instalador de skills de Codex, con versiones fijadas. Son archivos de instrucciones y recursos; no se han instalado programas ni paquetes npm.

| Skill | Fuente y revisión | Uso previsto |
| --- | --- | --- |
| frontend-design | [Anthropic](https://github.com/anthropics/skills/tree/main/skills/frontend-design), `e4bb5d960d87126ff3b3a8af1a104b7db67560ba` | Dirección visual específica y acabado; evitar soluciones de plantilla |
| impeccable | [pbakaus](https://github.com/pbakaus/impeccable), `b49177d32788f2dc585c42831d845dacf1ebed2c` | Definición de producto, jerarquía, densidad e interacción de aplicaciones |
| ui-ux-pro-max | [nextlevelbuilder](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill), `f76d1653d7467fc11fb9d9d79295a421c92ab958` | Consulta de patrones de usabilidad, accesibilidad y gráficos |

Se mantiene la skill existente `web-design-guidelines` de Vercel sin duplicarla ni sobrescribirla. La instalación no garantiza calidad por sí sola: prevalecen las necesidades del producto y la verificación del resultado.

## Revisión y límites
- Se leyeron las instrucciones y se revisaron los recursos relevantes. Esto no equivale a una certificación completa de seguridad de los repositorios.
- El lanzador de Impeccable descargaría un ejecutable: no se ejecutó, respetando la prohibición de instalar programas. Se utilizó lectura directa del contexto y de las guías.
- Se probaron consultas locales de UI UX Pro Max. Dos propuestas generales mezclaban patrones comerciales inadecuados y no se adoptaron como sistema de diseño. Las recomendaciones específicas de gráficos y legibilidad se evaluaron por separado.
- No se añadieron skills de React/Next a una web cuyo núcleo actual es HTML, CSS y JavaScript sin esos frameworks.
- Licencias de referencia: frontend-design incluye su licencia específica; repositorio Impeccable Apache-2.0; repositorio UI UX Pro Max MIT. Revisar los archivos de licencia de cada revisión al reutilizar recursos.
- Las nuevas skills estarán disponibles para carga automática en el siguiente turno; no hace falta reiniciar el ordenador.

## Aplicación a esta fase
Las guías han motivado separar definición de producto de apariencia, registrar el público confirmado en `PRODUCT.md`, revisar funciones reales antes de dibujar y rechazar una portada comercial genérica. No se ha cambiado la interfaz ni se han validado renders nuevos todavía.

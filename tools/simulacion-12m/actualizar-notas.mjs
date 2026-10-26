import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const notasPath = path.resolve(__dirname, '../../NOTAS-IA.md');

let c = fs.readFileSync(notasPath, 'utf-8');
const note = `## Simulación Longitudinal 12M e Inversión (26/10/2026)
- [VERIFICADO] Simulación sintética determinista generada en tools/simulacion-12m/ (semilla meteosurf-12m-v1, 5.000 usuarios, 5 cohortes, estacionalidad mediterránea, ventanas 6M y 12M, 3 escenarios).
- [VERIFICADO] Informe en docs/INFORME-SIMULACION-12M.md y navegable en tools/informe-simulacion-12m.html.
- [VERIFICADO] Mejoras aplicadas en rama Joorcs96/simulacion-12m: MEJ-01 (44px nav), MEJ-02 (app.json SDK 58), MEJ-03 (microcopia honesta Fase 1 en app móvil), MEJ-04 (transparencia pro modal), MEJ-05 (botón reintentar conexión).
- [VERIFICADO] Pruebas pasadas: verificar-resultados.mjs (invariantes e idempotencia OK), test_motor_fisica (34/34 OK), tsc --noEmit en app móvil (0 errores), Playwright PWA línea base (0 errores, 0 menores 44px).
- [BLOQUEO ANOTADO] PROGRESO.md no se tocó por conservar marcadores de conflicto ajenos preexistentes (seguridad-csp).

`;

c = c.replace('## Pendiente de Jordi', note + '## Pendiente de Jordi');
fs.writeFileSync(notasPath, c, 'utf-8');
console.log('NOTAS-IA.md actualizado con éxito.');

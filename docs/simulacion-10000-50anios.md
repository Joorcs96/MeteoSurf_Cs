# Simulación 10.000 usuarios · 50 años

Fecha: 2026-11-16  
Script: `surfline-mobile/scripts/simulacion_10000_50anios.ts`  
Configuración de compilación: `surfline-mobile/tsconfig.sim.json`  
Semilla base: `20261116` (determinista, reproducible)

## Qué se ha simulado

1. **Matriz climática física**: 14 spots × 12 meses × 160 escenarios marinos = **26.880 casos**. Cada caso combina tres trenes de ola (fondo, secundario y mar de viento), viento con rachas y la física real de la app (`calculateSurfFromTrains`, `calculateWindState`, `calculateWavePower`, `rateWave`).
2. **Flota de 10.000 usuarios durante 50 años**: niveles principiante/intermedio/avanzado/experto, spot de casa, reloj o no, año de alta, retención anual y abandono por frustración. Acumula sesiones, olas surfeables, clips de Vigía, avisos y publicaciones de comunidad.
3. **6.000 sesiones profundas** con el motor real de tracking: quieto, remando, ola, caída, sesión mixta, pico aislado de velocidad y sesión de 2 horas. Se alimentan GPS, acelerómetro, rumbo y biometría.
4. **Contratos de datos**: coordenadas y ventanas de swell de los spots, cobertura de cámaras, previsión offline de 72 h, previsión online sintética de 168 h, tolerancia a `null` de Open-Meteo, coherencia de resúmenes y estabilidad con mar constante.

## Resultado final (iteración 5)

| Métrica | Valor |
| --- | --- |
| Casos climáticos | 26.880 |
| Sesiones simuladas | 779.417 |
| Olas estimadas | 1.572.477 |
| Clips generados | 56.215 |
| Avisos enviados | 1.605 |
| Publicaciones de comunidad | 11.594 |
| Sesiones profundas de tracking | 6.000 |
| Olas detectadas en profundidad | 3.428 |
| Falsos positivos del detector | 0 |
| Olas perdidas | 0 |
| Fallos abiertos | **0** |
| Duración | ~2,4 s |

## Iteraciones

| Iteración | Hallazgo | Acción |
| --- | --- | --- |
| 1 | `CAM-001`: Renegà, El Palaciet y Nules no tenían cámara y la app mostraba un bloque vacío. | Se añadió cámara de zona: la cámara más cercana se ofrece marcada como `ZONA` con la distancia (Renegà 2,6 km; Palaciet 5,3 km; Nules 6,6 km). |
| 2 | `TRK-008`: las sesiones mixtas no generaban giros porque el escenario sintético no cambiaba de rumbo. | Se corrigió el escenario de prueba y se verificó que el detector real sí registra maniobras de 55°. |
| 3 | Sin fallos tras el arreglo de cámaras y del escenario. | Se amplió la batería de comprobaciones. |
| 4 | Sin fallos con brazadas fantasma, picos aislados, sesiones de 2 h, `null` de la API y diferencia horaria exacta. | Se añadieron contratos de estabilidad. |
| 5 | Sin fallos con coherencia interna de cada ola, puntos GPS, mejor hora del resumen y mar constante. | Cierre: 0 fallos abiertos. |

## Comprobaciones permanentes del script

- Física: alturas, periodos, estrellas, potencia y rompiente finitos y en rango; monotonía de potencia y rompiente; el terral nunca puntúa peor que el viento de mar; mar plana no genera olas fantasma; viento desconocido no rompe la puntuación.
- Flota: contadores no negativos, relación olas/sesiones razonable, cobertura climática para todos los spots.
- Tracking: olas esperadas vs detectadas, falsos positivos, brazadas, giros, duración, velocidad punta, coherencia interna de cada ola y conservación de la traza GPS.
- Previsión: 72/168 horas, horas crecientes y separadas exactamente 1 h, resumen coherente con las horas, tolerancia a `null`, estabilidad con mar constante.
- Datos: IDs únicos, coordenadas válidas, ventana de swell en 0-360°, `maxGood` positivo y cámara resuelta para todos los spots.

## Límites

- No sustituye a usuarios reales ni a una validación oceanográfica: comprueba consistencia, rangos y contratos, no la exactitud absoluta contra boyas.
- La previsión online se prueba con datos sintéticos; las llamadas reales a Open-Meteo se verificaron aparte con `curl`.
- No se han añadido dependencias ni servicios de pago.

## Reproducir

```bash
cd surfline-mobile
npx tsc -p tsconfig.sim.json
node /tmp/meteosurf-sim/scripts/simulacion_10000_50anios.js --iteracion=5
```

Los resultados por iteración quedan en `docs/simulacion-10000-50anios-iteracion-N.json`.

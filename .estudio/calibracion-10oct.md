# Calibración 10/10/2026 - Planetario

## Tabla Horaria (Previsión Open-Meteo vs Boya)
| Hora | Open-Meteo (H) | Periodo | Viento Efectivo | Rompiente | Calidad Web | Estrellas |
|------|----------------|---------|-----------------|-----------|-------------|-----------|
| 08h  | 0.28 m         | 5.1 s   | 6.7 km/h (Terral)| 0.19 m    | 0 (Plato)   | 0★       |
| 09h  | 0.28 m         | 5.0 s   | 6.5 km/h (Terral)| 0.17 m    | 0 (Plato)   | 0★       |
| 10h  | 0.26 m         | 5.0 s   | 6.1 km/h (Terral)| 0.17 m    | 0 (Plato)   | 0★       |
| 11h  | 0.26 m         | 5.0 s   | 6.1 km/h (Terral)| 0.14 m    | 0 (Plato)   | 0★       |
| 12h  | 0.24 m         | 5.0 s   | 5.0 km/h (Calma) | 0.16 m    | 0 (Plato)   | 0★       |
| 13h  | 0.24 m         | 5.0 s   | 8.4 km/h (Cruz)  | 0.14 m    | 0 (Plato)   | 0★       |
| 14h  | 0.22 m         | 5.0 s   | 10.1 km/h (Cruz) | 0.14 m    | 0 (Plato)   | 0★       |

**Observación Boya (09/10 23h):** H = 0.59 m, T = 5.86 s, Dir = 67° (ENE).  
**Viento real (Estación Mistral):** 1.1 km/h, rachas 6.1 km/h (OSO).  
Al pasar los datos de la boya por el motor, da **0.53 m** en rompiente y **Nota 4 (Regular / 3★)**.

## Causa del sesgo
[VERIFICADO] La web dio **Plato (0)** durante toda la mañana porque la previsión pura de Open-Meteo fue muy pesimista (0.28 m offshore).
[VERIFICADO] Al aplicar el factor físico de rompiente para Planetario (0.72 a 5s para ENE), la altura quedó en ~0.17 m - 0.20 m.
[VERIFICADO] Esto activa el corte estricto `if (h < 0.22) return 0;` en `js/forecast.js`, forzando el resultado a Plato.
[VERIFICADO] Sin embargo, con los datos reales de la boya (0.59 m), el motor acierta perfectamente dando **4 (Regular / 3★)**, que cuadra exactamente con la "calidad media" esperada por Jordi. 
[VERIFICADO] El techo actual para `h < 0.65m` (`maxCap = limpio ? 4 : 3`) limita la puntuación a 4, impidiendo que alcance el 5 (Regular-Bueno) a pesar de ser un buen baño.

## Cambio propuesto mínimo
Para que un baño de 0.5-0.65m limpios pueda alcanzar la valoración de "Regular-Bueno" (5) como esperaba Jordi para esta sesión, propongo elevar un punto el techo para viento limpio en ese rango:
- Cambiar en `js/forecast.js` (aprox línea 305):  
  `else if (h < 0.65) maxCap = limpio ? 5 : 3;` (en lugar de `4 : 3`).
- Nota: la puntuación base para 0.53m es 3.5. Con viento limpio (+0.4), llega a 3.9 (redondea a 4). Para que el motor llegue a dar 5 en 0.5-0.6m, habría que suavizar también la puntuación base, pero subir el techo es el paso mínimo necesario para permitirlo.

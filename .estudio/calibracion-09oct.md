# Diagnóstico de Calibración: 09/10/2026 (Planetario)

## 1. Observación real vs Web
* **Día y lugar:** 09/10/2026, 8 a 14 h (hora de Madrid), Planetario.
* **Realidad (Jordi):** "Buenas olas, no las mejores, pero un buen día para ir" (Regular-Bueno, 4-5 en calidad, 2-3 estrellas).
* **Predicción de la web:** Pesimista. En `historico_olas.csv`, a las 8 y 9 h (Madrid) se guardó una calidad de **1 (Muy malo)** y altura de rompiente de 0.31 m. A partir de las 10 h, la previsión del modelo mejoró y la web dio **4 (Regular)**.

## 2. Origen del fallo: ¿Física o Modelo?
El fallo está en la **previsión del modelo** en el momento de la consulta.

* **El modelo en la mañana (guardado en el CSV):** A las 08:00 (Madrid), el modelo que consultó la web preveía 0.31 m de altura total y 6.2 s de periodo. Con esos datos, la web dio calidad 1.
* **La realidad (Boya):** A las 13:00 UTC (15:00 Madrid), la boya midió **0.94 m** de altura y **7.23 s** de periodo máximo.
* **Diferencia (cociente):** Si usamos los 0.58 m del modelo (re-analizado por Open-Meteo para esa misma hora) frente a los 0.94 m reales, la boya midió un **1.62x** más de altura. Frente a la predicción inicial de la mañana (0.31 m), la diferencia fue de un **3x**.

## 3. Conclusión sobre la escala
No es necesario cambiar la física (`js/physics.js`) ni rebajar los techos de `maxCap` para llegar a 5.
Si pasamos los **datos reales de la boya** (0.94 m, 7.23 s, ENE) junto con el viento de la mañana (8.5 km/h Terral) por el script de calibración actual, obtenemos una altura en rompiente de **0.64 m** y una nota de **4 (Regular)**, lo cual cuadra perfectamente con la "calidad media" que indicó Jordi para su sesión.

El sistema de calibración evalúa el mar correctamente cuando los datos de entrada son fiables. El fallo de este día fue puramente una subestimación puntual del modelo marino de Open-Meteo en las horas tempranas, por lo que no hace falta modificar los umbrales.

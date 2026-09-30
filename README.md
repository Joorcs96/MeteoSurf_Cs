# MeteoSurf_Cs

Previsión de surf profesional para la costa de Castellón (Vinaròs, Peñíscola, Oropesa,
Benicàssim, Grao de Castellón, Almassora, Burriana, Nules y Almenara), con estética y
funciones inspiradas en Surfline y Surf-Forecast. Arquitectura 100 % estática, coste 0 €:
sin backend en producción, servida desde GitHub Pages, con automatización diaria en
GitHub Actions.

Demo: https://joorcs96.github.io/MeteoSurf_Cs/

---

## Qué es

Una PWA (Progressive Web App) instalable que calcula, en el propio navegador y a partir de
datos abiertos de Open-Meteo, la previsión de olas, viento, marea y calidad de cada spot de
la costa de Castellón, y la presenta junto a cámaras en directo, un mapa y un asistente de
previsión en español que responde a preguntas sobre cuándo y dónde surfear.

## Funciones

- **Lista regional de spots**: las cuatro zonas de la costa (Vinaròs · Peñíscola, Oropesa ·
  Benicàssim, Grao de Castellón, Burriana · Almenara) con tarjetas por spot que muestran
  tamaño de ola actual, calidad (badge de color), viento y una mini-previsión de 7 días.
- **Ficha de spot al estilo Surfline**: cámara en directo, condiciones actuales (altura en
  rompiente, calidad, marea, temperatura del agua), desglose del mar de fondo por
  componentes (swell principal, swell secundario, mar de viento), estado del viento
  (terral, terral cruzado, cruzado, mar cruzado, de mar) y una tabla de datos del spot
  (fondo, marea y mar óptimos, nivel, peligros).
- **Previsión detallada a 4 días, cada 3 horas**, al estilo Surf-Forecast: tabla horaria con
  altura, energía en kJ, dirección de swell, viento y marea.
- **Tendencia hasta 16 días** para anticipar repuntes de mar de fondo, con aviso de menor
  fiabilidad a partir del séptimo día.
- **Brújula del spot**: orientación real de la playa, ventana angular de mar que llega a la
  rompiente, ventana de viento terral y flechas en vivo del swell y del viento.
- **Mapa** con todos los spots y su calidad del momento.
- **Cámaras**: catálogo de webcams costeras embebidas por spot (iframe, YouTube, HLS,
  MJPEG o JPG con refresco automático), con reproductor adaptado a iOS (HLS nativo) y al
  resto de navegadores (hls.js).
- **Asistente de previsión local**: responde en español a preguntas en lenguaje natural
  ("¿cuándo surfeo esta semana?", "¿hace terral mañana en Burriana?", "¿qué traje llevo?")
  calculando la respuesta en el navegador a partir de la previsión ya descargada, sin APIs
  de IA externas ni claves.
- **PWA offline-friendly**: manifiesto de instalación, iconos, Service Worker que revalida
  los archivos propios y recarga la app cuando hay una versión nueva publicada.
- **Reporte de sesión** (`votar.html`): formulario para que los usuarios valoren cómo
  estaban las olas realmente, guardado en local y con opción de enviarlo como issue de
  GitHub para retroalimentar el modelo de calidad.

## Escala de calidad

Escala de 8 niveles (Plato, Muy malo, Malo, Malo-Regular, Regular, Regular-Bueno, Bueno,
Épico) calibrada para el Mediterráneo: con 0.5–0.7 m en rompiente y poco viento ya hay buen
baño, y un periodo de 4–6 s no penaliza (es lo habitual en esta costa); a partir de 7 s se
considera mar de fondo de calidad. La calidad combina el tamaño de ola en rompiente (según
la exposición y ventana de mar de cada spot), el periodo, y la velocidad y dirección del
viento relativa a la orientación de la playa.

## Fuentes de datos

- **Open-Meteo Marine API**: altura, periodo y dirección de ola (total y por componentes:
  swell principal, swell secundario, mar de viento), nivel del mar y temperatura superficial
  del agua, hasta 16 días.
- **GFS-Wave (`ncep_gfswave016`, vía Open-Meteo Marine)**: modelo de respaldo para rellenar
  los huecos del modelo principal en los días 11–16, donde este ya no tiene datos.
- **Open-Meteo Weather API**: viento (velocidad, ráfagas y dirección a 10 m), temperatura,
  código de tiempo, salida y puesta de sol.

Todo se descarga directamente desde el navegador del usuario; no hay servidor intermedio en
producción.

## Estructura del proyecto

```text
├── index.html                     # Punto de entrada de la PWA
├── css/
│   └── app.css                    # Estilos (tokens de color, claro/oscuro, componentes)
├── js/
│   ├── app.js                     # Enrutado, render de vistas y orquestación general
│   ├── spots.js                   # Catálogo de spots (coordenadas, orientación, ventanas)
│   ├── forecast.js                # Descarga Open-Meteo, física de rompiente y calidad
│   ├── compass.js                 # Brújula SVG del spot (orientación y ventanas)
│   ├── cams.js                    # Reproductor de webcams (iframe/YouTube/HLS/MJPEG/JPG)
│   └── assistant.js               # Asistente de previsión local en español
├── manifest.json                  # Manifiesto de instalación PWA
├── sw.js                          # Service Worker (caché y revalidación)
├── icon.svg / icon-192.png / icon-512.png
├── webcams.json                   # Catálogo de cámaras costeras y su estado
├── votar.html                     # Formulario de reporte de sesión
├── backend/
│   ├── motor_fisica.py            # Física costera y cálculo de calidad (Python)
│   ├── actualizar_prevision.py    # Histórico diario y alerta WhatsApp (GitHub Actions)
│   ├── actualizar_webcams.py      # Verificación y refresco del catálogo de webcams
│   └── test_motor_fisica.py       # Tests unitarios del motor físico
├── scripts/
│   ├── rewind.py                  # Graba clips Rewinds de las cámaras y mantiene el índice
│   └── test_rewind.py             # Tests unitarios del grabador de Rewinds
├── data/
│   └── rewinds.json               # Índice de clips Rewinds (lo escribe el workflow)
├── .github/workflows/
│   ├── prevision_diaria.yml       # Cron diario: histórico de olas y alerta WhatsApp
│   ├── rewinds.yml                # Cron cada 2 h en horas de luz: graba y publica clips
│   └── webcams.yml                # Cron cada 30 min: verifica y actualiza webcams.json
├── historico_olas.csv             # Registro histórico de observaciones
└── MASTER_CONTEXT.md              # Contexto de arquitectura y decisiones del proyecto
```

## Probar en local

No requiere build ni dependencias: es HTML/CSS/JS estático con módulos ES.

```bash
python -m http.server 8000
```

Y abrir `http://localhost:8000/`.

Para los tests (Python, solo librería estándar):

```bash
python -m unittest backend.test_motor_fisica
python -m unittest scripts.test_rewind
```

Para grabar un clip de Rewinds a mano (hacen falta `ffmpeg` y `ffprobe` en el PATH):

```bash
python scripts/rewind.py --cameras cv_grao_castellon
```

Graba 20 s de las cámaras HLS de Turisme Comunitat Valenciana, los baja a 480p con desenfoque
(para que no se reconozcan caras) y añade la previsión de ese momento al índice
`data/rewinds.json`. Solo graba entre las 8:00 y las 20:00 de Madrid y si algún spot con cámara
llega a 0,5 m de oleaje. Con `--subir` publica los clips como assets de la release mensual
`rewinds-AAAA-MM`; el workflow `.github/workflows/rewinds.yml` es quien lo hace de forma
automática.

## Despliegue

Publicado como sitio estático en **GitHub Pages**, rama `main` del repositorio
`Joorcs96/MeteoSurf_Cs`, en https://joorcs96.github.io/MeteoSurf_Cs/. No se usa Netlify ni
ningún otro hosting; no hay backend en producción, solo tres workflows de GitHub Actions que
mantienen actualizados el histórico de olas, el catálogo de webcams y el índice de clips
Rewinds.

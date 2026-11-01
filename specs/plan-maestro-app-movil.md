# Arquitectura y Plan Maestro de Ingeniería: App Nativa Surfline Castellón (iOS y Android)

> **Documento de Especificación Técnica para Supervisión de Cerebro (Claude / Codex)**  
> **Fecha:** 25 de Octubre de 2026  
> **Proyecto:** Surfline Castellón Mobile  
> **Objetivo:** Reconstrucción nativa multiplataforma (iOS & Android) desde cero, coste de desarrollo 0 €, cumplimiento estricto de la Directriz 4.2 de la Apple App Store y soporte sin conexión para playas.

---

## 1. Resumen Ejecutivo y Decisiones de Arquitectura

1. **Rechazo a soluciones WebView / Híbridas:**  
   Se excluye terminantemente `react-native-webview`. Las soluciones tipo Capacitor/Cordova sufren rechazos sistemáticos bajo la **Directriz 4.2 (Mínima Funcionalidad)** de Apple y no proporcionan el rendimiento necesario para decodificación HLS simultánea.
2. **Framework Base: React Native + Expo SDK 52/54+ con Nueva Arquitectura (JSI):**  
   - Interfaz renderizada en vistas nativas (`UIView` en iOS, `android.view.View` en Android) a 60–120 fps (ProMotion).
   - Motor Hermes con enlace síncrono en memoria C++ (JSI) sin sobrecarga del puente antiguo.
   - Reutilización del 100 % del motor matemático de física y cálculo oceanográfico ya programado en JavaScript/TypeScript.
3. **Flujo Multi-Entorno a Coste Cero (0 €):**  
   - **Desarrollo y pruebas inmediatas:** Portátil Windows con agentes de IA (Orca / Antigravity / Codex), pruebas en vivo mediante **Expo Go** en iPhone/Android escaneando código QR.
   - **Compilación en la nube:** Capa gratuita de **EAS Build** (30 builds/mes) para generar paquetes nativos sin saturar la máquina local.
   - **Compilación local opcional:** Mac de apoyo mediante `npx expo run:ios` con firma gratuita de desarrollo en Xcode.

---

## 2. Matriz de Librerías Nativas Críticas

| Capa Arquitectónica | Librería Seleccionada | Justificación Técnica y Protección de Rendimiento | Compatibilidad Expo Go |
|---|---|---|---|
| **Streaming HLS en Vivo** | `expo-video` | Sustituye a `expo-av` (obsoleto). Control por `EventEmitter`, soporte PiP nativo y límite forzado de RAM (`bufferOptions: { maxBufferBytes: 5_000_000 }`) para no saturar memoria con múltiples cámaras. | Adaptador en Go / Nativo en Dev Build |
| **Búfer Circular Vigía** | `expo-file-system` (API Objetos SDK 54+) | Manejo directo de segmentos `.ts` en disco (`Paths.cache`). Concatenación binaria con `Uint8Array` y `offset`. **Prohibido Base64 en memoria.** | Soportado en Expo SDK 54+ |
| **Carrete de Fotos** | `expo-media-library` | Modo de solo escritura (`writeOnly: true`) para cumplir la política restrictiva de Google Play sin pedir permisos intrusivos de lectura. Parche de ruta para iOS 18 (`.replace(/#.*$/, '')`). | Modo escritura seguro |
| **Navegación** | `expo-router` | Rutas basadas en archivos sobre `react-native-screens`. Soporta NativeTabs con desenfoque (`BlurView`), Deep Linking para alertas push. | 100 % en Expo Go y Builds |
| **Almacenamiento Local** | Adaptador Dual (`MMKV` + `expo-sqlite`) | En compilaciones EAS usa `react-native-mmkv` (JSI síncrono, 60 % más rápido). En Expo Go conmuta automáticamente a `expo-sqlite/kv-store` para evitar el error `NOBRIDGE`. | 100 % compatible sin errores |
| **Estado y Caché** | `TanStack Query v5` + `Zustand` | Persistencia offline de previsiones marítimas (7 días de caché). Zustand para UI efímera. | 100 % compatible (JS puro) |
| **Sensores y Hardware** | `expo-location`, `expo-sensors`, `expo-haptics` | Radar de spots cercanos por GPS (Haversine), barómetro físico para anticipar vientos térmicos y micro-vibraciones táctiles. | Soportado |

---

## 3. Superpoderes Móviles ("Killer Features")

1. **Alertas Inteligentes ("Swell & Terral Trigger"):** Notificaciones push locales/remotas (`expo-notifications`) con sonido personalizado de boya (`swell-alert.wav`) cuando la calidad supere 3.5 estrellas con viento terral. Al tocar la notificación, abre directamente el vídeo HLS en vivo.
2. **Radar de Spots por GPS y Telemetría Barométrica:** Ordena las cámaras por cercanía física. El sensor barométrico del móvil compara la presión atmosférica en hPa con el modelo para avisar de entradas repentinas de viento.
3. **Modo Playa Sin Conexión ("Zero-Signal Beach Bunker"):** Gráficas de energía (kW/m), periodo y viento guardadas en SQLite local; visualización instantánea incluso en calas sin cobertura.
4. **Picture-in-Picture (PiP):** Webcam flotante en pantalla mientras se chatea por WhatsApp u otras apps.
5. **Vigía Clip Studio:** Exportación y compartición nativa (`expo-sharing`) de clips de 20 s con tarjeta de telemetría sobreimpresa (playa, hora, altura, nudos, estrellas).
6. **Votación Comunitaria Verificada:** Validación de distancia GPS (< 500 m) para otorgar la insignia "Reporte a pie de playa", con respuesta háptica en cada interacción.

---

## 4. Blindaje contra Políticas de Apple (App Store) y Google Play

### A. Directriz 4.2 de Apple (Mínima Funcionalidad)
- **Cero WebViews:** Interfaz 100 % basada en componentes nativos.
- **Acceso inmediato sin barreras:** Cámaras, previsiones y clips disponibles sin registro ni login forzado.
- **Uso real de capacidades del dispositivo:** GPS, barómetro, Picture-in-Picture, hápticos y descargas locales a la fototeca.

### B. Manifiestos de Privacidad (`PrivacyInfo.xcprivacy`) — Error ITMS-91053
Declaración centralizada en `app.json` (`ios.privacyManifests`):
* `NSPrivacyAccessedAPICategoryUserDefaults` (Código `CA92.1`): `react-native-mmkv`, `expo-notifications`.
* `NSPrivacyAccessedAPICategoryFileTimestamp` (Códigos `C617.1`, `DDA9.1`): `expo-file-system` (segmentos temporales del Vigía).
* `NSPrivacyAccessedAPICategoryDiskSpace` (Código `E174.1`): `expo-file-system`, `expo-sqlite`.
* `NSPrivacyAccessedAPICategorySystemBootTime` (Código `35F9.1`): `react-native-reanimated`, `TanStack Query`.

### C. Permisos Transparentes y Restricciones
- Textos detallados en `ios.infoPlist` explicando el uso exacto del GPS y el guardado de vídeos.
- Bloqueo de permisos innecesarios en Android (`CAMERA`, `RECORD_AUDIO`, `READ_MEDIA_IMAGES`, `READ_MEDIA_VIDEO`) vía `android.blockedPermissions` para evitar auditorías de Google Play.

---

## 5. Estructura del Proyecto (Clean Architecture orientada a Dominio)

```
surfline-mobile/
├── app.json                     # Configuración declarativa maestra (Plugins, Permisos, PrivacyInfo)
├── package.json
├── tsconfig.json
└── src/
    ├── app/                     # Rutas de Expo Router (File-based navigation)
    │   ├── _layout.tsx          # SafeAreaProvider, QueryClientProvider, Tema y Notificaciones
    │   ├── (tabs)/
    │   │   ├── _layout.tsx      # Barra inferior de 4 pestañas con BlurView y Hápticos
    │   │   ├── index.tsx        # Pestaña 1: Radar de Spots y Cámaras en Directo
    │   │   ├── forecasts.tsx    # Pestaña 2: Previsiones, Física y Gráficas Offline
    │   │   ├── vigia.tsx        # Pestaña 3: Galería de Clips de Olas capturados
    │   │   └── community.tsx    # Pestaña 4: Votación GPS y Alertas de Mar
    │   └── spot/
    │       └── [id].tsx         # Vista de detalle: Streaming a pantalla completa y PiP
    ├── core/                    # LÓGICA PURA REUTILIZADA (100 % TypeScript, sin dependencias DOM)
    │   ├── physics/             # Fórmulas de olas
    │   │   ├── waveQuality.ts   # Calificación 0 a 5 estrellas
    │   │   ├── swellDecomposition.ts # Mar de fondo primario/secundario y potencia (kW/m)
    │   │   ├── breakerHeight.ts # Altura en rompiente según batimetría y orientación
    │   │   └── windPenalty.ts   # Bonificación terral vs. penalización marítima
    │   └── parsers/             # Ingesta de webcams.json, streams.json y APIs oceanográficas
    │       └── streamParser.ts
    ├── services/                # Servicios de Infraestructura Nativa
    │   ├── storage/
    │   │   └── storageAdapter.ts # Adaptador híbrido: MMKV (Builds) / SQLite (Expo Go)
    │   ├── video/
    │   │   ├── circularBufferManager.ts # Anillo de segmentos .ts en caché (sin Base64)
    │   │   ├── clipExporter.ts  # Guardado en carrete y compartición social
    │   │   └── hlsTokenService.ts # Renovación de tokens en segundo plano
    │   └── notifications/
    │       └── swellAlerts.ts   # Disparadores locales de olas y canal de audio
    ├── store/                   # Estado Global Ligero (Zustand)
    │   ├── useSpotStore.ts
    │   └── useVigiaStore.ts
    └── components/              # Componentes UI Nativos
        ├── video/
        │   └── SurfCamPlayer.tsx # Reproductor expo-video con bufferOptions de 5 MB
        └── ui/                  # Componentes táctiles a 60/120 fps
```

---

## 6. Plan de Implementación por Fases Atómicas

### Fase 1: Estructura Base, Navegación y Adaptador de Almacenamiento
- Inicialización con Expo Router y TypeScript.
- Creación de `src/services/storage/storageAdapter.ts` con detección dinámica (`MMKV` vs `expo-sqlite/kv-store`).
- Configuración de `app.json` con manifiestos de privacidad y permisos.
- Navegación de 4 pestañas con desenfoque nativo (`BlurView`) y hápticos.

### Fase 2: Cámaras, Streaming HLS y Búfer Circular del Vigía
- Migración de `webcams.json` y `data/streams.json` a `src/core/parsers/streamParser.ts`.
- Componente `SurfCamPlayer.tsx` (`expo-video`) con límite estricto de 5 MB de RAM por stream y soporte PiP.
- Gestor de búfer circular `circularBufferManager.ts` descargando segmentos `.ts` a disco sin Base64.
- Módulo `clipExporter.ts` con guardado `writeOnly` y saneamiento de rutas para iOS 18.

### Fase 3: Previsión Marítima, Motor de Física y Soporte Offline
- Extracción de fórmulas a `src/core/physics/` (TypeScript puro sin DOM).
- Configuración de `TanStack Query` con persistencia de 7 días respaldada por `expo-sqlite`.
- Pantalla interactiva de previsiones hora a hora con gráficas vectoriales y respuesta táctil.

### Fase 4: Sensores (GPS, Barómetro), Alertas Push y Comunidad
- Hook `useNearestSpots.ts` con ordenación por distancia geodésica (Haversine) y telemetría barométrica en hPa.
- Servicio `swellAlerts.ts` con notificaciones push condicionales y Deep Linking al spot.
- Votación comunitaria verificada por presencia GPS (< 500 m).

### Fase 5: Compilación, Validación y Despliegue Coste Cero
- Pruebas directas de interfaz en iPhone/Android con **Expo Go**.
- Generación de Development Build mediante **EAS Build** (capa gratuita) para probar PiP y MMKV nativo.
- Verificación de binarios y preparación para App Store Connect y Google Play.

---

## 7. Instrucciones para el Cerebro Revisor (Claude)

1. Verificar que el diseño cumple con la regla de **cero dependencias de DOM del navegador**.
2. Confirmar que la estrategia de memoria para el streaming HLS (5 MB máx por player) y el búfer circular (segmentos en disco) elimina cualquier riesgo de fugas u OOM.
3. Autorizar el inicio de la **Fase 1** una vez validada la estructura de carpetas y los archivos declarativos.

# SPEC AUTÓNOMA — Fase 1: App Nativa Surfline Castellón
# Sin preguntas. Sin dudas. Ejecutar de principio a fin.

**Fecha:** 2026-10-25 | **Worker:** OpenCode (modelo por defecto)  
**Tiempo estimado:** 50–70 min | **Jordi está durmiendo — NO interrumpir**

---

## REGLAS ANTES DE EMPEZAR

1. **No hacer preguntas.** Todo está resuelto aquí. Si algo no encaja, elige la opción más conservadora, apúntala en `DUDAS.md` y sigue.
2. **No tocar nada fuera de `surfline-mobile/`** y los dos archivos del repo raíz indicados.
3. **No hacer `git push`** bajo ninguna circunstancia.
4. **Si un comando falla 3 veces**, para, escribe el error en `DUDAS.md` y pasa al siguiente paso.
5. Cada paso: commit pequeño con mensaje descriptivo.

---

## OBJETIVO

Crear `C:\Users\Jordi\orca\Surfline_CS\surfline-mobile\` con:
- Proyecto Expo + React Native (nueva arquitectura JSI).
- Navegación de 4 pestañas con `expo-router`, `BlurView` y hápticos.
- Adaptador de almacenamiento dual (MMKV en builds / AsyncStorage en Expo Go).
- `app.json` con manifiestos de privacidad iOS y permisos Android completos.
- Stores Zustand vacíos y estructura de carpetas lista para Fase 2.
- Todo el código compilable sin errores TypeScript.

---

## PASO 1 — Crear proyecto base

Ejecutar desde `C:\Users\Jordi\orca\Surfline_CS\`:

```powershell
npx create-expo-app@latest surfline-mobile --template blank-typescript
```

Si pide confirmación de instalación de `create-expo-app`, responder `y`.  
Esperar hasta que termine completamente.

Luego entrar al directorio para todos los pasos siguientes:
```powershell
cd C:\Users\Jordi\orca\Surfline_CS\surfline-mobile
```

---

## PASO 2 — Instalar dependencias

Ejecutar en orden (esperar a que termine cada uno):

```powershell
npx expo install expo-router expo-blur expo-haptics expo-sqlite react-native-screens react-native-safe-area-context react-native-gesture-handler react-native-reanimated
```

```powershell
npm install zustand @tanstack/react-query @react-native-async-storage/async-storage
```

```powershell
npm install react-native-mmkv --save-optional
```

Si alguna instalación da error de peer deps, añadir `--legacy-peer-deps` y reintentar.

---

## PASO 3 — Reemplazar `app.json`

Borrar el `app.json` generado y crear este exacto:

```json
{
  "expo": {
    "name": "Surfline Castellón",
    "slug": "surfline-castellon",
    "version": "1.0.0",
    "scheme": "surflinecastellon",
    "platforms": ["ios", "android"],
    "newArchEnabled": true,
    "orientation": "portrait",
    "userInterfaceStyle": "dark",
    "icon": "./assets/icon.png",
    "splash": {
      "image": "./assets/splash-icon.png",
      "resizeMode": "contain",
      "backgroundColor": "#0a1628"
    },
    "ios": {
      "supportsTablet": false,
      "bundleIdentifier": "com.jordi.surflinecastellon",
      "privacyManifests": {
        "NSPrivacyAccessedAPITypes": [
          {
            "NSPrivacyAccessedAPIType": "NSPrivacyAccessedAPICategoryUserDefaults",
            "NSPrivacyAccessedAPITypeReasons": ["CA92.1"]
          },
          {
            "NSPrivacyAccessedAPIType": "NSPrivacyAccessedAPICategoryFileTimestamp",
            "NSPrivacyAccessedAPITypeReasons": ["C617.1", "DDA9.1"]
          },
          {
            "NSPrivacyAccessedAPIType": "NSPrivacyAccessedAPICategoryDiskSpace",
            "NSPrivacyAccessedAPITypeReasons": ["E174.1"]
          },
          {
            "NSPrivacyAccessedAPIType": "NSPrivacyAccessedAPICategorySystemBootTime",
            "NSPrivacyAccessedAPITypeReasons": ["35F9.1"]
          }
        ]
      },
      "infoPlist": {
        "NSLocationWhenInUseUsageDescription": "Para ordenar las playas por distancia a tu ubicación actual.",
        "NSPhotoLibraryAddUsageDescription": "Para guardar clips de olas en tu carrete de fotos."
      }
    },
    "android": {
      "package": "com.jordi.surflinecastellon",
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#0a1628"
      },
      "blockedPermissions": [
        "android.permission.CAMERA",
        "android.permission.RECORD_AUDIO",
        "android.permission.READ_MEDIA_IMAGES",
        "android.permission.READ_MEDIA_VIDEO"
      ]
    },
    "plugins": [
      "expo-router",
      "expo-sqlite",
      [
        "expo-haptics",
        {}
      ],
      [
        "@react-native-async-storage/async-storage",
        {
          "excludeSessionStorage": true
        }
      ]
    ],
    "experiments": {
      "typedRoutes": true
    }
  }
}
```

---

## PASO 4 — Configurar `package.json`

Abrir `package.json` y asegurarse de que tiene el campo `"main"` apuntando a expo-router.  
Buscar la línea `"main"` y reemplazarla por:
```json
"main": "expo-router/entry",
```
Si no existe el campo `"main"`, añadirlo justo después de `"name"`.

---

## PASO 5 — Configurar `tsconfig.json`

Reemplazar el contenido de `tsconfig.json` con:

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": [
    "**/*.ts",
    "**/*.tsx",
    ".expo/types/**/*.d.ts",
    "expo-env.d.ts"
  ]
}
```

---

## PASO 6 — Crear estructura de carpetas

Crear todos estos directorios y archivos placeholder:

```powershell
New-Item -ItemType Directory -Force -Path "app\(tabs)"
New-Item -ItemType Directory -Force -Path "src\core\physics"
New-Item -ItemType Directory -Force -Path "src\core\parsers"
New-Item -ItemType Directory -Force -Path "src\services\storage"
New-Item -ItemType Directory -Force -Path "src\services\video"
New-Item -ItemType Directory -Force -Path "src\services\notifications"
New-Item -ItemType Directory -Force -Path "src\store"
New-Item -ItemType Directory -Force -Path "src\components\video"
New-Item -ItemType Directory -Force -Path "src\components\ui"
```

Crear placeholders para que git trackee las carpetas vacías:
```powershell
"" | Out-File "src\core\physics\.gitkeep" -Encoding utf8
"" | Out-File "src\core\parsers\.gitkeep" -Encoding utf8
"" | Out-File "src\services\video\.gitkeep" -Encoding utf8
"" | Out-File "src\services\notifications\.gitkeep" -Encoding utf8
"" | Out-File "src\components\video\.gitkeep" -Encoding utf8
"" | Out-File "src\components\ui\.gitkeep" -Encoding utf8
```

---

## PASO 7 — Crear `app/_layout.tsx` (raíz)

Contenido exacto:

```tsx
import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 60 * 24 * 7,
      retry: 2,
    },
  },
});

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false }} />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
```

---

## PASO 8 — Crear `app/(tabs)/_layout.tsx` (pestañas)

Contenido exacto:

```tsx
import { Tabs } from 'expo-router';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

function TabIcon({ name, color, size }: { name: IoniconName; color: string; size: number }) {
  return <Ionicons name={name} size={size} color={color} />;
}

function TabBarBackground() {
  return (
    <BlurView
      intensity={85}
      tint="dark"
      style={StyleSheet.absoluteFill}
    />
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#4fc3f7',
        tabBarInactiveTintColor: '#7a8fa6',
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
        },
        tabBarBackground: () => <TabBarBackground />,
      }}
      screenListeners={{
        tabPress: () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Spots',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="water-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="forecasts"
        options={{
          title: 'Previsión',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="analytics-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="vigia"
        options={{
          title: 'Vigía',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="videocam-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="community"
        options={{
          title: 'Comunidad',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="people-outline" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
```

---

## PASO 9 — Crear las 4 pantallas de pestaña

### `app/(tabs)/index.tsx`
```tsx
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SpotsScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Spots en Directo</Text>
        <Text style={styles.subtitle}>Cámaras HLS — Fase 2</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a1628' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { color: '#ffffff', fontSize: 22, fontWeight: '700' },
  subtitle: { color: '#7a8fa6', fontSize: 14, marginTop: 8 },
});
```

### `app/(tabs)/forecasts.tsx`
```tsx
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ForecastsScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Previsión Marítima</Text>
        <Text style={styles.subtitle}>Física de olas y offline — Fase 3</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a1628' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { color: '#ffffff', fontSize: 22, fontWeight: '700' },
  subtitle: { color: '#7a8fa6', fontSize: 14, marginTop: 8 },
});
```

### `app/(tabs)/vigia.tsx`
```tsx
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function VigiaScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Vigía Clip Studio</Text>
        <Text style={styles.subtitle}>Captura y exportación de clips — Fase 2</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a1628' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { color: '#ffffff', fontSize: 22, fontWeight: '700' },
  subtitle: { color: '#7a8fa6', fontSize: 14, marginTop: 8 },
});
```

### `app/(tabs)/community.tsx`
```tsx
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function CommunityScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Comunidad</Text>
        <Text style={styles.subtitle}>Votación GPS verificada — Fase 4</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a1628' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { color: '#ffffff', fontSize: 22, fontWeight: '700' },
  subtitle: { color: '#7a8fa6', fontSize: 14, marginTop: 8 },
});
```

---

## PASO 10 — Crear `src/services/storage/storageAdapter.ts`

```typescript
/**
 * Adaptador de almacenamiento dual.
 * MMKV en builds EAS (JSI síncrono, 60% más rápido).
 * AsyncStorage como fallback en Expo Go (sin puente nativo).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export interface StorageAdapter {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

function createMMKVAdapter(): StorageAdapter {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { MMKV } = require('react-native-mmkv');
  const instance = new MMKV({ id: 'surfline-store' });
  // Verificar que el puente JSI está activo
  instance.set('__probe__', '1');
  instance.delete('__probe__');
  return {
    get: async (key) => instance.getString(key) ?? null,
    set: async (key, value) => instance.set(key, value),
    delete: async (key) => instance.delete(key),
  };
}

function createAsyncStorageAdapter(): StorageAdapter {
  return {
    get: (key) => AsyncStorage.getItem(key),
    set: (key, value) => AsyncStorage.setItem(key, value),
    delete: (key) => AsyncStorage.removeItem(key),
  };
}

let _storage: StorageAdapter | null = null;

export function getStorage(): StorageAdapter {
  if (_storage) return _storage;
  try {
    _storage = createMMKVAdapter();
  } catch {
    _storage = createAsyncStorageAdapter();
  }
  return _storage;
}

export default getStorage();
```

---

## PASO 11 — Crear `src/store/useSpotStore.ts`

```typescript
import { create } from 'zustand';

export interface Spot {
  id: string;
  name: string;
  lat: number;
  lng: number;
  stars: number;
}

interface SpotStore {
  spots: Spot[];
  selectedSpotId: string | null;
  setSpots: (spots: Spot[]) => void;
  selectSpot: (id: string | null) => void;
}

export const useSpotStore = create<SpotStore>((set) => ({
  spots: [],
  selectedSpotId: null,
  setSpots: (spots) => set({ spots }),
  selectSpot: (id) => set({ selectedSpotId: id }),
}));
```

---

## PASO 12 — Crear `src/store/useVigiaStore.ts`

```typescript
import { create } from 'zustand';

export interface VigiaClip {
  id: string;
  spotId: string;
  uri: string;
  capturedAt: number;
  durationMs: number;
}

interface VigiaStore {
  clips: VigiaClip[];
  isRecording: boolean;
  addClip: (clip: VigiaClip) => void;
  removeClip: (id: string) => void;
  setRecording: (value: boolean) => void;
}

export const useVigiaStore = create<VigiaStore>((set) => ({
  clips: [],
  isRecording: false,
  addClip: (clip) => set((s) => ({ clips: [...s.clips, clip] })),
  removeClip: (id) => set((s) => ({ clips: s.clips.filter((c) => c.id !== id) })),
  setRecording: (value) => set({ isRecording: value }),
}));
```

---

## PASO 13 — Actualizar `.gitignore` del repo raíz

Abrir `C:\Users\Jordi\orca\Surfline_CS\.gitignore` y añadir al final (si no están ya):

```
# App móvil
surfline-mobile/node_modules/
surfline-mobile/.expo/
surfline-mobile/dist/
surfline-mobile/.env
```

---

## PASO 14 — Verificar TypeScript

Desde `surfline-mobile/`:
```powershell
npx tsc --noEmit
```

**Si hay errores:** leerlos, corregir solo los errores marcados como `error TS` (no warnings). Anotar los que no puedas resolver en `DUDAS.md` y continuar.

**Error común esperado y su solución:**  
Si dice `Cannot find module 'react-native-mmkv'`: es normal, está como opcional. Añadir al `tsconfig.json` en `compilerOptions`:
```json
"skipLibCheck": true
```

---

## PASO 15 — Verificar que Expo arranca

```powershell
npx expo start --port 8081 --no-dev
```

Esperar 30 segundos. Si aparece el QR o `Metro waiting on exp://...` → éxito.  
Pulsar `Ctrl+C` para parar.

**Si falla con error de Metro:** intentar:
```powershell
npx expo start --port 8081 --clear
```
Esperar 45 segundos y pulsar `Ctrl+C`.

---

## PASO 16 — Commit final

Desde `C:\Users\Jordi\orca\Surfline_CS\`:

```powershell
git add surfline-mobile/ .gitignore
git status
```

Revisar que solo aparecen archivos de `surfline-mobile/` y `.gitignore`. Nada más.

```powershell
git commit -m "feat(mobile): inicializar proyecto React Native Expo - Fase 1 estructura base

- Proyecto Expo SDK con nueva arquitectura JSI
- Navegación 4 pestañas: Spots, Previsión, Vigía, Comunidad
- BlurView + haptics en barra de navegación
- Adaptador almacenamiento dual: MMKV/AsyncStorage
- Stores Zustand: spots y vigía
- app.json con manifiestos privacidad iOS y permisos Android
- Estructura src/ lista para Fases 2-4

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## PASO 17 — Actualizar `PROGRESO.md`

Añadir en la sección `✅ FINALIZADAS` del archivo `C:\Users\Jordi\orca\Surfline_CS\PROGRESO.md`:

```
| 2026-10-25 | App móvil Fase 1: estructura base React Native Expo | <hash del commit> | [VERIFICADO expo start arrancó] o [NO VERIFICADO: error: <mensaje>] |
```

---

## CRITERIO DE ACEPTACIÓN FINAL

- [ ] `surfline-mobile/` existe con todos los archivos de los pasos 3–12.
- [ ] `npx tsc --noEmit` sin errores `TS`.
- [ ] `npx expo start` arranca sin errores fatales.
- [ ] `git log --oneline -1` muestra el commit de la Fase 1.
- [ ] `PROGRESO.md` actualizado.

---

## DUDAS YA RESUELTAS (no preguntar)

| Duda | Decisión tomada |
|---|---|
| ¿SDK 52 o 54? | Usar lo que instale `create-expo-app@latest` (siempre estable) |
| ¿`app/` en raíz o en `src/app/`? | En raíz — más compatible con expo-router estándar |
| ¿MMKV falla en Expo Go? | Previsto: AsyncStorage es el fallback automático |
| ¿Qué hacer si peer deps fallan? | `--legacy-peer-deps` y seguir |
| ¿Íconos de pestañas? | `@expo/vector-icons` (incluido con Expo, sin instalación extra) |
| ¿Hay que hacer push? | NO. Nunca en esta fase. |
| ¿Dónde están los datos de la app web? | En `data/` y `webcams.json` — no tocar, son para Fase 2 |

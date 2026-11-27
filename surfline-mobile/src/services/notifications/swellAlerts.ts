import { Platform } from 'react-native';

/**
 * Carga diferida de expo-notifications.
 * En Expo Go (SDK 53+) el módulo nativo de notificaciones no está incluido, así que
 * importarlo arriba del todo hace que la app crashee al abrir. Lo cargamos solo cuando
 * se usa y devolvemos null si no está disponible, para que la app funcione igual.
 */
let notificationsModule: typeof import('expo-notifications') | null | undefined;

function getNotifications(): typeof import('expo-notifications') | null {
  if (notificationsModule !== undefined) return notificationsModule;
  try {
    notificationsModule = require('expo-notifications');
    notificationsModule?.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
        priority: notificationsModule!.AndroidNotificationPriority.HIGH,
      }),
    });
  } catch {
    notificationsModule = null;
  }
  return notificationsModule ?? null;
}

/**
 * Solicita permisos de notificaciones locales. Devuelve false si no hay soporte nativo.
 */
export async function registerForSwellAlertsAsync(): Promise<boolean> {
  const Notifications = getNotifications();
  if (!Notifications) return false;

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      return false;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('swell-alerts', {
        name: 'Alertas de Oleaje',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#0284c7',
      });
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Disparador inteligente ("Swell & Terral Trigger"):
 * Genera notificación si la calidad de olas supera 3.5★ con terral.
 */
export async function checkAndTriggerSwellAlert(
  spotId: string,
  spotName: string,
  stars: number,
  windLabel: string,
  waveHeight: number
): Promise<string | null> {
  if (stars < 3.5) return null;

  const Notifications = getNotifications();
  if (!Notifications) return null;

  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: `Condiciones excelentes en ${spotName}`,
        body: `${waveHeight}m · ${stars} estrellas con viento ${windLabel}. Pulsa para ver la cámara en directo.`,
        data: { spotId, type: 'swell_alert' },
        sound: true,
      },
      trigger: null, // Inmediato
    });
    return id;
  } catch (err) {
    console.warn('[swellAlerts] Error al enviar notificación:', err);
    return null;
  }
}

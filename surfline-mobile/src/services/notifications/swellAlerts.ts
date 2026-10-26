import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configurar handler de notificaciones en primer plano
try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
      priority: Notifications.AndroidNotificationPriority.HIGH,
    }),
  });
} catch {}

/**
 * Solicita permisos de notificaciones locales.
 */
export async function registerForSwellAlertsAsync(): Promise<boolean> {
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

  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: `🌊 ¡Condiciones excelentes en ${spotName}!`,
        body: `${waveHeight}m · ${stars}★ estrellas con viento ${windLabel}. Pulsa para ver la cámara en directo.`,
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

import { useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import { Accelerometer, Gyroscope } from 'expo-sensors';
import * as Haptics from 'expo-haptics';
import { useSessionStore } from '../../store/useSessionStore';
import { GpsPoint } from '../../core/surfTracker/sessionTypes';

export function useSurfSessionTracker() {
  const isTracking = useSessionStore((state) => state.isTracking);
  const updateGps = useSessionStore((state) => state.updateGps);
  const updateGyro = useSessionStore((state) => state.updateGyro);
  const updateAccel = useSessionStore((state) => state.updateAccel);
  const currentStatus = useSessionStore((state) => state.currentStatus);

  const locationSub = useRef<Location.LocationSubscription | null>(null);
  const accelSub = useRef<any>(null);
  const gyroSub = useRef<any>(null);
  const lastGyroTime = useRef<number>(Date.now());
  const prevStatus = useRef(currentStatus);

  // Respuesta háptica al entrar en ola o finalizarla
  useEffect(() => {
    if (prevStatus.current !== currentStatus) {
      if (currentStatus === 'riding_wave') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      } else if (prevStatus.current === 'riding_wave' && currentStatus === 'waiting') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      }
      prevStatus.current = currentStatus;
    }
  }, [currentStatus]);

  useEffect(() => {
    if (!isTracking) {
      // Limpiar suscripciones cuando no se está trackeando
      if (locationSub.current) {
        locationSub.current.remove();
        locationSub.current = null;
      }
      if (accelSub.current) {
        accelSub.current.remove();
        accelSub.current = null;
      }
      if (gyroSub.current) {
        gyroSub.current.remove();
        gyroSub.current = null;
      }
      return;
    }

    let isMounted = true;

    async function startSensors() {
      // 1. Activar GPS de alta precisión para agua
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.warn('Permiso de GPS no concedido para tracking de sesión');
        return;
      }

      if (!isMounted) return;

      locationSub.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 1000,
          distanceInterval: 1,
        },
        (loc) => {
          const speedMs = loc.coords.speed ?? 0;
          const speedKmH = Math.max(0, speedMs * 3.6);

          const pt: GpsPoint = {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            speed: Math.max(0, speedMs),
            speedKmH: Math.round(speedKmH * 10) / 10,
            altitude: loc.coords.altitude ?? 0,
            heading: loc.coords.heading ?? undefined,
            timestamp: loc.timestamp,
          };
          updateGps(pt);
        }
      );

      // 2. Activar Acelerómetro para remadas
      Accelerometer.setUpdateInterval(40); // 25 Hz
      accelSub.current = Accelerometer.addListener((data) => {
        updateAccel(data.x, data.y, data.z, Date.now());
      });

      // 3. Activar Giroscopio para virajes y maniobras
      Gyroscope.setUpdateInterval(40); // 25 Hz
      lastGyroTime.current = Date.now();
      gyroSub.current = Gyroscope.addListener((data) => {
        const now = Date.now();
        const dt = Math.max(0.01, (now - lastGyroTime.current) / 1000);
        lastGyroTime.current = now;
        updateGyro(data.z, dt, now);
      });
    }

    startSensors();

    return () => {
      isMounted = false;
      if (locationSub.current) locationSub.current.remove();
      if (accelSub.current) accelSub.current.remove();
      if (gyroSub.current) gyroSub.current.remove();
    };
  }, [isTracking, updateGps, updateAccel, updateGyro]);
}

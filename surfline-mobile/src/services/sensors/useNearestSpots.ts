import { useState, useEffect } from 'react';
import * as Location from 'expo-location';
import { Barometer } from 'expo-sensors';
import { SPOTS, Spot } from '../../data/spotsData';
import { haversineDistance } from '../../core/physics/haversine';

export { haversineDistance };

export interface SpotWithDistance extends Spot {
  distanceKm: number;
}

export function useNearestSpots() {
  const [spots, setSpots] = useState<SpotWithDistance[]>(() =>
    SPOTS.map((s) => ({ ...s, distanceKm: 0 }))
  );
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [pressureHpa, setPressureHpa] = useState<number | null>(null);
  const [hasLocationPermission, setHasLocationPermission] = useState(false);

  useEffect(() => {
    let isMounted = true;

    // 1. Obtener ubicación GPS del usuario
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;

        if (isMounted) setHasLocationPermission(true);

        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        if (!isMounted) return;

        const { latitude, longitude } = loc.coords;
        setUserLocation({ lat: latitude, lon: longitude });

        // Ordenar spots por cercanía física real
        const sorted = SPOTS.map((spot) => ({
          ...spot,
          distanceKm: haversineDistance(latitude, longitude, spot.lat, spot.lon),
        })).sort((a, b) => a.distanceKm - b.distanceKm);

        setSpots(sorted);
      } catch (err) {
        // En simulador o sin GPS, mantener orden por defecto (Planetario primero)
      }
    })();

    // 2. Telemetría barométrica física para anticipar cambios de viento
    let subBarometer: any;
    (async () => {
      try {
        const isAvailable = await Barometer.isAvailableAsync();
        if (isAvailable && isMounted) {
          subBarometer = Barometer.addListener(({ pressure }) => {
            if (isMounted) setPressureHpa(Number(pressure.toFixed(1)));
          });
        }
      } catch {}
    })();

    return () => {
      isMounted = false;
      subBarometer?.remove?.();
    };
  }, []);

  return {
    spots,
    userLocation,
    pressureHpa,
    hasLocationPermission,
  };
}

/**
 * useWatchSessionReceiver.ts
 * Simula la recepción de datos biométricos desde el Apple Watch via WCSession.
 * En producción real se conectaría a WatchConnectivity de iOS via un módulo nativo.
 * Durante tracking activo, envía una actualización biométrica cada 5 segundos.
 */

import { useEffect, useRef } from 'react';
import { useSessionStore } from '../../store/useSessionStore';

export function useWatchSessionReceiver() {
  // Referencia al intervalo para limpieza en desmontaje
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isTracking = useSessionStore((state) => state.isTracking);
  const updateBiometrics = useSessionStore((state) => state.updateBiometrics);

  useEffect(() => {
    // Solo activa la simulación si hay sesión activa
    if (!isTracking) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Genera biométricos simulados realistas para una sesión de surf
    const simulate = () => {
      // Ritmo cardíaco: surf intenso oscila entre 110 y 175 bpm
      const heartRate = Math.round(110 + Math.random() * 65);

      // SpO2: normalmente 97-100% en agua
      const oxygenSaturation = Math.round(97 + Math.random() * 3);

      // Calorías activas: incremento de ~6-10 cal/min en surf moderado
      const activeCalories = Math.round(6 + Math.random() * 4);

      updateBiometrics({ heartRate, oxygenSaturation, activeCalories });
    };

    // Primera lectura inmediata al iniciar
    simulate();

    // Actualización periódica cada 5 segundos (igual que WCSession en Watch real)
    intervalRef.current = setInterval(simulate, 5000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isTracking, updateBiometrics]);
}

import { create } from 'zustand';
import { GpsPoint, SurfSession, TrackerStatus, TurnDetail, WaveRide } from '../core/surfTracker/sessionTypes';
import { SurfTrackerEngine } from '../core/surfTracker/surfTrackerEngine';
import { getStorage } from '../services/storage/storageAdapter';

interface SessionStoreState {
  isTracking: boolean;
  activeSession: SurfSession | null;
  pastSessions: SurfSession[];
  currentStatus: TrackerStatus;
  lastWave: WaveRide | null;
  lastTurn: TurnDetail | null;

  startSession: (spotId: string, spotName: string) => void;
  stopSession: () => SurfSession | null;
  updateGps: (point: GpsPoint) => void;
  updateGyro: (rotationRateZ: number, dtSeconds: number, timestamp: number) => void;
  updateAccel: (x: number, y: number, z: number, timestamp: number) => void;
  updateBiometrics: (metrics: {
    heartRate?: number;
    oxygenSaturation?: number;
    activeCalories?: number;
  }) => void;
  loadPastSessions: () => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
}

const SESSIONS_STORAGE_KEY = 'meteosurf_past_sessions';

// Instancia única del motor cinemático
const trackerEngine = new SurfTrackerEngine();

export const useSessionStore = create<SessionStoreState>((set, get) => {
  // Configurar callbacks del motor
  trackerEngine.setCallbacks({
    onStatusChanged: (status) => {
      set({ currentStatus: status });
    },
    onWaveStarted: () => {
      const s = trackerEngine.getSession();
      if (s) set({ activeSession: { ...s }, currentStatus: 'riding_wave' });
    },
    onWaveEnded: (wave) => {
      const s = trackerEngine.getSession();
      if (s) set({ activeSession: { ...s }, lastWave: wave, currentStatus: 'waiting' });
    },
    onTurnDetected: (turn) => {
      set({ lastTurn: turn });
    },
    onStrokeDetected: () => {
      const s = trackerEngine.getSession();
      if (s) set({ activeSession: { ...s } });
    },
  });

  return {
    isTracking: false,
    activeSession: null,
    pastSessions: [],
    currentStatus: 'idle',
    lastWave: null,
    lastTurn: null,

    startSession: (spotId, spotName) => {
      const newSession = trackerEngine.startSession(spotId, spotName);
      set({
        isTracking: true,
        activeSession: { ...newSession },
        currentStatus: 'waiting',
        lastWave: null,
        lastTurn: null,
      });
    },

    stopSession: () => {
      const finished = trackerEngine.stopSession();
      if (finished) {
        set((state) => ({
          isTracking: false,
          activeSession: null,
          currentStatus: 'idle',
          pastSessions: [finished, ...state.pastSessions],
        }));

        // Persistir en almacenamiento seguro local
        const updated = [finished, ...get().pastSessions];
        getStorage().set(SESSIONS_STORAGE_KEY, JSON.stringify(updated)).catch(() => {});
      } else {
        set({ isTracking: false, activeSession: null, currentStatus: 'idle' });
      }
      return finished;
    },

    updateGps: (point) => {
      if (!get().isTracking) return;
      trackerEngine.processGps(point);
      const s = trackerEngine.getSession();
      if (s) set({ activeSession: { ...s } });
    },

    updateGyro: (rotationRateZ, dtSeconds, timestamp) => {
      if (!get().isTracking) return;
      trackerEngine.processGyro(rotationRateZ, dtSeconds, timestamp);
    },

    updateAccel: (x, y, z, timestamp) => {
      if (!get().isTracking) return;
      trackerEngine.processAccel(x, y, z, timestamp);
    },

    updateBiometrics: (metrics) => {
      if (!get().isTracking) return;
      trackerEngine.updateBiometrics(metrics);
      const s = trackerEngine.getSession();
      if (s) set({ activeSession: { ...s } });
    },

    loadPastSessions: async () => {
      try {
        const raw = await getStorage().get(SESSIONS_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            set({ pastSessions: parsed });
          }
        }
      } catch (err) {
        console.warn('Error cargando sesiones previas:', err);
      }
    },

    deleteSession: async (id: string) => {
      const filtered = get().pastSessions.filter((s) => s.id !== id);
      set({ pastSessions: filtered });
      try {
        await getStorage().set(SESSIONS_STORAGE_KEY, JSON.stringify(filtered));
      } catch (err) {
        console.warn('Error guardando sesiones tras borrar:', err);
      }
    },
  };
});

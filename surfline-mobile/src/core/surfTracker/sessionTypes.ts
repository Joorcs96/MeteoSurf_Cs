export interface GpsPoint {
  latitude: number;
  longitude: number;
  speed: number; // m/s
  speedKmH: number; // km/h
  altitude?: number;
  heading?: number; // degrees (0-360)
  timestamp: number;
}

export interface TurnDetail {
  angleDeg: number;
  type: 'bottom_turn' | 'cutback' | 'snap' | 'carve';
  timestamp: number;
}

export interface WaveRide {
  id: string;
  waveNumber: number;
  startTime: number;
  endTime: number;
  durationSeconds: number;
  distanceMeters: number;
  topSpeedKmH: number;
  avgSpeedKmH: number;
  turnsCount: number;
  turns: TurnDetail[];
  gpsPath: GpsPoint[];
}

export interface BiometricMetrics {
  currentHeartRate: number; // bpm
  avgHeartRate: number;
  maxHeartRate: number;
  oxygenSaturation?: number; // % (SpO2)
  activeCalories: number; // kcal
}

export type TrackerStatus = 'idle' | 'paddling' | 'waiting' | 'riding_wave';

export interface SurfSession {
  id: string;
  spotId: string;
  spotName: string;
  startTime: number;
  endTime?: number;
  durationSeconds: number;
  totalDistanceMeters: number;
  totalWaves: number;
  paddlingStrokes: number;
  topSpeedKmH: number;
  avgSpeedKmH: number;
  biometrics: BiometricMetrics;
  waveRides: WaveRide[];
  gpsTrack: GpsPoint[];
  status: TrackerStatus;
}

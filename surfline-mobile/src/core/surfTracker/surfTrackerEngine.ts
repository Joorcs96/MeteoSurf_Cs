import { GpsPoint, SurfSession, TrackerStatus, TurnDetail, WaveRide } from './sessionTypes';
import { WaveDetector } from './waveDetector';
import { TurnDetector } from './turnDetector';
import { PaddleDetector } from './paddleDetector';
import { haversineDistanceMeters } from '../physics/haversine';

export interface TrackerCallbacks {
  onWaveStarted?: () => void;
  onWaveEnded?: (wave: WaveRide) => void;
  onTurnDetected?: (turn: TurnDetail) => void;
  onStrokeDetected?: (totalStrokes: number) => void;
  onStatusChanged?: (status: TrackerStatus) => void;
}

export class SurfTrackerEngine {
  private waveDetector = new WaveDetector();
  private turnDetector = new TurnDetector();
  private paddleDetector = new PaddleDetector();

  private session: SurfSession | null = null;
  private isTracking: boolean = false;
  private callbacks: TrackerCallbacks = {};

  private heartRateSamples: number[] = [];
  private lastPoint: GpsPoint | null = null;

  constructor(callbacks?: TrackerCallbacks) {
    if (callbacks) this.callbacks = callbacks;
  }

  public setCallbacks(callbacks: TrackerCallbacks): void {
    this.callbacks = callbacks;
  }

  public startSession(spotId: string, spotName: string): SurfSession {
    const now = Date.now();
    this.isTracking = true;
    this.waveDetector.reset();
    this.turnDetector.reset();
    this.paddleDetector.reset();
    this.heartRateSamples = [];
    this.lastPoint = null;

    this.session = {
      id: `session_${now}`,
      spotId,
      spotName,
      startTime: now,
      durationSeconds: 0,
      totalDistanceMeters: 0,
      totalWaves: 0,
      paddlingStrokes: 0,
      topSpeedKmH: 0,
      avgSpeedKmH: 0,
      biometrics: {
        currentHeartRate: 0,
        avgHeartRate: 0,
        maxHeartRate: 0,
        activeCalories: 0,
      },
      waveRides: [],
      gpsTrack: [],
      status: 'waiting',
    };

    this.callbacks.onStatusChanged?.('waiting');
    return this.session;
  }

  public stopSession(): SurfSession | null {
    if (!this.session || !this.isTracking) return null;

    const now = Date.now();
    const effectiveEndTime =
      this.lastPoint && this.lastPoint.timestamp > this.session.startTime
        ? this.lastPoint.timestamp
        : now;

    // Si estaba en medio de una ola, cerrarla
    const waveEnd = this.waveDetector.forceEnd(effectiveEndTime);
    if (waveEnd.event === 'wave_ended' && waveEnd.wave) {
      this.session.waveRides.push(waveEnd.wave);
      this.session.totalWaves = this.session.waveRides.length;
    }

    this.session.endTime = effectiveEndTime;
    this.session.durationSeconds = Math.max(
      1,
      Math.round((effectiveEndTime - this.session.startTime) / 1000)
    );
    this.session.status = 'idle';
    this.isTracking = false;

    this.callbacks.onStatusChanged?.('idle');
    return { ...this.session };
  }

  public getSession(): SurfSession | null {
    return this.session;
  }

  public processGps(point: GpsPoint): void {
    if (!this.session || !this.isTracking) return;

    this.session.gpsTrack.push(point);

    // Actualizar distancia acumulada
    if (this.lastPoint) {
      const distM = haversineDistanceMeters(
        this.lastPoint.latitude,
        this.lastPoint.longitude,
        point.latitude,
        point.longitude
      );
      this.session.totalDistanceMeters += Math.round(distM);
    }
    this.lastPoint = point;

    // Actualizar velocidad máxima global
    if (point.speedKmH > this.session.topSpeedKmH) {
      this.session.topSpeedKmH = Math.round(point.speedKmH * 10) / 10;
    }

    // Actualizar duración transcurrida
    this.session.durationSeconds = Math.round((point.timestamp - this.session.startTime) / 1000);

    // Calcular velocidad media
    if (this.session.durationSeconds > 0) {
      const avgMPerS = this.session.totalDistanceMeters / this.session.durationSeconds;
      this.session.avgSpeedKmH = Math.round(avgMPerS * 3.6 * 10) / 10;
    }

    // Procesar detección de olas
    const waveResult = this.waveDetector.processGpsPoint(point);

    if (waveResult.event === 'wave_started') {
      this.session.status = 'riding_wave';
      this.callbacks.onStatusChanged?.('riding_wave');
      this.callbacks.onWaveStarted?.();
    } else if (waveResult.event === 'wave_ended' && waveResult.wave) {
      this.session.waveRides.push(waveResult.wave);
      this.session.totalWaves = this.session.waveRides.length;
      this.session.status = 'waiting';
      this.callbacks.onStatusChanged?.('waiting');
      this.callbacks.onWaveEnded?.(waveResult.wave);
    }

    // Si no está en ola, actualizar estado entre remando o esperando
    if (!this.waveDetector.isRidingWave()) {
      const newStatus: TrackerStatus = point.speedKmH > 2.5 ? 'paddling' : 'waiting';
      if (newStatus !== this.session.status) {
        this.session.status = newStatus;
        this.callbacks.onStatusChanged?.(newStatus);
      }
    }

    // Giro por rumbo GPS si estamos en ola
    if (this.waveDetector.isRidingWave() && point.heading !== undefined) {
      const turn = this.turnDetector.processHeading(point.heading, point.timestamp);
      if (turn) {
        this.waveDetector.registerTurn(turn);
        this.callbacks.onTurnDetected?.(turn);
      }
    }
  }

  public processGyro(rotationRateZ: number, dtSeconds: number, timestamp: number): void {
    if (!this.session || !this.isTracking) return;

    if (this.waveDetector.isRidingWave()) {
      const turn = this.turnDetector.processGyro(rotationRateZ, dtSeconds, timestamp);
      if (turn) {
        this.waveDetector.registerTurn(turn);
        this.callbacks.onTurnDetected?.(turn);
      }
    }
  }

  public processAccel(accelX: number, accelY: number, accelZ: number, timestamp: number): void {
    if (!this.session || !this.isTracking) return;

    const currentSpeed = this.lastPoint ? this.lastPoint.speedKmH : 0;
    const strokeDetected = this.paddleDetector.processAccel(
      accelX,
      accelY,
      accelZ,
      currentSpeed,
      timestamp
    );

    if (strokeDetected) {
      this.session.paddlingStrokes = this.paddleDetector.getStrokes();
      this.callbacks.onStrokeDetected?.(this.session.paddlingStrokes);
    }
  }

  public updateBiometrics(metrics: {
    heartRate?: number;
    oxygenSaturation?: number;
    activeCalories?: number;
  }): void {
    if (!this.session || !this.isTracking) return;

    if (metrics.heartRate !== undefined && metrics.heartRate > 0) {
      this.session.biometrics.currentHeartRate = Math.round(metrics.heartRate);
      this.heartRateSamples.push(metrics.heartRate);

      if (metrics.heartRate > this.session.biometrics.maxHeartRate) {
        this.session.biometrics.maxHeartRate = Math.round(metrics.heartRate);
      }

      const sum = this.heartRateSamples.reduce((a, b) => a + b, 0);
      this.session.biometrics.avgHeartRate = Math.round(sum / this.heartRateSamples.length);
    }

    if (metrics.oxygenSaturation !== undefined) {
      this.session.biometrics.oxygenSaturation = Math.round(metrics.oxygenSaturation * 10) / 10;
    }

    if (metrics.activeCalories !== undefined) {
      this.session.biometrics.activeCalories = Math.round(metrics.activeCalories);
    }
  }
}

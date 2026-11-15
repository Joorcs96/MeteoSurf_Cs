import { GpsPoint, WaveRide, TurnDetail } from './sessionTypes';
import { haversineDistanceMeters } from '../physics/haversine';

export class WaveDetector {
  private inWave: boolean = false;
  private wavePoints: GpsPoint[] = [];
  private waveStartTime: number = 0;
  private lowSpeedStartTime: number = 0;
  private waveCount: number = 0;
  private currentTurns: TurnDetail[] = [];

  // Parámetros calibrados para el Mediterráneo
  public readonly WAVE_START_SPEED_KMH = 11.0; // Velocidad para entrar en planeo de ola
  public readonly WAVE_END_SPEED_KMH = 6.0;   // Caída de velocidad fin de ola
  public readonly MIN_WAVE_DURATION_S = 2.8;   // Mínimo tiempo para descartar tirones de remada
  public readonly MIN_WAVE_DISTANCE_M = 7.5;   // Mínima distancia recorrida
  public readonly LOW_SPEED_TOLERANCE_MS = 2200; // Margen para cortes de velocidad por sección lenta

  public reset(): void {
    this.inWave = false;
    this.wavePoints = [];
    this.waveStartTime = 0;
    this.lowSpeedStartTime = 0;
    this.waveCount = 0;
    this.currentTurns = [];
  }

  public registerTurn(turn: TurnDetail): void {
    if (this.inWave) {
      this.currentTurns.push(turn);
    }
  }

  public isRidingWave(): boolean {
    return this.inWave;
  }

  public processGpsPoint(point: GpsPoint): {
    event: 'none' | 'wave_started' | 'wave_ended';
    wave?: WaveRide;
  } {
    const speed = point.speedKmH;

    if (!this.inWave) {
      // Condición de inicio de ola: aceleración por encima del umbral de deslizamiento
      if (speed >= this.WAVE_START_SPEED_KMH) {
        this.inWave = true;
        this.waveStartTime = point.timestamp;
        this.wavePoints = [point];
        this.lowSpeedStartTime = 0;
        this.currentTurns = [];
        return { event: 'wave_started' };
      }
      return { event: 'none' };
    }

    // Ya estamos surfeando la ola
    this.wavePoints.push(point);

    if (speed < this.WAVE_END_SPEED_KMH) {
      if (this.lowSpeedStartTime === 0) {
        this.lowSpeedStartTime = point.timestamp;
      } else if (point.timestamp - this.lowSpeedStartTime >= this.LOW_SPEED_TOLERANCE_MS) {
        // La ola ha finalizado por pérdida sostenida de velocidad o caída (wipeout)
        return this.finishWave(point.timestamp);
      }
    } else {
      // Recupera velocidad (ej. tras superar una sección lenta o realizar un cutback)
      this.lowSpeedStartTime = 0;
    }

    return { event: 'none' };
  }

  public forceEnd(timestamp: number): { event: 'wave_ended'; wave?: WaveRide } | { event: 'none' } {
    if (this.inWave) {
      return this.finishWave(timestamp);
    }
    return { event: 'none' };
  }

  private finishWave(endTime: number): {
    event: 'wave_ended' | 'none';
    wave?: WaveRide;
  } {
    this.inWave = false;
    const durationS = Math.max(0, (endTime - this.waveStartTime) / 1000);

    // Calcular distancia total de la ola
    let distanceM = 0;
    let topSpeed = 0;
    let sumSpeed = 0;

    for (let i = 0; i < this.wavePoints.length; i++) {
      const p = this.wavePoints[i];
      if (p.speedKmH > topSpeed) topSpeed = p.speedKmH;
      sumSpeed += p.speedKmH;

      if (i > 0) {
        const prev = this.wavePoints[i - 1];
        const distM = haversineDistanceMeters(prev.latitude, prev.longitude, p.latitude, p.longitude);
        distanceM += distM;
      }
    }

    const avgSpeed = this.wavePoints.length > 0 ? sumSpeed / this.wavePoints.length : 0;

    // Filtro de ruido: descartar falsos positivos (remadas cortas de aproximación)
    if (durationS < this.MIN_WAVE_DURATION_S || distanceM < this.MIN_WAVE_DISTANCE_M) {
      this.wavePoints = [];
      this.currentTurns = [];
      return { event: 'none' };
    }

    this.waveCount++;
    const completedWave: WaveRide = {
      id: `wave_${this.waveStartTime}_${this.waveCount}`,
      waveNumber: this.waveCount,
      startTime: this.waveStartTime,
      endTime: endTime,
      durationSeconds: Math.round(durationS * 10) / 10,
      distanceMeters: Math.round(distanceM),
      topSpeedKmH: Math.round(topSpeed * 10) / 10,
      avgSpeedKmH: Math.round(avgSpeed * 10) / 10,
      turnsCount: this.currentTurns.length,
      turns: [...this.currentTurns],
      gpsPath: [...this.wavePoints],
    };

    this.wavePoints = [];
    this.currentTurns = [];
    return { event: 'wave_ended', wave: completedWave };
  }
}

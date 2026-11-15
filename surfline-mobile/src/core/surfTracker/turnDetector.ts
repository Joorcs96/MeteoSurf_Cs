import { TurnDetail } from './sessionTypes';

export class TurnDetector {
  private isTurning: boolean = false;
  private accumulatedAngleDeg: number = 0;
  private turnStartTimestamp: number = 0;
  private lastHeadingDeg: number | null = null;
  private maxAngularVelocity: number = 0;

  // Umbrales cinemáticos de surf
  private readonly MIN_TURN_ANGLE_DEG = 40; // Ángulo mínimo para contar como maniobra
  private readonly SNAP_THRESHOLD_DEG = 85;
  private readonly CUTBACK_THRESHOLD_DEG = 70;

  public reset(): void {
    this.isTurning = false;
    this.accumulatedAngleDeg = 0;
    this.turnStartTimestamp = 0;
    this.lastHeadingDeg = null;
    this.maxAngularVelocity = 0;
  }

  /**
   * Procesa la lectura del giroscopio (z en rad/s) o cambio de rumbo
   * @param rotationRateZRadS Velocidad angular del giroscopio en rad/s
   * @param dtSeconds Intervalo de tiempo entre muestras (ej. 0.04s para 25Hz)
   * @param timestamp Marca de tiempo en ms
   */
  public processGyro(
    rotationRateZRadS: number,
    dtSeconds: number,
    timestamp: number
  ): TurnDetail | null {
    const degPerSec = Math.abs(rotationRateZRadS * (180 / Math.PI));

    // Si la velocidad angular supera 35°/s, el surfista está iniciando un viraje
    if (degPerSec > 35) {
      if (!this.isTurning) {
        this.isTurning = true;
        this.accumulatedAngleDeg = 0;
        this.turnStartTimestamp = timestamp;
        this.maxAngularVelocity = degPerSec;
      }
      this.accumulatedAngleDeg += degPerSec * dtSeconds;
      if (degPerSec > this.maxAngularVelocity) {
        this.maxAngularVelocity = degPerSec;
      }
    } else if (this.isTurning) {
      // El giro ha concluido al reducir la rotación
      const finishedTurn = this.evaluateTurn(timestamp);
      this.isTurning = false;
      this.accumulatedAngleDeg = 0;
      this.maxAngularVelocity = 0;
      return finishedTurn;
    }

    return null;
  }

  /**
   * Respaldo usando cambio de rumbo GPS si el giroscopio no está disponible
   */
  public processHeading(headingDeg: number, timestamp: number): TurnDetail | null {
    if (this.lastHeadingDeg === null) {
      this.lastHeadingDeg = headingDeg;
      return null;
    }

    // Diferencia angular en el círculo de 0 a 360°
    let diff = Math.abs(headingDeg - this.lastHeadingDeg);
    if (diff > 180) diff = 360 - diff;

    this.lastHeadingDeg = headingDeg;

    if (diff > 15) { // Cambio apreciable en un intervalo GPS (~1s)
      if (!this.isTurning) {
        this.isTurning = true;
        this.accumulatedAngleDeg = diff;
        this.turnStartTimestamp = timestamp;
      } else {
        this.accumulatedAngleDeg += diff;
      }
    } else if (this.isTurning) {
      const finishedTurn = this.evaluateTurn(timestamp);
      this.isTurning = false;
      this.accumulatedAngleDeg = 0;
      return finishedTurn;
    }

    return null;
  }

  private evaluateTurn(timestamp: number): TurnDetail | null {
    const angle = Math.round(this.accumulatedAngleDeg);
    if (angle < this.MIN_TURN_ANGLE_DEG) {
      return null;
    }

    let type: TurnDetail['type'] = 'carve';
    if (angle >= this.SNAP_THRESHOLD_DEG && this.maxAngularVelocity > 90) {
      type = 'snap';
    } else if (angle >= this.CUTBACK_THRESHOLD_DEG) {
      type = 'cutback';
    } else if (angle >= this.MIN_TURN_ANGLE_DEG) {
      type = 'bottom_turn';
    }

    return {
      angleDeg: angle,
      type: type,
      timestamp: this.turnStartTimestamp || timestamp,
    };
  }
}

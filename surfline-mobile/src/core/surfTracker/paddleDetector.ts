export class PaddleDetector {
  private strokeCount: number = 0;
  private lastPeakTime: number = 0;
  private lastValleyTime: number = 0;
  private isArmedForPeak: boolean = true;
  private lastAccelMagnitude: number = 0;

  // Umbrales para la cadencia de brazada de surf
  private readonly MIN_STROKE_INTERVAL_MS = 550;  // Máximo ~109 brazadas/minuto
  private readonly MAX_STROKE_INTERVAL_MS = 2200; // Mínimo ~27 brazadas/minuto
  private readonly ACCEL_PEAK_THRESHOLD_G = 0.32; // Aceleración mínima de la palada
  private readonly MAX_PADDLE_SPEED_KMH = 8.5;    // Por encima de esta velocidad no es remada, es planeo/ola

  public reset(): void {
    this.strokeCount = 0;
    this.lastPeakTime = 0;
    this.lastValleyTime = 0;
    this.isArmedForPeak = true;
    this.lastAccelMagnitude = 0;
  }

  public getStrokes(): number {
    return this.strokeCount;
  }

  /**
   * Procesa la aceleración del acelerómetro (en unidades 'g' o m/s^2 normalizadas)
   * @param accelX Aceleración lateral
   * @param accelY Aceleración longitudinal (dirección del brazo)
   * @param accelZ Aceleración vertical
   * @param currentSpeedKmH Velocidad actual del surfista
   * @param timestamp Marca de tiempo en ms
   */
  public processAccel(
    accelX: number,
    accelY: number,
    accelZ: number,
    currentSpeedKmH: number,
    timestamp: number
  ): boolean {
    // Si la velocidad supera la velocidad máxima de remada, el surfista va en ola
    if (currentSpeedKmH > this.MAX_PADDLE_SPEED_KMH) {
      return false;
    }

    // Amplitud de aceleración dinámica en el plano de avance del brazo
    const forwardArmAccel = Math.hypot(accelX, accelY);

    if (this.isArmedForPeak) {
      if (forwardArmAccel > this.ACCEL_PEAK_THRESHOLD_G) {
        const interval = timestamp - this.lastPeakTime;
        if (interval >= this.MIN_STROKE_INTERVAL_MS && interval <= this.MAX_STROKE_INTERVAL_MS) {
          this.strokeCount++;
          this.lastPeakTime = timestamp;
          this.isArmedForPeak = false;
          return true;
        } else if (interval > this.MAX_STROKE_INTERVAL_MS) {
          // Primera remada tras un descanso sentado en el pico
          this.strokeCount++;
          this.lastPeakTime = timestamp;
          this.isArmedForPeak = false;
          return true;
        }
      }
    } else {
      // Re-armar el detector cuando el brazo retorna (aceleración baja)
      if (forwardArmAccel < this.ACCEL_PEAK_THRESHOLD_G * 0.45) {
        this.isArmedForPeak = true;
        this.lastValleyTime = timestamp;
      }
    }

    this.lastAccelMagnitude = forwardArmAccel;
    return false;
  }
}

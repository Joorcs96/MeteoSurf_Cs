/**
 * breakerHeight.ts — Cálculo de altura en rompiente y exposición del spot.
 * Fórmula Komar & Gaudet: Hb = 0.39 · g^0.2 · (T · H²)^0.4
 */

export function breakingHeight(h: number, t: number): number {
  if (!h || !t || h <= 0 || t <= 0) return 0;
  return 0.39 * Math.pow(9.81, 0.2) * Math.pow(t * h * h, 0.4);
}

/**
 * Normaliza un ángulo en grados al rango [0, 360).
 */
export function norm360(deg: number): number {
  let d = deg % 360;
  if (d < 0) d += 360;
  return d;
}

/**
 * Calcula la diferencia angular mínima entre dos rumbos (0 a 180°).
 */
export function angDiff(a: number, b: number): number {
  const d = Math.abs(norm360(a) - norm360(b));
  return d > 180 ? 360 - d : d;
}

/**
 * Comprueba si una dirección cae dentro de una ventana angular en sentido horario.
 */
export function inWindow(dir: number, window: [number, number]): boolean {
  const [from, to] = window;
  const d = norm360(dir);
  const f = norm360(from);
  const t = norm360(to);
  if (f <= t) return d >= f && d <= t;
  return d >= f || d <= t;
}

/**
 * Factor de exposición de un tren de olas para un spot según su orientación (facing).
 */
export function exposureFactor(facing: number, swellWindow: [number, number], swellDir: number): number {
  if (swellDir == null) return 0;
  if (!inWindow(swellDir, swellWindow)) return 0.08;
  const d = angDiff(swellDir, facing);
  return Math.max(0.15, Math.pow(Math.cos((Math.min(d, 85) * Math.PI) / 180), 0.6));
}

export interface WaveTrain {
  h: number;
  t: number;
  dir: number;
}

export interface SurfHeight {
  min: number;
  max: number;
  mid: number;
}

/**
 * Calcula la altura en rompiente a partir de la suma energética de los trenes de ola.
 */
export function calculateSurfFromTrains(
  facing: number,
  swellWindow: [number, number],
  exposure: number,
  trains: WaveTrain[]
): SurfHeight {
  let e = 0;
  for (const tr of trains) {
    if (!tr.h || tr.h <= 0) continue;
    const exp = exposureFactor(facing, swellWindow, tr.dir);
    const hb = breakingHeight(tr.h, tr.t) * exp * exposure;
    e += hb * hb;
  }
  const hb = Math.sqrt(e);
  return {
    min: Number((hb * 0.75).toFixed(2)),
    max: Number((hb * 1.15).toFixed(2)),
    mid: Number(hb.toFixed(2)),
  };
}

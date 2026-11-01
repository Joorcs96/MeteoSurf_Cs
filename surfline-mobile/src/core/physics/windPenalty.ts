import { norm360, angDiff, inWindow } from './breakerHeight';

export interface WindState {
  key: 'glassy' | 'offshore' | 'crossoff' | 'cross' | 'crosson' | 'onshore' | 'na';
  label: string;
  effective: number | null;
}

/**
 * Calcula el viento efectivo considerando el efecto de las rachas.
 * Viento efectivo = max(media, 0.6 * racha)
 */
export function windEfectivo(speed?: number | null, gust?: number | null): number | null {
  const r = gust == null || isNaN(gust) ? 0 : gust * 0.6;
  if (speed == null || isNaN(speed)) {
    return gust == null || isNaN(gust) ? null : r;
  }
  return Math.max(speed, r);
}

/**
 * Aplica el factor de abrigo para spots protegidos del norte.
 */
export function vientoAbrigado(
  speed: number,
  dirFrom: number,
  gust?: number | null,
  windShelter?: { sector: [number, number]; factor: number }
): { speed: number; gust?: number | null } {
  if (!windShelter || dirFrom == null || isNaN(dirFrom) || !inWindow(dirFrom, windShelter.sector)) {
    return { speed, gust };
  }
  return {
    speed: speed * windShelter.factor,
    gust: gust != null ? gust * windShelter.factor : gust,
  };
}

/**
 * Determina el estado del viento para una playa según su orientación marítima.
 */
export function calculateWindState(
  facing: number,
  speed?: number | null,
  dirFrom?: number | null,
  gust?: number | null,
  windShelter?: { sector: [number, number]; factor: number }
): WindState {
  if (speed == null || dirFrom == null || isNaN(speed) || isNaN(dirFrom)) {
    return { key: 'na', label: '–', effective: null };
  }

  const abrigado = vientoAbrigado(speed, dirFrom, gust, windShelter);
  const v = windEfectivo(abrigado.speed, abrigado.gust) ?? 0;

  // Por debajo de 6 km/h el agua está lisa y limpia (glassy)
  if (v < 6) {
    return { key: 'glassy', label: 'Calma', effective: v };
  }

  const off = norm360(facing + 180);
  const d = angDiff(dirFrom, off);

  if (d <= 35) return { key: 'offshore', label: 'Terral', effective: v };
  if (d <= 70) return { key: 'crossoff', label: 'Terral cruzado', effective: v };
  if (d <= 110) return { key: 'cross', label: 'Cruzado', effective: v };
  if (d <= 145) return { key: 'crosson', label: 'Mar cruzado', effective: v };
  return { key: 'onshore', label: 'De mar', effective: v };
}

/**
 * swellDecomposition.ts — Cálculo de potencia y energía del oleaje (kW/m).
 * Fórmula: P = (ρ · g² / (64 · π)) · Hs² · Te ≈ 0.49 · Hs² · Tp
 */

export interface SwellEnergy {
  powerKwM: number;
  energyCategory: 'muy_baja' | 'baja' | 'moderada' | 'fuerte' | 'muy_fuerte';
  label: string;
}

export function calculateWavePower(hs: number, tp: number): SwellEnergy {
  if (!hs || !tp || hs <= 0 || tp <= 0) {
    return {
      powerKwM: 0,
      energyCategory: 'muy_baja',
      label: 'Sin energía',
    };
  }

  const power = 0.49 * hs * hs * tp;
  const rounded = Number(power.toFixed(1));

  let energyCategory: SwellEnergy['energyCategory'] = 'muy_baja';
  let label = 'Baja';

  if (rounded < 1.0) {
    energyCategory = 'muy_baja';
    label = 'Muy baja (<1 kW/m)';
  } else if (rounded < 3.0) {
    energyCategory = 'baja';
    label = 'Suave (1-3 kW/m)';
  } else if (rounded < 8.0) {
    energyCategory = 'moderada';
    label = 'Moderada (3-8 kW/m)';
  } else if (rounded < 18.0) {
    energyCategory = 'fuerte';
    label = 'Fuerte (8-18 kW/m)';
  } else {
    energyCategory = 'muy_fuerte';
    label = 'Muy potente (>18 kW/m)';
  }

  return {
    powerKwM: rounded,
    energyCategory,
    label,
  };
}

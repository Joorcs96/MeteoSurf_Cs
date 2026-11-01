import { WindState } from './windPenalty';
import { SurfHeight } from './breakerHeight';

export interface SpotRating {
  score: number; // 1 a 7
  stars: number; // 0 a 5 estrellas
  key: 'flat' | 'vpoor' | 'poor' | 'poorfair' | 'fair' | 'fairgood' | 'good' | 'epic';
  label: string;
  color: string;
}

export const RATINGS_META = [
  { key: 'flat', label: 'Plato', stars: 0, color: '#64748b' },
  { key: 'vpoor', label: 'Muy malo', stars: 1, color: '#ef4444' },
  { key: 'poor', label: 'Malo', stars: 1.5, color: '#f97316' },
  { key: 'poorfair', label: 'Malo-Regular', stars: 2, color: '#f59e0b' },
  { key: 'fair', label: 'Regular', stars: 3, color: '#eab308' },
  { key: 'fairgood', label: 'Regular-Bueno', stars: 3.5, color: '#84cc16' },
  { key: 'good', label: 'Bueno', stars: 4, color: '#10b981' },
  { key: 'epic', label: 'Épico', stars: 5, color: '#06b6d4' },
] as const;

export function rateWave(
  surf: SurfHeight,
  period: number,
  wind: WindState,
  speed?: number | null,
  gust?: number | null,
  maxGood?: number,
  abrigoBonus?: number,
  offshoreH?: number
): SpotRating {
  const h = surf.mid;
  if (h < 0.22) {
    return {
      score: 1,
      stars: 0,
      key: 'flat',
      label: 'Plato',
      color: '#64748b',
    };
  }

  // Base según altura en rompiente (escala mediterránea calibrada: 0.5-0.7m con terral ya es buen baño)
  let s = 1.0;
  if (h < 0.32) s = 1.0;
  else if (h < 0.40) s = 1.8;
  else if (h < 0.50) s = 3.2;
  else if (h < 0.60) s = 3.5;
  else if (h < 0.75) s = 3.9;
  else if (h < 0.95) s = 4.0;
  else if (h < 1.25) s = 4.8;
  else if (h < 1.60) s = 5.5;
  else s = 6.0;

  if (maxGood && h > maxGood) s -= 1.0;

  // Periodo (s) — en el Mediterráneo 4-6s es lo normal y no penaliza
  const p = period || 0;
  if (p < 4.0) s -= 1.2;
  else if (p >= 8.5) s += 0.9;
  else if (p >= 6.8) s += 0.5;

  // Viento y rachas
  const hasWind = wind && wind.key !== 'na' && speed != null && !isNaN(speed);
  if (hasWind) {
    const v = Math.max(0, speed);
    const g = gust != null && !isNaN(gust) ? Math.max(v, gust) : v;
    const eff = Math.max(v, g * 0.65);

    let wAdj = 0;
    switch (wind.key) {
      case 'glassy':
        wAdj = 0.3;
        break;
      case 'offshore':
        wAdj = eff < 14 ? 0.4 : eff < 22 ? 0.1 : eff < 32 ? -0.5 : -1.2;
        break;
      case 'crossoff':
        wAdj = eff < 12 ? 0.2 : eff < 20 ? -0.2 : eff < 30 ? -0.8 : -1.5;
        break;
      case 'cross':
        wAdj = eff < 8 ? 0 : eff < 15 ? -0.6 : eff < 24 ? -1.3 : -2.2;
        break;
      case 'crosson':
        wAdj = eff < 6 ? -0.2 : eff < 12 ? -0.8 : eff < 20 ? -1.7 : -2.6;
        break;
      case 'onshore':
        wAdj = eff < 6 ? -0.4 : eff < 12 ? -1.1 : eff < 20 ? -2.0 : -3.0;
        break;
    }

    let gustPenalty = 0;
    if (g >= 26) gustPenalty += g >= 40 ? 1.0 : g >= 30 ? 0.7 : 0.4;
    if (g >= 18 && g >= v * 1.8) gustPenalty += 0.4;
    if ((wind.key === 'onshore' || wind.key === 'crosson') && g >= 24) gustPenalty += 0.5;

    s += wAdj - gustPenalty;
  } else {
    if (s > 4.0) s = 4.0;
  }

  // Bonus de abrigo
  const abrigo = abrigoBonus && offshoreH && offshoreH >= 1.1 && p >= 4.5
    ? Math.min(abrigoBonus, offshoreH * 3)
    : 0;
  s += abrigo;

  // Techo duro por altura
  const limpio = wind && (wind.key === 'offshore' || wind.key === 'crossoff' || wind.key === 'glassy');
  let maxCap = 7;
  if (h < 0.35) maxCap = 1;
  else if (h < 0.40) maxCap = 2;
  else if (h < 0.65) maxCap = limpio ? 4 : 3;
  else if (h < 0.75) maxCap = limpio ? 5 : 4;
  else if (h < 1.05) maxCap = 5;
  else if (h < 1.40) maxCap = 6;

  if (abrigo > 0) maxCap = Math.min(7, maxCap + 2);

  let rounded = Math.round(s);
  if (rounded >= 7 && abrigo === 0) {
    if (!(h >= 1.40 && p >= 7.0 && limpio && (speed ?? 0) < 25)) {
      rounded = 6;
    }
  }

  rounded = Math.max(1, Math.min(7, Math.min(rounded, maxCap)));

  // Mapear a la escala visible
  const idx = rounded;
  const meta = RATINGS_META[idx] || RATINGS_META[0];

  return {
    score: rounded,
    stars: meta.stars,
    key: meta.key,
    label: meta.label,
    color: meta.color,
  };
}

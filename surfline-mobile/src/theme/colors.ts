/**
 * colors.ts — Paleta oficial de diseño de MeteoSurf_Cs
 * Extraída directamente de css/app.css para paridad visual 100% idéntica a la web.
 */

export const THEME = {
  // Fondos y superficies
  bg: '#151719',
  surface: '#151719',
  surface2: '#22262a',
  surface3: '#2a3036',
  
  // Textos
  text: '#f2f3f4',
  textSecondary: '#c4c9ce',
  textMuted: '#a9b1b9',
  textFaint: '#636c76',
  
  // Bordes y separadores
  line: '#363c42',
  lineSubtle: '#282d33',
  
  // Marca y acentos
  brand: '#f2f3f4',
  accent: '#38bdf8', // Azul cian Mediterráneo
  accentMuted: '#0284c7',
  danger: '#e11d48',
  
  // Escala de calidad de olas (Mediterráneo)
  ratings: {
    flat: '#c3cad3',     // 0: Plato
    vpoor: '#f4496d',    // 1: Muy malo
    poor: '#ff9500',     // 2: Malo
    poorfair: '#ffcd1e', // 3: Regular-bajo
    fair: '#0bd674',     // 4: Regular
    fairgood: '#009371', // 5: Bueno
    good: '#6851f4',     // 6: Muy bueno
    epic: '#5c00d0',     // 7: Épico
  },
  
  // Viento
  wind: {
    offshore: '#0bd674', // Terral
    onshore: '#f4496d',  // De mar
    cross: '#ff9500',    // Cruzado
    glassy: '#38bdf8',   // Calma
  }
} as const;

export function getRatingColor(stars: number): string {
  if (stars <= 0.2) return THEME.ratings.flat;
  if (stars < 1.5) return THEME.ratings.vpoor;
  if (stars < 2.5) return THEME.ratings.poor;
  if (stars < 3.5) return THEME.ratings.poorfair;
  if (stars < 4.5) return THEME.ratings.fair;
  if (stars < 5.5) return THEME.ratings.fairgood;
  if (stars < 6.5) return THEME.ratings.good;
  return THEME.ratings.epic;
}

export function getRatingLabel(stars: number): string {
  if (stars <= 0.2) return 'Plato';
  if (stars < 1.5) return 'Muy malo';
  if (stars < 2.5) return 'Malo';
  if (stars < 3.5) return 'Regular-bajo';
  if (stars < 4.5) return 'Regular';
  if (stars < 5.5) return 'Bueno';
  if (stars < 6.5) return 'Muy bueno';
  return 'Épico';
}

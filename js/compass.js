// compass.js — Rosa del spot: orientación de la playa, ventana de mar útil, ventana de terral,
// y flechas del mar de fondo y del viento actuales. Grados meteorológicos ("de dónde viene").
import { norm360 } from './forecast.js';

const pt = (cx, cy, r, deg) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
};
function sector(cx, cy, r0, r1, from, to) {
  let span = norm360(to - from);
  if (span === 0) span = 360;
  const large = span > 180 ? 1 : 0;
  const end = from + span;
  const [x0, y0] = pt(cx, cy, r1, from), [x1, y1] = pt(cx, cy, r1, end);
  const [x2, y2] = pt(cx, cy, r0, end), [x3, y3] = pt(cx, cy, r0, from);
  return `M${x0} ${y0} A${r1} ${r1} 0 ${large} 1 ${x1} ${y1} L${x2} ${y2} A${r0} ${r0} 0 ${large} 0 ${x3} ${y3} Z`;
}
// Flecha que entra desde el borde hacia el centro, apuntando a donde VA (dirección + 180)
function arrow(cx, cy, r, fromDeg, color, w = 4) {
  const [x0, y0] = pt(cx, cy, r, fromDeg);
  const [x1, y1] = pt(cx, cy, r * 0.28, fromDeg);
  const ang = fromDeg + 180;
  const [hx1, hy1] = pt(x1, y1, 9, ang + 150);
  const [hx2, hy2] = pt(x1, y1, 9, ang - 150);
  return `<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" stroke="${color}" stroke-width="${w}" stroke-linecap="round"/>` +
    `<path d="M${x1} ${y1} L${hx1} ${hy1} L${hx2} ${hy2} Z" fill="${color}"/>`;
}

// mini = true → versión para tarjeta (sin letras)
export function compassSVG(spot, { swellDir = null, windDir = null, mini = false } = {}) {
  const S = 200, c = S / 2, R = 92;
  const offshore = [norm360(spot.facing + 180 - 45), norm360(spot.facing + 180 + 45)];
  let s = `<svg viewBox="0 0 ${S} ${S}" role="img" aria-label="Orientación de ${spot.name}: mira al ${Math.round(spot.facing)}°">`;
  s += `<circle cx="${c}" cy="${c}" r="${R}" fill="var(--surface-2)" stroke="var(--line)" stroke-width="1"/>`;
  // Tierra: semicírculo opuesto a la cara de la playa
  s += `<path d="${sector(c, c, 0, R, spot.facing + 90, spot.facing + 270)}" fill="color-mix(in srgb, #b08850 22%, transparent)"/>`;
  // Ventana de mar útil
  s += `<path d="${sector(c, c, R * 0.55, R, spot.swellWindow[0], spot.swellWindow[1])}" fill="rgba(0,163,196,.38)"/>`;
  // Ventana de terral
  s += `<path d="${sector(c, c, R * 0.55, R, offshore[0], offshore[1])}" fill="rgba(31,196,124,.38)"/>`;
  // Línea de costa
  const [lx0, ly0] = pt(c, c, R, spot.facing - 90), [lx1, ly1] = pt(c, c, R, spot.facing + 90);
  s += `<line x1="${lx0}" y1="${ly0}" x2="${lx1}" y2="${ly1}" stroke="#c9a46a" stroke-width="3"/>`;
  if (!mini) {
    for (let d = 0; d < 360; d += 30) {
      const [a0, b0] = pt(c, c, R, d), [a1, b1] = pt(c, c, R - (d % 90 ? 5 : 9), d);
      s += `<line x1="${a0}" y1="${b0}" x2="${a1}" y2="${b1}" stroke="var(--text-3)" stroke-width="1.5"/>`;
    }
    [['N', 0], ['E', 90], ['S', 180], ['O', 270]].forEach(([t, d]) => {
      const [x, y] = pt(c, c, R - 18, d);
      s += `<text x="${x}" y="${y + 4}" text-anchor="middle" font-size="12" font-weight="800" fill="var(--text-2)">${t}</text>`;
    });
  }
  if (swellDir != null) s += arrow(c, c, R - 4, swellDir, '#314ee6', mini ? 9 : 5);
  if (windDir != null) s += arrow(c, c, R - 4, windDir, '#ff8a00', mini ? 7 : 3.5);
  s += `<circle cx="${c}" cy="${c}" r="${mini ? 5 : 4}" fill="#fff" stroke="var(--text-3)"/>`;
  return s + '</svg>';
}

// Flecha pequeña en línea (apunta hacia donde va el flujo)
export function dirArrow(fromDeg, size = 14) {
  if (fromDeg == null) return '';
  return `<svg class="arrow" width="${size}" height="${size}" viewBox="0 0 24 24" style="transform:rotate(${fromDeg + 180}deg)" aria-hidden="true">` +
    `<path d="M12 3 L18 15 L12 12 L6 15 Z" fill="currentColor"/></svg>`;
}

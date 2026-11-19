import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { THEME, getRatingColor, getRatingLabel } from '../../theme/colors';

interface RatingPillProps {
  rating: number; // 0 a 7 (escala de calidad mediterránea)
  showLabel?: boolean;
  style?: object;
}

// Convierte un color hex de THEME en rgba con la opacidad dada (para tintes sutiles)
function tint(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export const RatingPill: React.FC<RatingPillProps> = ({
  rating,
  showLabel = true,
  style,
}) => {
  const color = getRatingColor(rating);
  const label = getRatingLabel(rating);

  if (!showLabel) {
    // Variante compacta para tablas y filas: solo el punto de color
    return <View style={[styles.dotOnly, { backgroundColor: color }, style]} />;
  }

  return (
    <View
      style={[
        styles.pill,
        { backgroundColor: tint(color, 0.14), borderColor: tint(color, 0.45) },
        style,
      ]}
    >
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.label, { color }]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  dotOnly: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});

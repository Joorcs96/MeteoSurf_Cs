import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { THEME, getRatingColor, getRatingLabel } from '../../theme/colors';

interface RatingPillProps {
  rating: number; // 0 a 7 (o 0 a 5)
  showLabel?: boolean;
  style?: object;
}

export const RatingPill: React.FC<RatingPillProps> = ({
  rating,
  showLabel = true,
  style,
}) => {
  const color = getRatingColor(rating);
  const label = getRatingLabel(rating);

  return (
    <View style={[styles.pill, style]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      {showLabel && <Text style={styles.label}>{label}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  label: {
    color: THEME.text,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});

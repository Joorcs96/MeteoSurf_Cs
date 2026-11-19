import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { SPOTS, Spot } from '../../src/data/spotsData';
import { useSpotStore } from '../../src/store/useSpotStore';
import {
  generateOfflineForecast,
  fetchSpotForecast,
  SpotForecastResult,
  HourlyForecast,
} from '../../src/core/parsers/forecastParser';
import {
  getForecastFromCache,
  saveForecastToCache,
} from '../../src/services/storage/forecastCache';
import { RatingPill } from '../../src/components/ui/RatingPill';
import { THEME } from '../../src/theme/colors';

interface WeekDayForecast {
  offset: number;
  label: string;
  stars: number;
  color: string;
}

export default function ForecastsScreen() {
  const { selectedSpotId, selectSpot } = useSpotStore();
  const currentSpot: Spot = SPOTS.find((s) => s.id === selectedSpotId) || SPOTS[0];

  const [forecast, setForecast] = useState<SpotForecastResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [selectedDayOffset, setSelectedDayOffset] = useState(0);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    (async () => {
      let cached: SpotForecastResult | null = null;
      try {
        cached = await getForecastFromCache(currentSpot.id);
      } catch {
        cached = null;
      }
      if (cached && isMounted) {
        setForecast(cached);
        setLoading(false);
      }

      if (isOfflineMode) {
        if (isMounted) {
          setForecast(cached || generateOfflineForecast(currentSpot));
          setLoading(false);
        }
        return;
      }

      try {
        const fresh = await fetchSpotForecast(currentSpot);
        if (!isMounted) return;
        setForecast(fresh);
        setLoading(false);
        await saveForecastToCache(fresh);
      } catch {
        if (!isMounted) return;
        if (!cached) {
          setForecast(generateOfflineForecast(currentSpot));
        }
        setLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [currentSpot, isOfflineMode]);

  const toggleOffline = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsOfflineMode(!isOfflineMode);
  };

  const hoursForSelectedDay: HourlyForecast[] = (forecast?.hours || []).slice(
    selectedDayOffset * 24,
    (selectedDayOffset + 1) * 24
  );

  const bestHourData: HourlyForecast | undefined = hoursForSelectedDay.reduce<
    HourlyForecast | undefined
  >((best, h) => (!best || h.rating.stars > best.rating.stars ? h : best), undefined);

  const dayMaxStars = bestHourData?.rating.stars ?? 0;

  const weekDays: WeekDayForecast[] = Array.from({ length: 7 }, (_, offset) => {
    const dayHours = (forecast?.hours || []).slice(offset * 24, (offset + 1) * 24);
    const dayBest = dayHours.reduce<HourlyForecast | undefined>(
      (best, h) => (!best || h.rating.stars > best.rating.stars ? h : best),
      undefined
    );
    const maxStars = dayBest?.rating.stars ?? 0;
    const label = offset === 0 ? 'HOY' : `+${offset}`;
    const color = dayBest ? THEME.ratings[dayBest.rating.key] : THEME.ratings.flat;
    return { offset, label, stars: maxStars, color };
  });

  const heroHeightValue = bestHourData ? bestHourData.surfHeight.mid.toFixed(2) : '--';
  const heroPeriodValue = bestHourData ? bestHourData.period.toFixed(1) : '--';
  const heroSwellValue = bestHourData ? `${Math.round(bestHourData.waveDirection)}°` : '--';
  const heroEnergyValue = bestHourData ? bestHourData.energy.powerKwM.toFixed(1) : '--';

  const windColorFor = (key?: string): string => {
    switch (key) {
      case 'offshore':
        return THEME.wind.offshore;
      case 'onshore':
        return THEME.wind.onshore;
      case 'cross':
        return THEME.wind.cross;
      case 'crossoff':
        return THEME.wind.offshore;
      case 'crosson':
        return THEME.wind.cross;
      case 'glassy':
        return THEME.wind.glassy;
      default:
        return THEME.textMuted;
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingBox}>
          <ActivityIndicator size="small" color={THEME.accent} />
          <Text style={styles.loadingText}>Calculando física de rompiente...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Cabecera: nombre del spot + RatingPill grande */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.headerSpot}>
              <Text style={styles.headerSpotName}>{currentSpot.name}</Text>
              <Text style={styles.headerSpotZone}>{currentSpot.zoneName || currentSpot.zone}</Text>
            </View>
            <RatingPill rating={dayMaxStars} style={styles.bigRatingPill} />
          </View>
          <TouchableOpacity
            style={[styles.offlineBtn, isOfflineMode && styles.offlineBtnActive]}
            onPress={toggleOffline}
            activeOpacity={0.8}
          >
            <Text style={[styles.offlineBtnText, isOfflineMode && styles.offlineBtnTextActive]}>
              {isOfflineMode ? 'MODO PLAYA ACTIVO' : 'MODO PLAYA'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Selector horizontal de 7 días */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.daysScroll}
          contentContainerStyle={styles.daysContent}
        >
          {weekDays.map((d) => (
            <TouchableOpacity
              key={d.offset}
              style={[styles.dayPill, d.offset === selectedDayOffset && styles.dayPillActive]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSelectedDayOffset(d.offset);
              }}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.dayPillLabel,
                  d.offset === selectedDayOffset && styles.dayPillLabelActive,
                ]}
              >
                {d.label}
              </Text>
              <View style={styles.dayPillValue}>
                <View style={[styles.dayPillDot, { backgroundColor: d.color }]} />
                <Text style={[styles.dayPillScore, { color: d.color }]}>{d.stars}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Hero del día seleccionado */}
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View style={styles.heroHeightBox}>
              <Text style={styles.heroHeight}>{heroHeightValue}</Text>
              <Text style={styles.heroHeightUnit}>m</Text>
            </View>
            <View style={styles.heroMeta}>
              <View style={styles.heroMetaRow}>
                <Text style={styles.heroMetaKey}>PERIODO</Text>
                <Text style={styles.heroMetaVal}>{`${heroPeriodValue} s`}</Text>
              </View>
              <View style={styles.heroMetaRow}>
                <Text style={styles.heroMetaKey}>SWELL</Text>
                <Text style={styles.heroMetaVal}>{`${heroSwellValue}`}</Text>
              </View>
              <View style={styles.heroMetaRow}>
                <Text style={styles.heroMetaKey}>ENERGÍA</Text>
                <Text style={styles.heroMetaVal}>{`${heroEnergyValue} kW/m`}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Tabla horaria del día seleccionado */}
        <View style={styles.tableCard}>
          <View style={styles.tableHeader}>
            <Text style={[styles.colHeader, { width: 40 }]}>HORA</Text>
            <Text style={[styles.colHeader, { width: 56 }]}>ALTURA</Text>
            <Text style={[styles.colHeader, { width: 48 }]}>NOTA</Text>
            <Text style={[styles.colHeader, { width: 44 }]}>PER.</Text>
            <Text style={[styles.colHeader, { flex: 1 }]}>VIENTO</Text>
          </View>

          {hoursForSelectedDay.map((h, i) => {
            const timeLabel = h.time.includes('T')
              ? h.time.split('T')[1].slice(0, 5)
              : `${String(h.hour).padStart(2, '0')}:00`;
            const rowBackground = i % 2 === 1 ? THEME.surface2 : THEME.surface;
            return (
              <View key={i} style={[styles.tableRow, { backgroundColor: rowBackground }]}>
                <Text style={styles.colTime}>{timeLabel}</Text>
                <Text style={styles.colHeight}>{`${h.surfHeight.mid.toFixed(2)} m`}</Text>
                <View style={styles.colStars}>
                  <RatingPill rating={h.rating.stars} showLabel={false} />
                </View>
                <Text style={styles.colPeriod}>{`${h.period.toFixed(1)} s`}</Text>
                <Text style={[styles.colWind, { color: windColorFor(h.windState.key) }]}>
                  {`${h.windSpeed} km/h ${h.windState.label}`}
                </Text>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: THEME.bg,
  },
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
  },
  header: {
    backgroundColor: THEME.surface,
    borderWidth: 1,
    borderColor: THEME.line,
    borderRadius: 10,
    padding: 14,
    marginBottom: 14,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerSpot: {
    flex: 1,
    paddingRight: 12,
  },
  headerSpotName: {
    fontSize: 20,
    fontWeight: '800',
    color: THEME.text,
    letterSpacing: -0.4,
  },
  headerSpotZone: {
    fontSize: 11,
    color: THEME.textMuted,
    marginTop: 2,
  },
  bigRatingPill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: THEME.surface2,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: THEME.line,
  },
  offlineBtn: {
    marginTop: 12,
    alignSelf: 'flex-start',
    backgroundColor: THEME.surface2,
    borderWidth: 1,
    borderColor: THEME.line,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  offlineBtnActive: {
    backgroundColor: THEME.ratings.fair,
    borderColor: THEME.ratings.fair,
  },
  offlineBtnText: {
    color: THEME.textSecondary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  offlineBtnTextActive: {
    color: THEME.bg,
    fontWeight: '800',
  },
  daysScroll: {
    marginBottom: 16,
  },
  daysContent: {
    gap: 8,
  },
  dayPill: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: THEME.surface2,
    borderWidth: 1,
    borderColor: THEME.line,
    alignItems: 'center',
    minWidth: 62,
  },
  dayPillActive: {
    backgroundColor: THEME.text,
    borderColor: THEME.text,
  },
  dayPillLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: THEME.textSecondary,
    letterSpacing: 0.5,
  },
  dayPillLabelActive: {
    color: THEME.bg,
  },
  dayPillValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 6,
  },
  dayPillDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dayPillScore: {
    fontSize: 13,
    fontWeight: '800',
    color: THEME.text,
    fontVariant: ['tabular-nums'],
  },
  heroCard: {
    backgroundColor: THEME.surface,
    borderWidth: 1,
    borderColor: THEME.line,
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroHeightBox: {
    flex: 1,
  },
  heroHeight: {
    fontSize: 48,
    fontWeight: '800',
    color: THEME.text,
    letterSpacing: -1.5,
    fontVariant: ['tabular-nums'],
  },
  heroHeightUnit: {
    fontSize: 18,
    fontWeight: '600',
    color: THEME.textSecondary,
    marginLeft: 4,
  },
  heroMeta: {
    flex: 1,
    marginLeft: 12,
  },
  heroMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
  },
  heroMetaKey: {
    fontSize: 9,
    fontWeight: '800',
    color: THEME.textMuted,
    letterSpacing: 0.8,
  },
  heroMetaVal: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.text,
    fontVariant: ['tabular-nums'],
  },
  tableCard: {
    backgroundColor: THEME.surface,
    borderWidth: 1,
    borderColor: THEME.line,
    borderRadius: 10,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: THEME.surface2,
    borderBottomWidth: 1,
    borderBottomColor: THEME.line,
  },
  colHeader: {
    fontSize: 9,
    fontWeight: '800',
    color: THEME.textMuted,
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: THEME.lineSubtle,
  },
  colTime: {
    width: 40,
    fontSize: 12,
    fontWeight: '700',
    color: THEME.text,
    fontVariant: ['tabular-nums'],
  },
  colHeight: {
    width: 56,
    fontSize: 12,
    fontWeight: '700',
    color: THEME.text,
    fontVariant: ['tabular-nums'],
  },
  colStars: {
    width: 48,
    alignItems: 'center',
  },
  colPeriod: {
    width: 44,
    fontSize: 10,
    fontWeight: '700',
    color: THEME.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  colWind: {
    flex: 1,
    fontSize: 10,
    fontWeight: '700',
    color: THEME.textSecondary,
  },
  loadingBox: {
    flex: 1,
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: THEME.textMuted,
    fontSize: 12,
    marginTop: 10,
  },
});

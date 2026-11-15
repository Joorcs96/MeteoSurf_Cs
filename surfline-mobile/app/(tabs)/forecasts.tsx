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

  // Filtrar tramos de 24 horas por día
  const hoursForSelectedDay: HourlyForecast[] = (forecast?.hours || []).slice(
    selectedDayOffset * 24,
    (selectedDayOffset + 1) * 24
  );

  const bestHourData: HourlyForecast | undefined = hoursForSelectedDay.reduce<
    HourlyForecast | undefined
  >((best, h) => (!best || h.rating.stars > best.rating.stars ? h : best), undefined);

  const dayMaxStars = bestHourData?.rating.stars ?? 0;
  const dayMaxHeight = hoursForSelectedDay.reduce(
    (max, h) => Math.max(max, h.surfHeight.max),
    0
  );
  const isLiveData = forecast != null && !forecast.isOffline && !isOfflineMode;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Encabezado */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>PREVISIÓN DE OLAS</Text>
            <Text style={styles.subtitle}>Física costera · Modelo Mediterráneo</Text>
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

        {/* Selector horizontal de spots */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.pillsScroll}
          contentContainerStyle={styles.pillsContent}
        >
          {SPOTS.map((s) => {
            const isSelected = s.id === currentSpot.id;
            return (
              <TouchableOpacity
                key={s.id}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  selectSpot(s.id);
                }}
                style={[styles.pill, isSelected && styles.pillActive]}
                activeOpacity={0.7}
              >
                <Text style={[styles.pillText, isSelected && styles.pillTextActive]}>
                  {s.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color={THEME.accent} />
            <Text style={styles.loadingText}>Calculando física de rompiente...</Text>
          </View>
        ) : (
          <View>
            {/* Tarjeta de Resumen del Baño Óptimo */}
            <View style={styles.summaryCard}>
              <View style={styles.summaryTop}>
                <View>
                  <Text style={styles.summarySpot}>{currentSpot.name.toUpperCase()}</Text>
                  <Text style={styles.summaryZone}>{currentSpot.zoneName || currentSpot.zone}</Text>
                </View>
                <RatingPill rating={dayMaxStars} />
              </View>

              <View style={styles.summaryMainRow}>
                <View>
                  <Text style={styles.bestTimeTitle}>MEJOR FRANJA</Text>
                  <Text style={styles.bestTimeValue}>
                    {bestHourData != null
                      ? `${String(bestHourData.hour).padStart(2, '0')}:00 - ${String(
                          (bestHourData.hour + 3) % 24
                        ).padStart(2, '0')}:00 h`
                      : 'Sin datos'}
                  </Text>
                </View>
                <View style={styles.bestHeightBox}>
                  <Text style={styles.bestHeightVal}>
                    {hoursForSelectedDay.length > 0 ? `${dayMaxHeight.toFixed(2)} m` : '-- m'}
                  </Text>
                  <Text style={styles.bestHeightLabel}>Rompiente</Text>
                </View>
              </View>

              <View style={styles.conditionsPillRow}>
                <View style={styles.condPill}>
                  <Text style={styles.condPillText}>
                    {isLiveData ? 'Datos en vivo' : 'Modo playa (sin conexión)'}
                  </Text>
                </View>
                <View style={styles.condPill}>
                  <Text style={styles.condPillText}>
                    Viento: {bestHourData?.windState?.label || '--'} {bestHourData?.windSpeed ?? '--'} km/h
                  </Text>
                </View>
                <View style={styles.condPill}>
                  <Text style={styles.condPillText}>
                    Energía: {bestHourData?.energy?.powerKwM?.toFixed(1) ?? '--'} kW/m
                  </Text>
                </View>
                <View style={styles.condPill}>
                  <Text style={styles.condPillText}>
                    Periodo: {bestHourData?.period?.toFixed(1) ?? '--'} s
                  </Text>
                </View>
              </View>
            </View>

            {/* Selector de Días de Previsión */}
            <View style={styles.daysRow}>
              {['HOY', 'MAÑANA', 'DÍA 3', 'DÍA 4', 'DÍA 5', 'DÍA 6', 'DÍA 7'].map(
                (dayName, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={[
                      styles.dayBtn,
                      selectedDayOffset === idx && styles.dayBtnActive,
                    ]}
                    onPress={() => setSelectedDayOffset(idx)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.dayBtnText,
                        selectedDayOffset === idx && styles.dayBtnTextActive,
                      ]}
                    >
                      {dayName}
                    </Text>
                  </TouchableOpacity>
                )
              )}
            </View>

            {/* Tabla Horaria Desglosada */}
            <View style={styles.tableCard}>
              <View style={styles.tableHeader}>
                <Text style={[styles.colHeader, { width: 44 }]}>HORA</Text>
                <Text style={[styles.colHeader, { width: 68 }]}>ESTADO</Text>
                <Text style={[styles.colHeader, { width: 56 }]}>OLA</Text>
                <Text style={[styles.colHeader, { width: 48 }]}>PER.</Text>
                <Text style={[styles.colHeader, { flex: 1 }]}>VIENTO</Text>
              </View>

              {hoursForSelectedDay.map((h, i) => {
                const timeLabel = h.time.includes('T')
                  ? h.time.split('T')[1].slice(0, 5)
                  : `${String(h.hour).padStart(2, '0')}:00`;
                return (
                  <View key={i} style={[styles.tableRow, i % 2 === 1 && styles.tableRowEven]}>
                    <Text style={styles.colTime}>{timeLabel}</Text>
                    <View style={{ width: 68 }}>
                      <RatingPill rating={h.rating.stars} showLabel={false} />
                    </View>
                    <Text style={styles.colHeight}>{h.surfHeight.mid.toFixed(2)} m</Text>
                    <Text style={styles.colPeriod}>{h.period.toFixed(1)} s</Text>
                    <Text style={styles.colWind}>
                      {h.windSpeed} km/h {h.windState.label}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}
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
    paddingTop: 10,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: THEME.line,
    marginBottom: 12,
  },
  title: {
    color: THEME.brand,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  subtitle: {
    color: THEME.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  offlineBtn: {
    borderWidth: 1,
    borderColor: THEME.line,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
    backgroundColor: THEME.surface2,
  },
  offlineBtnActive: {
    backgroundColor: THEME.ratings.fair,
    borderColor: THEME.ratings.fair,
  },
  offlineBtnText: {
    color: THEME.textSecondary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  offlineBtnTextActive: {
    color: THEME.bg,
    fontWeight: '800',
  },
  pillsScroll: {
    marginBottom: 14,
  },
  pillsContent: {
    gap: 6,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    backgroundColor: THEME.surface2,
    borderWidth: 1,
    borderColor: THEME.line,
  },
  pillActive: {
    backgroundColor: THEME.text,
    borderColor: THEME.text,
  },
  pillText: {
    color: THEME.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  pillTextActive: {
    color: THEME.bg,
    fontWeight: '700',
  },
  loadingBox: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  loadingText: {
    color: THEME.textMuted,
    fontSize: 12,
    marginTop: 10,
  },
  summaryCard: {
    backgroundColor: THEME.surface,
    borderWidth: 1,
    borderColor: THEME.line,
    borderRadius: 6,
    padding: 16,
    marginBottom: 16,
  },
  summaryTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  summarySpot: {
    fontSize: 17,
    fontWeight: '800',
    color: THEME.text,
    letterSpacing: -0.3,
  },
  summaryZone: {
    fontSize: 11,
    color: THEME.textMuted,
    marginTop: 2,
  },
  summaryMainRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: THEME.lineSubtle,
  },
  bestTimeTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.textMuted,
    letterSpacing: 0.8,
  },
  bestTimeValue: {
    fontSize: 18,
    fontWeight: '800',
    color: THEME.text,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  bestHeightBox: {
    alignItems: 'flex-end',
  },
  bestHeightVal: {
    fontSize: 22,
    fontWeight: '800',
    color: THEME.accent,
    fontVariant: ['tabular-nums'],
  },
  bestHeightLabel: {
    fontSize: 10,
    color: THEME.textMuted,
  },
  conditionsPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  condPill: {
    backgroundColor: THEME.surface2,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: THEME.line,
  },
  condPillText: {
    fontSize: 10,
    color: THEME.textSecondary,
    fontWeight: '600',
  },
  daysRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
    overflow: 'hidden',
  },
  dayBtn: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    backgroundColor: THEME.surface2,
    borderWidth: 1,
    borderColor: THEME.line,
    borderRadius: 4,
  },
  dayBtnActive: {
    backgroundColor: THEME.text,
    borderColor: THEME.text,
  },
  dayBtnText: {
    color: THEME.textSecondary,
    fontSize: 10,
    fontWeight: '700',
  },
  dayBtnTextActive: {
    color: THEME.bg,
    fontWeight: '800',
  },
  tableCard: {
    backgroundColor: THEME.surface,
    borderWidth: 1,
    borderColor: THEME.line,
    borderRadius: 6,
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
    fontSize: 10,
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
  tableRowEven: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  colTime: {
    width: 44,
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
  colPeriod: {
    width: 48,
    fontSize: 11,
    color: THEME.textMuted,
    fontVariant: ['tabular-nums'],
  },
  colWind: {
    flex: 1,
    fontSize: 11,
    color: THEME.textSecondary,
  },
});

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
import { SPOTS } from '../../src/data/spotsData';
import { useSpotStore } from '../../src/store/useSpotStore';
import {
  generateOfflineForecast,
  SpotForecastResult,
} from '../../src/core/parsers/forecastParser';
import {
  getForecastFromCache,
  saveForecastToCache,
} from '../../src/services/storage/forecastCache';

export default function ForecastsScreen() {
  const { selectedSpotId, selectSpot } = useSpotStore();
  const currentSpot = SPOTS.find((s) => s.id === selectedSpotId) || SPOTS[0];

  const [forecast, setForecast] = useState<SpotForecastResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOfflineMode, setIsOfflineMode] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    (async () => {
      // 1. Intentar leer de caché persistente (modo playa sin conexión)
      const cached = await getForecastFromCache(currentSpot.id);
      if (cached && isMounted) {
        setForecast(cached);
        setLoading(false);
      }

      // 2. Generar/actualizar previsión física
      try {
        const fresh = generateOfflineForecast(currentSpot);
        if (isMounted) {
          setForecast(fresh);
          setLoading(false);
        }
        await saveForecastToCache(fresh);
      } catch {
        if (!cached && isMounted) {
          const fallback = generateOfflineForecast(currentSpot);
          setForecast(fallback);
          setLoading(false);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [currentSpot]);

  const toggleOffline = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsOfflineMode(!isOfflineMode);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Encabezado */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>PREVISIÓN DE OLAS</Text>
            <Text style={styles.subtitle}>Física marina · 7 Días Horarios</Text>
          </View>
          <TouchableOpacity
            style={[styles.offlineBtn, isOfflineMode && styles.offlineBtnActive]}
            onPress={toggleOffline}
            activeOpacity={0.8}
          >
            <Text style={[styles.offlineBtnText, isOfflineMode && styles.offlineBtnTextActive]}>
              {isOfflineMode ? '🏖️ Modo Playa ACTIVO' : '🏖️ Modo Playa'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Selector de Spot */}
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
                  Haptics.selectionAsync();
                  selectSpot(s.id);
                }}
                style={[styles.pill, isSelected && styles.pillActive]}
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
            <ActivityIndicator size="large" color="#38bdf8" />
            <Text style={styles.loadingText}>Calculando física de rompiente...</Text>
          </View>
        ) : forecast ? (
          <>
            {/* Banner resumen del día */}
            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <View>
                  <Text style={styles.summarySpot}>{forecast.spotName}</Text>
                  <Text style={styles.summaryBestHour}>
                    Mejor baño: {forecast.summary.bestHour}:00 h
                  </Text>
                </View>
                <View style={styles.summaryBadge}>
                  <Text style={styles.summaryStars}>
                    {'★'.repeat(Math.round(forecast.summary.maxStars))}
                  </Text>
                  <Text style={styles.summaryRating}>
                    Pico: {forecast.summary.maxHeight} m
                  </Text>
                </View>
              </View>
              <Text style={styles.summaryHint}>
                {forecast.summary.recommended
                  ? 'Buen baño asegurado con terral limpio por la mañana.'
                  : 'Mar flojo; buscar punto de marea favorable o picos abrigados.'}
              </Text>
            </View>

            {/* Listado hora a hora */}
            <Text style={styles.sectionTitle}>Próximas Horas</Text>

            {forecast.hours.slice(0, 18).map((h, idx) => {
              const starsCount = Math.round(h.rating.stars);
              return (
                <View key={idx} style={styles.hourCard}>
                  <View style={styles.hourLeft}>
                    <Text style={styles.hourText}>{h.hour}:00</Text>
                    <Text style={styles.energyLabel}>{h.energy.label}</Text>
                  </View>

                  <View style={styles.hourCenter}>
                    <Text style={styles.waveHeight}>
                      {h.surfHeight.min} - {h.surfHeight.max} m
                    </Text>
                    <Text style={styles.wavePeriod}>{h.period}s periodo</Text>
                  </View>

                  <View style={styles.hourWind}>
                    <Text style={styles.windSpeed}>{h.windSpeed} km/h</Text>
                    <Text
                      style={[
                        styles.windTag,
                        h.windState.key === 'offshore' || h.windState.key === 'glassy'
                          ? styles.windTagClean
                          : styles.windTagChoppy,
                      ]}
                    >
                      {h.windState.label}
                    </Text>
                  </View>

                  <View style={styles.hourRight}>
                    <Text style={[styles.starsText, { color: h.rating.color }]}>
                      {'★'.repeat(starsCount) || '·'}
                    </Text>
                    <Text style={styles.ratingText}>{h.rating.label}</Text>
                  </View>
                </View>
              );
            })}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0a1628' },
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: { color: '#38bdf8', fontSize: 18, fontWeight: '800' },
  subtitle: { color: '#94a3b8', fontSize: 13 },
  offlineBtn: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  offlineBtnActive: {
    backgroundColor: '#0284c7',
    borderColor: '#38bdf8',
  },
  offlineBtnText: { color: '#94a3b8', fontSize: 11, fontWeight: '700' },
  offlineBtnTextActive: { color: '#ffffff' },
  pillsScroll: { marginBottom: 16 },
  pillsContent: { gap: 8 },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
  },
  pillActive: { backgroundColor: '#0284c7', borderColor: '#38bdf8' },
  pillText: { color: '#94a3b8', fontSize: 13, fontWeight: '600' },
  pillTextActive: { color: '#ffffff', fontWeight: '700' },
  loadingBox: { padding: 40, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: '#64748b', fontSize: 13, marginTop: 12 },
  summaryCard: {
    backgroundColor: '#111e33',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 20,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summarySpot: { color: '#ffffff', fontSize: 18, fontWeight: '700' },
  summaryBestHour: { color: '#38bdf8', fontSize: 13, marginTop: 2, fontWeight: '600' },
  summaryBadge: { alignItems: 'flex-end' },
  summaryStars: { color: '#facc15', fontSize: 14, letterSpacing: 1 },
  summaryRating: { color: '#84cc16', fontSize: 12, fontWeight: '700', marginTop: 2 },
  summaryHint: { color: '#94a3b8', fontSize: 13, lineHeight: 18 },
  sectionTitle: { color: '#ffffff', fontSize: 16, fontWeight: '700', marginBottom: 12 },
  hourCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#111e33',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  hourLeft: { width: 55 },
  hourText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  energyLabel: { color: '#64748b', fontSize: 10, marginTop: 2 },
  hourCenter: { flex: 1, paddingHorizontal: 10 },
  waveHeight: { color: '#38bdf8', fontSize: 14, fontWeight: '700' },
  wavePeriod: { color: '#94a3b8', fontSize: 11, marginTop: 2 },
  hourWind: { width: 85, alignItems: 'center' },
  windSpeed: { color: '#ffffff', fontSize: 12, fontWeight: '600' },
  windTag: { fontSize: 10, fontWeight: '700', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginTop: 2 },
  windTagClean: { backgroundColor: 'rgba(16, 185, 129, 0.2)', color: '#10b981' },
  windTagChoppy: { backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#ef4444' },
  hourRight: { width: 80, alignItems: 'flex-end' },
  starsText: { fontSize: 13, letterSpacing: 1 },
  ratingText: { color: '#94a3b8', fontSize: 10, marginTop: 2 },
});

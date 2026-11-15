import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Alert,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { SPOTS, Spot } from '../../src/data/spotsData';
import { useSpotStore } from '../../src/store/useSpotStore';
import { useVigiaStore } from '../../src/store/useVigiaStore';
import { getStreamsForSpot, ResolvedStream } from '../../src/core/parsers/streamParser';
import { SurfCamPlayer, CamStreamOption } from '../../src/components/video/SurfCamPlayer';
import { RatingPill } from '../../src/components/ui/RatingPill';
import { useNearestSpots } from '../../src/services/sensors/useNearestSpots';
import { circularBufferManager } from '../../src/services/video/circularBufferManager';
import { checkAndTriggerSwellAlert } from '../../src/services/notifications/swellAlerts';
import {
  fetchSpotForecast,
  generateOfflineForecast,
  SpotForecastResult,
  HourlyForecast,
} from '../../src/core/parsers/forecastParser';
import {
  getForecastFromCache,
  saveForecastToCache,
} from '../../src/services/storage/forecastCache';
import { THEME, getRatingColor } from '../../src/theme/colors';

export default function SpotsScreen() {
  const { selectedSpotId, selectSpot } = useSpotStore();
  const { addClip } = useVigiaStore();
  const { spots: nearestSpots, pressureHpa } = useNearestSpots();

  const currentSpot: Spot = SPOTS.find((s) => s.id === selectedSpotId) || SPOTS[0];
  const streams: ResolvedStream[] = getStreamsForSpot(currentSpot.id);
  const [activeStreamId, setActiveStreamId] = useState<string>(streams[0]?.id || '');

  // Mantener stream activo sincronizado con el spot seleccionado
  const activeStream = streams.find((s) => s.id === activeStreamId) || streams[0] || null;

  const [isCapturing, setIsCapturing] = useState(false);
  const [spotForecast, setSpotForecast] = useState<SpotForecastResult | null>(null);

  useEffect(() => {
    let isMounted = true;

    (async () => {
      let cached: SpotForecastResult | null = null;
      try {
        cached = await getForecastFromCache(currentSpot.id);
      } catch {
        cached = null;
      }
      if (cached && isMounted) setSpotForecast(cached);

      try {
        const fresh = await fetchSpotForecast(currentSpot);
        if (!isMounted) return;
        setSpotForecast(fresh);
        saveForecastToCache(fresh).catch(() => {});
      } catch {
        if (!isMounted) return;
        if (!cached) setSpotForecast(generateOfflineForecast(currentSpot));
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [currentSpot]);

  const todayHours: HourlyForecast[] = (spotForecast?.hours || []).slice(0, 24);
  const bestToday = todayHours.reduce<HourlyForecast | undefined>(
    (best, h) => (!best || h.rating.stars > best.rating.stars ? h : best),
    undefined
  );
  const todayMaxStars = bestToday?.rating.stars ?? 0;
  const todayMinHeight = todayHours.length
    ? Math.min(...todayHours.map((h) => h.surfHeight.min))
    : null;
  const todayMaxHeight = todayHours.length
    ? Math.max(...todayHours.map((h) => h.surfHeight.max))
    : null;

  const weeklySpark = Array.from({ length: 7 }, (_, dayOffset) => {
    const dayHours = (spotForecast?.hours || []).slice(dayOffset * 24, (dayOffset + 1) * 24);
    const maxStars = dayHours.reduce((max, h) => Math.max(max, h.rating.stars), 0);
    const label =
      dayOffset === 0
        ? 'HOY'
        : new Date(Date.now() + dayOffset * 86400000)
            .toLocaleDateString('es-ES', { weekday: 'short' })
            .toUpperCase()
            .slice(0, 3);
    return { day: label, color: getRatingColor(maxStars) };
  });

  const handleSpotPress = (spotId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    selectSpot(spotId);
    const spotStreams = getStreamsForSpot(spotId);
    if (spotStreams.length > 0) {
      setActiveStreamId(spotStreams[0].id);
    }
  };

  const handleCaptureVigia = async () => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setIsCapturing(true);

      const clip = await circularBufferManager.exportLastClip(currentSpot.id);

      addClip({
        id: clip.id,
        spotId: currentSpot.id,
        spotName: currentSpot.name,
        uri: clip.uri,
        capturedAt: clip.capturedAt,
        durationMs: clip.durationMs,
        waveHeight: 0.6,
        stars: 3.5,
        sizeBytes: clip.sizeBytes,
      });

      await checkAndTriggerSwellAlert(
        currentSpot.id,
        currentSpot.name,
        3.5,
        'Terral',
        0.6
      );

      Alert.alert(
        'Clip Vigía Guardado',
        `Se han grabado los últimos 20 segundos de ${currentSpot.name}. Puedes revisarlo en la pestaña Vigía.`
      );
    } catch {
      Alert.alert('Aviso', 'No se ha podido procesar el clip en este momento.');
    } finally {
      setIsCapturing(false);
    }
  };

  const streamOptions: CamStreamOption[] = streams.map((s) => ({
    id: s.id,
    name: s.short || s.name,
    type: s.type,
    streamUrl: s.streamUrl,
    fallbackUrl: s.fallbackUrl,
  }));

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Cabecera idéntica a .topbar de la web */}
        <View style={styles.topbar}>
          <View>
            <View style={styles.logoRow}>
              <Text style={styles.logoTitle}>METEOSURF</Text>
              <Text style={styles.logoSuffix}>CS</Text>
            </View>
            <Text style={styles.headerSub}>Costa de Castellón · Previsión & Webcams</Text>
          </View>
          {pressureHpa && (
            <View style={styles.pressureBadge}>
              <Text style={styles.pressureText}>{pressureHpa} hPa</Text>
            </View>
          )}
        </View>

        {/* Barra horizontal de spots (Fiel a .quick-spots / .chips) */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipsScroll}
          contentContainerStyle={styles.chipsContent}
        >
          {SPOTS.map((s) => {
            const isSelected = s.id === currentSpot.id;
            return (
              <TouchableOpacity
                key={s.id}
                onPress={() => handleSpotPress(s.id)}
                style={[styles.chip, isSelected && styles.chipActive]}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                  {s.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Reproductor de cámara en directo (16:9 con soporte multi-cámara y restringidas) */}
        {activeStream ? (
          <SurfCamPlayer
            streamUrl={activeStream.streamUrl}
            fallbackImageUrl={activeStream.fallbackUrl}
            isImageStream={activeStream.type === 'jpg'}
            isRestricted={activeStream.type === 'restricted'}
            spotName={currentSpot.name}
            availableStreams={streamOptions}
            activeStreamId={activeStream.id}
            onSelectStream={(newId) => setActiveStreamId(newId)}
            onCaptureClip={handleCaptureVigia}
          />
        ) : (
          <View style={styles.noCameraBox}>
            <Text style={styles.noCameraTitle}>SIN EMISIÓN EN DIRECTO</Text>
            <Text style={styles.noCameraSub}>No hay señal de vídeo en este spot</Text>
          </View>
        )}

        {/* Ficha principal de condiciones del spot (Fiel a .spot-card de la web) */}
        <View style={styles.spotCard}>
          <View style={styles.cardTop}>
            <View>
              <Text style={styles.cardSpotName}>{currentSpot.name}</Text>
              <Text style={styles.cardSpotZone}>
                {currentSpot.zoneName || currentSpot.zone}
              </Text>
            </View>
            <RatingPill rating={todayMaxStars} />
          </View>

          {/* Altura de rompiente principal */}
          <View style={styles.heightRow}>
            <Text style={styles.heightNumber}>
              {todayMinHeight != null && todayMaxHeight != null
                ? `${todayMinHeight.toFixed(1)} - ${todayMaxHeight.toFixed(1)}`
                : '--'}
            </Text>
            <Text style={styles.heightUnit}>m</Text>
          </View>

          {/* Metadatos: Fondo, Periodo y Viento */}
          <View style={styles.metaRow}>
            <View style={styles.metaPill}>
              <Text style={styles.metaKey}>Periodo:</Text>
              <Text style={styles.metaVal}>
                {bestToday?.period != null ? `${bestToday.period.toFixed(1)} s` : '--'}
              </Text>
            </View>
            <View style={styles.metaPill}>
              <Text style={styles.metaKey}>Swell:</Text>
              <Text style={styles.metaVal}>
                {bestToday != null ? `${Math.round(bestToday.waveDirection)}°` : '--'}
              </Text>
            </View>
            <View style={[styles.metaPill, styles.windPill]}>
              <Text style={styles.windText}>
                {bestToday?.windState?.label ?? '--'} · {bestToday?.windSpeed ?? '--'} km/h
              </Text>
            </View>
          </View>

          {/* Mini chispa semanal de 7 días (Fiel a .spark de la web) */}
          <View style={styles.sparkContainer}>
            <Text style={styles.sparkTitle}>
              {spotForecast != null && !spotForecast.isOffline ? 'TENDENCIA 7 DÍAS · DATOS EN VIVO' : 'TENDENCIA 7 DÍAS'}
            </Text>
            <View style={styles.sparkBars}>
              {weeklySpark.map((item, idx) => (
                <View key={idx} style={styles.sparkItem}>
                  <View style={[styles.sparkBar, { backgroundColor: item.color }]} />
                  <Text style={styles.sparkLabel}>{item.day}</Text>
                </View>
              ))}
            </View>
          </View>

          <Text style={styles.spotDesc}>{currentSpot.desc}</Text>
        </View>

        {/* Radar de spots cercanos por GPS (Fiel a .spot-grid) */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>PLAYAS Y ROMPIENTES DE CASTELLÓN</Text>
          <Text style={styles.sectionSub}>Ordenado por cercanía geográfica</Text>
        </View>

        <View style={styles.spotGrid}>
          {nearestSpots.map((item) => {
            const isSelected = item.id === currentSpot.id;
            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.gridRow, isSelected && styles.gridRowActive]}
                onPress={() => handleSpotPress(item.id)}
                activeOpacity={0.7}
              >
                <View style={styles.gridRowMain}>
                  <Text style={styles.gridRowName}>{item.name}</Text>
                  <Text style={styles.gridRowMeta}>
                    {item.distanceKm > 0 ? `${item.distanceKm} km · ` : ''}
                    {item.bottom} · {item.level}
                  </Text>
                </View>
                <View style={styles.gridRowRight}>
                  <RatingPill rating={3} showLabel={false} />
                  <Text style={styles.gridChevron}>›</Text>
                </View>
              </TouchableOpacity>
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
    paddingTop: 10,
    paddingBottom: 40,
  },
  topbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: THEME.line,
    marginBottom: 12,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  logoTitle: {
    color: THEME.brand,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  logoSuffix: {
    color: THEME.accent,
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 4,
  },
  headerSub: {
    color: THEME.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  pressureBadge: {
    backgroundColor: THEME.surface2,
    borderWidth: 1,
    borderColor: THEME.line,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  pressureText: {
    color: THEME.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  chipsScroll: {
    marginBottom: 14,
  },
  chipsContent: {
    gap: 6,
    paddingVertical: 2,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    backgroundColor: THEME.surface2,
    borderWidth: 1,
    borderColor: THEME.line,
  },
  chipActive: {
    backgroundColor: THEME.text,
    borderColor: THEME.text,
  },
  chipText: {
    color: THEME.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  chipTextActive: {
    color: THEME.bg,
    fontWeight: '700',
  },
  noCameraBox: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: THEME.surface2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: THEME.line,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  noCameraTitle: {
    color: THEME.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  noCameraSub: {
    color: THEME.textFaint,
    fontSize: 11,
    marginTop: 4,
  },
  spotCard: {
    backgroundColor: THEME.surface,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: THEME.line,
    paddingVertical: 18,
    marginBottom: 20,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  cardSpotName: {
    fontSize: 20,
    fontWeight: '700',
    color: THEME.text,
    letterSpacing: -0.4,
  },
  cardSpotZone: {
    fontSize: 12,
    color: THEME.textMuted,
    marginTop: 2,
  },
  heightRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginVertical: 4,
  },
  heightNumber: {
    fontSize: 32,
    fontWeight: '800',
    color: THEME.text,
    letterSpacing: -1,
  },
  heightUnit: {
    fontSize: 18,
    fontWeight: '500',
    color: THEME.textSecondary,
    marginLeft: 6,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
    marginBottom: 14,
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: THEME.surface2,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: THEME.line,
  },
  metaKey: {
    fontSize: 11,
    color: THEME.textMuted,
  },
  metaVal: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.text,
  },
  windPill: {
    borderColor: 'rgba(11, 214, 116, 0.25)',
  },
  windText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.wind.offshore,
  },
  sparkContainer: {
    marginTop: 6,
    marginBottom: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: THEME.lineSubtle,
  },
  sparkTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: THEME.textMuted,
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  sparkBars: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sparkItem: {
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 2,
  },
  sparkBar: {
    width: '100%',
    height: 4,
    borderRadius: 1,
    marginBottom: 4,
  },
  sparkLabel: {
    fontSize: 9,
    color: THEME.textFaint,
    fontWeight: '600',
  },
  spotDesc: {
    fontSize: 12,
    color: THEME.textSecondary,
    lineHeight: 18,
  },
  sectionHeader: {
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.textMuted,
    letterSpacing: 1,
  },
  sectionSub: {
    fontSize: 11,
    color: THEME.textFaint,
    marginTop: 2,
  },
  spotGrid: {
    borderTopWidth: 1,
    borderColor: THEME.line,
  },
  gridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: THEME.line,
  },
  gridRowActive: {
    borderLeftWidth: 3,
    borderLeftColor: THEME.accent,
    paddingLeft: 8,
  },
  gridRowMain: {
    flex: 1,
  },
  gridRowName: {
    fontSize: 15,
    fontWeight: '700',
    color: THEME.text,
  },
  gridRowMeta: {
    fontSize: 12,
    color: THEME.textMuted,
    marginTop: 3,
  },
  gridRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  gridChevron: {
    fontSize: 18,
    color: THEME.textMuted,
    marginLeft: 4,
  },
});

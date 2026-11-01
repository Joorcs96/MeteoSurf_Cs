import React, { useState } from 'react';
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
import { SPOTS } from '../../src/data/spotsData';
import { useSpotStore } from '../../src/store/useSpotStore';
import { useVigiaStore } from '../../src/store/useVigiaStore';
import { getStreamsForSpot, ResolvedStream } from '../../src/core/parsers/streamParser';
import { SurfCamPlayer } from '../../src/components/video/SurfCamPlayer';
import { useNearestSpots } from '../../src/services/sensors/useNearestSpots';
import { circularBufferManager } from '../../src/services/video/circularBufferManager';
import { checkAndTriggerSwellAlert } from '../../src/services/notifications/swellAlerts';

export default function SpotsScreen() {
  const { selectedSpotId, selectSpot } = useSpotStore();
  const { addClip } = useVigiaStore();
  const { spots: nearestSpots, pressureHpa } = useNearestSpots();

  const currentSpot = SPOTS.find((s) => s.id === selectedSpotId) || SPOTS[0];
  const streams = getStreamsForSpot(currentSpot.id);
  const activeStream: ResolvedStream | null = streams[0] || null;

  const [isCapturing, setIsCapturing] = useState(false);

  const handleSpotPress = (spotId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    selectSpot(spotId);
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

      // Disparar notificación si cumple el trigger
      await checkAndTriggerSwellAlert(
        currentSpot.id,
        currentSpot.name,
        3.5,
        'Terral',
        0.6
      );

      Alert.alert(
        '📹 Clip Vigía Guardado',
        `Se han grabado los últimos 20 segundos de ${currentSpot.name}. Puedes revisarlo y compartirlo en la pestaña Vigía.`
      );
    } catch {
      Alert.alert('Error', 'No se ha podido procesar el clip');
    } finally {
      setIsCapturing(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Encabezado */}
        <View style={styles.header}>
          <View>
            <Text style={styles.appTitle}>SURFLINE CASTELLÓN</Text>
            <Text style={styles.headerSub}>Radar & Cámaras en Directo</Text>
          </View>
          {pressureHpa && (
            <View style={styles.barometerBadge}>
              <Text style={styles.barometerText}>🧭 {pressureHpa} hPa</Text>
            </View>
          )}
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
                onPress={() => handleSpotPress(s.id)}
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

        {/* Reproductor de cámara en directo */}
        <View style={styles.playerContainer}>
          {activeStream ? (
            <SurfCamPlayer
              streamUrl={activeStream.streamUrl}
              fallbackImageUrl={activeStream.fallbackUrl}
              isImageStream={activeStream.type === 'jpg'}
              spotName={currentSpot.name}
              onCaptureClip={handleCaptureVigia}
            />
          ) : (
            <View style={styles.noCameraBox}>
              <Text style={styles.noCameraText}>Sin emisión en directo configurada</Text>
            </View>
          )}
        </View>

        {/* Ficha de condiciones del spot seleccionado */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.spotName}>{currentSpot.name}</Text>
              <Text style={styles.spotZone}>{currentSpot.zoneName || currentSpot.zone}</Text>
            </View>
            <View style={styles.ratingBox}>
              <Text style={styles.ratingStars}>★★★★☆</Text>
              <Text style={styles.ratingLabel}>Regular-Bueno</Text>
            </View>
          </View>

          <View style={styles.metricsRow}>
            <View style={styles.metricItem}>
              <Text style={styles.metricVal}>0.5 - 0.7m</Text>
              <Text style={styles.metricKey}>Rompiente</Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricVal}>5.4s</Text>
              <Text style={styles.metricKey}>Periodo</Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricVal}>9 km/h</Text>
              <Text style={styles.metricKey}>Terral (O)</Text>
            </View>
          </View>

          <Text style={styles.spotDesc}>{currentSpot.desc}</Text>
        </View>

        {/* Radar de spots cercanos por GPS */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Radar de Playas Cercanas</Text>
          <Text style={styles.sectionSub}>Ordenado por distancia GPS</Text>
        </View>

        {nearestSpots.slice(0, 6).map((item) => (
          <TouchableOpacity
            key={item.id}
            style={[styles.radarItem, item.id === currentSpot.id && styles.radarItemActive]}
            onPress={() => handleSpotPress(item.id)}
            activeOpacity={0.7}
          >
            <View>
              <Text style={styles.radarName}>{item.name}</Text>
              <Text style={styles.radarMeta}>
                {item.distanceKm > 0 ? `${item.distanceKm} km · ` : ''}
                {item.level} · {item.bottom}
              </Text>
            </View>
            <View style={styles.radarAction}>
              <Text style={styles.radarChevron}>›</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0a1628',
  },
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  appTitle: {
    color: '#38bdf8',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  headerSub: {
    color: '#94a3b8',
    fontSize: 13,
  },
  barometerBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  barometerText: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '700',
  },
  pillsScroll: {
    marginBottom: 16,
  },
  pillsContent: {
    gap: 8,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
  },
  pillActive: {
    backgroundColor: '#0284c7',
    borderColor: '#38bdf8',
  },
  pillText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
  },
  pillTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  playerContainer: {
    marginBottom: 16,
  },
  noCameraBox: {
    height: 180,
    backgroundColor: '#1e293b',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noCameraText: {
    color: '#64748b',
    fontSize: 14,
  },
  card: {
    backgroundColor: '#111e33',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  spotName: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  spotZone: {
    color: '#64748b',
    fontSize: 13,
    marginTop: 2,
  },
  ratingBox: {
    alignItems: 'flex-end',
  },
  ratingStars: {
    color: '#facc15',
    fontSize: 14,
    letterSpacing: 2,
  },
  ratingLabel: {
    color: '#84cc16',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#0a1628',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  metricItem: {
    alignItems: 'center',
  },
  metricVal: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  metricKey: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 2,
  },
  spotDesc: {
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 18,
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  sectionSub: {
    color: '#64748b',
    fontSize: 12,
  },
  radarItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#111e33',
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  radarItemActive: {
    borderColor: '#0284c7',
    backgroundColor: '#0c2340',
  },
  radarName: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  radarMeta: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 2,
  },
  radarAction: {
    paddingLeft: 10,
  },
  radarChevron: {
    color: '#38bdf8',
    fontSize: 20,
    fontWeight: '700',
  },
});

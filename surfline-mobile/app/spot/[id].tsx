import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SPOTS, Spot } from '../../src/data/spotsData';
import { getStreamsForSpot, ResolvedStream } from '../../src/core/parsers/streamParser';
import { SurfCamPlayer, CamStreamOption } from '../../src/components/video/SurfCamPlayer';
import { RatingPill } from '../../src/components/ui/RatingPill';
import { THEME } from '../../src/theme/colors';

export default function SpotDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const spot: Spot = SPOTS.find((s) => s.id === id) || SPOTS[0];
  const streams: ResolvedStream[] = getStreamsForSpot(spot.id);
  const [activeStreamId, setActiveStreamId] = useState<string>(streams[0]?.id || '');
  const activeStream = streams.find((s) => s.id === activeStreamId) || streams[0] || null;

  const streamOptions: CamStreamOption[] = streams.map((s) => ({
    id: s.id,
    name: s.short || s.name,
    type: s.type,
    streamUrl: s.streamUrl,
    fallbackUrl: s.fallbackUrl,
  }));

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={styles.backBtnText}>‹ Volver</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{spot.name}</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Reproductor de cámara en directo (16:9 con soporte multi-cámara) */}
        {activeStream ? (
          <SurfCamPlayer
            streamUrl={activeStream.streamUrl}
            fallbackImageUrl={activeStream.fallbackUrl}
            isImageStream={activeStream.type === 'jpg'}
            isRestricted={activeStream.type === 'restricted'}
            spotName={spot.name}
            availableStreams={streamOptions}
            activeStreamId={activeStream.id}
            onSelectStream={(newId) => setActiveStreamId(newId)}
          />
        ) : (
          <View style={styles.noPlayer}>
            <Text style={styles.noPlayerText}>SIN EMISIÓN EN DIRECTO DISPONIBLE</Text>
          </View>
        )}

        {/* Ficha técnica del spot */}
        <View style={styles.infoCard}>
          <View style={styles.infoTop}>
            <View>
              <Text style={styles.infoTitle}>{spot.name.toUpperCase()}</Text>
              <Text style={styles.infoZone}>{spot.zoneName || spot.zone}</Text>
            </View>
            <RatingPill rating={3.5} />
          </View>

          <View style={styles.grid}>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>FONDO</Text>
              <Text style={styles.gridVal}>{spot.bottom || 'Arena'}</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>ORIENTACIÓN</Text>
              <Text style={styles.gridVal}>{spot.facing}°</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>NIVEL</Text>
              <Text style={styles.gridVal}>{spot.level || 'Todos'}</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>MAREA ÓPTIMA</Text>
              <Text style={styles.gridVal}>{spot.bestTide || 'Media'}</Text>
            </View>
          </View>

          {spot.desc && <Text style={styles.descText}>{spot.desc}</Text>}
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.line,
  },
  backBtn: {
    paddingVertical: 4,
    paddingRight: 12,
  },
  backBtnText: {
    color: THEME.textSecondary,
    fontSize: 15,
    fontWeight: '700',
  },
  headerTitle: {
    color: THEME.brand,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
  },
  noPlayer: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#171b1e',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: THEME.line,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  noPlayerText: {
    color: THEME.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  infoCard: {
    backgroundColor: THEME.surface,
    borderWidth: 1,
    borderColor: THEME.line,
    borderRadius: 6,
    padding: 16,
    marginTop: 4,
  },
  infoTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  infoTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: THEME.text,
    letterSpacing: -0.3,
  },
  infoZone: {
    fontSize: 11,
    color: THEME.textMuted,
    marginTop: 2,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  gridItem: {
    width: '48%',
    backgroundColor: THEME.surface2,
    borderWidth: 1,
    borderColor: THEME.line,
    borderRadius: 4,
    padding: 10,
  },
  gridLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: THEME.textMuted,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  gridVal: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.text,
  },
  descText: {
    fontSize: 12,
    color: THEME.textSecondary,
    lineHeight: 18,
    borderTopWidth: 1,
    borderTopColor: THEME.lineSubtle,
    paddingTop: 12,
  },
});

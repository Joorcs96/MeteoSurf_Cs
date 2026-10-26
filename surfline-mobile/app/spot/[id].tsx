import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SPOTS } from '../../src/data/spotsData';
import { getStreamsForSpot } from '../../src/core/parsers/streamParser';
import { SurfCamPlayer } from '../../src/components/video/SurfCamPlayer';

export default function SpotDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const spot = SPOTS.find((s) => s.id === id) || SPOTS[0];
  const streams = getStreamsForSpot(spot.id);
  const primaryStream = streams[0] || null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>‹ Volver</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{spot.name}</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Reproductor a tamaño completo */}
        <View style={styles.playerBox}>
          {primaryStream ? (
            <SurfCamPlayer
              streamUrl={primaryStream.streamUrl}
              fallbackImageUrl={primaryStream.fallbackUrl}
              isImageStream={primaryStream.type === 'jpg'}
              spotName={spot.name}
            />
          ) : (
            <View style={styles.noPlayer}>
              <Text style={styles.noPlayerText}>Sin emisión en directo disponible</Text>
            </View>
          )}
        </View>

        {/* Ficha técnica del spot */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Ficha Técnica de {spot.name}</Text>
          <Text style={styles.infoZone}>{spot.zoneName || spot.zone}</Text>

          <View style={styles.grid}>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>Fondo</Text>
              <Text style={styles.gridVal}>{spot.bottom || 'Arena'}</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>Nivel</Text>
              <Text style={styles.gridVal}>{spot.level || 'Todos los niveles'}</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>Mejor Marea</Text>
              <Text style={styles.gridVal}>{spot.bestTide || 'Media'}</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>Mejor Viento</Text>
              <Text style={styles.gridVal}>{spot.bestWind || 'Terral (O)'}</Text>
            </View>
          </View>

          <Text style={styles.desc}>{spot.desc}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0a1628' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  backBtn: { width: 60 },
  backBtnText: { color: '#38bdf8', fontSize: 16, fontWeight: '700' },
  headerTitle: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  container: { flex: 1 },
  content: { padding: 16 },
  playerBox: { marginBottom: 20 },
  noPlayer: {
    height: 220,
    backgroundColor: '#111e33',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noPlayerText: { color: '#64748b', fontSize: 14 },
  infoCard: {
    backgroundColor: '#111e33',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  infoTitle: { color: '#ffffff', fontSize: 18, fontWeight: '700' },
  infoZone: { color: '#64748b', fontSize: 13, marginTop: 2, marginBottom: 16 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
    backgroundColor: '#0a1628',
    padding: 12,
    borderRadius: 10,
  },
  gridItem: { width: '47%' },
  gridLabel: { color: '#64748b', fontSize: 11 },
  gridVal: { color: '#f0f6fc', fontSize: 13, fontWeight: '600', marginTop: 2 },
  desc: { color: '#94a3b8', fontSize: 13, lineHeight: 19 },
});

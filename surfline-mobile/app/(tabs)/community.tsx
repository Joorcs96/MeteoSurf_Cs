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
import { useNearestSpots, haversineDistance } from '../../src/services/sensors/useNearestSpots';

interface Report {
  id: string;
  spotName: string;
  timeAgo: string;
  condition: string;
  isVerifiedAtBeach: boolean;
  author: string;
  votes: number;
}

export default function CommunityScreen() {
  const { selectedSpotId, selectSpot } = useSpotStore();
  const currentSpot = SPOTS.find((s) => s.id === selectedSpotId) || SPOTS[0];
  const { userLocation } = useNearestSpots();

  // Comprobar si el usuario está a pie de playa (< 500 m = 0.5 km)
  const distanceKm = userLocation
    ? haversineDistance(userLocation.lat, userLocation.lon, currentSpot.lat, currentSpot.lon)
    : 999;
  const isAtBeach = distanceKm <= 0.5;

  const [reports, setReports] = useState<Report[]>([
    {
      id: 'rep_1',
      spotName: 'Planetario',
      timeAgo: 'Hace 15 min',
      condition: '🏄‍♂️ Olas de medio metro limpias con terral',
      isVerifiedAtBeach: true,
      author: 'Carlos S.',
      votes: 7,
    },
    {
      id: 'rep_2',
      spotName: 'Voramar',
      timeAgo: 'Hace 1 hora',
      condition: '🌊 Pico en el espigón funcionando',
      isVerifiedAtBeach: true,
      author: 'Javi M.',
      votes: 4,
    },
    {
      id: 'rep_3',
      spotName: 'Morro de Gos',
      timeAgo: 'Hace 3 horas',
      condition: '〰️ Mar bastante desordenado',
      isVerifiedAtBeach: false,
      author: 'Marcos R.',
      votes: 2,
    },
  ]);

  const handleVote = (condition: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    const newReport: Report = {
      id: `rep_${Date.now()}`,
      spotName: currentSpot.name,
      timeAgo: 'Ahora mismo',
      condition,
      isVerifiedAtBeach: isAtBeach,
      author: 'Tú',
      votes: 1,
    };

    setReports([newReport, ...reports]);

    if (isAtBeach) {
      Alert.alert(
        '📍 Reporte Verificado',
        '¡Tu reporte ha sido publicado con la insignia oficial [A pie de playa]!'
      );
    } else {
      Alert.alert(
        'Reporte Publicado',
        'Gracias por compartir las condiciones con la comunidad de surfistas.'
      );
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Encabezado */}
        <View style={styles.header}>
          <Text style={styles.title}>COMUNIDAD & REPORTES</Text>
          <Text style={styles.subtitle}>Reportes a pie de playa verificados por GPS</Text>
        </View>

        {/* Tarjeta de estado GPS para el spot actual */}
        <View style={styles.gpsCard}>
          <View style={styles.gpsRow}>
            <View>
              <Text style={styles.gpsSpotTitle}>{currentSpot.name}</Text>
              <Text style={styles.gpsDist}>
                {userLocation
                  ? `Estás a ${distanceKm} km del spot`
                  : 'Obteniendo señal GPS...'}
              </Text>
            </View>
            <View
              style={[
                styles.gpsBadge,
                isAtBeach ? styles.gpsBadgeVerified : styles.gpsBadgeRemote,
              ]}
            >
              <Text style={styles.gpsBadgeText}>
                {isAtBeach ? '✓ A pie de playa' : 'Observador remoto'}
              </Text>
            </View>
          </View>

          {/* Botones de reporte rápido */}
          <Text style={styles.votePrompt}>¿Cómo está rompiendo ahora mismo?</Text>
          <View style={styles.voteGrid}>
            <TouchableOpacity
              style={styles.voteBtn}
              onPress={() => handleVote('🏄‍♂️ Olas buenas y limpias')}
              activeOpacity={0.8}
            >
              <Text style={styles.voteBtnText}>🏄‍♂️ Olas buenas</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.voteBtn}
              onPress={() => handleVote('🌊 Olas surfeables')}
              activeOpacity={0.8}
            >
              <Text style={styles.voteBtnText}>🌊 Surfeable</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.voteBtn}
              onPress={() => handleVote('〰️ Mar plato o picado')}
              activeOpacity={0.8}
            >
              <Text style={styles.voteBtnText}>〰️ Mar plato</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Feed de reportes recientes */}
        <Text style={styles.sectionTitle}>Últimos Reportes en Vivo</Text>

        {reports.map((r) => (
          <View key={r.id} style={styles.reportCard}>
            <View style={styles.reportHeader}>
              <View>
                <Text style={styles.reportAuthor}>
                  {r.author} · <Text style={styles.reportSpot}>{r.spotName}</Text>
                </Text>
                <Text style={styles.reportTime}>{r.timeAgo}</Text>
              </View>
              {r.isVerifiedAtBeach && (
                <View style={styles.verifiedTag}>
                  <Text style={styles.verifiedTagText}>✓ En la playa</Text>
                </View>
              )}
            </View>
            <Text style={styles.reportCondition}>{r.condition}</Text>
            <View style={styles.reportFooter}>
              <Text style={styles.voteCount}>👍 {r.votes} confirmaciones</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0a1628' },
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  header: { marginBottom: 16 },
  title: { color: '#38bdf8', fontSize: 18, fontWeight: '800' },
  subtitle: { color: '#94a3b8', fontSize: 13, marginTop: 2 },
  gpsCard: {
    backgroundColor: '#111e33',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 20,
  },
  gpsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  gpsSpotTitle: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  gpsDist: { color: '#94a3b8', fontSize: 12, marginTop: 2 },
  gpsBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  gpsBadgeVerified: { backgroundColor: 'rgba(16, 185, 129, 0.2)' },
  gpsBadgeRemote: { backgroundColor: 'rgba(100, 116, 139, 0.2)' },
  gpsBadgeText: { color: '#10b981', fontSize: 11, fontWeight: '700' },
  votePrompt: { color: '#f0f6fc', fontSize: 13, fontWeight: '600', marginBottom: 10 },
  voteGrid: { flexDirection: 'row', gap: 8 },
  voteBtn: {
    flex: 1,
    backgroundColor: '#1e293b',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  voteBtnText: { color: '#ffffff', fontSize: 12, fontWeight: '600' },
  sectionTitle: { color: '#ffffff', fontSize: 16, fontWeight: '700', marginBottom: 12 },
  reportCard: {
    backgroundColor: '#111e33',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  reportAuthor: { color: '#ffffff', fontSize: 13, fontWeight: '700' },
  reportSpot: { color: '#38bdf8' },
  reportTime: { color: '#64748b', fontSize: 11, marginTop: 2 },
  verifiedTag: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  verifiedTagText: { color: '#10b981', fontSize: 10, fontWeight: '700' },
  reportCondition: { color: '#e2e8f0', fontSize: 14, lineHeight: 19, marginBottom: 8 },
  reportFooter: { flexDirection: 'row', justifyContent: 'flex-end' },
  voteCount: { color: '#64748b', fontSize: 11 },
});

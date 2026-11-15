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
import { THEME } from '../../src/theme/colors';

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

  const distanceKm = userLocation
    ? haversineDistance(userLocation.lat, userLocation.lon, currentSpot.lat, currentSpot.lon)
    : 999;
  const isAtBeach = distanceKm <= 0.5;

  const [reports, setReports] = useState<Report[]>([
    {
      id: 'rep_1',
      spotName: 'Planetario',
      timeAgo: 'Hace 15 min',
      condition: 'Olas de medio metro limpias con terral suave',
      isVerifiedAtBeach: true,
      author: 'Carlos S.',
      votes: 7,
    },
    {
      id: 'rep_2',
      spotName: 'Voramar',
      timeAgo: 'Hace 1 hora',
      condition: 'Pico en el espigón funcionando con marea subiendo',
      isVerifiedAtBeach: true,
      author: 'Javi M.',
      votes: 4,
    },
    {
      id: 'rep_3',
      spotName: 'Morro de Gos',
      timeAgo: 'Hace 3 horas',
      condition: 'Mar cruzado con viento de mar moderado',
      isVerifiedAtBeach: false,
      author: 'David R.',
      votes: 2,
    },
  ]);

  const handleVote = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setReports((prev) =>
      prev.map((r) => (r.id === id ? { ...r, votes: r.votes + 1 } : r))
    );
  };

  const handleCreateReport = (rating: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const newRep: Report = {
      id: `rep_${Date.now()}`,
      spotName: currentSpot.name,
      timeAgo: 'Ahora mismo',
      condition: `Reporte: ${rating}`,
      isVerifiedAtBeach: isAtBeach,
      author: 'Tú',
      votes: 1,
    };
    setReports([newRep, ...reports]);
    Alert.alert(
      'Reporte Enviado',
      isAtBeach
        ? 'Tu reporte incluye la insignia oficial "A pie de playa" verificada por GPS.'
        : 'Tu reporte ha sido publicado.'
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Encabezado */}
        <View style={styles.header}>
          <Text style={styles.title}>REPORTES COMUNITARIOS</Text>
          <Text style={styles.subtitle}>Verificación física a pie de playa por GPS</Text>
        </View>

        {/* Panel de votación rápida en el spot actual */}
        <View style={styles.voteCard}>
          <View style={styles.voteTop}>
            <View>
              <Text style={styles.voteSpotTitle}>{currentSpot.name.toUpperCase()}</Text>
              <Text style={styles.voteSpotSub}>
                {isAtBeach
                  ? 'Ubicación verificada a pie de playa (< 500 m)'
                  : `A ${distanceKm > 100 ? '--' : distanceKm.toFixed(1)} km del spot`}
              </Text>
            </View>
            <View style={[styles.badgeGps, isAtBeach && styles.badgeGpsActive]}>
              <Text style={[styles.badgeGpsText, isAtBeach && styles.badgeGpsTextActive]}>
                {isAtBeach ? 'EN EL SPOT' : 'REMOTO'}
              </Text>
            </View>
          </View>

          <Text style={styles.voteQuestion}>¿CÓMO ESTÁ ROMPIENDO AHORA?</Text>

          <View style={styles.voteButtonsGrid}>
            {[
              { label: 'Épico', stars: 5, color: '#5c00d0' },
              { label: 'Bueno', stars: 4, color: '#009371' },
              { label: 'Regular', stars: 3, color: '#0bd674' },
              { label: 'Malo', stars: 2, color: '#ff9500' },
              { label: 'Plato', stars: 0, color: '#c3cad3' },
            ].map((opt) => (
              <TouchableOpacity
                key={opt.label}
                style={styles.voteBtn}
                onPress={() => handleCreateReport(opt.label)}
                activeOpacity={0.7}
              >
                <View style={[styles.voteDot, { backgroundColor: opt.color }]} />
                <Text style={styles.voteBtnText}>{opt.label.toUpperCase()}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Lista de reportes de la comunidad */}
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>REPORTES RECIENTES</Text>
          <Text style={styles.sectionCount}>{reports.length} reportes</Text>
        </View>

        {reports.map((rep) => (
          <View key={rep.id} style={styles.reportCard}>
            <View style={styles.reportTop}>
              <View style={styles.reportAuthorRow}>
                <Text style={styles.reportAuthor}>{rep.author}</Text>
                <Text style={styles.reportTime}>· {rep.timeAgo}</Text>
              </View>
              {rep.isVerifiedAtBeach && (
                <View style={styles.verifiedPill}>
                  <Text style={styles.verifiedText}>A PIE DE PLAYA</Text>
                </View>
              )}
            </View>

            <Text style={styles.reportSpotName}>{rep.spotName.toUpperCase()}</Text>
            <Text style={styles.reportCondition}>{rep.condition}</Text>

            <View style={styles.reportBottom}>
              <TouchableOpacity
                style={styles.voteActionBtn}
                onPress={() => handleVote(rep.id)}
                activeOpacity={0.7}
              >
                <Text style={styles.voteActionText}>Útil ({rep.votes})</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
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
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: THEME.line,
    marginBottom: 16,
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
  voteCard: {
    backgroundColor: THEME.surface,
    borderWidth: 1,
    borderColor: THEME.line,
    borderRadius: 6,
    padding: 16,
    marginBottom: 20,
  },
  voteTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  voteSpotTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: THEME.text,
    letterSpacing: 0.3,
  },
  voteSpotSub: {
    fontSize: 11,
    color: THEME.textMuted,
    marginTop: 2,
  },
  badgeGps: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 3,
    backgroundColor: THEME.surface2,
    borderWidth: 1,
    borderColor: THEME.line,
  },
  badgeGpsActive: {
    backgroundColor: 'rgba(11, 214, 116, 0.15)',
    borderColor: '#0bd674',
  },
  badgeGpsText: {
    fontSize: 9,
    fontWeight: '800',
    color: THEME.textMuted,
    letterSpacing: 0.5,
  },
  badgeGpsTextActive: {
    color: '#0bd674',
  },
  voteQuestion: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.textMuted,
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  voteButtonsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  voteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: THEME.surface2,
    borderWidth: 1,
    borderColor: THEME.line,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 4,
  },
  voteDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  voteBtnText: {
    color: THEME.text,
    fontSize: 11,
    fontWeight: '700',
  },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.textMuted,
    letterSpacing: 1,
  },
  sectionCount: {
    fontSize: 11,
    color: THEME.textFaint,
    fontWeight: '600',
  },
  reportCard: {
    backgroundColor: THEME.surface,
    borderWidth: 1,
    borderColor: THEME.line,
    borderRadius: 6,
    padding: 14,
    marginBottom: 8,
  },
  reportTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  reportAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reportAuthor: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.text,
  },
  reportTime: {
    fontSize: 11,
    color: THEME.textFaint,
    marginLeft: 4,
  },
  verifiedPill: {
    backgroundColor: 'rgba(11, 214, 116, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 2,
  },
  verifiedText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#0bd674',
    letterSpacing: 0.5,
  },
  reportSpotName: {
    fontSize: 13,
    fontWeight: '800',
    color: THEME.accent,
    marginBottom: 4,
  },
  reportCondition: {
    fontSize: 13,
    color: THEME.textSecondary,
    lineHeight: 18,
    marginBottom: 10,
  },
  reportBottom: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  voteActionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 3,
    backgroundColor: THEME.surface2,
    borderWidth: 1,
    borderColor: THEME.line,
  },
  voteActionText: {
    color: THEME.textSecondary,
    fontSize: 10,
    fontWeight: '700',
  },
});

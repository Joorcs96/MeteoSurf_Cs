import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Modal,
  useWindowDimensions,
} from 'react-native';
import { useSessionStore } from '../../src/store/useSessionStore';
import { useSurfSessionTracker } from '../../src/services/sensors/useSurfSessionTracker';
import { useWatchSessionReceiver } from '../../src/services/watch/useWatchSessionReceiver';
import { SPOTS, Spot } from '../../src/data/spotsData';
import { SurfSession, WaveRide } from '../../src/core/surfTracker/sessionTypes';
import { SurfTrack3DMap } from '../../src/components/map/SurfTrack3DMap';
import { THEME } from '../../src/theme/colors';

export default function TrackingScreen() {
  useSurfSessionTracker();
  useWatchSessionReceiver();

  const isTracking = useSessionStore((state) => state.isTracking);
  const activeSession = useSessionStore((state) => state.activeSession);
  const pastSessions = useSessionStore((state) => state.pastSessions);
  const currentStatus = useSessionStore((state) => state.currentStatus);
  const startSession = useSessionStore((state) => state.startSession);
  const stopSession = useSessionStore((state) => state.stopSession);
  const loadPastSessions = useSessionStore((state) => state.loadPastSessions);

  const { height: screenHeight } = useWindowDimensions();
  const mapHeight = screenHeight * 0.4;

  const [selectedSpotId, setSelectedSpotId] = useState<string>(SPOTS[0].id);
  const [selectedSessionDetail, setSelectedSessionDetail] = useState<SurfSession | null>(null);

  useEffect(() => {
    loadPastSessions();
  }, [loadPastSessions]);

  const selectedSpot = SPOTS.find((s: Spot) => s.id === selectedSpotId) || SPOTS[0];

  const formatTimer = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.max(0, seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const prevStats = useMemo(() => {
    let waves = 0;
    let distanceMeters = 0;
    let seconds = 0;
    for (const session of pastSessions) {
      waves += session.totalWaves;
      distanceMeters += session.totalDistanceMeters;
      seconds += session.durationSeconds;
    }
    return { waves, distanceKm: distanceMeters / 1000, seconds };
  }, [pastSessions]);

  const getStatusLabel = (): string => {
    switch (currentStatus) {
      case 'riding_wave':
        return 'EN LA OLA';
      case 'paddling':
        return 'REMANDO AL PICO';
      case 'waiting':
        return 'ESPERANDO SERIE';
      default:
        return 'EN REPOSO';
    }
  };

  const getStatusColor = (): string => {
    switch (currentStatus) {
      case 'riding_wave':
        return THEME.ratings.fair;
      case 'paddling':
        return THEME.accentMuted;
      case 'waiting':
        return THEME.textFaint;
      default:
        return THEME.textFaint;
    }
  };

  const heartRate = activeSession?.biometrics.currentHeartRate ?? 0;
  const heartRateColor = heartRate > 160 ? THEME.danger : THEME.text;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>SESIONES DE SURF</Text>
          <Text style={styles.headerSubtitle}>TELEMETRIA Y APPLE WATCH</Text>
        </View>

        {isTracking && activeSession ? (
          <View style={styles.activeContainer}>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor() }]}>
              <View style={styles.pulseDot} />
              <Text style={styles.statusBadgeText}>{getStatusLabel()}</Text>
            </View>

            <Text style={styles.timerDisplay}>
              {formatTimer(activeSession.durationSeconds)}
            </Text>
            <Text style={styles.spotActiveLabel}>
              {activeSession.spotName.toUpperCase()}
            </Text>

            <View style={styles.watchPanel}>
              <View style={styles.watchCard}>
                <Text style={styles.watchValue}>{heartRate}</Text>
                <Text style={[styles.watchLabel, { color: heartRateColor }]}>PULSACIONES</Text>
              </View>
              <View style={styles.watchCard}>
                <Text style={styles.watchValue}>
                  {activeSession.biometrics.oxygenSaturation ?? '--'}
                </Text>
                <Text style={styles.watchLabel}>SPO2</Text>
              </View>
              <View style={styles.watchCard}>
                <Text style={styles.watchValue}>
                  {Math.round(activeSession.biometrics.activeCalories)}
                </Text>
                <Text style={styles.watchLabel}>CALORIAS</Text>
              </View>
            </View>

            <View style={styles.metricsGrid}>
              <View style={styles.metricCard}>
                <Text style={styles.metricValue}>
                  {activeSession.gpsTrack.length > 0
                    ? activeSession.gpsTrack[activeSession.gpsTrack.length - 1].speedKmH.toFixed(1)
                    : '0.0'}
                </Text>
                <Text style={styles.metricUnit}>KM/H</Text>
                <Text style={styles.metricLabel}>VELOCIDAD</Text>
                <Text style={styles.metricSub}>
                  Max: {activeSession.topSpeedKmH.toFixed(1)} KM/H
                </Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricValue}>{activeSession.totalWaves}</Text>
                <Text style={styles.metricUnit}>OLAS</Text>
                <Text style={styles.metricLabel}>SURFEADAS</Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricValue}>
                  {(activeSession.totalDistanceMeters / 1000).toFixed(2)}
                </Text>
                <Text style={styles.metricUnit}>KM</Text>
                <Text style={styles.metricLabel}>DISTANCIA</Text>
              </View>
            </View>

            <View style={[styles.mapWrapper, { height: mapHeight }]}>
              <SurfTrack3DMap
                gpsTrack={activeSession.gpsTrack}
                waveRides={activeSession.waveRides}
                spotName={activeSession.spotName}
              />
            </View>

            <TouchableOpacity
              style={styles.stopButton}
              activeOpacity={0.8}
              onPress={() => {
                const finished = stopSession();
                if (finished) setSelectedSessionDetail(finished);
              }}
            >
              <Text style={styles.stopButtonText}>PARAR SESION</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View>
            <View style={styles.startCard}>
              <Text style={styles.cardSectionTitle}>NUEVA SESION EN EL AGUA</Text>
              <Text style={styles.cardDesc}>
                Detecta automaticamente cada ola, velocidad punta, maniobras de giro, remadas
                y frecuencia cardiaca en sincronizacion con tu Apple Watch.
              </Text>

              <Text style={styles.spotSelectLabel}>SELECCIONA PLAYA</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.spotChipsRow}
              >
                {SPOTS.map((spot: Spot) => (
                  <TouchableOpacity
                    key={spot.id}
                    style={[
                      styles.spotChip,
                      selectedSpotId === spot.id && styles.spotChipActive,
                    ]}
                    onPress={() => setSelectedSpotId(spot.id)}
                  >
                    <Text
                      style={[
                        styles.spotChipText,
                        selectedSpotId === spot.id && styles.spotChipTextActive,
                      ]}
                    >
                      {spot.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <TouchableOpacity
                style={styles.startButton}
                activeOpacity={0.8}
                onPress={() => startSession(selectedSpot.id, selectedSpot.name)}
              >
                <Text style={styles.startButtonText}>INICIAR SESION</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.statsCard}>
              <Text style={styles.statsTitle}>TUS ESTADISTICAS PREVIAS</Text>
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{prevStats.waves}</Text>
                  <Text style={styles.statLabel}>OLAS</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{prevStats.distanceKm.toFixed(1)}</Text>
                  <Text style={styles.statLabel}>KM</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{formatTimer(prevStats.seconds)}</Text>
                  <Text style={styles.statLabel}>TIEMPO</Text>
                </View>
              </View>
            </View>

            <View style={styles.historySection}>
              <Text style={styles.sectionTitle}>HISTORIAL DE SESIONES</Text>
              {pastSessions.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyText}>
                    Aun no has registrado ninguna sesion. Inicia una sesion cuando entres al agua
                    para analizar tus olas y telemetria.
                  </Text>
                </View>
              ) : (
                pastSessions.map((s) => (
                  <TouchableOpacity
                    key={s.id}
                    style={styles.sessionHistoryCard}
                    activeOpacity={0.8}
                    onPress={() => setSelectedSessionDetail(s)}
                  >
                    <View style={styles.sessionHeaderRow}>
                      <Text style={styles.sessionSpotName}>{s.spotName.toUpperCase()}</Text>
                      <Text style={styles.sessionDate}>
                        {new Date(s.startTime).toLocaleDateString('es-ES', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                    </View>

                    <View style={styles.sessionMetricsRow}>
                      <View style={styles.sessionMiniMetric}>
                        <Text style={styles.sessionMiniValue}>{s.totalWaves}</Text>
                        <Text style={styles.sessionMiniLabel}>OLAS</Text>
                      </View>
                      <View style={styles.sessionMiniMetric}>
                        <Text style={styles.sessionMiniValue}>{s.topSpeedKmH.toFixed(1)}</Text>
                        <Text style={styles.sessionMiniLabel}>KM/H MAX</Text>
                      </View>
                      <View style={styles.sessionMiniMetric}>
                        <Text style={styles.sessionMiniValue}>
                          {Math.round(s.durationSeconds / 60)}
                        </Text>
                        <Text style={styles.sessionMiniLabel}>MINUTOS</Text>
                      </View>
                      <View style={styles.sessionMiniMetric}>
                        <Text style={styles.sessionMiniValue}>
                          {s.biometrics.avgHeartRate > 0 ? s.biometrics.avgHeartRate : '--'}
                        </Text>
                        <Text style={styles.sessionMiniLabel}>BPM MEDIO</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </View>
          </View>
        )}
      </ScrollView>

      <Modal
        visible={selectedSessionDetail !== null}
        animationType="slide"
        transparent={false}
      >
        <SafeAreaView style={styles.modalContainer}>
          <ScrollView contentContainerStyle={styles.modalScroll}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>
                  {selectedSessionDetail?.spotName.toUpperCase()}
                </Text>
                <Text style={styles.modalSubtitle}>DESGLOSE DE SESION Y OLAS</Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setSelectedSessionDetail(null)}
              >
                <Text style={styles.modalCloseText}>CERRAR</Text>
              </TouchableOpacity>
            </View>

            {selectedSessionDetail && (
              <View>
                <SurfTrack3DMap
                  gpsTrack={selectedSessionDetail.gpsTrack}
                  waveRides={selectedSessionDetail.waveRides}
                  spotName={selectedSessionDetail.spotName}
                />

                <View style={styles.biometricsBanner}>
                  <View style={styles.bioItem}>
                    <Text style={styles.bioValue}>
                      {selectedSessionDetail.biometrics.avgHeartRate > 0
                        ? `${selectedSessionDetail.biometrics.avgHeartRate} BPM`
                        : '--'}
                    </Text>
                    <Text style={styles.bioLabel}>Ritmo Cardiaco Medio</Text>
                  </View>
                  <View style={styles.bioItem}>
                    <Text style={styles.bioValue}>
                      {selectedSessionDetail.biometrics.maxHeartRate > 0
                        ? `${selectedSessionDetail.biometrics.maxHeartRate} BPM`
                        : '--'}
                    </Text>
                    <Text style={styles.bioLabel}>Pico Cardiaco</Text>
                  </View>
                  <View style={styles.bioItem}>
                    <Text style={styles.bioValue}>
                      {selectedSessionDetail.paddlingStrokes}
                    </Text>
                    <Text style={styles.bioLabel}>Remadas</Text>
                  </View>
                </View>

                <Text style={styles.wavesSectionTitle}>
                  OLAS SURFEADAS ({selectedSessionDetail.waveRides.length})
                </Text>

                {selectedSessionDetail.waveRides.length === 0 ? (
                  <Text style={styles.emptyWavesText}>
                    No se detectaron olas sostenidas en esta sesion (umbral superior a 11 KM/H).
                  </Text>
                ) : (
                  selectedSessionDetail.waveRides.map((w: WaveRide) => (
                    <View key={w.id} style={styles.waveItemCard}>
                      <View style={styles.waveHeader}>
                        <Text style={styles.waveNumberText}>OLA #{w.waveNumber}</Text>
                        <Text style={styles.waveTopSpeedText}>
                          {w.topSpeedKmH.toFixed(1)} KM/H
                        </Text>
                      </View>

                      <View style={styles.waveMetricsRow}>
                        <Text style={styles.waveMetricText}>
                          Distancia: <Text style={styles.boldText}>{w.distanceMeters} M</Text>
                        </Text>
                        <Text style={styles.waveMetricText}>
                          Duracion: <Text style={styles.boldText}>{w.durationSeconds} S</Text>
                        </Text>
                        <Text style={styles.waveMetricText}>
                          Maniobras: <Text style={styles.boldText}>{w.turnsCount} giros</Text>
                        </Text>
                      </View>

                      {w.turns.length > 0 && (
                        <View style={styles.turnsContainer}>
                          {w.turns.map((t, idx) => (
                            <View key={idx} style={styles.turnBadge}>
                              <Text style={styles.turnBadgeText}>
                                {t.type.replace('_', ' ').toUpperCase()} ({t.angleDeg}°)
                              </Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  ))
                )}
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.bg,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 20,
    marginTop: 8,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: THEME.text,
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.accent,
    marginTop: 2,
    letterSpacing: 1,
  },
  activeContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 16,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: THEME.text,
    marginRight: 8,
  },
  statusBadgeText: {
    color: THEME.text,
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 0.8,
  },
  timerDisplay: {
    fontSize: 56,
    fontWeight: '900',
    color: THEME.text,
    letterSpacing: 2,
    marginBottom: 4,
  },
  spotActiveLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.textSecondary,
    letterSpacing: 1,
    marginBottom: 14,
  },
  watchPanel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 14,
  },
  watchCard: {
    width: '30%',
    backgroundColor: THEME.surface2,
    borderColor: THEME.line,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  watchValue: {
    fontSize: 20,
    fontWeight: '900',
    color: THEME.text,
  },
  watchLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  metricsGrid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  metricCard: {
    width: '32%',
    backgroundColor: THEME.surface2,
    borderColor: THEME.line,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  metricValue: {
    fontSize: 26,
    fontWeight: '900',
    color: THEME.text,
  },
  metricUnit: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.textSecondary,
    marginTop: -2,
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.textSecondary,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  metricSub: {
    fontSize: 10,
    color: THEME.textFaint,
    marginTop: 4,
    textAlign: 'center',
  },
  mapWrapper: {
    width: '100%',
    overflow: 'hidden',
    borderRadius: 14,
    borderColor: THEME.line,
    borderWidth: 1,
    marginBottom: 18,
  },
  stopButton: {
    width: '100%',
    backgroundColor: THEME.danger,
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
  },
  stopButtonText: {
    color: THEME.text,
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: 1,
  },
  startCard: {
    backgroundColor: THEME.surface2,
    borderColor: THEME.line,
    borderWidth: 1,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    alignItems: 'center',
  },
  cardSectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: THEME.text,
    marginBottom: 6,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  cardDesc: {
    fontSize: 13,
    color: THEME.textSecondary,
    lineHeight: 18,
    marginBottom: 16,
    textAlign: 'center',
  },
  spotSelectLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.textFaint,
    letterSpacing: 0.8,
    marginBottom: 10,
    alignSelf: 'flex-start',
  },
  spotChipsRow: {
    marginBottom: 18,
  },
  spotChip: {
    backgroundColor: THEME.surface3,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    marginRight: 8,
    borderWidth: 1,
    borderColor: THEME.line,
  },
  spotChipActive: {
    backgroundColor: THEME.accentMuted,
    borderColor: THEME.accentMuted,
  },
  spotChipText: {
    color: THEME.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  spotChipTextActive: {
    color: THEME.text,
    fontWeight: '700',
  },
  startButton: {
    width: '100%',
    backgroundColor: 'transparent',
    borderColor: THEME.accent,
    borderWidth: 2,
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
  },
  startButtonText: {
    color: THEME.accent,
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: 1,
  },
  statsCard: {
    backgroundColor: THEME.surface2,
    borderColor: THEME.line,
    borderWidth: 1,
    borderRadius: 14,
    padding: 18,
    marginBottom: 24,
    alignItems: 'center',
  },
  statsTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: THEME.text,
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '900',
    color: THEME.accent,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.textFaint,
    marginTop: 4,
  },
  historySection: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: THEME.textFaint,
    letterSpacing: 1,
    marginBottom: 12,
  },
  emptyCard: {
    backgroundColor: THEME.surface2,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.line,
  },
  emptyText: {
    color: THEME.textFaint,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
  sessionHistoryCard: {
    backgroundColor: THEME.surface2,
    borderColor: THEME.line,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  sessionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sessionSpotName: {
    fontSize: 14,
    fontWeight: '800',
    color: THEME.accent,
    letterSpacing: 0.5,
  },
  sessionDate: {
    fontSize: 12,
    color: THEME.textFaint,
  },
  sessionMetricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopColor: THEME.line,
    borderTopWidth: 1,
    paddingTop: 10,
  },
  sessionMiniMetric: {
    alignItems: 'center',
  },
  sessionMiniValue: {
    fontSize: 16,
    fontWeight: '800',
    color: THEME.text,
  },
  sessionMiniLabel: {
    fontSize: 10,
    color: THEME.textFaint,
    marginTop: 2,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: THEME.bg,
  },
  modalScroll: {
    padding: 18,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: THEME.text,
    letterSpacing: 0.5,
  },
  modalSubtitle: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.accent,
    letterSpacing: 1,
  },
  modalCloseButton: {
    backgroundColor: THEME.surface2,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.line,
  },
  modalCloseText: {
    color: THEME.textSecondary,
    fontWeight: '700',
    fontSize: 11,
  },
  biometricsBanner: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: THEME.surface2,
    borderColor: THEME.line,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
  },
  bioItem: {
    alignItems: 'center',
  },
  bioValue: {
    fontSize: 16,
    fontWeight: '800',
    color: THEME.text,
  },
  bioLabel: {
    fontSize: 10,
    color: THEME.textFaint,
    marginTop: 2,
  },
  wavesSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: THEME.textFaint,
    letterSpacing: 1,
    marginBottom: 12,
  },
  emptyWavesText: {
    color: THEME.textFaint,
    fontSize: 13,
    fontStyle: 'italic',
  },
  waveItemCard: {
    backgroundColor: THEME.surface2,
    borderColor: THEME.line,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  waveHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  waveNumberText: {
    fontSize: 14,
    fontWeight: '800',
    color: THEME.accent,
  },
  waveTopSpeedText: {
    fontSize: 15,
    fontWeight: '900',
    color: THEME.ratings.fair,
  },
  waveMetricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  waveMetricText: {
    fontSize: 12,
    color: THEME.textSecondary,
  },
  boldText: {
    color: THEME.text,
    fontWeight: '700',
  },
  turnsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 6,
    borderTopColor: THEME.line,
    borderTopWidth: 1,
    paddingTop: 8,
  },
  turnBadge: {
    backgroundColor: THEME.surface3,
    borderColor: THEME.accentMuted,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: 6,
    marginBottom: 4,
  },
  turnBadgeText: {
    color: THEME.accent,
    fontSize: 10,
    fontWeight: '700',
  },
});

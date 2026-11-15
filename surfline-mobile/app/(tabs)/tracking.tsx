import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Modal,
} from 'react-native';
import { useSessionStore } from '../../src/store/useSessionStore';
import { useSurfSessionTracker } from '../../src/services/sensors/useSurfSessionTracker';
import { SPOTS, Spot } from '../../src/data/spotsData';
import { SurfSession, WaveRide } from '../../src/core/surfTracker/sessionTypes';
import { SurfTrack3DMap } from '../../src/components/map/SurfTrack3DMap';

export default function TrackingScreen() {
  // Activa sensores automáticos (GPS, acelerómetro y giroscopio) cuando isTracking es true
  useSurfSessionTracker();

  const isTracking = useSessionStore((state) => state.isTracking);
  const activeSession = useSessionStore((state) => state.activeSession);
  const pastSessions = useSessionStore((state) => state.pastSessions);
  const currentStatus = useSessionStore((state) => state.currentStatus);
  const startSession = useSessionStore((state) => state.startSession);
  const stopSession = useSessionStore((state) => state.stopSession);
  const loadPastSessions = useSessionStore((state) => state.loadPastSessions);

  const [selectedSpotId, setSelectedSpotId] = useState<string>('planetario');
  const [selectedSessionDetail, setSelectedSessionDetail] = useState<SurfSession | null>(null);

  useEffect(() => {
    loadPastSessions();
  }, [loadPastSessions]);

  const selectedSpot = SPOTS.find((s: Spot) => s.id === selectedSpotId) || SPOTS[0];

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusLabel = () => {
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

  const getStatusColor = () => {
    switch (currentStatus) {
      case 'riding_wave':
        return '#10b981'; // Verde esmeralda
      case 'paddling':
        return '#0284c7'; // Azul océano
      case 'waiting':
        return '#64748b'; // Pizarra neutro
      default:
        return '#475569';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Cabecera */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>TRACKING DE SESIÓN</Text>
          <Text style={styles.headerSubtitle}>TELEMETRÍA Y APPLE WATCH</Text>
        </View>

        {isTracking && activeSession ? (
          /* ============================================== */
          /* MODO SESIÓN ACTIVA (HUD EN TIEMPO REAL)        */
          /* ============================================== */
          <View style={styles.activeContainer}>
            {/* Indicador de Estado Dinámico */}
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor() }]}>
              <View style={styles.pulseDot} />
              <Text style={styles.statusBadgeText}>{getStatusLabel()}</Text>
            </View>

            {/* Cronómetro Central */}
            <Text style={styles.timerDisplay}>
              {formatTimer(activeSession.durationSeconds)}
            </Text>
            <Text style={styles.spotActiveLabel}>{activeSession.spotName.toUpperCase()}</Text>

            {/* Rejilla de Métricas en Vivo */}
            <View style={styles.metricsGrid}>
              {/* Olas */}
              <View style={styles.metricCardPrimary}>
                <Text style={styles.metricValueLarge}>{activeSession.totalWaves}</Text>
                <Text style={styles.metricLabel}>OLAS SURFEADAS</Text>
              </View>

              {/* Velocidad */}
              <View style={styles.metricCard}>
                <Text style={styles.metricValue}>
                  {activeSession.gpsTrack.length > 0
                    ? activeSession.gpsTrack[activeSession.gpsTrack.length - 1].speedKmH.toFixed(1)
                    : '0.0'}
                </Text>
                <Text style={styles.metricUnit}>km/h</Text>
                <Text style={styles.metricLabel}>VELOCIDAD ACTUAL</Text>
                <Text style={styles.metricSub}>Máx: {activeSession.topSpeedKmH.toFixed(1)} km/h</Text>
              </View>

              {/* Pulsaciones (Apple Watch / Sensor) */}
              <View style={styles.metricCard}>
                <Text style={[styles.metricValue, { color: '#f43f5e' }]}>
                  {activeSession.biometrics.currentHeartRate > 0
                    ? activeSession.biometrics.currentHeartRate
                    : '--'}
                </Text>
                <Text style={styles.metricUnit}>bpm</Text>
                <Text style={styles.metricLabel}>PULSACIONES</Text>
                <Text style={styles.metricSub}>
                  {activeSession.biometrics.oxygenSaturation
                    ? `SpO2: ${activeSession.biometrics.oxygenSaturation}%`
                    : 'Apple Watch activo'}
                </Text>
              </View>

              {/* Remadas */}
              <View style={styles.metricCard}>
                <Text style={styles.metricValue}>{activeSession.paddlingStrokes}</Text>
                <Text style={styles.metricUnit}>brazadas</Text>
                <Text style={styles.metricLabel}>REMADAS</Text>
                <Text style={styles.metricSub}>
                  Distancia: {(activeSession.totalDistanceMeters / 1000).toFixed(2)} km
                </Text>
              </View>
            </View>

            {/* Mapa 3D del Recorrido en Tiempo Real */}
            <SurfTrack3DMap
              gpsTrack={activeSession.gpsTrack}
              waveRides={activeSession.waveRides}
              spotName={activeSession.spotName}
            />

            {/* Botón Finalizar Sesión */}
            <TouchableOpacity
              style={styles.stopButton}
              activeOpacity={0.8}
              onPress={() => {
                const finished = stopSession();
                if (finished) setSelectedSessionDetail(finished);
              }}
            >
              <Text style={styles.stopButtonText}>FINALIZAR Y GUARDAR SESIÓN</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* ============================================== */
          /* MODO PREVIO A SESIÓN / HISTORIAL               */
          /* ============================================== */
          <View>
            {/* Tarjeta de Inicio de Sesión */}
            <View style={styles.startCard}>
              <Text style={styles.cardSectionTitle}>NUEVA SESIÓN EN EL AGUA</Text>
              <Text style={styles.cardDesc}>
                Detecta automáticamente cada ola, velocidad punta, maniobras de giro, remadas
                y frecuencia cardíaca en sincronización con tu Apple Watch.
              </Text>

              {/* Selector de Spot */}
              <Text style={styles.spotSelectLabel}>SELECCIONA PLAYA / SPOT</Text>
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

              {/* Botón Iniciar */}
              <TouchableOpacity
                style={styles.startButton}
                activeOpacity={0.8}
                onPress={() => startSession(selectedSpot.id, selectedSpot.name)}
              >
                <Text style={styles.startButtonText}>ENTRAR AL AGUA · INICIAR</Text>
              </TouchableOpacity>
            </View>

            {/* Historial de Sesiones */}
            <View style={styles.historySection}>
              <Text style={styles.sectionTitle}>HISTORIAL DE SESIONES</Text>
              {pastSessions.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyText}>
                    Aún no has registrado ninguna sesión. Inicia una sesión cuando entres al agua
                    para analizar tus olas y telemetría.
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
                        <Text style={styles.sessionMiniLabel}>Olas</Text>
                      </View>
                      <View style={styles.sessionMiniMetric}>
                        <Text style={styles.sessionMiniValue}>{s.topSpeedKmH.toFixed(1)}</Text>
                        <Text style={styles.sessionMiniLabel}>km/h máx</Text>
                      </View>
                      <View style={styles.sessionMiniMetric}>
                        <Text style={styles.sessionMiniValue}>{Math.round(s.durationSeconds / 60)}</Text>
                        <Text style={styles.sessionMiniLabel}>minutos</Text>
                      </View>
                      <View style={styles.sessionMiniMetric}>
                        <Text style={styles.sessionMiniValue}>
                          {s.biometrics.avgHeartRate > 0 ? s.biometrics.avgHeartRate : '--'}
                        </Text>
                        <Text style={styles.sessionMiniLabel}>bpm medio</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Modal Detalle de Sesión y Olas */}
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
                <Text style={styles.modalSubtitle}>DESGLOSE DE SESIÓN Y OLAS</Text>
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
                {/* Mapa 3D del Recorrido con Olas y Relieve */}
                <SurfTrack3DMap
                  gpsTrack={selectedSessionDetail.gpsTrack}
                  waveRides={selectedSessionDetail.waveRides}
                  spotName={selectedSessionDetail.spotName}
                />

                {/* Resumen Biométrico */}
                <View style={styles.biometricsBanner}>
                  <View style={styles.bioItem}>
                    <Text style={styles.bioValue}>
                      {selectedSessionDetail.biometrics.avgHeartRate > 0
                        ? `${selectedSessionDetail.biometrics.avgHeartRate} bpm`
                        : '--'}
                    </Text>
                    <Text style={styles.bioLabel}>Ritmo Cardíaco Medio</Text>
                  </View>
                  <View style={styles.bioItem}>
                    <Text style={styles.bioValue}>
                      {selectedSessionDetail.biometrics.maxHeartRate > 0
                        ? `${selectedSessionDetail.biometrics.maxHeartRate} bpm`
                        : '--'}
                    </Text>
                    <Text style={styles.bioLabel}>Pico Cardíaco</Text>
                  </View>
                  <View style={styles.bioItem}>
                    <Text style={styles.bioValue}>
                      {selectedSessionDetail.paddlingStrokes}
                    </Text>
                    <Text style={styles.bioLabel}>Remadas</Text>
                  </View>
                </View>

                {/* Lista de Olas Surfeadas */}
                <Text style={styles.wavesSectionTitle}>
                  OLAS SURFEADAS ({selectedSessionDetail.waveRides.length})
                </Text>

                {selectedSessionDetail.waveRides.length === 0 ? (
                  <Text style={styles.emptyWavesText}>
                    No se detectaron olas sostenidas en esta sesión (umbral superior a 11 km/h).
                  </Text>
                ) : (
                  selectedSessionDetail.waveRides.map((w: WaveRide) => (
                    <View key={w.id} style={styles.waveItemCard}>
                      <View style={styles.waveHeader}>
                        <Text style={styles.waveNumberText}>OLA #{w.waveNumber}</Text>
                        <Text style={styles.waveTopSpeedText}>{w.topSpeedKmH.toFixed(1)} km/h</Text>
                      </View>

                      <View style={styles.waveMetricsRow}>
                        <Text style={styles.waveMetricText}>
                          Distancia: <Text style={styles.boldText}>{w.distanceMeters} m</Text>
                        </Text>
                        <Text style={styles.waveMetricText}>
                          Duración: <Text style={styles.boldText}>{w.durationSeconds} s</Text>
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
    backgroundColor: '#0a1628',
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
    color: '#f8fafc',
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#38bdf8',
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
    backgroundColor: '#ffffff',
    marginRight: 8,
  },
  statusBadgeText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 0.8,
  },
  timerDisplay: {
    fontSize: 54,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 2,
  },
  spotActiveLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#94a3b8',
    letterSpacing: 1,
    marginBottom: 24,
  },
  metricsGrid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  metricCardPrimary: {
    width: '100%',
    backgroundColor: '#0f2744',
    borderColor: '#0284c7',
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 12,
  },
  metricCard: {
    width: '48%',
    backgroundColor: '#132035',
    borderColor: '#1e293b',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  metricValueLarge: {
    fontSize: 48,
    fontWeight: '900',
    color: '#38bdf8',
  },
  metricValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#f8fafc',
  },
  metricUnit: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94a3b8',
    marginTop: -2,
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#cbd5e1',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  metricSub: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 4,
  },
  stopButton: {
    width: '100%',
    backgroundColor: '#e11d48',
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
  },
  stopButtonText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 1,
  },
  startCard: {
    backgroundColor: '#132035',
    borderColor: '#1e293b',
    borderWidth: 1,
    borderRadius: 16,
    padding: 18,
    marginBottom: 28,
  },
  cardSectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#f8fafc',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  cardDesc: {
    fontSize: 13,
    color: '#94a3b8',
    lineHeight: 18,
    marginBottom: 16,
  },
  spotSelectLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  spotChipsRow: {
    marginBottom: 20,
  },
  spotChip: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    marginRight: 8,
  },
  spotChipActive: {
    backgroundColor: '#0284c7',
  },
  spotChipText: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '600',
  },
  spotChipTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  startButton: {
    backgroundColor: '#0284c7',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  startButtonText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 1,
  },
  historySection: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 1,
    marginBottom: 12,
  },
  emptyCard: {
    backgroundColor: '#132035',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    color: '#64748b',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
  sessionHistoryCard: {
    backgroundColor: '#132035',
    borderColor: '#1e293b',
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
    color: '#38bdf8',
    letterSpacing: 0.5,
  },
  sessionDate: {
    fontSize: 12,
    color: '#64748b',
  },
  sessionMetricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopColor: '#1e293b',
    borderTopWidth: 1,
    paddingTop: 10,
  },
  sessionMiniMetric: {
    alignItems: 'center',
  },
  sessionMiniValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#f8fafc',
  },
  sessionMiniLabel: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#0a1628',
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
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  modalSubtitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#38bdf8',
    letterSpacing: 1,
  },
  modalCloseButton: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  modalCloseText: {
    color: '#94a3b8',
    fontWeight: '700',
    fontSize: 11,
  },
  biometricsBanner: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#132035',
    borderColor: '#1e293b',
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
    color: '#f8fafc',
  },
  bioLabel: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
  },
  wavesSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 1,
    marginBottom: 12,
  },
  emptyWavesText: {
    color: '#64748b',
    fontSize: 13,
    fontStyle: 'italic',
  },
  waveItemCard: {
    backgroundColor: '#132035',
    borderColor: '#1e293b',
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
    color: '#38bdf8',
  },
  waveTopSpeedText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#10b981',
  },
  waveMetricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  waveMetricText: {
    fontSize: 12,
    color: '#94a3b8',
  },
  boldText: {
    color: '#f8fafc',
    fontWeight: '700',
  },
  turnsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 6,
    borderTopColor: '#1e293b',
    borderTopWidth: 1,
    paddingTop: 8,
  },
  turnBadge: {
    backgroundColor: '#0f2744',
    borderColor: '#0284c7',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: 6,
    marginBottom: 4,
  },
  turnBadgeText: {
    color: '#38bdf8',
    fontSize: 10,
    fontWeight: '700',
  },
});

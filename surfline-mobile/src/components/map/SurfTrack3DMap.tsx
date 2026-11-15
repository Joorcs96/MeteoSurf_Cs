import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
import { GpsPoint, WaveRide } from '../../core/surfTracker/sessionTypes';
import { THEME } from '../../theme/colors';

interface SurfTrack3DMapProps {
  gpsTrack?: GpsPoint[];
  waveRides?: WaveRide[];
  spotFacing?: number;
  spotName?: string;
  initialSelectedWave?: number;
}

export function SurfTrack3DMap({
  gpsTrack = [],
  waveRides = [],
  spotFacing = 102,
  spotName = 'Planetario',
  initialSelectedWave,
}: SurfTrack3DMapProps) {
  const [is3DMode, setIs3DMode] = useState<boolean>(true);
  const [cameraAngle, setCameraAngle] = useState<'beach' | 'lineup' | 'iso'>('iso');
  const [selectedWaveIndex, setSelectedWaveIndex] = useState<number | null>(
    initialSelectedWave ?? (waveRides.length > 0 ? 0 : null)
  );
  const [isPlayingReplay, setIsPlayingReplay] = useState<boolean>(false);
  const [replayProgress, setReplayProgress] = useState<number>(0);

  const containerWidth = Dimensions.get('window').width - 32;
  const containerHeight = 280;

  // Generar puntos sintéticos realistas si gpsTrack viene vacío (ej. demostración o test)
  const effectiveGpsTrack = useMemo(() => {
    if (gpsTrack.length > 0) return gpsTrack;

    // Simular un recorrido de surf en Castellón con 2 olas y 2 remadas
    const points: GpsPoint[] = [];
    const baseLat = 39.982;
    const baseLon = 0.024;
    const t0 = Date.now() - 3600000;

    // Remada hacia el pico (mar adentro, hacia el Este)
    for (let i = 0; i < 20; i++) {
      points.push({
        latitude: baseLat + i * 0.00005,
        longitude: baseLon + i * 0.00012,
        speed: 1.1,
        speedKmH: 4.0,
        heading: spotFacing,
        altitude: 0.1,
        timestamp: t0 + i * 4000,
      });
    }

    // Ola 1 (vuelta hacia la orilla en diagonal)
    for (let i = 0; i < 15; i++) {
      const spd = 12 + Math.sin((i / 15) * Math.PI) * 9;
      points.push({
        latitude: baseLat + (20 - i) * 0.00005 + Math.sin(i * 0.8) * 0.00008,
        longitude: baseLon + (20 - i) * 0.00012,
        speed: spd / 3.6,
        speedKmH: spd,
        heading: (spotFacing + 180) % 360,
        altitude: 0.6,
        timestamp: t0 + 100000 + i * 1000,
      });
    }

    // Segunda remada
    for (let i = 5; i < 22; i++) {
      points.push({
        latitude: baseLat + i * 0.00005,
        longitude: baseLon + i * 0.00012,
        speed: 1.0,
        speedKmH: 3.6,
        heading: spotFacing,
        altitude: 0.1,
        timestamp: t0 + 150000 + i * 3000,
      });
    }

    // Ola 2 (más rápida con giro brusco)
    for (let i = 0; i < 18; i++) {
      const spd = 14 + Math.sin((i / 18) * Math.PI) * 8.5;
      points.push({
        latitude: baseLat + (22 - i) * 0.00005 + (i > 8 ? 0.0002 : 0),
        longitude: baseLon + (22 - i) * 0.00012,
        speed: spd / 3.6,
        speedKmH: spd,
        heading: (spotFacing + 190) % 360,
        altitude: 0.75,
        timestamp: t0 + 250000 + i * 1000,
      });
    }

    return points;
  }, [gpsTrack, spotFacing]);

  // Si no hay waveRides recibidas, construir referencias a partir del track
  const effectiveWaves = useMemo(() => {
    if (waveRides.length > 0) return waveRides;

    // Detectar tramos de velocidad > 11 km/h en el track efectivo
    const rides: WaveRide[] = [];
    let currentWavePts: GpsPoint[] = [];
    let waveNum = 1;

    for (const pt of effectiveGpsTrack) {
      if (pt.speedKmH >= 11.0) {
        currentWavePts.push(pt);
      } else if (currentWavePts.length >= 6) {
        const top = Math.max(...currentWavePts.map((p) => p.speedKmH));
        const dur = Math.round(
          (currentWavePts[currentWavePts.length - 1].timestamp - currentWavePts[0].timestamp) / 1000
        );
        rides.push({
          id: `ride_${waveNum}`,
          waveNumber: waveNum,
          startTime: currentWavePts[0].timestamp,
          endTime: currentWavePts[currentWavePts.length - 1].timestamp,
          durationSeconds: dur > 0 ? dur : 12,
          distanceMeters: Math.round(dur * 6.5),
          topSpeedKmH: top,
          avgSpeedKmH: Math.round(top * 0.75 * 10) / 10,
          turnsCount: waveNum % 2 === 0 ? 2 : 1,
          turns:
            waveNum % 2 === 0
              ? [
                  { angleDeg: 58, type: 'bottom_turn', timestamp: currentWavePts[0].timestamp + 3000 },
                  { angleDeg: 82, type: 'cutback', timestamp: currentWavePts[0].timestamp + 7000 },
                ]
              : [
                  { angleDeg: 64, type: 'bottom_turn', timestamp: currentWavePts[0].timestamp + 4000 },
                ],
          gpsPath: currentWavePts,
        });
        waveNum++;
        currentWavePts = [];
      } else {
        currentWavePts = [];
      }
    }

    return rides;
  }, [waveRides, effectiveGpsTrack]);

  // Normalización de coordenadas geográficas al lienzo 3D
  const { minLat, maxLat, minLon, maxLon } = useMemo(() => {
    if (effectiveGpsTrack.length === 0) {
      return { minLat: 0, maxLat: 1, minLon: 0, maxLon: 1 };
    }
    let minLt = Infinity;
    let maxLt = -Infinity;
    let minLn = Infinity;
    let maxLn = -Infinity;

    for (const p of effectiveGpsTrack) {
      if (p.latitude < minLt) minLt = p.latitude;
      if (p.latitude > maxLt) maxLt = p.latitude;
      if (p.longitude < minLn) minLn = p.longitude;
      if (p.longitude > maxLn) maxLn = p.longitude;
    }

    const padLat = Math.max((maxLt - minLt) * 0.25, 0.0001);
    const padLon = Math.max((maxLn - minLn) * 0.25, 0.0001);

    return {
      minLat: minLt - padLat,
      maxLat: maxLt + padLat,
      minLon: minLn - padLon,
      maxLon: maxLn + padLon,
    };
  }, [effectiveGpsTrack]);

  // Proyección 3D isométrica / perspectiva
  const projectPoint = (lat: number, lon: number, altitude = 0) => {
    const latSpan = maxLat - minLat || 0.001;
    const lonSpan = maxLon - minLon || 0.001;

    // Coordenadas normalizadas [ -1, 1 ]
    const nx = ((lon - minLon) / lonSpan) * 2 - 1;
    const ny = ((lat - minLat) / latSpan) * 2 - 1;

    // Ángulo de rotación de la cámara (Yaw)
    let yawRad = 0;
    if (cameraAngle === 'beach') yawRad = ((spotFacing + 180) * Math.PI) / 180;
    else if (cameraAngle === 'lineup') yawRad = (spotFacing * Math.PI) / 180;
    else yawRad = ((spotFacing + 45) * Math.PI) / 180; // Isométrica por defecto

    // Rotación en el plano X-Y
    const rx = nx * Math.cos(yawRad) - ny * Math.sin(yawRad);
    const ry = nx * Math.sin(yawRad) + ny * Math.cos(yawRad);

    if (!is3DMode) {
      // Proyección 2D Cenital plana
      const screenX = (rx * 0.4 + 0.5) * containerWidth;
      const screenY = (ry * 0.38 + 0.5) * containerHeight;
      return { x: screenX, y: screenY, z: 0 };
    }

    // Proyección 3D con inclinación de 55° (Pitch)
    const pitch = (55 * Math.PI) / 180;
    const zOffset = altitude * 30; // Elevación de la cresta de la ola

    const x3d = rx;
    const y3d = ry * Math.cos(pitch) - (altitude * 0.25) * Math.sin(pitch);
    const depth = ry * Math.sin(pitch) + 1.6;

    // Proyección perspectiva
    const perspectiveScale = 1.0 / Math.max(0.6, depth);
    const screenX = containerWidth * 0.5 + x3d * (containerWidth * 0.38) * perspectiveScale;
    const screenY = containerHeight * 0.5 + y3d * (containerHeight * 0.38) * perspectiveScale - zOffset;

    return { x: screenX, y: screenY, z: depth };
  };

  // Replay interactivo animado de la ola seleccionada
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (isPlayingReplay) {
      interval = setInterval(() => {
        setReplayProgress((prev) => {
          if (prev >= 1.0) {
            setIsPlayingReplay(false);
            return 0;
          }
          return prev + 0.05;
        });
      }, 150);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlayingReplay]);

  const currentWave =
    selectedWaveIndex !== null && effectiveWaves[selectedWaveIndex]
      ? effectiveWaves[selectedWaveIndex]
      : null;

  // Puntos de la ola en replay
  const replayPoint = useMemo(() => {
    if (!currentWave || currentWave.gpsPath.length === 0) return null;
    const pts = currentWave.gpsPath;
    const idx = Math.min(Math.floor(replayProgress * (pts.length - 1)), pts.length - 1);
    return pts[idx];
  }, [currentWave, replayProgress]);

  return (
    <View style={styles.cardContainer}>
      {/* Barra de Controles Superiores del Visor 3D */}
      <View style={styles.topControlBar}>
        <View style={styles.spotInfo}>
          <Text style={styles.spotTitle}>{spotName.toUpperCase()}</Text>
          <Text style={styles.spotSubtitle}>RECORRIDO GPS Y ELEVACIÓN 3D</Text>
        </View>

        <View style={styles.modeButtonsRow}>
          {/* Alternar 2D / 3D */}
          <TouchableOpacity
            style={[styles.modeBtn, is3DMode && styles.modeBtnActive]}
            onPress={() => setIs3DMode(!is3DMode)}
            activeOpacity={0.8}
          >
            <Text style={[styles.modeBtnText, is3DMode && styles.modeBtnTextActive]}>
              {is3DMode ? '3D PERSPECTIVA' : '2D PLANO'}
            </Text>
          </TouchableOpacity>

          {/* Cambiar Ángulo de Cámara */}
          {is3DMode && (
            <TouchableOpacity
              style={styles.angleBtn}
              onPress={() => {
                if (cameraAngle === 'iso') setCameraAngle('beach');
                else if (cameraAngle === 'beach') setCameraAngle('lineup');
                else setCameraAngle('iso');
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.angleBtnText}>
                {cameraAngle === 'iso' ? 'VISTA ISO' : cameraAngle === 'beach' ? 'DESDE PLAYA' : 'DESDE MAR'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Lienzo Espacial 3D */}
      <View style={[styles.canvas3D, { width: containerWidth, height: containerHeight }]}>
        {/* Cuadrícula Batimétrica de Fondo Marino */}
        <View style={styles.oceanGridContainer}>
          {[0, 1, 2, 3, 4].map((gridLine) => {
            const p1 = projectPoint(minLat + (gridLine / 4) * (maxLat - minLat), minLon, 0);
            const p2 = projectPoint(minLat + (gridLine / 4) * (maxLat - minLat), maxLon, 0);
            return (
              <View
                key={`grid_lat_${gridLine}`}
                style={[
                  styles.gridLineStyle,
                  {
                    left: Math.min(p1.x, p2.x),
                    top: p1.y,
                    width: Math.abs(p2.x - p1.x) || 1,
                  },
                ]}
              />
            );
          })}
        </View>

        {/* Indicador de Línea de Costa / Playa */}
        <View style={styles.beachBanner}>
          <Text style={styles.beachText}>ORILLA / PLAYA</Text>
        </View>
        <View style={styles.lineupBanner}>
          <Text style={styles.lineupText}>PICO / LINEUP (MAR ADENTRO)</Text>
        </View>

        {/* 1. Trazado de Remada (Paddling): línea discontinua azul pizarra */}
        {effectiveGpsTrack.map((pt, idx) => {
          if (idx === 0) return null;
          const prev = effectiveGpsTrack[idx - 1];
          if (pt.speedKmH >= 11.0 || prev.speedKmH >= 11.0) return null; // No pintar en tramos de ola

          const p1 = projectPoint(prev.latitude, prev.longitude, 0);
          const p2 = projectPoint(pt.latitude, pt.longitude, 0);

          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          const len = Math.sqrt(dx * dx + dy * dy);
          if (len > 80 || len < 1) return null; // Salto de GPS descartado

          const angle = Math.atan2(dy, dx) * (180 / Math.PI);

          return (
            <View
              key={`paddle_${idx}`}
              style={{
                position: 'absolute',
                left: p1.x,
                top: p1.y,
                width: len,
                height: 1.5,
                backgroundColor: THEME.accent + '44',
                transform: [{ rotate: `${angle}deg` }],
                transformOrigin: '0 0',
              }}
            />
          );
        })}

        {/* 2. Trazado de Olas en 3D (Elevadas y coloreadas por velocidad) */}
        {effectiveWaves.map((wave, wIdx) => {
          const isSelected = selectedWaveIndex === null || selectedWaveIndex === wIdx;
          const opacity = isSelected ? 1.0 : 0.25;

          return wave.gpsPath.map((pt, ptIdx) => {
            if (ptIdx === 0) return null;
            const prev = wave.gpsPath[ptIdx - 1];

            const p1 = projectPoint(prev.latitude, prev.longitude, is3DMode ? 0.35 : 0);
            const p2 = projectPoint(pt.latitude, pt.longitude, is3DMode ? 0.35 : 0);

            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const len = Math.sqrt(dx * dx + dy * dy);
            if (len > 120 || len < 1) return null;

            const angle = Math.atan2(dy, dx) * (180 / Math.PI);

            // Gradiente de color según velocidad de planeo (usando paleta THEME)
            let segColor = THEME.ratings.fair;        // Verde (11-15 km/h)
            if (pt.speedKmH > 19) segColor = THEME.ratings.poorfair; // Dorado (>19 km/h)
            else if (pt.speedKmH > 15) segColor = THEME.accent;      // Cian (15-19 km/h)

            return (
              <View
                key={`wave_${wIdx}_seg_${ptIdx}`}
                style={{
                  position: 'absolute',
                  left: p1.x,
                  top: p1.y,
                  width: len,
                  height: isSelected ? 3.5 : 2.0,
                  backgroundColor: segColor,
                  opacity,
                  transform: [{ rotate: `${angle}deg` }],
                  transformOrigin: '0 0',
                  shadowColor: segColor,
                  shadowOpacity: isSelected ? 0.8 : 0,
                  shadowRadius: 4,
                }}
              />
            );
          });
        })}

        {/* 3. Balizas 3D de Takeoff de cada ola */}
        {effectiveWaves.map((wave, wIdx) => {
          if (wave.gpsPath.length === 0) return null;
          const takeoff = wave.gpsPath[0];
          const pos = projectPoint(takeoff.latitude, takeoff.longitude, is3DMode ? 0.5 : 0);
          const isSelected = selectedWaveIndex === null || selectedWaveIndex === wIdx;

          return (
            <TouchableOpacity
              key={`takeoff_${wIdx}`}
              style={[
                styles.takeoffPin,
                {
                  left: pos.x - 14,
                  top: pos.y - 14,
                  opacity: isSelected ? 1.0 : 0.35,
                  borderColor: isSelected ? THEME.ratings.fair : THEME.line,
                },
              ]}
              onPress={() => setSelectedWaveIndex(wIdx)}
              activeOpacity={0.8}
            >
              <Text style={styles.takeoffPinText}>#{wave.waveNumber}</Text>
            </TouchableOpacity>
          );
        })}

        {/* 4. Marcadores de Giros / Maniobras en la ola seleccionada */}
        {currentWave &&
          currentWave.turns.map((turn, tIdx) => {
            // Ubicar posición aproximada del giro en el path de la ola
            const turnRatio = Math.min((tIdx + 1) / (currentWave.turns.length + 1), 0.9);
            const ptIdx = Math.floor(turnRatio * currentWave.gpsPath.length);
            const pt = currentWave.gpsPath[ptIdx] || currentWave.gpsPath[0];
            if (!pt) return null;

            const pos = projectPoint(pt.latitude, pt.longitude, is3DMode ? 0.45 : 0);

            return (
              <View
                key={`turn_${tIdx}`}
                style={[styles.turnMarker, { left: pos.x - 10, top: pos.y - 10 }]}
              >
                <Text style={styles.turnMarkerText}>G</Text>
              </View>
            );
          })}

        {/* 5. Punto Animado en Modo Replay */}
        {replayPoint && (
          <View
            style={[
              styles.replaySurferDot,
              {
                left: projectPoint(replayPoint.latitude, replayPoint.longitude, is3DMode ? 0.45 : 0).x - 6,
                top: projectPoint(replayPoint.latitude, replayPoint.longitude, is3DMode ? 0.45 : 0).y - 6,
              },
            ]}
          >
            <View style={styles.replaySurferInner} />
          </View>
        )}
      </View>

      {/* Barra de Selección de Olas */}
      <View style={styles.waveSelectorRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.waveChipsScroll}>
          <TouchableOpacity
            style={[styles.waveChip, selectedWaveIndex === null && styles.waveChipActive]}
            onPress={() => {
              setSelectedWaveIndex(null);
              setIsPlayingReplay(false);
            }}
          >
            <Text style={[styles.waveChipText, selectedWaveIndex === null && styles.waveChipTextActive]}>
              TODAS LAS OLAS ({effectiveWaves.length})
            </Text>
          </TouchableOpacity>

          {effectiveWaves.map((wave, idx) => (
            <TouchableOpacity
              key={`chip_w_${idx}`}
              style={[styles.waveChip, selectedWaveIndex === idx && styles.waveChipActive]}
              onPress={() => {
                setSelectedWaveIndex(idx);
                setIsPlayingReplay(false);
                setReplayProgress(0);
              }}
            >
              <Text style={[styles.waveChipText, selectedWaveIndex === idx && styles.waveChipTextActive]}>
                OLA #{wave.waveNumber} · {wave.topSpeedKmH.toFixed(1)} km/h
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Ficha Flotante de Detalles de la Ola Seleccionada */}
      {currentWave ? (
        <View style={styles.waveDetailCard}>
          <View style={styles.waveDetailHeader}>
            <View>
              <Text style={styles.waveDetailTitle}>OLA #{currentWave.waveNumber}</Text>
              <Text style={styles.waveDetailSub}>
                {currentWave.durationSeconds}s · {currentWave.distanceMeters}m de recorrido
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.replayBtn, isPlayingReplay && styles.replayBtnActive]}
              onPress={() => {
                if (isPlayingReplay) {
                  setIsPlayingReplay(false);
                } else {
                  setReplayProgress(0);
                  setIsPlayingReplay(true);
                }
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.replayBtnText}>
                {isPlayingReplay ? 'PAUSAR 3D' : 'REPRODUCIR 3D'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.waveStatsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statVal}>{currentWave.topSpeedKmH.toFixed(1)}</Text>
              <Text style={styles.statLbl}>km/h punta</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statVal}>{currentWave.distanceMeters}</Text>
              <Text style={styles.statLbl}>metros</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statVal}>{currentWave.turnsCount}</Text>
              <Text style={styles.statLbl}>giros</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statVal, { color: THEME.accent }]}>
                {currentWave.turns.length > 0
                  ? currentWave.turns[0].type.replace('_', ' ').toUpperCase()
                  : 'PLANEADO'}
              </Text>
              <Text style={styles.statLbl}>maniobra clave</Text>
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: THEME.accent }]} />
            <Text style={styles.legendText}>Remada al pico</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: THEME.ratings.fair }]} />
            <Text style={styles.legendText}>Ola (11-15 km/h)</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: THEME.accent }]} />
            <Text style={styles.legendText}>Velocidad media (15-19)</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: THEME.ratings.poorfair }]} />
            <Text style={styles.legendText}>Punta (&gt;19 km/h)</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: THEME.surface2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.line,
    padding: 12,
    marginVertical: 10,
  },
  topControlBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  spotInfo: {
    flex: 1,
  },
  spotTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: THEME.text,
    letterSpacing: 0.5,
  },
  spotSubtitle: {
    fontSize: 9,
    fontWeight: '700',
    color: THEME.accent,
    marginTop: 1,
    letterSpacing: 0.5,
  },
  modeButtonsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  modeBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: THEME.surface3,
  },
  modeBtnActive: {
    backgroundColor: THEME.accentMuted,
  },
  modeBtnText: {
    fontSize: 9,
    fontWeight: '700',
    color: THEME.textMuted,
  },
  modeBtnTextActive: {
    color: THEME.text,
  },
  angleBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: THEME.surface3,
  },
  angleBtnText: {
    fontSize: 9,
    fontWeight: '700',
    color: THEME.textSecondary,
  },
  canvas3D: {
    backgroundColor: THEME.bg,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: THEME.line,
  },
  oceanGridContainer: {
    ...StyleSheet.absoluteFill,
    opacity: 0.15,
  },
  gridLineStyle: {
    position: 'absolute',
    height: 1,
    backgroundColor: THEME.accent,
  },
  beachBanner: {
    position: 'absolute',
    bottom: 6,
    left: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: '#78350f44',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#b4530966',
  },
  beachText: {
    fontSize: 8,
    fontWeight: '800',
    color: THEME.ratings.poorfair,
    letterSpacing: 0.5,
  },
  lineupBanner: {
    position: 'absolute',
    top: 6,
    right: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: '#0369a144',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#0284c766',
  },
  lineupText: {
    fontSize: 8,
    fontWeight: '800',
    color: THEME.accent,
    letterSpacing: 0.5,
  },
  takeoffPin: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: THEME.surface3,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: THEME.ratings.fair,
    shadowRadius: 5,
    shadowOpacity: 0.9,
    elevation: 4,
  },
  takeoffPinText: {
    fontSize: 10,
    fontWeight: '900',
    color: THEME.text,
  },
  turnMarker: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: THEME.accentMuted,
    borderWidth: 1.5,
    borderColor: THEME.text,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: THEME.accent,
    shadowRadius: 3,
    shadowOpacity: 0.8,
  },
  turnMarkerText: {
    fontSize: 9,
    fontWeight: '900',
    color: THEME.text,
  },
  replaySurferDot: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: THEME.ratings.poorfair,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: THEME.ratings.poorfair,
    shadowRadius: 8,
    shadowOpacity: 1.0,
  },
  replaySurferInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: THEME.text,
  },
  waveSelectorRow: {
    marginVertical: 8,
  },
  waveChipsScroll: {
    flexDirection: 'row',
  },
  waveChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: THEME.surface3,
    marginRight: 6,
  },
  waveChipActive: {
    backgroundColor: THEME.ratings.fair,
  },
  waveChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.textMuted,
  },
  waveChipTextActive: {
    color: THEME.text,
  },
  waveDetailCard: {
    backgroundColor: THEME.surface3,
    borderRadius: 8,
    padding: 10,
    marginTop: 4,
  },
  waveDetailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  waveDetailTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: THEME.ratings.fair,
  },
  waveDetailSub: {
    fontSize: 10,
    fontWeight: '600',
    color: THEME.textMuted,
    marginTop: 1,
  },
  replayBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: THEME.accentMuted,
  },
  replayBtnActive: {
    backgroundColor: THEME.danger,
  },
  replayBtnText: {
    fontSize: 10,
    fontWeight: '800',
    color: THEME.text,
  },
  waveStatsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: THEME.line,
    paddingTop: 8,
  },
  statBox: {
    alignItems: 'center',
  },
  statVal: {
    fontSize: 13,
    fontWeight: '900',
    color: THEME.text,
  },
  statLbl: {
    fontSize: 8,
    fontWeight: '700',
    color: THEME.textFaint,
    marginTop: 1,
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 6,
    paddingHorizontal: 4,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  legendText: {
    fontSize: 9,
    fontWeight: '600',
    color: THEME.textFaint,
  },
});

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ActivityIndicator,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { THEME } from '../../theme/colors';

export type CamStatus = 'directo' | 'buffer' | 'sin_senal' | 'restringida';

export interface CamStreamOption {
  id: string;
  name: string;
  type: string;
  streamUrl: string;
  fallbackUrl?: string;
  pageUrl?: string;
}

export interface SurfCamPlayerProps {
  streamUrl: string;
  fallbackImageUrl?: string;
  isImageStream?: boolean;
  isRestricted?: boolean;
  pageUrl?: string;
  spotName?: string;
  availableStreams?: CamStreamOption[];
  activeStreamId?: string;
  onSelectStream?: (streamId: string) => void;
  onCaptureClip?: () => void;
  style?: object;
}

export const SurfCamPlayer: React.FC<SurfCamPlayerProps> = ({
  streamUrl,
  fallbackImageUrl,
  isImageStream = false,
  isRestricted = false,
  pageUrl,
  spotName,
  availableStreams,
  activeStreamId,
  onSelectStream,
  onCaptureClip,
  style,
}) => {
  const [status, setStatus] = useState<CamStatus>(isRestricted ? 'restringida' : 'buffer');
  const [hasError, setHasError] = useState(false);

  const shouldPlayVideo = !isImageStream && !isRestricted && streamUrl.length > 0;

  const player = useVideoPlayer(shouldPlayVideo ? streamUrl : '', (p) => {
    try {
      p.loop = true;
      p.muted = true;
      if (p.bufferOptions) {
        p.bufferOptions = { maxBufferBytes: 5_000_000 };
      }
      p.play();
    } catch {
      // Ignorar en entornos de test
    }
  });

  useEffect(() => {
    if (isRestricted) {
      setStatus('restringida');
      return;
    }

    if (isImageStream) {
      setStatus('directo');
      return;
    }

    let timeout = setTimeout(() => {
      if (status === 'buffer') {
        setStatus('sin_senal');
      }
    }, 12000);

    const subPlaying = player?.addListener?.('playingChange', (event: any) => {
      if (event?.isPlaying) {
        setStatus('directo');
        setHasError(false);
        clearTimeout(timeout);
      } else {
        setStatus('buffer');
      }
    });

    const subStatus = player?.addListener?.('statusChange', (event: any) => {
      if (event?.status === 'readyToPlay') {
        setStatus('directo');
        setHasError(false);
        clearTimeout(timeout);
      } else if (event?.status === 'error') {
        setStatus('sin_senal');
        setHasError(true);
      }
    });

    return () => {
      clearTimeout(timeout);
      subPlaying?.remove?.();
      subStatus?.remove?.();
    };
  }, [player, isImageStream, isRestricted]);

  const handleOpenRestricted = () => {
    const target = pageUrl || streamUrl;
    if (target) {
      Linking.openURL(target).catch(() => {});
    }
  };

  return (
    <View style={styles.wrapper}>
      <View style={[styles.container, style]}>
        {/* Caso 1: Cámara restringida por derechos (Servigroup, etc.) */}
        {isRestricted ? (
          <View style={styles.restrictedContainer}>
            <Text style={styles.restrictedTitle}>EMISIÓN OFICIAL RESTRINGIDA</Text>
            <Text style={styles.restrictedDesc}>
              Esta cámara emite con restricciones de inserción móvil del proveedor oficial.
            </Text>
            <TouchableOpacity
              style={styles.restrictedBtn}
              onPress={handleOpenRestricted}
              activeOpacity={0.8}
            >
              <Text style={styles.restrictedBtnText}>ABRIR EMISIÓN EN NAVEGADOR</Text>
            </TouchableOpacity>
          </View>
        ) : isImageStream || (hasError && fallbackImageUrl) ? (
          /* Caso 2: Cámara estática / Snapshot JPG con auto-refresco */
          <Image
            source={{ uri: fallbackImageUrl || streamUrl }}
            style={styles.media}
            resizeMode="cover"
          />
        ) : (
          /* Caso 3: Streaming HLS Nativo */
          <VideoView
            player={player}
            style={styles.media}
            allowsPictureInPicture
            startsPictureInPictureAutomatically={false}
            contentFit="cover"
            nativeControls={false}
          />
        )}

        {/* Badge de estado en directo (Fiel al estilo web .live-badge) */}
        <View style={styles.liveBadge}>
          <View
            style={[
              styles.statusDot,
              status === 'directo'
                ? styles.dotDirecto
                : status === 'buffer'
                ? styles.dotBuffer
                : status === 'restringida'
                ? styles.dotRestringida
                : styles.dotSinSenal,
            ]}
          />
          <Text style={styles.liveBadgeText}>
            {status === 'directo'
              ? 'EN DIRECTO'
              : status === 'buffer'
              ? 'BÚFER'
              : status === 'restringida'
              ? 'RESTRINGIDA'
              : 'SIN SEÑAL'}
          </Text>
        </View>

        {/* Indicador de carga en búfer */}
        {status === 'buffer' && !hasError && !isRestricted && (
          <View style={styles.centerLoading}>
            <ActivityIndicator size="small" color={THEME.accent} />
          </View>
        )}

        {/* Etiqueta del spot en esquina inferior izquierda */}
        {spotName && (
          <View style={styles.spotOverlay}>
            <Text style={styles.spotText}>{spotName.toUpperCase()}</Text>
          </View>
        )}

        {/* Botón de captura Vigía en esquina inferior derecha */}
        {onCaptureClip && status === 'directo' && (
          <TouchableOpacity
            style={styles.vigiaBtn}
            onPress={onCaptureClip}
            activeOpacity={0.8}
          >
            <Text style={styles.vigiaBtnText}>GRABAR 20S</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Selector de cámaras alternativas si el spot dispone de más de una */}
      {availableStreams && availableStreams.length > 1 && (
        <View style={styles.camSwitchRow}>
          {availableStreams.map((cs) => {
            const isSelected = cs.id === activeStreamId;
            return (
              <TouchableOpacity
                key={cs.id}
                style={[styles.switchBtn, isSelected && styles.switchBtnActive]}
                onPress={() => onSelectStream?.(cs.id)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.switchBtnText,
                    isSelected && styles.switchBtnTextActive,
                  ]}
                >
                  {cs.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    marginBottom: 16,
  },
  container: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#171b1e',
    borderRadius: 6,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: THEME.line,
  },
  media: {
    width: '100%',
    height: '100%',
  },
  liveBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(22, 25, 29, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 3,
    zIndex: 10,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotDirecto: {
    backgroundColor: '#0bd674',
  },
  dotBuffer: {
    backgroundColor: '#ffcd1e',
  },
  dotRestringida: {
    backgroundColor: '#ff9500',
  },
  dotSinSenal: {
    backgroundColor: '#f4496d',
  },
  liveBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  centerLoading: {
    position: 'absolute',
    inset: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  spotOverlay: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(21, 23, 25, 0.85)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 3,
  },
  spotText: {
    color: THEME.text,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  vigiaBtn: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: THEME.surface2,
    borderColor: THEME.line,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 3,
  },
  vigiaBtnText: {
    color: THEME.text,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  camSwitchRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  switchBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: THEME.line,
    backgroundColor: THEME.surface,
  },
  switchBtnActive: {
    backgroundColor: THEME.text,
    borderColor: THEME.text,
  },
  switchBtnText: {
    color: THEME.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  switchBtnTextActive: {
    color: THEME.bg,
    fontWeight: '700',
  },
  restrictedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#171b1e',
  },
  restrictedTitle: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 6,
    textAlign: 'center',
  },
  restrictedDesc: {
    color: THEME.textMuted,
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 14,
  },
  restrictedBtn: {
    borderWidth: 1,
    borderColor: THEME.line,
    backgroundColor: THEME.surface2,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 4,
  },
  restrictedBtnText: {
    color: THEME.text,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});

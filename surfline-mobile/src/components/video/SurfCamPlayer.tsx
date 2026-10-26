import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';

export type CamStatus = 'directo' | 'buffer' | 'sin_senal';

export interface SurfCamPlayerProps {
  streamUrl: string;
  fallbackImageUrl?: string;
  isImageStream?: boolean;
  spotName?: string;
  onCaptureClip?: () => void;
  style?: object;
}

export const SurfCamPlayer: React.FC<SurfCamPlayerProps> = ({
  streamUrl,
  fallbackImageUrl,
  isImageStream = false,
  spotName,
  onCaptureClip,
  style,
}) => {
  const [status, setStatus] = useState<CamStatus>('buffer');
  const [hasError, setHasError] = useState(false);

  const player = useVideoPlayer(streamUrl, (p) => {
    try {
      p.loop = true;
      p.muted = true;
      if (p.bufferOptions) {
        p.bufferOptions = { maxBufferBytes: 5_000_000 };
      }
      p.play();
    } catch {
      // Manejo en entornos de prueba / web sin video nativo
    }
  });

  useEffect(() => {
    if (isImageStream) {
      setStatus('directo');
      return;
    }

    let timeout = setTimeout(() => {
      if (status === 'buffer') {
        setStatus('sin_senal');
      }
    }, 10000);

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
  }, [player, isImageStream]);

  return (
    <View style={[styles.container, style]}>
      {/* Reproductor nativo o imagen estática */}
      {isImageStream || (hasError && fallbackImageUrl) ? (
        <Image
          source={{ uri: fallbackImageUrl || streamUrl }}
          style={styles.media}
          resizeMode="cover"
        />
      ) : (
        <VideoView
          player={player}
          style={styles.media}
          allowsPictureInPicture
          startsPictureInPictureAutomatically={false}
          contentFit="cover"
          nativeControls={false}
        />
      )}

      {/* Badge de estado en directo */}
      <View
        style={[
          styles.badge,
          status === 'directo'
            ? styles.badgeDirecto
            : status === 'buffer'
            ? styles.badgeBuffer
            : styles.badgeSinSenal,
        ]}
      >
        <Text style={styles.badgeText}>
          {status === 'directo'
            ? '● En directo'
            : status === 'buffer'
            ? '● Búfer'
            : '● Sin señal'}
        </Text>
      </View>

      {/* Indicador de carga si está en búfer */}
      {status === 'buffer' && !hasError && (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="small" color="#38bdf8" />
        </View>
      )}

      {/* Etiqueta del spot */}
      {spotName && (
        <View style={styles.spotOverlay}>
          <Text style={styles.spotText}>{spotName}</Text>
        </View>
      )}

      {/* Botón de captura Vigía si se proporciona callback */}
      {onCaptureClip && (
        <TouchableOpacity style={styles.vigiaBtn} onPress={onCaptureClip} activeOpacity={0.8}>
          <Text style={styles.vigiaBtnText}>📹 Grabar 20s</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: 220,
    backgroundColor: '#050c18',
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
  },
  media: {
    width: '100%',
    height: '100%',
  },
  badge: {
    position: 'absolute',
    top: 10,
    right: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    zIndex: 10,
  },
  badgeDirecto: {
    backgroundColor: 'rgba(16, 185, 129, 0.9)',
  },
  badgeBuffer: {
    backgroundColor: 'rgba(245, 158, 11, 0.9)',
  },
  badgeSinSenal: {
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  centerLoading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  spotOverlay: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    backgroundColor: 'rgba(10, 22, 40, 0.75)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  spotText: {
    color: '#f0f6fc',
    fontSize: 12,
    fontWeight: '600',
  },
  vigiaBtn: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: '#0284c7',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  vigiaBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
});

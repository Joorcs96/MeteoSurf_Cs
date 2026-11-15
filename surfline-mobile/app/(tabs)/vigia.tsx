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
import { useVigiaStore, VigiaClip } from '../../src/store/useVigiaStore';
import { SurfCamPlayer } from '../../src/components/video/SurfCamPlayer';
import { saveClipToGallery, shareClip } from '../../src/services/video/clipExporter';
import { RatingPill } from '../../src/components/ui/RatingPill';
import { THEME } from '../../src/theme/colors';

export default function VigiaScreen() {
  const { clips, removeClip } = useVigiaStore();
  const [selectedClip, setSelectedClip] = useState<VigiaClip | null>(clips[0] || null);

  const handleSaveGallery = async (clip: VigiaClip) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const success = await saveClipToGallery(clip.uri);
    if (success) {
      Alert.alert('Guardado en Fotos', 'El clip de ola está ahora disponible en tu carrete.');
    } else {
      Alert.alert(
        'Aviso de Permisos',
        'No se ha podido guardar el clip. Comprueba los permisos de Fotos en Ajustes.'
      );
    }
  };

  const handleShare = async (clip: VigiaClip) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await shareClip(clip.uri, `Serie de olas en ${clip.spotName}`);
  };

  const handleDelete = (id: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    removeClip(id);
    if (selectedClip?.id === id) {
      setSelectedClip(clips.find((c) => c.id !== id) || null);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Encabezado */}
        <View style={styles.header}>
          <Text style={styles.title}>VIGÍA · CLIPS DE OLAS</Text>
          <Text style={styles.subtitle}>Grabaciones automáticas y repetición en el spot</Text>
        </View>

        {/* Reproductor de clip activo */}
        {selectedClip ? (
          <View style={styles.playerWrapper}>
            <SurfCamPlayer
              streamUrl={selectedClip.uri}
              spotName={`${selectedClip.spotName} · 20s`}
            />

            {/* Acciones del clip */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.actionBtnPrimary}
                onPress={() => handleSaveGallery(selectedClip)}
                activeOpacity={0.8}
              >
                <Text style={styles.actionBtnPrimaryText}>GUARDAR EN FOTOS</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionBtnSecondary}
                onPress={() => handleShare(selectedClip)}
                activeOpacity={0.8}
              >
                <Text style={styles.actionBtnSecondaryText}>COMPARTIR</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionBtnDanger}
                onPress={() => handleDelete(selectedClip.id)}
                activeOpacity={0.8}
              >
                <Text style={styles.actionBtnDangerText}>BORRAR</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>NO HAY CLIPS GUARDADOS</Text>
            <Text style={styles.emptyDesc}>
              Pulsa el botón de captura rápida en el reproductor de cualquier spot para guardar
              repeticiones de tus series de olas.
            </Text>
          </View>
        )}

        {/* Lista de clips capturados */}
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>HISTORIAL DE REPETICIONES</Text>
          <Text style={styles.sectionBadge}>{clips.length} clips</Text>
        </View>

        {clips.map((item) => {
          const isSelected = selectedClip?.id === item.id;
          return (
            <TouchableOpacity
              key={item.id}
              style={[styles.clipCard, isSelected && styles.clipCardActive]}
              onPress={() => setSelectedClip(item)}
              activeOpacity={0.8}
            >
              <View style={styles.clipThumb}>
                <View style={styles.clipPlayIcon} />
                <Text style={styles.clipDuration}>20s</Text>
              </View>

              <View style={styles.clipInfo}>
                <View style={styles.clipTitleRow}>
                  <Text style={styles.clipSpotName}>{item.spotName}</Text>
                  <RatingPill rating={item.stars || 3.5} showLabel={false} />
                </View>

                <Text style={styles.clipMeta}>
                  {new Date(item.capturedAt).toLocaleTimeString('es-ES', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}{' '}
                  · {item.waveHeight}m · {((item.sizeBytes ?? 1024 * 1024) / (1024 * 1024)).toFixed(1)} MB
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
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
  playerWrapper: {
    marginBottom: 20,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: -8,
  },
  actionBtnPrimary: {
    flex: 2,
    backgroundColor: THEME.text,
    paddingVertical: 10,
    borderRadius: 4,
    alignItems: 'center',
  },
  actionBtnPrimaryText: {
    color: THEME.bg,
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 0.5,
  },
  actionBtnSecondary: {
    flex: 1.5,
    backgroundColor: THEME.surface2,
    borderWidth: 1,
    borderColor: THEME.line,
    paddingVertical: 10,
    borderRadius: 4,
    alignItems: 'center',
  },
  actionBtnSecondaryText: {
    color: THEME.text,
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 0.5,
  },
  actionBtnDanger: {
    backgroundColor: 'rgba(225, 29, 72, 0.1)',
    borderWidth: 1,
    borderColor: THEME.danger,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 4,
    alignItems: 'center',
  },
  actionBtnDangerText: {
    color: THEME.danger,
    fontWeight: '800',
    fontSize: 10,
    letterSpacing: 0.5,
  },
  emptyBox: {
    backgroundColor: THEME.surface,
    borderWidth: 1,
    borderColor: THEME.line,
    borderRadius: 6,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    color: THEME.textMuted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  emptyDesc: {
    color: THEME.textFaint,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
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
  sectionBadge: {
    fontSize: 11,
    color: THEME.textFaint,
    fontWeight: '600',
  },
  clipCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.surface,
    borderWidth: 1,
    borderColor: THEME.line,
    borderRadius: 6,
    padding: 10,
    marginBottom: 8,
  },
  clipCardActive: {
    borderColor: THEME.accent,
    backgroundColor: THEME.surface2,
  },
  clipThumb: {
    width: 60,
    height: 42,
    backgroundColor: '#171b1e',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  clipPlayIcon: {
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderTopWidth: 6,
    borderBottomWidth: 6,
    borderLeftColor: '#ffffff',
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
  },
  clipDuration: {
    position: 'absolute',
    bottom: 2,
    right: 4,
    fontSize: 8,
    color: '#94a3b8',
    fontWeight: '700',
  },
  clipInfo: {
    flex: 1,
    marginLeft: 12,
  },
  clipTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  clipSpotName: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.text,
  },
  clipMeta: {
    fontSize: 11,
    color: THEME.textMuted,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
});

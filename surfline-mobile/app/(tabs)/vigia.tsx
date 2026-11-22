import React, { useState, useCallback, useEffect } from 'react';
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
  const { clips, removeClip, loadClips } = useVigiaStore();
  const [selectedClip, setSelectedClip] = useState<VigiaClip | null>(null);

  useEffect(() => {
    loadClips();
  }, [loadClips]);

  const handleSaveGallery = useCallback(async (clip: VigiaClip) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const success = await saveClipToGallery(clip.uri);
    if (success) {
      Alert.alert('Guardado en Fotos', 'El clip de ola está ahora disponible en tu carrete.');
    } else {
      Alert.alert('Aviso de Permisos', 'No se ha podido guardar el clip. Comprueba los permisos de Fotos en Ajustes.');
    }
  }, []);

  const handleShare = useCallback(async (clip: VigiaClip) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await shareClip(clip.uri, `Serie de olas en ${clip.spotName}`);
  }, []);

  const handleDelete = useCallback((id: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    removeClip(id);
    setSelectedClip(null);
  }, [removeClip]);

  const handlePlay = useCallback((clip: VigiaClip) => {
    setSelectedClip(clip);
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>VIGÍA</Text>
          <Text style={styles.subtitle}>Clips de olas capturados</Text>
        </View>

        {clips.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>Sin capturas todavía</Text>
            <Text style={styles.emptyDesc}>Captura clips desde la pestaña Spots</Text>
          </View>
        ) : (
          <>
            {selectedClip ? (
              <View style={styles.playerWrapper}>
                <SurfCamPlayer streamUrl={selectedClip.uri} spotName={selectedClip.spotName} />
                <View style={styles.actionRow}>
                  <TouchableOpacity style={styles.actionBtn} onPress={() => handleSaveGallery(selectedClip)} activeOpacity={0.8}>
                    <Text style={styles.actionBtnText}>Guardar en Fotos</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionBtnOutline} onPress={() => handleShare(selectedClip)} activeOpacity={0.8}>
                    <Text style={styles.actionBtnText}>Compartir</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionBtnDanger} onPress={() => handleDelete(selectedClip.id)} activeOpacity={0.8}>
                    <Text style={styles.actionBtnDangerText}>Borrar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}

            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>Historial de repeticiones</Text>
              <Text style={styles.sectionCount}>{clips.length} clips</Text>
            </View>

            {clips.map((item) => (
              <TouchableOpacity key={item.id} style={[styles.clipCard, selectedClip?.id === item.id && styles.clipCardActive]} onPress={() => handlePlay(item)} activeOpacity={0.8}>
                <View style={styles.clipThumb}>
                  <View style={styles.clipPlay} />
                  <Text style={styles.clipDuration}>{Math.round(item.durationMs / 1000)}s</Text>
                </View>
                <View style={styles.clipInfo}>
                  <View style={styles.clipTitleRow}>
                    <Text style={styles.clipSpotName}>{item.spotName}</Text>
                    <RatingPill rating={item.stars ?? 3} showLabel={false} />
                  </View>
                  <Text style={styles.clipMeta}>
                    {new Date(item.capturedAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} · {item.waveHeight?.toFixed(1) ?? '--'}m
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </>
        )}
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
    paddingBottom: 80,
  },
  header: {
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: THEME.line,
    marginBottom: 20,
  },
  title: {
    color: THEME.brand,
    fontSize: 20,
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
    marginTop: 8,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: THEME.accent,
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  actionBtnText: {
    color: THEME.bg,
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 0.5,
  },
  actionBtnOutline: {
    flex: 1,
    backgroundColor: THEME.surface2,
    borderWidth: 1,
    borderColor: THEME.line,
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  actionBtnDanger: {
    backgroundColor: THEME.surface2,
    borderWidth: 1,
    borderColor: THEME.danger,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 6,
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
    borderRadius: 8,
    padding: 26,
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    color: THEME.textMuted,
    fontSize: 13,
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
  sectionCount: {
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
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  clipCardActive: {
    borderColor: THEME.accent,
    backgroundColor: THEME.surface2,
  },
  clipThumb: {
    width: 64,
    height: 44,
    backgroundColor: THEME.surface3,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  clipPlay: {
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderTopWidth: 6,
    borderBottomWidth: 6,
    borderLeftColor: THEME.text,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
  },
  clipDuration: {
    position: 'absolute',
    bottom: 2,
    right: 4,
    fontSize: 8,
    color: THEME.textMuted,
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
  },
});

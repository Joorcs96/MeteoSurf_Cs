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

export default function VigiaScreen() {
  const { clips, removeClip } = useVigiaStore();
  const [selectedClip, setSelectedClip] = useState<VigiaClip | null>(clips[0] || null);

  const handleSaveGallery = async (clip: VigiaClip) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const success = await saveClipToGallery(clip.uri);
    if (success) {
      Alert.alert('✅ Guardado en Fotos', 'El clip de ola está ahora disponible en tu carrete.');
    } else {
      Alert.alert(
        'Aviso de Permisos',
        'No se ha podido guardar el clip. Comprueba los permisos de Fotos en Ajustes.'
      );
    }
  };

  const handleShare = async (clip: VigiaClip) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await shareClip(clip.uri, `🌊 Serie de olas en ${clip.spotName}`);
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
          <Text style={styles.title}>VIGÍA CLIP STUDIO</Text>
          <Text style={styles.subtitle}>Captura automática y repetición de olas</Text>
        </View>

        {/* Reproductor principal de clip activo */}
        {selectedClip ? (
          <View style={styles.playerWrapper}>
            <SurfCamPlayer
              streamUrl={selectedClip.uri}
              spotName={`${selectedClip.spotName} · 20s`}
            />

            {/* Acciones del clip seleccionado */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.actionBtnPrimary}
                onPress={() => handleSaveGallery(selectedClip)}
                activeOpacity={0.8}
              >
                <Text style={styles.actionBtnPrimaryText}>📥 Guardar en Fotos</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionBtnSecondary}
                onPress={() => handleShare(selectedClip)}
                activeOpacity={0.8}
              >
                <Text style={styles.actionBtnSecondaryText}>📤 Compartir</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.emptyPlayer}>
            <Text style={styles.emptyPlayerText}>No hay ningún clip seleccionado</Text>
          </View>
        )}

        {/* Galería de clips archivados */}
        <Text style={styles.sectionTitle}>Tus Grabaciones de Olas</Text>

        {clips.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>Sin clips todavía</Text>
            <Text style={styles.emptyText}>
              Ve a la pestaña Spots y pulsa "📹 Grabar 20s" en la cámara para capturar tu serie.
            </Text>
          </View>
        ) : (
          clips.map((clip) => {
            const isSelected = selectedClip?.id === clip.id;
            const dateStr = new Date(clip.capturedAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <TouchableOpacity
                key={clip.id}
                style={[styles.clipCard, isSelected && styles.clipCardActive]}
                onPress={() => {
                  Haptics.selectionAsync();
                  setSelectedClip(clip);
                }}
                activeOpacity={0.7}
              >
                <View style={styles.clipThumbnail}>
                  <Text style={styles.clipPlayIcon}>▶</Text>
                </View>

                <View style={styles.clipInfo}>
                  <Text style={styles.clipTitle}>{clip.spotName}</Text>
                  <Text style={styles.clipMeta}>
                    Hoy a las {dateStr} · {clip.waveHeight || 0.6}m · {'★'.repeat(Math.round(clip.stars || 4))}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => handleDelete(clip.id)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={styles.deleteBtnText}>✕</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            );
          })
        )}
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
  playerWrapper: { marginBottom: 20 },
  emptyPlayer: {
    height: 180,
    backgroundColor: '#111e33',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyPlayerText: { color: '#64748b', fontSize: 14 },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  actionBtnPrimary: {
    flex: 1,
    backgroundColor: '#0284c7',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  actionBtnPrimaryText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  actionBtnSecondary: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  actionBtnSecondaryText: {
    color: '#38bdf8',
    fontSize: 14,
    fontWeight: '700',
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  emptyBox: {
    backgroundColor: '#111e33',
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
  },
  emptyTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  clipCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111e33',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  clipCardActive: {
    borderColor: '#0284c7',
    backgroundColor: '#0c2340',
  },
  clipThumbnail: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#0284c7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clipPlayIcon: {
    color: '#ffffff',
    fontSize: 16,
  },
  clipInfo: {
    flex: 1,
    paddingHorizontal: 12,
  },
  clipTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  clipMeta: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2,
  },
  deleteBtn: {
    padding: 8,
  },
  deleteBtnText: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: '700',
  },
});

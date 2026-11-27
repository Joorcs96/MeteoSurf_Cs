import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { RatingPill } from '../../src/components/ui/RatingPill';
import { SPOTS, Spot } from '../../src/data/spotsData';
import { useNearestSpots, haversineDistance } from '../../src/services/sensors/useNearestSpots';
import { getStorage } from '../../src/services/storage/storageAdapter';
import { THEME, getRatingColor } from '../../src/theme/colors';

const POSTS_STORAGE_KEY = 'meteosurf_community_posts';
const AT_BEACH_KM = 0.5;

interface CommunityPost {
  id: string;
  author: string;
  spot: string;
  spotId: string;
  timeAgo: string;
  description: string;
  rating: number;
  verifiedAtBeach: boolean;
}

const SEED_POSTS: CommunityPost[] = [
  {
    id: 'post_1',
    author: 'Carlos S.',
    spot: 'Planetario',
    spotId: 'Planetario',
    timeAgo: 'Hace 15 min',
    description: 'Olas de medio metro limpias con terral suave.',
    rating: 4,
    verifiedAtBeach: true,
  },
  {
    id: 'post_2',
    author: 'Javi M.',
    spot: 'Voramar',
    spotId: 'Voramar',
    timeAgo: 'Hace 1 hora',
    description: 'Pico en el espigón funcionando con marea subiendo.',
    rating: 5,
    verifiedAtBeach: true,
  },
  {
    id: 'post_3',
    author: 'David R.',
    spot: 'Morro de Gos',
    spotId: 'MorroGos',
    timeAgo: 'Hace 3 horas',
    description: 'Mar cruzado con viento de mar moderado.',
    rating: 2,
    verifiedAtBeach: false,
  },
];

const RATING_OPTIONS = [
  { label: 'Épico', value: 5 },
  { label: 'Bueno', value: 4 },
  { label: 'Regular', value: 3 },
  { label: 'Malo', value: 2 },
  { label: 'Plato', value: 0 },
];

function initials(name: string): string {
  return name
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('');
}

export default function CommunityScreen() {
  const { userLocation } = useNearestSpots();
  const [posts, setPosts] = useState<CommunityPost[]>(SEED_POSTS);
  const [composerOpen, setComposerOpen] = useState(false);
  const [selectedSpotId, setSelectedSpotId] = useState<string>(SPOTS[0].id);
  const [rating, setRating] = useState<number>(3);
  const [description, setDescription] = useState('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const raw = await getStorage().get(POSTS_STORAGE_KEY);
        if (!mounted || !raw) return;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setPosts(parsed);
      } catch {
        // Si falla la lectura se mantienen las publicaciones de ejemplo
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const persist = useCallback((next: CommunityPost[]) => {
    getStorage().set(POSTS_STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const selectedSpot: Spot = useMemo(
    () => SPOTS.find((s) => s.id === selectedSpotId) || SPOTS[0],
    [selectedSpotId]
  );

  const distanceToSelectedKm = useMemo(() => {
    if (!userLocation) return null;
    return haversineDistance(userLocation.lat, userLocation.lon, selectedSpot.lat, selectedSpot.lon);
  }, [userLocation, selectedSpot]);

  const isAtBeach = distanceToSelectedKm !== null && distanceToSelectedKm <= AT_BEACH_KM;

  const openComposer = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setComposerOpen(true);
  }, []);

  const closeComposer = useCallback(() => {
    setComposerOpen(false);
    setDescription('');
  }, []);

  const publish = useCallback(() => {
    const clean = description.trim();
    if (!clean) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const newPost: CommunityPost = {
      id: `post_${Date.now()}`,
      author: 'Tu',
      spot: selectedSpot.name,
      spotId: selectedSpot.id,
      timeAgo: 'Ahora mismo',
      description: clean,
      rating,
      verifiedAtBeach: isAtBeach,
    };
    setPosts((prev) => {
      const next = [newPost, ...prev];
      persist(next);
      return next;
    });
    setDescription('');
    setComposerOpen(false);
  }, [description, selectedSpot, rating, isAtBeach, persist]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>COMUNIDAD</Text>
          <Text style={styles.subtitle}>Sesiones y avisos de la comunidad</Text>
        </View>

        <TouchableOpacity style={styles.newPostBtn} onPress={openComposer} activeOpacity={0.8}>
          <Text style={styles.newPostBtnText}>Nueva publicación</Text>
        </TouchableOpacity>

        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Avisos recientes</Text>
          <Text style={styles.sectionCount}>{posts.length} publicaciones</Text>
        </View>

        {posts.map((post) => (
          <View key={post.id} style={styles.postCard}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials(post.author)}</Text>
            </View>
            <View style={styles.postBody}>
              <View style={styles.postTop}>
                <Text style={styles.postAuthor}>{post.author}</Text>
                <Text style={styles.postTime}>{post.timeAgo}</Text>
              </View>
              <View style={styles.postSpotRow}>
                <Text style={styles.postSpot}>{post.spot}</Text>
                {post.verifiedAtBeach ? (
                  <View style={styles.verifiedPill}>
                    <Text style={styles.verifiedText}>A PIE DE PLAYA</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.postDescription}>{post.description}</Text>
              <View style={styles.postBottom}>
                <Text style={styles.postSpotLabel}>Valoración</Text>
                <RatingPill rating={post.rating} showLabel={false} />
              </View>
            </View>
          </View>
        ))}
      </ScrollView>

      <Modal
        visible={composerOpen}
        animationType="slide"
        transparent
        onRequestClose={closeComposer}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.composer}>
            <View style={styles.composerHeader}>
              <Text style={styles.composerTitle}>Nuevo aviso de olas</Text>
              <TouchableOpacity onPress={closeComposer} activeOpacity={0.7}>
                <Text style={styles.composerClose}>CERRAR</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>SPOT</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.spotRow}>
              {SPOTS.map((spot) => {
                const active = spot.id === selectedSpot.id;
                return (
                  <TouchableOpacity
                    key={spot.id}
                    style={[styles.spotChip, active && styles.spotChipActive]}
                    onPress={() => setSelectedSpotId(spot.id)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.spotChipText, active && styles.spotChipTextActive]}>
                      {spot.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Text style={styles.fieldLabel}>COMO ESTA ROMPIENDO</Text>
            <View style={styles.ratingRow}>
              {RATING_OPTIONS.map((opt) => {
                const active = rating === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.label}
                    style={[styles.ratingChip, active && styles.ratingChipActive]}
                    onPress={() => setRating(opt.value)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.ratingDot, { backgroundColor: getRatingColor(opt.value) }]} />
                    <Text style={[styles.ratingChipText, active && styles.ratingChipTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.fieldLabel}>COMENTARIO</Text>
            <TextInput
              style={styles.input}
              value={description}
              onChangeText={setDescription}
              placeholder="Cuenta como esta el agua y el viento"
              placeholderTextColor={THEME.textFaint}
              multiline
              maxLength={180}
            />

            <Text style={styles.locationNote}>
              {distanceToSelectedKm === null
                ? 'Ubicacion no disponible: el aviso se publicara como remoto'
                : isAtBeach
                  ? `Verificado a pie de playa (${distanceToSelectedKm.toFixed(2)} km)`
                  : `A ${distanceToSelectedKm.toFixed(1)} km del spot: aviso remoto`}
            </Text>

            <TouchableOpacity
              style={[styles.publishBtn, !description.trim() && styles.publishBtnDisabled]}
              onPress={publish}
              activeOpacity={0.8}
              disabled={!description.trim()}
            >
              <Text style={styles.publishBtnText}>Publicar aviso</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
    marginBottom: 16,
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
  newPostBtn: {
    backgroundColor: THEME.accent,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  newPostBtnText: {
    color: THEME.bg,
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 0.5,
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
  postCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: THEME.surface,
    borderWidth: 1,
    borderColor: THEME.line,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  avatar: {
    width: 36,
    height: 36,
    backgroundColor: THEME.accent,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: THEME.bg,
    fontWeight: '800',
    fontSize: 13,
  },
  postBody: {
    flex: 1,
  },
  postTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  postAuthor: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.text,
  },
  postTime: {
    fontSize: 10,
    color: THEME.textFaint,
  },
  postSpotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  postSpot: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.accent,
    marginRight: 8,
  },
  verifiedPill: {
    backgroundColor: 'rgba(11, 214, 116, 0.15)',
    borderWidth: 1,
    borderColor: THEME.wind.offshore,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  verifiedText: {
    fontSize: 8,
    fontWeight: '800',
    color: THEME.wind.offshore,
    letterSpacing: 0.5,
  },
  postDescription: {
    fontSize: 12,
    color: THEME.textSecondary,
    lineHeight: 17,
    marginBottom: 8,
  },
  postBottom: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  postSpotLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.textMuted,
    marginRight: 6,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  composer: {
    backgroundColor: THEME.surface2,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    borderColor: THEME.line,
    padding: 18,
    paddingBottom: 28,
  },
  composerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  composerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: THEME.text,
    letterSpacing: 0.3,
  },
  composerClose: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.textMuted,
    letterSpacing: 0.5,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: THEME.textFaint,
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 8,
  },
  spotRow: {
    marginBottom: 4,
  },
  spotChip: {
    backgroundColor: THEME.surface3,
    borderWidth: 1,
    borderColor: THEME.line,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    marginRight: 8,
  },
  spotChipActive: {
    backgroundColor: THEME.accentMuted,
    borderColor: THEME.accentMuted,
  },
  spotChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.textSecondary,
  },
  spotChipTextActive: {
    color: THEME.text,
    fontWeight: '700',
  },
  ratingRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  ratingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: THEME.surface3,
    borderWidth: 1,
    borderColor: THEME.line,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 6,
  },
  ratingChipActive: {
    borderColor: THEME.accent,
  },
  ratingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  ratingChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.textSecondary,
  },
  ratingChipTextActive: {
    color: THEME.text,
    fontWeight: '700',
  },
  input: {
    backgroundColor: THEME.surface3,
    borderWidth: 1,
    borderColor: THEME.line,
    borderRadius: 8,
    padding: 12,
    minHeight: 76,
    color: THEME.text,
    fontSize: 13,
    textAlignVertical: 'top',
  },
  locationNote: {
    fontSize: 10,
    color: THEME.textFaint,
    marginTop: 10,
    marginBottom: 14,
  },
  publishBtn: {
    backgroundColor: THEME.accent,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  publishBtnDisabled: {
    opacity: 0.4,
  },
  publishBtnText: {
    color: THEME.bg,
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 0.5,
  },
});

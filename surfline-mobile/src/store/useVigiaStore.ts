import { create } from 'zustand';
import { getStorage } from '../services/storage/storageAdapter';

const CLIPS_STORAGE_KEY = 'meteosurf_vigia_clips';

export interface VigiaClip {
  id: string;
  spotId: string;
  spotName: string;
  uri: string;
  capturedAt: number;
  durationMs: number;
  waveHeight?: number;
  stars?: number;
  sizeBytes?: number;
}

interface VigiaStore {
  clips: VigiaClip[];
  isRecording: boolean;
  addClip: (clip: VigiaClip) => void;
  removeClip: (id: string) => void;
  setRecording: (value: boolean) => void;
  loadClips: () => Promise<void>;
}

function persistClips(clips: VigiaClip[]) {
  getStorage()
    .set(CLIPS_STORAGE_KEY, JSON.stringify(clips))
    .catch(() => {});
}

export const useVigiaStore = create<VigiaStore>((set) => ({
  clips: [
    {
      id: 'clip_planetario_init',
      spotId: 'Planetario',
      spotName: 'Planetario',
      uri: 'https://streaming.comunitatvalenciana.com/webcam/GraodeCastellon/playlist.m3u8',
      capturedAt: Date.now() - 3600000 * 2,
      durationMs: 20000,
      waveHeight: 0.65,
      stars: 4.0,
      sizeBytes: 2450000,
    },
    {
      id: 'clip_voramar_init',
      spotId: 'Voramar',
      spotName: 'Voramar',
      uri: 'https://streaming.comunitatvalenciana.com/webcam/BenicassimVela/playlist.m3u8',
      capturedAt: Date.now() - 3600000 * 5,
      durationMs: 20000,
      waveHeight: 0.55,
      stars: 3.5,
      sizeBytes: 1980000,
    },
  ],
  isRecording: false,
  addClip: (clip) =>
    set((s) => {
      const clips = [clip, ...s.clips];
      persistClips(clips);
      return { clips };
    }),
  removeClip: (id) =>
    set((s) => {
      const clips = s.clips.filter((c) => c.id !== id);
      persistClips(clips);
      return { clips };
    }),
  setRecording: (value) => set({ isRecording: value }),
  loadClips: async () => {
    try {
      const raw = await getStorage().get(CLIPS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) set({ clips: parsed });
      }
    } catch {
      // Si el almacenamiento falla se mantienen los clips de ejemplo
    }
  },
}));

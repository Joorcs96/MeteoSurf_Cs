import { create } from 'zustand';

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
  addClip: (clip) => set((s) => ({ clips: [clip, ...s.clips] })),
  removeClip: (id) => set((s) => ({ clips: s.clips.filter((c) => c.id !== id) })),
  setRecording: (value) => set({ isRecording: value }),
}));

import { create } from 'zustand';

export interface VigiaClip {
  id: string;
  spotId: string;
  uri: string;
  capturedAt: number;
  durationMs: number;
}

interface VigiaStore {
  clips: VigiaClip[];
  isRecording: boolean;
  addClip: (clip: VigiaClip) => void;
  removeClip: (id: string) => void;
  setRecording: (value: boolean) => void;
}

export const useVigiaStore = create<VigiaStore>((set) => ({
  clips: [],
  isRecording: false,
  addClip: (clip) => set((s) => ({ clips: [...s.clips, clip] })),
  removeClip: (id) => set((s) => ({ clips: s.clips.filter((c) => c.id !== id) })),
  setRecording: (value) => set({ isRecording: value }),
}));

import { create } from 'zustand';

export interface Spot {
  id: string;
  name: string;
  lat: number;
  lng: number;
  stars: number;
}

interface SpotStore {
  spots: Spot[];
  selectedSpotId: string | null;
  setSpots: (spots: Spot[]) => void;
  selectSpot: (id: string | null) => void;
}

export const useSpotStore = create<SpotStore>((set) => ({
  spots: [],
  selectedSpotId: null,
  setSpots: (spots) => set({ spots }),
  selectSpot: (id) => set({ selectedSpotId: id }),
}));

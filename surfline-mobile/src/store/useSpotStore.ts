import { create } from 'zustand';
import { SPOTS, Spot } from '../data/spotsData';

interface SpotStore {
  selectedSpotId: string;
  favorites: string[];
  selectSpot: (id: string) => void;
  toggleFavorite: (id: string) => void;
  isFavorite: (id: string) => boolean;
}

export const useSpotStore = create<SpotStore>((set, get) => ({
  selectedSpotId: 'Planetario', // Jordi: Planetario es el spot por defecto
  favorites: ['Planetario', 'Voramar'],
  selectSpot: (id: string) => set({ selectedSpotId: id }),
  toggleFavorite: (id: string) => {
    const { favorites } = get();
    if (favorites.includes(id)) {
      set({ favorites: favorites.filter((f) => f !== id) });
    } else {
      set({ favorites: [...favorites, id] });
    }
  },
  isFavorite: (id: string) => get().favorites.includes(id),
}));

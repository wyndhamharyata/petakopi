import type { Coffee } from '@rpcTypes/coffee.ts';
import { create, type StateCreator } from 'zustand/index';

export type Sheet = 'peek' | 'half' | 'full';
export type Tab = 'latestReviews' | 'allPlaces';
export type LatLng = [number, number];

type SelectedCoffeeSlice = {
  selectedCoffee: Coffee | null;
  setSelectedCoffee: (coffee: Coffee) => void;
  removeSelectedCoffee: () => void;
};

export const createSelectedCoffeeSlice: StateCreator<
  SelectedCoffeeSlice & PanelSlice,
  [],
  [],
  SelectedCoffeeSlice
> = (set, get) => ({
  selectedCoffee: null,
  // A fresh object every time, so picking the selected shop again still flies the map back to it.
  setSelectedCoffee: (coffee: Coffee) =>
    set({
      selectedCoffee: { ...coffee },
      editing: false,
      placing: false,
      draft: null,
      draftName: '',
      sheet: get().sheet === 'peek' ? 'half' : get().sheet,
    }),
  removeSelectedCoffee: () => set({ selectedCoffee: null }),
});

type PanelSlice = {
  sheet: Sheet;
  setSheet: (sheet: Sheet) => void;
  tab: Tab;
  setTab: (tab: Tab) => void;
  query: string;
  setQuery: (query: string) => void;
  // The list on screen in Browse, so J/K can step through it from the shop view.
  browseList: Coffee[];
  setBrowseList: (list: Coffee[]) => void;
  userLocation: LatLng | null;
  setUserLocation: (location: LatLng) => void;
  // Editing the selected shop, or a new one when nothing is selected.
  editing: boolean;
  // Adding: waiting for a tap on the map.
  placing: boolean;
  // Where the shop being edited or added sits; the map pin and the form share it.
  draft: LatLng | null;
  // The name a Google Maps link gave the shop being added.
  draftName: string;
  setDraft: (draft: LatLng) => void;
  importShop: (name: string, latLng: LatLng) => void;
  startEdit: () => void;
  startAdd: () => void;
  stopEdit: () => void;
};

export const createPanelSlice: StateCreator<
  SelectedCoffeeSlice & PanelSlice,
  [],
  [],
  PanelSlice
> = (set, get) => ({
  sheet: 'half',
  setSheet: (sheet) => set({ sheet }),
  tab: 'latestReviews',
  setTab: (tab) => set({ tab }),
  query: '',
  setQuery: (query) => set({ query }),
  browseList: [],
  setBrowseList: (browseList) => set({ browseList }),
  userLocation: null,
  setUserLocation: (userLocation) => set({ userLocation }),
  editing: false,
  placing: false,
  draft: null,
  draftName: '',
  setDraft: (draft) => set({ draft }),
  startEdit: () => {
    const coffee = get().selectedCoffee;
    if (coffee) set({ editing: true, draft: [coffee.lat, coffee.lng], sheet: 'full' });
  },
  // Shrinks the sheet so the map is free to tap.
  startAdd: () =>
    set({
      selectedCoffee: null,
      editing: false,
      placing: true,
      draft: null,
      draftName: '',
      sheet: 'peek',
    }),
  // A Google Maps link gave the name and the spot: skip the map tap.
  importShop: (draftName, draft) =>
    set({ selectedCoffee: null, editing: true, placing: false, draftName, draft, sheet: 'full' }),
  stopEdit: () => set({ editing: false, placing: false, draft: null, draftName: '' }),
});

export const useAppStore = create<SelectedCoffeeSlice & PanelSlice>()((...a) => ({
  ...createSelectedCoffeeSlice(...a),
  ...createPanelSlice(...a),
}));

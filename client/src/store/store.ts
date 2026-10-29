import type { Coffee } from '@rpcTypes/coffee.ts';
import { create, type StateCreator } from 'zustand/index';

export type Sheet = 'peek' | 'half' | 'full';
export type Tab = 'latestReviews' | 'allPlaces';
export type LatLng = [number, number];

type SelectedCoffeeSlice = {
  selectedCoffee: Coffee | null;
  // still: the ticket is already in place (a saved nota turning back into it), so it doesn't hang in.
  setSelectedCoffee: (coffee: Coffee, still?: boolean) => void;
  still: boolean;
  removeSelectedCoffee: () => void;
  // The stub under the pointer, which gets a faint thread to its stamp.
  stubHover: string | null;
  setStubHover: (id: string | null) => void;
  // Shops opened before the open one, newest first: the stubs on the rail.
  rail: Coffee[];
  takeDown: (id: string) => void;
};

const RAIL_LENGTH = 3;
// The open shop goes back on the rail as a stub; the oldest stub falls off the end.
const hang = (rail: Coffee[], open: Coffee | null, next?: Coffee) =>
  [open, ...rail]
    .filter((c): c is Coffee => !!c && c.id !== next?.id)
    .filter((c, i, all) => all.findIndex((o) => o.id === c.id) === i)
    .slice(0, RAIL_LENGTH);

export const createSelectedCoffeeSlice: StateCreator<
  SelectedCoffeeSlice & PanelSlice,
  [],
  [],
  SelectedCoffeeSlice
> = (set, get) => ({
  selectedCoffee: null,
  rail: [],
  still: false,
  stubHover: null,
  setStubHover: (stubHover) => set({ stubHover }),
  // A fresh object every time, so picking the selected shop again still flies the map back to it.
  setSelectedCoffee: (coffee: Coffee, still = false) =>
    set({
      selectedCoffee: { ...coffee },
      still,
      stubHover: null,
      rail: hang(get().rail, get().selectedCoffee, coffee),
      editing: false,
      placing: false,
      draft: null,
      draftName: '',
      sheet: get().sheet === 'peek' ? 'half' : get().sheet,
    }),
  removeSelectedCoffee: () =>
    set({ selectedCoffee: null, rail: hang(get().rail, get().selectedCoffee) }),
  takeDown: (id) => set({ rail: get().rail.filter((c) => c.id !== id) }),
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
  // The tack is being dragged: the location field shows it is being written.
  dragging: boolean;
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
  dragging: false,
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

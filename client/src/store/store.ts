import type { Coffee } from '@rpcTypes/coffee.ts';
import { create, type StateCreator } from 'zustand/index';

type CollapsibleSlice = {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
};

export const createCollapsibleSlice: StateCreator<CollapsibleSlice> = (
  set
) => ({
  collapsed: false,
  setCollapsed: (collapsed: boolean) => {
    set({ collapsed });
  },
});

type SelectedCoffeeSlice = {
  selectedCoffee: Coffee | null;
  setSelectedCoffee: (coffee: Coffee) => void;
  removeSelectedCoffee: () => void;
};

export const createSelectedCoffeeSlice: StateCreator<SelectedCoffeeSlice> = (set) => ({
  selectedCoffee: null,
  // A fresh object every time, so picking the selected shop again still flies the map back to it.
  setSelectedCoffee: (coffee: Coffee) => set({ selectedCoffee: { ...coffee } }),
  removeSelectedCoffee: () => {
    set({ selectedCoffee: null });
  },
});

type SearchResultSlice = {
  searchResults: Coffee[] | null;
  setSearchResult: (coffees: Coffee[]) => void;
  clearSearchResult: () => void;
};

export const createSearchResultSlice: StateCreator<SearchResultSlice> = (
  set,
  get
) => ({
  searchResults: null,
  setSearchResult: (coffees: Coffee[]) => {
    const current = get().searchResults;
    // Only update if the results are actually different
    if (
      !current ||
      current.length !== coffees.length ||
      !current.every((coffee, index) => coffee.id === coffees[index]?.id)
    ) {
      set({ searchResults: coffees });
    }
  },
  clearSearchResult: () => {
    const current = get().searchResults;
    // Only update if there are actually results to clear
    if (current !== null) {
      set({ searchResults: null });
    }
  },
});

export const useAppStore = create<
  SelectedCoffeeSlice & SearchResultSlice & CollapsibleSlice
>()((...a) => ({
  ...createSelectedCoffeeSlice(...a),
  ...createSearchResultSlice(...a),
  ...createCollapsibleSlice(...a),
}));

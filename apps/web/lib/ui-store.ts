'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UiState {
  kitchenDisplayMode: boolean;
  setKitchenDisplayMode: (value: boolean) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      kitchenDisplayMode: false,
      setKitchenDisplayMode: (value) => set({ kitchenDisplayMode: value }),
    }),
    { name: 'qauto-ui' },
  ),
);

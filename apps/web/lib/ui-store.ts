'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UiState {
  kitchenDisplayMode: boolean;
  sidebarCollapsed: boolean;
  registerTipsDismissed: boolean;
  setKitchenDisplayMode: (value: boolean) => void;
  setSidebarCollapsed: (value: boolean) => void;
  setRegisterTipsDismissed: (value: boolean) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      kitchenDisplayMode: false,
      sidebarCollapsed: false,
      registerTipsDismissed: false,
      setKitchenDisplayMode: (value) => set({ kitchenDisplayMode: value }),
      setSidebarCollapsed: (value) => set({ sidebarCollapsed: value }),
      setRegisterTipsDismissed: (value) => set({ registerTipsDismissed: value }),
    }),
    { name: 'qauto-ui' },
  ),
);

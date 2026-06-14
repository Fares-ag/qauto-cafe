'use client';

import { create } from 'zustand';
import type { MenuCatalog, MenuCatalogItem, Order, CartLineInput } from '@qauto/shared-types';

export interface PendingLine {
  item: MenuCatalogItem;
  sizeId?: string;
  modifierIds: string[];
  notes?: string;
}

interface CartState {
  catalog: MenuCatalog | null;
  order: Order | null;
  pending: PendingLine | null;
  isSyncing: boolean;
  setCatalog: (catalog: MenuCatalog) => void;
  setOrder: (order: Order | null) => void;
  setPending: (pending: PendingLine | null) => void;
  setSyncing: (value: boolean) => void;
  localLines: CartLineInput[];
  setLocalLines: (lines: CartLineInput[]) => void;
  reset: () => void;
}

export const useCartStore = create<CartState>((set) => ({
  catalog: null,
  order: null,
  pending: null,
  isSyncing: false,
  localLines: [],
  setCatalog: (catalog) => set({ catalog }),
  setOrder: (order) => set({ order }),
  setPending: (pending) => set({ pending }),
  setSyncing: (isSyncing) => set({ isSyncing }),
  setLocalLines: (localLines) => set({ localLines }),
  reset: () =>
    set({
      catalog: null,
      order: null,
      pending: null,
      isSyncing: false,
      localLines: [],
    }),
}));

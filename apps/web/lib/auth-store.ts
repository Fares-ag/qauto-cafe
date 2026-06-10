'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthUser, Shift } from '@qauto/shared-types';

interface AuthState {
  accessToken: string | null;
  user: AuthUser | null;
  branchId: string | null;
  posTerminalId: string | null;
  kitchenTerminalId: string | null;
  shiftId: string | null;
  currentShift: Shift | null;
  hasHydrated: boolean;
  setSession: (data: {
    accessToken: string;
    user: AuthUser;
    branchId?: string;
  }) => void;
  setPosTerminalId: (id: string | null) => void;
  setKitchenTerminalId: (id: string | null) => void;
  setShift: (shift: Shift | null) => void;
  setHasHydrated: (value: boolean) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      user: null,
      branchId: null,
      posTerminalId: null,
      kitchenTerminalId: null,
      shiftId: null,
      currentShift: null,
      hasHydrated: false,
      setSession: ({ accessToken, user, branchId }) =>
        set((state) => ({
          accessToken,
          user,
          branchId: branchId ?? state.branchId,
        })),
      setPosTerminalId: (posTerminalId) => set({ posTerminalId }),
      setKitchenTerminalId: (kitchenTerminalId) => set({ kitchenTerminalId }),
      setShift: (shift) => set({ currentShift: shift, shiftId: shift?.id ?? null }),
      setHasHydrated: (value) => set({ hasHydrated: value }),
      clearSession: () =>
        set({
          accessToken: null,
          user: null,
          branchId: null,
          posTerminalId: null,
          kitchenTerminalId: null,
          shiftId: null,
          currentShift: null,
        }),
    }),
    {
      name: 'qauto-web-auth',
      partialize: (state) => ({
        accessToken: state.accessToken,
        user: state.user,
        branchId: state.branchId,
        posTerminalId: state.posTerminalId,
        kitchenTerminalId: state.kitchenTerminalId,
        shiftId: state.shiftId,
        currentShift: state.currentShift,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);

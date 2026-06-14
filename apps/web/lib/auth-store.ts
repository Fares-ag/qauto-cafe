'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthUser, Shift } from '@qauto/shared-types';

export type SessionType = 'staff' | 'manager';

interface AuthState {
  accessToken: string | null;
  user: AuthUser | null;
  branchId: string | null;
  sessionType: SessionType | null;
  posTerminalId: string | null;
  kitchenTerminalId: string | null;
  shiftId: string | null;
  currentShift: Shift | null;
  hasHydrated: boolean;
  setSession: (data: {
    accessToken: string;
    user: AuthUser;
    branchId?: string;
    sessionType?: SessionType;
  }) => void;
  setBranchId: (branchId: string | null) => void;
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
      sessionType: null,
      posTerminalId: null,
      kitchenTerminalId: null,
      shiftId: null,
      currentShift: null,
      hasHydrated: false,
      setSession: ({ accessToken, user, branchId, sessionType }) =>
        set((state) => ({
          accessToken,
          user,
          branchId: branchId ?? state.branchId,
          sessionType: sessionType ?? state.sessionType,
        })),
      setBranchId: (branchId) => set({ branchId }),
      setPosTerminalId: (posTerminalId) => set({ posTerminalId }),
      setKitchenTerminalId: (kitchenTerminalId) => set({ kitchenTerminalId }),
      setShift: (shift) => set({ currentShift: shift, shiftId: shift?.id ?? null }),
      setHasHydrated: (value) => set({ hasHydrated: value }),
      clearSession: () =>
        set({
          accessToken: null,
          user: null,
          branchId: null,
          sessionType: null,
          posTerminalId: null,
          kitchenTerminalId: null,
          shiftId: null,
          currentShift: null,
        }),
    }),
    {
      name: 'qauto-web-auth',
      partialize: (state) => ({
        user: state.user,
        branchId: state.branchId,
        sessionType: state.sessionType,
        posTerminalId: state.posTerminalId,
        kitchenTerminalId: state.kitchenTerminalId,
        shiftId: state.shiftId,
        currentShift: state.currentShift,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
        if (typeof window === 'undefined' || !state?.user) return;
        const e2eToken = sessionStorage.getItem('qauto-e2e-access-token');
        if (e2eToken) {
          state.setSession({
            accessToken: e2eToken,
            user: state.user,
            branchId: state.branchId ?? undefined,
            sessionType: state.sessionType ?? undefined,
          });
        }
      },
    },
  ),
);

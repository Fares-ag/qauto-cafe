'use client';

import { ApiClient } from '@qauto/api-client';
import { useAuthStore } from './auth-store';

export const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? '/api/v1';

function createBareClient() {
  return new ApiClient({
    baseUrl,
    getAccessToken: () => useAuthStore.getState().accessToken,
    getBranchId: () => useAuthStore.getState().branchId,
  });
}

let refreshInFlight: Promise<boolean> | null = null;

async function performRefresh(): Promise<boolean> {
  try {
    const client = createBareClient();
    const response = await client.refreshSession();
    const state = useAuthStore.getState();
    state.setSession({
      accessToken: response.accessToken,
      user: response.user,
      branchId: response.branchId ?? state.branchId ?? undefined,
    });
    return true;
  } catch {
    useAuthStore.getState().clearSession();
    return false;
  }
}

export async function refreshAccessToken(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = performRefresh().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

export function getApiClient() {
  return new ApiClient({
    baseUrl,
    getAccessToken: () => useAuthStore.getState().accessToken,
    getBranchId: () => useAuthStore.getState().branchId,
    onUnauthorized: refreshAccessToken,
  });
}

export async function withAuth<T>(fn: (client: ApiClient) => Promise<T>): Promise<T> {
  return fn(getApiClient());
}

export function getBusinessDate(offsetDays = 0): string {
  const now = new Date();
  const business = new Date(now);
  if (now.getHours() < 4) {
    business.setDate(business.getDate() - 1);
  }
  if (offsetDays) {
    business.setDate(business.getDate() + offsetDays);
  }
  return business.toISOString().slice(0, 10);
}

export function formatQar(value: string | number) {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return `${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} QAR`;
}

'use client';

import { ApiClient, ApiError } from '@qauto/api-client';
import { useAuthStore } from './auth-store';

export const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

export const wsBase =
  process.env.NEXT_PUBLIC_WS_URL?.replace(/\/ws\/?$/, '') ?? 'http://localhost:3001';

export function getApiClient() {
  return new ApiClient({
    baseUrl,
    getAccessToken: () => useAuthStore.getState().accessToken,
    getBranchId: () => useAuthStore.getState().branchId,
  });
}

export async function refreshAccessToken(): Promise<boolean> {
  try {
    const client = getApiClient();
    const response = await client.refreshSession();
    const state = useAuthStore.getState();
    state.setSession({
      accessToken: response.accessToken,
      user: response.user,
      branchId: response.branchId ?? state.branchId ?? undefined,
    });
    return true;
  } catch {
    return false;
  }
}

export async function withAuth<T>(fn: (client: ApiClient) => Promise<T>): Promise<T> {
  try {
    return await fn(getApiClient());
  } catch (err) {
    if (err instanceof ApiError && err.body.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return await fn(getApiClient());
      }
      useAuthStore.getState().clearSession();
    }
    throw err;
  }
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

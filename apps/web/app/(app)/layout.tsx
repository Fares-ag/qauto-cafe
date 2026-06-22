'use client';

import { useEffect, useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AppShell, ToastProvider } from '@qauto/ui';
import { refreshAccessToken, getApiClient } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { useCartStore } from '@/lib/cart-store';
import { applyNavBadges, getNavGroups, getRoleLabel, getShellSubtitle } from '@/lib/navigation';
import { useUiStore } from '@/lib/ui-store';
import { useNavBadges } from '@/lib/queries';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, branchId, sessionType, hasHydrated, accessToken, clearSession, setBranchId } =
    useAuthStore();
  const kitchenDisplayMode = useUiStore((s) => s.kitchenDisplayMode);
  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed);
  const setSidebarCollapsed = useUiStore((s) => s.setSidebarCollapsed);
  const minimalChrome = pathname === '/kitchen' && kitchenDisplayMode;
  const { data: badges } = useNavBadges(branchId, {
    enabled: Boolean(branchId) && !minimalChrome,
    refetchInterval: minimalChrome ? false : 30_000,
  });

  const badgeCounts = useMemo(
    () => ({
      unpaidCount: badges?.unpaidCount ?? 0,
      kitchenCount: badges?.kitchenCount ?? 0,
    }),
    [badges?.unpaidCount, badges?.kitchenCount],
  );

  useEffect(() => {
    if (!hasHydrated) return;
    if (!user) router.replace('/login');
  }, [hasHydrated, user, router]);

  useEffect(() => {
    if (!hasHydrated || !user || branchId) return;
    void getApiClient()
      .getMe()
      .then((me) => {
        const branches = (me as { branches?: Array<{ id: string; isDefault?: boolean }> }).branches ?? [];
        const defaultBranch = branches.find((b) => b.isDefault) ?? branches[0];
        if (defaultBranch) setBranchId(defaultBranch.id);
      })
      .catch(() => undefined);
  }, [hasHydrated, user, branchId, setBranchId]);

  useEffect(() => {
    if (!hasHydrated || !user || accessToken) return;
    void refreshAccessToken();
  }, [hasHydrated, user, accessToken]);

  const navGroups = useMemo(
    () =>
      applyNavBadges(getNavGroups(sessionType), {
        orders: badgeCounts.unpaidCount,
        kitchen: badgeCounts.kitchenCount,
      }),
    [sessionType, badgeCounts.unpaidCount, badgeCounts.kitchenCount],
  );

  if (!hasHydrated || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
      </main>
    );
  }

  return (
    <ToastProvider>
      <AppShell
        brand="QAuto Café"
        subtitle={getShellSubtitle(sessionType)}
        navGroups={minimalChrome ? undefined : navGroups}
        nav={minimalChrome ? [] : undefined}
        activePath={pathname}
        minimalChrome={minimalChrome}
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
        onNavigate={(href) => router.push(href)}
        user={{
          name: `${user.firstName} ${user.lastName}`,
          role: getRoleLabel(user.role, sessionType),
        }}
        onLogout={() => {
          void getApiClient()
            .logoutSession()
            .catch(() => undefined)
            .finally(() => {
              useCartStore.getState().reset();
              clearSession();
              router.push(sessionType === 'staff' ? '/login/pin' : '/login');
            });
        }}
      >
        {children}
      </AppShell>
    </ToastProvider>
  );
}

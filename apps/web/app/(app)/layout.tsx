'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AppShell, ToastProvider } from '@qauto/ui';
import { refreshAccessToken, getApiClient } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { useCartStore } from '@/lib/cart-store';
import { applyNavBadges, getNavGroups, getRoleLabel, getShellSubtitle } from '@/lib/navigation';
import { useUiStore } from '@/lib/ui-store';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, branchId, sessionType, hasHydrated, clearSession, setBranchId } = useAuthStore();
  const kitchenDisplayMode = useUiStore((s) => s.kitchenDisplayMode);
  const [unpaidCount, setUnpaidCount] = useState(0);
  const [kitchenCount, setKitchenCount] = useState(0);

  const loadBadges = useCallback(async () => {
    if (!branchId) return;
    try {
      const client = getApiClient();
      const [unpaid, queue] = await Promise.all([
        client.getUnpaidOrdersReport(branchId),
        client.getOrderQueue(branchId),
      ]);
      setUnpaidCount(unpaid.orderCount);
      setKitchenCount(queue.filter((o) => ['PAID', 'IN_PREP', 'READY'].includes(o.status)).length);
    } catch {
      // Badges are optional — ignore auth errors here
    }
  }, [branchId]);

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
    if (!hasHydrated) return;
    if (!user) return;
    void refreshAccessToken();
  }, [hasHydrated, user]);

  useEffect(() => {
    if (!branchId || !user) return;
    if (pathname === '/dashboard' || pathname === '/orders' || pathname === '/kitchen') return;

    loadBadges();
    const interval = setInterval(loadBadges, 60000);
    return () => clearInterval(interval);
  }, [branchId, user, loadBadges, pathname]);

  const navGroups = useMemo(
    () =>
      applyNavBadges(getNavGroups(sessionType), {
        orders: unpaidCount,
        kitchen: kitchenCount,
      }),
    [sessionType, unpaidCount, kitchenCount],
  );

  const minimalChrome = pathname === '/kitchen' && kitchenDisplayMode;

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
        onNavigate={(href) => router.push(href)}
        user={{
          name: `${user.firstName} ${user.lastName}`,
          role: getRoleLabel(user.role, sessionType),
        }}
        onLogout={() => {
          useCartStore.getState().reset();
          clearSession();
          router.push(sessionType === 'staff' ? '/login/pin' : '/login');
        }}
      >
        {children}
      </AppShell>
    </ToastProvider>
  );
}

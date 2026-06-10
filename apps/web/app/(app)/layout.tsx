'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AppShell, ToastProvider } from '@qauto/ui';
import { useAuthStore } from '@/lib/auth-store';

const NAV = [
  { id: 'dashboard', label: 'Dashboard', href: '/dashboard' },
  { id: 'sell', label: 'Sell', href: '/sell' },
  { id: 'kitchen', label: 'Kitchen', href: '/kitchen' },
  { id: 'orders', label: 'Orders', href: '/orders' },
  { id: 'menu', label: 'Menu', href: '/menu' },
  { id: 'inventory', label: 'Inventory', href: '/inventory' },
  { id: 'reports', label: 'Reports', href: '/reports' },
  { id: 'procurement', label: 'Procurement', href: '/procurement' },
  { id: 'audit', label: 'Audit log', href: '/audit' },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, accessToken, hasHydrated, clearSession } = useAuthStore();

  useEffect(() => {
    if (!hasHydrated) return;
    if (!user || !accessToken) router.replace('/login');
  }, [hasHydrated, user, accessToken, router]);

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
        subtitle="Admin"
        nav={NAV}
        activePath={pathname}
        onNavigate={(href) => router.push(href)}
        user={{ name: `${user.firstName} ${user.lastName}`, role: 'Admin' }}
        onLogout={() => {
          clearSession();
          router.push('/login');
        }}
      >
        {children}
      </AppShell>
    </ToastProvider>
  );
}

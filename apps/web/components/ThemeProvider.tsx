'use client';

import { useEffect } from 'react';
import { useThemeStore } from '@/lib/theme-store';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { theme, hasHydrated } = useThemeStore();

  useEffect(() => {
    if (!hasHydrated) return;
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme, hasHydrated]);

  return <>{children}</>;
}

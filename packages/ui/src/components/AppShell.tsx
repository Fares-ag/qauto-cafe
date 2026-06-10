'use client';

import type { ReactNode } from 'react';
import { Button } from './Button';

export interface NavItem {
  id: string;
  label: string;
  href: string;
  icon?: ReactNode;
}

export function AppShell({
  brand,
  subtitle,
  nav,
  activePath,
  user,
  onLogout,
  onNavigate,
  children,
}: {
  brand: string;
  subtitle?: string;
  nav: NavItem[];
  activePath: string;
  user?: { name: string; role?: string };
  onLogout?: () => void;
  /** Client-side navigation (e.g. Next.js router.push). Avoids full reloads that break persisted auth. */
  onNavigate?: (href: string) => void;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-surface">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-surface-raised lg:flex">
        <div className="border-b border-border px-5 py-5">
          <p className="text-base font-semibold tracking-tight text-ink">{brand}</p>
          {subtitle ? <p className="mt-0.5 text-xs text-ink-muted">{subtitle}</p> : null}
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {nav.map((item) => {
            const active =
              item.href === '/dashboard'
                ? activePath === '/dashboard'
                : activePath === item.href || activePath.startsWith(`${item.href}/`);
            const className = `flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 ${
              active
                ? 'bg-brand-muted text-brand'
                : 'text-ink-secondary hover:bg-surface-sunken hover:text-ink'
            }`;

            if (onNavigate) {
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate(item.href)}
                  className={className}
                >
                  {item.icon}
                  {item.label}
                </button>
              );
            }

            return (
              <a key={item.id} href={item.href} className={className}>
                {item.icon}
                {item.label}
              </a>
            );
          })}
        </nav>
        {user ? (
          <div className="border-t border-border p-4">
            <p className="truncate text-sm font-medium text-ink">{user.name}</p>
            {user.role ? (
              <p className="truncate text-xs text-ink-muted">{user.role}</p>
            ) : null}
            {onLogout ? (
              <Button variant="ghost" size="sm" className="mt-3 w-full justify-start" onClick={onLogout}>
                Sign out
              </Button>
            ) : null}
          </div>
        ) : null}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border bg-surface-raised/80 px-4 py-3 backdrop-blur lg:px-6">
          <div className="lg:hidden">
            <p className="text-sm font-semibold text-ink">{brand}</p>
          </div>
          <div className="ml-auto flex items-center gap-2 lg:hidden">
            {onLogout ? (
              <Button variant="ghost" size="sm" onClick={onLogout}>
                Sign out
              </Button>
            ) : null}
          </div>
        </header>
        <main className="flex-1 animate-fade-in p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}

'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { Button } from './Button';

export interface NavItem {
  id: string;
  label: string;
  href: string;
  icon?: ReactNode;
  badge?: number;
}

export interface NavGroup {
  label?: string;
  items: NavItem[];
}

export function AppShell({
  brand,
  subtitle,
  nav,
  navGroups,
  activePath,
  user,
  onLogout,
  onNavigate,
  minimalChrome = false,
  headerExtra,
  children,
}: {
  brand: string;
  subtitle?: string;
  nav?: NavItem[];
  navGroups?: NavGroup[];
  activePath: string;
  user?: { name: string; role?: string };
  onLogout?: () => void;
  onNavigate?: (href: string) => void;
  minimalChrome?: boolean;
  headerExtra?: ReactNode;
  children: ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const groups = navGroups ?? (nav ? [{ items: nav }] : []);

  useEffect(() => {
    setDrawerOpen(false);
  }, [activePath]);

  function isActive(item: NavItem) {
    return item.href === '/dashboard'
      ? activePath === '/dashboard'
      : activePath === item.href || activePath.startsWith(`${item.href}/`);
  }

  function navLinkClass(active: boolean) {
    return `flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150 ${
      active
        ? 'bg-brand-muted text-brand'
        : 'text-ink-secondary hover:bg-surface-sunken hover:text-ink'
    }`;
  }

  function handleNavigate(href: string) {
    setDrawerOpen(false);
    if (onNavigate) onNavigate(href);
  }

  function renderNavItem(item: NavItem) {
    const active = isActive(item);
    const className = navLinkClass(active);
    const content = (
      <>
        {item.icon ? <span className="shrink-0 opacity-90">{item.icon}</span> : null}
        <span className="flex-1 truncate text-left">{item.label}</span>
        {item.badge && item.badge > 0 ? (
          <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[10px] font-bold text-white">
            {item.badge > 99 ? '99+' : item.badge}
          </span>
        ) : null}
      </>
    );

    if (onNavigate) {
      return (
        <button key={item.id} type="button" onClick={() => handleNavigate(item.href)} className={className}>
          {content}
        </button>
      );
    }

    return (
      <a key={item.id} href={item.href} className={className}>
        {content}
      </a>
    );
  }

  function renderNavGroups(compact = false) {
    return groups.map((group, index) => (
      <div key={group.label ?? `group-${index}`} className={compact ? 'space-y-1' : 'space-y-1'}>
        {group.label ? (
          <p className="mb-1 px-3 pt-2 text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
            {group.label}
          </p>
        ) : null}
        {group.items.map(renderNavItem)}
      </div>
    ));
  }

  const userFooter = user ? (
    <div className="border-t border-border p-4">
      <p className="truncate text-sm font-medium text-ink">{user.name}</p>
      {user.role ? <p className="truncate text-xs text-ink-muted">{user.role}</p> : null}
      {onLogout ? (
        <Button variant="ghost" size="sm" className="mt-3 w-full justify-start" onClick={onLogout}>
          Sign out
        </Button>
      ) : null}
    </div>
  ) : null;

  if (minimalChrome) {
    return (
      <div className="flex min-h-screen flex-col bg-surface">
        <header className="flex items-center justify-between gap-3 border-b border-border bg-surface-raised/90 px-4 py-3 backdrop-blur">
          <div className="flex min-w-0 items-center gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink">{brand}</p>
              {subtitle ? <p className="truncate text-xs text-ink-muted">{subtitle}</p> : null}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {headerExtra}
            {onLogout ? (
              <Button variant="ghost" size="sm" onClick={onLogout}>
                Sign out
              </Button>
            ) : null}
          </div>
        </header>
        <main className="flex-1 animate-fade-in p-4 lg:p-6">{children}</main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-surface">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-surface-raised lg:flex">
        <div className="border-b border-border px-5 py-5">
          <p className="text-base font-semibold tracking-tight text-ink">{brand}</p>
          {subtitle ? <p className="mt-0.5 text-xs text-ink-muted">{subtitle}</p> : null}
        </div>
        <nav className="flex-1 space-y-2 overflow-y-auto p-3">{renderNavGroups()}</nav>
        {userFooter}
      </aside>

      {drawerOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-ink/40"
            aria-label="Close menu"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="relative flex h-full w-72 max-w-[85vw] flex-col bg-surface-raised shadow-soft-lg">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <p className="text-base font-semibold tracking-tight text-ink">{brand}</p>
                {subtitle ? <p className="mt-0.5 text-xs text-ink-muted">{subtitle}</p> : null}
              </div>
              <Button variant="ghost" size="sm" onClick={() => setDrawerOpen(false)} aria-label="Close menu">
                ✕
              </Button>
            </div>
            <nav className="flex-1 space-y-2 overflow-y-auto p-3">{renderNavGroups()}</nav>
            {userFooter}
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border bg-surface-raised/80 px-4 py-3 backdrop-blur lg:px-6">
          <div className="flex items-center gap-3 lg:hidden">
            <Button variant="ghost" size="sm" onClick={() => setDrawerOpen(true)} aria-label="Open menu">
              ☰
            </Button>
            <div>
              <p className="text-sm font-semibold text-ink">{brand}</p>
              {subtitle ? <p className="text-xs text-ink-muted">{subtitle}</p> : null}
            </div>
          </div>
          <div className="hidden lg:flex lg:items-center lg:gap-3">{headerExtra}</div>
          <div className="flex items-center gap-2 lg:hidden">{headerExtra}</div>
          <div className="flex items-center gap-2">
            {user ? (
              <span className="hidden text-sm text-ink-secondary sm:inline">{user.name}</span>
            ) : null}
            {onLogout ? (
              <Button variant="ghost" size="sm" onClick={onLogout} className="lg:hidden">
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

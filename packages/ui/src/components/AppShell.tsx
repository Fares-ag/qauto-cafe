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
  sidebarCollapsed = false,
  onToggleSidebar,
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
  sidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
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

  function navLinkClass(active: boolean, compact: boolean) {
    return `flex w-full items-center rounded-lg text-sm font-medium transition-colors duration-150 ${
      compact ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2.5'
    } ${
      active
        ? 'bg-brand-muted text-brand'
        : 'text-ink-secondary hover:bg-surface-sunken hover:text-ink'
    }`;
  }

  function handleNavigate(href: string) {
    setDrawerOpen(false);
    if (onNavigate) onNavigate(href);
  }

  function renderNavItem(item: NavItem, compact: boolean) {
    const active = isActive(item);
    const className = navLinkClass(active, compact);
    const content = (
      <>
        {item.icon ? (
          <span className="relative shrink-0 opacity-90">
            {item.icon}
            {compact && item.badge && item.badge > 0 ? (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[9px] font-bold text-white">
                {item.badge > 9 ? '9+' : item.badge}
              </span>
            ) : null}
          </span>
        ) : null}
        {!compact ? <span className="flex-1 truncate text-left">{item.label}</span> : null}
        {!compact && item.badge && item.badge > 0 ? (
          <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[10px] font-bold text-white">
            {item.badge > 99 ? '99+' : item.badge}
          </span>
        ) : null}
      </>
    );

    const title = compact ? item.label : undefined;

    if (onNavigate) {
      return (
        <button
          key={item.id}
          type="button"
          title={title}
          onClick={() => handleNavigate(item.href)}
          className={className}
        >
          {content}
        </button>
      );
    }

    return (
      <a key={item.id} href={item.href} title={title} className={className}>
        {content}
      </a>
    );
  }

  function renderNavGroups(compact: boolean) {
    return groups.map((group, index) => (
      <div key={group.label ?? `group-${index}`} className="space-y-1">
        {group.label && !compact ? (
          <p className="mb-1 px-3 pt-2 text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
            {group.label}
          </p>
        ) : null}
        {group.items.map((item) => renderNavItem(item, compact))}
      </div>
    ));
  }

  const userFooter = user ? (
    <div className={`border-t border-border ${sidebarCollapsed ? 'p-2' : 'p-4'}`}>
      {!sidebarCollapsed ? (
        <>
          <p className="truncate text-sm font-medium text-ink">{user.name}</p>
          {user.role ? <p className="truncate text-xs text-ink-muted">{user.role}</p> : null}
        </>
      ) : null}
      {onLogout ? (
        <Button
          variant="ghost"
          size="sm"
          className={`${sidebarCollapsed ? 'mt-0 w-full justify-center px-0' : 'mt-3 w-full justify-start'}`}
          onClick={onLogout}
          title={sidebarCollapsed ? 'Sign out' : undefined}
        >
          {sidebarCollapsed ? '⎋' : 'Sign out'}
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
      <aside
        className={`hidden shrink-0 flex-col border-r border-border bg-surface-raised transition-[width] duration-200 lg:flex ${
          sidebarCollapsed ? 'w-[4.5rem]' : 'w-60'
        }`}
      >
        <div
          className={`flex items-center border-b border-border ${
            sidebarCollapsed ? 'justify-center px-2 py-4' : 'justify-between px-5 py-5'
          }`}
        >
          {!sidebarCollapsed ? (
            <div className="min-w-0">
              <p className="text-base font-semibold tracking-tight text-ink">{brand}</p>
              {subtitle ? <p className="mt-0.5 truncate text-xs text-ink-muted">{subtitle}</p> : null}
            </div>
          ) : (
            <p className="text-lg font-bold text-brand" title={`${brand} · ${subtitle ?? ''}`}>
              Q
            </p>
          )}
          {onToggleSidebar ? (
            <Button
              variant="ghost"
              size="sm"
              className={sidebarCollapsed ? 'mt-2 w-full' : 'shrink-0'}
              onClick={onToggleSidebar}
              aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {sidebarCollapsed ? '»' : '«'}
            </Button>
          ) : null}
        </div>
        <nav className={`flex-1 space-y-2 overflow-y-auto ${sidebarCollapsed ? 'p-2' : 'p-3'}`}>
          {renderNavGroups(sidebarCollapsed)}
        </nav>
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
            <nav className="flex-1 space-y-2 overflow-y-auto p-3">{renderNavGroups(false)}</nav>
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
              <span className="hidden text-sm text-ink-secondary sm:inline">
                {user.name}
                {user.role ? ` · ${user.role}` : ''}
              </span>
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

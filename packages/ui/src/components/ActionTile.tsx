'use client';

import type { ReactNode } from 'react';

export function ActionTile({
  label,
  icon,
  variant = 'primary',
  disabled,
  loading,
  onClick,
  className = '',
}: {
  label: string;
  icon?: ReactNode;
  variant?: 'primary' | 'accent' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  const styles = {
    primary: 'bg-brand text-brand-foreground hover:bg-brand/90 shadow-soft',
    accent: 'bg-accent text-white hover:bg-accent/90 shadow-soft',
    ghost: 'border border-border bg-surface-raised text-ink hover:bg-surface-sunken',
  };

  return (
    <button
      type="button"
      disabled={disabled || loading}
      onClick={onClick}
      className={`flex min-h-[3.25rem] flex-col items-center justify-center gap-1 rounded-xl px-3 py-3 text-sm font-semibold transition-all duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`}
    >
      {loading ? (
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : (
        <>
          {icon ? <span className="text-lg leading-none">{icon}</span> : null}
          <span>{label}</span>
        </>
      )}
    </button>
  );
}

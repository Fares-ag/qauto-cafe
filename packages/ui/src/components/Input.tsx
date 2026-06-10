'use client';

import type { InputHTMLAttributes } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export function Input({ label, hint, error, className = '', id, ...props }: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
  return (
    <label className="block space-y-1.5">
      {label ? (
        <span className="text-sm font-medium text-ink-secondary">{label}</span>
      ) : null}
      <input
        id={inputId}
        className={`h-10 w-full rounded-lg border bg-surface-raised px-3 text-sm text-ink transition-colors duration-150 placeholder:text-ink-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 ${error ? 'border-danger' : 'border-border'} ${className}`}
        {...props}
      />
      {error ? (
        <span className="text-xs text-danger">{error}</span>
      ) : hint ? (
        <span className="text-xs text-ink-muted">{hint}</span>
      ) : null}
    </label>
  );
}

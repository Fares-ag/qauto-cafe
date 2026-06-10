'use client';

type AlertVariant = 'info' | 'success' | 'warning' | 'error';

const styles: Record<AlertVariant, string> = {
  info: 'border-border bg-surface-sunken text-ink-secondary',
  success: 'border-success/20 bg-success-muted text-success',
  warning: 'border-warning/20 bg-warning-muted text-warning',
  error: 'border-danger/20 bg-danger-muted text-danger',
};

export function Alert({
  children,
  variant = 'info',
  title,
  className = '',
}: {
  children?: React.ReactNode;
  variant?: AlertVariant;
  title?: string;
  className?: string;
}) {
  return (
    <div
      className={`animate-fade-in rounded-lg border px-4 py-3 text-sm ${styles[variant]} ${className}`}
      role="alert"
    >
      {title ? <p className="mb-1 font-medium">{title}</p> : null}
      {children}
    </div>
  );
}

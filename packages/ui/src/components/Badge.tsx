'use client';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'accent' | 'neutral';

const styles: Record<BadgeVariant, string> = {
  default: 'bg-brand-muted text-brand',
  success: 'bg-success-muted text-success',
  warning: 'bg-warning-muted text-warning',
  danger: 'bg-danger-muted text-danger',
  accent: 'bg-accent-muted text-accent',
  neutral: 'bg-surface-sunken text-ink-secondary',
};

export function Badge({
  children,
  variant = 'default',
  className = '',
}: {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${styles[variant]} ${className}`}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const labels: Record<string, string> = {
    DRAFT: 'Draft',
    PENDING_PAYMENT: 'Unpaid',
    PAID: 'Paid',
    IN_PREP: 'In prep',
    READY: 'Ready',
    COMPLETED: 'Completed',
    VOIDED: 'Voided',
    REFUNDED: 'Refunded',
    PARTIALLY_REFUNDED: 'Partial refund',
    OPEN: 'Open',
    CLOSED: 'Closed',
  };

  const map: Record<string, BadgeVariant> = {
    PAID: 'accent',
    PENDING_PAYMENT: 'warning',
    IN_PREP: 'warning',
    READY: 'success',
    COMPLETED: 'neutral',
    VOIDED: 'danger',
    REFUNDED: 'danger',
    PARTIALLY_REFUNDED: 'danger',
    DRAFT: 'neutral',
    OPEN: 'success',
    CLOSED: 'neutral',
  };

  return (
    <Badge variant={map[status] ?? 'neutral'}>{labels[status] ?? status.replaceAll('_', ' ')}</Badge>
  );
}

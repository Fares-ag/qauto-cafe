'use client';

import { Button, Card } from '@qauto/ui';
import { useUiStore } from '@/lib/ui-store';

export function RegisterTips() {
  const dismissed = useUiStore((s) => s.registerTipsDismissed);
  const setDismissed = useUiStore((s) => s.setRegisterTipsDismissed);

  if (dismissed) return null;

  return (
    <Card padding="lg" className="border-brand/20 bg-brand-muted/20">
      <h2 className="text-base font-semibold text-ink">Quick start</h2>
      <ol className="mt-2 list-inside list-decimal space-y-1 text-sm text-ink-secondary">
        <li>Tap a drink, pick size, then add to order</li>
        <li>Use <strong>Staff</strong> to find someone by extension, name, or department</li>
        <li>Tap <strong>Place order</strong> to send it to the kitchen</li>
      </ol>
      <Button variant="ghost" size="sm" className="mt-3" onClick={() => setDismissed(true)}>
        Got it
      </Button>
    </Card>
  );
}

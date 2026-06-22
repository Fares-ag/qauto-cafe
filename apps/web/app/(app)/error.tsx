'use client';

import { useEffect } from 'react';
import { Button, Card } from '@qauto/ui';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-[60vh] items-center justify-center p-6">
      <Card padding="lg" className="w-full max-w-md text-center">
        <h1 className="text-xl font-semibold text-ink">Something went wrong</h1>
        <p className="mt-2 text-sm text-ink-muted">
          {error.message || 'An unexpected error occurred. Try again or reload the page.'}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button variant="primary" onClick={reset}>
            Try again
          </Button>
          <Button variant="ghost" onClick={() => window.location.assign('/')}>
            Go home
          </Button>
        </div>
      </Card>
    </main>
  );
}

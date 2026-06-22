'use client';

import { useEffect } from 'react';
import { Button, Card } from '@qauto/ui';

export default function GlobalError({
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
    <html lang="en">
      <body className="min-h-screen bg-surface text-ink antialiased">
        <main className="flex min-h-screen items-center justify-center p-6">
          <Card padding="lg" className="w-full max-w-md text-center">
            <h1 className="text-xl font-semibold">Something went wrong</h1>
            <p className="mt-2 text-sm opacity-80">
              {error.message || 'An unexpected error occurred.'}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <Button variant="primary" onClick={reset}>
                Try again
              </Button>
            </div>
          </Card>
        </main>
      </body>
    </html>
  );
}

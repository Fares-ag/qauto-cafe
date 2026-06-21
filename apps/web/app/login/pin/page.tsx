'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ApiClient, ApiError } from '@qauto/api-client';
import { Alert, Card, PinPad } from '@qauto/ui';
import { useAuthStore } from '@/lib/auth-store';
import { baseUrl } from '@/lib/api';

export default function PinLoginPage() {
  const router = useRouter();
  const { user, hasHydrated, setSession, branchId } = useAuthStore();
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [terminalId, setTerminalId] = useState<string | null>(null);

  useEffect(() => {
    if (!hasHydrated) return;
    if (user) router.replace('/sell');
  }, [hasHydrated, user, router]);

  useEffect(() => {
    async function initTerminal() {
      try {
        const client = new ApiClient({ baseUrl });
        const bootstrap = await client.getBootstrap();
        const resolvedBranchId = branchId ?? bootstrap.branch?.id;
        if (!resolvedBranchId) {
          setError('No branch configured');
          return;
        }
        const posTerminal = bootstrap.terminals?.find((t) => t.type === 'POS');
        if (!posTerminal) {
          setError('No POS terminal configured. Ask a manager to register one.');
          return;
        }
        setTerminalId(posTerminal.id);
      } catch (err) {
        setError(
          err instanceof ApiError
            ? err.body.detail
            : err instanceof TypeError
              ? 'Cannot reach the API. Ensure the dev server is running (npm run dev).'
              : err instanceof Error
                ? err.message
                : 'Failed to initialize terminal',
        );
      }
    }
    if (hasHydrated) initTerminal();
  }, [hasHydrated, branchId]);

  async function handleSubmit() {
    if (!terminalId) return;
    setLoading(true);
    setError(null);
    try {
      const client = new ApiClient({ baseUrl });
      const res = await client.pinLogin(terminalId, pin);
      setSession({
        accessToken: res.accessToken,
        user: res.user,
        branchId: res.branchId ?? branchId ?? undefined,
        sessionType: 'staff',
      });
      router.push('/sell');
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.body.detail
          : err instanceof TypeError
            ? 'Cannot reach the API. Ensure the dev server is running (npm run dev).'
            : err instanceof Error
              ? err.message
              : 'Invalid PIN',
      );
      setPin('');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface p-6">
      <Card className="w-full max-w-sm animate-fade-in" padding="lg">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-muted text-lg font-bold text-brand">
            Q
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-ink">Staff PIN</h1>
          <p className="mt-1 text-sm text-ink-muted">Enter your PIN to open the register</p>
        </div>

        {terminalId ? (
          <PinPad
            pin={pin}
            onPinChange={setPin}
            onSubmit={handleSubmit}
            loading={loading}
            submitLabel="Sign in"
          />
        ) : (
          <div className="flex justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
          </div>
        )}

        {error ? <Alert variant="error" className="mt-4">{error}</Alert> : null}

        <p className="mt-6 text-center text-sm text-ink-muted">
          <a href="/login" className="text-brand hover:underline">
            Admin sign in
          </a>
        </p>
      </Card>
    </main>
  );
}

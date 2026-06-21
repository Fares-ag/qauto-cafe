'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ApiClient, ApiError } from '@qauto/api-client';
import { Alert, Button, Card, Input } from '@qauto/ui';
import { useAuthStore } from '@/lib/auth-store';
import { baseUrl } from '@/lib/api';

export default function AdminLoginPage() {
  const router = useRouter();
  const { user, hasHydrated, setSession } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!hasHydrated) return;
    if (user) router.replace('/dashboard');
  }, [hasHydrated, user, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const client = new ApiClient({ baseUrl });
      const res = await client.login(email, password);
      setSession({
        accessToken: res.accessToken,
        user: res.user,
        branchId: res.branchId,
        sessionType: 'manager',
      });
      router.push('/dashboard');
    } catch (err) {
      if (err instanceof ApiError) {
        const fieldMessages = err.body.errors?.map((e) => e.message).filter(Boolean);
        setError(fieldMessages?.length ? fieldMessages.join(' · ') : err.body.detail);
      } else if (err instanceof TypeError) {
        setError('Cannot reach the API. Ensure the dev server is running (npm run dev).');
      } else {
        setError(err instanceof Error ? err.message : 'Login failed');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface p-6">
      <Card className="w-full max-w-md animate-fade-in" padding="lg">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-muted text-lg font-bold text-brand">
            Q
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-ink">QAuto Café</h1>
          <p className="mt-1 text-sm text-ink-muted">Sign in to access all modules</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            label="Password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Button type="submit" variant="primary" size="lg" className="w-full" loading={loading}>
            Sign in
          </Button>
        </form>

        {error ? <Alert variant="error" className="mt-4">{error}</Alert> : null}

        <p className="mt-6 text-center text-sm text-ink-muted">
          <a href="/login/pin" className="text-brand hover:underline">
            Staff PIN login
          </a>
        </p>
      </Card>
    </main>
  );
}

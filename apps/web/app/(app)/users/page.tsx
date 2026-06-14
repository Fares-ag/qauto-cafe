'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Input,
  TableSkeleton,
  useToast,
} from '@qauto/ui';
import { getApiClient } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';

type User = Awaited<ReturnType<ReturnType<typeof getApiClient>['listUsers']>>[number];
type Branch = Awaited<ReturnType<ReturnType<typeof getApiClient>['listBranches']>>[number];

export default function UsersPage() {
  const branchId = useAuthStore((s) => s.branchId);
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    pin: '',
    employeeNumber: '',
    branchIds: [] as string[],
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const client = getApiClient();
      const [usersData, branchesData] = await Promise.all([
        client.listUsers(),
        client.listBranches(),
      ]);
      setUsers(usersData);
      setBranches(branchesData);
      if (form.branchIds.length === 0 && branchId) {
        setForm((f) => ({ ...f, branchIds: [branchId] }));
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to load users', 'error');
    } finally {
      setLoading(false);
    }
  }, [branchId, toast]);

  useEffect(() => {
    load();
  }, [load]);

  function toggleBranch(id: string) {
    setForm((f) => ({
      ...f,
      branchIds: f.branchIds.includes(id)
        ? f.branchIds.filter((b) => b !== id)
        : [...f.branchIds, id],
    }));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (form.branchIds.length === 0) {
      toast('Select at least one branch', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const client = getApiClient();
      await client.createUser({
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email || undefined,
        password: form.password || undefined,
        pin: form.pin,
        employeeNumber: form.employeeNumber || undefined,
        branchIds: form.branchIds,
      });
      toast('Staff member created', 'success');
      setForm({
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        pin: '',
        employeeNumber: '',
        branchIds: branchId ? [branchId] : [],
      });
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Create failed', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Users</h1>
        <p className="mt-1 text-sm text-ink-muted">Staff management and branch access</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card padding="lg" className="lg:col-span-1">
          <CardHeader title="Add staff member" />
          <form onSubmit={handleCreate} className="space-y-3">
            <Input
              label="First name"
              value={form.firstName}
              onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
              required
            />
            <Input
              label="Last name"
              value={form.lastName}
              onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
              required
            />
            <Input
              label="Email"
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
            <Input
              label="Password"
              type="password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            />
            <Input
              label="PIN (4–6 digits)"
              value={form.pin}
              onChange={(e) => setForm((f) => ({ ...f, pin: e.target.value }))}
              required
            />
            <Input
              label="Employee number"
              value={form.employeeNumber}
              onChange={(e) => setForm((f) => ({ ...f, employeeNumber: e.target.value }))}
            />
            <div className="space-y-2">
              <span className="text-sm font-medium text-ink-secondary">Branches</span>
              {branches.map((b) => (
                <label key={b.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.branchIds.includes(b.id)}
                    onChange={() => toggleBranch(b.id)}
                    className="rounded border-border"
                  />
                  <span>
                    {b.name} ({b.code})
                  </span>
                </label>
              ))}
            </div>
            <Button type="submit" variant="primary" loading={submitting}>
              Create user
            </Button>
          </form>
        </Card>

        <Card padding="lg" className="lg:col-span-2">
          <CardHeader title="Staff directory" />
          {loading ? (
            <TableSkeleton rows={8} />
          ) : users.length === 0 ? (
            <EmptyState title="No staff members" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-ink-muted">
                    <th className="pb-3 pr-4 font-medium">Name</th>
                    <th className="pb-3 pr-4 font-medium">Email</th>
                    <th className="pb-3 pr-4 font-medium">Role</th>
                    <th className="pb-3 pr-4 font-medium">Branches</th>
                    <th className="pb-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-border/60">
                      <td className="py-3 pr-4 font-medium text-ink">
                        {u.firstName} {u.lastName}
                      </td>
                      <td className="py-3 pr-4 text-ink-secondary">{u.email ?? '—'}</td>
                      <td className="py-3 pr-4">
                        <Badge variant="default">{u.role.name}</Badge>
                      </td>
                      <td className="py-3 pr-4">
                        {u.branches.map((ub) => ub.branch.code).join(', ') || '—'}
                      </td>
                      <td className="py-3">
                        <Badge variant={u.status === 'ACTIVE' ? 'success' : 'warning'}>
                          {u.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

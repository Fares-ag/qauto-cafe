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
import { Modal, selectClassName } from '@/components/admin/modal';
import { getApiClient } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';

type User = Awaited<ReturnType<ReturnType<typeof getApiClient>['listUsers']>>[number];
type Branch = Awaited<ReturnType<ReturnType<typeof getApiClient>['listBranches']>>[number];
type Role = Awaited<ReturnType<ReturnType<typeof getApiClient>['listRoles']>>[number];

export default function UsersPage() {
  const branchId = useAuthStore((s) => s.branchId);
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    employeeNumber: '',
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE' | 'SUSPENDED',
    roleId: '',
    branchIds: [] as string[],
    newPin: '',
  });
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
      const [usersData, branchesData, rolesData] = await Promise.all([
        client.listUsers(),
        client.listBranches(),
        client.listRoles(),
      ]);
      setUsers(usersData);
      setBranches(branchesData);
      setRoles(rolesData);
      if (form.branchIds.length === 0 && branchId) {
        setForm((f) => ({ ...f, branchIds: [branchId] }));
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to load users', 'error');
    } finally {
      setLoading(false);
    }
  }, [branchId, toast, form.branchIds.length]);

  useEffect(() => {
    load();
  }, [load]);

  function toggleBranch(ids: string[], id: string) {
    return ids.includes(id) ? ids.filter((b) => b !== id) : [...ids, id];
  }

  function openEdit(u: User) {
    setEditUser(u);
    setEditForm({
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email ?? '',
      employeeNumber: u.employeeNumber ?? '',
      status: u.status as 'ACTIVE' | 'INACTIVE' | 'SUSPENDED',
      roleId: u.role.id,
      branchIds: u.branches.map((b) => b.branch.id),
      newPin: '',
    });
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (form.branchIds.length === 0) {
      toast('Select at least one branch', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await getApiClient().createUser({
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email || undefined,
        password: form.password || undefined,
        pin: form.pin,
        employeeNumber: form.employeeNumber || undefined,
        branchIds: form.branchIds,
      });
      toast('Staff member created', 'success');
      setForm({ firstName: '', lastName: '', email: '', password: '', pin: '', employeeNumber: '', branchIds: branchId ? [branchId] : [] });
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Create failed', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function saveEdit() {
    if (!editUser) return;
    setSubmitting(true);
    try {
      const client = getApiClient();
      await client.updateUser(editUser.id, {
        firstName: editForm.firstName,
        lastName: editForm.lastName,
        email: editForm.email || undefined,
        employeeNumber: editForm.employeeNumber || undefined,
        status: editForm.status,
      });
      if (editForm.roleId !== editUser.role.id) {
        await client.assignUserRole(editUser.id, { roleId: editForm.roleId });
      }
      const prevBranches = editUser.branches.map((b) => b.branch.id).sort().join(',');
      const nextBranches = [...editForm.branchIds].sort().join(',');
      if (prevBranches !== nextBranches) {
        await client.setUserBranches(editUser.id, { branchIds: editForm.branchIds });
      }
      if (editForm.newPin.trim()) {
        await client.resetUserPin(editUser.id, { pin: editForm.newPin.trim() });
      }
      toast('Staff member updated', 'success');
      setEditUser(null);
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Update failed', 'error');
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
            <Input label="First name" value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} required />
            <Input label="Last name" value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} required />
            <Input label="Email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            <Input label="Password" type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
            <Input label="PIN (4–6 digits)" value={form.pin} onChange={(e) => setForm((f) => ({ ...f, pin: e.target.value }))} required />
            <Input label="Employee number" value={form.employeeNumber} onChange={(e) => setForm((f) => ({ ...f, employeeNumber: e.target.value }))} />
            <div className="space-y-2">
              <span className="text-sm font-medium text-ink-secondary">Branches</span>
              {branches.map((b) => (
                <label key={b.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.branchIds.includes(b.id)} onChange={() => setForm((f) => ({ ...f, branchIds: toggleBranch(f.branchIds, b.id) }))} className="rounded border-border" />
                  <span>{b.name} ({b.code})</span>
                </label>
              ))}
            </div>
            <Button type="submit" variant="primary" loading={submitting}>Create user</Button>
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
                    <th className="pb-3 pr-4 font-medium">Status</th>
                    <th className="pb-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-border/60">
                      <td className="py-3 pr-4 font-medium text-ink">{u.firstName} {u.lastName}</td>
                      <td className="py-3 pr-4 text-ink-secondary">{u.email ?? '—'}</td>
                      <td className="py-3 pr-4"><Badge variant="default">{u.role.name}</Badge></td>
                      <td className="py-3 pr-4">{u.branches.map((ub) => ub.branch.code).join(', ') || '—'}</td>
                      <td className="py-3 pr-4">
                        <Badge variant={u.status === 'ACTIVE' ? 'success' : 'warning'}>{u.status}</Badge>
                      </td>
                      <td className="py-3">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(u)}>Edit</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <Modal
        open={!!editUser}
        title="Edit staff member"
        onClose={() => setEditUser(null)}
        wide
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditUser(null)}>Cancel</Button>
            <Button variant="primary" loading={submitting} onClick={saveEdit}>Save changes</Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="First name" value={editForm.firstName} onChange={(e) => setEditForm((f) => ({ ...f, firstName: e.target.value }))} />
          <Input label="Last name" value={editForm.lastName} onChange={(e) => setEditForm((f) => ({ ...f, lastName: e.target.value }))} />
          <Input label="Email" type="email" value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} />
          <Input label="Employee number" value={editForm.employeeNumber} onChange={(e) => setEditForm((f) => ({ ...f, employeeNumber: e.target.value }))} />
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block text-ink-muted">Role</span>
            <select className={selectClassName} value={editForm.roleId} onChange={(e) => setEditForm((f) => ({ ...f, roleId: e.target.value }))}>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block text-ink-muted">Status</span>
            <select className={selectClassName} value={editForm.status} onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value as typeof editForm.status }))}>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="SUSPENDED">Suspended</option>
            </select>
          </label>
          <div className="space-y-2 sm:col-span-2">
            <span className="text-sm font-medium text-ink-secondary">Branch access</span>
            {branches.map((b) => (
              <label key={b.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={editForm.branchIds.includes(b.id)} onChange={() => setEditForm((f) => ({ ...f, branchIds: toggleBranch(f.branchIds, b.id) }))} className="rounded border-border" />
                <span>{b.name} ({b.code})</span>
              </label>
            ))}
          </div>
          <Input label="Reset PIN (leave blank to keep)" value={editForm.newPin} onChange={(e) => setEditForm((f) => ({ ...f, newPin: e.target.value }))} className="sm:col-span-2" />
        </div>
      </Modal>
    </div>
  );
}

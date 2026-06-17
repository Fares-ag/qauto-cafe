'use client';

import { useCallback, useEffect, useState } from 'react';
import { Badge, Button, Card, CardHeader, EmptyState, Input, TableSkeleton, useToast } from '@qauto/ui';
import { ConfirmDialog, Modal, selectClassName } from '@/components/admin/modal';
import { getApiClient } from '@/lib/api';

type Customer = Awaited<ReturnType<ReturnType<typeof getApiClient>['listCustomers']>>[number];

export default function CustomersPage() {
  const { toast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', department: '', email: '', phoneExtension: '' });
  const [giftAmount, setGiftAmount] = useState('50.0000');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [issuedCard, setIssuedCard] = useState<string | null>(null);
  const [balanceCode, setBalanceCode] = useState('');
  const [balanceResult, setBalanceResult] = useState<string | null>(null);
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);
  const [editForm, setEditForm] = useState({ name: '', department: '', email: '', phoneExtension: '', isActive: true });
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const client = getApiClient();
      setCustomers(await client.listCustomers());
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to load customers', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  function openEdit(c: Customer) {
    setEditCustomer(c);
    setEditForm({
      name: c.name,
      department: c.department ?? '',
      email: c.email ?? '',
      phoneExtension: c.phoneExtension ?? '',
      isActive: c.isActive,
    });
  }

  async function createCustomer(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await getApiClient().createCustomer(newCustomer);
      toast('Customer created', 'success');
      setNewCustomer({ name: '', department: '', email: '', phoneExtension: '' });
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function saveEdit() {
    if (!editCustomer) return;
    setSubmitting(true);
    try {
      await getApiClient().updateCustomer(editCustomer.id, {
        name: editForm.name,
        department: editForm.department || undefined,
        email: editForm.email || undefined,
        phoneExtension: editForm.phoneExtension || undefined,
        isActive: editForm.isActive,
      });
      toast('Customer updated', 'success');
      setEditCustomer(null);
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Update failed', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setSubmitting(true);
    try {
      await getApiClient().deleteCustomer(deleteTarget.id);
      toast('Customer deactivated', 'success');
      setDeleteTarget(null);
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Delete failed', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function issueGiftCard(e: React.FormEvent) {
    e.preventDefault();
    try {
      const card = await getApiClient().issueGiftCard({
        amount: giftAmount,
        customerId: selectedCustomerId || undefined,
      });
      setIssuedCard(card.code);
      toast(`Gift card issued: ${card.code}`, 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed', 'error');
    }
  }

  async function lookupBalance(e: React.FormEvent) {
    e.preventDefault();
    try {
      const result = await getApiClient().getGiftCardBalance(balanceCode.trim());
      setBalanceResult(`${result.code}: ${result.balance} QAR (${result.status})`);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Lookup failed', 'error');
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Customers</h1>
        <p className="mt-1 text-sm text-ink-muted">CRM profiles, loyalty, and gift cards</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card padding="lg">
          <CardHeader title="Add customer" />
          <form onSubmit={createCustomer} className="space-y-3">
            <Input label="Name" value={newCustomer.name} onChange={(e) => setNewCustomer((s) => ({ ...s, name: e.target.value }))} required />
            <Input label="Department" value={newCustomer.department} onChange={(e) => setNewCustomer((s) => ({ ...s, department: e.target.value }))} />
            <Input label="Phone extension" value={newCustomer.phoneExtension} onChange={(e) => setNewCustomer((s) => ({ ...s, phoneExtension: e.target.value }))} placeholder="e.g. 1101" />
            <Input label="Email" type="email" value={newCustomer.email} onChange={(e) => setNewCustomer((s) => ({ ...s, email: e.target.value }))} />
            <Button type="submit" variant="primary" loading={submitting}>Create customer</Button>
          </form>
        </Card>

        <Card padding="lg">
          <CardHeader title="Issue gift card" />
          <form onSubmit={issueGiftCard} className="space-y-3">
            <Input label="Amount (QAR)" value={giftAmount} onChange={(e) => setGiftAmount(e.target.value)} />
            <label className="block text-sm">
              <span className="mb-1 block text-ink-muted">Customer (optional)</span>
              <select className={selectClassName} value={selectedCustomerId} onChange={(e) => setSelectedCustomerId(e.target.value)}>
                <option value="">— None —</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
            <Button type="submit" variant="primary">Issue card</Button>
            {issuedCard ? <p className="text-sm text-success">Last issued: <span className="font-mono font-medium">{issuedCard}</span></p> : null}
          </form>
        </Card>

        <Card padding="lg">
          <CardHeader title="Gift card balance" />
          <form onSubmit={lookupBalance} className="space-y-3">
            <Input label="Card code" value={balanceCode} onChange={(e) => setBalanceCode(e.target.value)} placeholder="GC-..." />
            <Button type="submit" variant="secondary">Check balance</Button>
            {balanceResult ? <p className="text-sm font-medium text-ink">{balanceResult}</p> : null}
          </form>
        </Card>
      </div>

      <Card padding="lg">
        <CardHeader title="Customer directory" />
        {loading ? (
          <TableSkeleton rows={6} />
        ) : customers.length === 0 ? (
          <EmptyState title="No customers" description="Create a customer to link on orders" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-ink-muted">
                  <th className="pb-3 pr-4 font-medium">Name</th>
                  <th className="pb-3 pr-4 font-medium">Ext.</th>
                  <th className="pb-3 pr-4 font-medium">Department</th>
                  <th className="pb-3 pr-4 font-medium">Email</th>
                  <th className="pb-3 pr-4 font-medium">Status</th>
                  <th className="pb-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.id} className="border-b border-border/60">
                    <td className="py-3 pr-4 font-medium text-ink">{c.name}</td>
                    <td className="py-3 pr-4 font-mono text-ink-secondary">{c.phoneExtension ?? '—'}</td>
                    <td className="py-3 pr-4 text-ink-secondary">{c.department ?? '—'}</td>
                    <td className="py-3 pr-4 text-ink-secondary">{c.email ?? '—'}</td>
                    <td className="py-3 pr-4">
                      <Badge variant={c.isActive ? 'success' : 'warning'}>{c.isActive ? 'Active' : 'Inactive'}</Badge>
                    </td>
                    <td className="py-3">
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(c)}>Edit</Button>
                        {c.isActive ? (
                          <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(c)}>Deactivate</Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={!!editCustomer}
        title="Edit customer"
        onClose={() => setEditCustomer(null)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditCustomer(null)}>Cancel</Button>
            <Button variant="primary" loading={submitting} onClick={saveEdit}>Save</Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input label="Name" value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
          <Input label="Department" value={editForm.department} onChange={(e) => setEditForm((f) => ({ ...f, department: e.target.value }))} />
          <Input label="Phone extension" value={editForm.phoneExtension} onChange={(e) => setEditForm((f) => ({ ...f, phoneExtension: e.target.value }))} />
          <Input label="Email" type="email" value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={editForm.isActive} onChange={(e) => setEditForm((f) => ({ ...f, isActive: e.target.checked }))} className="rounded border-border" />
            <span>Active</span>
          </label>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Deactivate customer"
        message={`Deactivate ${deleteTarget?.name}? They will no longer appear in POS search.`}
        confirmLabel="Deactivate"
        loading={submitting}
        onConfirm={confirmDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}

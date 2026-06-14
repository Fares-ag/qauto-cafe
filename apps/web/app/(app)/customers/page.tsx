'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button, Card, CardHeader, EmptyState, Input, TableSkeleton, useToast } from '@qauto/ui';
import { getApiClient } from '@/lib/api';

type Customer = Awaited<ReturnType<ReturnType<typeof getApiClient>['listCustomers']>>[number];

export default function CustomersPage() {
  const { toast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [newCustomer, setNewCustomer] = useState({ name: '', department: '', email: '' });
  const [giftAmount, setGiftAmount] = useState('50.0000');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [issuedCard, setIssuedCard] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const client = getApiClient();
      const data = await client.listCustomers();
      setCustomers(data);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to load customers', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  async function createCustomer(e: React.FormEvent) {
    e.preventDefault();
    try {
      const client = getApiClient();
      await client.createCustomer(newCustomer);
      toast('Customer created', 'success');
      setNewCustomer({ name: '', department: '', email: '' });
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed', 'error');
    }
  }

  async function issueGiftCard(e: React.FormEvent) {
    e.preventDefault();
    try {
      const client = getApiClient();
      const card = await client.issueGiftCard({
        amount: giftAmount,
        customerId: selectedCustomerId || undefined,
      });
      setIssuedCard(card.code);
      toast(`Gift card issued: ${card.code}`, 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed', 'error');
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Customers</h1>
        <p className="mt-1 text-sm text-ink-muted">CRM profiles, loyalty, and gift cards</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card padding="lg">
          <CardHeader title="Add customer" />
          <form onSubmit={createCustomer} className="space-y-3">
            <Input label="Name" value={newCustomer.name} onChange={(e) => setNewCustomer((s) => ({ ...s, name: e.target.value }))} />
            <Input label="Department" value={newCustomer.department} onChange={(e) => setNewCustomer((s) => ({ ...s, department: e.target.value }))} />
            <Input label="Email" type="email" value={newCustomer.email} onChange={(e) => setNewCustomer((s) => ({ ...s, email: e.target.value }))} />
            <Button type="submit" variant="primary">Create customer</Button>
          </form>
        </Card>

        <Card padding="lg">
          <CardHeader title="Issue gift card" />
          <form onSubmit={issueGiftCard} className="space-y-3">
            <Input label="Amount (QAR)" value={giftAmount} onChange={(e) => setGiftAmount(e.target.value)} />
            <label className="block text-sm">
              <span className="mb-1 block text-ink-muted">Customer (optional)</span>
              <select
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
              >
                <option value="">— None —</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
            <Button type="submit" variant="primary">Issue card</Button>
            {issuedCard ? (
              <p className="text-sm text-success">Last issued: <span className="font-mono font-medium">{issuedCard}</span></p>
            ) : null}
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
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-ink-muted">
                <th className="pb-3 pr-4 font-medium">Name</th>
                <th className="pb-3 pr-4 font-medium">Department</th>
                <th className="pb-3 pr-4 font-medium">Email</th>
                <th className="pb-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id} className="border-b border-border/60">
                  <td className="py-3 pr-4 font-medium text-ink">{c.name}</td>
                  <td className="py-3 pr-4 text-ink-secondary">{c.department ?? '—'}</td>
                  <td className="py-3 pr-4 text-ink-secondary">{c.email ?? '—'}</td>
                  <td className="py-3">{c.isActive ? 'Active' : 'Inactive'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

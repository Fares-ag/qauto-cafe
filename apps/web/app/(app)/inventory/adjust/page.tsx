'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Button, Card, CardHeader, Input, PageHeader, useToast } from '@qauto/ui';
import { selectClassName } from '@/components/admin/modal';
import { getApiClient } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';

export default function InventoryAdjustPage() {
  const branchId = useAuthStore((s) => s.branchId);
  const { toast } = useToast();
  const [ingredients, setIngredients] = useState<
    Awaited<ReturnType<ReturnType<typeof getApiClient>['getIngredients']>>
  >([]);
  const [branches, setBranches] = useState<Array<{ id: string; name: string }>>([]);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    ingredientId: '',
    quantity: '',
    reason: 'Physical count adjustment',
    notes: '',
  });
  const [transfer, setTransfer] = useState({
    toBranchId: '',
    ingredientId: '',
    quantity: '',
    notes: '',
  });

  const load = useCallback(async () => {
    try {
      const client = getApiClient();
      const [ings, brs] = await Promise.all([client.getIngredients(), client.listBranches()]);
      setIngredients(ings);
      setBranches(brs);
      if (!form.ingredientId && ings[0]) setForm((f) => ({ ...f, ingredientId: ings[0].id }));
      if (!transfer.ingredientId && ings[0]) setTransfer((t) => ({ ...t, ingredientId: ings[0].id }));
      if (!transfer.toBranchId && brs[1]) setTransfer((t) => ({ ...t, toBranchId: brs[1].id }));
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to load', 'error');
    }
  }, [toast, form.ingredientId, transfer.ingredientId, transfer.toBranchId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAdjust(e: React.FormEvent) {
    e.preventDefault();
    if (!branchId) return;
    setSubmitting(true);
    try {
      await getApiClient().adjustStock({
        branchId,
        ingredientId: form.ingredientId,
        quantityDelta: form.quantity,
        reason: form.reason,
      });
      toast('Stock adjusted', 'success');
      setForm((f) => ({ ...f, quantity: '', notes: '' }));
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Adjust failed', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleTransfer(e: React.FormEvent) {
    e.preventDefault();
    if (!branchId) return;
    setSubmitting(true);
    try {
      await getApiClient().transferInventory({
        fromBranchId: branchId,
        toBranchId: transfer.toBranchId,
        ingredientId: transfer.ingredientId,
        quantity: transfer.quantity,
        notes: transfer.notes || undefined,
      });
      toast('Stock transferred', 'success');
      setTransfer((t) => ({ ...t, quantity: '', notes: '' }));
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Transfer failed', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Adjust stock"
        description="Correct on-hand quantities or transfer between branches"
        actions={
          <Link href="/inventory"><Button variant="ghost">Back to stock</Button></Link>
        }
      />

      <Card padding="lg">
        <CardHeader title="Stock adjustment" description="Use positive qty to add, negative to remove" />
        <form onSubmit={handleAdjust} className="space-y-3">
          <label className="block text-sm">
            <span className="mb-1 block text-ink-muted">Ingredient</span>
            <select className={selectClassName} value={form.ingredientId} onChange={(e) => setForm((f) => ({ ...f, ingredientId: e.target.value }))}>
              {ingredients.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
          </label>
          <Input label="Quantity (+/-)" value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} placeholder="-50 or 100" required />
          <Input label="Reason" value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} required />
          <Input label="Notes" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          <Button type="submit" variant="primary" loading={submitting}>Apply adjustment</Button>
        </form>
      </Card>

      {branches.length > 1 ? (
        <Card padding="lg">
          <CardHeader title="Transfer stock" description="Move inventory to another branch" />
          <form onSubmit={handleTransfer} className="space-y-3">
            <label className="block text-sm">
              <span className="mb-1 block text-ink-muted">To branch</span>
              <select className={selectClassName} value={transfer.toBranchId} onChange={(e) => setTransfer((t) => ({ ...t, toBranchId: e.target.value }))}>
                {branches.filter((b) => b.id !== branchId).map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-ink-muted">Ingredient</span>
              <select className={selectClassName} value={transfer.ingredientId} onChange={(e) => setTransfer((t) => ({ ...t, ingredientId: e.target.value }))}>
                {ingredients.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </label>
            <Input label="Quantity" value={transfer.quantity} onChange={(e) => setTransfer((t) => ({ ...t, quantity: e.target.value }))} required />
            <Input label="Notes" value={transfer.notes} onChange={(e) => setTransfer((t) => ({ ...t, notes: e.target.value }))} />
            <Button type="submit" variant="secondary" loading={submitting}>Transfer</Button>
          </form>
        </Card>
      ) : null}
    </div>
  );
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import type { InventoryStockItem } from '@qauto/api-client';
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  Input,
  KpiCard,
  TableSkeleton,
  useToast,
} from '@qauto/ui';
import { getApiClient } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';

type Ingredient = Awaited<ReturnType<ReturnType<typeof getApiClient>['getIngredients']>>[number];

export default function InventoryPage() {
  const branchId = useAuthStore((s) => s.branchId);
  const { toast } = useToast();
  const [stock, setStock] = useState<InventoryStockItem[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [receiveForm, setReceiveForm] = useState({
    ingredientId: '',
    quantity: '',
    unitCost: '',
    notes: '',
  });
  const [wasteForm, setWasteForm] = useState({ ingredientId: '', quantity: '', reason: '' });
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!branchId) return;
    setLoading(true);
    try {
      const client = getApiClient();
      const [stockData, ingredientsData] = await Promise.all([
        client.getInventoryStock(branchId),
        client.getIngredients(),
      ]);
      setStock(stockData.items);
      setIngredients(ingredientsData);
      if (!receiveForm.ingredientId && ingredientsData[0]) {
        setReceiveForm((f) => ({ ...f, ingredientId: ingredientsData[0].id }));
        setWasteForm((f) => ({ ...f, ingredientId: ingredientsData[0].id }));
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to load inventory', 'error');
    } finally {
      setLoading(false);
    }
  }, [branchId, toast]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleReceive(e: React.FormEvent) {
    e.preventDefault();
    if (!branchId) return;
    setSubmitting(true);
    try {
      const client = getApiClient();
      await client.receiveStock({ branchId, ...receiveForm });
      toast('Stock received', 'success');
      setReceiveForm((f) => ({ ...f, quantity: '', unitCost: '', notes: '' }));
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Receive failed', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleWaste(e: React.FormEvent) {
    e.preventDefault();
    if (!branchId) return;
    setSubmitting(true);
    try {
      const client = getApiClient();
      await client.wasteStock({ branchId, ...wasteForm });
      toast('Waste recorded', 'success');
      setWasteForm((f) => ({ ...f, quantity: '', reason: '' }));
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Waste failed', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  const lowStock = stock.filter((i) => !i.isPackaging && parseFloat(i.available) < 50);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Inventory</h1>
        <p className="mt-1 text-sm text-ink-muted">Stock levels, receive, and waste</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard label="Tracked items" value={String(stock.length)} />
        <KpiCard label="Low stock alerts" value={String(lowStock.length)} />
        <KpiCard label="Ingredients" value={String(ingredients.length)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card padding="lg">
          <CardHeader title="Receive stock" />
          <form onSubmit={handleReceive} className="space-y-3">
            <label className="block text-sm">
              <span className="mb-1 block text-ink-muted">Ingredient</span>
              <select
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                value={receiveForm.ingredientId}
                onChange={(e) => setReceiveForm((f) => ({ ...f, ingredientId: e.target.value }))}
              >
                {ingredients.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name} ({i.uom})
                  </option>
                ))}
              </select>
            </label>
            <Input
              label="Quantity"
              value={receiveForm.quantity}
              onChange={(e) => setReceiveForm((f) => ({ ...f, quantity: e.target.value }))}
              placeholder="100"
            />
            <Input
              label="Unit cost (QAR)"
              value={receiveForm.unitCost}
              onChange={(e) => setReceiveForm((f) => ({ ...f, unitCost: e.target.value }))}
              placeholder="0.50"
            />
            <Button type="submit" variant="primary" loading={submitting}>
              Receive
            </Button>
          </form>
        </Card>

        <Card padding="lg">
          <CardHeader title="Record waste" />
          <form onSubmit={handleWaste} className="space-y-3">
            <label className="block text-sm">
              <span className="mb-1 block text-ink-muted">Ingredient</span>
              <select
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                value={wasteForm.ingredientId}
                onChange={(e) => setWasteForm((f) => ({ ...f, ingredientId: e.target.value }))}
              >
                {ingredients.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
            </label>
            <Input
              label="Quantity"
              value={wasteForm.quantity}
              onChange={(e) => setWasteForm((f) => ({ ...f, quantity: e.target.value }))}
            />
            <Input
              label="Reason"
              value={wasteForm.reason}
              onChange={(e) => setWasteForm((f) => ({ ...f, reason: e.target.value }))}
              placeholder="Expired / spillage"
            />
            <Button type="submit" variant="accent" loading={submitting}>
              Record waste
            </Button>
          </form>
        </Card>
      </div>

      <Card padding="lg">
        <CardHeader title="Current stock" />
        {loading ? (
          <TableSkeleton rows={8} />
        ) : stock.length === 0 ? (
          <EmptyState title="No stock data" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-ink-muted">
                  <th className="pb-3 pr-4 font-medium">Ingredient</th>
                  <th className="pb-3 pr-4 font-medium">Code</th>
                  <th className="pb-3 pr-4 font-medium">Available</th>
                  <th className="pb-3 font-medium">UOM</th>
                </tr>
              </thead>
              <tbody>
                {stock.map((item) => (
                  <tr key={item.ingredientId} className="border-b border-border/60">
                    <td className="py-3 pr-4 font-medium text-ink">{item.name}</td>
                    <td className="py-3 pr-4 text-ink-secondary">{item.code}</td>
                    <td
                      className={`py-3 pr-4 ${
                        !item.isPackaging && parseFloat(item.available) < 50
                          ? 'font-medium text-danger'
                          : ''
                      }`}
                    >
                      {item.available}
                    </td>
                    <td className="py-3">{item.uom}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

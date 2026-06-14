'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card, CardHeader, Input, PageHeader, useToast } from '@qauto/ui';
import { IngredientSelect, UomModeSelect } from '@/components/inventory/IngredientSelect';
import { getApiClient } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { formatDisplayQty, formatQar } from '@/lib/format';

type Ingredient = Awaited<ReturnType<ReturnType<typeof getApiClient>['getIngredients']>>[number];

export default function InventoryReceivePage() {
  const branchId = useAuthStore((s) => s.branchId);
  const { toast } = useToast();
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [form, setForm] = useState({
    ingredientId: '',
    inputUomId: '',
    quantity: '',
    unitCost: '',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const client = getApiClient();
      const data = await client.getIngredients();
      setIngredients(data);
      if (!form.ingredientId && data[0]) {
        setForm((f) => ({
          ...f,
          ingredientId: data[0].id,
          inputUomId: data[0].uomId,
        }));
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to load ingredients', 'error');
    }
  }, [form.ingredientId, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const selected = useMemo(
    () => ingredients.find((i) => i.id === form.ingredientId),
    [ingredients, form.ingredientId],
  );

  const preview =
    selected && form.quantity && form.unitCost
      ? `${formatDisplayQty(form.quantity, selected.uom)} · ${formatQar(parseFloat(form.quantity) * parseFloat(form.unitCost))} total`
      : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!branchId || !selected) return;
    setSubmitting(true);
    try {
      const client = getApiClient();
      await client.receiveStock({
        branchId,
        ingredientId: form.ingredientId,
        quantity: form.quantity,
        unitCost: form.unitCost,
        inputUomId: form.inputUomId || selected.uomId,
        notes: form.notes || undefined,
      });
      toast('Stock received', 'success');
      setForm((f) => ({ ...f, quantity: '', unitCost: '', notes: '' }));
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Receive failed', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Receive stock"
        description="Enter quantity and cost in QAR — the system converts to stock units automatically"
      />

      <Card padding="lg">
        <CardHeader title="Receive into branch" description="All costs are in QAR" />
        <form onSubmit={handleSubmit} className="space-y-4">
          <IngredientSelect
            ingredients={ingredients}
            value={form.ingredientId}
            onChange={(ingredientId) => {
              const ing = ingredients.find((i) => i.id === ingredientId);
              setForm((f) => ({
                ...f,
                ingredientId,
                inputUomId: ing?.uomId ?? '',
              }));
            }}
          />

          {selected ? (
            <UomModeSelect
              baseUom={selected.uom}
              baseUomId={selected.uomId}
              purchaseUom={selected.purchaseUom}
              purchaseUomId={selected.purchaseUomId}
              value={form.inputUomId || selected.uomId}
              onChange={(inputUomId) => setForm((f) => ({ ...f, inputUomId }))}
            />
          ) : null}

          <Input
            label={`Quantity${selected ? ` (${ingredients.find((i) => i.id === form.inputUomId)?.uom ?? selected.uom})` : ''}`}
            value={form.quantity}
            onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
            placeholder="100"
            required
          />
          <Input
            label="Unit cost (QAR)"
            value={form.unitCost}
            onChange={(e) => setForm((f) => ({ ...f, unitCost: e.target.value }))}
            placeholder="0.50"
            required
          />
          <Input
            label="Notes (optional)"
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />

          {preview ? (
            <p className="rounded-lg bg-surface-sunken px-3 py-2 text-sm text-ink-secondary">
              Preview: {preview}
            </p>
          ) : null}

          <Button type="submit" variant="primary" loading={submitting} className="w-full">
            Receive stock
          </Button>
        </form>
      </Card>
    </div>
  );
}

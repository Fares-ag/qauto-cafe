'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card, CardHeader, Input, PageHeader, useToast } from '@qauto/ui';
import { IngredientSelect, UomModeSelect } from '@/components/inventory/IngredientSelect';
import { getApiClient } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';

type Ingredient = Awaited<ReturnType<ReturnType<typeof getApiClient>['getIngredients']>>[number];

export default function InventoryWastePage() {
  const branchId = useAuthStore((s) => s.branchId);
  const { toast } = useToast();
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [wasteForm, setWasteForm] = useState({
    ingredientId: '',
    inputUomId: '',
    quantity: '',
    reason: '',
  });
  const [submittingWaste, setSubmittingWaste] = useState(false);

  const load = useCallback(async () => {
    try {
      const client = getApiClient();
      const data = await client.getIngredients();
      setIngredients(data);
      if (!wasteForm.ingredientId && data[0]) {
        setWasteForm((f) => ({
          ...f,
          ingredientId: data[0].id,
          inputUomId: data[0].uomId,
        }));
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to load ingredients', 'error');
    }
  }, [wasteForm.ingredientId, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const selected = useMemo(
    () => ingredients.find((i) => i.id === wasteForm.ingredientId),
    [ingredients, wasteForm.ingredientId],
  );

  async function handleWaste(e: React.FormEvent) {
    e.preventDefault();
    if (!branchId || !selected) return;
    setSubmittingWaste(true);
    try {
      const client = getApiClient();
      await client.wasteStock({
        branchId,
        ingredientId: wasteForm.ingredientId,
        quantity: wasteForm.quantity,
        reason: wasteForm.reason,
        inputUomId: wasteForm.inputUomId || selected.uomId,
      });
      toast('Waste recorded', 'success');
      setWasteForm((f) => ({ ...f, quantity: '', reason: '' }));
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Waste failed', 'error');
    } finally {
      setSubmittingWaste(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="Waste & adjust" description="Record spoilage, spills, or shrinkage" />

      <Card padding="lg">
        <CardHeader title="Record waste" />
        <form onSubmit={handleWaste} className="space-y-4">
          <IngredientSelect
            ingredients={ingredients}
            value={wasteForm.ingredientId}
            onChange={(ingredientId) => {
              const ing = ingredients.find((i) => i.id === ingredientId);
              setWasteForm((f) => ({
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
              value={wasteForm.inputUomId || selected.uomId}
              onChange={(inputUomId) => setWasteForm((f) => ({ ...f, inputUomId }))}
            />
          ) : null}

          <Input
            label="Quantity"
            value={wasteForm.quantity}
            onChange={(e) => setWasteForm((f) => ({ ...f, quantity: e.target.value }))}
            required
          />
          <Input
            label="Reason"
            value={wasteForm.reason}
            onChange={(e) => setWasteForm((f) => ({ ...f, reason: e.target.value }))}
            placeholder="Expired / spillage"
            required
          />
          <Button type="submit" variant="accent" loading={submittingWaste} className="w-full">
            Record waste
          </Button>
        </form>
      </Card>
    </div>
  );
}

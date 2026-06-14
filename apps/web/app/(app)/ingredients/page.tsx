'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Badge,
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

type Ingredient = Awaited<ReturnType<ReturnType<typeof getApiClient>['listIngredientsAdmin']>>[number];

export default function IngredientsPage() {
  const { toast } = useToast();
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [uoms, setUoms] = useState<Array<{ id: string; code: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: '',
    code: '',
    baseUomCode: 'g',
    reorderPoint: '',
    trackStock: true,
    isPackaging: false,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const client = getApiClient();
      const [data, uomList] = await Promise.all([
        client.listIngredientsAdmin(),
        client.listUoms(),
      ]);
      setIngredients(data);
      setUoms(uomList);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to load ingredients', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const client = getApiClient();
      await client.createIngredient({
        name: form.name,
        code: form.code,
        baseUomCode: form.baseUomCode,
        reorderPoint: form.reorderPoint || undefined,
        trackStock: form.trackStock,
        isPackaging: form.isPackaging,
      });
      toast('Ingredient created', 'success');
      setForm({ name: '', code: '', baseUomCode: 'g', reorderPoint: '', trackStock: true, isPackaging: false });
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Create failed', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(ingredient: Ingredient) {
    try {
      const client = getApiClient();
      await client.updateIngredient(ingredient.id, { isActive: !ingredient.isActive });
      toast(`${ingredient.name} ${ingredient.isActive ? 'deactivated' : 'activated'}`, 'success');
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Update failed', 'error');
    }
  }

  const tracked = ingredients.filter((i) => i.trackStock).length;
  const packaging = ingredients.filter((i) => i.isPackaging).length;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Ingredients</h1>
        <p className="mt-1 text-sm text-ink-muted">Manage ingredient master data</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard label="Total ingredients" value={String(ingredients.length)} />
        <KpiCard label="Stock tracked" value={String(tracked)} />
        <KpiCard label="Packaging" value={String(packaging)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card padding="lg" className="lg:col-span-1">
          <CardHeader title="Add ingredient" />
          <form onSubmit={handleCreate} className="space-y-3">
            <Input
              label="Name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
            <Input
              label="Code"
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
              required
            />
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-ink-secondary">Base UOM (stock unit)</span>
              <select
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                value={form.baseUomCode}
                onChange={(e) => setForm((f) => ({ ...f, baseUomCode: e.target.value }))}
              >
                {uoms.map((uom) => (
                  <option key={uom.id} value={uom.code}>
                    {uom.name} ({uom.code})
                  </option>
                ))}
              </select>
            </label>
            <Input
              label="Reorder point (optional)"
              value={form.reorderPoint}
              onChange={(e) => setForm((f) => ({ ...f, reorderPoint: e.target.value }))}
              placeholder="500"
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.trackStock}
                onChange={(e) => setForm((f) => ({ ...f, trackStock: e.target.checked }))}
                className="rounded border-border"
              />
              <span className="text-ink-secondary">Track stock</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isPackaging}
                onChange={(e) => setForm((f) => ({ ...f, isPackaging: e.target.checked }))}
                className="rounded border-border"
              />
              <span className="text-ink-secondary">Packaging item</span>
            </label>
            <Button type="submit" variant="primary" loading={submitting}>
              Create ingredient
            </Button>
          </form>
        </Card>

        <Card padding="lg" className="lg:col-span-2">
          <CardHeader title="Ingredient catalog" description="Used in recipes and inventory" />
          {loading ? (
            <TableSkeleton rows={10} />
          ) : ingredients.length === 0 ? (
            <EmptyState title="No ingredients" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-ink-muted">
                    <th className="pb-3 pr-4 font-medium">Name</th>
                    <th className="pb-3 pr-4 font-medium">Code</th>
                    <th className="pb-3 pr-4 font-medium">Category</th>
                    <th className="pb-3 pr-4 font-medium">UOM</th>
                    <th className="pb-3 pr-4 font-medium">Flags</th>
                    <th className="pb-3 pr-4 font-medium">Status</th>
                    <th className="pb-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {ingredients.map((ing) => (
                    <tr key={ing.id} className="border-b border-border/60">
                      <td className="py-3 pr-4 font-medium text-ink">{ing.name}</td>
                      <td className="py-3 pr-4 text-ink-secondary">{ing.code}</td>
                      <td className="py-3 pr-4">{ing.categoryName ?? '—'}</td>
                      <td className="py-3 pr-4">{ing.uom}</td>
                      <td className="py-3 pr-4">
                        <div className="flex flex-wrap gap-1">
                          {ing.trackStock ? <Badge variant="default">Stock</Badge> : null}
                          {ing.isPackaging ? <Badge variant="default">Pkg</Badge> : null}
                          {ing.isSnackSku ? <Badge variant="default">Snack</Badge> : null}
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <Badge variant={ing.isActive ? 'success' : 'warning'}>
                          {ing.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="py-3">
                        <Button variant="ghost" size="sm" onClick={() => toggleActive(ing)}>
                          {ing.isActive ? 'Deactivate' : 'Activate'}
                        </Button>
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

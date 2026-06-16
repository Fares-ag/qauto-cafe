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
import { ConfirmDialog, Modal, selectClassName } from '@/components/admin/modal';
import { getApiClient } from '@/lib/api';

type Ingredient = Awaited<ReturnType<ReturnType<typeof getApiClient>['listIngredientsAdmin']>>[number];
type IngredientCategory = Awaited<ReturnType<ReturnType<typeof getApiClient>['listIngredientCategories']>>[number];

export default function IngredientsPage() {
  const { toast } = useToast();
  const [tab, setTab] = useState<'ingredients' | 'categories'>('ingredients');
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [categories, setCategories] = useState<IngredientCategory[]>([]);
  const [uoms, setUoms] = useState<Array<{ id: string; code: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: '',
    code: '',
    baseUomCode: 'g',
    categoryId: '',
    reorderPoint: '',
    trackStock: true,
    isPackaging: false,
  });
  const [categoryForm, setCategoryForm] = useState({ name: '', sortOrder: '0' });
  const [editIngredient, setEditIngredient] = useState<Ingredient | null>(null);
  const [editForm, setEditForm] = useState({ name: '', categoryId: '', reorderPoint: '', parLevel: '', isActive: true });
  const [editCategory, setEditCategory] = useState<IngredientCategory | null>(null);
  const [deleteIngredient, setDeleteIngredient] = useState<Ingredient | null>(null);
  const [deleteCategory, setDeleteCategory] = useState<IngredientCategory | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const client = getApiClient();
      const [data, uomList, cats] = await Promise.all([
        client.listIngredientsAdmin(),
        client.listUoms(),
        client.listIngredientCategories(),
      ]);
      setIngredients(data);
      setUoms(uomList);
      setCategories(cats);
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
      await getApiClient().createIngredient({
        name: form.name,
        code: form.code,
        baseUomCode: form.baseUomCode,
        categoryId: form.categoryId || undefined,
        reorderPoint: form.reorderPoint || undefined,
        trackStock: form.trackStock,
        isPackaging: form.isPackaging,
      });
      toast('Ingredient created', 'success');
      setForm({ name: '', code: '', baseUomCode: 'g', categoryId: '', reorderPoint: '', trackStock: true, isPackaging: false });
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Create failed', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreateCategory(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await getApiClient().createIngredientCategory({
        name: categoryForm.name,
        sortOrder: parseInt(categoryForm.sortOrder, 10) || 0,
      });
      toast('Category created', 'success');
      setCategoryForm({ name: '', sortOrder: '0' });
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Create failed', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  function openEdit(ing: Ingredient) {
    setEditIngredient(ing);
    setEditForm({
      name: ing.name,
      categoryId: categories.find((c) => c.name === ing.categoryName)?.id ?? '',
      reorderPoint: ing.reorderPoint ?? '',
      parLevel: ing.parLevel ?? '',
      isActive: ing.isActive,
    });
  }

  async function saveIngredient() {
    if (!editIngredient) return;
    setSubmitting(true);
    try {
      await getApiClient().updateIngredient(editIngredient.id, {
        name: editForm.name,
        categoryId: editForm.categoryId || null,
        reorderPoint: editForm.reorderPoint || null,
        parLevel: editForm.parLevel || null,
        isActive: editForm.isActive,
      });
      toast('Ingredient updated', 'success');
      setEditIngredient(null);
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Update failed', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmDeleteIngredient() {
    if (!deleteIngredient) return;
    setSubmitting(true);
    try {
      await getApiClient().deleteIngredient(deleteIngredient.id);
      toast('Ingredient deactivated', 'success');
      setDeleteIngredient(null);
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Delete failed', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function saveCategory() {
    if (!editCategory) return;
    setSubmitting(true);
    try {
      await getApiClient().updateIngredientCategory(editCategory.id, {
        name: editCategory.name,
        sortOrder: editCategory.sortOrder,
      });
      toast('Category updated', 'success');
      setEditCategory(null);
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Update failed', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmDeleteCategory() {
    if (!deleteCategory) return;
    setSubmitting(true);
    try {
      await getApiClient().deleteIngredientCategory(deleteCategory.id);
      toast('Category deleted', 'success');
      setDeleteCategory(null);
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Delete failed', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  const tracked = ingredients.filter((i) => i.trackStock).length;
  const packaging = ingredients.filter((i) => i.isPackaging).length;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Ingredients</h1>
        <p className="mt-1 text-sm text-ink-muted">Manage ingredient master data and categories</p>
      </div>

      <div className="flex gap-2 border-b border-border pb-1">
        {(['ingredients', 'categories'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-2 text-sm font-medium capitalize ${tab === t ? 'bg-brand-muted text-brand' : 'text-ink-muted hover:bg-surface-sunken'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'ingredients' ? (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <KpiCard label="Total ingredients" value={String(ingredients.length)} />
            <KpiCard label="Stock tracked" value={String(tracked)} />
            <KpiCard label="Packaging" value={String(packaging)} />
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            <Card padding="lg" className="lg:col-span-1">
              <CardHeader title="Add ingredient" />
              <form onSubmit={handleCreate} className="space-y-3">
                <Input label="Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
                <Input label="Code" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} required />
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-ink-secondary">Category</span>
                  <select className={selectClassName} value={form.categoryId} onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}>
                    <option value="">— None —</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-ink-secondary">Base UOM</span>
                  <select className={selectClassName} value={form.baseUomCode} onChange={(e) => setForm((f) => ({ ...f, baseUomCode: e.target.value }))}>
                    {uoms.map((uom) => (
                      <option key={uom.id} value={uom.code}>{uom.name} ({uom.code})</option>
                    ))}
                  </select>
                </label>
                <Input label="Reorder point" value={form.reorderPoint} onChange={(e) => setForm((f) => ({ ...f, reorderPoint: e.target.value }))} />
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.trackStock} onChange={(e) => setForm((f) => ({ ...f, trackStock: e.target.checked }))} className="rounded border-border" />
                  <span>Track stock</span>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.isPackaging} onChange={(e) => setForm((f) => ({ ...f, isPackaging: e.target.checked }))} className="rounded border-border" />
                  <span>Packaging item</span>
                </label>
                <Button type="submit" variant="primary" loading={submitting}>Create ingredient</Button>
              </form>
            </Card>
            <Card padding="lg" className="lg:col-span-2">
              <CardHeader title="Ingredient catalog" />
              {loading ? <TableSkeleton rows={10} /> : ingredients.length === 0 ? <EmptyState title="No ingredients" /> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-ink-muted">
                        <th className="pb-3 pr-4 font-medium">Name</th>
                        <th className="pb-3 pr-4 font-medium">Code</th>
                        <th className="pb-3 pr-4 font-medium">Category</th>
                        <th className="pb-3 pr-4 font-medium">UOM</th>
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
                          <td className="py-3 pr-4"><Badge variant={ing.isActive ? 'success' : 'warning'}>{ing.isActive ? 'Active' : 'Inactive'}</Badge></td>
                          <td className="py-3">
                            <div className="flex gap-1">
                              <Button variant="ghost" size="sm" onClick={() => openEdit(ing)}>Edit</Button>
                              {ing.isActive ? <Button variant="ghost" size="sm" onClick={() => setDeleteIngredient(ing)}>Delete</Button> : null}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        </>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card padding="lg">
            <CardHeader title="Add category" />
            <form onSubmit={handleCreateCategory} className="space-y-3">
              <Input label="Name" value={categoryForm.name} onChange={(e) => setCategoryForm((f) => ({ ...f, name: e.target.value }))} required />
              <Input label="Sort order" value={categoryForm.sortOrder} onChange={(e) => setCategoryForm((f) => ({ ...f, sortOrder: e.target.value }))} />
              <Button type="submit" variant="primary" loading={submitting}>Create category</Button>
            </form>
          </Card>
          <Card padding="lg">
            <CardHeader title="Categories" />
            {loading ? <TableSkeleton rows={5} /> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-ink-muted">
                      <th className="pb-3 pr-4 font-medium">Name</th>
                      <th className="pb-3 pr-4 font-medium">Ingredients</th>
                      <th className="pb-3 pr-4 font-medium">Order</th>
                      <th className="pb-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categories.map((cat) => (
                      <tr key={cat.id} className="border-b border-border/60">
                        <td className="py-3 pr-4 font-medium">{cat.name}</td>
                        <td className="py-3 pr-4">{cat.ingredientCount}</td>
                        <td className="py-3 pr-4">{cat.sortOrder}</td>
                        <td className="py-3">
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" onClick={() => setEditCategory({ ...cat })}>Edit</Button>
                            <Button variant="ghost" size="sm" onClick={() => setDeleteCategory(cat)}>Delete</Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      <Modal open={!!editIngredient} title="Edit ingredient" onClose={() => setEditIngredient(null)} footer={<><Button variant="ghost" onClick={() => setEditIngredient(null)}>Cancel</Button><Button variant="primary" loading={submitting} onClick={saveIngredient}>Save</Button></>}>
        <div className="space-y-3">
          <Input label="Name" value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
          <label className="block text-sm">
            <span className="mb-1 block text-ink-muted">Category</span>
            <select className={selectClassName} value={editForm.categoryId} onChange={(e) => setEditForm((f) => ({ ...f, categoryId: e.target.value }))}>
              <option value="">— None —</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <Input label="Reorder point" value={editForm.reorderPoint} onChange={(e) => setEditForm((f) => ({ ...f, reorderPoint: e.target.value }))} />
          <Input label="Par level" value={editForm.parLevel} onChange={(e) => setEditForm((f) => ({ ...f, parLevel: e.target.value }))} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={editForm.isActive} onChange={(e) => setEditForm((f) => ({ ...f, isActive: e.target.checked }))} className="rounded border-border" />
            <span>Active</span>
          </label>
        </div>
      </Modal>

      <Modal open={!!editCategory} title="Edit category" onClose={() => setEditCategory(null)} footer={<><Button variant="ghost" onClick={() => setEditCategory(null)}>Cancel</Button><Button variant="primary" loading={submitting} onClick={saveCategory}>Save</Button></>}>
        {editCategory ? (
          <div className="space-y-3">
            <Input label="Name" value={editCategory.name} onChange={(e) => setEditCategory((c) => c ? { ...c, name: e.target.value } : c)} />
            <Input label="Sort order" value={String(editCategory.sortOrder)} onChange={(e) => setEditCategory((c) => c ? { ...c, sortOrder: parseInt(e.target.value, 10) || 0 } : c)} />
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog open={!!deleteIngredient} title="Delete ingredient" message={`Deactivate ${deleteIngredient?.name}?`} loading={submitting} onConfirm={confirmDeleteIngredient} onClose={() => setDeleteIngredient(null)} />
      <ConfirmDialog open={!!deleteCategory} title="Delete category" message={`Delete ${deleteCategory?.name}? Ingredients will be uncategorized.`} loading={submitting} onConfirm={confirmDeleteCategory} onClose={() => setDeleteCategory(null)} />
    </div>
  );
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
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

type Tab = 'categories' | 'items' | 'modifiers';
type Category = Awaited<ReturnType<ReturnType<typeof getApiClient>['getMenuAdminCategories']>>[number];
type MenuItem = Awaited<ReturnType<ReturnType<typeof getApiClient>['getMenuAdminItems']>>[number];
type ModifierGroup = Awaited<ReturnType<ReturnType<typeof getApiClient>['getModifierGroups']>>[number] & {
  modifiers: Awaited<ReturnType<ReturnType<typeof getApiClient>['listModifiers']>>;
};

const TABS: { id: Tab; label: string }[] = [
  { id: 'categories', label: 'Categories' },
  { id: 'items', label: 'Items' },
  { id: 'modifiers', label: 'Modifiers' },
];

export default function MenuBuilderPage() {
  const branchId = useAuthStore((s) => s.branchId);
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>('categories');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [modifierGroups, setModifierGroups] = useState<ModifierGroup[]>([]);

  const [categoryForm, setCategoryForm] = useState({ name: '', sortOrder: '0' });
  const [itemForm, setItemForm] = useState({
    categoryId: '',
    name: '',
    code: '',
    type: 'BEVERAGE' as 'BEVERAGE' | 'FOOD' | 'SNACK',
    basePrice: '',
    description: '',
  });
  const [groupForm, setGroupForm] = useState({ name: '', minSelections: '0', maxSelections: '1' });
  const [modifierForm, setModifierForm] = useState({
    groupId: '',
    name: '',
    code: '',
    priceAdjustment: '0',
  });

  const load = useCallback(async () => {
    if (!branchId) return;
    setLoading(true);
    try {
      const client = getApiClient();
      const [categoriesData, itemsData, groupsData] = await Promise.all([
        client.getMenuAdminCategories(),
        client.getMenuAdminItems(branchId),
        client.getModifierGroups(),
      ]);
      const groupsWithModifiers = await Promise.all(
        groupsData.map(async (group) => ({
          ...group,
          modifiers: await client.listModifiers(group.id),
        })),
      );
      setCategories(categoriesData);
      setItems(itemsData);
      setModifierGroups(groupsWithModifiers);
      if (!itemForm.categoryId && categoriesData[0]) {
        setItemForm((f) => ({ ...f, categoryId: categoriesData[0].id }));
      }
      if (!modifierForm.groupId && groupsWithModifiers[0]) {
        setModifierForm((f) => ({ ...f, groupId: groupsWithModifiers[0].id }));
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to load menu builder', 'error');
    } finally {
      setLoading(false);
    }
  }, [branchId, toast]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreateCategory(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const client = getApiClient();
      await client.createMenuCategory({
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

  async function handleCreateItem(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const client = getApiClient();
      await client.createMenuItem({
        categoryId: itemForm.categoryId,
        name: itemForm.name,
        code: itemForm.code,
        type: itemForm.type === 'BEVERAGE' ? 'DRINK' : 'SNACK',
        basePrice: itemForm.basePrice,
        description: itemForm.description || undefined,
      });
      toast('Menu item created', 'success');
      setItemForm((f) => ({ ...f, name: '', code: '', basePrice: '', description: '' }));
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Create failed', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreateGroup(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const client = getApiClient();
      await client.createModifierGroup({
        name: groupForm.name,
        minSelections: parseInt(groupForm.minSelections, 10) || 0,
        maxSelections: parseInt(groupForm.maxSelections, 10) || 1,
      });
      toast('Modifier group created', 'success');
      setGroupForm({ name: '', minSelections: '0', maxSelections: '1' });
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Create failed', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreateModifier(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const client = getApiClient();
      await client.createModifier(modifierForm.groupId, {
        name: modifierForm.name,
        code: modifierForm.code,
        priceAdjustment: modifierForm.priceAdjustment || '0',
      });
      toast('Modifier created', 'success');
      setModifierForm((f) => ({ ...f, name: '', code: '', priceAdjustment: '0' }));
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Create failed', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleCategory(category: Category) {
    try {
      const client = getApiClient();
      await client.updateMenuCategory(category.id, { isActive: !category.isActive });
      toast(`Category ${category.isActive ? 'deactivated' : 'activated'}`, 'success');
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Update failed', 'error');
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Menu builder</h1>
          <p className="mt-1 text-sm text-ink-muted">Categories, items, and modifiers</p>
        </div>
        <Link href="/menu">
          <Button variant="ghost">Back to operations</Button>
        </Link>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-border pb-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.id
                ? 'bg-brand-muted text-brand'
                : 'text-ink-muted hover:bg-surface-sunken hover:text-ink'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'categories' ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card padding="lg">
            <CardHeader title="Add category" />
            <form onSubmit={handleCreateCategory} className="space-y-3">
              <Input
                label="Name"
                value={categoryForm.name}
                onChange={(e) => setCategoryForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
              <Input
                label="Sort order"
                value={categoryForm.sortOrder}
                onChange={(e) => setCategoryForm((f) => ({ ...f, sortOrder: e.target.value }))}
              />
              <Button type="submit" variant="primary" loading={submitting}>
                Create category
              </Button>
            </form>
          </Card>

          <Card padding="lg">
            <CardHeader title="Categories" description="Organize menu items" />
            {loading ? (
              <TableSkeleton rows={5} />
            ) : categories.length === 0 ? (
              <EmptyState title="No categories" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-ink-muted">
                      <th className="pb-3 pr-4 font-medium">Name</th>
                      <th className="pb-3 pr-4 font-medium">Items</th>
                      <th className="pb-3 pr-4 font-medium">Order</th>
                      <th className="pb-3 pr-4 font-medium">Status</th>
                      <th className="pb-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categories.map((cat) => (
                      <tr key={cat.id} className="border-b border-border/60">
                        <td className="py-3 pr-4 font-medium text-ink">{cat.name}</td>
                        <td className="py-3 pr-4">{cat.itemCount}</td>
                        <td className="py-3 pr-4">{cat.sortOrder}</td>
                        <td className="py-3 pr-4">
                          <Badge variant={cat.isActive ? 'success' : 'warning'}>
                            {cat.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>
                        <td className="py-3">
                          <Button variant="ghost" size="sm" onClick={() => toggleCategory(cat)}>
                            {cat.isActive ? 'Deactivate' : 'Activate'}
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
      ) : null}

      {tab === 'items' ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card padding="lg">
            <CardHeader title="Add menu item" />
            <form onSubmit={handleCreateItem} className="space-y-3">
              <label className="block text-sm">
                <span className="mb-1 block text-ink-muted">Category</span>
                <select
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                  value={itemForm.categoryId}
                  onChange={(e) => setItemForm((f) => ({ ...f, categoryId: e.target.value }))}
                  required
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <Input
                label="Name"
                value={itemForm.name}
                onChange={(e) => setItemForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
              <Input
                label="Code"
                value={itemForm.code}
                onChange={(e) => setItemForm((f) => ({ ...f, code: e.target.value }))}
                required
              />
              <label className="block text-sm">
                <span className="mb-1 block text-ink-muted">Type</span>
                <select
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                  value={itemForm.type}
                  onChange={(e) =>
                    setItemForm((f) => ({
                      ...f,
                      type: e.target.value as 'BEVERAGE' | 'FOOD' | 'SNACK',
                    }))
                  }
                >
                  <option value="BEVERAGE">Beverage</option>
                  <option value="FOOD">Food</option>
                  <option value="SNACK">Snack</option>
                </select>
              </label>
              <Input
                label="Base price (QAR)"
                value={itemForm.basePrice}
                onChange={(e) => setItemForm((f) => ({ ...f, basePrice: e.target.value }))}
                placeholder="12.00"
                required
              />
              <Input
                label="Description"
                value={itemForm.description}
                onChange={(e) => setItemForm((f) => ({ ...f, description: e.target.value }))}
              />
              <Button type="submit" variant="primary" loading={submitting}>
                Create item
              </Button>
            </form>
          </Card>

          <Card padding="lg">
            <CardHeader title="Menu items" description="All items in catalog" />
            {loading ? (
              <TableSkeleton rows={8} />
            ) : items.length === 0 ? (
              <EmptyState title="No menu items" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-ink-muted">
                      <th className="pb-3 pr-4 font-medium">Item</th>
                      <th className="pb-3 pr-4 font-medium">Code</th>
                      <th className="pb-3 pr-4 font-medium">Category</th>
                      <th className="pb-3 pr-4 font-medium">Type</th>
                      <th className="pb-3 font-medium">Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id} className="border-b border-border/60">
                        <td className="py-3 pr-4 font-medium text-ink">{item.name}</td>
                        <td className="py-3 pr-4 text-ink-secondary">{item.code}</td>
                        <td className="py-3 pr-4">{item.categoryName}</td>
                        <td className="py-3 pr-4">
                          <Badge variant="default">{item.type}</Badge>
                        </td>
                        <td className="py-3">{item.basePrice} QAR</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      ) : null}

      {tab === 'modifiers' ? (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card padding="lg">
              <CardHeader title="Add modifier group" />
              <form onSubmit={handleCreateGroup} className="space-y-3">
                <Input
                  label="Name"
                  value={groupForm.name}
                  onChange={(e) => setGroupForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Milk options"
                  required
                />
                <Input
                  label="Min selections"
                  value={groupForm.minSelections}
                  onChange={(e) => setGroupForm((f) => ({ ...f, minSelections: e.target.value }))}
                />
                <Input
                  label="Max selections"
                  value={groupForm.maxSelections}
                  onChange={(e) => setGroupForm((f) => ({ ...f, maxSelections: e.target.value }))}
                />
                <Button type="submit" variant="primary" loading={submitting}>
                  Create group
                </Button>
              </form>
            </Card>

            <Card padding="lg">
              <CardHeader title="Add modifier" />
              <form onSubmit={handleCreateModifier} className="space-y-3">
                <label className="block text-sm">
                  <span className="mb-1 block text-ink-muted">Group</span>
                  <select
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                    value={modifierForm.groupId}
                    onChange={(e) => setModifierForm((f) => ({ ...f, groupId: e.target.value }))}
                    required
                  >
                    {modifierGroups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </label>
                <Input
                  label="Name"
                  value={modifierForm.name}
                  onChange={(e) => setModifierForm((f) => ({ ...f, name: e.target.value }))}
                  required
                />
                <Input
                  label="Code"
                  value={modifierForm.code}
                  onChange={(e) => setModifierForm((f) => ({ ...f, code: e.target.value }))}
                  required
                />
                <Input
                  label="Price adjustment (QAR)"
                  value={modifierForm.priceAdjustment}
                  onChange={(e) =>
                    setModifierForm((f) => ({ ...f, priceAdjustment: e.target.value }))
                  }
                />
                <Button type="submit" variant="primary" loading={submitting}>
                  Create modifier
                </Button>
              </form>
            </Card>
          </div>

          <Card padding="lg">
            <CardHeader title="Modifier groups" description="Options customers can add to items" />
            {loading ? (
              <TableSkeleton rows={6} />
            ) : modifierGroups.length === 0 ? (
              <EmptyState title="No modifier groups" />
            ) : (
              <div className="space-y-6">
                {modifierGroups.map((group) => (
                  <div key={group.id} className="rounded-lg border border-border/60 p-4">
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <h3 className="font-medium text-ink">{group.name}</h3>
                      <Badge variant="default">
                        {group.minSelections}–{group.maxSelections} selections
                      </Badge>
                      {group.isRequired ? <Badge variant="warning">Required</Badge> : null}
                    </div>
                    {group.modifiers.length === 0 ? (
                      <p className="text-sm text-ink-muted">No modifiers in this group</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-border text-left text-ink-muted">
                              <th className="pb-2 pr-4 font-medium">Name</th>
                              <th className="pb-2 pr-4 font-medium">Code</th>
                              <th className="pb-2 pr-4 font-medium">Price</th>
                              <th className="pb-2 font-medium">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.modifiers.map((mod) => (
                              <tr key={mod.id} className="border-b border-border/40">
                                <td className="py-2 pr-4">{mod.name}</td>
                                <td className="py-2 pr-4 text-ink-secondary">{mod.code}</td>
                                <td className="py-2 pr-4">
                                  {parseFloat(mod.priceAdjustment) >= 0 ? '+' : ''}
                                  {mod.priceAdjustment} QAR
                                </td>
                                <td className="py-2">
                                  <Badge variant={mod.isActive ? 'success' : 'warning'}>
                                    {mod.isActive ? 'Active' : 'Inactive'}
                                  </Badge>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      ) : null}
    </div>
  );
}

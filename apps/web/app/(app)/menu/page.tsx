'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Badge, Button, Card, CardHeader, EmptyState, Input, TableSkeleton, useToast } from '@qauto/ui';
import { getApiClient } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';

type MenuItem = Awaited<ReturnType<ReturnType<typeof getApiClient>['getMenuAdminItems']>>[number];
type Recipe = Awaited<ReturnType<ReturnType<typeof getApiClient>['getRecipesAdmin']>>[number];

export default function MenuPage() {
  const branchId = useAuthStore((s) => s.branchId);
  const { toast } = useToast();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [ingredients, setIngredients] = useState<
    Awaited<ReturnType<ReturnType<typeof getApiClient>['getIngredients']>>
  >([]);
  const [loading, setLoading] = useState(true);
  const [newRecipe, setNewRecipe] = useState({
    menuItemId: '',
    ingredientId: '',
    quantity: '',
  });

  const load = useCallback(async () => {
    if (!branchId) return;
    setLoading(true);
    try {
      const client = getApiClient();
      const [itemsData, recipesData, ingredientsData] = await Promise.all([
        client.getMenuAdminItems(branchId),
        client.getRecipesAdmin(),
        client.getIngredients(),
      ]);
      setItems(itemsData);
      setRecipes(recipesData);
      setIngredients(ingredientsData);
      if (!newRecipe.menuItemId && itemsData[0]) {
        setNewRecipe((r) => ({ ...r, menuItemId: itemsData[0].id }));
      }
      if (!newRecipe.ingredientId && ingredientsData[0]) {
        setNewRecipe((r) => ({ ...r, ingredientId: ingredientsData[0].id }));
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to load menu', 'error');
    } finally {
      setLoading(false);
    }
  }, [branchId, toast]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggle86(item: MenuItem) {
    if (!branchId) return;
    try {
      const client = getApiClient();
      await client.updateMenuItemAvailability(item.id, {
        branchId,
        is86: !item.is86,
      });
      toast(`${item.name} ${item.is86 ? 'restored' : '86\'d'}`, 'success');
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Update failed', 'error');
    }
  }

  async function approveRecipe(recipeId: string) {
    try {
      const client = getApiClient();
      await client.approveRecipe(recipeId);
      toast('Recipe approved', 'success');
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Approve failed', 'error');
    }
  }

  async function createRecipe(e: React.FormEvent) {
    e.preventDefault();
    if (!newRecipe.menuItemId || !newRecipe.ingredientId || !newRecipe.quantity) return;
    try {
      const client = getApiClient();
      await client.createRecipe({
        menuItemId: newRecipe.menuItemId,
        lines: [{ ingredientId: newRecipe.ingredientId, quantity: newRecipe.quantity }],
      });
      toast('Draft recipe created', 'success');
      setNewRecipe((r) => ({ ...r, quantity: '' }));
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Create failed', 'error');
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Menu</h1>
          <p className="mt-1 text-sm text-ink-muted">Manage availability and recipes</p>
        </div>
        <Link href="/menu/builder">
          <Button variant="secondary">Open menu builder</Button>
        </Link>
      </div>

      <Card padding="lg">
        <CardHeader title="Menu items" description="Toggle 86 status per branch" />
        {loading ? (
          <TableSkeleton rows={6} />
        ) : items.length === 0 ? (
          <EmptyState title="No menu items" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-ink-muted">
                  <th className="pb-3 pr-4 font-medium">Item</th>
                  <th className="pb-3 pr-4 font-medium">Category</th>
                  <th className="pb-3 pr-4 font-medium">Price</th>
                  <th className="pb-3 pr-4 font-medium">Recipes</th>
                  <th className="pb-3 pr-4 font-medium">Status</th>
                  <th className="pb-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-border/60">
                    <td className="py-3 pr-4 font-medium text-ink">{item.name}</td>
                    <td className="py-3 pr-4 text-ink-secondary">{item.categoryName}</td>
                    <td className="py-3 pr-4">{item.basePrice} QAR</td>
                    <td className="py-3 pr-4">{item.approvedRecipeCount} approved</td>
                    <td className="py-3 pr-4">
                      {item.is86 ? (
                        <Badge variant="danger">86</Badge>
                      ) : (
                        <Badge variant="success">Available</Badge>
                      )}
                    </td>
                    <td className="py-3">
                      <Button variant="ghost" size="sm" onClick={() => toggle86(item)}>
                        {item.is86 ? 'Restore' : '86'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card padding="lg">
        <CardHeader title="Recipe / BOM builder" description="Create draft recipes with ingredient lines" />
        <form onSubmit={createRecipe} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block text-sm">
            <span className="mb-1 block text-ink-muted">Menu item</span>
            <select
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
              value={newRecipe.menuItemId}
              onChange={(e) => setNewRecipe((r) => ({ ...r, menuItemId: e.target.value }))}
            >
              {items.map((i) => (
                <option key={i.id} value={i.id}>{i.name}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-ink-muted">Ingredient</span>
            <select
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
              value={newRecipe.ingredientId}
              onChange={(e) => setNewRecipe((r) => ({ ...r, ingredientId: e.target.value }))}
            >
              {ingredients.map((i) => (
                <option key={i.id} value={i.id}>{i.name}</option>
              ))}
            </select>
          </label>
          <Input
            label="Quantity"
            value={newRecipe.quantity}
            onChange={(e) => setNewRecipe((r) => ({ ...r, quantity: e.target.value }))}
          />
          <div className="flex items-end">
            <Button type="submit" variant="primary">Create draft</Button>
          </div>
        </form>
      </Card>

      <Card padding="lg">
        <CardHeader title="Recipes" description="Approve draft recipes for production" />
        {loading ? (
          <TableSkeleton rows={4} />
        ) : recipes.length === 0 ? (
          <EmptyState title="No recipes" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-ink-muted">
                  <th className="pb-3 pr-4 font-medium">Item</th>
                  <th className="pb-3 pr-4 font-medium">Size</th>
                  <th className="pb-3 pr-4 font-medium">Version</th>
                  <th className="pb-3 pr-4 font-medium">Lines</th>
                  <th className="pb-3 pr-4 font-medium">Status</th>
                  <th className="pb-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {recipes.map((recipe) => (
                  <tr key={recipe.id} className="border-b border-border/60">
                    <td className="py-3 pr-4 font-medium text-ink">{recipe.menuItemName}</td>
                    <td className="py-3 pr-4">{recipe.sizeName ?? 'Default'}</td>
                    <td className="py-3 pr-4">v{recipe.version}</td>
                    <td className="py-3 pr-4">{recipe.lineCount}</td>
                    <td className="py-3 pr-4">
                      <Badge variant={recipe.status === 'APPROVED' ? 'success' : 'warning'}>
                        {recipe.status}
                      </Badge>
                    </td>
                    <td className="py-3">
                      {recipe.status === 'DRAFT' ? (
                        <Button variant="primary" size="sm" onClick={() => approveRecipe(recipe.id)}>
                          Approve
                        </Button>
                      ) : null}
                    </td>
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

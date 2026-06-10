'use client';

import { useCallback, useEffect, useState } from 'react';
import { Badge, Button, Card, CardHeader, EmptyState, TableSkeleton, useToast } from '@qauto/ui';
import { getApiClient } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';

type MenuItem = Awaited<ReturnType<ReturnType<typeof getApiClient>['getMenuAdminItems']>>[number];
type Recipe = Awaited<ReturnType<ReturnType<typeof getApiClient>['getRecipesAdmin']>>[number];

export default function MenuPage() {
  const branchId = useAuthStore((s) => s.branchId);
  const { toast } = useToast();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!branchId) return;
    setLoading(true);
    try {
      const client = getApiClient();
      const [itemsData, recipesData] = await Promise.all([
        client.getMenuAdminItems(branchId),
        client.getRecipesAdmin(),
      ]);
      setItems(itemsData);
      setRecipes(recipesData);
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

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Menu</h1>
        <p className="mt-1 text-sm text-ink-muted">Manage availability and recipes</p>
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

'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Badge, Button, Card, CardHeader, EmptyState, Input, TableSkeleton, useToast } from '@qauto/ui';
import { Modal, selectClassName } from '@/components/admin/modal';
import { getApiClient } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';

type MenuItem = Awaited<ReturnType<ReturnType<typeof getApiClient>['getMenuAdminItems']>>[number];
type Recipe = Awaited<ReturnType<ReturnType<typeof getApiClient>['getRecipesAdmin']>>[number];
type Ingredient = Awaited<ReturnType<ReturnType<typeof getApiClient>['getIngredients']>>[number];

type RecipeLineDraft = { ingredientId: string; quantity: string; uomId?: string };

export default function MenuPage() {
  const branchId = useAuthStore((s) => s.branchId);
  const { toast } = useToast();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [newRecipe, setNewRecipe] = useState({ menuItemId: '', ingredientId: '', quantity: '' });
  const [editRecipe, setEditRecipe] = useState<Recipe | null>(null);
  const [editLines, setEditLines] = useState<RecipeLineDraft[]>([]);

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
      await getApiClient().updateMenuItemAvailability(item.id, { branchId, is86: !item.is86 });
      toast(`${item.name} ${item.is86 ? 'restored' : "86'd"}`, 'success');
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Update failed', 'error');
    }
  }

  async function approveRecipe(recipeId: string) {
    try {
      await getApiClient().approveRecipe(recipeId);
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
      const ing = ingredients.find((i) => i.id === newRecipe.ingredientId);
      await getApiClient().createRecipe({
        menuItemId: newRecipe.menuItemId,
        lines: [{ ingredientId: newRecipe.ingredientId, quantity: newRecipe.quantity, uomId: ing?.uomId }],
      });
      toast('Draft recipe created', 'success');
      setNewRecipe((r) => ({ ...r, quantity: '' }));
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Create failed', 'error');
    }
  }

  function openRecipeEditor(recipe: Recipe) {
    if (recipe.status !== 'DRAFT') {
      toast('Only draft recipes can be edited. Create a new draft to change an approved recipe.', 'error');
      return;
    }
    setEditRecipe(recipe);
    setEditLines(
      recipe.lines.map((l) => ({
        ingredientId: l.ingredientId,
        quantity: l.quantity,
      })),
    );
  }

  function addLine() {
    const first = ingredients[0];
    if (!first) return;
    setEditLines((lines) => [...lines, { ingredientId: first.id, quantity: '1' }]);
  }

  async function saveRecipeLines() {
    if (!editRecipe || editLines.length === 0) return;
    setSubmitting(true);
    try {
      await getApiClient().updateRecipeLines(
        editRecipe.id,
        editLines.map((l) => {
          const ing = ingredients.find((i) => i.id === l.ingredientId);
          return { ingredientId: l.ingredientId, quantity: l.quantity, uomId: ing?.uomId };
        }),
      );
      toast('Recipe lines saved', 'success');
      setEditRecipe(null);
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Save failed', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Menu</h1>
          <p className="mt-1 text-sm text-ink-muted">Manage availability and recipes</p>
        </div>
        <Link href="/menu/builder"><Button variant="secondary">Open menu builder</Button></Link>
      </div>

      <Card padding="lg">
        <CardHeader title="Menu items" description="Toggle 86 status per branch" />
        {loading ? <TableSkeleton rows={6} /> : items.length === 0 ? <EmptyState title="No menu items" /> : (
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
                    <td className="py-3 pr-4">{item.is86 ? <Badge variant="danger">86</Badge> : <Badge variant="success">Available</Badge>}</td>
                    <td className="py-3"><Button variant="ghost" size="sm" onClick={() => toggle86(item)}>{item.is86 ? 'Restore' : '86'}</Button></td>
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
            <select className={selectClassName} value={newRecipe.menuItemId} onChange={(e) => setNewRecipe((r) => ({ ...r, menuItemId: e.target.value }))}>
              {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-ink-muted">Ingredient</span>
            <select className={selectClassName} value={newRecipe.ingredientId} onChange={(e) => setNewRecipe((r) => ({ ...r, ingredientId: e.target.value }))}>
              {ingredients.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
          </label>
          <Input label="Quantity" value={newRecipe.quantity} onChange={(e) => setNewRecipe((r) => ({ ...r, quantity: e.target.value }))} />
          <div className="flex items-end"><Button type="submit" variant="primary">Create draft</Button></div>
        </form>
      </Card>

      <Card padding="lg">
        <CardHeader title="Recipes" description="Edit draft lines, then approve for production" />
        {loading ? <TableSkeleton rows={4} /> : recipes.length === 0 ? <EmptyState title="No recipes" /> : (
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
                    <td className="py-3 pr-4">
                      <span className="text-ink-secondary">{recipe.lineCount} lines</span>
                      {recipe.lines?.length ? (
                        <ul className="mt-1 text-xs text-ink-muted">
                          {recipe.lines.slice(0, 3).map((l) => (
                            <li key={l.id}>{l.ingredientName}: {l.quantity}{l.uom}</li>
                          ))}
                          {recipe.lines.length > 3 ? <li>+{recipe.lines.length - 3} more</li> : null}
                        </ul>
                      ) : null}
                    </td>
                    <td className="py-3 pr-4"><Badge variant={recipe.status === 'APPROVED' ? 'success' : 'warning'}>{recipe.status}</Badge></td>
                    <td className="py-3">
                      <div className="flex gap-1">
                        {recipe.status === 'DRAFT' ? (
                          <>
                            <Button variant="ghost" size="sm" onClick={() => openRecipeEditor(recipe)}>Edit lines</Button>
                            <Button variant="primary" size="sm" onClick={() => approveRecipe(recipe.id)}>Approve</Button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={!!editRecipe}
        title={`Edit recipe — ${editRecipe?.menuItemName ?? ''}`}
        wide
        onClose={() => setEditRecipe(null)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditRecipe(null)}>Cancel</Button>
            <Button variant="secondary" onClick={addLine}>Add line</Button>
            <Button variant="primary" loading={submitting} onClick={saveRecipeLines}>Save lines</Button>
          </>
        }
      >
        <div className="space-y-3">
          {editLines.map((line, idx) => (
            <div key={idx} className="flex flex-wrap items-end gap-2 rounded-lg border border-border/60 p-3">
              <label className="block min-w-[180px] flex-1 text-sm">
                <span className="mb-1 block text-ink-muted">Ingredient</span>
                <select
                  className={selectClassName}
                  value={line.ingredientId}
                  onChange={(e) => setEditLines((lines) => lines.map((l, i) => i === idx ? { ...l, ingredientId: e.target.value } : l))}
                >
                  {ingredients.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                </select>
              </label>
              <Input
                label="Qty"
                value={line.quantity}
                onChange={(e) => setEditLines((lines) => lines.map((l, i) => i === idx ? { ...l, quantity: e.target.value } : l))}
              />
              <Button variant="ghost" size="sm" onClick={() => setEditLines((lines) => lines.filter((_, i) => i !== idx))}>Remove</Button>
            </div>
          ))}
          {editLines.length === 0 ? <p className="text-sm text-ink-muted">Add at least one ingredient line.</p> : null}
        </div>
      </Modal>
    </div>
  );
}

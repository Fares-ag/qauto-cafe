'use client';

import { useCallback, useEffect, useState } from 'react';
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

type Supplier = Awaited<ReturnType<ReturnType<typeof getApiClient>['listSuppliers']>>[number];
type PO = {
  id: string;
  poNumber: string;
  status: string;
  supplier: { name: string };
  lines: Array<{
    id: string;
    ingredientId: string;
    ingredientName: string;
    quantityOrdered: string;
    quantityReceived: string;
    unitCost: string;
  }>;
};

export default function ProcurementPage() {
  const branchId = useAuthStore((s) => s.branchId);
  const { toast } = useToast();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [orders, setOrders] = useState<PO[]>([]);
  const [ingredients, setIngredients] = useState<
    Awaited<ReturnType<ReturnType<typeof getApiClient>['getIngredients']>>
  >([]);
  const [loading, setLoading] = useState(true);
  const [newSupplier, setNewSupplier] = useState({ name: '', code: '' });
  const [newPo, setNewPo] = useState({
    supplierId: '',
    ingredientId: '',
    quantity: '',
    unitCost: '',
  });

  const load = useCallback(async () => {
    if (!branchId) return;
    setLoading(true);
    try {
      const client = getApiClient();
      const [suppliersData, ordersData, ingredientsData] = await Promise.all([
        client.listSuppliers(),
        client.listPurchaseOrders(branchId),
        client.getIngredients(),
      ]);
      setSuppliers(suppliersData);
      setOrders(ordersData as PO[]);
      setIngredients(ingredientsData);
      if (!newPo.supplierId && suppliersData[0]) {
        setNewPo((p) => ({ ...p, supplierId: suppliersData[0].id }));
      }
      if (!newPo.ingredientId && ingredientsData[0]) {
        setNewPo((p) => ({ ...p, ingredientId: ingredientsData[0].id }));
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to load procurement', 'error');
    } finally {
      setLoading(false);
    }
  }, [branchId, toast]);

  useEffect(() => {
    load();
  }, [load]);

  async function createSupplier(e: React.FormEvent) {
    e.preventDefault();
    try {
      const client = getApiClient();
      await client.createSupplier(newSupplier);
      toast('Supplier created', 'success');
      setNewSupplier({ name: '', code: '' });
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed', 'error');
    }
  }

  async function createPo(e: React.FormEvent) {
    e.preventDefault();
    if (!branchId) return;
    try {
      const client = getApiClient();
      await client.createPurchaseOrder({
        branchId,
        supplierId: newPo.supplierId,
        lines: [
          {
            ingredientId: newPo.ingredientId,
            quantityOrdered: newPo.quantity,
            unitCost: newPo.unitCost,
          },
        ],
      });
      toast('PO created', 'success');
      setNewPo((p) => ({ ...p, quantity: '', unitCost: '' }));
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed', 'error');
    }
  }

  async function editPo(po: PO) {
    const line = po.lines[0];
    if (!line) return;
    const qty = prompt('New quantity ordered', line.quantityOrdered);
    const cost = prompt('New unit cost', line.unitCost);
    if (!qty || !cost) return;
    try {
      const client = getApiClient();
      await client.updatePurchaseOrder(po.id, {
        lines: po.lines.map((l) =>
          l.id === line.id
            ? { ingredientId: l.ingredientId, quantityOrdered: qty, unitCost: cost }
            : { ingredientId: l.ingredientId, quantityOrdered: l.quantityOrdered, unitCost: l.unitCost },
        ),
      });
      toast('PO updated', 'success');
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Update failed', 'error');
    }
  }

  async function sendPo(poId: string) {
    try {
      const client = getApiClient();
      await client.sendPurchaseOrder(poId);
      toast('PO sent', 'success');
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed', 'error');
    }
  }

  async function receivePo(po: PO) {
    if (!branchId) return;
    try {
      const client = getApiClient();
      const lines = po.lines
        .filter((l) => parseFloat(l.quantityReceived) < parseFloat(l.quantityOrdered))
        .map((l) => ({
          lineId: l.id,
          quantityReceived: (
            parseFloat(l.quantityOrdered) - parseFloat(l.quantityReceived)
          ).toFixed(4),
        }));
      if (!lines.length) return;
      await client.receivePurchaseOrder(po.id, { branchId, lines });
      toast('PO received into stock', 'success');
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Receive failed', 'error');
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Procurement</h1>
        <p className="mt-1 text-sm text-ink-muted">Suppliers and purchase orders</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card padding="lg">
          <CardHeader title="Add supplier" />
          <form onSubmit={createSupplier} className="space-y-3">
            <Input
              label="Name"
              value={newSupplier.name}
              onChange={(e) => setNewSupplier((s) => ({ ...s, name: e.target.value }))}
            />
            <Input
              label="Code"
              value={newSupplier.code}
              onChange={(e) => setNewSupplier((s) => ({ ...s, code: e.target.value }))}
            />
            <Button type="submit" variant="primary">
              Create supplier
            </Button>
          </form>
        </Card>

        <Card padding="lg">
          <CardHeader title="Create purchase order" />
          <form onSubmit={createPo} className="space-y-3">
            <label className="block text-sm">
              <span className="mb-1 block text-ink-muted">Supplier</span>
              <select
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                value={newPo.supplierId}
                onChange={(e) => setNewPo((p) => ({ ...p, supplierId: e.target.value }))}
              >
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-ink-muted">Ingredient</span>
              <select
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                value={newPo.ingredientId}
                onChange={(e) => setNewPo((p) => ({ ...p, ingredientId: e.target.value }))}
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
              value={newPo.quantity}
              onChange={(e) => setNewPo((p) => ({ ...p, quantity: e.target.value }))}
            />
            <Input
              label="Unit cost (QAR)"
              value={newPo.unitCost}
              onChange={(e) => setNewPo((p) => ({ ...p, unitCost: e.target.value }))}
            />
            <Button type="submit" variant="primary">
              Create PO
            </Button>
          </form>
        </Card>
      </div>

      <Card padding="lg">
        <CardHeader title="Purchase orders" />
        {loading ? (
          <TableSkeleton rows={5} />
        ) : orders.length === 0 ? (
          <EmptyState title="No purchase orders" />
        ) : (
          <div className="space-y-4">
            {orders.map((po) => (
              <div key={po.id} className="rounded-lg border border-border/60 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-ink">{po.poNumber}</p>
                    <p className="text-sm text-ink-muted">{po.supplier.name}</p>
                  </div>
                  <Badge variant={po.status === 'RECEIVED' ? 'success' : 'neutral'}>
                    {po.status}
                  </Badge>
                </div>
                <ul className="mt-2 text-sm text-ink-secondary">
                  {po.lines.map((l) => (
                    <li key={l.id}>
                      {l.ingredientName}: {l.quantityReceived}/{l.quantityOrdered} @ {l.unitCost} QAR
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex gap-2">
                  {po.status === 'DRAFT' ? (
                    <>
                      <Button variant="ghost" size="sm" onClick={() => editPo(po)}>
                        Edit
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => sendPo(po.id)}>
                        Send
                      </Button>
                    </>
                  ) : null}
                  {['SENT', 'PARTIAL'].includes(po.status) ? (
                    <Button variant="primary" size="sm" onClick={() => receivePo(po)}>
                      Receive all
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

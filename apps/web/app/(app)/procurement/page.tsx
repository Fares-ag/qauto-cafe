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
  PageHeader,
  TableSkeleton,
  useToast,
} from '@qauto/ui';
import { ConfirmDialog, Modal, selectClassName } from '@/components/admin/modal';
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

type PoLineDraft = { ingredientId: string; quantityOrdered: string; unitCost: string };

export default function ProcurementPage() {
  const branchId = useAuthStore((s) => s.branchId);
  const { toast } = useToast();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [orders, setOrders] = useState<PO[]>([]);
  const [ingredients, setIngredients] = useState<
    Awaited<ReturnType<ReturnType<typeof getApiClient>['getIngredients']>>
  >([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [newSupplier, setNewSupplier] = useState({ name: '', code: '', email: '', phone: '' });
  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null);
  const [deleteSupplier, setDeleteSupplier] = useState<Supplier | null>(null);
  const [editPo, setEditPo] = useState<PO | null>(null);
  const [poLines, setPoLines] = useState<PoLineDraft[]>([]);
  const [newPo, setNewPo] = useState({ supplierId: '', lines: [{ ingredientId: '', quantityOrdered: '', unitCost: '' }] as PoLineDraft[] });
  const [cancelPo, setCancelPo] = useState<PO | null>(null);

  const load = useCallback(async () => {
    if (!branchId) return;
    setLoading(true);
    try {
      const client = getApiClient();
      const [suppliersData, ordersData, ingredientsData] = await Promise.all([
        client.listSuppliers(true),
        client.listPurchaseOrders(branchId),
        client.getIngredients(),
      ]);
      setSuppliers(suppliersData);
      setOrders(ordersData as PO[]);
      setIngredients(ingredientsData);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to load procurement', 'error');
    } finally {
      setLoading(false);
    }
  }, [branchId, toast]);

  useEffect(() => {
    load();
  }, [load]);

  async function addSupplier() {
    if (!newSupplier.name || !newSupplier.code) return;
    setSubmitting(true);
    try {
      await getApiClient().createSupplier(newSupplier);
      toast('Supplier created', 'success');
      setNewSupplier({ name: '', code: '', email: '', phone: '' });
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function saveSupplier() {
    if (!editSupplier) return;
    setSubmitting(true);
    try {
      await getApiClient().updateSupplier(editSupplier.id, {
        name: editSupplier.name,
        email: editSupplier.email ?? undefined,
        phone: editSupplier.phone ?? undefined,
        isActive: editSupplier.isActive ?? true,
      });
      toast('Supplier updated', 'success');
      setEditSupplier(null);
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Update failed', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmDeleteSupplier() {
    if (!deleteSupplier) return;
    setSubmitting(true);
    try {
      await getApiClient().deleteSupplier(deleteSupplier.id);
      toast('Supplier removed', 'success');
      setDeleteSupplier(null);
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Delete failed', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function createPo(e: React.FormEvent) {
    e.preventDefault();
    if (!branchId) return;
    setSubmitting(true);
    try {
      await getApiClient().createPurchaseOrder({
        branchId,
        supplierId: newPo.supplierId,
        lines: newPo.lines.filter((l) => l.ingredientId && l.quantityOrdered),
      });
      toast('PO created', 'success');
      setNewPo({ supplierId: suppliers[0]?.id ?? '', lines: [{ ingredientId: '', quantityOrdered: '', unitCost: '' }] });
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  function openEditPo(po: PO) {
    setEditPo(po);
    setPoLines(po.lines.map((l) => ({
      ingredientId: l.ingredientId,
      quantityOrdered: l.quantityOrdered,
      unitCost: l.unitCost,
    })));
  }

  async function savePo() {
    if (!editPo) return;
    setSubmitting(true);
    try {
      await getApiClient().updatePurchaseOrder(editPo.id, { lines: poLines });
      toast('PO updated', 'success');
      setEditPo(null);
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Update failed', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function sendPo(poId: string) {
    try {
      await getApiClient().sendPurchaseOrder(poId);
      toast('PO sent', 'success');
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed', 'error');
    }
  }

  async function receivePo(po: PO) {
    if (!branchId) return;
    try {
      const lines = po.lines
        .filter((l) => parseFloat(l.quantityReceived) < parseFloat(l.quantityOrdered))
        .map((l) => ({
          lineId: l.id,
          quantityReceived: (parseFloat(l.quantityOrdered) - parseFloat(l.quantityReceived)).toFixed(4),
        }));
      if (!lines.length) return;
      await getApiClient().receivePurchaseOrder(po.id, { branchId, lines });
      toast('PO received into stock', 'success');
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Receive failed', 'error');
    }
  }

  async function confirmCancelPo() {
    if (!cancelPo) return;
    setSubmitting(true);
    try {
      await getApiClient().cancelPurchaseOrder(cancelPo.id);
      toast('PO cancelled', 'success');
      setCancelPo(null);
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Cancel failed', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader title="Procurement" description="Suppliers and purchase orders" />

      <Card padding="lg">
        <CardHeader title="Suppliers" description="Vendor master data" />
        <div className="mb-4 grid gap-3 sm:grid-cols-4">
          <Input label="Name" value={newSupplier.name} onChange={(e) => setNewSupplier((s) => ({ ...s, name: e.target.value }))} />
          <Input label="Code" value={newSupplier.code} onChange={(e) => setNewSupplier((s) => ({ ...s, code: e.target.value }))} />
          <Input label="Email" value={newSupplier.email} onChange={(e) => setNewSupplier((s) => ({ ...s, email: e.target.value }))} />
          <div className="flex items-end"><Button variant="primary" loading={submitting} onClick={addSupplier}>Add supplier</Button></div>
        </div>
        {loading ? <TableSkeleton rows={4} /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-ink-muted">
                  <th className="pb-3 pr-4 font-medium">Name</th>
                  <th className="pb-3 pr-4 font-medium">Code</th>
                  <th className="pb-3 pr-4 font-medium">Contact</th>
                  <th className="pb-3 pr-4 font-medium">Status</th>
                  <th className="pb-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((s) => (
                  <tr key={s.id} className="border-b border-border/60">
                    <td className="py-3 pr-4 font-medium">{s.name}</td>
                    <td className="py-3 pr-4">{s.code}</td>
                    <td className="py-3 pr-4 text-ink-secondary">{s.email ?? '—'}</td>
                    <td className="py-3 pr-4"><Badge variant={s.isActive !== false ? 'success' : 'warning'}>{s.isActive !== false ? 'Active' : 'Inactive'}</Badge></td>
                    <td className="py-3">
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setEditSupplier({ ...s })}>Edit</Button>
                        <Button variant="ghost" size="sm" onClick={() => setDeleteSupplier(s)}>Delete</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card padding="lg">
        <CardHeader title="Create purchase order" />
        <form onSubmit={createPo} className="space-y-3">
          <label className="block text-sm">
            <span className="mb-1 block text-ink-muted">Supplier</span>
            <select className={selectClassName} value={newPo.supplierId} onChange={(e) => setNewPo((p) => ({ ...p, supplierId: e.target.value }))} required>
              <option value="">Select supplier</option>
              {suppliers.filter((s) => s.isActive !== false).map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>
          {newPo.lines.map((line, idx) => (
            <div key={idx} className="grid gap-2 sm:grid-cols-4">
              <select className={selectClassName} value={line.ingredientId} onChange={(e) => setNewPo((p) => ({ ...p, lines: p.lines.map((l, i) => i === idx ? { ...l, ingredientId: e.target.value } : l) }))}>
                <option value="">Ingredient</option>
                {ingredients.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
              <Input label="Qty" value={line.quantityOrdered} onChange={(e) => setNewPo((p) => ({ ...p, lines: p.lines.map((l, i) => i === idx ? { ...l, quantityOrdered: e.target.value } : l) }))} />
              <Input label="Unit cost" value={line.unitCost} onChange={(e) => setNewPo((p) => ({ ...p, lines: p.lines.map((l, i) => i === idx ? { ...l, unitCost: e.target.value } : l) }))} />
              <div className="flex items-end">
                {newPo.lines.length > 1 ? <Button type="button" variant="ghost" onClick={() => setNewPo((p) => ({ ...p, lines: p.lines.filter((_, i) => i !== idx) }))}>Remove</Button> : null}
              </div>
            </div>
          ))}
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={() => setNewPo((p) => ({ ...p, lines: [...p.lines, { ingredientId: '', quantityOrdered: '', unitCost: '' }] }))}>Add line</Button>
            <Button type="submit" variant="primary" loading={submitting}>Create PO</Button>
          </div>
        </form>
      </Card>

      <Card padding="lg">
        <CardHeader title="Purchase orders" />
        {loading ? <TableSkeleton rows={5} /> : orders.length === 0 ? <EmptyState title="No purchase orders" /> : (
          <div className="space-y-4">
            {orders.map((po) => (
              <div key={po.id} className="rounded-lg border border-border/60 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-ink">{po.poNumber}</p>
                    <p className="text-sm text-ink-muted">{po.supplier.name}</p>
                  </div>
                  <Badge variant={po.status === 'RECEIVED' ? 'success' : po.status === 'CANCELLED' ? 'warning' : 'neutral'}>{po.status}</Badge>
                </div>
                <ul className="mt-2 text-sm text-ink-secondary">
                  {po.lines.map((l) => (
                    <li key={l.id}>{l.ingredientName}: {l.quantityReceived}/{l.quantityOrdered} @ {l.unitCost} QAR</li>
                  ))}
                </ul>
                <div className="mt-3 flex flex-wrap gap-2">
                  {po.status === 'DRAFT' ? (
                    <>
                      <Button variant="ghost" size="sm" onClick={() => openEditPo(po)}>Edit</Button>
                      <Button variant="secondary" size="sm" onClick={() => sendPo(po.id)}>Send</Button>
                      <Button variant="ghost" size="sm" onClick={() => setCancelPo(po)}>Cancel</Button>
                    </>
                  ) : null}
                  {['SENT', 'PARTIAL'].includes(po.status) ? (
                    <>
                      <Button variant="primary" size="sm" onClick={() => receivePo(po)}>Receive all</Button>
                      <Button variant="ghost" size="sm" onClick={() => setCancelPo(po)}>Cancel</Button>
                    </>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal open={!!editSupplier} title="Edit supplier" onClose={() => setEditSupplier(null)} footer={<><Button variant="ghost" onClick={() => setEditSupplier(null)}>Cancel</Button><Button variant="primary" loading={submitting} onClick={saveSupplier}>Save</Button></>}>
        {editSupplier ? (
          <div className="space-y-3">
            <Input label="Name" value={editSupplier.name} onChange={(e) => setEditSupplier((s) => s ? { ...s, name: e.target.value } : s)} />
            <Input label="Email" value={editSupplier.email ?? ''} onChange={(e) => setEditSupplier((s) => s ? { ...s, email: e.target.value } : s)} />
            <Input label="Phone" value={editSupplier.phone ?? ''} onChange={(e) => setEditSupplier((s) => s ? { ...s, phone: e.target.value } : s)} />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={editSupplier.isActive !== false} onChange={(e) => setEditSupplier((s) => s ? { ...s, isActive: e.target.checked } : s)} className="rounded border-border" />
              <span>Active</span>
            </label>
          </div>
        ) : null}
      </Modal>

      <Modal open={!!editPo} title={`Edit ${editPo?.poNumber ?? 'PO'}`} wide onClose={() => setEditPo(null)} footer={<><Button variant="ghost" onClick={() => setEditPo(null)}>Cancel</Button><Button variant="primary" loading={submitting} onClick={savePo}>Save</Button></>}>
        <div className="space-y-3">
          {poLines.map((line, idx) => (
            <div key={idx} className="grid gap-2 sm:grid-cols-3">
              <select className={selectClassName} value={line.ingredientId} onChange={(e) => setPoLines((lines) => lines.map((l, i) => i === idx ? { ...l, ingredientId: e.target.value } : l))}>
                {ingredients.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
              <Input label="Qty" value={line.quantityOrdered} onChange={(e) => setPoLines((lines) => lines.map((l, i) => i === idx ? { ...l, quantityOrdered: e.target.value } : l))} />
              <Input label="Unit cost" value={line.unitCost} onChange={(e) => setPoLines((lines) => lines.map((l, i) => i === idx ? { ...l, unitCost: e.target.value } : l))} />
            </div>
          ))}
          <Button variant="secondary" size="sm" onClick={() => setPoLines((lines) => [...lines, { ingredientId: ingredients[0]?.id ?? '', quantityOrdered: '', unitCost: '' }])}>Add line</Button>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteSupplier} title="Delete supplier" message={`Remove ${deleteSupplier?.name}?`} loading={submitting} onConfirm={confirmDeleteSupplier} onClose={() => setDeleteSupplier(null)} />
      <ConfirmDialog open={!!cancelPo} title="Cancel PO" message={`Cancel ${cancelPo?.poNumber}?`} confirmLabel="Cancel PO" loading={submitting} onConfirm={confirmCancelPo} onClose={() => setCancelPo(null)} />
    </div>
  );
}

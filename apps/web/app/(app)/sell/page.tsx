'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiError } from '@qauto/api-client';
import type { CartLineInput, MenuCatalogItem, StockShortageError } from '@qauto/shared-types';
import { Alert, Button, Card, Input, useToast } from '@qauto/ui';
import { useAuthStore } from '@/lib/auth-store';
import { useCartStore } from '@/lib/cart-store';
import { withAuth } from '@/lib/api';
import { ensureTerminal } from '@/lib/terminal';
import { printReceipt } from '@/lib/print-receipt';
import { MenuGrid } from '@/components/MenuGrid';
import { ModifierSheet } from '@/components/ModifierSheet';
import { CartPanel } from '@/components/CartPanel';

function isStockShortageErrors(errors: unknown): errors is StockShortageError[] {
  return (
    Array.isArray(errors) &&
    errors.every(
      (e) =>
        typeof e === 'object' &&
        e !== null &&
        'ingredientId' in e &&
        'ingredientName' in e,
    )
  );
}

export default function SellPage() {
  const { toast } = useToast();
  const { branchId, posTerminalId, shiftId, currentShift, setShift, setPosTerminalId } =
    useAuthStore();
  const {
    catalog,
    order,
    pending,
    isSyncing,
    setCatalog,
    setOrder,
    setPending,
    setSyncing,
  } = useCartStore();

  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [payError, setPayError] = useState<string | null>(null);
  const [stockErrors, setStockErrors] = useState<StockShortageError[]>([]);
  const [paySuccess, setPaySuccess] = useState<string | null>(null);
  const [shiftLoading, setShiftLoading] = useState(true);
  const [terminalReady, setTerminalReady] = useState(false);
  const [openingFloat, setOpeningFloat] = useState('100.0000');
  const [closeCash, setCloseCash] = useState('');
  const [showCloseShift, setShowCloseShift] = useState(false);

  useEffect(() => {
    if (!branchId) return;
    withAuth(async (client) => {
      const id = await ensureTerminal(client, branchId, 'POS');
      setPosTerminalId(id);
      setTerminalReady(true);
    }).catch((err) => {
      setError(err instanceof Error ? err.message : 'Failed to initialize POS terminal');
    });
  }, [branchId, setPosTerminalId]);

  const loadShift = useCallback(async () => {
    if (!branchId || !terminalReady) return;
    setShiftLoading(true);
    try {
      const shift = await withAuth((client) =>
        client.getCurrentShift(branchId, posTerminalId ?? undefined),
      );
      setShift(shift);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to load shift', 'error');
    } finally {
      setShiftLoading(false);
    }
  }, [branchId, posTerminalId, terminalReady, setShift, toast]);

  useEffect(() => {
    if (terminalReady && branchId) loadShift();
  }, [terminalReady, branchId, loadShift]);

  const loadCatalog = useCallback(async () => {
    if (!branchId) return;
    const data = await withAuth((client) => client.getMenuCatalog(branchId));
    setCatalog(data);
    setActiveCategoryId(data.categories[0]?.id ?? null);
  }, [branchId, setCatalog]);

  const ensureOrder = useCallback(async () => {
    if (order || !branchId) return order;
    const created = await withAuth((client) =>
      client.createOrder({
        branchId,
        terminalId: posTerminalId ?? undefined,
        shiftId: shiftId ?? undefined,
      }),
    );
    setOrder(created);
    return created;
  }, [order, branchId, posTerminalId, shiftId, setOrder]);

  useEffect(() => {
    if (branchId && currentShift) {
      loadCatalog().catch((err) =>
        setError(err instanceof Error ? err.message : 'Failed to load menu'),
      );
    }
  }, [branchId, currentShift, loadCatalog]);

  const activeCategory = useMemo(
    () => catalog?.categories.find((c) => c.id === activeCategoryId) ?? catalog?.categories[0],
    [catalog, activeCategoryId],
  );

  function linesToInput(): CartLineInput[] {
    return (
      order?.lines.map((l) => ({
        menuItemId: l.menuItemId,
        sizeId: l.sizeId ?? undefined,
        quantity: l.quantity,
        modifierIds: l.modifiers.map((m) => m.modifierId),
        notes: l.notes ?? undefined,
      })) ?? []
    );
  }

  async function syncLines(lines: CartLineInput[]) {
    setSyncing(true);
    setError(null);
    try {
      const current = order ?? (await ensureOrder());
      if (!current) return;
      const updated = await withAuth((client) => client.updateOrderLines(current.id, lines));
      setOrder(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update order');
    } finally {
      setSyncing(false);
    }
  }

  async function handleSelectItem(item: MenuCatalogItem) {
    if (item.type === 'SNACK' && item.modifierGroups.length === 0) {
      await addLine({ menuItemId: item.id, quantity: 1, modifierIds: [] });
      return;
    }
    setPending({ item, modifierIds: [] });
  }

  async function addLine(line: CartLineInput) {
    await syncLines([...linesToInput(), line]);
  }

  async function handleUpdateQuantity(lineIndex: number, quantity: number) {
    const lines = linesToInput();
    lines[lineIndex] = { ...lines[lineIndex], quantity };
    await syncLines(lines);
  }

  async function handleRemoveLine(lineIndex: number) {
    await syncLines(linesToInput().filter((_, i) => i !== lineIndex));
  }

  async function handleClear() {
    if (!order) return;
    setPayError(null);
    setStockErrors([]);
    setPaySuccess(null);
    await syncLines([]);
  }

  async function handleOpenShift() {
    if (!branchId) return;
    try {
      const shift = await withAuth((client) =>
        client.openShift({
          branchId,
          terminalId: posTerminalId ?? undefined,
          openingFloat,
        }),
      );
      setShift(shift);
      toast('Shift opened', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to open shift', 'error');
    }
  }

  async function handleCloseShift() {
    if (!currentShift) return;
    try {
      await withAuth((client) =>
        client.closeShift(currentShift.id, { actualCash: closeCash || '0.0000' }),
      );
      setShift(null);
      setShowCloseShift(false);
      toast('Shift closed', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to close shift', 'error');
    }
  }

  async function handlePay(method: 'CASH' | 'CARD') {
    if (!order?.lines.length) return;
    setSyncing(true);
    setPayError(null);
    setStockErrors([]);
    setPaySuccess(null);

    try {
      const result = await withAuth((client) =>
        client.payOrder(order.id, {
          payments: [{ method, amount: order.total }],
          idempotencyKey: crypto.randomUUID(),
        }),
      );

      setOrder({
        ...order,
        status: result.order.status,
        cogsTotal: result.order.cogsTotal,
        paidAt: result.order.paidAt,
      });

      setPaySuccess(`Order #${result.order.orderNumber} paid · COGS ${result.order.cogsTotal} QAR`);
      toast('Payment successful', 'success');
      printReceipt(result);
      await loadCatalog();

      setTimeout(() => {
        setOrder(null);
        setPaySuccess(null);
      }, 3000);
    } catch (err) {
      if (
        err instanceof ApiError &&
        err.body.status === 409 &&
        isStockShortageErrors(err.body.errors)
      ) {
        setStockErrors(err.body.errors);
      } else {
        setPayError(err instanceof Error ? err.message : 'Payment failed');
      }
    } finally {
      setSyncing(false);
    }
  }

  if (shiftLoading || !terminalReady) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
      </div>
    );
  }

  if (!currentShift) {
    return (
      <div className="mx-auto max-w-md">
        <Card padding="lg">
          <h1 className="text-xl font-semibold text-ink">Open shift</h1>
          <p className="mt-1 text-sm text-ink-muted">Start your shift before taking orders</p>
          <div className="mt-4 space-y-3">
            <Input
              label="Opening float (QAR)"
              value={openingFloat}
              onChange={(e) => setOpeningFloat(e.target.value)}
            />
            <Button variant="primary" size="lg" className="w-full" onClick={handleOpenShift}>
              Open shift
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink">Sell</h1>
          <p className="text-sm text-ink-muted">
            {order ? `Order #${order.orderNumber}` : 'New order'} · Shift open
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setShowCloseShift(true)}>
          Close shift
        </Button>
      </div>

      {paySuccess ? <Alert variant="success">{paySuccess}</Alert> : null}
      {error ? <Alert variant="error">{error}</Alert> : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="flex flex-wrap gap-2">
            {catalog?.categories.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => setActiveCategoryId(category.id)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-all duration-150 ${
                  activeCategory?.id === category.id
                    ? 'bg-brand text-brand-foreground shadow-soft'
                    : 'border border-border bg-surface-raised text-ink-secondary hover:bg-surface-sunken'
                }`}
              >
                {category.name}
              </button>
            ))}
          </div>

          <div className="min-h-[420px] rounded-xl border border-border bg-surface-raised p-6 shadow-soft">
            {activeCategory ? (
              <MenuGrid
                items={activeCategory.items}
                activeCategory={activeCategory.name}
                onSelectItem={handleSelectItem}
              />
            ) : (
              <p className="text-sm text-ink-muted">Loading menu…</p>
            )}
          </div>
        </div>

        <CartPanel
          order={order}
          isSyncing={isSyncing}
          payError={payError}
          stockErrors={stockErrors}
          onClear={handleClear}
          onPay={handlePay}
          onUpdateQuantity={handleUpdateQuantity}
          onRemoveLine={handleRemoveLine}
        />
      </div>

      {pending ? (
        <ModifierSheet
          item={pending.item}
          onClose={() => setPending(null)}
          onAdd={(payload) =>
            addLine({
              menuItemId: pending.item.id,
              sizeId: payload.sizeId,
              quantity: 1,
              modifierIds: payload.modifierIds,
              notes: payload.notes,
            })
          }
        />
      ) : null}

      {showCloseShift ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
          <Card padding="lg" className="w-full max-w-sm">
            <h2 className="text-lg font-semibold text-ink">Close shift</h2>
            <Input
              label="Actual cash count (QAR)"
              value={closeCash}
              onChange={(e) => setCloseCash(e.target.value)}
              className="mt-4"
            />
            <div className="mt-4 flex gap-2">
              <Button variant="primary" onClick={handleCloseShift}>
                Close shift
              </Button>
              <Button variant="ghost" onClick={() => setShowCloseShift(false)}>
                Cancel
              </Button>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

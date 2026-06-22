'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@qauto/api-client';
import type { CartLineInput, MenuCatalogItem, OrderType, StockShortageError } from '@qauto/shared-types';
import { Alert, Button, Card, Input, useToast } from '@qauto/ui';
import { useAuthStore } from '@/lib/auth-store';
import { useCartStore } from '@/lib/cart-store';
import { withAuth } from '@/lib/api';
import type { Order } from '@qauto/shared-types';
import { printReceipt } from '@/lib/print-receipt';
import { MenuGrid } from '@/components/MenuGrid';
import { CartPanel } from '@/components/CartPanel';
import {
  emptyRegisterCustomer,
  type RegisterCustomerValue,
} from '@/components/RegisterCustomerPanel';
import { RegisterTips } from '@/components/RegisterTips';
import type { SplitPaymentRow } from '@/components/SplitPaySheet';
import { getCategoryIcon, ORDER_TYPE_LABELS } from '@/lib/navigation';
import { usePosBootstrap } from '@/lib/queries';
import { queryKeys } from '@/lib/query-keys';
import {
  applyOptimisticAddLine,
  applyOptimisticClearLines,
  applyOptimisticRemoveLine,
  applyOptimisticUpdateQuantity,
  isPendingLineId,
} from '@/lib/optimistic-order';

const ModifierSheet = dynamic(
  () => import('@/components/ModifierSheet').then((m) => m.ModifierSheet),
  { ssr: false },
);

const SplitPaySheet = dynamic(
  () => import('@/components/SplitPaySheet').then((m) => m.SplitPaySheet),
  { ssr: false },
);

const ORDER_TYPES: { value: OrderType; label: string }[] = [
  { value: 'COUNTER', label: ORDER_TYPE_LABELS.COUNTER },
  { value: 'TAKEAWAY', label: ORDER_TYPE_LABELS.TAKEAWAY },
  { value: 'STAFF', label: ORDER_TYPE_LABELS.STAFF },
  { value: 'COMP', label: ORDER_TYPE_LABELS.COMP },
];

function hashRegisterCustomer(value: RegisterCustomerValue): string {
  return JSON.stringify({
    mode: value.mode,
    customerId: value.customerId,
    customerName: value.customerName.trim(),
    customerDepartment: value.customerDepartment.trim(),
    guestName: value.guestName.trim(),
    billingParty: value.billingParty,
  });
}
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
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { branchId, posTerminalId, shiftId, currentShift, setShift, setPosTerminalId } =
    useAuthStore();
  const {
    catalog,
    order,
    pending,
    isSyncing,
    isPaying,
    setCatalog,
    setOrder,
    setPending,
    setSyncing,
    setPaying,
  } = useCartStore();

  const cartSyncQueueRef = useRef(Promise.resolve());
  const pendingCartOpsRef = useRef(0);
  const customerSyncedRef = useRef<string | null>(null);

  const { data: bootstrap, isLoading: bootstrapLoading, error: bootstrapError } = usePosBootstrap(branchId);

  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [payError, setPayError] = useState<string | null>(null);
  const [stockErrors, setStockErrors] = useState<StockShortageError[]>([]);
  const [paySuccess, setPaySuccess] = useState<string | null>(null);
  const [openingFloat, setOpeningFloat] = useState('100.0000');
  const [closeCash, setCloseCash] = useState('');
  const [showCloseShift, setShowCloseShift] = useState(false);
  const [registerCustomer, setRegisterCustomer] = useState<RegisterCustomerValue>(emptyRegisterCustomer());
  const [loyaltyPointsBalance, setLoyaltyPointsBalance] = useState(0);
  const [loyaltyPointsRedeem, setLoyaltyPointsRedeem] = useState('');
  const [giftCardCode, setGiftCardCode] = useState('');
  const [orderType, setOrderType] = useState<OrderType>('COUNTER');
  const [discountType, setDiscountType] = useState<'PERCENTAGE' | 'FIXED_AMOUNT'>('PERCENTAGE');
  const [discountValue, setDiscountValue] = useState('');
  const [showSplitPay, setShowSplitPay] = useState(false);

  useEffect(() => {
    if (!bootstrap) return;
    setPosTerminalId(bootstrap.terminalId);
    setCatalog(bootstrap.catalog);
    setShift(bootstrap.shift);
    setActiveCategoryId((current) => current ?? bootstrap.catalog.categories[0]?.id ?? null);
  }, [bootstrap, setPosTerminalId, setCatalog, setShift]);

  useEffect(() => {
    if (bootstrapError) {
      setError(bootstrapError instanceof Error ? bootstrapError.message : 'Failed to initialize POS');
    }
  }, [bootstrapError]);

  const isOrderLocked =
    order?.status === 'PAID' ||
    order?.status === 'PENDING_PAYMENT' ||
    Boolean(order?.deferredAt);

  const ensureOrder = useCallback(async () => {
    if (order || !branchId) return order;
    const created = await withAuth((client) =>
      client.createOrder({
        branchId,
        terminalId: posTerminalId ?? undefined,
        shiftId: shiftId ?? undefined,
        orderType,
      }),
    );
    setOrder(created);
    return created;
  }, [order, branchId, posTerminalId, shiftId, orderType, setOrder]);

  const activeCategory = useMemo(
    () => catalog?.categories.find((c) => c.id === activeCategoryId) ?? catalog?.categories[0],
    [catalog, activeCategoryId],
  );

  const refreshOrderFromServer = useCallback(async (orderId: string) => {
    const fresh = await withAuth((client) => client.getOrder(orderId));
    const current = useCartStore.getState().order;
    if (current?.id === orderId) {
      setOrder(fresh);
    }
    return fresh;
  }, [setOrder]);

  const enqueueCartMutation = useCallback(
    (fn: () => Promise<void>) => {
      pendingCartOpsRef.current += 1;
      setSyncing(true);
      setError(null);

      cartSyncQueueRef.current = cartSyncQueueRef.current
        .then(fn)
        .catch(async (err) => {
          const orderId = useCartStore.getState().order?.id;
          if (orderId) {
            try {
              await refreshOrderFromServer(orderId);
            } catch {
              // keep optimistic state if refetch fails
            }
          }
          setError(err instanceof Error ? err.message : 'Failed to update order');
        })
        .finally(() => {
          pendingCartOpsRef.current -= 1;
          if (pendingCartOpsRef.current <= 0) {
            pendingCartOpsRef.current = 0;
            setSyncing(false);
          }
        });
    },
    [refreshOrderFromServer, setSyncing],
  );

  const waitForCartSync = useCallback(async () => {
    await cartSyncQueueRef.current;
  }, []);

  async function addLine(line: CartLineInput) {
    if (isOrderLocked) return;

    let currentOrder = useCartStore.getState().order;
    const currentCatalog = useCartStore.getState().catalog;

    if (!currentOrder) {
      currentOrder = (await ensureOrder()) ?? null;
      if (!currentOrder) return;
    }

    if (currentCatalog) {
      setOrder(applyOptimisticAddLine(currentOrder, currentCatalog, line));
    }

    enqueueCartMutation(async () => {
      const orderId = useCartStore.getState().order?.id ?? currentOrder!.id;
      const updated = await withAuth((client) => client.addOrderLine(orderId, line));
      setOrder(updated);
    });
  }

  function handleUpdateQuantity(lineIndex: number, quantity: number) {
    const currentOrder = useCartStore.getState().order;
    const line = currentOrder?.lines[lineIndex];
    if (!line || isOrderLocked) return;

    setOrder(applyOptimisticUpdateQuantity(currentOrder, lineIndex, quantity));

    enqueueCartMutation(async () => {
      const latest = useCartStore.getState().order;
      const latestLine = latest?.lines[lineIndex];
      if (!latest?.id || !latestLine) return;

      if (isPendingLineId(latestLine.id)) {
        await refreshOrderFromServer(latest.id);
        const refreshed = useCartStore.getState().order;
        const resolvedLine = refreshed?.lines[lineIndex];
        if (!refreshed?.id || !resolvedLine || isPendingLineId(resolvedLine.id)) return;

        const updated =
          quantity <= 0
            ? await withAuth((client) => client.removeOrderLine(refreshed.id, resolvedLine.id))
            : await withAuth((client) =>
                client.updateOrderLineQuantity(refreshed.id, resolvedLine.id, quantity),
              );
        setOrder(updated);
        return;
      }

      const updated =
        quantity <= 0
          ? await withAuth((client) => client.removeOrderLine(latest.id, latestLine.id))
          : await withAuth((client) =>
              client.updateOrderLineQuantity(latest.id, latestLine.id, quantity),
            );
      setOrder(updated);
    });
  }

  function handleRemoveLine(lineIndex: number) {
    const currentOrder = useCartStore.getState().order;
    const line = currentOrder?.lines[lineIndex];
    if (!line || isOrderLocked) return;

    setOrder(applyOptimisticRemoveLine(currentOrder, lineIndex));

    enqueueCartMutation(async () => {
      const latest = useCartStore.getState().order;
      const latestLine = latest?.lines[lineIndex];
      if (!latest?.id) return;

      if (!latestLine || isPendingLineId(latestLine.id)) {
        await refreshOrderFromServer(latest.id);
        return;
      }

      const updated = await withAuth((client) => client.removeOrderLine(latest.id, latestLine.id));
      setOrder(updated);
    });
  }

  function handleClear() {
    const currentOrder = useCartStore.getState().order;
    if (!currentOrder || isOrderLocked) return;

    setPayError(null);
    setStockErrors([]);
    setPaySuccess(null);
    setOrder(applyOptimisticClearLines(currentOrder));

    enqueueCartMutation(async () => {
      const orderId = useCartStore.getState().order?.id ?? currentOrder.id;
      const updated = await withAuth((client) => client.clearOrderLines(orderId));
      setOrder(updated);
    });
  }

  function invalidateMenuCatalog() {
    if (!branchId) return;
    void queryClient.invalidateQueries({ queryKey: queryKeys.menuCatalog(branchId) });
  }

  function invalidateOrderQueries() {
    if (!branchId) return;
    void queryClient.invalidateQueries({ queryKey: queryKeys.unpaidCount(branchId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.orderQueue(branchId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.ordersList(branchId) });
  }

  async function handleSelectItem(item: MenuCatalogItem) {
    if (isOrderLocked || isPaying) return;
    if (item.type === 'SNACK' && item.modifierGroups.length === 0) {
      void addLine({ menuItemId: item.id, quantity: 1, modifierIds: [] });
      return;
    }
    setPending({ item, modifierIds: [] });
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

  function validateRegisterCustomer(): string | null {
    if (registerCustomer.mode === 'guest' && registerCustomer.billingParty === 'DEPARTMENT') {
      if (!registerCustomer.customerDepartment.trim()) {
        return 'Select a department for the office guest before checkout';
      }
    }
    return null;
  }

  async function syncCustomer(orderId: string) {
    const { customerName, customerDepartment, customerId, billingParty, guestName } = registerCustomer;
    const hasDetails =
      customerName.trim() ||
      customerDepartment.trim() ||
      customerId ||
      guestName.trim() ||
      billingParty === 'DEPARTMENT';
    if (!hasDetails) return;

    const updated = await withAuth((client) =>
      client.updateOrderCustomer(orderId, {
        customerId: billingParty === 'DEPARTMENT' ? null : customerId ?? undefined,
        customerName: customerName.trim() || undefined,
        customerDepartment: customerDepartment.trim() || undefined,
        guestName: guestName.trim() || undefined,
        billingParty,
      }),
    );
    customerSyncedRef.current = hashRegisterCustomer(registerCustomer);
    const current = useCartStore.getState().order;
    if (current?.id === orderId) {
      setOrder({
        ...current,
        customerName: updated.customerName ?? current.customerName,
        customerDepartment: updated.customerDepartment ?? current.customerDepartment,
        guestName: updated.guestName ?? current.guestName,
        billingParty: updated.billingParty ?? current.billingParty,
      });
    }
  }

  function handleRegisterCustomerChange(value: RegisterCustomerValue) {
    setRegisterCustomer(value);
    if (value.mode === 'extension' && value.customerId) {
      const q = value.customerName.trim() || value.phoneExtension.trim();
      withAuth((client) => client.getCustomerDirectory(q || undefined))
        .then((entries) => {
          const match = entries.find((e) => e.id === value.customerId);
          setLoyaltyPointsBalance(match?.pointsBalance ?? 0);
        })
        .catch(() => setLoyaltyPointsBalance(0));
    } else {
      setLoyaltyPointsBalance(0);
    }
  }

  useEffect(() => {
    if (!order?.id || order.status !== 'DRAFT') return;
    const validationError = validateRegisterCustomer();
    if (validationError) return;

    const timer = setTimeout(() => {
      syncCustomer(order.id).catch(() => undefined);
    }, 400);
    return () => clearTimeout(timer);
  }, [order?.id, order?.status, registerCustomer]);

  function resetRegisterCustomer() {
    setRegisterCustomer(emptyRegisterCustomer());
    setLoyaltyPointsBalance(0);
  }

  async function handleApplyDiscount() {
    if (!order?.lines.length || !discountValue) return;
    setSyncing(true);
    setError(null);
    try {
      const current = order ?? (await ensureOrder());
      if (!current) return;
      const updated = await withAuth((client) =>
        client.applyOrderDiscount(current.id, {
          scope: 'ORDER',
          type: discountType,
          value: discountValue,
        }),
      );
      setOrder(updated);
      toast('Discount applied', 'success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply discount');
    } finally {
      setSyncing(false);
    }
  }

  async function handleClearDiscount() {
    if (!order) return;
    setSyncing(true);
    try {
      const updated = await withAuth((client) => client.clearOrderDiscount(order.id));
      setOrder(updated);
      setDiscountValue('');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to clear discount', 'error');
    } finally {
      setSyncing(false);
    }
  }

  async function completePayment(
    payments: Array<{ method: 'CASH' | 'CARD' | 'CORPORATE' | 'OTHER'; amount: string; reference?: string }>,
  ) {
    if (!order?.lines.length) return;
    setPaying(true);
    setPayError(null);
    setStockErrors([]);
    setPaySuccess(null);

    try {
      await waitForCartSync();

      const validationError = validateRegisterCustomer();
      if (validationError) {
        setPayError(validationError);
        return;
      }

      const customerKey = hashRegisterCustomer(registerCustomer);
      if (customerKey !== customerSyncedRef.current) {
        await syncCustomer(order.id);
      }

      const latestOrder = useCartStore.getState().order ?? order;
      const points = loyaltyPointsRedeem ? parseInt(loyaltyPointsRedeem, 10) : undefined;
      const result = await withAuth((client) =>
        client.payOrder(latestOrder.id, {
          payments,
          idempotencyKey: crypto.randomUUID(),
          loyaltyPointsRedeem: points && points > 0 ? points : undefined,
          giftCardCode: giftCardCode || undefined,
        }),
      );

      setOrder({
        ...latestOrder,
        status: result.order.status,
        cogsTotal: result.order.cogsTotal,
        paidAt: result.order.paidAt,
      });

      setPaySuccess(`Paid — Order #${result.order.orderNumber}`);
      toast('Payment complete', 'success');
      printReceipt(result);
      invalidateOrderQueries();
      setShowSplitPay(false);

      setTimeout(() => {
        setOrder(null);
        setPaySuccess(null);
        resetRegisterCustomer();
        setLoyaltyPointsRedeem('');
        setGiftCardCode('');
        setOrderType('COUNTER');
        setDiscountValue('');
      }, 3000);
    } catch (err) {
      if (
        err instanceof ApiError &&
        err.body.status === 409 &&
        isStockShortageErrors(err.body.errors)
      ) {
        setStockErrors(err.body.errors);
        invalidateMenuCatalog();
      } else {
        setPayError(err instanceof Error ? err.message : 'Payment failed');
      }
    } finally {
      setPaying(false);
    }
  }
  async function handlePay(method: 'CASH' | 'CARD') {
    const latestOrder = useCartStore.getState().order;
    if (!latestOrder?.lines.length) return;
    await completePayment([{ method, amount: latestOrder.total }]);
  }

  async function handlePayWithGiftCard() {
    const latestOrder = useCartStore.getState().order;
    if (!latestOrder?.lines.length || !giftCardCode) return;
    await completePayment([
      { method: 'OTHER', amount: latestOrder.total, reference: giftCardCode },
    ]);
  }

  async function handleSplitPayConfirm(payments: SplitPaymentRow[]) {
    await completePayment(payments);
  }

  async function handlePayLater() {
    if (!order?.lines.length) return;
    setPaying(true);
    setPayError(null);
    setStockErrors([]);
    setPaySuccess(null);

    try {
      await waitForCartSync();

      const validationError = validateRegisterCustomer();
      if (validationError) {
        setPayError(validationError);
        return;
      }

      const customerKey = hashRegisterCustomer(registerCustomer);
      if (customerKey !== customerSyncedRef.current) {
        await syncCustomer(order.id);
      }

      const latestOrder = useCartStore.getState().order ?? order;
      const result = await withAuth((client) => client.deferOrder(latestOrder.id));

      setOrder({
        ...latestOrder,
        status: result.order.status,
        cogsTotal: result.order.cogsTotal,
        deferredAt: result.order.deferredAt,
        customerName: result.order.customerName ?? (registerCustomer.customerName || null),
        customerDepartment: result.order.customerDepartment ?? (registerCustomer.customerDepartment || null),
        guestName: result.order.guestName ?? null,
        billingParty: result.order.billingParty ?? registerCustomer.billingParty,
      });

      setPaySuccess(
        `Order #${result.order.orderNumber} sent to kitchen · payment pending`,
      );
      toast('Sent to kitchen — collect payment later', 'success');
      invalidateOrderQueries();

      setTimeout(() => {
        setOrder(null);
        setPaySuccess(null);
        resetRegisterCustomer();
      }, 3000);
    } catch (err) {
      if (
        err instanceof ApiError &&
        err.body.status === 409 &&
        isStockShortageErrors(err.body.errors)
      ) {
        setStockErrors(err.body.errors);
        invalidateMenuCatalog();
      } else {
        setPayError(err instanceof Error ? err.message : 'Could not send to kitchen');
      }
    } finally {
      setPaying(false);
    }
  }

  if ((bootstrapLoading && !catalog) || !bootstrap) {
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
          <h1 className="text-xl font-semibold text-ink">Start your shift</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Count the cash in the drawer, then tap Start shift
          </p>
          <div className="mt-4 space-y-3">
            <Input
              label="Starting cash in drawer (QAR)"
              value={openingFloat}
              onChange={(e) => setOpeningFloat(e.target.value)}
            />
            <Button variant="primary" size="lg" className="w-full" onClick={handleOpenShift}>
              Start shift
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-ink">Register</h1>
            <p className="text-sm text-ink-muted">
              {order ? `Order #${order.orderNumber}` : 'New order'}
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-success/30 bg-success-muted px-3 py-1.5">
            <span className="h-2 w-2 rounded-full bg-success" aria-hidden />
            <span className="text-xs font-semibold text-success">Shift open</span>
            {currentShift?.openingFloat ? (
              <span className="text-xs text-ink-muted">
                · Float {currentShift.openingFloat} QAR
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-border bg-surface-raised p-0.5">
            {ORDER_TYPES.map((type) => (
              <button
                key={type.value}
                type="button"
                disabled={Boolean(order && (order.status === 'PAID' || order.status === 'PENDING_PAYMENT' || order.deferredAt))}
                onClick={() => setOrderType(type.value)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  orderType === type.value
                    ? 'bg-brand text-brand-foreground'
                    : 'text-ink-secondary hover:bg-surface-sunken disabled:opacity-50'
                }`}
              >
                {type.label}
              </button>
            ))}
          </div>
          <Button variant="ghost" size="sm" onClick={() => setShowCloseShift(true)}>
            Close shift
          </Button>
        </div>
      </div>

      {paySuccess ? <Alert variant="success">{paySuccess}</Alert> : null}
      {error ? <Alert variant="error">{error}</Alert> : null}

      <RegisterTips />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="flex flex-wrap gap-2">
            {catalog?.categories.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => setActiveCategoryId(category.id)}
                className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-all duration-150 ${
                  activeCategory?.id === category.id
                    ? 'bg-brand text-brand-foreground shadow-soft'
                    : 'border border-border bg-surface-raised text-ink-secondary hover:bg-surface-sunken'
                }`}
              >
                <span>{getCategoryIcon(category.name)}</span>
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
                disabled={isOrderLocked || isPaying}
              />
            ) : (
              <p className="text-sm text-ink-muted">Loading menu…</p>
            )}
          </div>
        </div>

        <CartPanel
          order={order}
          isSyncing={isSyncing}
          isPaying={isPaying}
          payError={payError}
          stockErrors={stockErrors}
          registerCustomer={registerCustomer}
          onRegisterCustomerChange={handleRegisterCustomerChange}
          loyaltyPointsBalance={loyaltyPointsBalance}
          loyaltyPointsRedeem={loyaltyPointsRedeem}
          giftCardCode={giftCardCode}
          discountType={discountType}
          discountValue={discountValue}
          onLoyaltyPointsRedeemChange={setLoyaltyPointsRedeem}
          onGiftCardCodeChange={setGiftCardCode}
          onDiscountTypeChange={setDiscountType}
          onDiscountValueChange={setDiscountValue}
          onApplyDiscount={handleApplyDiscount}
          onClearDiscount={handleClearDiscount}
          onClear={handleClear}
          onPay={handlePay}
          onSplitPay={() => setShowSplitPay(true)}
          onPayWithGiftCard={handlePayWithGiftCard}
          onPayLater={handlePayLater}
          onUpdateQuantity={handleUpdateQuantity}
          onRemoveLine={handleRemoveLine}
        />
      </div>

      {pending ? (
        <ModifierSheet
          item={pending.item}
          onClose={() => setPending(null)}
          onAdd={(payload) => {
            setPending(null);
            void addLine({
              menuItemId: pending.item.id,
              sizeId: payload.sizeId,
              quantity: 1,
              modifierIds: payload.modifierIds,
              notes: payload.notes,
            });
          }}
        />
      ) : null}

      {showSplitPay && order?.lines.length ? (
        <SplitPaySheet
          order={order}
          isSyncing={isPaying}
          onClose={() => setShowSplitPay(false)}
          onConfirm={handleSplitPayConfirm}
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

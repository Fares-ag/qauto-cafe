'use client';

import type { Order } from '@qauto/shared-types';
import { Alert, ActionTile, Button, Card, CollapsibleSection, Input, StatusBadge } from '@qauto/ui';
import {
  RegisterCustomerPanel,
  type RegisterCustomerValue,
} from '@/components/RegisterCustomerPanel';

interface CartPanelProps {
  order: Order | null;
  isSyncing: boolean;
  payError: string | null;
  stockErrors: Array<{ ingredientName: string; required: string; available: string; uom: string }>;
  registerCustomer: RegisterCustomerValue;
  onRegisterCustomerChange: (value: RegisterCustomerValue) => void;
  loyaltyPointsBalance: number;
  loyaltyPointsRedeem: string;
  giftCardCode: string;
  discountType: 'PERCENTAGE' | 'FIXED_AMOUNT';
  discountValue: string;
  onLoyaltyPointsRedeemChange: (value: string) => void;
  onGiftCardCodeChange: (value: string) => void;
  onDiscountTypeChange: (value: 'PERCENTAGE' | 'FIXED_AMOUNT') => void;
  onDiscountValueChange: (value: string) => void;
  onApplyDiscount: () => void;
  onClearDiscount: () => void;
  onClear: () => void;
  onPay: (method: 'CASH' | 'CARD') => void;
  onSplitPay: () => void;
  onPayWithGiftCard: () => void;
  onPayLater: () => void;
  onUpdateQuantity: (lineIndex: number, quantity: number) => void;
  onRemoveLine: (lineIndex: number) => void;
}

export function CartPanel({
  order,
  isSyncing,
  payError,
  stockErrors,
  registerCustomer,
  onRegisterCustomerChange,
  loyaltyPointsBalance,
  loyaltyPointsRedeem,
  giftCardCode,
  discountType,
  discountValue,
  onLoyaltyPointsRedeemChange,
  onGiftCardCodeChange,
  onDiscountTypeChange,
  onDiscountValueChange,
  onApplyDiscount,
  onClearDiscount,
  onClear,
  onPay,
  onSplitPay,
  onPayWithGiftCard,
  onPayLater,
  onUpdateQuantity,
  onRemoveLine,
}: CartPanelProps) {
  const isLocked =
    order?.status === 'PAID' ||
    order?.status === 'PENDING_PAYMENT' ||
    Boolean(order?.deferredAt);

  const hasDiscount = order?.discounts && order.discounts.length > 0;

  return (
    <Card className="flex h-full flex-col lg:sticky lg:top-6" padding="lg">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-ink">
            {order ? `Order #${order.orderNumber}` : 'New order'}
          </h2>
          {isLocked ? (
            <div className="mt-1">
              <StatusBadge status={order?.status ?? 'PAID'} />
            </div>
          ) : null}
        </div>
        {order?.lines.length && !isLocked ? (
          <Button variant="ghost" size="sm" onClick={onClear}>
            Clear
          </Button>
        ) : null}
      </div>

      {!isLocked ? (
        <RegisterCustomerPanel
          value={registerCustomer}
          onChange={onRegisterCustomerChange}
          disabled={isSyncing}
        />
      ) : null}

      {!isLocked && (order?.customerName || order?.customerDepartment) ? (
        <div className="mb-4 mt-3 rounded-lg bg-surface-sunken px-3 py-2 text-sm">
          {order?.billingParty === 'DEPARTMENT' ? (
            <>
              <p className="font-medium text-ink">
                Guest: {order.guestName || order.customerName || 'Office guest'}
              </p>
              <p className="text-ink-muted">Bill to {order.customerDepartment}</p>
            </>
          ) : (
            <>
              {order?.customerName ? <p className="font-medium text-ink">{order.customerName}</p> : null}
              {order?.customerDepartment ? (
                <p className="text-ink-muted">{order.customerDepartment}</p>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      <div className="mt-4 flex-1 space-y-2 overflow-y-auto">
        {!order?.lines.length ? (
          <p className="py-6 text-center text-sm text-ink-muted">Tap a drink to start</p>
        ) : null}
        {order?.lines.map((line, index) => (
          <div
            key={line.id}
            className="rounded-lg border border-border/60 bg-surface-sunken px-3 py-3 transition-colors duration-150"
          >
            <div className="flex justify-between gap-2">
              <p className="font-medium text-ink">
                {line.itemName}
                {line.sizeName ? ` (${line.sizeName})` : ''}
              </p>
              <p className="shrink-0 font-semibold text-ink">{line.lineTotal} QAR</p>
            </div>
            {parseFloat(line.lineDiscount) > 0 ? (
              <p className="text-xs text-brand">Discount −{line.lineDiscount} QAR</p>
            ) : null}
            {line.modifiers.length > 0 ? (
              <p className="mt-1 text-sm text-ink-muted">
                {line.modifiers.map((m) => m.name).join(', ')}
              </p>
            ) : null}
            {!isLocked ? (
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface-raised text-lg font-medium hover:bg-surface-sunken"
                  onClick={() => onUpdateQuantity(index, Math.max(1, line.quantity - 1))}
                  aria-label="Decrease quantity"
                >
                  −
                </button>
                <span className="min-w-[2rem] text-center text-base font-semibold">{line.quantity}</span>
                <button
                  type="button"
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface-raised text-lg font-medium hover:bg-surface-sunken"
                  onClick={() => onUpdateQuantity(index, line.quantity + 1)}
                  aria-label="Increase quantity"
                >
                  +
                </button>
                <Button variant="ghost" size="sm" className="ml-auto" onClick={() => onRemoveLine(index)}>
                  Remove
                </Button>
              </div>
            ) : (
              <p className="mt-1 text-sm text-ink-muted">{line.quantity}×</p>
            )}
          </div>
        ))}
      </div>

      {stockErrors.length > 0 ? (
        <Alert variant="error" title="Can't make this item" className="mt-3">
          <ul className="mt-1 list-inside list-disc space-y-0.5">
            {stockErrors.map((e) => (
              <li key={e.ingredientName}>
                {e.ingredientName} — sold out
              </li>
            ))}
          </ul>
        </Alert>
      ) : null}

      {payError && !stockErrors.length ? (
        <Alert variant="error" className="mt-3">
          {payError}
        </Alert>
      ) : null}

      <div className="mt-4 border-t border-border pt-4">
        {order?.discountTotal && parseFloat(order.discountTotal) > 0 ? (
          <div className="mb-1 flex justify-between text-sm text-brand">
            <span>Discount</span>
            <span>−{order.discountTotal} QAR</span>
          </div>
        ) : null}
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-medium text-ink-muted">Total</span>
          <span className="text-2xl font-bold tracking-tight text-ink">
            {order?.total ?? '0.0000'} QAR
          </span>
        </div>

        {!isLocked ? (
          <div className="mt-4 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <ActionTile
                label="Cash"
                icon="💵"
                variant="primary"
                disabled={!order?.lines.length}
                loading={isSyncing}
                onClick={() => onPay('CASH')}
              />
              <ActionTile
                label="Card"
                icon="💳"
                variant="accent"
                disabled={!order?.lines.length}
                loading={isSyncing}
                onClick={() => onPay('CARD')}
              />
            </div>

            <Button
              variant="ghost"
              size="lg"
              className="w-full border border-dashed border-border"
              disabled={!order?.lines.length || isSyncing}
              loading={isSyncing}
              onClick={onPayLater}
            >
              Send to kitchen · pay later
            </Button>

            <CollapsibleSection title="More options" icon="➕">
              <div className="space-y-2">
                <Button
                  variant="ghost"
                  size="lg"
                  className="w-full"
                  disabled={!order?.lines.length || isSyncing}
                  onClick={onSplitPay}
                >
                  Split payment
                </Button>
                <Input
                  label="Gift card code"
                  value={giftCardCode}
                  onChange={(e) => onGiftCardCodeChange(e.target.value.toUpperCase())}
                  placeholder="GC-XXXX"
                />
                <Button
                  variant="ghost"
                  size="lg"
                  className="w-full"
                  disabled={!order?.lines.length || isSyncing || !giftCardCode}
                  loading={isSyncing}
                  onClick={onPayWithGiftCard}
                >
                  Pay with gift card
                </Button>
              </div>
            </CollapsibleSection>

            <CollapsibleSection
              title="Discount & loyalty"
              icon="🏷️"
              badge={
                hasDiscount ? (
                  <span className="rounded-full bg-brand-muted px-2 py-0.5 text-[10px] font-semibold text-brand">
                    Applied
                  </span>
                ) : null
              }
            >
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  <select
                    className="rounded-lg border border-border bg-surface px-2 py-2 text-sm"
                    value={discountType}
                    onChange={(e) =>
                      onDiscountTypeChange(e.target.value as 'PERCENTAGE' | 'FIXED_AMOUNT')
                    }
                  >
                    <option value="PERCENTAGE">Percentage %</option>
                    <option value="FIXED_AMOUNT">Fixed QAR</option>
                  </select>
                  <Input
                    value={discountValue}
                    onChange={(e) => onDiscountValueChange(e.target.value)}
                    placeholder={discountType === 'PERCENTAGE' ? '10' : '5.0000'}
                    className="min-w-0 flex-1"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={!discountValue || isSyncing}
                    loading={isSyncing}
                    onClick={onApplyDiscount}
                  >
                    Apply discount
                  </Button>
                  {hasDiscount ? (
                    <Button variant="ghost" size="sm" disabled={isSyncing} onClick={onClearDiscount}>
                      Clear
                    </Button>
                  ) : null}
                </div>
                {loyaltyPointsBalance > 0 ? (
                  <Input
                    label={`Redeem points (max ${loyaltyPointsBalance})`}
                    value={loyaltyPointsRedeem}
                    onChange={(e) => onLoyaltyPointsRedeemChange(e.target.value)}
                    placeholder="100 pts = 1 QAR"
                  />
                ) : null}
                {hasDiscount ? (
                  <p className="text-xs text-ink-muted">
                    Applied: −{order?.discountTotal} QAR
                    {order?.discounts?.[0]?.reason ? ` · ${order.discounts[0].reason}` : ''}
                  </p>
                ) : null}
              </div>
            </CollapsibleSection>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

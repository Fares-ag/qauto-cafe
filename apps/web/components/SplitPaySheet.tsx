'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Order } from '@qauto/shared-types';
import { Button, Card, Input } from '@qauto/ui';

export interface SplitPaymentRow {
  method: 'CASH' | 'CARD' | 'CORPORATE' | 'OTHER';
  amount: string;
  reference?: string;
}

interface SplitPaySheetProps {
  order: Order;
  isSyncing: boolean;
  onClose: () => void;
  onConfirm: (payments: SplitPaymentRow[]) => void;
}

const METHODS: SplitPaymentRow['method'][] = ['CASH', 'CARD', 'CORPORATE', 'OTHER'];

export function SplitPaySheet({ order, isSyncing, onClose, onConfirm }: SplitPaySheetProps) {
  const [rows, setRows] = useState<SplitPaymentRow[]>([
    { method: 'CASH', amount: order.total },
  ]);

  useEffect(() => {
    setRows([{ method: 'CASH', amount: order.total }]);
  }, [order.id, order.total]);

  const allocated = useMemo(
    () => rows.reduce((sum, row) => sum + (parseFloat(row.amount) || 0), 0),
    [rows],
  );
  const orderTotal = parseFloat(order.total);
  const remaining = orderTotal - allocated;
  const isBalanced = Math.abs(remaining) < 0.0001;

  function updateRow(index: number, patch: Partial<SplitPaymentRow>) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function addRow() {
    const remainder = Math.max(0, remaining).toFixed(4);
    setRows((prev) => [...prev, { method: 'CARD', amount: remainder }]);
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center">
      <Card padding="lg" className="w-full max-w-md animate-fade-in">
        <h2 className="text-lg font-semibold text-ink">Split payment</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Order total: {order.total} QAR · Remaining: {remaining.toFixed(4)} QAR
        </p>

        <div className="mt-4 space-y-3">
          {rows.map((row, index) => (
            <div key={index} className="flex flex-wrap items-end gap-2">
              <label className="min-w-[7rem] flex-1 text-sm">
                <span className="mb-1 block text-ink-muted">Method</span>
                <select
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                  value={row.method}
                  onChange={(e) =>
                    updateRow(index, { method: e.target.value as SplitPaymentRow['method'] })
                  }
                >
                  {METHODS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>
              <Input
                label="Amount"
                value={row.amount}
                onChange={(e) => updateRow(index, { amount: e.target.value })}
                className="min-w-[6rem] flex-1"
              />
              {rows.length > 1 ? (
                <Button variant="ghost" size="sm" onClick={() => removeRow(index)}>
                  Remove
                </Button>
              ) : null}
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="ghost" size="sm" onClick={addRow}>
            Add payment
          </Button>
          <Button
            variant="primary"
            className="ml-auto"
            disabled={!isBalanced || isSyncing}
            loading={isSyncing}
            onClick={() => onConfirm(rows)}
          >
            Confirm payment
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </Card>
    </div>
  );
}

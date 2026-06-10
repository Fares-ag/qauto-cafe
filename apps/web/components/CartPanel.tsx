'use client';



import type { Order } from '@qauto/shared-types';

import { Alert, Button, Card, StatusBadge } from '@qauto/ui';



interface CartPanelProps {

  order: Order | null;

  isSyncing: boolean;

  payError: string | null;

  stockErrors: Array<{ ingredientName: string; required: string; available: string; uom: string }>;

  onClear: () => void;

  onPay: (method: 'CASH' | 'CARD') => void;

  onUpdateQuantity: (lineIndex: number, quantity: number) => void;

  onRemoveLine: (lineIndex: number) => void;

}



export function CartPanel({

  order,

  isSyncing,

  payError,

  stockErrors,

  onClear,

  onPay,

  onUpdateQuantity,

  onRemoveLine,

}: CartPanelProps) {

  const isPaid = order?.status === 'PAID';



  return (

    <Card className="flex h-full flex-col lg:sticky lg:top-6" padding="lg">

      <div className="mb-4 flex items-center justify-between">

        <div>

          <h2 className="text-lg font-semibold tracking-tight text-ink">

            {order ? `Order #${order.orderNumber}` : 'New order'}

          </h2>

          {isPaid ? (

            <div className="mt-1">

              <StatusBadge status="PAID" />

            </div>

          ) : null}

        </div>

        {order?.lines.length && !isPaid ? (

          <Button variant="ghost" size="sm" onClick={onClear}>

            Clear

          </Button>

        ) : null}

      </div>



      <div className="flex-1 space-y-2 overflow-y-auto">

        {!order?.lines.length ? (

          <p className="text-sm text-ink-muted">Tap items to build the order</p>

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

              <p className="font-medium text-ink">{line.lineTotal} QAR</p>

            </div>

            {line.modifiers.length > 0 ? (

              <p className="mt-1 text-sm text-ink-muted">

                {line.modifiers.map((m) => m.name).join(', ')}

              </p>

            ) : null}

            {!isPaid ? (

              <div className="mt-2 flex items-center gap-2">

                <button

                  type="button"

                  className="flex h-7 w-7 items-center justify-center rounded border border-border text-sm hover:bg-surface-raised"

                  onClick={() => onUpdateQuantity(index, Math.max(1, line.quantity - 1))}

                >

                  −

                </button>

                <span className="min-w-[1.5rem] text-center text-sm font-medium">{line.quantity}</span>

                <button

                  type="button"

                  className="flex h-7 w-7 items-center justify-center rounded border border-border text-sm hover:bg-surface-raised"

                  onClick={() => onUpdateQuantity(index, line.quantity + 1)}

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

        <Alert variant="error" title="Out of stock" className="mt-3">

          <ul className="mt-1 list-inside list-disc space-y-0.5">

            {stockErrors.map((e) => (

              <li key={e.ingredientName}>

                {e.ingredientName}: need {e.required}

                {e.uom}, have {e.available}

                {e.uom}

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

        <div className="mb-1 flex justify-between text-sm text-ink-muted">

          <span>Subtotal</span>

          <span>{order?.subtotal ?? '0.0000'} QAR</span>

        </div>

        {order?.cogsTotal ? (

          <div className="mb-1 flex justify-between text-sm text-ink-muted">

            <span>COGS</span>

            <span>{order.cogsTotal} QAR</span>

          </div>

        ) : null}

        <div className="flex justify-between text-xl font-semibold tracking-tight text-ink">

          <span>Total</span>

          <span>{order?.total ?? '0.0000'} QAR</span>

        </div>



        {!isPaid ? (

          <div className="mt-4 grid grid-cols-2 gap-2">

            <Button

              variant="primary"

              size="lg"

              disabled={!order?.lines.length || isSyncing}

              loading={isSyncing}

              onClick={() => onPay('CASH')}

            >

              Cash

            </Button>

            <Button

              variant="accent"

              size="lg"

              disabled={!order?.lines.length || isSyncing}

              loading={isSyncing}

              onClick={() => onPay('CARD')}

            >

              Card

            </Button>

          </div>

        ) : null}

      </div>

    </Card>

  );

}



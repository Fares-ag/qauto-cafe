import type { PayOrderResponse } from '@qauto/shared-types';

export function printReceipt(result: PayOrderResponse) {
  const receipt = result.receipt as {
    orderNumber?: number;
    lines?: Array<{ name: string; quantity: number; total: string }>;
    total?: string;
    paidAt?: string;
  } | null;

  const lines = receipt?.lines?.length
    ? receipt.lines
    : result.consumption.map((c) => ({
        name: c.itemName,
        quantity: 1,
        total: c.cogs,
      }));

  const html = `<!DOCTYPE html>
<html><head><title>Receipt #${result.order.orderNumber}</title>
<style>
  body { font-family: monospace; max-width: 280px; margin: 24px auto; }
  h1 { font-size: 16px; text-align: center; }
  .line { display: flex; justify-content: space-between; margin: 4px 0; }
  .total { border-top: 1px dashed #000; margin-top: 12px; padding-top: 8px; font-weight: bold; }
</style></head><body>
  <h1>QAuto Café</h1>
  <p>Order #${result.order.orderNumber}</p>
  <p>${result.order.paidAt ? new Date(result.order.paidAt).toLocaleString() : ''}</p>
  ${lines.map((l) => `<div class="line"><span>${l.quantity}× ${l.name}</span><span>${l.total ?? ''}</span></div>`).join('')}
  <div class="line total"><span>Total</span><span>${result.order.total} QAR</span></div>
  <p style="text-align:center;margin-top:16px">Thank you!</p>
</body></html>`;

  const win = window.open('', '_blank', 'width=320,height=480');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  win.print();
}

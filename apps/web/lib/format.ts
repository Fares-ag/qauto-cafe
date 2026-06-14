export { formatQar } from './api';

export function formatQtyWithUom(qty: string | number, uom: string) {
  const num = typeof qty === 'string' ? parseFloat(qty) : qty;
  if (Number.isNaN(num)) return `0 ${uom}`;
  return `${num.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${uom}`;
}

export function formatDisplayQty(qty: string | number, uom: string) {
  const num = typeof qty === 'string' ? parseFloat(qty) : qty;
  if (Number.isNaN(num)) return `0 ${uom}`;

  if (uom === 'ml' && num >= 1000) {
    return `${(num / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 })} L (${formatQtyWithUom(num, 'ml')})`;
  }
  if (uom === 'g' && num >= 1000) {
    return `${(num / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 })} kg (${formatQtyWithUom(num, 'g')})`;
  }

  return formatQtyWithUom(num, uom);
}

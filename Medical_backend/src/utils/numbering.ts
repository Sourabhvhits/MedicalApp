import type { PrismaTx } from '../database/prisma';
import { dayjs } from './time';

type Sequenced = 'order' | 'purchaseOrder' | 'sale' | 'invoice' | 'payment' | 'purchaseReturn' | 'salesReturn';

const PREFIX: Record<Sequenced, string> = {
  order: 'ORD',
  purchaseOrder: 'PO',
  sale: 'SL',
  invoice: 'INV',
  payment: 'PAY',
  purchaseReturn: 'PR',
  salesReturn: 'SR',
};

/**
 * Human-readable document numbers, e.g. ORD-20260914-000123.
 * The daily counter is derived inside the caller's transaction so two
 * concurrent writers cannot produce the same number (the unique index on the
 * column is the final guard and the caller retries on conflict).
 */
export async function nextDocumentNumber(tx: PrismaTx, kind: Sequenced): Promise<string> {
  const prefix = PREFIX[kind];
  const stamp = dayjs().format('YYYYMMDD');
  const like = `${prefix}-${stamp}-%`;

  const counts: Record<Sequenced, () => Promise<number>> = {
    order: () => tx.order.count({ where: { orderNumber: { startsWith: `${prefix}-${stamp}-` } } }),
    purchaseOrder: () => tx.purchaseOrder.count({ where: { poNumber: { startsWith: `${prefix}-${stamp}-` } } }),
    sale: () => tx.sale.count({ where: { saleNumber: { startsWith: `${prefix}-${stamp}-` } } }),
    invoice: () => tx.invoice.count({ where: { invoiceNumber: { startsWith: `${prefix}-${stamp}-` } } }),
    payment: () => tx.payment.count({ where: { paymentNumber: { startsWith: `${prefix}-${stamp}-` } } }),
    purchaseReturn: () => tx.purchaseReturn.count({ where: { returnNumber: { startsWith: `${prefix}-${stamp}-` } } }),
    salesReturn: () => tx.salesReturn.count({ where: { returnNumber: { startsWith: `${prefix}-${stamp}-` } } }),
  };

  void like;
  const used = await counts[kind]();
  return `${prefix}-${stamp}-${String(used + 1).padStart(6, '0')}`;
}

/** Short business codes such as VEN-000045 / RET-000012 / CUS-000101. */
export function entityCode(prefix: 'VEN' | 'RET' | 'CUS' | 'WH', sequence: number): string {
  return `${prefix}-${String(sequence).padStart(6, '0')}`;
}

export function skuFromName(name: string, sequence: number): string {
  const letters = name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6) || 'PROD';
  return `${letters}-${String(sequence).padStart(6, '0')}`;
}

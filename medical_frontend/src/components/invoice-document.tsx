'use client';

import { currency, formatDate } from '@/lib/utils';
import { Card } from '@/components/ui';
import { PaymentStatusBadge } from '@/components/ui/status';

export interface InvoiceLine {
  id: string;
  productName: string;
  quantity: number;
  unitPrice: string;
  gstRate: string;
  taxableAmount: string;
  taxAmount: string;
  totalAmount: string;
  batchNumber?: string | null;
  expiryDate?: string | null;
}

export interface InvoiceDocumentData {
  invoiceNumber: string;
  invoiceDate: string;
  billToName: string | null;
  billToGst: string | null;
  billToAddress: string | null;
  taxableAmount: string;
  cgstAmount: string;
  sgstAmount: string;
  igstAmount: string;
  totalAmount: string;
  status: string;
  order?: { orderNumber: string; items?: InvoiceLine[] } | null;
  purchaseOrder?: { poNumber: string; items?: InvoiceLine[] } | null;
  vendor?: { businessName: string; gstNumber: string | null; addressLine1: string | null; city: string | null; drugLicenseNumber: string | null } | null;
  retailer?: { storeName: string; gstNumber: string | null; addressLine1: string | null; city: string | null; drugLicenseNumber: string | null } | null;
}

/** Printable GST tax-invoice layout — shared by the vendor/retailer invoice list and the customer order detail page. */
export function InvoiceDocument({ invoice }: { invoice: InvoiceDocumentData }) {
  const lines = invoice.order?.items ?? invoice.purchaseOrder?.items ?? [];
  const seller = invoice.vendor ?? invoice.retailer;
  const sellerName = invoice.vendor?.businessName ?? invoice.retailer?.storeName;

  return (
    <article className="space-y-5 text-sm">
      <header className="flex flex-wrap justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-ink-900">{sellerName}</h2>
          <p className="text-xs text-ink-500">
            {[seller?.addressLine1, seller?.city].filter(Boolean).join(', ')}
          </p>
          {seller?.gstNumber ? <p className="text-xs text-ink-500">GSTIN: {seller.gstNumber}</p> : null}
          {seller?.drugLicenseNumber ? (
            <p className="text-xs text-ink-500">DL: {seller.drugLicenseNumber}</p>
          ) : null}
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-ink-500">Tax invoice</p>
          <p className="font-mono text-sm font-semibold text-ink-900">{invoice.invoiceNumber}</p>
          <p className="text-xs text-ink-500">{formatDate(invoice.invoiceDate)}</p>
          <PaymentStatusBadge status={invoice.status} />
        </div>
      </header>

      <div className="rounded-lg bg-ink-50 px-3 py-2">
        <p className="text-xs uppercase tracking-wide text-ink-500">Billed to</p>
        <p className="font-medium text-ink-900">{invoice.billToName ?? '—'}</p>
        {invoice.billToGst ? <p className="text-xs text-ink-500">GSTIN: {invoice.billToGst}</p> : null}
        {invoice.billToAddress ? <p className="text-xs text-ink-500">{invoice.billToAddress}</p> : null}
      </div>

      {lines.length > 0 ? (
        <Card padded={false} className="overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-ink-50">
              <tr className="border-b border-ink-200">
                <th className="px-3 py-2 text-left font-semibold uppercase text-ink-500">Item</th>
                <th className="px-3 py-2 text-right font-semibold uppercase text-ink-500">Qty</th>
                <th className="px-3 py-2 text-right font-semibold uppercase text-ink-500">Rate</th>
                <th className="px-3 py-2 text-right font-semibold uppercase text-ink-500">Taxable</th>
                <th className="px-3 py-2 text-right font-semibold uppercase text-ink-500">GST</th>
                <th className="px-3 py-2 text-right font-semibold uppercase text-ink-500">Total</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.id} className="border-b border-ink-100 last:border-0">
                  <td className="px-3 py-2">
                    <p className="font-medium text-ink-800">{line.productName}</p>
                    {line.batchNumber ? (
                      <p className="font-mono text-[11px] text-ink-500">
                        Batch {line.batchNumber}
                        {line.expiryDate ? ` · exp ${formatDate(line.expiryDate, 'MM/yyyy')}` : ''}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{line.quantity}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{currency(line.unitPrice)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{currency(line.taxableAmount)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {currency(line.taxAmount)}
                    <span className="ml-1 text-ink-400">({Number(line.gstRate)}%)</span>
                  </td>
                  <td className="px-3 py-2 text-right font-medium tabular-nums">{currency(line.totalAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : null}

      <dl className="ml-auto max-w-xs space-y-1">
        <div className="flex justify-between">
          <dt className="text-ink-500">Taxable value</dt>
          <dd className="tabular-nums">{currency(invoice.taxableAmount)}</dd>
        </div>
        {Number(invoice.cgstAmount) > 0 ? (
          <>
            <div className="flex justify-between">
              <dt className="text-ink-500">CGST</dt>
              <dd className="tabular-nums">{currency(invoice.cgstAmount)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-500">SGST</dt>
              <dd className="tabular-nums">{currency(invoice.sgstAmount)}</dd>
            </div>
          </>
        ) : null}
        {Number(invoice.igstAmount) > 0 ? (
          <div className="flex justify-between">
            <dt className="text-ink-500">IGST</dt>
            <dd className="tabular-nums">{currency(invoice.igstAmount)}</dd>
          </div>
        ) : null}
        <div className="flex justify-between border-t border-ink-200 pt-1 text-base font-semibold">
          <dt>Total</dt>
          <dd className="tabular-nums">{currency(invoice.totalAmount)}</dd>
        </div>
      </dl>
    </article>
  );
}

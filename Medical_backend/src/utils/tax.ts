import { Prisma } from '@prisma/client';
import { D, round2 } from './money';
import type { Numeric } from './money';

export interface LineTax {
  grossAmount: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  taxableAmount: Prisma.Decimal;
  taxAmount: Prisma.Decimal;
  cgstAmount: Prisma.Decimal;
  sgstAmount: Prisma.Decimal;
  igstAmount: Prisma.Decimal;
  totalAmount: Prisma.Decimal;
}

export interface LineTaxInput {
  unitPrice: Numeric;
  quantity: number;
  gstRate: Numeric;
  discountPct?: Numeric;
  /**
   * true  — unitPrice already contains GST (retail / MRP-based selling).
   * false — GST is added on top (wholesale vendor -> retailer invoicing).
   */
  priceIncludesTax: boolean;
  /** Inter-state supply uses IGST instead of CGST + SGST. */
  interState?: boolean;
}

/**
 * Single source of truth for GST maths. Used by carts, customer orders,
 * purchase orders, sales and invoices so totals can never drift apart.
 */
export function computeLineTax(input: LineTaxInput): LineTax {
  const qty = D(input.quantity);
  const gstRate = D(input.gstRate ?? 0);
  const discountPct = D(input.discountPct ?? 0);

  const gross = round2(D(input.unitPrice).mul(qty));
  const discountAmount = round2(gross.mul(discountPct).div(100));
  const netAmount = gross.sub(discountAmount);

  let taxableAmount: Prisma.Decimal;
  let taxAmount: Prisma.Decimal;
  let totalAmount: Prisma.Decimal;

  if (input.priceIncludesTax) {
    taxableAmount = round2(netAmount.mul(100).div(D(100).add(gstRate)));
    taxAmount = round2(netAmount.sub(taxableAmount));
    totalAmount = round2(netAmount);
  } else {
    taxableAmount = round2(netAmount);
    taxAmount = round2(taxableAmount.mul(gstRate).div(100));
    totalAmount = round2(taxableAmount.add(taxAmount));
  }

  const interState = input.interState ?? false;
  const half = round2(taxAmount.div(2));

  return {
    grossAmount: gross,
    discountAmount,
    taxableAmount,
    taxAmount,
    cgstAmount: interState ? D(0) : half,
    sgstAmount: interState ? D(0) : round2(taxAmount.sub(half)),
    igstAmount: interState ? taxAmount : D(0),
    totalAmount,
  };
}

export function aggregateTax(lines: LineTax[]) {
  const zero = D(0);
  return lines.reduce(
    (acc, line) => ({
      subtotal: acc.subtotal.add(line.grossAmount),
      discountAmount: acc.discountAmount.add(line.discountAmount),
      taxableAmount: acc.taxableAmount.add(line.taxableAmount),
      taxAmount: acc.taxAmount.add(line.taxAmount),
      cgstAmount: acc.cgstAmount.add(line.cgstAmount),
      sgstAmount: acc.sgstAmount.add(line.sgstAmount),
      igstAmount: acc.igstAmount.add(line.igstAmount),
      totalAmount: acc.totalAmount.add(line.totalAmount),
    }),
    {
      subtotal: zero,
      discountAmount: zero,
      taxableAmount: zero,
      taxAmount: zero,
      cgstAmount: zero,
      sgstAmount: zero,
      igstAmount: zero,
      totalAmount: zero,
    },
  );
}

/** GST is inter-state when the two GSTINs start with different state codes. */
export function isInterState(sellerGst?: string | null, buyerGst?: string | null): boolean {
  if (!sellerGst || !buyerGst || sellerGst.length < 2 || buyerGst.length < 2) return false;
  return sellerGst.slice(0, 2) !== buyerGst.slice(0, 2);
}

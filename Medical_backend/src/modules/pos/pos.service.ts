import { prisma } from '../../database/prisma';
import { ApiError } from '../../utils/ApiError';
import { D, round2 } from '../../utils/money';
import { aggregateTax, computeLineTax } from '../../utils/tax';
import { nextDocumentNumber } from '../../utils/numbering';
import * as inventory from '../inventory/inventory.service';
import { RETAIL_PRICE_INCLUDES_TAX } from '../customers/cart.service';

export interface PosSaleInput {
  customerName?: string;
  customerPhone?: string;
  paymentMode: 'CASH' | 'UPI' | 'CARD' | 'NET_BANKING' | 'CHEQUE' | 'BANK_TRANSFER';
  items: { productId: string; quantity: number }[];
}

/**
 * Walk-in counter sale (TASKS.md #14) — no customer account, no cart, no
 * pickup slot, but still priced off the store's real catalogue
 * (`RetailerProduct`, same source `cart.service.ts`/`checkout()` use for an
 * online order) and consumed FEFO through the same `inventory.stockOut()`
 * every other direct stock-out (damage, expiry write-off) already uses —
 * a POS sale is not a second, looser stock/pricing path.
 */
export async function createPosSale(retailerId: string, input: PosSaleInput, userId: string) {
  const productIds = input.items.map((item) => item.productId);
  const listings = await prisma.retailerProduct.findMany({
    where: { retailerId, productId: { in: productIds }, status: 'ACTIVE', deletedAt: null },
    include: { product: { select: { id: true, name: true, status: true, isRecalled: true } } },
  });
  const listingByProduct = new Map(listings.map((listing) => [listing.productId, listing]));

  const lines = input.items.map((item) => {
    const listing = listingByProduct.get(item.productId);
    if (!listing) throw ApiError.badRequest('One of the selected products is not sold by this store');
    if (listing.product.status !== 'ACTIVE' || listing.product.isRecalled) {
      throw ApiError.badRequest(`${listing.product.name} has been blocked or recalled`);
    }
    const tax = computeLineTax({
      unitPrice: listing.sellingPrice,
      quantity: item.quantity,
      gstRate: listing.gstRate,
      discountPct: listing.discountPct,
      priceIncludesTax: RETAIL_PRICE_INCLUDES_TAX,
    });
    return { productId: item.productId, quantity: item.quantity, listing, tax };
  });
  const totals = aggregateTax(lines.map((line) => line.tax));

  const sale = await prisma.$transaction(async (tx) => {
    // Search every warehouse this store has, not just the default one — a
    // multi-location shop's stock for this product may sit anywhere.
    const warehouseIds = await inventory.listActiveWarehouseIds(tx, { ownerType: 'RETAILER', retailerId });

    let costAmount = D(0);
    const saleItems = [];
    for (const line of lines) {
      const allocations = await inventory.stockOut(
        tx,
        { ownerType: 'RETAILER', retailerId },
        warehouseIds,
        line.productId,
        line.quantity,
        'SALE',
        { referenceType: 'POS_SALE', performedById: userId },
      );
      const itemCost = allocations.reduce(
        (sum, allocation) => sum.add(D(allocation.purchasePrice).mul(allocation.quantity)),
        D(0),
      );
      costAmount = costAmount.add(itemCost);

      saleItems.push({
        productId: line.productId,
        productName: line.listing.product.name,
        batchNumber: allocations.map((allocation) => allocation.batchNumber).join(', ') || null,
        quantity: line.quantity,
        unitPrice: line.listing.sellingPrice,
        costPrice: line.quantity > 0 ? round2(itemCost.div(line.quantity)) : D(0),
        discountAmount: line.tax.discountAmount,
        gstRate: line.listing.gstRate,
        taxableAmount: line.tax.taxableAmount,
        taxAmount: line.tax.taxAmount,
        totalAmount: line.tax.totalAmount,
      });
    }

    const saleNumber = await nextDocumentNumber(tx, 'sale');
    const created = await tx.sale.create({
      data: {
        saleNumber,
        retailerId,
        customerName: input.customerName || 'Walk-in customer',
        customerPhone: input.customerPhone || null,
        subtotal: round2(totals.subtotal),
        discountAmount: round2(totals.discountAmount),
        taxableAmount: round2(totals.taxableAmount),
        taxAmount: round2(totals.taxAmount),
        totalAmount: round2(totals.totalAmount),
        costAmount: round2(costAmount),
        paymentMode: input.paymentMode,
        paymentStatus: 'PAID',
        items: { create: saleItems },
      },
      include: { items: true },
    });

    const invoiceNumber = await nextDocumentNumber(tx, 'invoice');
    await tx.invoice.create({
      data: {
        invoiceNumber,
        type: 'SALES',
        ownerType: 'RETAILER',
        retailerId,
        billToName: input.customerName || 'Walk-in customer',
        subtotal: round2(totals.subtotal),
        discountAmount: round2(totals.discountAmount),
        taxableAmount: round2(totals.taxableAmount),
        cgstAmount: round2(totals.cgstAmount),
        sgstAmount: round2(totals.sgstAmount),
        igstAmount: round2(totals.igstAmount),
        totalAmount: round2(totals.totalAmount),
        paidAmount: round2(totals.totalAmount),
        status: 'PAID',
      },
    });

    await tx.financeTransaction.create({
      data: {
        ownerType: 'RETAILER',
        retailerId,
        type: 'SALE',
        direction: 'IN',
        amount: round2(totals.totalAmount),
        taxAmount: round2(totals.taxAmount),
        referenceType: 'SALE',
        referenceId: created.id,
        partyName: input.customerName || 'Walk-in customer',
        description: `Counter sale ${saleNumber}`,
      },
    });

    return created;
  });

  return sale;
}

export async function searchSellableProducts(retailerId: string, search: string) {
  return prisma.retailerProduct.findMany({
    where: {
      retailerId,
      status: 'ACTIVE',
      deletedAt: null,
      product: {
        status: 'ACTIVE',
        isRecalled: false,
        // Also matched against SKU (not just name) so a barcode/QR scan —
        // which resolves to the SKU, not a readable name — can find the
        // product (TASKS.md #29).
        ...(search
          ? { OR: [{ name: { contains: search } }, { sku: { contains: search } }] }
          : {}),
      },
    },
    include: { product: { select: { id: true, name: true, sku: true, packSize: true, imageUrl: true } } },
    take: 20,
    orderBy: { product: { name: 'asc' } },
  });
}

import type { Prisma, PurchaseOrderStatus } from '@prisma/client';
import { prisma, type PrismaTx } from '../../database/prisma';
import { ApiError } from '../../utils/ApiError';
import { buildMeta } from '../../utils/response';
import { getPagination } from '../../utils/pagination';
import { D, round2, toNumber } from '../../utils/money';
import { aggregateTax, computeLineTax, isInterState } from '../../utils/tax';
import { nextDocumentNumber } from '../../utils/numbering';
import { endOfDay, startOfDay, toDateOnly } from '../../utils/time';
import { PURCHASE_ORDER_TRANSITIONS, NOTIFICATION_EVENTS } from '../../config/constants';
import { notify, notifyBackInStock } from '../notifications/notification.service';
import * as inventory from '../inventory/inventory.service';
import { outstandingBalance } from '../vendors/vendor.service';

/** Wholesale prices are quoted exclusive of GST. */
const WHOLESALE_PRICE_INCLUDES_TAX = false;

const DETAIL_INCLUDE = {
  vendor: {
    select: { id: true, businessName: true, code: true, phone: true, email: true, gstNumber: true, city: true, state: true, addressLine1: true },
  },
  retailer: {
    select: { id: true, storeName: true, code: true, phone: true, email: true, gstNumber: true, city: true, state: true, addressLine1: true },
  },
  items: {
    include: {
      product: { select: { id: true, name: true, sku: true, packSize: true, hsnCode: true, imageUrl: true } },
    },
  },
  invoice: true,
  payments: { orderBy: { paidAt: 'desc' as const } },
} satisfies Prisma.PurchaseOrderInclude;

export async function getPurchaseOrder(id: string, scope?: { vendorId?: string; retailerId?: string }) {
  const order = await prisma.purchaseOrder.findFirst({
    where: {
      id,
      ...(scope?.vendorId ? { vendorId: scope.vendorId } : {}),
      ...(scope?.retailerId ? { retailerId: scope.retailerId } : {}),
    },
    include: DETAIL_INCLUDE,
  });
  if (!order) throw ApiError.notFound('Purchase order not found');
  return order;
}

export async function listPurchaseOrders(
  scope: { vendorId?: string; retailerId?: string },
  query: Record<string, unknown>,
) {
  const { page, limit, skip, take } = getPagination(query);

  const where: Prisma.PurchaseOrderWhereInput = {
    ...(scope.vendorId ? { vendorId: scope.vendorId } : {}),
    ...(scope.retailerId ? { retailerId: scope.retailerId } : {}),
    ...(query.status ? { status: query.status as PurchaseOrderStatus } : {}),
    ...(query.vendorId && !scope.vendorId ? { vendorId: query.vendorId as string } : {}),
    ...(query.retailerId && !scope.retailerId ? { retailerId: query.retailerId as string } : {}),
    ...(query.paymentStatus ? { paymentStatus: query.paymentStatus as never } : {}),
  };

  if (query.search) {
    where.OR = [
      { poNumber: { contains: query.search as string } },
      { vendor: { businessName: { contains: query.search as string } } },
      { retailer: { storeName: { contains: query.search as string } } },
    ];
  }

  if (query.dateFrom || query.dateTo) {
    where.createdAt = {
      ...(query.dateFrom ? { gte: startOfDay(query.dateFrom as Date) } : {}),
      ...(query.dateTo ? { lte: endOfDay(query.dateTo as Date) } : {}),
    };
  }

  const [items, total] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where,
      include: {
        vendor: { select: { id: true, businessName: true, code: true } },
        retailer: { select: { id: true, storeName: true, code: true } },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: query.sortOrder === 'asc' ? 'asc' : 'desc' },
      skip,
      take,
    }),
    prisma.purchaseOrder.count({ where }),
  ]);

  return { items, meta: buildMeta(page, limit, total) };
}

// ---------------------------------------------------------------------------
// Create (retailer side)
// ---------------------------------------------------------------------------

export async function createPurchaseOrder(
  retailerId: string,
  input: { vendorId: string; expectedDate?: Date; notes?: string; items: { vendorProductId: string; quantity: number }[] },
) {
  const [retailer, vendor] = await Promise.all([
    prisma.retailer.findUnique({
      where: { id: retailerId },
      select: { id: true, storeName: true, gstNumber: true, approvalStatus: true, isActive: true, userId: true },
    }),
    prisma.vendor.findUnique({
      where: { id: input.vendorId },
      select: { id: true, businessName: true, gstNumber: true, approvalStatus: true, isActive: true, minOrderValue: true, userId: true },
    }),
  ]);

  if (!retailer || retailer.approvalStatus !== 'APPROVED' || !retailer.isActive) {
    throw ApiError.forbidden('Your store must be approved before placing purchase orders');
  }
  if (!vendor || vendor.approvalStatus !== 'APPROVED' || !vendor.isActive) {
    throw ApiError.badRequest('This vendor is not available for orders');
  }

  const vendorProducts = await prisma.vendorProduct.findMany({
    where: {
      id: { in: input.items.map((item) => item.vendorProductId) },
      vendorId: vendor.id,
      status: 'ACTIVE',
      deletedAt: null,
    },
    include: { product: { select: { id: true, name: true, status: true, isRecalled: true } } },
  });

  const byId = new Map(vendorProducts.map((vp) => [vp.id, vp]));
  const interState = isInterState(vendor.gstNumber, retailer.gstNumber);

  const lines = input.items.map((item) => {
    const vendorProduct = byId.get(item.vendorProductId);
    if (!vendorProduct) throw ApiError.badRequest('One or more products are no longer offered by this vendor');
    if (vendorProduct.product.status !== 'ACTIVE' || vendorProduct.product.isRecalled) {
      throw ApiError.badRequest(`${vendorProduct.product.name} is blocked or recalled and cannot be ordered`);
    }
    if (item.quantity < vendorProduct.minOrderQty) {
      throw ApiError.badRequest(
        `${vendorProduct.product.name} has a minimum order quantity of ${vendorProduct.minOrderQty}`,
      );
    }

    const tax = computeLineTax({
      unitPrice: vendorProduct.sellingPrice,
      quantity: item.quantity,
      gstRate: vendorProduct.gstRate,
      discountPct: vendorProduct.discountPct,
      priceIncludesTax: WHOLESALE_PRICE_INCLUDES_TAX,
      interState,
    });

    return { vendorProduct, quantity: item.quantity, tax };
  });

  const totals = aggregateTax(lines.map((line) => line.tax));

  if (toNumber(vendor.minOrderValue) > 0 && totals.totalAmount.lessThan(D(vendor.minOrderValue))) {
    throw ApiError.badRequest(
      `This vendor has a minimum order value of ₹${toNumber(vendor.minOrderValue).toFixed(2)}`,
    );
  }

  const terms = await prisma.vendorRetailerTerms.findUnique({
    where: { vendorId_retailerId: { vendorId: vendor.id, retailerId } },
    select: { creditLimit: true },
  });
  const creditLimit = toNumber(terms?.creditLimit ?? 0);
  if (creditLimit > 0) {
    const outstanding = await outstandingBalance(vendor.id, retailerId);
    if (outstanding + totals.totalAmount.toNumber() > creditLimit) {
      throw ApiError.badRequest(
        `This order would exceed your credit limit with this vendor (₹${creditLimit.toFixed(2)}) — you currently owe ₹${outstanding.toFixed(2)}. Clear some outstanding payments first.`,
      );
    }
  }

  const order = await prisma.$transaction(async (tx) => {
    const poNumber = await nextDocumentNumber(tx, 'purchaseOrder');

    return tx.purchaseOrder.create({
      data: {
        poNumber,
        retailerId,
        vendorId: vendor.id,
        status: 'PLACED',
        expectedDate: input.expectedDate ? toDateOnly(input.expectedDate) : null,
        notes: input.notes ?? null,
        subtotal: totals.subtotal,
        discountAmount: totals.discountAmount,
        taxableAmount: totals.taxableAmount,
        cgstAmount: totals.cgstAmount,
        sgstAmount: totals.sgstAmount,
        igstAmount: totals.igstAmount,
        taxAmount: totals.taxAmount,
        totalAmount: totals.totalAmount,
        items: {
          create: lines.map((line) => ({
            productId: line.vendorProduct.productId,
            productName: line.vendorProduct.product.name,
            quantity: line.quantity,
            unitPrice: line.vendorProduct.sellingPrice,
            mrp: line.vendorProduct.mrp,
            discountPct: line.vendorProduct.discountPct,
            discountAmount: line.tax.discountAmount,
            gstRate: line.vendorProduct.gstRate,
            taxableAmount: line.tax.taxableAmount,
            taxAmount: line.tax.taxAmount,
            totalAmount: line.tax.totalAmount,
          })),
        },
      },
      include: DETAIL_INCLUDE,
    });
  });

  await notify({
    userId: vendor.userId,
    event: NOTIFICATION_EVENTS.PURCHASE_ORDER_PLACED,
    title: 'New purchase order',
    body: `${retailer.storeName} placed purchase order ${order.poNumber} worth ₹${toNumber(order.totalAmount).toFixed(2)}.`,
    data: { purchaseOrderId: order.id, poNumber: order.poNumber },
    channels: ['IN_APP', 'EMAIL'],
  });

  return order;
}

// ---------------------------------------------------------------------------
// Status transitions
// ---------------------------------------------------------------------------

function assertTransition(from: PurchaseOrderStatus, to: PurchaseOrderStatus): void {
  if (!PURCHASE_ORDER_TRANSITIONS[from].includes(to)) {
    throw ApiError.badRequest(`A purchase order cannot move from ${from} to ${to}`);
  }
}

/** Vendor accepts, optionally trimming quantities and prices. */
export async function acceptPurchaseOrder(
  vendorId: string,
  id: string,
  input: { items?: { itemId: string; acceptedQty: number; freeQty: number; unitPrice?: number }[]; notes?: string },
) {
  const order = await getPurchaseOrder(id, { vendorId });
  assertTransition(order.status, 'ACCEPTED');

  const interState = isInterState(order.vendor.gstNumber, order.retailer.gstNumber);
  const overrides = new Map((input.items ?? []).map((item) => [item.itemId, item]));

  const updated = await prisma.$transaction(async (tx) => {
    const lines = order.items.map((item) => {
      const override = overrides.get(item.id);
      const acceptedQty = override ? override.acceptedQty : item.quantity;
      const freeQty = override?.freeQty ?? item.freeQty;
      const unitPrice = override?.unitPrice ?? toNumber(item.unitPrice);

      if (acceptedQty > item.quantity) {
        throw ApiError.badRequest(`Accepted quantity for ${item.productName} exceeds the ordered quantity`);
      }

      const tax = computeLineTax({
        unitPrice,
        quantity: acceptedQty,
        gstRate: item.gstRate,
        discountPct: item.discountPct,
        priceIncludesTax: WHOLESALE_PRICE_INCLUDES_TAX,
        interState,
      });

      return { item, acceptedQty, freeQty, unitPrice, tax };
    });

    if (lines.every((line) => line.acceptedQty === 0)) {
      throw ApiError.badRequest('At least one line must be accepted — reject the order instead');
    }

    for (const line of lines) {
      await tx.purchaseOrderItem.update({
        where: { id: line.item.id },
        data: {
          acceptedQty: line.acceptedQty,
          freeQty: line.freeQty,
          unitPrice: D(line.unitPrice),
          discountAmount: line.tax.discountAmount,
          taxableAmount: line.tax.taxableAmount,
          taxAmount: line.tax.taxAmount,
          totalAmount: line.tax.totalAmount,
        },
      });
    }

    const totals = aggregateTax(lines.map((line) => line.tax));

    return tx.purchaseOrder.update({
      where: { id },
      data: {
        status: 'ACCEPTED',
        acceptedAt: new Date(),
        notes: input.notes ?? order.notes,
        subtotal: totals.subtotal,
        discountAmount: totals.discountAmount,
        taxableAmount: totals.taxableAmount,
        cgstAmount: totals.cgstAmount,
        sgstAmount: totals.sgstAmount,
        igstAmount: totals.igstAmount,
        taxAmount: totals.taxAmount,
        totalAmount: totals.totalAmount,
      },
      include: DETAIL_INCLUDE,
    });
  });

  const retailerUser = await prisma.retailer.findUnique({
    where: { id: order.retailerId },
    select: { userId: true },
  });
  if (retailerUser) {
    await notify({
      userId: retailerUser.userId,
      event: NOTIFICATION_EVENTS.PURCHASE_ORDER_ACCEPTED,
      title: 'Purchase order accepted',
      body: `${order.vendor.businessName} accepted purchase order ${order.poNumber}.`,
      data: { purchaseOrderId: id, poNumber: order.poNumber, vendorName: order.vendor.businessName },
      channels: ['IN_APP', 'EMAIL'],
      scope: { vendorId },
    });
  }

  return updated;
}

export async function rejectPurchaseOrder(vendorId: string, id: string, reason: string) {
  const order = await getPurchaseOrder(id, { vendorId });
  assertTransition(order.status, 'REJECTED');

  const updated = await prisma.purchaseOrder.update({
    where: { id },
    data: { status: 'REJECTED', rejectionReason: reason },
    include: DETAIL_INCLUDE,
  });

  const retailer = await prisma.retailer.findUnique({
    where: { id: order.retailerId },
    select: { userId: true },
  });
  if (retailer) {
    await notify({
      userId: retailer.userId,
      event: NOTIFICATION_EVENTS.PURCHASE_ORDER_REJECTED,
      title: 'Purchase order rejected',
      body: `${order.vendor.businessName} rejected purchase order ${order.poNumber}. Reason: ${reason}`,
      data: { purchaseOrderId: id, poNumber: order.poNumber, vendorName: order.vendor.businessName, reason },
      channels: ['IN_APP', 'EMAIL'],
      scope: { vendorId },
    });
  }

  return updated;
}

export async function updateStatus(
  scope: { vendorId?: string; retailerId?: string },
  id: string,
  status: PurchaseOrderStatus,
) {
  const order = await getPurchaseOrder(id, scope);
  assertTransition(order.status, status);

  return prisma.purchaseOrder.update({
    where: { id },
    data: {
      status,
      ...(status === 'DELIVERED' ? { deliveredAt: new Date() } : {}),
    },
    include: DETAIL_INCLUDE,
  });
}

/**
 * Vendor dispatch: records logistics details, stamps batch/expiry onto each
 * line and deducts the vendor's own stock (FEFO) with full transaction trail.
 */
export async function dispatchPurchaseOrder(
  vendorId: string,
  id: string,
  input: {
    dispatchNumber?: string;
    courierName?: string;
    trackingNumber?: string;
    dispatchDate?: Date;
    items: { itemId: string; batchNumber: string; manufacturingDate?: Date; expiryDate: Date }[];
  },
  userId: string,
) {
  const order = await getPurchaseOrder(id, { vendorId });
  assertTransition(order.status, 'DISPATCHED');

  const batchByItem = new Map(input.items.map((item) => [item.itemId, item]));

  const updated = await prisma.$transaction(async (tx) => {
    // Search every warehouse this wholesaler has — a PO's stock isn't
    // necessarily sitting in whichever one happens to be marked default.
    const warehouseIds = await inventory.listActiveWarehouseIds(tx, { ownerType: 'VENDOR', vendorId });

    for (const item of order.items) {
      const shipQty = item.acceptedQty + item.freeQty;
      if (shipQty === 0) continue;

      const batch = batchByItem.get(item.id);
      if (!batch) throw ApiError.badRequest(`Batch details are missing for ${item.productName}`);

      await inventory.stockOut(
        tx,
        { ownerType: 'VENDOR', vendorId },
        warehouseIds,
        item.productId,
        shipQty,
        'SALE',
        { referenceType: 'PURCHASE_ORDER', referenceId: id, performedById: userId },
      );

      await tx.purchaseOrderItem.update({
        where: { id: item.id },
        data: {
          batchNumber: batch.batchNumber,
          manufacturingDate: batch.manufacturingDate ? toDateOnly(batch.manufacturingDate) : null,
          expiryDate: toDateOnly(batch.expiryDate),
        },
      });
    }

    return tx.purchaseOrder.update({
      where: { id },
      data: {
        status: 'DISPATCHED',
        dispatchNumber: input.dispatchNumber ?? null,
        courierName: input.courierName ?? null,
        trackingNumber: input.trackingNumber ?? null,
        dispatchDate: input.dispatchDate ?? new Date(),
      },
      include: DETAIL_INCLUDE,
    });
  });

  await createInvoiceForPurchaseOrder(id);

  const retailer = await prisma.retailer.findUnique({
    where: { id: order.retailerId },
    select: { userId: true },
  });
  if (retailer) {
    await notify({
      userId: retailer.userId,
      event: NOTIFICATION_EVENTS.PURCHASE_ORDER_DISPATCHED,
      title: 'Purchase order dispatched',
      body: `Purchase order ${order.poNumber} has been dispatched${input.courierName ? ` via ${input.courierName}` : ''}.`,
      data: {
        purchaseOrderId: id,
        poNumber: order.poNumber,
        vendorName: order.vendor.businessName,
        trackingNumber: input.trackingNumber ?? '',
        courierName: input.courierName ?? '',
      },
      channels: ['IN_APP', 'EMAIL'],
      scope: { vendorId },
    });
  }

  return updated;
}

/**
 * Retailer receives goods: creates batch-wise stock, the inventory
 * transactions and the payable finance entry in one database transaction.
 */
export async function receivePurchaseOrder(
  retailerId: string,
  id: string,
  input: {
    warehouseId?: string;
    items: {
      itemId: string;
      receivedQty: number;
      freeQty: number;
      batchNumber: string;
      manufacturingDate?: Date;
      expiryDate: Date;
      purchasePrice?: number;
      sellingPrice?: number;
      mrp?: number;
    }[];
    notes?: string;
  },
  userId: string,
) {
  const order = await getPurchaseOrder(id, { retailerId });
  if (!['DISPATCHED', 'DELIVERED'].includes(order.status)) {
    throw ApiError.badRequest('Only dispatched or delivered purchase orders can be received');
  }

  const receiptByItem = new Map(input.items.map((item) => [item.itemId, item]));

  // Snapshot which received products were out of stock BEFORE this receipt,
  // so a back-in-stock alert (TASKS.md #28) only fires on a genuine 0 → positive
  // transition rather than on every restock.
  const receivedProductIds = Array.from(
    new Set(
      order.items
        .filter((item) => {
          const receipt = receiptByItem.get(item.id);
          return receipt && receipt.receivedQty + receipt.freeQty > 0;
        })
        .map((item) => item.productId),
    ),
  );
  const wasOutOfStock = new Map<string, boolean>();
  await Promise.all(
    receivedProductIds.map(async (productId) => {
      wasOutOfStock.set(
        productId,
        (await inventory.totalAvailableQty({ ownerType: 'RETAILER', retailerId }, productId)) <= 0,
      );
    }),
  );

  const result = await prisma.$transaction(async (tx) => {
    const warehouseId = await inventory.resolveWarehouse(
      tx,
      { ownerType: 'RETAILER', retailerId },
      input.warehouseId,
    );

    for (const item of order.items) {
      const receipt = receiptByItem.get(item.id);
      if (!receipt || receipt.receivedQty + receipt.freeQty === 0) continue;

      const expected = item.acceptedQty + item.freeQty;
      if (receipt.receivedQty + receipt.freeQty > expected) {
        throw ApiError.badRequest(
          `Received quantity for ${item.productName} exceeds the dispatched quantity (${expected})`,
        );
      }

      await inventory.stockIn(
        tx,
        { ownerType: 'RETAILER', retailerId },
        warehouseId,
        {
          productId: item.productId,
          batchNumber: receipt.batchNumber,
          quantity: receipt.receivedQty,
          freeQuantity: receipt.freeQty,
          purchasePrice: receipt.purchasePrice ?? toNumber(item.unitPrice),
          sellingPrice: receipt.sellingPrice ?? toNumber(item.mrp),
          mrp: receipt.mrp ?? toNumber(item.mrp),
          gstRate: toNumber(item.gstRate),
          manufacturingDate: receipt.manufacturingDate ?? null,
          expiryDate: receipt.expiryDate,
          supplierName: order.vendor.businessName,
          supplierVendorId: order.vendorId,
        },
        'PURCHASE',
        { referenceType: 'PURCHASE_ORDER', referenceId: id, notes: input.notes, performedById: userId },
      );

      await tx.purchaseOrderItem.update({
        where: { id: item.id },
        data: { receivedQty: receipt.receivedQty },
      });
    }

    // The retailer now owes the vendor for this consignment.
    await tx.financeTransaction.create({
      data: {
        ownerType: 'RETAILER',
        retailerId,
        type: 'PURCHASE',
        direction: 'OUT',
        amount: order.totalAmount,
        taxAmount: order.taxAmount,
        referenceType: 'PURCHASE_ORDER',
        referenceId: id,
        partyName: order.vendor.businessName,
        description: `Purchase order ${order.poNumber}`,
      },
    });

    await tx.financeTransaction.create({
      data: {
        ownerType: 'VENDOR',
        vendorId: order.vendorId,
        type: 'SALE',
        direction: 'IN',
        amount: order.totalAmount,
        taxAmount: order.taxAmount,
        referenceType: 'PURCHASE_ORDER',
        referenceId: id,
        partyName: order.retailer.storeName,
        description: `Purchase order ${order.poNumber}`,
      },
    });

    return tx.purchaseOrder.update({
      where: { id },
      data: { status: 'RECEIVED', receivedAt: new Date() },
      include: DETAIL_INCLUDE,
    });
  });

  await Promise.all(
    receivedProductIds
      .filter((productId) => wasOutOfStock.get(productId))
      .map((productId) => notifyBackInStock(retailerId, productId)),
  );

  return result;
}

export async function cancelPurchaseOrder(retailerId: string, id: string, reason?: string) {
  const order = await getPurchaseOrder(id, { retailerId });
  assertTransition(order.status, 'CANCELLED');

  return prisma.purchaseOrder.update({
    where: { id },
    data: { status: 'CANCELLED', rejectionReason: reason ?? null },
    include: DETAIL_INCLUDE,
  });
}

// ---------------------------------------------------------------------------
// Invoicing & payments
// ---------------------------------------------------------------------------

export async function createInvoiceForPurchaseOrder(purchaseOrderId: string) {
  const existing = await prisma.invoice.findUnique({ where: { purchaseOrderId } });
  if (existing) return existing;

  const order = await prisma.purchaseOrder.findUnique({
    where: { id: purchaseOrderId },
    include: {
      vendor: { select: { id: true, businessName: true } },
      retailer: { select: { storeName: true, gstNumber: true, addressLine1: true, city: true, state: true, pincode: true } },
    },
  });
  if (!order) throw ApiError.notFound('Purchase order not found');

  // Only set when the vendor has fixed payment terms for this retailer
  // (TASKS.md #9) — otherwise `dueDate` stays null, same as before this item.
  const terms = await prisma.vendorRetailerTerms.findUnique({
    where: { vendorId_retailerId: { vendorId: order.vendorId, retailerId: order.retailerId } },
    select: { paymentTermsDays: true },
  });
  const invoiceDate = new Date();
  const dueDate =
    terms && terms.paymentTermsDays > 0
      ? new Date(invoiceDate.getTime() + terms.paymentTermsDays * 24 * 60 * 60 * 1000)
      : null;

  return prisma.$transaction(async (tx) => {
    const invoiceNumber = await nextDocumentNumber(tx, 'invoice');
    return tx.invoice.create({
      data: {
        invoiceNumber,
        type: 'PURCHASE',
        ownerType: 'VENDOR',
        vendorId: order.vendorId,
        purchaseOrderId,
        invoiceDate,
        dueDate,
        billToName: order.retailer.storeName,
        billToGst: order.retailer.gstNumber,
        billToAddress: [order.retailer.addressLine1, order.retailer.city, order.retailer.state, order.retailer.pincode]
          .filter(Boolean)
          .join(', '),
        subtotal: order.subtotal,
        discountAmount: order.discountAmount,
        taxableAmount: order.taxableAmount,
        cgstAmount: order.cgstAmount,
        sgstAmount: order.sgstAmount,
        igstAmount: order.igstAmount,
        totalAmount: order.totalAmount,
        status: 'PENDING',
      },
    });
  });
}

export async function recordPurchasePayment(
  retailerId: string,
  purchaseOrderId: string,
  input: { amount: number; mode: string; referenceNo?: string; paidAt?: Date; notes?: string },
) {
  const order = await getPurchaseOrder(purchaseOrderId, { retailerId });

  const outstanding = round2(D(order.totalAmount).sub(D(order.paidAmount)));
  if (D(input.amount).greaterThan(outstanding)) {
    throw ApiError.badRequest(`Payment exceeds the outstanding amount of ₹${outstanding.toFixed(2)}`);
  }

  return prisma.$transaction(async (tx) => {
    const paymentNumber = await nextDocumentNumber(tx, 'payment');

    const payment = await tx.payment.create({
      data: {
        paymentNumber,
        ownerType: 'RETAILER',
        retailerId,
        purchaseOrderId,
        invoiceId: order.invoice?.id ?? null,
        direction: 'OUT',
        mode: input.mode as never,
        amount: D(input.amount),
        status: 'PAID',
        referenceNo: input.referenceNo ?? null,
        paidAt: input.paidAt ?? new Date(),
        notes: input.notes ?? null,
      },
    });

    const paidAmount = round2(D(order.paidAmount).add(D(input.amount)));
    const paymentStatus = paidAmount.greaterThanOrEqualTo(D(order.totalAmount))
      ? 'PAID'
      : paidAmount.greaterThan(0)
        ? 'PARTIAL'
        : 'PENDING';

    await tx.purchaseOrder.update({
      where: { id: purchaseOrderId },
      data: { paidAmount, paymentStatus },
    });

    if (order.invoice) {
      await tx.invoice.update({
        where: { id: order.invoice.id },
        data: { paidAmount, status: paymentStatus },
      });
    }

    await tx.financeTransaction.create({
      data: {
        ownerType: 'RETAILER',
        retailerId,
        type: 'PAYMENT_OUT',
        direction: 'OUT',
        amount: D(input.amount),
        referenceType: 'PURCHASE_ORDER',
        referenceId: purchaseOrderId,
        partyName: order.vendor.businessName,
        description: `Payment for ${order.poNumber}`,
      },
    });

    await tx.financeTransaction.create({
      data: {
        ownerType: 'VENDOR',
        vendorId: order.vendorId,
        type: 'PAYMENT_IN',
        direction: 'IN',
        amount: D(input.amount),
        referenceType: 'PURCHASE_ORDER',
        referenceId: purchaseOrderId,
        partyName: order.retailer.storeName,
        description: `Payment received for ${order.poNumber}`,
      },
    });

    return payment;
  });
}

// ---------------------------------------------------------------------------
// Purchase returns
// ---------------------------------------------------------------------------

export async function createPurchaseReturn(
  retailerId: string,
  input: {
    purchaseOrderId?: string;
    vendorId: string;
    reason: string;
    items: { productId: string; batchNumber?: string; quantity: number; unitPrice: number; gstRate: number }[];
  },
  userId: string,
) {
  return prisma.$transaction(async (tx) => {
    // Search every warehouse this store has — the batch being returned may
    // not be sitting in whichever one is marked default.
    const warehouseIds = await inventory.listActiveWarehouseIds(tx, { ownerType: 'RETAILER', retailerId });
    const returnNumber = await nextDocumentNumber(tx, 'purchaseReturn');

    let totalAmount = D(0);
    let taxAmount = D(0);

    const items = input.items.map((item) => {
      const tax = computeLineTax({
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        gstRate: item.gstRate,
        priceIncludesTax: WHOLESALE_PRICE_INCLUDES_TAX,
      });
      totalAmount = totalAmount.add(tax.totalAmount);
      taxAmount = taxAmount.add(tax.taxAmount);
      return { ...item, totalAmount: tax.totalAmount };
    });

    const created = await tx.purchaseReturn.create({
      data: {
        returnNumber,
        retailerId,
        vendorId: input.vendorId,
        purchaseOrderId: input.purchaseOrderId ?? null,
        reason: input.reason,
        totalAmount: round2(totalAmount),
        taxAmount: round2(taxAmount),
        status: 'PENDING',
        items: {
          create: items.map((item) => ({
            productId: item.productId,
            batchNumber: item.batchNumber ?? null,
            quantity: item.quantity,
            unitPrice: D(item.unitPrice),
            gstRate: D(item.gstRate),
            totalAmount: item.totalAmount,
          })),
        },
      },
      include: { items: true },
    });

    // Returned goods leave the retailer's stock immediately.
    for (const item of input.items) {
      await inventory.stockOut(
        tx,
        { ownerType: 'RETAILER', retailerId },
        warehouseIds,
        item.productId,
        item.quantity,
        'PURCHASE_RETURN',
        { referenceType: 'PURCHASE_RETURN', referenceId: created.id, notes: input.reason, performedById: userId },
      );
    }

    await tx.financeTransaction.create({
      data: {
        ownerType: 'RETAILER',
        retailerId,
        type: 'PURCHASE_RETURN',
        direction: 'IN',
        amount: round2(totalAmount),
        taxAmount: round2(taxAmount),
        referenceType: 'PURCHASE_RETURN',
        referenceId: created.id,
        description: `Purchase return ${returnNumber}`,
      },
    });

    return created;
  });
}

export async function listPurchaseReturns(
  scope: { vendorId?: string; retailerId?: string },
  query: Record<string, unknown>,
) {
  const { page, limit, skip, take } = getPagination(query);

  const where: Prisma.PurchaseReturnWhereInput = {
    ...(scope.vendorId ? { vendorId: scope.vendorId } : {}),
    ...(scope.retailerId ? { retailerId: scope.retailerId } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.purchaseReturn.findMany({
      where,
      include: {
        items: true,
        vendor: { select: { id: true, businessName: true } },
        retailer: { select: { id: true, storeName: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
    prisma.purchaseReturn.count({ where }),
  ]);

  // `PurchaseReturnItem` only stores `productId` (no defined relation to
  // `Product` to eager-load through) — look product names up in one extra
  // query rather than adding a schema relation/migration for display text.
  const productIds = [...new Set(rows.flatMap((row) => row.items.map((item) => item.productId)))];
  const products = productIds.length
    ? await prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true } })
    : [];
  const productNameById = new Map(products.map((product) => [product.id, product.name]));

  const items = rows.map((row) => ({
    ...row,
    items: row.items.map((item) => ({ ...item, productName: productNameById.get(item.productId) ?? null })),
  }));

  return { items, meta: buildMeta(page, limit, total) };
}

export { DETAIL_INCLUDE as purchaseOrderInclude };
export type { PrismaTx };

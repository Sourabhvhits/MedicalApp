import { z } from 'zod';
import { dateRangeQuery, paginationQuery } from '../../common/query.validation';

export const purchaseOrderStatusEnum = z.enum([
  'DRAFT',
  'PLACED',
  'ACCEPTED',
  'REJECTED',
  'PROCESSING',
  'READY_FOR_DELIVERY',
  'DISPATCHED',
  'DELIVERED',
  'RECEIVED',
  'COMPLETED',
  'CANCELLED',
]);

export const createPurchaseOrderSchema = z.object({
  vendorId: z.string().uuid(),
  expectedDate: z.coerce.date().optional(),
  notes: z.string().trim().max(500).optional(),
  items: z
    .array(
      z.object({
        vendorProductId: z.string().uuid(),
        quantity: z.coerce.number().int().min(1).max(100_000),
      }),
    )
    .min(1, 'Add at least one product to the purchase order'),
});

export const purchaseOrderListQuery = paginationQuery.merge(dateRangeQuery).extend({
  status: purchaseOrderStatusEnum.optional(),
  vendorId: z.string().uuid().optional(),
  retailerId: z.string().uuid().optional(),
  paymentStatus: z.enum(['PENDING', 'PARTIAL', 'PAID', 'FAILED', 'REFUNDED', 'CANCELLED']).optional(),
});

/** Vendor accepting an order may trim quantities to what it can actually ship. */
export const acceptPurchaseOrderSchema = z.object({
  items: z
    .array(
      z.object({
        itemId: z.string().uuid(),
        acceptedQty: z.coerce.number().int().min(0),
        freeQty: z.coerce.number().int().min(0).default(0),
        unitPrice: z.coerce.number().nonnegative().optional(),
      }),
    )
    .optional(),
  notes: z.string().trim().max(500).optional(),
});

export const rejectPurchaseOrderSchema = z.object({
  reason: z.string().trim().min(3).max(500),
});

export const updateStatusSchema = z.object({
  status: purchaseOrderStatusEnum,
  notes: z.string().trim().max(500).optional(),
});

export const dispatchSchema = z.object({
  dispatchNumber: z.string().trim().max(80).optional(),
  courierName: z.string().trim().max(120).optional(),
  trackingNumber: z.string().trim().max(120).optional(),
  dispatchDate: z.coerce.date().optional(),
  items: z
    .array(
      z.object({
        itemId: z.string().uuid(),
        batchNumber: z.string().trim().min(1).max(80),
        manufacturingDate: z.coerce.date().optional(),
        expiryDate: z.coerce.date(),
      }),
    )
    .min(1, 'Batch and expiry details are required for every dispatched line'),
});

/** Retailer confirming physical receipt — this is what creates their stock. */
export const receivePurchaseOrderSchema = z.object({
  warehouseId: z.string().uuid().optional(),
  items: z
    .array(
      z.object({
        itemId: z.string().uuid(),
        receivedQty: z.coerce.number().int().min(0),
        freeQty: z.coerce.number().int().min(0).default(0),
        batchNumber: z.string().trim().min(1).max(80),
        manufacturingDate: z.coerce.date().optional(),
        expiryDate: z.coerce.date(),
        purchasePrice: z.coerce.number().nonnegative().optional(),
        sellingPrice: z.coerce.number().nonnegative().optional(),
        mrp: z.coerce.number().nonnegative().optional(),
      }),
    )
    .min(1),
  notes: z.string().trim().max(500).optional(),
});

export const purchaseReturnSchema = z.object({
  purchaseOrderId: z.string().uuid().optional(),
  vendorId: z.string().uuid(),
  reason: z.string().trim().min(3).max(500),
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        batchNumber: z.string().trim().max(80).optional(),
        quantity: z.coerce.number().int().min(1),
        unitPrice: z.coerce.number().nonnegative(),
        gstRate: z.coerce.number().min(0).max(100).default(0),
      }),
    )
    .min(1),
});

export const recordPaymentSchema = z.object({
  amount: z.coerce.number().positive(),
  mode: z.enum(['CASH', 'UPI', 'CARD', 'NET_BANKING', 'CHEQUE', 'BANK_TRANSFER', 'CREDIT', 'ONLINE']).default('BANK_TRANSFER'),
  referenceNo: z.string().trim().max(120).optional(),
  paidAt: z.coerce.date().optional(),
  notes: z.string().trim().max(500).optional(),
});

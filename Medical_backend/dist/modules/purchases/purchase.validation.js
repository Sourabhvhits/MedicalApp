"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordPaymentSchema = exports.purchaseReturnSchema = exports.receivePurchaseOrderSchema = exports.dispatchSchema = exports.updateStatusSchema = exports.rejectPurchaseOrderSchema = exports.acceptPurchaseOrderSchema = exports.purchaseOrderListQuery = exports.createPurchaseOrderSchema = exports.purchaseOrderStatusEnum = void 0;
const zod_1 = require("zod");
const query_validation_1 = require("../../common/query.validation");
exports.purchaseOrderStatusEnum = zod_1.z.enum([
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
exports.createPurchaseOrderSchema = zod_1.z.object({
    vendorId: zod_1.z.string().uuid(),
    expectedDate: zod_1.z.coerce.date().optional(),
    notes: zod_1.z.string().trim().max(500).optional(),
    items: zod_1.z
        .array(zod_1.z.object({
        vendorProductId: zod_1.z.string().uuid(),
        quantity: zod_1.z.coerce.number().int().min(1).max(100_000),
    }))
        .min(1, 'Add at least one product to the purchase order'),
});
exports.purchaseOrderListQuery = query_validation_1.paginationQuery.merge(query_validation_1.dateRangeQuery).extend({
    status: exports.purchaseOrderStatusEnum.optional(),
    vendorId: zod_1.z.string().uuid().optional(),
    retailerId: zod_1.z.string().uuid().optional(),
    paymentStatus: zod_1.z.enum(['PENDING', 'PARTIAL', 'PAID', 'FAILED', 'REFUNDED', 'CANCELLED']).optional(),
});
/** Vendor accepting an order may trim quantities to what it can actually ship. */
exports.acceptPurchaseOrderSchema = zod_1.z.object({
    items: zod_1.z
        .array(zod_1.z.object({
        itemId: zod_1.z.string().uuid(),
        acceptedQty: zod_1.z.coerce.number().int().min(0),
        freeQty: zod_1.z.coerce.number().int().min(0).default(0),
        unitPrice: zod_1.z.coerce.number().nonnegative().optional(),
    }))
        .optional(),
    notes: zod_1.z.string().trim().max(500).optional(),
});
exports.rejectPurchaseOrderSchema = zod_1.z.object({
    reason: zod_1.z.string().trim().min(3).max(500),
});
exports.updateStatusSchema = zod_1.z.object({
    status: exports.purchaseOrderStatusEnum,
    notes: zod_1.z.string().trim().max(500).optional(),
});
exports.dispatchSchema = zod_1.z.object({
    dispatchNumber: zod_1.z.string().trim().max(80).optional(),
    courierName: zod_1.z.string().trim().max(120).optional(),
    trackingNumber: zod_1.z.string().trim().max(120).optional(),
    dispatchDate: zod_1.z.coerce.date().optional(),
    items: zod_1.z
        .array(zod_1.z.object({
        itemId: zod_1.z.string().uuid(),
        batchNumber: zod_1.z.string().trim().min(1).max(80),
        manufacturingDate: zod_1.z.coerce.date().optional(),
        expiryDate: zod_1.z.coerce.date(),
    }))
        .min(1, 'Batch and expiry details are required for every dispatched line'),
});
/** Retailer confirming physical receipt — this is what creates their stock. */
exports.receivePurchaseOrderSchema = zod_1.z.object({
    warehouseId: zod_1.z.string().uuid().optional(),
    items: zod_1.z
        .array(zod_1.z.object({
        itemId: zod_1.z.string().uuid(),
        receivedQty: zod_1.z.coerce.number().int().min(0),
        freeQty: zod_1.z.coerce.number().int().min(0).default(0),
        batchNumber: zod_1.z.string().trim().min(1).max(80),
        manufacturingDate: zod_1.z.coerce.date().optional(),
        expiryDate: zod_1.z.coerce.date(),
        purchasePrice: zod_1.z.coerce.number().nonnegative().optional(),
        sellingPrice: zod_1.z.coerce.number().nonnegative().optional(),
        mrp: zod_1.z.coerce.number().nonnegative().optional(),
    }))
        .min(1),
    notes: zod_1.z.string().trim().max(500).optional(),
});
exports.purchaseReturnSchema = zod_1.z.object({
    purchaseOrderId: zod_1.z.string().uuid().optional(),
    vendorId: zod_1.z.string().uuid(),
    reason: zod_1.z.string().trim().min(3).max(500),
    items: zod_1.z
        .array(zod_1.z.object({
        productId: zod_1.z.string().uuid(),
        batchNumber: zod_1.z.string().trim().max(80).optional(),
        quantity: zod_1.z.coerce.number().int().min(1),
        unitPrice: zod_1.z.coerce.number().nonnegative(),
        gstRate: zod_1.z.coerce.number().min(0).max(100).default(0),
    }))
        .min(1),
});
exports.recordPaymentSchema = zod_1.z.object({
    amount: zod_1.z.coerce.number().positive(),
    mode: zod_1.z.enum(['CASH', 'UPI', 'CARD', 'NET_BANKING', 'CHEQUE', 'BANK_TRANSFER', 'CREDIT', 'ONLINE']).default('BANK_TRANSFER'),
    referenceNo: zod_1.z.string().trim().max(120).optional(),
    paidAt: zod_1.z.coerce.date().optional(),
    notes: zod_1.z.string().trim().max(500).optional(),
});
//# sourceMappingURL=purchase.validation.js.map
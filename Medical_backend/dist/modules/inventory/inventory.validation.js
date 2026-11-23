"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.warehouseUpdateSchema = exports.warehouseCreateSchema = exports.transactionListQuery = exports.writeOffSchema = exports.batchStatusSchema = exports.adjustStockSchema = exports.addStockSchema = exports.stockSummaryQuery = exports.stockListQuery = exports.batchStatusEnum = void 0;
const zod_1 = require("zod");
const query_validation_1 = require("../../common/query.validation");
exports.batchStatusEnum = zod_1.z.enum(['ACTIVE', 'EXPIRED', 'BLOCKED', 'DEPLETED']);
exports.stockListQuery = query_validation_1.paginationQuery.extend({
    warehouseId: zod_1.z.string().uuid().optional(),
    productId: zod_1.z.string().uuid().optional(),
    categoryId: zod_1.z.string().uuid().optional(),
    batchNumber: zod_1.z.string().trim().max(80).optional(),
    status: exports.batchStatusEnum.optional(),
    expiringInDays: zod_1.z.coerce.number().int().min(1).max(3650).optional(),
    includeDepleted: zod_1.z.coerce.boolean().default(false),
});
exports.stockSummaryQuery = query_validation_1.paginationQuery.extend({
    categoryId: zod_1.z.string().uuid().optional(),
    lowStockOnly: zod_1.z.coerce.boolean().default(false),
});
exports.addStockSchema = zod_1.z.object({
    productId: zod_1.z.string().uuid(),
    warehouseId: zod_1.z.string().uuid().optional(),
    batchNumber: zod_1.z.string().trim().min(1).max(80),
    quantity: zod_1.z.coerce.number().int().min(0).max(1_000_000),
    freeQuantity: zod_1.z.coerce.number().int().min(0).max(1_000_000).default(0),
    purchasePrice: zod_1.z.coerce.number().nonnegative().default(0),
    sellingPrice: zod_1.z.coerce.number().nonnegative().default(0),
    mrp: zod_1.z.coerce.number().nonnegative().default(0),
    gstRate: zod_1.z.coerce.number().min(0).max(100).default(0),
    manufacturingDate: zod_1.z.coerce.date().optional(),
    expiryDate: zod_1.z.coerce.date(),
    supplierName: zod_1.z.string().trim().max(191).optional(),
    supplierVendorId: zod_1.z.string().uuid().optional(),
    notes: zod_1.z.string().trim().max(500).optional(),
}).superRefine((data, ctx) => {
    if (data.quantity === 0 && data.freeQuantity === 0) {
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, path: ['quantity'], message: 'Enter a quantity greater than zero' });
    }
    if (data.manufacturingDate && data.manufacturingDate >= data.expiryDate) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            path: ['expiryDate'],
            message: 'Expiry date must be after the manufacturing date',
        });
    }
});
exports.adjustStockSchema = zod_1.z.object({
    quantity: zod_1.z.coerce.number().int().min(0).max(1_000_000),
    reason: zod_1.z.string().trim().min(3).max(500),
});
exports.batchStatusSchema = zod_1.z.object({
    status: exports.batchStatusEnum,
});
exports.writeOffSchema = zod_1.z.object({
    productId: zod_1.z.string().uuid(),
    warehouseId: zod_1.z.string().uuid().optional(),
    quantity: zod_1.z.coerce.number().int().min(1),
    type: zod_1.z.enum(['DAMAGE', 'EXPIRED']),
    reason: zod_1.z.string().trim().min(3).max(500),
});
exports.transactionListQuery = query_validation_1.paginationQuery.merge(query_validation_1.dateRangeQuery).extend({
    productId: zod_1.z.string().uuid().optional(),
    referenceId: zod_1.z.string().uuid().optional(),
    type: zod_1.z
        .enum([
        'OPENING_STOCK',
        'PURCHASE',
        'SALE',
        'SALE_RETURN',
        'PURCHASE_RETURN',
        'ADJUSTMENT',
        'DAMAGE',
        'EXPIRED',
        'TRANSFER',
        'ORDER_RESERVATION',
        'ORDER_RELEASE',
    ])
        .optional(),
});
exports.warehouseCreateSchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(2).max(150),
    code: zod_1.z.string().trim().min(1).max(32).regex(/^[A-Z0-9_-]+$/, 'Use uppercase letters, numbers, - or _'),
    addressLine1: zod_1.z.string().trim().max(255).optional(),
    city: zod_1.z.string().trim().max(100).optional(),
    state: zod_1.z.string().trim().max(100).optional(),
    pincode: zod_1.z.string().trim().max(12).optional(),
    isDefault: zod_1.z.coerce.boolean().default(false),
});
exports.warehouseUpdateSchema = exports.warehouseCreateSchema.partial().extend({
    isActive: zod_1.z.coerce.boolean().optional(),
});
//# sourceMappingURL=inventory.validation.js.map
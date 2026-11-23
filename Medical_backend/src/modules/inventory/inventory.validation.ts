import { z } from 'zod';
import { dateRangeQuery, paginationQuery } from '../../common/query.validation';

export const batchStatusEnum = z.enum(['ACTIVE', 'EXPIRED', 'BLOCKED', 'DEPLETED']);

export const stockListQuery = paginationQuery.extend({
  warehouseId: z.string().uuid().optional(),
  productId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  batchNumber: z.string().trim().max(80).optional(),
  status: batchStatusEnum.optional(),
  expiringInDays: z.coerce.number().int().min(1).max(3650).optional(),
  includeDepleted: z.coerce.boolean().default(false),
});

export const stockSummaryQuery = paginationQuery.extend({
  categoryId: z.string().uuid().optional(),
  lowStockOnly: z.coerce.boolean().default(false),
});

export const addStockSchema = z.object({
  productId: z.string().uuid(),
  warehouseId: z.string().uuid().optional(),
  batchNumber: z.string().trim().min(1).max(80),
  quantity: z.coerce.number().int().min(0).max(1_000_000),
  freeQuantity: z.coerce.number().int().min(0).max(1_000_000).default(0),
  purchasePrice: z.coerce.number().nonnegative().default(0),
  sellingPrice: z.coerce.number().nonnegative().default(0),
  mrp: z.coerce.number().nonnegative().default(0),
  gstRate: z.coerce.number().min(0).max(100).default(0),
  manufacturingDate: z.coerce.date().optional(),
  expiryDate: z.coerce.date(),
  supplierName: z.string().trim().max(191).optional(),
  supplierVendorId: z.string().uuid().optional(),
  notes: z.string().trim().max(500).optional(),
}).superRefine((data, ctx) => {
  if (data.quantity === 0 && data.freeQuantity === 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['quantity'], message: 'Enter a quantity greater than zero' });
  }
  if (data.manufacturingDate && data.manufacturingDate >= data.expiryDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['expiryDate'],
      message: 'Expiry date must be after the manufacturing date',
    });
  }
});

export const adjustStockSchema = z.object({
  quantity: z.coerce.number().int().min(0).max(1_000_000),
  reason: z.string().trim().min(3).max(500),
});

export const batchStatusSchema = z.object({
  status: batchStatusEnum,
});

export const writeOffSchema = z.object({
  productId: z.string().uuid(),
  warehouseId: z.string().uuid().optional(),
  quantity: z.coerce.number().int().min(1),
  type: z.enum(['DAMAGE', 'EXPIRED']),
  reason: z.string().trim().min(3).max(500),
});

export const transactionListQuery = paginationQuery.merge(dateRangeQuery).extend({
  productId: z.string().uuid().optional(),
  referenceId: z.string().uuid().optional(),
  type: z
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

export const warehouseCreateSchema = z.object({
  name: z.string().trim().min(2).max(150),
  code: z.string().trim().min(1).max(32).regex(/^[A-Z0-9_-]+$/, 'Use uppercase letters, numbers, - or _'),
  addressLine1: z.string().trim().max(255).optional(),
  city: z.string().trim().max(100).optional(),
  state: z.string().trim().max(100).optional(),
  pincode: z.string().trim().max(12).optional(),
  isDefault: z.coerce.boolean().default(false),
});

export const warehouseUpdateSchema = warehouseCreateSchema.partial().extend({
  isActive: z.coerce.boolean().optional(),
});
